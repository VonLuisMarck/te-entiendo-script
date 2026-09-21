# Preparación y validación en staging

Esta guía prepara un piloto; no autoriza ni describe un despliegue ya realizado. Usar un proyecto Supabase, dominio frontend y credenciales de proveedores independientes de producción.

## Configuración

| Dónde                         | Variable                                                                  | Uso                                                                                                   |
| ----------------------------- | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Frontend                      | `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`                      | URL y clave pública propias; la compilación rechaza claves de servicio                                |
| Frontend                      | `VITE_MAP_TILE_URL`, `VITE_MAP_ATTRIBUTION`                               | Opcionales: teselas y atribución del proveedor de mapas elegido                                       |
| Edge Functions                | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`          | Valores proporcionados por Supabase; nunca incluir la clave de servicio en el frontend                |
| Edge Functions                | `APP_URL`                                                                 | Origen HTTPS exacto del frontend, sin ruta, query o fragmento; localhost HTTP permitido en desarrollo |
| Edge Functions                | `BROWSER_WORKER_URL`                                                      | URL base HTTPS del worker                                                                             |
| Edge Functions y worker       | `SCRAPER_API_KEY`                                                         | Secreto aleatorio compartido para invocar el worker mediante Bearer                                   |
| Edge Functions y worker       | `SCRAPER_SECRET`                                                          | Secreto distinto para que el worker ingrese anuncios; no concede permisos de administración           |
| Worker                        | `SUPABASE_URL`, `PORT`, `CDP_ENDPOINTS`, `SOURCES_FILE`, `WORKER_DB`      | Destino de callback fijado por configuración; puerto 8000 y un navegador local por defecto            |
| Edge Functions                | `BILLING_ENABLED`                                                         | `false` durante el piloto gratuito; ausencia equivale a desactivado                                   |
| Edge Functions                | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`                              | Clave y secreto de endpoint de Stripe **test mode** mientras se valida                                |
| Email / Edge Functions        | `EMAIL_ENABLED`, `RESEND_API_KEY`, `EMAIL_FROM`, `APP_URL`                | Email desactivado por defecto; remitente/dominio verificados propios                                  |
| Pipeline separado             | `SUPABASE_SERVICE_ROLE_KEY`, `PIPELINE_INTERVAL_SECONDS`, `EMAIL_ENABLED` | Credencial exclusivamente de servidor; normalización/matching y, si se habilita, despacho de email    |
| Webhook Twilio administrativo | `TWILIO_AUTH_TOKEN`, `TWILIO_ADMIN_WEBHOOK_URL`                           | Validación de firma con URL pública exacta, incluido cualquier query configurado                      |
| Webhook ElevenLabs            | `ELEVENLABS_WEBHOOK_SECRET`                                               | HMAC y tolerancia de timestamp de cinco minutos                                                       |

El worker y su navegador se despliegan según [BROWSER_WORKERS.md](BROWSER_WORKERS.md).

Configurar secretos desde el gestor del proveedor. No añadirlos a Git, URLs, comandos registrados ni variables `VITE_*`. Revisar también configuración/credenciales históricas y revocar o rotar las que hayan quedado expuestas; `.gitignore` no elimina archivos ya versionados ni su historial.

## Orden de actualización

1. Preparar backup/restauración, inventariar administradores y detener temporalmente ejecutores de scraping/matching. Registrar la revisión anterior del frontend y funciones.
2. En una base nueva, aplicar **todo** el historial `supabase/migrations` por orden. En una existente, aplicar solo las pendientes. Las migraciones `20260920…` endurecen permisos, ingestión, leases, facturación y normalización. Las cinco `20260921…` añaden evidencias/historial, búsqueda y matching versionados, espacio de cliente/presupuestos, outbox de email y operación/retención. **El historial antiguo contiene limpieza destructiva de datos del prototipo:** en una base nueva aplicar el esquema antes de importar los datos; nunca volver a ejecutar todo el historial sobre datos ya restaurados.
3. Revisar los perfiles existentes, presupuestos invertidos, duplicados, clientes sin usuario y administradores; las comprobaciones `NOT VALID` no limpian datos históricos automáticamente.
4. Desplegar todas las Edge Functions junto con `_shared` y `deno.json` y la configuración por función de `supabase/config.toml`. El webhook de Stripe tiene `verify_jwt=false` porque valida su propia firma. No habilitarlo sin secreto.
5. Actualizar el worker y configurar ambos secretos compartidos. Solo `/health` queda público. No configurar callbacks desde peticiones del usuario.
6. Compilar/desplegar el frontend con variables de staging. Configurar SPA fallback para las rutas y URLs permitidas de Supabase Auth, incluyendo `/cliente/onboarding` después de confirmar el email y `/auth/recovery` para recuperar contraseña. Verificar correo real y sesión.
7. Ejecutar los casos siguientes y revisar errores antes de invitar usuarios. Mantener `BILLING_ENABLED=false`.

