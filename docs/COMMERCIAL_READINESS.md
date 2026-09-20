# Plan para comercializar InmoFinder

Fecha de revisión: 20 de septiembre de 2026. Punto de partida: `main` en `5c4e9fb6b79c92b4726f04b6616dc2d0dbeeb5cc`.

## Producto inicial

Hipótesis de trabajo basada en el producto existente: ayudar a compradores particulares a encontrar y guardar viviendas que respetan su búsqueda. Antes de ampliar a inversores o inmobiliarias, validar este recorrido en una zona y con un grupo pequeño de usuarios. El tamaño y los objetivos siguientes son criterios propuestos para el piloto, no resultados observados ni un compromiso de fecha.

Promesa del piloto: criterios que se guardan, anuncios con procedencia y fecha, requisitos explicables, favoritos y revisión por el equipo. Evitar prometer alertas inmediatas, cobertura completa, oportunidades de inversión o rentabilidad sin medición y soporte operativo.

## Primera entrega: cambios implementados

| Problema observado en el código | Cambio | Validación disponible |
| --- | --- | --- |
| Funciones privilegiadas sin comprobación de identidad/rol; políticas «Service» aplicables a usuarios ordinarios | Autorización común y políticas reservadas a `service_role`; restricciones de campos y RPC sensibles | Pruebas de autenticación, firmas y SQL con dos clientes |
| Asignación de administrador expuesta y endpoint con credenciales fijas | RPC restringido y endpoint de inicialización retirado (410) | Intentos de escalada rechazados en PostgreSQL |
| Alta que intentaba escribir sin sesión al exigir confirmación | Esperar la confirmación y crear el perfil con RPC idempotente | Caso de navegador con alta sin sesión; aislamiento en SQL |
| Portal centrado en venta de planes; criterios no recuperados al editar | Recomendaciones, favoritos, estados de carga/error y edición con datos guardados; retirar controles que no se persistían | Pruebas de navegador con datos simulados |
| Matching que podía compensar una zona equivocada o superar el presupuesto; conjuntos truncados | Requisitos obligatorios, desconocidos sin asumir, lectura paginada, límite explícito antes de escribir | Casos de presupuesto, zona, datos ausentes y más de 1.000 filas |
| Precios cambiados ignorados; errores de webhook tratados como éxito | Ingestión idempotente, invalidación de datos obsoletos, normalización determinista y confirmación atómica del registro | Pruebas SQL y Python, incluidas versiones concurrentes |
| Suscripciones por email, redirecciones del cliente y estado desactualizado | Vinculación por usuario, origen configurado, estado canónico de Stripe, firma y repetición segura de webhooks, sesiones pendientes controladas | Pruebas de reglas y sincronización SQL; integración Stripe pendiente |
| Cron que devolvía éxito sin crear una programación | Respuesta 501 explícita y controles de programación deshabilitados | Revisión del flujo; programación real pendiente |

El scoring actual indica cumplimiento de requisitos (100 o 0); no representa una probabilidad, valoración de mercado ni un modelo entrenado. La normalización no utiliza un modelo para inventar precio, ubicación o atributos.

## Condiciones antes de admitir usuarios al piloto

1. Aplicar migraciones y desplegar frontend, funciones y worker en staging; verificar dos cuentas distintas y un administrador a través de la API real de Supabase.
2. Verificar una muestra de anuncios con una fuente cuyo uso esté autorizado: precio, municipio, tipo, identidad, enlaces, fotos, cambios y retirada. Un formato no compatible debe generar un error revisable.
3. Probar registro, confirmación de correo, inicio/cierre de sesión, guardar y editar búsqueda, ejecución del pipeline, favoritos y errores en móvil y escritorio.
4. Asignar responsable y frecuencia de revisión, recuperar un fallo del worker y comprobar una restauración de backup. Avisar cuando no existan anuncios recientes.
5. Revisar dependencias, configuración y credenciales del repositorio histórico, límites y registros. Los cambios de acceso no constituyen una auditoría completa de seguridad.

## Condiciones antes de cobrar

