-- =============================================================================
-- ChocoTi-Digital | Esquema de Base de Datos Integral DDL & Datos Semilla
-- Motor: SQLite 3 ('chocoti.db' / 'chocoti_security.db')
-- Chocolates Para Ti · Solur S.R.L. · Sucre, Bolivia
-- Arquitectura RUP/AUP en 3 Capas · Patrón Repositorio
-- =============================================================================

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- =============================================================================
-- 1. TABLA: roles
-- Los 4 perfiles autorizados en el sistema ChocoTi-Digital.
-- =============================================================================
CREATE TABLE IF NOT EXISTS roles (
    id          INTEGER     PRIMARY KEY AUTOINCREMENT,
    nombre      TEXT        NOT NULL UNIQUE,
    descripcion TEXT
);

-- =============================================================================
-- 2. TABLA: almacenes
-- Planta Central en Sucre y Agencias Nacionales autorizadas.
-- =============================================================================
CREATE TABLE IF NOT EXISTS almacenes (
    id          INTEGER     PRIMARY KEY AUTOINCREMENT,
    nombre      TEXT        NOT NULL,
    ciudad      TEXT        NOT NULL,
    direccion   TEXT,
    tipo        TEXT        NOT NULL CHECK(tipo IN ('CENTRAL', 'AGENCIA')),
    activo      INTEGER     NOT NULL DEFAULT 1 -- 1 = Activo, 0 = Inactivo
);

-- =============================================================================
-- 3. TABLA: usuarios
-- Credenciales, perfiles y estado de usuarios internos y clientes.
-- =============================================================================
CREATE TABLE IF NOT EXISTS usuarios (
    id              INTEGER     PRIMARY KEY AUTOINCREMENT,
    nombre_completo TEXT        NOT NULL,
    email           TEXT        NOT NULL UNIQUE,
    password_hash   TEXT        NOT NULL,
    ci_nit          TEXT,
    telefono        TEXT,
    tipo_cliente    TEXT        NOT NULL CHECK(tipo_cliente IN ('MINORISTA', 'CORPORATIVO', 'INTERNO')),
    razon_social    TEXT,       -- Obligatorio para CLIENTE_CORPORATIVO (B2B)
    rol_id          INTEGER     NOT NULL,
    almacen_id      INTEGER,    -- Solo para operadores de almacén (NULL para clientes)
    estado          TEXT        NOT NULL DEFAULT 'ACTIVO' CHECK(estado IN ('ACTIVO', 'INACTIVO', 'BLOQUEADO')),
    intentos_fallidos INTEGER   NOT NULL DEFAULT 0,
    bloqueado_hasta DATETIME,
    token_recuperacion TEXT,
    token_expira_en DATETIME,
    fecha_creacion  DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ultima_conexion DATETIME,
    FOREIGN KEY (rol_id)     REFERENCES roles(id)     ON UPDATE CASCADE,
    FOREIGN KEY (almacen_id) REFERENCES almacenes(id) ON UPDATE CASCADE
);

-- =============================================================================
-- 4. TABLA: logs_acceso
-- Auditoría obligatoria de todos los intentos de autenticación.
-- =============================================================================
CREATE TABLE IF NOT EXISTS logs_acceso (
    id              INTEGER     PRIMARY KEY AUTOINCREMENT,
    usuario_id      INTEGER,
    fecha_hora      DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ip_origen       TEXT,
    estado_login    TEXT        NOT NULL CHECK(estado_login IN ('EXITOSO', 'FALLIDO')),
    detalles        TEXT,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL ON UPDATE CASCADE
);

-- =============================================================================
-- 5. TABLA: categorias
-- Líneas de productos oficiales de Chocolates Para Ti.
-- =============================================================================
CREATE TABLE IF NOT EXISTS categorias (
    id          INTEGER     PRIMARY KEY AUTOINCREMENT,
    nombre      TEXT        NOT NULL UNIQUE,
    descripcion TEXT,
    activo      INTEGER     NOT NULL DEFAULT 1
);

-- =============================================================================
-- 6. TABLA: productos (Catálogo de SKUs)
-- =============================================================================
CREATE TABLE IF NOT EXISTS productos (
    id              INTEGER     PRIMARY KEY AUTOINCREMENT,
    sku             TEXT        NOT NULL UNIQUE,
    nombre          TEXT        NOT NULL,
    descripcion     TEXT,
    precio          DECIMAL(10, 2) NOT NULL CHECK(precio >= 0),
    categoria_id    INTEGER     NOT NULL,
    imagen_url      TEXT,
    stock_minimo    INTEGER     NOT NULL DEFAULT 10 CHECK(stock_minimo >= 0),
    activo          INTEGER     NOT NULL DEFAULT 1,
    fecha_creacion  DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (categoria_id) REFERENCES categorias(id) ON UPDATE CASCADE
);

-- =============================================================================
-- 7. TABLA: inventario (Stock por Almacén)
-- =============================================================================
CREATE TABLE IF NOT EXISTS inventario (
    id              INTEGER     PRIMARY KEY AUTOINCREMENT,
    producto_id     INTEGER     NOT NULL,
    almacen_id      INTEGER     NOT NULL,
    stock_actual    INTEGER     NOT NULL DEFAULT 0 CHECK(stock_actual >= 0),
    stock_reservado INTEGER     NOT NULL DEFAULT 0 CHECK(stock_reservado >= 0),
    updated_at      DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(producto_id, almacen_id),
    FOREIGN KEY (producto_id) REFERENCES productos(id) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (almacen_id)  REFERENCES almacenes(id) ON DELETE CASCADE ON UPDATE CASCADE
);

-- =============================================================================
-- 8. TABLA: lotes (Gestión de Vencimientos FEFO)
-- =============================================================================
CREATE TABLE IF NOT EXISTS lotes (
    id                  INTEGER     PRIMARY KEY AUTOINCREMENT,
    lote_codigo         TEXT        NOT NULL,
    producto_id         INTEGER     NOT NULL,
    almacen_id          INTEGER     NOT NULL,
    cantidad            INTEGER     NOT NULL CHECK(cantidad >= 0),
    fecha_vencimiento   DATE        NOT NULL,
    fecha_ingreso       DATE        NOT NULL DEFAULT (date('now')),
    estado              TEXT        NOT NULL DEFAULT 'VIGENTE' CHECK(estado IN ('VIGENTE', 'AGOTADO', 'VENCIDO')),
    FOREIGN KEY (producto_id) REFERENCES productos(id) ON UPDATE CASCADE,
    FOREIGN KEY (almacen_id)  REFERENCES almacenes(id) ON UPDATE CASCADE
);

