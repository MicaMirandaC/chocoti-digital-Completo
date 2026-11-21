/**
 * @file config/database.js
 * @description Conexión singleton a SQLite utilizando better-sqlite3.
 * Configura pragmas de integridad referencial, WAL mode y sincronización óptima.
 * Implementa verificación e inicialización idempotente para despliegue en Render.
 * ChocoTi-Digital | Capa 3: Persistencia y Acceso a Datos
 */

'use strict';

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

// Resolver ruta de la base de datos de manera robusta (soporta raíz y subcarpeta backend)
let DB_PATH;
if (process.env.DB_PATH) {
  DB_PATH = path.isAbsolute(process.env.DB_PATH)
    ? process.env.DB_PATH
    : path.resolve(process.cwd(), process.env.DB_PATH);
} else {
  // Por defecto SQLite en database/chocoti.db
  const defaultPaths = [
    path.resolve(process.cwd(), 'database', 'chocoti.db'),
    path.resolve(__dirname, '..', '..', '..', 'database', 'chocoti.db'),
    path.resolve(__dirname, '..', '..', 'database', 'chocoti.db'),
  ];
  DB_PATH = defaultPaths[0];
}

// Garantizar que la carpeta contenedora exista
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

let db;

try {
  db = new Database(DB_PATH);

  // Integridad referencial mandatoria
  db.pragma('foreign_keys = ON');

  // Modo WAL (Write-Ahead Logging) para concurrencia de lectura/escritura sin bloqueos
  db.pragma('journal_mode = WAL');

  // Configuración de sincronización y rendimiento
  db.pragma('synchronous = NORMAL');
  db.pragma('cache_size = -32000'); // 32MB de cache

  // Registrar función SQLite para búsqueda insensible a acentos/tildes y mayúsculas
  db.function('quitar_tildes', (str) =>
    str ? str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() : ''
  );

  // Inicialización idempotente automática si la base de datos está vacía
  // Inicialización idempotente automática si la base de datos está vacía
  initSchemaIfEmpty(db);
  // Asegurar que las columnas de seguridad existen en la tabla usuarios (para compatibilidad con versiones previas)
  try {
    const colInfo = db.prepare("PRAGMA table_info('usuarios')").all();
    const addColumn = (name, sql) => {
      const exists = colInfo.some(c => c.name === name);
      if (!exists) {
        db.exec(`ALTER TABLE usuarios ADD COLUMN ${sql}`);
        console.log(`[DB] Migración: columna ${name} añadida a usuarios`);
      }
    };
    addColumn('intentos_fallidos', 'intentos_fallidos INTEGER NOT NULL DEFAULT 0');
    addColumn('bloqueado_hasta', 'bloqueado_hasta DATETIME');
    addColumn('token_recuperacion', 'token_recuperacion TEXT');
    addColumn('token_expira_en', 'token_expira_en DATETIME');
    addColumn('ultima_conexion', 'ultima_conexion DATETIME');
  } catch (migErr) {
    console.error('[DB] Error al verificar/agregar columnas de seguridad en usuarios:', migErr.message);
  }

  // Asegurar que las columnas extendidas de pedidos existen (compatibilidad Fase 5)
  try {
    const colPedidos = db.prepare("PRAGMA table_info('pedidos')").all();
    const addColPedido = (name, sql) => {
      const exists = colPedidos.some(c => c.name === name);
      if (!exists) {
        db.exec(`ALTER TABLE pedidos ADD COLUMN ${sql}`);
        console.log(`[DB] Migración: columna ${name} añadida a pedidos`);
      }
    };
    addColPedido('monto_usd', 'monto_usd DECIMAL(10, 2)');
    addColPedido('tipo_cambio_usd', 'tipo_cambio_usd DECIMAL(10, 4) DEFAULT 6.96');
    addColPedido('codigo_retiro', 'codigo_retiro TEXT');
    addColPedido('fecha_limite_retiro', 'fecha_limite_retiro DATETIME');
    addColPedido('fecha_finalizado', 'fecha_finalizado DATETIME');
    addColPedido('dias_para_finalizar', 'dias_para_finalizar INTEGER DEFAULT 7');
  } catch (migPedErr) {
    console.error('[DB] Error al verificar/agregar columnas en pedidos:', migPedErr.message);
  }

  // Asegurar que pagos_intentos tiene monto_declarado para depósito bancario
  try {
    const colPagos = db.prepare("PRAGMA table_info('pagos_intentos')").all();
    const addColPago = (name, sql) => {
      const exists = colPagos.some(c => c.name === name);
      if (!exists) {
        db.exec(`ALTER TABLE pagos_intentos ADD COLUMN ${sql}`);
        console.log(`[DB] Migración: columna ${name} añadida a pagos_intentos`);
      }
    };
    addColPago('monto_declarado', 'monto_declarado DECIMAL(10, 2)');
  } catch (migPagoErr) {
    console.error('[DB] Error al verificar/agregar columnas en pagos_intentos:', migPagoErr.message);
  }

  // Asegurar que bandeja_simulada tiene pedido_id (Módulo 6: Notificaciones)
  try {
    const colBandeja = db.prepare("PRAGMA table_info('bandeja_simulada')").all();
    const addColBandeja = (name, sql) => {
      const exists = colBandeja.some(c => c.name === name);
      if (!exists) {
        db.exec(`ALTER TABLE bandeja_simulada ADD COLUMN ${sql}`);
        console.log(`[DB] Migración: columna ${name} añadida a bandeja_simulada`);
      }
    };
    addColBandeja('pedido_id', 'pedido_id INTEGER REFERENCES pedidos(id)');
  } catch (migBandejaErr) {
    console.error('[DB] Error al verificar/agregar columnas en bandeja_simulada:', migBandejaErr.message);
  }

  // Asegurar que notificaciones_logs tiene mensaje_resumen (Módulo 6: Notificaciones)
  try {
    const colLogs = db.prepare("PRAGMA table_info('notificaciones_logs')").all();
    const addColLogs = (name, sql) => {
      const exists = colLogs.some(c => c.name === name);
      if (!exists) {
        db.exec(`ALTER TABLE notificaciones_logs ADD COLUMN ${sql}`);
        console.log(`[DB] Migración: columna ${name} añadida a notificaciones_logs`);
      }
    };
    addColLogs('mensaje_resumen', 'mensaje_resumen TEXT');
  } catch (migLogsErr) {
    console.error('[DB] Error al verificar/agregar columnas en notificaciones_logs:', migLogsErr.message);
  }
} catch (err) {
  console.error('[DB] Error crítico al inicializar conexión SQLite:', err.message);
  process.exit(1);
}

