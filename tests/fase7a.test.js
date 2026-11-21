/**
 * @file tests/fase7a.test.js
 * @description Suite de pruebas automatizadas para la Fase 7A:
 * 1. Permisos RBAC y rebote 403 por rol en cada transición del ciclo de vida.
 * 2. Aislamiento estricto por almacén: cada rol operativo ve y opera únicamente pedidos de su sucursal.
 * 3. Checklist de picking FEFO: sugerencias de lotes por vencimiento, guardado e incidencias de percha.
 * 4. Flujo funcional completo Pagado -> Listo (PAGADO -> EN_PREPARACION -> PREPARADO -> EMPACADO -> LISTO).
 * 5. Resiliencia de notificaciones: fallos de mensajería nunca bloquean ni abortan el cambio de estado.
 *
 * ChocoTi-Digital | Cierre Funcional Fase 7A
 */

'use strict';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_jwt_secret_sucre_bolivia_2026';
process.env.DB_PATH = 'database/chocoti.db';

const assert = require('assert');
const jwt = require('jsonwebtoken');
const app = require('../backend/src/app');
const db = require('../backend/src/config/database');
const AuthService = require('../backend/src/services/authService');
const Pedido = require('../backend/src/models/Pedido');
const PedidoPreparacion = require('../backend/src/models/PedidoPreparacion');
const PedidoEmpaque = require('../backend/src/models/PedidoEmpaque');
const NotificacionesService = require('../backend/src/services/notificacionesService');

