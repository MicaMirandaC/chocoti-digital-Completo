/**
 * @file adapters/emailAdapter.js
 * @description Adaptador para despacho de correos electrónicos transaccionales.
 * 
 * ============================================================================
 * DOCUMENTACIÓN DE RED EN ENTORNO DE DESPLIEGUE (RENDER CLOUD):
 * ============================================================================
 * El plan gratuito de Render bloquea por defecto todo el tráfico saliente
 * hacia puertos SMTP tradicionales (puerto 25, 465 y 587) como medida de
 * protección contra spam y actividades maliciosas.
 *
 * Para garantizar la viabilidad y operatividad del sistema en Render sin costos
 * adicionales, este adaptador implementa el Patrón Adapter con Doble Driver:
 *
 *  1. DRIVER REAL (API HTTPS REST - Puerto 443):
 *     Despacha correos mediante llamadas HTTP POST sobre TLS/HTTPS (puerto estándar 443,
 *     completamente habilitado y libre de restricciones en Render) utilizando el servicio
 *     Resend (o Brevo) con plan gratuito de desarrollo. Requiere definir `EMAIL_API_KEY`
 *     y opcionalmente `EMAIL_FROM`.
 *
 *  2. DRIVER SIMULADO DE CONTINGENCIA (Fallback Local en SQLite):
 *     Si no se provee `EMAIL_API_KEY` (o si la API externa experimenta fallos o timeouts),
 *     el adaptador conmuta automáticamente y de forma silenciosa al modo simulado,
 *     persistiendo el contenido HTML completo en la tabla `bandeja_simulada` y auditando
 *     el evento en `notificaciones_logs`. La bandeja es consultable por el Administrador.
 *
 * ChocoTi-Digital | Capa 2: Servicios y Adaptadores de Integración
 */

'use strict';

const db = require('../config/database');

