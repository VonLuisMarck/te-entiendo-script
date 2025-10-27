# 📊 Business Case - InmoFinder (Modelo B2C + Reformas)

## Executive Summary

**InmoFinder** es una plataforma B2C de suscripción que acompaña a compradores desde la búsqueda del piso hasta su reforma integral. El verdadero modelo de negocio no son las suscripciones (€9.99-19.99/mes), sino la **captación de leads cualificados para reformas** del estudio de arquitectura asociado.

### El Insight Clave

**80% de compradores necesitan reforma**, pero solo 10-15% tienen arquitecto de confianza. InmoFinder les acompaña desde el minuto 1, creando una relación de confianza que culmina en la contratación de la reforma.

### Propuesta de Valor Real

**Para Compradores**:
- 🔍 Encontrar su piso ideal (scoring inteligente + alertas WhatsApp)
- 💰 Análisis de mercado (saber si el precio es bueno)
- 🏗️ Valoración gratuita de reforma con IA (tras compra)
- 🎨 Acompañamiento completo hasta entrar a vivir

**Para InmoFinder + Estudio**:
- 📈 Suscripciones: Revenue predecible pero bajo (~€100-200/cliente)
- 💰 Reformas: Revenue real (~€8-15K margen por reforma ejecutada)
- 🎯 Lead qualification automático (IA detecta reformas rentables)

---

## 🎯 El Problema Real

### Búsqueda de Piso (Pain Point Actual)
- 15-20 horas/semana revisando portales manualmente
- Propiedades perfectas se pierden por detección tardía
- No saben si el precio es competitivo vs mercado

### Post-Compra (Oportunidad No Explotada)
- 80% necesitan reforma pero no saben por dónde empezar
- Desconfianza de estudios de arquitectura (precios opacos)
- Miedo a presupuestos inflados
- No saben cuánto debería costar realmente

**La brecha**: Nadie les acompaña en el journey completo (búsqueda → compra → reforma)

---

## ✅ La Solución: Journey Completo

### Fase 1: Búsqueda (Suscripción €9.99-19.99/mes)
```
Cliente configura criterios → InmoFinder scraping 24/7 
→ Algoritmo scoring → Alertas WhatsApp solo matches >70
→ Cliente encuentra piso (2-4 meses)
```

**Beneficio cliente**: Ahorra 15h/semana + Ve oportunidades antes que nadie  
**Beneficio InmoFinder**: Relación de confianza + Datos del cliente

### Fase 2: Compra (Gratuito, valor añadido)
- Análisis de mercado: ¿Es buen precio? (percentiles barrio)
- Proyección de revalorización (tendencias zona)
- Recomendaciones de negociación

**Beneficio cliente**: Toma decisión informada  
**Beneficio InmoFinder**: Cliente percibe alto valor

### Fase 3: Post-Compra (Lead Generation para Reformas)
**Timing: 7-14 días tras firma escrituras**

```
Cliente recibe WhatsApp: 
"¡Enhorabuena por tu piso! 🎉 
¿Te gustaría una valoración gratuita de reforma? 
Analizamos fotos con IA en 24h. Sin compromiso"

    ↓ 60% acepta valoración
    
Cliente sube 10-15 fotos del piso
    ↓
IA (GPT-5 Vision) analiza y estima coste reforma
    ↓
Informe automatizado:
- Coste estimado: €25-32K
- Desglose (cocina, baños, suelos, etc.)
- Comparativa con precios mercado
- ROI potencial (valor post-reforma)
    ↓
Llamada arquitecto (si reforma rentable para ambas partes)
    ↓ 50% de valoraciones → Contratación
    
Reforma ejecutada por estudio asociado
```

**Beneficio cliente**: Transparencia + Precio justo + Confianza  
**Beneficio Estudio**: Leads pre-cualificados + Alta conversión (vs 5% mercado)

---

## 💡 Innovación: IA de Valoración de Reformas

### ¿Por Qué IA?

**Problema**: Arquitectos tardan 3-5 días en visitar + presupuestar → Cliente se impacienta o contrata a otro

**Solución IA**: Valoración en 24h solo con fotos → Cliente ve precio transparente inmediatamente

### Cómo Funciona (Edge Function GPT-5 Vision)

**Input**: 10-15 fotos del piso (cocina, baños, salón, dormitorios)

