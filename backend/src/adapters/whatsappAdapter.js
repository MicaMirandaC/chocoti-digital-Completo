/**
 * @file adapters/whatsappAdapter.js
 * @description Adaptador para mensajería de WhatsApp transaccional.
 *
 * ============================================================================
 * DOCUMENTACIÓN DE INTEGRACIÓN WHATSAPP (DIRECTA VS CLOUD API):
 * ============================================================================
 * La mensajería con clientes mediante WhatsApp se aborda con dos estrategias
 * complementarias conforme a las especificaciones del Módulo 6:
 *
 *  1. ENLACES DIRECTOS wa.me (Sin costo ni infraestructura intermedia):
 *     Genera URLs directas codificadas mediante el protocolo universal de WhatsApp
 *     (https://wa.me/<numero>?text=<mensaje_codificado>) para dos casos de uso:
 *       a) "Enviar por WhatsApp": Permite al cliente compartir el resumen formal de
 *          su compra (pedido, productos, total, método de pago y guía de transporte).
 *       b) "Escribir a la Empresa": Abre un canal de chat directo con atención al
 *          cliente de Chocolates Para Ti (+591 71163789) con el contexto del pedido.
 *
 *  2. CONECTOR SERVIDOR WHATSAPP BUSINESS CLOUD API (Modo Simulado / Documentado):
 *     La API Cloud oficial de Meta (Facebook Graph API) requiere:
 *       - Cuenta de desarrollador Meta for Developers y registro de Meta App.
 *       - WhatsApp Business Account (WABA) con verificación de negocio (Solur S.R.L.).
 *       - Número telefónico dedicado y aprobado (no compatible con la app WhatsApp regular).
 *       - Plantillas pre-aprobadas por Meta (Utility / Service Templates).
 *       - Token de usuario de sistema permanente (`WHATSAPP_API_TOKEN`) y `WHATSAPP_PHONE_NUMBER_ID`.
 *     En ausencia de dichas credenciales corporativas, este adaptador opera en modo
 *     SIMULADO, auditando cada notificación en la tabla `notificaciones_logs` con
 *     canal 'WHATSAPP' y estado 'SIMULADO' sin bloquear la ejecución.
 *
 * ChocoTi-Digital | Capa 2: Servicios y Adaptadores de Integración
 */

'use strict';

const db = require('../config/database');
const EMPRESA = require('../../../config/empresa');
const {
  generarTextoWhatsAppCompra,
  generarTextoWhatsAppContacto,
  generarTextoWhatsAppEstado,
} = require('../templates/notificacionesTemplates');

class WhatsAppAdapter {
  /**
   * Obtiene el número oficial de WhatsApp de la empresa normalizado en formato internacional
   * sin símbolos ni espacios (ej. 59171163789).
   * @returns {string}
   */
  static obtenerNumeroEmpresaNormalizado() {
    const raw = process.env.WHATSAPP_BUSINESS_PHONE || EMPRESA.redesSociales.whatsapp || '59171163789';
    return String(raw).replace(/\D/g, '');
  }

  /**
   * Normaliza un número telefónico de cliente a formato internacional.
   * Si es un número boliviano de 8 dígitos, antepone el código de país '591'.
   * @param {string} telefono
   * @returns {string}
   */
  static normalizarTelefonoCliente(telefono) {
    if (!telefono) return '';
    const limpio = String(telefono).replace(/\D/g, '');
    if (limpio.length === 8) {
      return `591${limpio}`;
    }
    return limpio;
  }

  /**
   * Genera el enlace wa.me para que el cliente comparta el resumen estructurado de compra.
   *
   * @param {object} param
   * @param {object} param.pedido
   * @param {Array<object>} [param.items=[]]
   * @returns {{ url: string, textoPlano: string, numeroDestino: string }}
   */
  static generarEnlaceCompra({ pedido, items = [] }) {
    const numero = WhatsAppAdapter.obtenerNumeroEmpresaNormalizado();
    const texto = generarTextoWhatsAppCompra({ pedido, items });
    const url = `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;

    return {
      url,
      textoPlano: texto,
      numeroDestino: numero,
    };
  }

  /**
   * Genera el enlace wa.me para que el cliente escriba directamente a la empresa con consulta.
   *
   * @param {object} [param={}]
   * @param {string|null} [param.pedidoCodigo=null]
   * @param {string|null} [param.consulta=null]
   * @returns {{ url: string, textoPlano: string, numeroDestino: string }}
   */
  static generarEnlaceContacto({ pedidoCodigo = null, consulta = null } = {}) {
    const numero = WhatsAppAdapter.obtenerNumeroEmpresaNormalizado();
    const texto = generarTextoWhatsAppContacto({ pedidoCodigo, consulta });
    const url = `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;

    return {
      url,
      textoPlano: texto,
      numeroDestino: numero,
    };
  }

