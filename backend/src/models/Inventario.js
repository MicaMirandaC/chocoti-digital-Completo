/**
 * @file models/Inventario.js
 * @description Modelo de datos y DAO para existencias físicas y reservas por almacén.
 * ChocoTi-Digital | Capa 3: Persistencia y Acceso a Datos
 */

'use strict';

const db = require('../config/database');

class Inventario {
  /**
   * Obtiene el inventario de un almacén específico con semáforo de disponibilidad.
   * @param {number} almacenId
   * @returns {Array<object>}
   */
  static obtenerStockPorAlmacen(almacenId) {
    const query = `
      SELECT
        inv.id AS inventario_id,
        p.id AS producto_id,
        p.sku,
        p.nombre,
        p.precio,
        c.nombre AS categoria_nombre,
        p.stock_minimo,
        a.id AS almacen_id,
        a.nombre AS almacen_nombre,
        a.ciudad AS almacen_ciudad,
        COALESCE(SUM(l.cantidad),0) AS stock_actual,
        COALESCE(SUM(r.cantidad),0) AS stock_reservado,
        (COALESCE(SUM(l.cantidad),0) - COALESCE(SUM(r.cantidad),0)) AS stock_disponible,
        CASE
          WHEN (COALESCE(SUM(l.cantidad),0) - COALESCE(SUM(r.cantidad),0)) <= 0 THEN 'Agotado'
          WHEN (COALESCE(SUM(l.cantidad),0) - COALESCE(SUM(r.cantidad),0)) <= p.stock_minimo THEN 'Pocas unidades'
          ELSE 'Disponible'
        END AS estado_stock,
        MAX(inv.updated_at) AS updated_at
      FROM productos p
      JOIN categorias c ON p.categoria_id = c.id
      CROSS JOIN almacenes a
      LEFT JOIN lotes l ON p.id = l.producto_id AND a.id = l.almacen_id
        AND l.estado = 'VIGENTE' AND date(l.fecha_vencimiento) >= date('now')
      LEFT JOIN reservas_stock r ON p.id = r.producto_id AND a.id = r.almacen_id
        AND r.estado = 'ACTIVA' AND (r.expira_en IS NULL OR r.expira_en > datetime('now'))
      LEFT JOIN inventario inv ON p.id = inv.producto_id AND a.id = inv.almacen_id
      WHERE a.id = ? AND p.activo = 1
      GROUP BY p.id, a.id
      ORDER BY p.id ASC
    `;
    return db.prepare(query).all(almacenId);
  }

  /**
   * Obtiene la matriz de inventario consolidado para todos los almacenes (Uso Administrador).
   * @returns {Array<object>}
   */
  static obtenerConsolidado() {
    const query = `
      SELECT
        p.id AS producto_id,
        p.sku,
        p.nombre,
        c.nombre AS categoria_nombre,
        p.stock_minimo,
        COALESCE(SUM(inv.stock_actual), 0) AS stock_total_nacional,
        COALESCE(SUM(inv.stock_reservado), 0) AS stock_reservado_nacional,
        (COALESCE(SUM(inv.stock_actual), 0) - COALESCE(SUM(inv.stock_reservado), 0)) AS stock_disponible_nacional,
        COALESCE(SUM(CASE WHEN inv.almacen_id = 1 THEN inv.stock_actual - inv.stock_reservado ELSE 0 END), 0) AS stock_sucre,
        COALESCE(SUM(CASE WHEN inv.almacen_id = 2 THEN inv.stock_actual - inv.stock_reservado ELSE 0 END), 0) AS stock_lapaz,
        COALESCE(SUM(CASE WHEN inv.almacen_id = 3 THEN inv.stock_actual - inv.stock_reservado ELSE 0 END), 0) AS stock_cochabamba,
        COALESCE(SUM(CASE WHEN inv.almacen_id = 4 THEN inv.stock_actual - inv.stock_reservado ELSE 0 END), 0) AS stock_santacruz,
        CASE
          WHEN (COALESCE(SUM(inv.stock_actual), 0) - COALESCE(SUM(inv.stock_reservado), 0)) <= 0 THEN 'Agotado'
          WHEN (COALESCE(SUM(inv.stock_actual), 0) - COALESCE(SUM(inv.stock_reservado), 0)) <= p.stock_minimo THEN 'Pocas unidades'
          ELSE 'Disponible'
        END AS estado_stock
      FROM productos p
      JOIN categorias c ON p.categoria_id = c.id
      LEFT JOIN inventario inv ON p.id = inv.producto_id
      WHERE p.activo = 1
      GROUP BY p.id
      ORDER BY p.id ASC
    `;
    return db.prepare(query).all();
  }

