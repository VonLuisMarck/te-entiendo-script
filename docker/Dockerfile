FROM python:3.11-slim

WORKDIR /app

# Instalar dependencias del sistema
RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copiar requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copiar código del scraper
COPY . .

# Hacer ejecutable el script de inicio
RUN chmod +x /app/start.sh

# Exponer puerto
EXPOSE 8000

# Comando para ejecutar el servidor
CMD ["/app/start.sh"]
