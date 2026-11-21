/**
 * api.js — Capa de Comunicación con la API REST
 * ChocoTi-Digital | Capa 1: Presentación → Capa 2: Control
 *
 * Encapsula todas las llamadas HTTP al backend Express mediante rutas relativas.
 * Maneja tokens JWT, errores HTTP, sesión local y cierre por inactividad.
 */

'use strict';

/* ── Configuración base: rutas relativas por defecto; soporte para Live Server (puerto 5500/5501) ── */
const API_BASE = (typeof window !== 'undefined' && (window.location.port === '5500' || window.location.port === '5501'))
  ? `${window.location.protocol}//${window.location.hostname}:3001/api`
  : '/api';
const STORAGE_KEY_TOKEN = 'chocoti_token';
const STORAGE_KEY_USUARIO = 'chocoti_usuario';
const STORAGE_KEY_RECORDAR = 'chocoti_recordar';

/* ═══════════════════════════════════════════════════════════════
   HELPERS DE SESIÓN Y PERSISTENCIA
   ═══════════════════════════════════════════════════════════════ */

/**
 * Guarda el token y los datos del usuario en localStorage o sessionStorage.
 * @param {string} token
 * @param {Object} usuario
 * @param {boolean} [recordar=false]
 */
function guardarSesion(token, usuario, recordar = false) {
  const storage = recordar ? localStorage : sessionStorage;
  storage.setItem(STORAGE_KEY_TOKEN, token);
  storage.setItem(STORAGE_KEY_USUARIO, JSON.stringify(usuario));
  if (recordar) {
    localStorage.setItem(STORAGE_KEY_RECORDAR, 'true');
  } else {
    localStorage.removeItem(STORAGE_KEY_RECORDAR);
  }
}

/**
 * Recupera la sesión actual verificando tanto localStorage como sessionStorage.
 * @returns {{ token: string, usuario: Object } | null}
 */
function obtenerSesion() {
  const token = localStorage.getItem(STORAGE_KEY_TOKEN) || sessionStorage.getItem(STORAGE_KEY_TOKEN);
  const rawUser = localStorage.getItem(STORAGE_KEY_USUARIO) || sessionStorage.getItem(STORAGE_KEY_USUARIO);

  if (!token || !rawUser) return null;

  try {
    return { token, usuario: JSON.parse(rawUser) };
  } catch {
    return null;
  }
}

/**
 * Cierra la sesión limpiando ambos almacenamientos y redirige al login o refresca.
 * @param {boolean} [redirigir=true]
 */
function cerrarSesion(redirigir = true) {
  localStorage.removeItem(STORAGE_KEY_TOKEN);
  localStorage.removeItem(STORAGE_KEY_USUARIO);
  localStorage.removeItem(STORAGE_KEY_RECORDAR);
  sessionStorage.removeItem(STORAGE_KEY_TOKEN);
  sessionStorage.removeItem(STORAGE_KEY_USUARIO);

  if (redirigir && typeof window !== 'undefined') {
    window.location.href = resolveLoginPath();
  }
}

/** @returns {boolean} */
function estaAutenticado() {
  return obtenerSesion() !== null;
}

/** @returns {string|null} Nombre del rol activo */
function obtenerRol() {
  const sesion = obtenerSesion();
  return sesion?.usuario?.rol || null;
}

/**
 * Calcula la base relativa hacia /frontend/ según la ubicación actual.
 */
function resolveBaseFrontendPath() {
  if (typeof window === 'undefined') return '/';
  const path = window.location.pathname.replace(/\\/g, '/');
  if (path.includes('/frontend/dashboard/')) {
    return '../../';
  } else if (path.includes('/frontend/auth/')) {
    return '../';
  } else if (path.includes('/frontend/')) {
    return './';
  } else {
    return 'frontend/';
  }
}

/**
 * Calcula la ruta al login relativa a la ubicación actual o raíz del servidor.
 */
function resolveLoginPath() {
  if (typeof window !== 'undefined' && window.location.protocol === 'file:') {
    const base = resolveBaseFrontendPath();
    return `${base}auth/login.html`;
  }
  return '/frontend/auth/login.html';
}

/**
 * Calcula el path al dashboard correcto según el rol y la ubicación actual.
 * @param {string} rol
 * @returns {string}
 */
