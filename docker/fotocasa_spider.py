"""
Spider de Fotocasa (2025)
Version adaptada para scrapear toda Espana usando el nuevo endpoint
"""
import scrapy
import time
import urllib.parse
import random


API_SEARCH = "https://web.gw.fotocasa.es/v2/propertysearch/searchurl"

# User-Agents para rotar
USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
]

def get_random_delay(min_delay=0.8, max_delay=2.5):
    """Retorna un delay aleatorio"""
    return random.uniform(min_delay, max_delay)


class FotocasaApiSpider(scrapy.Spider):
    name = "fotocasa_api"
    
    custom_settings = {
        'ROBOTSTXT_OBEY': False,
        'CONCURRENT_REQUESTS': 2,
        'DOWNLOAD_DELAY': 1.5,
        'RANDOMIZE_DOWNLOAD_DELAY': True,
        'COOKIES_ENABLED': True,
        'RETRY_ENABLED': True,
        'RETRY_TIMES': 3,
        'RETRY_HTTP_CODES': [429, 500, 502, 503, 504],
        'AUTOTHROTTLE_ENABLED': True,
        'AUTOTHROTTLE_START_DELAY': 1,
        'AUTOTHROTTLE_MAX_DELAY': 10,
        'USER_AGENT': random.choice(USER_AGENTS),
    }

    def __init__(self, max_pages=50, **kwargs):
        """
        Args:
            max_pages (int): número máximo de páginas a recorrer (por defecto 50)
        """
        super().__init__(**kwargs)
        self.now = int(time.time())
        self.max_pages = int(max_pages)

        # Cobertura total: toda España
        self.combined_location_ids = "724,0,0,0,0,0,0,0,0"

    # ---------------------------- #
    # Inicio del scraping
    # ---------------------------- #
    def start_requests(self):
        """Inicia el proceso con la pagina 1"""
        headers = {
            'Accept': 'application/json, text/plain, */*',
            'Accept-Language': 'es-ES,es;q=0.9',
            'User-Agent': random.choice(USER_AGENTS),
        }
        url = self._build_url(page=1)
        self.logger.info(f"Scrapeando Fotocasa Espana - pagina 1")
        yield scrapy.Request(
            url,
            method="GET",
            headers=headers,
            callback=self.parse_search,
            cb_kwargs={"page": 1},
            dont_filter=True,
        )

    # ---------------------------- #
    # Parseo del JSON de resultados
    # ---------------------------- #
    def parse_search(self, response, page):
        """Procesa cada respuesta JSON"""
        try:
            data = response.json()
        except Exception:
            self.logger.warning(f"No se pudo parsear JSON (página {page})")
            return

        results = data.get("list") or data.get("realEstates") or []
        self.logger.info(f"✅ {len(results)} resultados en página {page}")

        # Emitimos cada anuncio con metadatos y el JSON bruto
        for rec in results:
            ad_id = str(rec.get("id") or rec.get("propertyId") or "")
            yield {
                "source": "fotocasa",
                "page": page,
                "fetched_at": self.now,
                "ad_id": ad_id,
                "province": rec.get("province", {}).get("label") if isinstance(rec.get("province"), dict) else None,
                "municipality": rec.get("municipality", {}).get("label") if isinstance(rec.get("municipality"), dict) else None,
                "price": rec.get("price"),
                "rooms": rec.get("rooms"),
                "surface": rec.get("surface"),
                "isNewDevelopment": rec.get("isNewDevelopment"),
                "raw": rec,  # Todo el JSON del anuncio
            }

        # ---------------- PAGINACION ---------------- #
        if results and page < self.max_pages:
            next_page = page + 1
            delay = get_random_delay(0.8, 2.5)
            self.logger.info(f"Esperando {delay:.2f}s antes de pagina {next_page}...")

            url = self._build_url(page=next_page)
            headers = {
                'Accept': 'application/json, text/plain, */*',
                'Accept-Language': 'es-ES,es;q=0.9',
                'User-Agent': random.choice(USER_AGENTS),
            }

            yield scrapy.Request(
                url,
                method="GET",
                headers=headers,
                callback=self.parse_search,
                cb_kwargs={"page": next_page},
                dont_filter=True,
                meta={"download_delay": delay},
            )

    # ---------------------------- #
    # Helper para construir URLs
    # ---------------------------- #
    def _build_url(self, page: int) -> str:
        """Crea la URL con parametros de busqueda global (Espana)"""
        params = {
            "combinedLocationIds": self.combined_location_ids,
            "culture": "es-ES",
            "latitude": 0,
            "longitude": 0,
            "text": "",
            "pageNumber": page,
        }
        return f"{API_SEARCH}?{urllib.parse.urlencode(params)}"
