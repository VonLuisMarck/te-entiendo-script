# Documentación Técnica: Algoritmo de Scoring InmoFinder

**Documento confidencial para registro de patente**  
**Versión:** 2.0  
**Fecha:** Octubre 2025  
**Última actualización:** v2.0 - Bonus por ahorro + Mayor peso análisis mercado

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

## 3. Algoritmo de Scoring Completo

### 3.1 Score Base (0-100 puntos) **[ACTUALIZADO v2.0]**

#### Distribución de Pesos

| Criterio | Peso (puntos) | Condición de Cumplimiento |
|----------|---------------|---------------------------|
| **Presupuesto Base** | 20 | precio ∈ [presupuesto_min, presupuesto_max] |
| **🆕 Bonus Ahorro** | **10** | **% ahorro respecto a presupuesto_max** |
| **Ubicación** | 20 | ubicacion ∈ criterios.ubicaciones[] |
| **Tipo Propiedad** | 15 | tipo_propiedad ∈ criterios.tipo_propiedad[] |
| **Dormitorios** | 10 | dormitorios ≥ criterios.dormitorios_min |
| **Metros** | 10 | metros ∈ [metros_min, metros_max] |
| **Estado** | 5 | condition ∈ criterios.condition[] |
| **Extras** | 5 | ascensor (2.5) + parking (2.5) |
| **Total** | **100** | *(antes: 90)* |

#### Presupuesto Base (20 puntos)

Si el precio está fuera del rango presupuestario:

```typescript
desviacion = min(
  |precio - presupuesto_min|,
  |precio - presupuesto_max|
)

penalizacion = min(20, (desviacion / 10000) × 5)
puntos_presupuesto = max(0, 20 - penalizacion)
```

#### 🆕 Bonus por Ahorro dentro del Presupuesto (10 puntos)

**Innovación v2.0:** Priorizar propiedades que dejan más margen financiero al cliente.

```typescript
if (precio <= presupuesto_max) {
  porcentaje_ahorro = ((presupuesto_max - precio) / presupuesto_max) × 100
  
  if (ahorro >= 30%) → +10 puntos
  if (ahorro >= 20%) → +8 puntos
  if (ahorro >= 10%) → +6 puntos
  if (ahorro >= 5%)  → +4 puntos
  if (ahorro > 0%)   → +2 puntos
}
```

**Ejemplos prácticos:**

Cliente con presupuesto máximo **200K**:
- Propiedad de **140K** (30% ahorro) → +10 puntos 🎯
- Propiedad de **160K** (20% ahorro) → +8 puntos
- Propiedad de **180K** (10% ahorro) → +6 puntos
- Propiedad de **190K** (5% ahorro) → +4 puntos
- Propiedad de **195K** (2.5% ahorro) → +2 puntos

**Justificación:** Una propiedad de 140K deja 60K de margen financiero vs. solo 10K con una de 190K. Aunque ambas están "dentro del presupuesto", la primera es objetivamente mejor para el cliente.

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

## 5. Bonus por Perfil de Cliente (0-20 puntos) **[ACTUALIZADO v2.0]**

**Cambio importante:** Incrementado de 15 a **20 puntos máximo** para dar más relevancia al análisis de mercado y detectar mejor los chollos auténticos.

### 5.1 Perfil "reformar" (Flippers / Inversores)
**Objetivo:** Máximo ROI, solo interesan chollos significativos.

```typescript
if (desviacion ≤ -30%) → +20 puntos  // 🆕 Super chollazo
if (desviacion ≤ -20%) → +17 puntos  // Chollazo (antes +15)
if (desviacion ≤ -15%) → +13 puntos  // (antes +10)
if (desviacion ≤ -10%) → +8 puntos   // (antes +5)
if (desviacion ≤ -5%)  → +3 puntos   // 🆕 Moderado
else → 0 puntos
```

**Filosofía:** Escala más granular para diferenciar super chollos de oportunidades moderadas.

### 5.2 Perfil "alquilar" (Landlords)
**Objetivo:** Rentabilidad a largo plazo, aceptan precio justo.

```typescript
if (desviacion ≤ -25%) → +17 puntos  // 🆕 Super chollo
if (desviacion ≤ -15%) → +13 puntos  // Buen chollo (antes +10)
if (desviacion ≤ -10%) → +10 puntos  // (antes +7)
if (desviacion ≤ -5%)  → +5 puntos   // (antes +3)
if (|desviacion| ≤ 5%) → +3 puntos   // Precio justo (antes +2)
else → 0 puntos
```

