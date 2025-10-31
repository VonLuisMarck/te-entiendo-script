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

    # Fallbacks from HTML for rooms, size, etc.
    # Common patterns in feature lists (e.g., "m²", "habitaciones", "baños")
    text = soup.get_text(" ", strip=True).lower()

    def rx(pattern):
        m = re.search(pattern, text)
        return m.group(1) if m else None

    size = rx(r'(\d+(?:[.,]\d+)?)\s*m[²2]\b')
    rooms = rx(r'(\d+)\s*habi(?:taciones|tación)\b')
    baths = rx(r'(\d+)\s*bañ(?:os|o)\b')
    floor = rx(r'(\d+)\s*planta\b')
    parking = bool(re.search(r'aparcamiento|garaje', text))
    lift = bool(re.search(r'ascensor', text))

    if size and not out.get("size_m2"):
        out["size_m2"] = to_number(size)
    if rooms and not out.get("rooms"):
        out["rooms"] = int(re.sub(r'\D','', rooms))
    if baths and not out.get("bathrooms"):
        out["bathrooms"] = int(re.sub(r'\D','', baths))
    if floor and not out.get("floor"):
        out["floor"] = int(re.sub(r'\D','', floor))
    out["has_parking"] = out.get("has_parking", parking)
    out["has_lift"] = out.get("has_lift", lift)

    # Extract potential ID from URL
    m = re.search(r'(\d{6,})', url)
    if m:
        out["id"] = m.group(1)

    # Title fallback
    if not out.get("title"):
        h1 = soup.find('h1')
        if h1:
            out["title"] = clean_text(h1.get_text())

    return out

def scrape_listings(session: Session, start_url: str, max_pages: int, delay: float, timeout: int, logger: logging.Logger):
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
                yield item
            except Exception as e:
                logger.exception(f"[pisos] Error en detalle {du}: {e}")
            finally:
                from utils import sleep_courteous
                sleep_courteous(delay)

        # Pagination
        nu = find_next_page(html, next_url)
        next_url = nu
        page += 1
