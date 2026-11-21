/**
 * @file controllers/planillaController.js
 * @description Módulo 7 — Planillas de Compra e Impresión.
 * Registro de ventas con filtros, paginación, exportación CSV y comprobante por pedido.
 * RBAC: Cliente → solo sus pedidos | Operador → solo su almacén | Admin → todo.
 * ChocoTi-Digital | Capa 1: Controladores y Seguridad HTTP
 */

'use strict';

const Pedido  = require('../models/Pedido');
const db      = require('../config/database');
const EMPRESA = require('../../../config/empresa');

/* ─────────────────────────────────────────────────────────────────
   HELPER: Construye los filtros SQL respetando el rol del usuario
   ───────────────────────────────────────────────────────────────── */
function construirFiltros(query, usuario) {
  const condiciones = [];
  const params      = [];

  // RBAC: restricción por rol
  if (['CLIENTE_MINORISTA', 'CLIENTE_CORPORATIVO'].includes(usuario.rol)) {
    condiciones.push('p.usuario_id = ?');
    params.push(Number(usuario.id));
  } else if (['OPERADOR_ALMACEN', 'PREPARADOR_PEDIDOS', 'EMPACADOR', 'DESPACHADOR_ENTREGA'].includes(usuario.rol)) {
    condiciones.push('p.almacen_id = ?');
    params.push(Number(usuario.almacen_id));
  }
  // ADMINISTRADOR: sin restricción base

  // Filtro por buscador libre (código, cliente, CI/NIT, email, guía)
  if (query.q && String(query.q).trim()) {
    const busq = `%${String(query.q).trim().toLowerCase()}%`;
    condiciones.push(`(
      LOWER(p.codigo_pedido)   LIKE ? OR
      LOWER(p.cliente_nombre)  LIKE ? OR
      LOWER(p.cliente_ci_nit)  LIKE ? OR
      LOWER(p.cliente_email)   LIKE ? OR
      LOWER(COALESCE(p.guia_envio,'')) LIKE ?
    )`);
    params.push(busq, busq, busq, busq, busq);
  }

  // Filtros exactos
  if (query.estado_pedido) { condiciones.push('p.estado_pedido = ?'); params.push(query.estado_pedido); }
  if (query.estado_pago)   { condiciones.push('p.estado_pago = ?');   params.push(query.estado_pago);   }
  if (query.metodo_pago)   { condiciones.push('p.metodo_pago = ?');   params.push(query.metodo_pago);   }
  if (query.almacen_id && usuario.rol === 'ADMINISTRADOR') {
    condiciones.push('p.almacen_id = ?');
    params.push(Number(query.almacen_id));
  }

  // Rango de fechas (fecha_inicio / fecha_fin — YYYY-MM-DD)
  if (query.fecha_inicio) {
    condiciones.push("DATE(p.created_at) >= ?");
    params.push(query.fecha_inicio);
  }
  if (query.fecha_fin) {
    condiciones.push("DATE(p.created_at) <= ?");
    params.push(query.fecha_fin);
  }

  return { condiciones, params };
}

/* ─────────────────────────────────────────────────────────────────
   HELPER: Genera la fila de texto enriquecido del pedido
   ───────────────────────────────────────────────────────────────── */
function enriquecerPedido(p) {
  const detalles = db.prepare(`
    SELECT pd.*, pr.nombre AS producto_nombre, pr.sku
    FROM pedido_detalles pd
    JOIN productos pr ON pd.producto_id = pr.id
    WHERE pd.pedido_id = ?
    ORDER BY pd.id
  `).all(p.id);

  return {
    ...p,
    detalles,
    productos_resumen: detalles.map(d => `${d.sku} ×${d.cantidad}`).join(', '),
  };
}

/* ─────────────────────────────────────────────────────────────────
   CONTROLADOR: Listar Planilla (JSON o CSV)
   ───────────────────────────────────────────────────────────────── */
class PlanillaController {

