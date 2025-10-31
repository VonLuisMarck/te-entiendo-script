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
    from pisos_scraper import scrape_listings as scrape_pisos
    print("[OK] Pisos scraper imported", flush=True)
except Exception as e:
    print(f"[ERROR] Import failed: {e}", flush=True)
    import traceback
    traceback.print_exc()
    sys.exit(1)

app = Flask(__name__)
jobs = {}

def transform_item_pisos(item):
    """Transforma item del scraper de pisos.com al formato del backend"""
    from datetime import datetime, timezone
    
    # Extraer ubicación
    municipality = item.get('municipality', '')
    neighborhood = item.get('neighborhood', '')
    provincia = item.get('province', 'Murcia')
    
    # Construir ubicación completa
    if neighborhood and neighborhood.lower() != municipality.lower():
        ubicacion_completa = f"{neighborhood}, {municipality}"
    else:
        ubicacion_completa = municipality or provincia
    
    # Mapear tipo de propiedad
    property_type = (item.get('property_type') or '').lower()
    tipo_mapeado = None
    
    if 'apartment' in property_type or 'piso' in property_type:
        tipo_mapeado = 'piso'
    elif 'house' in property_type or 'chalet' in property_type or 'villa' in property_type or 'singlefamily' in property_type:
        tipo_mapeado = 'chalet'
    elif 'penthouse' in property_type or 'ático' in property_type:
        tipo_mapeado = 'ático'
    elif 'duplex' in property_type or 'dúplex' in property_type:
        tipo_mapeado = 'dúplex'
    elif 'studio' in property_type or 'estudio' in property_type:
        tipo_mapeado = 'estudio'
    else:
        # Intentar inferir del título o descripción
        titulo = (item.get('title') or '').lower()
        desc = (item.get('description') or '').lower()
        texto = f"{titulo} {desc}"
        
        if 'chalet' in texto or 'villa' in texto or 'casa independiente' in texto:
            tipo_mapeado = 'chalet'
        elif 'ático' in texto or 'atico' in texto or 'penthouse' in texto:
            tipo_mapeado = 'ático'
        elif 'dúplex' in texto or 'duplex' in texto:
            tipo_mapeado = 'dúplex'
        elif 'estudio' in texto:
            tipo_mapeado = 'estudio'
        else:
            tipo_mapeado = 'piso'  # Por defecto
    
    # Capitalizar para el título
    tipo_texto = tipo_mapeado.capitalize()
    
    # Precio
    precio = item.get('price', 0)
    try:
        precio = float(precio) if precio else 0
    except (ValueError, TypeError):
        precio = 0
    
    # Metros y precio_m2
    metros = item.get('size_m2')
    try:
        metros = float(metros) if metros else None
    except (ValueError, TypeError):
        metros = None
    
    precio_m2 = round(precio / metros, 2) if metros and metros > 0 and precio else None
    
    # Rooms y bathrooms
    rooms = item.get('rooms')
    try:
        rooms = int(rooms) if rooms else None
    except (ValueError, TypeError):
        rooms = None
    
    baths = item.get('bathrooms')
    try:
        baths = int(baths) if baths else None
    except (ValueError, TypeError):
        baths = None
    
    # Año construcción
    ano_construccion = item.get('year_built')
    if ano_construccion:
        try:
            ano_construccion = int(ano_construccion)
        except (ValueError, TypeError):
            ano_construccion = None
    
    # Features booleanas
    tiene_ascensor = item.get('has_lift')
    if tiene_ascensor is not None:
        tiene_ascensor = bool(tiene_ascensor)
    
    tiene_parking = item.get('has_parking')
    if tiene_parking is not None:
        tiene_parking = bool(tiene_parking)
    
    # Condition - usar de extras si está disponible, sino energy_certificate
    extras = item.get('extras', {})
    condition = extras.get('condition') or item.get('energy_certificate')
    
    # Imágenes - usar image_urls si está disponible
    imagenes = item.get('image_urls', [])
    if not imagenes and isinstance(item.get('imagenes'), list):
        imagenes = item.get('imagenes', [])
    
    # Título construido o usar el original
    titulo = item.get('title')
    if not titulo:
        titulo = f"{tipo_texto} en {ubicacion_completa}"
    
    # Fecha de scraping
    fecha_scraping = item.get('scraped_at') or datetime.now(timezone.utc).isoformat()
    
    # Construir objeto completo con todos los campos
    return {
        'external_id': f"pisos-{item.get('id', uuid.uuid4())}",
        'portal_origen': 'pisos',
        'titulo': titulo,
        'descripcion': item.get('description'),
        'precio': precio,
        'precio_m2': precio_m2,
        'ubicacion': ubicacion_completa,
        'tipo_propiedad': tipo_mapeado,
        'dormitorios': rooms,
        'banos': baths,
        'metros': metros,
        'condition': condition,
        'ano_construccion': ano_construccion,
        'tiene_ascensor': tiene_ascensor,
        'tiene_parking': tiene_parking,
        'url': item.get('url'),
        'imagenes': imagenes[:10] if imagenes else [],  # Limitar a 10 para BD
        'fecha_scraping': fecha_scraping,
        'fecha_publicacion': None,
        
        # Campos adicionales que no están en la BD pero guardamos en el log
        '_extra_data': {
            'operation': item.get('operation'),
            'features': item.get('features', []),
            'photo_count': item.get('photo_count', 0),
            'address': item.get('address'),
            'neighborhood': neighborhood,
            'province': provincia,
            'postal_code': item.get('postal_code'),
            'latitude': item.get('latitude'),
            'longitude': item.get('longitude'),
            'energy_certificate': item.get('energy_certificate'),
            'advertiser': item.get('advertiser', {}),
            'extras': extras,
            'floor': item.get('floor'),
            'price_currency': item.get('price_currency', 'EUR'),
        }
    }

