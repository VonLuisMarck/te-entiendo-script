# Preparación comercial de InmoFinder

Revisión: 21 de septiembre de 2026. Este documento sustituye el inventario del prototipo Python y del matching anterior. El estado por tarea está en [ROADMAP_IMPLEMENTATION.md](ROADMAP_IMPLEMENTATION.md); las propuestas y gates originales se conservan en [PRODUCT_ROADMAP.md](PRODUCT_ROADMAP.md).

**Resultado: núcleo ampliado implementado y verificable; lanzamiento comercial todavía pendiente de validación externa.** El repositorio se compila y despliega sin Lovable. No se han migrado cuentas, Auth, datos, Storage ni dominio del entorno anterior. Los ejemplos de portales continúan sin un adaptador real: capturan respuestas, pero no acreditan búsquedas útiles de una fuente viva.

## Capacidades entregadas

| Área               | Comportamiento actual                                                                                                           | Evidencia y límite                                                                                                     |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Seguridad          | Autorización de funciones, RLS, restricciones de columnas/RPC, separación de credenciales y validación de configuración pública | Pruebas negativas con dos clientes en PostgreSQL/PGlite; falta comprobar el gateway y Auth reales                      |
| Dependencias       | Actualizados jsPDF, AutoTable, React Router, Vite y dependencias transitivas                                                    | `npm audit` sin avisos en la revisión; CI falla ante vulnerabilidades altas/críticas. No equivale a auditoría completa |
| Navegador          | Chromium dedicado conectado mediante CDP; cuerpos de respuesta conservados como bytes con hash                                  | Chromium real contra servidor sintético. No extrae anuncios del HTML ni garantiza guardar antes del renderizado        |
| Ejecución          | SQLite, leases, checkpoints, pausa/cancelación/prioridad, intervalos persistentes, cuotas por ámbito y pausa de fuente          | Fallos inyectados, reinicios y recuperación offline; un host, hasta cuatro navegadores                                 |
| Entrega            | Outbox por lote, confirmación durable, payload inmutable e ingesta atómica idempotente                                          | Corte después del commit y antes de la respuesta probado; ningún contador confirmado se pierde al reintentar           |
| Datos              | Anuncio separado de inmueble canónico, observaciones versionadas, eventos, evidencia y revisión por registro                    | Muestras sintéticas. Asociación canónica manual, reversible y auditada; no existe dedupe automático acreditado         |
| Búsqueda           | Perfil y criterios en una transacción, control de versiones, requisitos separados de preferencias                               | Conflictos entre sesiones rechazados; borradores locales recuperables; una búsqueda actual por cliente                 |
| Ranking            | Requisitos estrictos y preferencias explicadas; antigüedad y completitud separadas                                              | Puntuación de reglas, no probabilidad ni precio de mercado; mejora de relevancia aún sin medir                         |
| Geografía          | Radio seleccionable y mapa; matching de radio/polígono sobre coordenadas exactas                                                | Datos aproximados/desconocidos no satisfacen un requisito espacial. Dibujo de polígonos y rutas pendientes             |
| Espacio de cliente | Ficha, historia, favoritos, seguimiento, notas, visitas, descartes y valoración de utilidad                                     | Persistencia y aislamiento probados; los favoritos antiguos conservan su contexto                                      |
| Comparación        | Dos a cuatro candidatos, campos homogéneos, PDF y enlace temporal revocable                                                     | El enlace contiene una instantánea de hechos seleccionados; no notas ni escenarios privados                            |
| Inversión          | Supuestos explícitos, costes, financiación, vacancia, impago, cash flow y sensibilidad                                          | Fórmulas contrastadas con cálculos independientes en tests. No estima alquiler, fiscalidad, tasación ni comparables    |
| Avisos             | Bandeja, deduplicación por evento, preferencias, pausa y outbox de email                                                        | Quiet hours y DST probados en SQL. Email desactivado; entrega real, rebotes y reputación sin validar                   |
| Cuenta             | Recuperación de contraseña, cierre global de sesiones, exportación y borrado con reautenticación reciente                       | Rutas/SQL probados; Auth/SMTP reales, objetos históricos de Storage y ciclo completo pendientes                        |
| Operación          | Métricas privadas, registro de costes, logs por trabajo/lote, backup consistente y runbooks                                     | Infraestructura reproducible y pruebas en CI; no hay operación sostenida ni margen medido                              |

## Condiciones antes del piloto

