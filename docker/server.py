"""
Servidor Flask que expone API para triggear el scraper de Fotocasa
y envía resultados al Edge Function via webhook

Ejecuta Scrapy como subprocess para evitar conflictos con Twisted reactor
"""
import os
import json
import uuid
import subprocess
from flask import Flask, request, jsonify
from threading import Thread
import requests
from config import get_random_user_agent

app = Flask(__name__)

# Almacén de jobs en memoria (en producción usar Redis/DB)
jobs = {}

def run_spider_subprocess(job_id, portal, max_pages, webhook_url, webhook_auth):
    """Ejecuta el spider como subprocess separado"""
    print("=" * 80)
    print(f"🕷️  INICIANDO SPIDER SUBPROCESS - Job {job_id[:8]}")
    print("=" * 80)
    
    try:
        jobs[job_id]['status'] = 'running'
        print(f"🚀 [Job {job_id[:8]}] Portal: {portal}, Max pages: {max_pages}")
        
        # Crear archivo temporal con la configuración del job
        job_config = {
            'job_id': job_id,
            'portal': portal,
            'max_pages': max_pages,
            'webhook_url': webhook_url,
            'webhook_auth': webhook_auth,
        }
        
        config_file = f'/tmp/job_{job_id}.json'
        with open(config_file, 'w') as f:
            json.dump(job_config, f)
        
        print(f"📄 [Job {job_id[:8]}] Config guardado en {config_file}")
        
        # Ejecutar scrapy como subprocess
        cmd = [
            'scrapy', 'runspider', 
            'fotocasa_spider.py',
            '-a', f'max_pages={max_pages}',
            '-o', f'/tmp/output_{job_id}.jsonl',
            '--loglevel=INFO'
        ]
        
        print(f"🚀 [Job {job_id[:8]}] Ejecutando comando: {' '.join(cmd)}")
        
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            cwd='/app'
        )
        
        print(f"📊 [Job {job_id[:8]}] Return code: {result.returncode}")
        
        if result.stdout:
            print(f"📝 [Job {job_id[:8]}] STDOUT:\n{result.stdout}")
        
        if result.stderr:
            print(f"⚠️  [Job {job_id[:8]}] STDERR:\n{result.stderr}")
        
        # Leer resultados del archivo JSONL
        output_file = f'/tmp/output_{job_id}.jsonl'
        propiedades = []
        
        if os.path.exists(output_file):
            print(f"📦 [Job {job_id[:8]}] Leyendo resultados de {output_file}")
            with open(output_file, 'r') as f:
                for line in f:
                    if line.strip():
                        item = json.loads(line)
                        # Transformar item al formato del backend
                        prop = transform_item(item)
                        propiedades.append(prop)
            
            print(f"✅ [Job {job_id[:8]}] Total propiedades procesadas: {len(propiedades)}")
            
            # Limpiar archivo temporal
            os.remove(output_file)
        
        # Enviar resultados al webhook si hay propiedades
        if propiedades:
            send_to_webhook(job_id, portal, propiedades, webhook_url, webhook_auth)
        else:
            print(f"⚠️  [Job {job_id[:8]}] No se encontraron propiedades")
            jobs[job_id]['status'] = 'completed'
            jobs[job_id]['propiedades_encontradas'] = 0
        
        # Limpiar config temporal
        if os.path.exists(config_file):
            os.remove(config_file)
            
    except Exception as e:
        jobs[job_id]['status'] = 'error'
        jobs[job_id]['error'] = str(e)
        print(f"❌❌❌ ERROR EN RUN_SPIDER: {e}")
        import traceback
        traceback.print_exc()