-- =============================================================================
-- 9. TABLA: kardex_movimientos (Auditoría inmutable de inventario)
-- =============================================================================
CREATE TABLE IF NOT EXISTS kardex_movimientos (
    id                  INTEGER     PRIMARY KEY AUTOINCREMENT,
    tipo_movimiento     TEXT        NOT NULL CHECK(tipo_movimiento IN ('ENTRADA', 'SALIDA_VENTA', 'AJUSTE', 'TRASPASO')),
    producto_id         INTEGER     NOT NULL,
    almacen_origen_id   INTEGER,
    almacen_destino_id  INTEGER,
    cantidad            INTEGER     NOT NULL CHECK(cantidad > 0),
    usuario_id          INTEGER,
    motivo              TEXT        NOT NULL,
    fecha_hora          DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (producto_id) REFERENCES productos(id) ON UPDATE CASCADE,
    FOREIGN KEY (almacen_origen_id) REFERENCES almacenes(id) ON UPDATE CASCADE,
    FOREIGN KEY (almacen_destino_id) REFERENCES almacenes(id) ON UPDATE CASCADE,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL ON UPDATE CASCADE
);

-- =============================================================================
-- 10. TABLA: puntos_venta (47 Sucursales y Puntos Aliados a nivel nacional)
-- =============================================================================
CREATE TABLE IF NOT EXISTS puntos_venta (
    id              INTEGER     PRIMARY KEY AUTOINCREMENT,
    ciudad          TEXT        NOT NULL,
    tipo            TEXT        NOT NULL CHECK(tipo IN ('P', 'A', 'C')), -- P: Propia, A: Aliado, C: Cadena
    nombre          TEXT        NOT NULL,
    direccion       TEXT        NOT NULL,
    telefono        TEXT,
    permite_recojo  INTEGER     NOT NULL DEFAULT 0, -- 1 SOLO si tipo = 'P'
    activo          INTEGER     NOT NULL DEFAULT 1,
    UNIQUE(ciudad, nombre, direccion)
);

-- =============================================================================
-- 11. TABLA: pedidos (Ventas, Pagos y Despachos Omnicanal)
-- =============================================================================
CREATE TABLE IF NOT EXISTS pedidos (
    id                  INTEGER         PRIMARY KEY AUTOINCREMENT,
    codigo_pedido       TEXT            NOT NULL UNIQUE, -- ej. 'PED-2026-1001'
    usuario_id          INTEGER,        -- NULL si es compra como invitado
    cliente_nombre      TEXT            NOT NULL,
    cliente_ci_nit      TEXT            NOT NULL,
    cliente_razon_social TEXT,
    cliente_telefono    TEXT            NOT NULL,
    cliente_email       TEXT            NOT NULL,
    tipo_entrega        TEXT            NOT NULL CHECK(tipo_entrega IN ('RECOJO_AGENCIA', 'ENVIO_DOMICILIO')),
    punto_recojo_id     INTEGER,        -- FK puntos_venta tipo P si es RECOJO_AGENCIA
    direccion_envio     TEXT,           -- Requerido si ENVIO_DOMICILIO
    referencia_envio    TEXT,
    ciudad_destino      TEXT            NOT NULL,
    almacen_id          INTEGER         NOT NULL DEFAULT 1, -- Almacén que despacha
    metodo_pago         TEXT            NOT NULL CHECK(metodo_pago IN ('QR', 'TRANSFERENCIA', 'PAYPAL', 'EFECTIVO_TIENDA')),
    estado_pago         TEXT            NOT NULL DEFAULT 'PENDIENTE' CHECK(estado_pago IN ('PENDIENTE', 'PAGADO', 'VENCIDO', 'RECHAZADO')),
    estado_pedido       TEXT            NOT NULL DEFAULT 'PENDIENTE_PAGO' CHECK(estado_pedido IN ('PENDIENTE_PAGO', 'PAGADO', 'EN_PREPARACION', 'PREPARADO', 'EMPACADO', 'LISTO_DESPACHO', 'LISTO_RECOJO', 'DESPACHADO', 'ENTREGADO', 'FINALIZADO', 'CANCELADO', 'EXPIRADO', 'ENTREGA_FALLIDA', 'DEVUELTO')),
    subtotal            DECIMAL(10, 2)  NOT NULL CHECK(subtotal >= 0),
    costo_envio         DECIMAL(10, 2)  NOT NULL DEFAULT 0 CHECK(costo_envio >= 0),
    descuento           DECIMAL(10, 2)  NOT NULL DEFAULT 0 CHECK(descuento >= 0),
    total               DECIMAL(10, 2)  NOT NULL CHECK(total >= 0),
    monto_usd           DECIMAL(10, 2), -- Monto equivalente cobrado para pasarelas internacionales (PayPal)
    tipo_cambio_usd     DECIMAL(10, 4)  DEFAULT 6.96, -- Tasa BOB/USD aplicada en servidor
    codigo_retiro       TEXT            UNIQUE, -- Código corto único para retiro seguro en agencia
    fecha_limite_retiro DATETIME,       -- Plazo máximo para recoger antes de expiración
    fecha_finalizado    DATETIME,       -- Marca temporal de cierre definitivo
    dias_para_finalizar INTEGER         DEFAULT 7, -- Auto-finalización tras N días de entregado
    comprobante_url     TEXT,           -- Imagen o PDF de comprobante bancario (máx 2MB)
    transaccion_ref     TEXT,           -- Número de transacción bancaria / referencia externa
    guia_envio          TEXT            UNIQUE, -- ej. 'GUIA-SUC-89210'
    courier             TEXT            DEFAULT 'Transporte Expreso Chocolates Para Ti (Demo)',
    notas               TEXT,
    created_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL ON UPDATE CASCADE,
    FOREIGN KEY (punto_recojo_id) REFERENCES puntos_venta(id) ON UPDATE CASCADE,
    FOREIGN KEY (almacen_id) REFERENCES almacenes(id) ON UPDATE CASCADE
);

-- =============================================================================
-- 11b. TABLA: pedido_historial_estados (Auditoría inmutable de transiciones)
-- Registra quién cambió el estado, cuándo, desde qué rol y el motivo/comentario.
-- =============================================================================
CREATE TABLE IF NOT EXISTS pedido_historial_estados (
    id                  INTEGER     PRIMARY KEY AUTOINCREMENT,
    pedido_id           INTEGER     NOT NULL,
    estado_anterior     TEXT,
    estado_nuevo        TEXT        NOT NULL,
    usuario_id          INTEGER,    -- NULL si es transición automática por sistema/cron
    rol_transicion      TEXT,
    motivo              TEXT,
    comentario          TEXT,
    fecha_hora          DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (pedido_id) REFERENCES pedidos(id) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL ON UPDATE CASCADE
);

