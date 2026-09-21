# Validación de navegador — 21 de septiembre de 2026

## Hechos comprobados

- El navegador integrado abrió búsquedas reales de Pisos.com y la página de búsqueda de Fotocasa. No se extrajeron respuestas de red de ese navegador: su interfaz de control no expone CDP ni los cuerpos HTTP.
- En [Pisos.com, Murcia Capital](https://www.pisos.com/venta/pisos-murcia_capital/) se abrió [un anuncio clasificado como piso](https://www.pisos.com/comprar/piso-sur_infante_juan_manuel30002-61743566533_529699/) con precio principal de 100.000 €, mientras la descripción lo identifica como local comercial y conserva un precio anterior. Esto motiva el control conservador de uso residencial y la separación de hechos estructurados y descripción. No se copiaron teléfonos ni descripciones completas al repositorio.
- La selección del filtro de precio en aquella visita no quedó acreditada; no se considera una prueba pasada.
- Se arrancó un Chromium separado y el worker se conectó realmente a su puerto de depuración. La navegación desde ese entorno a la URL de búsqueda de Pisos.com falló con `ERR_EMPTY_RESPONSE`. No se capturó allí una API real ni se atribuye el fallo a una causa concreta no verificada.

## Pruebas reproducibles

`npm test --prefix workers/browser` arranca un Chromium real con un perfil temporal y un servidor HTTP sintético. Conecta por CDP y verifica datos exclusivos de la API, persistencia del cuerpo, deduplicación, entrega, recuperación tras fallo, reprocesamiento sin navegador, respuestas vacías, cambios de esquema, HTML sin respuesta seleccionada, denegación 429, texto y binarios, importación HAR, aislamiento de URL y reservas de navegador.

Son pruebas del motor, no evidencia de compatibilidad actual con la API de Fotocasa o Pisos.com. Las pruebas de interfaz usan fixtures de Supabase. Las pruebas PostgreSQL ejecutan las migraciones reales con PGlite; no hay una cuenta Supabase de staging conectada en esta entrega.

## Pendiente para cada portal

Recibir y revisar un HAR saneado con los cuerpos de las respuestas, identificar su formato y endpoints reales, implementar/validar el adaptador correspondiente y probar búsqueda → captura → ingesta → recomendaciones en staging. El usuario propuso aportar esa traza; al redactar este documento todavía no se había recibido.
