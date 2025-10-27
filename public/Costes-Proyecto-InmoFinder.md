# 💰 Resumen de Costes - InmoFinder

## 📊 Desglose por Partidas

### 1. **Lovable - Plataforma de Desarrollo**

#### Plan Free (Actual)
- **Coste mensual**: €0
- **Incluye**:
  - Hosting ilimitado
  - SSL automático (HTTPS)
  - Despliegue automático
  - 500 créditos de IA/mes
  - Lovable Cloud (base de datos + funciones backend)
  - Ancho de banda estándar
  - Badge "Edit in Lovable" visible

#### Plan Pro (Recomendado para producción)
- **Coste mensual**: **$20/mes** (~€18/mes)
- **Incluye todo lo anterior más**:
  - Dominio personalizado (ej. www.inmofinder.com)
  - Sin badge de Lovable
  - Más créditos de IA
  - Soporte prioritario
  - Analytics avanzados

#### Plan Business
- **Coste mensual**: **$60/mes** (~€55/mes)
- **Para**: Equipos o mayor escala
- **Incluye**: Todo lo de Pro + más recursos

---

### 2. **Lovable Cloud (Backend)**

Incluido en cualquier plan de Lovable, **sin coste adicional** hasta ciertos límites:

#### Uso incluido (Free tier):
- **Base de datos**: 500 MB almacenamiento
- **Edge Functions**: 500,000 ejecuciones/mes
- **Autenticación**: Usuarios ilimitados
- **Storage**: 1 GB de archivos

#### Coste adicional (si excedes límites):
- **Base de datos**: ~$0.125/GB adicional
- **Edge Functions**: ~$2 por millón de ejecuciones adicionales
- **Storage**: ~$0.021/GB adicional
- **Ancho de banda**: ~$0.09/GB adicional

**Estimación realista para InmoFinder**: 
- Con 50-100 usuarios activos: **€0-5/mes** en sobrecostes
- Con 500+ usuarios activos: **€10-30/mes** en sobrecostes

---

### 3. **Twilio - Notificaciones WhatsApp**

#### Sandbox (Actual - GRATIS para testing)
- **Coste**: €0
- **Limitaciones**:
  - Solo números pre-registrados
  - Mensajes limitados
  - Para desarrollo/pruebas

#### Producción - WhatsApp Business API
- **Coste de activación**: €0 (aprobación de Twilio)
- **Coste por mensaje**:
  - **Conversaciones iniciadas por negocio**: ~€0.005-0.08/mensaje (depende del país)
  - **España**: ~€0.04/mensaje
  - **Conversaciones de servicio** (respuestas): Más baratas o gratis

**Estimación realista**:
- **100 notificaciones/mes**: ~€4/mes
- **500 notificaciones/mes**: ~€20/mes
- **1,000 notificaciones/mes**: ~€40/mes

#### Alternativa - SMS (más caro)
- **Coste por SMS en España**: ~€0.08/SMS
- No recomendado para notificaciones masivas

---

### 4. **Dominio Personalizado (Opcional)**

Si quieres usar tu propio dominio (ej. `www.inmofinder.com`):

- **Registro de dominio**: €10-15/año
- **Proveedores**: Namecheap, GoDaddy, Google Domains
- **Nota**: El hosting ya está incluido en Lovable

---

## 💡 Resumen de Costes Totales

### Escenario 1: **Testing/Beta (Actual)**
| Partida | Coste Mensual |
|---------|---------------|
| Lovable Free | €0 |
| Lovable Cloud | €0 |
| Twilio Sandbox | €0 |
| **TOTAL** | **€0/mes** |

---

### Escenario 2: **Producción - Pequeña Escala**
*50-100 usuarios, 100-200 notificaciones WhatsApp/mes*

| Partida | Coste Mensual |
|---------|---------------|
| Lovable Pro | €18/mes |
| Lovable Cloud (sobrecostes) | €0-5/mes |
| Twilio WhatsApp | €5-10/mes |
| Dominio (anual €12) | €1/mes |
| **TOTAL** | **€24-34/mes** |

---

### Escenario 3: **Producción - Escala Media**
*200-500 usuarios, 500-1000 notificaciones WhatsApp/mes*

| Partida | Coste Mensual |
|---------|---------------|
| Lovable Pro | €18/mes |
| Lovable Cloud (sobrecostes) | €10-20/mes |
| Twilio WhatsApp | €20-40/mes |
| Dominio | €1/mes |
| **TOTAL** | **€49-79/mes** |

---

### Escenario 4: **Producción - Gran Escala**
*1000+ usuarios, 2000+ notificaciones WhatsApp/mes*

| Partida | Coste Mensual |
|---------|---------------|
| Lovable Business | €55/mes |
| Lovable Cloud (sobrecostes) | €30-50/mes |
| Twilio WhatsApp | €80-120/mes |
| Dominio | €1/mes |
| **TOTAL** | **€166-226/mes** |

---

## 🎯 Recomendaciones por Fase

### Fase 1: **Beta Testing (Ahora)**
- **Plan**: Lovable Free + Twilio Sandbox
- **Coste**: €0/mes
- **Duración**: 1-3 meses
- **Objetivo**: Validar producto con usuarios reales

### Fase 2: **Lanzamiento Soft**
- **Plan**: Lovable Pro + Twilio Producción
- **Coste**: €25-35/mes
- **Duración**: 3-6 meses
- **Objetivo**: Primeros 50-100 clientes de pago

### Fase 3: **Crecimiento**
- **Plan**: Lovable Pro + Twilio escalado
- **Coste**: €50-80/mes
- **Objetivo**: 200-500 clientes activos

### Fase 4: **Escalado**
- **Plan**: Lovable Business + Twilio alto volumen
- **Coste**: €150-250/mes
- **Objetivo**: 1000+ clientes activos

---

## 📝 Notas Importantes

### ✅ Lo que SÍ está incluido sin coste extra:
- Hosting web (ancho de banda estándar)
- SSL/HTTPS automático
- Despliegues ilimitados
- Autenticación de usuarios
- Base de datos (hasta 500 MB)
- Funciones backend (Edge Functions)
- Actualizaciones de código en tiempo real

### ⚠️ Lo que puede generar costes adicionales:
- Dominio personalizado (requiere plan Pro)
- Mensajes de WhatsApp en producción
- Almacenamiento de base de datos > 500 MB
- Más de 500k ejecuciones de funciones/mes
- Ancho de banda muy alto (> 100 GB/mes)

### 🚀 Consejos para optimizar costes:
1. **WhatsApp**: Solo envía notificaciones críticas (nuevo matching de alta puntuación)
2. **Base de datos**: Limpia propiedades antiguas periódicamente
3. **Lovable**: Empieza con Free, escala a Pro solo cuando necesites dominio personalizado
4. **Monitoreo**: Revisa logs de Lovable Cloud cada mes para detectar usos excesivos

---

## 📞 Contacto para Dudas

- **Lovable**: [docs.lovable.dev](https://docs.lovable.dev)
- **Twilio Pricing**: [twilio.com/pricing](https://www.twilio.com/pricing)
- **Soporte Lovable**: Chat en la plataforma

---

**Última actualización**: Diciembre 2024  
**Válido para**: InmoFinder v1.0
