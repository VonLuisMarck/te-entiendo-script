# Operación, recuperación y piloto

Estado: procedimientos implementados/preparados para ensayar en infraestructura propia. CI comprueba el entorno aislado; no acredita una restauración del backend real ni operación comercial sostenida. Mantener cobros y email desactivados hasta su aceptación específica.

## Componentes y responsabilidades

| Componente             | Qué conserva                                                       | Responsable que asignar antes del piloto          |
| ---------------------- | ------------------------------------------------------------------ | ------------------------------------------------- |
| Frontend estático      | Solo configuración pública; estado temporal de sesión              | Despliegue, dominio, TLS y experiencia de cliente |
| Chromium dedicado      | Perfil de automatización privado                                   | Salud, disco/memoria y sesiones de fuente         |
| Worker SQLite          | Jobs, capturas, rechazos, outbox, leases y programaciones          | Cola, pausas de fuente, conciliación y backup     |
| Supabase               | Identidad, observaciones, búsquedas, decisiones, matching y avisos | Migraciones, RLS, Auth, backups y retención       |
| Pipeline optativo      | Ejecuta funciones; no posee una segunda cola                       | Latencia de procesamiento y errores visibles      |
| Email/Stripe optativos | Efectos externos e identificadores de proveedor                    | Consentimiento, soporte y reconciliación          |

El operador debe asignar nombres/contactos reales. No hay un sistema de guardias ni notificaciones de incidentes externas configurado en esta entrega.

## Diagnóstico diario

Abrir `/scraper` como administrador. Revisar salud por fuente, trabajos en espera, fases incompletas, lotes inciertos, rechazos, raw pendiente, cola de matching y resultados de email. El mismo estado se puede consultar mediante el proxy de Edge Functions; no copiar claves del worker al navegador del usuario.

Los logs del worker contienen `job_id`, fuente, fase, estado y contadores; la entrega añade un ID persistido por lote. El backend conserva el hash y conteo de cada lote confirmado. Las funciones devuelven fallos explícitos y mantienen la tarea si no pueden confirmar la publicación. Los cuerpos de respuestas, destinatarios, notas y secretos no deben ir al sistema de logs.

Métricas disponibles:

| Métrica                                      | Interpretación                                                              | Lo que todavía no mide                                             |
| -------------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Jobs por estado, antigüedad de cola          | Trabajo pendiente y fallos del worker                                       | SLA real de fuente/mercado                                         |
| Lotes/filas confirmados o inciertos          | Estado de entrega y conciliación                                            | Que cada anuncio sea correcto                                      |
| Bytes/capturas y memoria del proceso         | Consumo observado del worker                                                | Memoria total de Chromium/coste de proveedor                       |
| Raw pendiente/revisión y cola matching       | Retraso y casos que requieren intervención                                  | Percentiles longitudinales                                         |
| Búsquedas configuradas activas               | Clientes con búsqueda y perfil activo                                       | Usuarios activos semanales                                         |
| Oportunidades valoradas útiles en siete días | Último feedback del par cliente/anuncio en la ventana                       | Conversión, ahorro de tiempo o utilidad de candidatos no evaluados |
| Anuncios observados en siete días            | Inventario reciente conocido                                                | Cobertura del mercado ni fecha de publicación                      |
| Registro de costes                           | Importes aportados con fecha, categoría y base: factura/medición/estimación | Coste automáticamente atribuido a cada cliente                     |

Umbrales iniciales a acordar: investigar una entrega incierta al detectarla; cola sin avance durante dos intervalos; fuente pausada; crecimiento del disco o memoria cerca del límite. Son reglas de operación propuestas, no alertas externas ya conectadas ni resultados medidos.

## Incidentes

| Señal                                            | Acción inmediata                                                          | Recuperación y evidencia                                                                          |
| ------------------------------------------------ | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| 401/403/429 de una fuente                        | Mantener la pausa; revisar autorización/configuración y estado del portal | Reanudar solo tras resolver la causa; registrar el job y el nuevo ensayo                          |
| Contrato cambiado/todos los registros rechazados | Revisar bruto privado y versión de adaptador                              | Añadir muestra saneada, probar contrato y replay; nunca inventar campos                           |
| Solo algunos registros inválidos                 | Revisar `completed_partial` y los punteros de rechazo                     | Corregir contrato si corresponde; el replay completo crea otro job auditado                       |
| Captura interrumpida                             | No publicar bytes parciales                                               | Investigar; iniciar una nueva captura explícita. Una captura completa se recupera offline         |
| Entrega incierta/timeout                         | Conservar payload, lote y clave                                           | Repetir el mismo lote; confirmar en backend. No editar SQLite para marcar éxito                   |
| Error tras cambiar un adaptador                  | Separar análisis nuevo de entrega pendiente                               | Conciliar el payload antiguo antes de crear una nueva versión de trabajo                          |
| Chromium cae                                     | Verificar límites, logs, disco y perfil dedicado                          | Reiniciar el contenedor; leases vencidos impiden confirmar a un propietario antiguo               |
| Healthcheck marca unhealthy con proceso vivo     | Revisar antes de reiniciar manualmente                                    | Docker no reinicia automáticamente por healthcheck; necesita supervisión externa si se requiere   |
| Matching en conflicto                            | Mantener la tarea y comprobar nuevas versiones                            | Siguiente ciclo usa búsqueda/anuncios actuales; los favoritos se conservan                        |
| Matching excede 5.000 candidatos                 | Pausar el ciclo para esa búsqueda y reducir alcance                       | Dimensionar/paginar antes de ampliar. No truncar y publicar resultados incompletos                |
| Correo incierto                                  | No cambiar clave ni destinatario del payload                              | Conciliar en proveedor; reintentos dentro de 23 h/3 intentos. Después revisión manual             |
| Borrado de cuenta falla                          | Mantener visible el error                                                 | Resolver suscripción u objetos de Storage con el titular; no declarar el borrado sin confirmación |

