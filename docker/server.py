# -*- coding: utf-8 -*-
"""
Servidor Flask para triggear el scraper de Fotocasa
Ejecuta Scrapy como subprocess
"""
import sys
import os
import json
import uuid
import subprocess
from flask import Flask, request, jsonify
from threading import Thread
import requests

print("=" * 80, flush=True)
print("[STARTING] SERVER.PY", flush=True)
print(f"Python: {sys.version}", flush=True)
print(f"CWD: {os.getcwd()}", flush=True)
print(f"PORT: {os.environ.get('PORT', 'NOT SET')}", flush=True)
print("=" * 80, flush=True)

try:
    from config import get_random_user_agent
    print("[OK] Config imported", flush=True)
except Exception as e:
    print(f"[ERROR] Import failed: {e}", flush=True)
    import traceback
    traceback.print_exc()
    sys.exit(1)

app = Flask(__name__)
jobs = {}

def transform_item(item):
    """Transforma item del nuevo formato de Fotocasa al formato del backend"""
    # Extraer ubicación
    location = item.get('location', {})
    zone = item.get('zone', '')
    
    # Mapear propertyType (viene como código numérico)
    property_type_map = {
        '1': 'Chalet',
        '2': 'Piso',
        '3': 'Ático',
        '4': 'Dúplex',
        '5': 'Estudio',
        '6': 'Local',
        '7': 'Oficina',
        '8': 'Garaje',
        '9': 'Terreno',
        '10': 'Trastero',
    }
    property_type_code = str(item.get('propertyType', '2'))
    tipo_texto = property_type_map.get(property_type_code, 'Vivienda')
    tipo_propiedad_bd = tipo_texto.lower()
    
    # Extraer precio
    transaction = item.get('transaction', {})
    precio = transaction.get('price', 0)
    
    # Extraer imágenes
    multimedia = item.get('multimedia', [])
    imagenes = [m.get('url') for m in multimedia if m.get('type') == '2' and m.get('url')]
    
    # Construir URL de la propiedad
    uris = item.get('uris', [])
    url = f"https://www.fotocasa.es{uris[0].get('value')}" if uris else f"https://www.fotocasa.es/propiedad/{item.get('propertyId')}"
    
    # Extraer features
    features = item.get('features', [])
    feature_ids = [str(f.get('id')) for f in features if f.get('id')]
    
    # Mapeo de features comunes (IDs de Fotocasa)
    # 1: aire acondicionado, 2: parking, 5: jardín, 7: terraza, 10: piscina, 17: ascensor
    tiene_parking = '2' in feature_ids
    tiene_ascensor = '17' in feature_ids
    
    # Calcular precio_m2
    metros = item.get('surface')
    precio_m2 = round(precio / metros, 2) if metros and metros > 0 else None
    
    # Convertir ano_construccion a int (puede venir como string)
    ano_construccion = item.get('antiquity')
    if ano_construccion:
        try:
            ano_construccion = int(ano_construccion)
        except (ValueError, TypeError):
            ano_construccion = None
    
    # Fecha actual para fecha_scraping
    from datetime import datetime, timezone
    fecha_scraping = datetime.now(timezone.utc).isoformat()
    
    # Construir ubicación completa con provincia
    barrio = zone or location.get('level8Name') or ''
    ciudad = location.get('level5Name', 'Murcia')
    
    # Construir ubicación: Si hay barrio, "Barrio, Ciudad", sino solo "Ciudad"
    if barrio and barrio.lower() != ciudad.lower():
        ubicacion_completa = f"{barrio}, {ciudad}"
    else:
        ubicacion_completa = ciudad
    
    titulo = f"{tipo_texto} en {ubicacion_completa}"
    
    return {
        'external_id': f"fotocasa-{item.get('propertyId')}",
        'portal_origen': 'fotocasa',
        'titulo': titulo,
        'descripcion': item.get('description'),
        'precio': precio,
        'precio_m2': precio_m2,
        'ubicacion': ubicacion_completa,
        'tipo_propiedad': tipo_propiedad_bd,
        'dormitorios': item.get('rooms'),
        'banos': item.get('baths'),
        'metros': metros,
        'condition': item.get('conservationStatus'),
        'ano_construccion': ano_construccion,
        'tiene_ascensor': tiene_ascensor,
        'tiene_parking': tiene_parking,
        'url': url,
        'imagenes': imagenes[:10] if imagenes else [],  # Limitar a 10 imágenes
        'fecha_scraping': fecha_scraping,
        'fecha_publicacion': None,  # Fotocasa no proporciona este dato
    }

def send_to_webhook(job_id, portal, propiedades, webhook_url, webhook_auth):
    """Envia propiedades al webhook"""
    try:
        webhook_data = {
            'propiedades': propiedades,
            'metadata': {
                'portal': portal,
                'ubicacion': None,
                'total_encontradas': len(propiedades)
            }
        }
        
        print(f"[WEBHOOK] Job {job_id[:8]} Sending {len(propiedades)} properties...")
        
        response = requests.post(
            webhook_url,
            json=webhook_data,
            headers={
                'Content-Type': 'application/json',
                'X-Scraper-Secret': webhook_auth
            },
            timeout=60
        )
        
        print(f"[WEBHOOK] Job {job_id[:8]} Response: {response.status_code}")
        
        if response.status_code == 200:
            jobs[job_id]['status'] = 'completed'
            jobs[job_id]['propiedades_encontradas'] = len(propiedades)
            print(f"[OK] Job {job_id[:8]} Webhook success")
        else:
            jobs[job_id]['status'] = 'error'
            jobs[job_id]['error'] = f'Webhook error: {response.status_code}'
            print(f"[ERROR] Job {job_id[:8]} Webhook failed: {response.text}")
            
    except Exception as e:
        jobs[job_id]['status'] = 'error'
        jobs[job_id]['error'] = f'Webhook error: {str(e)}'
        print(f"[ERROR] Job {job_id[:8]} Webhook exception: {e}")

