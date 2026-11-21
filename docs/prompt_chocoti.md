# PROMPT MAESTRO — ChocoTi-Digital (versión consolidada)

Este archivo reemplaza al docs/prompt_chocoti.md anterior y a
docs/ajustes_ingeniero.md (ya están integrados aquí). Es la única fuente de
instrucciones; si encuentras el archivo de ajustes, ignóralo.

Actúa como Arquitecto de Software Senior y Desarrollador Full-Stack, con
enfoque RUP/AUP (iterativo, incremental, centrado en la arquitectura y
guiado por casos de uso). Construye y mejora "ChocoTi-Digital", sistema de
e-commerce y gestión omnicanal para "Chocolates Para Ti" (Sucre, Bolivia).
Es un proyecto académico de Ingeniería de Sistemas (USFX, SIS324), desplegado
en Render (plan gratuito) con enlace público.

## ESTADO Y FORMA DE TRABAJO

- Fases YA HECHAS: 1 (documentación), 2 (estructura y base), 3 (seguridad y
  acceso), 3B (ajustes del ingeniero) y 4 (catálogo, buscador, lista de deseos
  e inventario). La siguiente es la Fase 5A.
- VERIFICACIÓN PREVIA (obligatoria, antes de escribir código nuevo): lee
  /docs/progreso.md y revisa el código real. Comprueba que existan: los roles
  internos (Administrador, Operador de Almacén, Preparador de Pedidos,
  Empacador, Despachador), el historial de estados del pedido, las tablas de
  checklist de preparación/empaque y de entregas, la cantidad reservada por
  producto y almacén, y las semillas de los usuarios de prueba. Si falta algo
  de la Fase 3B o de la Fase 4, complétalo primero y dime qué faltaba. Muestra
  un resumen breve del estado real (qué está hecho, qué falta).
- Ejecuta UNA fase por mensaje y detente a esperar mi confirmación. Por ahora
  SOLO la Fase 5A.
- Para ahorrar cuota: no reescribas archivos completos por cambios pequeños, no
  repitas lo ya hecho, no vuelvas a generar documentación que ya existe (solo
  actualízala en lo afectado) y, si te interrumpes, retoma desde
  /docs/progreso.md. Al terminar cada fase: guarda archivos, actualiza
  /docs/progreso.md y los diagramas afectados, y detente.

## CONTEXTO

- Fuente de verdad funcional: /docs/vision.md. Cada módulo, requisito (RF/RNF)
  y decisión debe rastrearse a ese documento.
- Ante vacíos o contradicciones, no inventes: regístralos en
  /docs/decisiones.md bajo "Supuestos" y sigue con la opción más simple.
- Datos de la empresa en un único archivo de configuración editable
  (/config/empresa.js o tabla en base). Lo que no esté en este archivo ni en
  /docs/puntos_venta.md queda como "por definir"; nunca inventes direcciones,
  teléfonos, cuentas bancarias ni NIT.
- Observaciones del ingeniero que este proyecto debe cumplir: (1) control de la
  cantidad disponible, (2) cobro correcto con QR o depósito bancario, (3)
  cobro con PayPal usando sus APIs, (4) control de preparación y empaque con
  roles específicos, (5) control de la entrega y cierre del proceso.

## DECISIONES FIJAS (no cambiar)

- Backend: Node.js + Express. Frontend: HTML5, CSS3 y JavaScript sin framework.
- Base de datos: SQLite (chocoti.db) con better-sqlite3, siempre detrás de
  repositorios para poder migrar a PostgreSQL (el disco de Render gratuito es
  temporal; documentarlo).
- El mismo servidor Express sirve el frontend y la API (mismo origen). El
  frontend llama a la API con rutas relativas ("/api/..."), NUNCA con
  "localhost" fijo.
