"""
Spider de Fotocasa (2025, versión optimizada)
---------------------------------------------
✅ Flujo correcto en dos pasos:
   1. /v2/propertysearch/searchurl  → obtiene token y cookie CSRF
   2. /v2/propertysearch/search     → obtiene resultados reales
✅ Configurado para Murcia capital
✅ Headers realistas basados en análisis HAR
✅ Soporta paginación paralela
"""

import scrapy
import json
import logging

class FotocasaSpider(scrapy.Spider):
    name = "fotocasa"
    custom_settings = {
        "DOWNLOAD_DELAY": 1.5,
        "CONCURRENT_REQUESTS": 2,
        "AUTOTHROTTLE_ENABLED": True,
        "AUTOTHROTTLE_START_DELAY": 1,
        "AUTOTHROTTLE_MAX_DELAY": 10,
        "RETRY_HTTP_CODES": [429, 500, 502, 503, 504],
    }

    def __init__(self, max_pages=5, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.max_pages = int(max_pages)
        # Murcia capital
        self.location_id = "804,0,0,0,0,0,0,0,0"

    def start_requests(self):
        url = (
            "https://web.gw.fotocasa.es/v2/propertysearch/searchurl?"
            f"combinedLocationIds={self.location_id}&culture=es-ES"
        )
        headers = {
            "User-Agent": "Mozilla/5.0 (X11; Ubuntu; Linux x86_64)",
            "Accept": "application/json, text/plain, */*",
            "Accept-Language": "es-ES,es;q=0.9",
            "Accept-Encoding": "identity",
            "Referer": "https://www.fotocasa.es/",
            "Origin": "https://www.fotocasa.es",
            "Connection": "keep-alive",
        }
        self.logger.info("🌍 Solicitando token CSRF desde %s", url)
        yield scrapy.Request(url, headers=headers, callback=self.parse_csrf, meta={"headers": headers})

    def parse_csrf(self, response):
        token = response.headers.get("X-Adevinta-Csrf-Token", b"").decode()
        cookie = response.headers.getlist("Set-Cookie")
        cookie_value = ""
        for c in cookie:
            if b"_csrf=" in c:
                cookie_value = c.decode().split("_csrf=")[1].split(";")[0]
                break

        if not token or not cookie_value:
            self.logger.error("❌ No se obtuvo token o cookie CSRF.")
            return

        self.logger.info("✅ Token CSRF: %s...", token[:12])
        self.logger.info("✅ Cookie CSRF: %s...", cookie_value[:12])

        headers = response.meta["headers"].copy()
        headers["X-Adevinta-Csrf-Token"] = token
        headers["Cookie"] = f"_csrf={cookie_value}"

        for page in range(1, self.max_pages + 1):
            url = (
                "https://web.gw.fotocasa.es/v2/propertysearch/search?"
                f"combinedLocationIds={self.location_id}&culture=es-ES&pageNumber={page}"
            )
            yield scrapy.Request(url, headers=headers, callback=self.parse_list, meta={"page": page})

    def parse_list(self, response):
        page = response.meta["page"]
        self.logger.info("📄 Procesando página %s", page)
        try:
            data = json.loads(response.text)
        except json.JSONDecodeError:
            self.logger.error("❌ Error parseando JSON en página %s", page)
            return

        for item in data.get("realEstates", []):
            yield {
                "id": item.get("id"),
                "title": item.get("title"),
                "price": item.get("price", {}).get("amount"),
                "propertyType": item.get("propertyType"),
                "province": item.get("province"),
                "municipality": item.get("municipality"),
                "neighborhood": item.get("district"),
                "url": f"https://www.fotocasa.es{item.get('detailUrl', '')}",
            }

        self.logger.info("✅ %d propiedades extraídas en página %s", len(data.get("realEstates", [])), page)
