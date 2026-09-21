import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface SystemMetrics {
  propiedades: {
    total: number;
    activas: number;
    nuevasSemana: number;
    precioMedio: number;
    precioM2Medio: number;
  };
  clientes: {
    total: number;
    free: number;
    basic: number;
    investor: number;
    activos: number;
  };
  matchings: {
    total: number;
    semana: number;
    scorePromedio: number | null;
    notificados: number;
  };
  scraping: {
    logsTotal: number;
    totalScraped: number;
    totalNuevas: number;
    duracionMedia: number;
  };
}

export const generateBusinessReport = (metrics: SystemMetrics) => {
  const doc = new jsPDF();
  doc.setFontSize(22);
  doc.text('Findoo · Estado del piloto', 18, 24);
  doc.setFontSize(10);
  doc.text(`Generado: ${new Date().toLocaleString('es-ES')}`, 18, 34);
  doc.text('Indicadores de la consulta del panel; no constituyen una auditoría completa.', 18, 43);
  autoTable(doc, { startY: 52, head: [['Indicador', 'Valor observado']], body: [
    ['Anuncios recuperados', String(metrics.propiedades.total)],
    ['Anuncios activos recuperados', String(metrics.propiedades.activas)],
    ['Clientes recuperados', String(metrics.clientes.total)],
    ['Recomendaciones recuperadas', String(metrics.matchings.total)],
    ['Ejecuciones registradas recuperadas', String(metrics.scraping.logsTotal)],
  ] });
  doc.setFontSize(12);
  doc.text('Arquitectura independiente', 18, 125);
  doc.setFontSize(10);
  doc.text([
    'Frontend React: compilación estática y alojamiento propio.',
    'Supabase: autenticación, PostgreSQL y funciones en una cuenta propia.',
    'Workers Node: navegador Chromium conectado por CDP y captura JSON.',
    'Datos brutos persistidos, adaptadores versionados y reprocesamiento.',
    '',
    'Pendiente: validar adaptadores con respuestas reales de cada portal,',
    'migrar las cuentas y datos del entorno anterior y medir costes reales.',
    'Los cobros siguen desactivados durante el piloto.',
  ], 18, 136, {lineHeightFactor: 1.7});
  doc.save('Findoo-Estado-Piloto.pdf');
};
