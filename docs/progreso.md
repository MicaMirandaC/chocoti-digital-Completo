# Bitácora de Progreso y Control de Fases
## Sistema E-Commerce y Gestión Omnicanal "ChocoTi-Digital"
### Chocolates Para Ti · Sucre, Bolivia

---

## 📊 Resumen General del Estado del Proyecto

| Fase | Descripción | Estado | Fecha de Finalización |
|:---:|---|:---:|:---:|
| **Fase 1** | Especificación, HU/CU, Matrices, Pila Justificada y Diagramas de Arquitectura | ✅ COMPLETADA | 15/11/2026 |
| **Fase 2** | Estructura de carpetas, schema.sql con semillas completas, config de empresa, package.json raíz, servidor base idempotente y health check | ✅ COMPLETADA | 15/11/2026 |
| **Fase 3** | Seguridad y Acceso (Login/Registro limpio sin credenciales en pantalla, JWT, bloqueo temporal, recuperación por token, Toasts y pruebas) | ✅ COMPLETADA | 15/11/2026 |
| **Fase 3B** | **Ajustes del Ingeniero (`docs/prompt_chocoti.md`):** 7 roles oficiales, 14 estados de pedido, 5 nuevas tablas, matriz de transiciones RBAC con 403, PayPal Sandbox, picking FEFO, empaque térmico, entrega/actas y tests | ✅ COMPLETADA | 17/11/2026 |
| **Fase 4** | Catálogo dinámico con buscador y semáforos, lista de deseos, cálculo de disponible real (`Físico - Reservas`) y límite de compra en carrito | ✅ COMPLETADA | 17/11/2026 |
| **Fase 5A** | **Checkout y Métodos de Pago:** Pregunta de cuenta, formulario omnicanal (envío vs recojo tipo P), QR Simple (15m, polling y banco simulado), Depósito bancario (máx 2MB y verificación RBAC) y Efectivo en tienda (48h) | ✅ COMPLETADA | 17/11/2026 |
| **Fase 5B** | Pago internacional con PayPal (Orders v2 Sandbox, cálculo en USD a tasa 6.96, capturas idempotentes) | ⏳ PENDIENTE | SIGUIENTE PASO |
| **Fase 6** | Notificaciones de Compra (Correo API HTTPS y WhatsApp wa.me), Planillas de Venta, Comprobante Imprimible (@media print) y Exportación CSV | ✅ COMPLETADA | 19/11/2026 |
| **Fase 7A** | Preparación y Picking por Almacén Asignado: Selección de lotes FEFO y checklist de preparación (Rol `PREPARADOR_PEDIDOS`) | ✅ COMPLETADA | 19/11/2026 |
| **Fase 7B** | Empaque Térmico (Rol `EMPACADOR`), Despacho, Retiro en Agencia, Actas de Entrega con Foto/CI (Rol `DESPACHADOR_ENTREGA`) y Seguimiento Real | ⏳ PENDIENTE | No iniciada |
| **Fase 8A** | Directorio de Puntos de Venta (47 sucursales), Bienvenida con Redes Sociales y Portal B2B Mayorista | ⏳ PENDIENTE | No iniciada |
| **Fase 8B** | Paneles por Rol, Reportes Gerenciales, Auto-finalización de Pedidos y Revisión Integral para Despliegue en Render | ⏳ PENDIENTE | No iniciada |

---

## 📝 Detalle de Entregables por Fase

