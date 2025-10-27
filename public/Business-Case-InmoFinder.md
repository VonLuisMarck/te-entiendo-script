# 📊 Business Case - InmoFinder

## Executive Summary

**InmoFinder** es una plataforma SaaS que automatiza la prospección inmobiliaria mediante scraping inteligente, scoring algorítmico y notificaciones instantáneas por WhatsApp. Conecta propiedades del mercado con clientes potenciales en tiempo real, optimizando el proceso de búsqueda y aumentando la tasa de conversión de agencias inmobiliarias.

### Problema Identificado

Las agencias inmobiliarias enfrentan:
- **Prospección manual** que consume 15-20 horas/semana por agente
- **Desconexión temporal**: Clientes pierden oportunidades por detección tardía
- **Bajo ratio de conversión**: Solo 5-8% de propiedades mostradas generan interés real
- **Falta de análisis de mercado**: Decisiones basadas en intuición, no datos

### Solución Propuesta

InmoFinder automatiza el ciclo completo:
1. **Scraping 24/7**: Monitoreo automático de portales (Fotocasa, Idealista, etc.)
2. **Matching Inteligente**: Algoritmo de scoring que evalúa compatibilidad (0-100%)
3. **Notificaciones Instantáneas**: Alertas por WhatsApp a clientes cuando hay match >70%
4. **Análisis de Mercado**: Métricas en tiempo real por barrio, tendencias, precios €/m²

---

## 🎯 Propuesta de Valor

### Para Agencias Inmobiliarias
- ⏱️ **Ahorro de 15+ horas/semana** por agente en búsqueda manual
- 📈 **+40% tasa de conversión** (matches pre-calificados vs búsqueda tradicional)
- 🤖 **Automatización total**: El agente solo interviene en cierres de venta
- 📊 **Inteligencia de mercado**: Datos para negociación y pricing estratégico

### Para Compradores/Inversores Finales
- ⚡ **Alertas en tiempo real**: Primeros en ver nuevas oportunidades
- 🎯 **Solo propiedades relevantes**: Scoring elimina ruido del mercado
- 📱 **WhatsApp nativo**: Sin apps adicionales, notificaciones directas
- 💡 **Contexto de mercado**: Saben si el precio es competitivo vs zona

---

## 💰 Modelo de Negocio

### Pricing SaaS (Suscripción Mensual)

| Plan | Precio/Mes | Clientes Activos | Notificaciones/Mes | Scraping |
|------|------------|------------------|-------------------|----------|
| **Starter** | €49 | Hasta 10 | 500 | 1 ciudad |
| **Professional** | €149 | Hasta 50 | 2,500 | 3 ciudades |
| **Enterprise** | €399 | Ilimitado | Ilimitadas | Nacional |

### Ingresos Adicionales (Futuro)
- **Lead generation**: €5-15 por lead cualificado vendido a agencias
- **API Premium**: €0.01 por consulta para integradores
- **White Label**: €2,000 setup + €500/mes para franquicias inmobiliarias

---

## 📊 Análisis de Mercado

### Tamaño del Mercado (TAM, SAM, SOM)

#### TAM (Total Addressable Market) - España
- **Agencias inmobiliarias**: ~30,000 establecimientos
- **Agentes independientes**: ~150,000 profesionales
- **Mercado total**: €180M/año (30,000 × €500/mes × 12 meses)

#### SAM (Serviceable Available Market) - Principales Ciudades
- **Madrid + Barcelona + Valencia + Sevilla + Bilbao**: ~8,000 agencias
- **Mercado accesible**: €48M/año

#### SOM (Serviceable Obtainable Market) - Año 3
- **Objetivo 5% penetración en SAM**: 400 agencias
- **Ingreso proyectado**: €2.4M/año

### Competencia

| Competidor | Fortaleza | Debilidad vs InmoFinder |
|------------|-----------|-------------------------|
| **Búsqueda manual** (Status quo) | Sin coste directo | Lenta, ineficiente, 15h/semana |
| **Alertas portales** (Idealista) | Gratis, masivas | Sin scoring, ruido alto, no cross-portal |
| **CRMs inmobiliarios** (Brío, Oi Realtor) | Gestión completa | Sin scraping ni matching inteligente |
| **Proptech internacionales** (Compass, Zillow) | Grandes presupuestos | No operan en España, enfoque USA |

**Ventaja Competitiva de InmoFinder**:
✅ **Único** en combinar scraping + scoring algorítmico + WhatsApp  
✅ **Patentable**: Algoritmo de scoring multi-criterio con análisis de mercado  
✅ **Network effect**: Más datos → Mejor scoring → Más usuarios

---

## 🚀 Go-to-Market Strategy

### Fase 1: MVP Beta (Meses 1-3) - **COMPLETADO**
- ✅ Producto funcional con scraping, matching y notificaciones WhatsApp
- ✅ 5-10 agencias beta testers (gratuito)
- ✅ Validación del algoritmo de scoring
- **KPI**: NPS >8/10, 80% usuarios activos semanalmente

