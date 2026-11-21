# Registro de Decisiones de Arquitectura y Supuestos (ADR)
## Sistema E-Commerce y Gestión Omnicanal "ChocoTi-Digital"
### Chocolates Para Ti · Solur S.R.L. (Sucre, Bolivia)

---

## 1. Contexto del Proyecto y Fuente de Verdad
- **Fuente de Verdad Funcional:** `/docs/vision.md`. Todos los requisitos funcionales (RF) y no funcionales (RNF), actores y alcance se derivan y rastrean a dicho documento.
- **Marco Metodológico:** Proceso Unificado RUP / AUP (centrado en la arquitectura, guiado por casos de uso, iterativo e incremental).
- **Entorno de Despliegue:** Render Cloud (Plan gratuito) con enlace público HTTPS.

---

## 2. Supuestos y Vacíos Funcionales Registrados
En concordancia con las instrucciones maestras ("ante vacíos o contradicciones, no inventes: regístralos en `/docs/decisiones.md` bajo Supuestos y sigue con la opción más simple"):

| ID | Área / Módulo | Vacío o Ambigüedad Detectada | Supuesto Asumido / Solución Más Simple |
|---|---|---|---|
| **SUP-01** | Datos Fiscales y Legales | NIT oficial y correo corporativo central no especificados en `vision.md` ni en el prompt. | Se registran como `null` / `"POR DEFINIR"` en `/config/empresa.js`. En comprobantes de venta se explicita: *"Comprobante sin valor fiscal SIN (Versión Académica)"*. |
| **SUP-02** | Cuentas Bancarias | Banco y número de cuenta para transferencias no provistos. | Se marcan como `"POR DEFINIR"` en `/config/empresa.js`. En la pasarela de transferencia se indica aviso para registrar comprobante mediante referencia de operación. |
| **SUP-03** | Costos de Envío | Tarifas por departamento no fijadas explícitamente. | Se establece costo estándar simple en `/config/empresa.js`: Sucre Local = 0 Bs (o 10 Bs delivery), Resto del País = 25 Bs base; configurable dinámicamente. |
| **SUP-04** | Persistencia en Render Gratuito | El disco en el plan Free de Render es efímero; al reiniciarse el servicio o tras inactividad, los archivos locales (SQLite y uploads) podrían resetearse. | Arquitectura basada en Patrón Repositorio desacoplado para migración inmediata a PostgreSQL gestionado (Render / Neon / Supabase). Se incluye script de arranque idempotente para regenerar esquema y semillas automáticamente. |
| **SUP-05** | Restricción de Mapas | Prohibición absoluta de Google Maps o mapas interactivos incrustados. | La sección y el checkout de Puntos de Venta gestionan únicamente direcciones textuales y filtros jerárquicos (Departamento/Ciudad -> Tipo P/A/C -> Nombre y Dirección). |
| **SUP-06** | Horarios de Atención | Horarios específicos por sucursal no provistos en `puntos_venta.md`. | Se muestran como *"Horario comercial habitual / Por definir"* sin inventar rangos no verificados. |
| **SUP-07** | Integraciones Externas | Plan gratuito de Render puede bloquear tráfico SMTP saliente (puertos 25/465/587); SIN y Pasarelas QR bancarias reales requieren convenios y certificados corporativos. | Se implementa el Patrón Adapter con doble driver: Driver Simulado (fallback con registro en base de datos `bandeja_simulada` y `notificaciones_logs`) y Driver HTTPS REST (Resend / Brevo para email). |
| **SUP-08** | Tasa de Cambio USD | Pagos internacionales requieren moneda USD no definida dinámicamente por API del BCB. | Se fija tasa oficial de 6.96 BOB/USD en variable de entorno `TIPO_CAMBIO_USD` con conversión en servidor. |
| **SUP-09** | Courier Interdepartamental | Flota de transporte para envíos a domicilio fuera de Sucre. | Se asigna por defecto el courier interno *"Transporte Expreso Chocolates Para Ti (Demo)"* con tracking público por número de guía. |
| **SUP-10** | Subida de Comprobantes | Límite y formato de archivos para comprobantes bancarios. | Máximo 2MB, tipos permitidos: JPG, PNG, PDF; sanitización estricta de nombres y registro en `pagos_intentos`. |

---

## 3. Decisiones Arquitectónicas Clave (ADR)

### ADR-01: Arquitectura en 3 Capas por Módulo
- **Decisión:** Separación estricta en Presentación (Frontend estático servido por Express), Control/Lógica (Controllers -> Services -> Repositories) y Datos (SQLite via better-sqlite3).
- **Justificación:** Alta cohesión, bajo acoplamiento, facilidad de testeo unitario y aislamiento de la lógica de negocio frente a la base de datos subyacente.

