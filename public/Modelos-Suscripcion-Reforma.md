# Modelos de Integración: Suscripción + Reforma

**Fecha:** 2025-10-27  
**Propósito:** Análisis de alternativas para integrar el servicio de reforma con el modelo de suscripción de InmoFinder

---

## 🎯 Contexto

InmoFinder tiene dos fuentes de valor:
1. **Suscripción** (búsqueda inteligente): €9.99-19.99/mes durante 2-4 meses
2. **Reforma** (arquitectura): €25-40K por proyecto, margen €8-15K

**Tensión clave:** La búsqueda es temporal (2-4 meses), pero la reforma es donde está el dinero real.

---

## 📊 Modelo A: Reformas como Beneficio del Tier

### Descripción
Diferentes planes de suscripción incluyen distintos niveles de acceso/descuento en reformas.

### Estructura de Planes

| Plan | Precio/mes | Beneficio Reforma |
|------|------------|-------------------|
| **Basic** | €9.99 | Valoración IA gratis, reforma a precio mercado |
| **Premium** | €19.99 | Valoración gratis + 5% descuento en reforma |
| **Elite** | €49.99 | Valoración gratis + 10% descuento + consultoría personalizada |

### Números (Ejemplo: Cliente compra en mes 3)

**Cliente Basic:**
- Gasta suscripción: €9.99 × 3 = €30
- Reforma sin descuento: €30,000
- **Tu ingreso total:** €30 + €9,000 (30% margen) = **€9,030**

**Cliente Elite:**
- Gasta suscripción: €49.99 × 3 = €150
- Reforma con 10% descuento: €27,000
- **Tu ingreso total:** €150 + €5,400 (20% margen) = **€5,550**

### ✅ Pros
- Incentiva planes más caros
- Diferenciación clara entre tiers
- Coherencia: "más pagas, más recibes"

### ❌ Contras
- **CRÍTICO:** Pierdes margen en reformas (tu verdadero negocio)
- Planes caros (€49.99) difíciles de justificar para un uso de 2-4 meses
- Cliente Elite podría sentirse "estafado" si no compra (pagó €150 sin usar el beneficio)
- Complejo de comunicar

### 💰 Impacto Financiero
- Cada 10% descuento en reforma = €3,000 menos de margen bruto
- Para compensar: necesitas 100 suscriptores Elite (€5,000/mes) por cada reforma que haces con descuento

---

## 📊 Modelo B: Descuento por Tenure (Permanencia)

### Descripción
Todos pagan lo mismo por suscripción (€14.99/mes), pero el descuento en reforma depende de cuántos meses estuvieron suscritos.

### Escala de Descuentos

| Meses suscrito | Descuento en reforma |
|----------------|----------------------|
| 1-2 meses | 0% |
| 3-4 meses | 5% |
| 5-6 meses | 10% |
| 7+ meses | 15% |

### Ejemplo Numérico

**Cliente que busca 3 meses:**
- Suscripción: €14.99 × 3 = €45
- Reforma con 5% descuento: €28,500
- Margen estudio: €5,700 (20%)
- **Tu ingreso total:** €45 + €5,700 = **€5,745**

**Cliente que busca 6 meses:**
- Suscripción: €14.99 × 6 = €90
- Reforma con 10% descuento: €27,000
- Margen estudio: €4,050 (15%)
- **Tu ingreso total:** €90 + €4,050 = **€4,140**

### ✅ Pros
- Incentiva permanencia sin subir el precio de entrada
- Simple de explicar: "cuanto más tiempo, mejor trato"
- Cliente siente que está "ganando" algo por su paciencia

### ❌ Contras
- **PROBLEMA:** Castigas al cliente eficiente (que compra rápido)
- Incentiva búsquedas largas = peor experiencia de usuario
- Sigue reduciendo margen de reforma progresivamente
- Cliente podría mantener suscripción "fake" solo por descuento

### 💰 Impacto Financiero
- Cliente promedio (3 meses): €5,745 total
- Cliente lento (6 meses): €4,140 total
- **Paradoja:** Cliente que tarda más en comprar = menos ganas tú

---

## 📊 Modelo C: Pago Único "All-In"

### Descripción
Eliminas la suscripción mensual. Cliente paga una cuota única al inicio que incluye búsqueda + acceso a reforma con precio preferente.

