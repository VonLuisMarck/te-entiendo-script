import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from '@/integrations/supabase/client';

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

  // Extraer ubicación más detallada disponible
  const ubicacionDetallada = propiedad.distrito || propiedad.ciudad || propiedad.provincia || propiedad.ubicacion || 'Ubicación no especificada';
  const ciudad = propiedad.ciudad || propiedad.provincia || 'Ciudad desconocida';
  const provincia = propiedad.provincia || '';
  
  // Usar la primera imagen real de la propiedad si está disponible
  let propertyImageUrl = null;
  if (propiedad.imagenes && Array.isArray(propiedad.imagenes) && propiedad.imagenes.length > 0) {
    propertyImageUrl = propiedad.imagenes[0];
    console.log('✓ Usando imagen real de la propiedad');
  } else {
    console.info('ℹ No hay imágenes disponibles para esta propiedad');
  }
  
  // El PDF se generará de todas formas, con o sin imagen
  
  // === PORTADA ===
  doc.setFillColor(240, 244, 248);
  doc.rect(0, 0, pageWidth, pageHeight, 'F');
  
  // Añadir imagen de la propiedad si está disponible
  if (propertyImageUrl) {
    try {
      // Si es una URL externa, necesitamos convertirla a base64 primero
      let imageData = propertyImageUrl;
      
      // Si no es base64, intentar cargar la imagen
      if (!propertyImageUrl.startsWith('data:')) {
        try {
          const response = await fetch(propertyImageUrl);
          const blob = await response.blob();
          const base64 = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
          });
          imageData = base64;
        } catch (e) {
          console.warn('No se pudo cargar la imagen externa, continuando sin imagen:', e);
          imageData = null;
        }
      }
      
      if (imageData) {
        // Determinar el formato de la imagen
        let format = 'JPEG';
        if (imageData.includes('data:image/png')) format = 'PNG';
        else if (imageData.includes('data:image/webp')) format = 'WEBP';
        
        doc.addImage(imageData, format, 0, 0, pageWidth, 80, undefined, 'FAST');
        
        // Overlay oscuro para mejorar legibilidad del texto
        doc.setFillColor(0, 0, 0);
        (doc as any).setGState({ opacity: 0.4 });
        doc.rect(0, 0, pageWidth, 80, 'F');
        (doc as any).setGState({ opacity: 1 });
      }
    } catch (error) {
      console.error('Error añadiendo imagen al PDF:', error);
    }
  }
  
  // Título principal - generar título dinámico basado en análisis
  let tituloPrincipal = ubicacionDetallada;
  
  // Si hay análisis de mercado, crear título con porcentaje de ajuste
  if (matching?.analisis_mercado?.disponible) {
    const desviacion = matching.analisis_mercado.desviacion_porcentaje;
    if (desviacion <= -10) {
      tituloPrincipal = `Ocasión con ${Math.abs(desviacion).toFixed(0)}% de ajuste`;
    } else if (desviacion <= -5) {
      tituloPrincipal = `Oportunidad con ${Math.abs(desviacion).toFixed(0)}% de descuento`;
    } else if (desviacion <= 10) {
      tituloPrincipal = `${ubicacionDetallada} - Precio Justo`;
    } else {
      tituloPrincipal = `${ubicacionDetallada} - ${desviacion.toFixed(0)}% sobre mercado`;
    }
  }
  
  doc.setTextColor(propertyImageUrl ? 255 : 30, propertyImageUrl ? 255 : 58, propertyImageUrl ? 255 : 138);
  doc.setFontSize(28);
  doc.setFont('helvetica', 'bold');
  doc.text(tituloPrincipal, pageWidth / 2, propertyImageUrl ? 50 : 80, { align: 'center' });
  
  // Subtítulo con tipo de propiedad
  const ySubtitle = propertyImageUrl ? 65 : 95;
  doc.setTextColor(propertyImageUrl ? 255 : 71, propertyImageUrl ? 255 : 85, propertyImageUrl ? 255 : 105);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'normal');
  doc.text(propiedad.tipo_propiedad, pageWidth / 2, ySubtitle, { align: 'center' });
  
  // Precio destacado
  const yPrecio = propertyImageUrl ? 100 : 120;
  doc.setTextColor(30, 58, 138);
  doc.setFontSize(32);
  doc.setFont('helvetica', 'bold');
  doc.text(`${formatNumber(propiedad.precio)} €`, pageWidth / 2, yPrecio, { align: 'center' });
  
  // Info adicional
  const yInfo = propertyImageUrl ? 112 : 132;
  doc.setTextColor(71, 85, 105);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  const infoLinea = `${propiedad.metros} m² • ${propiedad.dormitorios} dorm. • ${propiedad.banos} baños`;
  doc.text(infoLinea, pageWidth / 2, yInfo, { align: 'center' });
  
  // Perfil del cliente
  const yPerfil = propertyImageUrl ? 125 : 145;
  doc.setFontSize(10);
  const perfilText = clientePerfil === 'reformar' ? 'Perfil: Inversor - Reformar y Vender' :
                     clientePerfil === 'alquilar' ? 'Perfil: Inversor - Alquilar' :
                     'Perfil: Vivienda Habitual';
  doc.text(perfilText, pageWidth / 2, yPerfil, { align: 'center' });
  
  // Preparado para
  const yNombre = propertyImageUrl ? 135 : 155;
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(`Análisis preparado para: ${clienteNombre}`, pageWidth / 2, yNombre, { align: 'center' });
  
  // Footer portada
  doc.setTextColor(148, 163, 184);
  doc.setFontSize(8);
  const fecha = new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
  doc.text(fecha, pageWidth / 2, pageHeight - 30, { align: 'center' });
  doc.text('Findoo - Análisis Inteligente de Propiedades', pageWidth / 2, pageHeight - 25, { align: 'center' });
  
  // Nueva página
  doc.addPage();
  yPosition = 20;
  doc.setTextColor(0, 0, 0);

  // === RESUMEN EJECUTIVO ===
  doc.setFillColor(30, 58, 138);
  doc.rect(0, yPosition - 5, pageWidth, 10, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Resumen Ejecutivo', margin, yPosition + 2);
  yPosition += 15;
  
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  
  const resumenText = `La propiedad ubicada en ${ubicacionDetallada} representa ${
    clientePerfil === 'reformar' ? 'una oportunidad de inversión para reforma y reventa' :
    clientePerfil === 'alquilar' ? 'una oportunidad de inversión para alquiler' :
    'una opción para vivienda habitual'
  }. Con ${propiedad.metros}m² construidos, distribuidos en ${propiedad.dormitorios} dormitorios y ${propiedad.banos} baños.`;
  
  const splitResumen = doc.splitTextToSize(resumenText, pageWidth - 2 * margin);
  doc.text(splitResumen, margin, yPosition);
  yPosition += splitResumen.length * 5 + 10;

  // === DATOS CLAVE ===
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 58, 138);
  doc.text('Datos Clave', margin, yPosition);
  yPosition += 8;

  const datosClaveData = [
    ['Precio de venta', `${formatNumber(propiedad.precio)} €`],
    ['Precio por m²', `${formatNumber(propiedad.precio_m2)} €/m²`],
    ['Superficie', `${propiedad.metros} m²`],
    ['Dormitorios', `${propiedad.dormitorios}`],
    ['Baños', `${propiedad.banos}`],
  ];

  if (matching?.score) {
    datosClaveData.push(['Score de compatibilidad', `${Math.round(matching.score)}/100`]);
  }

  autoTable(doc, {
    startY: yPosition,
    body: datosClaveData,
    theme: 'plain',
    styles: { 
      fontSize: 10,
      cellPadding: 4,
      font: 'helvetica'
    },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 70, textColor: [71, 85, 105] },
      1: { cellWidth: 'auto', fontStyle: 'bold', textColor: [30, 58, 138], fontSize: 11 }
    },
    margin: { left: margin, right: margin }
  });

  yPosition = (doc as any).lastAutoTable.finalY + 15;

  // === CARACTERÍSTICAS DE LA PROPIEDAD ===
  checkNewPage(60);
  
  doc.setFillColor(30, 58, 138);
  doc.rect(0, yPosition - 5, pageWidth, 10, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Características de la Propiedad', margin, yPosition + 2);
  yPosition += 15;

  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');

  const caracteristicas = [
    ['Estado', propiedad.condition || 'No especificado'],
    ['Ascensor', propiedad.tiene_ascensor === true ? 'Sí' : propiedad.tiene_ascensor === false ? 'No' : 'No especificado'],
    ['Parking', propiedad.tiene_parking === true ? 'Sí' : propiedad.tiene_parking === false ? 'No' : 'No especificado'],
    ['Año construcción', propiedad.ano_construccion || 'No especificado'],
  ];

  autoTable(doc, {
    startY: yPosition,
    body: caracteristicas,
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

  yPosition = (doc as any).lastAutoTable.finalY + 15;

  // === DESCRIPCION ===
  if (propiedad.descripcion) {
    checkNewPage(50);
    
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 58, 138);
    doc.text('Descripción', margin, yPosition);
    yPosition += 8;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);

    const descripcionText = doc.splitTextToSize(propiedad.descripcion, pageWidth - 2 * margin - 10);
    const descripcionHeight = descripcionText.length * 4 + 10;
    
    checkNewPage(descripcionHeight + 10);
    
    doc.setFillColor(249, 250, 251);
    doc.roundedRect(margin, yPosition, pageWidth - 2 * margin, descripcionHeight, 2, 2, 'F');
    
    yPosition += 6;
    doc.text(descripcionText, margin + 5, yPosition);
    yPosition += descripcionHeight + 6;
  }

  // === ANÁLISIS DE MERCADO ===
  checkNewPage(80);
  
  doc.setFillColor(30, 58, 138);
  doc.rect(0, yPosition - 5, pageWidth, 10, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Análisis de Mercado', margin, yPosition + 2);
  yPosition += 15;
  
  doc.setTextColor(0, 0, 0);

  if (matching?.analisis_mercado?.disponible) {
    const analisis = matching.analisis_mercado;

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
      ['Precio/m² de esta propiedad', `${formatNumber(analisis.precio_m2_propiedad)} €/m²`],
      ['Precio/m² promedio en ' + ciudad, `${formatNumber(analisis.precio_m2_mercado)} €/m²`],
      ['Desviación respecto al mercado', `${desviacion > 0 ? '+' : ''}${desviacion.toFixed(1)}%`],
      ['Propiedades comparadas', `${analisis.total_propiedades_comparadas} propiedades`],
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

    yPosition = (doc as any).lastAutoTable.finalY + 15;
  } else {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text('No hay datos de mercado disponibles para esta zona.', margin, yPosition);
    yPosition += 15;
  }

  // === INFORMACIÓN DE LA ZONA ===
  if (metrica) {
    checkNewPage(80);

    doc.setFillColor(30, 58, 138);
    doc.rect(0, yPosition - 5, pageWidth, 10, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(`Análisis del Mercado en ${ubicacionDetallada}`, margin, yPosition + 2);
    yPosition += 15;

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');

    // Introducción del mercado
    let introTexto = `El mercado inmobiliario en ${ciudad} presenta características distintivas que son clave para entender el valor y potencial de esta inversión. `;
    introTexto += `Actualmente, nuestra base de datos monitoriza ${metrica.total_propiedades || 0} propiedades activas en ${ciudad}, `;
    introTexto += `lo que nos permite realizar un análisis preciso y actualizado del mercado local.\n\n`;
    
    // Análisis de precios
    introTexto += `El precio medio de una propiedad en ${ciudad} se sitúa en ${formatNumber(metrica.precio_medio)} €, `;
    introTexto += `con un precio medio por metro cuadrado de ${formatNumber(metrica.precio_m2_medio)} €/m². `;
    
    // Contexto del rango de precios
    const rangoPrecios = metrica.precio_m2_max - metrica.precio_m2_min;
    const porcentajeRango = ((rangoPrecios / metrica.precio_m2_medio) * 100).toFixed(0);
    introTexto += `Los precios por m² en la zona oscilan entre ${formatNumber(metrica.precio_m2_min)} € y ${formatNumber(metrica.precio_m2_max)} €, `;
    introTexto += `mostrando una variabilidad del ${porcentajeRango}% que refleja la diversidad de tipologías y zonas dentro de ${ciudad}.\n\n`;

    // Composición del mercado
    if (metrica.total_pisos > 0 || metrica.total_chalets > 0) {
      introTexto += `En cuanto a la composición del mercado, `;
      if (metrica.total_pisos > 0) {
        const porcentajePisos = ((metrica.total_pisos / metrica.total_propiedades) * 100).toFixed(0);
        introTexto += `los pisos representan el ${porcentajePisos}% del mercado con un precio medio de ${formatNumber(metrica.precio_medio_piso)} €`;
        if (metrica.metros_medio_piso) {
          introTexto += ` (${formatNumber(metrica.precio_medio_piso / metrica.metros_medio_piso)} €/m²)`;
        }
        introTexto += `. `;
      }
      if (metrica.total_chalets > 0) {
        const porcentajeChalets = ((metrica.total_chalets / metrica.total_propiedades) * 100).toFixed(0);
        introTexto += `Los chalets y viviendas unifamiliares representan el ${porcentajeChalets}% con un precio medio de ${formatNumber(metrica.precio_medio_chalet)} €`;
        if (metrica.metros_medio_chalet) {
          introTexto += ` (${formatNumber(metrica.precio_medio_chalet / metrica.metros_medio_chalet)} €/m²)`;
        }
        introTexto += `.`;
      }
    }

    const splitIntro = doc.splitTextToSize(introTexto, pageWidth - 2 * margin);
    doc.text(splitIntro, margin, yPosition);
    yPosition += splitIntro.length * 5 + 10;

    // Tabla resumen con datos clave
    checkNewPage(60);
    
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 58, 138);
    doc.text('Datos Clave del Mercado', margin, yPosition);
    yPosition += 8;

    const datosZona = [
      ['Precio medio en la zona', `${formatNumber(metrica.precio_medio)} €`],
      ['Precio medio por m²', `${formatNumber(metrica.precio_m2_medio)} €/m²`],
      ['Rango de precios por m²', `${formatNumber(metrica.precio_m2_min)} - ${formatNumber(metrica.precio_m2_max)} €/m²`],
      ['Total de propiedades activas', `${metrica.total_propiedades} propiedades`],
    ];

    if (metrica.total_pisos > 0) {
      datosZona.push(['Pisos disponibles', `${metrica.total_pisos} unidades`]);
      if (metrica.precio_medio_piso) {
        datosZona.push(['Precio medio pisos', `${formatNumber(metrica.precio_medio_piso)} €`]);
      }
    }
    if (metrica.total_chalets > 0) {
      datosZona.push(['Chalets disponibles', `${metrica.total_chalets} unidades`]);
      if (metrica.precio_medio_chalet) {
        datosZona.push(['Precio medio chalets', `${formatNumber(metrica.precio_medio_chalet)} €`]);
      }
    }

    autoTable(doc, {
      startY: yPosition,
      body: datosZona,
      theme: 'striped',
      styles: { 
        fontSize: 9, 
        cellPadding: 3,
        font: 'helvetica'
      },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 70, fillColor: [249, 250, 251] },
        1: { cellWidth: 'auto', fontStyle: 'bold', textColor: [30, 58, 138] }
      },
      margin: { left: margin, right: margin }
    });

    yPosition = (doc as any).lastAutoTable.finalY + 15;

    // Tendencias y proyección de mercado
    checkNewPage(80);
    
    doc.setFillColor(240, 244, 248);
    doc.roundedRect(margin, yPosition, pageWidth - 2 * margin, 8, 2, 2, 'F');
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 58, 138);
    doc.text('Tendencias y Proyección del Mercado', margin + 5, yPosition + 5.5);
    yPosition += 13;

    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);

    if (metrica.proyeccion_revalorizacion_anual !== null && metrica.meses_datos_historicos >= 3) {
      const proy = metrica.proyeccion_revalorizacion_anual;
      let analisisProyeccion = '';
      let colorProy = [71, 85, 105];
      
      if (proy >= 5) {
        colorProy = [34, 197, 94];
        analisisProyeccion = `${ciudad} está experimentando un crecimiento excepcional del ${proy.toFixed(1)}% anual. Este ritmo de revalorización indica una zona en plena expansión, `;
        analisisProyeccion += `con alta demanda y desarrollo activo. Las propiedades en esta zona han mostrado una apreciación consistente, `;
        analisisProyeccion += `lo que sugiere un mercado robusto con excelentes perspectivas de inversión. `;
        
        if (clientePerfil === 'reformar') {
          analisisProyeccion += `Para inversores enfocados en reformar y vender, esto significa que además del margen de la reforma, `;
          analisisProyeccion += `podrán beneficiarse de una revalorización natural del inmueble durante el período de obra y comercialización. `;
        } else if (clientePerfil === 'alquilar') {
          analisisProyeccion += `Para inversores en alquiler, esta revalorización garantiza no solo ingresos recurrentes sino también una apreciación significativa del capital. `;
        }
        
        analisisProyeccion += `\n\nProyectando esta tendencia, una propiedad de ${formatNumber(propiedad.precio)} € podría alcanzar un valor de ${formatNumber(Math.round(propiedad.precio * (1 + proy / 100)))} € en un año, `;
        analisisProyeccion += `representando una plusvalía de ${formatNumber(Math.round(propiedad.precio * (proy / 100)))} €. `;
        analisisProyeccion += `En un horizonte de 3 años, manteniendo esta tendencia, la revalorización acumulada podría ser de aproximadamente ${((Math.pow(1 + proy / 100, 3) - 1) * 100).toFixed(1)}%, `;
        analisisProyeccion += `elevando el valor a ${formatNumber(Math.round(propiedad.precio * Math.pow(1 + proy / 100, 3)))} €.`;
        
      } else if (proy >= 2) {
        colorProy = [59, 130, 246];
        analisisProyeccion = `El mercado en ${ciudad} muestra un crecimiento moderado y sostenible del ${proy.toFixed(1)}% anual. `;
        analisisProyeccion += `Esta tasa de revalorización indica un mercado maduro y estable, con demanda constante y precios que evolucionan de forma saludable. `;
        analisisProyeccion += `Este tipo de crecimiento es característico de zonas consolidadas donde la demanda está bien establecida.\n\n`;
        
        analisisProyeccion += `Basándonos en ${metrica.meses_datos_historicos} meses de datos históricos, proyectamos que esta propiedad `;
        analisisProyeccion += `podría alcanzar un valor de ${formatNumber(Math.round(propiedad.precio * (1 + proy / 100)))} € en un año, `;
        analisisProyeccion += `generando una plusvalía de ${formatNumber(Math.round(propiedad.precio * (proy / 100)))} €. `;
        
        if (clientePerfil === 'vivir') {
          analisisProyeccion += `Para vivienda habitual, esto garantiza que su inversión se mantendrá protegida de la inflación y crecerá en valor con el tiempo.`;
        }
        
      } else if (proy > 0) {
        colorProy = [234, 179, 8];
        analisisProyeccion = `${ciudad} presenta un crecimiento leve del ${proy.toFixed(1)}% anual. El mercado se encuentra estable, `;
        analisisProyeccion += `con precios que crecen de forma conservadora. Esta estabilidad puede ser positiva para inversores que buscan seguridad, `;
        analisisProyeccion += `aunque las oportunidades de revalorización rápida son limitadas. `;
        
        analisisProyeccion += `\n\nEn un año, se estima que esta propiedad podría valer ${formatNumber(Math.round(propiedad.precio * (1 + proy / 100)))} €. `;
        
        if (clientePerfil === 'reformar' || clientePerfil === 'alquilar') {
          analisisProyeccion += `Para inversores, el retorno principal deberá provenir de la operación (reforma/alquiler) más que de la revalorización del activo.`;
        }
        
      } else if (proy >= -2) {
        colorProy = [107, 114, 128];
        analisisProyeccion = `El mercado en ${ciudad} se mantiene estable sin cambios significativos en los precios. `;
        analisisProyeccion += `Esto puede indicar un equilibrio entre oferta y demanda, o un momento de consolidación tras períodos de crecimiento previo. `;
        analisisProyeccion += `En mercados estables, la estrategia debe enfocarse en encontrar oportunidades individuales con descuento sobre el precio medio.`;
        
      } else {
        colorProy = [239, 68, 68];
        analisisProyeccion = `ATENCIÓN: El mercado en ${ciudad} está experimentando una corrección del ${Math.abs(proy).toFixed(1)}% anual. `;
        analisisProyeccion += `Esta tendencia a la baja puede deberse a diversos factores económicos o de oferta excesiva. `;
        analisisProyeccion += `Es crucial analizar las causas específicas de esta tendencia antes de invertir. `;
        
        if (clientePerfil === 'alquilar') {
          analisisProyeccion += `\n\nPara inversión en alquiler, evalúe si la rentabilidad por rentas puede compensar la depreciación del activo. `;
          analisisProyeccion += `Una propiedad de ${formatNumber(propiedad.precio)} € podría valer ${formatNumber(Math.round(propiedad.precio * (1 + proy / 100)))} € en un año.`;
        } else if (clientePerfil === 'reformar') {
          analisisProyeccion += `\n\nPara reformar y vender, considere que tendrá que vender en un mercado a la baja, lo que puede reducir significativamente los márgenes proyectados.`;
        }
      }

      // Badge con estado
      const estadoBadgeWidth = 60;
      const estadoBadgeHeight = 8;
      doc.setFillColor(colorProy[0], colorProy[1], colorProy[2]);
      doc.roundedRect(margin, yPosition, estadoBadgeWidth, estadoBadgeHeight, 2, 2, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      const estadoTexto = proy >= 5 ? 'Fuerte Crecimiento' :
                         proy >= 2 ? 'Crecimiento Moderado' :
                         proy > 0 ? 'Crecimiento Leve' :
                         proy >= -2 ? 'Estable' : 'En Descenso';
      doc.text(estadoTexto, margin + estadoBadgeWidth / 2, yPosition + 5.5, { align: 'center' });
      
      doc.setTextColor(colorProy[0], colorProy[1], colorProy[2]);
      doc.setFontSize(11);
      doc.text(`${proy > 0 ? '+' : ''}${proy.toFixed(1)}% anual`, margin + estadoBadgeWidth + 5, yPosition + 5.5);
      yPosition += 13;

      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      const splitAnalisis = doc.splitTextToSize(analisisProyeccion, pageWidth - 2 * margin);
      doc.text(splitAnalisis, margin, yPosition);
      yPosition += splitAnalisis.length * 4 + 12;

      // Tabla con proyecciones
      checkNewPage(40);
      const proyData = [
        ['Proyección a 1 año', `${formatNumber(Math.round(propiedad.precio * (1 + proy / 100)))} €`, `${proy > 0 ? '+' : ''}${formatNumber(Math.round(propiedad.precio * (proy / 100)))} €`],
        ['Proyección a 3 años', `${formatNumber(Math.round(propiedad.precio * Math.pow(1 + proy / 100, 3)))} €`, `${proy > 0 ? '+' : ''}${formatNumber(Math.round(propiedad.precio * (Math.pow(1 + proy / 100, 3) - 1)))} €`],
        ['Proyección a 5 años', `${formatNumber(Math.round(propiedad.precio * Math.pow(1 + proy / 100, 5)))} €`, `${proy > 0 ? '+' : ''}${formatNumber(Math.round(propiedad.precio * (Math.pow(1 + proy / 100, 5) - 1)))} €`],
      ];

      autoTable(doc, {
        startY: yPosition,
        head: [['Horizonte', 'Valor Estimado', 'Plusvalía']],
        body: proyData,
        theme: 'striped',
        headStyles: {
          fillColor: [30, 58, 138],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 9
        },
        styles: { 
          fontSize: 9, 
          cellPadding: 3,
          font: 'helvetica'
        },
        columnStyles: {
          0: { fontStyle: 'bold', cellWidth: 50 },
          1: { cellWidth: 'auto', fontStyle: 'bold', textColor: [30, 58, 138] },
          2: { cellWidth: 'auto', fontStyle: 'bold', textColor: proy >= 0 ? [34, 197, 94] : [239, 68, 68] }
        },
        margin: { left: margin, right: margin }
      });

      yPosition = (doc as any).lastAutoTable.finalY + 12;

      // Nota sobre la proyección
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      const notaTexto = `* Proyecciones basadas en ${metrica.meses_datos_historicos} meses de datos históricos. Los valores futuros son estimaciones y pueden variar según condiciones macroeconómicas y del mercado local.`;
      const splitNota = doc.splitTextToSize(notaTexto, pageWidth - 2 * margin);
      doc.text(splitNota, margin, yPosition);
      yPosition += splitNota.length * 4 + 10;

    } else if (metrica.indice_dinamismo !== null) {
      const dinamismo = metrica.indice_dinamismo;
      let textoDinamismo = `El índice de dinamismo del mercado en ${ciudad} es de ${Math.round(dinamismo)}/100. `;
      
      if (dinamismo >= 80) {
        textoDinamismo += `Esto indica un mercado muy activo con alto volumen de transacciones y rotación de propiedades. `;
      } else if (dinamismo >= 60) {
        textoDinamismo += `Esto refleja un mercado activo con buen nivel de transacciones. `;
      } else if (dinamismo >= 40) {
        textoDinamismo += `Esto indica un mercado moderado con actividad transaccional estándar. `;
      } else {
        textoDinamismo += `Esto sugiere un mercado tranquilo con menor volumen de transacciones. `;
      }
      
      textoDinamismo += `\n\nActualmente estamos acumulando datos históricos para ofrecer proyecciones de revalorización precisas. `;
      textoDinamismo += `Se necesitan al menos 3 meses de datos para calcular tendencias fiables. `;
      textoDinamismo += `Dispondremos de proyecciones de revalorización en aproximadamente ${Math.max(0, 3 - (metrica.meses_datos_historicos || 0))} meses.`;

      const splitDinamismo = doc.splitTextToSize(textoDinamismo, pageWidth - 2 * margin);
      doc.text(splitDinamismo, margin, yPosition);
      yPosition += splitDinamismo.length * 4 + 10;
    }

    // Variación mensual si existe
    if (metrica.variacion_mensual !== null) {
      checkNewPage(30);
      
      doc.setFillColor(240, 244, 248);
      doc.roundedRect(margin, yPosition, pageWidth - 2 * margin, 8, 2, 2, 'F');
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 58, 138);
      doc.text('Variación Mensual Reciente', margin + 5, yPosition + 5.5);
      yPosition += 13;

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0, 0, 0);
      
      const varTexto = `En el último mes, los precios en ${ciudad} han experimentado una variación del ${metrica.variacion_mensual > 0 ? '+' : ''}${metrica.variacion_mensual.toFixed(2)}%. `;
      const varTexto2 = metrica.variacion_mensual > 0.5 
        ? 'Esta subida mensual refuerza la tendencia alcista del mercado.' 
        : metrica.variacion_mensual < -0.5 
        ? 'Esta bajada mensual puede indicar una corrección temporal o el inicio de una tendencia a la baja.'
        : 'Esta estabilidad mensual confirma un mercado sin volatilidad significativa.';
      
      const splitVar = doc.splitTextToSize(varTexto + varTexto2, pageWidth - 2 * margin);
      doc.text(splitVar, margin, yPosition);
      yPosition += splitVar.length * 4 + 10;
    }
  }

  // === COMPATIBILIDAD CON SU PERFIL ===
  if (matching) {
    checkNewPage(70);

    doc.setFillColor(30, 58, 138);
    doc.rect(0, yPosition - 5, pageWidth, 10, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Compatibilidad con su Perfil', margin, yPosition + 2);
    yPosition += 15;

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
      
      // Explicación del matching
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      const explicacionScore = score >= 80 
        ? 'Esta propiedad cumple excelentemente con tus criterios de búsqueda. Es una opción altamente recomendada.'
        : score >= 70
        ? 'Esta propiedad cumple muy bien con la mayoría de tus requisitos. Vale la pena considerarla seriamente.'
        : score >= 60
        ? 'Esta propiedad cumple satisfactoriamente con varios de tus criterios, aunque con algunas diferencias.'
        : 'Esta propiedad cumple parcialmente con tus criterios. Evalúa si las características que no coinciden son negociables.';
      
      const splitExpl = doc.splitTextToSize(explicacionScore, pageWidth - 2 * margin);
      doc.text(splitExpl, margin, yPosition);
      yPosition += splitExpl.length * 4 + 10;
      
      // Tabla de criterios mejorada
      const criteriosData: string[][] = [];
      
      if (criterios.presupuesto !== undefined) {
        const status = criterios.presupuesto ? '✓ Sí' : '✗ No';
        criteriosData.push(['Presupuesto', status, criterios.presupuesto ? 'Dentro de tu rango' : 'Fuera de presupuesto']);
      }
      
      if (criterios.ubicacion !== undefined) {
        const status = criterios.ubicacion ? '✓ Sí' : '✗ No';
        const detail = criterios.ubicacion ? `En ${ciudad}` : 'Otra ubicación';
        criteriosData.push(['Ubicación', status, detail]);
      }
      
      if (criterios.tipo_propiedad !== undefined) {
        const status = criterios.tipo_propiedad ? '✓ Sí' : '✗ No';
        criteriosData.push(['Tipo de propiedad', status, propiedad.tipo_propiedad]);
      }
      
      if (criterios.dormitorios !== undefined) {
        const status = criterios.dormitorios ? '✓ Sí' : '✗ No';
        criteriosData.push(['Dormitorios', status, `${propiedad.dormitorios} habitaciones`]);
      }
      
      if (criterios.metros !== undefined) {
        const status = criterios.metros ? '✓ Sí' : '✗ No';
        criteriosData.push(['Superficie', status, `${propiedad.metros} m²`]);
      }
      
      if (criterios.condition !== undefined) {
        const status = criterios.condition ? '✓ Sí' : '✗ No';
        criteriosData.push(['Estado', status, propiedad.condition || 'No especificado']);
      }

      if (criteriosData.length > 0) {
        autoTable(doc, {
          startY: yPosition,
          head: [['Criterio', 'Cumple', 'Detalles']],
          body: criteriosData,
          theme: 'striped',
          headStyles: {
            fillColor: [30, 58, 138],
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            fontSize: 9
          },
          styles: { 
            fontSize: 9, 
            cellPadding: 3,
            font: 'helvetica'
          },
          columnStyles: {
            0: { fontStyle: 'bold', cellWidth: 50, fillColor: [249, 250, 251] },
            1: { cellWidth: 25, halign: 'center' },
            2: { cellWidth: 'auto' }
          },
          margin: { left: margin, right: margin }
        });

        yPosition = (doc as any).lastAutoTable.finalY + 12;
      }
    }
  }

  // === CONCLUSIONES ===
  checkNewPage(60);

  doc.setFillColor(30, 58, 138);
  doc.rect(0, yPosition - 5, pageWidth, 10, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Conclusiones y Recomendaciones', margin, yPosition + 2);
  yPosition += 15;

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
  const conclusionesText = conclusiones.map(c => `• ${c}`).join('\n\n');
  const splitText = doc.splitTextToSize(conclusionesText, pageWidth - 2 * margin - 10);
  const textHeight = splitText.length * 5 + 10;
  
  checkNewPage(textHeight + 10);
  
  doc.setFillColor(239, 246, 255);
  doc.roundedRect(margin, yPosition, pageWidth - 2 * margin, textHeight, 2, 2, 'F');
  
  yPosition += 6;
  doc.text(splitText, margin + 5, yPosition);
  yPosition += textHeight + 10;

  // === ANÁLISIS DE RIESGOS Y OPORTUNIDADES ===
  checkNewPage(80);
  
  doc.setFillColor(30, 58, 138);
  doc.rect(0, yPosition - 5, pageWidth, 10, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Análisis de Riesgos y Oportunidades', margin, yPosition + 2);
  yPosition += 15;
  
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  
  // OPORTUNIDADES
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(34, 197, 94);
  doc.text('✓ Oportunidades Identificadas', margin, yPosition);
  yPosition += 8;
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);
  
  const oportunidades: string[] = [];
  
  if (matching?.analisis_mercado?.disponible && matching.analisis_mercado.desviacion_porcentaje < -5) {
    oportunidades.push(`Precio ${Math.abs(matching.analisis_mercado.desviacion_porcentaje).toFixed(1)}% inferior al mercado - Potencial de negociación o reventa rápida con beneficio`);
  }
  
  if (metrica?.proyeccion_revalorizacion_anual && metrica.proyeccion_revalorizacion_anual > 3) {
    oportunidades.push(`Zona con crecimiento anual del ${metrica.proyeccion_revalorizacion_anual.toFixed(1)}% - Alta probabilidad de revalorización del activo`);
  }
  
  if (clientePerfil === 'reformar' && (propiedad.condition === 'a reformar' || propiedad.condition === 'para reformar')) {
    oportunidades.push('Estado para reformar permite maximizar ROI mediante reforma integral y modernización');
  }
  
  if (propiedad.metros >= 80 && propiedad.dormitorios < 4) {
    oportunidades.push(`Con ${propiedad.metros}m² es posible redistribuir espacios para añadir dormitorios y aumentar el valor de mercado`);
  }
  
  if (metrica && metrica.total_propiedades < 50) {
    oportunidades.push('Mercado con poca oferta - Mayor poder de negociación y menor competencia');
  }
  
  if (!propiedad.tiene_ascensor && propiedad.tiene_parking) {
    oportunidades.push('Parking disponible aumenta atractivo y justifica precio superior en zona urbana');
  }
  
  if (oportunidades.length === 0) {
    oportunidades.push('Propiedad estándar sin oportunidades excepcionales identificadas en este momento');
  }
  
  const oportunidadesText = oportunidades.map((o, i) => `${i + 1}. ${o}`).join('\n\n');
  const splitOp = doc.splitTextToSize(oportunidadesText, pageWidth - 2 * margin - 10);
  const opHeight = splitOp.length * 4 + 10;
  
  checkNewPage(opHeight + 20);
  
  doc.setFillColor(240, 253, 244);
  doc.roundedRect(margin, yPosition, pageWidth - 2 * margin, opHeight, 2, 2, 'F');
  
  yPosition += 6;
  doc.text(splitOp, margin + 5, yPosition);
  yPosition += opHeight + 15;
  
  // RIESGOS
  checkNewPage(40);
  
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(239, 68, 68);
  doc.text('⚠ Riesgos a Considerar', margin, yPosition);
  yPosition += 8;
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);
  
  const riesgos: string[] = [];
  
  if (matching?.analisis_mercado?.disponible && matching.analisis_mercado.desviacion_porcentaje > 15) {
    riesgos.push(`Precio ${matching.analisis_mercado.desviacion_porcentaje.toFixed(1)}% superior al mercado - Riesgo de sobrepago y dificultad para revender`);
  }
  
  if (metrica?.proyeccion_revalorizacion_anual && metrica.proyeccion_revalorizacion_anual < 0) {
    riesgos.push(`Mercado en descenso ${metrica.proyeccion_revalorizacion_anual.toFixed(1)}% anual - Riesgo de depreciación del activo`);
  }
  
  if (!propiedad.tiene_ascensor && propiedad.metros > 100) {
    riesgos.push('Sin ascensor puede limitar mercado potencial, especialmente para familias o personas mayores');
  }
  
  if (propiedad.ano_construccion && propiedad.ano_construccion < 1980) {
    riesgos.push(`Construcción de ${propiedad.ano_construccion} puede requerir gastos imprevistos en instalaciones (electricidad, fontanería, estructura)`);
  }
  
  if (!propiedad.condition || propiedad.condition === 'a reformar') {
    riesgos.push('Estado a reformar implica inversión adicional significativa y periodo sin generar ingresos durante obras');
  }
  
  if (metrica && metrica.total_propiedades > 200) {
    riesgos.push('Alta competencia en el mercado local - Más difícil destacar y puede presionar precios a la baja');
  }
  
  if (riesgos.length === 0) {
    riesgos.push('No se han identificado riesgos significativos en base a la información disponible');
  }
  
  const riesgosText = riesgos.map((r, i) => `${i + 1}. ${r}`).join('\n\n');
  const splitRiesgo = doc.splitTextToSize(riesgosText, pageWidth - 2 * margin - 10);
  const riesgoHeight = splitRiesgo.length * 4 + 10;
  
  checkNewPage(riesgoHeight + 20);
  
  doc.setFillColor(254, 242, 242);
  doc.roundedRect(margin, yPosition, pageWidth - 2 * margin, riesgoHeight, 2, 2, 'F');
  
  yPosition += 6;
  doc.text(splitRiesgo, margin + 5, yPosition);
  yPosition += riesgoHeight + 15;

  // === ANÁLISIS FINANCIERO PERSONALIZADO ===
  checkNewPage(100);
  
  doc.setFillColor(30, 58, 138);
  doc.rect(0, yPosition - 5, pageWidth, 10, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  const tituloFinanciero = clientePerfil === 'reformar' ? 'Análisis Financiero - Reformar y Vender' :
                          clientePerfil === 'alquilar' ? 'Análisis Financiero - Inversión en Alquiler' :
                          'Análisis Financiero - Vivienda Habitual';
  doc.text(tituloFinanciero, margin, yPosition + 2);
  yPosition += 15;
  
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  
  if (clientePerfil === 'reformar') {
    const costeReformaEstimado = Math.round(propiedad.metros * 600); // €600/m² reforma media
    const precioCompra = propiedad.precio;
    const precioVentaEstimado = metrica?.precio_m2_medio ? Math.round(metrica.precio_m2_medio * propiedad.metros) : Math.round(precioCompra * 1.15);
    const gastosCompra = Math.round(precioCompra * 0.12); // 12% gastos notaría, registro, etc.
    const gastosVenta = Math.round(precioVentaEstimado * 0.05); // 5% comisión agencia
    const beneficioBruto = precioVentaEstimado - precioCompra - costeReformaEstimado - gastosCompra - gastosVenta;
    const roi = ((beneficioBruto / (precioCompra + costeReformaEstimado + gastosCompra)) * 100).toFixed(1);
    
    const analisisText = `Inversión Total Estimada:\n`;
    const analisisText2 = `• Precio de compra: ${formatNumber(precioCompra)} €\n`;
    const analisisText3 = `• Reforma estimada (€600/m²): ${formatNumber(costeReformaEstimado)} €\n`;
    const analisisText4 = `• Gastos de compra (~12%): ${formatNumber(gastosCompra)} €\n`;
    const analisisText5 = `TOTAL INVERSIÓN: ${formatNumber(precioCompra + costeReformaEstimado + gastosCompra)} €\n\n`;
    const analisisText6 = `Retorno Estimado:\n`;
    const analisisText7 = `• Precio venta estimado: ${formatNumber(precioVentaEstimado)} €\n`;
    const analisisText8 = `• Gastos venta (~5%): ${formatNumber(gastosVenta)} €\n`;
    const analisisText9 = `BENEFICIO NETO ESTIMADO: ${formatNumber(beneficioBruto)} €\n`;
    const analisisText10 = `ROI ESTIMADO: ${roi}%\n\n`;
    const analisisText11 = `Tiempo estimado de proyecto: 6-12 meses (obras + comercialización)\n`;
    const analisisText12 = `Rentabilidad anualizada: ${(parseFloat(roi) / 0.75).toFixed(1)}% (asumiendo 9 meses)`;
    
    const fullText = analisisText + analisisText2 + analisisText3 + analisisText4 + analisisText5 + 
                    analisisText6 + analisisText7 + analisisText8 + analisisText9 + analisisText10 + 
                    analisisText11 + analisisText12;
    
    const splitAnalisis = doc.splitTextToSize(fullText, pageWidth - 2 * margin - 10);
    const analisisHeight = splitAnalisis.length * 4 + 10;
    
    checkNewPage(analisisHeight + 10);
    
    doc.setFillColor(254, 249, 195);
    doc.roundedRect(margin, yPosition, pageWidth - 2 * margin, analisisHeight, 2, 2, 'F');
    
    yPosition += 6;
    doc.text(splitAnalisis, margin + 5, yPosition);
    yPosition += analisisHeight + 12;
    
  } else if (clientePerfil === 'alquilar') {
    const precioCompra = propiedad.precio;
    const rentaMensualEstimada = Math.round((precioCompra * 0.05) / 12); // 5% rentabilidad anual
    const gastosCompra = Math.round(precioCompra * 0.12);
    const gastosMensuales = Math.round(rentaMensualEstimada * 0.25); // 25% gastos (comunidad, IBI, seguros, etc.)
    const rentaNetaMensual = rentaMensualEstimada - gastosMensuales;
    const rentabilidadNeta = ((rentaNetaMensual * 12 / (precioCompra + gastosCompra)) * 100).toFixed(2);
    
    const analisisText = `Inversión Inicial:\n`;
    const analisisText2 = `• Precio de compra: ${formatNumber(precioCompra)} €\n`;
    const analisisText3 = `• Gastos de compra (~12%): ${formatNumber(gastosCompra)} €\n`;
    const analisisText4 = `TOTAL INVERSIÓN: ${formatNumber(precioCompra + gastosCompra)} €\n\n`;
    const analisisText5 = `Ingresos Estimados Mensuales:\n`;
    const analisisText6 = `• Renta mensual estimada: ${formatNumber(rentaMensualEstimada)} €\n`;
    const analisisText7 = `• Gastos mensuales (~25%): ${formatNumber(gastosMensuales)} €\n`;
    const analisisText8 = `RENTA NETA MENSUAL: ${formatNumber(rentaNetaMensual)} €\n`;
    const analisisText9 = `RENTA NETA ANUAL: ${formatNumber(rentaNetaMensual * 12)} €\n\n`;
    const analisisText10 = `RENTABILIDAD NETA: ${rentabilidadNeta}% anual\n\n`;
    const analisisText11 = metrica?.proyeccion_revalorizacion_anual 
      ? `Revalorización esperada: +${metrica.proyeccion_revalorizacion_anual.toFixed(1)}% anual adicional` 
      : 'Revalorización: datos insuficientes para calcular';
    
    const fullText = analisisText + analisisText2 + analisisText3 + analisisText4 + analisisText5 + 
                    analisisText6 + analisisText7 + analisisText8 + analisisText9 + analisisText10 + analisisText11;
    
    const splitAnalisis = doc.splitTextToSize(fullText, pageWidth - 2 * margin - 10);
    const analisisHeight = splitAnalisis.length * 4 + 10;
    
    checkNewPage(analisisHeight + 10);
    
    doc.setFillColor(254, 249, 195);
    doc.roundedRect(margin, yPosition, pageWidth - 2 * margin, analisisHeight, 2, 2, 'F');
    
    yPosition += 6;
    doc.text(splitAnalisis, margin + 5, yPosition);
    yPosition += analisisHeight + 12;
    
  } else {
    // Vivienda habitual
    const precioCompra = propiedad.precio;
    const gastosCompra = Math.round(precioCompra * 0.12);
    const hipotecaEstimada = Math.round(precioCompra * 0.8); // 80% hipoteca
    const cuotaMensualEst = Math.round((hipotecaEstimada * 0.005)); // ~0.5% mensual aprox
    const entradaNecesaria = precioCompra - hipotecaEstimada + gastosCompra;
    
    const analisisText = `Coste Total de Adquisición:\n`;
    const analisisText2 = `• Precio de compra: ${formatNumber(precioCompra)} €\n`;
    const analisisText3 = `• Gastos de compra (~12%): ${formatNumber(gastosCompra)} €\n`;
    const analisisText4 = `TOTAL: ${formatNumber(precioCompra + gastosCompra)} €\n\n`;
    const analisisText5 = `Financiación Estimada (80% hipoteca):\n`;
    const analisisText6 = `• Entrada necesaria: ${formatNumber(entradaNecesaria)} €\n`;
    const analisisText7 = `• Hipoteca: ${formatNumber(hipotecaEstimada)} €\n`;
    const analisisText8 = `• Cuota mensual estimada: ${formatNumber(cuotaMensualEst)} €/mes (aprox)\n\n`;
    const analisisText9 = `Coste por m² habitable: ${formatNumber(Math.round(precioCompra / propiedad.metros))} €/m²\n`;
    const analisisText10 = metrica?.proyeccion_revalorizacion_anual 
      ? `Revalorización esperada: +${metrica.proyeccion_revalorizacion_anual.toFixed(1)}% anual` 
      : 'Revalorización: datos insuficientes';
    
    const fullText = analisisText + analisisText2 + analisisText3 + analisisText4 + analisisText5 + 
                    analisisText6 + analisisText7 + analisisText8 + analisisText9 + analisisText10;
    
    const splitAnalisis = doc.splitTextToSize(fullText, pageWidth - 2 * margin - 10);
    const analisisHeight = splitAnalisis.length * 4 + 10;
    
    checkNewPage(analisisHeight + 10);
    
    doc.setFillColor(254, 249, 195);
    doc.roundedRect(margin, yPosition, pageWidth - 2 * margin, analisisHeight, 2, 2, 'F');
    
    yPosition += 6;
    doc.text(splitAnalisis, margin + 5, yPosition);
    yPosition += analisisHeight + 12;
  }

  // === PRÓXIMOS PASOS RECOMENDADOS ===
  checkNewPage(60);
  
  doc.setFillColor(30, 58, 138);
  doc.rect(0, yPosition - 5, pageWidth, 10, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Próximos Pasos Recomendados', margin, yPosition + 2);
  yPosition += 15;
  
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  
  const proximosPasos = [
    '1. VISITA PRESENCIAL: Programa una visita para inspeccionar el estado real, orientación, vistas y entorno',
    '2. VERIFICACIÓN LEGAL: Solicita nota simple del Registro para comprobar cargas, hipotecas y situación legal',
    '3. COMPARATIVA ACTIVA: Visita al menos 3-5 propiedades similares para tener referencias de mercado',
    '4. TASACIÓN PROFESIONAL: Si procedes, contrata tasador independiente para confirmar valor real',
    clientePerfil === 'reformar' ? '5. PRESUPUESTO DETALLADO: Solicita 3 presupuestos de reforma antes de tomar decisión final' :
    clientePerfil === 'alquilar' ? '5. ANÁLISIS DE RENTAS: Investiga rentas reales en portales para validar proyecciones' :
    '5. PRE-APROBACIÓN HIPOTECARIA: Consulta con bancos condiciones y máximo que te pueden conceder'
  ];
  
  const pasosText = proximosPasos.join('\n\n');
  const splitPasos = doc.splitTextToSize(pasosText, pageWidth - 2 * margin - 10);
  const pasosHeight = splitPasos.length * 4 + 10;
  
  checkNewPage(pasosHeight + 10);
  
  doc.setFillColor(243, 244, 246);
  doc.roundedRect(margin, yPosition, pageWidth - 2 * margin, pasosHeight, 2, 2, 'F');
  
  yPosition += 6;
  doc.text(splitPasos, margin + 5, yPosition);
  yPosition += pasosHeight + 10;

  // === FOOTER ===
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(107, 114, 128);
    const footerText = `Pagina ${i} de ${pageCount} | Findoo ${new Date().getFullYear()} | Analisis generado automaticamente`;
    doc.text(footerText, pageWidth / 2, pageHeight - 10, { align: 'center' });
  }

  // Guardar PDF
  const ubicacionLimpia = propiedad.ubicacion.replace(/[,\s]/g, '_').substring(0, 30);
  const fileName = `Findoo_${ubicacionLimpia}_${Date.now()}.pdf`;
  doc.save(fileName);
  
  // Retornar información
  return {
    success: true,
    warnings: []
  };
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
    const footerText = `Pagina ${i} de ${pageCount} | Findoo x ARQO Estudio ${new Date().getFullYear()} | Presupuesto orientativo`;
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
