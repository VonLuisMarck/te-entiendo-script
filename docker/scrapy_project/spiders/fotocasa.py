"""
Spider de Fotocasa (2025, versión final)
----------------------------------------
✅ Flujo real:
   1. GET /v2/propertysearch/searchurl → obtiene token y cookie CSRF
   2. POST /v2/propertysearch/search   → obtiene resultados reales
✅ Maneja gzip y tokenización automática
✅ Soporta paginación y filtros globales (toda España)
"""

import scrapy
import time
import urllib.parse
import gzip
import json
from config import get_random_headers, get_random_delay, SCRAPY_SETTINGS


API_BASE = "https://web.gw.fotocasa.es/v2/propertysearch"


class FotocasaApiSpider(scrapy.Spider):
    name = "fotocasa_api"
    custom_settings = SCRAPY_SETTINGS

    def __init__(self, max_pages=50, **kwargs):
        super().__init__(**kwargs)
        self.now = int(time.time())
        self.max_pages = int(max_pages)
        # 724 = España
        self.combined_location_ids = "724,0,0,0,0,0,0,0,0"

    # ---------------------------- #
    # Paso 1 — Obtener token y cookie CSRF
    # ---------------------------- #
    def start_requests(self):
        """Primera petición: resolver token y cookie"""
        headers = get_random_headers()
        headers["Accept-Encoding"] = "identity"

        url = f"{API_BASE}/searchurl?{urllib.parse.urlencode({'combinedLocationIds': self.combined_location_ids, 'culture': 'es-ES'})}"

        self.logger.info("🌍 Solicitando token CSRF desde /searchurl")
        self.logger.info(f"URL: {url}")

        yield scrapy.Request(
            url,
            method="GET",
            headers=headers,
            callback=self.parse_csrf,
            dont_filter=True,
        )

    def parse_csrf(self, response):
        """Extrae token y cookie CSRF de los headers"""
        csrf_cookie = None
        csrf_token = None

        # Buscar cookie _csrf
        set_cookie = response.headers.getlist(b"Set-Cookie")
        for ck in set_cookie:
            if b"_csrf=" in ck:
                csrf_cookie = ck.decode("utf-8").split("_csrf=")[1].split(";")[0]
                break

        # Buscar header X-Adevinta-Csrf-Token
        csrf_token = response.headers.get(b"X-Adevinta-Csrf-Token")
        if csrf_token:
            csrf_token = csrf_token.decode("utf-8")

        if not csrf_cookie or not csrf_token:
            self.logger.error("❌ No se pudo obtener token/cookie CSRF")
            self.logger.error(f"Response headers: {response.headers}")
            return

        self.logger.info(f"✅ Token CSRF obtenido: {csrf_token[:10]}...")
        self.logger.info(f"✅ Cookie CSRF: {csrf_cookie[:10]}...")

        # Lanzar búsqueda real
        yield from self.fetch_results(page=1, csrf_cookie=csrf_cookie, csrf_token=csrf_token)

    # ---------------------------- #
    # Paso 2 — Obtener resultados reales
    # ---------------------------- #
    def fetch_results(self, page, csrf_cookie, csrf_token):
        """Lanza petición real a /search (POST con JSON)"""
        headers = get_random_headers()
        headers["Accept-Encoding"] = "identity"
        headers["X-Adevinta-Csrf-Token"] = csrf_token
        headers["Cookie"] = f"_csrf={csrf_cookie}"
        headers["Referer"] = "https://www.fotocasa.es/"
        headers["Origin"] = "https://www.fotocasa.es"
        headers["Content-Type"] = "application/json"

        body = {
            "combinedLocationIds": self.combined_location_ids,
            "culture": "es-ES",
            "latitude": 40,
            "longitude": -4,
            "text": "",
            "pageNumber": page,
            "sortOrder": "desc",
            "sortType": "publicationDate",
        }

        url = f"{API_BASE}/search"
        self.logger.info(f"🏠 Descargando página {page} (POST) -> {url}")

        yield scrapy.Request(
            url,
            method="POST",
            headers=headers,
            body=json.dumps(body),
            callback=self.parse_results,
            cb_kwargs={
                "page": page,
                "csrf_cookie": csrf_cookie,
                "csrf_token": csrf_token,
            },
            dont_filter=True,
        )

    # ---------------------------- #
    # Parseo del JSON
    # ---------------------------- #
    def parse_results(self, response, page, csrf_cookie, csrf_token):
        """Procesa la respuesta JSON del buscador real"""
        body = response.body

        if body[:2] == b"\x1f\x8b" or body[:1] == b"\x8b":
            try:
                body = gzip.decompress(body)
            except Exception:
                self.logger.warning("⚠️ No se pudo descomprimir gzip")

        try:
            data = json.loads(body.decode("utf-8"))
        except Exception as e:
            self.logger.error(f"❌ Error parseando JSON (página {page}): {e}")
            self.logger.error(f"Status: {response.status}")
            self.logger.error(f"Headers: {response.headers}")
            self.logger.error(f"Body (primeros 200 bytes): {body[:200]!r}")
            return

        results = data.get("list") or data.get("realEstates") or []
        total = data.get("totalCount") or len(results)
        self.logger.info(f"✅ Página {page}: {len(results)} resultados (total aprox: {total})")

        for rec in results:
            ad_id = str(rec.get("id") or rec.get("propertyId") or "")
            yield {
                "source": "fotocasa",
                "page": page,
                "fetched_at": self.now,
                "ad_id": ad_id,
                "province": rec.get("province", {}).get("label")
                if isinstance(rec.get("province"), dict)
                else rec.get("province"),
                "municipality": rec.get("municipality", {}).get("label")
                if isinstance(rec.get("municipality"), dict)
                else rec.get("municipality"),
                "price": rec.get("price"),
                "rooms": rec.get("rooms"),
                "surface": rec.get("surface"),
                "isNewDevelopment": rec.get("isNewDevelopment"),
                "raw": rec,
            }

        # --- Paginación ---
        if results and page < self.max_pages:
            next_page = page + 1
            delay = get_random_delay(1.0, 2.5)
            self.logger.info(f"⏱️ Esperando {delay:.2f}s antes de página {next_page}...")

            yield from self.fetch_results(
                page=next_page, csrf_cookie=csrf_cookie, csrf_token=csrf_token
            )
