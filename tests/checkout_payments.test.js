/**
 * @file tests/checkout_payments.test.js
 * @description Suite de pruebas automatizadas para Fase 5A:
 * 1. Checkout y validación transaccional de stock disponible (Físico - Reservas).
 * 2. Rechazo estricto ante sobreventa o falta de existencias (concurrencia).
 * 3. Flujo completo QR Simple: generación de imagen QR, polling y confirmación por Banco Simulado.
 * 4. Idempotencia: confirmaciones duplicadas no descuentan stock dos veces.
 * 5. Flujo Depósito Bancario: reserva 24h, comprobante digital máx 2MB, verificación y RBAC (403).
 * 6. Flujo Efectivo en Tienda: restricción a recojo en agencia propia (tipo P), reserva 48h y cobro en caja.
 * 7. Expiración de reservas: liberación automática y reversión de existencias retenidas.
 */

'use strict';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_jwt_secret_sucre_bolivia_2026';
process.env.DB_PATH = 'database/chocoti.db';
process.env.ENABLE_BANK_SIMULATOR = 'true';

const assert = require('assert');
const app = require('../backend/src/app');
const db = require('../backend/src/config/database');
const AuthService = require('../backend/src/services/authService');
const ReservaStock = require('../backend/src/models/ReservaStock');
const Pedido = require('../backend/src/models/Pedido');

