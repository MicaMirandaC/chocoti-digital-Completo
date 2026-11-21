/**
 * @file services/pagosService.js
 * @description Gestión de pasarelas de pago: QR Simple, Depósito Bancario con verificación
 * de comprobante (máx 2MB) y Cobro en Efectivo en Agencias Propias.
 * ChocoTi-Digital | Capa 2: Servicios de Negocio
 */

'use strict';

const fs = require('fs');
const path = require('path');
const db = require('../config/database');
const PagoIntento = require('../models/PagoIntento');
const Pedido = require('../models/Pedido');
const ReservaStock = require('../models/ReservaStock');
const PedidosService = require('./pedidosService');
const BancoSimuladoAdapter = require('../adapters/bancoSimuladoAdapter');

class PagosService {
  /**
   * Consulta el estado en tiempo real de un intento de pago (usado para polling en QR y depósito).
   *
   * @param {string} referencia
   * @returns {object}
   */
  static consultarEstadoPago(referencia) {
    // 1. Limpiar reservas expiradas antes de consultar
    ReservaStock.limpiarExpiradas();

    const intento = PagoIntento.findByReferencia(referencia);
    if (!intento) {
      const err = new Error(`Referencia de pago '${referencia}' no encontrada.`);
      err.statusCode = 404;
      throw err;
    }

    const pedido = Pedido.findById(intento.pedido_id);

    return {
      referencia: intento.referencia_externa,
      proveedor: intento.proveedor,
      estado_pago: intento.estado,
      monto_bob: intento.monto_bob,
      expira_en: intento.expira_en,
      comprobante_url: intento.comprobante_url,
      motivo_rechazo: intento.motivo_rechazo,
      pedido: {
        id: pedido.id,
        codigo_pedido: pedido.codigo_pedido,
        estado_pedido: pedido.estado_pedido,
        total: pedido.total,
        tipo_entrega: pedido.tipo_entrega,
        guia_envio: pedido.guia_envio,
        codigo_retiro: pedido.codigo_retiro,
      },
    };
  }

  /**
   * Procesa la subida y validación del comprobante de transferencia bancaria.
   * Valida tipo de archivo, tamaño máximo (2 MB), número de operación no duplicado.
   *
   * @param {object} params
   * @param {number} params.pedidoId
   * @param {string} params.archivoBase64 - Archivo codificado en Base64 (con o sin prefijo data:image/...)
   * @param {string} params.nombreArchivo
   * @param {string} params.tipoMime
   * @param {string} params.bancoOrigen
   * @param {string} params.numeroOperacion
   * @param {string} params.fechaOperacion
   * @returns {object} Resultado con URL pública del comprobante
   */
  static subirComprobanteDeposito({
    pedidoId,
    archivoBase64,
    nombreArchivo,
    tipoMime,
    bancoOrigen,
    numeroOperacion,
    fechaOperacion,
    montoDeclarado,
  }) {
    const pedido = Pedido.findById(pedidoId);
    if (!pedido) {
      const err = new Error('Pedido no encontrado.');
      err.statusCode = 404;
      throw err;
    }

    if (pedido.metodo_pago !== 'TRANSFERENCIA') {
      const err = new Error('El pedido especificado no requiere comprobante de transferencia bancaria.');
      err.statusCode = 400;
      throw err;
    }

    if (pedido.estado_pedido === 'PAGADO') {
      const err = new Error('Este pedido ya se encuentra pagado y confirmado.');
      err.statusCode = 400;
      throw err;
    }

    if (pedido.estado_pedido === 'EXPIRADO' || pedido.estado_pedido === 'CANCELADO') {
      const err = new Error('El plazo de reserva para este pedido ha expirado. Por favor, realice un nuevo pedido.');
      err.statusCode = 400;
      throw err;
    }

    // 1. Validar que el número de operación no haya sido usado previamente
    if (PagoIntento.existeNumeroOperacion(numeroOperacion, pedidoId)) {
      const err = new Error(`El número de operación bancaria '${numeroOperacion}' ya fue registrado previamente en otro pago.`);
      err.statusCode = 409;
      throw err;
    }

    // 2. Validar formato MIME y peso
    const mimesValidos = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!tipoMime || !mimesValidos.includes(tipoMime.toLowerCase())) {
      const err = new Error('Formato de comprobante no válido. Se permiten exclusivamente imágenes (JPG, PNG, WebP) o documentos PDF.');
      err.statusCode = 400;
      throw err;
    }