1. **Entorno propio:** crear staging, aplicar migraciones pendientes, desplegar funciones/frontend/worker y probar dos usuarios y un administrador mediante API e interfaz. Registrar revisión, dominio, proyecto y resultado sin secretos.
2. **Primera fuente:** recibir HAR con cuerpos y fechas, confirmar uso permitido, construir contrato versionado y evaluar muestras reservadas. Contrastar precio, operación, divisa, filtros, páginas, identidad, localización, duplicados y cambios. No activar publicación solo porque se pueda decodificar JSON.
3. **Cadena completa:** observar captura → lote confirmado → normalización → matching → ficha → aviso en el proyecto real. Una captura incompleta o un campo esencial dudoso exige revisión.
4. **Recuperación:** restaurar PostgreSQL y SQLite en destinos aislados; comparar recuentos, relaciones, decisiones, sesiones y estados de entrega. Conciliar acciones externas posteriores al backup.
5. **Uso real:** comprobar móvil físico, teclado y lector de pantalla, y realizar sesiones con participantes. Las pruebas con viewport móvil no acreditan Safari/iOS ni accesibilidad completa.
6. **Responsables:** elegir primera cohorte, zona, responsable de fuente, responsable operativo y canal de soporte. Acordar cómo responder a cero resultados, cola bloqueada, fuente pausada y bajas de usuarios.

## Condiciones antes de cobrar

| Puerta               | Evidencia todavía necesaria                                                                                   |
| -------------------- | ------------------------------------------------------------------------------------------------------------- |
| Utilidad             | Piloto de 2–4 semanas y entrevistas: candidatos útiles, tiempo ahorrado, causas de descarte y oferta aceptada |
| Fuente y datos       | Muestra revisada, uso autorizado, cobertura y frescura medidas; incidentes de contrato gestionados            |
| Operación            | Restauración acreditada, alertas operativas conectadas a un responsable, capacidad y costes representativos   |
| Pagos y cuotas       | Precios propios, Stripe test mode completo, reconciliación y límites de cada prestación aplicados en servidor |
| Privacidad y soporte | Documentos y contacto reales del prestador, revisión adecuada al mercado, exportación/baja verificadas        |
| Comunicación         | Dominio de envío verificado, consentimiento, destinatario confirmado, baja, reintentos y rebotes probados     |

`BILLING_ENABLED=false` y `EMAIL_ENABLED=false` siguen siendo los valores seguros por defecto. Las tablas de planes/IDs heredadas no son una oferta validada y no deben activarse sin sustituirlas y cerrar estas puertas. Los presupuestos atómicos añadidos son infraestructura para consumo futuro; no limitan todavía todas las prestaciones de los planes antiguos.

## Límites que deben seguir visibles

- Fuente real, datos de mercado, calidad longitudinal, carga representativa, rentabilidad del servicio y disposición de pago no están demostrados.
- Solo hay decodificadores JSON/NDJSON. Otros cuerpos se preservan, pero SSE/WebSocket, protobuf y demás formatos necesitan una implementación basada en una traza.
- La planificación usa intervalos transcurridos en UTC, con zona IANA para mostrarlos. No promete una hora local fija a través del cambio de hora.
- El matching procesa hasta 20 búsquedas por ciclo y 5.000 candidatos prefiltados por búsqueda. Si excede el límite, falla de forma explícita y conserva la tarea; hay que reducir alcance o paginar el cálculo antes de escalar.
- La cola es SQLite de un host, no una cola distribuida. La supervisión del contenedor no sustituye una prueba de carga o un supervisor que recicle automáticamente un proceso vivo bloqueado.
- El proveedor de email puede aceptar un envío sin entregarlo. Se conserva la distinción `accepted`/`uncertain`/`failed`; no hay confirmaciones de entrega ni tratamiento integrado de rebotes.
- Borrar la cuenta exige resolver antes una suscripción activa. Archivos históricos que impidan el borrado requieren revisión operativa; un error no se presenta como borrado completado. Un JWT ya emitido puede seguir vigente hasta expirar, aunque se cierren sus sesiones de refresco.
- Permanecen desactivados los ejecutores heredados de llamadas con IA, WhatsApp, informes externos y valoración automática de reformas. No consumen proveedores por activar el pipeline nuevo.
- IA de lenguaje natural/resúmenes, comparables, valoración de mercado, tiempos de desplazamiento, segunda fuente y producto B2B quedan condicionados a datos y demanda. No se anuncian como entregados.

## Qué prueban las comprobaciones

Las pruebas Node/PGlite ejecutan las migraciones y comprueban transacciones, privilegios, aislamiento, historia, conflictos, cuotas, avisos y fórmulas. Las del worker conectan Chromium real a un servidor propio y fuerzan cortes. Playwright comprueba interfaz de escritorio y móvil simulado con Supabase interceptado. CI añade las imágenes y el conjunto Compose con CDP privado, reinicio y backup.

Estas pruebas no usan credenciales de clientes, no visitan portales para producir anuncios y no envían correos o pagos reales. El resultado del workflow de la revisión concreta, junto con las evidencias del staging y del piloto, determina qué puede darse por aceptado.