  /**
   * Genera el enlace wa.me para avisar un cambio de estado del pedido.
   *
   * @param {object} param
   * @param {object} param.pedido
   * @param {string} param.nuevoEstado
   * @param {string} [param.motivo='']
   * @returns {{ url: string, textoPlano: string, numeroDestino: string }}
   */
  static generarEnlaceEstado({ pedido, nuevoEstado, motivo = '' }) {
    const numero = WhatsAppAdapter.obtenerNumeroEmpresaNormalizado();
    const texto = generarTextoWhatsAppEstado({ pedido, nuevoEstado, motivo });
    const url = `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;

    return {
      url,
      textoPlano: texto,
      numeroDestino: numero,
    };
  }

  /**
   * Despacha un mensaje de WhatsApp a través del conector de servidor (API Cloud o Simulado).
   * Siempre opera de forma segura y no bloqueante.
   *
   * @param {object} param
   * @param {string} param.telefono
   * @param {string} param.mensaje
   * @param {number|null} [param.pedidoId=null]
   * @returns {Promise<{ ok: boolean, modo: 'REAL'|'SIMULADO', error?: string }>}
   */
  static async enviarMensaje({ telefono, mensaje, pedidoId = null }) {
    const apiToken = process.env.WHATSAPP_API_TOKEN;
    const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const destinoNormalizado = WhatsAppAdapter.normalizarTelefonoCliente(telefono);

    // 1. Despacho Real vía Meta WhatsApp Business Cloud API si existen credenciales válidas
    if (apiToken && phoneId && apiToken.trim().length > 0 && apiToken !== 'simulado') {
      try {
        console.log(`[WHATSAPP-ADAPTER] Despachando mensaje real vía Meta Cloud API a: ${destinoNormalizado}`);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000);

        const response = await fetch(`https://graph.facebook.com/v18.0/${phoneId}/messages`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiToken.trim()}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: destinoNormalizado,
            type: 'text',
            text: { preview_url: false, body: mensaje },
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          const resData = await response.json().catch(() => ({}));
          console.log(`[WHATSAPP-ADAPTER] Mensaje WhatsApp despachado vía Meta Cloud API. ID: ${resData.messages?.[0]?.id || 'OK'}`);

          WhatsAppAdapter.registrarLog({
            pedidoId,
            destinatario: destinoNormalizado,
            estado: 'ENVIADO',
            detalleError: null,
            mensajeResumen: mensaje.slice(0, 250),
          });

          return { ok: true, modo: 'REAL', metaId: resData.messages?.[0]?.id };
        } else {
          const errText = await response.text().catch(() => 'Error Meta API');
          console.warn(`[WHATSAPP-ADAPTER] Error en Meta Cloud API (${response.status}): ${errText}. Conmutando a modo simulado...`);
        }
      } catch (cloudErr) {
        console.warn(`[WHATSAPP-ADAPTER] Falla en conexión con Meta Cloud API: ${cloudErr.message}. Conmutando a simulación...`);
      }
    }

    // 2. Conector Simulado (Registra auditoría en notificaciones_logs)
    try {
      WhatsAppAdapter.registrarLog({
        pedidoId,
        destinatario: destinoNormalizado || telefono || 'No especificado',
        estado: 'SIMULADO',
        detalleError: 'Conector simulado de WhatsApp Business activo (sin credenciales Meta Cloud WABA)',
        mensajeResumen: mensaje.slice(0, 250),
      });

      console.log(`[WHATSAPP-ADAPTER] Notificación WhatsApp simulada registrada para: ${destinoNormalizado || telefono}`);
      return { ok: true, modo: 'SIMULADO' };
    } catch (logErr) {
      console.error('[WHATSAPP-ADAPTER] Error al registrar notificación simulada:', logErr.message);
      return { ok: false, modo: 'SIMULADO', error: logErr.message };
    }
  }

  /**
   * Registra el resultado en la bitácora inmutable (notificaciones_logs).
   */
  static registrarLog({ pedidoId, destinatario, estado, detalleError = null, mensajeResumen = null }) {
    try {
      db.prepare(`
        INSERT INTO notificaciones_logs (pedido_id, canal, destinatario, estado, detalle_error, mensaje_resumen)
        VALUES (?, 'WHATSAPP', ?, ?, ?, ?)
      `).run(pedidoId, destinatario, estado, detalleError, mensajeResumen);
    } catch (err) {
      try {
        db.prepare(`
          INSERT INTO notificaciones_logs (pedido_id, canal, destinatario, estado, detalle_error)
          VALUES (?, 'WHATSAPP', ?, ?, ?)
        `).run(pedidoId, destinatario, estado, detalleError || mensajeResumen);
      } catch (innerErr) {
        console.warn('[WHATSAPP-ADAPTER] No se pudo guardar en notificaciones_logs:', innerErr.message);
      }
    }
  }
}

module.exports = WhatsAppAdapter;
