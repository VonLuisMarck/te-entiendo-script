# InmoFinder / Findoo

Buscador inmobiliario con criterios personales, recomendaciones y favoritos. El código combina un portal de clientes y administración en React, Supabase y un worker Node que captura respuestas de un navegador conectado por CDP. La interfaz conserva la marca Findoo.

**Estado: preparación de un piloto supervisado.** Esta entrega refuerza el acceso a datos, hace verificable la ingestión y añade el recorrido de búsqueda del cliente. No acredita un lanzamiento comercial: faltan pruebas integradas en staging, validación de fuentes y operación, y validación del producto con usuarios.

## Empezar

Requisitos: Node 22.13+ y Deno 2 para comprobar las funciones.

```bash
npm ci --ignore-scripts
cp .env.example .env.local
# Completar únicamente las variables públicas de un proyecto Supabase de staging.
npm run dev
```

Aplicar primero las migraciones y configurar los servicios según [DEPLOYMENT.md](docs/DEPLOYMENT.md). No utilizar credenciales de producción en las pruebas.

```bash
npm test
npm run typecheck
npm run build
deno check --no-lock --config supabase/functions/deno.json supabase/functions/*/index.ts
npm ci --prefix workers/browser --ignore-scripts
npx playwright install chromium
npm test --prefix workers/browser
npm run test:browser
```

Las pruebas PostgreSQL usan PGlite y ejecutan todo el historial de migraciones con roles que simulan Supabase. Las pruebas del portal de clientes usan respuestas simuladas y las del worker conectan un Chromium real a un servidor HTTP de prueba; no prueban la disponibilidad de portales externos, la entrega de correos ni pagos reales.

## Qué incluye este piloto

- Alta con confirmación de correo y perfil creado de forma idempotente tras autenticarse.
- Búsqueda editable: zona, presupuesto, margen, tipo, superficie, dormitorios, baños, estado, año, ascensor y parking.
- Recomendaciones con origen, fecha de observación, favoritos y paginación. Se muestran anuncios activos observados en los últimos siete días.
- Ingestión de cambios de precio, normalización de datos de la fuente y comparación explicable con requisitos obligatorios.
- Administración protegida por rol, aislamiento por cliente y permisos limitados para los workers.
- Preparación de Stripe con sincronización del estado actual y firma de webhooks. **Los cobros están desactivados por defecto.**

El operador inicia captura, revisión, procesamiento y matching. El nuevo panel permite inspeccionar respuestas originales y reprocesarlas. No hay programación automática activa. Las notificaciones e informes de clientes y las valoraciones de reforma están pausados con respuesta explícita 503 hasta completar su implementación y validación.

El alcance, los riesgos conocidos y los criterios para abrir el servicio de pago están en [COMMERCIAL_READINESS.md](docs/COMMERCIAL_READINESS.md). Los documentos anteriores del repositorio describen el prototipo; no son evidencia de funciones operativas.

## Fuera de Lovable

El código de ejecución, la compilación y la normalización no requieren el editor, su tagger ni su gateway de IA. Frontend React estático, worker Node/Chromium y Supabase se configuran con cuentas e infraestructura propias. Hay `Dockerfile`, `compose.yaml` y CI. La cuenta y los datos del despliegue anterior **no se han migrado**.

Consulta [BROWSER_WORKERS.md](docs/BROWSER_WORKERS.md) para arrancar el navegador, configurar captura de cualquier formato, importar un HAR y validar adaptadores. Los ejemplos de portales solo capturan; necesitan una traza real antes de publicar. [QA_BROWSER_2026-09-21.md](docs/QA_BROWSER_2026-09-21.md) distingue las visitas reales y las pruebas sintéticas.

## Plan maestro de mejora

[PRODUCT_ROADMAP.md](docs/PRODUCT_ROADMAP.md) define el estado de referencia, las fases de producto, fuentes, datos, workers, inversión, seguridad y comercialización, con backlog priorizado, pruebas y criterios de cierre. Sus umbrales y esfuerzos son propuestas para validar, no funciones ya entregadas.
