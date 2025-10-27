# Documentación Técnica: Algoritmo de Scoring InmoFinder

**Documento confidencial para registro de patente**  
**Versión:** 1.0  
**Fecha:** Octubre 2025

---

## 1. Resumen Ejecutivo

El **Algoritmo de Scoring InmoFinder** es un sistema patentable de valoración y matching inteligente que combina criterios objetivos del comprador con análisis comparativo de mercado en tiempo real, ajustando la puntuación final según el perfil de inversión del usuario (vivir, alquilar, reformar).

**Innovación clave:** Ponderación dinámica basada en desviación de precio respecto al mercado local, con bonificaciones diferenciadas por perfil de cliente.

---

## 2. Arquitectura del Sistema

### 2.1 Componentes
```
Cliente (Criterios + Perfil) → Propiedad → Métricas Mercado
                                    ↓
                            [Score Base] + [Bonus Perfil]
                                    ↓
                            Score Final (0-100)
```

### 2.2 Flujo de Ejecución
1. **Pre-carga:** Cache de métricas de barrios en memoria (Map)
2. **Cálculo iterativo:** Para cada cliente × propiedad:
   - Calcular score base (criterios objetivos)
   - Analizar precio vs mercado local
   - Calcular bonus según perfil
   - Score final = min(100, score_base + bonus_perfil)
3. **Filtrado:** Solo se guardan matchings con score ≥ 50
4. **Persistencia:** Upsert en lotes de 50 registros

---

## 3. Algoritmo de Score Base (0-90 puntos)

### 3.1 Fórmula General
```
score_base = (suma_puntos_obtenidos / suma_puntos_máximos) × 100
```

### 3.2 Distribución de Pesos

| Criterio | Peso (puntos) | Condición de Cumplimiento |
|----------|---------------|---------------------------|
| **Presupuesto** | 25 | precio ∈ [presupuesto_min, presupuesto_max] |
| **Ubicación** | 20 | ubicacion ∈ criterios.ubicaciones[] |
| **Tipo Propiedad** | 15 | tipo_propiedad ∈ criterios.tipo_propiedad[] |
| **Dormitorios** | 10 | dormitorios ≥ criterios.dormitorios_min |
| **Metros** | 10 | metros ∈ [metros_min, metros_max] |
| **Estado** | 5 | condition ∈ criterios.condition[] |
| **Extras** | 5 | ascensor (2.5) + parking (2.5) |
| **Total** | **90** | - |

### 3.3 Penalización de Presupuesto (Gradiente Suave)

Si el precio está fuera del rango presupuestario:

```typescript
desviacion = min(
  |precio - presupuesto_min|,
  |precio - presupuesto_max|
)

penalizacion = min(25, (desviacion / 10000) × 5)
puntos_presupuesto = max(0, 25 - penalizacion)
```

**Ejemplo práctico:**
- Cliente busca 200K-250K
- Propiedad cuesta 265K
- Desviación: 15K
- Penalización: (15000/10000) × 5 = 7.5 puntos
- Puntos obtenidos: 25 - 7.5 = **17.5 puntos**

---

## 4. Análisis Comparativo de Mercado

### 4.1 Extracción de Contexto Geográfico
```typescript
ubicacion = "Madrid, Chamberí"
→ ciudad = "Madrid"
→ barrio = "Chamberí"

// Búsqueda jerárquica en cache:
1. Buscar métricas de "Madrid|Chamberí" (barrio)
2. Si no existe → Buscar "Madrid|ciudad" (agregado ciudad)
```

### 4.2 Cálculo de Desviación Porcentual
```typescript
precio_m2_propiedad = precio / metros
precio_m2_mercado = metricas_barrio.precio_m2_medio

desviacion_% = ((precio_m2_propiedad - precio_m2_mercado) / precio_m2_mercado) × 100
```

### 4.3 Clasificación de Oportunidad

| Desviación | Nivel | Etiqueta | es_chollo |
|------------|-------|----------|-----------|
| ≤ -20% | Chollazo | `chollazo` | ✅ |
| -20% a -10% | Buena oportunidad | `buena_oportunidad` | ✅ |
| -10% a -5% | Oportunidad | `oportunidad` | ❌ |
| -5% a +10% | Normal | `normal` | ❌ |
| +10% a +20% | Caro | `caro` | ❌ |
| > +20% | Sobrevalorado | `sobrevalorado` | ❌ |

**Ejemplo:**
- Propiedad: 2.500 €/m²
- Mercado Chamberí: 3.000 €/m²
- Desviación: **-16.67%** → **Buena oportunidad** (chollo)

---

## 5. Bonus por Perfil de Cliente (0-15 puntos)

### 5.1 Perfil "reformar" (Flippers / Inversores)
**Objetivo:** Máximo ROI, solo interesan chollos significativos.

