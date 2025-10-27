"""
Pipelines de Scrapy para procesar items antes de enviarlos al backend
"""
import logging
from itemadapter import ItemAdapter


class DataValidationPipeline:
    """Valida que los campos requeridos estén presentes"""
    
    def process_item(self, item, spider):
        adapter = ItemAdapter(item)
        
        # Validar campos obligatorios
        required_fields = ['ad_id', 'raw']
        for field in required_fields:
            if not adapter.get(field):
                spider.logger.warning(f"❌ Item sin {field}: {item}")
                raise DropItem(f"Missing {field} in {item}")
        
        return item


class DataCleaningPipeline:
    """Limpia y normaliza los datos"""
    
    def process_item(self, item, spider):
        adapter = ItemAdapter(item)
        
        # Asegurar que ad_id sea string
        if adapter.get('ad_id'):
            adapter['ad_id'] = str(adapter['ad_id'])
        
        # Normalizar precios (remover None, convertir a float)
        if adapter.get('price'):
            try:
                adapter['price'] = float(adapter['price'])
            except (ValueError, TypeError):
                adapter['price'] = None
        
        # Normalizar superficie
        if adapter.get('surface'):
            try:
                adapter['surface'] = float(adapter['surface'])
            except (ValueError, TypeError):
                adapter['surface'] = None
        
        # Normalizar habitaciones
        if adapter.get('rooms'):
            try:
                adapter['rooms'] = int(adapter['rooms'])
            except (ValueError, TypeError):
                adapter['rooms'] = None
        
        return item


class PropertyTransformPipeline:
    """Transforma los datos crudos al formato esperado por el backend"""
    
    def process_item(self, item, spider):
        adapter = ItemAdapter(item)
        raw = adapter.get('raw', {})
        
        # Extraer datos del raw JSON
        price_obj = raw.get('price', {})
        features = raw.get('features', {})
        property_type = raw.get('propertyType', {})
        
        # Construir objeto de propiedad final
        transformed = {
            'external_id': f"fotocasa-{adapter.get('ad_id')}",
            'portal_origen': 'fotocasa',
            'titulo': raw.get('title', 'Sin título'),
            'descripcion': raw.get('description'),
            'precio': price_obj.get('amount', 0) if isinstance(price_obj, dict) else (price_obj or 0),
            'ubicacion': self._build_location(adapter, raw),
            'tipo_propiedad': property_type.get('id', 'piso') if isinstance(property_type, dict) else 'piso',
            'dormitorios': features.get('bedrooms'),
            'banos': features.get('bathrooms'),
            'metros': adapter.get('surface'),
            'condition': features.get('condition'),
            'ano_construccion': features.get('builtYear'),
            'tiene_ascensor': bool(features.get('hasLift', False)),
            'tiene_parking': bool(features.get('parking', False)),
            'url': raw.get('url') or f"https://www.fotocasa.es/vivienda/{adapter.get('ad_id')}",
            'imagenes': raw.get('images', []),
        }
        
        # Actualizar el item con los datos transformados
        adapter.update(transformed)
        return item
    
    def _build_location(self, adapter, raw):
        """Construye la ubicación completa desde province y municipality"""
        province = adapter.get('province')
        municipality = adapter.get('municipality')
        
        # Intentar también desde raw si no está en adapter
        if not province:
            province_obj = raw.get('province', {})
            if isinstance(province_obj, dict):
                province = province_obj.get('label')
        
        if not municipality:
            municipality_obj = raw.get('municipality', {})
            if isinstance(municipality_obj, dict):
                municipality = municipality_obj.get('label')
        
        # Construir ubicación
        if municipality and province:
            return f"{municipality}, {province}"
        elif province:
            return province
        else:
            return "Desconocida"


class DuplicateFilterPipeline:
    """Filtra items duplicados basándose en ad_id"""
    
    def __init__(self):
        self.ids_seen = set()
    
    def process_item(self, item, spider):
        adapter = ItemAdapter(item)
        ad_id = adapter.get('ad_id')
        
        if ad_id in self.ids_seen:
            spider.logger.debug(f"🔄 Duplicado detectado: {ad_id}")
            raise DropItem(f"Duplicate item found: {ad_id}")
        else:
            self.ids_seen.add(ad_id)
            return item


class DropItem(Exception):
    """Excepción para descartar items"""
    pass