Un contenedor que reinicia no garantiza salud. Revisar también progreso de cola y persistencia. Los límites de Compose contienen memoria/CPU/procesos, pero pueden necesitar ajustes tras medir una carga real.

## Backup SQLite

Desde `workers/browser`, con `WORKER_DB` configurado cuando no sea el predeterminado:

```bash
node src/backup.mjs --to /backups/worker-20260921T120000Z.sqlite
node src/backup.mjs --verify /backups/worker-20260921T120000Z.sqlite
```

`VACUUM INTO` crea una instantánea consistente con WAL activo. El destino debe ser nuevo; se crea privado. El verificador ejecuta `PRAGMA quick_check` y lee jobs/capturas. Copiar la instantánea a almacenamiento cifrado separado del host, con acceso y caducidad definidos. La copia local de CI no es una estrategia de backup de producción.

El perfil de Chromium se respalda por separado solo si procede, con el navegador detenido. Contiene sesiones; no se versiona, adjunta a una incidencia ni comparte con clientes. Restaurar el perfil no evita que una fuente exija volver a iniciar sesión.

## Ensayo de restauración

1. Registrar commit, fecha, checksum, recuentos de jobs/capturas/outbox y quién ejecuta el ensayo. Usar un destino nuevo; conservar intacta la base original y sus ficheros WAL/SHM.
2. Detener worker/pipeline del destino. Copiar la instantánea verificada a su directorio vacío con propietario/permisos correctos. No sustituir una base abierta ni mezclar un backup antiguo con WAL de otra base.
3. Verificar integridad y recuentos offline. Inspeccionar `schedules`, `source_health` y lotes inciertos. Antes de arrancar, mantener las fuentes pausadas y programaciones deshabilitadas en la copia de ensayo, sin credenciales de ingesta/email ni acceso a CDP de producción.
4. Restaurar PostgreSQL/Auth/Storage en **otro proyecto de staging**, según el procedimiento compatible con el proveedor. Aplicar solo migraciones pendientes, comparar relaciones/RLS y comprobar logins de prueba. El repositorio no contiene una exportación del entorno anterior.
5. Conciliar efectos que ocurrieron después del backup: lote aceptado por backend, email aceptado por proveedor, pago o cambio de cuenta. Recuperar el historial de idempotencia junto a los datos. Restaurar solo una de las dos partes puede perder confirmaciones.
6. Ensayar un replay con el servidor sintético o staging preparado. Verificar que los lotes confirmados se omiten, los inciertos conservan clave/payload y las capturas mantienen su fecha original.
7. Registrar duración, diferencias y acciones pendientes. Solo entonces acordar objetivo de recuperación y periodicidad. No se han medido RPO/RTO de producción.

CI ensaya una parte concreta: levanta Compose, conecta CDP privado, crea un trabajo con la fuente pausada, respalda SQLite, reinicia el worker y comprueba que trabajo/pausa persisten. Nunca visita un portal durante ese ensayo.

## Retención

- Worker: limpieza horaria de trabajos terminales/bruto de más de siete días. Conserva pendientes, pausados, interrumpidos y entregas sin resolver; revisar manualmente los casos que no pueden cerrarse.
- Backend: `prune_private_retention()` está reservado a servicio. Elimina raw procesado de más de 30 días, entregas terminales de más de 30 días y enlaces expirados desde hace más de siete días. **Su programación debe configurarse en el entorno propio**; el pipeline no la activa implícitamente.
- Los hashes de lotes confirmados preservan idempotencia sin guardar otra copia del raw. Las observaciones e historial de decisiones se mantienen para explicar lo que vio el usuario. Un anuncio no observado no se borra junto a sus notas ni se declara vendido.
- El borrado del usuario elimina sus datos privados por cascada. Exportación, archivo fiscal que corresponda, conservación de datos de fuente y plazos legales deben revisarse para el servicio concreto; esta implementación no fija una política legal por sí sola.

## Piloto y costes

Usar las puertas y umbrales propuestos en `PRODUCT_ROADMAP.md`, aún sin darlos por alcanzados. Registrar participantes, búsqueda inicial, tarea, candidatos revisados, feedback, tiempo y motivo de abandono con consentimiento y acceso limitado.

El panel permite introducir costes por periodo con su referencia y base. Registrar infraestructura, navegador, base de datos, email, IA si llega a habilitarse y tiempo de soporte. No sumar estimaciones y facturas de la misma partida como si fueran gastos distintos. Calcular después coste por búsqueda útil y por cliente a partir de denominadores medidos. Un campo vacío significa pendiente de medir, no coste cero.

No activar planes heredados por terminar los tests. La decisión de pago depende de utilidad, fuente, costes, soporte y aceptación completa de Stripe en la cuenta propia.