### Estructura de Precios

| Opción | Precio único | Incluye | Reforma |
|--------|--------------|---------|---------|
| **Solo búsqueda** | €99 | Búsqueda ilimitada 6 meses + alertas IA | Precio mercado |
| **All-In** | €499 | Lo mismo + valoración IA + 5% descuento reforma | €28,500 (ejemplo) |

### Ejemplo Numérico

**Cliente All-In que compra y reforma:**
- Pago inicial: €499
- Reforma con 5% descuento: €28,500
- Margen estudio: €5,700 (20%)
- **Tu ingreso total:** €499 + €5,700 = **€6,199**
- **vs. Modelo suscripción:** €45 + €6,750 = €6,795

### ✅ Pros
- Cash upfront (liquidez inmediata)
- Selección natural: solo entran clientes serios
- Eliminas problema de "churners" mensuales
- Simple: un solo pago, no micro-gestión de suscripciones

### ❌ Contras
- **CRÍTICO:** Barrera de entrada muy alta (€499 vs €9.99)
- Asumes riesgo: cliente puede no comprar ni reformar
- Difícil de justificar si el cliente no encuentra nada en 6 meses
- Potencial backlash: "pagué €499 y no compré nada"

### 💰 Impacto Financiero
- Conversión estimada: 10-20% (vs 40-50% con suscripción baja)
- Necesitas ~13 clientes All-In para igualar 100 suscriptores @ €14.99/mes
- Si cliente no reforma: ganas €499 vs €60-90 en suscripción

---

## 📊 Modelo D: Freemium + Bonus Reforma

### Descripción
Búsqueda básica es GRATIS. Cliente paga solo por valor añadido o por reforma. Reforma no tiene descuento pero sí servicios "bonus" según engagement.

### Estructura

| Nivel | Precio | Acceso | Bonus Reforma |
|-------|--------|--------|---------------|
| **Free** | €0 | Alertas básicas, sin scoring IA | Valoración IA a €49 |
| **Pro** | €19.99/mes | Scoring IA, análisis mercado, percentiles | Valoración IA gratis |
| **Reforma** | €25-40K | N/A | Si estuvo suscrito Pro: gestoría incluida (€500 valor) |

### Ejemplo Numérico

**Cliente Free que compra y reforma:**
- Suscripción: €0
- Paga valoración IA: €49
- Reforma sin descuento: €30,000
- Margen estudio: €9,000 (30%)
- **Tu ingreso total:** €49 + €9,000 = **€9,049**

**Cliente Pro 3 meses que reforma:**
- Suscripción: €19.99 × 3 = €60
- Valoración gratis (valor €49)
- Reforma sin descuento: €30,000 + gestoría incluida (valor €500)
- Margen estudio: €8,500 (28.3% real, das €500 en gestoría)
- **Tu ingreso total:** €60 + €8,500 = **€8,560**

### ✅ Pros
- **Sin fricción de entrada:** Todos pueden probar gratis
- No reduces margen de reforma (tu core business)
- Volumen alto de usuarios = mejor data para IA
- Bonus reforma es "servicio" no descuento (gestoría, seguimiento obra, etc.)

### ❌ Contras
- Mayoría no pagará suscripción (típico freemium)
- Riesgo: clientes free "parasitan" pero no convierten
- Requiere valor diferencial MUY claro entre Free y Pro
- Complejo de operar: dos funnel paralelos

### 💰 Impacto Financiero
- Conversión Free → Reforma: 5-10% estimado
- Conversión Pro → Reforma: 25-35% estimado
- Margen reforma intacto: €9,000 por proyecto
- LTV Pro (3 meses) + Reforma: €8,560

---

## 🔍 Análisis Comparativo

### Revenue por Cliente que Compra + Reforma

| Modelo | Suscripción | Reforma (margen) | **Total** |
|--------|-------------|------------------|-----------|
| A - Basic | €30 | €9,000 (30%) | **€9,030** |
| A - Elite | €150 | €5,400 (20%) | **€5,550** |
| B - 3 meses | €45 | €5,700 (20%) | **€5,745** |
| C - All-In | €499 | €5,700 (20%) | **€6,199** |
| D - Free | €0 | €9,000 (30%) | **€9,000** |
| D - Pro | €60 | €8,500 (28%) | **€8,560** |