- Idioma: interfaz y documentación en español; identificadores en inglés.
- Integraciones externas con adaptadores (interfaz común + implementación real
  o simulada intercambiable): QR Simple (adaptador de banco + banco SIMULADO),
  PayPal (REAL en sandbox), facturación SIN (SIMULADO), courier (SIMULADO),
  correo (REAL por API HTTPS, con respaldo simulado), WhatsApp (enlace wa.me
  REAL; API Business SIMULADA).
- NO usar Google Maps ni mapas incrustados en ninguna parte.

## DATOS REALES DE LA EMPRESA (en /config/empresa.js y en las semillas)

- Nombre comercial: Chocolates Para Ti. Razón social: Solur S.R.L. Lema: "El
  mejor Chocolate de toda Bolivia". Fundada el 27 de mayo de 1990 en Sucre.
- Facebook: https://www.facebook.com/paratichocolates/
- Instagram: https://www.instagram.com/chocolates_parati/
- WhatsApp: +591 71163789 (enlace wa.me/59171163789 con mensaje predefinido).
- Categorías: Combos, Chocolates en Cajas Artesanales, Chocolates en Cajas,
  Grageas en Bolsa, Tabletas de Chocolate, Paletas, Chocolates en Bolsa.
- Catálogo de semilla (Bs; el precio no incluye envío): 3BOLBOM100 Bolsa
  bombón con crema 100 g 15.50 | 3BOLBOM200 Bolsa bombón con crema 200 g 30.00
  | 3BOLCHF100 Bolsa chocolate con fruta 100 g 22.00 | 3BOLCHR100 Bolsa
  chocolates rellenos 100 g 23.50 | 3BOLCHS100 Bolsa chocolates con sabores
  100 g 22.50 | 3BOLGAL050 Grageas de almendras 50 g 7.00 | 3BOLGAL100
  Grageas de almendras 100 g 14.00 | 3BOLGAR050 Grageas de arroz 50 g 7.00 |
  3BOLGAR100 Grageas de arroz 100 g 14.00 | 3BOLGMA050 Grageas de maní 50 g
  7.00 | 3BOLGMA100 Grageas de maní 100 g 14.00 | 3BOLGMC050 Grageas de
  macarrón 50 g 7.00. Es una muestra: el Administrador carga el resto desde el
  panel o por importación CSV.
- Puntos de venta: tabla puntos_venta cargada desde /docs/puntos_venta.md.
- Por definir: NIT, correo de contacto, horarios, datos de cuenta bancaria,
  costos de envío por destino.

## ARQUITECTURA

Modelo cliente-servidor con 3 capas, aplicado por módulo:
1. Presentación (Frontend): un paquete que concentra toda la interfaz.
2. Control/Lógica (Backend): un paquete por módulo, con controllers ->
   services -> repositories. El paquete de Control orquesta; ningún módulo
   accede a la base de otro, solo a su servicio.
3. Datos: schema.sql con claves foráneas, restricciones, índices y semillas.
Principios: concordancia entre arquitectura y funcionalidad, separación de
responsabilidades, bajo acoplamiento, alta cohesión, modularidad, seguridad
por diseño. Patrones: MVC, Repository, Facade/Adapter para integraciones,
Observer para notificaciones, máquina de estados para el pedido.

## ROLES Y ACCESO

- Visitante (sin cuenta): ver catálogo, buscar, lista de deseos, comprar como
  invitado, consultar seguimiento por guía.
- Cliente Minorista y Cliente Corporativo: se registran solos. El registro
  público SOLO crea estos dos roles; el servidor ignora cualquier rol enviado
  por el cliente. Corporativo exige razón social y NIT.
- Roles internos (solo los crea un Administrador o las semillas), cada uno
  ligado a un almacén y limitado a lo suyo:
  - Administrador: todo el sistema.
  - Operador de Almacén: inventario de su almacén (entradas, ajustes,
    traspasos, kardex), cobros en agencia y verificación de pagos.
  - Preparador de Pedidos: arma los pedidos pagados de su almacén (picking).
  - Empacador: empaca los pedidos ya preparados.
  - Despachador / Entrega: despacha y registra la entrega.