**Filosofía:** Mayor recompensa por chollos significativos, pero mantienen valoración de precio justo.

### 5.3 Perfil "vivir" (End Users)
**Objetivo:** Mejor relación calidad-precio, flexible.

```typescript
if (desviacion ≤ -25%) → +15 puntos  // 🆕 Super oportunidad
if (desviacion ≤ -15%) → +11 puntos  // (antes +8)
if (desviacion ≤ -10%) → +8 puntos   // (antes +5)
if (desviacion ≤ -5%)  → +5 puntos   // (antes +3)
if (desviacion ≤ 0%)   → +2 puntos   // Cualquier descuento (antes +1)
else → 0 puntos
```

**Filosofía:** Valoran más los super chollos, pero cualquier ahorro sigue siendo bienvenido.

---

## 6. Score Final y Filtrado **[ACTUALIZADO v2.0]**

### 6.1 Fórmula de Score Final
```typescript
score_final = min(100, score_base + bonus_perfil)
// Máximo posible antes del cap: 100 (base) + 20 (bonus) = 120
// Se normaliza a 100 para evitar distorsiones
```

**Implicaciones:**
- Propiedades con **doble ventaja** (bajo precio + chollo de mercado) alcanzan scores cercanos a 100
- Score base mejorado permite mejor diferenciación entre propiedades similares

### 6.2 Umbral de Match Válido
```typescript
if (score_final >= 50) {
  // Guardar matching en base de datos
  // Generar notificación si está configurada
}
```

**Justificación del 50%:** Equilibrio entre cobertura y precisión. Score < 50 indica desajuste fundamental.

---

## 7. Casos de Uso Reales **[ACTUALIZADOS v2.0]**

### Caso 1: Flipper encuentra super chollazo **[NUEVO EJEMPLO]**
**Criterios:**
- Perfil: **reformar**
- Presupuesto: 100K-200K
- Ubicación: Murcia Centro
- Estado: Para reformar

**Propiedad:**
- Precio: **140K**, 80m², centro, para reformar
- Precio/m²: 1.750 €/m²
- Mercado zona: 2.500 €/m² → Desviación: **-30%** (super chollazo)

**Cálculo v2.0:**
```
Score Base:
- Presupuesto base: +20 (dentro de rango 100-200K)
- 🆕 Bonus ahorro: +10 (30% ahorro vs 200K máximo) ← NUEVO
- Ubicación: +20 (match centro)
- Tipo: +15 (piso)
- Superficie: +10 (cumple)
- Estado: +5 (para reformar, match)
- Extras: +3
- Total Score Base: 83/100 (antes era 78/90)

Bonus Perfil "reformar":
- Desviación -30% → +20 puntos (antes +15)

Score Final: min(100, 83 + 20) = 100 puntos ✅ 🎯
```

**Resultado:** Matching perfecto. La propiedad combina:
1. Bajo desembolso (30% menos del presupuesto máximo)
2. Super chollo de mercado (-30% vs precio/m² zona)
3. Cumple todos los criterios del cliente

**Comparación con v1.0:**
- v1.0: 93 puntos (78 base + 15 bonus)
- v2.0: **100 puntos** (83 base + 20 bonus)
- Mejora: +7 puntos por valorar correctamente el doble beneficio

### Caso 2: Comparación por ahorro dentro del presupuesto **[NUEVO CASO]**

**Cliente "alquilar":**
- Presupuesto: 150K-250K
- Zona: Universitaria
- Perfil: Inversión para alquiler

**Propiedad A:**
- Precio: **220K**, 90m², buen estado
- Todas las características iguales

**Propiedad B:**
- Precio: **180K**, 90m², buen estado
- Todas las características iguales

**Sin v2.0 (algoritmo antiguo):**
- Ambas: +25 presupuesto (dentro de rango)
- Ambas puntuarían igual en presupuesto ❌

**Con v2.0:**

**Propiedad A (220K):**
- Presupuesto base: +20
- Bonus ahorro: +6 (12% ahorro vs 250K)
- **Total presupuesto: 26 puntos**

**Propiedad B (180K):**
- Presupuesto base: +20
- 🆕 Bonus ahorro: +10 (28% ahorro vs 250K)
- **Total presupuesto: 30 puntos** (+4 ventaja)

