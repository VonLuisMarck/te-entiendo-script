"""
Servidor Flask que expone API para triggear el scraper de Fotocasa
y envía resultados al Edge Function via webhook

Incluye rotación de User-Agents y anti-detección
"""
import os
import json
import uuid
from threading import Thread
from flask import Flask, request, jsonify
from scrapy.crawler import CrawlerProcess
from scrapy.utils.project import get_project_settings
import requests
from config import get_random_user_agent, SCRAPY_SETTINGS

# Habilitar pipelines
SCRAPY_SETTINGS['ITEM_PIPELINES'] = {
    'pipelines.DataValidationPipeline': 100,
    'pipelines.DataCleaningPipeline': 200,
    'pipelines.PropertyTransformPipeline': 300,
    'pipelines.DuplicateFilterPipeline': 400,
}

app = Flask(__name__)

# Almacén de jobs en memoria (en producción usar Redis/DB)
jobs = {}

def run_spider(job_id, portal, max_pages, webhook_url, webhook_auth):
    """Ejecuta el spider de Scrapy en background con User-Agent rotation"""
    try:
        jobs[job_id]['status'] = 'running'
        print(f"🚀 [Job {job_id[:8]}] Iniciando spider: {portal}, max_pages={max_pages}")
        
        # Obtener User-Agent aleatorio para este job
        user_agent = get_random_user_agent()
        print(f"🎭 [Job {job_id[:8]}] User-Agent: {user_agent[:60]}...")
        
        # Configurar el proceso de Scrapy con settings anti-detección
        settings = SCRAPY_SETTINGS.copy()
        settings['USER_AGENT'] = user_agent
        settings['LOG_LEVEL'] = 'INFO'
        
        # Datos que se enviarán al webhook
        propiedades = []
        
        # Importar spider actualizado
        from fotocasa_spider import FotocasaApiSpider
        
        # Recolectar resultados usando señales de Scrapy
        from scrapy import signals
        from scrapy.signalmanager import dispatcher
        
        # Recolectar resultados
        def collect_items(item, response, spider):
            # Los datos ya vienen procesados por los pipelines
            propiedades.append(dict(item))
            print(f"📦 [Job {job_id[:8]}] Propiedad: {item['external_id']} - {item['ubicacion']}")
        
        # Conectar señal
        dispatcher.connect(collect_items, signal=signals.item_scraped)
        
        # Ejecutar spider
        print(f"🕷️  [Job {job_id[:8]}] Iniciando CrawlerProcess...")
        process = CrawlerProcess(settings)
        process.crawl(
            FotocasaApiSpider,
            max_pages=max_pages
        )
        process.start(stop_after_crawl=True)
        print(f"✅ [Job {job_id[:8]}] Spider finalizado. Total propiedades: {len(propiedades)}")
        
        # Enviar resultados al webhook
        if propiedades:
            webhook_data = {
                'propiedades': propiedades,
                'metadata': {
                    'portal': portal,
                    'ubicacion': None,  # Ya no filtramos por ubicación
                    'total_encontradas': len(propiedades)
                }
            }
            
            response = requests.post(
                webhook_url,
                json=webhook_data,
                headers={
                    'Content-Type': 'application/json',
                    'X-Scraper-Secret': webhook_auth
                }
            )
            
            if response.status_code == 200:
                jobs[job_id]['status'] = 'completed'
                jobs[job_id]['propiedades_encontradas'] = len(propiedades)
            else:
                jobs[job_id]['status'] = 'error'
                jobs[job_id]['error'] = f'Error al enviar webhook: {response.status_code}'
        else:
            jobs[job_id]['status'] = 'completed'
            jobs[job_id]['propiedades_encontradas'] = 0
            
    except Exception as e:
        jobs[job_id]['status'] = 'error'
        jobs[job_id]['error'] = str(e)
        print(f"Error en spider: {e}")

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({'status': 'healthy'}), 200

@app.route('/scrape', methods=['POST'])
def scrape():
    """
    Endpoint para triggear scraping de toda España
    Body: {
        "portal": "fotocasa",
        "max_pages": 50,
        "webhook_url": "https://...",
        "webhook_auth": "Bearer ..."
    }
    """
    data = request.json
    
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    portal = data.get('portal')
    max_pages = data.get('max_pages', 50)
    webhook_url = data.get('webhook_url')
    webhook_auth = data.get('webhook_auth')
    
    if not all([portal, webhook_url, webhook_auth]):
        return jsonify({'error': 'Missing required fields: portal, webhook_url, webhook_auth'}), 400
    
    # Crear job
    job_id = str(uuid.uuid4())
    jobs[job_id] = {
        'status': 'pending',
        'portal': portal,
        'max_pages': max_pages,
    }
    
    # Ejecutar spider en background thread
    thread = Thread(
        target=run_spider,
        args=(job_id, portal, max_pages, webhook_url, webhook_auth)
    )
    thread.daemon = True
    thread.start()
    
    return jsonify({
        'job_id': job_id,
        'status': 'pending',
        'message': 'Scraping de toda España iniciado'
    }), 202

@app.route('/jobs/<job_id>', methods=['GET'])
def get_job(job_id):
    """Obtener estado de un job"""
    job = jobs.get(job_id)
    if not job:
        return jsonify({'error': 'Job not found'}), 404
    return jsonify(job), 200

@app.route('/jobs', methods=['GET'])
def list_jobs():
    """Listar todos los jobs"""
    return jsonify(jobs), 200

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8000))
    app.run(host='0.0.0.0', port=port, debug=False)
