# Matriz de Control de Acceso Basado en Roles (RBAC)
## Sistema E-Commerce y Gestión Omnicanal "ChocoTi-Digital"
### Seguridad por Diseño y Protección en Middleware Backend (Fase 3 y 3B)

---

## 1. Definición de Roles del Sistema (7 Roles Oficiales)

| Rol | Alcance | Descripción y Asignación |
|---|---|---|
| **VISITANTE** (Invitado) | Público / No autenticado | Acceso abierto para explorar catálogo, buscar productos, gestionar favoritos en el navegador, comprar como invitado y consultar guías de tracking. |
| **CLIENTE_MINORISTA** | Consumidor Final | Registro público autónomo. Acceso a historial de pedidos propios, comprobantes, favoritos sincronizados en base de datos, confirmación de cierre y gestión de perfil. |
| **CLIENTE_CORPORATIVO** | Empresa / B2B | Registro público autónomo requiriendo obligatoriamente Razón Social y NIT. Acceso a cotizaciones mayoristas, pedidos por volumen, confirmación de conformidad e histórico comercial. |
| **OPERADOR_ALMACEN** | Operativo Interno | Creado exclusivamente por el Administrador. **Ligado a un almacén específico** (Sucre, La Paz, Cochabamba, Santa Cruz). Valida comprobantes de depósito bancario y cobros en efectivo en tienda de su almacén asignado. |
| **PREPARADOR_PEDIDOS** | Operativo Interno | Asignado a un almacén específico. Realiza el picking en estanterías de su almacén, valida lotes según política FEFO y completa el checklist de preparación (`PAGADO` -> `EN_PREPARACION` -> `PREPARADO`). |
| **EMPACADOR** | Operativo Interno | Asignado a un almacén específico. Verifica integridad del chocolate, aplica empaque térmico con gel en destinos cálidos, rotula tarjetas dedicatorias y cajas (`PREPARADO` -> `EMPACADO` -> `LISTO_DESPACHO` o `LISTO_RECOJO`). |
| **DESPACHADOR_ENTREGA** | Operativo Interno | Asignado a sucursal/almacén. Gestiona couriers, emite guías de transporte, valida retiros en agencia con código corto y genera actas digitales de entrega con foto (`LISTO_DESPACHO` -> `DESPACHADO` -> `ENTREGADO`). |
| **ADMINISTRADOR** | Gerencial / TI | Rol supremo con acceso irrestricto a todos los almacenes, usuarios, configuración, reportes, auditoría, catálogos y cualquier transición de pedidos. |

---

## 2. Matriz de Permisos por Módulo y Funcionalidad

Leyenda:
- **C:** Crear / Registrar
- **R:** Leer / Consultar
- **U:** Actualizar / Modificar
- **D:** Eliminar / Dar de Baja Lógica
- **P:** Operación Parcial / Restringida a su propio registro o sucursal
- **-:** Sin Acceso / Denegado por Middleware

| Módulo / Funcionalidad | Visitante | Minorista | Corporativo | Operador Almacén | Preparador | Empacador | Despachador | Administrador |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **Ver Catálogo y Buscar** | R | R | R | R | R | R | R | R |
| **Lista de Deseos (Favoritos)** | R (Local) | CRUD (Propio) | CRUD (Propio) | - | - | - | - | R |
| **Registro de Nueva Cuenta** | C (Min/Corp) | - | - | - | - | - | - | C (Todos) |
| **Login y Autenticación** | C | C | C | C | C | C | C | C |
| **Gestión de Usuarios y Roles** | - | - | - | - | - | - | - | CRUD |
| **Consultar Logs de Auditoría** | - | - | - | - | - | - | - | R |
| **Comprar / Checkout (Pedidos)** | C (Invitado) | C (Propio) | C (Propio) | - | - | - | - | C |
| **Ver Historial de Pedidos** | - | R (Propio) | R (Propio) | R (Su Almacén)| R (Su Almacén)| R (Su Almacén)| R (Su Almacén)| R (Global) |
| **Imprimir Comprobante de Venta** | R (Al comprar) | R (Propio) | R (Propio) | R (Su Almacén)| R (Su Almacén)| R (Su Almacén)| R (Su Almacén)| R (Global) |
| **Verificar Depósito Bancario / QR**| - | - | - | U (Su Almacén)| - | - | - | U (Global) |
| **Inventario: Consultar Existencias** | R (Solo estado)| R (Solo estado)| R (Solo estado)| R (Su Almacén)| R (Su Almacén)| R (Su Almacén)| R (Su Almacén)| R (Todos) |
| **Inventario: Ajustes y Kardex** | - | - | - | C (Su Almacén)| - | - | - | CRUD (Global)|
| **Picking y Checklist FEFO** | - | - | - | - | U (Su Almacén)| - | - | U (Global) |
| **Control de Empaque Térmico** | - | - | - | - | - | U (Su Almacén)| - | U (Global) |
| **Despacho y Asignación Courier** | - | - | - | - | - | - | U (Su Almacén)| U (Global) |
| **Validar Retiro Agencia (Código)** | - | - | - | - | - | - | U (Su Almacén)| U (Global) |
| **Registrar Acta Entrega (Foto/CI)**| - | - | - | - | - | - | U (Su Almacén)| U (Global) |
| **Confirmar Cierre de Pedido** | - | U (Propio) | U (Propio) | - | - | - | - | U (Global) |
| **Puntos de Venta: Consulta** | R | R | R | R | R | R | R | R |
| **Portal B2B: Cotizaciones** | C | - | CRUD (Propio) | - | - | - | - | CRUD |
| **Seguimiento por Guía (Tracking)**| R | R | R | R | R | R | R | R |