-- =============================================================================
-- 11c. TABLA: pagos_intentos (Intentos de Pago con Proveedor, Referencia y Vencimiento)
-- Soporta QR Simple (adaptador/banco demo), Depósito Bancario y PayPal Orders v2.
-- =============================================================================
CREATE TABLE IF NOT EXISTS pagos_intentos (
    id                  INTEGER         PRIMARY KEY AUTOINCREMENT,
    pedido_id           INTEGER         NOT NULL,
    proveedor           TEXT            NOT NULL CHECK(proveedor IN ('QR_SIMPLE', 'DEPOSITO_BANCARIO', 'PAYPAL', 'EFECTIVO_TIENDA')),
    referencia_externa  TEXT,           -- ID orden/captura PayPal, Nro de operación bancaria, ID QR
    monto_bob           DECIMAL(10, 2)  NOT NULL,
    monto_usd           DECIMAL(10, 2),
    tipo_cambio         DECIMAL(10, 4)  DEFAULT 6.96,
    estado              TEXT            NOT NULL DEFAULT 'PENDIENTE' CHECK(estado IN ('PENDIENTE', 'PAGADO', 'VENCIDO', 'RECHAZADO')),
    datos_proveedor_json TEXT,          -- Payload devuelto por API PayPal, adaptador QR o banco
    comprobante_url     TEXT,           -- Imagen o PDF subido por cliente (máx 2MB)
    banco_origen        TEXT,
    fecha_operacion     DATE,
    numero_operacion    TEXT,
    verificado_por_id   INTEGER,        -- Admin u Operador que verificó
    fecha_verificacion  DATETIME,
    motivo_rechazo      TEXT,
    expira_en           DATETIME,
    created_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (pedido_id) REFERENCES pedidos(id) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (verificado_por_id) REFERENCES usuarios(id) ON DELETE SET NULL ON UPDATE CASCADE
);

-- =============================================================================
-- 11d. TABLA: pedido_preparacion (Checklist de Picking y Lotes FEFO por Almacén)
-- Rol: PREPARADOR_PEDIDOS
-- =============================================================================
CREATE TABLE IF NOT EXISTS pedido_preparacion (
    id                      INTEGER     PRIMARY KEY AUTOINCREMENT,
    pedido_id               INTEGER     NOT NULL UNIQUE,
    almacen_id              INTEGER     NOT NULL,
    preparador_id           INTEGER     NOT NULL,
    fecha_inicio            DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_fin               DATETIME,
    checklist_picking_json  TEXT,       -- Checklist de productos, cantidades y lotes FEFO confirmados
    incidencia_stock        INTEGER     NOT NULL DEFAULT 0, -- 1 si hubo falta de stock físico
    detalle_incidencia      TEXT,
    estado                  TEXT        NOT NULL DEFAULT 'EN_PROCESO' CHECK(estado IN ('EN_PROCESO', 'COMPLETADO', 'INCIDENCIA')),
    notas                   TEXT,
    created_at              DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (pedido_id) REFERENCES pedidos(id) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (almacen_id) REFERENCES almacenes(id) ON UPDATE CASCADE,
    FOREIGN KEY (preparador_id) REFERENCES usuarios(id) ON UPDATE CASCADE
);

-- =============================================================================
-- 11e. TABLA: pedido_empaque (Checklist de Empaque, Térmico, Tarjetas y Cajas)
-- Rol: EMPACADOR
-- =============================================================================
CREATE TABLE IF NOT EXISTS pedido_empaque (
    id                      INTEGER         PRIMARY KEY AUTOINCREMENT,
    pedido_id               INTEGER         NOT NULL UNIQUE,
    almacen_id              INTEGER         NOT NULL,
    empacador_id            INTEGER         NOT NULL,
    fecha_inicio            DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_fin               DATETIME,
    empaque_termico         INTEGER         NOT NULL DEFAULT 0, -- 1 si destino/temporada requiere térmico
    tarjeta_mensaje         INTEGER         NOT NULL DEFAULT 0, -- 1 si cliente solicitó tarjeta/dedicatoria
    texto_tarjeta           TEXT,
    etiqueta_generada       INTEGER         NOT NULL DEFAULT 0,
    peso_kg                 DECIMAL(6, 2)   CHECK(peso_kg >= 0),
    numero_cajas            INTEGER         DEFAULT 1 CHECK(numero_cajas >= 1),
    checklist_empaque_json  TEXT,           -- Checklist de validación de embalaje y sellado
    estado                  TEXT            NOT NULL DEFAULT 'EN_PROCESO' CHECK(estado IN ('EN_PROCESO', 'COMPLETADO')),
    notas                   TEXT,
    created_at              DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (pedido_id) REFERENCES pedidos(id) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (almacen_id) REFERENCES almacenes(id) ON UPDATE CASCADE,
    FOREIGN KEY (empacador_id) REFERENCES usuarios(id) ON UPDATE CASCADE
);

-- =============================================================================
-- 11f. TABLA: pedido_entregas (Despacho, Asignación Courier, Entrega o Retiro)
-- Rol: DESPACHADOR_ENTREGA
-- =============================================================================
CREATE TABLE IF NOT EXISTS pedido_entregas (
    id                      INTEGER         PRIMARY KEY AUTOINCREMENT,
    pedido_id               INTEGER         NOT NULL UNIQUE,
    despachador_id          INTEGER,        -- Despachador asignado
    almacen_id              INTEGER         NOT NULL,
    tipo_entrega            TEXT            NOT NULL CHECK(tipo_entrega IN ('ENVIO_DOMICILIO', 'RECOJO_AGENCIA')),
    courier                 TEXT,
    guia_transporte         TEXT,
    codigo_retiro           TEXT,           -- Código corto único para recojo
    codigo_retiro_validado  INTEGER         NOT NULL DEFAULT 0,
    receptor_nombre         TEXT,           -- Nombre de quien recibe
    receptor_ci             TEXT,           -- CI de quien recibe
    foto_comprobante_url    TEXT,           -- Foto opcional de entrega
    intentos_realizados     INTEGER         NOT NULL DEFAULT 0,
    max_intentos            INTEGER         NOT NULL DEFAULT 3,
    motivo_fallo            TEXT,
    estado_entrega          TEXT            NOT NULL DEFAULT 'LISTO' CHECK(estado_entrega IN ('LISTO', 'EN_CAMINO', 'ENTREGADO', 'ENTREGA_FALLIDA', 'DEVUELTO')),
    fecha_despacho          DATETIME,
    fecha_entrega           DATETIME,
    observaciones           TEXT,
    created_at              DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at              DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (pedido_id) REFERENCES pedidos(id) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (despachador_id) REFERENCES usuarios(id) ON UPDATE CASCADE,
    FOREIGN KEY (almacen_id) REFERENCES almacenes(id) ON UPDATE CASCADE
);

