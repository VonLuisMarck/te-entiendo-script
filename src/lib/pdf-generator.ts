import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface PropiedadAnalisis {
  propiedad: any;
  matching?: any;
  metrica?: any;
  clientePerfil?: string;
}

interface PresupuestoReforma {
  propiedad: any;
  clientePerfil?: string;
}

export const generarPDFAnalisis = async ({
  propiedad,
  matching,
  metrica,
  clientePerfil = 'vivir'
}: PropiedadAnalisis) => {
  const doc = new jsPDF({
    format: 'a4',
    unit: 'mm'
  });
  
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const margin = 15;
  let yPosition = 20;

  // Helper para verificar si necesitamos nueva página
  const checkNewPage = (requiredSpace: number) => {
    if (yPosition + requiredSpace > pageHeight - 30) {
      doc.addPage();
      yPosition = 20;
      return true;
    }
    return false;
  };

  // === HEADER ===
  doc.setFillColor(59, 130, 246);
  doc.rect(0, 0, pageWidth, 35, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text('InmoFinder', margin, 18);
  
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text('Analisis Inteligente de Propiedad', margin, 28);

  doc.setFontSize(9);
  const fecha = new Date().toLocaleDateString('es-ES');
  doc.text(fecha, pageWidth - margin, 28, { align: 'right' });

  yPosition = 45;
  doc.setTextColor(0, 0, 0);

  // === INFORMACION BASICA ===
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(59, 130, 246);
  doc.text('Informacion de la Propiedad', margin, yPosition);
  yPosition += 8;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);

  const infoProp = [
    ['Ubicacion', propiedad.ubicacion],
    ['Tipo', propiedad.tipo_propiedad],
    ['Precio', `${formatNumber(propiedad.precio)} EUR`],
    ['Precio/m2', `${formatNumber(propiedad.precio_m2)} EUR/m2`],
    ['Superficie', `${propiedad.metros} m2`],
    ['Dormitorios', propiedad.dormitorios || 'N/A'],
    ['Banos', propiedad.banos || 'N/A'],
    ['Estado', propiedad.condition || 'No aparece'],
    ['Ascensor', propiedad.tiene_ascensor === true ? 'Si' : propiedad.tiene_ascensor === false ? 'No' : 'No aparece'],
    ['Parking', propiedad.tiene_parking === true ? 'Si' : propiedad.tiene_parking === false ? 'No' : 'No aparece'],
  ];

  autoTable(doc, {
    startY: yPosition,
    head: [],
    body: infoProp,
    theme: 'striped',
    styles: { 
      fontSize: 9,
      cellPadding: 3,
      font: 'helvetica'
    },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 45, fillColor: [249, 250, 251] },
      1: { cellWidth: 'auto' }
    },
    margin: { left: margin, right: margin }
  });

  yPosition = (doc as any).lastAutoTable.finalY + 12;

  // === DESCRIPCION DEL ANUNCIO ===
  if (propiedad.descripcion) {
    checkNewPage(50);
    
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(59, 130, 246);
    doc.text('Descripcion del Anuncio', margin, yPosition);
    yPosition += 8;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);

    const descripcionText = doc.splitTextToSize(propiedad.descripcion, pageWidth - 2 * margin - 10);
    const descripcionHeight = descripcionText.length * 4 + 10;
    
    checkNewPage(descripcionHeight + 10);
    
    doc.setFillColor(249, 250, 251);
    doc.roundedRect(margin, yPosition, pageWidth - 2 * margin, descripcionHeight, 2, 2, 'F');
    
    yPosition += 6;
    doc.text(descripcionText, margin + 5, yPosition);
    yPosition += descripcionHeight + 6;
  }

  // === ANALISIS DE MERCADO ===
  if (matching?.analisis_mercado?.disponible) {
    checkNewPage(60);
    const analisis = matching.analisis_mercado;
    
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(59, 130, 246);
    doc.text('Analisis Comparativo de Mercado', margin, yPosition);
    yPosition += 8;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);

    const desviacion = analisis.desviacion_porcentaje;
    let estadoMercado = '';
    let colorEstado = [0, 0, 0];

    if (desviacion <= -20) {
      estadoMercado = 'CHOLLAZO - Oportunidad excepcional';
      colorEstado = [34, 197, 94];
    } else if (desviacion <= -10) {
      estadoMercado = 'BUENA OPORTUNIDAD - Precio inferior al mercado';
      colorEstado = [34, 197, 94];
    } else if (desviacion <= -5) {
      estadoMercado = 'OPORTUNIDAD - Ligero descuento';
      colorEstado = [59, 130, 246];
    } else if (desviacion <= 10) {
      estadoMercado = 'PRECIO JUSTO - En linea con el mercado';
      colorEstado = [107, 114, 128];
    } else if (desviacion <= 20) {
      estadoMercado = 'CARO - Precio superior al mercado';
      colorEstado = [234, 179, 8];
    } else {
      estadoMercado = 'SOBREVALORADO - Muy por encima del mercado';
      colorEstado = [239, 68, 68];
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
      ['Precio/m2 Propiedad', `${formatNumber(analisis.precio_m2_propiedad)} EUR/m2`],
      ['Precio/m2 Mercado', `${formatNumber(analisis.precio_m2_mercado)} EUR/m2`],
      ['Desviacion', `${desviacion > 0 ? '+' : ''}${desviacion.toFixed(1)}%`],
      ['Comparado con', analisis.metricas_usadas === 'barrio' ? 'Barrio especifico' : 'Ciudad completa'],
      ['Propiedades analizadas', `${analisis.total_propiedades_comparadas} propiedades`],
    ];

    autoTable(doc, {
      startY: yPosition,
      body: mercadoData,
      theme: 'striped',
      styles: { 
        fontSize: 9, 
        cellPadding: 3,
        font: 'helvetica'
      },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 60, fillColor: [249, 250, 251] },
        1: { cellWidth: 'auto' }
      },
      margin: { left: margin, right: margin }
    });

    yPosition = (doc as any).lastAutoTable.finalY + 12;
  }

  // === PROYECCION DE REVALORIZACION ===
  if (metrica) {
    checkNewPage(60);

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(59, 130, 246);
    doc.text('Proyeccion de Revalorizacion', margin, yPosition);
    yPosition += 8;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);

    const proyData = [];

    if (metrica.proyeccion_revalorizacion_anual !== null && metrica.meses_datos_historicos >= 3) {
      const proy = metrica.proyeccion_revalorizacion_anual;
      let estadoProy = '';
      
      if (proy >= 5) estadoProy = 'Zona en fuerte crecimiento';
      else if (proy >= 2) estadoProy = 'Zona en crecimiento moderado';
      else if (proy > 0) estadoProy = 'Zona con crecimiento leve';
      else if (proy >= -2) estadoProy = 'Zona estable';
      else estadoProy = 'Zona en descenso';

      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(proy >= 2 ? 34 : proy >= 0 ? 59 : 239, proy >= 2 ? 197 : proy >= 0 ? 130 : 68, proy >= 2 ? 94 : proy >= 0 ? 246 : 68);
      doc.text(estadoProy, margin, yPosition);
      yPosition += 8;

      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);

      proyData.push(
        ['Proyeccion anual', `${proy > 0 ? '+' : ''}${proy.toFixed(1)}%`],
        ['Basado en', `${metrica.meses_datos_historicos} meses de datos historicos`],
        ['Valor estimado en 1 ano', `${formatNumber(Math.round(propiedad.precio * (1 + proy / 100)))} EUR`],
        ['Plusvalia potencial', `${formatNumber(Math.round(propiedad.precio * (proy / 100)))} EUR`]
      );
    } else if (metrica.indice_dinamismo !== null) {
      const dinamismo = metrica.indice_dinamismo;
      let estadoDin = '';
      
      if (dinamismo >= 80) estadoDin = 'Mercado muy activo';
      else if (dinamismo >= 60) estadoDin = 'Mercado activo';
      else if (dinamismo >= 40) estadoDin = 'Mercado moderado';
      else estadoDin = 'Mercado tranquilo';

      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(dinamismo >= 60 ? 34 : 107, dinamismo >= 60 ? 197 : 114, dinamismo >= 60 ? 94 : 128);
      doc.text(estadoDin, margin, yPosition);
      yPosition += 8;

      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);

      proyData.push(
        ['Indice de dinamismo', `${Math.round(dinamismo)}/100`],
        ['Estado', 'Acumulando datos historicos...'],
        ['Proyeccion disponible en', `${Math.max(0, 3 - (metrica.meses_datos_historicos || 0))} meses`]
      );
    }

    if (proyData.length > 0) {
      autoTable(doc, {
        startY: yPosition,
        body: proyData,
        theme: 'striped',
        styles: { 
          fontSize: 9, 
          cellPadding: 3,
          font: 'helvetica'
        },
        columnStyles: {
          0: { fontStyle: 'bold', cellWidth: 60, fillColor: [249, 250, 251] },
          1: { cellWidth: 'auto' }
        },
        margin: { left: margin, right: margin }
      });

      yPosition = (doc as any).lastAutoTable.finalY + 12;
    }
  }

  // === SCORE Y COMPATIBILIDAD ===
  if (matching) {
    checkNewPage(70);

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(59, 130, 246);
    doc.text('Analisis de Compatibilidad', margin, yPosition);
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
        ['Presupuesto', criterios.presupuesto ? 'Cumple' : 'No cumple'],
        ['Ubicacion', criterios.ubicacion ? 'Cumple' : 'No cumple'],
        ['Tipo de propiedad', criterios.tipo_propiedad ? 'Cumple' : 'No cumple'],
        ['Dormitorios', criterios.dormitorios ? 'Cumple' : 'No cumple'],
        ['Metros', criterios.metros ? 'Cumple' : 'No cumple'],
      ];

      autoTable(doc, {
        startY: yPosition,
        body: criteriosData,
        theme: 'striped',
        styles: { 
          fontSize: 9, 
          cellPadding: 3,
          font: 'helvetica'
        },
        columnStyles: {
          0: { fontStyle: 'bold', cellWidth: 60, fillColor: [249, 250, 251] },
          1: { cellWidth: 'auto' }
        },
        margin: { left: margin, right: margin }
      });

      yPosition = (doc as any).lastAutoTable.finalY + 12;
    }
  }

  // === CONCLUSIONES ===
  checkNewPage(50);

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(59, 130, 246);
  doc.text('Conclusiones InmoFinder', margin, yPosition);
  yPosition += 8;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);

  const conclusiones = generarConclusiones({
    propiedad,
    matching,
    metrica,
    clientePerfil
  });

  // Agregar box con conclusiones
  const conclusionesText = conclusiones.map(c => `- ${c}`).join('\n\n');
  const splitText = doc.splitTextToSize(conclusionesText, pageWidth - 2 * margin - 10);
  const textHeight = splitText.length * 5 + 10;
  
  checkNewPage(textHeight + 10);
  
  doc.setFillColor(239, 246, 255);
  doc.roundedRect(margin, yPosition, pageWidth - 2 * margin, textHeight, 2, 2, 'F');
  
  yPosition += 6;
  doc.text(splitText, margin + 5, yPosition);

  // === FOOTER ===
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(107, 114, 128);
    const footerText = `Pagina ${i} de ${pageCount} | InmoFinder ${new Date().getFullYear()} | Analisis generado automaticamente`;
    doc.text(footerText, pageWidth / 2, pageHeight - 10, { align: 'center' });
  }

  // Guardar PDF
  const ubicacionLimpia = propiedad.ubicacion.replace(/[,\s]/g, '_').substring(0, 30);
  const fileName = `InmoFinder_${ubicacionLimpia}_${Date.now()}.pdf`;
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
  if (metrica?.proyeccion_revalorizacion_anual !== null && metrica?.proyeccion_revalorizacion_anual !== undefined && (metrica?.meses_datos_historicos ?? 0) >= 3) {
    const proy = metrica.proyeccion_revalorizacion_anual;
      if (proy >= 5) {
        conclusiones.push(`La zona muestra una tendencia de crecimiento fuerte (+${proy.toFixed(1)}% anual), ideal para inversion a medio-largo plazo.`);
      } else if (proy >= 2) {
        conclusiones.push(`La revalorizacion esperada es positiva (+${proy.toFixed(1)}% anual), ofreciendo seguridad de inversion.`);
      } else if (proy < 0) {
        conclusiones.push(`La zona presenta descenso de precios (${proy.toFixed(1)}% anual). Considerar si es estrategico para su perfil.`);
      }
  }

  // Análisis según perfil
  switch (clientePerfil) {
    case 'reformar':
      if (matching?.analisis_mercado?.es_chollo) {
        conclusiones.push('Propiedad apta para reforma y reventa: margen potencial identificado por algoritmo InmoFinder.');
      }
      if (propiedad.condition === 'a reformar') {
        conclusiones.push('Estado a reformar permite personalizacion total y maximizar ROI post-renovacion.');
      }
      break;
    case 'alquilar':
      conclusiones.push(`Con ${propiedad.dormitorios || 0} dormitorios en ${propiedad.ubicacion}, presenta potencial de rentabilidad por alquiler.`);
      if (metrica?.indice_dinamismo >= 60) {
        conclusiones.push('Alta demanda en la zona segun indice de dinamismo, facilitando ocupacion del inmueble.');
      }
      break;
    case 'vivir':
      if (matching?.score >= 75) {
        conclusiones.push('Compatibilidad alta con sus criterios de busqueda. Propiedad recomendada para visitar.');
      }
      if (propiedad.tiene_ascensor && propiedad.tiene_parking) {
        conclusiones.push('Cuenta con comodidades clave (ascensor + parking) que mejoran calidad de vida diaria.');
      }
      break;
  }

  // Recomendación final
  if (matching?.score >= 80 && matching?.analisis_mercado?.es_chollo) {
    conclusiones.push('RECOMENDACION ALTA: Combina score elevado con precio inferior al mercado. Actuar rapido.');
  } else if (matching?.score >= 70) {
    conclusiones.push('RECOMENDACION: Propiedad bien valorada por nuestro algoritmo. Vale la pena considerarla.');
  }

  if (conclusiones.length === 0) {
    conclusiones.push('Analisis en progreso. Mas datos historicos mejoraran las proyecciones en los proximos meses.');
  }

  return conclusiones;
}

