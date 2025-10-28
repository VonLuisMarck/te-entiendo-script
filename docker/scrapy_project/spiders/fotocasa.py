import scrapy
import json
import logging
import uuid


class FotocasaSpainSpider(scrapy.Spider):
    name = "fotocasa"

    custom_settings = {
        "DOWNLOAD_DELAY": 1.5,
        "CONCURRENT_REQUESTS": 2,
        "AUTOTHROTTLE_ENABLED": True,
        "AUTOTHROTTLE_START_DELAY": 1,
        "AUTOTHROTTLE_MAX_DELAY": 10,
        "RETRY_HTTP_CODES": [429, 500, 502, 503, 504],
        "RETRY_TIMES": 3,
    }

    def __init__(self, max_pages=5, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.max_pages = int(max_pages)
        # Murcia capital (ID obtenido del HAR)
        self.location_id = "804,0,0,0,0,0,0,0,0"

    def start_requests(self):
        """Primera petición: obtener el token CSRF y la cookie."""
        url = (
            "https://web.gw.fotocasa.es/v2/propertysearch/searchurl?"
            f"combinedLocationIds={self.location_id}&culture=es-ES"
        )

        headers = {
            "User-Agent": (
                "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
                "(KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36"
            ),
            "Accept": "application/json, text/plain, */*",
            "Accept-Language": "es-ES,es;q=0.9",
            "Accept-Encoding": "identity",
            "Referer": "https://www.fotocasa.es/",
            "Origin": "https://www.fotocasa.es",
            "Connection": "keep-alive",
            # 🔑 Headers reales desde el HAR
            "X-Api-Key": "fc_web",
            "X-Application-Id": "1",
            "X-Client-Device": "web",
            "X-Device-Id": str(uuid.uuid4()),  # valor único por ejecución
            "Sec-Fetch-Mode": "cors",
            "Sec-Fetch-Dest": "empty",
            "Sec-Fetch-Site": "same-origin",
        }

        self.logger.info("🌍 Solicitando token CSRF desde %s", url)
        yield scrapy.Request(
            url,
            headers=headers,
            callback=self.parse_csrf,
            meta={"headers": headers},
            dont_filter=True,
        )

    def parse_csrf(self, response):
        """Extrae el token y cookie CSRF del primer request."""
        if response.status == 403:
            self.logger.error("❌ Respuesta 403 Forbidden al solicitar /searchurl. Revisa headers o IP bloqueada.")
            return
        elif response.status != 200:
            self.logger.error("⚠️ Respuesta inesperada (%s) en /searchurl", response.status)
            return

        token = response.headers.get("X-Adevinta-Csrf-Token", b"").decode()
        cookie = response.headers.getlist("Set-Cookie")
        cookie_value = ""
        for c in cookie:
            if b"_csrf=" in c:
                cookie_value = c.decode().split("_csrf=")[1].split(";")[0]
                break

        if not token or not cookie_value:
            self.logger.error("❌ No se obtuvo token o cookie CSRF.")
            self.logger.debug("Headers recibidos: %s", response.headers)
            return

        self.logger.info("✅ Token CSRF: %s...", token[:12])
        self.logger.info("✅ Cookie CSRF: %s...", cookie_value[:12])

        headers = response.meta["headers"].copy()
        headers["X-Adevinta-Csrf-Token"] = token
        headers["Cookie"] = f"_csrf={cookie_value}"

        # Repite el resto de headers que mantiene el front
        headers["Referer"] = "https://www.fotocasa.es/es/"
        headers["Origin"] = "https://www.fotocasa.es"

        # Empieza a recorrer páginas
        for page in range(1, self.max_pages + 1):
            url = (
                "https://web.gw.fotocasa.es/v2/propertysearch/search?"
                f"combinedLocationIds={self.location_id}&culture=es-ES&pageNumber={page}"
            )
            yield scrapy.Request(
                url,
                headers=headers,
                callback=self.parse_list,
                meta={"page": page},
                dont_filter=True,
            )

    def parse_list(self, response):
        """Procesa el listado JSON de propiedades."""
        page = response.meta["page"]
        if response.status != 200:
            self.logger.warning("⚠️ Página %s devolvió %s", page, response.status)
            return

        try:
            data = json.loads(response.text)
        except json.JSONDecodeError:
            self.logger.error("❌ Error parseando JSON en página %s", page)
            self.logger.debug("Contenido: %s", response.text[:500])
            return

        listings = data.get("realEstates", [])
        self.logger.info("📄 Página %s: %d propiedades", page, len(listings))

        for item in listings:
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