**Procesamiento**:
```typescript
Prompt especializado de arquitectura:
"Analiza estas fotos y estima coste de reforma integral.
Criterios:
- Cocina: Mobiliario + electrodomésticos (€8-12K)
- Baños: 1 baño (€6-8K), 2 baños (€12-16K)  
- Suelos: Tarima 80m² (€4-6K)
- Pintura: Paredes + techos (€2-3K)
- Electricidad/Fontanería (€2-5K)

Devuelve JSON con:
- Coste min/max
- Desglose por partidas
- Nivel urgencia (alto/medio/bajo)
- Observaciones clave"
```

**Output**: PDF personalizado con:
- Estimación: €28,000-34,000
- Desglose transparente
- Fotos anotadas (qué hay que cambiar)
- Timeline aproximado (8-10 semanas)

**Decisión interna** (algoritmo filtra):
```typescript
// Cálculo de rentabilidad para AMBAS partes
const margenEstudio = precioCliente - costeReal; // Ej: €35K - €25K = €10K
const margenPorcentaje = 40%; // Objetivo: 35-45%

const inversionCliente = precioCompra + reforma; // €200K + €35K = €235K
const valorPostReforma = 280000; // IA predice según mercado
const roiCliente = ((280K - 235K) / 235K) * 100; // 19%

// SOLO OFERTAR SI:
if (margenEstudio >= €8K && roiCliente >= 12%) {
  return "CONTACTAR"; // ✅ Win-win
} else {
  return "DECLINAR_EDUCADAMENTE"; // ❌ No rentable
}
```

**Ventaja competitiva**: Solo ofertamos reformas donde **cliente Y estudio ganan**. Esto genera:
- Alta satisfacción cliente (ROI real post-reforma)
- Margen saludable estudio (no aceptamos cualquier trabajo)
- Reputación de honestidad (declinamos proyectos poco rentables)

---

## 👥 Estructura de Equipo (Crecimiento Realista)

### Año 1: Founders + Freelancers (2 personas)

**InmoFinder (Tech)**:
- **Founder Tech/Producto** (tú): Producto + IT + Growth
  - 60% producto (features, UX)
  - 30% marketing (ads, SEO, growth hacks)
  - 10% operaciones

**Estudio Arquitectura**:
- **Founder Arquitecto** (socio): Reformas + Ventas
  - 70% ejecución reformas (gestión obras)
  - 20% ventas (cerrar leads de InmoFinder)
  - 10% estrategia

**Freelancers/Externos**:
- 1 Developer part-time (mantenimiento scraper, bugs)
- 1 Arquitecto técnico freelance (mediciones, pliegos)
- Subcontratas reformas (fontaneros, electricistas, pintores)

**Headcount**: 2 FTE + 3 freelancers

---

### Año 2: Primeras Contrataciones (5-6 personas)

**InmoFinder crece a 3 personas**:
- Founder Tech (tú)
- **+ Backend Developer** (scraping avanzado, algoritmo ML)
  - Perfil: Python + Scrapy + ML basics
  - Salario: €35-45K/año
  - Timing: Contratar cuando tengamos 200+ suscriptores
  
- **+ Growth Marketer / Inside Sales**
  - Perfil: Ads (Google, Meta) + Email marketing + A/B testing
  - Salario: €28-35K/año + comisión por suscripciones
  - Timing: Cuando CAC suba (ads menos eficientes)

**Estudio crece a 3 personas**:
- Founder Arquitecto (socio)
- **+ Arquitecto Junior** (proyectos + dirección obra)
  - Perfil: Colegiado, 2-3 años experiencia, proactivo
  - Salario: €30-38K/año
  - Timing: Cuando tengamos 2-3 reformas simultáneas (no dar abasto)
  
- **+ Project Manager / Customer Success**
  - Perfil: Organizado, trato con cliente, seguimiento obras
  - Salario: €28-32K/año
  - Timing: Mismo momento que arquitecto junior

**Headcount**: 6 FTE + 2-3 freelancers

---

### Año 3: Equipo Consolidado (10-12 personas)

**InmoFinder crece a 6 personas**:
- Founder Tech (tú) → Pasa a CEO/Producto
- Backend Developer (senior ya)
- **+ Frontend Developer** (mejorar UX, dashboard clientes)
  - Perfil: React + TypeScript, diseño
  - Salario: €35-45K/año
  
- Growth Marketer
- **+ Content Creator / Community Manager**
  - Perfil: Creación contenido (TikTok, Instagram), inmobiliario
  - Salario: €25-30K/año
  
