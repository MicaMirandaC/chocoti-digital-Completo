/**
 * @file controllers/pagosController.js
 * @description Controlador para procesamiento de pagos QR Simple, Depósito Bancario
 * y Cobro en Efectivo en Agencias Propias.
 * ChocoTi-Digital | Capa 1: Controladores y Seguridad HTTP
 */

'use strict';

const PagosService = require('../services/pagosService');

class PagosController {
  /**
   * Consulta el estado del intento de pago (usado para polling en el frontend).
   *
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   * @param {import('express').NextFunction} next
   */
  static consultarEstado(req, res, next) {
    try {
      const { referencia } = req.params;
      const estado = PagosService.consultarEstadoPago(referencia);
      return res.status(200).json({
        ok: true,
        data: estado,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Sube el comprobante de transferencia bancaria (imagen o PDF, máx 2MB) codificado en Base64.
   *
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   * @param {import('express').NextFunction} next
   */
  static subirComprobante(req, res, next) {
    try {
      const {
        pedido_id,
        archivo_base64,
        nombre_archivo,
        tipo_mime,
        banco_origen,
        numero_operacion,
        fecha_operacion,
        monto,
      } = req.body;

      if (!pedido_id || !archivo_base64 || !numero_operacion || !banco_origen || !fecha_operacion || monto === undefined || monto === null) {
        return res.status(400).json({
          ok: false,
          mensaje: 'Se requiere banco, monto, fecha de depósito, número de operación y comprobante digital.',
        });
      }

      const montoNum = Number(monto);
      if (isNaN(montoNum) || montoNum <= 0) {
        return res.status(400).json({
          ok: false,
          mensaje: 'El monto declarado debe ser un número válido mayor a cero.',
        });
      }

      const resultado = PagosService.subirComprobanteDeposito({
        pedidoId: Number(pedido_id),
        archivoBase64: archivo_base64,
        nombreArchivo: nombre_archivo || 'comprobante.jpg',
        tipoMime: tipo_mime || 'image/jpeg',
        bancoOrigen: String(banco_origen).trim(),
        numeroOperacion: String(numero_operacion).trim(),
        fechaOperacion: String(fecha_operacion).trim(),
        montoDeclarado: montoNum,
      });

      return res.status(200).json(resultado);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Verificación y aprobación/rechazo de comprobante bancario por Administrador u Operador.
   *
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   * @param {import('express').NextFunction} next
   */
  static verificarDeposito(req, res, next) {
    try {
      const { intento_id, aprobado, motivo_rechazo } = req.body;

      if (!intento_id || aprobado === undefined) {
        return res.status(400).json({
          ok: false,
          mensaje: 'Parámetros intento_id y aprobado son requeridos.',
        });
      }

      const resultado = PagosService.verificarDeposito({
        intentoId: Number(intento_id),
        aprobado: Boolean(aprobado),
        motivoRechazo: motivo_rechazo || null,
        usuarioAuth: req.usuario,
      });

      return res.status(200).json(resultado);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Registro de cobro en efectivo en mostrador de agencia propia por Operador o Administrador.
   *
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   * @param {import('express').NextFunction} next
   */
  static cobroEfectivoTienda(req, res, next) {
    try {
      const { pedido_id, monto_recibido } = req.body;

      if (!pedido_id || monto_recibido === undefined) {
        return res.status(400).json({
          ok: false,
          mensaje: 'Parámetros pedido_id y monto_recibido son requeridos.',
        });
      }

      const resultado = PagosService.cobroEfectivoTienda({
        pedidoId: Number(pedido_id),
        montoRecibido: Number(monto_recibido),
        usuarioAuth: req.usuario,
      });

      return res.status(200).json(resultado);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Endpoint de simulación bancaria para QR Simple (Webhook simulado para la demo académica).
   *
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   * @param {import('express').NextFunction} next
   */
  static notificarBancoDemo(req, res, next) {
    try {
      if (process.env.ENABLE_BANK_SIMULATOR !== 'true') {
        return res.status(403).json({
          ok: false,
          mensaje: 'El simulador bancario está deshabilitado (se requiere ENABLE_BANK_SIMULATOR=true).',
        });
      }

      const { referencia, monto, estado, firma, firma_seguridad } = req.body;
      const firmaEnviada = req.headers['x-signature'] || req.headers['x-banco-firma'] || firma || firma_seguridad;

      if (!referencia || monto === undefined) {
        return res.status(400).json({
          ok: false,
          mensaje: 'Se requiere referencia y monto en la notificación bancaria.',
        });
      }

      let usuarioAuth = req.usuario || null;
      if (!usuarioAuth && req.headers['authorization']) {
        const partes = req.headers['authorization'].trim().split(' ');
        if (partes.length === 2 && partes[0].toLowerCase() === 'bearer') {
          try {
            const jwt = require('jsonwebtoken');
            const JWT_SECRET = process.env.JWT_SECRET || 'chocoti_secret_sucre_bolivia_2026';
            usuarioAuth = jwt.verify(partes[1], JWT_SECRET);
          } catch (_e) {}
        }
      }

      const resultado = PagosService.procesarNotificacionBancoDemo({
        referencia,
        monto: Number(monto),
        estado: estado || 'APROBADO',
        firma: firmaEnviada || null,
        usuarioAuth,
      });

      return res.status(200).json({
        ok: true,
        mensaje: 'Notificación bancaria procesada por el webhook demo.',
        ...resultado,
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = PagosController;
