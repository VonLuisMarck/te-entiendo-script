# 🚀 InmoFinder - Pitch Deck v2.0 (B2C + Reformas)

## Slide 1: Cover

```
╔═══════════════════════════════════════════════════════╗
║                                                       ║
║                    🏠 InmoFinder                      ║
║                                                       ║
║     De la Búsqueda del Piso a la Reforma Integral    ║
║                                                       ║
║              B2C Subscription + Reformas              ║
║                                                       ║
║                                                       ║
║                  [Nombre Founders]                    ║
║        Tech Founder + Arquitectura Founder            ║
║                  [emails/LinkedIn]                    ║
║                                                       ║
║                  Diciembre 2024                       ║
║                                                       ║
╚═══════════════════════════════════════════════════════╝
```

---

## Slide 2: El Problema (Dos Pain Points)

### 🔴 Pain Point 1: Búsqueda de Piso

**Compradores gastan 15-20h/semana** revisando portales:
- Fotocasa, Idealista, Habitaclia... manualmente
- Propiedades interesantes desaparecen en horas
- No saben si el precio es bueno vs mercado

> *"Paso 2 horas cada noche mirando pisos en Idealista"*  
> — Comprador típico, 28-35 años

---

### 🔴 Pain Point 2: Post-Compra (Más importante)

**80% de compradores necesitan reforma**, pero:
- No saben por dónde empezar
- Desconfianza de estudios (precios opacos)
- Miedo a presupuestos inflados
- Pierden semanas buscando arquitecto de confianza

> *"Compré el piso en marzo, empecé reforma en julio. Perdí 4 meses buscando arquitecto"*  
> — Comprador real, Madrid

**La brecha**: Nadie acompaña el journey completo (búsqueda → compra → reforma)

---

## Slide 3: La Solución - Journey Completo

### ✅ InmoFinder: Tu Acompañante Inmobiliario

```
┌─────────────────────────────────────────────────┐
│                                                 │
│  🔍 BÚSQUEDA        💰 COMPRA        🏗️ REFORMA │
│  (2-4 meses)       (Puntual)        (3 meses)  │
│                                                 │
│  Scraping 24/7     Análisis         Valoración │
│  + Scoring         de mercado       con IA      │
│  + WhatsApp        (percentiles)    (GPT-5)     │
│                                                 │
│  €9.99-19.99/mes   GRATIS           €25-40K     │
│  (suscripción)     (valor añadido)  (reforma)   │
│                                                 │
└─────────────────────────────────────────────────┘
```

**Diferenciador**: Somos los únicos que te acompañamos desde que buscas hasta que entras a vivir.

---

## Slide 4: Cómo Funciona (3 Fases)

### Fase 1: Búsqueda (€9.99-19.99/mes)

```
Usuario configura criterios
    ↓
InmoFinder scraping 24/7 (Fotocasa, Idealista, etc.)
    ↓
Algoritmo scoring 0-100 (matching + análisis mercado)
    ↓
Alerta WhatsApp solo si score >70
    ↓
Usuario ve piso (antes que nadie)
```

**Valor para cliente**: Ahorra 15h/semana + Acceso anticipado  
**Valor para InmoFinder**: Relación de confianza

---

### Fase 2: Compra (Gratis, cortesía)

**Análisis de mercado incluido**:
- ¿Es buen precio? (percentil 25/50/75 del barrio)
- ¿Zona al alza o a la baja? (tendencia precios)
- Proyección revalorización a 5 años

**Valor para cliente**: Decisión informada (no paga de más)  
**Valor para InmoFinder**: Cliente percibe alto valor, fidelidad

---

### Fase 3: Reforma (€25-40K, margen 30-40%)

**7-14 días tras firma escrituras**:

```
WhatsApp automático:
"¡Enhorabuena! ¿Valoración gratuita de reforma?"

    ↓ 60% acepta
    
Cliente sube 10-15 fotos del piso
    ↓
IA (GPT-5 Vision) analiza en 24h
    ↓
PDF con estimación: €28-34K
+ Desglose transparente
+ ROI potencial (valor post-reforma)
    ↓
Llamada arquitecto (si ambos ganan)
    ↓ 50% contrata
    
Reforma ejecutada por estudio asociado
```

**Valor para cliente**: Transparencia + Precio justo + Confianza  
**Valor para Estudio**: Lead pre-cualificado (vs 5% conversión mercado frío)

