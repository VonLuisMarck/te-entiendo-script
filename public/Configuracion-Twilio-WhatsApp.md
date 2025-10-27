# Guía de Configuración - Twilio WhatsApp Business

Esta guía te ayudará a configurar tu cuenta de Twilio para enviar notificaciones de WhatsApp desde InmoFinder.

---

## 📋 Requisitos Previos

- Una cuenta de Twilio (puedes empezar con la versión de prueba gratuita)
- Verificar tu número de WhatsApp personal durante el proceso de prueba
- Para producción: Un número de WhatsApp Business verificado

---

## 🚀 Paso 1: Crear Cuenta en Twilio

1. Ve a [https://www.twilio.com/try-twilio](https://www.twilio.com/try-twilio)
2. Regístrate con tu email y completa el proceso de verificación
3. Verifica tu número de teléfono personal

**Crédito de Prueba:**
- Twilio te da $15.00 USD de crédito gratis para empezar
- Cada mensaje de WhatsApp cuesta aproximadamente $0.005 USD
- Con el crédito gratuito puedes enviar ~3,000 mensajes de prueba

---

## 📱 Paso 2: Configurar WhatsApp Sandbox (Modo Prueba)

**Para desarrollo y pruebas, usa el WhatsApp Sandbox:**

1. En tu [Twilio Console](https://console.twilio.com/), ve a:
   - **Messaging** → **Try it out** → **Send a WhatsApp message**

2. Verás un número de WhatsApp de Twilio (algo como: `+1 415 523 8886`)
   
3. **Conecta tu WhatsApp personal:**
   - Abre WhatsApp en tu teléfono
   - Envía el código de activación que te muestra Twilio
   - Ejemplo: `join <código-único>` al número de Twilio
   - Recibirás un mensaje de confirmación: "You are all set!"

4. Ahora tu número personal está conectado al Sandbox y puede recibir mensajes

**Limitaciones del Sandbox:**
- ✅ Gratis y fácil de configurar
- ✅ Perfecto para desarrollo
- ❌ Solo números que se unan al sandbox pueden recibir mensajes
- ❌ No es para producción

---

## 🔑 Paso 3: Obtener Credenciales

En tu [Twilio Console](https://console.twilio.com/), encontrarás:

### **Account SID** y **Auth Token**
- Están en la página principal del Dashboard
- Copia ambos valores (necesitarás introducirlos en InmoFinder)

### **WhatsApp Number**
- En el Sandbox, el número será algo como: `whatsapp:+14155238886`
- Copia el número completo **incluyendo** el prefijo `whatsapp:`

---

## 🏢 Paso 4: Para Producción (Opcional)

**Cuando estés listo para lanzar el servicio real:**

### Opción A: Twilio WhatsApp Sender (Recomendado)
1. Ve a **Messaging** → **WhatsApp** → **Senders**
2. Click en **Add WhatsApp Sender**
3. Registra tu número de negocio
4. Completa el proceso de verificación de Meta
5. Tiempo estimado: 1-3 días hábiles

### Opción B: Número de Twilio con WhatsApp
1. Compra un número de teléfono con capacidad de WhatsApp
2. Costo: ~$1-2 USD/mes + costos de mensajes
3. Configuración más rápida pero menos profesional

---

## 💰 Costos de Operación

| Concepto | Precio Aproximado |
|----------|-------------------|
| Mensaje saliente (España) | $0.0055 USD |
| Mensaje entrante | $0.0000 USD |
| Número WhatsApp Business | $0-2 USD/mes |

**Ejemplo de costos mensuales:**
- 1,000 notificaciones = $5.50 USD
- 5,000 notificaciones = $27.50 USD
- 10,000 notificaciones = $55.00 USD

---

## ⚙️ Paso 5: Configurar en InmoFinder

Una vez que tengas tus credenciales:

1. Los secrets ya están configurados en tu proyecto:
   - `TWILIO_ACCOUNT_SID`
   - `TWILIO_AUTH_TOKEN`
   - `TWILIO_WHATSAPP_NUMBER`

2. El formato del número debe ser:
   - Sandbox: `whatsapp:+14155238886`
   - Producción: `whatsapp:+34612345678` (con código de país)

---

## 🧪 Paso 6: Probar el Sistema

### Preparar un Cliente de Prueba:

1. Ve a la sección **Clientes** en InmoFinder
2. Crea o edita un cliente
3. Asegúrate de que tenga:
   - ✅ Nombre
   - ✅ Email
   - ✅ **Teléfono** (tu número personal que uniste al sandbox)
   - ✅ Criterios de búsqueda definidos

### Enviar Notificación de Prueba:

1. Ve a la sección **Matchings**
2. Encuentra un matching con buen score (>80%)
3. Click en el botón **"Notificar"**
4. Deberías recibir el mensaje en tu WhatsApp en menos de 30 segundos

**Formato del número del cliente:**
- Con código de país: `+34612345678`
- Sin código de país: `612345678` (se asume +34 España)

---

## 🔍 Solución de Problemas

### ❌ "No se pudo enviar el mensaje"

**Posibles causas:**
1. **Credenciales incorrectas**: Verifica que copiaste bien el Account SID y Auth Token
2. **Número no verificado**: En Sandbox, el número del cliente debe unirse primero con el código
3. **Formato de número incorrecto**: Asegúrate de incluir el código de país (+34 para España)
4. **Crédito agotado**: Verifica tu balance en Twilio Console

### ❌ "Unauthorized"

- Revisa que el Auth Token sea correcto
- No incluyas espacios al copiar las credenciales

### ❌ "Invalid To Phone Number"

- El número debe incluir código de país
- Formato correcto: `+34612345678`
- En Sandbox: El número debe estar previamente conectado

### 📊 Ver Logs de Mensajes

En Twilio Console:
- Ve a **Monitor** → **Logs** → **Messaging Logs**
- Aquí verás el estado de todos los mensajes enviados

---

## ✅ Checklist de Configuración

Antes de empezar a usar el sistema en producción:

- [ ] Cuenta de Twilio creada y verificada
- [ ] WhatsApp Sandbox configurado y probado
- [ ] Credenciales copiadas en InmoFinder
- [ ] Cliente de prueba con teléfono configurado
- [ ] Mensaje de prueba enviado y recibido exitosamente
- [ ] (Producción) Número de WhatsApp Business aprobado
- [ ] (Producción) Template de mensaje aprobado por Meta

---

## 🎓 Recursos Adicionales

- [Twilio WhatsApp Documentation](https://www.twilio.com/docs/whatsapp)
- [WhatsApp Business API](https://www.twilio.com/docs/whatsapp/api)
- [Pricing Calculator](https://www.twilio.com/whatsapp/pricing)
- [Support Twilio](https://support.twilio.com/)

---

## 📞 Soporte

Si tienes problemas con la configuración:
1. Revisa los logs del edge function en InmoFinder
2. Consulta los logs de mensajería en Twilio Console
3. Verifica que todos los pasos de esta guía estén completos

---

**¡Listo!** Una vez completada la configuración, InmoFinder enviará notificaciones automáticas cada vez que encuentre una propiedad perfecta para tus clientes.
