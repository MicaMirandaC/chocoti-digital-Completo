/**
 * @file services/inventarioService.js
 * @description Lógica de negocio para inventario, kardex, lotes FEFO y traspasos entre almacenes.
 * ChocoTi-Digital | Capa 2: Lógica de Negocio
 */

'use strict';

const db = require('../config/database');
const Inventario = require('../models/Inventario');
const Lote = require('../models/Lote');
const Kardex = require('../models/Kardex');
const Producto = require('../models/Producto');

class InventarioService {
  /**
   * Consulta el stock disponible.
   * Si es operador, restringe estrictamente a su almacén asignado.
   * Si es admin, puede consultar consolidado o filtrar por almacén.
   */
  static async consultarStock({ almacen_id = null, usuario }) {
    let targetAlmacen = almacen_id ? Number(almacen_id) : null;

    if (usuario && usuario.rol_id === 2) {
      // Operador de Almacén: solo su almacén
      targetAlmacen = usuario.almacen_id;
    }

    if (targetAlmacen) {
      const items = Inventario.obtenerStockPorAlmacen(targetAlmacen);
      return {
        tipo: 'almacen',
        almacen_id: targetAlmacen,
        total_items: items.length,
        items
      };
    }

    // Administrador sin filtro: vista consolidada
    const consolidado = Inventario.obtenerConsolidado();
    return {
      tipo: 'consolidado',
      total_items: consolidado.length,
      items: consolidado
    };
  }

  /**
   * Consulta alertas de inventario (stock mínimo y vencimiento de lotes).
   */
  static async consultarAlertas({ almacen_id = null, usuario }) {
    let targetAlmacen = almacen_id ? Number(almacen_id) : null;

    if (usuario && usuario.rol_id === 2) {
      targetAlmacen = usuario.almacen_id;
    }

    const alertasStock = Inventario.obtenerAlertasStock(targetAlmacen);
    const alertasVencimiento = Lote.obtenerAlertasVencimiento(30, targetAlmacen);

    return {
      almacen_id: targetAlmacen,
      resumen: {
        total_alertas_stock: alertasStock.length,
        total_alertas_vencimiento: alertasVencimiento.length
      },
      stock_bajo: alertasStock,
      vencimientos_proximos: alertasVencimiento
    };
  }

  /**
   * Registra una entrada de mercadería (compra / producción) y su lote asociado.
   */
  static async registrarEntrada({
    producto_id,
    almacen_id,
    cantidad,
    lote_codigo,
    fecha_vencimiento,
    usuario_id = null,
    motivo = 'Entrada de producción / Lote inicial'
  }) {
    const pId = Number(producto_id);
    const aId = Number(almacen_id);
    const cant = Number(cantidad);

    if (!pId || !aId || !cant || cant <= 0) {
      const error = new Error('Producto, almacén y una cantidad positiva son obligatorios.');
      error.statusCode = 400;
      throw error;
    }

    const prod = Producto.findById(pId);
    if (!prod) {
      const error = new Error('El producto especificado no existe.');
      error.statusCode = 404;
      throw error;
    }

    const operacion = db.transaction(() => {
      // 1. Ajustar stock físico
      Inventario.ajustarStock(pId, aId, cant);

      // 2. Registrar lote si se especificó código y vencimiento
      let loteCreado = null;
      if (lote_codigo && fecha_vencimiento) {
        loteCreado = Lote.crearLote({
          lote_codigo: lote_codigo.trim().toUpperCase(),
          producto_id: pId,
          almacen_id: aId,
          cantidad: cant,
          fecha_vencimiento
        });
      }

      // 3. Registrar movimiento en Kardex
      const movimientoKardex = Kardex.registrar({
        tipo_movimiento: 'ENTRADA',
        producto_id: pId,
        almacen_destino_id: aId,
        cantidad: cant,
        usuario_id,
        motivo
      });

      return { loteCreado, movimientoKardex };
    });

    const resultado = operacion();

    return {
      mensaje: 'Entrada de inventario registrada con éxito.',
      producto_id: pId,
      almacen_id: aId,
      cantidad_ingresada: cant,
      lote: resultado.loteCreado,
      kardex_id: resultado.movimientoKardex.id
    };
  }

