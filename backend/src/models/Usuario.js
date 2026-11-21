/**
 * @file models/Usuario.js
 * @description Modelo de datos y DAO para la tabla 'usuarios'.
 * ChocoTi-Digital | Capa 3: Persistencia y Acceso a Datos
 */

'use strict';

const db = require('../config/database');

class Usuario {
  /**
   * Busca un usuario por email incluyendo password_hash y campos de seguridad.
   * @param {string} email
   * @returns {object|undefined}
   */
  static findByEmail(email) {
    return db
      .prepare(
        `SELECT
          u.id,
          u.nombre_completo,
          u.email,
          u.password_hash,
          u.ci_nit,
          u.telefono,
          u.tipo_cliente,
          u.razon_social,
          u.rol_id,
          u.almacen_id,
          u.estado,
          u.intentos_fallidos,
          u.bloqueado_hasta,
          u.token_recuperacion,
          u.token_expira_en,
          u.fecha_creacion,
          u.ultima_conexion,
          r.nombre AS rol,
          a.nombre AS almacen_nombre
        FROM usuarios u
        JOIN roles r ON u.rol_id = r.id
        LEFT JOIN almacenes a ON u.almacen_id = a.id
        WHERE u.email = ? COLLATE NOCASE`
      )
      .get(email);
  }

  /**
   * Busca un usuario por ID (sin password_hash ni datos sensibles).
   * @param {number} id
   * @returns {object|undefined}
   */
  static findById(id) {
    return db
      .prepare(
        `SELECT
          u.id,
          u.nombre_completo,
          u.email,
          u.ci_nit,
          u.telefono,
          u.tipo_cliente,
          u.razon_social,
          u.rol_id,
          u.almacen_id,
          u.estado,
          u.intentos_fallidos,
          u.bloqueado_hasta,
          u.fecha_creacion,
          u.ultima_conexion,
          r.nombre AS rol,
          a.nombre AS almacen_nombre
        FROM usuarios u
        JOIN roles r ON u.rol_id = r.id
        LEFT JOIN almacenes a ON u.almacen_id = a.id
        WHERE u.id = ?`
      )
      .get(id);
  }

  /**
   * Obtiene un usuario con password_hash por su ID (para cambio de clave).
   * @param {number} id
   * @returns {object|undefined}
   */
  static findWithPasswordById(id) {
    return db
      .prepare(
        `SELECT
          u.id,
          u.nombre_completo,
          u.email,
          u.password_hash,
          u.estado,
          u.bloqueado_hasta
        FROM usuarios u
        WHERE u.id = ?`
      )
      .get(id);
  }

  /**
   * Incrementa el contador de intentos fallidos.
   * Si alcanza 5 intentos, bloquea temporalmente la cuenta por 15 minutos.
   * @param {number} id
   * @returns {object} Estado actualizado de intentos y bloqueo
   */
  static incrementarIntentosFallidos(id) {
    const usuario = db.prepare('SELECT intentos_fallidos FROM usuarios WHERE id = ?').get(id);
    if (!usuario) return null;

    const nuevosIntentos = (usuario.intentos_fallidos || 0) + 1;

    if (nuevosIntentos >= 5) {
      db.prepare(`
        UPDATE usuarios
        SET intentos_fallidos = ?,
            bloqueado_hasta = datetime('now', '+15 minutes'),
            estado = 'BLOQUEADO'
        WHERE id = ?
      `).run(nuevosIntentos, id);

      return { intentos_fallidos: nuevosIntentos, bloqueado: true };
    }

    db.prepare('UPDATE usuarios SET intentos_fallidos = ? WHERE id = ?').run(nuevosIntentos, id);
    return { intentos_fallidos: nuevosIntentos, bloqueado: false };
  }

  /**
   * Restablece el contador de intentos fallidos y desbloquea la cuenta.
   * @param {number} id
   */
  static resetearIntentosFallidos(id) {
    db.prepare(`
      UPDATE usuarios
      SET intentos_fallidos = 0,
          bloqueado_hasta = NULL,
          estado = CASE WHEN estado = 'BLOQUEADO' THEN 'ACTIVO' ELSE estado END
      WHERE id = ?
    `).run(id);
  }