    // Extraer datos base64 limpios
    let base64Limpio = archivoBase64;
    if (base64Limpio.includes(',')) {
      base64Limpio = base64Limpio.split(',')[1];
    }

    const buffer = Buffer.from(base64Limpio, 'base64');
    const MAX_SIZE = 2 * 1024 * 1024; // 2 MB límite estricto

    if (buffer.length > MAX_SIZE) {
      const err = new Error(`El archivo excede el tamaño máximo permitido de 2 MB (tamaño actual: ${(buffer.length / (1024 * 1024)).toFixed(2)} MB).`);
      err.statusCode = 400;
      throw err;
    }

    // 3. Guardar archivo en disco
    const extensiones = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp',
      'application/pdf': '.pdf',
    };
    const ext = extensiones[tipoMime.toLowerCase()] || path.extname(nombreArchivo) || '.bin';
    const uploadsDir = path.resolve(__dirname, '../../../uploads/comprobantes');

    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const nombreFinal = `comp_ped_${pedidoId}_${Date.now()}${ext}`;
    const rutaAbsoluta = path.join(uploadsDir, nombreFinal);
    fs.writeFileSync(rutaAbsoluta, buffer);

    const comprobanteUrl = `/uploads/comprobantes/${nombreFinal}`;

    // 4. Actualizar registro en base de datos
    PagoIntento.registrarComprobante(pedidoId, {
      comprobante_url: comprobanteUrl,
      banco_origen: bancoOrigen || 'No especificado',
      fecha_operacion: fechaOperacion || new Date().toISOString().split('T')[0],
      numero_operacion: numeroOperacion,
      monto_declarado: Number(montoDeclarado),
    });

    return {
      ok: true,
      mensaje: 'Comprobante bancario subido correctamente. En espera de verificación por personal de almacén.',
      comprobante_url: comprobanteUrl,
      numero_operacion: numeroOperacion,
      monto_declarado: Number(montoDeclarado),
    };
  }

  /**
   * Verificación manual de depósito bancario realizada por Administrador u Operador de Almacén.
   *
   * @param {object} params
   * @param {number} params.intentoId
   * @param {boolean} params.aprobado
   * @param {string|null} [params.motivoRechazo=null]
   * @param {object} params.usuarioAuth
   * @returns {object}
   */
  static verificarDeposito({ intentoId, aprobado, motivoRechazo = null, usuarioAuth }) {
    ReservaStock.limpiarExpiradas();

    const intento = db.prepare('SELECT * FROM pagos_intentos WHERE id = ?').get(intentoId);
    if (!intento) {
      const err = new Error('Intento de pago no encontrado.');
      err.statusCode = 404;
      throw err;
    }

    const pedido = Pedido.findById(intento.pedido_id);
    if (!pedido) {
      const err = new Error('Pedido asociado no encontrado.');
      err.statusCode = 404;
      throw err;
    }

    if (pedido.estado_pedido === 'EXPIRADO' || pedido.estado_pedido === 'CANCELADO') {
      const err = new Error(`El plazo de reserva para este pedido ha expirado (Estado: ${pedido.estado_pedido}).`);
      err.statusCode = 400;
      throw err;
    }

    // Restricción RBAC: Operador solo puede verificar pedidos de su propio almacén
    if (usuarioAuth.rol === 'OPERADOR_ALMACEN' && Number(usuarioAuth.almacen_id) !== Number(pedido.almacen_id)) {
      const err = new Error('Acceso denegado. Solo puede verificar pagos de pedidos asignados a su sucursal.');
      err.statusCode = 403;
      throw err;
    }

    const montoDeclarado = intento.monto_declarado !== null && intento.monto_declarado !== undefined
      ? Number(intento.monto_declarado)
      : Number(intento.monto_bob);
    const totalPedido = Number(pedido.total);
    const diferencia = Number(Math.abs(montoDeclarado - totalPedido).toFixed(2));

    if (aprobado) {
      if (Math.abs(montoDeclarado - totalPedido) > 0.009) {
        const err = new Error(
          `No se puede aprobar el depósito: el monto declarado (Bs. ${montoDeclarado.toFixed(2)}) no coincide con el total del pedido (Bs. ${totalPedido.toFixed(2)}). Diferencia: Bs. ${diferencia.toFixed(2)}. Solo se permite rechazar con motivo.`
        );
        err.statusCode = 400;
        err.diferencia = diferencia;
        throw err;
      }

      return PedidosService.confirmarPago({
        pedidoId: pedido.id,
        proveedor: 'DEPOSITO_BANCARIO',
        transaccionRef: intento.numero_operacion || intento.referencia_externa,
        montoCobrado: pedido.total,
        datosProveedor: {
          banco_origen: intento.banco_origen,
          numero_operacion: intento.numero_operacion,
          fecha_operacion: intento.fecha_operacion,
          comprobante_url: intento.comprobante_url,
          verificado_por: usuarioAuth.email,
        },
        usuarioId: usuarioAuth.id,
        rol: usuarioAuth.rol,
      });
    } else {
      if (!motivoRechazo || !motivoRechazo.trim()) {
        const err = new Error('Debe proporcionar un motivo de rechazo claro para notificar al cliente.');
        err.statusCode = 400;
        throw err;
      }

      PagoIntento.actualizarEstado(
        intentoId,
        'RECHAZADO',
        {
          motivo_rechazo: motivoRechazo,
          verificado_por_id: usuarioAuth.id,
          fecha_verificacion: new Date().toISOString(),
        },
        db
      );

      // Se registra la incidencia en el historial del pedido
      db.prepare(`
        INSERT INTO pedido_historial_estados (pedido_id, estado_anterior, estado_nuevo, usuario_id, rol_transicion, motivo, comentario)
        VALUES (?, ?, ?, ?, ?, 'DEPOSITO_RECHAZADO', ?)
      `).run(
        pedido.id,
        pedido.estado_pedido,
        pedido.estado_pedido,
        usuarioAuth.id,
        usuarioAuth.rol,
        `Comprobante de depósito rechazado: ${motivoRechazo}. El cliente puede cargar un nuevo comprobante dentro del plazo de 24h.`
      );

      return {
        ok: true,
        mensaje: 'Depósito rechazado. Se ha notificado la observación.',
        motivo_rechazo: motivoRechazo,
      };
    }
  }

  /**
   * Registra el cobro en efectivo en tienda (caja física de la sucursal propia).
   *
   * @param {object} params
   * @param {number} params.pedidoId
   * @param {number} params.montoRecibido
   * @param {object} params.usuarioAuth
   * @returns {object}
   */
  static cobroEfectivoTienda({ pedidoId, montoRecibido, usuarioAuth }) {
    ReservaStock.limpiarExpiradas();

    const pedido = Pedido.findById(pedidoId);
    if (!pedido) {
      const err = new Error('Pedido no encontrado.');
      err.statusCode = 404;
      throw err;
    }

    if (pedido.estado_pedido === 'EXPIRADO' || pedido.estado_pedido === 'CANCELADO') {
      const err = new Error(`El plazo de reserva de 48h para este pedido ha expirado (Estado: ${pedido.estado_pedido}).`);
      err.statusCode = 400;
      throw err;
    }

    if (pedido.metodo_pago !== 'EFECTIVO_TIENDA') {
      const err = new Error('Este pedido no fue registrado con la modalidad de pago en efectivo en tienda.');
      err.statusCode = 400;
      throw err;
    }

    // RBAC: Operador solo cobra en su almacén
    if (usuarioAuth.rol === 'OPERADOR_ALMACEN' && Number(usuarioAuth.almacen_id) !== Number(pedido.almacen_id)) {
      const err = new Error('Acceso denegado. Solo puede registrar cobros en su almacén asignado.');
      err.statusCode = 403;
      throw err;
    }

    if (Number(montoRecibido) < Number(pedido.total)) {
      const err = new Error(`El monto recibido (Bs. ${montoRecibido}) es menor al total del pedido (Bs. ${pedido.total}).`);
      err.statusCode = 400;
      throw err;
    }

    const refCobro = `EFE-CAJA-${pedidoId}-${Date.now()}`;

    return PedidosService.confirmarPago({
      pedidoId: pedido.id,
      proveedor: 'EFECTIVO_TIENDA',
      transaccionRef: refCobro,
      montoCobrado: pedido.total,
      datosProveedor: {
        monto_recibido: Number(montoRecibido),
        cambio_entregado: Number((montoRecibido - pedido.total).toFixed(2)),
        cobrado_por: usuarioAuth.email,
        almacen_id: pedido.almacen_id,
      },
      usuarioId: usuarioAuth.id,
      rol: usuarioAuth.rol,
    });
  }

  /**
   * Procesa la notificación simulada del banco (Webhook de prueba para QR Simple).
   *
   * @param {object} datos
   * @param {string} datos.referencia
   * @param {number} datos.monto
   * @param {'APROBADO'|'RECHAZADO'} [datos.estado='APROBADO']
   * @returns {object}
   */
  static procesarNotificacionBancoDemo({ referencia, monto, estado = 'APROBADO', firma = null, usuarioAuth = null }) {
    const intento = PagoIntento.findByReferencia(referencia);
    if (!intento) {
      const err = new Error(`Referencia bancaria '${referencia}' no existe.`);
      err.statusCode = 404;
      throw err;
    }

    const pedido = Pedido.findById(intento.pedido_id);
    if (!pedido) {
      const err = new Error('Pedido asociado no encontrado.');
      err.statusCode = 404;
      throw err;
    }

    // Exigir sesión del dueño del pedido (o admin) O firma HMAC válida del servidor
    const firmaValida = firma ? BancoSimuladoAdapter.validarFirma(referencia, monto, firma) : false;
    const esDuenio = usuarioAuth && (
      usuarioAuth.rol === 'ADMINISTRADOR' ||
      (pedido.usuario_id && Number(usuarioAuth.id) === Number(pedido.usuario_id))
    );

    if (!firmaValida && !esDuenio) {
      const err = new Error('No autorizado: Se requiere la sesión del dueño del pedido o una firma HMAC generada por el servidor.');
      err.statusCode = 401;
      throw err;
    }

    // El adaptador bancario exige y valida la firma si la notificación proviene del banco
    if (firma) {
      BancoSimuladoAdapter.exigirFirmaValida({ referencia, monto, firma });
    }

    // Validar monto
    if (Number(monto).toFixed(2) !== Number(pedido.total).toFixed(2)) {
      const err = new Error(`Monto de la notificación (Bs. ${monto}) no coincide con el total del pedido (Bs. ${pedido.total}).`);
      err.statusCode = 400;
      throw err;
    }

    if (estado === 'APROBADO') {
      const txRef = `BNB-TX-${Date.now()}`;
      return PedidosService.confirmarPago({
        pedidoId: pedido.id,
        proveedor: 'QR_SIMPLE',
        transaccionRef: txRef,
        montoCobrado: pedido.total,
        datosProveedor: {
          banco: 'Banco Simulado Demo',
          referencia_banco: txRef,
          fecha: new Date().toISOString(),
        },
      });
    } else {
      PagoIntento.actualizarEstado(intento.id, 'RECHAZADO', { motivo_rechazo: 'Pago rechazado por el banco simulado.' });
      return PedidosService.cancelarPedido(pedido.id, 'Pago QR rechazado por la entidad bancaria simulada.');
    }
  }

  // ─────────────────────────────────────────────────────────────
  //  FASE 5B: PAYPAL (Orders v2 Sandbox)
  // ─────────────────────────────────────────────────────────────

  /**
   * Registra un intento de pago PayPal en la tabla pagos_intentos.
   * Llamado por el controlador justo después de crear la orden en PayPal.
   *
   * @param {object} params
   * @param {number} params.pedido_id
   * @param {string} params.referencia_externa  - PayPal orderId
   * @param {number} params.monto_usd
   * @param {number} params.monto_bob
   * @param {string} [params.datos_proveedor_json]
   * @returns {object} Intento creado
   */
  static registrarIntentoPago({ pedido_id, referencia_externa, monto_usd, monto_bob, datos_proveedor_json }) {
    // Idempotencia: si ya existe un intento PENDIENTE para este orderId exacto, no duplicar
    const existente = PagoIntento.findByReferencia(referencia_externa);
    if (existente) return existente;

    // Si ya existe un intento PAYPAL PENDIENTE para este pedido (creado por pedidosService
    // con una referencia provisional), actualizarlo con el orderId real de PayPal
    const intentoPrevio = db.prepare(`
      SELECT * FROM pagos_intentos
      WHERE pedido_id = ? AND proveedor = 'PAYPAL' AND estado = 'PENDIENTE'
      ORDER BY id DESC LIMIT 1
    `).get(pedido_id);

    if (intentoPrevio) {
      // Actualizar la referencia provisional con el orderId real de PayPal
      db.prepare(`
        UPDATE pagos_intentos
        SET referencia_externa = ?,
            monto_usd = ?,
            datos_proveedor_json = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(
        referencia_externa,
        monto_usd,
        datos_proveedor_json || intentoPrevio.datos_proveedor_json,
        intentoPrevio.id
      );
      return db.prepare('SELECT * FROM pagos_intentos WHERE id = ?').get(intentoPrevio.id);
    }

    const tipoCambio = Number(process.env.TIPO_CAMBIO_USD || 6.96);

    return PagoIntento.crear({
      pedido_id,
      proveedor: 'PAYPAL',
      referencia_externa,
      monto_bob,
      monto_usd,
      tipo_cambio: tipoCambio,
      datos_proveedor_json: datos_proveedor_json || null,
      expira_en: null,
    });
  }

  /**
   * Confirma el pago PayPal tras la captura exitosa de la orden.
   * Verifica idempotencia (evita doble confirmación), valida el monto
   * capturado por PayPal y delega la confirmación al servicio de pedidos.
   *
   * @param {object} params
   * @param {number} params.pedidoId
   * @param {string} params.orderId          - PayPal orderId
   * @param {object} params.captureData      - Respuesta completa de PayPal /capture
   * @returns {object}
   */
  static confirmarPagoPayPal({ pedidoId, orderId, captureData }) {
    // 1. Limpiar reservas expiradas
    ReservaStock.limpiarExpiradas();

    // 2. Buscar el pedido
    const pedido = Pedido.findById(pedidoId);
    if (!pedido) {
      const err = new Error('Pedido no encontrado.');
      err.statusCode = 404;
      throw err;
    }

    // 3. Idempotencia: si ya está pagado, retornar el estado actual sin procesar de nuevo
    if (pedido.estado_pedido === 'PAGADO' || pedido.estado_pedido === 'FINALIZADO') {
      return { ok: true, mensaje: 'El pedido ya fue confirmado anteriormente.', pedido };
    }

    // 4. Buscar el intento de pago PayPal vinculado a este orderId
    const intento = PagoIntento.findByReferencia(orderId);
    if (!intento) {
      const err = new Error(`Intento de pago PayPal con orderId '${orderId}' no encontrado.`);
      err.statusCode = 404;
      throw err;
    }

    if (Number(intento.pedido_id) !== Number(pedidoId)) {
      const err = new Error('El orderId de PayPal no corresponde al pedido indicado.');
      err.statusCode = 400;
      throw err;
    }

    // 5. Verificar que PayPal reporta status COMPLETED
    if (captureData.status !== 'COMPLETED') {
      const err = new Error(`La captura de PayPal no fue completada. Estado recibido: ${captureData.status}`);
      err.statusCode = 400;
      throw err;
    }

    // 6. Validar el monto capturado por PayPal contra lo registrado
    //    La captura puede tener múltiples purchase_units; tomamos la primera
    const captureMonto = captureData.purchase_units?.[0]?.payments?.captures?.[0]?.amount?.value;
    const captureMoneda = captureData.purchase_units?.[0]?.payments?.captures?.[0]?.amount?.currency_code;
    const captureId = captureData.purchase_units?.[0]?.payments?.captures?.[0]?.id;

    if (!captureMonto || captureMoneda !== 'USD') {
      const err = new Error('No se pudo verificar el monto capturado en USD desde la respuesta de PayPal.');
      err.statusCode = 400;
      throw err;
    }

    const montoCapturadoUSD = Number(captureMonto);
    const montoEsperadoUSD  = Number(intento.monto_usd);

    // Tolerancia de ±$0.02 USD por redondeos de tipo de cambio
    if (Math.abs(montoCapturadoUSD - montoEsperadoUSD) > 0.02) {
      const err = new Error(
        `Discrepancia de monto: PayPal capturó $${montoCapturadoUSD} USD pero se esperaban $${montoEsperadoUSD} USD.`
      );
      err.statusCode = 400;
      throw err;
    }

    // 7. Actualizar datos del intento con el captureId real de PayPal
    PagoIntento.actualizarEstado(intento.id, 'PAGADO', {
      datos_proveedor_json: JSON.stringify({
        orderId,
        captureId: captureId || null,
        montoCapturadoUSD,
        moneda: captureMoneda,
        captureData,
      }),
    });

    // 8. Confirmar el pago en el sistema (transición de estado, stock y guía)
    return PedidosService.confirmarPago({
      pedidoId,
      proveedor: 'PAYPAL',
      transaccionRef: captureId || orderId,
      montoCobrado: pedido.total,
      datosProveedor: {
        paypal_order_id: orderId,
        paypal_capture_id: captureId || null,
        monto_usd: montoCapturadoUSD,
        monto_bob: pedido.total,
        tipo_cambio_usado: Number(process.env.TIPO_CAMBIO_USD || 6.96),
      },
      usuarioId: null,
      rol: 'SISTEMA',
    });
  }
}

module.exports = PagosService;