- Control de acceso por rol en el BACKEND (middleware) en cada ruta, no solo
  ocultando botones. Cada rol solo ejecuta SUS transiciones del pedido; el
  backend responde 403 a las demás. Matriz de permisos documentada en /docs.

## FLUJO DEL PEDIDO Y RESPONSABLES

Pendiente de pago -> Pagado -> En preparación -> Preparado -> Empacado ->
Listo para despacho / Listo para recoger -> Despachado -> Entregado ->
Finalizado. Excepciones: Cancelado, Expirado, Entrega fallida, Devuelto.
Subestados de pago: Pendiente de verificación (depósito) y Pendiente de pago
en tienda (efectivo).

- Pendiente de pago -> Pagado: sistema (pago confirmado) o Administrador /
  Operador (depósito o efectivo verificado).
- Pagado -> En preparación: Preparador (toma el pedido de su almacén).
- En preparación -> Preparado: Preparador, con el checklist de picking
  completo (cada producto y cantidad confirmados, lote por primero en vencer,
  primero en salir). Si falta stock físico, registra la incidencia y avisa al
  Administrador.
- Preparado -> Empacado: Empacador, con el checklist de empaque (empaque
  térmico si el destino o la temporada lo requieren, definido en /config;
  tarjeta o mensaje si lo pidió el cliente; etiqueta con pedido y destino;
  peso y número de cajas).
- Empacado -> Listo para despacho o Listo para recoger: Empacador.
- Listo para despacho -> Despachado: Despachador (courier simulado y guía).
- Despachado -> Entregado: Despachador, con nombre y CI de quien recibe,
  fecha y hora, observaciones y foto opcional (imagen validada).
- Entregado -> Finalizado: el cliente confirma la recepción o se finaliza
  solo tras N días (configurable).
- Cada transición se guarda en historial_estados (quién, cuándo, comentario)
  y notifica al cliente. Estados terminales: Finalizado, Cancelado, Expirado,
  Devuelto; el pedido terminal queda en solo lectura.

## MÓDULOS Y FUNCIONALIDADES

### 1) SEGURIDAD / INICIO DE SESIÓN
- Login y registro en pestañas, con validación en vivo, mostrar/ocultar
  contraseña, "recordar sesión", indicador de fortaleza (mínimo 8 caracteres,
  1 mayúscula, 1 minúscula, 1 número) y errores claros: credenciales
  incorrectas, cuenta bloqueada, servidor no disponible, sesión expirada.
- PROHIBIDO mostrar usuarios, correos o contraseñas de prueba en cualquier
  pantalla: ni listas, ni botones de "Cuentas de Prueba", ni autorrelleno, ni
  texto de ayuda, ni comentarios HTML, ni en las respuestas de la API. El
  mensaje de error de login es genérico ("Correo o contraseña incorrectos") y
  no revela si el correo existe.
- JWT con expiración + bcrypt. Bloqueo temporal tras 5 intentos fallidos y
  límite de peticiones en login. Cierre por inactividad. Cambio de contraseña.
  Recuperar contraseña con token de un solo uso y expiración, por correo.
  Redirección tras login según rol. Bitácora de accesos (logs_acceso).
- Semillas de cuentas de prueba (una por cada rol) creadas al arrancar si la
  tabla de usuarios está vacía y SEED_DEMO_USERS=true. Correos y contraseña
  SOLO documentados en el README (la contraseña sale de SEED_DEMO_PASSWORD; si
  no existe, usa la indicada en el README con la advertencia de cambiarla fuera
  de la demo).
- Pruebas automatizadas: login de todos los roles, permisos, y que ninguna
  pantalla ni respuesta exponga credenciales.

### 2) NOTIFICACIONES EN PANTALLA (TOASTS)
- Un único componente reutilizable: cierre automático a los 3.5 s
  (éxito/información) y 6 s (error/advertencia), botón de cerrar, pausa al
  pasar el mouse, máximo 3 visibles apiladas, sin duplicados, accesible
  (aria-live). Sin alert() en ninguna parte. Prohibido dejar notificaciones
  fijas.

