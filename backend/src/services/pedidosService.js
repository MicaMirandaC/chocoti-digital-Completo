/**
 * @file services/pedidosService.js
 * @description Orquestación de lógica de negocio para pedidos, cálculo de fletes,
 * control transaccional de disponibilidad e idempotencia de cobros.
 * ChocoTi-Digital | Capa 2: Servicios de Negocio
 */

'use strict';

const db = require('../config/database');
const Pedido = require('../models/Pedido');
const PagoIntento = require('../models/PagoIntento');
const ReservaStock = require('../models/ReservaStock');
const PuntoVenta = require('../models/PuntoVenta');
const Producto = require('../models/Producto');
const QrAdapter = require('../adapters/qrAdapter');
const BancoSimuladoAdapter = require('../adapters/bancoSimuladoAdapter');
const NotificacionesService = require('./notificacionesService');
const EMPRESA_CONFIG = require('../../../config/empresa');

class PedidosService {
  /**
   * Obtiene un pedido por su ID. Usado por el controlador PayPal para calcular el monto.
   * @param {number} id
   * @returns {object|null}
   */
  static obtenerPedidoPorId(id) {
    return Pedido.findById(Number(id));
  }

  /**
   * Valida stock disponible, calcula montos en servidor, reserva inventario
   * y registra el pedido de manera transaccional.
   *
   * @param {object} params
   * @param {object} params.datosCliente
   * @param {Array<{ id: number, cantidad: number }>} params.items
   * @param {'QR'|'TRANSFERENCIA'|'EFECTIVO_TIENDA'} params.metodoPago
   * @param {'RECOJO_AGENCIA'|'ENVIO_DOMICILIO'} params.tipoEntrega
   * @param {number|null} [params.puntoRecojoId=null]
   * @param {string|null} [params.direccionEnvio=null]
   * @param {string|null} [params.referenciaEnvio=null]
   * @param {string} params.ciudadDestino
   * @param {string|null} [params.cupon=null]
   * @param {string|null} [params.notas=null]
   * @param {object|null} [params.usuarioAuth=null]
   * @returns {Promise<object>} Pedido creado con datos para el pago
   */
  static async crearPedidoCheckout({
    datosCliente,
    items,
    metodoPago,
    tipoEntrega,
    puntoRecojoId = null,
    direccionEnvio = null,
    referenciaEnvio = null,
    ciudadDestino,
    cupon = null,
    notas = null,
    usuarioAuth = null,
  }) {
    // 1. Validaciones básicas de entrada
    if (!datosCliente || !datosCliente.nombre || !datosCliente.ci_nit || !datosCliente.email || !datosCliente.telefono) {
      const err = new Error('Los datos personales del comprador (nombre, CI/NIT, email y teléfono) son obligatorios.');
      err.statusCode = 400;
      throw err;
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      const err = new Error('El carrito no contiene productos válidos.');
      err.statusCode = 400;
      throw err;
    }

    const metodosPermitidos = ['QR', 'TRANSFERENCIA', 'EFECTIVO_TIENDA', 'PAYPAL'];
    if (!metodosPermitidos.includes(metodoPago)) {
      const err = new Error(`Método de pago '${metodoPago}' no admitido en esta fase.`);
      err.statusCode = 400;
      throw err;
    }

    // Validación estricta para EFECTIVO_TIENDA: solo con RECOJO_AGENCIA
    if (metodoPago === 'EFECTIVO_TIENDA' && tipoEntrega !== 'RECOJO_AGENCIA') {
      const err = new Error('El pago en efectivo en tienda solo está disponible seleccionando "Recoger en agencia".');
      err.statusCode = 400;
      throw err;
    }

    // 2. Determinar almacén de despacho y validar punto de recojo
    let almacenId = 1; // Planta Central Sucre por defecto
    let agenciaElegida = null;

    if (tipoEntrega === 'RECOJO_AGENCIA') {
      if (!puntoRecojoId) {
        const err = new Error('Debe seleccionar una agencia propia autorizada para el recojo.');
        err.statusCode = 400;
        throw err;
      }

      agenciaElegida = PuntoVenta.findById(puntoRecojoId);
      if (!agenciaElegida || agenciaElegida.tipo !== 'P' || !agenciaElegida.permite_recojo) {
        const err = new Error('La sucursal seleccionada no es una agencia propia habilitada para entrega de pedidos.');
        err.statusCode = 400;
        throw err;
      }

      // Si la agencia es de La Paz, se despacha desde Almacén 2 (Agencia La Paz)
      if (agenciaElegida.ciudad.toLowerCase() === 'la paz') {
        almacenId = 2;
      } else {
        almacenId = 1; // Sucre
      }
    } else {
      if (!direccionEnvio || !direccionEnvio.trim()) {
        const err = new Error('Para envío a domicilio se requiere especificar la dirección completa.');
        err.statusCode = 400;
        throw err;
      }
      // Envío nacional: Almacén 1 por defecto (Planta Central Sucre)
      almacenId = 1;
    }

    // 3. Ejecutar transacción atómica de verificación de stock, creación de pedido y reserva
    const resultadoTransaccion = db.transaction(() => {
      // a. Revalidar disponibilidad real en tiempo de servidor (Físico - Reservas)
      const itemsProcesados = [];
      let subtotal = 0;

      for (const item of items) {
        const productoId = Number(item.id || item.producto_id);
        const cantidadSolicitada = parseInt(item.cantidad || item.qty, 10);

        if (!productoId || cantidadSolicitada <= 0) {
          throw new Error('Cantidad inválida para uno de los productos.');
        }

        const producto = Producto.findById(productoId, almacenId);
        if (!producto || !producto.activo) {
          throw new Error(`El producto solicitado (ID ${productoId}) no se encuentra activo en catálogo.`);
        }

        // Consultar stock actual y reservado en el almacén de despacho
        const stockRow = db.prepare(`
          SELECT
            COALESCE(stock_actual, 0) as stock_actual,
            COALESCE(stock_reservado, 0) as stock_reservado
          FROM inventario
          WHERE producto_id = ? AND almacen_id = ?
        `).get(productoId, almacenId);

        const stockActual = stockRow ? stockRow.stock_actual : 0;
        const stockReservado = stockRow ? stockRow.stock_reservado : 0;
        const disponibleReal = stockActual - stockReservado;

        if (cantidadSolicitada > disponibleReal) {
          const err = new Error(
            `Stock insuficiente para "${producto.nombre}". Solicitados: ${cantidadSolicitada}, disponibles: ${Math.max(0, disponibleReal)} en este almacén.`
          );
          err.statusCode = 409; // Conflicto de concurrencia
          throw err;
        }

        const precioUnitario = Number(producto.precio);
        const subtotalItem = Number((precioUnitario * cantidadSolicitada).toFixed(2));
        subtotal += subtotalItem;

        itemsProcesados.push({
          producto_id: productoId,
          sku: producto.sku,
          nombre: producto.nombre,
          precio_unitario: precioUnitario,
          cantidad: cantidadSolicitada,
          subtotal: subtotalItem,
        });
      }

      // b. Cálculo de costos de envío
      let costoEnvio = 0;
      if (tipoEntrega === 'RECOJO_AGENCIA') {
        costoEnvio = 0;
      } else {
        const ciudadNormalizada = (ciudadDestino || '').toLowerCase().trim();
        if (ciudadNormalizada === 'sucre') {
          costoEnvio = EMPRESA_CONFIG.envios.costoSucreLocal || 0;
        } else {
          costoEnvio = EMPRESA_CONFIG.envios.costoNacionalBase || 25;
        }
      }

      // c. Cálculo de descuento (ej. Cupón CHOCOTI10)
      let descuento = 0;
      if (cupon && cupon.trim().toUpperCase() === 'CHOCOTI10') {
        descuento = Number((subtotal * 0.10).toFixed(2));
      }

      const total = Number((subtotal + costoEnvio - descuento).toFixed(2));

      // d. Determinar tiempos de reserva según método de pago
      let minutosReserva = 15;
      let proveedorPago = 'QR_SIMPLE';

      if (metodoPago === 'QR') {
        minutosReserva = QrAdapter.obtenerMinutosVencimiento(); // 15 minutos
        proveedorPago = 'QR_SIMPLE';
      } else if (metodoPago === 'TRANSFERENCIA') {
        minutosReserva = 24 * 60; // 24 horas (1440 minutos)
        proveedorPago = 'DEPOSITO_BANCARIO';
      } else if (metodoPago === 'EFECTIVO_TIENDA') {
        minutosReserva = 48 * 60; // 48 horas (2880 minutos)
        proveedorPago = 'EFECTIVO_TIENDA';
      } else if (metodoPago === 'PAYPAL') {
        minutosReserva = 15; // 15 minutos para PayPal
        proveedorPago = 'PAYPAL';
      }

      // e. Insertar Pedido
      const tipoCambioActual = Number(process.env.TIPO_CAMBIO_USD || 6.96);
      const montoUsdCalculado = Number((total / tipoCambioActual).toFixed(2));

      const pedidoCreado = Pedido.crear(
        {
          usuario_id: usuarioAuth ? usuarioAuth.id : null,
          cliente_nombre: datosCliente.nombre,
          cliente_ci_nit: datosCliente.ci_nit,
          cliente_razon_social: datosCliente.razon_social || null,
          cliente_telefono: datosCliente.telefono,
          cliente_email: datosCliente.email,
          tipo_entrega: tipoEntrega,
          punto_recojo_id: puntoRecojoId,
          direccion_envio: direccionEnvio,
          referencia_envio: referenciaEnvio,
          ciudad_destino: ciudadDestino,
          almacen_id: almacenId,
          metodo_pago: metodoPago,
          estado_pago: 'PENDIENTE',
          estado_pedido: 'PENDIENTE_PAGO',
          subtotal,
          costo_envio: costoEnvio,
          descuento,
          total,
          monto_usd: metodoPago === 'PAYPAL' ? montoUsdCalculado : null,
          tipo_cambio_usd: tipoCambioActual,
          notas,
        },
        itemsProcesados,
        db
      );

      // f. Crear reserva de inventario temporal
      ReservaStock.crearReservas(pedidoCreado.id, itemsProcesados, almacenId, minutosReserva, db);

      // g. Generar datos específicos del pago
      let datosPagoRetorno = {};

      if (metodoPago === 'QR') {
        const referenciaQR = QrAdapter.generarReferencia(pedidoCreado.id);
        const vencimientoISO = new Date(Date.now() + minutosReserva * 60 * 1000).toISOString();
        const payloadQR = QrAdapter.generarPayloadQR({
          referencia: referenciaQR,
          monto: total,
          codigoPedido: pedidoCreado.codigo_pedido,
          vencimiento: vencimientoISO,
        });

        // Registrar intento de pago
        PagoIntento.crear(
          {
            pedido_id: pedidoCreado.id,
            proveedor: 'QR_SIMPLE',
            referencia_externa: referenciaQR,
            monto_bob: total,
            expira_en: db.prepare("SELECT datetime('now', '+' || ? || ' minutes') as exp").get(minutosReserva).exp,
            datos_proveedor_json: payloadQR,
          },
          db
        );

        datosPagoRetorno = {
          referencia: referenciaQR,
          monto: total,
          vencimiento: vencimientoISO,
          minutosReserva,
          payloadQR,
          firmaDemo: BancoSimuladoAdapter.generarFirma(referenciaQR, total),
        };
      } else if (metodoPago === 'TRANSFERENCIA') {
        const refDeposito = `DEP-${pedidoCreado.id}-${Date.now().toString(36).toUpperCase()}`;

        PagoIntento.crear(
          {
            pedido_id: pedidoCreado.id,
            proveedor: 'DEPOSITO_BANCARIO',
            referencia_externa: refDeposito,
            monto_bob: total,
            expira_en: db.prepare("SELECT datetime('now', '+24 hours') as exp").get().exp,
          },
          db
        );

        datosPagoRetorno = {
          referencia: refDeposito,
          monto: total,
          datosBancarios: EMPRESA_CONFIG.datosBancarios,
          horasReserva: 24,
        };
      } else if (metodoPago === 'EFECTIVO_TIENDA') {
        const refEfectivo = `EFE-${pedidoCreado.id}-${Date.now().toString(36).toUpperCase()}`;

        PagoIntento.crear(
          {
            pedido_id: pedidoCreado.id,
            proveedor: 'EFECTIVO_TIENDA',
            referencia_externa: refEfectivo,
            monto_bob: total,
            expira_en: db.prepare("SELECT datetime('now', '+48 hours') as exp").get().exp,
          },
          db
        );

        datosPagoRetorno = {
          referencia: refEfectivo,
          monto: total,
          agencia: agenciaElegida,
          horasReserva: 48,
        };
      } else if (metodoPago === 'PAYPAL') {
        const refPayPal = `PAYPAL-${pedidoCreado.id}-${Date.now().toString(36).toUpperCase()}`;

        PagoIntento.crear(
          {
            pedido_id: pedidoCreado.id,
            proveedor: 'PAYPAL',
            referencia_externa: refPayPal,
            monto_bob: total,
            monto_usd: montoUsdCalculado,
            tipo_cambio: tipoCambioActual,
            expira_en: db.prepare("SELECT datetime('now', '+15 minutes') as exp").get().exp,
          },
          db
        );

        datosPagoRetorno = {
          referencia: refPayPal,
          monto: total,
          montoUSD: montoUsdCalculado,
          tipoCambioUSD: tipoCambioActual,
          minutosReserva: 15,
        };
      }

      return {
        pedido: pedidoCreado,
        datosPago: datosPagoRetorno,
      };
    })();

    // 4. Si es QR, generar la imagen de código QR de manera asíncrona
    if (metodoPago === 'QR' && resultadoTransaccion.datosPago.payloadQR) {
      resultadoTransaccion.datosPago.qrImagenDataUrl = await QrAdapter.generarImagenQR(
        resultadoTransaccion.datosPago.payloadQR
      );
    }

    // 5. Notificar al cliente la creación del pedido (instrucciones para métodos diferidos)
    try {
      NotificacionesService.notificarCreacionPedido({
        pedido: resultadoTransaccion.pedido,
        items: itemsProcesados,
        datosPago: resultadoTransaccion.datosPago,
      }).catch((notifAsyncErr) => {
        console.warn('[CHECKOUT] Error asíncrono no bloqueante en notificación:', notifAsyncErr.message);
      });
    } catch (notifErr) {
      console.warn('[CHECKOUT] Error síncrono no bloqueante en notificación de checkout:', notifErr.message);
    }

    return resultadoTransaccion;
  }

