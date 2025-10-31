import re, json, time, logging
from typing import Optional, Dict, Any, List

def sleep_courteous(delay: float):
    try:
        time.sleep(max(0.0, delay))
    except Exception:
        pass

def to_number(text: Optional[str]) -> Optional[float]:
    if not text:
        return None
    t = re.sub(r'[^0-9,.\-]', '', text)
    # replace thousands separators commonly used in ES
    # heuristics: if both , and . occur, assume . is thousands and , is decimal
    if ',' in t and '.' in t:
        if t.find('.') < t.find(','):
            t = t.replace('.', '').replace(',', '.')
    else:
        t = t.replace(',', '.')
    try:
        return float(t)
    except Exception:
        return None

def clean_text(s: Optional[str]) -> Optional[str]:
    if s is None:
        return None
    return re.sub(r'\s+', ' ', s).strip()

def parse_ld_json(blocks: List[str]) -> List[Dict[str, Any]]:
    out = []
    for b in blocks:
        try:
            # Some pages include multiple JSON objects concatenated
            data = json.loads(b)
            if isinstance(data, list):
                out.extend(data)
            else:
                out.append(data)
        except Exception:
            # Try to fix minor JSON issues (trailing commas, etc.) conservatively
            try:
                b2 = re.sub(r',\s*}', '}', b)
                b2 = re.sub(r',\s*]', ']', b2)
                data = json.loads(b2)
                if isinstance(data, list):
                    out.extend(data)
                else:
                    out.append(data)
            except Exception:
                continue
    return out

def get_first(d: Dict[str, Any], *keys, default=None):
    for k in keys:
        v = d.get(k)
        if v is not None:
            return v
    return default
