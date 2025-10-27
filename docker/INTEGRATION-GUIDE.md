# 🔌 Guía de Integración - Nuevos Scrapers

## 📋 Tabla de Contenidos
1. [Arquitectura Actual](#arquitectura-actual)
2. [Endpoints Disponibles](#endpoints-disponibles)
3. [Agregar Nuevo Scraper](#agregar-nuevo-scraper)
4. [Ejemplos de Integración](#ejemplos-de-integración)
5. [Best Practices](#best-practices)

---

## 🏗️ Arquitectura Actual

```
┌─────────────────────────────────────────────────┐
│          InmoFinder Frontend (Lovable)          │
│              (React + TypeScript)               │
└─────────────────┬───────────────────────────────┘
                  │
                  │ HTTP POST /scrape
                  │ (Edge Function)
                  ▼
┌─────────────────────────────────────────────────┐
│     Supabase Edge Function (scraping-service)   │
│            (Deno + TypeScript)                  │
└─────────────────┬───────────────────────────────┘
                  │
                  │ HTTP POST /scrape
                  │
                  ▼
┌─────────────────────────────────────────────────┐
│      Python Scraper Service (Fly.io)            │
│        https://inmofinder-scraper.fly.dev       │
│              (Python + Scrapy)                  │
└─────────────────────────────────────────────────┘
```

---

## 🔗 Endpoints Disponibles

### 1. Health Check
**GET** `/health`

```bash
curl https://inmofinder-scraper.fly.dev/health
```

**Respuesta:**
```json
{
  "status": "healthy",
  "service": "fotocasa-scraper",
  "timestamp": "2025-01-15T10:30:00Z"
}
```

---

### 2. Scrape Properties
**POST** `/scrape`

**Request:**
```bash
curl -X POST https://inmofinder-scraper.fly.dev/scrape \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://www.fotocasa.es/es/comprar/viviendas/madrid-capital/todas-las-zonas/l",
    "max_pages": 3,
    "location": "Madrid"
  }'
```

**Request Body:**
```json
{
  "url": "string (required)",          // URL de la primera página
  "max_pages": "number (optional)",    // Máximo de páginas a scrapear (default: 1)
  "location": "string (optional)",     // Ubicación para filtrar
  "min_price": "number (optional)",    // Precio mínimo
  "max_price": "number (optional)"     // Precio máximo
}
```

**Response (Success):**
```json
{
  "success": true,
  "properties": [
    {
      "title": "Piso en calle Mayor, 5",
      "price": 350000,
      "location": "Madrid Capital",
      "surface": 85,
      "rooms": 3,
      "bathrooms": 2,
      "description": "Piso exterior con mucha luz...",
      "url": "https://www.fotocasa.es/...",
      "images": ["https://...", "https://..."],
      "agency": "Inmobiliaria XYZ",
      "scraped_at": "2025-01-15T10:30:00Z"
    }
  ],
  "total_found": 25,
  "pages_scraped": 3
}
```

**Response (Error):**
```json
{
  "success": false,
  "error": "Error message",
  "details": "Detailed error information"
}
```

---

## ➕ Agregar Nuevo Scraper

### Opción 1: Nuevo Spider en el mismo servicio

#### Paso 1: Crear el Spider
Crea `docker/idealista_spider.py`:

```python
import scrapy
from datetime import datetime

class IdealistaSpider(scrapy.Spider):
    name = "idealista"
    
    def __init__(self, url=None, max_pages=1, *args, **kwargs):
        super(IdealistaSpider, self).__init__(*args, **kwargs)
        self.start_urls = [url] if url else []
        self.max_pages = int(max_pages)
        self.pages_scraped = 0
        
    def parse(self, response):
        # Extraer propiedades
        properties = response.css('.item-info-container')
        
        for prop in properties:
            yield {
                'title': prop.css('.item-link::text').get(),
                'price': self._extract_price(prop),
                'location': prop.css('.item-detail::text').get(),
                'surface': self._extract_surface(prop),
                'rooms': self._extract_rooms(prop),
                'bathrooms': self._extract_bathrooms(prop),
                'url': response.urljoin(prop.css('.item-link::attr(href)').get()),
                'images': prop.css('.item-multimedia img::attr(src)').getall(),
                'scraped_at': datetime.now().isoformat()
            }
        
        # Paginación
        self.pages_scraped += 1
        if self.pages_scraped < self.max_pages:
            next_page = response.css('.next-page::attr(href)').get()
            if next_page:
                yield response.follow(next_page, self.parse)
    
    def _extract_price(self, element):
        price_text = element.css('.item-price::text').get()
        if price_text:
            return int(price_text.replace('.', '').replace('€', '').strip())
        return None
    
    def _extract_surface(self, element):
        surface_text = element.css('.item-detail-char::text').get()
        if surface_text and 'm²' in surface_text:
            return int(surface_text.replace('m²', '').strip())
        return None
    
    def _extract_rooms(self, element):
        rooms_text = element.css('.item-detail-char:contains("hab")::text').get()
        if rooms_text:
            return int(rooms_text.split()[0])
        return None
    
    def _extract_bathrooms(self, element):
        bathrooms_text = element.css('.item-detail-char:contains("baño")::text').get()
        if bathrooms_text:
            return int(bathrooms_text.split()[0])
        return None
```

#### Paso 2: Actualizar server.py
```python
from idealista_spider import IdealistaSpider

# Agregar nuevo endpoint
@app.route('/scrape/idealista', methods=['POST'])
def scrape_idealista():
    try:
        data = request.json
        url = data.get('url')
        max_pages = data.get('max_pages', 1)
        
        if not url:
            return jsonify({'error': 'URL is required'}), 400
        
        # Configurar y ejecutar spider
        process = CrawlerProcess(settings={
            'USER_AGENT': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'ROBOTSTXT_OBEY': False,
            'CONCURRENT_REQUESTS': 1,
            'DOWNLOAD_DELAY': 2,
        })
        
        results = []
        
        def collect_results(item, response, spider):
            results.append(dict(item))
        
        dispatcher.connect(collect_results, signal=signals.item_scraped)
        
        process.crawl(IdealistaSpider, url=url, max_pages=max_pages)
        process.start()
        
        return jsonify({
            'success': True,
            'properties': results,
            'total_found': len(results),
            'source': 'idealista'
        })
        
    except Exception as e:
        logger.error(f"Error scraping Idealista: {str(e)}")
        return jsonify({'error': str(e)}), 500
```

#### Paso 3: Actualizar requirements.txt (si necesario)
```txt
scrapy==2.11.0
flask==3.0.0
gunicorn==21.2.0
requests==2.31.0
lxml==4.9.3
# Agregar dependencias adicionales aquí
```

#### Paso 4: Desplegar
```bash
cd docker/
git add .
git commit -m "Add Idealista scraper"
git push origin main

# Desplegar
fly deploy -a inmofinder-scraper
```

---

### Opción 2: Servicio Independiente

Si prefieres crear un servicio completamente separado:

#### Paso 1: Crear nuevo directorio
```bash
mkdir docker-idealista/
cd docker-idealista/
```

#### Paso 2: Copiar estructura base
```bash
cp ../docker/Dockerfile .
cp ../docker/server.py .
cp ../docker/requirements.txt .
```

#### Paso 3: Adaptar código para Idealista

#### Paso 4: Crear nueva app en Fly.io
```bash
fly apps create idealista-scraper --region ams
fly deploy
```

#### Paso 5: Obtener URL del nuevo servicio
```bash
fly info
# URL: https://idealista-scraper.fly.dev
```

---

## 🔧 Integración desde Frontend/Edge Function

### Desde Edge Function (Recomendado)

Actualiza `supabase/functions/scraping-service/index.ts`:

```typescript
const SCRAPER_SERVICES = {
  fotocasa: 'https://inmofinder-scraper.fly.dev',
  idealista: 'https://idealista-scraper.fly.dev',
  // Agregar más servicios aquí
};

Deno.serve(async (req) => {
  try {
    const { source, url, max_pages, filters } = await req.json();
    
    // Seleccionar servicio según la fuente
    const scraperUrl = SCRAPER_SERVICES[source];
    
    if (!scraperUrl) {
      return new Response(
        JSON.stringify({ error: 'Invalid source' }),
        { status: 400, headers: corsHeaders }
      );
    }
    
    // Llamar al scraper
    const response = await fetch(`${scraperUrl}/scrape`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, max_pages, ...filters })
    });
    
    const data = await response.json();
    
    // Guardar en Supabase
    if (data.success && data.properties) {
      const { error: dbError } = await supabase
        .from('propiedades')
        .insert(
          data.properties.map(prop => ({
            ...prop,
            source,
            imported_at: new Date().toISOString()
          }))
        );
      
      if (dbError) throw dbError;
    }
    
    return new Response(
      JSON.stringify(data),
      { headers: corsHeaders }
    );
    
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: corsHeaders }
    );
  }
});
```

### Desde Frontend (Directo)

```typescript
// src/services/scraperService.ts
const SCRAPER_ENDPOINTS = {
  fotocasa: 'https://inmofinder-scraper.fly.dev/scrape',
  idealista: 'https://idealista-scraper.fly.dev/scrape',
};

export async function scrapeProperties(
  source: 'fotocasa' | 'idealista',
  options: {
    url: string;
    maxPages?: number;
    filters?: Record<string, any>;
  }
) {
  const endpoint = SCRAPER_ENDPOINTS[source];
  
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(options)
  });
  
  if (!response.ok) {
    throw new Error(`Scraping failed: ${response.statusText}`);
  }
  
  return response.json();
}

// Uso
import { scrapeProperties } from '@/services/scraperService';

const results = await scrapeProperties('fotocasa', {
  url: 'https://www.fotocasa.es/...',
  maxPages: 3
});
```

---

## ✅ Best Practices

### 1. Rate Limiting
```python
# En tu spider
custom_settings = {
    'DOWNLOAD_DELAY': 2,  # 2 segundos entre requests
    'CONCURRENT_REQUESTS': 1,
    'CONCURRENT_REQUESTS_PER_DOMAIN': 1,
}
```

### 2. User Agents Rotativos
```python
USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36...',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36...',
    # Más user agents
]

# Rotar aleatoriamente
import random
custom_settings = {
    'USER_AGENT': random.choice(USER_AGENTS)
}
```

### 3. Manejo de Errores
```python
def parse(self, response):
    try:
        # Tu código de scraping
        pass
    except Exception as e:
        self.logger.error(f"Error parsing {response.url}: {str(e)}")
        # Continuar con la siguiente página
```

### 4. Validación de Datos
```python
def clean_price(self, price_text):
    """Validar y limpiar precio"""
    if not price_text:
        return None
    try:
        price = int(price_text.replace('.', '').replace('€', '').strip())
        # Validar rango razonable
        if 10000 <= price <= 10000000:
            return price
    except (ValueError, AttributeError):
        return None
    return None
```

### 5. Logging
```python
import logging

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

# En tu código
logger.info(f"Scraping {url}")
logger.warning(f"No price found for property")
logger.error(f"Failed to scrape: {error}")
```

### 6. Testing Local
```bash
# Probar spider localmente
scrapy runspider fotocasa_spider.py -a url="https://..." -a max_pages=1

# Probar servidor localmente
python server.py

# En otra terminal
curl -X POST http://localhost:8000/scrape \
  -H "Content-Type: application/json" \
  -d '{"url": "https://...", "max_pages": 1}'
```

---

## 🔍 Debugging

### Ver logs del scraper en producción
```bash
fly logs -a inmofinder-scraper | grep "fotocasa"
```

### Probar endpoint con más detalle
```bash
curl -X POST https://inmofinder-scraper.fly.dev/scrape \
  -H "Content-Type: application/json" \
  -d '{"url": "https://...", "max_pages": 1}' \
  -v  # Verbose mode
```

### SSH para debugging avanzado
```bash
fly ssh console -a inmofinder-scraper

# Dentro del contenedor
python
>>> from fotocasa_spider import FotocasaApiSpider
>>> spider = FotocasaApiSpider(url="https://...", max_pages=1)
>>> # Probar métodos
```

---

## 📚 Recursos Adicionales

- [Scrapy Documentation](https://docs.scrapy.org/)
- [Fly.io Documentation](https://fly.io/docs/)
- [XPath Cheatsheet](https://devhints.io/xpath)
- [CSS Selectors Reference](https://www.w3schools.com/cssref/css_selectors.asp)

---

## 🎯 Checklist para Nuevo Scraper

- [ ] Crear spider con selectores correctos
- [ ] Implementar paginación
- [ ] Agregar manejo de errores
- [ ] Validar datos extraídos
- [ ] Configurar rate limiting
- [ ] Probar localmente
- [ ] Actualizar server.py
- [ ] Actualizar requirements.txt si necesario
- [ ] Desplegar a Fly.io
- [ ] Probar endpoint en producción
- [ ] Actualizar documentación
- [ ] Integrar con Edge Function
- [ ] Probar desde frontend

---

## ⚠️ IMPORTANTE

1. **Respeta robots.txt**: Aunque lo desactivamos, sé responsable
2. **Rate Limiting**: No hagas scraping agresivo
3. **Legal**: Asegúrate de tener permiso para scrapear
4. **Datos Personales**: No almacenes información sensible sin consentimiento
5. **Testing**: Siempre prueba en local antes de desplegar