-- =============================================================================
-- 12. TABLA: pedido_detalles (Líneas de Compra)
-- =============================================================================
CREATE TABLE IF NOT EXISTS pedido_detalles (
    id              INTEGER         PRIMARY KEY AUTOINCREMENT,
    pedido_id       INTEGER         NOT NULL,
    producto_id     INTEGER         NOT NULL,
    cantidad        INTEGER         NOT NULL CHECK(cantidad > 0),
    precio_unitario DECIMAL(10, 2)  NOT NULL CHECK(precio_unitario >= 0),
    subtotal        DECIMAL(10, 2)  NOT NULL CHECK(subtotal >= 0),
    FOREIGN KEY (pedido_id)   REFERENCES pedidos(id)   ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (producto_id) REFERENCES productos(id) ON UPDATE CASCADE
);

-- =============================================================================
-- 13. TABLA: reservas_stock (Reserva temporal en Checkout)
-- =============================================================================
CREATE TABLE IF NOT EXISTS reservas_stock (
    id              INTEGER     PRIMARY KEY AUTOINCREMENT,
    pedido_id       INTEGER     NOT NULL,
    producto_id     INTEGER     NOT NULL,
    almacen_id      INTEGER     NOT NULL,
    cantidad        INTEGER     NOT NULL CHECK(cantidad > 0),
    expira_en       DATETIME    NOT NULL,
    estado          TEXT        NOT NULL DEFAULT 'ACTIVA' CHECK(estado IN ('ACTIVA', 'CONFIRMADA', 'LIBERADA', 'EXPIRADA')),
    created_at      DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (pedido_id)   REFERENCES pedidos(id)   ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (producto_id) REFERENCES productos(id) ON UPDATE CASCADE,
    FOREIGN KEY (almacen_id)  REFERENCES almacenes(id) ON UPDATE CASCADE
);

-- =============================================================================
-- 14. TABLA: cotizaciones_b2b (Portal Corporativo y Mayorista)
-- =============================================================================
CREATE TABLE IF NOT EXISTS cotizaciones_b2b (
    id                  INTEGER     PRIMARY KEY AUTOINCREMENT,
    codigo              TEXT        NOT NULL UNIQUE, -- ej. 'COT-2026-001'
    usuario_id          INTEGER,    -- Opcional si está logueado como corporativo
    empresa             TEXT        NOT NULL,
    nit                 TEXT        NOT NULL,
    contacto_nombre     TEXT        NOT NULL,
    email               TEXT        NOT NULL,
    telefono            TEXT        NOT NULL,
    detalle_solicitud   TEXT        NOT NULL,
    estado              TEXT        NOT NULL DEFAULT 'NUEVA' CHECK(estado IN ('NUEVA', 'EN_REVISION', 'COTIZADA', 'CERRADA')),
    respuesta_admin     TEXT,
    fecha_respuesta     DATETIME,
    created_at          DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL ON UPDATE CASCADE
);

-- =============================================================================
-- 15. TABLA: lista_deseos (Favoritos persistentes para clientes autenticados)
-- =============================================================================
CREATE TABLE IF NOT EXISTS lista_deseos (
    id              INTEGER     PRIMARY KEY AUTOINCREMENT,
    usuario_id      INTEGER     NOT NULL,
    producto_id     INTEGER     NOT NULL,
    created_at      DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(usuario_id, producto_id),
    FOREIGN KEY (usuario_id)   REFERENCES usuarios(id)   ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (producto_id)  REFERENCES productos(id)  ON DELETE CASCADE ON UPDATE CASCADE
);

-- =============================================================================
-- 16. TABLA: bandeja_simulada (Notificaciones de Correo en Plan Free de Render)
-- =============================================================================
CREATE TABLE IF NOT EXISTS bandeja_simulada (
    id                  INTEGER     PRIMARY KEY AUTOINCREMENT,
    pedido_id           INTEGER,
    destinatario        TEXT        NOT NULL,
    asunto              TEXT        NOT NULL,
    contenido_html      TEXT        NOT NULL,
    tipo_notificacion   TEXT        NOT NULL, -- ej. 'CONFIRMACION_COMPRA', 'RECUPERAR_PASSWORD', 'INSTRUCCIONES_PAGO', 'CAMBIO_ESTADO'
    fecha_envio         DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (pedido_id) REFERENCES pedidos(id) ON DELETE SET NULL ON UPDATE CASCADE
);

-- =============================================================================
-- 17. TABLA: notificaciones_logs (Bitácora de notificaciones enviadas y fallidas)
-- =============================================================================
CREATE TABLE IF NOT EXISTS notificaciones_logs (
    id              INTEGER     PRIMARY KEY AUTOINCREMENT,
    pedido_id       INTEGER,
    canal           TEXT        NOT NULL CHECK(canal IN ('EMAIL', 'WHATSAPP')),
    destinatario    TEXT        NOT NULL,
    estado          TEXT        NOT NULL CHECK(estado IN ('ENVIADO', 'SIMULADO', 'FALLIDO')),
    detalle_error   TEXT,
    mensaje_resumen TEXT,
    fecha_registro  DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (pedido_id) REFERENCES pedidos(id) ON DELETE SET NULL ON UPDATE CASCADE
);

-- =============================================================================
-- TRIGGERS E ÍNDICES DE RENDIMIENTO Y AUDITORÍA
-- =============================================================================
CREATE TRIGGER IF NOT EXISTS trg_actualizar_ultima_conexion
AFTER INSERT ON logs_acceso
WHEN NEW.estado_login = 'EXITOSO' AND NEW.usuario_id IS NOT NULL
BEGIN
    UPDATE usuarios
    SET    ultima_conexion = NEW.fecha_hora,
           intentos_fallidos = 0,
           bloqueado_hasta = NULL
    WHERE  id = NEW.usuario_id;
END;

CREATE INDEX IF NOT EXISTS idx_productos_sku ON productos(sku);
CREATE INDEX IF NOT EXISTS idx_productos_categoria ON productos(categoria_id);
CREATE INDEX IF NOT EXISTS idx_inventario_prod_alm ON inventario(producto_id, almacen_id);
CREATE INDEX IF NOT EXISTS idx_lotes_vencimiento ON lotes(fecha_vencimiento);
CREATE INDEX IF NOT EXISTS idx_pedidos_codigo ON pedidos(codigo_pedido);
CREATE INDEX IF NOT EXISTS idx_pedidos_guia ON pedidos(guia_envio);
CREATE INDEX IF NOT EXISTS idx_reservas_expira ON reservas_stock(expira_en, estado);
CREATE INDEX IF NOT EXISTS idx_puntos_venta_ciudad ON puntos_venta(ciudad);
CREATE INDEX IF NOT EXISTS idx_historial_pedido ON pedido_historial_estados(pedido_id);
CREATE INDEX IF NOT EXISTS idx_pagos_pedido ON pagos_intentos(pedido_id);
CREATE INDEX IF NOT EXISTS idx_pagos_referencia ON pagos_intentos(referencia_externa);
CREATE INDEX IF NOT EXISTS idx_preparacion_pedido ON pedido_preparacion(pedido_id);
CREATE INDEX IF NOT EXISTS idx_empaque_pedido ON pedido_empaque(pedido_id);
CREATE INDEX IF NOT EXISTS idx_entregas_pedido ON pedido_entregas(pedido_id);
CREATE INDEX IF NOT EXISTS idx_entregas_retiro ON pedido_entregas(codigo_retiro);

