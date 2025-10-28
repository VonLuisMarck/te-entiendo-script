# 🔍 Reverse Engineering del API de Fotocasa (2025-10)

## 📋 Contexto

El objetivo del análisis fue identificar las llamadas de red que realiza Fotocasa.es cuando el usuario realiza una búsqueda en la web (por ejemplo, "Murcia capital") y navega al detalle de un inmueble.

El análisis se realizó mediante captura HAR (HTTP Archive) generada desde Chrome/Firefox al interactuar con la página web.

---

## 🕸️ Flujo General de la Aplicación

Fotocasa utiliza un API REST en el dominio:

```
https://web.gw.fotocasa.es
```

| Paso | Endpoint                    | Método  | Descripción                                               |
| ---- | --------------------------- | ------- | --------------------------------------------------------- |
| 1    | `/v2/propertysearch/searchurl` | **GET** | Inicializa la sesión y genera el token + cookie CSRF.     |
| 2    | `/v2/propertysearch/search`    | **GET** | Recupera el listado de propiedades (JSON con paginación). |
| 3    | `/v2/realestate/<id>`          | **GET** | (Opcional) Obtiene el detalle de un inmueble específico.  |

---

## 🔐 Paso 1 — Obtener Token CSRF

### Request

```http
GET https://web.gw.fotocasa.es/v2/propertysearch/searchurl?combinedLocationIds=804%2C0%2C0%2C0%2C0%2C0%2C0%2C0%2C0&culture=es-ES
```

### Headers Requeridos

```
User-Agent: Mozilla/5.0 (X11; Ubuntu; Linux x86_64)
Accept: application/json, text/plain, */*
Accept-Language: es-ES,es;q=0.9
Accept-Encoding: identity
Referer: https://www.fotocasa.es/
Origin: https://www.fotocasa.es
Connection: keep-alive
```

### Response

```http
HTTP/1.1 200 OK
X-Adevinta-Csrf-Token: 43760607ef3a4f...
Set-Cookie: _csrf=ekymPNzpKC...; Path=/; Domain=fotocasa.es; Secure; HttpOnly; SameSite=None
```

**Importante:** Estos valores (token y cookie) son necesarios para todas las peticiones posteriores.

---

## 🏘️ Paso 2 — Obtener Listado de Propiedades

### Request

```http
GET https://web.gw.fotocasa.es/v2/propertysearch/search?combinedLocationIds=804%2C0%2C0%2C0%2C0%2C0%2C0%2C0%2C0&culture=es-ES&pageNumber=1
```

### Headers Requeridos

```
User-Agent: Mozilla/5.0 (X11; Ubuntu; Linux x86_64)
Accept: application/json, text/plain, */*
Accept-Language: es-ES,es;q=0.9
Accept-Encoding: identity
Referer: https://www.fotocasa.es/
Origin: https://www.fotocasa.es
Connection: keep-alive
X-Adevinta-Csrf-Token: <token del paso 1>
Cookie: _csrf=<cookie del paso 1>
```

### Response

```json
{
  "totalCount": 1720,
  "realEstates": [
    {
      "id": 12345678,
      "title": "Piso en venta en...",
      "price": { "amount": 125000 },
      "province": "Murcia",
      "municipality": "Murcia",
      "district": "Centro",
      "propertyType": "flat",
      "detailUrl": "/es/comprar/vivienda/murcia-capital..."
    }
  ],
  "pagination": {
    "currentPage": 1,
    "totalPages": 34
  }
}
```

### Paginación

- El parámetro `pageNumber` controla las páginas.
- Si la lista `realEstates` viene vacía, significa fin de resultados.

---

## 🏠 Paso 3 — (Opcional) Detalle de Inmueble

### Request

```http
GET https://web.gw.fotocasa.es/v2/realestate/<id>
```

### Headers

Los mismos que en el Paso 2 (incluyendo token CSRF y cookie).

---

## 🧰 Parámetros Más Comunes

| Parámetro             | Descripción                          | Ejemplo                   |
| --------------------- | ------------------------------------ | ------------------------- |
| `combinedLocationIds` | Ubicación (país, provincia, ciudad)  | `804,0,0,0,0,0,0,0,0`     |
| `pageNumber`          | Número de página                     | `1`                       |
| `culture`             | Idioma de resultados                 | `es-ES`                   |
| `sortType`            | Campo de ordenación (opcional)       | `"price"`                 |
| `sortOrder`           | Asc/desc                             | `"desc"`                  |

---

## 🧾 Headers Mínimos para el Scraper

| Header                    | Valor                            |
| ------------------------- | -------------------------------- |
| `User-Agent`              | Navegador moderno                |
| `X-Adevinta-Csrf-Token`   | Token obtenido del paso 1        |
| `Cookie`                  | `_csrf=<cookie>`                 |
| `Referer`                 | `https://www.fotocasa.es/`       |
| `Origin`                  | `https://www.fotocasa.es`        |
| `Accept-Encoding`         | `identity`                       |

---

## 📍 IDs de Localización Conocidos

| Lugar            | combinedLocationIds        |
| ---------------- | -------------------------- |
| España           | `724,0,0,0,0,0,0,0,0`      |
| Murcia capital   | `804,0,0,0,0,0,0,0,0`      |
| Madrid capital   | `375,0,0,0,0,0,0,0,0`      |
| Barcelona capital| `188,0,0,0,0,0,0,0,0`      |

---

## ⚠️ Errores y Observaciones

| Error                    | Causa                           | Solución                          |
| ------------------------ | ------------------------------- | --------------------------------- |
| `400 Bad Request`        | Falta token o cookie CSRF       | Hacer primero `/searchurl`        |
| `405 Method Not Allowed` | Uso de POST en `/search`        | Cambiar a GET                     |
| `403 Forbidden`          | Token expirado                  | Repetir flujo completo            |
| `429 Too Many Requests`  | Límite de rate del API          | Usar `DOWNLOAD_DELAY` y `AUTOTHROTTLE` |

---

## 🎯 Conclusiones

1. **Autenticación CSRF:** Es obligatoria para todas las búsquedas.
2. **Método HTTP:** Siempre usar GET (no POST).
3. **Rate Limiting:** Implementar delays entre peticiones (1-2 segundos recomendado).
4. **Headers realistas:** Simular un navegador moderno para evitar bloqueos.
5. **Paginación:** Controlar con `pageNumber` y detectar fin de resultados cuando `realEstates` esté vacío.

---

## 📝 Implementación en Scrapy

El spider implementado en `scrapy_project/spiders/fotocasa.py` sigue exactamente este flujo:

1. **`start_requests()`**: Solicita el token CSRF desde `/searchurl`
2. **`parse_csrf()`**: Extrae token y cookie, lanza peticiones de búsqueda
3. **`parse_list()`**: Procesa los resultados JSON de cada página

### Configuración de Seguridad

```python
custom_settings = {
    "DOWNLOAD_DELAY": 1.5,
    "CONCURRENT_REQUESTS": 2,
    "AUTOTHROTTLE_ENABLED": True,
    "AUTOTHROTTLE_START_DELAY": 1,
    "AUTOTHROTTLE_MAX_DELAY": 10,
    "RETRY_HTTP_CODES": [429, 500, 502, 503, 504],
}
```

---

## 🔗 Referencias

- Dominio API: `https://web.gw.fotocasa.es`
- Sitio web: `https://www.fotocasa.es`
- Análisis realizado: Octubre 2025
- Método: Captura HAR + análisis de tráfico HTTP