async function ejecutarPruebasFase7A() {
  console.log('\n======================================================');
  console.log('🧪 INICIANDO PRUEBAS FASE 7A: PICKING FEFO, CHECKLIST Y TRANSICIONES');
  console.log('======================================================\n');

  const server = app.listen(0);
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}/api`;

  const pedidosCreadosParaLimpieza = [];

  try {
    // ---------------------------------------------------------------------------
    // 0. GENERACIÓN / OBTENCIÓN DE TOKENS PARA LOS DISTINTOS ROLES
    // ---------------------------------------------------------------------------
    console.log('0. Autenticando roles para las pruebas...');

    const authAdmin = await AuthService.login({ email: 'admin@chocolatesti.bo', password: 'Admin2024!', ip: '127.0.0.1' });
    const tokenAdmin = authAdmin.token;

    const authPrepSucre = await AuthService.login({ email: 'preparador.sucre@chocolatesti.bo', password: 'Preparador2024!', ip: '127.0.0.1' });
    const tokenPrepSucre = authPrepSucre.token;

    const authEmpSucre = await AuthService.login({ email: 'empacador.sucre@chocolatesti.bo', password: 'Empacador2024!', ip: '127.0.0.1' });
    const tokenEmpSucre = authEmpSucre.token;

    const authDespSucre = await AuthService.login({ email: 'despachador.sucre@chocolatesti.bo', password: 'Despachador2024!', ip: '127.0.0.1' });
    const tokenDespSucre = authDespSucre.token;

    const authOpSucre = await AuthService.login({ email: 'operador.sucre@chocolatesti.bo', password: 'Operador2024!', ip: '127.0.0.1' });
    const tokenOpSucre = authOpSucre.token;

    const authCliente = await AuthService.login({ email: 'cliente@gmail.com', password: 'Cliente2024!', ip: '127.0.0.1' });
    const tokenCliente = authCliente.token;

    // Tokens para operarios de Almacén 2 (La Paz) para probar aislamiento estricto
    const tokenPrepLaPaz = jwt.sign(
      { id: 98, email: 'prep.lapaz@chocolatesti.bo', rol: 'PREPARADOR_PEDIDOS', almacen_id: 2, nombre_completo: 'Prep La Paz' },
      process.env.JWT_SECRET,
      { expiresIn: '2h' }
    );

    const tokenEmpLaPaz = jwt.sign(
      { id: 99, email: 'emp.lapaz@chocolatesti.bo', rol: 'EMPACADOR', almacen_id: 2, nombre_completo: 'Emp La Paz' },
      process.env.JWT_SECRET,
      { expiresIn: '2h' }
    );

    console.log('  ✓ Tokens de autenticación obtenidos para los 7 roles y sucursales Sucre / La Paz.');

    // Helper para crear un pedido de prueba directamente en BD en estado PAGADO
    function crearPedidoPrueba(almacenId = 1, tipoEntrega = 'ENVIO_DOMICILIO') {
      const codigo = `TEST-7A-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const result = db.prepare(`
        INSERT INTO pedidos (
          codigo_pedido, usuario_id, cliente_nombre, cliente_ci_nit, cliente_email, cliente_telefono,
          almacen_id, tipo_entrega, subtotal, costo_envio, descuento, total,
          estado_pedido, estado_pago, metodo_pago, direccion_envio, ciudad_destino
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PAGADO', 'PAGADO', 'QR', 'Calle Test 123', 'Sucre')
      `).run(codigo, authCliente.usuario.id, 'Cliente Test 7A', '1234567-CH', 'test7a@gmail.com', '70000000', almacenId, tipoEntrega, 85.00, 0.00, 0.00, 85.00);

      const pedidoId = result.lastInsertRowid;
      pedidosCreadosParaLimpieza.push(pedidoId);

      // Agregar líneas de pedido con productos de semilla
      db.prepare(`
        INSERT INTO pedido_detalles (pedido_id, producto_id, cantidad, precio_unitario, subtotal)
        VALUES (?, 1, 2, 25.00, 50.00), (?, 2, 1, 35.00, 35.00)
      `).run(pedidoId, pedidoId);

      // Registrar historial inicial
      db.prepare(`
        INSERT INTO pedido_historial_estados (pedido_id, estado_anterior, estado_nuevo, usuario_id, rol_transicion, motivo)
        VALUES (?, NULL, 'PAGADO', ?, 'ADMINISTRADOR', 'Creación de prueba')
      `).run(pedidoId, authAdmin.usuario.id);

      return pedidoId;
    }

    // ---------------------------------------------------------------------------
    // 1. RESTRICCIONES RBAC: REBOTE 403 POR ROL EN CADA TRANSICIÓN (PAGADO A LISTO)
    // ---------------------------------------------------------------------------
    console.log('\n1. Probando que cada transición de Pagado a Listo solo la ejecute su rol correspondiente (rebote 403)...');
    const p1 = crearPedidoPrueba(1, 'ENVIO_DOMICILIO');

    // 1.1 De PAGADO a EN_PREPARACION:
    // Operador Almacén -> 403
    let res = await fetch(`${baseUrl}/pedidos/${p1}/estado`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenOpSucre}` },
      body: JSON.stringify({ nuevo_estado: 'EN_PREPARACION' }),
    });
    assert.strictEqual(res.status, 403, 'OPERADOR_ALMACEN no debe poder pasar a EN_PREPARACION (debe responder 403)');

    // Empacador -> 403
    res = await fetch(`${baseUrl}/pedidos/${p1}/estado`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenEmpSucre}` },
      body: JSON.stringify({ nuevo_estado: 'EN_PREPARACION' }),
    });
    assert.strictEqual(res.status, 403, 'EMPACADOR no debe poder pasar a EN_PREPARACION (debe responder 403)');

    // Despachador -> 403
    res = await fetch(`${baseUrl}/pedidos/${p1}/estado`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenDespSucre}` },
      body: JSON.stringify({ nuevo_estado: 'EN_PREPARACION' }),
    });
    assert.strictEqual(res.status, 403, 'DESPACHADOR_ENTREGA no debe poder pasar a EN_PREPARACION (debe responder 403)');

    // Cliente -> 403
    res = await fetch(`${baseUrl}/pedidos/${p1}/estado`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenCliente}` },
      body: JSON.stringify({ nuevo_estado: 'EN_PREPARACION' }),
    });
    assert.strictEqual(res.status, 403, 'CLIENTE_MINORISTA no debe poder pasar a EN_PREPARACION (debe responder 403)');

    // PREPARADOR_PEDIDOS -> 200 OK
    res = await fetch(`${baseUrl}/pedidos/${p1}/estado`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenPrepSucre}` },
      body: JSON.stringify({ nuevo_estado: 'EN_PREPARACION' }),
    });
    assert.strictEqual(res.status, 200, 'PREPARADOR_PEDIDOS sí debe transicionar a EN_PREPARACION');
    console.log('  ✓ PAGADO -> EN_PREPARACION: solo autorizado para PREPARADOR_PEDIDOS (otros 403).');

    // 1.2 De EN_PREPARACION a PREPARADO:
    // Empacador intenta marcar como PREPARADO -> 403
    res = await fetch(`${baseUrl}/pedidos/${p1}/estado`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenEmpSucre}` },
      body: JSON.stringify({ nuevo_estado: 'PREPARADO' }),
    });
    assert.strictEqual(res.status, 403, 'EMPACADOR no debe poder pasar a PREPARADO (debe responder 403)');

    // Preparador intenta saltar directo a EMPACADO -> 403
    res = await fetch(`${baseUrl}/pedidos/${p1}/estado`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenPrepSucre}` },
      body: JSON.stringify({ nuevo_estado: 'EMPACADO' }),
    });
    assert.strictEqual(res.status, 403, 'PREPARADOR_PEDIDOS no debe poder pasar a EMPACADO (debe responder 403)');

    // PREPARADOR_PEDIDOS pasa a PREPARADO -> 200 OK
    res = await fetch(`${baseUrl}/pedidos/${p1}/estado`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenPrepSucre}` },
      body: JSON.stringify({ nuevo_estado: 'PREPARADO' }),
    });
    assert.strictEqual(res.status, 200, 'PREPARADOR_PEDIDOS sí debe transicionar a PREPARADO');
    console.log('  ✓ EN_PREPARACION -> PREPARADO: solo autorizado para PREPARADOR_PEDIDOS (otros 403).');

    // 1.3 De PREPARADO a EMPACADO:
    // Preparador intenta pasar a EMPACADO -> 403
    res = await fetch(`${baseUrl}/pedidos/${p1}/estado`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenPrepSucre}` },
      body: JSON.stringify({ nuevo_estado: 'EMPACADO' }),
    });
    assert.strictEqual(res.status, 403, 'PREPARADOR_PEDIDOS no puede pasar a EMPACADO (403)');

    // Despachador intenta pasar a EMPACADO -> 403
    res = await fetch(`${baseUrl}/pedidos/${p1}/estado`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenDespSucre}` },
      body: JSON.stringify({ nuevo_estado: 'EMPACADO' }),
    });
    assert.strictEqual(res.status, 403, 'DESPACHADOR_ENTREGA no puede pasar a EMPACADO (403)');

    // EMPACADOR pasa a EMPACADO -> 200 OK
    res = await fetch(`${baseUrl}/pedidos/${p1}/estado`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenEmpSucre}` },
      body: JSON.stringify({ nuevo_estado: 'EMPACADO' }),
    });
    assert.strictEqual(res.status, 200, 'EMPACADOR sí debe poder pasar a EMPACADO');
    console.log('  ✓ PREPARADO -> EMPACADO: solo autorizado para EMPACADOR (otros 403).');

    // 1.4 De EMPACADO a LISTO_DESPACHO (o LISTO_RECOJO):
    // Preparador intenta pasar a LISTO_DESPACHO -> 403
    res = await fetch(`${baseUrl}/pedidos/${p1}/estado`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenPrepSucre}` },
      body: JSON.stringify({ nuevo_estado: 'LISTO_DESPACHO' }),
    });
    assert.strictEqual(res.status, 403, 'PREPARADOR_PEDIDOS no puede pasar a LISTO_DESPACHO (403)');

    // Despachador intenta pasar a LISTO_DESPACHO -> 403
    res = await fetch(`${baseUrl}/pedidos/${p1}/estado`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenDespSucre}` },
      body: JSON.stringify({ nuevo_estado: 'LISTO_DESPACHO' }),
    });
    assert.strictEqual(res.status, 403, 'DESPACHADOR_ENTREGA no puede pasar a LISTO_DESPACHO (403)');

    // EMPACADOR pasa a LISTO_DESPACHO -> 200 OK
    res = await fetch(`${baseUrl}/pedidos/${p1}/estado`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenEmpSucre}` },
      body: JSON.stringify({ nuevo_estado: 'LISTO_DESPACHO' }),
    });
    assert.strictEqual(res.status, 200, 'EMPACADOR sí debe poder pasar a LISTO_DESPACHO');
    console.log('  ✓ EMPACADO -> LISTO_DESPACHO: solo autorizado para EMPACADOR (otros 403).');

    // ---------------------------------------------------------------------------
    // 2. AISLAMIENTO POR ALMACÉN: VISIBILIDAD Y OPERACIÓN EXCLUSIVA
    // ---------------------------------------------------------------------------
    console.log('\n2. Probando aislamiento por almacén: cada rol ve y opera únicamente pedidos de su sucursal...');

    const pedidoSucre = crearPedidoPrueba(1, 'ENVIO_DOMICILIO'); // Almacén 1
    const pedidoLaPaz = crearPedidoPrueba(2, 'ENVIO_DOMICILIO'); // Almacén 2

    // 2.1 Preparador Sucre lista pedidos: solo debe recibir pedidos de Almacén 1
    res = await fetch(`${baseUrl}/pedidos`, {
      headers: { Authorization: `Bearer ${tokenPrepSucre}` },
    });
    assert.strictEqual(res.status, 200);
    const bodyListPrepSucre = await res.json();
    assert(bodyListPrepSucre.ok);
    const pedidosPrepSucre = bodyListPrepSucre.data;
    assert(pedidosPrepSucre.length > 0, 'Debe retornar pedidos para Almacén 1');
    const todosSucre = pedidosPrepSucre.every(p => Number(p.almacen_id) === 1);
    assert.strictEqual(todosSucre, true, 'PREPARADOR Sucre NO debe ver pedidos de La Paz ni otras sucursales');

    // 2.2 Empacador Sucre lista pedidos: solo debe recibir pedidos de Almacén 1
    res = await fetch(`${baseUrl}/pedidos`, {
      headers: { Authorization: `Bearer ${tokenEmpSucre}` },
    });
    assert.strictEqual(res.status, 200);
    const bodyListEmpSucre = await res.json();
    const todosEmpSucre = bodyListEmpSucre.data.every(p => Number(p.almacen_id) === 1);
    assert.strictEqual(todosEmpSucre, true, 'EMPACADOR Sucre NO debe ver pedidos de otra sucursal');

    // 2.3 Preparador Sucre intenta consultar pedido de La Paz por ID -> 403 Forbidden
    res = await fetch(`${baseUrl}/pedidos/${pedidoLaPaz}`, {
      headers: { Authorization: `Bearer ${tokenPrepSucre}` },
    });
    assert.strictEqual(res.status, 403, 'Preparador Sucre debe recibir 403 al intentar consultar pedido de La Paz');

    // 2.4 Preparador Sucre intenta transicionar pedido de La Paz -> 403 Forbidden
    res = await fetch(`${baseUrl}/pedidos/${pedidoLaPaz}/estado`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenPrepSucre}` },
      body: JSON.stringify({ nuevo_estado: 'EN_PREPARACION' }),
    });
    assert.strictEqual(res.status, 403, 'Preparador Sucre debe recibir 403 al intentar operar pedido de La Paz');

    // 2.5 Empacador Sucre intenta operar pedido de La Paz -> 403 Forbidden
    res = await fetch(`${baseUrl}/pedidos/${pedidoLaPaz}/estado`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenEmpSucre}` },
      body: JSON.stringify({ nuevo_estado: 'EMPACADO' }),
    });
    assert.strictEqual(res.status, 403, 'Empacador Sucre debe recibir 403 al operar pedido de La Paz');

    // 2.6 Preparador La Paz sí puede consultar y operar su pedido de La Paz
    res = await fetch(`${baseUrl}/pedidos/${pedidoLaPaz}`, {
      headers: { Authorization: `Bearer ${tokenPrepLaPaz}` },
    });
    assert.strictEqual(res.status, 200, 'Preparador La Paz sí puede consultar su propio pedido de La Paz');

    console.log('  ✓ Filtros y aislamiento estricto por almacén comprobados al 100%.');

    // ---------------------------------------------------------------------------
    // 3. CHECKLIST DE PREPARACIÓN (PICKING) Y SUGERENCIA FEFO
    // ---------------------------------------------------------------------------
    console.log('\n3. Probando checklist interactivo de picking con sugerencia FEFO e incidencias...');

    const pedidoChecklist = crearPedidoPrueba(1, 'ENVIO_DOMICILIO');

    // 3.1 Consulta de sugerencias FEFO
    res = await fetch(`${baseUrl}/preparacion/${pedidoChecklist}`, {
      headers: { Authorization: `Bearer ${tokenPrepSucre}` },
    });
    assert.strictEqual(res.status, 200, 'Endpoint /api/preparacion/:id debe responder 200 para preparador autorizado');
    const dataPrep = await res.json();
    assert(dataPrep.ok);
    assert(Array.isArray(dataPrep.data.sugerencias_fefo), 'Debe retornar array de sugerencias FEFO');
    assert(dataPrep.data.sugerencias_fefo.length > 0, 'Debe haber sugerencias para los productos del pedido');
    const primeraSugerencia = dataPrep.data.sugerencias_fefo[0];
    assert(primeraSugerencia.lotes.length > 0, 'Debe sugerir al menos un lote disponible');
    console.log(`  ✓ Sugerencia FEFO generada: Producto '${primeraSugerencia.producto_nombre}' con lote sugerido '${primeraSugerencia.lotes[0].lote_codigo}'.`);

    // 3.2 Guardado de checklist de picking con incidencia de stock
    const itemsChecklist = [
      { producto_id: 1, sku: 'BOM-SUR-250', lote_codigo: primeraSugerencia.lotes[0].lote_codigo, cantidad_recolectada: 2, verificado: true },
      { producto_id: 2, sku: 'TAB-AMA-70-100', lote_codigo: 'LOTE-SUC-02', cantidad_recolectada: 0, verificado: false, falta_stock: true },
    ];

    res = await fetch(`${baseUrl}/preparacion/${pedidoChecklist}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenPrepSucre}` },
      body: JSON.stringify({
        checklist_picking: itemsChecklist,
        incidencia_stock: 1,
        detalle_incidencia: 'Falta 1 unidad de tableta amarga en percha B2',
        notas: 'Se solicitó reposición inmediata',
      }),
    });
    assert.strictEqual(res.status, 200, 'Guardado de checklist con incidencia debe responder 200');
    const bodyCheckIncidencia = await res.json();
    assert.strictEqual(bodyCheckIncidencia.data.preparacion.incidencia_stock, 1);
    assert.strictEqual(bodyCheckIncidencia.data.preparacion.estado, 'INCIDENCIA');
    console.log('  ✓ Checklist con incidencia de stock registrado en pedido_preparacion (estado INCIDENCIA).');

    // 3.3 Guardado de checklist exitoso con avance de estado a PREPARADO
    const itemsChecklistOK = [
      { producto_id: 1, sku: 'BOM-SUR-250', lote_codigo: primeraSugerencia.lotes[0].lote_codigo, cantidad_recolectada: 2, verificado: true },
      { producto_id: 2, sku: 'TAB-AMA-70-100', lote_codigo: 'LOTE-SUC-02', cantidad_recolectada: 1, verificado: true },
    ];

    res = await fetch(`${baseUrl}/preparacion/${pedidoChecklist}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenPrepSucre}` },
      body: JSON.stringify({
        checklist_picking: itemsChecklistOK,
        incidencia_stock: 0,
        detalle_incidencia: '',
        avanzar_estado: true,
      }),
    });
    assert.strictEqual(res.status, 200);
    const bodyCheckOK = await res.json();
    assert.strictEqual(bodyCheckOK.data.preparacion.incidencia_stock, 0);
    assert.strictEqual(bodyCheckOK.data.preparacion.estado, 'COMPLETADO');
    assert.strictEqual(bodyCheckOK.data.pedido.estado_pedido, 'PREPARADO');
    console.log('  ✓ Checklist completo guardado y pedido transicionado automáticamente a PREPARADO.');

    // ---------------------------------------------------------------------------
    // 4. FLUJO COMPLETO PAGADO -> LISTO (DOMICILIO Y RECOJO)
    // ---------------------------------------------------------------------------
    console.log('\n4. Probando flujo completo Pagado -> Listo (PAGADO -> EN_PREPARACION -> PREPARADO -> EMPACADO -> LISTO)...');

    // 4.1 Flujo Envío a Domicilio -> Finaliza en LISTO_DESPACHO
    const pedidoDomicilio = crearPedidoPrueba(1, 'ENVIO_DOMICILIO');

    // Paso A: Iniciar Preparación
    res = await fetch(`${baseUrl}/pedidos/${pedidoDomicilio}/estado`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenPrepSucre}` },
      body: JSON.stringify({ nuevo_estado: 'EN_PREPARACION' }),
    });
    assert.strictEqual(res.status, 200);
    let pedDom = (await res.json()).data;
    assert.strictEqual(pedDom.estado_pedido, 'EN_PREPARACION');

    // Paso B: Finalizar Picking -> PREPARADO
    res = await fetch(`${baseUrl}/pedidos/${pedidoDomicilio}/estado`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenPrepSucre}` },
      body: JSON.stringify({
        nuevo_estado: 'PREPARADO',
        checklist_picking: [{ sku: 'BOM-SUR-250', recolectado: 2 }],
      }),
    });
    assert.strictEqual(res.status, 200);
    pedDom = (await res.json()).data;
    assert.strictEqual(pedDom.estado_pedido, 'PREPARADO');

    // Paso C: Iniciar Empaque -> EMPACADO
    res = await fetch(`${baseUrl}/pedidos/${pedidoDomicilio}/estado`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenEmpSucre}` },
      body: JSON.stringify({ nuevo_estado: 'EMPACADO' }),
    });
    assert.strictEqual(res.status, 200);
    pedDom = (await res.json()).data;
    assert.strictEqual(pedDom.estado_pedido, 'EMPACADO');

    // Paso D: Checklist de Empaque con Térmico y Tarjeta -> LISTO_DESPACHO
    res = await fetch(`${baseUrl}/empaque/${pedidoDomicilio}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenEmpSucre}` },
      body: JSON.stringify({
        empaque_termico: 1,
        tarjeta_mensaje: 1,
        texto_tarjeta: '¡Feliz cumpleaños con amor!',
        peso_kg: 1.45,
        numero_cajas: 1,
        checklist_empaque: [{ item: 'Gel refrigerante', verificado: true }, { item: 'Caja sellada', verificado: true }],
        avanzar_estado: true,
      }),
    });
    assert.strictEqual(res.status, 200);
    const bodyEmpFin = await res.json();
    assert.strictEqual(bodyEmpFin.data.pedido.estado_pedido, 'LISTO_DESPACHO', 'Envío a domicilio debe transicionar a LISTO_DESPACHO');
    assert.strictEqual(bodyEmpFin.data.empaque.empaque_termico, 1);
    console.log('  ✓ Flujo Envio a Domicilio: PAGADO -> EN_PREPARACION -> PREPARADO -> EMPACADO -> LISTO_DESPACHO verificado.');

    // 4.2 Flujo Recojo en Agencia -> Finaliza en LISTO_RECOJO
    const pedidoRecojo = crearPedidoPrueba(1, 'RECOJO_AGENCIA');

    // Preparación directa a PREPARADO
    await fetch(`${baseUrl}/pedidos/${pedidoRecojo}/estado`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenPrepSucre}` },
      body: JSON.stringify({ nuevo_estado: 'EN_PREPARACION' }),
    });
    await fetch(`${baseUrl}/pedidos/${pedidoRecojo}/estado`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenPrepSucre}` },
      body: JSON.stringify({ nuevo_estado: 'PREPARADO' }),
    });
    await fetch(`${baseUrl}/pedidos/${pedidoRecojo}/estado`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenEmpSucre}` },
      body: JSON.stringify({ nuevo_estado: 'EMPACADO' }),
    });

    // Empacador envía 'LISTO' genérico -> debe resolver a 'LISTO_RECOJO' por ser RECOJO_AGENCIA
    res = await fetch(`${baseUrl}/pedidos/${pedidoRecojo}/estado`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenEmpSucre}` },
      body: JSON.stringify({ nuevo_estado: 'LISTO' }),
    });
    assert.strictEqual(res.status, 200);
    const bodyRecojoListo = await res.json();
    assert.strictEqual(bodyRecojoListo.data.estado_pedido, 'LISTO_RECOJO', 'Recojo en agencia con nuevo_estado=LISTO debe resolver a LISTO_RECOJO');
    console.log('  ✓ Flujo Recojo en Agencia: resolución automática a LISTO_RECOJO verificada.');

    // 4.3 Verificación de la auditoría en pedido_historial_estados
    const historial = db.prepare('SELECT * FROM pedido_historial_estados WHERE pedido_id = ? ORDER BY id ASC').all(pedidoDomicilio);
    assert(historial.length >= 4, 'Debe haber al menos 4 transiciones auditadas en el historial');
    const estadosSecuencia = historial.map(h => h.estado_nuevo);
    assert(estadosSecuencia.includes('EN_PREPARACION'), 'Historial debe incluir EN_PREPARACION');
    assert(estadosSecuencia.includes('PREPARADO'), 'Historial debe incluir PREPARADO');
    assert(estadosSecuencia.includes('EMPACADO'), 'Historial debe incluir EMPACADO');
    assert(estadosSecuencia.includes('LISTO_DESPACHO'), 'Historial debe incluir LISTO_DESPACHO');
    console.log('  ✓ Trazabilidad inmutable en pedido_historial_estados comprobada con éxito.');

    // ---------------------------------------------------------------------------
    // 5. RESILIENCIA: FALLOS EN NOTIFICACIONES NUNCA BLOQUEAN EL CAMBIO DE ESTADO
    // ---------------------------------------------------------------------------
    console.log('\n5. Probando resiliencia: fallo en notificaciones nunca bloquea el cambio de estado...');

    const pedidoResiliencia = crearPedidoPrueba(1, 'ENVIO_DOMICILIO');

    // Interceptar temporalmente notificarCambioEstado simulando caída de servicio / red
    const originalNotificar = NotificacionesService.notificarCambioEstado;
    NotificacionesService.notificarCambioEstado = async function () {
      throw new Error('SIMULACIÓN_ERROR_RED: API externa de notificaciones inalcanzable');
    };

    try {
      // Intentar cambio de estado a EN_PREPARACION mientras las notificaciones fallan
      res = await fetch(`${baseUrl}/pedidos/${pedidoResiliencia}/estado`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenPrepSucre}` },
        body: JSON.stringify({ nuevo_estado: 'EN_PREPARACION' }),
      });

      assert.strictEqual(res.status, 200, 'El cambio de estado debe responder 200 OK aun si el servicio de notificaciones falla');
      const bodyResiliente = await res.json();
      assert.strictEqual(bodyResiliente.ok, true);
      assert.strictEqual(bodyResiliente.data.estado_pedido, 'EN_PREPARACION', 'El estado del pedido en BD debe haberse actualizado a EN_PREPARACION');

      // Verificar en base de datos directamente
      const pedidoEnBd = Pedido.findById(pedidoResiliencia);
      assert.strictEqual(pedidoEnBd.estado_pedido, 'EN_PREPARACION', 'El pedido debe estar en EN_PREPARACION en SQLite');
      console.log('  ✓ Resiliencia comprobada: Falla forzada en notificaciones no interrumpió la transición a EN_PREPARACION.');
    } finally {
      // Restaurar método original
      NotificacionesService.notificarCambioEstado = originalNotificar;
    }

    console.log('\n======================================================');
    console.log('✅ TODAS LAS PRUEBAS DE LA FASE 7A PASARON AL 100%');
    console.log('======================================================\n');
  } finally {
    // Limpieza de pedidos de prueba creados
    for (const id of pedidosCreadosParaLimpieza) {
      try {
        db.prepare('DELETE FROM pedido_preparacion WHERE pedido_id = ?').run(id);
        db.prepare('DELETE FROM pedido_empaque WHERE pedido_id = ?').run(id);
        db.prepare('DELETE FROM pedido_historial_estados WHERE pedido_id = ?').run(id);
        db.prepare('DELETE FROM pedido_detalles WHERE pedido_id = ?').run(id);
        db.prepare('DELETE FROM pedidos WHERE id = ?').run(id);
      } catch (_e) {}
    }

    server.close();
  }
}

if (require.main === module) {
  ejecutarPruebasFase7A().catch(err => {
    console.error('❌ Error en pruebas Fase 7A:', err);
    process.exit(1);
  });
}

module.exports = ejecutarPruebasFase7A;
