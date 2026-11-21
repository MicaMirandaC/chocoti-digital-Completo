/**
 * @file tests/catalog_inventory.test.js
 * @description Suite de pruebas automatizadas para Fase 4:
 * 1. Catálogo y buscador insensible a tildes/mayúsculas.
 * 2. Disponibilidad y semáforos de stock (Disponible, Pocas unidades, Agotado).
 * 3. Lista de deseos (CRUD autenticado y sincronización de visitante).
 * 4. Control de inventario, aislamiento por almacén y roles (Admin vs Operador).
 * 5. Auditoría Kardex y gestión de lotes FEFO.
 * 6. CRUD de SKUs protegido por RBAC.
 */

'use strict';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_jwt_secret_sucre_bolivia_2026';
process.env.DB_PATH = 'database/chocoti.db';

const assert = require('assert');
const app = require('../backend/src/app');
const AuthService = require('../backend/src/services/authService');

async function ejecutarPruebasFase4() {
  console.log('\n======================================================');
  console.log('🧪 INICIANDO PRUEBAS FASE 4: CATÁLOGO E INVENTARIO');
  console.log('======================================================\n');

  // Iniciar servidor en puerto efímero para pruebas HTTP reales
  const server = app.listen(0);
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}/api`;

  try {
    // Obtener tokens de prueba para ADMIN, OPERADOR DE SUCRE y CLIENTE
    const authAdmin = await AuthService.login({ email: 'admin@chocolatesti.bo', password: 'Admin2024!', ip: '127.0.0.1' });
    const tokenAdmin = authAdmin.token;

    const authOperador = await AuthService.login({ email: 'operador.sucre@chocolatesti.bo', password: 'Operador2024!', ip: '127.0.0.1' });
    const tokenOperador = authOperador.token;

    const authCliente = await AuthService.login({ email: 'cliente@gmail.com', password: 'Cliente2024!', ip: '127.0.0.1' });
    const tokenCliente = authCliente.token;

    // ---------------------------------------------------------------------------
    // 1. CATÁLOGO: Búsqueda insensible a tildes, mayúsculas y filtros
    // ---------------------------------------------------------------------------
    console.log('1. Probando búsqueda en catálogo (tildes, mayúsculas y SKU)...');

    // Buscar "bombon" sin tilde debe coincidir con productos que tienen "bombón"
    const respSinTilde = await fetch(`${baseUrl}/productos?q=bombon`);
    assert.strictEqual(respSinTilde.status, 200);
    const dataSinTilde = await respSinTilde.json();

    assert.ok(dataSinTilde.total > 0, 'La búsqueda sin tilde "bombon" debe retornar resultados');
    const todosTienenBombon = dataSinTilde.data.every(p =>
      p.nombre.toLowerCase().includes('bombón') || p.sku.toLowerCase().includes('bom')
    );
    assert.ok(todosTienenBombon, 'Todos los resultados deben coincidir con bombón o bom');
    console.log(`  ✓ Búsqueda "bombon" -> ${dataSinTilde.total} productos encontrados (ignora tildes)`);

    // Buscar por SKU exacto en minúsculas: "3bolbom100"
    const respSku = await fetch(`${baseUrl}/productos?q=3bolbom100`);
    assert.strictEqual(respSku.status, 200);
    const dataSku = await respSku.json();

    assert.strictEqual(dataSku.total, 1);
    assert.strictEqual(dataSku.data[0].sku, '3BOLBOM100');
    console.log('  ✓ Búsqueda por SKU exacto insensible a mayúsculas verificado');

    // Sugerencias de autocompletado en vivo
    const respSugerencias = await fetch(`${baseUrl}/productos/sugerencias?q=almen`);
    assert.strictEqual(respSugerencias.status, 200);
    const dataSugerencias = await respSugerencias.json();

    assert.ok(Array.isArray(dataSugerencias), 'Sugerencias debe retornar un array');
    assert.ok(dataSugerencias.length > 0, 'Debe sugerir productos con "almen" (almendras)');
    console.log(`  ✓ Endpoint de sugerencias funcional (${dataSugerencias.length} sugerencias devueltas)`);

    // Categorías
    const respCategorias = await fetch(`${baseUrl}/categorias`);
    assert.strictEqual(respCategorias.status, 200);
    const dataCategorias = await respCategorias.json();

    assert.ok(dataCategorias.length >= 7, 'Debe haber al menos 7 categorías activas');
    console.log(`  ✓ Endpoint de categorías retorna ${dataCategorias.length} categorías oficiales`);

    // ---------------------------------------------------------------------------
    // 2. DISPONIBILIDAD Y SEMÁFOROS DE STOCK
    // ---------------------------------------------------------------------------
    console.log('\n2. Verificando cálculo de disponibilidad y semáforos de stock...');

    const respProds = await fetch(`${baseUrl}/productos`);
    assert.strictEqual(respProds.status, 200);
    const dataProds = await respProds.json();

    const productoSemilla = dataProds.data[0];
    assert.ok(productoSemilla.stock_total !== undefined, 'Debe incluir stock_total');
    assert.ok(productoSemilla.stock_reservado !== undefined, 'Debe incluir stock_reservado');
    assert.ok(productoSemilla.stock_disponible !== undefined, 'Debe incluir stock_disponible');
    assert.ok(['Disponible', 'Pocas unidades', 'Agotado'].includes(productoSemilla.estado_stock),
      'El estado_stock debe ser uno de los 3 valores de semáforo');
    console.log(`  ✓ Producto "${productoSemilla.nombre}" tiene estado_stock: ${productoSemilla.estado_stock} (Disponible: ${productoSemilla.stock_disponible})`);

    // ---------------------------------------------------------------------------
    // 3. LISTA DE DESEOS: Favoritos y Fusión de Visitante
    // ---------------------------------------------------------------------------
    console.log('\n3. Probando Lista de Deseos (CRUD autenticado y sincronización de visitante)...');

    // Agregar producto a favoritos
    const respAddDeseo = await fetch(`${baseUrl}/deseos`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCliente}`
      },
      body: JSON.stringify({ producto_id: productoSemilla.id })
    });
    assert.strictEqual(respAddDeseo.status, 201);

    // Consultar lista
    const respGetDeseos = await fetch(`${baseUrl}/deseos`, {
      headers: { Authorization: `Bearer ${tokenCliente}` }
    });
    assert.strictEqual(respGetDeseos.status, 200);
    const dataDeseos = await respGetDeseos.json();

    assert.ok(dataDeseos.data.some(d => d.producto_id === productoSemilla.id), 'El producto debe estar en favoritos');
    console.log('  ✓ Producto agregado y listado en la lista de deseos con éxito');

    // Sincronizar array de visitante (fusión al login)
    const respSync = await fetch(`${baseUrl}/deseos/sincronizar`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCliente}`
      },
      body: JSON.stringify({ productos: [1, 2, 3] })
    });
    assert.strictEqual(respSync.status, 200);
    const dataSync = await respSync.json();

    assert.ok(dataSync.total >= 3, 'La lista debe incluir los productos fusionados');
    console.log(`  ✓ Sincronización de lista de visitante completada (${dataSync.total} productos en total)`);

    // Eliminar producto de favoritos
    const respDelDeseo = await fetch(`${baseUrl}/deseos/${productoSemilla.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenCliente}` }
    });
    assert.strictEqual(respDelDeseo.status, 200);
    console.log('  ✓ Eliminación de favorito confirmada');

    // ---------------------------------------------------------------------------
    // 4. AISLAMIENTO MULTITENANT POR ALMACÉN Y PERMISOS RBAC
    // ---------------------------------------------------------------------------
    console.log('\n4. Verificando aislamiento por almacén y control RBAC...');

    // Operador intenta consultar inventario general: el backend debe restringirlo a su almacén asignado (Sucre, id 1)
    const respInvOp = await fetch(`${baseUrl}/inventario?almacen_id=2`, {
      headers: { Authorization: `Bearer ${tokenOperador}` }
    });
    assert.strictEqual(respInvOp.status, 200);
    const dataInvOp = await respInvOp.json();

    assert.strictEqual(dataInvOp.tipo, 'almacen');
    assert.strictEqual(dataInvOp.almacen_id, 1, 'Operador de Sucre debe ser forzado a su almacén 1 por middleware');
    console.log('  ✓ Operador de Almacén restringido forzosamente a su sucursal (almacen_id = 1)');

    // Cliente no puede acceder al inventario operativo (403 Forbidden)
    const respInvCli = await fetch(`${baseUrl}/inventario`, {
      headers: { Authorization: `Bearer ${tokenCliente}` }
    });
    assert.strictEqual(respInvCli.status, 403);
    console.log('  ✓ Acceso denegado a clientes en endpoints de inventario operativo (HTTP 403)');

    // Administrador puede consultar vista consolidada global
    const respInvAdm = await fetch(`${baseUrl}/inventario`, {
      headers: { Authorization: `Bearer ${tokenAdmin}` }
    });
    assert.strictEqual(respInvAdm.status, 200);
    const dataInvAdm = await respInvAdm.json();

    assert.strictEqual(dataInvAdm.tipo, 'consolidado');
    assert.ok(dataInvAdm.items.length >= 12, 'Admin debe ver consolidado de todos los SKUs');
    console.log('  ✓ Administrador accede a matriz consolidada nacional');

    // ---------------------------------------------------------------------------
    // 5. ENTRADA DE MERCADERÍA, KARDEX Y LOTES FEFO
    // ---------------------------------------------------------------------------
    console.log('\n5. Probando entrada de mercadería, lotes FEFO y auditoría Kardex...');

    const codLoteTest = `LOT-TEST-${Date.now()}`;
    const respEntrada = await fetch(`${baseUrl}/inventario/entradas`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenAdmin}`
      },
      body: JSON.stringify({
        producto_id: 1,
        almacen_id: 1,
        cantidad: 25,
        lote_codigo: codLoteTest,
        fecha_vencimiento: '2027-12-31',
        motivo: 'Entrada de prueba automatizada'
      })
    });
    assert.strictEqual(respEntrada.status, 201);
    const dataEntrada = await respEntrada.json();

    assert.strictEqual(dataEntrada.cantidad_ingresada, 25);
    assert.ok(dataEntrada.lote, 'Debe haber creado el lote');
    assert.ok(dataEntrada.kardex_id, 'Debe haber registrado en Kardex');
    console.log('  ✓ Entrada de 25 unidades registrada con lote y movimiento de Kardex');

    // Verificar movimiento en Kardex
    const respKardex = await fetch(`${baseUrl}/inventario/kardex?tipo_movimiento=ENTRADA`, {
      headers: { Authorization: `Bearer ${tokenAdmin}` }
    });
    assert.strictEqual(respKardex.status, 200);
    const dataKardex = await respKardex.json();

    assert.ok(dataKardex.data.some(k => k.id === dataEntrada.kardex_id), 'El movimiento debe constar en Kardex');
    console.log('  ✓ Auditoría de Kardex registra la entrada correctamente');

    // Ajuste manual de inventario (-5 unidades por merma)
    const respAjuste = await fetch(`${baseUrl}/inventario/ajustes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenAdmin}`
      },
      body: JSON.stringify({
        producto_id: 1,
        almacen_id: 1,
        cantidad_delta: -5,
        motivo: 'Rotura durante acomodo en estante'
      })
    });
    assert.strictEqual(respAjuste.status, 200);
    const dataAjuste = await respAjuste.json();

    assert.ok(dataAjuste.kardex_id, 'El ajuste debe generar registro en Kardex');
    console.log('  ✓ Ajuste negativo (-5) registrado con motivo auditado');

    // Traspaso entre almacenes (Sucre id 1 -> La Paz id 2)
    const respTraspaso = await fetch(`${baseUrl}/inventario/traspasos`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenAdmin}`
      },
      body: JSON.stringify({
        producto_id: 1,
        almacen_origen_id: 1,
        almacen_destino_id: 2,
        cantidad: 10,
        motivo: 'Traspaso interalmacén para cobertura La Paz'
      })
    });
    assert.strictEqual(respTraspaso.status, 200);
    const dataTraspaso = await respTraspaso.json();

    assert.strictEqual(dataTraspaso.cantidad, 10);
    console.log('  ✓ Traspaso interalmacén de 10 unidades ejecutado correctamente');

    // Alertas de stock crítico y vencimiento
    const respAlertas = await fetch(`${baseUrl}/inventario/alertas`, {
      headers: { Authorization: `Bearer ${tokenAdmin}` }
    });
    assert.strictEqual(respAlertas.status, 200);
    const dataAlertas = await respAlertas.json();

    assert.ok(dataAlertas.resumen !== undefined, 'Debe incluir resumen de alertas');
    console.log(`  ✓ Alertas consultadas: ${dataAlertas.resumen.total_alertas_stock} de stock, ${dataAlertas.resumen.total_alertas_vencimiento} de vencimientos`);

    // ---------------------------------------------------------------------------
    // 6. CRUD DE PRODUCTOS / SKUs PROTEGIDO POR RBAC
    // ---------------------------------------------------------------------------
    console.log('\n6. Probando CRUD de SKUs (Permisos y operaciones)...');

    // Cliente u Operador no pueden crear SKU
    const respDenyCreate = await fetch(`${baseUrl}/productos`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenOperador}`
      },
      body: JSON.stringify({ sku: '3TEST999', nombre: 'Test', precio: 50, categoria_id: 1 })
    });
    assert.strictEqual(respDenyCreate.status, 403);
    console.log('  ✓ Creación de SKU denegada a Operador (Solo Admin, HTTP 403)');

    // Admin crea nuevo SKU
    const nuevoSku = `SKU-TEST-${Date.now()}`;
    const respCreateSku = await fetch(`${baseUrl}/productos`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenAdmin}`
      },
      body: JSON.stringify({
        sku: nuevoSku,
        nombre: 'Chocolate Especial de Almendras Silvestres',
        descripcion: 'Edición limitada con almendras de la Amazonía boliviana.',
        precio: 65.5,
        categoria_id: 1,
        stock_minimo: 15
      })
    });
    assert.strictEqual(respCreateSku.status, 201);
    const dataCreateSku = await respCreateSku.json();

    const productoCreadoId = dataCreateSku.data.id;
    assert.strictEqual(dataCreateSku.data.sku, nuevoSku);
    console.log(`  ✓ Administrador creó nuevo SKU: ${nuevoSku} (ID: ${productoCreadoId})`);

    // Actualizar SKU
    const respUpdateSku = await fetch(`${baseUrl}/productos/${productoCreadoId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenAdmin}`
      },
      body: JSON.stringify({
        nombre: 'Chocolate Especial de Almendras Silvestres Modificado',
        precio: 70.0
      })
    });
    assert.strictEqual(respUpdateSku.status, 200);
    console.log('  ✓ SKU modificado exitosamente');

    // Dar de baja lógica
    const respDeleteSku = await fetch(`${baseUrl}/productos/${productoCreadoId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenAdmin}` }
    });
    assert.strictEqual(respDeleteSku.status, 200);

    // Comprobar que en listado público de activos ya no aparece
    const respActivos = await fetch(`${baseUrl}/productos?solo_activos=true`);
    assert.strictEqual(respActivos.status, 200);
    const dataActivos = await respActivos.json();

    const existeEnActivos = dataActivos.data.some(p => p.id === productoCreadoId);
    assert.strictEqual(existeEnActivos, false, 'El producto dado de baja no debe figurar en el catálogo de clientes');
    console.log('  ✓ Baja lógica confirmada: producto retirado del catálogo público');

    console.log('\n======================================================');
    console.log('🎉 TODAS LAS PRUEBAS DE LA FASE 4 PASARON EXITOSAMENTE');
    console.log('======================================================\n');
  } finally {
    const dbInst = require('../backend/src/config/database');
    try {
      dbInst.prepare("DELETE FROM inventario WHERE producto_id IN (SELECT id FROM productos WHERE sku LIKE 'SKU-TEST%')").run();
      dbInst.prepare("DELETE FROM productos WHERE sku LIKE 'SKU-TEST%'").run();
    } catch (_) {}
    server.close();
  }
}

ejecutarPruebasFase4().catch((err) => {
  console.error('\n❌ ERROR EN PRUEBAS FASE 4:', err);
  process.exit(1);
});
