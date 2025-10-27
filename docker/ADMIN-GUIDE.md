# 📚 Guía de Administración - InmoFinder Scraper Service

## 🚀 Información del Servicio

- **URL del servicio**: https://inmofinder-scraper.fly.dev
- **Región**: Amsterdam (ams)
- **Plataforma**: Fly.io
- **Recursos**: 256MB RAM, 1 CPU compartida

---

## 🔍 Monitoreo y Logs

### Ver logs en tiempo real
```bash
fly logs -a inmofinder-scraper
```

### Ver logs filtrados por error
```bash
fly logs -a inmofinder-scraper | grep ERROR
```

### Ver logs de las últimas 24 horas
```bash
fly logs -a inmofinder-scraper --since 24h
```

---

## 🔧 Comandos de Administración

### Estado del servicio
```bash
fly status -a inmofinder-scraper
```

### Información detallada de las máquinas
```bash
fly machine list -a inmofinder-scraper
```

### Ver configuración actual
```bash
fly config show -a inmofinder-scraper
```

### SSH al contenedor (debugging avanzado)
```bash
fly ssh console -a inmofinder-scraper
```

---

## 🔄 Actualización y Despliegue

### Actualizar el servicio con nuevos cambios
```bash
cd docker/
git pull origin main
fly deploy -a inmofinder-scraper
```

### Despliegue con logs en vivo
```bash
fly deploy -a inmofinder-scraper --verbose
```

### Rollback a versión anterior
```bash
fly releases -a inmofinder-scraper  # Ver releases
fly releases rollback <version> -a inmofinder-scraper
```

---

## 📈 Escalado

### Escalar recursos (RAM/CPU)
```bash
# Aumentar RAM a 512MB
fly scale memory 512 -a inmofinder-scraper

# Cambiar a CPU dedicada
fly scale vm dedicated-cpu-1x -a inmofinder-scraper
```

### Escalar número de instancias
```bash
# Aumentar a 2 instancias
fly scale count 2 -a inmofinder-scraper

# Por región
fly scale count 2 --region ams -a inmofinder-scraper
```

---

## 🔐 Gestión de Secrets

### Ver secrets configurados
```bash
fly secrets list -a inmofinder-scraper
```

### Agregar/actualizar secret
```bash
fly secrets set API_KEY=tu_api_key -a inmofinder-scraper
```

### Eliminar secret
```bash
fly secrets unset API_KEY -a inmofinder-scraper
```

---

## 🏥 Health Checks

### Endpoint de salud
```bash
curl https://inmofinder-scraper.fly.dev/health
```

Respuesta esperada:
```json
{
  "status": "healthy",
  "service": "fotocasa-scraper",
  "timestamp": "2025-01-15T10:30:00Z"
}
```

### Ver estado de health checks
```bash
fly checks list -a inmofinder-scraper
```

---

## 🐛 Troubleshooting

### Servicio no responde
1. Verificar estado:
   ```bash
   fly status -a inmofinder-scraper
   ```

2. Ver logs recientes:
   ```bash
   fly logs -a inmofinder-scraper --since 1h
   ```

3. Reiniciar máquina:
   ```bash
   fly machine restart <machine-id> -a inmofinder-scraper
   ```

### High CPU/Memory
1. Ver métricas:
   ```bash
   fly vm status -a inmofinder-scraper
   ```

2. Considerar escalar:
   ```bash
   fly scale memory 512 -a inmofinder-scraper
   ```

### Errores de scraping
1. Verificar logs específicos:
   ```bash
   fly logs -a inmofinder-scraper | grep "fotocasa"
   ```

2. Probar endpoint manualmente:
   ```bash
   curl -X POST https://inmofinder-scraper.fly.dev/scrape \
     -H "Content-Type: application/json" \
     -d '{"url": "https://www.fotocasa.es/...", "max_pages": 1}'
   ```

### Container crashes
1. Ver eventos:
   ```bash
   fly events -a inmofinder-scraper
   ```

2. Acceder al contenedor:
   ```bash
   fly ssh console -a inmofinder-scraper
   ```

---

## 💰 Costos y Facturación

### Ver uso actual
```bash
fly apps list
```

### Estimar costos
- **256MB RAM, 1 CPU compartida**: ~$1.94/mes
- **512MB RAM, 1 CPU compartida**: ~$3.88/mes
- **1GB RAM, 1 CPU dedicada**: ~$7.76/mes

### Optimizar costos
- Usar `auto_stop_machines = true` en fly.toml para apagar cuando no hay tráfico
- Reducir `min_machines_running` a 0 si no necesitas disponibilidad 24/7

---

## 🔄 Backup y Recuperación

### Crear snapshot del volumen (si existe)
```bash
fly volumes list -a inmofinder-scraper
fly volumes snapshots create <volume-id> -a inmofinder-scraper
```

### Backup de configuración
```bash
# Guardar fly.toml y código en git
git add docker/
git commit -m "Backup scraper config"
git push origin main
```

---

## 📊 Monitoreo Avanzado

### Métricas en tiempo real
```bash
fly dashboard -a inmofinder-scraper
```

### Integración con servicios externos
- **Sentry**: Para error tracking
- **DataDog**: Para métricas detalladas
- **Uptime Robot**: Para monitoreo de disponibilidad

---

## 🔒 Seguridad

### Mejores prácticas
1. **Nunca** expongas secrets en logs
2. Usa HTTPS para todas las comunicaciones
3. Implementa rate limiting en el servidor
4. Valida todos los inputs
5. Mantén dependencias actualizadas

### Actualizar dependencias
```bash
cd docker/
pip list --outdated
# Actualizar requirements.txt
fly deploy -a inmofinder-scraper
```

---

## 📞 Soporte

### Documentación oficial
- [Fly.io Docs](https://fly.io/docs/)
- [Scrapy Docs](https://docs.scrapy.org/)

### Comandos útiles de referencia
```bash
# Ayuda general
fly help

# Ayuda para comando específico
fly deploy --help

# Ver todas las apps
fly apps list

# Abrir dashboard web
fly dashboard -a inmofinder-scraper
```

---

## ⚠️ IMPORTANTE

1. **Antes de hacer cambios críticos**: Crea un backup
2. **Testing**: Siempre prueba en local antes de desplegar
3. **Logs**: Revisa logs después de cada deploy
4. **Monitoreo**: Configura alertas para errores críticos
5. **Documentación**: Mantén esta guía actualizada con cambios

---

## 🎯 Checklist de Mantenimiento

### Semanal
- [ ] Revisar logs de errores
- [ ] Verificar métricas de uso
- [ ] Comprobar health checks

### Mensual
- [ ] Actualizar dependencias
- [ ] Revisar costos
- [ ] Optimizar rendimiento
- [ ] Backup de configuración

### Trimestral
- [ ] Auditoría de seguridad
- [ ] Evaluar escalado
- [ ] Review de arquitectura