def run_scraper_subprocess(job_id, portal, max_pages, webhook_url, webhook_auth):
    """Ejecuta el scraper de Python como subprocess"""
    print("=" * 80)
    print(f"[SCRAPER] Starting subprocess - Job {job_id[:8]}")
    print(f"Portal: {portal}, Max pages: {max_pages}")
    print("=" * 80)
    
    try:
        jobs[job_id]['status'] = 'running'
        
        output_file = f'/tmp/output_{job_id}.jsonl'
        
        print(f"[OK] Output file: {output_file}")
        
        cmd = [
            'python', 'fotocasa_scraper.py',
            '--city', 'murcia-capital',
            '--output', output_file,
            '--max-pages', str(max_pages),
            '--transaction', '1'
        ]
        
        print(f"[RUN] {' '.join(cmd)}")
        
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            cwd='/app',
            timeout=300
        )
        
        print(f"[DONE] Return code: {result.returncode}")
        
        if result.stdout:
            print(f"[STDOUT] ({len(result.stdout)} chars)")
            print(result.stdout)
        
        if result.stderr:
            print(f"[STDERR] ({len(result.stderr)} chars)")
            print(result.stderr)
        
        if result.returncode != 0:
            error_msg = f"Scraper failed with code {result.returncode}"
            print(f"[ERROR] {error_msg}")
            jobs[job_id]['status'] = 'error'
            jobs[job_id]['error'] = error_msg
            jobs[job_id]['stderr'] = result.stderr
            jobs[job_id]['stdout'] = result.stdout
            return
        
        if not os.path.exists(output_file):
            print(f"[WARN] No output file generated")
            jobs[job_id]['status'] = 'completed'
            jobs[job_id]['propiedades_encontradas'] = 0
            return
        
        propiedades = []
        print(f"[READ] Reading results from {output_file}")
        
        with open(output_file, 'r', encoding='utf-8') as f:
            for line_num, line in enumerate(f, 1):
                if line.strip():
                    try:
                        item = json.loads(line)
                        prop = transform_item(item)
                        propiedades.append(prop)
                    except Exception as e:
                        print(f"[WARN] Line {line_num} error: {e}")
        
        print(f"[OK] Total properties: {len(propiedades)}")
        
        if propiedades:
            send_to_webhook(job_id, portal, propiedades, webhook_url, webhook_auth)
        else:
            jobs[job_id]['status'] = 'completed'
            jobs[job_id]['propiedades_encontradas'] = 0
        
        if os.path.exists(output_file):
            os.remove(output_file)
            
    except Exception as e:
        jobs[job_id]['status'] = 'error'
        jobs[job_id]['error'] = str(e)
        print(f"[ERROR] Job {job_id[:8]} Exception: {e}")
        import traceback
        traceback.print_exc()

@app.route('/health', methods=['GET'])
def health():
    """Health check"""
    return jsonify({
        'status': 'healthy',
        'jobs_count': len(jobs),
        'active_jobs': sum(1 for j in jobs.values() if j.get('status') == 'running')
    }), 200

@app.route('/scrape', methods=['POST'])
def scrape():
    """Endpoint para triggear scraping"""
    print("=" * 80)
    print("[ENDPOINT] /scrape called")
    print("=" * 80)
    
    try:
        data = request.json
        print(f"[DATA] {data}")
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        portal = data.get('portal')
        max_pages = data.get('max_pages', 50)
        webhook_url = data.get('webhook_url')
        webhook_auth = data.get('webhook_auth')
        
        if not all([portal, webhook_url, webhook_auth]):
            return jsonify({'error': 'Missing required fields'}), 400
        
        job_id = str(uuid.uuid4())
        jobs[job_id] = {
            'status': 'pending',
            'portal': portal,
            'max_pages': max_pages,
        }
        
        print(f"[JOB] Created: {job_id}")
        
        thread = Thread(
            target=run_scraper_subprocess,
            args=(job_id, portal, max_pages, webhook_url, webhook_auth)
        )
        thread.daemon = True
        thread.start()
        
        print(f"[THREAD] Started")
        
        return jsonify({
            'job_id': job_id,
            'status': 'pending',
            'message': 'Scraping iniciado'
        }), 202
        
    except Exception as e:
        print(f"[ERROR] /scrape exception: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/jobs/<job_id>', methods=['GET'])
def get_job(job_id):
    """Get job status"""
    job = jobs.get(job_id)
    if not job:
        return jsonify({'error': 'Job not found'}), 404
    return jsonify(job), 200

@app.route('/jobs', methods=['GET'])
def list_jobs():
    """List all jobs"""
    return jsonify(jobs), 200

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8000))
    host = '0.0.0.0'
    
    print("=" * 80, flush=True)
    print("[FLASK] Starting server", flush=True)
    print(f"Host: {host}, Port: {port}", flush=True)
    print("=" * 80, flush=True)
    
    try:
        import socket
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        sock.bind((host, port))
        sock.close()
        print(f"[OK] Port {port} available", flush=True)
        
        app.run(host=host, port=port, debug=False, threaded=True)
        
    except Exception as e:
        print(f"[ERROR] Server startup failed: {e}", flush=True)
        import traceback
        traceback.print_exc()
        sys.exit(1)