```typescript
if (desviacion ≤ -20%) → +15 puntos  // Chollazo
if (desviacion ≤ -15%) → +10 puntos
if (desviacion ≤ -10%) → +5 puntos
else → 0 puntos
```

**Filosofía:** No diluir esfuerzos en propiedades mediocres. Solo alertar de verdaderas gangas.

### 5.2 Perfil "alquilar" (Landlords)
**Objetivo:** Rentabilidad a largo plazo, aceptan precio justo.

```typescript
if (desviacion ≤ -15%) → +10 puntos  // Buen chollo
if (desviacion ≤ -10%) → +7 puntos
if (desviacion ≤ -5%) → +3 puntos
if (|desviacion| ≤ 5%) → +2 puntos  // Precio justo OK
else → 0 puntos
```

**Filosofía:** Valoran estabilidad y ubicación; precio justo también es válido.

### 5.3 Perfil "vivir" (End Users)
**Objetivo:** Mejor relación calidad-precio, flexible.

```typescript
if (desviacion ≤ -15%) → +8 puntos
if (desviacion ≤ -10%) → +5 puntos
if (desviacion ≤ -5%) → +3 puntos
if (desviacion ≤ 0%) → +1 punto  // Cualquier descuento vale
else → 0 puntos
```

**Filosofía:** Cualquier ahorro es bienvenido, priorizan "vivienda ideal" sobre inversión.

---

## 6. Score Final y Filtrado

### 6.1 Fórmula de Score Final
```typescript
score_final = min(100, score_base + bonus_perfil)
```

**Límite superior:** 100 puntos para evitar distorsiones.

### 6.2 Umbral de Match Válido
```typescript
if (score_final >= 50) {
  // Guardar matching en base de datos
  // Generar notificación si está configurada
}
```

**Justificación del 50%:** Equilibrio entre cobertura y precisión. Score < 50 indica desajuste fundamental.

---

## 7. Casos de Uso Reales

### Caso 1: Cliente "vivir" busca piso en Chamberí
**Criterios:**
- Presupuesto: 250K-300K
- Ubicación: Madrid, Chamberí
- Tipo: Piso
- Dormitorios: ≥2
- Metros: 60-80m²

**Propiedad A:**
- Precio: 270K, 70m² (3.857 €/m²)
- Ubicación: Chamberí
- Tipo: Piso, 2 dorm.
- Mercado: 3.000 €/m² → Desviación: **+28.6%** (sobrevalorado)

**Cálculo:**
```
Score Base:
- Presupuesto: 25 (dentro de rango)
- Ubicación: 20 (match)
- Tipo: 15 (match)
- Dormitorios: 10 (cumple)
- Metros: 10 (cumple)
- Total: 80/90 × 100 = 88.9 puntos

Bonus Perfil "vivir":
- Desviación +28.6% → 0 puntos

Score Final: 88.9 puntos → ✅ Match válido
```

**Propiedad B:**
- Precio: 250K, 75m² (3.333 €/m²)
- Mercado: 3.000 €/m² → Desviación: **+11.1%** (caro)

**Cálculo:**
```
Score Base: 88.9 puntos (igual criterios)
Bonus Perfil: 0 puntos
Score Final: 88.9 puntos
```

**Propiedad C:**
- Precio: 240K, 80m² (3.000 €/m²)
- Mercado: 3.000 €/m² → Desviación: **0%** (precio justo)

**Cálculo:**
```
Score Base: 88.9 puntos
Bonus Perfil: +1 punto (desviación ≤ 0%)
Score Final: 89.9 puntos → ⭐ Mejor opción
```

### Caso 2: Cliente "reformar" busca chollo en Malasaña
**Criterios:**
- Presupuesto: 150K-200K
- Ubicación: Madrid, Malasaña
- Estado: A reformar

**Propiedad D:**
- Precio: 180K, 60m² (3.000 €/m²)
- Estado: A reformar
- Mercado: 4.000 €/m² → Desviación: **-25%** (chollazo)

**Cálculo:**
```
Score Base: 75 puntos
Bonus Perfil "reformar": +15 puntos (desviación ≤ -20%)
Score Final: 90 puntos → 🎯 Alerta prioritaria
```

---

## 8. Optimizaciones de Rendimiento

### 8.1 Pre-carga de Métricas en Memoria
```typescript
// Cache Map<string, Metrica>
// Key: "ciudad|barrio" o "ciudad|ciudad"
// Evita N queries a base de datos
const metricasMap = new Map();
todasMetricas.forEach(m => {
  metricasMap.set(`${m.ciudad}|${m.barrio || 'ciudad'}`, m);
});
```

### 8.2 Procesamiento por Lotes
- **Batch size:** 50 matchings/upsert
- **Límites:** 20 clientes × 100 propiedades = 2.000 combinaciones máx
- **Evita:** Timeouts en edge functions (10s límite)