### 3) PÁGINA PRINCIPAL
- Bienvenida: ventana o banner al entrar (una vez por visita, cerrable y
  recordado) con botones a Facebook, Instagram y WhatsApp (enlaces de
  /config, pestaña nueva con rel="noopener noreferrer"). Botón flotante de
  WhatsApp con mensaje predefinido. Iconos de redes también en el pie.
- Buscador siempre visible: por nombre, código, categoría y descripción,
  ignora mayúsculas y tildes, con sugerencias, "sin resultados" y combinable
  con filtros de categoría.
- Lista de deseos: corazón en cada producto y sección "Mi lista de deseos".
  Invitado: en el navegador; con sesión: en la base, fusionando la del
  navegador al iniciar sesión. Desde la lista se pasa al carrito.

### 4) INVENTARIO Y CANTIDAD DISPONIBLE
- Cantidad disponible = stock físico - cantidad reservada, por producto y por
  almacén (Sucre, La Paz, Cochabamba, Santa Cruz), con stock mínimo
  configurable y alertas visibles.
- Se muestra en el catálogo, en el detalle ("Solo quedan N unidades") y en el
  carrito. Si es 0: "Agotado" y no se puede agregar.
- La cantidad del carrito se limita al disponible y se revalida en el checkout
  y al confirmar el pago, dentro de una transacción de base de datos para no
  vender el mismo stock dos veces. Límite máximo por compra configurable.
- Movimientos (kardex): entrada, salida por venta, ajuste y traspaso entre
  almacenes, con fecha, usuario y motivo.
- Lotes y vencimientos: primero en vencer, primero en salir; alerta de
  próximos a vencer.
- RESERVA temporal de stock al iniciar el checkout, con expiración, contador
  visible y liberación automática; el tiempo depende del método de pago.
- Panel de inventario: Administrador (todos los almacenes), Operador (solo el
  suyo); tabla con buscador, filtros, indicadores de color y CRUD de SKU.

### 5) CHECKOUT Y MÉTODOS DE PAGO
- Al presionar "Pagar" pregunta "¿Ya tienes una cuenta?": Iniciar sesión,
  Crear cuenta o Continuar como invitado.
- Formulario de datos de compra (autocompleta con sesión): nombre, CI o NIT,
  razón social (opcional), teléfono, correo, tipo de entrega (recoger en
  agencia o envío a domicilio), dirección y referencia, ciudad, destino
  (Sucre vs. resto de Bolivia), cupón y notas. Validación en vivo.
- Resumen con subtotal, envío, descuento y total.
- Cuatro métodos de pago:

a) QR (completo):
  - Generar un código QR REAL (imagen, con una librería como "qrcode") por
    pedido, con referencia única, monto y vencimiento (15 min, configurable).
  - El QR Simple real requiere convenio bancario: implementa el adaptador del
    banco con interfaz definida y un "banco simulado" para la demo (endpoint y
    página de prueba que confirma, rechaza o deja vencer el pago). La
    confirmación entra por un endpoint de notificación de pago que valida
    referencia, monto y que no se haya procesado antes (idempotente).
  - Estados del pago: Pendiente, Pagado, Vencido, Rechazado. El pedido solo
    avanza con el pago confirmado; si vence, se libera la reserva. Marcar en
    pantalla que la confirmación es "demo".

b) Depósito / transferencia bancaria:
  - Mostrar datos de cuenta desde /config (por definir si no existen; nunca
    inventarlos) y una referencia única del pedido.
  - El cliente sube el comprobante (imagen o PDF, máximo 2 MB, validado en el
    servidor) e indica banco, monto, fecha y número de operación.
  - El Administrador u Operador verifica y confirma o rechaza con motivo.
    Valida monto exacto, número de operación no repetido y plazo vigente. Si
    se rechaza, el cliente puede subir otro comprobante dentro del plazo. Sin
    verificación a tiempo: Vencido y se libera el stock (reserva 24 h). Se
    registra quién verificó y cuándo.