def transform_item(item):
    """Transforma item del nuevo formato de Fotocasa al formato del backend"""
    # Extraer ubicación
    location = item.get('location', {})
    zone = item.get('zone', '')
    
    # Mapear propertyType (viene como código numérico)
    property_type_map = {
        '1': 'chalet',
        '2': 'piso',
        '3': 'ático',
        '4': 'dúplex',
        '5': 'estudio',
        '6': 'local',
        '7': 'oficina',
        '8': 'garaje',
        '9': 'terreno',
        '10': 'trastero',
    }
    
    property_type_code = str(item.get('propertyType', ''))
    tipo_propiedad_bd = property_type_map.get(property_type_code, None)
    
    # Log para debugging
    print(f"[DEBUG] propertyType={property_type_code}, mapped={tipo_propiedad_bd}", flush=True)
    
    # Si no viene propertyType o no está mapeado, intentar inferir de descripción/título
    if not tipo_propiedad_bd:
        descripcion = (item.get('description') or '').lower()
        titulo_web = (item.get('title') or '').lower()
        texto_completo = f"{titulo_web} {descripcion}"
        
        if 'chalet' in texto_completo or 'villa' in texto_completo or 'casa' in texto_completo:
            tipo_propiedad_bd = 'chalet'
        elif 'ático' in texto_completo or 'atico' in texto_completo:
            tipo_propiedad_bd = 'ático'
        elif 'dúplex' in texto_completo or 'duplex' in texto_completo:
            tipo_propiedad_bd = 'dúplex'
        elif 'estudio' in texto_completo:
            tipo_propiedad_bd = 'estudio'
        else:
            tipo_propiedad_bd = 'piso'  # Por defecto solo si no se puede determinar
        
        print(f"[DEBUG] Inferred from text: {tipo_propiedad_bd}", flush=True)
    
    # Capitalizar para el título
    tipo_texto = tipo_propiedad_bd.capitalize()
    
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
    
    # Parking/Garaje: buscar en features Y en descripción
    tiene_parking = None
    if '2' in feature_ids:
        tiene_parking = True
    else:
        # Buscar en descripción
        descripcion = (item.get('description') or '').lower()
        palabras_parking = ['parking', 'garaje', 'plaza de garaje', 'aparcamiento', 'cochera']
        if any(palabra in descripcion for palabra in palabras_parking):
            tiene_parking = True
        # Si no aparece explícitamente, dejarlo como None (no aparece)
    
    # Ascensor: solo si está en features, sino None
    tiene_ascensor = True if '17' in feature_ids else None
    
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

def run_pisos_scraper(job_id, max_pages, webhook_url, webhook_auth):
    """Ejecuta el scraper de pisos.com directamente"""
    print("=" * 80)
    print(f"[PISOS] Starting scraper - Job {job_id[:8]}")
    print(f"Max pages: {max_pages}")
    print("=" * 80)
    
    try:
        jobs[job_id]['status'] = 'running'
        
        # Crear sesión con requests
        import requests
        from requests.adapters import HTTPAdapter
        from urllib3.util.retry import Retry
        import logging
        
        session = requests.Session()
        session.headers.update({
            "User-Agent": get_random_user_agent(),
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "es-ES,es;q=0.9",
            "Connection": "keep-alive",
        })
        
        retry = Retry(
            total=5,
            backoff_factor=0.5,
            status_forcelist=(429, 500, 502, 503, 504),
            allowed_methods=["GET", "HEAD"]
        )
        adapter = HTTPAdapter(max_retries=retry, pool_connections=10, pool_maxsize=10)
        session.mount("http://", adapter)
        session.mount("https://", adapter)
        
        # Logger
        logger = logging.getLogger(f"pisos_{job_id[:8]}")
        logger.setLevel(logging.INFO)
        
        # URL de inicio para Murcia
        start_url = "https://www.pisos.com/venta/pisos-murcia/"
        
        print(f"[PISOS] URL: {start_url}")
        
        # Ejecutar scraper
        propiedades = []
        for item in scrape_pisos(session, start_url, max_pages, delay=1.5, timeout=20, logger=logger):
            try:
                prop = transform_item_pisos(item)
                propiedades.append(prop)
                print(f"[PISOS] Property scraped: {prop.get('titulo', 'No title')[:50]}...")
            except Exception as e:
                print(f"[WARN] Error transforming item: {e}")
        
        print(f"[PISOS] Total properties: {len(propiedades)}")
        
        if propiedades:
            send_to_webhook(job_id, 'pisos', propiedades, webhook_url, webhook_auth)
        else:
            jobs[job_id]['status'] = 'completed'
            jobs[job_id]['propiedades_encontradas'] = 0
            
    except Exception as e:
        jobs[job_id]['status'] = 'error'
        jobs[job_id]['error'] = str(e)
        print(f"[ERROR] Job {job_id[:8]} Exception: {e}")
        import traceback
        traceback.print_exc()

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
        
        # Elegir el scraper apropiado
        if portal == 'pisos':
            thread = Thread(
                target=run_pisos_scraper,
                args=(job_id, max_pages, webhook_url, webhook_auth)
            )
        else:  # fotocasa
            thread = Thread(
                target=run_scraper_subprocess,
                args=(job_id, portal, max_pages, webhook_url, webhook_auth)
            )
        
        thread.daemon = True
        thread.start()
        
        print(f"[THREAD] Started for portal: {portal}")
        
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
