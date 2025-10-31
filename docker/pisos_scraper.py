import re, json, logging
from typing import Iterable, Dict, Any, List, Optional, Tuple
from bs4 import BeautifulSoup
from requests import Session
from urllib.parse import urljoin, urlparse, parse_qs

from utils import clean_text, to_number, parse_ld_json

LISTING_SELECTORS = [
    'a[href*="/comprar/"]',
    'a[href*="/venta/"]',
    'a.c-ListItem__title',  # historical class
    'a[class*="card"]',
]

NEXT_PAGE_CANDIDATES = [
    'a[rel="next"]',
    'a[aria-label="Siguiente"]',
    'a:contains("Siguiente")',
    'a:contains("Next")',
]

def _unique_urls(urls: Iterable[str]) -> List[str]:
    seen=set()
    out=[]
    for u in urls:
        if not u: 
            continue
        if u in seen:
            continue
        seen.add(u)
        out.append(u)
    return out

def parse_listing_cards(html: str, base_url: str) -> List[str]:
    soup = BeautifulSoup(html, "lxml")
    # collect obvious listing links
    links = []
    for sel in LISTING_SELECTORS:
        for a in soup.select(sel):
            href = a.get("href")
            if not href:
                continue
            full = urljoin(base_url, href)
            # crude filter: must be property detail (avoid tracking, anchors)
            if re.search(r'/ficha/|/inmueble/|/comprar/|/venta/', full) and '#' not in full:
                links.append(full)
    # Heuristic: some sites embed links in data attributes
    for a in soup.find_all('a'):
        data_href = a.get('data-href')
        if data_href:
            full = urljoin(base_url, data_href)
            if re.search(r'/comprar/|/venta/', full):
                links.append(full)
    return _unique_urls(links)

def find_next_page(html: str, base_url: str) -> Optional[str]:
    soup = BeautifulSoup(html, "lxml")
    # rel="next"
    a = soup.find('a', rel='next')
    if a and a.get('href'):
        return urljoin(base_url, a['href'])
    # fallback: text search
    for a in soup.find_all('a'):
        txt = clean_text(a.get_text(' ')).lower() if a.get_text() else ''
        if 'siguiente' in txt or 'next' in txt:
            href = a.get('href')
            if href:
                return urljoin(base_url, href)
    return None

