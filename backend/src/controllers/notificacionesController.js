/**
 * @file controllers/notificacionesController.js
 * @description Controlador para visualización y auditoría de notificaciones.
 * Permite al Administrador inspeccionar la bandeja de correos simulados (bandeja_simulada)
 * y la bitácora inmutable de eventos multicanal (notificaciones_logs).
 * ChocoTi-Digital | Capa 1: Controladores y Seguridad HTTP
 */

'use strict';

const EmailAdapter = require('../adapters/emailAdapter');
const WhatsAppAdapter = require('../adapters/whatsappAdapter');
const NotificacionesService = require('../services/notificacionesService');

class NotificacionesController {
  /**
   * Lista los correos simulados en la base de datos (Exclusivo Administrador).
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   * @param {import('express').NextFunction} next
   */
  static listarBandejaSimulada(req, res, next) {
    try {
      const limite = Math.min(Number(req.query.limite) || 50, 100);
      const offset = Number(req.query.offset) || 0;

      const correos = EmailAdapter.obtenerBandejaSimulada(limite, offset);
      const total = EmailAdapter.contarBandejaSimulada();

      return res.status(200).json({
        ok: true,
        total,
        limite,
        offset,
        data: correos,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Obtiene el contenido completo de un correo simulado específico por su ID (Exclusivo Administrador).
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   * @param {import('express').NextFunction} next
   */
  static obtenerCorreoSimulado(req, res, next) {
    try {
      const id = Number(req.params.id);
      const correo = EmailAdapter.obtenerBandejaPorId(id);

      if (!correo) {
        return res.status(404).json({ ok: false, mensaje: 'Correo no encontrado en la bandeja simulada.' });
      }

      return res.status(200).json({
        ok: true,
        data: correo,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Lista la bitácora inmutable de notificaciones (notificaciones_logs) con filtros (Exclusivo Administrador).
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   * @param {import('express').NextFunction} next
   */
  static listarLogs(req, res, next) {
    try {
      const limite = Math.min(Number(req.query.limite) || 50, 100);
      const offset = Number(req.query.offset) || 0;
      const canal = req.query.canal ? String(req.query.canal).toUpperCase() : null;
      const estado = req.query.estado ? String(req.query.estado).toUpperCase() : null;
      const pedidoId = req.query.pedido_id ? Number(req.query.pedido_id) : null;

      const logs = EmailAdapter.obtenerLogsNotificaciones({ limite, offset, canal, estado, pedidoId });
      const total = EmailAdapter.contarLogsNotificaciones({ canal, estado, pedidoId });

      return res.status(200).json({
        ok: true,
        total,
        limite,
        offset,
        data: logs,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Retorna los enlaces directos wa.me y los textos redactados para un pedido (Público / Comprobante).
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   * @param {import('express').NextFunction} next
   */
  static obtenerEnlacesWhatsApp(req, res, next) {
    try {
      const identificador = req.params.identificador;
      const resultado = NotificacionesService.obtenerEnlacesWhatsApp(identificador);

      if (!resultado.ok) {
        return res.status(404).json({ ok: false, mensaje: resultado.error || 'Pedido no encontrado' });
      }

      return res.status(200).json(resultado);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = NotificacionesController;
