import scrapy
import json
import urllib.parse


class FotocasaSpider(scrapy.Spider):
    name = "fotocasa"
    allowed_domains = ["fotocasa.es", "web.gw.fotocasa.es"]

    custom_settings = {
        "DOWNLOAD_DELAY": 1.5,
        "AUTOTHROTTLE_ENABLED": True,
        "CONCURRENT_REQUESTS": 2,
        "LOG_LEVEL": "INFO",
        "RETRY_HTTP_CODES": [429, 500, 502, 503, 504],
        "RETRY_TIMES": 3,
    }

    def __init__(self, location_id="804,0,0,0,0,0,0,0,0", max_pages=50, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.location_id = location_id
        self.max_pages = int(max_pages)
        self.page = 1

    def start_requests(self):
        """Primer paso: obtener token y URL de búsqueda dinámica."""
        url = (
            f"https://web.gw.fotocasa.es/v2/propertysearch/searchurl"
            f"?combinedLocationIds={self.location_id}&culture=es-ES"
        )
        self.logger.info(f"🌍 Solicitando URL dinámica desde {url}")
        yield scrapy.Request(url, callback=self.parse_searchurl)

    def parse_searchurl(self, response):
        """Procesa la respuesta inicial: obtiene searchUrl y token CSRF."""
        if response.status != 200:
            self.logger.error(f"❌ Error {response.status} en /searchurl: {response.text[:500]}")
            return

        data = json.loads(response.text)
        search_url = data.get("searchUrl")
        if not search_url:
            self.logger.error("❌ No se encontró 'searchUrl' en la respuesta.")
            return

        csrf_token = response.headers.get("X-Adevinta-Csrf-Token", "").decode("utf-8")
        cookie_header = response.headers.get("Set-Cookie", b"").decode("utf-8")
        csrf_cookie = None
        if "_csrf=" in cookie_header:
            csrf_cookie = cookie_header.split("_csrf=")[1].split(";")[0]

        self.logger.info(f"✅ URL dinámica: {search_url}")
        self.logger.info(f"✅ Token CSRF: {csrf_token[:12]}... | Cookie CSRF: {csrf_cookie[:10]}...")

        # Construimos la URL completa para la primera página
        full_url = urllib.parse.urljoin("https://web.gw.fotocasa.es", search_url)

        headers = {
            "X-Api-Key": "fc_web",
            "X-Adevinta-Csrf-Token": csrf_token,
            "X-Application-Id": "1",
            "X-Client-Device": "web",
            "X-Device-Id": "scrapy-agent",
            "Origin": "https://www.fotocasa.es",
            "Referer": "https://www.fotocasa.es/",
            "Accept": "application/json, text/plain, */*",
            "Accept-Language": "es-ES,es;q=0.9",
        }
        cookies = {"_csrf": csrf_cookie} if csrf_cookie else {}

        yield scrapy.Request(
            full_url,
            headers=headers,
            cookies=cookies,
            callback=self.parse_results,
            cb_kwargs={"page": 1, "headers": headers, "cookies": cookies},
        )

    def parse_results(self, response, page, headers, cookies):
        """Procesa cada página de resultados."""
        if response.status != 200:
            self.logger.error(f"❌ Error {response.status} en /search (página {page})")
            self.logger.debug(response.text[:500])
            return

        data = json.loads(response.text)
        results = (
            data.get("listResult") or
            data.get("realEstates") or
            data.get("items") or []
        )

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

        # Paginación
        if page < self.max_pages and "nextPage" in (data.get("pagination", {}) or {}):
            next_url = urllib.parse.urljoin("https://web.gw.fotocasa.es", data["pagination"]["nextPage"])
            yield scrapy.Request(
                next_url,
                headers=headers,
                cookies=cookies,
                callback=self.parse_results,
                cb_kwargs={"page": page + 1, "headers": headers, "cookies": cookies},
            )
        else:
            self.logger.info("🏁 Fin del scraping de Fotocasa.")