- **+ Data Analyst / BI**
  - Perfil: SQL + Looker/Metabase, análisis funnel
  - Salario: €35-40K/año
  - Timing: Cuando tengamos 1000+ usuarios (mucho dato que analizar)

**Estudio crece a 6 personas**:
- Founder Arquitecto → Pasa a Director Técnico
- Arquitecto Junior → Arquitecto Senior (3 años experiencia ya)
- **+ Arquitecto Junior #2** (para nuevos proyectos)
  - Salario: €30-38K/año
  
- Project Manager
- **+ Interiorista / Diseñador**
  - Perfil: Renders, selección materiales, decoración
  - Salario: €28-35K/año
  - Timing: Cuando clientes pidan más nivel de diseño
  
- **+ Administrativo / Contabilidad**
  - Perfil: Facturación, proveedores, cobros/pagos
  - Salario: €24-28K/año

**Headcount**: 12 FTE + 4-5 subcontratas fijas (fontanero, electricista, etc.)

---

### Año 4+: Escala (20+ personas)

**InmoFinder**:
- Equipo Tech: 8-10 personas (backend, frontend, mobile app, DevOps)
- Equipo Growth: 4-5 personas (ads, SEO, content, partnerships)
- Equipo Operaciones: 2-3 personas (CS, admin, legal)

**Estudio Arquitectura**:
- Equipo Técnico: 6-8 arquitectos + 2-3 aparejadores
- Equipo Ejecución: 4-5 project managers
- Equipo Subcontratas: 10-15 profesionales fijos (carpinteros, electricistas, fontaneros, pintores)

**Total**: 35-40 personas

---

## 📊 Métricas Clave (Sin Revenue Inflado)

### North Star Metric
**Reformas ejecutadas/mes** (no suscriptores, no MRR)

Porque:
- 1 reforma = €8-15K margen estudio
- Suscripciones son vanity metric (cliente cancela tras 3 meses)
- Lo que importa es convertir suscriptores → compradores → reformas

### Funnel Real (Conservador)

```
1,000 usuarios registrados (gratuitos)
    ↓ 40% conversión a pago (realista)
400 suscriptores activos
    ↓ 10% compran piso en 3 meses (conservador)
40 compradores/año
    ↓ 60% acepta valoración reforma
24 valoraciones
    ↓ 50% contrata reforma
12 reformas ejecutadas/año

Ticket medio reforma: €30,000 (al cliente)
Coste real: €21,000 (material + subcontratas)
Margen estudio: €9,000/reforma
    
12 reformas × €9K = €108K margen anual
```

**Esto es Año 1**. Sin escalar, sin inversión, solo founders trabajando.

### KPIs por Fase

**Fase Búsqueda**:
- Suscriptores activos (meta: 400 Año 1, 1000 Año 2)
- Churn mensual (<10% aceptable, es producto temporal)
- NPS (>8/10 mínimo)

**Fase Compra**:
- % suscriptores que compran (10-15% en 6 meses)
- Tiempo medio hasta compra (2-4 meses)

**Fase Reforma**:
- % compradores que aceptan valoración (>60%)
- % valoraciones que contratan (>40%)
- Margen medio por reforma (€8-12K)
- NPS post-reforma (>9/10 crítico para referidos)

**Fase Crecimiento**:
- CAC (Customer Acquisition Cost): <€50 Año 1
- LTV (Lifetime Value): €100 suscripción + €3,600 reforma promedio (40% × €9K) = **€3,700**
- LTV/CAC: >70x (brutal, incluso pagando €200/cliente sigue siendo 18x)

---

## 🎯 Go-to-Market (Realista)

### Fase 1: Validación Manual (Meses 1-3)

**Objetivo**: Validar que el modelo funciona con 10-20 usuarios reales

**Acciones**:
1. **Búsqueda activa de beta testers**:
   - LinkedIn: Posts en grupos inmobiliarios
   - Amigos/familia que busquen piso
   - Grupos Facebook de barrios (ej. "Chamberí", "Malasaña")
   
2. **Oferta beta**: Gratis 3 meses a cambio de feedback semanal

3. **Onboarding 1:1**: Videollamada 30 min con cada usuario
   - Entender bien sus criterios
   - Configurar alertas personalizadas
   - Crear relación de confianza

4. **Seguimiento manual**: WhatsApp directo (aún no automatizado 100%)