c) Efectivo en la tienda:
  - SOLO con "Recoger en agencia" (agencias propias, tipo P). Estado
    "Pendiente de pago en tienda"; el Operador marca "Pagado" al cobrar y
    registra el monto recibido. Reserva: 48 h; si vence, Expirado y se libera
    el stock.

d) PayPal (API REST de PayPal, Orders v2, sandbox por defecto):
  - El servidor crea la orden, el cliente la aprueba con los botones de PayPal
    y el servidor la captura. El monto se calcula SIEMPRE en el servidor;
    nunca confiar en el monto que envía el navegador. Verificar estado y
    monto de la captura antes de marcar Pagado. Capturas idempotentes.
  - Moneda: los precios están en Bs. Confirma qué monedas acepta PayPal para
    la cuenta; si el boliviano no es admitido, cobra en USD con un tipo de
    cambio configurable en /config, mostrando al cliente el equivalente en USD
    antes de pagar y guardando ambos montos y el tipo de cambio usado.
  - Variables de entorno (sin valores reales en el repositorio): PAYPAL_ENV
    (sandbox o live), PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET. El secreto vive
    solo en el servidor; al frontend solo llega el Client ID.
  - Ajustar la CSP de helmet para permitir únicamente el script y los marcos de
    PayPal.
  - Manejar con toasts: pago cancelado, rechazado y error de red. Si el cliente
    cierra la ventana, el pedido queda pendiente hasta vencer la reserva.
  - Guardar id de orden y de captura, estado, montos y fecha. Webhooks:
    endpoint documentado y simulado si no se puede probar localmente.
  - README: cómo crear la cuenta de PayPal Developer, obtener credenciales
    sandbox y probar con cuentas de prueba.

- Al confirmarse el pago: crea el pedido, descuenta stock, genera la guía real
  (tabla de envíos) y dispara las notificaciones. En depósito y efectivo se
  notifica la instrucción de pago al crear el pedido y la confirmación al
  verificarse.

### 6) NOTIFICACIONES DE COMPRA (CORREO Y WHATSAPP)
- Correo de confirmación con el detalle, el método de pago e instrucciones si
  falta pagar, enviado desde un adaptador por API HTTPS (Resend, Brevo u otro
  con plan gratuito; el plan gratuito de Render puede bloquear SMTP:
  verifícalo y documéntalo). Clave y remitente en variables de entorno. Sin
  clave: adaptador simulado que guarda el correo en "bandeja_simulada",
  visible para el Administrador.
- WhatsApp: botón "Enviar por WhatsApp" que abre un enlace wa.me con el mensaje
  de compra redactado (pedido, productos, total, método de pago, guía), y otro
  para que el cliente escriba a la empresa. La API automática de WhatsApp
  Business queda como adaptador simulado documentado.
- Plantillas en un solo archivo editable; cada notificación enviada o fallida
  se registra en la base. Aviso al cliente en cada cambio de estado del pedido.

### 7) PLANILLAS DE COMPRA E IMPRESIÓN
- Registro de ventas (planilla): nº de pedido, fecha, cliente, productos,
  total, método de pago, estado de pago, estado del pedido, almacén y entrega;
  con buscador, filtros (fecha, estado, método de pago, cliente, almacén),
  orden, paginación y totales.
- Cliente: solo su historial. Operador: solo su almacén. Administrador: todo.
- Comprobante de compra (nota de venta) por pedido, imprimible, que diga
  claramente que NO es una factura fiscal válida del SIN. Comprobante final al
  finalizar el pedido.
- Botón "Imprimir" en el comprobante y en la planilla, con @media print
  (oculta menús y botones, tamaño carta, encabezado con logo y datos de la
  empresa, número de página y fecha de impresión). Exportar a CSV.