### Fase 1: Análisis y Diseño Arquitectónico (/docs) — ✅ COMPLETADA
- [x] **Historias de Usuario por Módulo:** [docs/historias_usuario.md](file:///d:/SIS324%20INGENIERIA%20DE%20SOFTWARE/ChocoTi-Digital/docs/historias_usuario.md) con criterios de aceptación Gherkin en 11 módulos.
- [x] **Casos de Uso Principales:** [docs/casos_uso.md](file:///d:/SIS324%20INGENIERIA%20DE%20SOFTWARE/ChocoTi-Digital/docs/casos_uso.md) con diagrama general Mermaid y tablas detalladas.
- [x] **Matriz de Permisos RBAC:** [docs/matriz_permisos.md](file:///d:/SIS324%20INGENIERIA%20DE%20SOFTWARE/ChocoTi-Digital/docs/matriz_permisos.md) mapeando los 5 roles frente a cada funcionalidad y endpoint protegido.
- [x] **Pila Tecnológica Justificada:** [docs/stack_tecnologico.md](file:///d:/SIS324%20INGENIERIA%20DE%20SOFTWARE/ChocoTi-Digital/docs/stack_tecnologico.md) fundamentando Node.js, Express, better-sqlite3 (WAL mode) con Patrón Repositorio y adaptadores para Render Cloud.
- [x] **Diagramas de Arquitectura en Mermaid:** [docs/diagramas_arquitectura.md](file:///d:/SIS324%20INGENIERIA%20DE%20SOFTWARE/ChocoTi-Digital/docs/diagramas_arquitectura.md) (Paquetes, Clases, Componentes, Despliegue en Render, DFD 0 y 1, Entidad-Relación).
- [x] **Matriz de Trazabilidad:** [docs/matriz_trazabilidad.md](file:///d:/SIS324%20INGENIERIA%20DE%20SOFTWARE/ChocoTi-Digital/docs/matriz_trazabilidad.md).
- [x] **Riesgos y Restricciones:** [docs/riesgos_restricciones.md](file:///d:/SIS324%20INGENIERIA%20DE%20SOFTWARE/ChocoTi-Digital/docs/riesgos_restricciones.md).
- [x] **Registro de Decisiones y Supuestos:** [docs/decisiones.md](file:///d:/SIS324%20INGENIERIA%20DE%20SOFTWARE/ChocoTi-Digital/docs/decisiones.md).

---

### Fase 2: Fundación y Base de Datos — ✅ COMPLETADA
- [x] **Configuración Centralizada de Empresa:** [config/empresa.js](file:///d:/SIS324%20INGENIERIA%20DE%20SOFTWARE/ChocoTi-Digital/config/empresa.js) con identidad de Solur S.R.L., 12 SKUs del catálogo de semilla, redes sociales, tiempos de reserva y campos "POR DEFINIR".
- [x] **Esquema DDL Completo y Semillas:** [database/schema.sql](file:///d:/SIS324%20INGENIERIA%20DE%20SOFTWARE/ChocoTi-Digital/database/schema.sql) con 17 tablas, triggers, índices y semillas oficiales completas (4 roles, 4 almacenes, 7 categorías, 12 SKUs, 92 puntos de venta de Bolivia clasificados P/A/C).
- [x] **Configuración para Render en la Raíz:** [package.json](file:///d:/SIS324%20INGENIERIA%20DE%20SOFTWARE/ChocoTi-Digital/package.json), [.env.example](file:///d:/SIS324%20INGENIERIA%20DE%20SOFTWARE/ChocoTi-Digital/.env.example), [.env](file:///d:/SIS324%20INGENIERIA%20DE%20SOFTWARE/ChocoTi-Digital/.env) y [.gitignore](file:///d:/SIS324%20INGENIERIA%20DE%20SOFTWARE/ChocoTi-Digital/.gitignore).
- [x] **Servidor Base Express y Arranque Idempotente:** [server.js](file:///d:/SIS324%20INGENIERIA%20DE%20SOFTWARE/ChocoTi-Digital/server.js), [backend/src/app.js](file:///d:/SIS324%20INGENIERIA%20DE%20SOFTWARE/ChocoTi-Digital/backend/src/app.js) y [backend/src/config/database.js](file:///d:/SIS324%20INGENIERIA%20DE%20SOFTWARE/ChocoTi-Digital/backend/src/config/database.js) con validación de `JWT_SECRET` y endpoint `GET /api/health` verificado.

---

### Fase 3: Seguridad y Acceso — ✅ COMPLETADA
- [x] **Depuración Estricta de Credenciales Expuestas:**
  - Eliminación total de botones de auto-rellenado (`.cred-pill`), tablas de contraseñas y listas de cuentas demo en [index.html](file:///d:/SIS324%20INGENIERIA%20DE%20SOFTWARE/ChocoTi-Digital/index.html) y [frontend/auth/login.html](file:///d:/SIS324%20INGENIERIA%20DE%20SOFTWARE/ChocoTi-Digital/frontend/auth/login.html).
  - Respuestas de error genéricas contra enumeración de usuarios: *"Correo o contraseña incorrectos"*.
- [x] **Autenticación, Tokens JWT y Bloqueo por Fuerza Bruta:**
  - Hashing bcrypt (10 rondas) y emisión de JWT (8h de expiración).
  - Bloqueo temporal por 15 minutos tras 5 intentos fallidos consecutivos en [backend/src/services/authService.js](file:///d:/SIS324%20INGENIERIA%20DE%20SOFTWARE/ChocoTi-Digital/backend/src/services/authService.js) y [backend/src/models/Usuario.js](file:///d:/SIS324%20INGENIERIA%20DE%20SOFTWARE/ChocoTi-Digital/backend/src/models/Usuario.js).
  - Registro inmutable de cada intento en la tabla `logs_acceso`.
- [x] **Registro Público Seguro de Clientes:**
  - Endpoint `POST /api/auth/register` con asignación estricta de roles seguros en backend: `CLIENTE_MINORISTA` (rol 3) y `CLIENTE_CORPORATIVO` (rol 4, con Razón Social y NIT obligatorios). El backend ignora cualquier rol manipulado enviado desde el cliente.
  - Validación de fortaleza de contraseña: mínimo 8 caracteres, 1 mayúscula, 1 minúscula y 1 número.
- [x] **Recuperación de Contraseña por Token de un Solo Uso:**
  - Endpoints `POST /api/auth/recuperar-password` y `POST /api/auth/restablecer-password`.
  - Generación de token criptográfico de 32 bytes con expiración de 1 hora.
  - Despacho mediante [backend/src/adapters/emailAdapter.js](file:///d:/SIS324%20INGENIERIA%20DE%20SOFTWARE/ChocoTi-Digital/backend/src/adapters/emailAdapter.js) con respaldo automático en `bandeja_simulada` en SQLite y bitácora en `notificaciones_logs`.
- [x] **Componente Universal de Notificaciones Toast:**
  - Implementado en [frontend/shared/js/toasts.js](file:///d:/SIS324%20INGENIERIA%20DE%20SOFTWARE/ChocoTi-Digital/frontend/shared/js/toasts.js) y [frontend/shared/css/toasts.css](file:///d:/SIS324%20INGENIERIA%20DE%20SOFTWARE/ChocoTi-Digital/frontend/shared/css/toasts.css).
  - Cierre automático diferenciado: 3.5 segundos para éxito/información y 6 segundos para error/advertencia.
  - Botón de cierre manual "✕", pausa al situar el mouse (`mouseenter` / `mouseleave`), máximo 3 notificaciones apiladas simultáneamente, deduplicación estricta y accesibilidad (`aria-live`).
  - Reemplazo transparente y seguro de `window.alert()`.
- [x] **Cierre de Sesión por Inactividad:**
  - Detector en [frontend/shared/js/api.js](file:///d:/SIS324%20INGENIERIA%20DE%20SOFTWARE/ChocoTi-Digital/frontend/shared/js/api.js) que cierra la sesión tras 30 minutos de inactividad del usuario.
- [x] **Suite Automatizada de Pruebas de Seguridad:**
  - [tests/auth.test.js](file:///d:/SIS324%20INGENIERIA%20DE%20SOFTWARE/ChocoTi-Digital/tests/auth.test.js) pasando al 100% en `npm test` verificando: login de los roles, respuestas genéricas, bloqueo tras 5 intentos, protección de roles en registro, recuperación por token y no exposición de contraseñas en pantallas.

---

### Fase 3B: Ajustes del Ingeniero (`docs/ajustes_ingeniero.md`) — ✅ COMPLETADA
- [x] **Actualización Integral de Documentación `/docs`:**
  - [docs/historias_usuario.md](file:///d:/SIS324%20INGENIERIA%20DE%20SOFTWARE/ChocoTi-Digital/docs/historias_usuario.md): Añadidas HU-08B (QR Simple con polling y 15 min), HU-08C (Depósito bancario máx 2MB), HU-08D (PayPal Sandbox USD tasa 6.96), HU-14 (Cálculo de disponible real `Físico - Reservas`), HU-15 (Picking FEFO por almacén), HU-16 (Empaque térmico y tarjetas), HU-17 (Despacho courier y acta con foto/CI), HU-18 (Retiro seguro con código corto) y HU-19 (Auto-finalización 7 días).
  - [docs/casos_uso.md](file:///d:/SIS324%20INGENIERIA%20DE%20SOFTWARE/ChocoTi-Digital/docs/casos_uso.md): Diagrama Mermaid actualizado con los 7 roles y especificaciones formales añadidas para CU-16 hasta CU-22.
  - [docs/matriz_permisos.md](file:///d:/SIS324%20INGENIERIA%20DE%20SOFTWARE/ChocoTi-Digital/docs/matriz_permisos.md): Mapeo de los 7 roles, nuevos endpoints y matriz estricta de transiciones de pedidos con regla de rechazo 403 Forbidden.
  - [docs/diagramas_arquitectura.md](file:///d:/SIS324%20INGENIERIA%20DE%20SOFTWARE/ChocoTi-Digital/docs/diagramas_arquitectura.md): Diagrama de Paquetes con nuevos módulos, Diagrama de Clases del Dominio con ciclo de vida del pedido, Componentes, DFD 0 y 1 descompuestos y ERD completo con las 22 tablas.
  - [docs/matriz_trazabilidad.md](file:///d:/SIS324%20INGENIERIA%20DE%20SOFTWARE/ChocoTi-Digital/docs/matriz_trazabilidad.md): Trazabilidad bidireccional completa para todos los nuevos requerimientos.
  - [docs/decisiones.md](file:///d:/SIS324%20INGENIERIA%20DE%20SOFTWARE/ChocoTi-Digital/docs/decisiones.md): Incorporados ADR-06 (Máquina de 14 estados y RBAC), ADR-07 (Adaptadores de cobro multicanal), ADR-08 (Especialización de roles internos y multitenancy por almacén), ADR-09 (Checklists FEFO y empaque térmico), ADR-10 (Código corto y auto-cierre), y SUP-08 a SUP-10.
- [x] **Base de Datos y Persistencia (`database/schema.sql`):**
  - Incorporación de 3 nuevos roles: `PREPARADOR_PEDIDOS` (5), `EMPACADOR` (6), `DESPACHADOR_ENTREGA` (7).
  - Creación de 5 nuevas tablas inmutables y relacionales: `pedido_historial_estados`, `pagos_intentos`, `pedido_preparacion`, `pedido_empaque`, `pedido_entregas`.
  - Ampliación de campos en tabla `pedidos`: `monto_usd`, `tipo_cambio_usd`, `codigo_retiro`, `fecha_limite_retiro`, `fecha_finalizado`, `dias_para_finalizar`.
  - Actualización de CHECK constraints para 14 estados canónicos de pedido, método `PAYPAL` y estado de pago `VENCIDO`.
  - Índices de rendimiento para todas las tablas nuevas.
  - Semillas de los 3 nuevos usuarios operativos con contraseñas seguras según política de complejidad.
- [x] **Seguridad y Control de Transiciones (`backend/src/middleware/authMiddleware.js`):**
  - Aislamiento estricto de sucursal (`soloAlmacenAsignado`) ampliado a los roles: `OPERADOR_ALMACEN`, `PREPARADOR_PEDIDOS`, `EMPACADOR`, `DESPACHADOR_ENTREGA`.
  - Middleware `validarTransicionEstado` con diccionario `TRANSICIONES_POR_ROL` que bloquea con `HTTP 403 Forbidden` cualquier cambio no facultado.
- [x] **Documentación Segura en `README.md`:**
  - Registro exclusivo de las 8 cuentas demo en la tabla del [README.md](file:///d:/SIS324%20INGENIERIA%20DE%20SOFTWARE/ChocoTi-Digital/README.md) cumpliendo la regla de no exhibirlas en ninguna pantalla ni código cliente.
  - Guía detallada para configurar credenciales y sandbox de PayPal.
- [x] **Pruebas Automatizadas 100% Exitosas:**
  - [tests/health.test.js](file:///d:/SIS324%20INGENIERIA%20DE%20SOFTWARE/ChocoTi-Digital/tests/health.test.js): Verificación de 22 tablas, 7 roles, 8 cuentas demo, 12 SKUs y 92 puntos de venta.
  - [tests/auth.test.js](file:///d:/SIS324%20INGENIERIA%20DE%20SOFTWARE/ChocoTi-Digital/tests/auth.test.js): Pruebas de inicio de sesión de los 7 roles, validación de la matriz de transiciones y rebote 403 Forbidden, aislamiento de almacén para personal operativo y verificación de cero credenciales en código visual.
  - [tests/catalog_inventory.test.js](file:///d:/SIS324%20INGENIERIA%20DE%20SOFTWARE/ChocoTi-Digital/tests/catalog_inventory.test.js): Pasando al 100% con limpieza automática de registros de prueba.

---

### Fase 4: Catálogo, Buscador, Lista de Deseos e Inventario — ✅ COMPLETADA
- [x] **Catálogo Dinámico e Insensible a Tildes/Mayúsculas:**
  - Endpoints `GET /api/productos` y `GET /api/productos/sugerencias` con función SQLite `quitar_tildes` en [backend/src/models/Producto.js](file:///d:/ChocoTi-Digital3/backend/src/models/Producto.js).
  - Semáforos visuales de disponibilidad calculados dinámicamente (`stock_disponible = stock_actual - stock_reservado`): *Disponible*, *Pocas unidades* (<= stock mínimo) y *Agotado*.
- [x] **Lista de Deseos Omnicanal:**
  - Modelo [backend/src/models/ListaDeseos.js](file:///d:/ChocoTi-Digital3/backend/src/models/ListaDeseos.js) con sincronización bidireccional cliente-servidor al autenticarse.
  - Interfaz de corazón en tarjetas de producto y modal dedicado en [index.html](file:///d:/ChocoTi-Digital3/index.html).
- [x] **Gestión y Auditoría de Inventario:**
  - Consolidado nacional y multitenancy por almacén en [backend/src/models/Inventario.js](file:///d:/ChocoTi-Digital3/backend/src/models/Inventario.js).
  - Bitácora inmutable en tabla `kardex_movimientos` y control de vencimientos FEFO en `lotes`.
- [x] **Pruebas Automatizadas:**
  - [tests/catalog_inventory.test.js](file:///d:/ChocoTi-Digital3/tests/catalog_inventory.test.js) pasando al 100%.

---

### Fase 5A: Checkout y Métodos de Pago — ✅ COMPLETADA
- [x] **Flujo de Acceso en Checkout ("¿Ya tienes una cuenta?"):**
  - Modal interactivo con 3 opciones: *Iniciar Sesión*, *Crear Cuenta* o *Continuar como Invitado*.
  - Autocompletado de datos del comprador al contar con sesión activa.
- [x] **Formulario Omnicanal y Validación en Vivo:**
  - Validación de campos obligatorios (nombre, CI/NIT, email, teléfono).
  - Selector de entrega:
    - *Envío a Domicilio:* cálculo dinámico de costo (Sucre: Bs. 0.00 / Resto de Bolivia: Bs. 25.00 según [config/empresa.js](file:///d:/ChocoTi-Digital3/config/empresa.js)).
    - *Recoger en Agencia:* selector dinámico cargado desde endpoint `GET /api/puntos-venta/agencias-propias`, restringido estrictamente a sucursales propias (tipo P: Sucre y La Paz) con dirección física escrita y costo de envío Bs. 0.00.
  - Resumen financiero en tiempo real (subtotal, envío, descuento con cupón `CHOCOTI10` y total).
- [x] **Reserva Temporal de Stock y Transaccionalidad:**
  - Modelo [backend/src/models/ReservaStock.js](file:///d:/ChocoTi-Digital3/backend/src/models/ReservaStock.js) con verificación atómica de existencias dentro de transacciones SQLite.
  - Incremento inmediato de `stock_reservado` e inserción en tabla `reservas_stock`.
  - Rechazo estricto (HTTP 409 Conflict) ante intentos de compra simultánea que superen el disponible real (`stock_actual - stock_reservado`).
  - Tarea periódica de limpieza que libera reservas expiradas y marca pedidos como `EXPIRADO` y pagos como `VENCIDO`.
- [x] **Pasarela 1: QR Simple (Bolivia):**
  - Generación de referencia bancaria única y código QR real en imagen Data URI mediante [backend/src/adapters/qrAdapter.js](file:///d:/ChocoTi-Digital3/backend/src/adapters/qrAdapter.js) (soporte SVG nativo sin dependencias y PNG con librería `qrcode`).
  - Temporizador visible de 15 minutos con cuenta regresiva en vivo.
  - Polling cada 3 segundos a `GET /api/pagos/estado/:referencia`.
  - Banco Simulado para entorno demo/académico ([backend/src/adapters/bancoSimuladoAdapter.js](file:///d:/ChocoTi-Digital3/backend/src/adapters/bancoSimuladoAdapter.js)) con botones para simular confirmación exitosa o rechazo.
  - Idempotencia estricta en webhooks para evitar duplicidad de cobros o descuentos de stock.
- [x] **Pasarela 2: Depósito / Transferencia Bancaria:**
  - Exposición de datos de cuenta oficial de Solur S.R.L. y referencia única requerida.
  - Subida de comprobante digital validado en servidor (imágenes JPG/PNG/WebP o PDF, límite estricto de 2 MB) en [backend/src/services/pagosService.js](file:///d:/ChocoTi-Digital3/backend/src/services/pagosService.js).
  - Validación de número de operación único no repetido.
  - Verificación manual por Administrador u Operador (`POST /api/pagos/verificar-deposito`) con regla de aislamiento por almacén (HTTP 403 Forbidden si operador de otra sucursal intenta verificar). Plazo de reserva: 24 horas.
- [x] **Pasarela 3: Efectivo en Tienda:**
  - Restringido exclusivamente a pedidos con recojo en agencias propias (tipo P).
  - Reserva de inventario activa por 48 horas.
  - Registro de cobro en caja por Operador o Administrador (`POST /api/pagos/cobro-efectivo-tienda`).
- [x] **Cierre y Comprobante de Compra:**
  - Al confirmarse el pago: estado transiciona a `PAGADO`, se confirma la reserva (deducción de `stock_actual` y Kardex `SALIDA_VENTA`), y se genera guía de courier (`GUIA-SUC-XXXXX`) o código corto de retiro (`RET-XXXX`).
  - Modal de confirmación con enlace directo a WhatsApp (`wa.me`) con mensaje preformateado y botón de impresión de nota de venta con estilos `@media print` que aclaran que no constituye factura fiscal del SIN.
- [x] **Suite Automatizada de Pruebas:**
  - [tests/checkout_payments.test.js](file:///d:/ChocoTi-Digital3/tests/checkout_payments.test.js) cubriendo los 7 escenarios críticos.

---

### Fase 6: Notificaciones de Compra, Planillas y Comprobantes — ✅ COMPLETADA
- [x] **Adaptador de Correo Electrónico con Doble Driver (`emailAdapter.js`):**
  - Driver Real vía API HTTPS REST (Resend/Brevo, puerto 443, compatible con Render Cloud gratuito). Requiere `EMAIL_API_KEY`.
  - Driver Simulado de Contingencia: sin `EMAIL_API_KEY`, persiste el HTML completo en tabla `bandeja_simulada` y audita en `notificaciones_logs`. Sin corte en transacciones de pedidos.
- [x] **Adaptador WhatsApp con Doble Estrategia (`whatsappAdapter.js`):**
  - Enlace directo `wa.me/591...` para compartir resumen de compra (texto preformateado con pedido, productos, total, método de pago y guía de transporte).
  - Enlace directo `wa.me` para contacto con atención al cliente de Chocolates Para Ti.
  - Conector simulado para WhatsApp Business Cloud API (Meta) con auditoría en `notificaciones_logs` (canal `WHATSAPP`, estado `SIMULADO`).
- [x] **Plantillas Transaccionales Centralizadas (`notificacionesTemplates.js`):**
  - Diccionario `ESTADOS_INFO` con los 14 estados canónicos de pedido.
  - Plantillas HTML para: Confirmación de Compra, Instrucciones de Pago, Cambio de Estado.
  - Plantillas de texto para WhatsApp: compra, contacto y cambio de estado.
- [x] **Servicio Orquestador (`notificacionesService.js`):**
  - Orquesta despachos multicanal (email + WhatsApp) protegidos con `try/catch` independientes para no bloquear transacciones principales.
- [x] **Módulo 7 — Planillas de Venta (`planillaController.js` + `planillaRoutes.js`):**
  - `GET /api/planilla` — Listado JSON con filtros (estado, fecha, almacén) y paginación; RBAC: Cliente→solo sus pedidos, Operador→solo su almacén, Admin→todo.
  - `GET /api/planilla?formato=csv` — Exportación CSV con cabeceras de pedido descargable directamente.
  - `GET /api/planilla/:id/comprobante` — Nota de venta HTML imprimible con estilos `@media print` y aviso explícito de no-factura SIN.
- [x] **Consulta y Auditoría de Notificaciones (`notificacionesController.js` + `notificacionesRoutes.js`):**
  - `GET /api/notificaciones/bandeja-simulada` y `/:id` — Solo Administrador.
  - `GET /api/notificaciones/logs` — Bitácora inmutable multicanal solo Administrador.
  - `GET /api/notificaciones/whatsapp/:identificador` — Genera enlaces wa.me (público, para vistas de éxito).
- [x] **Rutas montadas en `app.js`:** `/api/notificaciones` y `/api/planilla` registradas y activas.
- [x] **Suite Automatizada de Pruebas:**
  - [tests/notificaciones_planilla.test.js](file:///c:/Users/miran/Downloads/ChocoTi-Digital3/tests/notificaciones_planilla.test.js) — 7 escenarios: enlaces wa.me, bandeja simulada SQLite, auth 401, listado JSON, CSV con cabeceras y comprobante HTML imprimible.

---

### Fase 7A: Preparación y Picking por Almacén Asignado — ✅ COMPLETADA
- [x] **Permisos RBAC y Matriz de Transiciones (Pagado a Listo):**
  - Validación estricta que rechaza con `HTTP 403 Forbidden` cualquier transición fuera de las atribuciones de cada rol (`validarTransicionEstado`):
    - `PAGADO` -> `EN_PREPARACION` y `EN_PREPARACION` -> `PREPARADO` exclusivo para `PREPARADOR_PEDIDOS` y `ADMINISTRADOR`.
    - `PREPARADO` -> `EMPACADO` y `EMPACADO` -> `LISTO_DESPACHO` / `LISTO_RECOJO` exclusivo para `EMPACADOR` y `ADMINISTRADOR`.
    - Roles no autorizados (`OPERADOR_ALMACEN`, `CLIENTE_...`, etc.) rebotan con 403 Forbidden.
- [x] **Aislamiento Multitenant por Almacén:**
  - Los preparadores, empacadores y operarios ven únicamente los pedidos asignados a su sucursal (`almacen_id`) tanto en `/api/pedidos` como en `/api/planilla`.
  - Intentos de consulta o alteración de pedidos de otro almacén son denegados con `HTTP 403 Forbidden`.
- [x] **Checklist Digital de Picking y Sugerencias FEFO:**
  - Modelo [backend/src/models/PedidoPreparacion.js](file:///c:/Users/MIL/Downloads/ChocoTi-Digital3%20-%20copia%20(2)/backend/src/models/PedidoPreparacion.js) y persistencia en tabla `pedido_preparacion`.
  - Algoritmo que sugiere lotes priorizando fechas de vencimiento más próximas (`Lote.obtenerPorProductoAlmacen` ordenado por `fecha_vencimiento ASC`).
  - Registro estructurado de ítems recolectados, control de incidencias de stock físico (`incidencia_stock = 1`, `estado = 'INCIDENCIA'`).
  - Endpoints dedicados `/api/preparacion/:pedido_id` y `/api/pedidos/:id/preparacion`.
- [x] **Checklist de Empaque y Transición a Listo:**
  - Modelo [backend/src/models/PedidoEmpaque.js](file:///c:/Users/MIL/Downloads/ChocoTi-Digital3%20-%20copia%20(2)/backend/src/models/PedidoEmpaque.js) y endpoints `/api/empaque/:pedido_id`.
  - Soporte de empaque térmico con gel refrigerante, tarjetas dedicatorias personalizadas, pesos y bultos.
  - Resolución inteligente de estado 'LISTO' a `LISTO_DESPACHO` (envío a domicilio) o `LISTO_RECOJO` (retiro en agencia).
- [x] **Resiliencia ante Fallos de Notificaciones:**
  - Desacoplamiento total con bloques de contingencia `try/catch` y promesas capturadas en [backend/src/services/pedidosService.js](file:///c:/Users/MIL/Downloads/ChocoTi-Digital3%20-%20copia%20(2)/backend/src/services/pedidosService.js) que aseguran que caídas en servicios externos de email o WhatsApp nunca impidan ni reviertan un cambio de estado en base de datos.
- [x] **Suite Automatizada de Pruebas:**
  - [tests/fase7a.test.js](file:///c:/Users/MIL/Downloads/ChocoTi-Digital3%20-%20copia%20(2)/tests/fase7a.test.js) pasando al 100% cubriendo permisos 403 por rol, aislamiento por almacén, checklist FEFO, flujo Pagado -> Listo y resiliencia de notificaciones.

---

## ⏸️ Estado Actual y Siguiente Paso
**Fases 1, 2, 3, 3B, 4, 5A, 6 y 7A ejecutadas y verificadas al 100%.**

El desarrollo queda **estrictamente DETENIDO a la espera de la confirmación del usuario** antes de iniciar la **Fase 7B: Empaque Térmico (Rol EMPACADOR), Despacho, Retiro en Agencia, Actas de Entrega con Foto/CI (Rol DESPACHADOR_ENTREGA) y Seguimiento Real**.