  static listar(req, res, next) {
    try {
      const usuario = req.usuario;
      const { condiciones, params } = construirFiltros(req.query, usuario);

      // Paginación
      const limite  = Math.min(Number(req.query.limite) || 50, 200);
      const pagina  = Math.max(Number(req.query.pagina) || 1, 1);
      const offset  = (pagina - 1) * limite;

      // Orden (campo y dirección)
      const camposOrden = ['created_at', 'total', 'estado_pedido', 'estado_pago', 'cliente_nombre', 'codigo_pedido'];
      const ordenCampo  = camposOrden.includes(req.query.orden) ? req.query.orden : 'created_at';
      const ordenDir    = req.query.dir === 'ASC' ? 'ASC' : 'DESC';

      const where = condiciones.length > 0 ? `WHERE ${condiciones.join(' AND ')}` : '';

      // Total para paginación
      const totalRow = db.prepare(`
        SELECT COUNT(*) AS n
        FROM pedidos p
        ${where}
      `).get(...params);
      const total = totalRow ? totalRow.n : 0;

      // Totales financieros (Bs.)
      const totalesRow = db.prepare(`
        SELECT
          COALESCE(SUM(p.subtotal),   0) AS sum_subtotal,
          COALESCE(SUM(p.costo_envio),0) AS sum_envio,
          COALESCE(SUM(p.descuento),  0) AS sum_descuento,
          COALESCE(SUM(p.total),      0) AS sum_total
        FROM pedidos p
        ${where}
      `).get(...params);

      // Filas de la página
      const filas = db.prepare(`
        SELECT
          p.*,
          a.nombre AS almacen_nombre,
          pv.nombre AS punto_recojo_nombre
        FROM pedidos p
        LEFT JOIN almacenes a    ON p.almacen_id      = a.id
        LEFT JOIN puntos_venta pv ON p.punto_recojo_id = pv.id
        ${where}
        ORDER BY p.${ordenCampo} ${ordenDir}
        LIMIT ? OFFSET ?
      `).all(...params, limite, offset);

      // ── Exportación CSV ──────────────────────────────────────────
      if (req.query.formato === 'csv') {
        const cabecera = [
          'N°Pedido','Fecha','Cliente','CI/NIT','Email','Teléfono',
          'Productos','Subtotal (Bs.)','Envío (Bs.)','Descuento (Bs.)','Total (Bs.)',
          'Método Pago','Estado Pago','Estado Pedido','Almacén','Tipo Entrega',
          'Guía/Retiro'
        ].join(',');

        const lineas = filas.map(p => {
          const detsFila = db.prepare(`
            SELECT pd.cantidad, pr.sku, pr.nombre
            FROM pedido_detalles pd
            JOIN productos pr ON pd.producto_id = pr.id
            WHERE pd.pedido_id = ?
          `).all(p.id);

          const productos = detsFila.map(d => `${d.sku}x${d.cantidad}`).join('; ');
          const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`;

          return [
            esc(p.codigo_pedido),
            esc(p.created_at ? p.created_at.slice(0,10) : ''),
            esc(p.cliente_nombre),
            esc(p.cliente_ci_nit),
            esc(p.cliente_email),
            esc(p.cliente_telefono),
            esc(productos),
            Number(p.subtotal   || 0).toFixed(2),
            Number(p.costo_envio || 0).toFixed(2),
            Number(p.descuento   || 0).toFixed(2),
            Number(p.total       || 0).toFixed(2),
            esc(p.metodo_pago),
            esc(p.estado_pago),
            esc(p.estado_pedido),
            esc(p.almacen_nombre || ''),
            esc(p.tipo_entrega),
            esc(p.guia_envio || p.codigo_retiro || ''),
          ].join(',');
        });

        const csv = [cabecera, ...lineas].join('\r\n');
        res.setHeader('Content-Type',        'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="planilla_ventas.csv"');
        return res.status(200).send('\uFEFF' + csv); // BOM para Excel
      }

      // ── Respuesta JSON ───────────────────────────────────────────
      return res.status(200).json({
        ok: true,
        total,
        pagina,
        limite,
        total_paginas: Math.ceil(total / limite),
        totales: {
          subtotal:    Number((totalesRow?.sum_subtotal   || 0).toFixed(2)),
          envio:       Number((totalesRow?.sum_envio      || 0).toFixed(2)),
          descuento:   Number((totalesRow?.sum_descuento  || 0).toFixed(2)),
          total:       Number((totalesRow?.sum_total      || 0).toFixed(2)),
        },
        data: filas,
      });
    } catch (err) {
      next(err);
    }
  }

  /* ───────────────────────────────────────────────────────────────
     CONTROLADOR: Comprobante / Nota de Venta de un Pedido
     ─────────────────────────────────────────────────────────────── */
  static comprobante(req, res, next) {
    try {
      const usuario  = req.usuario;
      const pedidoId = Number(req.params.id);

      const pedido = Pedido.findById(pedidoId);
      if (!pedido) {
        return res.status(404).json({ ok: false, mensaje: 'Pedido no encontrado.' });
      }

      // RBAC: acceso al comprobante
      const rolesAlmacen = ['OPERADOR_ALMACEN', 'PREPARADOR_PEDIDOS', 'EMPACADOR', 'DESPACHADOR_ENTREGA'];
      const esAdmin    = usuario.rol === 'ADMINISTRADOR';
      const esPersonalAlmacen = rolesAlmacen.includes(usuario.rol) && Number(usuario.almacen_id) === Number(pedido.almacen_id);
      const esCliente  = ['CLIENTE_MINORISTA', 'CLIENTE_CORPORATIVO'].includes(usuario.rol)
                         && pedido.usuario_id && Number(usuario.id) === Number(pedido.usuario_id);

      if (!esAdmin && !esPersonalAlmacen && !esCliente) {
        return res.status(403).json({ ok: false, mensaje: 'Acceso denegado a este comprobante.' });
      }

      const enriched = enriquecerPedido(pedido);

      return res.status(200).json({
        ok: true,
        empresa: {
          razonSocial:     EMPRESA.razonSocial,
          nombreComercial: EMPRESA.nombreComercial,
          ciudad:          EMPRESA.ciudad,
          pais:            EMPRESA.pais,
          email:           EMPRESA.email,
          telefono:        EMPRESA.telefono,
          redesSociales:   EMPRESA.redesSociales,
        },
        data: enriched,
        advertencia_fiscal: 'Esta nota de venta es de carácter interno y NO constituye una factura fiscal válida ante el SIN (Servicio de Impuestos Nacionales de Bolivia).',
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = PlanillaController;
