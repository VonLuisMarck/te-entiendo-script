# InmoFinder - Guía del Usuario
## Manual Ejecutivo para Perfiles No Técnicos

---

## Índice

1. [¿Qué es InmoFinder?](#qué-es-inmofinder)
2. [Acceso a la Plataforma](#acceso-a-la-plataforma)
3. [Panel Principal (Dashboard)](#panel-principal)
4. [Módulos de la Aplicación](#módulos-de-la-aplicación)
   - [Propiedades](#propiedades)
   - [Clientes](#clientes)
   - [Matchings](#matchings)
   - [Scraper](#scraper)
   - [Métricas de Mercado](#métricas-de-mercado)
5. [Flujo de Trabajo Recomendado](#flujo-de-trabajo-recomendado)
6. [Casos de Uso](#casos-de-uso)

---

## ¿Qué es InmoFinder?

InmoFinder es una plataforma inteligente diseñada para automatizar y optimizar la búsqueda de propiedades inmobiliarias. La aplicación combina tres funcionalidades clave:

1. **Captura automática de propiedades** de portales inmobiliarios
2. **Gestión de clientes** y sus preferencias de búsqueda
3. **Sistema de matching inteligente** que encuentra las mejores coincidencias

### Beneficios Principales

- ⏱️ **Ahorro de tiempo**: Automatiza la búsqueda manual en múltiples portales
- 🎯 **Precisión**: Encuentra propiedades que realmente encajan con cada cliente
- 💰 **Detección de oportunidades**: Identifica chollos según el precio de mercado
- 📊 **Análisis de mercado**: Conoce los precios medios por barrio y ciudad

---

## Acceso a la Plataforma

### Registro y Login

1. **Primera vez**: Accede a la aplicación y haz clic en "Comenzar Ahora"
2. **Registro**: Introduce tu email y crea una contraseña
3. **Inicio de sesión**: Una vez registrado, usa tus credenciales para acceder

> 💡 **Nota**: La primera vez que accedas, verás el Dashboard vacío. No te preocupes, una vez que agregues clientes y ejecutes el scraper, verás toda la información.

---

## Panel Principal (Dashboard)

El Dashboard es tu centro de control. Aquí verás:

### Resumen de Datos

- **Propiedades**: Número total de inmuebles en tu base de datos
- **Clientes**: Cantidad de clientes activos
- **Matchings**: Total de coincidencias encontradas

### Acceso Rápido a Módulos

Cada tarjeta te lleva a una sección específica:
- Propiedades
- Clientes
- Matchings
- Scraper
- Métricas de Mercado

---

## Módulos de la Aplicación

### Propiedades

**¿Qué es?** Base de datos con todas las propiedades capturadas de portales inmobiliarios.

**¿Qué puedes hacer?**
- Ver listado completo de propiedades
- Filtrar por ciudad, precio, metros, tipo de propiedad
- Ver detalles de cada inmueble (precio, ubicación, características)
- Acceder al enlace original del portal

**Información que verás:**
- Título y descripción
- Precio y precio por m²
- Metros cuadrados
- Número de habitaciones y baños
- Ciudad y barrio
- Enlace a la fuente original

---

### Clientes

**¿Qué es?** Gestión de tu cartera de clientes y sus preferencias de búsqueda.

**¿Qué puedes hacer?**
- Añadir nuevos clientes con sus datos de contacto
- Definir criterios de búsqueda por cliente:
  - Rango de precio (mínimo y máximo)
  - Metros mínimos requeridos
  - Número de habitaciones
  - Ciudades de interés
  - Tipo de propiedad (piso, chalet, etc.)
- Indicar el **perfil del cliente**:
  - **Reformar**: Busca chollos extremos para reformar y revender
  - **Alquilar**: Busca oportunidades para inversión en alquiler
  - **Vivir**: Busca vivienda habitual, no necesita estar muy por debajo del mercado
- Editar y actualizar información de clientes

**Perfil del Cliente - Importante**

El perfil determina cómo el sistema evalúa las oportunidades:

- **Reformar**: +20 puntos si el precio está 20% por debajo del mercado
- **Alquilar**: +10 puntos si está 10% por debajo del mercado
- **Vivir**: +5 puntos si está cerca del precio medio (no necesita grandes descuentos)

---

### Matchings

**¿Qué es?** Resultados del cruce entre clientes y propiedades.

**¿Qué puedes hacer?**
- Ver todas las coincidencias encontradas
- Filtrar por cliente
- Ordenar por puntuación (score)
- Ver el análisis de mercado de cada propiedad
- Marcar matchings como contactados o interesados

**Cómo interpretar la puntuación:**

Cada matching tiene un **score** (0-100) que indica qué tan bien encaja la propiedad con el cliente:

- **90-100**: Coincidencia excelente
- **70-89**: Muy buena opción
- **50-69**: Opción válida
- **0-49**: Coincidencia débil

**Análisis de Mercado:**

Cada matching incluye información sobre si la propiedad está:
- Por encima del precio medio del barrio
- Dentro del precio medio
- Por debajo del precio medio (**oportunidad**)
- Muy por debajo (**chollo**)

---

### Scraper

**¿Qué es?** Herramienta para capturar propiedades automáticamente de portales inmobiliarios.

**¿Qué puedes hacer?**
- Configurar URLs de búsqueda de portales (ej: Fotocasa, Idealista)
- Ejecutar el scraping de forma manual
- Ver el progreso en tiempo real
- Consultar el historial de ejecuciones

**Cómo funciona:**

1. **Configura las URLs**: Copia las URLs de búsqueda de los portales inmobiliarios
2. **Ejecuta el scraper**: Haz clic en "Ejecutar Scraper"
3. **Espera a que termine**: El proceso puede tardar varios minutos dependiendo del número de propiedades
4. **Revisa los resultados**: Una vez completado, las propiedades aparecerán en el módulo "Propiedades"

**Recomendación**: Ejecuta el scraper periódicamente (diario, semanal) para mantener tu base de datos actualizada.

---

### Métricas de Mercado

**¿Qué es?** Análisis estadístico de precios por ciudad y barrio.

**¿Qué puedes hacer?**
- Ver precio medio por m² de cada barrio
- Comparar precios entre diferentes zonas
- Identificar barrios más caros y más económicos
- Detectar tendencias de mercado
- Calcular métricas actualizadas

**Información que verás:**

Por cada ciudad y barrio:
- **Precio medio**: Promedio de todas las propiedades
- **Precio/m² medio**: Precio promedio por metro cuadrado
- **Rango de precios**: Mínimo y máximo por m²
- **Distribución**: Precios por tipo de propiedad (piso vs chalet)
- **Volumen**: Número total de propiedades analizadas

**Cómo actualizar las métricas:**

1. Ve al módulo "Métricas de Mercado"
2. Haz clic en "Calcular Métricas"
3. Espera a que se procesen los datos
4. La tabla se actualizará automáticamente

> 💡 **Tip**: Calcula las métricas después de cada scraping para tener datos actualizados.

---

## Flujo de Trabajo Recomendado

### 1. Configuración Inicial

1. **Registra tu cuenta** y accede al Dashboard
2. **Añade tus clientes** con sus criterios de búsqueda y perfil
3. **Configura el scraper** con las URLs de los portales inmobiliarios

### 2. Captura de Propiedades

1. **Ejecuta el scraper** para capturar propiedades
2. **Calcula las métricas** de mercado en el módulo "Métricas"
3. **Revisa las propiedades** capturadas en el módulo "Propiedades"

### 3. Generación de Matchings

1. Ve al módulo **"Matchings"**
2. Haz clic en **"Calcular Matchings"**
3. El sistema cruzará automáticamente clientes con propiedades

### 4. Gestión y Seguimiento

1. **Revisa los matchings** ordenados por puntuación
2. **Filtra por cliente** para ver sus mejores opciones
3. **Contacta con los clientes** sobre las propiedades relevantes
4. **Marca el estado** de cada matching (contactado, interesado, etc.)

### 5. Mantenimiento

- Ejecuta el scraper periódicamente (recomendado: diariamente)
- Actualiza las métricas de mercado después de cada scraping
- Recalcula los matchings cuando haya nuevas propiedades

---

## Casos de Uso

### Caso 1: Inversor que Busca Reformar

**Perfil**: Inversor inmobiliario que compra, reforma y revende.

**Configuración del Cliente:**
- Perfil: **Reformar**
- Precio máximo: 150.000€
- Metros mínimos: 60m²
- Ciudades: Madrid, Barcelona
- Habitaciones: 2+

**Qué buscará el sistema:**
- Propiedades **20% o más por debajo** del precio medio del barrio
- Alta puntuación para chollos extremos
- Oportunidades de revalorización

### Caso 2: Particular Buscando Vivienda Habitual

**Perfil**: Familia que busca vivienda para vivir.

**Configuración del Cliente:**
- Perfil: **Vivir**
- Precio máximo: 250.000€
- Metros mínimos: 80m²
- Ciudades: Valencia
- Habitaciones: 3+

**Qué buscará el sistema:**
- Propiedades cerca del precio medio del barrio
- No necesita estar muy por debajo del mercado
- Prioriza que cumpla con los criterios de espacio y ubicación

### Caso 3: Inversor para Alquiler

**Perfil**: Inversor que busca propiedades para alquilar.

**Configuración del Cliente:**
- Perfil: **Alquilar**
- Precio máximo: 200.000€
- Metros mínimos: 70m²
- Ciudades: Sevilla, Málaga
- Habitaciones: 2+

**Qué buscará el sistema:**
- Propiedades **10% por debajo** del precio medio
- Oportunidades de rentabilidad
- Balance entre precio y potencial de renta

---

## Glosario de Términos

- **Scraping**: Proceso automatizado de captura de datos de portales inmobiliarios
- **Matching**: Coincidencia entre un cliente y una propiedad
- **Score**: Puntuación de 0 a 100 que indica qué tan bien encaja una propiedad con un cliente
- **Precio/m²**: Precio por metro cuadrado, métrica clave para comparar propiedades
- **RLS (Row Level Security)**: Sistema de seguridad que protege los datos de cada usuario
- **Perfil del cliente**: Tipo de inversión o uso que el cliente dará a la propiedad

---

## Soporte y Contacto

Para cualquier duda o sugerencia sobre el uso de InmoFinder, contacta con el equipo de soporte técnico.

---

**InmoFinder** - Automatizando la búsqueda inmobiliaria inteligente

*Versión 1.0 - Octubre 2024*
