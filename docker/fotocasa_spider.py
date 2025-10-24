"""
Spider de Fotocasa - Copia tu spider aquí
Este es un placeholder - reemplaza con tu spider real
"""
from __future__ import annotations
import json
import time
import scrapy

API_SEARCH = "https://web.gw.fotocasa.es/v2/propertysearch/search?portal=www-fotocasa-es"

class FotocasaApiSpider(scrapy.Spider):
    """
    Spider que consume la API pública de Fotocasa sin renderizado.
    Descarga anuncios en formato JSON y los procesa.
    """
    
    name = "fotocasa_api"
    custom_settings = {
        "DOWNLOAD_DELAY": 0.5,
        "CONCURRENT_REQUESTS": 4,
        "AUTOTHROTTLE_ENABLED": True,
        "AUTOTHROTTLE_START_DELAY": 0.25,
        "AUTOTHROTTLE_MAX_DELAY": 3.0,
        "RETRY_TIMES": 3,
        "RETRY_HTTP_CODES": [429, 500, 502, 503, 504],
    }
    
    def __init__(self, search_path: str = None, max_pages: int = 50, **kwargs):
        """
        Args:
            search_path (str): Ruta de búsqueda (ej: '/es/comprar/viviendas/murcia-capital/todas-las-zonas')
            max_pages (int): Límite de páginas a recorrer
        """
        super().__init__(**kwargs)
        self.now = int(time.time())
        self.search_path = search_path
        self.max_pages = int(max_pages)
    
    def start_requests(self):
        headers = {
            "content-type": "application/json",
            "accept": "application/json, text/plain, */*",
            "origin": "https://www.fotocasa.es",
            "referer": "https://www.fotocasa.es/",
        }
        
        payload = self._build_payload(self.search_path, page=1)
        yield scrapy.Request(
            API_SEARCH,
            method="POST",
            headers=headers,
            body=json.dumps(payload),
            callback=self.parse_search,
            cb_kwargs={"search_path": self.search_path, "page": 1},
        )
    
    def parse_search(self, response, search_path: str, page: int):
        try:
            data = response.json()
        except Exception:
            self.logger.warning(f"No JSON en respuesta (page {page})")
            return
        
        records = data.get("list") or data.get("realEstates") or []
        if not isinstance(records, list):
            self.logger.warning(f"Formato inesperado en page {page}")
            records = []
        
        self.logger.info(f"{len(records)} resultados en página {page} ({search_path})")
        
        for rec in records:
            ad_id = str(rec.get("id") or rec.get("propertyId") or "")
            yield {
                "source": "fotocasa",
                "search_path": search_path,
                "page": page,
                "fetched_at": self.now,
                "ad_id": ad_id,
                "raw": rec,
            }
        
        # Paginación
        next_page = page + 1
        if next_page <= self.max_pages and records:
            payload = self._build_payload(search_path, page=next_page)
            headers = {
                "content-type": "application/json",
                "accept": "application/json, text/plain, */*",
                "origin": "https://www.fotocasa.es",
                "referer": "https://www.fotocasa.es/",
            }
            yield scrapy.Request(
                API_SEARCH,
                method="POST",
                headers=headers,
                body=json.dumps(payload),
                callback=self.parse_search,
                cb_kwargs={"search_path": search_path, "page": next_page},
            )
    
    def _build_payload(self, path: str, page: int) -> dict:
        """Crea el payload necesario para pedir resultados."""
        return {
            "filter": {
                "isNewConstruction": None,
                "isDevelopment": None,
                "hasMultimedia": None,
                "sortType": "relevance",
                "maxItems": 36,
                "pageNumber": page,
                "path": path,
            }
        }
