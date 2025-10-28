import scrapy
import json
import urllib.parse


class FotocasaSpider(scrapy.Spider):
    name = "fotocasa"
    allowed_domains = ["fotocasa.es", "web.gw.fotocasa.es"]

    custom_settings = {
        "DOWNLOAD_DELAY": 1.5,
        "AUTOTHROTTLE_ENABLED": True,
        "AUTOTHROTTLE_START_DELAY": 1,
        "AUTOTHROTTLE_MAX_DELAY": 10,
        "CONCURRENT_REQUESTS": 2,
        "LOG_LEVEL": "INFO",
        "RETRY_HTTP_CODES": [429, 500, 502, 503, 504],
        "RETRY_TIMES": 3,
    }

    def __init__(self, location_id="804,0,0,0,0,0,0,0,0", operation_id=1, property_type_id=1, max_pages=50, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.location_id = location_id
        self.operation_id = int(operation_id)
        self.property_type_id = int(property_type_id)
        self.max_pages = int(max_pages)
        self.page = 1

        self.user_agent = (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/130.0.0.0 Safari/537.36"
        )

    # ======================================================================
    #                          PETICIÓN SEARCHURL
    # ======================================================================

    def start_requests(self):
        url = (
            "https://web.gw.fotocasa.es/v2/propertysearch/searchurl"
            f"?combinedLocationIds={self.location_id}"
            f"&operationId={self.operation_id}"
            f"&propertyTypeId={self.property_type_id}"
            "&culture=es-ES"
        )

        headers = {
            "accept": "application/json, text/plain, */*",
            "accept-encoding": "gzip, deflate, br, zstd",
            "accept-language": "es-ES,es;q=0.9",
            "origin": "https://www.fotocasa.es",
            "referer": "https://www.fotocasa.es/es/comprar/viviendas/murcia-capital/todas-las-zonas/l",
            "sec-ch-ua": '"Chromium";v="130", "Not=A?Brand";v="24", "Google Chrome";v="130"',
            "sec-ch-ua-mobile": "?0",
            "sec-ch-ua-platform": '"Windows"',
            "sec-fetch-dest": "empty",
            "sec-fetch-mode": "cors",
            "sec-fetch-site": "same-site",
            "user-agent": self.user_agent,
            "x-api-key": "fc_web",
            "x-client-device": "web",
            "x-application-id": "1",
            "host": "web.gw.fotocasa.es",
        }

        self.logger.info(f"🌍 Solicitando URL dinámica desde {url}")
        yield scrapy.Request(url, headers=headers, callback=self.parse_searchurl, dont_filter=True)

    # ======================================================================
    #                         PARSE DE SEARCHURL
    # ======================================================================

    def parse_searchurl(self, response):
        if response.status != 200:
            self.logger.error(f"❌ Error {response.status} en /searchurl: {response.text[:300]}")
            return

        try:
            data = json.loads(response.text)
        except json.JSONDecodeError:
            self.logger.error("❌ No se pudo parsear JSON de /searchurl")
            self.logger.debug(response.text[:500])
            return

        search_url = data.get("searchUrl")
        if not search_url:
            self.logger.error("❌ No se encontró 'searchUrl' en la respuesta.")
            self.logger.debug(response.text[:500])
            return

        csrf_token = response.headers.get("X-Adevinta-Csrf-Token", b"").decode("utf-8")
        cookies = {"_csrf": csrf_token} if csrf_token else {}

        full_url = urllib.parse.urljoin("https://web.gw.fotocasa.es", search_url)
        self.logger.info(f"✅ URL dinámica obtenida: {full_url[:120]}...")

        headers = {
            **response.request.headers,
            "x-adevinta-csrf-token": csrf_token,
        }

        yield scrapy.Request(
            full_url,
            headers=headers,
            cookies=cookies,
            callback=self.parse_results,
            cb_kwargs={"page": 1, "headers": headers, "cookies": cookies},
            dont_filter=True,
        )

    # ======================================================================
    #                         PARSE DE RESULTADOS
    # ======================================================================

    def parse_results(self, response, page, headers, cookies):
        if response.status != 200:
            self.logger.error(f"❌ Error {response.status} en resultados: {response.text[:500]}")
            return

        try:
            data = json.loads(response.text)
        except json.JSONDecodeError:
            self.logger.error("❌ No se pudo parsear JSON de resultados")
            self.logger.debug(response.text[:500])
            return

        results = data.get("listResult") or data.get("realEstates") or data.get("items") or []
        self.logger.info(f"📦 Página {page}: {len(results)} resultados")

        for item in results:
            yield {
                "id": item.get("id"),
                "title": item.get("title"),
                "price": item.get("priceInfo", {}).get("price"),
                "url": item.get("detail", {}).get("url"),
                "address": item.get("address", {}).get("value"),
                "latitude": item.get("location", {}).get("latitude"),
                "longitude": item.get("location", {}).get("longitude"),
                "agency": item.get("agency", {}).get("name"),
            }

        next_page = (data.get("pagination") or {}).get("nextPage")
        if page < self.max_pages and next_page:
            next_url = urllib.parse.urljoin("https://web.gw.fotocasa.es", next_page)
            self.logger.info(f"➡️ Página siguiente: {page + 1}")
            yield scrapy.Request(
                next_url,
                headers=headers,
                cookies=cookies,
                callback=self.parse_results,
                cb_kwargs={"page": page + 1, "headers": headers, "cookies": cookies},
                dont_filter=True,
            )
        else:
            self.logger.info("🏁 Fin del scraping de Fotocasa.")
