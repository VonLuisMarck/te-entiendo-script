# Docker Scraper - Fotocasa

Este contenedor Docker ejecuta el scraper de Fotocasa en Python/Scrapy y envía los resultados al backend via webhook.

## Estructura

```
docker/
├── Dockerfile          # Imagen Docker
├── requirements.txt    # Dependencias Python
├── server.py          # Servidor Flask que expone API
├── fotocasa_spider.py # Spider de Scrapy (reemplaza con el tuyo)
└── README.md          # Esta documentación
```

## Configuración

### 1. Reemplazar el spider

Copia tu spider real de Fotocasa a `fotocasa_spider.py` (el que tienes en tu repo de GitHub).

### 2. Build de la imagen

```bash
cd docker
docker build -t fotocasa-scraper .
```

### 3. Ejecutar localmente

```bash
docker run -p 8000:8000 fotocasa-scraper
```

### 4. Test del endpoint

```bash
curl -X POST http://localhost:8000/scrape \
  -H "Content-Type: application/json" \
  -d '{
    "portal": "fotocasa",
    "ubicacion": "madrid",
    "tipo_propiedad": "piso",
    "max_pages": 2,
    "webhook_url": "https://mtjomlpwpiuhflwmgctk.supabase.co/functions/v1/scraping-service",
    "webhook_auth": "YOUR_SERVICE_ROLE_KEY"
  }'
```

## Deployment

### Opción 1: Railway

1. Crea proyecto en [Railway](https://railway.app)
2. Conecta tu repo de GitHub o deploy desde CLI
3. Railway auto-detectará el Dockerfile
4. Anota la URL pública (ej: `https://your-app.railway.app`)

### Opción 2: Render

1. Crea servicio en [Render](https://render.com)
2. Selecciona "Docker"
3. Conecta repo y selecciona el directorio `docker/`
4. Anota la URL pública

### Opción 3: Fly.io

```bash
fly launch
fly deploy
```

## Configurar en Lovable

Una vez deployado, configura el secret en Lovable Cloud:

1. Ve a Cloud > Settings > Secrets
2. Añade: `PYTHON_SCRAPER_URL` = `https://your-scraper.railway.app`
3. Ya puedes usar el scraper desde el frontend

## API Endpoints

### `POST /scrape`
Triggea un scraping job

**Body:**
```json
{
  "portal": "fotocasa",
  "ubicacion": "madrid",
  "tipo_propiedad": "piso",
  "max_pages": 5,
  "webhook_url": "https://...",
  "webhook_auth": "Bearer ..."
}
```

**Response:**
```json
{
  "job_id": "uuid",
  "status": "pending",
  "message": "Scraping iniciado"
}
```

### `GET /jobs/<job_id>`
Consulta estado de un job

### `GET /health`
Health check

## Flujo de datos

```
Frontend (/scraper)
    ↓ trigger
Edge Function (scraping-service)
    ↓ POST /scrape
Docker Container (Python + Scrapy)
    ↓ scraping
Fotocasa API
    ↓ webhook con datos
Edge Function (scraping-service)
    ↓ insert/update
Supabase Database
```

## Troubleshooting

### El spider no encuentra resultados
- Verifica que el `search_path` sea correcto
- Revisa logs: `docker logs <container_id>`

### Error 405 al scrapear
- Fotocasa puede estar bloqueando. Considera usar proxies residenciales

### Webhook falla
- Verifica que `webhook_url` y `webhook_auth` sean correctos
- Comprueba logs del Edge Function