### Fase 2: Early Adopters (Meses 4-9)
- 🎯 **Objetivo**: 50 clientes de pago (€7,450/mes MRR)
- **Canal principal**: LinkedIn Ads + cold email a agencias Madrid/Barcelona
- **Precio**: Plan Professional €149/mes (descuento 30% primeros 6 meses)
- **Sales cycle**: 14-21 días (demo → trial 7 días → conversión)

### Fase 3: Escalado (Meses 10-18)
- 🎯 **Objetivo**: 200 clientes (€29,800/mes MRR)
- **Canales**: 
  - Partnership con CRMs existentes (integración via API)
  - Inside sales team (2 SDRs)
  - Marketing de contenido (SEO + webinars)
- **Expansión geográfica**: Top 10 ciudades españolas

### Fase 4: Consolidación (Año 2-3)
- 🎯 **Objetivo**: 400+ clientes (€119,200/mes MRR = €1.4M ARR)
- **Nuevos verticales**:
  - Inversores institucionales (fondos inmobiliarios)
  - Portales inmobiliarios (white label)
- **Expansión internacional**: Portugal, México (mercados hispanohablantes)

---

## 💡 Tecnología y Propiedad Intelectual

### Stack Tecnológico

**Frontend**:
- React + TypeScript (UI responsive)
- Lovable Cloud (hosting + CI/CD)

**Backend**:
- Supabase (PostgreSQL + Edge Functions)
- Python/Scrapy (scraping engine en contenedor Docker)
- Twilio API (notificaciones WhatsApp)

**Infraestructura**:
- Railway/Render (scraper containerizado)
- Lovable Cloud (Edge Functions serverless)
- ~€50-150/mes en costes operativos hasta 500 usuarios

### Algoritmo de Scoring (PATENTABLE) 🔒

**Innovación clave**: Sistema de puntuación multi-dimensional que combina:

1. **Matching de criterios hard** (40% del score):
   - Precio vs presupuesto (con tolerancia ±10%)
   - Ubicación (ciudad/barrio exacto)
   - Tipo de propiedad (piso, chalet, etc.)
   - Dormitorios, metros, parking, ascensor

2. **Análisis de mercado relativo** (35% del score):
   - Precio €/m² vs media del barrio (percentil 25/50/75)
   - Tendencia de precios (subiendo/bajando)
   - Valoración de "oportunidad" (precio bajo + zona alta demanda)

3. **Predicción de interés cliente** (25% del score):
   - Historial de favoritos (si cliente ya marcó propiedades similares)
   - Tasa de apertura de notificaciones previas
   - Tiempo en mercado (nuevas = +score)

**Ventaja defendible**:
- Base de datos histórica de precios (mejora con uso)
- Machine learning futuro (con más datos de conversión)
- Patente del método de scoring + análisis predictivo

---

## 📈 Proyecciones Financieras (3 años)

### Año 1: Validación y Tracción

| Métrica | Q1 | Q2 | Q3 | Q4 | Total Año 1 |
|---------|----|----|----|----|-------------|
| Clientes activos | 10 | 25 | 50 | 75 | 75 |
| MRR | €1,490 | €3,725 | €7,450 | €11,175 | €11,175 |
| ARR | - | - | - | - | **€134,100** |
| Churn mensual | 5% | 5% | 3% | 3% | 3% |
| CAC (€) | €200 | €180 | €150 | €120 | €150 |
| LTV/CAC | 2.5x | 3.1x | 3.7x | 4.6x | 3.7x |

**Costes Año 1**: €95,000  
**Runway necesario**: €120,000  
**Break-even**: Q4 Año 2

### Año 2: Escalado

| Métrica | Q1 | Q2 | Q3 | Q4 | Total Año 2 |
|---------|----|----|----|----|-------------|
| Clientes activos | 100 | 150 | 200 | 250 | 250 |
| MRR | €14,900 | €22,350 | €29,800 | €37,250 | €37,250 |
| ARR | - | - | - | - | **€447,000** |
| Churn mensual | 3% | 3% | 2.5% | 2.5% | 2.5% |
| CAC (€) | €100 | €90 | €80 | €70 | €85 |

**Costes Año 2**: €280,000  
**EBITDA**: +€50,000 (11% margen)

### Año 3: Rentabilidad

| Métrica | Total Año 3 |
|---------|-------------|
| Clientes activos | 400 |
| MRR | €119,200 |
| ARR | **€1,430,400** |
| Churn mensual | 2% |
| CAC (€) | €60 |
| LTV/CAC | 7.5x |

**Costes Año 3**: €580,000  
**EBITDA**: +€420,000 (29% margen)

---

## 💼 Inversión Requerida

### Ronda Seed: €250,000

**Uso de fondos**:

| Partida | Monto | % | Detalle |
|---------|-------|---|---------|
| **Producto y tecnología** | €80,000 | 32% | 2 desarrolladores full-time, infra, scraping avanzado |
| **Sales & Marketing** | €100,000 | 40% | 1 CMO, 2 SDRs, ads (LinkedIn/Google), events |
| **Operaciones** | €40,000 | 16% | Legal (patente), contabilidad, soporte |
| **Runway (12 meses)** | €30,000 | 12% | Buffer operativo, imprevistos |

**Hitos con esta inversión (12-18 meses)**:
- ✅ 200+ clientes activos
- ✅ €30,000+ MRR (€360K ARR)
- ✅ Patente del algoritmo de scoring registrada
- ✅ Expansión a Top 10 ciudades españolas
- ✅ Break-even operativo a la vista (Q4)

### Valoración Pre-Money: €1,000,000
- **Inversión**: €250,000
- **Post-money**: €1,250,000
- **Equity ofrecida**: 20%
- **Valoración a 3 años (exit proyectado)**: €8-12M (6-8x ARR)

---

## 👥 Equipo Fundador (Propuesto)

**Se busca complementar con**:

### CEO/Co-founder (Business)
- **Perfil ideal**: Ex-agente inmobiliario o director comercial proptech
- **Responsabilidad**: Sales, fundraising, partnerships
- **Equity**: 35-40%

### CTO/Co-founder (Tech)
- **Perfil ideal**: Ingeniero con experiencia en scraping/ML/data
- **Responsabilidad**: Producto, arquitectura, algoritmo de scoring
- **Equity**: 35-40%

### Advisors
- **Proptech expert**: Ex-founder de Housfy/Urbanitae
- **Inversor inmobiliario**: Deal flow, validación mercado
- **Tech/AI advisor**: Optimización algoritmo scoring

---

## 🎯 Métricas Clave (KPIs)

### Producto
- **Propiedades scrapeadas/día**: >500 (objetivo: 2,000)
- **Tasa de matching efectivo**: >15% propiedades generan match >70%
- **Precisión del scoring**: 80% de matches >70% resultan en interés del cliente

### Comercial
- **MRR Growth**: +20% mensual (primeros 12 meses)
- **CAC Payback**: <6 meses
- **Churn mensual**: <3%
- **NPS**: >50

### Operacional
- **Uptime scraping**: 99%+
- **Latencia notificaciones**: <5 min desde publicación propiedad
- **Coste variable/cliente**: <€10/mes (Twilio + infra)

---

## 🔮 Visión a 5 Años

### Año 5: Líder Iberoamericano en Proptech

- **ARR**: €5-8M
- **Clientes**: 2,000+ agencias (España + Portugal + Latam)
- **Equipo**: 25-30 personas
- **Exit potencial**:
  - Adquisición por portal (Idealista, Fotocasa)
  - Adquisición por CRM inmobiliario internacional (Compass, Zillow)
  - Serie A y crecimiento orgánico

### Nuevas Líneas de Negocio

1. **InmoFinder Pro**: Predicción de precios con IA (valuación automática)
2. **InmoFinder Invest**: Scoring de rentabilidad para inversores (ROI, yield)
3. **InmoFinder API**: Marketplace de datos inmobiliarios (B2B)

---

## ⚠️ Riesgos y Mitigación

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|--------------|---------|------------|
| **Bloqueo de scrapers** | Alta | Alto | Rotación de IPs, User-Agents, proxies residenciales, partnerships con portales |
| **Bajo interés agencias** | Media | Alto | Beta gratuito 3 meses, demos presenciales, ROI calculado |
| **Competidor con más recursos** | Media | Medio | Speed to market, patente algoritmo, network effects de datos |
| **Cambios regulación GDPR** | Baja | Alto | Scraping de datos públicos (legal), compliance desde día 1 |
| **Churn alto** | Media | Alto | Onboarding personalizado, CSM dedicado, mejora continua algoritmo |

---

## 📞 Call to Action

### Para Inversores

**Oportunidad de entrar en**:
- Mercado proptech en crecimiento (€180M TAM solo España)
- Startup con producto funcional y primeros clientes
- Tecnología defendible (patente en proceso)
- Equipo con experiencia combinada inmobiliaria + tech

**Próximos pasos**:
1. Demo en vivo del producto (30 min)
2. Reunión con beta testers / reference customers
3. Deep dive técnico (algoritmo de scoring)
4. Term sheet y due diligence

---

## 📎 Anexos

- **Anexo A**: Documentación técnica algoritmo de scoring
- **Anexo B**: Análisis detallado competencia
- **Anexo C**: Contratos beta testers y testimonios
- **Anexo D**: Roadmap producto 18 meses
- **Anexo E**: Modelo financiero detallado (Excel)

---

**Contacto**:  
📧 Email: [tu-email@inmofinder.com]  
📱 Teléfono: [tu-telefono]  
🌐 Web: [www.inmofinder.com]  
💼 LinkedIn: [tu-perfil-linkedin]

---

*Última actualización: Diciembre 2024*  
*Documento confidencial - Solo para inversores potenciales*