---

## Slide 5: El Modelo Real (No es SaaS)

### 💡 Insight Clave

Las suscripciones son **customer acquisition**, no el negocio real.

```
┌──────────────────────────────────────────────┐
│                                              │
│  Suscripciones (€10-20/mes)                  │
│  ↓                                           │
│  €100-200 revenue/cliente                    │
│  ↓                                           │
│  CAC = €40                                   │
│  ↓                                           │
│  LTV/CAC = 2.5-5x (OK, pero no espectacular)│
│                                              │
└──────────────────────────────────────────────┘

VS

┌──────────────────────────────────────────────┐
│                                              │
│  Reformas (€25-40K ticket)                   │
│  ↓                                           │
│  €8-15K margen/reforma                       │
│  ↓                                           │
│  10% suscriptores → reforma (conservador)    │
│  ↓                                           │
│  LTV = €100 (sub) + €900 (reforma) = €1,000 │
│  ↓                                           │
│  LTV/CAC = 25x 🚀                            │
│                                              │
└──────────────────────────────────────────────┘
```

**La suscripción es el anzuelo, la reforma es el pez.**

---

## Slide 6: Innovación Tecnológica (IA de Valoración)

### 🤖 Valoración de Reformas con GPT-5 Vision

**Problema**: Arquitectos tardan 3-5 días en visitar + presupuestar

**Solución**: Valoración en 24h solo con fotos

**Cómo funciona**:

```python
# Prompt especializado de arquitectura
prompt = """
Analiza estas 15 fotos del piso y estima coste reforma integral.

Criterios estándar:
- Cocina completa: €8-12K
- Baño completo: €6-8K cada uno
- Suelos 80m²: €4-6K
- Pintura total: €2-3K
- Electricidad/Fontanería: €2-5K

Devuelve JSON:
{
  "coste_min": 25000,
  "coste_max": 32000,
  "desglose": {...},
  "urgencia": "alto|medio|bajo",
  "observaciones": "Cocina muy antigua, baños OK"
}
"""

# GPT-5 Vision analiza
response = openai_client.chat(model="gpt-5", prompt=prompt, images=[...])

# Generamos PDF personalizado
pdf = generar_valoracion(response, fotos_anotadas)
```

**Output**:
- Estimación: €28,000-34,000
- Desglose por partidas (cocina €10K, baños €14K, etc.)
- Fotos con anotaciones (qué cambiar)
- Comparativa precio mercado

**Precisión actual**: ±15% (buena para valoración inicial)

---

### Algoritmo de Filtrado Interno

**No ofertamos todas las reformas** (clave del negocio):

```typescript
// Calculamos rentabilidad para AMBAS partes
const margenEstudio = precioCliente - costeReal;
const margenPorcentaje = (margenEstudio / costeReal) * 100;

const inversionCliente = precioCompra + costes + reforma;
const valorPostReforma = predecirValorIA(barrio, metros, reforma);
const roiCliente = ((valorPostReforma - inversionCliente) / inversionCliente) * 100;

// SOLO contactar si win-win
if (margenEstudio >= 8000 && roiCliente >= 12) {
  contactarCliente();
} else {
  declinarEducadamente(); // "Ahora no es buen momento para reformar"
}
```

**Ventaja competitiva**: Solo hacemos reformas donde **cliente Y estudio ganan**  
→ Alta satisfacción cliente  
→ Reputación de honestidad (declinamos proyectos poco rentables)

---

## Slide 7: Traction (Beta Actual)

### 📊 Validación Inicial (3 meses)

**Usuarios**:
- 12 beta testers activos
- 8 continúan usando producto (67% retención)
- NPS: 8.5/10

**Conversiones**:
- 3 compraron piso (25% conversión - alto porque beta manual)
- 2 aceptaron valoración reforma (67%)
- 1 reforma en ejecución (€32,000, margen €11,500)

**Feedback cualitativo**:
> *"Encontré mi piso en 3 semanas. Sin InmoFinder habría tardado 3 meses"*  
> — Beta tester, Madrid

> *"La valoración IA fue sorprendentemente precisa. Arquitecto confirmó €30-35K"*  
> — Beta tester post-compra

---

## Slide 8: Mercado (TAM-SAM-SOM)

### 🌍 Tamaño del Mercado (España)

