"""
Servidor Flask que expone API para triggear el scraper de Fotocasa
y envía resultados al Edge Function via webhook

Ejecuta Scrapy como subprocess para evitar conflictos con Twisted reactor
"""
import sys
import os

# Logging inmediato
print("=" * 80, flush=True)
print("🚀 INICIANDO SERVER.PY", flush=True)
print(f"   Python: {sys.version}", flush=True)
print(f"   CWD: {os.getcwd()}", flush=True)
print(f"   PORT env: {os.environ.get('PORT', 'NOT SET')}", flush=True)
print("=" * 80, flush=True)

try:
    import json
    import uuid
    import subprocess
    from flask import Flask, request, jsonify
    from threading import Thread
    import requests
    print("✅ Importaciones básicas OK", flush=True)
    
    from config import get_random_user_agent
    print("✅ Config importado OK", flush=True)
    
except Exception as e:
    print(f"❌ ERROR EN IMPORTS: {e}", flush=True)
    import traceback
    traceback.print_exc()
    sys.exit(1)

app = Flask(__name__)

# Almacén de jobs en memoria (en producción usar Redis/DB)
jobs = {}

def run_spider_subprocess(job_id, portal, max_pages, webhook_url, webhook_auth):
    """Ejecuta el spider como subprocess separado"""
    print("=" * 80)
    print(f"🕷️  INICIANDO SPIDER SUBPROCESS - Job {job_id[:8]}")
    print(f"   Portal: {portal}")
    print(f"   Max pages: {max_pages}")
    print(f"   Webhook: {webhook_url[:50]}...")
    print("=" * 80)
    
    try:
        jobs[job_id]['status'] = 'running'
        
        # Verificar que scrapy está disponible
        print(f"🔍 [Job {job_id[:8]}] Verificando scrapy instalado...")
        check_cmd = ['which', 'scrapy']
        check_result = subprocess.run(check_cmd, capture_output=True, text=True)
        print(f"   Scrapy path: {check_result.stdout.strip()}")
        
        # Verificar que fotocasa_spider.py existe
        spider_path = '/app/fotocasa_spider.py'
        if os.path.exists(spider_path):
            print(f"✅ [Job {job_id[:8]}] Spider encontrado en {spider_path}")
        else:
            print(f"❌ [Job {job_id[:8]}] Spider NO encontrado en {spider_path}")
            print(f"   Contenido de /app: {os.listdir('/app')}")
            raise FileNotFoundError(f"Spider not found at {spider_path}")
        
        # Output file
        output_file = f'/tmp/output_{job_id}.jsonl'
        print(f"📄 [Job {job_id[:8]}] Output: {output_file}")
        
        # Ejecutar scrapy como subprocess
        cmd = [
            'python', '-m', 'scrapy', 'runspider', 
            spider_path,
            '-a', f'max_pages={max_pages}',
            '-o', output_file,
            '--loglevel=INFO'
        ]
        
        print(f"🚀 [Job {job_id[:8]}] Ejecutando: {' '.join(cmd)}")
        print(f"   CWD: /app")
        
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            cwd='/app',
            timeout=300  # 5 minutos timeout
        )
        
        print(f"📊 [Job {job_id[:8]}] Subprocess terminó con código: {result.returncode}")
        
        if result.stdout:
            print(f"📝 [Job {job_id[:8]}] STDOUT ({len(result.stdout)} chars):")
            print(result.stdout[:2000])  # Primeros 2000 caracteres
        else:
            print(f"⚠️  [Job {job_id[:8]}] No STDOUT")
        
        if result.stderr:
            print(f"⚠️  [Job {job_id[:8]}] STDERR ({len(result.stderr)} chars):")
            print(result.stderr[:2000])  # Primeros 2000 caracteres
        else:
            print(f"✅ [Job {job_id[:8]}] No STDERR")
        
        if result.returncode != 0:
            raise Exception(f"Scrapy falló con código {result.returncode}")
        
        # Verificar que el output file existe
        if not os.path.exists(output_file):
            print(f"❌ [Job {job_id[:8]}] Output file NO existe: {output_file}")
            print(f"   Contenido de /tmp: {[f for f in os.listdir('/tmp') if 'output' in f]}")
            jobs[job_id]['status'] = 'completed'
            jobs[job_id]['propiedades_encontradas'] = 0
            return
        
        # Leer resultados del archivo JSONL
        propiedades = []
        print(f"📦 [Job {job_id[:8]}] Leyendo resultados de {output_file}")
        
        with open(output_file, 'r') as f:
            for line_num, line in enumerate(f, 1):
                if line.strip():
                    try:
                        item = json.loads(line)
                        prop = transform_item(item)
                        propiedades.append(prop)
                    except Exception as e:
                        print(f"⚠️  [Job {job_id[:8]}] Error en línea {line_num}: {e}")
        
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
    return jsonify({
        'status': 'healthy',
        'jobs_count': len(jobs),
        'active_jobs': sum(1 for j in jobs.values() if j.get('status') == 'running')
    }), 200

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
    host = '0.0.0.0'
    
    print("=" * 80, flush=True)
    print("🚀 ARRANCANDO SERVIDOR FLASK", flush=True)
    print(f"   Host: {host}", flush=True)
    print(f"   Port: {port}", flush=True)
    print(f"   Debug: False", flush=True)
    print(f"   Threaded: True", flush=True)
    print("=" * 80, flush=True)
    
    try:
        # Verificar que Flask puede bindear al puerto
        import socket
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        sock.bind((host, port))
        sock.close()
        print(f"✅ Puerto {port} disponible", flush=True)
        
        # Iniciar Flask
        app.run(host=host, port=port, debug=False, threaded=True)
        
    except Exception as e:
        print(f"❌ ERROR INICIANDO SERVIDOR: {e}", flush=True)
        import traceback
        traceback.print_exc()
        sys.exit(1)