  /**
   * Almacena un token criptográfico de recuperación de contraseña con fecha de caducidad.
   * @param {number} id
   * @param {string} token
   * @param {string} expiraEnIso
   */
  static guardarTokenRecuperacion(id, token, expiraEnIso) {
    db.prepare(`
      UPDATE usuarios
      SET token_recuperacion = ?,
          token_expira_en = ?
      WHERE id = ?
    `).run(token, expiraEnIso, id);
  }

  /**
   * Busca un usuario por token de recuperación verificando que no haya caducado.
   * @param {string} token
   * @returns {object|undefined}
   */
  static findByTokenRecuperacion(token) {
    return db
      .prepare(
        `SELECT
          id, nombre_completo, email, estado, token_expira_en
        FROM usuarios
        WHERE token_recuperacion = ?
          AND datetime(token_expira_en) > datetime('now')`
      )
      .get(token);
  }

  /**
   * Restablece la contraseña mediante token de recuperación y limpia el token.
   * @param {number} id
   * @param {string} passwordHash
   */
  static restablecerPasswordConToken(id, passwordHash) {
    db.prepare(`
      UPDATE usuarios
      SET password_hash = ?,
          token_recuperacion = NULL,
          token_expira_en = NULL,
          intentos_fallidos = 0,
          bloqueado_hasta = NULL,
          estado = 'ACTIVO'
      WHERE id = ?
    `).run(passwordHash, id);
  }

  /**
   * Registro público seguro de clientes: SOLO permite CLIENTE_MINORISTA (rol 3)
   * o CLIENTE_CORPORATIVO (rol 4). Ignora cualquier rol privilegiado recibido.
   * @param {object} datos
   * @returns {object}
   */
  static createClientePublico(datos) {
    const esCorporativo = String(datos.tipo_cliente).toUpperCase() === 'CORPORATIVO';
    const rolId = esCorporativo ? 4 : 3; // 4 = CLIENTE_CORPORATIVO, 3 = CLIENTE_MINORISTA
    const tipoCliente = esCorporativo ? 'CORPORATIVO' : 'MINORISTA';

    const stmt = db.prepare(`
      INSERT INTO usuarios
        (nombre_completo, email, password_hash, ci_nit, telefono,
         tipo_cliente, razon_social, rol_id, almacen_id, estado)
      VALUES
        (@nombre_completo, @email, @password_hash, @ci_nit, @telefono,
         @tipo_cliente, @razon_social, @rol_id, NULL, 'ACTIVO')
    `);

    const info = stmt.run({
      nombre_completo: datos.nombre_completo.trim(),
      email: datos.email.trim().toLowerCase(),
      password_hash: datos.password_hash,
      ci_nit: datos.ci_nit ? datos.ci_nit.trim() : null,
      telefono: datos.telefono ? datos.telefono.trim() : null,
      tipo_cliente: tipoCliente,
      razon_social: esCorporativo && datos.razon_social ? datos.razon_social.trim() : null,
      rol_id: rolId,
    });

    return Usuario.findById(info.lastInsertRowid);
  }

  /**
   * Lista usuarios aplicando filtros opcionales (Solo administradores).
   * @param {object} filtros
   * @returns {Array<object>}
   */
  static findAll(filtros = {}) {
    const condiciones = [];
    const params = [];

    if (filtros.rol_id !== undefined && filtros.rol_id !== null && filtros.rol_id !== '') {
      condiciones.push('u.rol_id = ?');
      params.push(Number(filtros.rol_id));
    }

    if (filtros.almacen_id !== undefined && filtros.almacen_id !== null && filtros.almacen_id !== '') {
      condiciones.push('u.almacen_id = ?');
      params.push(Number(filtros.almacen_id));
    }

    if (filtros.estado) {
      condiciones.push('u.estado = ?');
      params.push(filtros.estado.toUpperCase());
    }

    if (filtros.tipo_cliente) {
      condiciones.push('u.tipo_cliente = ?');
      params.push(filtros.tipo_cliente.toUpperCase());
    }

    const where = condiciones.length > 0 ? `WHERE ${condiciones.join(' AND ')}` : '';

    return db
      .prepare(
        `SELECT
          u.id,
          u.nombre_completo,
          u.email,
          u.ci_nit,
          u.telefono,
          u.tipo_cliente,
          u.razon_social,
          u.rol_id,
          u.almacen_id,
          u.estado,
          u.fecha_creacion,
          u.ultima_conexion,
          r.nombre AS rol,
          a.nombre AS almacen_nombre
        FROM usuarios u
        JOIN roles r ON u.rol_id = r.id
        LEFT JOIN almacenes a ON u.almacen_id = a.id
        ${where}
        ORDER BY u.id ASC`
      )
      .all(...params);
  }

