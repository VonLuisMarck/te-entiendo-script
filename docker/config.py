"""
Configuración del scraper - User-Agents y settings
"""
import random

# Pool de User-Agents realistas (actualizados 2025)
USER_AGENTS = [
    # Chrome en Windows
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 11.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    
    # Chrome en Mac
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_6_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    
    # Firefox en Windows
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
    'Mozilla/5.0 (Windows NT 11.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0',
    
    # Firefox en Mac
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:122.0) Gecko/20100101 Firefox/122.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 13.6; rv:121.0) Gecko/20100101 Firefox/121.0',
    
    # Safari en Mac
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_6_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
    
    # Edge en Windows
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0',
    
    # Chrome en Linux (menos común pero válido)
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:122.0) Gecko/20100101 Firefox/122.0',
]

# Accept-Language variados (principalmente español)
ACCEPT_LANGUAGES = [
    'es-ES,es;q=0.9,en;q=0.8',
    'es-ES,es;q=0.9',
    'es,en-US;q=0.9,en;q=0.8',
    'es-ES,es;q=0.9,ca;q=0.8,en;q=0.7',
    'es-ES,es;q=0.8,en-US;q=0.5,en;q=0.3',
]

# Viewport sizes comunes
VIEWPORTS = [
    {'width': 1920, 'height': 1080},
    {'width': 1366, 'height': 768},
    {'width': 1536, 'height': 864},
    {'width': 1440, 'height': 900},
    {'width': 2560, 'height': 1440},
]

def get_random_user_agent():
    """Retorna un User-Agent aleatorio del pool"""
    return random.choice(USER_AGENTS)

def get_random_accept_language():
    """Retorna un Accept-Language aleatorio"""
    return random.choice(ACCEPT_LANGUAGES)

def get_random_viewport():
    """Retorna un viewport aleatorio"""
    return random.choice(VIEWPORTS)

def get_random_headers():
    """Genera headers completos con valores aleatorios"""
    return {
        'User-Agent': get_random_user_agent(),
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': get_random_accept_language(),
        'Accept-Encoding': 'gzip, deflate, br',
        'Content-Type': 'application/json',
        'Origin': 'https://www.fotocasa.es',
        'Referer': 'https://www.fotocasa.es/',
        'Sec-Ch-Ua': '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"Windows"',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-site',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
    }

# Delays aleatorios entre requests (en segundos)
def get_random_delay(min_delay=0.5, max_delay=2.0):
    """Retorna un delay aleatorio para simular comportamiento humano"""
    return random.uniform(min_delay, max_delay)

# Settings de Scrapy con anti-detección
SCRAPY_SETTINGS = {
    'ROBOTSTXT_OBEY': False,
    'CONCURRENT_REQUESTS': 2,  # Bajo para no levantar sospechas
    'DOWNLOAD_DELAY': 1.5,  # Base delay entre requests
    'RANDOMIZE_DOWNLOAD_DELAY': True,  # Variar el delay ±50%
    'COOKIES_ENABLED': True,
    'COOKIES_DEBUG': False,
    'RETRY_ENABLED': True,
    'RETRY_TIMES': 3,
    'RETRY_HTTP_CODES': [429, 500, 502, 503, 504],
    'AUTOTHROTTLE_ENABLED': True,
    'AUTOTHROTTLE_START_DELAY': 1,
    'AUTOTHROTTLE_MAX_DELAY': 10,
    'AUTOTHROTTLE_TARGET_CONCURRENCY': 1.0,
    'AUTOTHROTTLE_DEBUG': False,
    # Headers por defecto (se sobreescriben por request)
    'DEFAULT_REQUEST_HEADERS': get_random_headers(),
}
