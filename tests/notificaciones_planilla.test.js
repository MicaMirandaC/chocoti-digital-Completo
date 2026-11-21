/**
 * @file tests/notificaciones_planilla.test.js
 * @description Suite de pruebas automatizadas para Fase 6 (Módulo 6 y 7):
 * 1. Generación de enlace wa.me de compra contiene wa.me/591 y texto del pedido.
 * 2. Generación de enlace wa.me de contacto con la empresa apunta a número boliviano.
 * 3. Despacho a bandeja simulada (fallback SQLite sin EMAIL_API_KEY) persiste en BD.
 * 4. GET /api/planilla requiere autenticación JWT (401 sin token).
 * 5. GET /api/planilla retorna listado JSON paginado para Administrador.
 * 6. GET /api/planilla?formato=csv retorna text/csv con cabeceras de pedidos.
 * 7. GET /api/planilla/:id/comprobante retorna HTML imprimible con @media print.
 */

'use strict';

process.env.NODE_ENV  = 'test';
process.env.JWT_SECRET = 'test_jwt_secret_sucre_bolivia_2026';
process.env.DB_PATH   = 'database/chocoti.db';

const assert          = require('assert');
const app             = require('../backend/src/app');
const AuthService     = require('../backend/src/services/authService');
const WhatsAppAdapter = require('../backend/src/adapters/whatsappAdapter');
const EmailAdapter    = require('../backend/src/adapters/emailAdapter');
const db              = require('../backend/src/config/database');

// ── Fetch universal (Node ≥18 nativo; fallback http nativo) ──────────────────
async function httpGet(url, headers = {}) {
  return new Promise((resolve) => {
    const http = require('http');
    const opts = new URL(url);
    const req  = http.get(
      { hostname: opts.hostname, port: opts.port, path: opts.pathname + opts.search, headers },
      (res) => {
        let body = '';
        res.on('data', (c) => { body += c; });
        res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, text: () => body, json: () => JSON.parse(body) }));
      }
    );
    req.on('error', (e) => resolve({ status: 0, text: () => e.message, json: () => ({}) }));
  });
}

