/**
 * @file services/notificacionesService.js
 * @description Servicio unificado para orquestar notificaciones multicanal (Email y WhatsApp).
 * Integra los adaptadores de integración (EmailAdapter y WhatsAppAdapter) con las
 * plantillas transaccionales centralizadas en notificacionesTemplates.js.
 *
 * REGLA DE FIABILIDAD ESTRICTA:
 * Todo despacho de notificación está protegido por bloques try/catch independientes
 * para garantizar que ninguna falla en servicios externos, red o simulación bloquee
 * ni aborte la transacción principal de pedidos, confirmación de pagos o transiciones.
 *
 * ChocoTi-Digital | Capa 2: Lógica de Negocio y Control
 */

'use strict';

const db = require('../config/database');
const Pedido = require('../models/Pedido');
const EmailAdapter = require('../adapters/emailAdapter');
const WhatsAppAdapter = require('../adapters/whatsappAdapter');
const {
  ESTADOS_INFO,
  renderConfirmacionCompraHTML,
  renderInstruccionesPagoHTML,
  renderCambioEstadoHTML,
  generarTextoWhatsAppCompra,
  generarTextoWhatsAppContacto,
  generarTextoWhatsAppEstado,
} = require('../templates/notificacionesTemplates');

class NotificacionesService {
  /**
   * Notifica al cliente al registrar un nuevo pedido en checkout.
   * Si el método es diferido (Depósito o Efectivo en Tienda), envía instrucciones de pago.
   *
   * @param {object} param
   * @param {object} param.pedido
   * @param {Array<object>} [param.items=[]]
   * @param {object} [param.datosPago={}]
   * @returns {Promise<{ ok: boolean, emailDespachado: boolean, whatsappDespachado: boolean }>}
   */
  static async notificarCreacionPedido({ pedido, items = [], datosPago = {} }) {
    let emailDespachado = false;
    let whatsappDespachado = false;

    if (!pedido || !pedido.cliente_email) {
      return { ok: false, mensaje: 'Pedido o correo de cliente no disponible' };
    }

    const metodo = pedido.metodo_pago;

    // Solo se envían instrucciones de pago diferido para TRANSFERENCIA, EFECTIVO_TIENDA o QR pendiente
    if (['TRANSFERENCIA', 'EFECTIVO_TIENDA', 'QR'].includes(metodo)) {
      // 1. Envío de Correo con Instrucciones de Pago (Try/Catch protegido)
      try {
        const itemsParaPlantilla = items.length > 0 ? items : (pedido.detalles || []);
        const html = renderInstruccionesPagoHTML({
          pedido: {
            ...pedido,
            agencia_nombre: pedido.punto_recojo_nombre || pedido.agencia_nombre,
            agencia_direccion: pedido.punto_recojo_direccion || pedido.agencia_direccion,
          },
          items: itemsParaPlantilla,
          metodoPago: metodo,
          datosPago,
        });

        const asunto = `🍫 Instrucciones de Pago - Pedido ${pedido.codigo_pedido} - Chocolates Para Ti`;
        const respEmail = await EmailAdapter.enviarCorreo({
          destinatario: pedido.cliente_email,
          asunto,
          contenidoHtml: html,
          tipo: 'INSTRUCCIONES_PAGO',
          pedidoId: pedido.id,
        });

        emailDespachado = Boolean(respEmail.ok);
      } catch (errEmail) {
        console.warn(`[NOTIFICACIONES-SERVICE] Error no bloqueante al enviar correo de instrucciones (${pedido.codigo_pedido}):`, errEmail.message);
      }

      // 2. Despacho WhatsApp con Instrucciones (Try/Catch protegido)
      if (pedido.cliente_telefono) {
        try {
          let textoWa = `🍫 *Chocolates Para Ti*\n¡Hola ${pedido.cliente_nombre || 'Cliente'}! Tu pedido *${pedido.codigo_pedido}* ha sido registrado.\n`;
          if (metodo === 'TRANSFERENCIA') {
            textoWa += `Stock reservado por 24h. Recuerda transferir Bs. ${Number(pedido.total).toFixed(2)} y subir tu comprobante bancario.`;
          } else if (metodo === 'EFECTIVO_TIENDA') {
            textoWa += `Stock reservado por 48h. Puedes pasar por la agencia seleccionada a cancelar Bs. ${Number(pedido.total).toFixed(2)} en caja.`;
          } else {
            textoWa += `Total por pagar: Bs. ${Number(pedido.total).toFixed(2)}. Recuerda que el QR vence en 15 minutos.`;
          }

          const respWa = await WhatsAppAdapter.enviarMensaje({
            telefono: pedido.cliente_telefono,
            mensaje: textoWa,
            pedidoId: pedido.id,
          });

          whatsappDespachado = Boolean(respWa.ok);
        } catch (errWa) {
          console.warn(`[NOTIFICACIONES-SERVICE] Error no bloqueante al enviar WhatsApp de instrucciones (${pedido.codigo_pedido}):`, errWa.message);
        }
      }
    }

    return { ok: true, emailDespachado, whatsappDespachado };
  }