```
┌────────────────────────────────────────────────┐
│  TAM (Total Addressable Market)                │
│  400,000 compras/año × €30K reforma promedio   │
│  = €12,000M/año                                │
│                                                │
│  ┌──────────────────────────────────────────┐ │
│  │ SAM (Serviceable Available Market)       │ │
│  │ Top 5 ciudades: 120,000 compras/año      │ │
│  │ = €3,600M/año                             │ │
│  │                                           │ │
│  │  ┌─────────────────────────────────────┐ │ │
│  │  │ SOM (Objetivo Año 3)                │ │ │
│  │  │ 0.3% market share = 360 reformas/año│ │ │
│  │  │ = €10.8M revenue (€3.5M margen)     │ │ │
│  │  └─────────────────────────────────────┘ │ │
│  └──────────────────────────────────────────┘ │
└────────────────────────────────────────────────┘
```

**Nota**: Objetivo conservador (0.3% penetración en 3 años)

---

## Slide 9: Competencia (Nadie hace esto)

### 🥊 Landscape Competitivo

```
                Alto
                 │
  Reformas       │   [InmoFinder] 🚀
  (monetización) │        ★
                 │
                 │
  Medio          │   [Portales: Idealista, Fotocasa]
                 │   (solo búsqueda)
                 │
                 │   [Estudios arquitectura tradicionales]
                 │   (solo reformas, sin leads)
  Bajo           │
                 │
                 └──────────────────────────── Alto
                     Búsqueda de Piso
```

**Competidores directos**: Ninguno (nadie conecta búsqueda + reforma)

**Competidores indirectos**:

| Player | Qué hacen | Por qué no son amenaza |
|--------|-----------|------------------------|
| **Idealista/Fotocasa** | Portales de búsqueda | No tienen estudio de arquitectura, no monetizan reformas |
| **Estudios arquitectura** | Reformas tradicionales | Sin canal de captación, leads fríos (5% conversión) |
| **Houzz/Habitissimo** | Marketplace reformas | No acompañan búsqueda piso, no dan confianza pre-establecida |

**Ventaja única**: Relación de confianza ANTES de vender la reforma

---

## Slide 10: Equipo y Crecimiento

### 👥 Founders

**[Tu Nombre] - Founder Tech/Producto**
- Background: [Tu experiencia]
- Responsabilidad: Producto, IT, Growth
- Equity: 50%

**[Nombre Socio] - Founder Arquitectura**
- Background: Arquitecto colegiado, X años experiencia
- Responsabilidad: Reformas, Ventas, Operaciones
- Equity: 50%

**Complementariedad perfecta**: Tech que entiende producto + Arquitecto que ejecuta reformas

---

### 📈 Plan de Crecimiento de Equipo

**Año 1** (Founders + Freelancers):
- 2 founders full-time
- 1 developer part-time (mantenimiento)
- 1 arquitecto técnico freelance (mediciones)
- Subcontratas (fontaneros, electricistas)

**Año 2** (5-6 personas):
- **InmoFinder**: +1 Backend Dev, +1 Growth Marketer
- **Estudio**: +1 Arquitecto Junior, +1 Project Manager
- Cuando: Al llegar a 200 suscriptores + 2-3 reformas simultáneas

**Año 3** (10-12 personas):
- **InmoFinder**: +1 Frontend, +1 Content, +1 Data Analyst
- **Estudio**: +1 Arquitecto, +1 Interiorista, +1 Admin
- Cuando: 1,000 suscriptores + 3-5 reformas simultáneas

**Bottleneck crítico**: Capacidad del estudio (1 arquitecto = 4-6 reformas/año)  
→ **Contratar ANTES de escalar marketing** (no aceptar leads que no podemos atender)

---

## Slide 11: Unit Economics (Conservadores)

### 💰 Lifetime Value (LTV)

```
Suscripción: €15/mes × 3 meses promedio = €45

Reforma (10% conversión):
  Ticket: €30,000
  Margen: €9,000
  Probabilidad: 10%
  → €900 esperado

LTV TOTAL = €45 + €900 = €945
```

(Nota: Proyecciones conservadoras, 10% conversión es pesimista)

---

### 🎯 Customer Acquisition Cost (CAC)

```
Ads (Google + Meta): €30/suscriptor
Onboarding + Tools: €10

CAC TOTAL = €40
```

---

### 📊 Ratio LTV/CAC

```
€945 / €40 = 23.6x 🚀
```