  /**
   * Confirma el pago de un pedido de manera idempotente y atómica:
   * - Cambia estado a PAGADO
   * - Convierte reservas en venta y descuenta stock actual
   * - Genera guía de despacho (domicilio) o código de retiro (agencia)
   * - Notifica al cliente (simulada)
   *
   * @param {object} params
   * @param {number} params.pedidoId
   * @param {'QR_SIMPLE'|'DEPOSITO_BANCARIO'|'EFECTIVO_TIENDA'|'PAYPAL'} params.proveedor
   * @param {string} params.transaccionRef
   * @param {number} params.montoCobrado
   * @param {object} [params.datosProveedor={}]
   * @param {number|null} [params.usuarioId=null]
   * @param {string} [params.rol='SISTEMA']
   * @returns {object} Pedido actualizado
   */
  static confirmarPago({
    pedidoId,
    proveedor,
    transaccionRef,
    montoCobrado,
    datosProveedor = {},
    usuarioId = null,
    rol = 'SISTEMA',
  }) {
    return db.transaction(() => {
      const pedido = Pedido.findById(pedidoId);
      if (!pedido) {
        throw new Error(`Pedido ID #${pedidoId} no encontrado.`);
      }

      // Idempotencia estricta: si ya está pagado, retornar sin duplicar descuento
      if (pedido.estado_pago === 'PAGADO') {
        return {
          ok: true,
          mensaje: 'El pedido ya se encontraba pagado previamente (transacción idempotente).',
          pedido,
        };
      }

      if (pedido.estado_pedido === 'EXPIRADO' || pedido.estado_pedido === 'CANCELADO') {
        throw new Error(`No se puede confirmar el pago de un pedido con estado '${pedido.estado_pedido}'.`);
      }

      // 1. Actualizar el intento de pago correspondiente
      const intento = db.prepare(`
        SELECT id FROM pagos_intentos
        WHERE pedido_id = ? AND (proveedor = ? OR referencia_externa = ?)
        ORDER BY id DESC LIMIT 1
      `).get(pedidoId, proveedor, transaccionRef);

      if (intento) {
        PagoIntento.actualizarEstado(
          intento.id,
          'PAGADO',
          {
            datos_proveedor_json: datosProveedor,
            verificado_por_id: usuarioId,
            fecha_verificacion: new Date().toISOString(),
          },
          db
        );
      }

      // 2. Transicionar pedido a PAGADO
      Pedido.actualizarEstado(
        pedidoId,
        'PAGADO',
        usuarioId,
        rol,
        'CONFIRMACION_PAGO',
        `Pago confirmado mediante ${proveedor}. Transacción/Ref: ${transaccionRef}`,
        db
      );
      Pedido.actualizarEstadoPago(pedidoId, 'PAGADO', db);

      // 3. Confirmar reservas de stock: deduce stock_actual, reduce stock_reservado y genera Kardex SALIDA_VENTA
      ReservaStock.confirmarReservas(pedidoId, usuarioId, db);

      // 4. Generar guía de envío o código seguro de retiro
      if (pedido.tipo_entrega === 'ENVIO_DOMICILIO') {
        const guia = Pedido.generarGuiaTransporte(pedido.almacen_id, pedidoId);
        Pedido.registrarDespachoEnvio(
          pedidoId,
          guia,
          'Transporte Expreso Chocolates Para Ti (Demo)',
          pedido.almacen_id,
          db
        );
      } else {
        const codigoRetiro = Pedido.generarCodigoRetiroCorto(pedidoId);
        const limiteRetiro = db.prepare("SELECT datetime('now', '+7 days') as exp").get().exp;
        Pedido.registrarRetiroAgencia(pedidoId, codigoRetiro, pedido.almacen_id, limiteRetiro, db);
      }

      return {
        ok: true,
        mensaje: 'Pago confirmado exitosamente.',
        pedido: Pedido.findById(pedidoId, db),
      };
    })();

    // 5. Disparar notificaciones multicanal completas (Email y WhatsApp)
    // Envuelta en try/catch independiente para nunca bloquear la operación principal
    try {
      NotificacionesService.notificarConfirmacionPago({
        pedidoId,
        transaccionRef,
        proveedor,
        montoCobrado,
      }).catch((asyncNotifErr) => {
        console.warn('[CONFIRMAR-PAGO] Notificación asíncrona error no bloqueante:', asyncNotifErr.message);
      });
    } catch (notifErr) {
      console.warn('[CONFIRMAR-PAGO] Error síncrono no bloqueante en notificación de pago:', notifErr.message);
    }

    return resultadoTransaccion;
  }