**Success criteria**:
- 10 usuarios activos
- 2-3 compraron piso (10-30% conversión OK en beta)
- 1-2 contrataron reforma
- NPS >8/10

**Coste**: €0 (solo tiempo founders)

---

### Fase 2: Product-Market Fit (Meses 4-12)

**Objetivo**: Llegar a 200-400 suscriptores de pago

**Canales**:
1. **Organic (80% esfuerzo inicial)**:
   - SEO: "pisos baratos chamberí", "mejor barrio madrid comprar"
   - Content: Blog con guías (ej. "Cómo saber si un piso es buena inversión")
   - YouTube: Vídeos tipo "Visitamos 5 pisos en Madrid y analizamos si son buena compra"
   - Instagram/TikTok: Clips cortos de propiedades + análisis
   
2. **Paid (20% presupuesto pequeño)**:
   - Google Ads: Keywords long-tail ("comprar piso chamberi 200k")
   - Meta Ads: Lookalike audiences de beta testers
   - Presupuesto: €500-1,000/mes (conservador)

3. **Referral Program**:
   - Usuario refiere amigo → Ambos 1 mes gratis
   - Usuario compra piso + hace reforma → 500€ descuento si refiere cliente

**Pricing**:
- Plan Básico: €9.99/mes (90% de usuarios)
- Plan Premium: €19.99/mes (10% de usuarios, incluye llamadas con asesor)

**Success criteria**:
- 300 suscriptores activos (€3,500 MRR)
- 30 compradores
- 10-15 reformas ejecutadas
- CAC <€40
- Churn <8% mensual

**Coste**: €10-15K (ads + herramientas + freelancers)

---

### Fase 3: Escala Controlada (Año 2-3)

**Objetivo**: Escalar sin perder calidad (bottleneck = capacidad del estudio)

**Restricción crítica**: **No podemos hacer 50 reformas/año** con 2 arquitectos
- 1 reforma = 2-3 meses de trabajo (diseño + dirección obra)
- 2 arquitectos × 4 reformas/año = **8 reformas max/año** (capacidad)

**Por tanto, el crecimiento DEBE ser**:
1. Contratar arquitectos ANTES de escalar suscriptores
2. Rechazar reformas poco rentables (IA filtra)
3. Subir precios si demand > supply (pricing power)

**Estrategia**:
- Año 2: Contratar 1 arquitecto junior → Capacidad 12 reformas/año
- Año 3: Contratar 2 arquitectos más → Capacidad 20 reformas/año

**Canales de escala**:
- Partnerships con inmobiliarias (comisión por referir compradores)
- Influencers inmobiliarios (colaboraciones)
- Eventos presenciales (charlas en barrios sobre "Cómo comprar bien")

---

## 💰 Inversión Requerida (Realista)

### Opción A: Bootstrapped (Sin inversión externa)

**Ventaja**: Mantenéis 100% equity

**Modelo**:
- Founders no cobran sueldo Año 1 (viven de ahorros)
- Reinvierten 100% margen reformas en marketing
- Crecimiento lento pero sostenible

**Timeline**:
- Año 1: 10-15 reformas (€90-135K margen) → Reinvertir en ads
- Año 2: 20-25 reformas (€180-225K margen) → Contratar 1-2 personas
- Año 3: Rentables + Equipo de 8-10 personas

**Riesgo**: Lento, competidores pueden adelantar

---

### Opción B: Ronda Pre-Seed €80-120K (Recomendado)

**Por qué no más**: No necesitáis levantar €250K todavía

**Uso de fondos** (12 meses):

| Partida | Monto | % | Justificación |
|---------|-------|---|---------------|
| **Salarios founders** | €40K | 40% | €20K/cada uno (subsistencia 1 año) |
| **Marketing** | €30K | 30% | Ads + SEO + herramientas (€2.5K/mes) |
| **Tech** | €20K | 20% | Freelancers, infra, APIs |
| **Operaciones** | €10K | 10% | Legal, contabilidad, seguros |
| **Total** | **€100K** | | |

**Equity ofrecida**: 10-15% (valoración pre-money €500-700K)

**Hitos con esta inversión**:
- 300+ suscriptores activos
- 30+ compradores
- 12-18 reformas ejecutadas
- €108-162K margen (recuperan inversión)
- Product-market fit validado
- Listos para crecer sin dinero externo (bootstrapped de ahí en adelante)

