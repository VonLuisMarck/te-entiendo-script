# 🔍 Reverse Engineering del API de Fotocasa (2025-10)

## 📋 Contexto

El objetivo del análisis fue identificar las llamadas de red que realiza Fotocasa.es para realizar búsquedas de propiedades. Este documento describe el método más directo y moderno que utiliza la API v1.

El análisis se realizó mediante captura de tráfico HTTP/JSON al interactuar con la página web.

---

## 🕸️ Flujo General de la API

Fotocasa utiliza una API REST moderna en el dominio:

```
https://web.gw.fotocasa.es
```

### Endpoint Principal

| Endpoint                 | Método | Descripción                                         |
| ------------------------ | ------ | -------------------------------------------------- |
| `/v1/search/ads`         | **POST** | Busca propiedades con paginación (JSON payload)  |

### 🔐 Autenticación

**No requiere tokens CSRF ni cookies especiales.** La autenticación se maneja mediante headers estándar de navegador.

---

## 🏘️ Búsqueda de Propiedades

### Request

```http
POST https://web.gw.fotocasa.es/v1/search/ads
Content-Type: application/json
```

### Headers Requeridos

```http
User-Agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36
Accept: application/json, text/plain, */*
Content-Type: application/json
Origin: https://www.fotocasa.es
Referer: https://www.fotocasa.es/
```

### Payload JSON

```json
{
  "combinedLocations": ["724,16,30,374,745,30030,0,0,0"],
  "transactionType": 1,
  "page": 1,
  "size": 30,
  "sort": {
    "order": "desc",
    "type": "publicationDate"
  },
  "filters": {}
}
```

### Response

```json
{
  "totalCount": 1720,
  "ads": [
    {
      "id": "1_177158215",
      "propertyId": "177158215",
      "transactionType": "1",
      "propertyType": "2",
      "surface": 165,
      "rooms": 4,
      "baths": 2,
      "street": "Calle Constanza de Aviles, Guadalupe, Murcia",
      "zone": "Murcia, Guadalupe",
      "description": "...",
      "location": {
        "countryId": "724",
        "level5Name": " Murcia Capital",
        "latitude": "37.996615",
        "longitude": "-1.180776"
      },
      "transaction": {
        "type": "SALE",
        "price": 405000
      },
      "multimedia": [
        {
          "url": "https://static.fotocasa.es/images/ads/...",
          "type": "2",
          "position": 1,
          "classification": "terrace"
        }
      ],
      "features": [
        { "id": "1" },
        { "id": "2" },
        { "id": "17" }
      ]
    }
  ],
  "page": {
    "current": 1,
    "total": 58
  }
}
```

---

## 🧾 Parámetros del Payload

| Parámetro | Tipo | Descripción | Ejemplo |
| --- | --- | --- | --- |
| `combinedLocations` | `array[string]` | Array de IDs de ubicación | `["804,0,0,0,0,0,0,0,0"]` |
| `transactionType` | `number` | 1=venta, 2=alquiler | `1` |
| `page` | `number` | Número de página (base 1) | `1` |
| `size` | `number` | Resultados por página (max ~30) | `30` |
| `sort.type` | `string` | Campo de ordenación | `"publicationDate"` |
| `sort.order` | `string` | Orden: "asc" o "desc" | `"desc"` |
| `filters` | `object` | Filtros adicionales (opcional) | `{}` |

---

## 📍 IDs de Ubicación Conocidos

Para obtener los IDs correctos de una ubicación, puedes usar el endpoint:

```http
GET https://web.gw.fotocasa.es/v2/propertysearch/urllocationsegments?location=murcia-capital&zone=todas-las-zonas&culture=es-ES
```

**Response:**
```json
{
  "ids": "724,16,30,374,745,30030,0,0,0",
  "combinedLocationIds": "724,16,30,374,745,30030,0,0,0"
}
```

### Ubicaciones Comunes

| Lugar | combinedLocations |
| --- | --- |
| España (todo el país) | `724,0,0,0,0,0,0,0,0` |
| Murcia capital | `724,16,30,374,745,30030,0,0,0` |
| Madrid capital | `375,0,0,0,0,0,0,0,0` |
| Barcelona capital | `188,0,0,0,0,0,0,0,0` |

---

## 📊 Estructura de Datos de Propiedades

### Campos Principales

- **`id`**: ID único compuesto (ej: "1_177158215")
- **`propertyId`**: ID numérico de la propiedad
- **`transactionType`**: "1" (venta) o "2" (alquiler)
- **`propertyType`**: Tipo de propiedad (códigos numéricos)
  - "1": Casa/Chalet
  - "2": Piso
  - "3": Ático
  - etc.
