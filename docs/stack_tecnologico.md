# Pila de Desarrollo y Justificación Tecnológica
## Sistema E-Commerce y Gestión Omnicanal "ChocoTi-Digital"
### Proyecto de Ingeniería de Software · Universidad San Francisco Xavier (USFX)

---

## 1. Cuadro Resumen de la Pila Tecnológica

| Componente | Tecnología Seleccionada | Versión | Justificación Técnica y de Negocio |
|---|---|---|---|
| **Plataforma de Ejecución** | Node.js | v18.x / v20.x LTS | Motor V8 asíncrono y de alto rendimiento. Ecosistema unificado en JavaScript en backend y frontend. Compatible nativamente con Render. |
| **Framework Backend** | Express.js | 4.18+ / 4.19+ | Minimalista, altamente extensible mediante middleware, bajo consumo de memoria RAM (< 50 MB en reposo), ideal para el límite de 512 MB del plan gratuito de Render. |
| **Persistencia de Datos** | SQLite 3 (`better-sqlite3`) | 13.x | Rendimiento síncrono ultra-rápido (C++ bindings), cero latencia de red, modo WAL (concurrencia de lectura y escritura). Empaquetado embebido sin requerir aprovisionamiento de servidor independiente para la demo académica. |
| **Estrategia de Abstracción** | Patrón Repository (DAO) | Arquitectura Limpia | Todo acceso SQL está encapsulado tras clases de repositorio. Permite migrar a PostgreSQL gestionado (ej. Neon o Supabase) modificando únicamente la capa de persistencia sin alterar controllers ni services. |
| **Frontend / Presentación** | HTML5 Semántico + CSS3 Puro + Vanilla JavaScript | ES2022 | Cero sobrecarga de bundlers complejos (Webpack/Vite), tiempos de carga instantáneos (< 1 segundo), renderizado nativo sin hidratación pesada, responsivo móvil primero y alta fidelidad a la identidad gráfica institucional. |
| **Seguridad HTTP** | Helmet + Rate Limit | Helmet 7.x, Express-Rate-Limit 7.x | Fortalecimiento de cabeceras HTTP (X-Frame-Options, CSP, HSTS) y protección activa contra ataques de fuerza bruta y denegación de servicio (DoS). |
| **Criptografía y Sesiones** | bcryptjs + JSON Web Tokens (JWT) | bcryptjs 2.4, jsonwebtoken 9.x | Hashing unidireccional de contraseñas con salting (10 rondas de costo computacional) y autenticación stateless desacoplada para APIs REST. |
| **Validación y Sanitización** | express-validator | 7.x | Validación declarativa de esquemas JSON, saneamiento contra Inyección SQL y Cross-Site Scripting (XSS). |
| **Alojamiento y Despliegue** | Render Cloud (Web Service) | Free Tier | Infraestructura gestionada con provisión automática de certificados SSL/TLS 1.3, integración con Git, despliegue continuo y monitoreo de logs en vivo. |

---

## 2. Justificación Detallada de Decisiones Clave

### 2.1 ¿Por qué SQLite con `better-sqlite3` y Patrón Repositorio?
1. **Simplicidad y Autosuficiencia:** Al desplegarse en el plan gratuito de Render, el uso de bases de datos externas suele introducir latencias de red (RTT transoceánico) y complejidad en la configuración de cadenas de conexión. SQLite embebido resuelve esto manteniendo el archivo `.db` en el mismo contenedor.
2. **Modo WAL (Write-Ahead Logging):** Permite que múltiples clientes lean concurrentemente mientras se ejecuta una escritura en el kardex o compras, evitando los bloqueos tradicionales de SQLite.
3. **Aislamiento para Migración:** Dado que el almacenamiento del plan gratuito de Render es efímero (se restablece si la instancia se reinicia o duerme), la arquitectura utiliza el **Patrón Repositorio**. Ningún controlador ejecuta sentencias SQL directas. Cuando se requiera migrar a PostgreSQL, solo se reemplazan los métodos `query/run` por un pool de `pg`, conservando el 100% de la lógica de negocio.

### 2.2 ¿Por qué Vanilla JavaScript en el Frontend sin Frameworks?
1. **Reutilización y Estabilidad:** El proyecto cuenta con una base previa sólida en `index.html`, `styles.css` y `script.js` con paleta institucional (#2C1A1D y dorados) e interactividad probada. Rehacerlo en React/Angular añadiría deuda técnica, overhead de dependencias y riesgo de degradar el rendimiento móvil.
2. **Compatibilidad Universal:** Funciona sin transpilación en cualquier navegador moderno (smartphones de gama baja, tablets de almacén y PCs de oficina).
3. **Mantenibilidad:** La arquitectura cliente se organiza modularmente mediante servicios de comunicación (`api.js`) y componentes independientes (Toasts, Carrito, Tracking, Checkout).

### 2.3 Patrón Adaptador para Integraciones Externas
El sistema implementa interfaces unificadas para servicios que en un entorno real requerirían contratos bancarios o fiscales:
- **Pasarela de Pago QR:** `IQRAdapter` con implementación `SimulatedQRAdapter` (genera códigos QR estandarizados y emite confirmaciones automáticas de prueba).
- **Notificaciones por Correo:** `IEmailAdapter` con doble driver:
  - `HttpApiEmailAdapter` (Resend / Brevo) mediante llamadas REST HTTPS sin depender del puerto SMTP (bloqueado con frecuencia en cloud hosting).
  - `SimulatedEmailAdapter` (registra el correo en la tabla `bandeja_simulada` para auditoría administrativa).
- **WhatsApp:** `IWhatsAppAdapter` con generación de enlaces directos `wa.me/59171163789` y conector simulado para WhatsApp Cloud Business API.
- **Logística Courier:** `ICourierAdapter` con emisión de números de guía locales y seguimiento verídico respaldado en base de datos.
- **Facturación SIN:** `ISINAdapter` simulado con nota de venta académica que explicita no tener validez tributaria.

---

## 3. Consideraciones de Despliegue en Render (Plan Free)
1. **Sleep Mode (Suspensión por Inactividad):** Render duerme el servicio tras 15 minutos sin tráfico entrante. El primer arranque puede demorar entre 30 y 60 segundos. El frontend implementa un indicador *"Conectando con el servidor..."* que sondea `/api/health` para evitar que el usuario piense que el sistema está caído.
2. **Disco Efímero y Arranque Idempotente:** Al reiniciarse el contenedor, los datos no persistidos en volumen se reinician. ChocoTi-Digital incluye un inicializador idempotente (`initDb.js` / migrador automático) que, al arrancar, comprueba si la base de datos existe y contiene registros; si no, ejecuta el DDL y carga automáticamente las semillas de catálogo y puntos de venta.