### 8) PUNTOS DE VENTA Y LUGAR DE ENTREGA (SOLO DIRECCIONES)
- Sección "Puntos de venta" con la tabla puntos_venta (ciudad, tipo, nombre,
  dirección, teléfono). Agrupada por ciudad, con buscador y filtro por ciudad
  y por tipo (agencia propia P / punto aliado A / cadena C). Las cadenas se
  muestran como "varias sucursales"; los teléfonos con "-" como "Sin
  teléfono". Editable por el Administrador.
- En el checkout, "Recoger en agencia" lista SOLO las agencias propias (tipo
  P: Sucre y La Paz) con su dirección escrita y asocia el pedido a ese punto.
  Los puntos aliados son solo informativos. "Envío a domicilio" pide
  dirección y referencia. Sin Google Maps ni mapas.

### 9) PREPARACIÓN Y EMPAQUE (roles específicos)
- Pantalla propia para el Preparador y para el Empacador, con su cola de
  trabajo, filtros y buscador; solo ven pedidos de su almacén.
- Checklist de picking y de empaque como se describe en el flujo del pedido;
  cada paso guarda responsable y hora. Incidencias de faltante de stock con
  aviso al Administrador.

### 10) ENVÍOS, ENTREGA Y CIERRE DEL PROCESO
- Envío a domicilio: courier simulado y guía real; el Despachador registra la
  entrega (quién recibe, CI, fecha y hora, observaciones, foto opcional). Si
  no se puede entregar: Entrega fallida con motivo y reintento; tras el máximo
  de intentos (configurable) pasa a Devuelto y avisa al Administrador.
- Recojo en agencia: al quedar Listo para recoger, el cliente recibe un código
  de retiro único; el personal lo valida, registra CI y hora y el pedido pasa
  a Entregado (en efectivo, registra también el cobro).
- Cierre: Entregado -> Finalizado (confirmación del cliente o automático tras N
  días). Al finalizar el kardex queda definitivo y el pedido en solo lectura.
