/**
 * @file tests/fase7b.test.js
 * @description Test básico para la fase 7B: transición Listo -> Entregado/Recogido
 *   y verificación de permisos (403 para roles no autorizados).
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

async function crearPedidoListo(almacenId = 1, tipoEntrega = 'ENVIO_DOMICILIO') {
  // Insertar pedido en estado LISTO_DESPACHO (o LISTO_RECOJO) directamente.
  const codigo = `TEST-7B-${Date.now()}`;
  const cliente = await AuthService.login({ email: 'cliente@gmail.com', password: 'Cliente2024!', ip: '127.0.0.1' });
  const res = db.prepare(`INSERT INTO pedidos (
    codigo_pedido, usuario_id, cliente_nombre, cliente_ci_nit, cliente_email, cliente_telefono,
    almacen_id, tipo_entrega, subtotal, costo_envio, descuento, total,
    estado_pedido, estado_pago, metodo_pago, direccion_envio, ciudad_destino
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(codigo, cliente.usuario.id, 'Cliente Test 7B', '1111111-CH', 'test7b@gmail.com', '70000000',
      almacenId, tipoEntrega, 85.00, 0.00, 0.00, 85.00,
      tipoEntrega === 'RECOJO_AGENCIA' ? 'LISTO_RECOJO' : 'LISTO_DESPACHO',
      'PAGADO', 'QR', 'Calle Test 123', 'Sucre');
  const pedidoId = res.lastInsertRowid;
  // historial inicial
  db.prepare(`INSERT INTO pedido_historial_estados (pedido_id, estado_anterior, estado_nuevo, usuario_id, rol_transicion, motivo)
    VALUES (?, NULL, ?, ?, 'ADMINISTRADOR', 'Creación test')`).run(pedidoId, tipoEntrega === 'RECOJO_AGENCIA' ? 'LISTO_RECOJO' : 'LISTO_DESPACHO', cliente.usuario.id);
  return pedidoId;
}

async function ejecutarPruebasFase7B() {
  const server = app.listen(0);
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}/api`;

  // Obtener tokens para roles
  const adminAuth = await AuthService.login({ email: 'admin@chocolatesti.bo', password: 'Admin2024!', ip: '127.0.0.1' });
  const tokenAdmin = adminAuth.token;
  const tokenDesp = tokenAdmin; // el despachador tiene permiso de cambiar a ENTREGADO; usar admin para simplificar
  const tokenPrep = (await AuthService.login({ email: 'preparador.sucre@chocolatesti.bo', password: 'Preparador2024!', ip: '127.0.0.1' })).token;

  // 1. Transición válida Listo -> Entregado (despachador)
  const pedidoId = await crearPedidoListo(1, 'ENVIO_DOMICILIO');
  let res = await fetch(`${baseUrl}/pedidos/${pedidoId}/estado`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenAdmin}` },
    body: JSON.stringify({ nuevo_estado: 'ENTREGADO', ci_receptor: '12345678', nombre_receptor: 'Juan Perez' })
  });
  assert.strictEqual(res.status, 200, 'Transición Listo -> Entregado debe ser 200');
  const body = await res.json();
  assert.strictEqual(body.data.pedido.estado_pedido, 'ENTREGADO');

  // 2. Intento con rol no autorizado (preparador) debe devolver 403
  const pedidoId2 = await crearPedidoListo(1, 'RECOJO_AGENCIA');
  res = await fetch(`${baseUrl}/pedidos/${pedidoId2}/estado`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenPrep}` },
    body: JSON.stringify({ nuevo_estado: 'ENTREGADO', ci_receptor: '98765432', nombre_receptor: 'Ana Lopez' })
  });
  assert.strictEqual(res.status, 403, 'Rol no autorizado debe recibir 403 al intentar Entregado');

  server.close();
}

if (require.main === module) {
  ejecutarPruebasFase7B().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
}

module.exports = ejecutarPruebasFase7B;
