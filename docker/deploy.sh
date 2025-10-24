#!/bin/bash
# Script de deployment automático para Railway

set -e

echo "🚀 Deployment del Scraper de Fotocasa"
echo "====================================="
echo ""

# Verificar que Railway CLI está instalado
if ! command -v railway &> /dev/null; then
    echo "❌ Railway CLI no encontrado."
    echo "📦 Instalando Railway CLI..."
    npm install -g @railway/cli
fi

echo "✅ Railway CLI encontrado"
echo ""

# Login a Railway
echo "🔐 Iniciando sesión en Railway..."
railway login

# Crear proyecto
echo "📁 Creando proyecto en Railway..."
railway init

# Desplegar
echo "🚢 Desplegando contenedor Docker..."
railway up

# Obtener URL
echo ""
echo "✅ ¡Deployment completado!"
echo ""
echo "🔗 Obtén tu URL con: railway domain"
echo "📝 Luego configura ese URL en Lovable Cloud > Secrets > PYTHON_SCRAPER_URL"
echo ""

# Mostrar logs
echo "📊 Mostrando logs (Ctrl+C para salir)..."
railway logs