**Perfil inversor ideal**:
- Business angel sector inmobiliario/proptech
- Pequeños fondos pre-seed (Demium, Plug and Play España)
- Family offices con portfolio inmobiliario

---

## 🔮 Riesgos y Mitigación

### Riesgo 1: Bajas conversiones búsqueda → compra

**Impacto**: Alto (sin compradores, no hay reformas)

**Probabilidad**: Media (depende de mercado inmobiliario)

**Mitigación**:
- Expandir a más ciudades (Madrid + Barcelona + Valencia)
- Bajar umbral de notificación (score >60 en vez de >70)
- Ofrecer asesoría de compra más hands-on (Premium €19.99)

---

### Riesgo 2: Estudio muere de éxito (demasiados leads)

**Impacto**: Alto (perder clientes por no dar abasto)

**Probabilidad**: Media-Alta (si marketing funciona bien)

**Mitigación**:
- **Contratar ANTES de necesitar** (arquitecto junior cuando tengamos 15 valoraciones/mes)
- Subir precios (reducir demanda naturalmente)
- Waitlist transparente ("Estamos a tope, te avisamos en 2 semanas")
- Partnership con otros estudios (comisión por referir overflow)

---

### Riesgo 3: IA da valoraciones muy erróneas

**Impacto**: Alto (pérdida de confianza cliente)

**Probabilidad**: Baja-Media (GPT-5 Vision es bueno pero no perfecto)

**Mitigación**:
- Disclaimer claro: "Valoración orientativa, presupuesto final tras visita"
- Arquitecto revisa SIEMPRE la valoración IA antes de enviar
- Solo enviar valoración si IA tiene >80% confianza
- Mejorar prompt con datos reales (entrenar con reformas pasadas)

---

### Riesgo 4: Scraping bloqueado por portales

**Impacto**: Crítico (producto deja de funcionar)

**Probabilidad**: Media (portales odian scrapers)

**Mitigación**:
- IPs rotativas + proxies residenciales (ya implementado)
- User-Agents aleatorios (ya implementado)
- **Plan B**: Partnership directo con portales (compartimos datos de demanda)
- **Plan C**: API oficial Idealista (pagar €X/mes, más caro pero legal)

---

### Riesgo 5: Competidor copia el modelo

**Impacto**: Medio (ventaja first-mover se reduce)

**Probabilidad**: Alta (modelo es replicable)

**Mitigación**:
- **Speed to market**: Ejecutar rápido (6-12 meses ventaja)
- **Patente algoritmo** scoring (ya en proceso)
- **Network effects**: Más datos históricos → Mejor matching → Más usuarios
- **Reputación**: Primeros 100 clientes satisfechos = reviews orgánicas (difícil copiar)

---

## 📞 Próximos Pasos (90 Días)

### Mes 1: Validación Manual

- [ ] Encontrar 10 beta testers (LinkedIn + amigos)
- [ ] Onboarding 1:1 con cada uno
- [ ] Configurar alertas personalizadas
- [ ] 1 usuario debe encontrar un piso que le guste

### Mes 2: Primeras Conversiones

- [ ] 3-5 beta testers deben ver propiedades en persona
- [ ] 1-2 deben hacer oferta de compra
- [ ] Recopilar feedback semanal (¿qué falta? ¿qué sobra?)
- [ ] Iterar algoritmo scoring según feedback

### Mes 3: Primera Reforma

- [ ] 1 beta tester debe comprar piso
- [ ] Enviar valoración reforma con IA (manual por ahora)
- [ ] Cerrar primera reforma
- [ ] Documentar proceso completo (para escalar)
- [ ] Calcular métricas reales: CAC, conversión, margen

**Success criteria a 90 días**:
- 15 beta testers activos
- 2 compraron piso
- 1 reforma en ejecución
- NPS >8/10
- Founders convencidos de que el modelo funciona

---

## 📎 Anexos

**Anexo A**: Documentación técnica algoritmo scoring  
**Anexo B**: Edge Function análisis fotos con IA  
**Anexo C**: Plantillas WhatsApp (alertas, valoración reforma)  
**Anexo D**: Roadmap producto 18 meses  
**Anexo E**: Análisis competencia proptech  

---

**Contacto**:  
📧 Email: [tu-email]  
📱 WhatsApp: [tu-telefono]  
💼 LinkedIn: [tu-perfil]

---

*Última actualización: Diciembre 2024*  
*Versión 2.0 - Modelo B2C + Reformas*