**Benchmark SaaS B2C**: 3-5x es bueno  
**InmoFinder**: 23x porque las reformas son el verdadero LTV

**Incluso si CAC sube a €150** (escala, ads menos eficientes):
→ LTV/CAC = 6.3x (aún excelente)

---

## Slide 12: Monetización (3 Streams)

### 💵 Revenue Streams

#### 1. Suscripciones (Predecible, bajo)
- Plan Básico: €9.99/mes (80% usuarios)
- Plan Premium: €19.99/mes (20% usuarios)
- **Objetivo Año 1**: 300 suscriptores → €3,900 MRR (€47K ARR)

**Pros**: Revenue recurrente, predecible  
**Contras**: Churn alto (5-8% mensual), tickets bajos

---

#### 2. Reformas (Core business, alto margen)
- Ticket medio: €30,000
- Coste real: €21,000 (material + subcontratas)
- **Margen**: €9,000/reforma (30%)
- **Conversión**: 10% suscriptores → reforma

**Objetivo Año 1**: 12-18 reformas → €108-162K margen

**Pros**: Margen alto, escalable con equipo  
**Contras**: Requiere capital humano (arquitectos)

---

#### 3. Otros (Futuro, diversificación)

**Financiación reformas**:
- Partnership con bancos (préstamos reformas)
- Comisión: 2-3% del préstamo (€600-900 por cliente)

**Seguros de hogar**:
- Afiliado con aseguradoras
- Comisión: €50-100 por póliza

**Servicios legales**:
- Referidos a notarios/gestorías amigas
- Comisión: €200-300 por cliente

**Potencial Año 2-3**: +€50-100K/año adicionales

---

## Slide 13: Roadmap (18 Meses)

### 🛠️ Q1 2025: Validación

**Objetivo**: 50 suscriptores, 5 compradores, 2 reformas

**Features**:
- Scraping estable (99% uptime)
- Algoritmo scoring v1.0 funcional
- WhatsApp alertas automáticas
- Valoración reforma con IA (GPT-5 Vision)

---

### 📈 Q2-Q3 2025: Product-Market Fit

**Objetivo**: 200 suscriptores, 20 compradores, 8-10 reformas

**Features**:
- Dashboard cliente (ver historial matches)
- Algoritmo scoring v2.0 con ML (aprende de favoritos)
- App móvil (iOS + Android)
- Onboarding automatizado (self-service)

**Team**: Contratar 1 backend dev, 1 arquitecto junior

---

### 🚀 Q4 2025 - Q1 2026: Escala Controlada

**Objetivo**: 400 suscriptores, 40 compradores, 16-20 reformas

**Features**:
- Expansión a Barcelona (ya tenemos Madrid)
- Chatbot WhatsApp (respuestas automáticas FAQ)
- Panel de control reformas (cliente ve avance obra en tiempo real)
- Marketplace de materiales (descuentos por volumen)

**Team**: +1 growth marketer, +1 arquitecto, +1 PM

---

## Slide 14: La Pregunta (Ask)

### 💼 Inversión: €100,000 (Pre-Seed)

**Uso de Fondos** (12 meses):

```
💰 Salarios founders         €40K  (40%)  ████████░░
   → €20K/cada uno (subsistencia)

📢 Marketing & Growth        €30K  (30%)  ███████░░░
   → Ads, SEO, herramientas

🔧 Tech & Producto           €20K  (20%)  █████░░░░░
   → Freelancers, infra, APIs

📋 Operaciones               €10K  (10%)  ██░░░░░░░░
   → Legal, contabilidad, seguros
```

---

### 📊 Hitos con Esta Inversión (12 meses)

- ✅ 300-400 suscriptores activos
- ✅ 30-40 compradores
- ✅ 12-18 reformas ejecutadas
- ✅ €108-162K margen generado (recuperan inversión)
- ✅ Product-market fit validado
- ✅ Runway para crecer sin más inversión (bootstrapped después)

---

### 💎 Términos

- **Valoración pre-money**: €500-700K (negociable)
- **Equity ofrecida**: 12-15%
- **Tipo**: SAFE o equity directa
- **Milestone para Serie A** (18-24 meses): 1,000 suscriptores + 60 reformas/año

---

## Slide 15: Por Qué Ahora (Timing Perfecto)

### ⏰ 3 Tendencias Convergentes