def parse_detail_page(html: str, url: str) -> Dict[str, Any]:
    soup = BeautifulSoup(html, "lxml")
    out: Dict[str, Any] = {
        "url": url,
        "source": "pisos.com",
    }

    # Prefer JSON-LD
    ld_blocks = [s.get_text() for s in soup.select('script[type="application/ld+json"]')]
    ld = parse_ld_json(ld_blocks)

    # Try to merge useful keys if present
    for obj in ld:
        t = obj.get("@type") or obj.get("type")
        # Offer + Product/Place pattern is common
        if t in ("Product", "Accommodation", "Residence", "SingleFamilyResidence", "Apartment", "Offer", "RealEstateListing"):
            # Generic fields
            out["title"] = out.get("title") or obj.get("name") or obj.get("title")
            out["description"] = out.get("description") or obj.get("description")
            offers = obj.get("offers") or {}
            if isinstance(offers, list):
                offers = offers[0] if offers else {}
            price = offers.get("price") if isinstance(offers, dict) else obj.get("price")
            currency = offers.get("priceCurrency") if isinstance(offers, dict) else obj.get("priceCurrency")
            out["price"] = out.get("price") or price
            out["price_currency"] = out.get("price_currency") or currency
            
            # Extract operation (venta/alquiler) from offers
            if isinstance(offers, dict):
                business_function = offers.get("businessFunction") or ""
                if "rent" in str(business_function).lower() or "alquiler" in str(business_function).lower():
                    out["operation"] = "alquiler"
                else:
                    out["operation"] = "venta"
            
            # Address
            addr = obj.get("address") or {}
            if isinstance(addr, dict):
                out["address"] = addr.get("streetAddress")
                out["municipality"] = addr.get("addressLocality")
                out["province"] = addr.get("addressRegion")
                out["postal_code"] = addr.get("postalCode")
            # Geo
            geo = obj.get("geo") or {}
            if isinstance(geo, dict):
                out["latitude"] = geo.get("latitude")
                out["longitude"] = geo.get("longitude")
            # attributes
            out["property_type"] = out.get("property_type") or obj.get("@type") or obj.get("category")
            
            # Extract additional properties
            if "numberOfRooms" in obj:
                out["rooms"] = obj.get("numberOfRooms")
            if "floorSize" in obj:
                out["size_m2"] = to_number(str(obj.get("floorSize")))

    # Extract images from various sources
    image_urls = []
    
    # From JSON-LD
    for obj in ld:
        if "image" in obj:
            img = obj.get("image")
            if isinstance(img, list):
                image_urls.extend([i.get("url") if isinstance(i, dict) else i for i in img])
            elif isinstance(img, dict):
                image_urls.append(img.get("url"))
            elif isinstance(img, str):
                image_urls.append(img)
    
    # From HTML img tags
    for img in soup.select('img[src*="fotos"], img[data-src*="fotos"], img[class*="photo"], img[class*="image"]'):
        src = img.get('data-src') or img.get('src')
        if src and ('http' in src or src.startswith('//')):
            if src.startswith('//'):
                src = 'https:' + src
            image_urls.append(src)
    
    # Remove duplicates and filter valid URLs
    seen = set()
    unique_images = []
    for img_url in image_urls:
        if img_url and img_url not in seen and 'placeholder' not in img_url.lower():
            seen.add(img_url)
            unique_images.append(img_url)
    
    out["image_urls"] = unique_images
    out["photo_count"] = len(unique_images)

    # Fallbacks from HTML for rooms, size, etc.
    # Common patterns in feature lists (e.g., "m²", "habitaciones", "baños")
    text = soup.get_text(" ", strip=True).lower()

    def rx(pattern):
        m = re.search(pattern, text)
        return m.group(1) if m else None

    size = rx(r'(\d+(?:[.,]\d+)?)\s*m[²2]\b')
    rooms = rx(r'(\d+)\s*habi(?:taciones|tación)\b')
    baths = rx(r'(\d+)\s*bañ(?:os|o)\b')
    floor = rx(r'(\d+)(?:ª|º)?\s*planta\b')
    year_built = rx(r'(?:año|construido|antigüedad).*?(\d{4})\b')
    
    # Boolean features from text
    parking = bool(re.search(r'aparcamiento|garaje|parking', text))
    lift = bool(re.search(r'ascensor', text))
    pool = bool(re.search(r'piscina', text))
    garden = bool(re.search(r'jardín|jardin', text))
    terrace = bool(re.search(r'terraza', text))
    
    # Condition
    condition = None
    if re.search(r'reformado|obra nueva|nuevo', text):
        if 'obra nueva' in text or 'nuevo' in text:
            condition = "obra nueva"
        elif 'reformado' in text:
            condition = "reformado"
    elif re.search(r'buen estado', text):
        condition = "buen estado"
    elif re.search(r'a reformar|para reformar', text):
        condition = "a reformar"
    
    # Orientation
    orientation = None
    if 'sur' in text:
        orientation = "sur"
    elif 'norte' in text:
        orientation = "norte"
    elif 'este' in text:
        orientation = "este"
    elif 'oeste' in text:
        orientation = "oeste"
    
    # Interior/Exterior
    interior_exterior = None
    if re.search(r'\bexterior\b', text):
        interior_exterior = "exterior"
    elif re.search(r'\binterior\b', text):
        interior_exterior = "interior"
    
    # Energy certificate
    energy_cert = rx(r'certificado energético:?\s*([a-g])\b')
    if not energy_cert:
        energy_cert = rx(r'eficiencia energética:?\s*([a-g])\b')

    if size and not out.get("size_m2"):
        out["size_m2"] = to_number(size)
    if rooms and not out.get("rooms"):
        out["rooms"] = int(re.sub(r'\D','', rooms))
    if baths and not out.get("bathrooms"):
        out["bathrooms"] = int(re.sub(r'\D','', baths))
    if floor and not out.get("floor"):
        out["floor"] = int(re.sub(r'\D','', floor))
    if year_built and not out.get("year_built"):
        try:
            out["year_built"] = int(year_built)
        except:
            pass
    if energy_cert:
        out["energy_certificate"] = energy_cert.upper()
    
    out["has_parking"] = out.get("has_parking", parking)
    out["has_lift"] = out.get("has_lift", lift)
    
    # Extract features list
    features = []
    if lift:
        features.append("ascensor")
    if parking:
        features.append("parking/garaje")
    if pool:
        features.append("piscina")
    if garden:
        features.append("jardín")
    if terrace:
        features.append("terraza")
    
    # Look for additional features in specific sections
    feature_section = soup.find(['ul', 'div'], class_=re.compile(r'caracteristicas|features|amenities', re.I))
    if feature_section:
        for li in feature_section.find_all(['li', 'span', 'div']):
            feature_text = clean_text(li.get_text())
            if feature_text and len(feature_text) < 50 and feature_text.lower() not in [f.lower() for f in features]:
                features.append(feature_text.lower())
    
    out["features"] = features[:20]  # Limit to 20 features
    
    # Extras object
    out["extras"] = {
        "has_pool": pool,
        "has_garden": garden,
        "has_terrace": terrace,
        "orientation": orientation,
        "condition": condition,
        "interior_exterior": interior_exterior
    }
    
    # Extract neighborhood (barrio)
    # Try to find it in breadcrumbs or location text
    breadcrumb = soup.find(['nav', 'ol', 'ul'], class_=re.compile(r'breadcrumb', re.I))
    if breadcrumb:
        crumbs = [clean_text(a.get_text()) for a in breadcrumb.find_all('a')]
        if len(crumbs) >= 3:
            # Usually: Home > City > Neighborhood > Property
            out["neighborhood"] = crumbs[-2] if len(crumbs) > 2 else None
    
    # Try to extract from title or description
    if not out.get("neighborhood") and out.get("title"):
        title_lower = out["title"].lower()
        # Common pattern: "Piso en [Neighborhood]"
        m = re.search(r'en (?:el |la )?([A-ZÁÉÍÓÚ][a-záéíóúñ\s]+?)(?:,|\.|$)', out["title"])
        if m:
            potential_neighborhood = m.group(1).strip()
            if potential_neighborhood and potential_neighborhood.lower() != out.get("municipality", "").lower():
                out["neighborhood"] = potential_neighborhood

    # Extract advertiser information
    advertiser = {}
    
    # Look for agency/advertiser info
    agency_section = soup.find(['div', 'section'], class_=re.compile(r'agencia|inmobiliaria|anunciante|advertiser', re.I))
    if agency_section:
        # Agency name
        name_tag = agency_section.find(['h2', 'h3', 'span', 'div'], class_=re.compile(r'name|nombre|title', re.I))
        if name_tag:
            advertiser["name"] = clean_text(name_tag.get_text())
        
        # Phone
        phone_link = agency_section.find('a', href=re.compile(r'tel:'))
        if phone_link:
            advertiser["phone"] = phone_link.get('href').replace('tel:', '').strip()
        else:
            # Try to find phone in text
            phone_match = re.search(r'\b\d{3}[-\s]?\d{3}[-\s]?\d{3}\b', agency_section.get_text())
            if phone_match:
                advertiser["phone"] = phone_match.group(0)
        
        # Logo
        logo_img = agency_section.find('img')
        if logo_img:
            logo_src = logo_img.get('src') or logo_img.get('data-src')
            if logo_src:
                if logo_src.startswith('//'):
                    logo_src = 'https:' + logo_src
                advertiser["logo"] = logo_src
        
        # Type (agencia vs particular)
        type_text = agency_section.get_text().lower()
        if 'particular' in type_text:
            advertiser["type"] = "particular"
        else:
            advertiser["type"] = "agencia"
    
    if advertiser:
        out["advertiser"] = advertiser

    # Extract potential ID from URL
    m = re.search(r'(\d{6,})', url)
    if m:
        out["id"] = m.group(1)
    else:
        # Generate a unique ID from URL hash
        import hashlib
        url_hash = hashlib.md5(url.encode()).hexdigest()[:12]
        out["id"] = f"pisos-{url_hash}"

    # Title fallback
    if not out.get("title"):
        h1 = soup.find('h1')
        if h1:
            out["title"] = clean_text(h1.get_text())
    
    # Ensure operation is set (default to venta if not found)
    if not out.get("operation"):
        if '/alquiler/' in url.lower() or 'alquilar' in url.lower():
            out["operation"] = "alquiler"
        else:
            out["operation"] = "venta"
    
    # Add scraped timestamp
    from datetime import datetime, timezone
    out["scraped_at"] = datetime.now(timezone.utc).isoformat()

    return out