### ADR-02: Patrón Repositorio y Base de Datos SQLite
- **Decisión:** Uso de `better-sqlite3` con modo WAL y claves foráneas activadas (`PRAGMA foreign_keys = ON`), encapsulada siempre detrás de interfaces de Repositorio.
- **Justificación:** Rendimiento síncrono ultra-rápido en Node.js sin sobrecarga de servidor DB independiente para la demo, con portabilidad directa hacia PostgreSQL.

### ADR-03: Mismo Origen para Frontend y API
- **Decisión:** El mismo servidor Node.js/Express sirve los archivos estáticos de la interfaz web y la API REST en el puerto asignado por Render (`process.env.PORT`). El frontend utiliza rutas relativas (`/api/...`).
- **Justificación:** Elimina problemas de CORS en producción, reduce latencia y permite despliegue mono-servicio sin costos adicionales en Render.

### ADR-04: Seguridad por Diseño y Cero Credenciales en Pantalla
- **Decisión:** Autenticación JWT con expiración estricta, contraseñas hasheadas con bcryptjs (10 rondas), protección contra fuerza bruta con rate-limiting en `/api/auth/login` y bloqueo por intentos fallidos.
- **Regla Estricta:** Prohibido exponer usuarios, correos o contraseñas de prueba en pantallas, botones, modales, placeholders o comentarios HTML. Las credenciales de demo solo se documentan en el `README.md`.

### ADR-05: Sistema de Reserva Temporal de Stock en Checkout
- **Decisión:** El checkout genera un bloqueo temporal de existencias (reserva): 15 minutos para Pago QR, 24 horas para Transferencia Bancaria y 48 horas para Pago en Efectivo en Agencia.
- **Justificación:** Evita sobreventa de productos perecederos de alta demanda y libera inventario si la transacción no se concreta.

### ADR-06: Máquina de Estados de Pedidos (14 Estados) y Matriz de Transiciones RBAC
- **Decisión:** Los pedidos transicionan a través de 14 estados canónicos auditados inmutablemente en `pedido_historial_estados`. El middleware `validarTransicionEstado` rechaza con `HTTP 403 Forbidden` cualquier cambio fuera del mapa de permisos del rol autenticado.
- **Justificación:** Garantiza la integridad del flujo logístico, evitando que roles como el Preparador o Empacador salten pasos o ejecuten despachos indebidos.

### ADR-07: Adaptadores de Pago Multicanal y Manejo de Divisas
- **Decisión:** Implementación del patrón Adapter para QR Simple (con polling cada 3s y cuenta regresiva de 15 min), Depósito Bancario (con validación de comprobante máx 2MB por operador) y PayPal Sandbox (Orders v2 con monto en USD a tasa 6.96).
- **Justificación:** Desacopla la lógica de pedidos de los proveedores de pago y facilita añadir pasarelas reales en producción.

### ADR-08: Especialización de Roles Internos y Aislamiento por Almacén
- **Decisión:** Creación de tres roles operativos especializados: `PREPARADOR_PEDIDOS` (picking), `EMPACADOR` (embalaje) y `DESPACHADOR_ENTREGA` (courier y ventanilla), todos aislados estrictamente a su `almacen_id` mediante el middleware `soloAlmacenAsignado`.
- **Justificación:** Refleja la división real del trabajo en la fábrica de Chocolates Para Ti y previene que operadores de Sucre alteren despachos de La Paz o viceversa.

### ADR-09: Checklist de Picking FEFO y Control de Calidad Térmica
- **Decisión:** Registro estructurado en JSON de checklists para picking (`pedido_preparacion`) priorizando lotes próximos a vencer (FEFO) y para empaque (`pedido_empaque`) exigiendo embalaje térmico para destinos cálidos (Santa Cruz).
- **Justificación:** Preservación de la calidad del chocolate boliviano artesanal y trazabilidad de lotes ante posibles devoluciones o reclamos.

### ADR-10: Retiro Seguro con Código Corto y Auto-finalización en 7 Días
- **Decisión:** Para retiros en agencias propias (Tipo P), se genera un código corto único de retiro (`codigo_retiro`). Para pedidos entregados, se permite la confirmación de conformidad del cliente o se auto-finaliza a los 7 días mediante tarea programada.
- **Justificación:** Cierre formal del ciclo de vida contable y logístico del pedido sin dejar órdenes indefinidamente abiertas en el sistema.