  /**
   * Dispara las notificaciones de confirmación de compra y pago exitoso (Email + WhatsApp).
   *
   * @param {object} param
   * @param {number} param.pedidoId
   * @param {string} [param.transaccionRef='']
   * @param {string} [param.proveedor='']
   * @param {number} [param.montoCobrado=0]
   * @returns {Promise<{ ok: boolean, emailDespachado: boolean, whatsappDespachado: boolean }>}
   */
  static async notificarConfirmacionPago({ pedidoId, transaccionRef = '', proveedor = '', montoCobrado = 0 }) {
    let emailDespachado = false;
    let whatsappDespachado = false;

    try {
      const pedido = Pedido.findById(pedidoId);
      if (!pedido) {
        console.warn(`[NOTIFICACIONES-SERVICE] Pedido #${pedidoId} no encontrado para confirmación de pago.`);
        return { ok: false, error: 'Pedido no encontrado' };
      }

      const items = pedido.detalles || [];
      const datosPedidoNormalizados = {
        ...pedido,
        agencia_nombre: pedido.punto_recojo_nombre || pedido.agencia_nombre,
        agencia_direccion: pedido.punto_recojo_direccion || pedido.agencia_direccion,
      };

      // 1. Envío de Correo de Confirmación de Compra
      try {
        const html = renderConfirmacionCompraHTML({
          pedido: datosPedidoNormalizados,
          items,
        });

        const asunto = `🍫 ¡Pago Confirmado! Pedido ${pedido.codigo_pedido} - Chocolates Para Ti`;
        const respEmail = await EmailAdapter.enviarCorreo({
          destinatario: pedido.cliente_email,
          asunto,
          contenidoHtml: html,
          tipo: 'CONFIRMACION_COMPRA',
          pedidoId: pedido.id,
        });

        emailDespachado = Boolean(respEmail.ok);
      } catch (errEmail) {
        console.warn(`[NOTIFICACIONES-SERVICE] Error no bloqueante al enviar correo de confirmación (${pedido.codigo_pedido}):`, errEmail.message);
      }

      // 2. Envío de WhatsApp de Confirmación (Conector Simulado / Cloud API)
      if (pedido.cliente_telefono) {
        try {
          const mensajeWhatsApp = generarTextoWhatsAppCompra({
            pedido: datosPedidoNormalizados,
            items,
          });

          const respWa = await WhatsAppAdapter.enviarMensaje({
            telefono: pedido.cliente_telefono,
            mensaje: mensajeWhatsApp,
            pedidoId: pedido.id,
          });

          whatsappDespachado = Boolean(respWa.ok);
        } catch (errWa) {
          console.warn(`[NOTIFICACIONES-SERVICE] Error no bloqueante al enviar WhatsApp de confirmación (${pedido.codigo_pedido}):`, errWa.message);
        }
      }
    } catch (generalErr) {
      console.warn(`[NOTIFICACIONES-SERVICE] Falla general no bloqueante en notificarConfirmacionPago:`, generalErr.message);
    }

    return { ok: true, emailDespachado, whatsappDespachado };
  }

