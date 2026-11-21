/**
 * @file app.js
 * @description Servidor Express principal para ChocoTi-Digital Backend (Fases 1 y 2).
 * Implementa arquitectura en 3 capas, middleware de seguridad, rate limiting y CORS.
 * Diseñado para despliegue en Render y entorno local.
 */

'use strict';

// Cargar .env desde el directorio del backend (backend/.env),
// independientemente del CWD desde el que se inicie el proceso.
// Usar { override: false } para no sobreescribir variables ya cargadas
// (p.ej. cuando server.js raíz cargó primero el .env raíz).
const path = require('path');
require('dotenv').config({
  path: path.resolve(__dirname, '../../.env'),
  override: false,
});
// Fallback: si no existe .env raíz, cargar backend/.env
require('dotenv').config({
  path: path.resolve(__dirname, '../.env'),
  override: false,
});

const express = require('express');
const fs = require('fs');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

// Validación de variables de entorno críticas
if (!process.env.JWT_SECRET && process.env.NODE_ENV !== 'test') {
  if (process.env.NODE_ENV === 'production') {
    console.error('\n❌ ERROR CRÍTICO DE SEGURIDAD:');
    console.error('La variable de entorno JWT_SECRET es obligatoria en producción pero no está definida.');
    console.error('Defina JWT_SECRET en el panel de variables de Render.\n');
    process.exit(1);
  } else {
    process.env.JWT_SECRET = 'chocoti_jwt_secret_sucre_bolivia_2026_dev_key';
    console.warn('[SERVER] ⚠️ Advertencia: JWT_SECRET no definido. Usando clave de desarrollo por defecto.');
  }
}

// Inicialización de la base de datos (conexión singleton y arranque idempotente)
const db = require('./config/database');

// Rutas modulares existentes
const authRoutes = require('./routes/authRoutes');
const usuariosRoutes = require('./routes/usuariosRoutes');
const almacenesRoutes = require('./routes/almacenesRoutes');
const productosRoutes = require('./routes/productosRoutes');
const categoriasRoutes = require('./routes/categoriasRoutes');
const deseosRoutes = require('./routes/deseosRoutes');
const inventarioRoutes = require('./routes/inventarioRoutes');
const puntosVentaRoutes = require('./routes/puntosVentaRoutes');
const pedidosRoutes = require('./routes/pedidosRoutes');
const pagosRoutes = require('./routes/pagosRoutes');
const notificacionesRoutes = require('./routes/notificacionesRoutes');
const planillaRoutes = require('./routes/planillaRoutes'); // Módulo 7
const preparacionRoutes = require('./routes/preparacionRoutes'); // Fase 7A
const empaqueRoutes = require('./routes/empaqueRoutes'); // Fase 7B
const ReservaStock = require('./models/ReservaStock');

const app = express();

// Seguridad HTTP con Helmet
app.use(
  helmet({
    contentSecurityPolicy: false,
  })
);

// Configuración de CORS
const corsOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
  : [
      'http://localhost:5500',
      'http://127.0.0.1:5500',
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://localhost:3001',
      'http://127.0.0.1:3001',
      'https://chocoti-api.onrender.com'
    ];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || corsOrigins.includes('*') || corsOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(null, true);
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  })
);

// Body Parsers (10MB para soportar comprobantes en base64)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false, limit: '10mb' }));

// Directorio raíz y directorio de uploads garantizado
const rootDir = path.resolve(__dirname, '../../');
const uploadsDir = path.join(rootDir, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Servir archivos estáticos
app.use(express.static(rootDir));
app.use('/frontend', express.static(path.join(rootDir, 'frontend')));
app.use('/uploads', express.static(uploadsDir));

// Ruta principal para cargar el index.html
app.get('/', (_req, res) => {
  res.sendFile(path.join(rootDir, 'index.html'));
});

// Rutas amigables de navegación
app.get(['/tienda', '/catalogo'], (_req, res) => {
  res.redirect('/#catalogo');
});

app.get(['/login', '/registro'], (_req, res) => {
  res.sendFile(path.join(rootDir, 'frontend', 'auth', 'login.html'));
});

app.get('/dashboard', (_req, res) => {
  res.redirect('/frontend/auth/login.html');
});

app.get('/admin', (_req, res) => {
  res.sendFile(path.join(rootDir, 'frontend', 'dashboard', 'admin', 'index.html'));
});

app.get('/almacen', (_req, res) => {
  res.sendFile(path.join(rootDir, 'frontend', 'dashboard', 'almacen', 'index.html'));
});

app.get('/dashboard/admin', (_req, res) => {
  res.sendFile(path.join(rootDir, 'frontend', 'dashboard', 'admin', 'index.html'));
});

app.get('/dashboard/almacen', (_req, res) => {
  res.sendFile(path.join(rootDir, 'frontend', 'dashboard', 'almacen', 'index.html'));
});

app.get('/dashboard/cliente-minorista', (_req, res) => {
  res.sendFile(path.join(rootDir, 'frontend', 'dashboard', 'cliente-minorista', 'index.html'));
});

app.get('/dashboard/cliente-corporativo', (_req, res) => {
  res.sendFile(path.join(rootDir, 'frontend', 'dashboard', 'cliente-corporativo', 'index.html'));
});

// Rate Limiting general y para autenticación
const limiterGlobal = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    ok: false,
    mensaje: 'Demasiadas solicitudes desde esta dirección IP. Intente más tarde.',
  },
});

