/**
 * @file middleware/authMiddleware.js
 * @description Middlewares de autenticación JWT y control de acceso basado en roles (RBAC).
 * ChocoTi-Digital | Capa 1: Controladores y Seguridad HTTP
 */

'use strict';

require('dotenv').config();

const jwt = require('jsonwebtoken');
const LogAcceso = require('../models/LogAcceso');

const JWT_SECRET = process.env.JWT_SECRET || 'chocoti_secret_sucre_bolivia_2026';

/**
 * Extrae el Bearer token de las cabeceras HTTP.
 * @param {import('express').Request} req
 * @returns {string|null}
 */
function extraerToken(req) {
  const authHeader = req.headers['authorization'] || req.headers['Authorization'];
  if (!authHeader || typeof authHeader !== 'string') return null;

  const partes = authHeader.trim().split(' ');
  if (partes.length === 2 && partes[0].toLowerCase() === 'bearer') {
    return partes[1];
  }
  return null;
}

/**
 * Middleware para validar el JWT y cargar la sesión en req.usuario.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
function verificarToken(req, res, next) {
  const token = extraerToken(req);

  if (!token) {
    return res.status(401).json({
      ok: false,
      mensaje: 'Acceso no autorizado. Token de autenticación requerido.',
    });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.usuario = {
      id: payload.id,
      nombre_completo: payload.nombre_completo,
      email: payload.email,
      rol: payload.rol,
      rol_id: payload.rol_id,
      almacen_id: payload.almacen_id,
      tipo_cliente: payload.tipo_cliente,
    };
    next();
  } catch (err) {
    const mensaje =
      err.name === 'TokenExpiredError'
        ? 'La sesión ha expirado por inactividad. Por favor, inicie sesión nuevamente.'
        : 'Token de autenticación inválido o alterado.';

    return res.status(401).json({
      ok: false,
      mensaje,
    });
  }
}

/**
 * Middleware para restringir acceso exclusivamente al rol ADMINISTRADOR.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
function soloAdmin(req, res, next) {
  if (!req.usuario || req.usuario.rol !== 'ADMINISTRADOR') {
    return res.status(403).json({
      ok: false,
      mensaje: 'Acceso denegado. Se requieren privilegios de ADMINISTRADOR.',
    });
  }
  next();
}

/**
 * Middleware parametrizado para autorizar una lista específica de roles.
 * @param {Array<string>} rolesPermitidos - ej. ['ADMINISTRADOR', 'OPERADOR_ALMACEN']
 */
function rolAutorizado(rolesPermitidos = []) {
  return (req, res, next) => {
    if (!req.usuario) {
      return res.status(401).json({ ok: false, mensaje: 'Usuario no autenticado.' });
    }
    if (!rolesPermitidos.includes(req.usuario.rol)) {
      return res.status(403).json({
        ok: false,
        mensaje: `Acceso denegado. Rol '${req.usuario.rol}' no autorizado para este recurso.`,
      });
    }
    next();
  };
}

/**
 * Mapa de transiciones de estado de pedidos permitidas por cada rol del sistema.
 * Requisito Fase 3B / ajustes_ingeniero.md
 */
const TRANSICIONES_POR_ROL = {
  ADMINISTRADOR: [
    'PENDIENTE_PAGO', 'PAGADO', 'EN_PREPARACION', 'PREPARADO', 'EMPACADO',
    'LISTO', 'LISTO_DESPACHO', 'LISTO_RECOJO', 'DESPACHADO', 'ENTREGADO', 'FINALIZADO',
    'CANCELADO', 'EXPIRADO', 'ENTREGA_FALLIDA', 'DEVUELTO',
  ],
  OPERADOR_ALMACEN: ['PAGADO', 'EN_PREPARACION', 'PREPARADO', 'EMPACADO',
    'LISTO', 'LISTO_DESPACHO', 'LISTO_RECOJO', 'DESPACHADO', 'CANCELADO',],
  PREPARADOR_PEDIDOS: ['EN_PREPARACION', 'PREPARADO'],
  EMPACADOR: ['EMPACADO', 'LISTO', 'LISTO_DESPACHO', 'LISTO_RECOJO'],
  DESPACHADOR_ENTREGA: ['DESPACHADO', 'ENTREGADO', 'ENTREGA_FALLIDA', 'DEVUELTO'],
  CLIENTE_MINORISTA: ['FINALIZADO', 'CANCELADO'],
  CLIENTE_CORPORATIVO: ['FINALIZADO', 'CANCELADO'],
};

/**
 * Middleware para garantizar que los operadores y personal interno de almacén solo operen en su sucursal.
 */
