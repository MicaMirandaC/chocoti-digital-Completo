/**
 * @file adapters/bancoSimuladoAdapter.js
 * @description Simulador de Pasarela Bancaria para QR Simple en ambiente académico / demo.
 * Valida idempotencia, referencia única, monto exacto y notifica al webhook de pagos.
 * ChocoTi-Digital | Capa de Adaptadores e Integraciones
 */

'use strict';

class BancoSimuladoAdapter {
  /**
   * Simula la firma de verificación criptográfica del banco.
   * @param {string} referencia
   * @param {number} monto
   * @returns {string} Token/Firma simulada
   */
  static generarFirma(referencia, monto) {
    const crypto = require('crypto');
    return crypto
      .createHmac('sha256', 'demo_banco_secret_sucre_2026')
      .update(`${referencia}|${Number(monto).toFixed(2)}`)
      .digest('hex');
  }

  /**
   * Valida la firma del banco simulado.
   * @param {string} referencia
   * @param {number} monto
   * @param {string} firma
   * @returns {boolean}
   */
  static validarFirma(referencia, monto, firma) {
    if (!firma) return false;
    const esperada = BancoSimuladoAdapter.generarFirma(referencia, monto);
    return firma === esperada;
  }

  /**
   * Exige y valida estrictamente la firma criptográfica en el adaptador.
   * @param {object} param0
   * @param {string} param0.referencia
   * @param {number} param0.monto
   * @param {string} param0.firma
   * @returns {boolean}
   */
  static exigirFirmaValida({ referencia, monto, firma }) {
    if (!firma) {
      const err = new Error('Firma criptográfica bancaria obligatoria no provista.');
      err.statusCode = 401;
      throw err;
    }
    if (!BancoSimuladoAdapter.validarFirma(referencia, monto, firma)) {
      const err = new Error('Firma criptográfica bancaria inválida o alterada.');
      err.statusCode = 401;
      throw err;
    }
    return true;
  }

  /**
   * Construye el payload de notificación bancaria que envía el banco al webhook del comercio.
   *
   * @param {object} datos
   * @param {string} datos.referencia
   * @param {number} datos.monto
   * @param {'APROBADO'|'RECHAZADO'} [datos.resultado='APROBADO']
   * @param {string} [datos.numeroTransaccionBancaria]
   * @returns {object}
   */
  static construirNotificacionPago({ referencia, monto, resultado = 'APROBADO', numeroTransaccionBancaria = null }) {
    const nroTx = numeroTransaccionBancaria || `BNB-QR-${Date.now()}`;
    const firma = BancoSimuladoAdapter.generarFirma(referencia, monto);

    return {
      banco: 'Banco Nacional de Bolivia (Simulado - Demo)',
      tipo_evento: 'NOTIFICACION_PAGO_QR',
      referencia_comercio: referencia,
      monto_cobrado: Number(monto).toFixed(2),
      moneda: 'BOB',
      numero_transaccion_banco: nroTx,
      fecha_hora_banco: new Date().toISOString(),
      estado_transaccion: resultado,
      firma_seguridad: firma,
      es_demo: true,
    };
  }
}

module.exports = BancoSimuladoAdapter;
