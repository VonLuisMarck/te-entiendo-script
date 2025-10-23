# Integración con Scraper Python

## Cómo conectar tu scraper Python existente

Tu scraper Python/Scrapy puede enviar datos directamente al Edge Function `scraping-service`.

### Opción 1: HTTP POST directo

```python
import requests

SUPABASE_URL = "https://mtjomlpwpiuhflwmgctk.supabase.co"
SUPABASE_ANON_KEY = "tu-anon-key-aquí"

def enviar_propiedad(propiedad_data):
    url = f"{SUPABASE_URL}/functions/v1/scraping-service"
    headers = {
        "Authorization": f"Bearer {SUPABASE_ANON_KEY}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "portal": "fotocasa",
        "ubicacion": propiedad_data['ubicacion'],
        "propiedades": [propiedad_data]  # Array de propiedades
    }
    
    response = requests.post(url, json=payload, headers=headers)
    return response.json()
```

### Opción 2: Inserción directa en Supabase

```python
from supabase import create_client, Client

SUPABASE_URL = "https://mtjomlpwpiuhflwmgctk.supabase.co"
SUPABASE_KEY = "tu-service-role-key-aquí"  # ¡Usa SERVICE ROLE KEY!

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def guardar_propiedad(item):
    data = {
        "external_id": f"fotocasa-{item['id']}",
        "portal_origen": "fotocasa",
        "titulo": item['title'],
        "descripcion": item['description'],
        "precio": item['price'],
        "ubicacion": item['location'],
        "tipo_propiedad": item['property_type'],
        "dormitorios": item['bedrooms'],
        "banos": item['bathrooms'],
        "metros": item['surface'],
        "condition": item['condition'],
        "ano_construccion": item.get('year_built'),
        "tiene_ascensor": item.get('has_elevator', False),
        "tiene_parking": item.get('has_parking', False),
        "url": item['url'],
        "imagenes": item.get('images', []),
        "activo": True
    }
    
    result = supabase.table('propiedades').upsert(data, on_conflict='external_id').execute()
    return result
```

### Ejemplo Pipeline Scrapy

```python
# pipelines.py
from supabase import create_client
import os

class SupabasePipeline:
    def __init__(self):
        self.supabase = create_client(
            os.getenv('SUPABASE_URL'),
            os.getenv('SUPABASE_SERVICE_ROLE_KEY')
        )
    
    def process_item(self, item, spider):
        try:
            data = self._item_to_dict(item)
            self.supabase.table('propiedades').upsert(
                data,
                on_conflict='external_id'
            ).execute()
            spider.logger.info(f'Propiedad guardada: {data["external_id"]}')
        except Exception as e:
            spider.logger.error(f'Error guardando propiedad: {e}')
        
        return item
    
    def _item_to_dict(self, item):
        return {
            "external_id": f"{item['portal']}-{item['id']}",
            "portal_origen": item['portal'],
            "titulo": item['title'],
            "precio": float(item['price']),
            "ubicacion": item['location'],
            "tipo_propiedad": item['property_type'],
            "dormitorios": int(item.get('bedrooms', 0)),
            "banos": int(item.get('bathrooms', 0)),
            "metros": float(item.get('surface', 0)),
            "url": item['url'],
            "activo": True
        }
```

### Variables de Entorno (.env)

```bash
SUPABASE_URL=https://mtjomlpwpiuhflwmgctk.supabase.co
SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key-aquí
```

### Instalar dependencias Python

```bash
pip install supabase
```

## Ejecutar tu scraper

```bash
# Desde tu proyecto Python/Scrapy
scrapy crawl fotocasa_spider

# O si usas el script directo
python src/scraper/fotocasa_scraper.py
```

## Logs automáticos

El sistema registrará automáticamente cada ejecución en la tabla `scraping_logs` con:
- Propiedades encontradas
- Propiedades nuevas vs actualizadas
- Errores (si los hay)
- Duración de la ejecución