function resolverRutaDashboard(rol) {
  if (typeof window !== 'undefined' && window.location.protocol === 'file:') {
    const base = resolveBaseFrontendPath();
    const mapRoles = {
      ADMINISTRADOR: `${base}dashboard/admin/index.html`,
      OPERADOR_ALMACEN: `${base}dashboard/almacen/index.html`,
      CLIENTE_MINORISTA: `${base}dashboard/cliente-minorista/index.html`,
      CLIENTE_CORPORATIVO: `${base}dashboard/cliente-corporativo/index.html`,
    };
    return mapRoles[rol] || resolveLoginPath();
  }

  const mapRoles = {
    ADMINISTRADOR: '/frontend/dashboard/admin/index.html',
    OPERADOR_ALMACEN: '/frontend/dashboard/almacen/index.html',
    CLIENTE_MINORISTA: '/frontend/dashboard/cliente-minorista/index.html',
    CLIENTE_CORPORATIVO: '/frontend/dashboard/cliente-corporativo/index.html',
  };
  return mapRoles[rol] || resolveLoginPath();
}

/* ═══════════════════════════════════════════════════════════════
   HELPER DE FETCH CENTRALIZADO
   ═══════════════════════════════════════════════════════════════ */

/**
 * Realiza una petición HTTP autenticada al backend Express.
 * @param {string} endpoint - Ruta relativa a API_BASE (ej: '/auth/me')
 * @param {RequestInit} [options] - Opciones de fetch
 * @param {boolean} [conAuth=true] - Si debe incluir Bearer token
 * @returns {Promise<Object>} Respuesta JSON parseada
 */
async function request(endpoint, options = {}, conAuth = true) {
  const sesion = obtenerSesion();
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };

  if (conAuth && sesion?.token) {
    headers['Authorization'] = `Bearer ${sesion.token}`;
  }

  let res;
  try {
    res = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });
  } catch (netErr) {
    const errorConexion = new Error('No se pudo conectar con el servidor ChocoTi. Verifique su conexión.');
    errorConexion.status = 503;
    errorConexion.isNetworkError = true;
    throw errorConexion;
  }

  // Sesión expirada o token inválido
  if (res.status === 401 && conAuth) {
    if (typeof window !== 'undefined' && window.Toast) {
      window.Toast.error('La sesión ha expirado. Inicie sesión nuevamente.');
    }
    cerrarSesion(true);
    return;
  }

  let data;
  try {
    data = await res.json();
  } catch {
    data = { ok: false, mensaje: `Error HTTP ${res.status}` };
  }

  data._status = res.status;

  if (!res.ok) {
    const err = new Error(data.mensaje || `Error ${res.status}`);
    err.data = data;
    err.status = res.status;
    err.errores = data.errores || [];
    throw err;
  }

  return data;
}

/* ═══════════════════════════════════════════════════════════════
   MÓDULO: AUTH
   ═══════════════════════════════════════════════════════════════ */

const Auth = {
  /**
   * Inicia sesión con email y contraseña.
   * @param {string} email
   * @param {string} password
   */
  async login(email, password) {
    return request(
      '/auth/login',
      {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      },
      false
    );
  },

  /**
   * Registro público de cliente minorista o corporativo.
   */
  async register(datos) {
    return request(
      '/auth/register',
      {
        method: 'POST',
        body: JSON.stringify(datos),
      },
      false
    );
  },

  /**
   * Solicita token de recuperación de contraseña.
   * @param {string} email
   */
  async recuperarPassword(email) {
    return request(
      '/auth/recuperar-password',
      {
        method: 'POST',
        body: JSON.stringify({ email }),
      },
      false
    );
  },

  /**
   * Restablece la contraseña con token emitido.
   * @param {object} datos - { token, password_nueva, password_confirmar }
   */
  async restablecerPassword(datos) {
    return request(
      '/auth/restablecer-password',
      {
        method: 'POST',
        body: JSON.stringify(datos),
      },
      false
    );
  },

  /**
   * Obtiene el perfil del usuario autenticado.
   */
  async getMe() {
    return request('/auth/me');
  },

  /**
   * Actualiza el perfil personal del usuario.
   */
  async updatePerfil(datos) {
    return request('/auth/perfil', {
      method: 'PUT',
      body: JSON.stringify(datos),
    });
  },

  /**
   * Cambia la contraseña del usuario autenticado.
   */
  async cambiarPassword(datos) {
    return request('/auth/password', {
      method: 'PUT',
      body: JSON.stringify(datos),
    });
  },
};