  /**
   * Alertas de stock crítico (existencias disponibles <= stock mínimo).
   * @param {number|null} [almacenId]
   * @returns {Array<object>}
   */
  static obtenerAlertasStock(almacenId = null) {
    let whereAlmacen = '';
    if (almacenId) {
      whereAlmacen = `AND a.id = ${Number(almacenId)}`;
    }

    const query = `
      SELECT
        p.id AS producto_id,
        p.sku,
        p.nombre,
        p.stock_minimo,
        a.id AS almacen_id,
        a.nombre AS almacen_nombre,
        COALESCE(inv.stock_actual, 0) AS stock_actual,
        COALESCE(inv.stock_reservado, 0) AS stock_reservado,
        (COALESCE(inv.stock_actual, 0) - COALESCE(inv.stock_reservado, 0)) AS stock_disponible
      FROM productos p
      CROSS JOIN almacenes a
      LEFT JOIN inventario inv ON p.id = inv.producto_id AND a.id = inv.almacen_id
      WHERE p.activo = 1 ${whereAlmacen}
        AND (COALESCE(inv.stock_actual, 0) - COALESCE(inv.stock_reservado, 0)) <= p.stock_minimo
      ORDER BY stock_disponible ASC
    `;
    return db.prepare(query).all();
  }

  /**
   * Actualiza el stock físico de un producto en un almacén (suma o resta cantidad).
   * @param {number} productoId
   * @param {number} almacenId
   * @param {number} deltaCantidad - Positivo para entradas, negativo para salidas
   * @returns {object} Registro de inventario actualizado
   */
  static ajustarStock(productoId, almacenId, deltaCantidad) {
    db.prepare(`
      INSERT INTO inventario (producto_id, almacen_id, stock_actual, stock_reservado)
      VALUES (?, ?, ?, 0)
      ON CONFLICT(producto_id, almacen_id) DO UPDATE SET
        stock_actual = MAX(0, stock_actual + ?),
        updated_at = CURRENT_TIMESTAMP
    `).run(productoId, almacenId, Math.max(0, deltaCantidad), deltaCantidad);

    return db
      .prepare('SELECT * FROM inventario WHERE producto_id = ? AND almacen_id = ?')
      .get(productoId, almacenId);
  }

  /**
   * Reserva temporalmente unidades en checkout.
   * @param {number} productoId
   * @param {number} almacenId
   * @param {number} cantidad
   */
  static reservar(productoId, almacenId, cantidad) {
    db.prepare(`
      UPDATE inventario
      SET stock_reservado = stock_reservado + ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE producto_id = ? AND almacen_id = ?
    `).run(cantidad, productoId, almacenId);
  }

  /**
   * Libera reserva de stock (al cancelar o expirar pedido).
   * @param {number} productoId
   * @param {number} almacenId
   * @param {number} cantidad
   */
  static liberarReserva(productoId, almacenId, cantidad) {
    db.prepare(`
      UPDATE inventario
      SET stock_reservado = MAX(0, stock_reservado - ?),
          updated_at = CURRENT_TIMESTAMP
      WHERE producto_id = ? AND almacen_id = ?
    `).run(cantidad, productoId, almacenId);
  }
}

module.exports = Inventario;