- **`surface`**: Superficie en m²
- **`rooms`**: Número de habitaciones
- **`baths`**: Número de baños
- **`street`**: Dirección completa
- **`zone`**: Zona/barrio
- **`description`**: Descripción detallada
- **`location`**: Objeto con coordenadas y jerarquía administrativa
  - `latitude`: Latitud (string)
  - `longitude`: Longitud (string)
  - `level5Name`: Municipio
  - `level8Name`: Barrio
- **`transaction`**: Objeto con información de la transacción
  - `type`: "SALE" o "RENT"
  - `price`: Precio en euros
- **`multimedia`**: Array de imágenes
  - `url`: URL de la imagen
  - `type`: "2" para imágenes
  - `classification`: Tipo de habitación ("terrace", "kitchen", "living room", etc.)
- **`features`**: Array de características (IDs)
- **`agency`**: Información de la agencia inmobiliaria

### Feature IDs Comunes

- **`1`**: Aire acondicionado
- **`2`**: Parking
- **`5`**: Jardín
- **`7`**: Terraza
- **`10`**: Piscina
- **`17`**: Ascensor

---

## 🔄 Paginación

La paginación se maneja incrementando el valor de `page` en el payload:

```json
{
  "page": 2,
  "size": 30
}
```

El response incluye información de paginación:

```json
{
  "totalCount": 1720,
  "page": {
    "current": 2,
    "total": 58
  }
}
```

### Algoritmo de Paginación

1. Hacer request con `page: 1`
2. Leer `totalCount` del response
3. Calcular `total_pages = ceil(totalCount / size)`
4. Iterar desde `page: 2` hasta `page: total_pages`
5. Detectar fin si `ads` está vacío o tiene menos elementos que `size`
6. Añadir delay de ~1 segundo entre requests

---

## ⚠️ Errores y Soluciones

| Error | Causa | Solución |
| --- | --- | --- |
| `400 Bad Request` | Payload JSON inválido o malformado | Verificar estructura del JSON y tipos de datos |
| `405 Method Not Allowed` | Usar GET en vez de POST | Cambiar a método POST |
| `429 Too Many Requests` | Rate limit excedido | Añadir delays de 1-2s entre requests |
| `500 Server Error` | Error interno del servidor | Reintentar con backoff exponencial |
| `Empty results` | Página fuera de rango | Verificar `page.total` antes de continuar |

---

## 💡 Best Practices

1. **Rate Limiting**: Añadir delays de 1-2 segundos entre requests para evitar bloqueos
2. **Headers Realistas**: Incluir siempre User-Agent y Referer que simulen navegador real
3. **Error Handling**: Implementar reintentos con backoff exponencial para errores 429, 500, 502, 503
4. **Timeout**: Configurar timeouts de 20-30 segundos para requests HTTP
5. **Validación**: Verificar que `ads` no esté vacío antes de procesar
6. **Persistencia de Sesión**: Usar `requests.Session()` para mantener cookies entre requests
7. **Logging**: Registrar cada página procesada para debugging

---

## 📝 Implementación en Python

El scraper implementado en `fotocasa_scraper.py` utiliza directamente `requests` sin Scrapy:

```python
import requests
import json

session = requests.Session()
session.headers.update(HEADERS)

# Visitar homepage primero
session.get("https://www.fotocasa.es/")

# Búsqueda
payload = {
    "combinedLocations": ["724,16,30,374,745,30030,0,0,0"],
    "transactionType": 1,
    "page": 1,
    "size": 30,
    "sort": {"order": "desc", "type": "publicationDate"},
    "filters": {}
}

response = session.post(
    "https://web.gw.fotocasa.es/v1/search/ads",
    json=payload
)

data = response.json()
properties = data.get("ads", [])
```

### Ventajas del Método POST

1. **No requiere tokens CSRF** - Más simple y robusto
2. **Payload estructurado** - Más fácil de modificar filtros
3. **Response más completo** - Incluye más metadatos
4. **Menos propenso a cambios** - API moderna y estable

---

## 🔗 Referencias

- **Dominio API**: `https://web.gw.fotocasa.es`
- **Sitio web**: `https://www.fotocasa.es`
- **Análisis realizado**: Octubre 2025
- **Método**: Captura de tráfico HTTP + análisis de JSON

---

## 🎯 Conclusiones

1. **Simplicidad**: El endpoint v1 es más directo que v2 (no requiere CSRF)
2. **Método POST**: Permite filtros complejos y paginación robusta
3. **Rate Limiting**: Respetar delays es crucial para evitar bloqueos
4. **Headers**: Simular navegador real es importante
5. **Paginación**: Usar `totalCount` para calcular páginas totales
