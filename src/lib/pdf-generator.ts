import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface PropiedadAnalisis {
  propiedad: any;
  matching?: any;
  metrica?: any;
  clientePerfil?: string;
}

export const generarPDFAnalisis = async ({
  propiedad,
  matching,
  metrica,
  clientePerfil = 'vivir'
}: PropiedadAnalisis) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  const margin = 15;
  let yPosition = 20;

  // === HEADER ===
  doc.setFillColor(59, 130, 246); // primary blue
  doc.rect(0, 0, pageWidth, 30, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('InmoFinder', margin, 15);
  
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text('Análisis Inteligente de Propiedad', margin, 23);

  // Fecha
  doc.setFontSize(9);
  doc.text(new Date().toLocaleDateString('es-ES', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  }), pageWidth - margin, 23, { align: 'right' });

  yPosition = 40;
  doc.setTextColor(0, 0, 0);

  // === INFORMACIÓN BÁSICA ===
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(59, 130, 246);
  doc.text('📋 Información de la Propiedad', margin, yPosition);
  yPosition += 10;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);

  const infoProp = [
    ['Ubicación', propiedad.ubicacion],
    ['Tipo', propiedad.tipo_propiedad],
    ['Precio', `${formatNumber(propiedad.precio)} €`],
    ['Precio/m²', `${formatNumber(propiedad.precio_m2)} €/m²`],
    ['Superficie', `${propiedad.metros} m²`],
    ['Dormitorios', propiedad.dormitorios || 'N/A'],
    ['Baños', propiedad.banos || 'N/A'],
    ['Estado', propiedad.condition || 'N/A'],
    ['Ascensor', propiedad.tiene_ascensor ? 'Sí' : 'No'],
    ['Parking', propiedad.tiene_parking ? 'Sí' : 'No'],
  ];

  autoTable(doc, {
    startY: yPosition,
    head: [],
    body: infoProp,
    theme: 'plain',
    styles: { fontSize: 10, cellPadding: 2 },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 50 },
      1: { cellWidth: 'auto' }
    },
    margin: { left: margin, right: margin }
  });

  yPosition = (doc as any).lastAutoTable.finalY + 15;

  // === ANÁLISIS DE MERCADO ===
  if (matching?.analisis_mercado?.disponible) {
    const analisis = matching.analisis_mercado;
    
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(59, 130, 246);
    doc.text('📊 Análisis Comparativo de Mercado', margin, yPosition);
    yPosition += 10;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);

    const desviacion = analisis.desviacion_porcentaje;
    let estadoMercado = '';
    let colorEstado = [0, 0, 0];

    if (desviacion <= -20) {
      estadoMercado = '🚀 CHOLLAZO - Oportunidad excepcional';
      colorEstado = [34, 197, 94]; // green
    } else if (desviacion <= -10) {
      estadoMercado = '⭐ BUENA OPORTUNIDAD - Precio inferior al mercado';
      colorEstado = [34, 197, 94];
    } else if (desviacion <= -5) {
      estadoMercado = '✅ OPORTUNIDAD - Ligero descuento';
      colorEstado = [59, 130, 246]; // blue
    } else if (desviacion <= 10) {
      estadoMercado = '➡️ PRECIO JUSTO - En línea con el mercado';
      colorEstado = [107, 114, 128]; // gray
    } else if (desviacion <= 20) {
      estadoMercado = '⚠️ CARO - Precio superior al mercado';
      colorEstado = [234, 179, 8]; // yellow
    } else {
      estadoMercado = '🔴 SOBREVALORADO - Muy por encima del mercado';
      colorEstado = [239, 68, 68]; // red
    }

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(colorEstado[0], colorEstado[1], colorEstado[2]);
    doc.text(estadoMercado, margin, yPosition);
    yPosition += 8;

    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);

    const mercadoData = [
      ['Precio/m² Propiedad', `${formatNumber(analisis.precio_m2_propiedad)} €/m²`],
      ['Precio/m² Mercado', `${formatNumber(analisis.precio_m2_mercado)} €/m²`],
      ['Desviación', `${desviacion > 0 ? '+' : ''}${desviacion.toFixed(1)}%`],
      ['Comparado con', analisis.metricas_usadas === 'barrio' ? 'Barrio específico' : 'Ciudad completa'],
      ['Propiedades analizadas', `${analisis.total_propiedades_comparadas} propiedades`],
    ];

    autoTable(doc, {
      startY: yPosition,
      body: mercadoData,
      theme: 'striped',
      styles: { fontSize: 10, cellPadding: 3 },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 70 },
        1: { cellWidth: 'auto' }
      },
      margin: { left: margin, right: margin }
    });

    yPosition = (doc as any).lastAutoTable.finalY + 15;
  }

  // === PROYECCIÓN DE REVALORIZACIÓN ===
  if (metrica) {
    // Check if new page needed
    if (yPosition > 240) {
      doc.addPage();
      yPosition = 20;
    }

    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(59, 130, 246);
    doc.text('📈 Proyección de Revalorización', margin, yPosition);
    yPosition += 10;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);

    const proyData = [];

    if (metrica.proyeccion_revalorizacion_anual !== null && metrica.meses_datos_historicos >= 3) {
      const proy = metrica.proyeccion_revalorizacion_anual;
      let estadoProy = '';
      
      if (proy >= 5) estadoProy = '🚀 Zona en fuerte crecimiento';
      else if (proy >= 2) estadoProy = '📈 Zona en crecimiento moderado';
      else if (proy > 0) estadoProy = '↗️ Zona con crecimiento leve';
      else if (proy >= -2) estadoProy = '→ Zona estable';
      else estadoProy = '📉 Zona en descenso';

      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(proy >= 2 ? 34 : proy >= 0 ? 59 : 239, proy >= 2 ? 197 : proy >= 0 ? 130 : 68, proy >= 2 ? 94 : proy >= 0 ? 246 : 68);
      doc.text(estadoProy, margin, yPosition);
      yPosition += 8;

      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);

      proyData.push(
        ['Proyección anual', `${proy > 0 ? '+' : ''}${proy.toFixed(1)}%`],
        ['Basado en', `${metrica.meses_datos_historicos} meses de datos históricos`],
        ['Valor estimado en 1 año', `${formatNumber(Math.round(propiedad.precio * (1 + proy / 100)))} €`],
        ['Plusvalía potencial', `${formatNumber(Math.round(propiedad.precio * (proy / 100)))} €`]
      );
    } else if (metrica.indice_dinamismo !== null) {
      const dinamismo = metrica.indice_dinamismo;
      let estadoDin = '';
      
      if (dinamismo >= 80) estadoDin = '🔥 Mercado muy activo';
      else if (dinamismo >= 60) estadoDin = '💪 Mercado activo';
      else if (dinamismo >= 40) estadoDin = '📊 Mercado moderado';
      else estadoDin = '🐢 Mercado tranquilo';

      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(dinamismo >= 60 ? 34 : 107, dinamismo >= 60 ? 197 : 114, dinamismo >= 60 ? 94 : 128);
      doc.text(estadoDin, margin, yPosition);
      yPosition += 8;

      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);

      proyData.push(
        ['Índice de dinamismo', `${Math.round(dinamismo)}/100`],
        ['Estado', 'Acumulando datos históricos...'],
        ['Proyección disponible en', `${Math.max(0, 3 - (metrica.meses_datos_historicos || 0))} meses`]
      );
    }

    if (proyData.length > 0) {
      autoTable(doc, {
        startY: yPosition,
        body: proyData,
        theme: 'striped',
        styles: { fontSize: 10, cellPadding: 3 },
        columnStyles: {
          0: { fontStyle: 'bold', cellWidth: 70 },
          1: { cellWidth: 'auto' }
        },
        margin: { left: margin, right: margin }
      });

      yPosition = (doc as any).lastAutoTable.finalY + 15;
    }
  }

  // === SCORE Y COMPATIBILIDAD ===
  if (matching) {
    if (yPosition > 230) {
      doc.addPage();
      yPosition = 20;
    }

    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(59, 130, 246);
    doc.text('🎯 Análisis de Compatibilidad', margin, yPosition);
    yPosition += 10;

    // Score badge
    const score = matching.score;
    let scoreColor = [107, 114, 128]; // gray
    let scoreLabel = 'Bajo';
    
    if (score >= 80) {
      scoreColor = [34, 197, 94]; // green
      scoreLabel = 'Excelente';
    } else if (score >= 70) {
      scoreColor = [59, 130, 246]; // blue
      scoreLabel = 'Muy bueno';
    } else if (score >= 60) {
      scoreColor = [234, 179, 8]; // yellow
      scoreLabel = 'Bueno';
    }

    doc.setFillColor(scoreColor[0], scoreColor[1], scoreColor[2]);
    doc.roundedRect(margin, yPosition, 50, 12, 2, 2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(`Score: ${Math.round(score)}`, margin + 25, yPosition + 8, { align: 'center' });

    doc.setTextColor(scoreColor[0], scoreColor[1], scoreColor[2]);
    doc.setFontSize(10);
    doc.text(scoreLabel, margin + 55, yPosition + 8);

    yPosition += 20;

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');

    if (matching.criterios_cumplidos) {
      const criterios = matching.criterios_cumplidos;
      const criteriosData = [
        ['✓ Presupuesto', criterios.presupuesto ? 'Cumple' : 'No cumple'],
        ['✓ Ubicación', criterios.ubicacion ? 'Cumple' : 'No cumple'],
        ['✓ Tipo de propiedad', criterios.tipo_propiedad ? 'Cumple' : 'No cumple'],
        ['✓ Dormitorios', criterios.dormitorios ? 'Cumple' : 'No cumple'],
        ['✓ Metros', criterios.metros ? 'Cumple' : 'No cumple'],
      ];

      autoTable(doc, {
        startY: yPosition,
        body: criteriosData,
        theme: 'plain',
        styles: { fontSize: 10, cellPadding: 2 },
        columnStyles: {
          0: { fontStyle: 'bold', cellWidth: 70 },
          1: { cellWidth: 'auto' }
        },
        margin: { left: margin, right: margin }
      });

      yPosition = (doc as any).lastAutoTable.finalY + 15;
    }
  }

  // === CONCLUSIONES ===
  if (yPosition > 220) {
    doc.addPage();
    yPosition = 20;
  }

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(59, 130, 246);
  doc.text('💡 Conclusiones InmoFinder', margin, yPosition);
  yPosition += 10;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);

  const conclusiones = generarConclusiones({
    propiedad,
    matching,
    metrica,
    clientePerfil
  });

  doc.setFillColor(239, 246, 255); // light blue
  doc.roundedRect(margin, yPosition, pageWidth - 2 * margin, conclusiones.length * 7 + 10, 3, 3, 'F');
  
  yPosition += 7;
  conclusiones.forEach((conclusion) => {
    doc.text(`• ${conclusion}`, margin + 5, yPosition, {
      maxWidth: pageWidth - 2 * margin - 10
    });
    yPosition += 7;
  });

  yPosition += 10;

  // === FOOTER ===
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(107, 114, 128);
    doc.text(
      `Página ${i} de ${pageCount} | InmoFinder © ${new Date().getFullYear()} | Análisis generado automáticamente`,
      pageWidth / 2,
      doc.internal.pageSize.height - 10,
      { align: 'center' }
    );
  }

  // Guardar PDF
  const fileName = `InmoFinder_${propiedad.ubicacion.replace(/[,\s]/g, '_')}_${Date.now()}.pdf`;
  doc.save(fileName);
};

