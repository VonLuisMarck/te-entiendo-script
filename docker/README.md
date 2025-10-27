# 🏠 InmoFinder Scraper Service

Servicio de scraping de propiedades inmobiliarias desplegado en Fly.io que proporciona APIs REST para extraer datos de portales inmobiliarios españoles.

## 🌐 URL del Servicio

**Producción**: https://inmofinder-scraper.fly.dev

## 📋 Índice de Documentación

### 📖 Guías Disponibles

1. **[ADMIN-GUIDE.md](./ADMIN-GUIDE.md)** - Guía completa de administración
   - Monitoreo y logs
   - Comandos de administración
   - Actualización y despliegue
   - Escalado y recursos
   - Troubleshooting
   - Costos y optimización

2. **[INTEGRATION-GUIDE.md](./INTEGRATION-GUIDE.md)** - Guía de integración de scrapers
   - Arquitectura del sistema
   - Endpoints disponibles
   - Cómo agregar nuevos scrapers
   - Ejemplos de integración
   - Best practices

3. **[DEPLOYMENT.md](./DEPLOYMENT.md)** - Guía de despliegue inicial
   - Railway, Render, Fly.io
   - Configuración inicial
   - Testing local

---

## 🚀 Quick Start

### Health Check
```bash
curl https://inmofinder-scraper.fly.dev/health
```

### Scraping de Propiedades
```bash
curl -X POST https://inmofinder-scraper.fly.dev/scrape \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://www.fotocasa.es/es/comprar/viviendas/madrid-capital/todas-las-zonas/l",
    "max_pages": 3
  }'
```

---

## 📦 Estructura del Proyecto

```
docker/
├── README.md                 # Este archivo
├── ADMIN-GUIDE.md           # Guía de administración
├── INTEGRATION-GUIDE.md     # Guía de integración
├── DEPLOYMENT.md            # Guía de despliegue
│
├── Dockerfile               # Configuración Docker
├── fly.toml                 # Configuración Fly.io
├── requirements.txt         # Dependencias Python
│
├── server.py                # Servidor Flask (API REST)
├── config.py                # Configuración del scraper
├── fotocasa_spider.py       # Spider de Fotocasa
│
└── test_rotation.py         # Tests de user agents
```

---

## 🔧 Tecnologías

- **Python 3.11**
- **Scrapy 2.11** - Framework de scraping
- **Flask 3.0** - API REST
- **Gunicorn 21.2** - WSGI server
- **Fly.io** - Hosting y deployment

---

## 🎯 Funcionalidades

### ✅ Implementadas

- [x] Scraping de Fotocasa
- [x] API REST para scraping
- [x] Health checks
- [x] Paginación automática
- [x] Rate limiting
- [x] Manejo de errores robusto
- [x] Logging detallado
- [x] User agents rotativos
- [x] Despliegue en Fly.io

### 🚧 Roadmap

- [ ] Scraping de Idealista
- [ ] Scraping de Pisos.com
- [ ] Cache de resultados
- [ ] Webhooks para notificaciones
- [ ] Proxy rotation
- [ ] Selenium para sitios con JavaScript
- [ ] Rate limiting por cliente
- [ ] Autenticación con API keys

---

## 📊 Endpoints

### GET /health
Health check del servicio

**Response:**
```json
{
  "status": "healthy",
  "service": "fotocasa-scraper",
  "timestamp": "2025-01-15T10:30:00Z"
}
```

### POST /scrape
Scrapear propiedades de Fotocasa

**Request:**
```json
{
  "url": "https://www.fotocasa.es/...",
  "max_pages": 3,
  "location": "Madrid",
  "min_price": 200000,
  "max_price": 500000
}
```

**Response:**
```json
{
  "success": true,
  "properties": [...],
  "total_found": 25,
  "pages_scraped": 3
}
```

---

## 🔐 Seguridad

- HTTPS forzado en todas las conexiones
- Headers CORS configurados
- Rate limiting implementado
- Validación de inputs
- Logs sin información sensible

---

## 💰 Costos

**Configuración Actual:**
- 256MB RAM, 1 CPU compartida
- Región: Amsterdam
- Costo estimado: ~$1.94/mes

**Escalado recomendado según tráfico:**
- Bajo (< 1000 scrapes/mes): 256MB - $1.94/mes
- Medio (1000-5000 scrapes/mes): 512MB - $3.88/mes
- Alto (> 5000 scrapes/mes): 1GB - $7.76/mes

---

## 🛠️ Mantenimiento

### Comandos Rápidos

```bash
# Ver logs
fly logs -a inmofinder-scraper

# Estado del servicio
fly status -a inmofinder-scraper

# Desplegar cambios
fly deploy -a inmofinder-scraper

# Escalar recursos
fly scale memory 512 -a inmofinder-scraper

# SSH al contenedor
fly ssh console -a inmofinder-scraper
```

---

## 🐛 Troubleshooting

### Servicio no responde
```bash
fly status -a inmofinder-scraper
fly logs -a inmofinder-scraper --since 1h
```

### Errores de scraping
```bash
fly logs -a inmofinder-scraper | grep ERROR
```

### Testing local
```bash
docker build -t scraper-test .
docker run -p 8000:8000 scraper-test
curl http://localhost:8000/health
```

**Ver guía completa**: [ADMIN-GUIDE.md](./ADMIN-GUIDE.md#-troubleshooting)

---

## 📚 Recursos

- [Guía de Administración](./ADMIN-GUIDE.md)
- [Guía de Integración](./INTEGRATION-GUIDE.md)
- [Guía de Despliegue](./DEPLOYMENT.md)
- [Fly.io Documentation](https://fly.io/docs/)
- [Scrapy Documentation](https://docs.scrapy.org/)

---

## 🤝 Contribuir

### Agregar nuevo scraper

1. Crear spider siguiendo el patrón de `fotocasa_spider.py`
2. Actualizar `server.py` con nuevo endpoint
3. Probar localmente
4. Desplegar con `fly deploy`
5. Actualizar documentación

**Ver guía detallada**: [INTEGRATION-GUIDE.md](./INTEGRATION-GUIDE.md#-agregar-nuevo-scraper)

---

## 📞 Soporte

- **Logs en vivo**: `fly logs -a inmofinder-scraper`
- **Dashboard**: `fly dashboard -a inmofinder-scraper`
- **Documentación completa**: Ver guías en este directorio

---

## ⚠️ Disclaimer

Este servicio es para uso educativo y de desarrollo. Asegúrate de:
- Respetar términos de servicio de los portales
- No hacer scraping agresivo
- Cumplir con GDPR y leyes de privacidad
- Obtener permisos necesarios para uso comercial

---

## 📝 Changelog

### v1.0.0 (2025-01-15)
- ✨ Despliegue inicial en Fly.io
- ✨ Spider de Fotocasa funcional
- ✨ API REST con Flask
- ✨ Health checks configurados
- ✨ Documentación completa
- ✨ Rate limiting implementado

---

## 📄 Licencia

Este proyecto es parte de InmoFinder. Todos los derechos reservados.

---

**Última actualización**: 2025-01-15
**Versión del servicio**: 1.0.0
**URL de producción**: https://inmofinder-scraper.fly.dev
