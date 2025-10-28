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
COPY fotocasa_scraper.py .
COPY server.py .
COPY config.py .
COPY __init__.py .

# Exponer puerto
EXPOSE 8000

# Variables de entorno
ENV PYTHONUNBUFFERED=1
ENV PORT=8000

# Comando para ejecutar el servidor
CMD ["python", "-u", "server.py"]
