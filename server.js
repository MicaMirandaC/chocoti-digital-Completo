/**
 * @file server.js
 * @description Punto de entrada principal para el despliegue en Render y entorno local.
 * Carga variables de entorno, valida la configuración y arranca el servidor Express.
 * ChocoTi-Digital · Solur S.R.L. · Sucre, Bolivia
 */

'use strict';

const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// Cargar variables de entorno desde la raíz o desde /backend
const rootEnv = path.resolve(process.cwd(), '.env');
const backendEnv = path.resolve(process.cwd(), 'backend', '.env');

if (fs.existsSync(rootEnv)) {
  dotenv.config({ path: rootEnv });
} else if (fs.existsSync(backendEnv)) {
  dotenv.config({ path: backendEnv });
} else {
  dotenv.config();
}

// Validación de JWT_SECRET
if (!process.env.JWT_SECRET && process.env.NODE_ENV !== 'test') {
  if (process.env.NODE_ENV === 'production') {
    console.error('\n❌ ERROR CRÍTICO DE CONFIGURACIÓN:');
    console.error('La variable de entorno JWT_SECRET es obligatoria en producción pero no está definida.');
    console.error('Por favor configure JWT_SECRET en el panel de Environment de Render.');
    console.error('Consulte .env.example para ver los parámetros requeridos.\n');
    process.exit(1);
  } else {
    process.env.JWT_SECRET = 'chocoti_jwt_secret_sucre_bolivia_2026_dev_key';
    console.warn('[SERVER] ⚠️ Advertencia: JWT_SECRET no definido. Usando clave de desarrollo por defecto.');
  }
}

// Importar aplicación Express configurada
const app = require('./backend/src/app');

const PORT = process.env.PORT || 3001;
const HOST = '0.0.0.0';

const server = app.listen(PORT, HOST, () => {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║       🍫 ChocoTi-Digital — Servidor Principal Iniciado 🍫      ║');
  console.log('╠════════════════════════════════════════════════════════════════╣');
  console.log(`║ URL Local       : http://localhost:${String(PORT).padEnd(27)}║`);
  console.log(`║ Escuchando en   : ${HOST}:${String(PORT).padEnd(33)}║`);
  console.log(`║ Entorno         : ${String(process.env.NODE_ENV || 'development').padEnd(39)}║`);
  console.log(`║ Health Check    : http://localhost:${PORT}/api/health           ║`);
  console.log('╚════════════════════════════════════════════════════════════════╝');
});

// Manejo elegante de terminación (SIGTERM / SIGINT)
const shutdown = () => {
  console.log('\n[SERVER] Recibida señal de apagado. Cerrando servidor HTTP...');
  server.close(() => {
    console.log('[SERVER] Conexiones finalizadas limpiamente.');
    process.exit(0);
  });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

module.exports = server;
