/**
 * @file models/Categoria.js
 * @description Modelo de datos y DAO para la tabla 'categorias'.
 * ChocoTi-Digital | Capa 3: Persistencia y Acceso a Datos
 */

'use strict';

const db = require('../config/database');

class Categoria {
  /**
   * Obtiene todas las categorías activas.
   * @returns {Array<object>}
   */
  static findAll() {
    return db
      .prepare('SELECT id, nombre, descripcion, activo FROM categorias WHERE activo = 1 ORDER BY id ASC')
      .all();
  }

  /**
   * Obtiene una categoría por ID.
   * @param {number} id
   * @returns {object|undefined}
   */
  static findById(id) {
    return db
      .prepare('SELECT id, nombre, descripcion, activo FROM categorias WHERE id = ?')
      .get(id);
  }
}

module.exports = Categoria;