/* ═══════════════════════════════════════════════════════════════
   MÓDULO: USUARIOS (Admin)
   ═══════════════════════════════════════════════════════════════ */

const Usuarios = {
  async listar(filtros = {}) {
    const params = new URLSearchParams(
      Object.entries(filtros).filter(([, v]) => v !== '' && v !== null && v !== undefined)
    ).toString();
    return request(`/usuarios${params ? '?' + params : ''}`);
  },

  async crear(datos) {
    return request('/usuarios', {
      method: 'POST',
      body: JSON.stringify(datos),
    });
  },

  async obtener(id) {
    return request(`/usuarios/${id}`);
  },

  async actualizar(id, datos) {
    return request(`/usuarios/${id}`, {
      method: 'PUT',
      body: JSON.stringify(datos),
    });
  },

  async inactivar(id) {
    return request(`/usuarios/${id}`, { method: 'DELETE' });
  },

  async getStats() {
    return request('/usuarios/stats');
  },

  async getLogs(filtros = {}) {
    const params = new URLSearchParams(
      Object.entries(filtros).filter(([, v]) => v !== '' && v !== null && v !== undefined)
    ).toString();
    return request(`/usuarios/logs${params ? '?' + params : ''}`);
  },
};

/* ═══════════════════════════════════════════════════════════════
   MÓDULO: ALMACENES
   ═══════════════════════════════════════════════════════════════ */

const Almacenes = {
  async listar() {
    return request('/almacenes');
  },
  async obtener(id) {
    return request(`/almacenes/${id}`);
  },
};

/* ═══════════════════════════════════════════════════════════════
   MÓDULO: PRODUCTOS Y CATÁLOGO
   ═══════════════════════════════════════════════════════════════ */

const Productos = {
  async listar(filtros = {}) {
    const params = new URLSearchParams(
      Object.entries(filtros).filter(([, v]) => v !== '' && v !== null && v !== undefined)
    ).toString();
    return request(`/productos${params ? '?' + params : ''}`, {}, false);
  },

  async sugerencias(q) {
    if (!q) return [];
    return request(`/productos/sugerencias?q=${encodeURIComponent(q)}`, {}, false);
  },

  async obtener(id, almacenId = null) {
    const query = almacenId ? `?almacen_id=${almacenId}` : '';
    return request(`/productos/${id}${query}`, {}, false);
  },

  async crear(datos) {
    return request('/productos', {
      method: 'POST',
      body: JSON.stringify(datos),
    });
  },

  async actualizar(id, datos) {
    return request(`/productos/${id}`, {
      method: 'PUT',
      body: JSON.stringify(datos),
    });
  },

  async eliminar(id) {
    return request(`/productos/${id}`, { method: 'DELETE' });
  },

  async listarCategorias() {
    return request('/categorias', {}, false);
  },
};

/* ═══════════════════════════════════════════════════════════════
   MÓDULO: LISTA DE DESEOS (FAVORITOS)
   ═══════════════════════════════════════════════════════════════ */

const Deseos = {
  async listar() {
    return request('/deseos');
  },

  async agregar(productoId) {
    return request('/deseos', {
      method: 'POST',
      body: JSON.stringify({ producto_id: productoId }),
    });
  },

  async eliminar(productoId) {
    return request(`/deseos/${productoId}`, { method: 'DELETE' });
  },

  async sincronizar(productos) {
    return request('/deseos/sincronizar', {
      method: 'POST',
      body: JSON.stringify({ productos }),
    });
  },
};

/* ═══════════════════════════════════════════════════════════════
   MÓDULO: INVENTARIO, KARDEX Y LOTES
   ═══════════════════════════════════════════════════════════════ */

