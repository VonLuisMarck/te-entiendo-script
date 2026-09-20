# InmoFinder / Findoo

Buscador inmobiliario con criterios personales, recomendaciones y favoritos. El código combina un portal de clientes y administración en React, Supabase y un worker de recopilación en Python. La interfaz conserva la marca Findoo.

**Estado: preparación de un piloto supervisado.** Esta entrega refuerza el acceso a datos, hace verificable la ingestión y añade el recorrido de búsqueda del cliente. No acredita un lanzamiento comercial: faltan pruebas integradas en staging, validación de fuentes y operación, y validación del producto con usuarios.

## Empezar

Requisitos: Node 22+, Python 3.12 y Deno 2 para comprobar las funciones.

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
python -m pip install -r docker/requirements.txt
python -m unittest discover -s tests -p 'test_*.py'
npx playwright install chromium
npm run test:browser
```

Las pruebas PostgreSQL usan PGlite y ejecutan todo el historial de migraciones con roles que simulan Supabase. Las pruebas de navegador y Python usan respuestas simuladas; no prueban la disponibilidad de portales externos, la entrega de correos ni pagos reales.

## Qué incluye este piloto

- Alta con confirmación de correo y perfil creado de forma idempotente tras autenticarse.
- Búsqueda editable: zona, presupuesto, margen, tipo, superficie, dormitorios, baños, estado, año, ascensor y parking.
- Recomendaciones con origen, fecha de observación, favoritos y paginación. Se muestran anuncios activos observados en los últimos siete días.
- Ingestión de cambios de precio, normalización de datos de la fuente y comparación explicable con requisitos obligatorios.
- Administración protegida por rol, aislamiento por cliente y permisos limitados para los workers.
- Preparación de Stripe con sincronización del estado actual y firma de webhooks. **Los cobros están desactivados por defecto.**

El operador inicia recopilación, procesamiento y matching. Las pantallas indican que la programación automática sigue pendiente. Las notificaciones e informes de clientes y las valoraciones de reforma están pausados con respuesta explícita 503 hasta completar su implementación y validación.

El alcance, los riesgos conocidos y los criterios para abrir el servicio de pago están en [COMMERCIAL_READINESS.md](docs/COMMERCIAL_READINESS.md). Los documentos anteriores del repositorio describen el prototipo; no son evidencia de funciones operativas.
