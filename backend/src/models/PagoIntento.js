/**
 * @file models/PagoIntento.js
 * @description Modelo de datos y DAO para la tabla 'pagos_intentos'.
 * Soporta pasarelas QR Simple, Depósito Bancario, Efectivo en Tienda y PayPal.
 * ChocoTi-Digital | Capa 3: Persistencia y Acceso a Datos
 */

'use strict';

const db = require('../config/database');

class PagoIntento {
  /**
   * Crea un nuevo intento de pago.
   *
   * @param {object} datos
   * @param {number} datos.pedido_id
   * @param {'QR_SIMPLE'|'DEPOSITO_BANCARIO'|'PAYPAL'|'EFECTIVO_TIENDA'} datos.proveedor
   * @param {string} datos.referencia_externa
   * @param {number} datos.monto_bob
   * @param {number} [datos.monto_usd]
   * @param {number} [datos.tipo_cambio=6.96]
   * @param {string} [datos.datos_proveedor_json]
   * @param {string} [datos.expira_en]
   * @param {object} [clientDb=db]
   * @returns {object} Registro creado
   */
  static crear(datos, clientDb = db) {
    const stmt = clientDb.prepare(`
      INSERT INTO pagos_intentos (
        pedido_id, proveedor, referencia_externa, monto_bob, monto_usd, tipo_cambio,
        estado, datos_proveedor_json, expira_en
      ) VALUES (
        ?, ?, ?, ?, ?, ?,
        'PENDIENTE', ?, ?
      )
    `);

    const result = stmt.run(
      datos.pedido_id,
      datos.proveedor,
      datos.referencia_externa,
      datos.monto_bob,
      datos.monto_usd || null,
      datos.tipo_cambio || 6.96,
      datos.datos_proveedor_json || null,
      datos.expira_en || null
    );

    return clientDb.prepare('SELECT * FROM pagos_intentos WHERE id = ?').get(result.lastInsertRowid);
  }

  /**
   * Busca un intento de pago por su referencia externa única.
   * @param {string} referencia
   * @returns {object|undefined}
   */
  static findByReferencia(referencia) {
    return db.prepare(`
      SELECT pi.*, p.codigo_pedido, p.cliente_nombre, p.cliente_email, p.total AS pedido_total
      FROM pagos_intentos pi
      JOIN pedidos p ON pi.pedido_id = p.id
      WHERE pi.referencia_externa = ?
    `).get(referencia);
  }

  /**
   * Obtiene todos los intentos de pago asociados a un pedido.
   * @param {number} pedidoId
   * @returns {Array<object>}
   */
  static findByPedidoId(pedidoId) {
    return db.prepare(`
      SELECT * FROM pagos_intentos WHERE pedido_id = ? ORDER BY id DESC
    `).all(pedidoId);
  }

  /**
   * Actualiza el estado de un intento de pago.
   *
   * @param {number} id
   * @param {'PENDIENTE'|'PAGADO'|'VENCIDO'|'RECHAZADO'} nuevoEstado
   * @param {object} [extras={}]
   * @param {object} [clientDb=db]
   */
  static actualizarEstado(id, nuevoEstado, extras = {}, clientDb = db) {
    const campos = ['estado = ?', 'updated_at = CURRENT_TIMESTAMP'];
    const valores = [nuevoEstado];

    if (extras.datos_proveedor_json !== undefined) {
      campos.push('datos_proveedor_json = ?');
      valores.push(typeof extras.datos_proveedor_json === 'string' ? extras.datos_proveedor_json : JSON.stringify(extras.datos_proveedor_json));
    }

    if (extras.motivo_rechazo !== undefined) {
      campos.push('motivo_rechazo = ?');
      valores.push(extras.motivo_rechazo);
    }

    if (extras.verificado_por_id !== undefined) {
      campos.push('verificado_por_id = ?');
      valores.push(extras.verificado_por_id);
    }

    if (extras.fecha_verificacion !== undefined) {
      campos.push('fecha_verificacion = ?');
      valores.push(extras.fecha_verificacion);
    }

    valores.push(id);
    const query = `UPDATE pagos_intentos SET ${campos.join(', ')} WHERE id = ?`;
    clientDb.prepare(query).run(...valores);
  }

  /**
   * Registra comprobante bancario adjuntado por el cliente.
   *
   * @param {number} pedidoId
   * @param {object} datos
   * @param {string} datos.comprobante_url
   * @param {string} datos.banco_origen
   * @param {string} datos.fecha_operacion
   * @param {string} datos.numero_operacion
   * @param {object} [clientDb=db]
   */
  static registrarComprobante(pedidoId, datos, clientDb = db) {
    const stmt = clientDb.prepare(`
      UPDATE pagos_intentos
      SET comprobante_url = ?,
          banco_origen = ?,
          fecha_operacion = ?,
          numero_operacion = ?,
          monto_declarado = ?,
          estado = 'PENDIENTE',
          motivo_rechazo = NULL,
          updated_at = CURRENT_TIMESTAMP
      WHERE pedido_id = ? AND proveedor = 'DEPOSITO_BANCARIO'
    `);
    stmt.run(
      datos.comprobante_url,
      datos.banco_origen,
      datos.fecha_operacion,
      datos.numero_operacion,
      datos.monto_declarado || null,
      pedidoId
    );

    // Actualizar también en la tabla pedidos
    clientDb.prepare(`
      UPDATE pedidos
      SET comprobante_url = ?,
          transaccion_ref = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(datos.comprobante_url, datos.numero_operacion, pedidoId);
  }

  /**
   * Valida si un número de operación bancaria ya fue registrado previamente en un intento pagado o pendiente.
   * @param {string} numeroOperacion
   * @param {number} [excluirPedidoId=0]
   * @returns {boolean} True si ya existe
   */
  static existeNumeroOperacion(numeroOperacion, excluirPedidoId = 0) {
    if (!numeroOperacion) return false;
    const res = db.prepare(`
      SELECT count(*) as total
      FROM pagos_intentos
      WHERE numero_operacion = ?
        AND pedido_id != ?
        AND estado IN ('PENDIENTE', 'PAGADO')
    `).get(numeroOperacion, excluirPedidoId);
    return res && res.total > 0;
  }
}

module.exports = PagoIntento;
