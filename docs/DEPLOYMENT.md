# Preparación y validación en staging

Esta guía prepara un piloto; no autoriza ni describe un despliegue ya realizado. Usar un proyecto Supabase, dominio frontend y credenciales de proveedores independientes de producción.

## Configuración

| Dónde | Variable | Uso |
| --- | --- | --- |
| Frontend | `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` | URL y clave pública del proyecto de staging; únicas variables del ejemplo `.env.example` |
| Edge Functions | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Valores proporcionados por Supabase; nunca incluir la clave de servicio en el frontend |
| Edge Functions | `APP_URL` | Origen HTTPS exacto del frontend, sin ruta, query o fragmento; localhost HTTP permitido en desarrollo |
| Edge Functions | `BROWSER_WORKER_URL` | URL base HTTPS del worker |
| Edge Functions y worker | `SCRAPER_API_KEY` | Secreto aleatorio compartido para invocar el worker mediante Bearer |
| Edge Functions y worker | `SCRAPER_SECRET` | Secreto distinto para que el worker ingrese anuncios; no concede permisos de administración |
| Worker | `SUPABASE_URL`, `PORT`, `CDP_ENDPOINTS`, `SOURCES_FILE`, `WORKER_DB` | Destino de callback fijado por configuración; puerto 8000 y un navegador local por defecto |
| Edge Functions | `BILLING_ENABLED` | `false` durante el piloto gratuito; ausencia equivale a desactivado |
| Edge Functions | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Clave y secreto de endpoint de Stripe **test mode** mientras se valida |
| Webhook Twilio administrativo | `TWILIO_AUTH_TOKEN`, `TWILIO_ADMIN_WEBHOOK_URL` | Validación de firma con URL pública exacta, incluido cualquier query configurado |
| Webhook ElevenLabs | `ELEVENLABS_WEBHOOK_SECRET` | HMAC y tolerancia de timestamp de cinco minutos |

El worker y su navegador se despliegan según [BROWSER_WORKERS.md](BROWSER_WORKERS.md).

Configurar secretos desde el gestor del proveedor. No añadirlos a Git, URLs, comandos registrados ni variables `VITE_*`. Revisar también configuración/credenciales históricas y revocar o rotar las que hayan quedado expuestas; `.gitignore` no elimina archivos ya versionados ni su historial.

## Orden de actualización

1. Preparar backup/restauración, inventariar administradores y detener temporalmente ejecutores de scraping/matching. Registrar la revisión anterior del frontend y funciones.
2. En una base nueva, aplicar **todo** el historial `supabase/migrations` por orden. En una existente, aplicar solo las pendientes. Las cuatro migraciones `20260920…` endurecen permisos, añaden ingestión y leases, sincronización de facturación y normalización atómica/invalidation de matches.
3. Revisar los perfiles existentes, presupuestos invertidos, duplicados, clientes sin usuario y administradores; las comprobaciones `NOT VALID` no limpian datos históricos automáticamente.
4. Desplegar todas las Edge Functions junto con `_shared` y `deno.json` y la configuración por función de `supabase/config.toml`. El webhook de Stripe tiene `verify_jwt=false` porque valida su propia firma. No habilitarlo sin secreto.
5. Actualizar el worker y configurar ambos secretos compartidos. Solo `/health` queda público. No configurar callbacks desde peticiones del usuario.
6. Compilar/desplegar el frontend con variables de staging. Configurar SPA fallback para las rutas y URLs permitidas de Supabase Auth, incluyendo `/cliente/onboarding` después de confirmar el email. Verificar correo real y sesión.
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
- **Búsqueda:** guardar y reabrir los valores. Al cambiar presupuesto/criterios se invalidan matches anteriores. Ejecutar matching y comprobar exclusiones por zona, presupuesto, baños o requisito desconocido.
- **Pipeline:** iniciar una fuente autorizada en el panel; confirmar que devuelve job ID. Supervisar el estado del worker, procesar pendientes en `/batch-processing` y calcular en `/matchings`. Verificar precio contra origen, cambio de precio, repetición sin duplicado y propagación de un error de callback. Publicar solo datos contrastados.
- **Portal:** comprobar anuncios activos y recientes, origen/fecha, favoritos persistentes, carga, error, vacío y vista móvil. Un anuncio no visto durante siete días deja de mostrarse; eso no acredita que se haya vendido.
- **Programación:** `manage-cron-jobs` devuelve 501. No comunicar un intervalo automático como activo. Asignar una revisión manual del piloto; la programación persistente debe implementarse y observarse después.
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

El workflow `ci.yml` comprueba TypeScript, compilación, reglas de negocio, políticas y migraciones PostgreSQL, funciones Deno, worker CDP con Chromium real y servidor sintético, interfaz con fixtures y construcción de imágenes independientes. No contiene credenciales reales. Las pruebas de navegador interceptan Supabase y no sustituyen los casos integrados anteriores. Ejecutar además la revisión de dependencias y configuración antes de una beta pública.

## Salida del entorno anterior

1. Crear un proyecto Supabase bajo una cuenta propia y mantener el origen anterior disponible hasta verificar la migración. `project_id` local no fija un proveedor ni traslada la base. Vincular la CLI al nuevo proyecto con `supabase link --project-ref ID_DEL_PROYECTO` y revisar migraciones antes de `supabase db push`.
2. Exportar y restaurar datos, usuarios/Auth y objetos de Storage mediante procedimientos compatibles con el proveedor. Inventariar secretos, plantillas de correo, redirecciones OAuth, tareas y webhooks. No hay un export de cuentas ni una restauración hecha en esta entrega.
3. Compilar el frontend con URL y clave pública propias. El fichero `.env` histórico y el lockfile de Bun se retiran de la rama; usar el lockfile de npm y `.env.example`.
4. Desplegar el worker Node y Chromium dedicados, aplicar los secretos y validar una traza de cada fuente. El worker Python anterior se ha retirado y los antiguos triggers por ciudad ya no se ejecutan.
5. Desplegar las funciones actuales: `transform-property` y `classify-location` aceptan registros estructurados y normalización determinista; ya no aceptan HTML para inferencia. `generate-city-image` devuelve 410 al haberse retirado su proveedor anterior. No tenía consumidor en la interfaz.
6. Probar con cuentas y datos de staging, conservar copia restaurable y verificar dominio, TLS y correo. Solo entonces cambiar el tráfico del dominio propio. No se ha cambiado DNS ni publicado producción en esta entrega.