  /**
   * Registra un ajuste de stock manual (merma, corrección de conteo, etc.).
   */
  static async registrarAjuste({
    producto_id,
    almacen_id,
    cantidad_delta,
    usuario_id = null,
    motivo
  }) {
    const pId = Number(producto_id);
    const aId = Number(almacen_id);
    const delta = Number(cantidad_delta);

    if (!pId || !aId || isNaN(delta) || delta === 0) {
      const error = new Error('Producto, almacén y una variación distinta de 0 son obligatorios.');
      error.statusCode = 400;
      throw error;
    }

    if (!motivo || !motivo.trim()) {
      const error = new Error('Debe especificar un motivo justificando el ajuste de inventario.');
      error.statusCode = 400;
      throw error;
    }

    const operacion = db.transaction(() => {
      const stockFila = db
        .prepare('SELECT stock_actual, stock_reservado FROM inventario WHERE producto_id = ? AND almacen_id = ?')
        .get(pId, aId);

      const actual = stockFila ? stockFila.stock_actual : 0;
      if (actual + delta < 0) {
        const error = new Error(`El ajuste excede las existencias físicas disponibles (${actual} disponibles).`);
        error.statusCode = 400;
        throw error;
      }

      Inventario.ajustarStock(pId, aId, delta);

      // Si es reducción (merma), consumir lotes FEFO
      let lotesAfectados = [];
      if (delta < 0) {
        lotesAfectados = Lote.consumirFEFO(pId, aId, Math.abs(delta));
      }

      const movimientoKardex = Kardex.registrar({
        tipo_movimiento: 'AJUSTE',
        producto_id: pId,
        almacen_origen_id: delta < 0 ? aId : null,
        almacen_destino_id: delta > 0 ? aId : null,
        cantidad: Math.abs(delta),
        usuario_id,
        motivo: motivo.trim()
      });

      return { movimientoKardex, lotesAfectados };
    });

    const res = operacion();

    return {
      mensaje: 'Ajuste de inventario procesado correctamente.',
      producto_id: pId,
      almacen_id: aId,
      delta,
      kardex_id: res.movimientoKardex.id,
      lotes_afectados: res.lotesAfectados
    };
  }

  /**
   * Registra un traspaso de mercadería entre dos almacenes.
   */
  static async registrarTraspaso({
    producto_id,
    almacen_origen_id,
    almacen_destino_id,
    cantidad,
    usuario_id = null,
    motivo
  }) {
    const pId = Number(producto_id);
    const origId = Number(almacen_origen_id);
    const destId = Number(almacen_destino_id);
    const cant = Number(cantidad);

    if (!pId || !origId || !destId || !cant || cant <= 0) {
      const error = new Error('Producto, almacén origen, almacén destino y una cantidad mayor a 0 son obligatorios.');
      error.statusCode = 400;
      throw error;
    }

    if (origId === destId) {
      const error = new Error('El almacén de origen y destino no pueden ser el mismo.');
      error.statusCode = 400;
      throw error;
    }

    const operacion = db.transaction(() => {
      const stockOrigen = db
        .prepare('SELECT stock_actual, stock_reservado FROM inventario WHERE producto_id = ? AND almacen_id = ?')
        .get(pId, origId);

      const disponible = stockOrigen ? stockOrigen.stock_actual - stockOrigen.stock_reservado : 0;
      if (disponible < cant) {
        const error = new Error(`Stock insuficiente en almacén de origen (${disponible} unidades disponibles para transferir).`);
        error.statusCode = 400;
        throw error;
      }

      // Restar en origen y sumar en destino
      Inventario.ajustarStock(pId, origId, -cant);
      Inventario.ajustarStock(pId, destId, cant);

      // Consumir lotes FEFO en origen
      const lotesConsumidos = Lote.consumirFEFO(pId, origId, cant);

      // Replicar lotes consumidos en el almacén de destino para preservar trazabilidad de vencimiento
      for (const lote of lotesConsumidos) {
        Lote.crearLote({
          lote_codigo: `${lote.lote_codigo}-TR`,
          producto_id: pId,
          almacen_id: destId,
          cantidad: lote.cantidad_descontada,
          fecha_vencimiento: lote.fecha_vencimiento
        });
      }

      const kardexMov = Kardex.registrar({
        tipo_movimiento: 'TRASPASO',
        producto_id: pId,
        almacen_origen_id: origId,
        almacen_destino_id: destId,
        cantidad: cant,
        usuario_id,
        motivo: motivo || 'Traspaso interalmacenes'
      });

      return { kardexMov, lotesConsumidos };
    });

    const res = operacion();

    return {
      mensaje: 'Traspaso realizado exitosamente.',
      producto_id: pId,
      almacen_origen_id: origId,
      almacen_destino_id: destId,
      cantidad: cant,
      kardex_id: res.kardexMov.id
    };
  }

  /**
   * Consulta el historial inmutable de Kardex con filtros y permisos.
   */
  static async consultarKardex({
    producto_id,
    almacen_id,
    tipo_movimiento,
    limite = 50,
    offset = 0,
    usuario
  }) {
    let targetAlmacen = almacen_id ? Number(almacen_id) : null;

    if (usuario && usuario.rol_id === 2) {
      targetAlmacen = usuario.almacen_id;
    }

    return Kardex.listar({
      producto_id: producto_id ? Number(producto_id) : null,
      almacen_id: targetAlmacen,
      tipo_movimiento,
      limite,
      offset
    });
  }

  /**
   * Consulta lotes vigentes o por almacén.
   */
  static async consultarLotes({ producto_id, almacen_id, estado, usuario }) {
    let targetAlmacen = almacen_id ? Number(almacen_id) : null;

    if (usuario && usuario.rol_id === 2) {
      targetAlmacen = usuario.almacen_id;
    }

    return Lote.listar({
      producto_id: producto_id ? Number(producto_id) : null,
      almacen_id: targetAlmacen,
      estado
    });
  }
}

module.exports = InventarioService;
