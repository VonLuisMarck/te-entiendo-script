export const SUBSCRIPTION_TIERS = {
  free: {
    name: 'Free',
    price: 0,
    priceId: null,
    productId: null,
    features: [
      '5 matchings/mes',
      'Sin alertas WhatsApp',
      'Sin análisis reforma',
      'Dashboard demo nacional'
    ],
    limits: {
      matchings: 5,
      alertas: false,
      analisisReforma: 0,
      dashboard: 'nacional',
      descargas: false
    }
  },
  basic: {
    name: 'Básico',
    price: 9.99,
    priceId: 'price_1SNVunIZNGNvNT1eDLHxmlM2',
    productId: 'prod_TKAF23fhblkfJU',
    features: [
      '20 matchings/mes',
      'Alertas WhatsApp semanales (1 ubicación)',
      '3 análisis reforma/mes',
      'Métricas nacionales'
    ],
    limits: {
      matchings: 20,
      alertas: true,
      periodicidadAlertas: 'semanal',
      maxUbicaciones: 1,
      analisisReforma: 3,
      dashboard: 'nacional',
      descargas: false
    }
  },
  investor: {
    name: 'Inversor',
    price: 49.99,
    priceId: 'price_1SNVvAIZNGNvNT1eZt8aW9BO',
    productId: 'prod_TKAFdxpTBCEdel',
    features: [
      'Matchings ilimitados',
      'Alertas WhatsApp diarias (5 provincias)',
      'Análisis reforma ilimitados',
      'Dashboard por provincia',
      '€/m² y evolución histórica',
      'Datos INE (población, renta)',
      'Descargas PDF/Excel/CSV'
    ],
    limits: {
      matchings: null,
      alertas: true,
      periodicidadAlertas: 'diaria',
      maxUbicaciones: 5,
      analisisReforma: null,
      dashboard: 'provincia',
      descargas: true,
      formatosDescarga: ['pdf', 'excel', 'csv'],
      accesoINE: true
    }
  },
  investor_platino: {
    name: 'Inversor Platino',
    price: 149.99,
    priceId: 'price_1SNVvUIZNGNvNT1eq1p9SZ7l',
    productId: 'prod_TKAGwOzkUFemBK',
    features: [
      'Todo lo de Inversor +',
      'Alertas inmediatas (< 1 hora)',
      'Dashboard por distrito',
      'Heatmaps €/m² distrito',
      'Predicción IA zonas emergentes',
      'API REST (100 calls/día)',
      'Histórico completo (2+ años)',
      'Soporte prioritario WhatsApp',
      'Asesoría inversión 1h/mes'
    ],
    limits: {
      matchings: null,
      alertas: true,
      periodicidadAlertas: 'inmediata',
      maxUbicaciones: null,
      analisisReforma: null,
      dashboard: 'distrito',
      descargas: true,
      formatosDescarga: ['pdf', 'excel', 'csv', 'api'],
      accesoINE: true,
      apiAccess: true,
      soportePrioritario: true
    }
  }
} as const;

export type SubscriptionTier = keyof typeof SUBSCRIPTION_TIERS;