  /**
   * Inserta un nuevo usuario (Uso administrativo).
   * @param {object} datos
   * @returns {object}
   */
  static create(datos) {
    const stmt = db.prepare(`
      INSERT INTO usuarios
        (nombre_completo, email, password_hash, ci_nit, telefono,
         tipo_cliente, razon_social, rol_id, almacen_id, estado)
      VALUES
        (@nombre_completo, @email, @password_hash, @ci_nit, @telefono,
         @tipo_cliente, @razon_social, @rol_id, @almacen_id, @estado)
    `);

    const info = stmt.run({
      nombre_completo: datos.nombre_completo,
      email: datos.email,
      password_hash: datos.password_hash,
      ci_nit: datos.ci_nit ?? null,
      telefono: datos.telefono ?? null,
      tipo_cliente: datos.tipo_cliente || 'MINORISTA',
      razon_social: datos.razon_social ?? null,
      rol_id: datos.rol_id,
      almacen_id: datos.almacen_id ?? null,
      estado: datos.estado || 'ACTIVO',
    });

    return Usuario.findById(info.lastInsertRowid);
  }

  /**
   * Actualiza los datos de un usuario.
   * @param {number} id
   * @param {object} datos
   * @returns {object|undefined}
   */
  static update(id, datos) {
    const camposPermitidos = [
      'nombre_completo',
      'email',
      'ci_nit',
      'telefono',
      'tipo_cliente',
      'razon_social',
      'rol_id',
      'almacen_id',
      'estado',
    ];

    const sets = [];
    const params = [];

    for (const campo of camposPermitidos) {
      if (Object.prototype.hasOwnProperty.call(datos, campo) && datos[campo] !== undefined) {
        sets.push(`${campo} = ?`);
        params.push(datos[campo] === '' ? null : datos[campo]);
      }
    }

    if (sets.length === 0) {
      return Usuario.findById(id);
    }

    params.push(id);
    db.prepare(`UPDATE usuarios SET ${sets.join(', ')} WHERE id = ?`).run(...params);

    return Usuario.findById(id);
  }

  /**
   * Inactiva lógicamente un usuario.
   * @param {number} id
   * @returns {boolean}
   */
  static inactivar(id) {
    const info = db.prepare(`UPDATE usuarios SET estado = 'INACTIVO' WHERE id = ?`).run(id);
    return info.changes > 0;
  }

  /**
   * Cambia la contraseña (password_hash) del usuario.
   * @param {number} id
   * @param {string} passwordHash
   */
  static cambiarPassword(id, passwordHash) {
    db.prepare(`UPDATE usuarios SET password_hash = ? WHERE id = ?`).run(passwordHash, id);
  }

  /**
   * Actualiza la marca de última conexión.
   * @param {number} id
   */
  static actualizarUltimaConexion(id) {
    db.prepare(`UPDATE usuarios SET ultima_conexion = CURRENT_TIMESTAMP WHERE id = ?`).run(id);
  }

  /**
   * Retorna estadísticas agregadas de usuarios.
   * @returns {object}
   */
  static obtenerEstadisticas() {
    const row = db
      .prepare(
        `SELECT
          COUNT(*) AS total,
          SUM(CASE WHEN estado = 'ACTIVO' THEN 1 ELSE 0 END) AS activos,
          SUM(CASE WHEN estado = 'INACTIVO' THEN 1 ELSE 0 END) AS inactivos,
          SUM(CASE WHEN estado = 'BLOQUEADO' THEN 1 ELSE 0 END) AS bloqueados
        FROM usuarios`
      )
      .get();

    return {
      total: row.total || 0,
      activos: row.activos || 0,
      inactivos: row.inactivos || 0,
      bloqueados: row.bloqueados || 0,
    };
  }
}

module.exports = Usuario;