def transform_item(item):
    """Transforma item del spider al formato del backend"""
    raw = item.get('raw', {})
    price_obj = raw.get('price', {})
    features = raw.get('features', {})
    property_type = raw.get('propertyType', {})
    
    province = item.get('province') or 'Desconocida'
    municipality = item.get('municipality') or ''
    ubicacion = f"{municipality}, {province}" if municipality else province
    
    return {
        'external_id': f"fotocasa-{item.get('ad_id')}",
        'portal_origen': 'fotocasa',
        'titulo': raw.get('title', 'Sin título'),
        'descripcion': raw.get('description'),
        'precio': price_obj.get('amount', 0) if isinstance(price_obj, dict) else (price_obj or 0),
        'ubicacion': ubicacion,
        'tipo_propiedad': property_type.get('id', 'piso') if isinstance(property_type, dict) else 'piso',
        'dormitorios': features.get('bedrooms'),
        'banos': features.get('bathrooms'),
        'metros': item.get('surface'),
        'condition': features.get('condition'),
        'ano_construccion': features.get('builtYear'),
        'tiene_ascensor': bool(features.get('hasLift', False)),
        'tiene_parking': bool(features.get('parking', False)),
        'url': raw.get('url') or f"https://www.fotocasa.es/vivienda/{item.get('ad_id')}",
        'imagenes': raw.get('images', []),
    }


def send_to_webhook(job_id, portal, propiedades, webhook_url, webhook_auth):
    """Envía propiedades al webhook"""
    try:
        webhook_data = {
            'propiedades': propiedades,
            'metadata': {
                'portal': portal,
                'ubicacion': None,
                'total_encontradas': len(propiedades)
            }
        }
        
        print(f"📤 [Job {job_id[:8]}] Enviando {len(propiedades)} propiedades al webhook...")
        
        response = requests.post(
            webhook_url,
            json=webhook_data,
            headers={
                'Content-Type': 'application/json',
                'X-Scraper-Secret': webhook_auth
            },
            timeout=60
        )
        
        print(f"📬 [Job {job_id[:8]}] Webhook response: {response.status_code}")
        
        if response.status_code == 200:
            jobs[job_id]['status'] = 'completed'
            jobs[job_id]['propiedades_encontradas'] = len(propiedades)
            print(f"✅ [Job {job_id[:8]}] Webhook exitoso")
        else:
            jobs[job_id]['status'] = 'error'
            jobs[job_id]['error'] = f'Error al enviar webhook: {response.status_code}'
            print(f"❌ [Job {job_id[:8]}] Webhook falló: {response.text}")
            
    except Exception as e:
        jobs[job_id]['status'] = 'error'
        jobs[job_id]['error'] = f'Error en webhook: {str(e)}'
        print(f"❌ [Job {job_id[:8]}] Error enviando webhook: {e}")

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
    print("=" * 80)
    print("📥 /scrape endpoint llamado")
    print("=" * 80)
    
    try:
        data = request.json
        print(f"📦 Data recibida: {data}")
        
        if not data:
            print("❌ No data provided")
            return jsonify({'error': 'No data provided'}), 400
        
        portal = data.get('portal')
        max_pages = data.get('max_pages', 50)
        webhook_url = data.get('webhook_url')
        webhook_auth = data.get('webhook_auth')
        
        print(f"🔍 Portal: {portal}, Max pages: {max_pages}")
        print(f"🔗 Webhook URL: {webhook_url[:50]}...")
        
        if not all([portal, webhook_url, webhook_auth]):
            print("❌ Missing required fields")
            return jsonify({'error': 'Missing required fields: portal, webhook_url, webhook_auth'}), 400
        
        # Crear job
        job_id = str(uuid.uuid4())
        jobs[job_id] = {
            'status': 'pending',
            'portal': portal,
            'max_pages': max_pages,
        }
        
        print(f"✅ Job creado: {job_id}")
        print(f"🚀 Iniciando thread para spider...")
        
        # Ejecutar spider en background thread
        thread = Thread(
            target=run_spider_subprocess,
            args=(job_id, portal, max_pages, webhook_url, webhook_auth)
        )
        thread.daemon = True
        thread.start()
        
        print(f"✅ Thread iniciado correctamente")
        
        return jsonify({
            'job_id': job_id,
            'status': 'pending',
            'message': 'Scraping de toda España iniciado'
        }), 202
    except Exception as e:
        print(f"❌❌❌ ERROR EN /scrape: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

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
