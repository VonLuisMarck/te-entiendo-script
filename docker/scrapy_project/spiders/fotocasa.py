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

    def __init__(self, max_pages=5, location_id="804,0,0,0,0,0,0,0,0", *args, **kwargs):
        """
        max_pages: número máximo de páginas a recorrer.
        location_id: ID combinado de localización. Ejemplo:
            - Murcia capital: "804,0,0,0,0,0,0,0,0"
            - Toda España: "724,0,0,0,0,0,0,0,0"
        """
        super().__init__(*args, **kwargs)
        self.max_pages = int(max_pages)
        self.location_id = location_id

    # -------------------------------------------------------------------------
    # 1️⃣ Solicitud inicial: obtener token y cookie CSRF
    # -------------------------------------------------------------------------
    def start_requests(self):
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
            "X-Api-Key": "fc_web",
            "X-Application-Id": "1",
            "X-Client-Device": "web",
            "X-Device-Id": str(uuid.uuid4()),
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

    # -------------------------------------------------------------------------
    # 2️⃣ Parsear token y cookie CSRF
    # -------------------------------------------------------------------------
    def parse_csrf(self, response):
        if response.status == 403:
            self.logger.error("❌ 403 Forbidden al solicitar /searchurl.")
            return
        if response.status != 200:
            self.logger.error("⚠️ Respuesta inesperada: %s", response.status)
            return

        token = response.headers.get("X-Adevinta-Csrf-Token", b"").decode()
        cookie_value = ""
        for c in response.headers.getlist("Set-Cookie"):
            c = c.decode()
            if "_csrf=" in c:
                cookie_value = c.split("_csrf=")[1].split(";")[0]
                break

        if not token or not cookie_value:
            self.logger.error("❌ No se obtuvo token o cookie CSRF.")
            return

        self.logger.info("✅ Token CSRF: %s...", token[:12])
        self.logger.info("✅ Cookie CSRF: %s...", cookie_value[:10])

        headers = response.meta["headers"]
        headers.update({
            "X-Adevinta-Csrf-Token": token,
            "Cookie": f"_csrf={cookie_value}",
            "Content-Type": "application/json",
        })

        yield from self.fetch_page(headers, page=1)

    # -------------------------------------------------------------------------
    # 3️⃣ Enviar POST /search con JSON body
    # -------------------------------------------------------------------------
    def fetch_page(self, headers, page):
        if page > self.max_pages:
            return

        url = "https://web.gw.fotocasa.es/v2/propertysearch/search"

        body = {
            "searchParameters": {
                "location": {"combinedLocationIds": self.location_id},
                "culture": "es-ES",
                "sortOrder": "desc",
                "sortType": "relevance",
                "pageNumber": page,
                "platformId": 1,
            }
        }

        self.logger.info("📦 Descargando página %s (POST)", page)

        yield scrapy.Request(
            url,
            method="POST",
            headers=headers,
            body=json.dumps(body),
            callback=self.parse_list,
            meta={"headers": headers, "page": page},
            dont_filter=True,
        )

    # -------------------------------------------------------------------------
    # 4️⃣ Procesar propiedades de cada página
    # -------------------------------------------------------------------------
    def parse_list(self, response):
        page = response.meta["page"]

        if response.status != 200:
            self.logger.warning("⚠️ Página %s devolvió %s", page, response.status)
            return

        try:
            data = json.loads(response.text)
        except json.JSONDecodeError:
            self.logger.error("❌ No se pudo decodificar JSON de página %s", page)
            return

        results = data.get("listResult", [])
        self.logger.info("🏠 Página %s -> %d propiedades", page, len(results))

        for prop in results:
            yield {
                "id": prop.get("id"),
                "title": prop.get("title"),
                "price": prop.get("price"),
                "propertyType": prop.get("propertyType"),
                "url": prop.get("detail", {}).get("url"),
                "agency": prop.get("agency", {}).get("name"),
                "city": prop.get("location", {}).get("city"),
                "province": prop.get("location", {}).get("province"),
            }

        if len(results) > 0 and page < self.max_pages:
            yield from self.fetch_page(response.meta["headers"], page + 1)
