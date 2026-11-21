/**
 * @file models/Pedido.js
 * @description Modelo de datos y DAO para las tablas 'pedidos', 'pedido_detalles',
 * 'pedido_historial_estados' y 'pedido_entregas'.
 * ChocoTi-Digital | Capa 3: Persistencia y Acceso a Datos
 */

'use strict';

const db = require('../config/database');

class Pedido {
  /**
   * Genera el siguiente código secuencial de pedido (ej. PED-2026-1001).
   * @param {object} [clientDb=db]
   * @returns {string}
   */
  static generarSiguienteCodigo(clientDb = db) {
    const row = clientDb.prepare("SELECT MAX(id) as max_id FROM pedidos").get();
    const nextId = (row && row.max_id ? row.max_id : 0) + 1;
    const year = new Date().getFullYear();
    return `PED-${year}-${String(nextId).padStart(4, '0')}`;
  }

  /**
   * Genera una guía de envío única (ej. GUIA-SUC-48291).
   * @param {number} almacenId
   * @param {number} pedidoId
   * @returns {string}
   */
  static generarGuiaTransporte(almacenId, pedidoId) {
    const sufijos = { 1: 'SUC', 2: 'LPZ', 3: 'CBB', 4: 'SCZ' };
    const suf = sufijos[almacenId] || 'NAC';
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `GUIA-${suf}-${pedidoId}${rand}`;
  }

  /**
   * Genera un código de retiro corto y seguro para recojo en tienda (ej. RET-8492).
   * @param {number} pedidoId
   * @returns {string}
   */
  static generarCodigoRetiroCorto(pedidoId) {
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `RET-${pedidoId}-${rand}`;
  }

  /**
   * Crea un nuevo pedido con sus líneas de detalle e historial inicial dentro de una transacción.
   *
   * @param {object} datos
   * @param {Array<{ producto_id: number, cantidad: number, precio_unitario: number, subtotal: number }>} items
   * @param {object} [clientDb=db]
   * @returns {object} Pedido recién creado
   */
  static crear(datos, items, clientDb = db) {
    const codigoPedido = datos.codigo_pedido || Pedido.generarSiguienteCodigo(clientDb);

    const stmtPedido = clientDb.prepare(`
      INSERT INTO pedidos (
        codigo_pedido, usuario_id, cliente_nombre, cliente_ci_nit, cliente_razon_social,
        cliente_telefono, cliente_email, tipo_entrega, punto_recojo_id, direccion_envio,
        referencia_envio, ciudad_destino, almacen_id, metodo_pago, estado_pago, estado_pedido,
        subtotal, costo_envio, descuento, total, monto_usd, tipo_cambio_usd, notas
      ) VALUES (
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?
      )
    `);

    const result = stmtPedido.run(
      codigoPedido,
      datos.usuario_id || null,
      datos.cliente_nombre,
      datos.cliente_ci_nit,
      datos.cliente_razon_social || null,
      datos.cliente_telefono,
      datos.cliente_email,
      datos.tipo_entrega,
      datos.punto_recojo_id || null,
      datos.direccion_envio || null,
      datos.referencia_envio || null,
      datos.ciudad_destino,
      datos.almacen_id || 1,
      datos.metodo_pago,
      datos.estado_pago || 'PENDIENTE',
      datos.estado_pedido || 'PENDIENTE_PAGO',
      datos.subtotal,
      datos.costo_envio || 0,
      datos.descuento || 0,
      datos.total,
      datos.monto_usd || null,
      datos.tipo_cambio_usd || 6.96,
      datos.notas || null
    );

    const pedidoId = result.lastInsertRowid;

    // Insertar líneas de compra
    const stmtDetalle = clientDb.prepare(`
      INSERT INTO pedido_detalles (pedido_id, producto_id, cantidad, precio_unitario, subtotal)
      VALUES (?, ?, ?, ?, ?)
    `);

    for (const item of items) {
      stmtDetalle.run(
        pedidoId,
        item.producto_id,
        item.cantidad,
        item.precio_unitario,
        item.subtotal || (item.cantidad * item.precio_unitario)
      );
    }

    // Registrar historial de estados inicial
    const stmtHistorial = clientDb.prepare(`
      INSERT INTO pedido_historial_estados (
        pedido_id, estado_anterior, estado_nuevo, usuario_id, rol_transicion, motivo, comentario
      ) VALUES (?, NULL, ?, ?, ?, ?, ?)
    `);

    stmtHistorial.run(
      pedidoId,
      datos.estado_pedido || 'PENDIENTE_PAGO',
      datos.usuario_id || null,
      datos.usuario_id ? 'CLIENTE' : 'VISITANTE',
      'CREACION_PEDIDO',
      'Pedido registrado exitosamente en el sistema de Checkout ChocoTi-Digital.'
    );

    return Pedido.findById(pedidoId, clientDb);
  }