const limiterAuth = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    ok: false,
    mensaje: 'Demasiados intentos de autenticación. Por seguridad, intente en 15 minutos.',
  },
});

app.use('/api', limiterGlobal);
app.use('/api/auth/login', limiterAuth);

// Registro de Rutas de la API
app.use('/api/auth', authRoutes);
app.use('/api/usuarios', usuariosRoutes);
app.use('/api/almacenes', almacenesRoutes);
app.use('/api/productos', productosRoutes);
app.use('/api/categorias', categoriasRoutes);
app.use('/api/deseos', deseosRoutes);
app.use('/api/inventario', inventarioRoutes);
app.use('/api/puntos-venta', puntosVentaRoutes);
app.use('/api/pedidos', pedidosRoutes);
app.use('/api/pagos', pagosRoutes);
app.use('/api/banco-demo', pagosRoutes); // Alias para el webhook demo bancario
app.use('/api/notificaciones', notificacionesRoutes);
app.use('/api/planilla', planillaRoutes); // Módulo 7: Planillas y Comprobantes
app.use('/api/preparacion', preparacionRoutes); // Fase 7A: Preparación y picking FEFO
app.use('/api/empaque', empaqueRoutes); // Fase 7B: Empaque y rotulado térmico

// Limpieza inmediata al arrancar el servidor (crucial para Render tras despertar de inactividad)
try {
  const liberadasInicio = ReservaStock.limpiarExpiradas();
  if (liberadasInicio > 0) {
    console.log(`[RESERVAS] Al arrancar: se liberaron reservas de ${liberadasInicio} pedido(s) expirados durante la inactividad.`);
  }
} catch (e) {
  console.error('[RESERVAS] Error al limpiar reservas al arrancar:', e.message);
}

// Tarea periódica de limpieza de reservas expiradas (cada 60 segundos)
if (process.env.NODE_ENV !== 'test') {
  setInterval(() => {
    try {
      const liberadas = ReservaStock.limpiarExpiradas();
      if (liberadas > 0) {
        console.log(`[RESERVAS] Se liberaron automáticamente reservas de ${liberadas} pedido(s) expirado(s).`);
      }
    } catch (e) {
      console.error('[RESERVAS] Error al limpiar reservas expiradas:', e.message);
    }
  }, 60000);
}

// Health Check verificado con estado de base de datos
app.get('/api/health', (_req, res) => {
  let dbStatus = 'ok';
  try {
    db.prepare('SELECT 1').get();
  } catch (dbErr) {
    dbStatus = `error: ${dbErr.message}`;
  }

  res.status(200).json({
    ok: true,
    servicio: 'ChocoTi-Digital API REST',
    version: '1.0.0',
    entorno: process.env.NODE_ENV || 'development',
    db: dbStatus,
    timestamp: new Date().toISOString(),
  });
});

// Manejo de recursos no encontrados (404)
app.use((req, res) => {
  res.status(404).json({
    ok: false,
    mensaje: `Ruta no encontrada: ${req.method} ${req.originalUrl}`,
  });
});

// Middleware global de manejo de excepciones no controladas (500)
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error('[GLOBAL ERROR HANDLER]', err);
  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    ok: false,
    mensaje: err.message || 'Error interno del servidor.',
    ...(process.env.NODE_ENV === 'development' && { detalle: err.stack }),
  });
});

// Inicialización del servidor si se ejecuta directamente
const PORT = process.env.PORT || 3001;
const HOST = '0.0.0.0';

if (require.main === module) {
  app.listen(PORT, HOST, () => {
    console.log('╔════════════════════════════════════════════════════════╗');
    console.log('║       🍫 ChocoTi-Digital - API REST Express 🍫        ║');
    console.log('╠════════════════════════════════════════════════════════╣');
    console.log(`║ Servidor Activo : http://localhost:${String(PORT).padEnd(19)}║`);
    console.log(`║ Escuchando en   : ${HOST}:${String(PORT).padEnd(25)}║`);
    console.log(`║ Entorno         : ${String(process.env.NODE_ENV || 'development').padEnd(31)}║`);
    console.log(`║ Base de Datos   : SQLite ('chocoti.db')                ║`);
    console.log('╚════════════════════════════════════════════════════════╝');
  });
}

module.exports = app;