class EmailAdapter {
  /**
   * Envía un correo electrónico o lo almacena en la bandeja simulada de contingencia.
   *
   * @param {object} param
   * @param {string} param.destinatario
   * @param {string} param.asunto
   * @param {string} param.contenidoHtml
   * @param {string} [param.tipo='GENERAL'] - 'RECUPERAR_PASSWORD' | 'CONFIRMACION_COMPRA' | 'INSTRUCCIONES_PAGO' | 'CAMBIO_ESTADO' | 'GENERAL'
   * @param {number|null} [param.pedidoId=null]
   * @returns {Promise<{ ok: boolean, modo: 'REAL'|'SIMULADO', id?: number, error?: string }>}
   */
  static async enviarCorreo({ destinatario, asunto, contenidoHtml, tipo = 'GENERAL', pedidoId = null }) {
    const apiKey = process.env.EMAIL_API_KEY || process.env.RESEND_API_KEY;
    const remitente = process.env.EMAIL_FROM || 'Chocolates Para Ti <onboarding@resend.dev>';

    // 1. Driver Real vía API HTTPS REST (Resend) sobre puerto 443
    if (apiKey && apiKey.trim().length > 0 && apiKey.trim().toLowerCase() !== 'simulado') {
      try {
        console.log(`[EMAIL-ADAPTER] Despachando correo real vía API HTTPS (Resend) a: ${destinatario}`);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000); // 6 segundos timeout máximo

        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey.trim()}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: remitente,
            to: [destinatario],
            subject: asunto,
            html: contenidoHtml,
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          const resData = await response.json().catch(() => ({}));
          console.log(`[EMAIL-ADAPTER] Correo despachado con éxito vía HTTPS. ID externo: ${resData.id || 'N/A'}`);

          EmailAdapter.registrarLogNotificacion({
            pedidoId,
            canal: 'EMAIL',
            destinatario,
            estado: 'ENVIADO',
            detalleError: null,
            mensajeResumen: asunto,
          });

          return { ok: true, modo: 'REAL', idExterno: resData.id };
        } else {
          const errorBody = await response.text().catch(() => 'Error en respuesta');
          console.warn(`[EMAIL-ADAPTER] API HTTPS de correo respondió con error (${response.status}): ${errorBody}. Conmutando a modo simulado...`);
        }
      } catch (sendErr) {
        console.warn(`[EMAIL-ADAPTER] Error en proveedor HTTPS de correo (${sendErr.name || 'Error'}: ${sendErr.message}), conmutando a simulación...`);
      }
    }

    // 2. Driver Simulado de Respaldo: Registra en 'bandeja_simulada' de SQLite
    try {
      const stmt = db.prepare(`
        INSERT INTO bandeja_simulada (pedido_id, destinatario, asunto, contenido_html, tipo_notificacion)
        VALUES (?, ?, ?, ?, ?)
      `);
      const info = stmt.run(pedidoId, destinatario, asunto, contenidoHtml, tipo);

      EmailAdapter.registrarLogNotificacion({
        pedidoId,
        canal: 'EMAIL',
        destinatario,
        estado: 'SIMULADO',
        detalleError: null,
        mensajeResumen: asunto,
      });

      console.log(`[EMAIL-ADAPTER] Correo simulado almacenado en DB para: ${destinatario} | Asunto: ${asunto}`);
      return { ok: true, modo: 'SIMULADO', id: info.lastInsertRowid };
    } catch (dbErr) {
      console.error('[EMAIL-ADAPTER] Error al persistir correo simulado:', dbErr.message);
      EmailAdapter.registrarLogNotificacion({
        pedidoId,
        canal: 'EMAIL',
        destinatario,
        estado: 'FALLIDO',
        detalleError: dbErr.message,
        mensajeResumen: asunto,
      });
      return { ok: false, modo: 'SIMULADO', error: dbErr.message };
    }
  }

  /**
   * Registra el resultado en la bitácora inmutable de notificaciones (notificaciones_logs).
   */
  static registrarLogNotificacion({ pedidoId = null, canal, destinatario, estado, detalleError = null, mensajeResumen = null }) {
    try {
      db.prepare(`
        INSERT INTO notificaciones_logs (pedido_id, canal, destinatario, estado, detalle_error, mensaje_resumen)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(pedidoId, canal, destinatario, estado, detalleError, mensajeResumen);
    } catch (logErr) {
      // Intento de compatibilidad si la columna mensaje_resumen no estuviera disponible
      try {
        db.prepare(`
          INSERT INTO notificaciones_logs (pedido_id, canal, destinatario, estado, detalle_error)
          VALUES (?, ?, ?, ?, ?)
        `).run(pedidoId, canal, destinatario, estado, detalleError || mensajeResumen);
      } catch (innerErr) {
        console.warn('[EMAIL-ADAPTER] No se pudo guardar en notificaciones_logs:', innerErr.message);
      }
    }
  }

  /**
   * Retorna la bandeja de correos simulados para consulta del Administrador.
   * @param {number} [limite=50]
   * @param {number} [offset=0]
   * @returns {Array<object>}
   */
  static obtenerBandejaSimulada(limite = 50, offset = 0) {
    try {
      return db
        .prepare(`
          SELECT b.*, p.codigo_pedido, p.cliente_nombre
          FROM bandeja_simulada b
          LEFT JOIN pedidos p ON b.pedido_id = p.id
          ORDER BY b.fecha_envio DESC
          LIMIT ? OFFSET ?
        `)
        .all(limite, offset);
    } catch {
      try {
        return db
          .prepare(`SELECT * FROM bandeja_simulada ORDER BY fecha_envio DESC LIMIT ? OFFSET ?`)
          .all(limite, offset);
      } catch {
        return [];
      }
    }
  }

  /**
   * Obtiene un correo simulado específico por ID con su contenido HTML completo.
   * @param {number} id
   * @returns {object|null}
   */
  static obtenerBandejaPorId(id) {
    try {
      return db
        .prepare(`
          SELECT b.*, p.codigo_pedido, p.cliente_nombre
          FROM bandeja_simulada b
          LEFT JOIN pedidos p ON b.pedido_id = p.id
          WHERE b.id = ?
        `)
        .get(id) || null;
    } catch {
      return null;
    }
  }

  /**
   * Cuenta el total de correos en la bandeja simulada.
   * @returns {number}
   */
  static contarBandejaSimulada() {
    try {
      const row = db.prepare('SELECT COUNT(*) as count FROM bandeja_simulada').get();
      return row ? row.count : 0;
    } catch {
      return 0;
    }
  }

  /**
   * Retorna los registros de auditoría de notificaciones con filtros opcionales.
   * @param {object} filtros
   * @param {number} [filtros.limite=50]
   * @param {number} [filtros.offset=0]
   * @param {'EMAIL'|'WHATSAPP'} [filtros.canal]
   * @param {'ENVIADO'|'SIMULADO'|'FALLIDO'} [filtros.estado]
   * @param {number} [filtros.pedidoId]
   * @returns {Array<object>}
   */
  static obtenerLogsNotificaciones({ limite = 50, offset = 0, canal = null, estado = null, pedidoId = null } = {}) {
    try {
      let sql = `
        SELECT l.*, p.codigo_pedido, p.cliente_nombre
        FROM notificaciones_logs l
        LEFT JOIN pedidos p ON l.pedido_id = p.id
        WHERE 1=1
      `;
      const params = [];

      if (canal) {
        sql += ` AND l.canal = ?`;
        params.push(canal);
      }
      if (estado) {
        sql += ` AND l.estado = ?`;
        params.push(estado);
      }
      if (pedidoId) {
        sql += ` AND l.pedido_id = ?`;
        params.push(Number(pedidoId));
      }

      sql += ` ORDER BY l.fecha_registro DESC LIMIT ? OFFSET ?`;
      params.push(limite, offset);

      return db.prepare(sql).all(...params);
    } catch {
      return [];
    }
  }

  /**
   * Cuenta los registros de auditoría de notificaciones con filtros opcionales.
   * @param {object} filtros
   * @returns {number}
   */
  static contarLogsNotificaciones({ canal = null, estado = null, pedidoId = null } = {}) {
    try {
      let sql = `SELECT COUNT(*) as count FROM notificaciones_logs WHERE 1=1`;
      const params = [];

      if (canal) {
        sql += ` AND canal = ?`;
        params.push(canal);
      }
      if (estado) {
        sql += ` AND estado = ?`;
        params.push(estado);
      }
      if (pedidoId) {
        sql += ` AND pedido_id = ?`;
        params.push(Number(pedidoId));
      }

      const row = db.prepare(sql).get(...params);
      return row ? row.count : 0;
    } catch {
      return 0;
    }
  }
}

module.exports = EmailAdapter;
