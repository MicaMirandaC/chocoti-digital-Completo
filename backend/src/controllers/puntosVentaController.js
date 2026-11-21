/**
 * @file controllers/puntosVentaController.js
 * @description Controlador para consulta de puntos de venta y agencias autorizadas de recojo.
 * ChocoTi-Digital | Capa 1: Controladores y Seguridad HTTP
 */

'use strict';

const PuntoVenta = require('../models/PuntoVenta');

class PuntosVentaController {
  /**
   * Obtiene la lista exclusiva de agencias propias (tipo P) que permiten recojo de pedidos en tienda.
   * Por especificación: agencias oficiales de Sucre y La Paz con dirección física escrita.
   *
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   * @param {import('express').NextFunction} next
   */
  static obtenerAgenciasPropias(req, res, next) {
    try {
      const agencias = PuntoVenta.obtenerAgenciasPropias();
      return res.status(200).json({
        ok: true,
        total: agencias.length,
        data: agencias,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Lista todos los puntos de venta con filtros opcionales de ciudad y tipo (P, A, C).
   *
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   * @param {import('express').NextFunction} next
   */
  static listar(req, res, next) {
    try {
      const { ciudad, tipo } = req.query;
      const puntos = PuntoVenta.findAll({ ciudad, tipo });
      return res.status(200).json({
        ok: true,
        total: puntos.length,
        data: puntos,
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = PuntosVentaController;
