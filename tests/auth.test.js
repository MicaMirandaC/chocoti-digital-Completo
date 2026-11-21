/**
 * @file tests/auth.test.js
 * @description Suite de pruebas automatizadas de seguridad, autenticación, roles, permisos y no exposición de credenciales.
 * ChocoTi-Digital · Sprint 3: Seguridad y Acceso
 */

'use strict';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_jwt_secret_sucre_bolivia_2026';
process.env.DB_PATH = 'database/chocoti.db';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const AuthService = require('../backend/src/services/authService');
const Usuario = require('../backend/src/models/Usuario');
const db = require('../backend/src/config/database');
const LogAcceso = require('../backend/src/models/LogAcceso');
const { validarTransicionEstado, soloAlmacenAsignado, TRANSICIONES_POR_ROL } = require('../backend/src/middleware/authMiddleware');

console.log('🧪 [TEST SUITE] Iniciando pruebas de Fase 3: Seguridad, Autenticación y RBAC...\n');

async function ejecutarPruebas() {
  // ─────────────────────────────────────────────────────────────
  // 1. Autenticación exitosa para los 7 roles autorizados
  // ─────────────────────────────────────────────────────────────
  console.log('▶ [1/8] Probando inicio de sesión exitoso para los 7 roles...');
  
  // 1.1 Administrador
  const loginAdmin = await AuthService.login({ email: 'admin@chocolatesti.bo', password: 'Admin2024!', ip: '127.0.0.1' });
  assert(loginAdmin.token, 'Admin debe recibir token JWT');
  assert.strictEqual(loginAdmin.usuario.rol, 'ADMINISTRADOR');
  assert.strictEqual(loginAdmin.usuario.password_hash, undefined, 'PROHIBIDO retornar password_hash');

  // 1.2 Operador de Almacén (Sucre)
  const loginOperador = await AuthService.login({ email: 'operador.sucre@chocolatesti.bo', password: 'Operador2024!', ip: '127.0.0.1' });
  assert.strictEqual(loginOperador.usuario.rol, 'OPERADOR_ALMACEN');
  assert.strictEqual(loginOperador.usuario.almacen_id, 1, 'Operador Sucre debe estar ligado a Almacén 1');

  // 1.3 Cliente Minorista
  const loginMinorista = await AuthService.login({ email: 'cliente@gmail.com', password: 'Cliente2024!', ip: '127.0.0.1' });
  assert.strictEqual(loginMinorista.usuario.rol, 'CLIENTE_MINORISTA');

  // 1.4 Cliente Corporativo (B2B)
  const loginCorp = await AuthService.login({ email: 'empresa@acme.bo', password: 'Empresa2024!', ip: '127.0.0.1' });
  assert.strictEqual(loginCorp.usuario.rol, 'CLIENTE_CORPORATIVO');
  assert(loginCorp.usuario.razon_social, 'Cliente corporativo debe tener Razón Social');

  // 1.5 Preparador de Pedidos (Sucre) - Requisito Fase 3B
  const loginPrep = await AuthService.login({ email: 'preparador.sucre@chocolatesti.bo', password: 'Preparador2024!', ip: '127.0.0.1' });
  assert.strictEqual(loginPrep.usuario.rol, 'PREPARADOR_PEDIDOS');
  assert.strictEqual(loginPrep.usuario.almacen_id, 1, 'Preparador Sucre debe estar ligado a Almacén 1');
  assert.strictEqual(loginPrep.usuario.password_hash, undefined);

  // 1.6 Empacador (Sucre) - Requisito Fase 3B
  const loginEmp = await AuthService.login({ email: 'empador.sucre@chocolatesti.bo', password: 'Empacador2024!', ip: '127.0.0.1' }).catch(async () => {
    return await AuthService.login({ email: 'empacador.sucre@chocolatesti.bo', password: 'Empacador2024!', ip: '127.0.0.1' });
  });
  assert.strictEqual(loginEmp.usuario.rol, 'EMPACADOR');
  assert.strictEqual(loginEmp.usuario.almacen_id, 1, 'Empacador Sucre debe estar ligado a Almacén 1');
  assert.strictEqual(loginEmp.usuario.password_hash, undefined);

  // 1.7 Despachador / Entrega (Sucre) - Requisito Fase 3B
  const loginDesp = await AuthService.login({ email: 'despachador.sucre@chocolatesti.bo', password: 'Despachador2024!', ip: '127.0.0.1' });
  assert.strictEqual(loginDesp.usuario.rol, 'DESPACHADOR_ENTREGA');
  assert.strictEqual(loginDesp.usuario.almacen_id, 1, 'Despachador Sucre debe estar ligado a Almacén 1');
  assert.strictEqual(loginDesp.usuario.password_hash, undefined);

  console.log('   ✅ Los 7 roles se autentican correctamente y reciben JWT sin exponer contraseñas.\n');

  // ─────────────────────────────────────────────────────────────
  // 2. Mensaje genérico y sin fuga de información (Email no existe vs Password errónea)
  // ─────────────────────────────────────────────────────────────
  console.log('▶ [2/6] Verificando mensajes de error genéricos (anti-enumeración de usuarios)...');
  
  // Caso A: Email que no existe
  try {
    await AuthService.login({ email: 'correo_inexistente_12345@noexiste.bo', password: 'Password123!', ip: '127.0.0.1' });
    assert.fail('Debió lanzar error 401');
  } catch (err) {
    assert.strictEqual(err.status, 401);
    assert.strictEqual(err.message, 'Correo o contraseña incorrectos.', 'Mensaje debe ser genérico para usuario inexistente');
  }

  // Caso B: Email existente pero contraseña errónea
  try {
    await AuthService.login({ email: 'cliente@gmail.com', password: 'PasswordErronea123!', ip: '127.0.0.1' });
    assert.fail('Debió lanzar error 401');
  } catch (err) {
    assert.strictEqual(err.status, 401);
    assert.strictEqual(err.message, 'Correo o contraseña incorrectos.', 'Mensaje debe ser exactamente el mismo para no revelar existencia');
  }
  console.log('   ✅ Respuestas genéricas verificadas: No revelan si el correo está registrado en la base de datos.\n');

  // ─────────────────────────────────────────────────────────────
  // 3. Bloqueo temporal de cuenta tras 5 intentos fallidos
  // ─────────────────────────────────────────────────────────────
  console.log('▶ [3/6] Verificando bloqueo temporal tras 5 intentos fallidos...');
  
  // Crear usuario temporal para prueba de fuerza bruta
  const emailTestBloqueo = `test_bloqueo_${Date.now()}@test.bo`;
  const userTest = Usuario.createClientePublico({
    nombre_completo: 'Usuario Test Bloqueo',
    email: emailTestBloqueo,
    password_hash: '$2a$10$rj1PMIVNc4ES5BF3w/etZeyiXRXxbPETAHOolhFTf5b5IG/6h6P4a', // Cliente2024!
    tipo_cliente: 'MINORISTA',
  });

  // Ejecutar 4 intentos fallidos
  for (let i = 1; i <= 4; i++) {
    try {
      await AuthService.login({ email: emailTestBloqueo, password: 'WrongPassword!', ip: '127.0.0.1' });
    } catch (err) {
      assert.strictEqual(err.status, 401);
    }
  }

  // Intento 5: Debe provocar el bloqueo
  try {
    await AuthService.login({ email: emailTestBloqueo, password: 'WrongPassword!', ip: '127.0.0.1' });
    assert.fail('Debió bloquear la cuenta en el 5to intento fallido');
  } catch (err) {
    assert.strictEqual(err.status, 403);
    assert(err.message.includes('bloqueada'), 'Debe notificar bloqueo temporal de cuenta');
  }

  // Intento 6 (incluso con contraseña correcta): Debe permanecer bloqueada
  try {
    await AuthService.login({ email: emailTestBloqueo, password: 'Cliente2024!', ip: '127.0.0.1' });
    assert.fail('Cuenta bloqueada no debe permitir acceso');
  } catch (err) {
    assert.strictEqual(err.status, 403);
    assert(err.message.includes('bloqueada'));
  }

  // Limpiar usuario de prueba
  db.prepare('DELETE FROM usuarios WHERE id = ?').run(userTest.id);
  console.log('   ✅ Bloqueo por fuerza bruta verificado: Cuenta bloqueada tras 5 intentos fallidos.\n');

  // ─────────────────────────────────────────────────────────────
  // 4. Registro público de clientes y forzado de rol seguro
  // ─────────────────────────────────────────────────────────────
  console.log('▶ [4/6] Probando registro público seguro (Minorista y Corporativo)...');
  
  const emailNuevoMinorista = `nuevo_minorista_${Date.now()}@chocoti.test`;
  const regMin = await AuthService.register({
    nombre_completo: 'Juan Pérez Sucre',
    email: emailNuevoMinorista,
    password: 'PasswordSegura2026!',
    tipo_cliente: 'MINORISTA',
    rol_id: 1, // Intento de escalada de privilegios a ADMINISTRADOR
  });

  assert.strictEqual(regMin.usuario.rol, 'CLIENTE_MINORISTA', 'El servidor DEBE ignorar rol_id enviado y forzar rol CLIENTE_MINORISTA');
  assert.strictEqual(regMin.usuario.rol_id, 3);

  // Registro Corporativo con validación de NIT y Razón Social
  const emailNuevoCorp = `nuevo_corp_${Date.now()}@empresa.test`;
  const regCorp = await AuthService.register({
    nombre_completo: 'Lic. Roberto Gómez',
    email: emailNuevoCorp,
    password: 'PasswordCorp2026!',
    tipo_cliente: 'CORPORATIVO',
    razon_social: 'Gómez & Asociados Distribuciones S.R.L.',
    ci_nit: '1098765432',
  });
  assert.strictEqual(regCorp.usuario.rol, 'CLIENTE_CORPORATIVO');
  assert.strictEqual(regCorp.usuario.razon_social, 'Gómez & Asociados Distribuciones S.R.L.');

  // Intento de registro corporativo sin NIT (debe fallar)
  try {
    await AuthService.register({
      nombre_completo: 'Empresa Sin Nit',
      email: `sin_nit_${Date.now()}@test.bo`,
      password: 'Password2026!',
      tipo_cliente: 'CORPORATIVO',
      razon_social: 'Empresa Fantasma',
      ci_nit: '',
    });
    assert.fail('Debió rechazar registro corporativo sin NIT');
  } catch (err) {
    assert.strictEqual(err.status, 422);
  }

  // Limpieza de usuarios de prueba
  db.prepare('DELETE FROM usuarios WHERE id IN (?, ?)').run(regMin.usuario.id, regCorp.usuario.id);
  console.log('   ✅ Registro seguro verificado: Protección contra escalada de privilegios y validación B2B activa.\n');

  // ─────────────────────────────────────────────────────────────
  // 5. Recuperación y restablecimiento de contraseña por token
  // ─────────────────────────────────────────────────────────────
  console.log('▶ [5/6] Probando flujo de recuperación de contraseña con token de un solo uso...');
  
  // Solicitar recuperación
  const resRecup = await AuthService.recuperarPassword({ email: 'cliente@gmail.com', ip: '127.0.0.1' });
  assert(resRecup.mensaje.includes('instrucciones'), 'Debe retornar mensaje de confirmación');

  // Verificar que el token se generó en la base de datos
  const userConToken = db.prepare('SELECT token_recuperacion FROM usuarios WHERE email = ?').get('cliente@gmail.com');
  assert(userConToken.token_recuperacion, 'El token debe estar guardado en la base');

  // Verificar que se guardó el correo en la bandeja simulada
  const correoSimulado = db.prepare('SELECT * FROM bandeja_simulada WHERE destinatario = ? ORDER BY id DESC LIMIT 1').get('cliente@gmail.com');
  assert(correoSimulado, 'El correo de recuperación debe registrarse en bandeja_simulada');
  assert(correoSimulado.contenido_html.includes(userConToken.token_recuperacion), 'El correo debe contener el token generado');

  // Restablecer contraseña con el token
  const resRestablecer = await AuthService.restablecerPassword({
    token: userConToken.token_recuperacion,
    password_nueva: 'ClienteNuevaClave2026!',
    password_confirmar: 'ClienteNuevaClave2026!',
  });
  assert(resRestablecer.mensaje.includes('correctamente'));

  // Verificar que el token fue consumido (de un solo uso)
  const tokenConsumido = db.prepare('SELECT token_recuperacion FROM usuarios WHERE email = ?').get('cliente@gmail.com');
  assert.strictEqual(tokenConsumido.token_recuperacion, null, 'El token de recuperación debe invalidarse tras su uso');

  // Restaurar contraseña original para no romper tests futuros
  await AuthService.restablecerPasswordConTokenDirecto(4, '$2a$10$rj1PMIVNc4ES5BF3w/etZeyiXRXxbPETAHOolhFTf5b5IG/6h6P4a'); // Cliente2024!
  console.log('   ✅ Recuperación y restablecimiento por token de un solo uso validado al 100%.\n');

  // ─────────────────────────────────────────────────────────────
  // 6. Validación de matriz de transiciones de estados y rebote con 403 Forbidden
  // Requisito estricto Fase 3B / ajustes_ingeniero.md
  // ─────────────────────────────────────────────────────────────
  console.log('▶ [6/8] Probando matriz de transiciones de pedidos por rol y rechazo con 403...');

  // Helper para simular middleware express
  function invocarMiddleware(mw, req) {
    return new Promise((resolve) => {
      const res = {
        statusCode: 200,
        body: null,
        status(code) {
          this.statusCode = code;
          return this;
        },
        json(payload) {
          this.body = payload;
          resolve({ status: this.statusCode, body: this.body });
        },
      };
      mw(req, res, () => {
        resolve({ status: 200, body: { ok: true } });
      });
    });
  }

  // 6.1 PREPARADOR_PEDIDOS intentando transicionar a EMPACADO (Debe fallar con 403)
  const resPrepInvalido = await invocarMiddleware(validarTransicionEstado, {
    usuario: { rol: 'PREPARADOR_PEDIDOS' },
    body: { nuevo_estado: 'EMPACADO' },
  });
  assert.strictEqual(resPrepInvalido.status, 403, 'PREPARADOR_PEDIDOS no puede pasar a EMPACADO; debe rebotar con 403');
  assert(resPrepInvalido.body.mensaje.includes('Acceso denegado'));

  // 6.2 PREPARADOR_PEDIDOS transicionando a EN_PREPARACION o PREPARADO (Permitido)
  const resPrepValido = await invocarMiddleware(validarTransicionEstado, {
    usuario: { rol: 'PREPARADOR_PEDIDOS' },
    body: { nuevo_estado: 'PREPARADO' },
  });
  assert.strictEqual(resPrepValido.status, 200, 'PREPARADOR_PEDIDOS sí puede marcar como PREPARADO');

  // 6.3 EMPACADOR intentando transicionar a DESPACHADO (Debe fallar con 403)
  const resEmpInvalido = await invocarMiddleware(validarTransicionEstado, {
    usuario: { rol: 'EMPACADOR' },
    body: { nuevo_estado: 'DESPACHADO' },
  });
  assert.strictEqual(resEmpInvalido.status, 403, 'EMPACADOR no puede pasar a DESPACHADO; debe rebotar con 403');

  // 6.4 EMPACADOR transicionando a EMPACADO (Permitido)
  const resEmpValido = await invocarMiddleware(validarTransicionEstado, {
    usuario: { rol: 'EMPACADOR' },
    body: { nuevo_estado: 'EMPACADO' },
  });
  assert.strictEqual(resEmpValido.status, 200, 'EMPACADOR sí puede marcar como EMPACADO');

  // 6.5 DESPACHADOR_ENTREGA intentando transicionar a PREPARADO (Debe fallar con 403)
  const resDespInvalido = await invocarMiddleware(validarTransicionEstado, {
    usuario: { rol: 'DESPACHADOR_ENTREGA' },
    body: { nuevo_estado: 'PREPARADO' },
  });
  assert.strictEqual(resDespInvalido.status, 403, 'DESPACHADOR_ENTREGA no puede cambiar a PREPARADO');

  // 6.6 DESPACHADOR_ENTREGA transicionando a ENTREGADO (Permitido)
  const resDespValido = await invocarMiddleware(validarTransicionEstado, {
    usuario: { rol: 'DESPACHADOR_ENTREGA' },
    body: { nuevo_estado: 'ENTREGADO' },
  });
  assert.strictEqual(resDespValido.status, 200, 'DESPACHADOR_ENTREGA sí puede marcar como ENTREGADO');

  // 6.7 OPERADOR_ALMACEN intentando transicionar a EN_PREPARACION (Debe fallar con 403)
  const resOpInvalido = await invocarMiddleware(validarTransicionEstado, {
    usuario: { rol: 'OPERADOR_ALMACEN' },
    body: { nuevo_estado: 'EN_PREPARACION' },
  });
  assert.strictEqual(resOpInvalido.status, 403, 'OPERADOR_ALMACEN no puede cambiar a EN_PREPARACION');

  // 6.8 CLIENTE_MINORISTA intentando marcar pedido como PAGADO directamente (Debe fallar con 403)
  const resCliInvalido = await invocarMiddleware(validarTransicionEstado, {
    usuario: { rol: 'CLIENTE_MINORISTA' },
    body: { nuevo_estado: 'PAGADO' },
  });
  assert.strictEqual(resCliInvalido.status, 403, 'CLIENTE_MINORISTA no puede auto-aprobarse como PAGADO');

  // 6.9 ADMINISTRADOR tiene privilegios globales para cualquier estado
  const resAdminValido = await invocarMiddleware(validarTransicionEstado, {
    usuario: { rol: 'ADMINISTRADOR' },
    body: { nuevo_estado: 'EMPACADO' },
  });
  assert.strictEqual(resAdminValido.status, 200, 'ADMINISTRADOR puede transicionar a cualquier estado');

  console.log('   ✅ Matriz de estados y rebote 403 por rol validado al 100%.\n');

  // ─────────────────────────────────────────────────────────────
  // 7. Aislamiento de Almacén para todos los roles operativos de planta
  // Requisito Fase 3B: Sucre no puede operar La Paz y viceversa
  // ─────────────────────────────────────────────────────────────
  console.log('▶ [7/8] Probando aislamiento estricto de almacén para personal operativo...');

  // Operador Sucre (almacen 1) intentando acceder a Almacen 2 (La Paz) -> 403
  const resAislamientoOp = await invocarMiddleware(soloAlmacenAsignado, {
    usuario: { rol: 'OPERADOR_ALMACEN', almacen_id: 1 },
    params: { almacen_id: 2 },
    query: {},
    body: {},
  });
  assert.strictEqual(resAislamientoOp.status, 403);

  // Preparador Sucre (almacen 1) intentando acceder a Almacen 3 (Cochabamba) -> 403
  const resAislamientoPrep = await invocarMiddleware(soloAlmacenAsignado, {
    usuario: { rol: 'PREPARADOR_PEDIDOS', almacen_id: 1 },
    params: { almacen_id: 3 },
    query: {},
    body: {},
  });
  assert.strictEqual(resAislamientoPrep.status, 403);

  // Empacador Sucre (almacen 1) operando en su propio almacén 1 -> 200
  const resAislamientoEmpPropio = await invocarMiddleware(soloAlmacenAsignado, {
    usuario: { rol: 'EMPACADOR', almacen_id: 1 },
    params: { almacen_id: 1 },
    query: {},
    body: {},
  });
  assert.strictEqual(resAislamientoEmpPropio.status, 200);

  // Administrador accediendo a cualquier almacén -> 200
  const resAdminAlm = await invocarMiddleware(soloAlmacenAsignado, {
    usuario: { rol: 'ADMINISTRADOR', almacen_id: 1 },
    params: { almacen_id: 4 },
    query: {},
    body: {},
  });
  assert.strictEqual(resAdminAlm.status, 200);

  console.log('   ✅ Aislamiento estricto de almacén verificado para todos los roles de planta.\n');

  // ─────────────────────────────────────────────────────────────
  // 8. Verificación de CERO exposición de credenciales en pantallas
  // ─────────────────────────────────────────────────────────────
  console.log('▶ [8/8] Verificando que ninguna pantalla ni script expone credenciales ni listas de prueba...');
  
  const archivosAInspeccionar = [
    path.resolve(process.cwd(), 'index.html'),
    path.resolve(process.cwd(), 'script.js'),
    path.resolve(process.cwd(), 'frontend/auth/login.html'),
    path.resolve(process.cwd(), 'frontend/dashboard/admin/index.html'),
    path.resolve(process.cwd(), 'frontend/dashboard/almacen/index.html'),
    path.resolve(process.cwd(), 'frontend/dashboard/cliente-minorista/index.html'),
    path.resolve(process.cwd(), 'frontend/dashboard/cliente-corporativo/index.html'),
  ];

  const cadenasProhibidas = [
    'Admin2024!',
    'Operador2024!',
    'Cliente2024!',
    'Empresa2024!',
    'Preparador2024!',
    'Empacador2024!',
    'Despachador2024!',
    'Cuentas de Prueba',
    'cred-pill',
    'admin@chocolatesti.bo' // no debe estar hardcodeado como valor o botón en pantallas públicas
  ];

  for (const archivo of archivosAInspeccionar) {
    if (fs.existsSync(archivo)) {
      const contenido = fs.readFileSync(archivo, 'utf8');
      
      for (const prohibida of cadenasProhibidas) {
        assert(!contenido.includes(prohibida), `Credencial o elemento de prueba '${prohibida}' expuesto en: ${path.basename(archivo)}`);
      }
    }
  }

  console.log('   ✅ Cumplimiento estricto de seguridad: Ningún archivo de interfaz expone contraseñas de ninguno de los 7 roles ni botones de prueba.');

  console.log('\n=============================================================');
  console.log('🎉 TODAS LAS PRUEBAS DE LA FASE 3 Y 3B PASARON CON ÉXITO ROTUNDO');
  console.log('=============================================================\n');
  console.log('🎉 TODAS LAS PRUEBAS DE LA FASE 3 PASARON CON ÉXITO ROTUNDO');
  console.log('=============================================================\n');
}

// Helper para restaurar password del cliente minorista tras el test
AuthService.restablecerPasswordConTokenDirecto = function (id, hash) {
  db.prepare('UPDATE usuarios SET password_hash = ? WHERE id = ?').run(hash, id);
};

ejecutarPruebas()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Error en suite de pruebas:', err);
    process.exit(1);
  });