-- =============================================================================
-- DATOS SEMILLA: roles (7 Roles oficiales)
-- =============================================================================
INSERT OR IGNORE INTO roles (id, nombre, descripcion) VALUES
    (1, 'ADMINISTRADOR',        'Acceso total al sistema: gestión de usuarios, auditoría, almacenes y configuración global.'),
    (2, 'OPERADOR_ALMACEN',     'Gestión logística: control de existencias, despachos y recepción en almacén asignado.'),
    (3, 'CLIENTE_MINORISTA',    'Cliente consumidor final con acceso al catálogo digital, carrito y seguimiento de pedidos.'),
    (4, 'CLIENTE_CORPORATIVO',  'Cliente empresarial (B2B) con lista de precios mayorista, cotizaciones y pedidos institucionales.'),
    (5, 'PREPARADOR_PEDIDOS',   'Picking en almacén asignado: selección de lotes según política FEFO y checklist de preparación.'),
    (6, 'EMPACADOR',            'Control de calidad en embalaje: empaque térmico, rotulado, tarjetas dedicatorias y cajas.'),
    (7, 'DESPACHADOR_ENTREGA',  'Despacho, asignación de couriers, validación de retiros en agencia y actas de entrega.');

-- =============================================================================
-- DATOS SEMILLA: almacenes (Planta Central Sucre y Agencias oficiales)
-- =============================================================================
INSERT OR IGNORE INTO almacenes (id, nombre, ciudad, direccion, tipo, activo) VALUES
    (1, 'Planta Central Sucre',  'Sucre',         'Av. Hernando Siles 123 (Planta Matriz)', 'CENTRAL', 1),
    (2, 'Agencia La Paz',        'La Paz',        'Calle Comercio 456, Zona Central',       'AGENCIA', 1),
    (3, 'Agencia Cochabamba',    'Cochabamba',    'Blvd. Recoleta 789, Cala Cala',          'AGENCIA', 1),
    (4, 'Agencia Santa Cruz',    'Santa Cruz',    'Av. Cristo Redentor 1011, 2do Anillo',   'AGENCIA', 1);

-- =============================================================================
-- DATOS SEMILLA: categorias (7 Categorías oficiales de Chocolates Para Ti)
-- =============================================================================
INSERT OR IGNORE INTO categorias (id, nombre, descripcion) VALUES
    (1, 'Combos', 'Combinaciones especiales de surtido de chocolates y regalos.'),
    (2, 'Chocolates en Cajas Artesanales', 'Presentaciones premium en estuches típicos y madera tallada.'),
    (3, 'Chocolates en Cajas', 'Cajas de bombones finos y chocolates surtidos.'),
    (4, 'Grageas en Bolsa', 'Grageas crocantes con almendras, arroz, maní y macarrón.'),
    (5, 'Tabletas de Chocolate', 'Barras y tabletas de chocolate puro tradicional y con agregados.'),
    (6, 'Paletas', 'Paletas artesanales con figuras y formas divertidas.'),
    (7, 'Chocolates en Bolsa', 'Bolsas de bombones con crema, fruta y sabores selectos.');

-- =============================================================================
-- DATOS SEMILLA: productos (12 SKUs oficiales según especificación)
-- =============================================================================
INSERT OR IGNORE INTO productos (id, sku, nombre, descripcion, precio, categoria_id, stock_minimo, activo) VALUES
    (1,  '3BOLBOM100', 'Bolsa bombón con crema 100 g',      'Deliciosos bombones con crema fina en bolsa hermética de 100 g.', 15.50, 7, 15, 1),
    (2,  '3BOLBOM200', 'Bolsa bombón con crema 200 g',      'Tradicionales bombones con suave crema en presentación familiar de 200 g.', 30.00, 7, 10, 1),
    (3,  '3BOLCHF100', 'Bolsa chocolate con fruta 100 g',    'Selección de chocolates rellenos con frutos andinos y tropicales 100 g.', 22.00, 7, 10, 1),
    (4,  '3BOLCHR100', 'Bolsa chocolates rellenos 100 g',   'Chocolates surtidos con exquisitos rellenos variados 100 g.', 23.50, 7, 10, 1),
    (5,  '3BOLCHS100', 'Bolsa chocolates con sabores 100 g','Bolsa de chocolates con esencias y sabores tradicionales de Sucre 100 g.', 22.50, 7, 10, 1),
    (6,  '3BOLGAL050', 'Grageas de almendras 50 g',         'Almendras seleccionadas bañadas en chocolate con leche 50 g.', 7.00, 4, 20, 1),
    (7,  '3BOLGAL100', 'Grageas de almendras 100 g',        'Crocantes almendras tostadas cubiertas de chocolate premium 100 g.', 14.00, 4, 15, 1),
    (8,  '3BOLGAR050', 'Grageas de arroz 50 g',             'Arroz crocante inflado bañado en chocolate con leche 50 g.', 7.00, 4, 20, 1),
    (9,  '3BOLGAR100', 'Grageas de arroz 100 g',            'Grageas de arroz crocante con doble capa de chocolate 100 g.', 14.00, 4, 15, 1),
    (10, '3BOLGMA050', 'Grageas de maní 50 g',              'Maní tostado crujiente recubierto de chocolate fino 50 g.', 7.00, 4, 20, 1),
    (11, '3BOLGMA100', 'Grageas de maní 100 g',             'Bolsa de grageas de maní bañadas en chocolate con leche 100 g.', 14.00, 4, 15, 1),
    (12, '3BOLGMC050', 'Grageas de macarrón 50 g',          'Grageas artesanales de macarrón con cobertura de cacao 50 g.', 7.00, 4, 20, 1);

