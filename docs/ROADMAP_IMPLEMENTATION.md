# Implementación del roadmap

Fecha: 21 de septiembre de 2026. Rama: `codex/commercial-foundation-20260920`. PR: [#1](https://github.com/VonLuisMarck/te-entiendo-script/pull/1).

Esta entrega implementa la base técnica y el recorrido de producto que pueden desarrollarse y comprobarse con el repositorio y un Chromium propio. **No cierra el roadmap completo ni acredita que el servicio esté listo para venderse.** No hay HAR real recibido, entorno propio desplegado, migración de cuentas, envío real, pago real ni piloto con usuarios. Las tareas condicionadas del roadmap mantienen sus condiciones de entrada.

Los estados siguientes tienen un significado estricto:

- **Implementado:** existe código y evidencia automatizada para el alcance descrito. No sustituye su aceptación en infraestructura real.
- **Parcial:** una parte está implementada; falta una condición del cierre original.
- **Externo:** requiere datos, acceso, proveedor o trabajo de validación que no está disponible en esta sesión.
- **Condicionado:** el roadmap pospone esta ampliación hasta disponer de evidencia de datos o demanda.

No se calcula un porcentaje mezclando código, validación de fuente y lanzamiento comercial.

## Entregas técnicas

| Entrega                      | Ubicación principal                                     | Resultado                                                                                                       |
| ---------------------------- | ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Dependencias y configuración | `package*.json`, `vite.config.ts`, `Dockerfile`         | Librerías expuestas actualizadas; rechazo de credenciales de servicio en la compilación pública                 |
| Captura/ejecución durable    | `workers/browser/src/{store,runner,adapter,server}.mjs` | Checkpoints, leases, outbox, reintentos, cuarentena, prioridad, intervalos y pausa por fuente                   |
| Modelo y transacciones       | Cinco migraciones `20260921…`                           | Observaciones/evidencia, búsqueda versionada, publicación atómica, decisiones, avisos, presupuestos y operación |
| Procesamiento                | `matching-service`, `scraping-service`, `_shared`       | Ingesta idempotente, normalización, requisitos y preferencias, geografía y recálculo por eventos                |
| Producto cliente             | `src/components` y rutas `/cliente/*`                   | Ficha, historia, seguimiento, comparador/PDF, escenarios, avisos y gestión de cuenta                            |
| Compartición                 | `SharedSelection`, RPC de selección                     | Instantánea de 2–4 candidatos, token aleatorio, caducidad de siete días y revocación                            |
| Operación                    | `compose*.yaml`, `backup.mjs`, `pipeline.mjs`, CI       | Despliegue independiente, procesamiento optativo y ensayo aislado de persistencia                               |
| Preparación comercial        | Documentación vigente y métricas privadas               | Estado verificable, costes registrados con evidencia y puertas de aceptación sin afirmar resultados no medidos  |

## Estado de las 63 tareas originales

| ID     | Estado       | Entrega y condición pendiente                                                                                                                                                   |
| ------ | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FND-01 | Implementado | README, preparación comercial, despliegue y workers reconciliados con el código; documentos del prototipo identificados como históricos                                         |
| FND-02 | Implementado | Dependencias actualizadas, auditoría sin avisos en esta revisión y regresiones de reglas, UI y worker; CI repite el control                                                     |
| FND-03 | Externo      | Docker/Compose/configuración preparados; falta crear y configurar proyecto, secretos y dominio propios                                                                          |
| FND-04 | Externo      | Secuencia y acta de migración/restauración documentadas; sin exportación de datos/Auth/Storage ni restauración real                                                             |
| FND-05 | Parcial      | Ensayo completo de Compose añadido a CI: CDP privado, cola, backup y reinicio. Su resultado debe comprobarse en el workflow del commit; staging propio sigue pendiente          |
| FND-06 | Parcial      | Recuperar contraseña, cierre global, exportación y borrado con reautenticación; SQL/UI verificados, Auth/SMTP/Storage reales pendientes                                         |
| PRD-01 | Externo      | Hipótesis y protocolo disponibles; faltan entrevistas y elección de cohorte con Luis                                                                                            |
| PRD-02 | Parcial      | Diccionario operativo, feedback útil/no útil y costes; faltan instrumentación longitudinal y acuerdo de criterios con la cohorte                                                |
| SRC-01 | Externo      | Importación HAR conserva cuerpos/fechas y permite replay; falta una traza actual y matriz de comportamiento real                                                                |
| SRC-02 | Externo      | Falta concretar fuente y validar alcance de acceso, almacenamiento y uso                                                                                                        |
| SRC-03 | Externo      | Contrato versionado, evidencia, divisa explícita y cuarentena implementados; ejemplos mantienen `adapter: null` hasta disponer de muestras reales                               |
| SRC-04 | Externo      | URLs/páginas explícitas y acciones limitadas; filtros, paginación y completitud del portal todavía sin contrastar                                                               |
| SRC-05 | Parcial      | Salud y pausa ante 401/403/429 o deriva repetida; pruebas sintéticas. Falta operación contra una fuente validada y alertas externas                                             |
| SRC-06 | Condicionado | Segunda fuente supeditada a estabilizar la primera; no se presenta la segunda configuración de ejemplo como integración                                                         |
| WRK-01 | Implementado | Fases, checkpoint de captura completa y recuperación de leases; una interrupción parcial no publica datos                                                                       |
| WRK-02 | Implementado | Lotes inmutables persistidos y RPC transaccional idempotente; corte después de commit probado                                                                                   |
| WRK-03 | Implementado | Estados inciertos, confirmaciones conservadas, reintento acotado y replay sin recaptura; replay finalizado crea otro job auditado                                               |
| WRK-04 | Implementado | Intervalos persistentes, pausas y omisión de intervalos atrasados; prueba de cambio de hora. No cron a hora local fija                                                          |
| WRK-05 | Parcial      | Límites globales/por ámbito y rotación por fuente/ámbito implementados; falta carga representativa y cuota comercial por cliente                                                |
| WRK-06 | Parcial      | Healthchecks, aislamiento de CDP y límites de CPU/RAM/procesos; falta ensayo prolongado de saturación y supervisión externa de procesos bloqueados                              |
| WRK-07 | Condicionado | No se comparte una captura entre búsquedas distintas; requiere equivalencia de filtros, permisos y ahorro medido                                                                |
| DAT-01 | Implementado | Anuncio de fuente, inmueble canónico, observaciones y eventos separados con migración y relaciones verificadas                                                                  |
| DAT-02 | Parcial      | Hash, fecha, fuente, versión, puntero de registro/campo y visor; falta validar que cada mapeo corresponde al hecho real de la fuente                                            |
| DAT-03 | Parcial      | Reglas deterministas, desconocidos, revisión de operaciones especiales y rechazo individual; falta calidad evaluada con casos reales                                            |
| DAT-04 | Implementado | Versiones de cambios materiales y eventos; capturas antiguas no sustituyen datos más recientes, tampoco después de retener/eliminar raw                                         |
| DAT-05 | Parcial      | Asociación/separación canónica manual, auditable y reversible; falta detector de candidatos y evaluación de pares difíciles                                                     |
| DAT-06 | Parcial      | Estados distinguen observación, verificación, antigüedad y retirada confirmada; historial/decisiones se conservan. Semántica real de retirada/reaparición pendiente de contrato |
| DAT-07 | Externo      | Faltan muestras reservadas de una fuente real y anotación independiente; las fixtures no sustituyen ese conjunto                                                                |
| MAT-01 | Parcial      | Formulario y reglas distinguen requisitos de preferencias; falta comprobar comprensión con usuarios                                                                             |
| MAT-02 | Implementado | Guardado perfil/criterios atómico con versión esperada y rollback completo; conflicto entre pestañas probado                                                                    |
| MAT-03 | Parcial      | Ranking determinista explicable, completitud y frescura separadas; falta demostrar mejora de relevancia en conjunto reservado                                                   |
| MAT-04 | Implementado | Snapshot de búsqueda, generación de cola y versión de anuncio comprobados al publicar en una transacción; favoritos preservados                                                 |
| MAT-05 | Parcial      | Cola por eventos, prefiltro presupuestario, keyset y límites explícitos; falta dimensionamiento con carga representativa y cálculo paginado superior al límite                  |
| GEO-01 | Parcial      | Radio en UI, mapa, precisión y matching radio/polígono probados; faltan geocodificación validada y dibujo de polígonos                                                          |
| GEO-02 | Condicionado | Sin proveedor de rutas ni presupuesto/evidencia para tiempos de desplazamiento                                                                                                  |
| UX-01  | Parcial      | Formulario persistente, borrador, carga/error/vacío y conflicto; tareas sin asistencia requieren sesiones con usuarios                                                          |
| UX-02  | Parcial      | Ficha con historia/evidencia/desconocidos y observación antigua visible; falta contraste real de discrepancias entre fuentes                                                    |
| UX-03  | Implementado | Bandeja de seguimiento, etapas, notas, visita y descarte persistidos con RLS por propietario                                                                                    |
| UX-04  | Implementado | Comparador 2–4 con unidades homogéneas y desconocidos visibles, PDF y prueba de descarga                                                                                        |
| UX-05  | Parcial      | Tests en Chromium de escritorio y viewport móvil, formularios etiquetados; móvil físico, Safari y auditoría con tecnologías de asistencia pendientes                            |
| UX-06  | Implementado | Selección segura por RPC, token temporal/revocable y proyección sin notas ni escenarios; pruebas de acceso anónimo, propiedad y revocación                                      |
| NTF-01 | Implementado | Avisos únicos por evento/búsqueda relevante y publicación repetible sin duplicar notificaciones                                                                                 |
| NTF-02 | Implementado | Preferencias, opt-in de email, pausa, frecuencia, zona y descanso; opt-out comprobado antes del envío                                                                           |
| NTF-03 | Parcial      | Bandeja y outbox email persistida, intento acotado y clave estable; falta entrega real y webhook de rebotes/confirmaciones                                                      |
| NTF-04 | Condicionado | Canales adicionales esperan demanda. Los antiguos ejecutores WhatsApp quedan pausados                                                                                           |
| INV-01 | Parcial      | Fórmulas de compra/financiación/cash flow contrastadas con cálculos independientes en tests; falta aceptación de convenciones con usuarios/especialista                         |
| INV-02 | Externo      | Sin fuente ni conjunto de comparables trazables; no se estima alquiler ni tasación                                                                                              |
| INV-03 | Implementado | Supuestos explícitos editables, guardado versionado, exportación y sensibilidad de una variable                                                                                 |
| INV-04 | Parcial      | PDF factual del comparador y exportación de escenarios; dossier inversor con comparables/conclusiones soportadas pendiente de INV-02                                            |
| AI-01  | Condicionado | No hay conversión por modelo de lenguaje natural a criterios; requiere evaluación, presupuesto y revisión del usuario                                                           |
| AI-02  | Condicionado | No hay resúmenes generativos; falta corpus/evaluación de fidelidad e inyección                                                                                                  |
| AI-03  | Parcial      | Reserva y liquidación atómicas, límites y consumo incierto retenido, pruebas de permisos; falta integrarlo en cada futura operación de IA. Ejecutores heredados desactivados    |
| OPS-01 | Parcial      | Métricas de cola/datos/avisos y logs por trabajo/lote; faltan históricos, alertas y percentiles de operación real                                                               |
| OPS-02 | Parcial      | Runbooks concretos y fallos sintéticos probados; falta conectar alertas y ensayar guardia en infraestructura propia                                                             |
| OPS-03 | Parcial      | Backup SQLite consistente y verificación/ensayo CI; falta programación externa, restauración PostgreSQL/Auth/Storage y reconciliación real                                      |
| SEC-01 | Parcial      | Autorización/RLS/privilegios/captura/compartición probados negativamente; revisión de amenazas y gateway real pendiente                                                         |
| SEC-02 | Parcial      | Bruto privado, metadatos minimizados, límites y retención; falta revisión de secretos históricos y política aprobada para fuentes reales                                        |
| SEC-03 | Parcial      | Exportación, cascadas de borrado y enlaces probados; faltan ciclo Auth/Storage real y política del prestador                                                                    |
| BIZ-01 | Parcial      | Registro de costes con periodo/categoría/base y feedback; falta atribución real por búsqueda/cliente y margen observado                                                         |
| BIZ-02 | Externo      | Sin piloto ni aceptación de una oferta concreta; precios heredados no validados                                                                                                 |
| BIZ-03 | Parcial      | Preparación Stripe, firmas/sincronización y presupuestos atómicos; faltan precios propios, cuotas completas y aceptación test mode. Cobros desactivados                         |
| BIZ-04 | Externo      | Sin lanzamiento, usuarios invitados ni responsables finales asignados; gates comerciales abiertos                                                                               |
| PRO-01 | Condicionado | Equipos/expedientes B2B aplazados hasta evidencia de demanda y aislamiento organizativo diseñado                                                                                |

## Verificación realizada y reproducible

- 39 comprobaciones Node/PostgreSQL/PGlite: migraciones, privilegios/RLS, transacciones, idempotencia, historia, geografía, fórmulas, cuotas, avisos y cuenta. La prueba de observaciones antiguas incluye el caso posterior a eliminar raw.
- 17 comprobaciones del worker: Chromium real contra servidor propio, captura sin DOM, bytes/texto/binarios, importación HAR, entrega incierta, leases, replay, cuotas, pausa y programación.
- 16 recorridos Playwright: ocho flujos en escritorio y viewport móvil. Supabase interceptado; incluyen notas/escenarios, comparador/PDF, conflicto de búsqueda, recuperación de acceso y borrador tras recargar.
- TypeScript, compilación de producción con configuración pública de prueba y comprobación Deno de 27 funciones.
- Auditoría npm sin avisos en esta revisión. Debe volver a ejecutarse con el lockfile publicado.
- CI incluye Compose completo, CDP sin puerto público, cola/pausa persistentes tras reinicio y backup verificable. El workflow del commit publicado es la evidencia definitiva de esa revisión.

No se mide ni afirma calidad ≥98 %, cobertura ≥95 %, rentabilidad, latencia comercial o disponibilidad de portales. Los umbrales del roadmap siguen siendo objetivos de evaluación.

## Orden siguiente de aceptación

1. HAR real con cuerpos/fechas y URL de búsqueda, revisado para retirar datos de sesión y datos personales innecesarios. Si el formato requiere SSE/WebSocket, obtener además la traza específica. No enviar contraseñas o tokens en el chat.
2. Cuenta/proyecto propios y datos de migración disponibles mediante acceso apropiado; desplegar y ejecutar el acta de `DEPLOYMENT.md`.
3. Primer adaptador y conjunto reservado; medir filtros, páginas, campos y errores. Solo entonces habilitar publicación programada de esa fuente.
4. Cadena completa con usuarios de prueba, backup/restauración y email si se activa. Mantener cerrado cualquier módulo que no supere aceptación.
5. Cohorte y piloto; medir utilidad y costes. Con esos resultados, decidir oferta/pagos y qué ampliaciones condicionadas tienen sentido.

No hace falta otra reescritura para iniciar estos pasos. Sí hace falta evidencia externa para cerrarlos.