function soloAlmacenAsignado(req, res, next) {
  if (!req.usuario) {
    return res.status(401).json({ ok: false, mensaje: 'Usuario no autenticado.' });
  }

  // Si es Administrador, tiene acceso irrestricto a todos los almacenes
  if (req.usuario.rol === 'ADMINISTRADOR') {
    return next();
  }

  // Si es Operador, Preparador, Empacador o Despachador, debe coincidir con su almacen_id
  const rolesConAlmacen = ['OPERADOR_ALMACEN', 'PREPARADOR_PEDIDOS', 'EMPACADOR', 'DESPACHADOR_ENTREGA'];
  if (rolesConAlmacen.includes(req.usuario.rol)) {
    const almacenSolicitado = req.params.almacen_id || req.query.almacen_id || req.body.almacen_id;
    if (almacenSolicitado && Number(almacenSolicitado) !== Number(req.usuario.almacen_id)) {
      return res.status(403).json({
        ok: false,
        mensaje: 'Acceso denegado. Solo tiene permisos para gestionar su almacén asignado.',
      });
    }

    // Si la ruta contiene un pedido_id o id, verificar el almacén del pedido
    const pedidoId = req.params.pedido_id || req.params.id;
    if (pedidoId && !isNaN(Number(pedidoId))) {
      try {
        const Pedido = require('../models/Pedido');
        const pedido = Pedido.findById(Number(pedidoId));
        if (pedido && Number(pedido.almacen_id) !== Number(req.usuario.almacen_id)) {
          return res.status(403).json({
            ok: false,
            mensaje: 'Acceso denegado. Solo tiene permisos para gestionar pedidos de su almacén asignado.',
          });
        }
      } catch (_e) {
        // En caso de que no exista el pedido o en pruebas unitarias aisladas
      }
    }
  }

  next();
}

/**
 * Middleware para validar que el rol del usuario autenticado tenga permiso para transicionar
 * el pedido al nuevo estado solicitado. Si no tiene permiso, retorna 403 Forbidden.
 */
function validarTransicionEstado(req, res, next) {
  if (!req.usuario) {
    return res.status(401).json({ ok: false, mensaje: 'Usuario no autenticado.' });
  }

  let nuevoEstado = req.body && (req.body.nuevo_estado || req.body.estado_pedido || req.body.estado);
  if (!nuevoEstado) {
    return next();
  }

  nuevoEstado = String(nuevoEstado).toUpperCase();

  // Si se envía 'LISTO' genérico, resolver según el tipo_entrega del pedido si está disponible
  const pedidoId = req.params && (req.params.id || req.params.pedido_id);
  if (pedidoId && !isNaN(Number(pedidoId))) {
    try {
      const Pedido = require('../models/Pedido');
      const pedido = Pedido.findById(Number(pedidoId));
      if (pedido) {
        // Aislamiento de almacén para transiciones
        const rolesConAlmacen = ['OPERADOR_ALMACEN', 'PREPARADOR_PEDIDOS', 'EMPACADOR', 'DESPACHADOR_ENTREGA'];
        if (rolesConAlmacen.includes(req.usuario.rol) && Number(pedido.almacen_id) !== Number(req.usuario.almacen_id)) {
          return res.status(403).json({
            ok: false,
            mensaje: `Acceso denegado. Solo tiene permisos para gestionar pedidos de su almacén asignado.`,
          });
        }

        if (nuevoEstado === 'LISTO') {
          nuevoEstado = pedido.tipo_entrega === 'RECOJO_AGENCIA' ? 'LISTO_RECOJO' : 'LISTO_DESPACHO';
          req.body.nuevo_estado = nuevoEstado;
        }
      }
    } catch (_e) {}
  }

  const rol = req.usuario.rol;
  const permitidos = TRANSICIONES_POR_ROL[rol] || [];

  if (!permitidos.includes(nuevoEstado) && !(nuevoEstado === 'LISTO' && (permitidos.includes('LISTO_DESPACHO') || permitidos.includes('LISTO_RECOJO')))) {
    return res.status(403).json({
      ok: false,
      mensaje: `Acceso denegado. El rol '${rol}' no tiene autorización para cambiar pedidos al estado '${nuevoEstado}'.`,
    });
  }

  next();
}

/**
 * Middleware para permitir el acceso a un recurso de usuario si es ADMINISTRADOR
 * o si es el propio usuario autenticado solicitando su propio ID.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
function adminOPropioUsuario(req, res, next) {
  if (!req.usuario) {
    return res.status(401).json({ ok: false, mensaje: 'Usuario no autenticado.' });
  }

  const esAdmin = req.usuario.rol === 'ADMINISTRADOR';
  const esPropio = String(req.usuario.id) === String(req.params.id);

  if (esAdmin || esPropio) {
    return next();
  }

  return res.status(403).json({
    ok: false,
    mensaje: 'Acceso denegado. No tiene permisos para acceder a información de otros usuarios.',
  });
}

/**
 * Helper para registrar accesos en logs_acceso.
 *
 * @param {number|null} usuario_id
 * @param {string} ip_origen
 * @param {'EXITOSO'|'FALLIDO'} estado_login
 * @param {string} detalles
 */
function registrarLog(usuario_id, ip_origen, estado_login, detalles = '') {
  try {
    LogAcceso.registrar({ usuario_id, ip_origen, estado_login, detalles });
  } catch (err) {
    console.error('[authMiddleware.registrarLog] Error al registrar log:', err.message);
  }
}

module.exports = {
  verificarToken,
  soloAdmin,
  rolAutorizado,
  soloAlmacenAsignado,
  adminOPropioUsuario,
  registrarLog,
  validarTransicionEstado,
  TRANSICIONES_POR_ROL,
};
