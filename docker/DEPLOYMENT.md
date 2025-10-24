# 🚀 Guía de Deployment Paso a Paso

## Opción 1: Railway (Recomendado - Más fácil)

### Paso 1: Preparar el código
```bash
# Clonar o descargar los archivos del proyecto
cd docker/

# IMPORTANTE: Reemplaza fotocasa_spider.py con tu spider real
# Copia tu spider de GitHub aquí
```

### Paso 2: Instalar Railway CLI
```bash
npm install -g @railway/cli
```

### Paso 3: Deploy automático
```bash
# Ejecutar script de deployment
chmod +x deploy.sh
./deploy.sh
```

O manualmente:
```bash
railway login
railway init
railway up
```

### Paso 4: Obtener URL pública
```bash
railway domain
```

Copiarás algo como: `https://fotocasa-scraper-production.up.railway.app`

### Paso 5: Configurar en Lovable
Ya configuraste el secret `PYTHON_SCRAPER_URL` con esa URL ✅

### Paso 6: ¡Probar!
Ve a `/scraper` en tu app y ejecuta un scraping.

---

## Opción 2: Render

### Paso 1: Crear cuenta en Render.com
Regístrate gratis en [render.com](https://render.com)

### Paso 2: Nuevo Web Service
1. Click en "New +"
2. Selecciona "Docker"
3. Conecta tu repo de GitHub (o sube el código)

### Paso 3: Configuración
- **Name**: `fotocasa-scraper`
- **Region**: Frankfurt (más cerca de España)
- **Branch**: `main`
- **Dockerfile Path**: `docker/Dockerfile`
- **Plan**: Free

### Paso 4: Deploy
Click "Create Web Service" y espera 5-10 minutos.

### Paso 5: Obtener URL
Render te dará una URL como: `https://fotocasa-scraper.onrender.com`

### Paso 6: Actualizar secret
Ve a Lovable Cloud > Secrets > PYTHON_SCRAPER_URL y pega la URL.

---

## Opción 3: Fly.io

```bash
# Instalar flyctl
curl -L https://fly.io/install.sh | sh

# Login
fly auth login

# Deploy (desde el directorio docker/)
cd docker/
fly launch --dockerfile Dockerfile
fly deploy

# Obtener URL
fly info
```

---

## 🧪 Testing local antes de deployar

```bash
cd docker/

# Build
docker build -t fotocasa-scraper .

# Run
docker run -p 8000:8000 fotocasa-scraper

# Test en otra terminal
curl http://localhost:8000/health
```

Deberías ver: `{"status":"healthy"}`

---

## ⚠️ IMPORTANTE: Reemplazar el spider

El archivo `fotocasa_spider.py` es un placeholder. Debes reemplazarlo con tu spider real:

1. Ve a tu repo: https://github.com/VonLuisMarck/InmoFinder
2. Copia el contenido de `src/scraper/inmofinder/spiders/fotocasa.py`
3. Pégalo en `docker/fotocasa_spider.py`

---

## 📊 Monitoreo

### Ver logs en Railway:
```bash
railway logs
```

### Ver logs en Render:
Ve al dashboard y click en "Logs"

### Ver logs en Fly.io:
```bash
fly logs
```

---

## 🆘 Troubleshooting

### Error: "Module scrapy not found"
- Asegúrate de que `requirements.txt` está en el mismo directorio
- Rebuild: `railway up` o en Render click "Manual Deploy"

### Error: "Port already in use"
- El puerto 8000 está ocupado localmente
- Cambia: `docker run -p 8001:8000 fotocasa-scraper`

### Error: "Cannot import FotocasaApiSpider"
- Reemplaza `fotocasa_spider.py` con tu spider real
- Verifica que la clase se llama exactamente `FotocasaApiSpider`

### El scraper no encuentra propiedades:
- Verifica logs: `railway logs` o en el dashboard
- Puede ser que Fotocasa esté bloqueando. Considera proxies residenciales

---

## 💰 Costos estimados

- **Railway**: Free tier incluye $5/mes de crédito (suficiente para testing)
- **Render**: Free tier con sleep después de 15 min de inactividad
- **Fly.io**: Free tier incluye 3 VMs pequeñas

Para producción, considera:
- Railway Pro: $20/mes
- Render Standard: $7/mes
- Fly.io: Pay as you go (~$5-10/mes)

---

## 🔐 Seguridad

El webhook usa el SERVICE_ROLE_KEY de Supabase para autenticar.
Nunca expongas este key públicamente.

El Edge Function valida automáticamente la autenticación.