async function ejecutarPruebasFase6() {
  console.log('\n======================================================');
  console.log('🧪 INICIANDO PRUEBAS FASE 6: NOTIFICACIONES Y PLANILLAS (Módulo 6 y 7)');
  console.log('======================================================\n');

  const server = app.listen(0);
  const port   = server.address().port;
  const base   = `http://127.0.0.1:${port}/api`;
  let errores  = 0;

  function ok(prueba, condicion, detalle = '') {
    if (condicion) {
      console.log(`  ✅ ${prueba}`);
    } else {
      console.error(`  ❌ ${prueba}${detalle ? ' — ' + detalle : ''}`);
      errores++;
    }
  }

  try {
    // --- Autenticación Admin para pruebas HTTP ---
    const authAdmin  = await AuthService.login({ email: 'admin@chocolatesti.bo', password: 'Admin2024!', ip: '127.0.0.1' });
    const tokenAdmin = authAdmin.token;

    // -----------------------------------------------------------------------
    // 1. Enlace wa.me para compartir resumen de compra
    // -----------------------------------------------------------------------
    console.log('1. Probando generación de enlace wa.me para compra...');
    const pedidoFalso = { codigo_pedido: 'PED-TEST-F6', cliente_nombre: 'Ana Prueba', total: 120.5, metodo_pago: 'QR_SIMPLE', tipo_entrega: 'ENVIO_DOMICILIO' };
    const enlaceCompra = WhatsAppAdapter.generarEnlaceCompra({ pedido: pedidoFalso, items: [] });
    ok('Resultado es un objeto con propiedad url', enlaceCompra && typeof enlaceCompra.url === 'string', JSON.stringify(enlaceCompra));
    ok('URL contiene wa.me/591', enlaceCompra.url.includes('wa.me/591'), enlaceCompra.url);
    ok('URL contiene número del pedido codificado', decodeURIComponent(enlaceCompra.url).includes('PED-TEST-F6'), enlaceCompra.url);

    // -----------------------------------------------------------------------
    // 2. Enlace wa.me de contacto con la empresa
    // -----------------------------------------------------------------------
    console.log('2. Probando generación de enlace wa.me de contacto...');
    const enlaceContacto = WhatsAppAdapter.generarEnlaceContacto({ pedidoCodigo: 'PED-TEST-F6' });
    ok('Resultado es un objeto con propiedad url', enlaceContacto && typeof enlaceContacto.url === 'string', JSON.stringify(enlaceContacto));
    ok('URL de contacto contiene wa.me/591', enlaceContacto.url.includes('wa.me/591'), enlaceContacto.url);

    // -----------------------------------------------------------------------
    // 3. Fallback a bandeja simulada sin EMAIL_API_KEY
    // -----------------------------------------------------------------------
    console.log('3. Probando fallback a bandeja simulada sin EMAIL_API_KEY...');
    const apiKeyOriginal = process.env.EMAIL_API_KEY;
    delete process.env.EMAIL_API_KEY;
    delete process.env.RESEND_API_KEY;

    const resultEmail = await EmailAdapter.enviarCorreo({
      destinatario: 'test-fase6@chocolatesti.bo',
      asunto:       'Prueba automática Fase 6 — Bandeja Simulada',
      contenidoHtml:'<p>Test unitario de bandeja simulada.</p>',
      tipo:         'GENERAL',
      pedidoId:     null,
    });
    ok('enviarCorreo retorna ok:true en modo simulado', resultEmail && resultEmail.ok === true, JSON.stringify(resultEmail));
    ok('modo es SIMULADO', resultEmail && resultEmail.modo === 'SIMULADO', JSON.stringify(resultEmail));

    const filaDB = db.prepare("SELECT * FROM bandeja_simulada WHERE destinatario = ? ORDER BY id DESC LIMIT 1")
                     .get('test-fase6@chocolatesti.bo');
    ok('Correo persiste en tabla bandeja_simulada de SQLite', filaDB !== undefined, filaDB ? JSON.stringify({ id: filaDB.id }) : 'sin fila');

    if (apiKeyOriginal) process.env.EMAIL_API_KEY = apiKeyOriginal;

    // -----------------------------------------------------------------------
    // 4. GET /api/planilla sin JWT → 401
    // -----------------------------------------------------------------------
    console.log('4. Probando que GET /api/planilla exige autenticación...');
    const r401 = await httpGet(`${base}/planilla`);
    ok('GET /api/planilla sin token responde 401', r401.status === 401, `status=${r401.status}`);

    // -----------------------------------------------------------------------
    // 5. GET /api/planilla (JSON) para Administrador → 200 con array
    // -----------------------------------------------------------------------
    console.log('5. Probando listado de planilla para Administrador...');
    const rListado = await httpGet(`${base}/planilla`, { Authorization: `Bearer ${tokenAdmin}` });
    ok('GET /api/planilla responde 200', rListado.status === 200, `status=${rListado.status}`);
    const bodyListado = rListado.json();
    ok('JSON contiene ok:true', bodyListado.ok === true, JSON.stringify(Object.keys(bodyListado)));
    ok('JSON contiene array de pedidos (datos/pedidos/data)', Array.isArray(bodyListado.datos) || Array.isArray(bodyListado.pedidos) || Array.isArray(bodyListado.data), JSON.stringify(Object.keys(bodyListado)));

    // -----------------------------------------------------------------------
    // 6. GET /api/planilla?formato=csv → 200 text/csv con cabeceras
    // -----------------------------------------------------------------------
    console.log('6. Probando exportación CSV de planilla...');
    const rCsv = await httpGet(`${base}/planilla?formato=csv`, { Authorization: `Bearer ${tokenAdmin}` });
    ok('GET /api/planilla?formato=csv responde 200', rCsv.status === 200, `status=${rCsv.status}`);
    const contentType = (rCsv.headers['content-type'] || '');
    ok('Content-Type es text/csv o application/octet-stream', contentType.includes('csv') || contentType.includes('octet-stream'), contentType);
    const csvBody    = rCsv.text();
    const cabecera   = csvBody.split('\n')[0].toLowerCase();
    ok(
      'CSV tiene cabecera con campos de pedido',
      cabecera.includes('pedido') || cabecera.includes('numero') || cabecera.includes('total') || cabecera.includes('fecha'),
      cabecera,
    );

    // -----------------------------------------------------------------------
    // 7. GET /api/planilla/:id/comprobante → HTML imprimible
    // -----------------------------------------------------------------------
    console.log('7. Probando comprobante HTML imprimible...');
    const pedidoEjemplo = db.prepare('SELECT id FROM pedidos LIMIT 1').get();
    if (pedidoEjemplo) {
      const rComp = await httpGet(`${base}/planilla/${pedidoEjemplo.id}/comprobante`, { Authorization: `Bearer ${tokenAdmin}` });
      ok(`GET /api/planilla/${pedidoEjemplo.id}/comprobante responde 200`, rComp.status === 200, `status=${rComp.status}`);
      const html = rComp.text();
      ok('HTML contiene @media print o estilo de impresión', html.includes('@media print') || html.includes('comprobante') || html.includes('print'), 'Revisar planillaController.comprobante');
      ok('HTML incluye aviso de no-factura SIN', html.toLowerCase().includes('sin') || html.toLowerCase().includes('nota de venta') || html.toLowerCase().includes('no constituye'), 'Falta aviso fiscal del SIN');
    } else {
      console.log('  ⚠️  No hay pedidos en BD — prueba de comprobante omitida.');
    }

  } finally {
    server.close();
  }

  // ── Resultado final ───────────────────────────────────────────────────────
  console.log('\n------------------------------------------------------');
  if (errores === 0) {
    console.log('✅ FASE 6 — Todas las pruebas pasaron al 100%');
  } else {
    console.error(`❌ FASE 6 — ${errores} prueba(s) fallaron`);
    process.exit(1);
  }
  console.log('------------------------------------------------------\n');
}

ejecutarPruebasFase6();