-- =============================================================================
-- DATOS SEMILLA: inventario inicial distribuido en los 4 almacenes
-- =============================================================================
INSERT OR IGNORE INTO inventario (producto_id, almacen_id, stock_actual, stock_reservado) VALUES
    -- Planta Central Sucre (Almacén 1)
    (1, 1, 150, 0), (2, 1, 120, 0), (3, 1, 80, 0), (4, 1, 95, 0), (5, 1, 110, 0),
    (6, 1, 200, 0), (7, 1, 180, 0), (8, 1, 150, 0), (9, 1, 140, 0), (10, 1, 220, 0),
    (11, 1, 190, 0), (12, 1, 130, 0),
    -- Agencia La Paz (Almacén 2)
    (1, 2, 60, 0), (2, 2, 45, 0), (3, 2, 30, 0), (4, 2, 35, 0), (5, 2, 40, 0),
    (6, 2, 80, 0), (7, 2, 70, 0), (8, 2, 50, 0), (9, 2, 50, 0), (10, 2, 90, 0),
    (11, 2, 75, 0), (12, 2, 45, 0),
    -- Agencia Cochabamba (Almacén 3)
    (1, 3, 50, 0), (2, 3, 35, 0), (3, 3, 25, 0), (4, 3, 30, 0), (5, 3, 35, 0),
    (6, 3, 70, 0), (7, 3, 60, 0), (8, 3, 40, 0), (9, 3, 40, 0), (10, 3, 75, 0),
    (11, 3, 65, 0), (12, 3, 35, 0),
    -- Agencia Santa Cruz (Almacén 4)
    (1, 4, 80, 0), (2, 4, 60, 0), (3, 4, 40, 0), (4, 4, 50, 0), (5, 4, 55, 0),
    (6, 4, 110, 0), (7, 4, 95, 0), (8, 4, 65, 0), (9, 4, 70, 0), (10, 4, 120, 0),
    (11, 4, 105, 0), (12, 4, 55, 0);

-- =============================================================================
-- DATOS SEMILLA: lotes iniciales para control FEFO
-- =============================================================================
INSERT OR IGNORE INTO lotes (id, lote_codigo, producto_id, almacen_id, cantidad, fecha_vencimiento, estado) VALUES
    (1, 'LOT-2026-BOM-01', 1, 1, 150, date('now', '+180 days'), 'VIGENTE'),
    (2, 'LOT-2026-BOM-02', 2, 1, 120, date('now', '+180 days'), 'VIGENTE'),
    (3, 'LOT-2026-GRA-01', 6, 1, 200, date('now', '+240 days'), 'VIGENTE'),
    (4, 'LOT-2026-GRA-02', 10, 1, 220, date('now', '+210 days'), 'VIGENTE'),
    (5, 'LOT-2026-LPZ-01', 1, 2, 60,  date('now', '+150 days'), 'VIGENTE'),
    (6, 'LOT-2026-SCZ-01', 1, 4, 80,  date('now', '+160 days'), 'VIGENTE');

