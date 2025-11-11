# 🤖 Sistema de Gestión WhatsApp para InmoFinder

Este sistema te permite gestionar scrapers y monitorear el estado de InmoFinder directamente desde WhatsApp, sin necesitar acceso a ordenador.

## 📋 Contenido

1. [Características](#características)
2. [Configuración Inicial](#configuración-inicial)
3. [Comandos Disponibles](#comandos-disponibles)
4. [Alertas Automáticas](#alertas-automáticas)
5. [Ejemplos de Uso](#ejemplos-de-uso)

---

## ✨ Características

### 🔍 Comandos de Consulta
- **Estado general**: Resumen de propiedades, raw pendientes, scrapers activos y costes AI
- **Propiedades**: Estadísticas detalladas por portal
- **Raw**: Propiedades pendientes de procesar
- **Scrapers**: Estado de ejecución de cada scraper
- **Costes**: Monitoreo de gastos en IA

### ⚙️ Gestión de Scrapers
- **Listar**: Ver todos los scrapers configurados
- **Activar/Desactivar**: Control remoto de scrapers individuales
- Verificación de estado en tiempo real

### 🚨 Alertas Automáticas (Proactivas)
El sistema te envía alertas automáticas cuando:
- Un scraper activo no se ejecuta en más de 6 horas
- Hay más de 100 propiedades raw sin procesar
- El procesado batch tiene más del 30% de fallos
- Los costes AI exceden el 90% del límite diario
- No hay propiedades nuevas en 12 horas (posible fallo de scrapers)

---

## 🔧 Configuración Inicial

### 1. Registrar Número de Admin

Primero, necesitas agregar tu número de WhatsApp a la base de datos como administrador.

**Opción A: Desde Lovable Cloud (Recomendada)**

1. Ve a tu panel de Lovable Cloud → Database → Tables
2. Busca la tabla `admin_config`
3. Click en "Insert Row"
4. Completa los campos:
   - **telefono**: Tu número con código de país (ej: `+34612345678`)
   - **nombre**: Tu nombre
   - **activo**: `true`
   - **recibir_alertas**: `true`
5. Click en "Insert"

**Opción B: Con SQL**

Ejecuta esta consulta en tu base de datos:

```sql
INSERT INTO admin_config (telefono, nombre, activo, recibir_alertas)
VALUES ('+34612345678', 'Tu Nombre', true, true);
```

⚠️ **Importante**: Usa el formato internacional con `+` y código de país.

---

### 2. Configurar Webhook en Twilio

Para que WhatsApp envíe los mensajes que recibes a la función de InmoFinder:

1. **Accede a tu Twilio Console**
   - Ve a: https://console.twilio.com/

2. **Navega a WhatsApp Sandbox Settings**
   - En el menú lateral: `Messaging` → `Try it out` → `Send a WhatsApp message`
   - O busca directamente: "WhatsApp Sandbox"

3. **Configura el Webhook**
   - Busca la sección "Sandbox Configuration"
   - En el campo "WHEN A MESSAGE COMES IN":
     ```
     https://mtjomlpwpiuhflwmgctk.supabase.co/functions/v1/whatsapp-admin-bot
     ```
   - Método: **POST**
   - Click en "Save"

4. **Verifica la Conexión**
   - Envía "join [código]" al número de Twilio WhatsApp Sandbox desde tu número registrado
   - Luego envía: `ayuda`
   - Deberías recibir la lista de comandos disponibles

---

### 3. Configurar Cron Job para Alertas Automáticas

Las alertas automáticas se ejecutan mediante un cron job que monitorea el sistema cada hora.

**Ejecuta este SQL en tu base de datos** (una sola vez):

```sql
-- Asegúrate de que las extensiones estén habilitadas
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Configurar cron job para alertas cada hora
SELECT cron.schedule(
  'whatsapp-scraper-alerts',
  '0 * * * *', -- Cada hora en punto
  $$
  SELECT net.http_post(
    url:='https://mtjomlpwpiuhflwmgctk.supabase.co/functions/v1/whatsapp-scraper-alerts',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10am9tbHB3cGl1aGZsd21nY3RrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEyMTY0NjgsImV4cCI6MjA3Njc5MjQ2OH0.UzAdZCWeYJ7-P-X1jox0xE5MP8gKPBiU542GWM4mAH4"}'::jsonb,
    body:='{"trigger": "cron"}'::jsonb
  ) as request_id;
  $$
);
```

**Para verificar que el cron está configurado:**

```sql
SELECT * FROM cron.job WHERE jobname = 'whatsapp-scraper-alerts';
```

**Para ver ejecuciones del cron:**

```sql
SELECT * FROM cron.job_run_details 
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'whatsapp-scraper-alerts')
ORDER BY start_time DESC 
LIMIT 10;
```

---

## 📱 Comandos Disponibles

### Consultas Rápidas

| Comando | Alias | Descripción |
|---------|-------|-------------|
| `estado` | `e` | Resumen general del sistema |
| `propiedades` | `p` | Estadísticas de propiedades por portal |
| `raw` | `r` | Propiedades pendientes de procesar |
| `scrapers` | `s` | Estado de ejecución de scrapers |
| `costes` | `c` | Costes de IA del día y mes |

### Gestión de Scrapers

| Comando | Descripción |
|---------|-------------|
| `listar` o `l` | Lista todos los scrapers configurados |
| `activar [nombre]` | Activa un scraper específico |
| `desactivar [nombre]` | Desactiva un scraper específico |

### Ayuda

| Comando | Alias | Descripción |
|---------|-------|-------------|
| `ayuda` | `h` o `?` | Muestra lista de comandos |

---

## 🚨 Alertas Automáticas

El sistema envía alertas proactivas cuando detecta:

### 1. Scrapers Sin Ejecutar
```
⚠️ Murcia - Fotocasa
Sin ejecutar hace 8h (límite: 6h)
```

### 2. Acumulación de Raw
```
🚨 Acumulación de Raw
150 propiedades sin procesar
Más antigua: hace 36h
```

### 3. Fallos en Procesado
```
🚨 Fallos en Procesado
Último batch: 45% fallos (45/100)
```

### 4. Costes AI Excedidos
```
🚨 Coste AI Excedido
$12.50 / $10.00 (125%)
Límite diario superado!
```

### 5. Sin Propiedades Nuevas
```
⚠️ Sin Propiedades Nuevas
No se han detectado propiedades nuevas en las últimas 12h
Scrapers activos: 5
```

---

## 💡 Ejemplos de Uso

### Ejemplo 1: Consultar Estado General

**Envías:**
```
estado
```

**Recibes:**
```
📊 ESTADO GENERAL

🏠 Propiedades activas: 1,247
📥 Raw pendientes: 23
🤖 Scrapers activos: 5
💰 Coste AI hoy: $3.45

Última actualización: 15/11/2025 10:30
```

---

### Ejemplo 2: Ver Scrapers y Activar Uno

**Envías:**
```
listar
```

**Recibes:**
```
📋 SCRAPERS DISPONIBLES

1. ✅ Murcia - Fotocasa
   Portal: fotocasa
   Ubicación: Murcia

2. ⏸️ Alicante - Idealista
   Portal: idealista
   Ubicación: Alicante

Para activar/desactivar:
"activar [nombre]"
"desactivar [nombre]"
```

**Envías:**
```
activar Alicante
```

**Recibes:**
```
✅ Scraper "Alicante - Idealista" activado correctamente
```

---

### Ejemplo 3: Monitorear Costes

**Envías:**
```
costes
```

**Recibes:**
```
💰 COSTES IA

📅 Hoy: $8.25 / $10.00 (83%)
📊 Mes: $145.67
🔢 Llamadas hoy: 342

⚠️ Advertencia: 75% del límite usado
```

---

## 🔐 Seguridad

- Solo números registrados en `admin_config` pueden usar comandos
- Los mensajes de números no autorizados son rechazados automáticamente
- Todas las interacciones quedan registradas en `whatsapp_alerts_log`
- Las credenciales de Twilio están almacenadas de forma segura en Supabase Secrets

---

## 🐛 Troubleshooting

### No recibo respuestas

1. Verifica que tu número esté en `admin_config` con `activo = true`
2. Comprueba que el webhook esté configurado correctamente en Twilio
3. Revisa los logs del edge function: `whatsapp-admin-bot`
4. Asegúrate de haber hecho "join" al Twilio Sandbox

### Las alertas automáticas no llegan

1. Verifica que el cron job esté configurado:
   ```sql
   SELECT * FROM cron.job WHERE jobname = 'whatsapp-scraper-alerts';
   ```

2. Comprueba que `recibir_alertas = true` en tu registro de `admin_config`

3. Revisa los logs del edge function: `whatsapp-scraper-alerts`

4. Verifica ejecuciones recientes del cron:
   ```sql
   SELECT * FROM cron.job_run_details 
   WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'whatsapp-scraper-alerts')
   ORDER BY start_time DESC LIMIT 5;
   ```

### Los comandos no funcionan correctamente

1. Los comandos son case-insensitive, puedes usar mayúsculas o minúsculas
2. Para activar/desactivar scrapers, usa parte del nombre (no hace falta el nombre completo)
3. Si un scraper tiene nombre largo, usa palabras clave únicas (ej: "activar Murcia")

---

## 📊 Personalización

### Ajustar Umbrales de Alerta

Puedes modificar los umbrales directamente en el código del edge function `whatsapp-scraper-alerts`:

```typescript
// Línea ~157: Horas sin ejecutar scraper
const HORAS_LIMITE = 6;

// Línea ~171: Propiedades raw acumuladas
const UMBRAL_RAW = 100;

// Línea ~197: Tasa de fallos en procesado
return tasa > 0.3; // 30% de fallos
```

### Cambiar Frecuencia de Alertas

Para cambiar la frecuencia del cron job (por defecto cada hora):

```sql
-- Cada 30 minutos
SELECT cron.schedule('whatsapp-scraper-alerts', '*/30 * * * *', ...);

-- Cada 2 horas
SELECT cron.schedule('whatsapp-scraper-alerts', '0 */2 * * *', ...);

-- Cada 6 horas
SELECT cron.schedule('whatsapp-scraper-alerts', '0 */6 * * *', ...);
```

---

## 🎯 Próximos Pasos

Este sistema está en **Fase 1** y puede extenderse con:

- **Comandos adicionales**: ejecutar scrapers bajo demanda, generar reportes, etc.
- **Respuestas con imágenes**: enviar gráficos de métricas
- **Comandos con parámetros**: filtrar por fechas, portales específicos, etc.
- **Integración con IA**: consultas en lenguaje natural
- **Webhooks bidireccionales**: recibir alertas de otros sistemas

---

## 📞 Soporte

Para problemas o sugerencias:
1. Revisa los logs de los edge functions en Lovable Cloud
2. Consulta la tabla `whatsapp_alerts_log` para ver historial de mensajes
3. Verifica configuración de Twilio y webhooks

**¡Listo! 🚀**

Ahora puedes gestionar InmoFinder desde cualquier lugar usando solo WhatsApp.