**Resultado:** Propiedad B correctamente priorizada:
- Ahorro real: 70K de margen vs. 30K
- Mejor ROI potencial
- Menor riesgo financiero

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
// Pesos de criterios (suma 100) **[ACTUALIZADO v2.0]**
const WEIGHTS = {
  presupuesto_base: 20,      // Antes: 25
  bonus_ahorro: 10,          // 🆕 NUEVO
  ubicacion: 20,
  tipo_propiedad: 15,
  dormitorios: 10,
  metros: 10,
  condition: 5,
  extras: 5
};

// Escalas bonus por ahorro **[NUEVO v2.0]**
const AHORRO_THRESHOLDS = {
  excelente: 30,  // +10 puntos
  muy_bueno: 20,  // +8 puntos
  bueno: 10,      // +6 puntos
  moderado: 5,    // +4 puntos
  minimo: 0       // +2 puntos
};

// Umbrales de oportunidad (sin cambios)
const THRESHOLDS = {
  chollazo: -20,
  buena_oportunidad: -10,
  oportunidad: -5,
  caro: 10,
  sobrevalorado: 20
};

// Bonus por perfil **[ACTUALIZADO v2.0]**
const BONUS = {
  reformar: { 
    super_chollazo: 20,  // 🆕 -30%
    chollazo: 17,        // Antes: 15
    bueno: 13,           // Antes: 10
    moderado: 8,         // Antes: 5
    leve: 3              // 🆕 NUEVO
  },
  alquilar: { 
    super_chollazo: 17,  // 🆕 -25%
    chollazo: 13,        // Antes: 10
    bueno: 10,           // Antes: 7
    moderado: 5,         // Antes: 3
    justo: 3             // Antes: 2
  },
  vivir: { 
    super_oportunidad: 15, // 🆕 -25%
    bueno: 11,             // Antes: 8
    moderado: 8,           // Antes: 5
    leve: 5,               // Antes: 3
    minimo: 2              // Antes: 1
  }
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

## 14. Historial de Versiones

### **v2.0 - Octubre 2025** ✨ **[VERSIÓN ACTUAL]**

**Mejoras implementadas:**

1. **🆕 Nuevo criterio: Bonus por ahorro dentro del presupuesto (10 puntos)**
   - Sistema escalonado desde +2 (5% ahorro) hasta +10 (>30% ahorro)
   - **Justificación:** Prioriza propiedades que dejan más margen financiero
   - **Impacto:** Diferencia correctamente entre una propiedad de 140K vs 190K dentro de presupuesto de 200K

2. **📈 Incremento del peso del análisis de mercado**
   - Bonus por perfil: 15 → **20 puntos** máximo (+33%)
   - Escalas más granulares para super chollos (≤-30%)
   - **Justificación:** El análisis €/m² vs mercado es crucial para identificar oportunidades reales

3. **⚖️ Redistribución de pesos**
   - Score base: 90 → **100 puntos** (presupuesto base 20 + bonus ahorro 10)
   - Score total máximo: 105 → **120 puntos** (con cap en 100)
   - Mejor diferenciación entre propiedades similares

**Impacto esperado:**
- ✅ Mayor precisión en rankings para perfiles de inversión
- ✅ Mejor identificación de chollos auténticos vs propiedades sobrevaloradas
- ✅ Scores más altos para propiedades con doble ventaja (bajo precio + oportunidad de mercado)
- ✅ Priorización correcta de propiedades dentro del mismo rango presupuestario

### v1.0 - Octubre 2025
- Versión inicial del algoritmo
- Score base: 90 puntos
- Bonus perfil: 15 puntos máximo
- Presupuesto: criterio binario (25 puntos fijos)

---

## 15. Conclusiones

El **Algoritmo de Scoring InmoFinder v2.0** representa una innovación significativa en el sector inmobiliario al:

1. **Democratizar** el análisis de mercado profesional para usuarios finales
2. **Personalizar** las recomendaciones según objetivos de inversión
3. **Automatizar** la detección de oportunidades infravaloradas
4. **Integrar** datos de mercado en tiempo real con criterios subjetivos
5. **🆕 Priorizar** correctamente el ahorro real dentro del presupuesto del cliente

La **patentabilidad** se fundamenta en:
- Combinación única de scoring ponderado + análisis comparativo + personalización por perfil
- Sistema de cache geográfico jerárquico con fallback ciudad
- Algoritmo de bonus dinámico basado en desviación de mercado
- **🆕 Sistema de bonus escalonado por ahorro presupuestario**

**Siguiente paso:** Proteger mediante patente el método y sistema completo antes de lanzamiento público (Q1 2026).

---

**Confidencial - InmoFinder © 2025**