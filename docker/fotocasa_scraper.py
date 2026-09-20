#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
fotocasa_scraper.py
--------------------------------------------------
Scraper simplificado para Fotocasa usando requests directamente.
Se ejecuta desde server.py como subprocess.

Uso:
    python fotocasa_scraper.py --output <path> --max-pages <num>
"""

import requests
import json
import os
import time
import math
import argparse
from datetime import datetime

HOMEPAGE = "https://www.fotocasa.es/"
SEARCH_V1 = "https://web.gw.fotocasa.es/v1/search/ads"
URLLOCATIONSEGMENTS = "https://web.gw.fotocasa.es/v2/propertysearch/urllocationsegments"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Content-Type": "application/json",
    "Origin": "https://www.fotocasa.es",
    "Referer": "https://www.fotocasa.es/"
}

def ensure_dir(p):
    os.makedirs(p, exist_ok=True)

def get_combined_ids(session, city):
    """Unknown or unavailable locations fail instead of silently querying Murcia."""
    r = session.get(URLLOCATIONSEGMENTS, params={'location': city, 'zone': 'todas-las-zonas', 'culture': 'es-ES'}, timeout=20)
    r.raise_for_status()
    data = r.json()
    ids = data.get('ids') or data.get('combinedLocationIds')
    if not ids: raise ValueError(f'No location IDs returned for {city}')
    return ids


def normalize_items(data):
    """Extrae la lista de propiedades del JSON de respuesta"""
    for key in ["realEstates", "ads", "items", "list"]:
        if isinstance(data.get(key), list):
            return data[key]
    if isinstance(data.get("data"), dict):
        for key in ["realEstates", "ads", "items", "list"]:
            if isinstance(data["data"].get(key), list):
                return data["data"][key]
    raise ValueError("Unrecognized portal response: refusing to report an empty success")

def send_page_to_webhook(propiedades_raw, webhook_url, webhook_auth):
    """Envía una página de propiedades RAW al webhook para guardar en propiedades_raw"""
    if not webhook_url or not propiedades_raw:
        return
    
    try:
        # Construir payload simplificado - enviar raw data directamente
        propiedades_formato = []
        for item in propiedades_raw:
            if not (item.get('id') or item.get('propertyId')): raise ValueError('Listing has no source ID')
            # Construir URL completa de forma segura
            try:
                uris = item.get('uris', [])
                if uris and isinstance(uris, list) and len(uris) > 0:
                    url = f"https://www.fotocasa.es{uris[0].get('value', '')}"
                else:
                    url = f"https://www.fotocasa.es/propiedad/{item.get('id', 'unknown')}"
            except:
                url = f"https://www.fotocasa.es/propiedad/{item.get('id', 'unknown')}"
            
            prop = {
                'external_id': f"fotocasa-{item.get('id') or item.get('propertyId')}",
                'portal_origen': 'fotocasa',
                'url': url,
                'raw_data': item  # Objeto JSON completo sin transformar
            }
            propiedades_formato.append(prop)
        
        # Log para debug
        print(f"📤 Enviando {len(propiedades_formato)} propiedades al webhook...")
        
        webhook_data = {
            'propiedades': propiedades_formato,
            'metadata': {
                'portal': 'fotocasa',
                'ubicacion': None,
                'total_encontradas': len(propiedades_formato)
            }
        }
        
        response = requests.post(
            webhook_url,
            json=webhook_data,
            headers={
                'Content-Type': 'application/json',
                'X-Scraper-Secret': webhook_auth
            },
            timeout=60
        )
        
        response.raise_for_status()
        if response.json().get('success') is not True:
            raise RuntimeError('Ingestion did not confirm persistence')
    except Exception:
        raise


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--city", default="murcia-capital")
    ap.add_argument("--output", required=True, help="Path del archivo de salida")
    ap.add_argument("--transaction", type=int, default=1, help="1=venta, 2=alquiler")
    ap.add_argument("--size", type=int, default=30)
    ap.add_argument("--max-pages", type=int, default=50)
    ap.add_argument("--sleep", type=float, default=1.0)
    ap.add_argument("--webhook-url", default=None, help="URL del webhook para enviar resultados")
    ap.add_argument("--webhook-auth", default=os.environ.get("SCRAPER_SECRET"), help="Token de autenticación del webhook")
    args = ap.parse_args()

    output_file = args.output
    ensure_dir(os.path.dirname(output_file))

    s = requests.Session()
    s.headers.update(HEADERS)
    
    # Visitar homepage primero
    print("🏠 Visitando homepage...")
    s.get(HOMEPAGE, timeout=20).raise_for_status()

    # Obtener IDs de ubicación
    combined = get_combined_ids(s, args.city)
    print(f"📍 combinedLocationIds = {combined}")

    payload = {
        "combinedLocations": [combined],
        "transactionType": args.transaction,
        "platformId": 1,
        "sort": {"order": "desc", "type": "publicationDate"},
        "page": {"number": 1, "size": args.size},
        "from": 0,
        "filters": {}
    }

    # Primera página
    print("🔹 Página 1")
    r = s.post(SEARCH_V1, json=payload, timeout=30)
    print(f"   Respuesta: {r.status_code}")
    
    if r.status_code != 200:
        print(f"⚠️ Error HTTP {r.status_code}, abortando...")
        r.raise_for_status()
    
    data = r.json()

    total_items = data.get("totalItems", 0)
    page_size = data.get("page", {}).get("size", args.size)
    total_pages = math.ceil(total_items / page_size) if total_items else 1
    
    # Limitar al max-pages configurado
    total_pages = min(total_pages, args.max_pages)

    print(f"📊 Total propiedades: {total_items}")
    print(f"📄 Páginas a procesar: {total_pages}")

    # Procesar primera página
    found = normalize_items(data)
    seen = set(str(a.get("id")) for a in found if isinstance(a, dict))
    
    print(f"→ Página 1 devolvió {len(found)} resultados")
    
    # Guardar primera página inmediatamente
    if found:
        with open(output_file, "w", encoding="utf-8") as f:
            for item in found:
                f.write(json.dumps(item, ensure_ascii=False) + "\n")
        print(f"💾 Página 1: {len(found)} propiedades guardadas")
        
        # Enviar al webhook inmediatamente
        send_page_to_webhook(found, args.webhook_url, args.webhook_auth)

    # Resto de páginas - guardar cada una inmediatamente
    for page in range(2, total_pages + 1):
        payload["page"]["number"] = page
        payload["from"] = (page - 1) * page_size
        print(f"🔹 Página {page}")
        
        try:
            r = s.post(SEARCH_V1, json=payload, timeout=30)
            print(f"   Respuesta: {r.status_code}")
            
            if r.status_code != 200:
                print(f"⚠️ Error HTTP {r.status_code}, deteniendo...")
                r.raise_for_status()
            
            data = r.json()
        except Exception as e:
            print(f"⚠️ Error en página {page}: {e}")
            raise
            
        items = normalize_items(data)
        print(f"   {len(items)} resultados en esta página")
        
        if not items:
            print(f"⚠️ Sin resultados en página {page}, finalizando...")
            break
            
        # Filtrar duplicados para el archivo local
        new = [a for a in items if str(a.get("id")) not in seen]
        if new:
            # Append a archivo existente
            with open(output_file, "a", encoding="utf-8") as f:
                for item in new:
                    f.write(json.dumps(item, ensure_ascii=False) + "\n")
            print(f"💾 Página {page}: {len(new)} propiedades nuevas guardadas")
            seen.update(str(a.get("id")) for a in new)
        
        # IMPORTANTE: Enviar TODOS los items al webhook (no solo new)
        # El webhook/propiedades_raw maneja los duplicados con upsert
        send_page_to_webhook(items, args.webhook_url, args.webhook_auth)
        
        time.sleep(args.sleep)
    
    print(f"✅ Completado: {len(seen)} propiedades totales guardadas")

if __name__ == "__main__":
    main()