const Inventario = {
  async consultarStock(almacenId = null) {
    const query = almacenId ? `?almacen_id=${almacenId}` : '';
    return request(`/inventario${query}`);
  },

  async consultarAlertas(almacenId = null) {
    const query = almacenId ? `?almacen_id=${almacenId}` : '';
    return request(`/inventario/alertas${query}`);
  },

  async registrarEntrada(datos) {
    return request('/inventario/entradas', {
      method: 'POST',
      body: JSON.stringify(datos),
    });
  },

  async registrarAjuste(datos) {
    return request('/inventario/ajustes', {
      method: 'POST',
      body: JSON.stringify(datos),
    });
  },

  async registrarTraspaso(datos) {
    return request('/inventario/traspasos', {
      method: 'POST',
      body: JSON.stringify(datos),
    });
  },

  async consultarKardex(filtros = {}) {
    const params = new URLSearchParams(
      Object.entries(filtros).filter(([, v]) => v !== '' && v !== null && v !== undefined)
    ).toString();
    return request(`/inventario/kardex${params ? '?' + params : ''}`);
  },

  async consultarLotes(filtros = {}) {
    const params = new URLSearchParams(
      Object.entries(filtros).filter(([, v]) => v !== '' && v !== null && v !== undefined)
    ).toString();
    return request(`/inventario/lotes${params ? '?' + params : ''}`);
  },
};

/* ═══════════════════════════════════════════════════════════════
   CIERRE POR INACTIVIDAD (30 MINUTOS)
   ═══════════════════════════════════════════════════════════════ */

function initInactividadWatcher(tiempoLimiteMinutos = 30) {
  if (typeof window === 'undefined') return;

  let timerInactividad = null;
  const tiempoMs = tiempoLimiteMinutos * 60 * 1000;

  function reiniciarTimer() {
    if (!estaAutenticado()) return;

    if (timerInactividad) clearTimeout(timerInactividad);

    timerInactividad = setTimeout(() => {
      if (estaAutenticado()) {
        if (window.Toast) {
          window.Toast.warning('Sesión cerrada por inactividad prolongada.');
        }
        cerrarSesion(true);
      }
    }, tiempoMs);
  }

  ['mousedown', 'keydown', 'scroll', 'touchstart'].forEach((evento) => {
    window.addEventListener(evento, reiniciarTimer, { passive: true });
  });

  reiniciarTimer();
}

// Iniciar detector de inactividad al cargar en navegador
if (typeof window !== 'undefined') {
  initInactividadWatcher(30);
}

/* ═══════════════════════════════════════════════════════════════
   MÓDULO: PLANILLA DE VENTAS Y COMPROBANTES (MÓDULO 7)
   ═══════════════════════════════════════════════════════════════ */

const Planilla = {
  /**
   * Lista pedidos (planilla) con filtros, paginación y orden.
   * El backend aplica restricción por rol automáticamente.
   * @param {Object} [filtros={}] q, estado_pedido, estado_pago, metodo_pago,
   *   almacen_id, fecha_inicio, fecha_fin, pagina, limite, orden, dir
   */
  async listar(filtros = {}) {
    const params = Object.entries(filtros)
      .filter(([, v]) => v !== '' && v !== null && v !== undefined);
    const qs = new URLSearchParams(params).toString();
    return request(`/planilla${qs ? `?${qs}` : ''}`);
  },

  /**
   * Descarga la planilla en formato CSV como Blob.
   * @param {Object} [filtros={}]
   */
  async descargarCSV(filtros = {}) {
    const sesion = obtenerSesion();
    if (!sesion) throw new Error('Sesión requerida para descargar CSV');
    const params = Object.entries({ ...filtros, formato: 'csv' })
      .filter(([, v]) => v !== '' && v !== null && v !== undefined);
    const qs = new URLSearchParams(params).toString();
    const url = `${API_BASE}/planilla${qs ? `?${qs}` : ''}`;
    const resp = await fetch(url, {
      headers: { Authorization: `Bearer ${sesion.token}` },
    });
    if (!resp.ok) throw new Error(`Error al descargar CSV: ${resp.status}`);
    return resp.blob();
  },

  /**
   * Obtiene el comprobante / nota de venta de un pedido específico.
   * @param {number} pedidoId
   */
  async obtenerComprobante(pedidoId) {
    return request(`/planilla/${pedidoId}/comprobante`);
  },
};



/* ═══════════════════════════════════════════════════════════════
   MÓDULO: PUNTOS DE VENTA Y AGENCIAS (FASE 5A)
   ═══════════════════════════════════════════════════════════════ */

