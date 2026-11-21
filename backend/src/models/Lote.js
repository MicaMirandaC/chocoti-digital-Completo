/**
 * @file models/Lote.js
 * @description Modelo y DAO para lotes de producción y gestión FEFO (First Expired, First Out).
 * ChocoTi-Digital | Capa 3: Persistencia y Acceso a Datos
 */

'use strict';

const db = require('../config/database');

class Lote {
  /**
   * Obtiene lotes vigentes de un producto en un almacén, ordenados por fecha de vencimiento ascendente (FEFO).
   * @param {number} productoId
   * @param {number} almacenId
   * @returns {Array<object>}
   */
  static obtenerPorProductoAlmacen(productoId, almacenId) {
    const query = `
      SELECT
        l.id,
        l.lote_codigo,
        l.producto_id,
        p.nombre AS producto_nombre,
        p.sku,
        l.almacen_id,
        a.nombre AS almacen_nombre,
        l.cantidad,
        l.fecha_vencimiento,
        l.fecha_ingreso,
        l.estado,
        CAST(julianday(l.fecha_vencimiento) - julianday('now') AS INTEGER) AS dias_para_vencer
      FROM lotes l
      JOIN productos p ON l.producto_id = p.id
      JOIN almacenes a ON l.almacen_id = a.id
      WHERE l.producto_id = ?
        AND l.almacen_id = ?
        AND l.cantidad > 0
        AND l.estado = 'VIGENTE'
      ORDER BY l.fecha_vencimiento ASC
    `;
    return db.prepare(query).all(productoId, almacenId);
  }

  /**
   * Obtiene todos los lotes con filtros opcionales (almacén, estado, producto).
   * @param {object} filtros
   * @returns {Array<object>}
   */
  static listar(filtros = {}) {
    let sql = `
      SELECT
        l.id,
        l.lote_codigo,
        l.producto_id,
        p.nombre AS producto_nombre,
        p.sku,
        l.almacen_id,
        a.nombre AS almacen_nombre,
        l.cantidad,
        l.fecha_vencimiento,
        l.fecha_ingreso,
        l.estado,
        CAST(julianday(l.fecha_vencimiento) - julianday('now') AS INTEGER) AS dias_para_vencer
      FROM lotes l
      JOIN productos p ON l.producto_id = p.id
      JOIN almacenes a ON l.almacen_id = a.id
      WHERE 1=1
    `;
    const params = [];

    if (filtros.almacen_id) {
      sql += ' AND l.almacen_id = ?';
      params.push(filtros.almacen_id);
    }
    if (filtros.producto_id) {
      sql += ' AND l.producto_id = ?';
      params.push(filtros.producto_id);
    }
    if (filtros.estado) {
      sql += ' AND l.estado = ?';
      params.push(filtros.estado);
    }

    sql += ' ORDER BY l.fecha_vencimiento ASC';
    return db.prepare(sql).all(...params);
  }

  /**
   * Obtiene alertas de lotes próximos a vencer o ya vencidos.
   * @param {number} diasThreshold - Días de anticipación para alerta (por defecto 30)
   * @param {number|null} almacenId - Filtro opcional por almacén
   * @returns {Array<object>}
   */
  static obtenerAlertasVencimiento(diasThreshold = 30, almacenId = null) {
    let sql = `
      SELECT
        l.id,
        l.lote_codigo,
        l.producto_id,
        p.nombre AS producto_nombre,
        p.sku,
        l.almacen_id,
        a.nombre AS almacen_nombre,
        l.cantidad,
        l.fecha_vencimiento,
        l.estado,
        CAST(julianday(l.fecha_vencimiento) - julianday('now') AS INTEGER) AS dias_restantes,
        CASE
          WHEN julianday(l.fecha_vencimiento) < julianday('now') THEN 'VENCIDO'
          WHEN (julianday(l.fecha_vencimiento) - julianday('now')) <= ? THEN 'PROXIMO_A_VENCER'
          ELSE 'OK'
        END AS nivel_alerta
      FROM lotes l
      JOIN productos p ON l.producto_id = p.id
      JOIN almacenes a ON l.almacen_id = a.id
      WHERE l.cantidad > 0
        AND l.estado = 'VIGENTE'
        AND julianday(l.fecha_vencimiento) <= julianday('now', '+' || ? || ' days')
    `;
    const params = [diasThreshold, diasThreshold];

    if (almacenId) {
      sql += ' AND l.almacen_id = ?';
      params.push(almacenId);
    }

    sql += ' ORDER BY l.fecha_vencimiento ASC';
    return db.prepare(sql).all(...params);
  }

  /**
   * Registra un nuevo lote en el sistema.
   * @param {object} datos
   * @returns {object} Lote creado
   */
  static crearLote({ lote_codigo, producto_id, almacen_id, cantidad, fecha_vencimiento }) {
    const info = db.prepare(`
      INSERT INTO lotes (lote_codigo, producto_id, almacen_id, cantidad, fecha_vencimiento, estado)
      VALUES (?, ?, ?, ?, ?, 'VIGENTE')
    `).run(lote_codigo.trim().toUpperCase(), producto_id, almacen_id, cantidad, fecha_vencimiento);

    return db.prepare('SELECT * FROM lotes WHERE id = ?').get(info.lastInsertRowid);
  }

  /**
   * Consume existencias de lotes respetando el principio FEFO.
   * Descuenta de los lotes más próximos a vencer primero.
   * @param {number} productoId
   * @param {number} almacenId
   * @param {number} cantidadRequerida
   * @returns {Array<object>} Desglose de lotes afectados y cantidades consumidas
   */
  static consumirFEFO(productoId, almacenId, cantidadRequerida) {
    if (cantidadRequerida <= 0) return [];

    const lotesDisponibles = this.obtenerPorProductoAlmacen(productoId, almacenId);
    let porDescontar = cantidadRequerida;
    const asignaciones = [];

    const updateStmt = db.prepare(`
      UPDATE lotes
      SET cantidad = ?,
          estado = CASE WHEN ? = 0 THEN 'AGOTADO' ELSE 'VIGENTE' END
      WHERE id = ?
    `);

    for (const lote of lotesDisponibles) {
      if (porDescontar <= 0) break;

      const aDescontar = Math.min(lote.cantidad, porDescontar);
      const nuevoRemanente = lote.cantidad - aDescontar;

      updateStmt.run(nuevoRemanente, nuevoRemanente, lote.id);

      asignaciones.push({
        lote_id: lote.id,
        lote_codigo: lote.lote_codigo,
        fecha_vencimiento: lote.fecha_vencimiento,
        cantidad_descontada: aDescontar,
        saldo_restante: nuevoRemanente
      });

      porDescontar -= aDescontar;
    }

    return asignaciones;
  }
}

module.exports = Lote;