function generarConclusiones({ propiedad, matching, metrica, clientePerfil }: any): string[] {
  const conclusiones: string[] = [];

  // Análisis de precio vs mercado
  if (matching?.analisis_mercado?.disponible) {
    const desv = matching.analisis_mercado.desviacion_porcentaje;
    if (desv <= -15) {
      conclusiones.push('Esta propiedad presenta un precio significativamente inferior al mercado local, representando una excelente oportunidad de compra.');
    } else if (desv <= -5) {
      conclusiones.push('El precio está ligeramente por debajo del mercado, ofreciendo un buen valor por el dinero.');
    } else if (desv >= 15) {
      conclusiones.push('El precio está considerablemente por encima del promedio del mercado. Se recomienda negociar o buscar alternativas.');
    }
  }

  // Proyección de revalorización
  if (metrica?.proyeccion_revalorizacion_anual !== null && metrica.meses_datos_historicos >= 3) {
    const proy = metrica.proyeccion_revalorizacion_anual;
    if (proy >= 5) {
      conclusiones.push(`La zona muestra una tendencia de crecimiento fuerte (+${proy.toFixed(1)}% anual), ideal para inversión a medio-largo plazo.`);
    } else if (proy >= 2) {
      conclusiones.push(`La revalorización esperada es positiva (+${proy.toFixed(1)}% anual), ofreciendo seguridad de inversión.`);
    } else if (proy < 0) {
      conclusiones.push(`La zona presenta descenso de precios (${proy.toFixed(1)}% anual). Considerar si es estratégico para su perfil.`);
    }
  }

  // Análisis según perfil
  switch (clientePerfil) {
    case 'reformar':
      if (matching?.analisis_mercado?.es_chollo) {
        conclusiones.push('Propiedad apta para reforma y reventa: margen potencial identificado por algoritmo InmoFinder.');
      }
      if (propiedad.condition === 'a reformar') {
        conclusiones.push('Estado a reformar permite personalización total y maximizar ROI post-renovación.');
      }
      break;
    case 'alquilar':
      conclusiones.push(`Con ${propiedad.dormitorios || 0} dormitorios en ${propiedad.ubicacion}, presenta potencial de rentabilidad por alquiler.`);
      if (metrica?.indice_dinamismo >= 60) {
        conclusiones.push('Alta demanda en la zona según índice de dinamismo, facilitando ocupación del inmueble.');
      }
      break;
    case 'vivir':
      if (matching?.score >= 75) {
        conclusiones.push('Compatibilidad alta con sus criterios de búsqueda. Propiedad recomendada para visitar.');
      }
      if (propiedad.tiene_ascensor && propiedad.tiene_parking) {
        conclusiones.push('Cuenta con comodidades clave (ascensor + parking) que mejoran calidad de vida diaria.');
      }
      break;
  }

  // Recomendación final
  if (matching?.score >= 80 && matching?.analisis_mercado?.es_chollo) {
    conclusiones.push('🚀 RECOMENDACIÓN ALTA: Combine score elevado con precio inferior al mercado. Actuar rápido.');
  } else if (matching?.score >= 70) {
    conclusiones.push('✅ RECOMENDACIÓN: Propiedad bien valorada por nuestro algoritmo. Vale la pena considerarla.');
  }

  if (conclusiones.length === 0) {
    conclusiones.push('Análisis en progreso. Más datos históricos mejorarán las proyecciones en los próximos meses.');
  }

  return conclusiones;
}

function formatNumber(num: number | null): string {
  if (num === null || num === undefined) return 'N/A';
  return num.toLocaleString('es-ES', { maximumFractionDigits: 0 });
}