  /**
   * Cambia el estado de un pedido y notifica al cliente con aviso multicanal.
   * La notificación está protegida con try/catch para nunca bloquear la operación.
   *
   * @param {object} param
   * @param {number} param.pedidoId
   * @param {string} param.nuevoEstado
   * @param {string} [param.motivo='']
   * @param {string} [param.comentario='']
   * @param {object|null} [param.usuarioAuth=null]
   * @returns {object} Pedido actualizado
   */
  static cambiarEstadoPedido({ pedidoId, nuevoEstado, motivo = '', comentario = '', usuarioAuth = null }) {
    const pedidoActual = Pedido.findById(pedidoId);
    if (!pedidoActual) {
      const err = new Error(`Pedido #${pedidoId} no encontrado.`);
      err.statusCode = 404;
      throw err;
    }

    const estadoAnterior = pedidoActual.estado_pedido;
    const usuarioId = usuarioAuth ? usuarioAuth.id : null;
    const rol = usuarioAuth ? usuarioAuth.rol : 'SISTEMA';

    // 1. Actualizar estado y registrar en pedido_historial_estados
    Pedido.actualizarEstado(pedidoId, nuevoEstado, usuarioId, rol, motivo, comentario, db);

    // Si transiciona a CANCELADO o EXPIRADO y tenía reservas, liberarlas
    if (nuevoEstado === 'CANCELADO' || nuevoEstado === 'EXPIRADO') {
      try {
        ReservaStock.liberarReservas(pedidoId, db);
      } catch (libErr) {
        console.warn(`[PEDIDOS] Error al liberar reservas en ${nuevoEstado}:`, libErr.message);
      }
    }

    // 2. Disparar notificación de cambio de estado (try/catch no bloqueante)
    try {
      NotificacionesService.notificarCambioEstado({
        pedidoId,
        estadoAnterior,
        nuevoEstado,
        usuarioId,
        rol,
        motivo,
        comentario,
      }).catch((asyncErr) => {
        console.warn(`[CAMBIAR-ESTADO] Error asíncrono en notificación (${nuevoEstado}):`, asyncErr.message);
      });
    } catch (notifErr) {
      console.warn(`[CAMBIAR-ESTADO] Error síncrono en notificación (${nuevoEstado}):`, notifErr.message);
    }

    return Pedido.findById(pedidoId, db);
  }