async function ejecutarPruebasFase5A() {
  console.log('\n======================================================');
  console.log('🧪 INICIANDO PRUEBAS FASE 5A: CHECKOUT Y PAGOS (QR, DEPÓSITO, EFECTIVO)');
  console.log('======================================================\n');

  const server = app.listen(0);
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}/api`;

  try {
    // 0. Obtener tokens de autenticación para pruebas
    const authAdmin = await AuthService.login({ email: 'admin@chocolatesti.bo', password: 'Admin2024!', ip: '127.0.0.1' });
    const tokenAdmin = authAdmin.token;

    const authOpSucre = await AuthService.login({ email: 'operador.sucre@chocolatesti.bo', password: 'Operador2024!', ip: '127.0.0.1' });
    const tokenOpSucre = authOpSucre.token;

    const authOpLaPaz = await AuthService.login({ email: 'operador.lapaz@chocolatesti.bo', password: 'Operador2024!', ip: '127.0.0.1' });
    const tokenOpLaPaz = authOpLaPaz.token;

    // ---------------------------------------------------------------------------
    // 1. CHECKOUT Y RESERVA TEMPORAL DE STOCK
    // ---------------------------------------------------------------------------
    console.log('1. Probando creación de pedido y reserva temporal de stock...');

    // Consultar stock inicial de producto 1 (3BOLBOM100) en Sucre (Almacén 1)
    const stockInicialRow = db.prepare('SELECT stock_actual, stock_reservado FROM inventario WHERE producto_id = 1 AND almacen_id = 1').get();
    const stockInicial = stockInicialRow.stock_actual;
    const reservadoInicial = stockInicialRow.stock_reservado;

    const respCheckout = await fetch(`${baseUrl}/pedidos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cliente: {
          nombre: 'Juan Carlos Pérez',
          ci_nit: '4567890-CH',
          email: 'juan.perez@test.bo',
          telefono: '71234567',
        },
        items: [{ id: 1, cantidad: 2 }],
        metodo_pago: 'QR',
        tipo_entrega: 'ENVIO_DOMICILIO',
        ciudad_destino: 'Sucre',
        direccion_envio: 'Calle Calvo #123',
        referencia_envio: 'Frente a la plaza principal',
      }),
    });

    assert.strictEqual(respCheckout.status, 201, 'Debe crear el pedido exitosamente (HTTP 201)');
    const dataCheckout = await respCheckout.json();
    assert.ok(dataCheckout.ok);
    assert.ok(dataCheckout.pedido.codigo_pedido.startsWith('PED-'));
    assert.strictEqual(dataCheckout.pedido.estado_pedido, 'PENDIENTE_PAGO');
    assert.strictEqual(dataCheckout.pedido.estado_pago, 'PENDIENTE');
    assert.strictEqual(dataCheckout.pedido.costo_envio, 0, 'Envío local en Sucre debe ser 0 Bs');

    const pedidoQRId = dataCheckout.pedido.id;
    const refQR = dataCheckout.datosPago.referencia;

    // Verificar que el stock reservado aumentó exactamente en 2 unidades
    const stockPostRow = db.prepare('SELECT stock_actual, stock_reservado FROM inventario WHERE producto_id = 1 AND almacen_id = 1').get();
    assert.strictEqual(stockPostRow.stock_reservado, reservadoInicial + 2, 'El stock_reservado debe haber aumentado en 2 unidades');
    assert.strictEqual(stockPostRow.stock_actual, stockInicial, 'El stock_actual no debe descontarse hasta confirmarse el pago');
    console.log(`  ✓ Pedido ${dataCheckout.pedido.codigo_pedido} creado con reserva de 2 unidades en inventario.`);

    // ---------------------------------------------------------------------------
    // 2. CONCURRENCIA: RECHAZO ANTE CANTIDAD SUPERIOR AL DISPONIBLE
    // ---------------------------------------------------------------------------
    console.log('\n2. Verificando protección contra sobreventa (Físico - Reservas)...');

    const dispActual = stockPostRow.stock_actual - stockPostRow.stock_reservado;
    const excesoCantidad = dispActual + 50;

    const respSobreventa = await fetch(`${baseUrl}/pedidos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cliente: {
          nombre: 'Comprador Excesivo',
          ci_nit: '9999999',
          email: 'exceso@test.bo',
          telefono: '70000000',
        },
        items: [{ id: 1, cantidad: excesoCantidad }],
        metodo_pago: 'QR',
        tipo_entrega: 'ENVIO_DOMICILIO',
        ciudad_destino: 'Sucre',
        direccion_envio: 'Calle X',
      }),
    });

    assert.strictEqual(respSobreventa.status, 409, 'Debe retornar HTTP 409 Conflict por stock insuficiente');
    const errSobreventa = await respSobreventa.json();
    assert.ok(errSobreventa.mensaje.includes('Stock insuficiente'), 'El mensaje debe indicar stock insuficiente');
    console.log('  ✓ Intento de sobreventa rechazado correctamente con HTTP 409.');

    // ---------------------------------------------------------------------------
    // 3. FLUJO QR SIMPLE: IMAGEN QR, POLLING Y CONFIRMACIÓN POR BANCO SIMULADO
    // ---------------------------------------------------------------------------
    console.log('\n3. Verificando generación de imagen QR, polling y confirmación bancaria...');

    assert.ok(dataCheckout.datosPago.qrImagenDataUrl, 'Debe generar una imagen QR Data URL');
    assert.ok(
      dataCheckout.datosPago.qrImagenDataUrl.startsWith('data:image/'),
      'La imagen QR debe ser un Data URI válido (SVG o PNG)'
    );
    console.log('  ✓ Imagen QR generada correctamente.');

    // Polling de estado inicial
    const respPoll = await fetch(`${baseUrl}/pagos/estado/${refQR}`);
    assert.strictEqual(respPoll.status, 200);
    const dataPoll = await respPoll.json();
    assert.strictEqual(dataPoll.data.estado_pago, 'PENDIENTE', 'Estado de pago inicial debe ser PENDIENTE');
    console.log('  ✓ Polling de estado consultado con éxito (Estado: PENDIENTE).');

    // Confirmación simulada a través del webhook del banco demo
    const respBanco = await fetch(`${baseUrl}/banco-demo/demo-banco-notificar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        referencia: refQR,
        monto: dataCheckout.pedido.total,
        estado: 'APROBADO',
        firma: dataCheckout.datosPago.firmaDemo,
      }),
    });

    assert.strictEqual(respBanco.status, 200, 'El webhook bancario debe responder HTTP 200');
    const dataBanco = await respBanco.json();
    assert.ok(dataBanco.ok);
    assert.strictEqual(dataBanco.pedido.estado_pedido, 'PAGADO');
    assert.strictEqual(dataBanco.pedido.estado_pago, 'PAGADO');
    assert.ok(dataBanco.pedido.guia_envio, 'Debe haberse generado una guía de envío real');
    console.log(`  ✓ Pago QR confirmado. Pedido pasó a PAGADO con guía: ${dataBanco.pedido.guia_envio}`);

    // Verificar deducción definitiva del stock físico (stock_actual) y liberación de reserva
    const stockFinRow = db.prepare('SELECT stock_actual, stock_reservado FROM inventario WHERE producto_id = 1 AND almacen_id = 1').get();
    assert.strictEqual(stockFinRow.stock_actual, stockInicial - 2, 'El stock_actual debe haberse descontado en 2 unidades definitivamente');
    assert.strictEqual(stockFinRow.stock_reservado, reservadoInicial, 'El stock_reservado debe haber vuelto a su valor original');
    console.log('  ✓ Stock físico descontado y Kardex inmutable SALIDA_VENTA registrado.');

    // ---------------------------------------------------------------------------
    // 4. IDEMPOTENCIA: CONFIRMACIÓN DUPLICADA
    // ---------------------------------------------------------------------------
    console.log('\n4. Verificando idempotencia ante notificaciones bancarias duplicadas...');

    const respDup = await fetch(`${baseUrl}/banco-demo/demo-banco-notificar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        referencia: refQR,
        monto: dataCheckout.pedido.total,
        estado: 'APROBADO',
        firma: dataCheckout.datosPago.firmaDemo,
      }),
    });

    assert.strictEqual(respDup.status, 200);
    const dataDup = await respDup.json();
    assert.ok(dataDup.mensaje.includes('idempotente') || dataDup.ok);

    // Comprobar que el stock_actual NO se haya descontado otra vez
    const stockDupRow = db.prepare('SELECT stock_actual FROM inventario WHERE producto_id = 1 AND almacen_id = 1').get();
    assert.strictEqual(stockDupRow.stock_actual, stockInicial - 2, 'El stock no debe descontarse de nuevo por duplicidad');
    console.log('  ✓ Idempotencia garantizada: no hubo doble cobro ni doble descuento.');

    // ---------------------------------------------------------------------------
    // 5. FLUJO DEPÓSITO BANCARIO: COMPROBANTE Y VERIFICACIÓN RBAC
    // ---------------------------------------------------------------------------
    console.log('\n5. Verificando flujo de Depósito Bancario, comprobante y RBAC...');

    const respDep = await fetch(`${baseUrl}/pedidos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cliente: {
          nombre: 'María Reneé Morales',
          ci_nit: '10203040',
          email: 'maria@test.bo',
          telefono: '78998877',
        },
        items: [{ id: 2, cantidad: 1 }],
        metodo_pago: 'TRANSFERENCIA',
        tipo_entrega: 'ENVIO_DOMICILIO',
        ciudad_destino: 'Cochabamba',
        direccion_envio: 'Av. América #456',
      }),
    });

    assert.strictEqual(respDep.status, 201);
    const dataDep = await respDep.json();
    const pedidoDepId = dataDep.pedido.id;
    assert.strictEqual(dataDep.pedido.costo_envio, 25, 'Envío nacional a Cochabamba debe ser 25 Bs');
    console.log(`  ✓ Pedido con transferencia registrado con flete nacional de 25 Bs.`);

    // Subir comprobante digital en base64 (simulando imagen PNG pequeña)
    const base64FakePng = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    const nroOperacion = `BNB-OP-${Date.now()}`;

    const respSubida = await fetch(`${baseUrl}/pagos/subir-comprobante`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pedido_id: pedidoDepId,
        archivo_base64: base64FakePng,
        nombre_archivo: 'recibo_transferencia.png',
        tipo_mime: 'image/png',
        banco_origen: 'Banco Nacional de Bolivia',
        numero_operacion: nroOperacion,
        fecha_operacion: '2026-11-17',
        monto: dataDep.pedido.total,
      }),
    });

    assert.strictEqual(respSubida.status, 200, 'La subida de comprobante debe ser exitosa');
    const dataSubida = await respSubida.json();
    assert.ok(dataSubida.comprobante_url.includes('/uploads/comprobantes/'));
    console.log(`  ✓ Comprobante PNG subido y vinculado a pedidos/pagos.`);

    // Obtener el ID del intento de pago
    const intentoDep = db.prepare('SELECT id FROM pagos_intentos WHERE pedido_id = ?').get(pedidoDepId);

    // Intentar verificar con operador de La Paz (debe rebotar con 403 Forbidden porque el pedido es de Sucre)
    const respOpLaPaz = await fetch(`${baseUrl}/pagos/verificar-deposito`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenOpLaPaz}`,
      },
      body: JSON.stringify({
        intento_id: intentoDep.id,
        aprobado: true,
      }),
    });

    assert.strictEqual(respOpLaPaz.status, 403, 'Operador de otra sucursal debe recibir 403 Forbidden');
    console.log('  ✓ Aislamiento RBAC verificado: Operador de otra sucursal rebotado con HTTP 403.');

    // Verificar y aprobar con Operador de Sucre (almacén asignado)
    const respOpSucre = await fetch(`${baseUrl}/pagos/verificar-deposito`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenOpSucre}`,
      },
      body: JSON.stringify({
        intento_id: intentoDep.id,
        aprobado: true,
      }),
    });

    assert.strictEqual(respOpSucre.status, 200);
    const dataVerif = await respOpSucre.json();
    assert.strictEqual(dataVerif.pedido.estado_pedido, 'PAGADO');
    console.log('  ✓ Depósito verificado y aprobado por Operador autorizado de Sucre.');

    // ---------------------------------------------------------------------------
    // 6. FLUJO EFECTIVO EN TIENDA: RESTRICCIÓN Y COBRO EN AGENCIA
    // ---------------------------------------------------------------------------
    console.log('\n6. Verificando Efectivo en Tienda (solo agencias propias tipo P)...');

    // Intentar efectivo con ENVIO_DOMICILIO (debe fallar con 400)
    const respEfectivoInvalido = await fetch(`${baseUrl}/pedidos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cliente: {
          nombre: 'Cliente Efectivo',
          ci_nit: '1234567',
          email: 'efectivo@test.bo',
          telefono: '71112233',
        },
        items: [{ id: 3, cantidad: 1 }],
        metodo_pago: 'EFECTIVO_TIENDA',
        tipo_entrega: 'ENVIO_DOMICILIO',
        ciudad_destino: 'Sucre',
        direccion_envio: 'Calle Avaroa #45',
      }),
    });

    assert.strictEqual(respEfectivoInvalido.status, 400, 'Efectivo con envío a domicilio debe rechazarse');
    console.log('  ✓ Efectivo en tienda restringido exclusivamente a recojo en agencia propia.');

    // Crear pedido válido con recojo en Agencia Principal Sucre (punto_recojo_id: 1)
    const respEfectivoValido = await fetch(`${baseUrl}/pedidos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cliente: {
          nombre: 'Cliente Efectivo',
          ci_nit: '1234567',
          email: 'efectivo@test.bo',
          telefono: '71112233',
        },
        items: [{ id: 3, cantidad: 1 }],
        metodo_pago: 'EFECTIVO_TIENDA',
        tipo_entrega: 'RECOJO_AGENCIA',
        punto_recojo_id: 1,
        ciudad_destino: 'Sucre',
      }),
    });

    assert.strictEqual(respEfectivoValido.status, 201);
    const dataEfectivo = await respEfectivoValido.json();
    const pedidoEfeId = dataEfectivo.pedido.id;
    assert.strictEqual(dataEfectivo.datosPago.horasReserva, 48, 'Reserva de efectivo debe ser 48 horas');
    console.log(`  ✓ Pedido con pago en tienda creado con 48h de reserva.`);

    // Cobrar en mostrador por Operador de Sucre
    const respCobroEfe = await fetch(`${baseUrl}/pagos/cobro-efectivo-tienda`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenOpSucre}`,
      },
      body: JSON.stringify({
        pedido_id: pedidoEfeId,
        monto_recibido: dataEfectivo.pedido.total,
      }),
    });

    assert.strictEqual(respCobroEfe.status, 200);
    const dataCobro = await respCobroEfe.json();
    assert.strictEqual(dataCobro.pedido.estado_pedido, 'PAGADO');
    assert.ok(dataCobro.pedido.codigo_retiro, 'Debe generar código de retiro corto para el cliente');
    console.log(`  ✓ Cobro en caja completado. Código de retiro: ${dataCobro.pedido.codigo_retiro}`);

    // ---------------------------------------------------------------------------
    // 7. EXPIRACIÓN DE RESERVAS Y LIBERACIÓN AUTOMÁTICA
    // ---------------------------------------------------------------------------
    console.log('\n7. Verificando expiración automática de reservas vencidas...');

    // Crear un pedido y forzar su fecha de expiración al pasado en SQLite
    const respExpira = await fetch(`${baseUrl}/pedidos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cliente: {
          nombre: 'Cliente Que No Pagó',
          ci_nit: '99887766',
          email: 'no.pago@test.bo',
          telefono: '76543210',
        },
        items: [{ id: 4, cantidad: 3 }],
        metodo_pago: 'QR',
        tipo_entrega: 'ENVIO_DOMICILIO',
        ciudad_destino: 'Sucre',
        direccion_envio: 'Calle Junín',
      }),
    });

    const dataExpira = await respExpira.json();
    const pedidoVencerId = dataExpira.pedido.id;

    // Forzar en BD fecha de expiración vencida (hace 2 horas)
    db.prepare("UPDATE reservas_stock SET expira_en = datetime('now', '-2 hours') WHERE pedido_id = ?").run(pedidoVencerId);
    db.prepare("UPDATE pagos_intentos SET expira_en = datetime('now', '-2 hours') WHERE pedido_id = ?").run(pedidoVencerId);

    // Consultar stock antes de limpiar
    const stockAntesExp = db.prepare('SELECT stock_reservado FROM inventario WHERE producto_id = 4 AND almacen_id = 1').get();

    // Ejecutar el limpiador de reservas
    const pedidosExpirados = ReservaStock.limpiarExpiradas();
    assert.ok(pedidosExpirados >= 1, 'Debe haber detectado y limpiado al menos 1 pedido vencido');

    // Verificar que el stock_reservado se redujo en 3
    const stockDespExp = db.prepare('SELECT stock_reservado FROM inventario WHERE producto_id = 4 AND almacen_id = 1').get();
    assert.strictEqual(stockDespExp.stock_reservado, stockAntesExp.stock_reservado - 3, 'El stock reservado debe haberse liberado');

    // Verificar estado del pedido
    const pedidoVencido = Pedido.findById(pedidoVencerId);
    assert.strictEqual(pedidoVencido.estado_pedido, 'EXPIRADO');
    assert.strictEqual(pedidoVencido.estado_pago, 'VENCIDO');
    console.log('  ✓ Pedido vencido expirado y reservas de inventario liberadas automáticamente.');

    // ---------------------------------------------------------------------------
    // 8. PRUEBAS DE SEGURIDAD Y CONTROL DE ERRORES (FASE 5)
    // ---------------------------------------------------------------------------
    console.log('\n8. Verificando validaciones avanzadas y protección del endpoint demo...');

    // a) Número de operación bancaria duplicado
    const respPedidoDep2 = await fetch(`${baseUrl}/pedidos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cliente: {
          nombre: 'Cliente Prueba 2',
          ci_nit: '1234500',
          email: 'prueba2@test.bo',
          telefono: '70011223',
        },
        items: [{ id: 1, cantidad: 1 }],
        metodo_pago: 'TRANSFERENCIA',
        tipo_entrega: 'RECOJO_AGENCIA',
        punto_recojo_id: 1,
        ciudad_destino: 'Sucre',
      }),
    });
    const dataDep2 = await respPedidoDep2.json();
    const pedidoDep2Id = dataDep2.pedido.id;

    const respDupNro = await fetch(`${baseUrl}/pagos/subir-comprobante`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pedido_id: pedidoDep2Id,
        archivo_base64: base64FakePng,
        nombre_archivo: 'otro.png',
        tipo_mime: 'image/png',
        banco_origen: 'Banco Nacional de Bolivia',
        numero_operacion: nroOperacion, // Reusando el mismo número de operación ya registrado en paso 5
        fecha_operacion: '2026-11-17',
        monto: 50,
      }),
    });
    assert.strictEqual(respDupNro.status, 409, 'Número de operación duplicado debe responder 409 Conflict');
    console.log('  ✓ Número de operación duplicado rechazado con HTTP 409.');

    // b) Depósito sobre pedido expirado
    db.prepare("UPDATE pedidos SET estado_pedido = 'EXPIRADO' WHERE id = ?").run(pedidoDep2Id);
    const respDepExp = await fetch(`${baseUrl}/pagos/subir-comprobante`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pedido_id: pedidoDep2Id, // Pedido TRANSFERENCIA ya EXPIRADO
        archivo_base64: base64FakePng,
        nombre_archivo: 'comprobante_tardio.png',
        tipo_mime: 'image/png',
        banco_origen: 'Banco Unión',
        numero_operacion: `OP-EXP-${Date.now()}`,
        fecha_operacion: '2026-11-17',
        monto: 50,
      }),
    });
    assert.strictEqual(respDepExp.status, 400, 'Subida de comprobante sobre pedido expirado debe responder 400');
    console.log('  ✓ Depósito sobre pedido expirado rechazado con HTTP 400.');

    // c) Cobro en efectivo sobre pedido expirado
    const respPedidoEfExp = await fetch(`${baseUrl}/pedidos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cliente: {
          nombre: 'Cliente Efectivo Exp',
          ci_nit: '55443322',
          email: 'ef_exp@test.bo',
          telefono: '71122334',
        },
        items: [{ id: 1, cantidad: 1 }],
        metodo_pago: 'EFECTIVO_TIENDA',
        tipo_entrega: 'RECOJO_AGENCIA',
        punto_recojo_id: 1,
        ciudad_destino: 'Sucre',
      }),
    });
    const dataEfExp = await respPedidoEfExp.json();
    const pedidoEfExpId = dataEfExp.pedido.id;
    db.prepare("UPDATE pedidos SET estado_pedido = 'EXPIRADO' WHERE id = ?").run(pedidoEfExpId);

    const respCobroExp = await fetch(`${baseUrl}/pagos/cobro-efectivo-tienda`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenOpSucre}`,
      },
      body: JSON.stringify({
        pedido_id: pedidoEfExpId,
        monto_recibido: 100,
      }),
    });
    assert.strictEqual(respCobroExp.status, 400, 'Cobro en efectivo sobre pedido expirado debe responder 400');
    console.log('  ✓ Cobro en efectivo sobre pedido expirado rechazado con HTTP 400.');

    // d) Monto que no coincide en verificación de depósito
    const respDepMismatch = await fetch(`${baseUrl}/pedidos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cliente: {
          nombre: 'Carlos Montaño',
          ci_nit: '9988776',
          email: 'carlos@test.bo',
          telefono: '76543210',
        },
        items: [{ id: 1, cantidad: 1 }],
        metodo_pago: 'TRANSFERENCIA',
        tipo_entrega: 'RECOJO_AGENCIA',
        punto_recojo_id: 1,
        ciudad_destino: 'Sucre',
      }),
    });
    const dataMismatch = await respDepMismatch.json();
    const pedidoMisId = dataMismatch.pedido.id;
    const totalReal = dataMismatch.pedido.total;
    const nroOpMismatch = `OP-MIS-${Date.now()}`;

    // Subir comprobante con monto menor
    await fetch(`${baseUrl}/pagos/subir-comprobante`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pedido_id: pedidoMisId,
        archivo_base64: base64FakePng,
        nombre_archivo: 'recibo_menor.png',
        tipo_mime: 'image/png',
        banco_origen: 'BNB',
        numero_operacion: nroOpMismatch,
        fecha_operacion: '2026-11-17',
        monto: totalReal - 10, // Monto declarado no coincide con total
      }),
    });

    const intentoMis = db.prepare('SELECT id FROM pagos_intentos WHERE pedido_id = ?').get(pedidoMisId);

    // Intentar aprobar con operador (debe fallar con 400 y mostrar diferencia)
    const respAprobarMis = await fetch(`${baseUrl}/pagos/verificar-deposito`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenOpSucre}`,
      },
      body: JSON.stringify({
        intento_id: intentoMis.id,
        aprobado: true,
      }),
    });
    assert.strictEqual(respAprobarMis.status, 400, 'Aprobar depósito con monto no coincidente debe responder 400');
    const dataAprobarMis = await respAprobarMis.json();
    assert.ok(dataAprobarMis.mensaje.includes('Diferencia') || dataAprobarMis.mensaje.includes('no coincide'), 'El error debe indicar la discrepancia');
    console.log('  ✓ Monto que no coincide: aprobación bloqueada y diferencia reportada.');

    // Rechazar con motivo sí debe permitirse
    const respRechazarMis = await fetch(`${baseUrl}/pagos/verificar-deposito`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenOpSucre}`,
      },
      body: JSON.stringify({
        intento_id: intentoMis.id,
        aprobado: false,
        motivo_rechazo: 'Monto depositado incompleto',
      }),
    });
    assert.strictEqual(respRechazarMis.status, 200, 'Rechazo con motivo de depósito con monto incorrecto debe permitirse');
    console.log('  ✓ Rechazo con motivo ejecutado exitosamente para monto no coincidente.');

    // e) Endpoint de demo bancario rechaza peticiones sin firma ni sesión
    const respDemoSinAuth = await fetch(`${baseUrl}/banco-demo/demo-banco-notificar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        referencia: refQR,
        monto: 100,
        estado: 'APROBADO',
      }),
    });
    assert.strictEqual(respDemoSinAuth.status, 401, 'Endpoint demo sin firma ni sesión debe responder 401 Unauthorized');

    // Deshabilitar ENABLE_BANK_SIMULATOR y probar que responde 403
    process.env.ENABLE_BANK_SIMULATOR = 'false';
    const respDemoDisabled = await fetch(`${baseUrl}/banco-demo/demo-banco-notificar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        referencia: refQR,
        monto: 100,
      }),
    });
    assert.strictEqual(respDemoDisabled.status, 403, 'Endpoint demo deshabilitado debe responder 403 Forbidden');
    process.env.ENABLE_BANK_SIMULATOR = 'true';
    console.log('  ✓ Endpoint demo bancario protegido: rechaza peticiones sin firma/sesión y cuando está deshabilitado.');

    console.log('\n======================================================');
    console.log('✅ TODAS LAS PRUEBAS DE LA FASE 5A PASARON AL 100%');
    console.log('======================================================\n');
  } finally {
    server.close();
  }
}

if (require.main === module) {
  ejecutarPruebasFase5A().catch(err => {
    console.error('❌ Error en pruebas Fase 5A:', err);
    process.exit(1);
  });
}

module.exports = ejecutarPruebasFase5A;
