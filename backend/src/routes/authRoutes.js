/**
 * @file routes/authRoutes.js
 * @description Definición de endpoints REST para autenticación, registro y recuperación de clave.
 * ChocoTi-Digital | Capa 1: Controladores y Transporte HTTP
 */

'use strict';

const express = require('express');
const { body } = require('express-validator');
const router = express.Router();

const authController = require('../controllers/authController');
const { verificarToken } = require('../middleware/authMiddleware');

/**
 * Validaciones para login.
 */
const validarLogin = [
  body('email')
    .trim()
    .notEmpty().withMessage('El email es requerido.')
    .isEmail().withMessage('El formato de correo electrónico no es válido.')
    .normalizeEmail(),
  body('password')
    .notEmpty().withMessage('La contraseña es requerida.'),
];

/**
 * Validaciones para registro público de clientes.
 */
const validarRegister = [
  body('nombre_completo')
    .trim()
    .notEmpty().withMessage('El nombre completo es requerido.')
    .isLength({ min: 3 }).withMessage('El nombre debe tener al menos 3 caracteres.'),
  body('email')
    .trim()
    .notEmpty().withMessage('El email es requerido.')
    .isEmail().withMessage('El formato de correo no es válido.')
    .normalizeEmail(),
  body('password')
    .notEmpty().withMessage('La contraseña es requerida.')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/)
    .withMessage('La contraseña debe tener mínimo 8 caracteres, al menos una mayúscula, una minúscula y un número.'),
  body('tipo_cliente')
    .optional()
    .isIn(['MINORISTA', 'CORPORATIVO'])
    .withMessage('El tipo de cliente debe ser MINORISTA o CORPORATIVO.'),
];

/**
 * Validaciones para recuperar contraseña.
 */
const validarRecuperar = [
  body('email')
    .trim()
    .notEmpty().withMessage('El email es requerido.')
    .isEmail().withMessage('El formato de correo no es válido.')
    .normalizeEmail(),
];

/**
 * Validaciones para restablecer contraseña.
 */
const validarRestablecer = [
  body('token').notEmpty().withMessage('El token de recuperación es requerido.'),
  body('password_nueva')
    .notEmpty().withMessage('La nueva contraseña es requerida.')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/)
    .withMessage('La contraseña debe tener mínimo 8 caracteres, al menos una mayúscula, una minúscula y un número.'),
  body('password_confirmar')
    .notEmpty().withMessage('La confirmación de contraseña es requerida.'),
];

// Endpoints públicos
router.post('/login', validarLogin, authController.login);
router.post('/register', validarRegister, authController.register);
router.post('/recuperar-password', validarRecuperar, authController.recuperarPassword);
router.post('/restablecer-password', validarRestablecer, authController.restablecerPassword);

// Endpoints autenticados (JWT Bearer)
router.get('/me', verificarToken, authController.getMe);
router.put('/perfil', verificarToken, authController.updatePerfil);
router.put('/password', verificarToken, authController.cambiarPassword);

module.exports = router;
