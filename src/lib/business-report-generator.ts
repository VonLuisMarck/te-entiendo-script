import jsPDF from 'jspdf';
import 'jspdf-autotable';

export const generateBusinessReport = () => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let yPos = 20;

  // Portada
  doc.setFillColor(41, 128, 185);
  doc.rect(0, 0, pageWidth, pageHeight, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(36);
  doc.text('InmoFinder', pageWidth / 2, 80, { align: 'center' });
  
  doc.setFontSize(20);
  doc.text('Documentación Técnica y de Negocio', pageWidth / 2, 100, { align: 'center' });
  
  doc.setFontSize(14);
  doc.text('Análisis de Arquitectura, Flujos y Costes', pageWidth / 2, 120, { align: 'center' });
  
  doc.setFontSize(12);
  const date = new Date().toLocaleDateString('es-ES', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
  doc.text(date, pageWidth / 2, 260, { align: 'center' });

  // Página 2: Índice
  doc.addPage();
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(24);
  doc.text('Índice', 20, 30);
  
  doc.setFontSize(12);
  const index = [
    '1. Arquitectura Global del Sistema ...................... 3',
    '2. Flujo de Caso de Uso: Clientes ....................... 4',
    '3. Flujo de Caso de Uso: Empleados .................. 5',
    '4. Análisis de Costes y Escalabilidad ................... 6',
    '5. Métricas de ROI y Break-even ........................ 7'
  ];
  
  yPos = 50;
  index.forEach(item => {
    doc.text(item, 30, yPos);
    yPos += 10;
  });

  // Página 3: Arquitectura Global
  doc.addPage();
  doc.setFontSize(20);
  doc.setTextColor(41, 128, 185);
  doc.text('1. Arquitectura Global del Sistema', 20, 20);
  
  doc.setFontSize(11);
  doc.setTextColor(0, 0, 0);
  
  // Frontend
  doc.setFillColor(76, 175, 80);
  doc.rect(20, 35, 80, 25, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(12);
  doc.text('PORTAL CLIENTE', 60, 45, { align: 'center' });
  doc.setFontSize(9);
  doc.text('(Público)', 60, 52, { align: 'center' });
  
  doc.setFillColor(255, 152, 0);
  doc.rect(110, 35, 80, 25, 'F');
  doc.text('PORTAL ADMIN', 150, 45, { align: 'center' });
  doc.text('(Privado)', 150, 52, { align: 'center' });
  
  // Backend
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10);
  doc.text('↓', 60, 65, { align: 'center' });
  doc.text('↓', 150, 65, { align: 'center' });
  
  doc.setFillColor(33, 150, 243);
  doc.rect(20, 70, 170, 50, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11);
  doc.text('LOVABLE CLOUD BACKEND', 105, 80, { align: 'center' });
  doc.setFontSize(9);
  doc.text('• Supabase Auth (Autenticación)', 30, 92);
  doc.text('• PostgreSQL (Base de Datos)', 30, 100);
  doc.text('• Edge Functions (Lógica Negocio)', 30, 108);
  
  // Scrapers
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10);
  doc.text('↓', 105, 125, { align: 'center' });
  
  doc.setFillColor(156, 39, 176);
  doc.rect(20, 130, 80, 30, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.text('SCRAPERS PYTHON', 60, 140, { align: 'center' });
  doc.setFontSize(8);
  doc.text('Fotocasa | Pisos.com', 60, 148, { align: 'center' });
  doc.text('Fly.io Deployment', 60, 155, { align: 'center' });
  
  // Integraciones
  doc.setFillColor(120, 120, 120);
  doc.rect(110, 130, 80, 30, 'F');
  doc.setFontSize(10);
  doc.text('INTEGRACIONES', 150, 140, { align: 'center' });
  doc.setFontSize(8);
  doc.text('Stripe | WhatsApp', 150, 148, { align: 'center' });
  doc.text('ElevenLabs | Lovable AI', 150, 155, { align: 'center' });
  
  // Descripción
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10);
  const archDesc = [
    'El sistema se estructura en 4 capas principales:',
    '',
    '• Frontend: Dos portales independientes (cliente público y admin privado)',
    '• Backend: Lovable Cloud con Supabase para auth, BD y funciones',
    '• Scrapers: Python en Fly.io extrayendo 30K+ propiedades/día',
    '• Integraciones: Servicios externos (pagos, notificaciones, IA)'
  ];
  
  yPos = 175;
  archDesc.forEach(line => {
    doc.text(line, 20, yPos);
    yPos += 7;
  });

  // Página 4: Flujo Clientes
  doc.addPage();
  doc.setFontSize(20);
  doc.setTextColor(41, 128, 185);
  doc.text('2. Flujo de Caso de Uso: Clientes', 20, 20);
  
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  
  // Diagrama de flujo simplificado
  const clientFlow = [
    { step: '1', title: 'REGISTRO/LOGIN', desc: 'Cliente se registra con email/contraseña', y: 35 },
    { step: '2', title: 'CREAR PERFIL', desc: 'Define criterios: ubicación, precio, metros, etc.', y: 60 },
    { step: '3', title: 'PLAN FREE', desc: 'Comienza con 5 matchings/mes gratuitos', y: 85 },
    { step: '4', title: 'UPGRADE (Opcional)', desc: 'Stripe: Basic (€29) o Investor (€99/€199)', y: 110 },
    { step: '5', title: 'RECIBIR MATCHINGS', desc: 'Notificaciones WhatsApp cuando score > 70%', y: 135 },
    { step: '6', title: 'GESTIONAR FAVORITOS', desc: 'Marcar propiedades, ver detalles, contactar', y: 160 },
    { step: '7', title: 'DASHBOARD IA', desc: 'Solo Investor: métricas, proyecciones, análisis', y: 185 }
  ];
  
  clientFlow.forEach(item => {
    doc.setFillColor(76, 175, 80);
    doc.circle(30, item.y, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.text(item.step, 30, item.y + 3, { align: 'center' });
    
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(item.title, 45, item.y);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(item.desc, 45, item.y + 6);
    
    if (item.step !== '7') {
      doc.setDrawColor(200, 200, 200);
      doc.line(30, item.y + 8, 30, item.y + 17);
    }
  });
  
  // Notas importantes
  doc.setFillColor(255, 243, 205);
  doc.rect(20, 210, 170, 50, 'F');
  doc.setDrawColor(255, 193, 7);
  doc.rect(20, 210, 170, 50);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('💡 Puntos Clave del Flujo:', 25, 220);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('• Onboarding simple: registro en 2 minutos', 25, 230);
  doc.text('• Freemium model: todos empiezan gratis para validar valor', 25, 238);
  doc.text('• Notificaciones proactivas: cliente no busca, recibe alertas', 25, 246);
  doc.text('• Upsell natural: dashboard IA solo visible con plan Investor', 25, 254);

  // Página 5: Flujo Empleados
  doc.addPage();
  doc.setFontSize(20);
  doc.setTextColor(41, 128, 185);
  doc.text('3. Flujo de Caso de Uso: Empleados', 20, 20);
  
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  
  const employeeFlow = [
    { 
      title: 'GESTIÓN DE SCRAPING',
      color: [200, 220, 250],
      items: [
        '• Configurar triggers automáticos (1h, 6h, 12h, 24h)',
        '• Lanzar scraping masivo "Toda España"',
        '• Monitorear logs en tiempo real',
        '• Gestionar histórico de 30K+ propiedades/día'
      ],
      y: 40
    },
    {
      title: 'SISTEMA DE MATCHINGS',
      color: [200, 250, 220],
      items: [
        '• Revisar matchings generados automáticamente',
        '• Analizar score de compatibilidad (0-100)',
        '• Ver métricas de mercado por propiedad',
        '• Validar calidad de coincidencias'
      ],
      y: 100
    },
    {
      title: 'SEGUIMIENTO CON IA',
      color: [250, 220, 200],
      items: [
        '• Programar llamadas automáticas con ElevenLabs',
        '• Revisar transcripciones y resultados',
        '• Analizar sentimiento de conversaciones',
        '• Agendar visitas cuando cliente interesado'
      ],
      y: 160
    },
    {
      title: 'GESTIÓN DE CLIENTES',
      color: [240, 240, 240],
      items: [
        '• Dashboard con métricas por cliente',
        '• Monitorear uso de suscripciones',
        '• Tracking de conversiones Free → Paid',
        '• Soporte y atención personalizada'
      ],
      y: 220
    }
  ];
  
  employeeFlow.forEach(section => {
    doc.setFillColor(section.color[0], section.color[1], section.color[2]);
    doc.rect(20, section.y, 170, 45, 'F');
    doc.setDrawColor(100, 100, 100);
    doc.rect(20, section.y, 170, 45);
    
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text(section.title, 25, section.y + 8);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    let itemY = section.y + 18;
    section.items.forEach(item => {
      doc.text(item, 25, itemY);
      itemY += 7;
    });
  });

  // Página 6: Costes y Escalabilidad
  doc.addPage();
  doc.setFontSize(20);
  doc.setTextColor(41, 128, 185);
  doc.text('4. Análisis de Costes y Escalabilidad', 20, 20);
  
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  
  // Tabla de costes
  (doc as any).autoTable({
    startY: 35,
    head: [['Componente', 'Inicial', 'Medio', 'Alto', 'Notas']],
    body: [
      ['Lovable Pro', '$25', '$25', '$100', '150 créditos/mes'],
      ['Lovable Cloud', 'Incluido', 'Incluido', 'Incluido', 'BD + Auth + Functions'],
      ['Storage', '1GB gratis', '$0.02/GB', '$2 (100GB)', 'Imágenes propiedades'],
      ['Bandwidth', '5GB gratis', '$0.09/GB', '$9 (100GB)', 'Transferencia datos'],
      ['Edge Functions', '500K inv.', '2M inv.', '10M+', '$2/millón extra'],
      ['Lovable AI', '$0.15/1M', '$30', '$150', 'Gemini Flash'],
      ['Scrapers Fly.io', '$0', '$25', '$100', '256MB RAM base'],
      ['Stripe', '1.5% + €0.25', '1.5% + €0.25', 'Negociable', 'Por transacción'],
      ['Twilio WhatsApp', '$0.005/msg', '$50 (10K)', '$200 (40K)', 'Notificaciones'],
      ['ElevenLabs', '$0.30/min', '$100 (5h)', '$500 (25h)', 'Llamadas IA']
    ],
    foot: [['TOTAL ESTIMADO', '$25-50/mes', '$250-300/mes', '$1,100/mes', '']],
    theme: 'grid',
    headStyles: { fillColor: [41, 128, 185], fontSize: 9 },
    footStyles: { fillColor: [76, 175, 80], fontStyle: 'bold', fontSize: 9 },
    styles: { fontSize: 8, cellPadding: 2 },
    columnStyles: {
      0: { cellWidth: 40 },
      1: { cellWidth: 30, halign: 'right' },
      2: { cellWidth: 30, halign: 'right' },
      3: { cellWidth: 30, halign: 'right' },
      4: { cellWidth: 40 }
    }
  });
  
  // Desglose por etapa
  yPos = (doc as any).lastAutoTable.finalY + 15;
  
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('📊 Desglose por Etapa del Negocio', 20, yPos);
  
  const stages = [
    {
      title: '🌱 MVP / Primeros 10 Clientes',
      data: [
        '1,000-5,000 propiedades en BD',
        '50-100 matchings/día',
        '50 notificaciones WhatsApp/día',
        'Coste: ~$50/mes | Storage: <500 MB'
      ]
    },
    {
      title: '🚀 Crecimiento / 50-100 Clientes',
      data: [
        '10,000-30,000 propiedades',
        '500-1,000 matchings/día',
        '500 notificaciones/día',
        'Coste: ~$300/mes | Storage: 5-10 GB'
      ]
    },
    {
      title: '💼 Consolidación / 500+ Clientes',
      data: [
        '50,000-100,000 propiedades activas',
        '5,000+ matchings/día',
        '2,000 notificaciones/día',
        'Coste: ~$1,100/mes | Storage: 50-100 GB'
      ]
    }
  ];
  
  yPos += 10;
  stages.forEach(stage => {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(stage.title, 20, yPos);
    yPos += 7;
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    stage.data.forEach(line => {
      doc.text('• ' + line, 25, yPos);
      yPos += 6;
    });
    yPos += 3;
  });

  // Página 7: ROI
  doc.addPage();
  doc.setFontSize(20);
  doc.setTextColor(41, 128, 185);
  doc.text('5. Métricas de ROI y Break-even', 20, 20);
  
  doc.setFontSize(12);
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.text('Modelo de Suscripción', 20, 35);
  
  // Planes
  (doc as any).autoTable({
    startY: 40,
    head: [['Plan', 'Precio', 'Matchings', 'Características']],
    body: [
      ['Free', '€0/mes', '5/mes', 'Adquisición y validación'],
      ['Basic', '€29/mes', '20/mes', 'Notificaciones WhatsApp'],
      ['Investor', '€99/mes', 'Ilimitado', '+ Dashboard IA + Métricas'],
      ['Investor Platino', '€199/mes', 'Ilimitado', '+ Todo + Llamadas IA']
    ],
    theme: 'striped',
    headStyles: { fillColor: [41, 128, 185] },
    styles: { fontSize: 10 }
  });
  
  yPos = (doc as any).lastAutoTable.finalY + 15;
  
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('🎯 Proyección de Break-even', 20, yPos);
  
  yPos += 10;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  
  const breakeven = [
    { scenario: 'Cubrir MVP', clients: '2 clientes Basic', revenue: '€58/mes', cost: '$50', margin: '+€8' },
    { scenario: 'Escalado Medio', clients: '10 clientes (5B + 3I + 2F)', revenue: '€442/mes', cost: '$300', margin: '+€142' },
    { scenario: 'Rentabilidad Alta', clients: '50 clientes (60% conversión)', revenue: '€2,185/mes', cost: '$1,100', margin: '+€1,085' }
  ];
  
  (doc as any).autoTable({
    startY: yPos,
    head: [['Escenario', 'Clientes', 'Ingresos', 'Costes', 'Margen']],
    body: breakeven.map(b => [b.scenario, b.clients, b.revenue, b.cost, b.margin]),
    theme: 'grid',
    headStyles: { fillColor: [76, 175, 80] },
    bodyStyles: { fontSize: 9 },
    columnStyles: {
      4: { fontStyle: 'bold', textColor: [46, 125, 50] }
    }
  });
  
  yPos = (doc as any).lastAutoTable.finalY + 15;
  
  // KPIs clave
  doc.setFillColor(232, 245, 233);
  doc.rect(20, yPos, 170, 60, 'F');
  doc.setDrawColor(76, 175, 80);
  doc.rect(20, yPos, 170, 60);
  
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('📈 KPIs Clave para Seguimiento', 25, yPos + 10);
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const kpis = [
    '• Tasa de conversión Free → Paid: Objetivo 30-40%',
    '• Churn rate mensual: <5% (retención alta)',
    '• CAC (Coste Adquisición Cliente): <€50 via ads',
    '• LTV (Lifetime Value): €600-1,200 (12-24 meses)',
    '• Ratio LTV/CAC: >3x (ideal 6x+)',
    '• Matchings por cliente/mes: 15-25 (engagement)',
    '• Time to value: <7 días (primer matching relevante)'
  ];
  
  let kpiY = yPos + 20;
  kpis.forEach(kpi => {
    doc.text(kpi, 25, kpiY);
    kpiY += 7;
  });

  // Guardar PDF
  doc.save('InmoFinder_Documentacion_Negocio.pdf');
};