-- =============================================================================
-- DATOS SEMILLA: puntos_venta (47 Sucursales y Puntos Oficiales de Bolivia)
-- Cargados desde /docs/puntos_venta.md
-- Tipo P: Agencia Propia (permite_recojo = 1)
-- Tipo A: Aliado (permite_recojo = 0)
-- Tipo C: Cadena (permite_recojo = 0)
-- =============================================================================
INSERT OR IGNORE INTO puntos_venta (ciudad, tipo, nombre, direccion, telefono, permite_recojo) VALUES
    -- SUCRE
    ('Sucre', 'P', 'Agencia Principal Chocolates Para Ti', 'Calle Arenales Nº 7', '6443177', 1),
    ('Sucre', 'P', 'Agencia Chocolates Para Ti', 'Calle Audiencia Nº 68', '6437901', 1),
    ('Sucre', 'P', 'Agencia Chocolates Para Ti', 'Av. de las Américas esq. Colombia', '6454260', 1),
    ('Sucre', 'P', 'Agencia Chocolates Para Ti - Aeropuerto', 'Aeropuerto Alcantarí', '67600209', 1),
    ('Sucre', 'P', 'Agencia Chocolates Para Ti - Fábrica', 'Calle Monteagudo', '6455689', 1),
    ('Sucre', 'P', 'Agencia Chocolates Para Ti - Terminal de Buses', 'Av. Ostria Gutiérrez', '6443113', 1),
    ('Sucre', 'A', 'Supermercado SAS', 'Calle J.J. Pérez Nº 331 (Zona Central)', '6462443', 0),
    ('Sucre', 'C', 'Cadena de Supermercados Líder', 'varias sucursales', '6432480', 0),
    ('Sucre', 'A', 'Supermercado Mercamax', 'Calle Panamá Nº 149 (edif. Roxana Mariscal III)', NULL, 0),
    ('Sucre', 'A', 'Supermercado Paceña', 'Calle Guillermo Loayza, antes del Mercado Campesino', NULL, 0),
    ('Sucre', 'A', 'Micromercado Petrolero', 'Calle Colombia Nº 291 entre Av. de las Américas y René Barrientos', '6454752', 0),
    ('Sucre', 'A', 'Mini Super Variété', 'Av. Emilio Mendizábal esq. Nicaragua', NULL, 0),
    ('Sucre', 'A', 'Micromercado Día a Día', 'Calle Camargo esq. Avaroa', '6434193', 0),
    ('Sucre', 'A', 'Micromercado Max Simple', 'Av. Jaime Mendoza Nº 882', '72876145', 0),
    ('Sucre', 'A', 'Micromercado Ksero', 'Emilio Mendizábal esq. Colombia', NULL, 0),
    ('Sucre', 'A', 'Micromercado Cabir', 'Lemoine Nº 502 entre Miguel Ángel y Plazuela Inisterio', NULL, 0),
    ('Sucre', 'A', 'Micromercado La Surtida', 'Av. Juana Azurduy de Padilla', '6458179', 0),
    ('Sucre', 'A', 'Tienda de Regalos Dulce Vida', 'Av. Ostria Gutiérrez Nº 420', NULL, 0),

    -- LA PAZ
    ('La Paz', 'P', 'Tienda Chocolates Para Ti - Zona Sur', 'Claudio Aliaga Nº 1211 (entre Enrique Peñaranda y Gabriel René Moreno)', '79305787', 1),
    ('La Paz', 'P', 'Tienda Chocolates Para Ti - Sopocachi', 'Av. 20 de Octubre Nº 393 esq. Lisímaco Gutiérrez', '79305787', 1),
    ('La Paz', 'P', 'Tienda Chocolates Para Ti - Miraflores', 'Calle Panamá Nº 1289 (entre c. Guerrilleros Lanza y c. Estados Unidos)', '79305787', 1),
    ('La Paz', 'A', 'Centro de Comercio Peatonal', 'Calle Murillo Nº 1028 Local 14', '77763487', 0),
    ('La Paz', 'A', 'Dulce Momento', 'Ecuador Nº 2598', NULL, 0),
    ('La Paz', 'A', 'Dulcemanía', 'Calle Potosí Nº 1081 Zona Central', '2906300', 0),
    ('La Paz', 'A', 'Chocomundo', 'Prado, edificio 16 de Julio', NULL, 0),
    ('La Paz', 'A', 'Chocolates y Regalos', 'Av. Saavedra Nº 2162 (frente al Hospital Cossmil, Miraflores)', '77240917', 0),
    ('La Paz', 'A', 'Chocopop', 'Shopping Norte, planta baja', NULL, 0),
    ('La Paz', 'A', 'Delicor', 'Av. Ballivián Nº 302 esq. calle 9, Calacoto (zona sur)', '2787883', 0),
    ('La Paz', 'A', 'Dufly Bolivia', 'Aeropuerto Internacional El Alto', '2821000', 0),
    ('La Paz', 'A', 'Chocomanía', 'Av. Mariscal Santa Cruz esq. Cochabamba, edificio Lotería Nacional', NULL, 0),
    ('La Paz', 'A', 'Dulcemente', 'Av. Sánchez Lima, mercado Sopocachi', NULL, 0),
    ('La Paz', 'A', 'Nicci Regalos', 'Av. Mariscal Santa Cruz, frente a Correos de Bolivia Nº 1215, dentro del centro', NULL, 0),
    ('La Paz', 'C', 'Hipermaxi; Andy''s; Farmacorp; Delicor; Pedidos Ya Market', 'varias sucursales', NULL, 0),

    -- EL ALTO
    ('El Alto', 'A', 'Chocolatería Pameluz', 'Av. Juan Pablo II Nº 2560, galería 1', NULL, 0),
    ('El Alto', 'A', 'Apaza Sur', 'Av. Franco Valle y Calle 1, frente a la plaza del Lustrabotas', NULL, 0),
    ('El Alto', 'A', 'Choco Adela', 'Zona Esperanza, por la terminal interprovincial', NULL, 0),
    ('El Alto', 'A', 'Tienda ASODIM', 'Mercado Mayorista, Av. Tiahuanacu y Av. Charaña', NULL, 0),

    -- COCHABAMBA
    ('Cochabamba', 'A', 'Brancatti La Cioccolata', 'Calle Aniceto Padilla E 530 (entre Plazuela Recoleta y Potosí)', '4488793', 0),
    ('Cochabamba', 'A', 'Bombonería Tentación', 'Av. Heroínas (entre Ayacucho y Baptista)', '79729733', 0),
    ('Cochabamba', 'A', 'La Golosa', 'Calle 25 de Mayo Nº 333 (al lado del CBA)', '4520294', 0),
    ('Cochabamba', 'A', 'Chocoprix', 'Av. Monseñor Roberto Nicoli casi calle Granado (lado Clínica Arebalo, Sacaba)', NULL, 0),
    ('Cochabamba', 'A', 'Mundo Chocolatoso', 'Av. Libertador Bolívar Nº 1321', NULL, 0),
    ('Cochabamba', 'A', 'Tienda Aeropuerto', 'Aeropuerto Jorge Wilstermann, lado preembarque', '4488793', 0),
    ('Cochabamba', 'A', 'Almacén GMC', 'Av. América entre Enrique Arce y Héctor Cossio', NULL, 0),
    ('Cochabamba', 'A', 'Xocacau', 'Calle Ladislao Cabrera Nº 657 (entre Antezana y Lanza)', '70712000', 0),
    ('Cochabamba', 'A', 'Micromercado Rote', 'Av. Libertador Bolívar y Av. América Oeste', NULL, 0),
    ('Cochabamba', 'A', 'Bombonería Libertad', 'Calle Esteban Arce Nº 455 (entre Jordán y Calama)', '4256437', 0),
    ('Cochabamba', 'A', 'Súper Hass', 'Av. Heroínas Nº 585 (esq. Lanza y San Martín)', '4234233', 0),
    ('Cochabamba', 'A', 'Re Barato', 'Av. Melchor Pérez entre Av. América y Alcides Arguedas', '4251242', 0),
    ('Cochabamba', 'A', 'Chocolatería Nelly (Quillacollo)', 'Calle Gral. Pando y Antofagasta (frente a la plazuela Lanza)', '72711944', 0),
    ('Cochabamba', 'A', 'Chocobom', 'Cine Center y Terminal de Buses', NULL, 0),
    ('Cochabamba', 'C', 'Hipermaxi; IC Norte; A Market; Súper Mercado América; Farmacorp', 'varias sucursales', '4249127', 0),

    -- SANTA CRUZ
    ('Santa Cruz', 'A', 'Tienda Mericita', 'Calle Vallegrande Nº 40, zona 7 Calles', '75369463', 0),
    ('Santa Cruz', 'A', 'Makro Parque', 'Av. Paraguá y 4to anillo', NULL, 0),
    ('Santa Cruz', 'A', 'Duty Fly Bolivia', 'Aeropuerto Viru Viru', '3852425', 0),
    ('Santa Cruz', 'A', 'Perfect Love', 'Calle Ingavi entre Colón y Vallegrande', NULL, 0),
    ('Santa Cruz', 'A', 'Luxury Shop', 'Ventura Mall', NULL, 0),
    ('Santa Cruz', 'A', 'Supermercado Mixtura', 'Av. Brasil, 3er anillo', NULL, 0),
    ('Santa Cruz', 'C', 'Drugstore Farmacorp; Delicor; Multicenter; Hipermaxi; IC Norte; Fidalga; Tía; Makro Mayorista; A Market', 'varias sucursales', NULL, 0),

    -- ORURO
    ('Oruro', 'A', 'Mundolate', 'Calle Montesinos esq. Potosí', '5253721', 0),
    ('Oruro', 'A', 'Dorita Chocolate House', 'Sargento Tejerina entre Sucre y Murguía', '72481423', 0),
    ('Oruro', 'A', 'Dulce Seducción', 'Calle Adolfo Mier entre Pagador, casi esq. Junín', '72467145', 0),
    ('Oruro', 'A', 'Bombonería Don Braulio', 'Calle Velasco Galvarro entre Bolívar y Adolfo Mier', '5276946 / 73847142', 0),
    ('Oruro', 'A', 'Bomcor', 'Calle Bolívar Nº 373 entre Pagador y Potosí', NULL, 0),
    ('Oruro', 'A', 'Supermercado Global', 'Calle Junín entre La Plata y Presidente Montes', NULL, 0),
    ('Oruro', 'C', 'Farmacorp', 'varias sucursales', NULL, 0),

    -- POTOSÍ
    ('Potosí', 'A', 'Tienda Bolívar', 'Calle Bolívar Nº 636 entre Oruro y Camacho', '6222663', 0),
    ('Potosí', 'A', 'Tarjetería Valeria', 'Pasaje Boulevard Nº 20', '26225776', 0),
    ('Potosí', 'A', 'Rosticería La Pollita', 'Calle Linares Nº 24, Pasaje Boulevard, a una cuadra de la plaza', '6222262', 0),
    ('Potosí', 'A', 'Bazar Melanie', 'Calle Linares Nº 54 entre Padilla y Millares', '6225367 / 6230933', 0),
    ('Potosí', 'A', 'Tienda Germán Mariscal', 'Calle Bustillos Nº 1060, casi calle Frías y Ayacucho', NULL, 0),
    ('Potosí', 'A', 'Supermercado del Sur', 'Calle Mejillones esq. Periodista (zona San Pedro)', '76173911 / 6223414', 0),
    ('Potosí', 'A', 'Supermercado Snowfall', 'Calle La Paz Nº 835', '72405256', 0),
    ('Potosí', 'A', 'Supermercado Family', 'M. García entre Av. Murillo y Colombia', '78724992', 0),

    -- TARIJA
    ('Tarija', 'A', 'Todo Dulce', 'Calle 15 de Abril entre Méndez y Suipacha', NULL, 0),
    ('Tarija', 'A', 'Supermercado Urkupiña II', 'Av. Las Américas, al lado de SETAR', NULL, 0),
    ('Tarija', 'A', 'Supermercado Urkupiña Megacenter', 'Av. Integración', NULL, 0),
    ('Tarija', 'A', 'Comercial Ceal', 'Calle Sucre pasando la calle Domingo Paz', NULL, 0),
    ('Tarija', 'A', 'Supermercado Colosal (sucursal I)', 'Av. Font esq. Defensores del Chaco, barrio Juan XXIII', NULL, 0),
    ('Tarija', 'A', 'Supermercado Colosal (sucursal 2)', 'Calle Francisco Urriondo, casi esq. Av. Julio Castillo', NULL, 0),
    ('Tarija', 'A', 'Supermercado CA', 'Calle Alejandro del Carpio esq. O''Connor', NULL, 0),
    ('Tarija', 'A', 'Super Durán', 'Barrio Tabladita, Av. Los Molles esq. 10 de Noviembre Nº 247', NULL, 0),
    ('Tarija', 'A', 'Maxicompras', 'Mercado Campesino', NULL, 0),
    ('Tarija', 'A', 'Super Mío (sucursal 1)', 'Calle Méndez esq. Ingavi', NULL, 0),
    ('Tarija', 'A', 'Super Mío (sucursal 2)', 'Av. 4 de Julio, barrio Luis de Fuentes', NULL, 0),
    ('Tarija', 'C', 'Farmacorp', 'varias sucursales', NULL, 0),

    -- PANDO
    ('Pando', 'A', 'Librería Claudia', 'Av. Emilio Fernández, casi esq. Oruro', NULL, 0),
    ('Pando', 'A', 'La Casa de los Vinos', 'Calle Juan Oliveira, cerca de la Cruz Milagrosa', NULL, 0),
    ('Pando', 'A', 'Florería Florales', 'Av. 9 de Febrero Nº 179', NULL, 0),
    ('Pando', 'C', 'Farmacia Farmacorp', 'varias sucursales', NULL, 0),

    -- YACUIBA
    ('Yacuiba', 'A', 'Silvia Hilarión Calderón', 'Calle Ballivián entre 7 y 8, zona Mercado Campesino (Barrio Petrolero)', '77891900', 0),
    ('Yacuiba', 'A', 'The Best Candy Bar', 'Calle Santa Cruz entre Sucre y Campero, zona Mercado Central', '72087104', 0);

