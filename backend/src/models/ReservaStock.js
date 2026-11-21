/**
 * @file models/ReservaStock.js
 * @description Gestión de reservas temporales de stock en Checkout y control de expiración.
 * ChocoTi-Digital | Capa 3: Persistencia y Acceso a Datos
 */

'use strict';

const db = require('../config/database');

class ReservaStock {
  /**
   * Crea reservas temporales de inventario para los items de un pedido dentro de una transacción.
   *
   * @param {number} pedidoId
   * @param {Array<{ producto_id: number, cantidad: number }>} items
   * @param {number} almacenId
   * @param {number} minutosExpiracion
   * @param {object} [clientDb=db] - Instancia para transacciones
   * @returns {Array<object>}
   */
  static crearReservas(pedidoId, items, almacenId, minutosExpiracion = 15, clientDb = db) {
    const stmtInsertReserva = clientDb.prepare(`
      INSERT INTO reservas_stock (pedido_id, producto_id, almacen_id, cantidad, expira_en, estado)
      VALUES (?, ?, ?, ?, datetime('now', '+' || ? || ' minutes'), 'ACTIVA')
    `);

    const stmtUpdateInventario = clientDb.prepare(`
      INSERT INTO inventario (producto_id, almacen_id, stock_actual, stock_reservado)
      VALUES (?, ?, 0, ?)
      ON CONFLICT(producto_id, almacen_id) DO UPDATE SET
        stock_reservado = stock_reservado + ?,
        updated_at = CURRENT_TIMESTAMP
    `);

    const reservasCreadas = [];

    for (const item of items) {
      const res = stmtInsertReserva.run(pedidoId, item.producto_id, almacenId, item.cantidad, minutosExpiracion);
      stmtUpdateInventario.run(item.producto_id, almacenId, item.cantidad, item.cantidad);
      reservasCreadas.push({
        id: res.lastInsertRowid,
        producto_id: item.producto_id,
        almacen_id: almacenId,
        cantidad: item.cantidad,
      });
    }

    return reservasCreadas;
  }

  /**
   * Confirma la reserva de stock al confirmarse el pago.
   * Convierte la reserva en venta definitiva: descuenta el stock reservado y el stock actual,
   * y genera el registro Kardex inmutable tipo SALIDA_VENTA.
   *
   * @param {number} pedidoId
   * @param {number|null} [usuarioId=null]
   * @param {object} [clientDb=db]
   */
  static confirmarReservas(pedidoId, usuarioId = null, clientDb = db) {
    const reservas = clientDb.prepare(`
      SELECT id, producto_id, almacen_id, cantidad
      FROM reservas_stock
      WHERE pedido_id = ? AND estado = 'ACTIVA'
    `).all(pedidoId);

    const stmtUpdateReserva = clientDb.prepare(`
      UPDATE reservas_stock SET estado = 'CONFIRMADA' WHERE id = ?
    `);

    const stmtDeducirStock = clientDb.prepare(`
      UPDATE inventario
      SET stock_reservado = MAX(0, stock_reservado - ?),
          stock_actual    = MAX(0, stock_actual - ?),
          updated_at      = CURRENT_TIMESTAMP
      WHERE producto_id = ? AND almacen_id = ?
    `);

    const stmtKardex = clientDb.prepare(`
      INSERT INTO kardex_movimientos (tipo_movimiento, producto_id, almacen_origen_id, cantidad, usuario_id, motivo)
      VALUES ('SALIDA_VENTA', ?, ?, ?, ?, ?)
    `);

    for (const r of reservas) {
      stmtUpdateReserva.run(r.id);
      stmtDeducirStock.run(r.cantidad, r.cantidad, r.producto_id, r.almacen_id);
      stmtKardex.run(
        r.producto_id,
        r.almacen_id,
        r.cantidad,
        usuarioId,
        `Venta confirmada y facturada - Pedido ID #${pedidoId}`
      );
    }
  }

  /**
   * Libera las reservas activas asociadas a un pedido (ej. cancelación o rechazo).
   * Restaura el stock reservado en la tabla inventario.
   *
   * @param {number} pedidoId
   * @param {object} [clientDb=db]
   */
  static liberarReservas(pedidoId, clientDb = db) {
    const reservas = clientDb.prepare(`
      SELECT id, producto_id, almacen_id, cantidad
      FROM reservas_stock
      WHERE pedido_id = ? AND estado = 'ACTIVA'
    `).all(pedidoId);

    const stmtUpdateReserva = clientDb.prepare(`
      UPDATE reservas_stock SET estado = 'LIBERADA' WHERE id = ?
    `);

    const stmtRestaurarStock = clientDb.prepare(`
      UPDATE inventario
      SET stock_reservado = MAX(0, stock_reservado - ?),
          updated_at = CURRENT_TIMESTAMP
      WHERE producto_id = ? AND almacen_id = ?
    `);

    for (const r of reservas) {
      stmtUpdateReserva.run(r.id);
      stmtRestaurarStock.run(r.cantidad, r.producto_id, r.almacen_id);
    }
  }

  /**
   * Identifica y libera automáticamente todas las reservas cuyo tiempo de expiración ha vencido.
   * Actualiza el pedido a EXPIRADO y su estado de pago a VENCIDO.
   *
   * @param {object} [clientDb=db]
   * @returns {number} Cantidad de pedidos expirados
   */
  static limpiarExpiradas(clientDb = db) {
    const expiradas = clientDb.prepare(`
      SELECT DISTINCT r.pedido_id
      FROM reservas_stock r
      JOIN pedidos p ON r.pedido_id = p.id
      WHERE r.estado = 'ACTIVA'
        AND r.expira_en <= datetime('now')
        AND p.estado_pedido = 'PENDIENTE_PAGO'
    `).all();

    if (expiradas.length === 0) return 0;

    const stmtUpdatePedido = clientDb.prepare(`
      UPDATE pedidos
      SET estado_pedido = 'EXPIRADO',
          estado_pago   = 'VENCIDO',
          updated_at    = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    const stmtHistorial = clientDb.prepare(`
      INSERT INTO pedido_historial_estados (pedido_id, estado_anterior, estado_nuevo, usuario_id, rol_transicion, motivo, comentario)
      VALUES (?, 'PENDIENTE_PAGO', 'EXPIRADO', NULL, 'SISTEMA', 'EXPIRACION_RESERVA', 'Reserva de stock expirada automáticamente por superar el tiempo límite.')
    `);

    const stmtUpdatePago = clientDb.prepare(`
      UPDATE pagos_intentos
      SET estado = 'VENCIDO',
          updated_at = CURRENT_TIMESTAMP
      WHERE pedido_id = ? AND estado = 'PENDIENTE'
    `);

    for (const item of expiradas) {
      ReservaStock.liberarReservas(item.pedido_id, clientDb);
      stmtUpdatePedido.run(item.pedido_id);
      stmtHistorial.run(item.pedido_id);
      stmtUpdatePago.run(item.pedido_id);
    }

    return expiradas.length;
  }
}

module.exports = ReservaStock;
