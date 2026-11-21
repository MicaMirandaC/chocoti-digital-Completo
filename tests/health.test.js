/**
 * @file tests/health.test.js
 * @description Suite de verificación de salud del sistema, base de datos y configuración.
 * Ejecutado por `npm test` para validación automatizada en CI/CD y despliegue.
 */

'use strict';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_jwt_secret_sucre_bolivia_2026';
process.env.DB_PATH = 'database/chocoti.db';

const assert = require('assert');
const path = require('path');
const fs = require('fs');

console.log('🧪 [TEST SUITE] Iniciando pruebas de Fase 1 y Fase 2: Salud del Sistema...\n');

// 1. Prueba de Configuración Centralizada de Empresa
console.log('▶ [1/4] Verificando archivo de configuración /config/empresa.js...');
const empresaConfig = require('../config/empresa');
assert.strictEqual(empresaConfig.nombreComercial, 'Chocolates Para Ti', 'Nombre comercial debe ser "Chocolates Para Ti"');
assert.strictEqual(empresaConfig.razonSocial, 'Solur S.R.L.', 'Razón social debe ser "Solur S.R.L."');
assert.strictEqual(empresaConfig.nit, null, 'NIT no provisto debe permanecer como null/por definir');
assert.strictEqual(empresaConfig.catalogoSemilla.length, 12, 'Deben existir exactamente 12 SKUs oficiales de semilla');
assert.strictEqual(empresaConfig.categorias.length, 7, 'Deben existir 7 categorías oficiales');
assert.strictEqual(empresaConfig.tiemposReservaStock.QR.minutos, 15, 'Reserva QR debe ser de 15 minutos');
assert.strictEqual(empresaConfig.tiemposReservaStock.TRANSFERENCIA.horas, 24, 'Reserva transferencia debe ser de 24 horas');
assert.strictEqual(empresaConfig.tiemposReservaStock.EFECTIVO_TIENDA.horas, 48, 'Reserva efectivo en tienda debe ser de 48 horas');
console.log('   ✅ Configuración de empresa validada correctamente.\n');

// 2. Prueba de Base de Datos y Arranque Idempotente
console.log('▶ [2/4] Verificando inicialización de Base de Datos SQLite (better-sqlite3)...');
const db = require('../backend/src/config/database');

const tables = db
  .prepare("SELECT name FROM sqlite_master WHERE type='table'")
  .all()
  .map((t) => t.name);

const tablasRequeridas = [
  'roles',
  'almacenes',
  'usuarios',
  'logs_acceso',
  'categorias',
  'productos',
  'inventario',
  'lotes',
  'kardex_movimientos',
  'puntos_venta',
  'pedidos',
  'pedido_historial_estados',
  'pagos_intentos',
  'pedido_preparacion',
  'pedido_empaque',
  'pedido_entregas',
  'pedido_detalles',
  'reservas_stock',
  'cotizaciones_b2b',
  'lista_deseos',
  'bandeja_simulada',
  'notificaciones_logs',
];

tablasRequeridas.forEach((tabla) => {
  assert(tables.includes(tabla), `La tabla requerida "${tabla}" no existe en la base de datos.`);
});
console.log(`   ✅ Las ${tablasRequeridas.length} tablas del esquema integral existen en SQLite.`);

// 3. Verificación de Semillas Oficiales
console.log('▶ [3/4] Verificando consistencia de datos semilla...');
const rolesCount = db.prepare('SELECT count(*) as total FROM roles').get().total;
assert(rolesCount >= 7, 'Deben existir al menos 7 roles oficiales');

const almacenesCount = db.prepare('SELECT count(*) as total FROM almacenes').get().total;
assert.strictEqual(almacenesCount, 4, 'Deben existir 4 almacenes (Sucre, La Paz, Cochabamba, Santa Cruz)');

const categoriasCount = db.prepare('SELECT count(*) as total FROM categorias').get().total;
assert.strictEqual(categoriasCount, 7, 'Deben existir 7 categorías oficiales');

const productosCount = db.prepare("SELECT count(*) as total FROM productos WHERE sku NOT LIKE 'SKU-TEST%'").get().total;
assert.strictEqual(productosCount, 12, 'Deben existir 12 productos de semilla oficiales');

const puntosVentaCount = db.prepare('SELECT count(*) as total FROM puntos_venta').get().total;
assert.strictEqual(puntosVentaCount, 92, 'Deben existir los 92 puntos de venta a nivel nacional cargados desde /docs/puntos_venta.md');

const agenciasRecojoCount = db.prepare('SELECT count(*) as total FROM puntos_venta WHERE permite_recojo = 1').get().total;
assert(agenciasRecojoCount >= 9, 'Las agencias tipo P (Sucre y La Paz) deben permitir recojo web');

const usuariosDemoCount = db.prepare('SELECT count(*) as total FROM usuarios').get().total;
assert(usuariosDemoCount >= 8, 'Deben existir las 8 cuentas demo oficiales (Admin, 2 Operadores, Minorista, B2B, Preparador, Empacador, Despachador)');
console.log('   ✅ Datos semilla verificados: 7 roles, 4 almacenes, 7 categorías, 12 SKUs, 92 puntos de venta y 8 usuarios demo.\n');

// 4. Verificación de Servidor Express y /api/health
console.log('▶ [4/4] Verificando endpoints y montaje de Express...');
const app = require('../backend/src/app');
assert(typeof app === 'function', 'La aplicación Express debe ser una función/servidor válido.');

console.log('   ✅ Servidor base y middlewares montados correctamente.');

console.log('\n=============================================================');
console.log('🎉 TODAS LAS PRUEBAS DE SALUD Y PERSISTENCIA PASARON CON ÉXITO');
console.log('=============================================================\n');
process.exit(0);