const PuntosVenta = {
  /**
   * Obtiene exclusivamente las agencias propias (Tipo P) autorizadas para recojo de pedidos.
   */
  async obtenerAgenciasPropias() {
    return request('/puntos-venta/agencias-propias', {}, false);
  },

  /**
   * Lista puntos de venta con filtros opcionales.
   * @param {Object} [filtros={}]
   */
  async listar(filtros = {}) {
    const qs = new URLSearchParams(filtros).toString();
    return request(`/puntos-venta${qs ? `?${qs}` : ''}`, {}, false);
  },
};

/* ═══════════════════════════════════════════════════════════════
   MÓDULO: PEDIDOS Y CHECKOUT (FASE 5A)
   ═══════════════════════════════════════════════════════════════ */

const Pedidos = {
  /**
   * Registra un nuevo pedido en el checkout con reserva temporal de stock.
   * @param {Object} payload
   */
  async crear(payload) {
    return request(
      '/pedidos',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      estaAutenticado()
    );
  },

  /**
   * Consulta pública de un pedido por su código (ej. PED-2026-1001).
   * @param {string} codigo
   */
  async obtenerPorCodigo(codigo) {
    return request(`/pedidos/codigo/${encodeURIComponent(codigo)}`, {}, false);
  },

  /**
   * Obtiene detalle de un pedido por ID (requiere sesión autorizada).
   * @param {number} id
   */
  async obtenerPorId(id) {
    return request(`/pedidos/${id}`);
  },

  /**
   * Lista los pedidos según el rol del usuario autenticado.
   * @param {Object} [filtros={}]
   */
  async listar(filtros = {}) {
    const qs = new URLSearchParams(filtros).toString();
    return request(`/pedidos${qs ? `?${qs}` : ''}`);
  },
  async listar(filtros = {}) {
    const qs = new URLSearchParams(filtros).toString();
    return request(`/pedidos${qs ? `?${qs}` : ''}`);
  },

  async cambiarEstado(id, datos) {
    return request(`/pedidos/${id}/estado`, {
      method: 'PATCH',
      body: JSON.stringify(datos),
    });
  },
};

/* ═══════════════════════════════════════════════════════════════
   MÓDULO: PAGOS Y PASARELAS (FASE 5A)
   ═══════════════════════════════════════════════════════════════ */