El endpoint `initialize-admin` ahora devuelve 410. Crear la cuenta mediante Auth y asignar el rol desde una conexión SQL operativa de confianza, usando un UUID ya verificado:

```sql
-- Sustituir por el UUID de una cuenta existente y verificada por el operador.
INSERT INTO public.user_roles (user_id, role)
VALUES ('00000000-0000-4000-8000-000000000000', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;
```

No se restaura acceso público a `assign_admin_role` ni se usa una contraseña predefinida.

## Recorrido de aceptación

- **Acceso:** dos clientes y un administrador. Sin sesión/como cliente, rechazar funciones administrativas, lectura de datos de otro cliente, cambio de suscripción, modificación de scores y asignación de roles. Probar mediante HTTP además de la interfaz.
- **Alta:** confirmar que el registro sin sesión solo solicita revisar el email. Tras confirmarlo, un único perfil aparece; repetir entrada no crea duplicados.
- **Búsqueda:** guardar perfil/criterios atómicamente y reabrir valores/borrador. Editar desde dos sesiones: la segunda escritura sobre una versión antigua debe fallar. Comprobar radio, requisitos frente a preferencias y que cambiar el criterio invalida matches anteriores conservando favoritos.
- **Pipeline:** iniciar una fuente autorizada en el panel; confirmar que devuelve job ID. Supervisar el estado del worker, procesar pendientes en `/batch-processing` y calcular en `/matchings`. Verificar precio contra origen, cambio de precio, repetición sin duplicado y propagación de un error de callback. Publicar solo datos contrastados.
- **Portal:** comprobar anuncios activos y recientes, origen/fecha, favoritos persistentes, carga, error, vacío y vista móvil. Un anuncio no visto durante siete días deja de mostrarse; eso no acredita que se haya vendido.
- **Programación:** crear un intervalo en `/scraper`, reiniciar el worker y comprobar la próxima ejecución y los efectos de pausar fuente/planificación. Los intervalos son UTC y no una hora local fija. El endpoint antiguo `manage-cron-jobs` sigue retirado; el programador vigente vive en SQLite.
- **Espacio de cliente:** guardar nota/visita, escenario versionado y comparación. Abrir enlace en una sesión anónima, comprobar que no contiene notas/escenarios y revocarlo. Exportar y borrar una cuenta de prueba; verificar suscripción, cascadas y archivos de Storage.
- **Avisos:** bandeja y preferencias; con el proveedor configurado en staging, probar opt-out, quiet hours, entrega incierta y reintento con la misma clave. No equiparar aceptación por el proveedor con recepción del correo.
- **Restauración:** provocar un fallo controlado en staging, comprobar que se detecta y documentar cómo recuperar sin repetir efectos externos.

## Validación de Stripe antes de activar planes