  /**
   * Cancela o expira un pedido, liberando sus reservas de inventario.
   *
   * @param {number} pedidoId
   * @param {string} motivo
   * @param {number|null} [usuarioId=null]
   * @param {string} [rol='SISTEMA']
   * @returns {object}
   */
  static cancelarPedido(pedidoId, motivo, usuarioId = null, rol = 'SISTEMA') {
    const pedidoCancelado = db.transaction(() => {
      const pedido = Pedido.findById(pedidoId);
      if (!pedido) throw new Error('Pedido no encontrado.');

      if (pedido.estado_pedido === 'PAGADO' || pedido.estado_pedido === 'FINALIZADO') {
        throw new Error(`No es posible cancelar un pedido en estado '${pedido.estado_pedido}'.`);
      }

      // Liberar existencias reservadas
      ReservaStock.liberarReservas(pedidoId, db);

      // Actualizar pedido
      Pedido.actualizarEstado(pedidoId, 'CANCELADO', usuarioId, rol, 'CANCELACION', motivo, db);
      Pedido.actualizarEstadoPago(pedidoId, 'RECHAZADO', db);

      // Actualizar intentos de pago
      db.prepare(`
        UPDATE pagos_intentos
        SET estado = 'RECHAZADO', motivo_rechazo = ?, updated_at = CURRENT_TIMESTAMP
        WHERE pedido_id = ? AND estado = 'PENDIENTE'
      `).run(motivo, pedidoId);

      return Pedido.findById(pedidoId, db);
    })();

    // Disparar notificación de cancelación envuelta en try/catch
    try {
      NotificacionesService.notificarCambioEstado({
        pedidoId,
        estadoAnterior: 'PENDIENTE_PAGO',
        nuevoEstado: 'CANCELADO',
        usuarioId,
        rol,
        motivo,
      }).catch((asyncErr) => {
        console.warn('[CANCELAR-PEDIDO] Error asíncrono en notificación:', asyncErr.message);
      });
    } catch (notifErr) {
      console.warn('[CANCELAR-PEDIDO] Error síncrono en notificación de cancelación:', notifErr.message);
    }

    return pedidoCancelado;
  }
}

module.exports = PedidosService;