const Pagos = {
  /**
   * Consulta el estado de un intento de pago en tiempo real (Polling QR y Depósito).
   * @param {string} referencia
   */
  async consultarEstado(referencia) {
    return request(`/pagos/estado/${encodeURIComponent(referencia)}`, {}, false);
  },

  /**
   * Carga el comprobante bancario en formato Base64 (máx 2MB).
   * @param {Object} payload
   */
  async subirComprobante(payload) {
    return request(
      '/pagos/subir-comprobante',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      estaAutenticado()
    );
  },

  /**
   * Verificación de depósito bancario (Admin u Operador).
   * @param {Object} payload
   */
  async verificarDeposito(payload) {
    return request('/pagos/verificar-deposito', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  /**
   * Registro de cobro en efectivo en mostrador (Admin u Operador).
   * @param {Object} payload
   */
  async cobroEfectivoTienda(payload) {
    return request('/pagos/cobro-efectivo-tienda', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  /**
   * Simula la notificación de confirmación o rechazo del banco para QR Simple (Demo).
   * @param {Object} payload
   */
  async notificarBancoDemo(payload) {
    return request(
      '/pagos/demo-banco-notificar',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      false
    );
  },

  // ── Fase 5B: PayPal ──────────────────────────────────────────────────────

  /**
   * Crea una orden PayPal en el servidor y devuelve { orderId, approvalUrl, montoUSD }.
   * El monto se calcula 100% en el servidor (nunca se envía desde el frontend).
   * @param {{ pedidoId: number }} payload
   */
  async paypalCrearOrden(payload) {
    return request(
      '/pagos/paypal/create',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      estaAutenticado()
    );
  },

  /**
   * Consulta el estado actual de una orden PayPal directamente en PayPal.
   * @param {string} orderId
   */
  async paypalObtenerEstado(orderId) {
    return request(
      `/pagos/paypal/status/${encodeURIComponent(orderId)}`,
      { method: 'GET' },
      false
    );
  },
};

const API = {
  // Auth
  login: Auth.login.bind(Auth),
  register: Auth.register.bind(Auth),
  recuperarPassword: Auth.recuperarPassword.bind(Auth),
  restablecerPassword: Auth.restablecerPassword.bind(Auth),
  getMe: Auth.getMe.bind(Auth),
  updatePerfil: Auth.updatePerfil.bind(Auth),
  cambiarPassword: Auth.cambiarPassword.bind(Auth),

  // Usuarios
  listarUsuarios: Usuarios.listar.bind(Usuarios),
  crearUsuario: Usuarios.crear.bind(Usuarios),
  obtenerUsuario: Usuarios.obtener.bind(Usuarios),
  actualizarUsuario: Usuarios.actualizar.bind(Usuarios),
  inactivarUsuario: Usuarios.inactivar.bind(Usuarios),
  getStatsUsuarios: Usuarios.getStats.bind(Usuarios),
  getLogs: Usuarios.getLogs.bind(Usuarios),

  // Almacenes
  listarAlmacenes: Almacenes.listar.bind(Almacenes),
  obtenerAlmacen: Almacenes.obtener.bind(Almacenes),

  // Productos y Catálogo
  listarProductos: Productos.listar.bind(Productos),
  obtenerSugerencias: Productos.sugerencias.bind(Productos),
  obtenerProducto: Productos.obtener.bind(Productos),
  crearProducto: Productos.crear.bind(Productos),
  actualizarProducto: Productos.actualizar.bind(Productos),
  eliminarProducto: Productos.eliminar.bind(Productos),
  listarCategorias: Productos.listarCategorias.bind(Productos),

  // Deseos (Favoritos)
  listarDeseos: Deseos.listar.bind(Deseos),
  agregarDeseo: Deseos.agregar.bind(Deseos),
  eliminarDeseo: Deseos.eliminar.bind(Deseos),
  sincronizarDeseos: Deseos.sincronizar.bind(Deseos),

  // Inventario y Kardex
  consultarInventario: Inventario.consultarStock.bind(Inventario),
  consultarAlertasInventario: Inventario.consultarAlertas.bind(Inventario),
  registrarEntradaInventario: Inventario.registrarEntrada.bind(Inventario),
  registrarAjusteInventario: Inventario.registrarAjuste.bind(Inventario),
  registrarTraspasoInventario: Inventario.registrarTraspaso.bind(Inventario),
  consultarKardex: Inventario.consultarKardex.bind(Inventario),
  consultarLotes: Inventario.consultarLotes.bind(Inventario),

  // Fase 5A: Pedidos y Pagos

// Fase 5A: Pedidos y Pagos
crearPedido: Pedidos.crear.bind(Pedidos),
obtenerPedidoPorCodigo: Pedidos.obtenerPorCodigo.bind(Pedidos),
consultarEstadoPago: Pagos.consultarEstado.bind(Pagos),
subirComprobantePago: Pagos.subirComprobante.bind(Pagos),
notificarBancoDemo: Pagos.notificarBancoDemo.bind(Pagos),
obtenerAgenciasPropias: PuntosVenta.obtenerAgenciasPropias.bind(PuntosVenta),

  // Fase 5B: PayPal
  paypalCrearOrden: Pagos.paypalCrearOrden.bind(Pagos),
  paypalObtenerEstado: Pagos.paypalObtenerEstado.bind(Pagos),

  // Módulo 7: Planilla de Ventas y Comprobantes
  listarPlanilla: Planilla.listar.bind(Planilla),
  descargarPlanillaCSV: Planilla.descargarCSV.bind(Planilla),
  obtenerComprobante: Planilla.obtenerComprobante.bind(Planilla),
  listarPedidos: Pedidos.listar.bind(Pedidos),
  cambiarEstadoPedido: Pedidos.cambiarEstado.bind(Pedidos),


  // Namespaces directos
  Productos,
  Deseos,
  Inventario,
  PuntosVenta,
  Pedidos,
  Pagos,
  Planilla,

  // Sesión y Navegación
  guardarSesion,
  obtenerSesion,
  cerrarSesion,
  estaAutenticado,
  obtenerRol,
  resolverRutaDashboard,
  resolveLoginPath,
};

if (typeof window !== 'undefined') {
  window.API = API;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = API;
}