---

## 3. Matriz Estricta de Transiciones de Estados de Pedidos por Rol

> 🔒 **Regla de Rechazo 403 Forbidden:** Cualquier intento de un rol de cambiar un pedido a un estado no contemplado en esta matriz es rechazado de inmediato por el middleware `validarTransicionEstado` con código `HTTP 403 Forbidden`.

| Rol | Estados a los que TIENE PERMISO de Transicionar | Motivo Operativo / Regla de Negocio |
|---|---|---|
| **ADMINISTRADOR** | `*` (Todos los 14 estados) | Control administrativo y corrección de incidencias. |
| **OPERADOR_ALMACEN** | `PAGADO`, `CANCELADO` | Verifica transferencias bancarias, aprueba cobros en efectivo en tienda o rechaza comprobantes inválidos. |
| **PREPARADOR_PEDIDOS**| `EN_PREPARACION`, `PREPARADO` | Inicia el picking de lotes FEFO y confirma la preparación física completa. *(No puede pasar a EMPACADO -> 403).* |
| **EMPACADOR** | `EMPACADO`, `LISTO_DESPACHO`, `LISTO_RECOJO` | Verifica embalaje térmico, rotulado y acondicionamiento. *(No puede pasar a DESPACHADO -> 403).* |
| **DESPACHADOR_ENTREGA**| `DESPACHADO`, `ENTREGADO`, `ENTREGA_FALLIDA`, `DEVUELTO` | Asigna courier, valida código corto de retiro en agencia o registra entrega final con acta digital. *(No puede alterar preparación -> 403).* |
| **CLIENTE_MINORISTA** | `FINALIZADO`, `CANCELADO` | Confirma recepción y conformidad o cancela pedido antes de entrar a preparación. *(No puede marcarse como PAGADO -> 403).* |
| **CLIENTE_CORPORATIVO**| `FINALIZADO`, `CANCELADO` | Confirma conformidad institucional o cancela antes de preparación. |

---

## 4. Mapeo de Endpoints de la API y Middlewares de Protección

| Endpoint / Recurso | Método HTTP | Middleware Requerido | Roles Autorizados | Restricción Adicional |
|---|:---:|---|---|---|
| `/api/auth/login` | `POST` | `limiterAuth` | Todos (Público) | Rate limit 30 peticiones / 15 min |
| `/api/auth/register` | `POST` | `limiterAuth` | Público | Solo permite crear `CLIENTE_MINORISTA` o `CLIENTE_CORPORATIVO` |
| `/api/auth/me` | `GET` | `verificarJWT` | Todos autenticados | Retorna perfil del token activo |
| `/api/usuarios` | `GET, POST`| `verificarJWT`, `soloAdmin` | `ADMINISTRADOR` | Acceso irrestricto |
| `/api/usuarios/:id` | `GET, PUT, DELETE` | `verificarJWT`, `soloAdmin` | `ADMINISTRADOR` | Borrado lógico (`INACTIVO`) |
| `/api/pedidos` | `POST` | Opcional `verificarJWT` | Visitante, Clientes | Genera reserva de stock |
| `/api/pedidos/:id/transicion` | `PUT` | `verificarJWT`, `validarTransicionEstado` | Según rol | Valida matriz de transiciones; rebota con 403 |
| `/api/pedidos/:id/verificar-pago` | `PUT` | `verificarJWT`, `rolAutorizado(['ADMINISTRADOR','OPERADOR_ALMACEN'])`, `soloAlmacenAsignado` | Admin, Operador | Aprueba comprobante o cobro en tienda |
| `/api/preparacion/:pedido_id` | `GET, POST, PUT` | `verificarJWT`, `rolAutorizado(['ADMINISTRADOR','PREPARADOR_PEDIDOS'])`, `soloAlmacenAsignado` | Admin, Preparador | Checklist de picking y lotes FEFO |
| `/api/empaque/:pedido_id` | `GET, POST, PUT` | `verificarJWT`, `rolAutorizado(['ADMINISTRADOR','EMPACADOR'])`, `soloAlmacenAsignado` | Admin, Empacador | Empaque térmico, tarjetas y cajas |
| `/api/entregas/:pedido_id` | `GET, POST, PUT` | `verificarJWT`, `rolAutorizado(['ADMINISTRADOR','DESPACHADOR_ENTREGA'])`, `soloAlmacenAsignado` | Admin, Despachador | Asignación courier, código retiro y acta |
| `/api/pagos/paypal/capture` | `POST` | `verificarJWT` | Clientes, Admin | Captura orden v2 PayPal Sandbox en USD |
| `/api/inventario` | `GET` | `verificarJWT`, `rolAutorizado(['ADMINISTRADOR','OPERADOR_ALMACEN','PREPARADOR_PEDIDOS'])`, `soloAlmacenAsignado` | Admin, Operador, Preparador | Forzado a `almacen_id` del token |
| `/api/envios/tracking/:guia` | `GET` | Público | Todos | Sanitización estricta sin XSS |

---

## 4. Principios de Seguridad Implementados
1. **Validación en Backend:** La seguridad nunca depende del cliente. Ocultar un botón o enlace en la interfaz es solo comodidad de UX; el middleware rechaza con `401 Unauthorized` o `403 Forbidden` cualquier petición ilegítima.
2. **Aislamiento Multitenant por Almacén:** El Operador de Almacén no puede enviar `almacen_id` en el query o body para alterar existencias de otra sucursal: el valor se extrae directamente del payload verificado del JWT.
3. **Impenetrabilidad de Credenciales:** Prohibido retornar `password_hash`, tokens antiguos o datos sensibles en las respuestas JSON.
