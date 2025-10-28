# -*- coding: utf-8 -*-
"""
Spider de Fotocasa (2025, endpoint definitivo)
---------------------------------------------
✅ Usa /v2/propertysearch/search (GET)
✅ Scrapea toda España
✅ Maneja compresión gzip y logs detallados
"""

import scrapy
import time
import urllib.parse
import gzip
import json
import sys
import os

# Importar configuración de headers desde config.py
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from config import get_random_headers, get_random_delay, SCRAPY_SETTINGS


API_SEARCH = "https://web.gw.fotocasa.es/v2/propertysearch/search"


class FotocasaSpider(scrapy.Spider):
    name = "fotocasa"
    custom_settings = SCRAPY_SETTINGS

    def __init__(self, max_pages='50', *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.now = int(time.time())
        self.max_pages = int(max_pages)
        self.combined_location_ids = "724,0,0,0,0,0,0,0,0"  # Toda España

    def start_requests(self):
        headers = get_random_headers()
        headers["Accept-Encoding"] = "identity"

        url = self._build_url(page=1)
        self.logger.info(f"🌍 Scrapeando Fotocasa España - página 1")
        self.logger.info(f"URL: {url}")
        yield scrapy.Request(
            url,
            method="GET",
            headers=headers,
            callback=self.parse_search,
            cb_kwargs={"page": 1},
            dont_filter=True,
        )

    def parse_search(self, response, page):
        body = response.body
        if body[:2] == b"\x1f\x8b" or body[:1] == b"\x8b":
            try:
                body = gzip.decompress(body)
            except Exception:
                self.logger.warning("⚠️ No se pudo descomprimir con gzip")

        try:
            data = json.loads(body.decode("utf-8"))
        except Exception as e:
            self.logger.error(f"❌ Error parseando JSON (página {page}): {e}")
            self.logger.error(f"Response status: {response.status}")
            self.logger.error(f"Response headers: {response.headers}")
            self.logger.error(f"Response body (primeros 200 bytes): {body[:200]!r}")
            return

        results = data.get("list") or data.get("realEstates") or []
        total = data.get("totalCount") or len(results)
        self.logger.info(f"✅ Página {page}: {len(results)} resultados (de {total} totales)")

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

        if results and page < self.max_pages:
            next_page = page + 1
            delay = get_random_delay(0.8, 2.5)
            self.logger.info(f"⏱️ Esperando {delay:.2f}s antes de página {next_page}...")

            url = self._build_url(page=next_page)
            headers = get_random_headers()
            headers["Accept-Encoding"] = "identity"

            yield scrapy.Request(
                url,
                method="GET",
                headers=headers,
                callback=self.parse_search,
                cb_kwargs={"page": next_page},
                dont_filter=True,
                meta={"download_delay": delay},
            )

    def _build_url(self, page: int) -> str:
        params = {
            "combinedLocationIds": self.combined_location_ids,
            "culture": "es-ES",
            "latitude": 40,
            "longitude": -4,
            "text": "",
            "pageNumber": page,
        }
        return f"{API_SEARCH}?{urllib.parse.urlencode(params)}"
