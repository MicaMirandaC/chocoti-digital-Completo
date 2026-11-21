/**
 * @file templates/notificacionesTemplates.js
 * @description Archivo único editable de plantillas para notificaciones transaccionales.
 * Contiene plantillas HTML para Correo Electrónico (API HTTPS / Bandeja Simulada)
 * y plantillas de texto formateado para WhatsApp (enlaces directos wa.me y conector Business).
 * Identidad visual: Chocolates Para Ti (Solur S.R.L. · Sucre, Bolivia).
 * ChocoTi-Digital | Módulo 6: Notificaciones de Compra
 */

'use strict';

const EMPRESA = require('../../../config/empresa');

/**
 * Diccionario canónico de los 14 estados de pedidos con títulos legibles y explicaciones amigables.
 */
const ESTADOS_INFO = {
  PENDIENTE_PAGO: {
    titulo: 'Pendiente de Pago',
    icono: '⏳',
    color: '#D97706',
    descripcion: 'Tu pedido ha sido registrado con reserva temporal de stock. Por favor completa tu pago para iniciar la preparación.',
  },
  PAGADO: {
    titulo: 'Pago Confirmado',
    icono: '✅',
    color: '#16A34A',
    descripcion: '¡Tu pago ha sido verificado con éxito! Tus chocolates están listos para pasar al área de preparación.',
  },
  EN_PREPARACION: {
    titulo: 'En Preparación (Picking FEFO)',
    icono: '🍫',
    color: '#4F46E5',
    descripcion: 'Nuestro personal especializado está seleccionando tus chocolates con control estricto de lote y vencimiento FEFO.',
  },
  PREPARADO: {
    titulo: 'Preparado',
    icono: '📋',
    color: '#0284C7',
    descripcion: 'La selección de chocolates para tu pedido ha finalizado y se encuentra en checklist de control de calidad.',
  },
  EMPACADO: {
    titulo: 'Empacado Térmico',
    icono: '📦',
    color: '#7C3AED',
    descripcion: 'Tus productos han sido acondicionados en empaque térmico con aislamiento especial para proteger el chocolate en tránsito.',
  },
  LISTO_DESPACHO: {
    titulo: 'Listo para Despacho',
    icono: '🚚',
    color: '#2563EB',
    descripcion: 'El paquete está consolidado y listo en el centro de distribución para ser retirado por la empresa de courier.',
  },
  LISTO_RECOJO: {
    titulo: 'Listo para Recojo en Agencia',
    icono: '🏬',
    color: '#059669',
    descripcion: '¡Tus chocolates ya te esperan en la agencia seleccionada! Puedes pasar a recogerlos dentro del horario de atención.',
  },
  DESPACHADO: {
    titulo: 'En Camino / Despachado',
    icono: '🛵',
    color: '#0D9488',
    descripcion: 'Tu paquete se encuentra en ruta hacia tu dirección con la empresa de transporte asignada.',
  },
  ENTREGADO: {
    titulo: 'Entregado al Cliente',
    icono: '🎉',
    color: '#15803D',
    descripcion: '¡Tu pedido ha sido entregado exitosamente! Esperamos que disfrutes del mejor chocolate de toda Bolivia.',
  },
  FINALIZADO: {
    titulo: 'Finalizado',
    icono: '⭐',
    color: '#3F3F46',
    descripcion: 'El ciclo de tu compra ha concluido satisfactoriamente. Agradecemos tu preferencia por Chocolates Para Ti.',
  },
  CANCELADO: {
    titulo: 'Cancelado',
    icono: '❌',
    color: '#DC2626',
    descripcion: 'El pedido ha sido cancelado y las existencias reservadas han sido reincorporadas al inventario.',
  },
  EXPIRADO: {
    titulo: 'Reserva Expirada',
    icono: '⏰',
    color: '#991B1B',
    descripcion: 'El tiempo límite para realizar el pago o retirar el pedido ha vencido. La reserva ha sido liberada.',
  },
  ENTREGA_FALLIDA: {
    titulo: 'Entrega Fallida',
    icono: '⚠️',
    color: '#EA580C',
    descripcion: 'No fue posible completar la entrega en la dirección especificada. Nos pondremos en contacto contigo para coordinar.',
  },
  DEVUELTO: {
    titulo: 'Devuelto a Almacén',
    icono: '🔄',
    color: '#6B7280',
    descripcion: 'El paquete ha retornado a nuestro almacén de origen. Por favor comunícate con nosotros para coordinar la resolución.',
  },
};

