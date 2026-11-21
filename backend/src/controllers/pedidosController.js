/**
 * @file controllers/pedidosController.js
 * @description Controlador para creación de pedidos en checkout y consulta de ventas.
 * ChocoTi-Digital | Capa 1: Controladores y Seguridad HTTP
 */

'use strict';

const PedidosService = require('../services/pedidosService');
const Pedido = require('../models/Pedido');

class PedidosController {
  /**
   * Endpoint de Checkout: Crea un nuevo pedido con reserva temporal de stock.
   * Admite compras de usuarios autenticados y compras como invitado.
   *
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   * @param {import('express').NextFunction} next
   */
  static async crear(req, res, next) {
    try {
      const {
        cliente,
        items,
        metodo_pago,
        tipo_entrega,
        punto_recojo_id,
        direccion_envio,
        referencia_envio,
        ciudad_destino,
        cupon,
        notas,
      } = req.body;

      const resultado = await PedidosService.crearPedidoCheckout({
        datosCliente: cliente,
        items,
        metodoPago: metodo_pago,
        tipoEntrega: tipo_entrega,
        puntoRecojoId: punto_recojo_id ? Number(punto_recojo_id) : null,
        direccionEnvio: direccion_envio,
        referenciaEnvio: referencia_envio,
        ciudadDestino: ciudad_destino,
        cupon,
        notas,
        usuarioAuth: req.usuario || null,
      });

      return res.status(201).json({
        ok: true,
        mensaje: 'Pedido registrado con reserva temporal de inventario exitosa.',
        ...resultado,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Lista los pedidos con control de visibilidad según el rol del usuario autenticado:
   * - CLIENTE: solo sus pedidos
   * - OPERADOR_ALMACEN: solo pedidos asignados a su sucursal
   * - ADMINISTRADOR: todos los pedidos
   *
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   * @param {import('express').NextFunction} next
   */
  static listar(req, res, next) {
    try {
      const filtros = { ...req.query };

      // Restricciones RBAC de visibilidad: cada rol operativo ve únicamente pedidos de su almacén
      const rolesAlmacen = ['OPERADOR_ALMACEN', 'PREPARADOR_PEDIDOS', 'EMPACADOR', 'DESPACHADOR_ENTREGA'];
      if (req.usuario.rol === 'CLIENTE_MINORISTA' || req.usuario.rol === 'CLIENTE_CORPORATIVO') {
        filtros.usuario_id = req.usuario.id;
      } else if (rolesAlmacen.includes(req.usuario.rol)) {
        filtros.almacen_id = req.usuario.almacen_id;
      }

      const pedidos = Pedido.findAll(filtros);

      return res.status(200).json({
        ok: true,
        total: pedidos.length,
        data: pedidos,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Obtiene el detalle completo de un pedido por ID.
   *
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   * @param {import('express').NextFunction} next
   */
  static obtenerPorId(req, res, next) {
    try {
      const pedidoId = Number(req.params.id || req.params.pedido_id);
      const pedido = Pedido.findById(pedidoId);

      if (!pedido) {
        return res.status(404).json({ ok: false, mensaje: 'Pedido no encontrado.' });
      }

      // Validar acceso: Admin, personal operativo de su propio almacén, o propio cliente
      const esAdmin = req.usuario && req.usuario.rol === 'ADMINISTRADOR';
      const rolesAlmacen = ['OPERADOR_ALMACEN', 'PREPARADOR_PEDIDOS', 'EMPACADOR', 'DESPACHADOR_ENTREGA'];
      const esPersonalAlmacen = req.usuario && rolesAlmacen.includes(req.usuario.rol) && Number(req.usuario.almacen_id) === Number(pedido.almacen_id);
      const esPropioCliente = req.usuario && pedido.usuario_id && Number(req.usuario.id) === Number(pedido.usuario_id);

      if (!esAdmin && !esPersonalAlmacen && !esPropioCliente) {
        return res.status(403).json({ ok: false, mensaje: 'Acceso denegado a este pedido.' });
      }

      return res.status(200).json({
        ok: true,
        data: pedido,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Consulta pública de pedido por código (ej. PED-2026-1001) para comprobante o seguimiento de compra.
   *
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   * @param {import('express').NextFunction} next
   */
  static obtenerPorCodigo(req, res, next) {
    try {
      const codigo = req.params.codigo;
      const pedido = Pedido.findByCodigo(codigo);

      if (!pedido) {
        return res.status(404).json({ ok: false, mensaje: `Pedido '${codigo}' no encontrado.` });
      }

      return res.status(200).json({
        ok: true,
        data: pedido,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Actualiza el estado del pedido con RBAC y notificación automática al cliente.
   *
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   * @param {import('express').NextFunction} next
   */
  static cambiarEstado(req, res, next) {
    try {
      const pedidoId = Number(req.params.id || req.params.pedido_id);
      let nuevoEstado = req.body.nuevo_estado || req.body.estado_pedido || req.body.estado;
      const motivo = req.body.motivo || '';
      const comentario = req.body.comentario || '';

      if (!nuevoEstado) {
        return res.status(400).json({ ok: false, mensaje: 'El campo nuevo_estado es obligatorio.' });
      }

      const pedidoActual = Pedido.findById(pedidoId);
      if (!pedidoActual) {
        return res.status(404).json({ ok: false, mensaje: `Pedido #${pedidoId} no encontrado.` });
      }

      // Validar aislamiento de almacén para personal operativo
      const rolesAlmacen = ['OPERADOR_ALMACEN', 'PREPARADOR_PEDIDOS', 'EMPACADOR', 'DESPACHADOR_ENTREGA'];
      if (req.usuario && rolesAlmacen.includes(req.usuario.rol) && Number(pedidoActual.almacen_id) !== Number(req.usuario.almacen_id)) {
        return res.status(403).json({
          ok: false,
          mensaje: 'Acceso denegado. Solo tiene permisos para gestionar pedidos de su almacén asignado.',
        });
      }

      // Si nuevoEstado es 'LISTO', resolver a LISTO_RECOJO o LISTO_DESPACHO
      nuevoEstado = String(nuevoEstado).toUpperCase();
      if (nuevoEstado === 'LISTO') {
        nuevoEstado = pedidoActual.tipo_entrega === 'RECOJO_AGENCIA' ? 'LISTO_RECOJO' : 'LISTO_DESPACHO';
      }

      // Si se envía checklist de picking en el body, persistirlo
      if (req.body.checklist_picking || req.body.checklist) {
        try {
          const PedidoPreparacion = require('../models/PedidoPreparacion');
          PedidoPreparacion.registrarChecklist({
            pedidoId,
            preparadorId: req.usuario ? req.usuario.id : 1,
            almacenId: pedidoActual.almacen_id,
            checklist: req.body.checklist_picking || req.body.checklist,
            incidenciaStock: req.body.incidencia_stock ? 1 : 0,
            detalleIncidencia: req.body.detalle_incidencia || '',
            notas: req.body.notas || comentario,
            estado: req.body.incidencia_stock ? 'INCIDENCIA' : 'COMPLETADO',
          });
        } catch (prepErr) {
          console.warn('[CAMBIAR-ESTADO] Error al registrar checklist de preparación:', prepErr.message);
        }
      }

      // Si se envía checklist de empaque en el body, persistirlo
      if (req.body.checklist_empaque || req.body.empaque_termico !== undefined) {
        try {
          const PedidoEmpaque = require('../models/PedidoEmpaque');
          PedidoEmpaque.registrarChecklist({
            pedidoId,
            empacadorId: req.usuario ? req.usuario.id : 1,
            almacenId: pedidoActual.almacen_id,
            empaqueTermico: req.body.empaque_termico ? 1 : 0,
            tarjetaMensaje: req.body.tarjeta_mensaje ? 1 : 0,
            textoTarjeta: req.body.texto_tarjeta || '',
            pesoKg: req.body.peso_kg || 1.0,
            numeroCajas: req.body.numero_cajas || 1,
            checklist: req.body.checklist_empaque || null,
            notas: req.body.notas || comentario,
            estado: 'COMPLETADO',
          });
        } catch (empErr) {
          console.warn('[CAMBIAR-ESTADO] Error al registrar checklist de empaque:', empErr.message);
        }
      }

      const pedidoActualizado = PedidosService.cambiarEstadoPedido({
        pedidoId,
        nuevoEstado,
        motivo,
        comentario,
        usuarioAuth: req.usuario || null,
      });

      return res.status(200).json({
        ok: true,
        mensaje: `Pedido #${pedidoId} actualizado al estado '${nuevoEstado}' correctamente.`,
        data: pedidoActualizado,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Obtiene la orden de preparación con sugerencias FEFO de lotes por almacén.
   *
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   * @param {import('express').NextFunction} next
   */
  static obtenerPreparacion(req, res, next) {
    try {
      const pedidoId = Number(req.params.id || req.params.pedido_id);
      const pedido = Pedido.findById(pedidoId);

      if (!pedido) {
        return res.status(404).json({ ok: false, mensaje: `Pedido #${pedidoId} no encontrado.` });
      }

      const esAdmin = req.usuario && req.usuario.rol === 'ADMINISTRADOR';
      const esPreparador = req.usuario && req.usuario.rol === 'PREPARADOR_PEDIDOS';

      if (!esAdmin && !esPreparador) {
        return res.status(403).json({
          ok: false,
          mensaje: `Acceso denegado. Rol '${req.usuario ? req.usuario.rol : 'ANONIMO'}' no autorizado para preparación.`,
        });
      }

      if (!esAdmin && Number(req.usuario.almacen_id) !== Number(pedido.almacen_id)) {
        return res.status(403).json({
          ok: false,
          mensaje: 'Acceso denegado. Solo tiene permisos para gestionar pedidos de su almacén asignado.',
        });
      }

      const PedidoPreparacion = require('../models/PedidoPreparacion');
      const preparacion = PedidoPreparacion.obtenerPorPedidoId(pedidoId);
      const sugerenciasFEFO = PedidoPreparacion.generarSugerenciaFEFO(pedidoId);

      return res.status(200).json({
        ok: true,
        data: {
          pedido_id: pedidoId,
          codigo_pedido: pedido.codigo_pedido,
          almacen_id: pedido.almacen_id,
          almacen_nombre: pedido.almacen_nombre,
          estado_pedido: pedido.estado_pedido,
          preparacion: preparacion || null,
          sugerencias_fefo: sugerenciasFEFO,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Registra el checklist de preparación (picking) y opcionalmente transiciona el estado.
   *
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   * @param {import('express').NextFunction} next
   */
  static guardarPreparacion(req, res, next) {
    try {
      const pedidoId = Number(req.params.id || req.params.pedido_id);
      const pedido = Pedido.findById(pedidoId);

      if (!pedido) {
        return res.status(404).json({ ok: false, mensaje: `Pedido #${pedidoId} no encontrado.` });
      }

      const esAdmin = req.usuario && req.usuario.rol === 'ADMINISTRADOR';
      const esPreparador = req.usuario && req.usuario.rol === 'PREPARADOR_PEDIDOS';

      if (!esAdmin && !esPreparador) {
        return res.status(403).json({
          ok: false,
          mensaje: `Acceso denegado. Rol '${req.usuario ? req.usuario.rol : 'ANONIMO'}' no autorizado para guardar preparación.`,
        });
      }

      if (!esAdmin && Number(req.usuario.almacen_id) !== Number(pedido.almacen_id)) {
        return res.status(403).json({
          ok: false,
          mensaje: 'Acceso denegado. Solo tiene permisos para gestionar pedidos de su almacén asignado.',
        });
      }

      const {
        checklist,
        checklist_picking,
        incidencia_stock = 0,
        detalle_incidencia = '',
        notas = '',
        estado = null,
        avanzar_estado = null,
        nuevo_estado = null,
      } = req.body;

      const itemsChecklist = checklist_picking || checklist || [];
      const PedidoPreparacion = require('../models/PedidoPreparacion');

      const registro = PedidoPreparacion.registrarChecklist({
        pedidoId,
        preparadorId: req.usuario ? req.usuario.id : 1,
        almacenId: pedido.almacen_id,
        checklist: itemsChecklist,
        incidenciaStock: incidencia_stock,
        detalleIncidencia: detalle_incidencia,
        notas,
        estado,
      });

      // Si se solicita transicionar estado
      const estadoDeseado = nuevo_estado || (avanzar_estado ? 'PREPARADO' : null);
      let pedidoActualizado = pedido;

      if (estadoDeseado) {
        pedidoActualizado = PedidosService.cambiarEstadoPedido({
          pedidoId,
          nuevoEstado: String(estadoDeseado).toUpperCase(),
          motivo: incidencia_stock ? 'Preparación con incidencia de stock' : 'Picking completado según checklist FEFO',
          comentario: detalle_incidencia || notas,
          usuarioAuth: req.usuario,
        });
      }

      return res.status(200).json({
        ok: true,
        mensaje: 'Checklist de preparación guardado correctamente.',
        data: {
          preparacion: registro,
          pedido: pedidoActualizado,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Obtiene la orden de empaque con información térmica y tarjetas dedicatorias.
   *
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   * @param {import('express').NextFunction} next
   */
  static obtenerEmpaque(req, res, next) {
    try {
      const pedidoId = Number(req.params.id || req.params.pedido_id);
      const pedido = Pedido.findById(pedidoId);

      if (!pedido) {
        return res.status(404).json({ ok: false, mensaje: `Pedido #${pedidoId} no encontrado.` });
      }

      const esAdmin = req.usuario && req.usuario.rol === 'ADMINISTRADOR';
      const esEmpacador = req.usuario && req.usuario.rol === 'EMPACADOR';

      if (!esAdmin && !esEmpacador) {
        return res.status(403).json({
          ok: false,
          mensaje: `Acceso denegado. Rol '${req.usuario ? req.usuario.rol : 'ANONIMO'}' no autorizado para empaque.`,
        });
      }

      if (!esAdmin && Number(req.usuario.almacen_id) !== Number(pedido.almacen_id)) {
        return res.status(403).json({
          ok: false,
          mensaje: 'Acceso denegado. Solo tiene permisos para gestionar pedidos de su almacén asignado.',
        });
      }

      const PedidoEmpaque = require('../models/PedidoEmpaque');
      const empaque = PedidoEmpaque.obtenerPorPedidoId(pedidoId);

      return res.status(200).json({
        ok: true,
        data: {
          pedido_id: pedidoId,
          codigo_pedido: pedido.codigo_pedido,
          almacen_id: pedido.almacen_id,
          tipo_entrega: pedido.tipo_entrega,
          ciudad_destino: pedido.ciudad_destino,
          estado_pedido: pedido.estado_pedido,
          empaque: empaque || null,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Registra el checklist de empaque y opcionalmente transiciona a LISTO_DESPACHO o LISTO_RECOJO.
   *
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   * @param {import('express').NextFunction} next
   */
  static guardarEmpaque(req, res, next) {
    try {
      const pedidoId = Number(req.params.id || req.params.pedido_id);
      const pedido = Pedido.findById(pedidoId);

      if (!pedido) {
        return res.status(404).json({ ok: false, mensaje: `Pedido #${pedidoId} no encontrado.` });
      }

      const esAdmin = req.usuario && req.usuario.rol === 'ADMINISTRADOR';
      const esEmpacador = req.usuario && req.usuario.rol === 'EMPACADOR';

      if (!esAdmin && !esEmpacador) {
        return res.status(403).json({
          ok: false,
          mensaje: `Acceso denegado. Rol '${req.usuario ? req.usuario.rol : 'ANONIMO'}' no autorizado para guardar empaque.`,
        });
      }

      if (!esAdmin && Number(req.usuario.almacen_id) !== Number(pedido.almacen_id)) {
        return res.status(403).json({
          ok: false,
          mensaje: 'Acceso denegado. Solo tiene permisos para gestionar pedidos de su almacén asignado.',
        });
      }

      const {
        empaque_termico = 0,
        tarjeta_mensaje = 0,
        texto_tarjeta = '',
        etiqueta_generada = 1,
        peso_kg = 1.0,
        numero_cajas = 1,
        checklist = null,
        checklist_empaque = null,
        notas = '',
        estado = 'COMPLETADO',
        avanzar_estado = null,
        nuevo_estado = null,
      } = req.body;

      const itemsChecklist = checklist_empaque || checklist || null;
      const PedidoEmpaque = require('../models/PedidoEmpaque');

      const registro = PedidoEmpaque.registrarChecklist({
        pedidoId,
        empacadorId: req.usuario ? req.usuario.id : 1,
        almacenId: pedido.almacen_id,
        empaqueTermico: empaque_termico,
        tarjetaMensaje: tarjeta_mensaje,
        textoTarjeta: texto_tarjeta,
        etiquetaGenerada: etiqueta_generada,
        pesoKg: peso_kg,
        numeroCajas: numero_cajas,
        checklist: itemsChecklist,
        notas,
        estado,
      });

      // Transición automática o solicitada al finalizar empaque
      let estadoDeseado = nuevo_estado;
      if (!estadoDeseado && avanzar_estado) {
        estadoDeseado = pedido.tipo_entrega === 'RECOJO_AGENCIA' ? 'LISTO_RECOJO' : 'LISTO_DESPACHO';
      }

      let pedidoActualizado = pedido;
      if (estadoDeseado) {
        if (String(estadoDeseado).toUpperCase() === 'LISTO') {
          estadoDeseado = pedido.tipo_entrega === 'RECOJO_AGENCIA' ? 'LISTO_RECOJO' : 'LISTO_DESPACHO';
        }

        pedidoActualizado = PedidosService.cambiarEstadoPedido({
          pedidoId,
          nuevoEstado: String(estadoDeseado).toUpperCase(),
          motivo: 'Empaque y control de calidad completado',
          comentario: notas,
          usuarioAuth: req.usuario,
        });
      }

      return res.status(200).json({
        ok: true,
        mensaje: 'Checklist de empaque registrado exitosamente.',
        data: {
          empaque: registro,
          pedido: pedidoActualizado,
        },
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = PedidosController;