1. Verificar que los productos y precios de `src/lib/subscription-tiers.ts` y `_shared/billing.ts` pertenecen a la misma cuenta y modo de Stripe. Reemplazar los identificadores heredados si procede.
2. Configurar portal de facturación y endpoint público `/functions/v1/stripe-webhook` con su secreto. Escuchar `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `customer.subscription.created/updated/deleted`, `invoice.paid` e `invoice.payment_failed`.
3. En staging, activar `BILLING_ENABLED=true` exclusivamente para las pruebas de aceptación. Comprobar pago correcto, dos clicks simultáneos, plan inválido, intento de redirección, sesión pendiente y acceso al portal por su propietario.
4. Probar renovación, impago, cancelación inmediata/al final del periodo, reintentos y eventos fuera de orden. Los eventos vuelven a leer el estado actual de Stripe; una firma falsa debe fallar y una incidencia de sincronización debe permitir reintento (503).
5. Comprobar acceso en base de datos y UI tras cerrar el navegador, volver a entrar y vencer el periodo. No confiar en parámetros `success=true`, email o campos enviados por el cliente.
6. Volver a desactivar cobros hasta validar cuotas, oferta y las prestaciones incluidas en los planes. No trasladar las claves de test al entorno real.

## Recuperación

No revertir automáticamente las restricciones de acceso: reabriría vulnerabilidades. Si una actualización falla, pausar procesos, mantener los cobros cerrados y aplicar una corrección hacia delante. Las migraciones están transaccionadas individualmente; una aplicada no equivale a un despliegue completo. Una restauración de backup exige evaluar y conciliar anuncios, perfiles y eventos de Stripe posteriores al backup. Probar el procedimiento primero en staging.

## Pruebas locales y CI

El workflow `ci.yml` comprueba TypeScript, compilación, reglas de negocio, políticas y migraciones PostgreSQL, funciones Deno, worker CDP con Chromium real y servidor sintético, interfaz con fixtures y construcción de imágenes independientes y Compose completo: CDP privado, persistencia tras reinicio y backup de SQLite. No contiene credenciales reales. Las pruebas de navegador interceptan Supabase y no sustituyen los casos integrados anteriores. Ejecutar además la revisión de dependencias y configuración antes de una beta pública.

## Salida del entorno anterior

1. Crear un proyecto Supabase bajo una cuenta propia y mantener el origen anterior disponible hasta verificar la migración. `project_id` local no fija un proveedor ni traslada la base. Vincular la CLI al nuevo proyecto con `supabase link --project-ref ID_DEL_PROYECTO` y revisar migraciones antes de `supabase db push`.
2. Exportar y restaurar datos, usuarios/Auth y objetos de Storage mediante procedimientos compatibles con el proveedor. Inventariar secretos, plantillas de correo, redirecciones OAuth, tareas y webhooks. No hay un export de cuentas ni una restauración hecha en esta entrega.
3. Compilar el frontend con URL y clave pública propias. El fichero `.env` histórico y el lockfile de Bun se retiran de la rama; usar el lockfile de npm y `.env.example`.
4. Desplegar el worker Node y Chromium dedicados, aplicar los secretos y validar una traza de cada fuente. El worker Python anterior se ha retirado y los antiguos triggers por ciudad ya no se ejecutan.
5. Desplegar las funciones actuales: `transform-property` y `classify-location` aceptan registros estructurados y normalización determinista; ya no aceptan HTML para inferencia. `generate-city-image` devuelve 410 al haberse retirado su proveedor anterior. No tenía consumidor en la interfaz.
6. Probar con cuentas y datos de staging, conservar copia restaurable y verificar dominio, TLS y correo. Solo entonces cambiar el tráfico del dominio propio. No se ha cambiado DNS ni publicado producción en esta entrega.

## Pipeline automático optativo

Primero validar manualmente una ingesta y el matching. Después, con credenciales de **staging** cargadas desde el gestor de secretos:

```bash
docker compose -f compose.yaml -f compose.pipeline.yaml up --build --wait -d
```

El servicio separado `pipeline` llama a `batch-classify-properties` y `matching-service` cada 60 segundos por defecto (rango 30–3.600). La credencial de servicio solo existe en ese proceso; no se añade al contenedor del navegador ni al frontend. Las funciones conservan leases y publicación atómica. El proceso no migra datos ni crea adaptadores de portales. El modo `node src/pipeline.mjs --once` permite un ciclo supervisado.

Para detener el procesamiento sin perder datos: `docker compose -f compose.yaml -f compose.pipeline.yaml stop pipeline`. Para parar capturas, pausar la fuente y sus programaciones en el panel. Usar el mismo conjunto de archivos Compose en las operaciones posteriores.

## Email optativo

1. Configurar `RESEND_API_KEY`, `EMAIL_FROM`, `APP_URL` y `EMAIL_ENABLED=true` **solo en el staging preparado para el ensayo**. El remitente debe pertenecer a un dominio verificado. Activar también `EMAIL_ENABLED` en el pipeline si se quiere ejecutar periódicamente el despacho.
2. El usuario debe confirmar su email mediante Auth y habilitar email en preferencias. Nunca se toma el destinatario de un campo de perfil editable ni de una petición del navegador.
3. El proveedor recibe un payload persistido y una clave estable por entrega. Reintentos automáticos: máximo tres, dentro de 23 horas de crear la entrega (límite conservador respecto al primer intento). Pasado ese plazo se requiere conciliación operativa; no se cambia la clave para forzar otro envío.
4. Probar pausa/baja antes de reclamar el lote, cambios de email, horas de descanso en la zona elegida, pérdida de respuesta y recepción real. El registro `accepted` no es confirmación de entrega ni prueba de consentimiento futuro.
5. Mantener desactivado fuera del ensayo hasta cerrar reputación, rebotes, soporte y responsabilidades. WhatsApp y llamadas con IA permanecen pausados.

La ventana de reintento se mantiene por debajo de las 24 horas documentadas para las [claves de idempotencia de Resend](https://resend.com/docs/dashboard/emails/idempotency-keys).

## Mapa

El mapa interactivo carga teselas al abrirlo; no precarga zonas. Por defecto usa OpenStreetMap con atribución visible. Para un despliegue comercial, seleccionar un proveedor y capacidad adecuados y configurar las dos variables públicas de mapa al compilar (también disponibles como argumentos Docker). La política del servidor público de teselas exige atribución, caché normal y limita usos masivos; no ofrece SLA. Véase [política de teselas de OpenStreetMap](https://operations.osmfoundation.org/policies/tiles/). Las pruebas sintéticas no recorren ni descargan mapas reales.

## Acta mínima del despliegue

Guardar de forma privada: commit desplegado, ID de proyecto, hosts sin credenciales, migraciones aplicadas, recuentos antes/después, pruebas de acceso, hash/fecha del backup y restauración, logs por job/batch, funciones desplegadas y resultado de aceptación. No basta con que una imagen arranque. Si falta alguna evidencia, mantener el piloto cerrado para esa capacidad.