- Seguimiento público por guía lee de la base: si no existe, "Guía no
  encontrada". Prohibido inventar resultados. Nunca insertar texto del usuario
  con innerHTML; usar textContent o escapar. Quitar del historial los textos
  que prometan funciones no implementadas ("validación fiscal SIN", "empaque
  térmico completado" genérico) o marcarlos "demo".
- Reporte para el Administrador: pedidos por estado, tiempos entre etapas y
  entregas fallidas.

### 11) PORTAL B2B
- El formulario guarda la cotización en la base, genera su código y la muestra
  en el panel del Administrador con estados (Nueva, En revisión, Cotizada,
  Cerrada) y respuesta. El Cliente Corporativo ve sus cotizaciones.

### 12) PANELES POR ROL
- Administrador: ventas (planilla), verificación de pagos, inventario,
  productos, usuarios y almacenes, puntos de venta, cotizaciones, bandeja de
  notificaciones y reportes (ventas por día y por método de pago, productos
  más vendidos, stock bajo, tiempos y estados de pedidos).
- Operador: inventario de su almacén, cobros en agencia y verificación de
  pagos. Preparador, Empacador y Despachador: su cola de trabajo.
- Cliente: mis pedidos (con estado e historial), comprobantes, lista de
  deseos, direcciones, perfil y seguridad.
- Fase 2 del producto (solo estructura vacía y documentada): CRM/
  fidelización, Facturación SIN real, Modelos BI, WhatsApp Business API.

## DESPLIEGUE EN RENDER (OBLIGATORIO)

- Arranque idempotente: crea esquema y semillas (catálogo y puntos de venta)
  si la base está vacía. Escucha en process.env.PORT y 0.0.0.0.
- Variables de entorno en .env.example (sin valores reales): PORT, NODE_ENV,
  JWT_SECRET, JWT_EXPIRES_IN, SEED_DEMO_USERS, SEED_DEMO_PASSWORD,
  EMAIL_API_KEY, EMAIL_FROM, APP_BASE_URL, PAYPAL_ENV, PAYPAL_CLIENT_ID,
  PAYPAL_CLIENT_SECRET. Error claro si falta JWT_SECRET. Los secretos nunca
  van en el código ni en el frontend.
- GET /api/health; el frontend muestra "Conectando con el servidor..." con
  reintento (el plan gratuito se duerme y tarda hasta un minuto).
- package.json con "engines", "start" y "test"; .gitignore (node_modules, .env,
  *.db, uploads). README con despliegue en Render, usuarios de prueba y
  limitaciones. Los comprobantes y fotos subidos también se pierden al
  reiniciar en el plan gratuito: documentarlo.

## TEXTOS HONESTOS

- Lo simulado (confirmación del QR, courier, factura SIN, WhatsApp automático)
  se marca como "demo" o se redacta sin prometer lo que no existe.

## CALIDAD

- Validación de entradas en frontend Y backend, códigos HTTP correctos,
  consultas parametrizadas, protección contra XSS e inyección SQL, CORS
  configurado, cabeceras de seguridad (helmet), subida de archivos validada,
  sin datos sensibles en logs.
- Pruebas automatizadas mínimas: autenticación, permisos por rol, stock y
  reserva (incluida concurrencia), pedido con los 4 métodos de pago,
  expiración de reservas, recorrido completo del pedido con los roles
  correspondientes, planilla y notificación simulada.
- Diseño responsivo móvil primero, accesible (etiquetas, contraste, foco),
  estados de carga, error y vacío en todas las pantallas, y la identidad
  visual chocolate existente.

## PLAN DE FASES

| Fase | Contenido | Estado |
|---|---|---|
| 1 | Documentación (H.U., C.U., diagramas, trazabilidad) | Hecha |
| 2 | Estructura, base de datos y semillas, servidor base | Hecha |
| 3 | Seguridad y acceso, roles, toasts | Hecha |
| 3B | Ajustes del ingeniero (roles, estados, tablas, docs) | Hecha (verificar) |
| 4 | Catálogo, buscador, lista de deseos, inventario y cantidad disponible | Hecha |
| 5A | Checkout, QR completo, depósito bancario y efectivo en tienda | SIGUE |
| 5B | Pago con PayPal | Pendiente |
| 6 | Correo y WhatsApp, planillas, comprobante imprimible, CSV | Pendiente |
| 7A | Preparación y empaque con roles | Pendiente |
| 7B | Despacho, entrega, cierre del proceso y seguimiento real | Pendiente |
| 8A | Puntos de venta, bienvenida con redes sociales, Portal B2B | Pendiente |
| 8B | Paneles por rol, reportes, README final y revisión general | Pendiente |

## EJECUCIÓN

Haz la verificación previa y luego SOLO la Fase 5A. Al terminar, actualiza
/docs/progreso.md (marca la 5A como hecha y deja claro lo pendiente), actualiza
los diagramas afectados y detente a esperar mi confirmación.

## CRITERIO DE TERMINADO (del proyecto completo)

- `npm install && npm start` corre sin errores; el login funciona para todos
  los roles, localmente y en Render, sin mostrar credenciales en pantalla.
- Un visitante puede buscar, guardar favoritos y comprar como invitado con
  cualquiera de los 4 métodos de pago; no se puede vender más que la cantidad
  disponible, ni con compras simultáneas.
- Un pedido recorre TODO el flujo, de pago a Finalizado, con los roles
  correspondientes y probado con pruebas automatizadas; ningún rol ejecuta
  transiciones que no le corresponden (403).
- El pago con PayPal funciona en sandbox de punta a punta y no confía en montos
  enviados por el navegador.
- Los módulos se comunican solo mediante servicios y rutas REST documentadas.
- Lo implementado coincide con los diagramas; si algo cambia, actualiza el
  diagrama.
- Al final, resume: qué quedó completo, qué es simulado y qué quedó pendiente.