  /**
   * Obtiene un pedido completo por su ID interno.
   * Incluye detalles de productos, punto de venta y almacén.
   *
   * @param {number} id
   * @param {object} [clientDb=db]
   * @returns {object|undefined}
   */
  static findById(id, clientDb = db) {
    const pedido = clientDb.prepare(`
      SELECT p.*,
             a.nombre AS almacen_nombre, a.ciudad AS almacen_ciudad,
             pv.nombre AS punto_recojo_nombre, pv.direccion AS punto_recojo_direccion
      FROM pedidos p
      LEFT JOIN almacenes a ON p.almacen_id = a.id
      LEFT JOIN puntos_venta pv ON p.punto_recojo_id = pv.id
      WHERE p.id = ?
    `).get(id);

    if (!pedido) return undefined;

    pedido.detalles = clientDb.prepare(`
      SELECT pd.*, prod.sku, prod.nombre AS producto_nombre, prod.imagen_url
      FROM pedido_detalles pd
      JOIN productos prod ON pd.producto_id = prod.id
      WHERE pd.pedido_id = ?
    `).all(id);

    pedido.historial = clientDb.prepare(`
      SELECT phe.*, u.nombre_completo AS usuario_nombre
      FROM pedido_historial_estados phe
      LEFT JOIN usuarios u ON phe.usuario_id = u.id
      WHERE phe.pedido_id = ?
      ORDER BY phe.id ASC
    `).all(id);

    pedido.pagos = clientDb.prepare(`
      SELECT * FROM pagos_intentos WHERE pedido_id = ? ORDER BY id DESC
    `).all(id);

    pedido.entrega = clientDb.prepare(`
      SELECT * FROM pedido_entregas WHERE pedido_id = ?
    `).get(id) || null;

    pedido.preparacion = clientDb.prepare(`
      SELECT * FROM pedido_preparacion WHERE pedido_id = ?
    `).get(id) || null;

    pedido.empaque = clientDb.prepare(`
      SELECT * FROM pedido_empaque WHERE pedido_id = ?
    `).get(id) || null;

    return pedido;
  }

  /**
   * Obtiene un pedido por su código único público (ej. PED-2026-1001).
   * @param {string} codigo
   * @param {object} [clientDb=db]
   * @returns {object|undefined}
   */
  static findByCodigo(codigo, clientDb = db) {
    const row = clientDb.prepare('SELECT id FROM pedidos WHERE UPPER(codigo_pedido) = UPPER(?)').get(codigo);
    if (!row) return undefined;
    return Pedido.findById(row.id, clientDb);
  }

