/**
 * @file models/PedidoEmpaque.js
 * @description Modelo y DAO para el checklist de empaque, embalaje térmico y rotulado.
 * ChocoTi-Digital | Capa 3: Persistencia y Acceso a Datos (Fases 7A y 7B)
 */

'use strict';

const db = require('../config/database');

class PedidoEmpaque {
  /**
   * Obtiene el registro de empaque por ID de pedido.
   * @param {number} pedidoId
   * @param {object} [clientDb=db]
   * @returns {object|undefined}
   */
  static obtenerPorPedidoId(pedidoId, clientDb = db) {
    const row = clientDb.prepare(`
      SELECT pe.*,
             u.nombre_completo AS empacador_nombre,
             a.nombre AS almacen_nombre
      FROM pedido_empaque pe
      LEFT JOIN usuarios u ON pe.empacador_id = u.id
      LEFT JOIN almacenes a ON pe.almacen_id = a.id
      WHERE pe.pedido_id = ?
    `).get(Number(pedidoId));

    if (row && row.checklist_empaque_json) {
      try {
        row.checklist = JSON.parse(row.checklist_empaque_json);
      } catch (_e) {
        row.checklist = [];
      }
    }
    return row;
  }

  /**
   * Inicia el proceso de empaque del pedido si no existe registro previo.
   * @param {number} pedidoId
   * @param {number} empacadorId
   * @param {number} almacenId
   * @param {string} [notas='']
   * @param {object} [clientDb=db]
   * @returns {object}
   */
  static iniciar(pedidoId, empacadorId, almacenId, notas = '', clientDb = db) {
    const existente = this.obtenerPorPedidoId(pedidoId, clientDb);
    if (existente) {
      return existente;
    }

    clientDb.prepare(`
      INSERT INTO pedido_empaque (
        pedido_id, almacen_id, empacador_id, fecha_inicio, estado, notas
      ) VALUES (?, ?, ?, CURRENT_TIMESTAMP, 'EN_PROCESO', ?)
    `).run(Number(pedidoId), Number(almacenId), Number(empacadorId), notas);

    return this.obtenerPorPedidoId(pedidoId, clientDb);
  }

  /**
   * Registra o actualiza el checklist de empaque, empaque térmico, tarjetas y pesos.
   * @param {object} params
   * @param {number} params.pedidoId
   * @param {number} params.empacadorId
   * @param {number} params.almacenId
   * @param {number|boolean} [params.empaqueTermico=0]
   * @param {number|boolean} [params.tarjetaMensaje=0]
   * @param {string} [params.textoTarjeta='']
   * @param {number|boolean} [params.etiquetaGenerada=1]
   * @param {number} [params.pesoKg=1.0]
   * @param {number} [params.numeroCajas=1]
   * @param {Array<object>|object} [params.checklist=null]
   * @param {string} [params.notas='']
   * @param {'EN_PROCESO'|'COMPLETADO'} [params.estado='COMPLETADO']
   * @param {object} [clientDb=db]
   * @returns {object}
   */
  static registrarChecklist({
    pedidoId,
    empacadorId,
    almacenId,
    empaqueTermico = 0,
    tarjetaMensaje = 0,
    textoTarjeta = '',
    etiquetaGenerada = 1,
    pesoKg = 1.0,
    numeroCajas = 1,
    checklist = null,
    notas = '',
    estado = 'COMPLETADO',
  }, clientDb = db) {
    const checklistJson = checklist ? (typeof checklist === 'string' ? checklist : JSON.stringify(checklist)) : null;
    const termico = empaqueTermico ? 1 : 0;
    const tarjeta = tarjetaMensaje ? 1 : 0;
    const etiqueta = etiquetaGenerada ? 1 : 0;

    const existente = clientDb.prepare('SELECT id FROM pedido_empaque WHERE pedido_id = ?').get(Number(pedidoId));

    if (existente) {
      clientDb.prepare(`
        UPDATE pedido_empaque
        SET empacador_id = ?,
            almacen_id = ?,
            empaque_termico = ?,
            tarjeta_mensaje = ?,
            texto_tarjeta = ?,
            etiqueta_generada = ?,
            peso_kg = ?,
            numero_cajas = ?,
            checklist_empaque_json = ?,
            estado = ?,
            notas = ?,
            fecha_fin = CURRENT_TIMESTAMP
        WHERE pedido_id = ?
      `).run(
        Number(empacadorId),
        Number(almacenId),
        termico,
        tarjeta,
        textoTarjeta,
        etiqueta,
        Number(pesoKg) || 1.0,
        Number(numeroCajas) || 1,
        checklistJson,
        estado,
        notas,
        Number(pedidoId)
      );
    } else {
      clientDb.prepare(`
        INSERT INTO pedido_empaque (
          pedido_id, almacen_id, empacador_id, fecha_inicio, fecha_fin,
          empaque_termico, tarjeta_mensaje, texto_tarjeta, etiqueta_generada,
          peso_kg, numero_cajas, checklist_empaque_json, estado, notas
        ) VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        Number(pedidoId),
        Number(almacenId),
        Number(empacadorId),
        termico,
        tarjeta,
        textoTarjeta,
        etiqueta,
        Number(pesoKg) || 1.0,
        Number(numeroCajas) || 1,
        checklistJson,
        estado,
        notas
      );
    }

    return this.obtenerPorPedidoId(pedidoId, clientDb);
  }
}

module.exports = PedidoEmpaque;
