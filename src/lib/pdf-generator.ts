import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface PropiedadAnalisis {
  propiedad: any;
  matching?: any;
  metrica?: any;
  clientePerfil?: string;
  clienteNombre?: string;
}

interface PresupuestoReforma {
  propiedad: any;
  clientePerfil?: string;
  clienteNombre?: string;
}

export const generarPDFAnalisis = async ({
  propiedad,
  matching,
  metrica,
  clientePerfil = 'vivir',
  clienteNombre = 'Cliente'
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
  doc.text(`Analisis para: ${clienteNombre}`, margin, 26);
  doc.setFontSize(9);
  const perfilText = clientePerfil === 'reformar' ? 'Inversor - Reformar y Vender' :
                     clientePerfil === 'alquilar' ? 'Inversor - Alquilar' :
                     'Vivienda Habitual';
  doc.text(`Perfil: ${perfilText}`, margin, 31);

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

  // Análisis de precio vs mercado - adaptado al perfil
  if (matching?.analisis_mercado?.disponible) {
    const desv = matching.analisis_mercado.desviacion_porcentaje;
    if (desv <= -15) {
      if (clientePerfil === 'reformar') {
        conclusiones.push(`OPORTUNIDAD PARA REFORMAR: Precio ${Math.abs(desv).toFixed(1)}% inferior al mercado. Margen significativo para reforma y reventa con beneficio.`);
      } else if (clientePerfil === 'alquilar') {
        conclusiones.push(`EXCELENTE PARA INVERSION: Precio ${Math.abs(desv).toFixed(1)}% bajo mercado mejora significativamente el ROI por alquiler.`);
      } else {
        conclusiones.push(`GRAN OPORTUNIDAD: Precio ${Math.abs(desv).toFixed(1)}% inferior al mercado local. Excelente relacion calidad-precio para su hogar.`);
      }
    } else if (desv <= -5) {
      if (clientePerfil === 'reformar' || clientePerfil === 'alquilar') {
        conclusiones.push(`Precio ${Math.abs(desv).toFixed(1)}% por debajo del mercado. Margen razonable para rentabilizar su inversion.`);
      } else {
        conclusiones.push('El precio esta ligeramente por debajo del mercado, ofreciendo un buen valor por el dinero.');
      }
    } else if (desv >= 15) {
      if (clientePerfil === 'reformar' || clientePerfil === 'alquilar') {
        conclusiones.push(`ATENCION: Precio ${desv.toFixed(1)}% sobre mercado reduce margen de beneficio. Negociar agresivamente o buscar alternativas.`);
      } else {
        conclusiones.push('El precio esta considerablemente por encima del promedio del mercado. Se recomienda negociar o buscar alternativas.');
      }
    }
  }

  // Proyección de revalorización - interpretada según perfil
  if (metrica?.proyeccion_revalorizacion_anual !== null && metrica?.proyeccion_revalorizacion_anual !== undefined && (metrica?.meses_datos_historicos ?? 0) >= 3) {
    const proy = metrica.proyeccion_revalorizacion_anual;
    if (proy >= 5) {
      if (clientePerfil === 'reformar') {
        conclusiones.push(`Zona en fuerte crecimiento (+${proy.toFixed(1)}% anual): maximiza beneficio en reventa tras reforma.`);
      } else if (clientePerfil === 'alquilar') {
        conclusiones.push(`Zona en crecimiento (+${proy.toFixed(1)}% anual): revalorizacion del activo + ingresos por alquiler = doble rentabilidad.`);
      } else {
        conclusiones.push(`La zona muestra crecimiento fuerte (+${proy.toFixed(1)}% anual): su vivienda se revalorizara con el tiempo.`);
      }
    } else if (proy >= 2) {
      conclusiones.push(`Revalorizacion positiva esperada (+${proy.toFixed(1)}% anual), ofreciendo seguridad de inversion a medio plazo.`);
    } else if (proy < 0) {
      if (clientePerfil === 'reformar' || clientePerfil === 'alquilar') {
        conclusiones.push(`ATENCION: Zona en descenso (${proy.toFixed(1)}% anual). Solo recomendable si cashflow por alquiler compensa depreciacion.`);
      } else {
        conclusiones.push(`Zona con descenso de precios (${proy.toFixed(1)}% anual). Evaluar si el entorno y calidad de vida compensan.`);
      }
    }
  }

  // Análisis específico por perfil - más detallado
  switch (clientePerfil) {
    case 'reformar':
      if (matching?.analisis_mercado?.es_chollo) {
        conclusiones.push('PERFIL INVERSOR REFORMAR: Oportunidad identificada por nuestro algoritmo. Precio bajo + reforma = margen atractivo.');
      }
      if (propiedad.condition === 'a reformar' || propiedad.condition === 'para reformar') {
        conclusiones.push('Estado actual perfecto para su perfil: permite reforma completa optimizando costes y maximizando ROI en reventa.');
      } else if (propiedad.condition === 'buen estado') {
        conclusiones.push('Estado bueno reduce necesidad de inversion en reforma, aunque limita margen de mejora en reventa.');
      }
      if (propiedad.metros >= 80) {
        conclusiones.push(`${propiedad.metros}m2 permiten redistribucion inteligente: ganar habitacion extra incrementa valor significativamente.`);
      }
      break;
      
    case 'alquilar':
      const rentabilidadEstimada = ((propiedad.precio_m2 * propiedad.metros * 0.05 / 12) / propiedad.precio * 100).toFixed(2);
      conclusiones.push(`PERFIL INVERSOR ALQUILER: Rentabilidad estimada bruta ~${rentabilidadEstimada}% mensual (5% anual orientativo).`);
      
      if (propiedad.dormitorios >= 3) {
        conclusiones.push(`${propiedad.dormitorios} dormitorios facilitan alquiler a familias o compartido, maximizando ocupacion y renta.`);
      } else if (propiedad.dormitorios === 2) {
        conclusiones.push('2 dormitorios: demanda alta tanto para parejas como para compartir, versatilidad en perfil inquilino.');
      }
      
      if (metrica?.indice_dinamismo >= 60) {
        conclusiones.push('Alta demanda en la zona (indice de dinamismo elevado): facilita alquiler rapido y minimiza periodos sin ingresos.');
      }
      
      if (propiedad.tiene_ascensor && propiedad.tiene_parking) {
        conclusiones.push('Ascensor + parking aumentan atractivo para inquilinos y justifican renta superior.');
      }
      break;
      
    case 'vivir':
      if (matching?.score >= 75) {
        conclusiones.push('VIVIENDA HABITUAL: Alta compatibilidad con sus criterios (score ' + matching.score + '%). Propiedad muy recomendada para visitar.');
      }
      
      if (propiedad.tiene_ascensor && propiedad.tiene_parking) {
        conclusiones.push('Comodidades clave para calidad de vida diaria: ascensor (comodidad) + parking (seguridad para su vehiculo).');
      }
      
      if (propiedad.condition === 'buen estado' || propiedad.condition === 'a estrenar') {
        conclusiones.push('Estado optimo: puede mudarse directamente sin obras, ahorrando tiempo y dinero.');
      } else if (propiedad.condition === 'a reformar') {
        conclusiones.push('Estado a reformar permite personalizacion total segun sus gustos, aunque requiere inversion y tiempo adicional.');
      }
      
      if (propiedad.metros >= 90) {
        conclusiones.push(`Superficie generosa (${propiedad.metros}m2): espacio suficiente para vivir comodo y crecer como familia.`);
      }
      break;
  }

  // Recomendación final - personalizada por perfil
  if (matching?.score >= 80 && matching?.analisis_mercado?.es_chollo) {
    if (clientePerfil === 'reformar') {
      conclusiones.push('★★★ RECOMENDACION MAXIMA PARA REFORMAR: Score alto + precio bajo + zona adecuada. Actuar con urgencia.');
    } else if (clientePerfil === 'alquilar') {
      conclusiones.push('★★★ RECOMENDACION MAXIMA PARA ALQUILAR: Combina precio atractivo con ubicacion demandada. ROI esperado excelente.');
    } else {
      conclusiones.push('★★★ RECOMENDACION MAXIMA: Propiedad ideal para usted. Score elevado + precio justo. No dejar escapar.');
    }
  } else if (matching?.score >= 70) {
    conclusiones.push('★★ RECOMENDACION: Propiedad bien valorada por nuestro algoritmo. Merece atencion seria.');
  } else if (matching?.score >= 60) {
    conclusiones.push('★ Opcion valida: Cumple criterios basicos, considerar junto a otras alternativas.');
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
  clientePerfil = 'vivir',
  clienteNombre = 'Cliente'
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
  doc.text('Presupuesto de Reforma', margin, 18);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Para: ${clienteNombre}`, margin, 26);
  doc.setFontSize(9);
  const perfilText = clientePerfil === 'reformar' ? 'Inversor - Reformar y Vender' :
                     clientePerfil === 'alquilar' ? 'Inversor - Alquilar' :
                     'Vivienda Habitual';
  doc.text(`Perfil: ${perfilText}`, margin, 31);
  
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

// Genera presupuesto según el perfil del cliente con desglose detallado
function generarPresupuestoPorPerfil(propiedad: any, perfil: string) {
  const metros = propiedad.metros || 100;
  const dormitorios = propiedad.dormitorios || 2;
  const banos = propiedad.banos || 1;
  
  // Presupuestos base por m2 según perfil
  const perfiles: Record<string, any> = {
    vivir: {
      nombre: 'Vivir (Reforma Integral Premium)',
      costeM2: 650,
      partidas: [
        { 
          nombre: 'Demolicion y Obra Gruesa', 
          descripcion: 'Derribo de tabiques no estructurales, levantado de pavimentos, retirada de alicatados existentes, limpieza y evacuacion de escombros',
          porcentaje: 8,
          subpartidas: [
            { item: 'Derribo y levantado', costeM2: 25 },
            { item: 'Gestion de residuos y escombros', costeM2: 15 },
            { item: 'Proteccion de elementos a conservar', costeM2: 12 }
          ]
        },
        { 
          nombre: 'Albanileria y Construccion', 
          descripcion: 'Tabiqueria nueva con ladrillo ceramico, enfoscados y maestreados, soleras y nivelacion de suelos, replanteos',
          porcentaje: 20,
          subpartidas: [
            { item: 'Tabiques de ladrillo ceramico 7cm', costeM2: 45 },
            { item: 'Enfoscados y maestreados de paredes', costeM2: 28 },
            { item: 'Soleras y nivelacion', costeM2: 32 },
            { item: 'Rozas y pasatubos', costeM2: 25 }
          ]
        },
        { 
          nombre: 'Instalacion de Fontaneria', 
          descripcion: 'Red completa de agua fria y caliente (polietileno reticulado), desagües (PVC), griferia empotrada Roca/Grohe, llaves de paso',
          porcentaje: 12,
          subpartidas: [
            { item: 'Tuberias agua fria/caliente', costeM2: 28 },
            { item: 'Red de desagües y bajantes', costeM2: 22 },
            { item: 'Griferia empotrada (Roca/Grohe)', unidad: dormitorios + banos, costeUnit: 350 },
            { item: 'Termo electrico/caldera', unidad: 1, costeUnit: 800 }
          ]
        },
        { 
          nombre: 'Instalacion Electrica', 
          descripcion: 'Cableado completo (RZ1-K 0.6/1kV), cuadro electrico con magnetotermicos y diferenciales, mecanismos Simon/BJC, iluminacion LED',
          porcentaje: 10,
          subpartidas: [
            { item: 'Cableado completo y canalizacion', costeM2: 25 },
            { item: 'Cuadro electrico normalizado', unidad: 1, costeUnit: 450 },
            { item: 'Mecanismos Simon 82/BJC', costeM2: 18 },
            { item: 'Puntos de iluminacion LED', unidad: metros * 0.4, costeUnit: 45 }
          ]
        },
        { 
          nombre: 'Carpinteria Interior', 
          descripcion: 'Puertas lacadas blancas con premarco, armarios empotrados melamina blanca con frente corredero, rodapies lacados 7cm',
          porcentaje: 15,
          subpartidas: [
            { item: 'Puertas lacadas 72cm paso (inc. herrajes)', unidad: dormitorios + 2, costeUnit: 320 },
            { item: 'Armarios empotrados (por metro lineal)', unidad: dormitorios * 2.5, costeUnit: 280 },
            { item: 'Rodapies lacados 7cm', costeM2: 8 },
            { item: 'Manetas y tiradores', unidad: dormitorios + 2, costeUnit: 35 }
          ]
        },
        { 
          nombre: 'Revestimientos y Acabados', 
          descripcion: 'Alicatado Porcelanosa/Roca 60x60 banos/cocina, pavimento porcelanico imitacion madera 20x120, pintura plastica blanca lisa Bruguer/Titan',
          porcentaje: 18,
          subpartidas: [
            { item: 'Alicatado banos/cocina (Porcelanosa)', costeM2: 45 },
            { item: 'Pavimento porcelanico imitacion madera', costeM2: 38 },
            { item: 'Pintura plastica lisa (2 manos)', costeM2: 12 },
            { item: 'Falsos techos pladur zonas humedas', costeM2: 28 }
          ]
        },
        { 
          nombre: 'Cocina Completa', 
          descripcion: 'Muebles de cocina melamina/lacado, encimera Silestone/Compac, fregadero bajo encimera, electrodomesticos Balay/Bosch (vitro, horno, campana, frigorifico)',
          porcentaje: 10,
          subpartidas: [
            { item: 'Muebles cocina (por metro lineal)', unidad: 4, costeUnit: 450 },
            { item: 'Encimera Silestone 2cm', unidad: 4, costeUnit: 280 },
            { item: 'Fregadero bajo encimera + griferia', unidad: 1, costeUnit: 320 },
            { item: 'Electrodomesticos Balay (pack basico)', unidad: 1, costeUnit: 1200 }
          ]
        },
        { 
          nombre: 'Equipamiento de Banos', 
          descripcion: 'Sanitarios Roca (inodoro suspendido, lavabo), mampara ducha cristal 8mm, griferia monomando, accesorios, espejo con luz LED',
          porcentaje: 7,
          subpartidas: [
            { item: 'Sanitarios Roca suspendidos (por baño)', unidad: banos, costeUnit: 680 },
            { item: 'Mampara cristal templado 8mm', unidad: banos, costeUnit: 420 },
            { item: 'Griferia monomando termostatica', unidad: banos, costeUnit: 280 },
            { item: 'Mueble lavabo + espejo LED', unidad: banos, costeUnit: 550 }
          ]
        }
      ],
      observaciones: [
        'Reforma integral llave en mano con acabados premium',
        'Incluye proyecto tecnico, licencias y legalizaciones',
        'Materiales de primeras marcas con 3 años de garantia',
        'Cumplimiento CTE y RITE - Certificacion energetica incluida',
        'Plazo estimado: 3-4 meses con planificacion detallada',
        'Seguro decenal de daños incluido'
      ]
    },
    reformar: {
      nombre: 'Reformar (Optimizado para Reventa)',
      costeM2: 450,
      partidas: [
        { 
          nombre: 'Demolicion y Limpieza', 
          descripcion: 'Derribo selectivo, levantado de elementos deteriorados, limpieza y evacuacion',
          porcentaje: 10,
          subpartidas: [
            { item: 'Derribo y levantado selectivo', costeM2: 22 },
            { item: 'Evacuacion de escombros', costeM2: 18 },
            { item: 'Limpieza general', costeM2: 5 }
          ]
        },
        { 
          nombre: 'Albanileria Basica', 
          descripcion: 'Reparaciones estructurales necesarias, nuevos tabiques, enfoscados basicos',
          porcentaje: 22,
          subpartidas: [
            { item: 'Reparaciones estructurales', costeM2: 35 },
            { item: 'Tabiques ceramicos 7cm', costeM2: 38 },
            { item: 'Enfoscados basicos', costeM2: 22 },
            { item: 'Solera nivelacion', costeM2: 24 }
          ]
        },
        { 
          nombre: 'Fontaneria Funcional', 
          descripcion: 'Renovacion de instalaciones criticas, tuberias basicas, griferia estandar',
          porcentaje: 12,
          subpartidas: [
            { item: 'Tuberias polietileno basicas', costeM2: 22 },
            { item: 'Desagües PVC', costeM2: 18 },
            { item: 'Griferia estandar', unidad: dormitorios + banos, costeUnit: 180 },
            { item: 'Termo electrico basico', unidad: 1, costeUnit: 450 }
          ]
        },
        { 
          nombre: 'Electrica Estandar', 
          descripcion: 'Actualizacion basica a normativa, cuadro normalizado, mecanismos economicos',
          porcentaje: 10,
          subpartidas: [
            { item: 'Cableado y canalizacion basica', costeM2: 18 },
            { item: 'Cuadro electrico estandar', unidad: 1, costeUnit: 320 },
            { item: 'Mecanismos economicos', costeM2: 12 },
            { item: 'Iluminacion LED basica', unidad: metros * 0.3, costeUnit: 28 }
          ]
        },
        { 
          nombre: 'Carpinteria Economica', 
          descripcion: 'Puertas blancas basicas, armarios funcionales, rodapies DM',
          porcentaje: 12,
          subpartidas: [
            { item: 'Puertas blancas basicas', unidad: dormitorios + 2, costeUnit: 180 },
            { item: 'Armarios melamina (metro lineal)', unidad: dormitorios * 2, costeUnit: 180 },
            { item: 'Rodapies DM lacado', costeM2: 5 }
          ]
        },
        { 
          nombre: 'Revestimientos Funcionales', 
          descripcion: 'Alicatado basico, pavimento laminado/vinilico, pintura plastica',
          porcentaje: 18,
          subpartidas: [
            { item: 'Alicatado basico banos/cocina', costeM2: 28 },
            { item: 'Pavimento laminado AC4', costeM2: 22 },
            { item: 'Pintura plastica (2 manos)', costeM2: 9 },
            { item: 'Plaquetas techo baños', costeM2: 18 }
          ]
        },
        { 
          nombre: 'Cocina Funcional', 
          descripcion: 'Muebles melamina basicos, encimera laminada, sin electrodomesticos',
          porcentaje: 8,
          subpartidas: [
            { item: 'Muebles cocina basicos (metro lineal)', unidad: 3.5, costeUnit: 280 },
            { item: 'Encimera laminada', unidad: 3.5, costeUnit: 120 },
            { item: 'Fregadero + griferia basica', unidad: 1, costeUnit: 180 }
          ]
        },
        { 
          nombre: 'Banos Estandar', 
          descripcion: 'Sanitarios basicos, ducha con cortina, griferia economica',
          porcentaje: 8,
          subpartidas: [
            { item: 'Sanitarios estandar (por baño)', unidad: banos, costeUnit: 380 },
            { item: 'Plato ducha + cortina', unidad: banos, costeUnit: 220 },
            { item: 'Griferia economica', unidad: banos, costeUnit: 150 },
            { item: 'Espejo y accesorios basicos', unidad: banos, costeUnit: 180 }
          ]
        }
      ],
      observaciones: [
        'Reforma optimizada para maximizar ROI en reventa rapida',
        'Acabados funcionales con buena relacion calidad-precio',
        'Enfoque en aspectos visibles y cumplimiento normativo',
        'Sin elementos superfluos - prioridad: funcionalidad y estetica',
        'Plazo estimado: 2-3 meses',
        'Ideal para flip inmobiliario con margen optimizado'
      ]
    },
    alquilar: {
      nombre: 'Alquilar (Durabilidad + Rentabilidad)',
      costeM2: 550,
      partidas: [
        { 
          nombre: 'Demolicion Selectiva', 
          descripcion: 'Derribo de elementos no aprovechables, limpieza, evacuacion',
          porcentaje: 8,
          subpartidas: [
            { item: 'Derribo selectivo', costeM2: 20 },
            { item: 'Evacuacion escombros', costeM2: 16 },
            { item: 'Limpieza profunda', costeM2: 8 }
          ]
        },
        { 
          nombre: 'Albanileria Robusta', 
          descripcion: 'Construccion duradera, tabiques reforzados, solados resistentes',
          porcentaje: 20,
          subpartidas: [
            { item: 'Tabiques reforzados ladrillo', costeM2: 42 },
            { item: 'Enfoscados maestreados', costeM2: 26 },
            { item: 'Soleras reforzadas', costeM2: 30 },
            { item: 'Rozas y pasatubos', costeM2: 12 }
          ]
        },
        { 
          nombre: 'Fontaneria Duradera', 
          descripcion: 'Instalacion robusta bajo mantenimiento, tuberias calidad, griferia resistente',
          porcentaje: 13,
          subpartidas: [
            { item: 'Tuberias multicapa premium', costeM2: 26 },
            { item: 'Red desagües reforzada', costeM2: 20 },
            { item: 'Griferia anti-vandalica Roca', unidad: dormitorios + banos, costeUnit: 280 },
            { item: 'Termo alta capacidad', unidad: 1, costeUnit: 680 }
          ]
        },
        { 
          nombre: 'Instalacion Electrica Robusta', 
          descripcion: 'Sistema electrico dimensionado, protecciones reforzadas, mecanismos resistentes',
          porcentaje: 11,
          subpartidas: [
            { item: 'Cableado reforzado', costeM2: 22 },
            { item: 'Cuadro con protecciones extra', unidad: 1, costeUnit: 420 },
            { item: 'Mecanismos anti-vandalicos', costeM2: 16 },
            { item: 'Iluminacion LED bajo consumo', unidad: metros * 0.4, costeUnit: 38 }
          ]
        },
        { 
          nombre: 'Carpinteria Resistente', 
          descripcion: 'Puertas reforzadas, armarios robustos, herrajes anti-rotura',
          porcentaje: 14,
          subpartidas: [
            { item: 'Puertas sapelly reforzadas', unidad: dormitorios + 2, costeUnit: 280 },
            { item: 'Armarios melamina resistente', unidad: dormitorios * 2.5, costeUnit: 240 },
            { item: 'Rodapies resistentes', costeM2: 7 },
            { item: 'Herrajes reforzados', unidad: dormitorios + 2, costeUnit: 45 }
          ]
        },
        { 
          nombre: 'Revestimientos Anti-desgaste', 
          descripcion: 'Materiales alta resistencia al uso, facil limpieza y mantenimiento',
          porcentaje: 18,
          subpartidas: [
            { item: 'Alicatado porcelanico banos/cocina', costeM2: 38 },
            { item: 'Pavimento porcelanico AC5', costeM2: 35 },
            { item: 'Pintura lavable anti-manchas', costeM2: 11 },
            { item: 'Falsos techos zonas humedas', costeM2: 25 }
          ]
        },
        { 
          nombre: 'Cocina Equipada Completa', 
          descripcion: 'Cocina funcional completa con electrodomesticos basicos incluidos',
          porcentaje: 10,
          subpartidas: [
            { item: 'Muebles cocina resistentes', unidad: 4, costeUnit: 380 },
            { item: 'Encimera resistente', unidad: 4, costeUnit: 220 },
            { item: 'Fregadero inox + griferia', unidad: 1, costeUnit: 280 },
            { item: 'Electrodomesticos basicos', unidad: 1, costeUnit: 850 }
          ]
        },
        { 
          nombre: 'Banos Completos Durables', 
          descripcion: 'Equipamiento completo resistente al uso intensivo',
          porcentaje: 6,
          subpartidas: [
            { item: 'Sanitarios Roca estandar (por baño)', unidad: banos, costeUnit: 580 },
            { item: 'Mampara vidrio seguridad', unidad: banos, costeUnit: 350 },
            { item: 'Griferia anti-vandalica', unidad: banos, costeUnit: 220 },
            { item: 'Mueble lavabo + espejo', unidad: banos, costeUnit: 420 }
          ]
        }
      ],
      observaciones: [
        'Reforma enfocada en durabilidad y minimo mantenimiento',
        'Materiales resistentes al uso intensivo de inquilinos',
        'Diseño atractivo para maximizar ocupacion',
        'Electrodomesticos incluidos para alquiler llave en mano',
        'Plazo estimado: 3 meses',
        'ROI optimizado por bajo mantenimiento y alta ocupacion'
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
