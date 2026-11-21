/**
 * @file models/PuntoVenta.js
 * @description Modelo de datos y DAO para la tabla 'puntos_venta'.
 * ChocoTi-Digital | Capa 3: Persistencia y Acceso a Datos
 */

'use strict';

const db = require('../config/database');

class PuntoVenta {
  /**
   * Obtiene todas las agencias propias (tipo P) habilitadas para recojo en tienda.
   * Por especificación: agencias oficiales de Sucre y La Paz.
   * @returns {Array<object>}
   */
  static obtenerAgenciasPropias() {
    const query = `
      SELECT id, ciudad, tipo, nombre, direccion, telefono, permite_recojo, activo
      FROM puntos_venta
      WHERE tipo = 'P' AND permite_recojo = 1 AND activo = 1
      ORDER BY ciudad ASC, nombre ASC
    `;
    return db.prepare(query).all();
  }

  /**
   * Busca un punto de venta por ID.
   * @param {number} id
   * @returns {object|undefined}
   */
  static findById(id) {
    return db.prepare('SELECT * FROM puntos_venta WHERE id = ?').get(id);
  }

  /**
   * Lista todos los puntos de venta con filtros opcionales de ciudad y tipo.
   * @param {object} [filtros={}]
   * @returns {Array<object>}
   */
  static findAll(filtros = {}) {
    const condiciones = ['activo = 1'];
    const params = [];

    if (filtros.ciudad) {
      condiciones.push('LOWER(ciudad) = LOWER(?)');
      params.push(filtros.ciudad);
    }

    if (filtros.tipo) {
      condiciones.push('tipo = ?');
      params.push(filtros.tipo);
    }

    const where = `WHERE ${condiciones.join(' AND ')}`;
    const query = `
      SELECT id, ciudad, tipo, nombre, direccion, telefono, permite_recojo, activo
      FROM puntos_venta
      ${where}
      ORDER BY ciudad ASC, tipo ASC, nombre ASC
    `;
    return db.prepare(query).all(...params);
  }
}

module.exports = PuntoVenta;
