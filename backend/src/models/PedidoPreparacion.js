/**
 * @file models/PedidoPreparacion.js
 * @description Modelo y DAO para el checklist de preparación (picking) y sugerencias FEFO por almacén.
 * ChocoTi-Digital | Capa 3: Persistencia y Acceso a Datos (Fase 7A)
 */

'use strict';

const db = require('../config/database');
const Lote = require('./Lote');

class PedidoPreparacion {
  /**
   * Obtiene el registro de preparación por ID de pedido.
   * @param {number} pedidoId
   * @param {object} [clientDb=db]
   * @returns {object|undefined}
   */
  static obtenerPorPedidoId(pedidoId, clientDb = db) {
    const row = clientDb.prepare(`
      SELECT pp.*,
             u.nombre_completo AS preparador_nombre,
             a.nombre AS almacen_nombre
      FROM pedido_preparacion pp
      LEFT JOIN usuarios u ON pp.preparador_id = u.id
      LEFT JOIN almacenes a ON pp.almacen_id = a.id
      WHERE pp.pedido_id = ?
    `).get(Number(pedidoId));

    if (row && row.checklist_picking_json) {
      try {
        row.checklist = JSON.parse(row.checklist_picking_json);
      } catch (_e) {
        row.checklist = [];
      }
    }
    return row;
  }

  /**
   * Inicia el proceso de preparación física del pedido si no existe registro previo.
   * @param {number} pedidoId
   * @param {number} preparadorId
   * @param {number} almacenId
   * @param {string} [notas='']
   * @param {object} [clientDb=db]
   * @returns {object} Registro creado o actualizado
   */
  static iniciar(pedidoId, preparadorId, almacenId, notas = '', clientDb = db) {
    const existente = this.obtenerPorPedidoId(pedidoId, clientDb);
    if (existente) {
      return existente;
    }

    clientDb.prepare(`
      INSERT INTO pedido_preparacion (
        pedido_id, almacen_id, preparador_id, fecha_inicio, estado, notas
      ) VALUES (?, ?, ?, CURRENT_TIMESTAMP, 'EN_PROCESO', ?)
    `).run(Number(pedidoId), Number(almacenId), Number(preparadorId), notas);

    return this.obtenerPorPedidoId(pedidoId, clientDb);
  }

  /**
   * Registra o actualiza el checklist de picking con validación FEFO e incidencias.
   * @param {object} params
   * @param {number} params.pedidoId
   * @param {number} params.preparadorId
   * @param {number} params.almacenId
   * @param {Array<object>|object} params.checklist
   * @param {number|boolean} [params.incidenciaStock=0]
   * @param {string} [params.detalleIncidencia='']
   * @param {string} [params.notas='']
   * @param {'EN_PROCESO'|'COMPLETADO'|'INCIDENCIA'} [params.estado]
   * @param {object} [clientDb=db]
   * @returns {object} Registro guardado
   */
  static registrarChecklist({
    pedidoId,
    preparadorId,
    almacenId,
    checklist,
    incidenciaStock = 0,
    detalleIncidencia = '',
    notas = '',
    estado = null,
  }, clientDb = db) {
    const checklistJson = typeof checklist === 'string' ? checklist : JSON.stringify(checklist || []);
    const incidencia = (incidenciaStock && incidenciaStock !== 0 && incidenciaStock !== '0') ? 1 : 0;
    const estadoFinal = estado || (incidencia ? 'INCIDENCIA' : 'COMPLETADO');

    const existente = clientDb.prepare('SELECT id FROM pedido_preparacion WHERE pedido_id = ?').get(Number(pedidoId));

    if (existente) {
      clientDb.prepare(`
        UPDATE pedido_preparacion
        SET preparador_id = ?,
            almacen_id = ?,
            checklist_picking_json = ?,
            incidencia_stock = ?,
            detalle_incidencia = ?,
            estado = ?,
            notas = ?,
            fecha_fin = CURRENT_TIMESTAMP
        WHERE pedido_id = ?
      `).run(
        Number(preparadorId),
        Number(almacenId),
        checklistJson,
        incidencia,
        detalleIncidencia,
        estadoFinal,
        notas,
        Number(pedidoId)
      );
    } else {
      clientDb.prepare(`
        INSERT INTO pedido_preparacion (
          pedido_id, almacen_id, preparador_id, fecha_inicio, fecha_fin,
          checklist_picking_json, incidencia_stock, detalle_incidencia, estado, notas
        ) VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, ?, ?, ?, ?, ?)
      `).run(
        Number(pedidoId),
        Number(almacenId),
        Number(preparadorId),
        checklistJson,
        incidencia,
        detalleIncidencia,
        estadoFinal,
        notas
      );
    }

    return this.obtenerPorPedidoId(pedidoId, clientDb);
  }

  /**
   * Genera sugerencias de picking respetando política FEFO (First Expired, First Out)
   * para los productos del pedido en el almacén especificado.
   * @param {number} pedidoId
   * @param {object} [clientDb=db]
   * @returns {Array<object>} Lista de productos con lotes recomendados ordenados por vencimiento próximo
   */
  static generarSugerenciaFEFO(pedidoId, clientDb = db) {
    const Pedido = require('./Pedido');
    const pedido = Pedido.findById(Number(pedidoId), clientDb);
    if (!pedido || !pedido.detalles) return [];

    const sugerencias = [];

    for (const item of pedido.detalles) {
      const lotesDisponibles = Lote.obtenerPorProductoAlmacen(item.producto_id, pedido.almacen_id);
      let pendiente = item.cantidad;
      const lotesSugeridos = [];

      for (const lote of lotesDisponibles) {
        if (pendiente <= 0) break;
        const cantRecomendada = Math.min(lote.cantidad, pendiente);
        lotesSugeridos.push({
          lote_id: lote.id,
          lote_codigo: lote.lote_codigo,
          fecha_vencimiento: lote.fecha_vencimiento,
          dias_para_vencer: lote.dias_para_vencer,
          cantidad_disponible: lote.cantidad,
          cantidad_sugerida: cantRecomendada,
        });
        pendiente -= cantRecomendada;
      }

      sugerencias.push({
        producto_id: item.producto_id,
        sku: item.sku,
        producto_nombre: item.producto_nombre,
        cantidad_requerida: item.cantidad,
        cobertura_completa: pendiente === 0,
        unidades_faltantes: Math.max(0, pendiente),
        lotes: lotesSugeridos,
      });
    }

    return sugerencias;
  }
}

module.exports = PedidoPreparacion;
