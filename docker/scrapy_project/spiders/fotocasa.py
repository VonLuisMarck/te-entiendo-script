# -*- coding: utf-8 -*-
"""
Spider de Fotocasa
"""
import scrapy
import time
import urllib.parse
import random


API_SEARCH = "https://web.gw.fotocasa.es/v2/propertysearch/searchurl"

USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
]


class FotocasaSpider(scrapy.Spider):
    name = 'fotocasa'
    
    def __init__(self, max_pages='50', *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.max_pages = int(max_pages)
        self.now = int(time.time())
        self.combined_location_ids = "724,0,0,0,0,0,0,0,0"  # Toda Espana

    def start_requests(self):
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
            callback=self.parse,
            cb_kwargs={"page": 1},
            dont_filter=True,
        )

    def parse(self, response, page):
        try:
            data = response.json()
        except Exception as e:
            self.logger.warning(f"No se pudo parsear JSON (pagina {page}): {e}")
            return

        results = data.get("list") or data.get("realEstates") or []
        self.logger.info(f"OK {len(results)} resultados en pagina {page}")

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
                "raw": rec,
            }

        # Paginacion
        if results and page < self.max_pages:
            next_page = page + 1
            delay = random.uniform(0.8, 2.5)
            self.logger.info(f"Esperando {delay:.2f}s antes de pagina {next_page}")

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
                callback=self.parse,
                cb_kwargs={"page": next_page},
                dont_filter=True,
                meta={"download_delay": delay},
            )

    def _build_url(self, page: int) -> str:
        params = {
            "combinedLocationIds": self.combined_location_ids,
            "culture": "es-ES",
            "latitude": 0,
            "longitude": 0,
            "text": "",
            "pageNumber": page,
        }
        return f"{API_SEARCH}?{urllib.parse.urlencode(params)}"