**1. WhatsApp = Canal Dominante**
- 90% penetración en España (vs 40% email)
- Gen Z/Millennials (70% futuros compradores): 95% prefieren mensajería

**2. IA Visual Madura**
- GPT-5 Vision sale 2024 → Valoraciones reformas precisas ahora posibles
- Hace 2 años esto no era viable

**3. Digitalización Post-COVID**
- 2020: 10% compradores buscan online  
- 2024: 85% buscan online primero  
- Disposición a pagar por herramientas digitales x5

**Window of Opportunity**: 12-18 meses antes de que grandes players (Idealista) lancen algo similar

---

## Slide 16: Exit Strategy (Horizonte 5 Años)

### 🚪 Escenarios de Salida

**Opción 1: Adquisición Estratégica** (Más Probable)

**Compradores potenciales**:
- **Portales**: Idealista, Fotocasa (añaden servicio reformas)
- **Proptech**: Spotahome, Housfy (vertical integration)
- **Estudios grandes**: Tarimas, Grupo Sto (canal de captación)

**Valuación esperada**: 4-6x revenue  
**Timeline**: Año 4-5 (cuando tengamos €2-3M revenue)

---

**Opción 2: Escala Independiente**

- Serie A (€1-2M) en Año 2
- Expansión nacional (Top 10 ciudades)
- Exit mayor en 5-7 años (€15-25M)

---

**Opción 3: Bootstrapped + Dividendos**

- No levantar más tras pre-seed
- Crecer orgánicamente con margen reformas
- Distribuir dividendos desde Año 3
- ROI inversores: 3-5x en 4 años vía dividendos

---

## Slide 17: Riesgos Principales

### ⚠️ Top 3 Riesgos

**1. Conversión suscriptor → comprador baja (<5%)**

**Mitigación**:
- Expandir a más ciudades (más oferta)
- Bajar umbral notificaciones (score >60 vs >70)
- Añadir asesoría de compra hands-on (Premium)

---

**2. Estudio muere de éxito (demasiados leads)**

**Mitigación**:
- **Contratar ANTES de necesitar** (hiring anticipado)
- Subir precios (reducir demanda)
- Waitlist transparente
- Partnership con otros estudios (referir overflow)

---

**3. IA valoraciones erróneas (±30% vs real)**

**Mitigación**:
- Disclaimer: "Valoración orientativa"
- Arquitecto revisa siempre antes de enviar
- Solo enviar si IA >80% confianza
- Entrenar con datos reales (mejora continua)

---

## Slide 18: Contacto

```
╔════════════════════════════════════════════════════╗
║                                                    ║
║         ¿Listo para Revolucionar                   ║
║      la Compra + Reforma de Viviendas?             ║
║                                                    ║
║             📧 [tu-email@inmofinder.com]           ║
║             📱 [+34 XXX XXX XXX]                   ║
║             💼 [linkedin.com/in/tu-perfil]         ║
║             🌐 www.inmofinder.com                  ║
║                                                    ║
║                                                    ║
║          📅 Agendar Reunión (30 min):             ║
║          [calendly.com/inmofinder-founders]       ║
║                                                    ║
║                                                    ║
║         Próxima ronda: Q1 2025 (€100K)            ║
║              Respuesta en 48h                      ║
║                                                    ║
╚════════════════════════════════════════════════════╝
```

---

## Apéndice: FAQs Inversores

**P: ¿Por qué no levantar más (€250K, €500K)?**  
R: No lo necesitamos. Con €100K validamos PMF en 12 meses. Si funciona, levantamos Serie A con mejores términos.

**P: ¿Qué pasa si mercado inmobiliario cae?**  
R: Reformas son contra-cíclicas. Si mercado cae, la gente reforma en vez de mudarse (más barato).

**P: ¿Por qué no solo reformas sin suscripción?**  
R: Canal de captación sería frío (5% conversión). Con suscripción tenemos relación previa (50% conversión).

**P: ¿Competencia de Idealista/Fotocasa?**  
R: Son lentos (organizaciones grandes). Tenemos 12-18 meses de ventaja. Además, su modelo es ads, no reformas.

**P: ¿Escalabilidad limitada por arquitectos?**  
R: Sí, pero es un "problema bueno". Podemos elegir proyectos más rentables. A escala, abrimos franquicia a otros estudios.

---

*Presentación actualizada: Diciembre 2024*  
*Versión 2.0 para inversores pre-seed*
