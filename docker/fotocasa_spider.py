"""
Spider de Fotocasa con User-Agent rotation y anti-detección
"""
from __future__ import annotations
import json
import time
import scrapy
from config import get_random_headers, get_random_delay, SCRAPY_SETTINGS

API_SEARCH = "https://web.gw.fotocasa.es/v2/propertysearch/search?portal=www-fotocasa-es"

class FotocasaApiSpider(scrapy.Spider):
    """
    Spider que consume la API pública de Fotocasa sin renderizado.
    Usa rotación de User-Agents y delays aleatorios para evitar detección.
    """
    
    name = "fotocasa_api"
    custom_settings = SCRAPY_SETTINGS
    
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
        """Inicia requests con headers aleatorios"""
        headers = get_random_headers()
        
        self.logger.info(f"🎭 Usando User-Agent: {headers['User-Agent'][:50]}...")
        
        payload = self._build_payload(self.search_path, page=1)
        yield scrapy.Request(
            API_SEARCH,
            method="POST",
            headers=headers,
            body=json.dumps(payload),
            callback=self.parse_search,
            cb_kwargs={"search_path": self.search_path, "page": 1},
            dont_filter=True,
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
        
        # Paginación con User-Agent y delay aleatorios
        next_page = page + 1
        if next_page <= self.max_pages and records:
            # Delay aleatorio entre páginas (simular humano)
            delay = get_random_delay(0.8, 2.5)
            self.logger.info(f"⏱️  Esperando {delay:.2f}s antes de página {next_page}...")
            
            payload = self._build_payload(search_path, page=next_page)
            
            # Nuevo User-Agent para cada página
            headers = get_random_headers()
            self.logger.info(f"🎭 Rotando User-Agent para página {next_page}")
            
            yield scrapy.Request(
                API_SEARCH,
                method="POST",
                headers=headers,
                body=json.dumps(payload),
                callback=self.parse_search,
                cb_kwargs={"search_path": search_path, "page": next_page},
                dont_filter=True,
                meta={'download_delay': delay},
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
