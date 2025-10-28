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

    def __init__(self, location_id="804,0,0,0,0,0,0,0,0", max_pages=50, *args, **kwargs):
        """
        location_id: ID combinado de la localización (por ejemplo 804 → Murcia Capital)
        max_pages: número máximo de páginas a scrapear
        """
        super().__init__(*args, **kwargs)
        self.location_id = location_id
        self.max_pages = int(max_pages)
        self.page = 1

        # User-Agent real de navegador (sin rotación)
        self.user_agent = (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/130.0.0.0 Safari/537.36"
        )

    # =============================
    #        FLUJO PRINCIPAL
    # =============================

    def start_requests(self):
        """Paso 1: obtener token y URL dinámica desde /searchurl"""
        url = (
            "https://web.gw.fotocasa.es/v2/propertysearch/searchurl"
            f"?combinedLocationIds={self.location_id}&culture=es-ES"
        )

        headers = {
            "User-Agent": self.user_agent,
            "Accept": "application/json, text/plain, */*",
            "Accept-Language": "es-ES,es;q=0.9",
            "Origin": "https://www.fotocasa.es",
            "Referer": "https://www.fotocasa.es/es/comprar/viviendas/murcia-capital/todas-las-zonas/l",
            "X-Api-Key": "fc_web",
            "X-Client-Device": "web",
            "X-Application-Id": "1",
        }

        self.logger.info(f"🌍 Solicitando URL dinámica desde {url}")
        yield scrapy.Request(url, headers=headers, callback=self.parse_searchurl, dont_filter=True)

    def parse_searchurl(self, response):
        """Paso 2: procesar la respuesta inicial y obtener la URL dinámica de búsqueda"""
        if response.status != 200:
            self.logger.error(f"❌ Error {response.status} en /searchurl: {response.text[:500]}")
            return

        try:
            data = json.loads(response.text)
        except json.JSONDecodeError:
            self.logger.error("❌ No se pudo parsear el JSON de /searchurl")
            return

        search_url = data.get("searchUrl")
        if not search_url:
            self.logger.error("❌ No se encontró 'searchUrl' en la respuesta.")
            self.logger.debug(response.text[:800])
            return

        csrf_token = response.headers.get("X-Adevinta-Csrf-Token", b"").decode("utf-8")
        cookie_header = response.headers.get("Set-Cookie", b"").decode("utf-8")
        csrf_cookie = None
        if "_csrf=" in cookie_header:
            csrf_cookie = cookie_header.split("_csrf=")[1].split(";")[0]

        self.logger.info(f"✅ URL dinámica obtenida")
        self.logger.info(f"   searchUrl: {search_url[:120]}...")
        self.logger.info(f"   CSRF token: {csrf_token[:12]}... | cookie: {csrf_cookie[:12]}...")

        # Construir URL completa
        full_url = urllib.parse.urljoin("https://web.gw.fotocasa.es", search_url)

        headers = {
            "User-Agent": self.user_agent,
            "Accept": "application/json, text/plain, */*",
            "Accept-Language": "es-ES,es;q=0.9",
            "Origin": "https://www.fotocasa.es",
            "Referer": "https://www.fotocasa.es/",
            "X-Api-Key": "fc_web",
            "X-Application-Id": "1",
            "X-Client-Device": "web",
            "X-Adevinta-Csrf-Token": csrf_token,
        }
        cookies = {"_csrf": csrf_cookie} if csrf_cookie else {}

        yield scrapy.Request(
            full_url,
            headers=headers,
            cookies=cookies,
            callback=self.parse_results,
            cb_kwargs={"page": 1, "headers": headers, "cookies": cookies},
            dont_filter=True,
        )

    def parse_results(self, response, page, headers, cookies):
        """Paso 3: procesar los resultados de la búsqueda y seguir la paginación."""
        if response.status != 200:
            self.logger.error(f"❌ Error {response.status} en /search (página {page})")
            self.logger.debug(response.text[:500])
            return

        try:
            data = json.loads(response.text)
        except json.JSONDecodeError:
            self.logger.error("❌ No se pudo parsear JSON de resultados")
            return

        results = (
            data.get("listResult")
            or data.get("realEstates")
            or data.get("items")
            or []
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

        # Paginación (si hay siguiente)
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