def scrape_listings(session: Session, start_url: str, max_pages: int, delay: float, timeout: int, logger: logging.Logger):
    """Scrape listings page by page, yielding lists of properties per page"""
    page = 1
    next_url = start_url
    seen_detail_urls = set()

    while next_url and page <= max_pages:
        logger.info(f"[pisos] Página {page}: {next_url}")
        resp = session.get(next_url, timeout=timeout)
        resp.raise_for_status()
        html = resp.text

        detail_urls = parse_listing_cards(html, next_url)
        logger.info(f"[pisos] Detectados {len(detail_urls)} enlaces de ficha en la página {page}.")
        
        # Acumular propiedades de esta página
        page_items = []
        for du in detail_urls:
            if du in seen_detail_urls:
                continue
            seen_detail_urls.add(du)
            try:
                r = session.get(du, timeout=timeout)
                if r.status_code != 200:
                    logger.warning(f"[pisos] {du} -> HTTP {r.status_code}")
                    continue
                item = parse_detail_page(r.text, du)
                page_items.append(item)
            except Exception as e:
                logger.exception(f"[pisos] Error en detalle {du}: {e}")
            finally:
                from utils import sleep_courteous
                sleep_courteous(delay)
        
        # Yield toda la página completa
        if page_items:
            logger.info(f"[pisos] Página {page} completada: {len(page_items)} propiedades")
            yield page_items
        
        # Pagination
        nu = find_next_page(html, next_url)
        next_url = nu
        page += 1
