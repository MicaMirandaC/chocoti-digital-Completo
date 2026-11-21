/**
 * @file controllers/authController.js
 * @description Controlador HTTP para endpoints de autenticación, registro y recuperación.
 * ChocoTi-Digital | Capa 1: Controladores y Transporte HTTP
 */

'use strict';

const { validationResult } = require('express-validator');
const AuthService = require('../services/authService');

/**
 * Obtiene la dirección IP real del cliente considerando cabeceras de proxy.
 * @param {import('express').Request} req
 * @returns {string}
 */
function obtenerIp(req) {
  return (
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.socket?.remoteAddress ||
    '127.0.0.1'
  );
}

/**
 * POST /api/auth/login
 * Autentica usuario con email y contraseña, registrando auditoría en logs_acceso.
 */
async function login(req, res, next) {
  const errores = validationResult(req);
  if (!errores.isEmpty()) {
    return res.status(422).json({
      ok: false,
      mensaje: 'Datos de inicio de sesión inválidos.',
      errores: errores.array(),
    });
  }

  try {
    const { email, password } = req.body;
    const ip = obtenerIp(req);

    const resultado = await AuthService.login({ email, password, ip });

    return res.status(200).json({
      ok: true,
      mensaje: 'Inicio de sesión exitoso.',
      token: resultado.token,
      usuario: resultado.usuario,
    });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({
        ok: false,
        mensaje: err.message,
      });
    }
    return next(err);
  }
}

/**
 * POST /api/auth/register
 * Registro público para Clientes Minoristas y Corporativos.
 */
async function register(req, res, next) {
  const errores = validationResult(req);
  if (!errores.isEmpty()) {
    return res.status(422).json({
      ok: false,
      mensaje: 'Datos de registro incompletos o inválidos.',
      errores: errores.array(),
    });
  }

  try {
    const ip = obtenerIp(req);
    const resultado = await AuthService.register({
      ...req.body,
      ip,
    });

    return res.status(201).json({
      ok: true,
      mensaje: 'Cuenta registrada exitosamente.',
      token: resultado.token,
      usuario: resultado.usuario,
    });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({
        ok: false,
        mensaje: err.message,
      });
    }
    return next(err);
  }
}

/**
 * POST /api/auth/recuperar-password
 * Emite token de recuperación y envía instrucciones por correo.
 */
async function recuperarPassword(req, res, next) {
  const errores = validationResult(req);
  if (!errores.isEmpty()) {
    return res.status(422).json({
      ok: false,
      mensaje: 'Ingrese un correo electrónico válido.',
      errores: errores.array(),
    });
  }

  try {
    const { email } = req.body;
    const ip = obtenerIp(req);
    const resultado = await AuthService.recuperarPassword({ email, ip });

    return res.status(200).json({
      ok: true,
      mensaje: resultado.mensaje,
    });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ ok: false, mensaje: err.message });
    }
    return next(err);
  }
}

/**
 * POST /api/auth/restablecer-password
 * Restablece la contraseña tras validar el token de recuperación.
 */
async function restablecerPassword(req, res, next) {
  const errores = validationResult(req);
  if (!errores.isEmpty()) {
    return res.status(422).json({
      ok: false,
      mensaje: 'Datos para restablecer contraseña inválidos.',
      errores: errores.array(),
    });
  }

  try {
    const { token, password_nueva, password_confirmar } = req.body;
    const resultado = await AuthService.restablecerPassword({
      token,
      password_nueva,
      password_confirmar,
    });

    return res.status(200).json({
      ok: true,
      mensaje: resultado.mensaje,
    });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ ok: false, mensaje: err.message });
    }
    return next(err);
  }
}

/**
 * GET /api/auth/me
 * Retorna el perfil del usuario autenticado actual.
 */
function getMe(req, res, next) {
  try {
    const usuario = AuthService.getPerfil(req.usuario.id);
    return res.status(200).json({
      ok: true,
      usuario,
    });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ ok: false, mensaje: err.message });
    }
    return next(err);
  }
}

/**
 * PUT /api/auth/perfil
 * Actualiza los datos de perfil propio del usuario autenticado.
 */
function updatePerfil(req, res, next) {
  try {
    const usuarioActualizado = AuthService.updatePerfil(req.usuario.id, req.body);
    return res.status(200).json({
      ok: true,
      mensaje: 'Perfil actualizado exitosamente.',
      usuario: usuarioActualizado,
    });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ ok: false, mensaje: err.message });
    }
    return next(err);
  }
}

/**
 * PUT /api/auth/password
 * Cambia la contraseña del usuario autenticado verificando la clave previa.
 */
async function cambiarPassword(req, res, next) {
  try {
    const resultado = await AuthService.cambiarPassword(req.usuario.id, req.body);
    return res.status(200).json({
      ok: true,
      mensaje: resultado.mensaje,
    });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ ok: false, mensaje: err.message });
    }
    return next(err);
  }
}

module.exports = {
  login,
  register,
  recuperarPassword,
  restablecerPassword,
  getMe,
  updatePerfil,
  cambiarPassword,
};
