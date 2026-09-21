# InmoFinder / Findoo

Buscador inmobiliario independiente de Lovable: React, Supabase propio y workers Node conectados a Chromium por CDP. Captura respuestas de red, conserva el bruto y permite revisar, normalizar y reproducir la ingesta sin volver a visitar la fuente. La interfaz mantiene la marca Findoo.

**Estado: núcleo del roadmap implementado para validar un piloto.** Hay pruebas automatizadas y despliegue reproducible; faltan un HAR/contrato real de fuente, la migración al entorno propio y la aceptación integrada con usuarios. No se han activado cobros ni envío de email.

## Empezar

Node 22.13+; Deno 2 para comprobar las funciones.

```bash
npm ci --ignore-scripts
cp .env.example .env.local
# Configurar solo URL y clave pública de tu Supabase de staging.
npm run dev
```

Aplicar migraciones y configurar servicios según [DEPLOYMENT.md](docs/DEPLOYMENT.md). El frontend rechaza una clave de servicio al compilar. El worker utiliza otras credenciales, nunca variables públicas `VITE_*`.

## Qué incluye

- Búsqueda transaccional y versionada, borradores recuperables, requisitos y preferencias, radio geográfico y resultados explicables.
- Ficha con evidencia e historial, favoritos, seguimiento, notas, visitas y motivos de descarte.
- Comparación de 2–4 inmuebles, PDF y enlaces temporales revocables sin información privada.
- Escenarios de inversión editables/versionados, financiación, gastos, vacancia y sensibilidad; sin estimar datos desconocidos.
- Bandeja de avisos, preferencias y outbox de email preparada; recuperación, exportación y borrado de cuenta.
- Workers con checkpoints, outbox durable, reintentos idempotentes, programación por intervalos, cuotas, pausas y métricas.
- Modelo de anuncios/observaciones/inmuebles, evidencia por campo, eventos, revisión por registro y matching atómico que rechaza versiones antiguas.
- Contenedores independientes, pipeline optativo, copias de seguridad y pruebas de fallos, seguridad, navegador y Compose.

La captura no presupone JSON. Los decodificadores actuales admiten JSON/NDJSON; cualquier otro formato necesita su contrato. Los ejemplos de Fotocasa/Pisos siguen en modo captura sin un adaptador real validado. El sistema se detiene ante controles de acceso y no requiere el perfil personal del navegador.

## Comprobar

```bash
npm test
npm run typecheck
npm run build
npm audit --audit-level=high
deno check --no-lock --config supabase/functions/deno.json supabase/functions/*/index.ts
npm ci --prefix workers/browser --ignore-scripts
npx playwright install chromium
npm test --prefix workers/browser
npm run test:browser
```

Las pruebas SQL usan PostgreSQL/PGlite con roles simulados de Supabase. La interfaz usa fixtures; los workers prueban CDP con Chromium real y un servidor sintético. CI prueba también Compose, reinicio y persistencia. No equivalen a validar portales, Auth, correo o pagos reales.

## Documentación vigente

- [Estado de las 63 tareas](docs/ROADMAP_IMPLEMENTATION.md): implementación, evidencia y dependencias pendientes.
- [Roadmap original](docs/PRODUCT_ROADMAP.md): objetivos, prioridades y puertas de aceptación.
- [Preparación comercial](docs/COMMERCIAL_READINESS.md): qué puede prometerse y qué falta antes de cobrar.
- [Despliegue y migración](docs/DEPLOYMENT.md): entorno propio, secretos y secuencia de actualización.
- [Workers y HAR](docs/BROWSER_WORKERS.md): captura, contratos, replay, programación y límites.
- [Operación y recuperación](docs/OPERATIONS.md): incidentes, backup, retención y piloto.

Los documentos históricos del prototipo describen estados anteriores; no acreditan funciones actuales. El código ya no depende del editor/tagger/gateway de Lovable. Las cuentas, datos y dominio del despliegue anterior todavía necesitan migrarse.
