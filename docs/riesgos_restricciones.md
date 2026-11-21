# Matriz de Riesgos y Restricciones del Proyecto
## Sistema E-Commerce y Gestión Omnicanal "ChocoTi-Digital"
### Análisis de Riesgos y Restricciones Técnicas/Operativas

---

## 1. Identificación y Mitigación de Riesgos

| ID | Riesgo Identificado | Probabilidad | Impacto | Estrategia de Mitigación y Contingencia |
|---|---|:---:|:---:|---|
| **R-01** | **Pérdida de datos por disco efímero en Render (Plan Free)**<br>Al reiniciarse el contenedor o suspenderse por inactividad, los cambios locales en el archivo SQLite o comprobantes subidos se restablecen. | Alta | Alto | **1.** Arranque idempotente automatizado: crea tablas y siembra datos iniciales si la BD está vacía.<br>**2.** Patrón Repositorio desacoplado: facilita la migración a PostgreSQL gestionado (Neon/Supabase) en cualquier momento.<br>**3.** Documentación explícita de la limitación en el `README.md`. |
| **R-02** | **Latencia por Sleep Mode en Render (Cold Start)**<br>Tras 15 minutos sin peticiones, el contenedor se duerme y el primer acceso tarda entre 30 y 60 segundos. | Alta | Medio | **1.** Endpoint `/api/health` liviano.<br>**2.** El frontend detecta la demora y muestra un banner amigable: *"Conectando con el servidor ChocoTi (despertando servicio)..."* con reintentos progresivos para evitar el abandono del usuario. |
| **R-03** | **Bloqueo de puertos SMTP salientes en la nube**<br>Muchos proveedores de hosting gratuito bloquean los puertos SMTP 25, 465 y 587 para evitar spam. | Alta | Medio | **1.** Envío de correos exclusivamente mediante API HTTPS REST (Resend / Brevo) sobre el puerto 443.<br>**2.** Driver de contingencia (`SimulatedEmailAdapter`) que registra los correos en la tabla `bandeja_simulada` si no hay API key configurada. |
| **R-04** | **Bloqueos de lectura/escritura en base de datos SQLite**<br>Múltiples accesos simultáneos podrían generar excepciones `SQLITE_BUSY`. | Media | Medio | **1.** Activación obligatoria de `PRAGMA journal_mode = WAL` (Write-Ahead Logging).<br>**2.** Conexión Singleton con `better-sqlite3` que optimiza el pool de conexiones y caché en memoria (32 MB). |
| **R-05** | **Sobreventa por retención no liberada (Reserva de stock)**<br>Usuarios que inicien checkout sin pagar podrían bloquear existencias indefinidamente. | Media | Alto | **1.** Mecanismo de reservas con tiempo de expiración estricto (15m para QR, 24h para transferencia, 48h para tienda).<br>**2.** Proceso de liberación automática al validar el stock o transcurrir la ventana temporal. |
| **R-06** | **Fuga accidental de credenciales o cuentas demo en pantalla**<br>Vulneración de la directriz de seguridad estricta del proyecto. | Baja | Crítico | **1.** Eliminación completa de botones de auto-rellenado y modales con listas de contraseñas.<br>**2.** Respuestas de autenticación genéricas ("Correo o contraseña incorrectos").<br>**3.** Suite de pruebas automatizadas que inspecciona el código HTML y respuestas de la API verificando la no inclusión de credenciales. |

---

## 2. Restricciones Técnicas y de Negocio

| Categoría | Restricción Obligatoria | Justificación / Impacto |
|---|---|---|
| **Visual / Mapas** | **Prohibición absoluta de Google Maps o mapas incrustados** | Se deben gestionar las 47 sucursales y agencias exclusivamente mediante texto estructurado (ciudad, tipo, dirección, teléfono) para garantizar ligereza y cumplimiento de especificación. |
| **Datos de Empresa** | **No inventar datos no provistos** | NIT, teléfonos no listados, números de cuenta bancaria y costos de flete no especificados deben registrarse como `"POR DEFINIR"` en `/config/empresa.js`. |
| **Arquitectura Web** | **Mismo origen para Frontend y Backend** | El servidor Express debe servir la landing y dashboards estáticos junto con la API REST (`/api/...`), utilizando siempre rutas relativas y nunca `http://localhost:3001` fijo. |
| **Stack de Cliente** | **Frontend Vanilla sin frameworks** | Utilizar exclusivamente HTML5 semántico, CSS3 institucional (#2C1A1D y dorado) y JavaScript estándar. |
| **Roles y Acceso** | **Restricción de registro público** | El formulario de registro público solo puede dar de alta clientes con rol `CLIENTE_MINORISTA` o `CLIENTE_CORPORATIVO`. El servidor ignora cualquier intento de asignar roles privilegiados desde el cliente. |
| **Legal / Tributario** | **Textos honestos y comprobantes no fiscales** | Los comprobantes de venta emitidos deben incluir la leyenda explícita indicando que NO son facturas fiscales válidas del SIN, y las pasarelas simuladas deben rotularse como demo académica. |
