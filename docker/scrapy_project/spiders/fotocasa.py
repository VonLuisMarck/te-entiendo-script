# -*- coding: utf-8 -*-
"""
Spider de Fotocasa
"""
import scrapy
import time
import urllib.parse
import sys
import os

# Importar configuración de headers desde config.py
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from config import get_random_headers, get_random_delay


API_SEARCH = "https://web.gw.fotocasa.es/v2/propertysearch/searchurl"


class FotocasaSpider(scrapy.Spider):
    name = 'fotocasa'
    
    def __init__(self, max_pages='50', *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.max_pages = int(max_pages)
        self.now = int(time.time())
        self.combined_location_ids = "724,0,0,0,0,0,0,0,0"  # Toda Espana

    def start_requests(self):
        headers = get_random_headers()
        url = self._build_url(page=1)
        self.logger.info(f"Scrapeando Fotocasa Espana - pagina 1")
        self.logger.info(f"URL: {url}")
        self.logger.info(f"Headers: {headers}")
        
        yield scrapy.Request(
            url,
            method="GET",
            headers=headers,
            callback=self.parse,
            cb_kwargs={"page": 1},
            dont_filter=True,
        )

    def parse(self, response, page):
        # La respuesta viene comprimida (brotli/gzip)
        # Scrapy debería descomprimir automáticamente, pero lo forzamos con .text
        try:
            import json
            data = json.loads(response.text)
        except Exception as e:
            self.logger.error(f"Error parseando JSON (pagina {page}): {e}")
            self.logger.error(f"Response status: {response.status}")
            self.logger.error(f"Response headers: {response.headers}")
            self.logger.error(f"Response body (primeros 200 bytes): {response.body[:200]}")
            return

        self.logger.info(f"API Response keys: {list(data.keys())}")
        
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
            delay = get_random_delay(0.8, 2.5)
            self.logger.info(f"Esperando {delay:.2f}s antes de pagina {next_page}")

            url = self._build_url(page=next_page)
            headers = get_random_headers()

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
            "latitude": 40,  # Centro de España (coords reales del HAR)
            "longitude": -4,  # Centro de España (coords reales del HAR)
            "text": "",
            "pageNumber": page,
        }
        return f"{API_SEARCH}?{urllib.parse.urlencode(params)}"
