/**
 * @file models/Kardex.js
 * @description Modelo y DAO para movimientos de kardex (auditoría física de inventario).
 * ChocoTi-Digital | Capa 3: Persistencia y Acceso a Datos
 */

'use strict';

const db = require('../config/database');

class Kardex {
  /**
   * Registra un movimiento inmutable en el Kardex.
   * @param {object} param0
   * @param {'ENTRADA'|'SALIDA_VENTA'|'AJUSTE'|'TRASPASO'} param0.tipo_movimiento
   * @param {number} param0.producto_id
   * @param {number|null} [param0.almacen_origen_id]
   * @param {number|null} [param0.almacen_destino_id]
   * @param {number} param0.cantidad
   * @param {number|null} [param0.usuario_id]
   * @param {string} param0.motivo
   * @returns {object} Registro creado
   */
  static registrar({
    tipo_movimiento,
    producto_id,
    almacen_origen_id = null,
    almacen_destino_id = null,
    cantidad,
    usuario_id = null,
    motivo
  }) {
    const info = db.prepare(`
      INSERT INTO kardex_movimientos (
        tipo_movimiento,
        producto_id,
        almacen_origen_id,
        almacen_destino_id,
        cantidad,
        usuario_id,
        motivo
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      tipo_movimiento,
      producto_id,
      almacen_origen_id,
      almacen_destino_id,
      Math.abs(cantidad),
      usuario_id,
      motivo.trim()
    );

    return db.prepare('SELECT * FROM kardex_movimientos WHERE id = ?').get(info.lastInsertRowid);
  }

  /**
   * Lista movimientos de kardex con filtros y paginación.
   * @param {object} filtros
   * @returns {Array<object>}
   */
  static listar(filtros = {}) {
    let sql = `
      SELECT
        k.id,
        k.tipo_movimiento,
        k.producto_id,
        p.sku,
        p.nombre AS producto_nombre,
        k.almacen_origen_id,
        ao.nombre AS almacen_origen_nombre,
        k.almacen_destino_id,
        ad.nombre AS almacen_destino_nombre,
        k.cantidad,
        k.usuario_id,
        u.nombre_completo AS usuario_nombre,
        k.motivo,
        k.fecha_hora
      FROM kardex_movimientos k
      JOIN productos p ON k.producto_id = p.id
      LEFT JOIN almacenes ao ON k.almacen_origen_id = ao.id
      LEFT JOIN almacenes ad ON k.almacen_destino_id = ad.id
      LEFT JOIN usuarios u ON k.usuario_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (filtros.producto_id) {
      sql += ' AND k.producto_id = ?';
      params.push(filtros.producto_id);
    }
    if (filtros.almacen_id) {
      sql += ' AND (k.almacen_origen_id = ? OR k.almacen_destino_id = ?)';
      params.push(filtros.almacen_id, filtros.almacen_id);
    }
    if (filtros.tipo_movimiento) {
      sql += ' AND k.tipo_movimiento = ?';
      params.push(filtros.tipo_movimiento);
    }

    sql += ' ORDER BY k.id DESC';

    const limit = Math.min(Number(filtros.limite) || 50, 200);
    const offset = Number(filtros.offset) || 0;
    sql += ` LIMIT ${limit} OFFSET ${offset}`;

    return db.prepare(sql).all(...params);
  }
}

module.exports = Kardex;