| Área | Trabajo pendiente | Evidencia para aprobar |
| --- | --- | --- |
| Valor para el cliente | Piloto propuesto de 10–20 compradores en una zona durante dos semanas; entrevistas y revisión de recomendaciones | Medir activación, criterios completos, tiempo hasta primer anuncio útil, favoritos, motivos de descarte y voluntad de pago; acordar los umbrales antes de empezar |
| Datos | Validar condiciones de uso/licencia, cobertura, deduplicación entre portales y calidad de parsers | Fuente autorizada y muestra revisada; errores y anuncios obsoletos medidos |
| Operación | Cola persistente, programación efectiva, reintentos con idempotencia, límites, alertas y métricas | Un reinicio no pierde trabajos; fallos visibles y recuperables; sin cobros ni avisos duplicados |
| Pagos | Configurar productos/precios y portal Stripe de prueba; validar alta, renovación, impago, cancelación y webhooks repetidos/desordenados | Casos completos en test mode; ningún cliente obtiene acceso pagado por modificar el navegador o su perfil |
| Planes y cuotas | Definir una oferta inicial y aplicar límites atómicos en servidor | Concurrencia y consumo real verificados; cada prestación anunciada existe y está disponible |
| Comunicación | Destinatario verificado, preferencias/consentimiento, plantillas, límites e idempotencia para WhatsApp/email | Entrega y baja probadas; sin mensajes arbitrarios ni envíos duplicados |
| Confianza y soporte | Identidad y contacto del prestador, documentos y flujos de privacidad, condiciones, eliminación/exportación de cuenta y soporte | Revisión adecuada al mercado elegido y pruebas de las solicitudes; los enlaces y responsables existen |

Los importes e identificadores de planes heredados son configuración del prototipo, no precios comercialmente validados. `BILLING_ENABLED=true` exige completar las condiciones de pago y prestaciones; no es una certificación automática de preparación comercial.

## Límites explícitos de esta entrega

- No se ha accedido ni desplegado a producción, procesado un pago, enviado comunicaciones o realizado scraping real.
- PGlite comprueba PostgreSQL y políticas; no reproduce el gateway, Auth, extensiones, servicio de correo o configuración real de Supabase.
- El worker actual guarda trabajos en memoria y usa el servidor Flask de desarrollo. Debe pasar a un servidor WSGI y una cola persistente antes de una operación comercial. El piloto requiere supervisión y un único proceso del worker.
- Matching: máximo de 10.000 registros por conjunto y 50.000 pares por ejecución; fuera de ese alcance falla explícitamente. Requiere ejecutar por cliente o desarrollar trabajos paginados persistentes. No hay recálculo automático tras editar criterios; el equipo debe ejecutarlo.
- Las escrituras masivas de matching no forman una transacción única ni comprueban una versión de criterios por lote. Un fallo parcial o cambios de criterios/anuncios durante el cálculo requieren repetir la ejecución; la cola persistente y la publicación con comprobación de versiones quedan pendientes. Supervisar este caso en el piloto.
- Las reglas de normalización deben contrastarse con muestras reales de cada portal. No se han comprobado los identificadores numéricos de tipos y prestaciones contra el portal vivo.
- Los informes/WhatsApp de clientes y la valoración de reformas se han cerrado temporalmente: las versiones anteriores no garantizaban cuotas, destinatarios o persistencia. Las herramientas administrativas de IA heredadas permanecen solo para administradores y necesitan su propia validación.
- Falta completar la recuperación de contraseña y el borrado/exportación de cuenta antes de la beta pública.
- La edición del perfil y de los criterios son dos escrituras comprobadas, no una única transacción. Ante un fallo, se muestra error y puede repetirse; conviene consolidarlas antes de escalar.

## Referencias técnicas contrastadas

- [Supabase: seguridad por fila](https://supabase.com/docs/guides/database/postgres/row-level-security) y [privilegios por columna](https://supabase.com/docs/guides/database/postgres/column-level-security).
- [Stripe: recepción de webhooks](https://docs.stripe.com/webhooks), incluido tratamiento de duplicados y orden de eventos; [periodos por item en Basil](https://docs.stripe.com/changelog/basil/2025-03-31/deprecate-subscription-current-period-start-and-end).
- [Twilio: validación de peticiones](https://www.twilio.com/docs/usage/security) y [ElevenLabs: webhooks posteriores a llamadas](https://elevenlabs.io/docs/eleven-agents/workflows/post-call-webhooks).

## Resultado de esta revisión local

24 comprobaciones Node/PostgreSQL, 8 de Python y 4 casos de navegador aprobados. TypeScript, las 24 Edge Functions en Deno y la compilación de producción pasan. Navegador: Chromium 153, escritorio y viewport móvil emulado; Supabase interceptado con fixtures. La ejecución remota de CI y los servicios reales de staging no están acreditados por estas pruebas.

La carga inicial de JavaScript se ha dividido por rutas: el bundle principal pasa de aproximadamente 1,98 MB a 494 kB antes de gzip (comparación de builds locales); las herramientas administrativas se cargan al visitar su ruta. Esto no equivale a una medición de velocidad en dispositivos reales.