### 8.3 Background Processing
```typescript
EdgeRuntime.waitUntil(processMatchings());
// Respuesta inmediata al cliente
// Procesamiento asíncrono en background
```

---

## 9. Estructura de Datos de Salida

### 9.1 Objeto `analisis_mercado` (JSONB)
```json
{
  "disponible": true,
  "precio_m2_propiedad": 3500,
  "precio_m2_mercado": 4000,
  "desviacion_porcentaje": -12.5,
  "nivel_oportunidad": "buena_oportunidad",
  "es_chollo": true,
  "metricas_usadas": "barrio",
  "total_propiedades_comparadas": 45
}
```

### 9.2 Objeto `criterios_cumplidos` (JSONB)
```json
{
  "presupuesto": true,
  "ubicacion": true,
  "tipo_propiedad": true,
  "dormitorios": true,
  "metros": true,
  "condition": false,
  "ascensor": true,
  "parking": false
}
```

---

## 10. Ventajas Competitivas del Algoritmo

### 10.1 vs. Matching Tradicional
| Aspecto | Tradicional | InmoFinder |
|---------|-------------|------------|
| Criterios | Binarios (sí/no) | Ponderados + gradiente |
| Contexto | Aislado | Comparación con mercado real |
| Personalización | Estática | Dinámica según perfil |
| Actualización | Manual | Automática con cada scraping |

### 10.2 Elementos Patentables
1. **Sistema de ponderación gradual** en desviación presupuestaria
2. **Bonificación diferenciada por perfil** basada en análisis de mercado
3. **Cache jerárquico geográfico** (barrio → ciudad)
4. **Umbral dinámico de oportunidad** según desviación porcentual
5. **Integración de scoring base + contexto de mercado** en tiempo real

---

## 11. Parámetros Ajustables (Configuración)

```typescript
// Pesos de criterios (suma 90)
const WEIGHTS = {
  presupuesto: 25,
  ubicacion: 20,
  tipo_propiedad: 15,
  dormitorios: 10,
  metros: 10,
  condition: 5,
  extras: 5
};

// Umbrales de oportunidad
const THRESHOLDS = {
  chollazo: -20,
  buena_oportunidad: -10,
  oportunidad: -5,
  caro: 10,
  sobrevalorado: 20
};

// Bonus por perfil
const BONUS = {
  reformar: { chollazo: 15, bueno: 10, moderado: 5 },
  alquilar: { chollazo: 10, bueno: 7, moderado: 3, justo: 2 },
  vivir: { chollazo: 8, bueno: 5, moderado: 3, minimo: 1 }
};

// Filtrado
const MIN_SCORE = 50;
```

---

## 12. Métricas de Calidad del Algoritmo

### 12.1 KPIs de Precisión
- **Tasa de aceptación:** % de matchings >80 puntos que generan contacto
- **False positives:** Matchings >70 puntos rechazados por cliente
- **Chollos validados:** % de propiedades marcadas "chollo" que se venden rápido

### 12.2 Calibración Continua
- Ajustar pesos según feedback implícito (clicks, favoritos, contactos)
- A/B testing de umbrales de bonus por perfil
- Reentrenamiento semestral con datos históricos

---

## 13. Extensiones Futuras

### 13.1 Machine Learning
- Reemplazar pesos fijos por modelo entrenado con datos reales
- Predicción de "tiempo en mercado" como factor adicional
- Clustering de perfiles más granulares

### 13.2 Variables Adicionales
- **Tendencia de revalorización:** Bonus si barrio es alcista (+3-5 puntos)
- **Índice de liquidez:** Penalización si mercado es lento (-2 puntos)
- **Competencia:** Bonus si hay pocas propiedades similares (+5 puntos)

### 13.3 Personalización Avanzada
- Aprendizaje de preferencias implícitas (clicks, tiempo en página)
- Ajuste automático de pesos por usuario
- Sugerencias proactivas de ajuste de criterios

---

## 14. Conclusiones

El **Algoritmo de Scoring InmoFinder** representa una innovación significativa en el sector inmobiliario al:

1. **Democratizar** el análisis de mercado profesional para usuarios finales
2. **Personalizar** las recomendaciones según objetivos de inversión
3. **Automatizar** la detección de oportunidades infravaloradas
4. **Integrar** datos de mercado en tiempo real con criterios subjetivos

La **patentabilidad** se fundamenta en:
- Combinación única de scoring ponderado + análisis comparativo + personalización por perfil
- Sistema de cache geográfico jerárquico con fallback ciudad
- Algoritmo de bonus dinámico basado en desviación de mercado

**Siguiente paso:** Proteger mediante patente el método y sistema completo antes de lanzamiento público (Q1 2026).

---

**Confidencial - InmoFinder © 2025**