/**
 * Genera el encabezado HTML común para los correos de Chocolates Para Ti.
 */
function renderHeaderHTML(titulo = 'Notificación de Pedido') {
  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#3E2723;border-radius:12px 12px 0 0;padding:24px 20px;text-align:center;">
      <tr>
        <td>
          <div style="font-size:32px;line-height:1;margin-bottom:6px;">🍫</div>
          <h1 style="margin:0;font-family:'Playfair Display',Georgia,serif;color:#D4AF37;font-size:24px;font-weight:bold;letter-spacing:0.5px;">
            Chocolates Para Ti
          </h1>
          <p style="margin:4px 0 0;color:#F5EBE1;font-size:12px;font-family:'Inter',sans-serif;letter-spacing:1px;text-transform:uppercase;">
            Solur S.R.L. · Sucre, Bolivia · Desde 1990
          </p>
          <div style="margin-top:16px;display:inline-block;background:rgba(212,175,55,0.18);border:1px solid #D4AF37;color:#FFF;padding:6px 16px;border-radius:20px;font-size:13px;font-weight:600;font-family:'Inter',sans-serif;">
            ${titulo}
          </div>
        </td>
      </tr>
    </table>
  `;
}

/**
 * Genera el pie de página HTML común para los correos.
 */
function renderFooterHTML() {
  const wa = EMPRESA.redesSociales.whatsapp;
  const waUrl = EMPRESA.redesSociales.whatsappUrl;
  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#F7F3EE;border-radius:0 0 12px 12px;padding:20px;text-align:center;border-top:1px solid #E6DCD2;font-family:'Inter',sans-serif;font-size:12px;color:#786961;">
      <tr>
        <td>
          <p style="margin:0 0 8px;font-weight:600;color:#3E2723;">
            ¿Necesitas ayuda con tu pedido? Estamos a tu disposición:
          </p>
          <p style="margin:0 0 12px;">
            <a href="${waUrl}" style="display:inline-block;background:#25D366;color:#FFF;text-decoration:none;padding:6px 14px;border-radius:6px;font-weight:600;font-size:12px;">
              💬 Escribir por WhatsApp (${wa})
            </a>
          </p>
          <p style="margin:0 0 4px;font-size:11px;color:#9E8F87;">
            Este correo es una notificación automática generada por el sistema e-commerce de Chocolates Para Ti (Solur S.R.L.).
          </p>
          <p style="margin:0;font-size:10px;color:#B0A49C;">
            DOCUMENTO NO VÁLIDO PARA CRÉDITO FISCAL - NOTA DE VENTA WEB
          </p>
        </td>
      </tr>
    </table>
  `;
}

/**
 * Genera la tabla HTML de ítems de compra.
 */