  /**
   * Actualiza el estado del pedido registrando la auditoría inmutable de transiciones.
   *
   * @param {number} id
   * @param {string} nuevoEstado
   * @param {number|null} usuarioId
   * @param {string} rol
   * @param {string} motivo
   * @param {string} [comentario='']
   * @param {object} [clientDb=db]
   */
  static actualizarEstado(id, nuevoEstado, usuarioId = null, rol = 'SISTEMA', motivo = '', comentario = '', clientDb = db) {
    const actual = clientDb.prepare('SELECT estado_pedido FROM pedidos WHERE id = ?').get(id);
    const estadoAnterior = actual ? actual.estado_pedido : null;

    clientDb.prepare(`
      UPDATE pedidos
      SET estado_pedido = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(nuevoEstado, id);

    clientDb.prepare(`
      INSERT INTO pedido_historial_estados (
        pedido_id, estado_anterior, estado_nuevo, usuario_id, rol_transicion, motivo, comentario
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, estadoAnterior, nuevoEstado, usuarioId, rol, motivo, comentario);
  }

  /**
   * Actualiza el estado de pago del pedido.
   * @param {number} id
   * @param {'PENDIENTE'|'PAGADO'|'VENCIDO'|'RECHAZADO'} nuevoEstadoPago
   * @param {object} [clientDb=db]
   */
  static actualizarEstadoPago(id, nuevoEstadoPago, clientDb = db) {
    clientDb.prepare(`
      UPDATE pedidos
      SET estado_pago = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(nuevoEstadoPago, id);
  }

  /**
   * Asigna guía de transporte real y registra el envío en 'pedido_entregas'.
   *
   * @param {number} pedidoId
   * @param {string} guiaEnvio
   * @param {string} courier
   * @param {number} almacenId
   * @param {object} [clientDb=db]
   */
  static registrarDespachoEnvio(pedidoId, guiaEnvio, courier, almacenId, clientDb = db) {
    clientDb.prepare(`
      UPDATE pedidos
      SET guia_envio = ?,
          courier = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(guiaEnvio, courier, pedidoId);

    clientDb.prepare(`
      INSERT INTO pedido_entregas (
        pedido_id, almacen_id, tipo_entrega, courier, guia_transporte, estado_entrega
      ) VALUES (?, ?, 'ENVIO_DOMICILIO', ?, ?, 'LISTO')
      ON CONFLICT(pedido_id) DO UPDATE SET
        courier = excluded.courier,
        guia_transporte = excluded.guia_transporte,
        updated_at = CURRENT_TIMESTAMP
    `).run(pedidoId, almacenId, courier, guiaEnvio);
  }

  /**
   * Asigna código de retiro en tienda y registra el retiro en 'pedido_entregas'.
   *
   * @param {number} pedidoId
   * @param {string} codigoRetiro
   * @param {number} almacenId
   * @param {string} [fechaLimite=null]
   * @param {object} [clientDb=db]
   */
  static registrarRetiroAgencia(pedidoId, codigoRetiro, almacenId, fechaLimite = null, clientDb = db) {
    clientDb.prepare(`
      UPDATE pedidos
      SET codigo_retiro = ?,
          fecha_limite_retiro = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(codigoRetiro, fechaLimite, pedidoId);

    clientDb.prepare(`
      INSERT INTO pedido_entregas (
        pedido_id, almacen_id, tipo_entrega, codigo_retiro, estado_entrega
      ) VALUES (?, ?, 'RECOJO_AGENCIA', ?, 'LISTO')
      ON CONFLICT(pedido_id) DO UPDATE SET
        codigo_retiro = excluded.codigo_retiro,
        updated_at = CURRENT_TIMESTAMP
    `).run(pedidoId, almacenId, codigoRetiro);
  }

  /**
   * Lista pedidos con filtros y paginación para la planilla de ventas.
   *
   * @param {object} [filtros={}]
   * @returns {Array<object>}
   */
  static findAll(filtros = {}) {
    const condiciones = [];
    const params = [];

    if (filtros.usuario_id) {
      condiciones.push('p.usuario_id = ?');
      params.push(Number(filtros.usuario_id));
    }

    if (filtros.almacen_id) {
      condiciones.push('p.almacen_id = ?');
      params.push(Number(filtros.almacen_id));
    }

    if (filtros.estado_pedido) {
      condiciones.push('p.estado_pedido = ?');
      params.push(filtros.estado_pedido);
    }

    if (filtros.estado_pago) {
      condiciones.push('p.estado_pago = ?');
      params.push(filtros.estado_pago);
    }

    if (filtros.metodo_pago) {
      condiciones.push('p.metodo_pago = ?');
      params.push(filtros.metodo_pago);
    }

    if (filtros.busqueda && filtros.busqueda.trim()) {
      const q = `%${filtros.busqueda.trim().toLowerCase()}%`;
      condiciones.push(`(
        LOWER(p.codigo_pedido) LIKE ? OR
        LOWER(p.cliente_nombre) LIKE ? OR
        LOWER(p.cliente_ci_nit) LIKE ? OR
        LOWER(p.cliente_email) LIKE ? OR
        LOWER(COALESCE(p.guia_envio, '')) LIKE ?
      )`);
      params.push(q, q, q, q, q);
    }

    const where = condiciones.length > 0 ? `WHERE ${condiciones.join(' AND ')}` : '';
    const query = `
      SELECT p.*,
             a.nombre AS almacen_nombre,
             (SELECT count(*) FROM pedido_detalles WHERE pedido_id = p.id) AS total_items
      FROM pedidos p
      LEFT JOIN almacenes a ON p.almacen_id = a.id
      ${where}
      ORDER BY p.id DESC
    `;

    return db.prepare(query).all(...params);
  }
}

module.exports = Pedido;