function formatNumber(num: number | null): string {
  if (num === null || num === undefined) return 'N/A';
  return num.toLocaleString('es-ES', { maximumFractionDigits: 0 });
}

// === GENERADOR DE PRESUPUESTO DE REFORMA ===
export const generarPDFPresupuesto = async ({
  propiedad,
  clientePerfil = 'vivir'
}: PresupuestoReforma) => {
  const doc = new jsPDF({
    format: 'a4',
    unit: 'mm'
  });
  
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const margin = 15;
  let yPosition = 20;

  // Helper para verificar si necesitamos nueva página
  const checkNewPage = (requiredSpace: number) => {
    if (yPosition + requiredSpace > pageHeight - 30) {
      doc.addPage();
      yPosition = 20;
      return true;
    }
    return false;
  };

  // === HEADER ===
  doc.setFillColor(59, 130, 246);
  doc.rect(0, 0, pageWidth, 40, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text('Presupuesto de Reforma', margin, 20);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Powered by InmoFinder', margin, 28);
  
  doc.setFontSize(9);
  const fecha = new Date().toLocaleDateString('es-ES');
  doc.text(fecha, pageWidth - margin, 28, { align: 'right' });

  yPosition = 50;
  doc.setTextColor(0, 0, 0);

  // === INFORMACIÓN DE LA PROPIEDAD ===
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(59, 130, 246);
  doc.text('Propiedad Analizada', margin, yPosition);
  yPosition += 8;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);

  const infoProp = [
    ['Ubicacion', propiedad.ubicacion],
    ['Tipo', propiedad.tipo_propiedad],
    ['Precio Compra', `${formatNumber(propiedad.precio)} EUR`],
    ['Superficie', `${propiedad.metros} m2`],
    ['Dormitorios', propiedad.dormitorios || 'N/A'],
    ['Banos', propiedad.banos || 'N/A'],
    ['Estado Actual', propiedad.condition || 'No especificado'],
  ];

  autoTable(doc, {
    startY: yPosition,
    body: infoProp,
    theme: 'striped',
    styles: { 
      fontSize: 9,
      cellPadding: 3,
      font: 'helvetica'
    },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 50, fillColor: [249, 250, 251] },
      1: { cellWidth: 'auto' }
    },
    margin: { left: margin, right: margin }
  });

  yPosition = (doc as any).lastAutoTable.finalY + 12;

  // === FOTOS DE LA PROPIEDAD ===
  if (propiedad.imagenes && propiedad.imagenes.length > 0) {
    checkNewPage(80);
    
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(59, 130, 246);
    doc.text('Imagenes de la Propiedad', margin, yPosition);
    yPosition += 8;

    const imagesToShow = propiedad.imagenes.slice(0, 4); // Mostrar hasta 4 imágenes
    const imagePromises = imagesToShow.map(async (url: string) => {
      try {
        const response = await fetch(url);
        const blob = await response.blob();
        return new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });
      } catch (error) {
        console.error('Error loading image:', error);
        return null;
      }
    });

    const imageDataUrls = await Promise.all(imagePromises);
    
    let imgX = margin;
    let imgY = yPosition;
    const imgWidth = (pageWidth - 2 * margin - 5) / 2;
    const imgHeight = 50;

    for (let i = 0; i < imageDataUrls.length; i++) {
      if (imageDataUrls[i]) {
        try {
          doc.addImage(imageDataUrls[i]!, 'JPEG', imgX, imgY, imgWidth, imgHeight);
          
          if (i % 2 === 0) {
            imgX = margin + imgWidth + 5;
          } else {
            imgX = margin;
            imgY += imgHeight + 5;
            
            // Verificar si necesitamos nueva página
            if (imgY + imgHeight > pageHeight - 30) {
              doc.addPage();
              imgY = 20;
            }
          }
        } catch (error) {
          console.error('Error adding image to PDF:', error);
        }
      }
    }

    yPosition = imgY + (imageDataUrls.length % 2 === 0 ? 0 : imgHeight) + 12;
  }

  // === PRESUPUESTO SEGÚN PERFIL ===
  checkNewPage(100);

  const presupuestoData = generarPresupuestoPorPerfil(propiedad, clientePerfil);

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(59, 130, 246);
  doc.text(`Presupuesto Estimado - Perfil: ${presupuestoData.perfilNombre}`, margin, yPosition);
  yPosition += 10;

  doc.setFillColor(239, 246, 255);
  doc.roundedRect(margin, yPosition, pageWidth - 2 * margin, 20, 2, 2, 'F');
  
  doc.setFontSize(12);
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.text(`Coste Total Estimado: ${formatNumber(presupuestoData.total)} EUR`, margin + 5, yPosition + 8);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Rango: ${formatNumber(presupuestoData.min)} - ${formatNumber(presupuestoData.max)} EUR`, margin + 5, yPosition + 15);

  yPosition += 28;

  // Tabla de partidas
  autoTable(doc, {
    startY: yPosition,
    head: [['Partida', 'Descripcion', 'Coste Estimado']],
    body: presupuestoData.partidas.map(p => [
      p.nombre,
      p.descripcion,
      `${formatNumber(p.coste)} EUR`
    ]),
    theme: 'striped',
    styles: { 
      fontSize: 9,
      cellPadding: 3,
      font: 'helvetica'
    },
    headStyles: {
      fillColor: [59, 130, 246],
      textColor: [255, 255, 255],
      fontStyle: 'bold'
    },
    columnStyles: {
      0: { cellWidth: 40 },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 35, halign: 'right' }
    },
    margin: { left: margin, right: margin }
  });

  yPosition = (doc as any).lastAutoTable.finalY + 12;

  // === OBSERVACIONES ===
  checkNewPage(50);

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(59, 130, 246);
  doc.text('Observaciones del Presupuesto', margin, yPosition);
  yPosition += 8;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);

  const observacionesText = presupuestoData.observaciones.map(o => `- ${o}`).join('\n\n');
  const splitObs = doc.splitTextToSize(observacionesText, pageWidth - 2 * margin - 10);
  const obsHeight = splitObs.length * 5 + 10;
  
  checkNewPage(obsHeight + 10);
  
  doc.setFillColor(254, 243, 199);
  doc.roundedRect(margin, yPosition, pageWidth - 2 * margin, obsHeight, 2, 2, 'F');
  
  yPosition += 6;
  doc.text(splitObs, margin + 5, yPosition);
  yPosition += obsHeight + 10;

  // === DISCLAIMER ===
  checkNewPage(60);

  doc.setFillColor(254, 226, 226);
  doc.roundedRect(margin, yPosition, pageWidth - 2 * margin, 50, 2, 2, 'F');
  
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(220, 38, 38);
  doc.text('IMPORTANTE - Presupuesto Orientativo', margin + 5, yPosition + 8);
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);
  
  const disclaimerText = [
    'Este presupuesto es ORIENTATIVO y no constituye una oferta definitiva. Los costes reales',
    'pueden variar segun el estado real de la propiedad, materiales seleccionados, y factores',
    'imprevistos descubiertos durante la obra.',
    '',
    'Es imprescindible una visita presencial de nuestros arquitectos para elaborar un',
    'presupuesto detallado y ajustado a la realidad del inmueble.'
  ];
  
  let disclaimerY = yPosition + 16;
  disclaimerText.forEach(line => {
    doc.text(line, margin + 5, disclaimerY);
    disclaimerY += 5;
  });

  yPosition += 58;

  // === CONTACTO Y PRÓXIMOS PASOS ===
  checkNewPage(50);

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(59, 130, 246);
  doc.text('Proximos Pasos', margin, yPosition);
  yPosition += 10;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);

  const pasosText = [
    '1. Revision de este presupuesto orientativo',
    '2. Solicitar visita de nuestros arquitectos especializados',
    '3. Inspeccion detallada de la propiedad',
    '4. Elaboracion de presupuesto definitivo y planos',
    '5. Inicio de la reforma con garantias',
  ];

  pasosText.forEach(paso => {
    doc.text(paso, margin, yPosition);
    yPosition += 7;
  });

  yPosition += 8;

  // Información de contacto con ARQO Estudio
  doc.setFillColor(239, 246, 255);
  doc.roundedRect(margin, yPosition, pageWidth - 2 * margin, 35, 2, 2, 'F');
  
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(59, 130, 246);
  doc.text('Arquitectura y Reformas - ARQO Estudio', margin + 5, yPosition + 8);
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);
  doc.text('Nuestro estudio asociado de arquitectura especializado en reformas integrales', margin + 5, yPosition + 15);
  
  doc.setTextColor(59, 130, 246);
  doc.textWithLink('Visita: https://arqoestudio.com/', margin + 5, yPosition + 22, { url: 'https://arqoestudio.com/' });
  
  doc.setTextColor(0, 0, 0);
  doc.text('Contacta para agendar tu visita y presupuesto detallado', margin + 5, yPosition + 29);

  // === FOOTER ===
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(107, 114, 128);
    const footerText = `Pagina ${i} de ${pageCount} | InmoFinder x ARQO Estudio ${new Date().getFullYear()} | Presupuesto orientativo`;
    doc.text(footerText, pageWidth / 2, pageHeight - 10, { align: 'center' });
  }

  // Guardar PDF
  const ubicacionLimpia = propiedad.ubicacion.replace(/[,\s]/g, '_').substring(0, 30);
  const fileName = `Presupuesto_Reforma_${ubicacionLimpia}_${Date.now()}.pdf`;
  doc.save(fileName);
};

// Genera presupuesto según el perfil del cliente
function generarPresupuestoPorPerfil(propiedad: any, perfil: string) {
  const metros = propiedad.metros || 100;
  
  // Presupuestos base por m2 según perfil
  const perfiles: Record<string, any> = {
    vivir: {
      nombre: 'Vivir (Reforma Integral)',
      costeM2: 650,
      partidas: [
        { nombre: 'Demolicion', descripcion: 'Derribo de tabiques, levantado de pavimentos y alicatados', porcentaje: 8 },
        { nombre: 'Albanileria', descripcion: 'Tabiqueria nueva, enfoscados, solados', porcentaje: 20 },
        { nombre: 'Fontaneria', descripcion: 'Instalacion completa de tuberias, sanitarios y griferia', porcentaje: 12 },
        { nombre: 'Electricidad', descripcion: 'Cableado completo, cuadro electrico, enchufes y luces', porcentaje: 10 },
        { nombre: 'Carpinteria', descripcion: 'Puertas interiores, armarios empotrados, rodapies', porcentaje: 15 },
        { nombre: 'Revestimientos', descripcion: 'Alicatado banos/cocina, pavimentos, pintura', porcentaje: 18 },
        { nombre: 'Cocina', descripcion: 'Muebles de cocina, encimera y electrodomesticos', porcentaje: 10 },
        { nombre: 'Banos', descripcion: 'Sanitarios, mampara, griferia y accesorios', porcentaje: 7 }
      ],
      observaciones: [
        'Reforma integral para habitabilidad inmediata con acabados de calidad media-alta',
        'Incluye actualizacion completa de instalaciones a normativa vigente',
        'Plazo estimado: 3-4 meses',
        'Materiales de primeras marcas con garantia'
      ]
    },
    reformar: {
      nombre: 'Reformar (Reforma para Reventa)',
      costeM2: 450,
      partidas: [
        { nombre: 'Demolicion', descripcion: 'Trabajos de derribo necesarios', porcentaje: 10 },
        { nombre: 'Albanileria', descripcion: 'Reparaciones estructurales y nuevos tabiques', porcentaje: 22 },
        { nombre: 'Fontaneria', descripcion: 'Renovacion de instalaciones criticas', porcentaje: 12 },
        { nombre: 'Electricidad', descripcion: 'Actualizacion electrica basica', porcentaje: 10 },
        { nombre: 'Carpinteria', descripcion: 'Puertas y elementos basicos', porcentaje: 12 },
        { nombre: 'Revestimientos', descripcion: 'Pintura, solados y alicatados funcionales', porcentaje: 18 },
        { nombre: 'Cocina Basica', descripcion: 'Muebles funcionales sin electrodomesticos', porcentaje: 8 },
        { nombre: 'Banos Basicos', descripcion: 'Sanitarios estandar y griferia', porcentaje: 8 }
      ],
      observaciones: [
        'Reforma optimizada para maximizar ROI en reventa',
        'Acabados funcionales con buena relacion calidad-precio',
        'Plazo estimado: 2-3 meses',
        'Enfoque en mejorar aspectos visibles y cumplir normativa',
        'Sin lujos innecesarios, prioridad: funcionalidad y estetica'
      ]
    },
    alquilar: {
      nombre: 'Alquilar (Reforma para Arrendamiento)',
      costeM2: 550,
      partidas: [
        { nombre: 'Demolicion', descripcion: 'Derribo selectivo', porcentaje: 8 },
        { nombre: 'Albanileria', descripcion: 'Trabajos de construccion necesarios', porcentaje: 20 },
        { nombre: 'Fontaneria', descripcion: 'Instalacion duradera y de bajo mantenimiento', porcentaje: 13 },
        { nombre: 'Electricidad', descripcion: 'Sistema electrico robusto', porcentaje: 11 },
        { nombre: 'Carpinteria', descripcion: 'Puertas reforzadas, armarios practicos', porcentaje: 14 },
        { nombre: 'Revestimientos', descripcion: 'Materiales resistentes al desgaste', porcentaje: 18 },
        { nombre: 'Cocina', descripcion: 'Equipamiento completo con electrodomesticos basicos', porcentaje: 10 },
        { nombre: 'Banos', descripcion: 'Completos con buena durabilidad', porcentaje: 6 }
      ],
      observaciones: [
        'Reforma enfocada en durabilidad y bajo mantenimiento',
        'Materiales resistentes al uso intensivo',
        'Plazo estimado: 3 meses',
        'Diseño atractivo para inquilinos potenciales',
        'Incluye electrodomesticos para alquiler llave en mano'
      ]
    }
  };

  const perfilData = perfiles[perfil] || perfiles.vivir;
  const costetotal = Math.round(metros * perfilData.costeM2);
  const variacion = 0.15; // +/- 15%

  const partidas = perfilData.partidas.map((p: any) => ({
    nombre: p.nombre,
    descripcion: p.descripcion,
    coste: Math.round(costetotal * (p.porcentaje / 100))
  }));

  return {
    perfilNombre: perfilData.nombre,
    total: costetotal,
    min: Math.round(costetotal * (1 - variacion)),
    max: Math.round(costetotal * (1 + variacion)),
    partidas,
    observaciones: perfilData.observaciones
  };
}