### Conversión Estimada (Top of Funnel → Reforma)

| Modelo | Barrera entrada | Conv. estimada | Rev/100 visitors |
|--------|-----------------|----------------|------------------|
| A - Basic | Baja (€9.99) | 12-18% | €13,500 |
| A - Elite | Alta (€49.99) | 3-5% | €8,300 |
| B | Media (€14.99) | 10-15% | €8,600 |
| C - All-In | Muy alta (€499) | 5-8% | €9,300 |
| D - Free | Nula (€0) | 6-10% | **€9,000** |
| D - Pro | Media (€19.99) | 15-20% | **€14,200** |

---

## ❓ Preguntas Clave para Decidir

### 1. ¿Cuál es vuestro perfil de cliente primary target?

**Opción A: First-time buyer (Pareja joven, primera vivienda)**
- Precio-sensible
- Reforma "necesaria" (actualización)
- Ticket reforma: €25-35K
- **Mejor modelo:** D (Freemium) o A (Basic)

**Opción B: Inversor/Flipper (Compra para renovar y revender)**
- Menos precio-sensible
- Reforma es core del negocio
- Ticket reforma: €40-60K
- **Mejor modelo:** C (All-In) o A (Elite)

**Opción C: Ambos**
- Requiere segmentación
- **Mejor modelo:** D (Freemium con Pro opcional)

---

### 2. ¿Preferís volumen o margen?

**Escenario A: Muchas reformas, margen menor**
- 15 reformas/año × €5,400 margen = **€81,000/año**
- Requiere: Equipo grande, procesos escalables
- Riesgo: Saturación estudio, calidad baja

**Escenario B: Pocas reformas, margen alto**
- 10 reformas/año × €9,000 margen = **€90,000/año**
- Requiere: Servicio premium, reputación
- Riesgo: Dependencia de pocos clientes

---

### 3. ¿Qué rol tiene la suscripción?

**A. Es el producto (SaaS real)**
- Objetivo: Maximizar MRR
- Reforma es upsell/bonus
- **Mejor modelo:** A (Elite) o C (All-In)

**B. Es solo lead-gen (B2C → B2C pipeline)**
- Objetivo: Maximizar conversión a reforma
- Suscripción es "puerta de entrada"
- **Mejor modelo:** D (Freemium) o A (Basic)

---

## 💡 Recomendación Preliminar

Basándome en vuestro Business Case v2 y los números:

### **Modelo Híbrido: D (Freemium) + Reforma Sin Descuento**

**Por qué:**
1. **Sin fricción:** Free elimina barrera, Pro (€19.99) es justificable
2. **Margen intacto:** Reforma sigue siendo 30% margen = €9K por proyecto
3. **Volumen + Calidad:** Atraes muchos (free) pero conviertes los buenos (Pro)
4. **Realismo:** No prometes descuentos que luego reducen vuestra ganancia core

**Ajuste propuesto:**
- **Free:** Alertas básicas sin IA
- **Pro (€19.99/mes):** Scoring IA + Análisis mercado + Valoración reforma gratis (valor €99)
- **Reforma:** Precio mercado (€25-40K), margen 30%, sin descuentos pero con servicios incluidos (gestoría, seguimiento obra)

**Números ejemplo (100 visitantes):**
- 60 se registran Free
- 20 se convierten a Pro (€19.99 × 3 meses = €60 cada uno) = **€1,200 MRR**
- 12 compran piso (20% conversión de Pro)
- 8 contratan reforma (67% de los que compran) = **€72,000 margen** (€9K × 8)
- **Total/100 visitors:** €1,200 + €72,000 = **€73,200 anual**

---

## 🚀 Próximos Pasos

1. **Definir:** ¿Quién es vuestro cliente ideal? (First-buyer, Inversor, Ambos)
2. **Validar:** ¿Cuánto margen real tiene el estudio de arquitectura por reforma?
3. **Decidir:** ¿Modelo A, B, C, D, o híbrido?
4. **Actualizar:** Reescribir Business Case v2 y Pitch Deck con modelo elegido

---

**Preparado para discusión entre socios. Una vez decidáis, actualizo toda la documentación con números finales.**
