/**
 * @file routes/notificacionesRoutes.js
 * @description Enrutador para consulta de bandeja simulada, logs de auditoría y WhatsApp.
 * ChocoTi-Digital | Capa 1: Presentación y Enrutamiento
 */

'use strict';

const express = require('express');
const router = express.Router();
const NotificacionesController = require('../controllers/notificacionesController');
const { verificarToken, soloAdmin } = require('../middleware/authMiddleware');

// Consulta de enlaces directos wa.me para un pedido (Público, para vista de éxito o seguimiento)
router.get('/whatsapp/:identificador', NotificacionesController.obtenerEnlacesWhatsApp);

// Rutas protegidas exclusivas para el Administrador
router.get('/bandeja-simulada', verificarToken, soloAdmin, NotificacionesController.listarBandejaSimulada);
router.get('/bandeja-simulada/:id', verificarToken, soloAdmin, NotificacionesController.obtenerCorreoSimulado);
router.get('/logs', verificarToken, soloAdmin, NotificacionesController.listarLogs);

module.exports = router;