  /**
   * Notifica al cliente de un cambio de estado en el pedido (Aviso al cliente en cada cambio).
   *
   * @param {object} param
   * @param {number} param.pedidoId
   * @param {string} [param.estadoAnterior='']
   * @param {string} param.nuevoEstado
   * @param {number|null} [param.usuarioId=null]
   * @param {string} [param.rol='SISTEMA']
   * @param {string} [param.motivo='']
   * @param {string} [param.comentario='']
   * @returns {Promise<{ ok: boolean, emailDespachado: boolean, whatsappDespachado: boolean }>}
   */
  static async notificarCambioEstado({
    pedidoId,
    estadoAnterior = '',
    nuevoEstado,
    usuarioId = null,
    rol = 'SISTEMA',
    motivo = '',
    comentario = '',
  }) {
    let emailDespachado = false;
    let whatsappDespachado = false;

    try {
      const pedido = Pedido.findById(pedidoId);
      if (!pedido) {
        console.warn(`[NOTIFICACIONES-SERVICE] Pedido #${pedidoId} no encontrado para notificar cambio de estado.`);
        return { ok: false, error: 'Pedido no encontrado' };
      }

      // Evitar notificaciones redundantes si el estado no cambió
      if (estadoAnterior && estadoAnterior === nuevoEstado) {
        return { ok: true, redundante: true };
      }

      const infoEstado = ESTADOS_INFO[nuevoEstado] || { titulo: nuevoEstado };
      const datosPedidoNormalizados = {
        ...pedido,
        agencia_nombre: pedido.punto_recojo_nombre || pedido.agencia_nombre,
        agencia_direccion: pedido.punto_recojo_direccion || pedido.agencia_direccion,
      };

      // 1. Envío de Correo de Cambio de Estado
      try {
        const html = renderCambioEstadoHTML({
          pedido: datosPedidoNormalizados,
          nuevoEstado,
          motivo,
          comentario,
        });

        const asunto = `📦 Actualización de tu pedido ${pedido.codigo_pedido}: ${infoEstado.titulo} - Chocolates Para Ti`;
        const respEmail = await EmailAdapter.enviarCorreo({
          destinatario: pedido.cliente_email,
          asunto,
          contenidoHtml: html,
          tipo: 'CAMBIO_ESTADO',
          pedidoId: pedido.id,
        });

        emailDespachado = Boolean(respEmail.ok);
      } catch (errEmail) {
        console.warn(`[NOTIFICACIONES-SERVICE] Error no bloqueante al enviar correo de cambio de estado (${pedido.codigo_pedido}):`, errEmail.message);
      }

      // 2. Envío de WhatsApp de Cambio de Estado
      if (pedido.cliente_telefono) {
        try {
          const mensajeWa = generarTextoWhatsAppEstado({
            pedido: datosPedidoNormalizados,
            nuevoEstado,
            motivo,
          });

          const respWa = await WhatsAppAdapter.enviarMensaje({
            telefono: pedido.cliente_telefono,
            mensaje: mensajeWa,
            pedidoId: pedido.id,
          });

          whatsappDespachado = Boolean(respWa.ok);
        } catch (errWa) {
          console.warn(`[NOTIFICACIONES-SERVICE] Error no bloqueante al enviar WhatsApp de cambio de estado (${pedido.codigo_pedido}):`, errWa.message);
        }
      }
    } catch (generalErr) {
      console.warn(`[NOTIFICACIONES-SERVICE] Falla general no bloqueante en notificarCambioEstado:`, generalErr.message);
    }

    return { ok: true, emailDespachado, whatsappDespachado };
  }

  /**
   * Retorna los enlaces directos wa.me para el pedido especificado.
   *
   * @param {string|number} idOCodigo
   * @returns {{ ok: boolean, data?: object, error?: string }}
   */
  static obtenerEnlacesWhatsApp(idOCodigo) {
    try {
      let pedido;
      if (typeof idOCodigo === 'number' || /^\d+$/.test(String(idOCodigo))) {
        pedido = Pedido.findById(Number(idOCodigo));
      } else {
        pedido = Pedido.findByCodigo(String(idOCodigo));
      }

      if (!pedido) {
        return { ok: false, error: 'Pedido no encontrado' };
      }

      const items = pedido.detalles || [];
      const datosPedidoNormalizados = {
        ...pedido,
        agencia_nombre: pedido.punto_recojo_nombre || pedido.agencia_nombre,
        agencia_direccion: pedido.punto_recojo_direccion || pedido.agencia_direccion,
      };

      const enlaceCompra = WhatsAppAdapter.generarEnlaceCompra({
        pedido: datosPedidoNormalizados,
        items,
      });

      const enlaceContacto = WhatsAppAdapter.generarEnlaceContacto({
        pedidoCodigo: pedido.codigo_pedido,
      });

      return {
        ok: true,
        data: {
          codigoPedido: pedido.codigo_pedido,
          cliente: pedido.cliente_nombre,
          enlaceCompra: enlaceCompra.url,
          textoCompra: enlaceCompra.textoPlano,
          enlaceContacto: enlaceContacto.url,
          textoContacto: enlaceContacto.textoPlano,
          numeroEmpresa: enlaceCompra.numeroDestino,
        },
      };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }
}

module.exports = NotificacionesService;