/**
 * Verifica si las tablas esenciales y semillas existen en la base de datos.
 * Si la base está vacía o recién creada, ejecuta automáticamente schema.sql.
 * @param {Database.Database} databaseInstance
 */
function initSchemaIfEmpty(databaseInstance) {
  try {
    const tableCheck = databaseInstance
      .prepare("SELECT count(*) as count FROM sqlite_master WHERE type = 'table' AND name = 'productos'")
      .get();

    if (!tableCheck || tableCheck.count === 0) {
      console.log('[DB] Base de datos no inicializada. Ejecutando schema.sql de forma idempotente...');

      // Buscar schema.sql en las posibles rutas del proyecto
      const posiblesRutas = [
        path.resolve(process.cwd(), 'database', 'schema.sql'),
        path.resolve(__dirname, '..', '..', '..', 'database', 'schema.sql'),
        path.resolve(__dirname, '..', '..', 'database', 'schema.sql'),
      ];

      const schemaFile = posiblesRutas.find((p) => fs.existsSync(p));

      if (schemaFile) {
        const schemaSql = fs.readFileSync(schemaFile, 'utf8');
        databaseInstance.exec(schemaSql);
        console.log(`[DB] Esquema y semillas cargados exitosamente desde: ${schemaFile}`);
      } else {
        console.warn('[DB] Advertencia: No se encontró database/schema.sql para inicialización automática.');
      }
    }
  } catch (initErr) {
    console.error('[DB] Error durante la inicialización idempotente del esquema:', initErr.message);
  }
}

module.exports = db;
module.exports.initSchemaIfEmpty = initSchemaIfEmpty;
