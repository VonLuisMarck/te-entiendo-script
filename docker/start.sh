#!/bin/bash
set -e

echo "=========================================="
echo "🚀 Iniciando InmoFinder Scraper"
echo "=========================================="

# Verificar instalación de Python y Scrapy
echo "🔍 Verificando entorno..."
python --version
pip list | grep -i scrapy

# Verificar archivos críticos
echo ""
echo "📁 Verificando archivos..."
ls -la /app/*.py

# Iniciar servidor Flask
echo ""
echo "🌐 Iniciando servidor Flask en 0.0.0.0:${PORT:-8000}..."
exec python /app/server.py