function renderItemsTableHTML(items = []) {
  if (!items || items.length === 0) return '';
  const rows = items
    .map(
      (item) => `
      <tr style="border-bottom:1px solid #EFEAE4;">
        <td style="padding:10px 8px;font-size:13px;color:#3E2723;font-family:'Inter',sans-serif;">
          <strong>${item.nombre || item.producto_nombre || 'Producto'}</strong>
          ${item.sku ? `<div style="font-size:11px;color:#8D7F77;">SKU: ${item.sku}</div>` : ''}
        </td>
        <td style="padding:10px 8px;font-size:13px;color:#3E2723;text-align:center;font-family:'Inter',sans-serif;">
          ${item.cantidad}
        </td>
        <td style="padding:10px 8px;font-size:13px;color:#3E2723;text-align:right;font-family:'Inter',sans-serif;">
          Bs. ${Number(item.precio_unitario || item.precio || 0).toFixed(2)}
        </td>
        <td style="padding:10px 8px;font-size:13px;color:#3E2723;text-align:right;font-weight:600;font-family:'Inter',sans-serif;">
          Bs. ${Number(item.subtotal || (item.precio_unitario || item.precio || 0) * item.cantidad).toFixed(2)}
        </td>
      </tr>
    `
    )
    .join('');

  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:14px;border-collapse:collapse;">
      <thead>
        <tr style="background:#F7F3EE;border-bottom:2px solid #D4AF37;">
          <th style="padding:8px;font-size:11px;color:#5D4037;text-align:left;font-family:'Inter',sans-serif;text-transform:uppercase;">Producto</th>
          <th style="padding:8px;font-size:11px;color:#5D4037;text-align:center;font-family:'Inter',sans-serif;text-transform:uppercase;">Cant.</th>
          <th style="padding:8px;font-size:11px;color:#5D4037;text-align:right;font-family:'Inter',sans-serif;text-transform:uppercase;">P. Unit.</th>
          <th style="padding:8px;font-size:11px;color:#5D4037;text-align:right;font-family:'Inter',sans-serif;text-transform:uppercase;">Subtotal</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  `;
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * PLANTILLA 1: CONFIRMACIÓN DE COMPRA / PAGO EXITOSO
 * ─────────────────────────────────────────────────────────────────────────────
 */
function renderConfirmacionCompraHTML({ pedido, items = [] }) {
  const esEnvio = pedido.tipo_entrega === 'ENVIO_DOMICILIO';
  const headerHtml = renderHeaderHTML('¡Pago Confirmado Exitosamente!');
  const footerHtml = renderFooterHTML();
  const itemsHtml = renderItemsTableHTML(items);

  const bloqueEntrega = esEnvio
    ? `
      <div style="background:#F9F6F0;border-left:4px solid #D4AF37;padding:12px 16px;border-radius:4px;margin-bottom:18px;">
        <h4 style="margin:0 0 6px;color:#3E2723;font-size:14px;">🚚 Envío a Domicilio</h4>
        <p style="margin:0 0 4px;font-size:13px;color:#5D4037;"><strong>Dirección:</strong> ${pedido.direccion_envio || 'No especificada'} (${pedido.ciudad_destino || 'Bolivia'})</p>
        ${pedido.referencia_envio ? `<p style="margin:0 0 4px;font-size:12px;color:#786961;"><strong>Referencia:</strong> ${pedido.referencia_envio}</p>` : ''}
        ${pedido.guia_envio ? `<p style="margin:4px 0 0;font-size:13px;color:#2563EB;"><strong>N° Guía Courier:</strong> <span style="font-family:monospace;font-size:14px;background:#EFF6FF;padding:2px 8px;border-radius:4px;border:1px solid #BFDBFE;">${pedido.guia_envio}</span></p>` : ''}
      </div>
    `
    : `
      <div style="background:#F9F6F0;border-left:4px solid #10B981;padding:12px 16px;border-radius:4px;margin-bottom:18px;">
        <h4 style="margin:0 0 6px;color:#3E2723;font-size:14px;">🏬 Retiro en Agencia Autorizada</h4>
        <p style="margin:0 0 4px;font-size:13px;color:#5D4037;"><strong>Agencia:</strong> ${pedido.agencia_nombre || 'Sucursal Solur S.R.L.'} - ${pedido.agencia_ciudad || 'Bolivia'}</p>
        ${pedido.agencia_direccion ? `<p style="margin:0 0 4px;font-size:12px;color:#786961;"><strong>Dirección:</strong> ${pedido.agencia_direccion}</p>` : ''}
        ${pedido.codigo_retiro ? `<p style="margin:6px 0 0;font-size:13px;color:#047857;"><strong>Código Seguro de Retiro:</strong> <span style="font-family:monospace;font-size:15px;font-weight:bold;background:#ECFDF5;padding:2px 10px;border-radius:4px;border:1px solid #A7F3D0;letter-spacing:1px;">${pedido.codigo_retiro}</span></p>` : ''}
        <p style="margin:6px 0 0;font-size:11px;color:#6B7280;">Presenta tu Cédula de Identidad y este código en caja para retirar tu pedido.</p>
      </div>
    `;

  return `
    <!DOCTYPE html>
    <html lang="es">
    <head><meta charset="UTF-8"/></head>
    <body style="margin:0;padding:20px 10px;background:#ECE6E0;font-family:'Inter',Arial,sans-serif;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;margin:0 auto;background:#FFFFFF;border-radius:12px;box-shadow:0 4px 16px rgba(0,0,0,0.08);overflow:hidden;">
        <tr><td>${headerHtml}</td></tr>
        <tr>
          <td style="padding:24px 20px;">
            <p style="margin:0 0 12px;font-size:15px;color:#3E2723;">
              Estimado(a) <strong>${pedido.cliente_nombre || 'Cliente'}</strong>,
            </p>
            <p style="margin:0 0 18px;font-size:13px;line-height:1.5;color:#5D4037;">
              ¡Muchas gracias por tu compra! Tu pago ha sido confirmado correctamente y tu orden ya ha ingresado a nuestra línea de logística en Chocolates Para Ti.
            </p>

            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#FAF8F5;border:1px solid #EFEAE4;border-radius:8px;padding:12px 16px;margin-bottom:18px;">
              <tr>
                <td style="font-size:12px;color:#786961;padding:4px 0;"><strong>Código de Pedido:</strong></td>
                <td style="font-size:14px;color:#3E2723;font-weight:bold;text-align:right;font-family:monospace;">${pedido.codigo_pedido}</td>
              </tr>
              <tr>
                <td style="font-size:12px;color:#786961;padding:4px 0;"><strong>Método de Pago:</strong></td>
                <td style="font-size:12px;color:#3E2723;text-align:right;">${pedido.metodo_pago || 'Electrónico'}</td>
              </tr>
              <tr>
                <td style="font-size:12px;color:#786961;padding:4px 0;"><strong>Estado del Pedido:</strong></td>
                <td style="font-size:12px;color:#16A34A;font-weight:bold;text-align:right;">PAGADO</td>
              </tr>
              <tr>
                <td style="font-size:12px;color:#786961;padding:4px 0;"><strong>Fecha:</strong></td>
                <td style="font-size:12px;color:#3E2723;text-align:right;">${new Date().toLocaleDateString('es-BO')}</td>
              </tr>
            </table>

            ${bloqueEntrega}

            <h4 style="margin:16px 0 4px;font-size:14px;color:#3E2723;border-bottom:1px solid #EFEAE4;padding-bottom:6px;">
              Resumen de Productos
            </h4>
            ${itemsHtml}

            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:14px;border-top:1px solid #EFEAE4;padding-top:10px;">
              <tr>
                <td style="font-size:12px;color:#786961;padding:3px 0;">Subtotal:</td>
                <td style="font-size:12px;color:#3E2723;text-align:right;">Bs. ${Number(pedido.subtotal || 0).toFixed(2)}</td>
              </tr>
              <tr>
                <td style="font-size:12px;color:#786961;padding:3px 0;">Costo de Envío:</td>
                <td style="font-size:12px;color:#3E2723;text-align:right;">Bs. ${Number(pedido.costo_envio || 0).toFixed(2)}</td>
              </tr>
              ${pedido.descuento && Number(pedido.descuento) > 0 ? `
              <tr>
                <td style="font-size:12px;color:#16A34A;padding:3px 0;">Descuento aplicado:</td>
                <td style="font-size:12px;color:#16A34A;text-align:right;">- Bs. ${Number(pedido.descuento).toFixed(2)}</td>
              </tr>` : ''}
              <tr style="font-size:15px;font-weight:bold;color:#3E2723;">
                <td style="padding:8px 0 0;border-top:2px solid #D4AF37;">Total Pagado:</td>
                <td style="padding:8px 0 0;border-top:2px solid #D4AF37;text-align:right;color:#D4AF37;">
                  Bs. ${Number(pedido.total || 0).toFixed(2)}
                  ${pedido.monto_usd ? `<div style="font-size:11px;color:#786961;font-weight:normal;">($ ${Number(pedido.monto_usd).toFixed(2)} USD)</div>` : ''}
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr><td>${footerHtml}</td></tr>
      </table>
    </body>
    </html>
  `;
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * PLANTILLA 2: INSTRUCCIONES DE PAGO PENDIENTE (TRANSFERENCIA / EFECTIVO / QR)
 * ─────────────────────────────────────────────────────────────────────────────
 */
function renderInstruccionesPagoHTML({ pedido, items = [], metodoPago, datosPago = {} }) {
  const headerHtml = renderHeaderHTML('Instrucciones para Completar tu Pago');
  const footerHtml = renderFooterHTML();
  const itemsHtml = renderItemsTableHTML(items);

  let instruccionesEspecificas = '';

  if (metodoPago === 'TRANSFERENCIA') {
    instruccionesEspecificas = `
      <div style="background:#FFFBEB;border:1px solid #FDE68A;border-radius:8px;padding:16px;margin-bottom:18px;">
        <h4 style="margin:0 0 10px;color:#92400E;font-size:14px;">🏦 Datos Bancarios Oficiales de Solur S.R.L.</h4>
        <p style="margin:0 0 6px;font-size:13px;color:#78350F;">
          Tu stock se encuentra <strong>reservado por 24 horas</strong>. Por favor realiza la transferencia bancaria con los siguientes datos:
        </p>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:8px;font-size:12px;color:#78350F;">
          <tr><td style="padding:3px 0;"><strong>Titular:</strong></td><td>Solur S.R.L.</td></tr>
          <tr><td style="padding:3px 0;"><strong>Banco:</strong></td><td>${EMPRESA.datosBancarios.banco}</td></tr>
          <tr><td style="padding:3px 0;"><strong>N° de Cuenta:</strong></td><td>${EMPRESA.datosBancarios.numeroCuenta}</td></tr>
          <tr><td style="padding:3px 0;"><strong>Tipo de Cuenta:</strong></td><td>${EMPRESA.datosBancarios.tipoCuenta}</td></tr>
          <tr><td style="padding:3px 0;"><strong>Referencia requerida:</strong></td><td style="font-family:monospace;font-weight:bold;">${pedido.codigo_pedido}</td></tr>
        </table>
        <div style="margin-top:12px;padding-top:10px;border-top:1px dashed #FCD34D;font-size:12px;color:#92400E;">
          📌 <strong>Paso final:</strong> Ingresa a la tienda web o contacta a nuestro equipo por WhatsApp para subir la foto/PDF de tu comprobante o número de operación.
        </div>
      </div>
    `;
  } else if (metodoPago === 'EFECTIVO_TIENDA') {
    instruccionesEspecificas = `
      <div style="background:#ECFDF5;border:1px solid #A7F3D0;border-radius:8px;padding:16px;margin-bottom:18px;">
        <h4 style="margin:0 0 10px;color:#065F46;font-size:14px;">💵 Pago en Efectivo al Retirar en Tienda</h4>
        <p style="margin:0 0 6px;font-size:13px;color:#047857;">
          Tus chocolates están <strong>reservados exclusivamente para ti por 48 horas</strong> en nuestra agencia oficial:
        </p>
        <p style="margin:4px 0;font-size:13px;color:#064E3B;"><strong>Agencia:</strong> ${pedido.agencia_nombre || 'Sucursal Seleccionada'}</p>
        ${pedido.agencia_direccion ? `<p style="margin:2px 0;font-size:12px;color:#047857;"><strong>Dirección:</strong> ${pedido.agencia_direccion}</p>` : ''}
        <div style="margin-top:12px;padding:10px;background:#FFFFFF;border-radius:6px;border:1px solid #D1FAE5;font-size:12px;color:#065F46;">
          Presenta tu <strong>Código de Pedido: <span style="font-family:monospace;font-weight:bold;">${pedido.codigo_pedido}</span></strong> en la caja de la agencia para cancelar en efectivo (Bs. ${Number(pedido.total).toFixed(2)}) y retirar tus chocolates.
        </div>
      </div>
    `;
  } else {
    // QR Simple
    instruccionesEspecificas = `
      <div style="background:#EFF6FF;border:1px solid #BFDBFE;border-radius:8px;padding:16px;margin-bottom:18px;">
        <h4 style="margin:0 0 8px;color:#1E40AF;font-size:14px;">📱 Pago con QR Simple Bolivia</h4>
        <p style="margin:0 0 6px;font-size:13px;color:#1E3A8A;">
          Recuerda que el código QR generado tiene una <strong>vigencia estricta de 15 minutos</strong>.
        </p>
        <p style="margin:0;font-size:12px;color:#3B82F6;">
          Total a pagar: <strong>Bs. ${Number(pedido.total).toFixed(2)}</strong> | Pedido: <strong>${pedido.codigo_pedido}</strong>
        </p>
      </div>
    `;
  }

  return `
    <!DOCTYPE html>
    <html lang="es">
    <head><meta charset="UTF-8"/></head>
    <body style="margin:0;padding:20px 10px;background:#ECE6E0;font-family:'Inter',Arial,sans-serif;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;margin:0 auto;background:#FFFFFF;border-radius:12px;box-shadow:0 4px 16px rgba(0,0,0,0.08);overflow:hidden;">
        <tr><td>${headerHtml}</td></tr>
        <tr>
          <td style="padding:24px 20px;">
            <p style="margin:0 0 12px;font-size:15px;color:#3E2723;">
              Hola <strong>${pedido.cliente_nombre || 'Cliente'}</strong>,
            </p>
            <p style="margin:0 0 18px;font-size:13px;line-height:1.5;color:#5D4037;">
              Tu pedido <strong>${pedido.codigo_pedido}</strong> ha sido registrado con éxito. Para asegurar tus chocolates y despachar tu compra, completa tu pago siguiendo estas instrucciones:
            </p>

            ${instruccionesEspecificas}

            <h4 style="margin:16px 0 4px;font-size:14px;color:#3E2723;border-bottom:1px solid #EFEAE4;padding-bottom:6px;">
              Detalle del Pedido Reservado
            </h4>
            ${itemsHtml}

            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:14px;border-top:1px solid #EFEAE4;padding-top:10px;">
              <tr style="font-size:15px;font-weight:bold;color:#3E2723;">
                <td style="padding:6px 0;">Total por Pagar:</td>
                <td style="padding:6px 0;text-align:right;color:#D4AF37;">Bs. ${Number(pedido.total || 0).toFixed(2)}</td>
              </tr>
            </table>
          </td>
        </tr>
        <tr><td>${footerHtml}</td></tr>
      </table>
    </body>
    </html>
  `;
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * PLANTILLA 3: ACTUALIZACIÓN / CAMBIO DE ESTADO DEL PEDIDO
 * ─────────────────────────────────────────────────────────────────────────────
 */
function renderCambioEstadoHTML({ pedido, nuevoEstado, motivo = '', comentario = '' }) {
  const info = ESTADOS_INFO[nuevoEstado] || {
    titulo: nuevoEstado,
    icono: '🔔',
    color: '#4A2E1B',
    descripcion: `Tu pedido ha cambiado de estado a ${nuevoEstado}.`,
  };

  const headerHtml = renderHeaderHTML(`Actualización: ${info.titulo}`);
  const footerHtml = renderFooterHTML();

  return `
    <!DOCTYPE html>
    <html lang="es">
    <head><meta charset="UTF-8"/></head>
    <body style="margin:0;padding:20px 10px;background:#ECE6E0;font-family:'Inter',Arial,sans-serif;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;margin:0 auto;background:#FFFFFF;border-radius:12px;box-shadow:0 4px 16px rgba(0,0,0,0.08);overflow:hidden;">
        <tr><td>${headerHtml}</td></tr>
        <tr>
          <td style="padding:24px 20px;">
            <p style="margin:0 0 12px;font-size:15px;color:#3E2723;">
              Estimado(a) <strong>${pedido.cliente_nombre || 'Cliente'}</strong>,
            </p>
            <p style="margin:0 0 18px;font-size:13px;line-height:1.5;color:#5D4037;">
              Te informamos que tu pedido <strong>${pedido.codigo_pedido}</strong> presenta una nueva actualización:
            </p>

            <div style="background:#FAF8F5;border-left:4px solid ${info.color};padding:16px;border-radius:4px;margin-bottom:18px;">
              <div style="font-size:24px;margin-bottom:6px;">${info.icono}</div>
              <h3 style="margin:0 0 6px;color:${info.color};font-size:16px;">
                ${info.titulo}
              </h3>
              <p style="margin:0;font-size:13px;color:#5D4037;line-height:1.5;">
                ${info.descripcion}
              </p>
              ${motivo ? `<p style="margin:8px 0 0;font-size:12px;color:#786961;"><strong>Motivo:</strong> ${motivo}</p>` : ''}
              ${comentario ? `<p style="margin:4px 0 0;font-size:12px;color:#786961;"><strong>Detalle adicional:</strong> ${comentario}</p>` : ''}
            </div>

            <!-- Datos de Entrega actualizados si aplican -->
            ${pedido.guia_envio ? `
              <div style="background:#EFF6FF;border:1px solid #BFDBFE;padding:12px;border-radius:6px;margin-bottom:14px;font-size:13px;color:#1E3A8A;">
                🚚 <strong>Guía de seguimiento de tu courier:</strong>
                <span style="font-family:monospace;font-weight:bold;margin-left:6px;background:#FFFFFF;padding:2px 8px;border-radius:4px;">${pedido.guia_envio}</span>
              </div>
            ` : ''}

            ${pedido.codigo_retiro ? `
              <div style="background:#ECFDF5;border:1px solid #A7F3D0;padding:12px;border-radius:6px;margin-bottom:14px;font-size:13px;color:#065F46;">
                🏬 <strong>Tu código seguro para retirar en agencia:</strong>
                <span style="font-family:monospace;font-weight:bold;margin-left:6px;background:#FFFFFF;padding:2px 8px;border-radius:4px;">${pedido.codigo_retiro}</span>
              </div>
            ` : ''}

            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#FAF8F5;border:1px solid #EFEAE4;border-radius:8px;padding:12px 16px;margin-top:16px;">
              <tr>
                <td style="font-size:12px;color:#786961;padding:3px 0;">Código de Pedido:</td>
                <td style="font-size:12px;color:#3E2723;font-weight:bold;text-align:right;font-family:monospace;">${pedido.codigo_pedido}</td>
              </tr>
              <tr>
                <td style="font-size:12px;color:#786961;padding:3px 0;">Total:</td>
                <td style="font-size:12px;color:#3E2723;text-align:right;">Bs. ${Number(pedido.total || 0).toFixed(2)}</td>
              </tr>
              <tr>
                <td style="font-size:12px;color:#786961;padding:3px 0;">Estado Actual:</td>
                <td style="font-size:12px;color:${info.color};font-weight:bold;text-align:right;">${info.titulo}</td>
              </tr>
            </table>
          </td>
        </tr>
        <tr><td>${footerHtml}</td></tr>
      </table>
    </body>
    </html>
  `;
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * PLANTILLA 4: MENSAJES WHATSAPP (Texto formateado para wa.me y API Business)
 * ─────────────────────────────────────────────────────────────────────────────
 */

/**
 * Genera el texto redactado de confirmación de compra para WhatsApp.
 * Incluye: Pedido, productos, total, método de pago y guía o código de retiro.
 */
function generarTextoWhatsAppCompra({ pedido, items = [] }) {
  const lineasItems = (items || []).map((it, idx) => {
    const nombre = it.nombre || it.producto_nombre || 'Producto';
    const cant = it.cantidad || 1;
    const precio = Number(it.subtotal || (it.precio_unitario || 0) * cant).toFixed(2);
    return `   ${idx + 1}. ${nombre} (x${cant}) - Bs. ${precio}`;
  }).join('\n');

  let entregaInfo = '';
  if (pedido.tipo_entrega === 'ENVIO_DOMICILIO') {
    entregaInfo = `📍 *Envío a domicilio:* ${pedido.ciudad_destino || 'Bolivia'}\n` +
      (pedido.guia_envio ? `🚚 *Guía Courier:* ${pedido.guia_envio}\n` : '');
  } else {
    entregaInfo = `🏬 *Retiro en Agencia:* ${pedido.agencia_nombre || 'Sucursal Propia'}\n` +
      (pedido.codigo_retiro ? `🔑 *Código de Retiro:* ${pedido.codigo_retiro}\n` : '');
  }

  const metodoPago = pedido.metodo_pago || 'Electrónico';
  const total = Number(pedido.total || 0).toFixed(2);

  return (
    `🍫 *Chocolates Para Ti · Sucre, Bolivia*\n` +
    `¡Hola! Confirmo los detalles de mi pedido web:\n\n` +
    `📋 *Código de Pedido:* ${pedido.codigo_pedido}\n` +
    `👤 *Cliente:* ${pedido.cliente_nombre || 'Cliente'}\n` +
    `💳 *Método de Pago:* ${metodoPago} (${pedido.estado_pago || 'PAGADO'})\n` +
    `${entregaInfo}` +
    `🛍️ *Productos:*\n${lineasItems || '   (Ver detalle en orden)'}\n\n` +
    `💰 *Total:* Bs. ${total}\n\n` +
    `¡Muchas gracias!`
  );
}

/**
 * Genera el texto para que el cliente consulte o escriba directamente a la empresa.
 */
function generarTextoWhatsAppContacto({ pedidoCodigo = null, consulta = null } = {}) {
  if (pedidoCodigo) {
    return (
      `Hola Chocolates Para Ti, me comunico respecto a mi pedido *${pedidoCodigo}* ` +
      `para coordinar detalles o consultar sobre el despacho.`
    );
  }
  return consulta || EMPRESA.redesSociales.mensajePredeterminadoWhatsApp;
}

/**
 * Genera el texto para notificar actualización de estado por WhatsApp.
 */
function generarTextoWhatsAppEstado({ pedido, nuevoEstado, motivo = '' }) {
  const info = ESTADOS_INFO[nuevoEstado] || { titulo: nuevoEstado, icono: '🔔' };
  let extra = '';
  if (pedido.guia_envio && (nuevoEstado === 'DESPACHADO' || nuevoEstado === 'LISTO_DESPACHO')) {
    extra = `\n🚚 *Guía Courier:* ${pedido.guia_envio}`;
  } else if (pedido.codigo_retiro && nuevoEstado === 'LISTO_RECOJO') {
    extra = `\n🔑 *Código Seguro de Retiro:* ${pedido.codigo_retiro}`;
  }
  if (motivo) {
    extra += `\n💬 *Motivo:* ${motivo}`;
  }

  return (
    `🍫 *Chocolates Para Ti*\n` +
    `Actualización de tu pedido *${pedido.codigo_pedido}*:\n\n` +
    `${info.icono} Estado: *${info.titulo}*\n` +
    `${info.descripcion}${extra}\n\n` +
    `¡Gracias por tu confianza!`
  );
}

module.exports = {
  ESTADOS_INFO,
  renderConfirmacionCompraHTML,
  renderInstruccionesPagoHTML,
  renderCambioEstadoHTML,
  generarTextoWhatsAppCompra,
  generarTextoWhatsAppContacto,
  generarTextoWhatsAppEstado,
};