-- =============================================================================
-- DATOS SEMILLA: usuarios iniciales para los 7 roles autorizados
-- Documentados en README.md
-- =============================================================================
INSERT OR IGNORE INTO usuarios
    (id, nombre_completo, email, password_hash, ci_nit, telefono, tipo_cliente, razon_social, rol_id, almacen_id, estado, fecha_creacion)
VALUES
    -- 1. Rol: ADMINISTRADOR
    (1, 'Administrador ChocoTi', 'admin@chocolatesti.bo', '$2a$10$OSgtqZzk6nEDKpwGwMIw7eTWtgCnqzV0Im1vDnZWJHyJ6Sp7762cq', '1020304-CH', '72889900', 'INTERNO', NULL, 1, 1, 'ACTIVO', CURRENT_TIMESTAMP),
    -- 2. Rol: OPERADOR_ALMACEN (Planta Central Sucre)
    (2, 'Operador Sucre', 'operador.sucre@chocolatesti.bo', '$2a$10$Uo2/s1S5O4u1dfyoIUfGNurq2ayykm.RdTfNtaiq./Qt2gnKUM3Vq', '2030405-CH', '71223344', 'INTERNO', NULL, 2, 1, 'ACTIVO', CURRENT_TIMESTAMP),
    -- 3. Rol: OPERADOR_ALMACEN (Agencia La Paz)
    (3, 'Operador La Paz', 'operador.lapaz@chocolatesti.bo', '$2a$10$Uo2/s1S5O4u1dfyoIUfGNurq2ayykm.RdTfNtaiq./Qt2gnKUM3Vq', '3040506-LP', '73445566', 'INTERNO', NULL, 2, 2, 'ACTIVO', CURRENT_TIMESTAMP),
    -- 4. Rol: CLIENTE_MINORISTA
    (4, 'Ana María Flores', 'cliente@gmail.com', '$2a$10$rj1PMIVNc4ES5BF3w/etZeyiXRXxbPETAHOolhFTf5b5IG/6h6P4a', '5678901-SC', '78990011', 'MINORISTA', NULL, 3, NULL, 'ACTIVO', CURRENT_TIMESTAMP),
    -- 5. Rol: CLIENTE_CORPORATIVO (B2B)
    (5, 'Carlos Mendoza (ACME)', 'empresa@acme.bo', '$2a$10$RldKcA/0vstBKAz7zxf8KOz.iThx4nqonDaTlM3PNJ023uOGiPkRy', '1023456789', '46412345', 'CORPORATIVO', 'ACME Distribuidora Bolivia S.R.L.', 4, NULL, 'ACTIVO', CURRENT_TIMESTAMP),
    -- 6. Rol: PREPARADOR_PEDIDOS (Planta Central Sucre)
    (6, 'Preparador Sucre', 'preparador.sucre@chocolatesti.bo', '$2a$10$eSOhqMBDAAqKaGQnvDOzWe.F/Qrjss/QUipaCxztIbqq6lLtn3eq2', '4050607-CH', '71556677', 'INTERNO', NULL, 5, 1, 'ACTIVO', CURRENT_TIMESTAMP),
    -- 7. Rol: EMPACADOR (Planta Central Sucre)
    (7, 'Empacador Sucre', 'empacador.sucre@chocolatesti.bo', '$2a$10$oaAK6ZKV6t2lBQtUt5IZX.QmHCPk1SV7Lc2YT9JI8munkfbkZorAy', '5060708-CH', '72667788', 'INTERNO', NULL, 6, 1, 'ACTIVO', CURRENT_TIMESTAMP),
    -- 8. Rol: DESPACHADOR_ENTREGA (Planta Central Sucre)
    (8, 'Despachador Sucre', 'despachador.sucre@chocolatesti.bo', '$2a$10$oO3CXqLSPYmeMqxQDxKDZ.nHEAAV.C6To7yFG1dWCSFSU5lCy3n6G', '6070809-CH', '73778899', 'INTERNO', NULL, 7, 1, 'ACTIVO', CURRENT_TIMESTAMP);
