# DOCUMENTO DE VISIÓN DEL PROYECTO

**Sistema de Gestión E-Commerce y Omnicanal para 'Chocolates Para Ti' — Sucre, Bolivia**

| Campo | Detalle |
|---|---|
| Organización | Chocolates Para Ti (SUCRE - BOLIVIA) |
| Proyecto | Sistema de Comercio Electrónico y Control de Distribución Nacional |
| Fecha | Septiembre de 2026 |
| Elaborado por | Equipo de Ingeniería de Sistemas (USFX) |
| Integrantes | Medrano Valdez Marly, Miranda Coro Angela Micaela, Acsama Cari Eli Mabel |

---

## 1. Introducción

### Nombre del Proyecto

El proyecto se titula formalmente **Plataforma Integral de E-Commerce y Gestión Omnicanal 'Chocolates Para Ti' (ChocoTi-Digital)**.

### Propósito del documento

El propósito de este documento de Visión es definir los requisitos de alto nivel y el diseño arquitectónico del sistema para la empresa Chocolates Para Ti en Sucre, Bolivia. Este documento captura la esencia fundamental del proyecto, sus objetivos estratégicos, el alcance técnico y de negocio, las necesidades de las partes interesadas (stakeholders), así como los atributos de calidad esenciales que guiarán las fases de diseño, desarrollo y despliegue.

### Alcance

El alcance del sistema delimita con precisión las capacidades operativas e interfaces que serán implementadas.

**Lo que se incluye:**

- Desarrollo de un portal web E-Commerce responsivo para ventas minoristas e institucionales a nivel local, nacional e internacional.
- Módulo de catálogo digital interactivo categorizado por líneas de productos (chocolates artesanales, bombones, tabletas, regalos corporativos, ediciones especiales).
- Integración con pasarelas de pago bolivianas (cobro mediante Código QR / Simple, transferencias bancarias directas y tarjetas de crédito/débito Red Enlace/ATC).
- Módulo de gestión de inventarios multi-almacén sincronizado en tiempo real entre la planta central en Sucre y las agencias nacionales (La Paz, Cochabamba, Santa Cruz, etc.).
- Sistema de seguimiento en tiempo real del estado de despachos y envíos (tracking nacional).
- Módulo de gestión de clientes (CRM básico) para programas de fidelización, promociones personalizadas e historial de compras.

**Lo que NO se incluye:**

- Desarrollo e infraestructura de logística física propia o transporte externo para entrega a domicilio (delivery local/nacional) en áreas donde no exista cobertura.
- Sistemas automatizados de empaquetado industrial o automatización de hardware dentro de la planta de producción.
- Módulos contables complejos o ERP corporativo completo (el sistema se integrará con el software contable/ERP existente mediante APIs, pero no lo reemplazará totalmente).

### Definiciones y acrónimos

| Término / Acrónimo | Definición / Significado |
|---|---|
| E-Commerce | Comercio electrónico de bienes y servicios a través de redes informáticas e Internet. |
| QR / Pago Simple | Mecanismo estándar de pago interoperable por código QR utilizado en el sistema financiero boliviano. |
| Omnicanalidad | Estrategia de gestión que integra de manera fluida la atención en tiendas físicas y la plataforma digital. |
| ERP | Enterprise Resource Planning (Sistema de Planificación de Recursos Empresariales). |
| SKU | Stock Keeping Unit (Unidad de Mantenimiento de Inventario / Código único de producto). |

### Referencias

- Estudio de Mercado y Diagnóstico Digital para Chocolates Para Ti (Sucre, 2025/2026).
- Plan Estratégico Comercial y Crecimiento de Marca 'Chocolates Para Ti'.
- Estudio de Viabilidad Técnica y Financiera para la digitalización de canales de venta minorista.
- Normativa de Comercio Electrónico y Facturación En Línea del Servicio de Impuestos Nacionales (SIN) de Bolivia.

---

## 2. Posicionamiento del negocio

### Oportunidad de negocio

Chocolates Para Ti es una de las marcas más emblemáticas, tradicionales y queridas de la ciudad de Sucre y de Bolivia. Sin embargo, existe una demanda creciente por parte de clientes locales, nacionales e internacionales (turistas, bolivianos en el exterior y empresas) que desean adquirir productos de la marca de manera rápida, segura y directa a través de canales digitales. Actualmente, la dependencia en ventas exclusivamente presenciales en agencias limita el crecimiento del volumen de ventas y genera pérdida de oportunidades comerciales.

La implantación de una plataforma de comercio electrónico omnicanal permitirá capturar esta demanda no atendida, automatizar los procesos de venta corporativa y consolidar el liderazgo de la marca en el mercado de repostería fina.

### Declaración del problema

| Elemento | Descripción |
|---|---|
| El problema de | Inexistencia de un canal de venta digital unificado e integrado con el control de inventarios. |
| Afecta a | Clientes nacionales e internacionales, clientes corporativos y el equipo administrativo y comercial de Chocolates Para Ti. |
| El impacto de lo cual es | Pérdida de ventas potenciales, ineficiencia en el procesamiento de pedidos interdepartamentales, falta de visibilidad en tiempo real del inventario y tiempos de respuesta lentos ante compras de grandes volúmenes. |
| Una solución exitosa sería | Desplegar una plataforma web centralizada con integración a pagos digitales locales (QR Simple), gestión automatizada de pedidos y sincronización de stock con la fábrica en Sucre. |

### Declaración de la posición del producto

| Elemento | Descripción |
|---|---|
| Para | Consumidores amantes del chocolate tradicional, turistas y clientes corporativos de Bolivia y el exterior. |
| Que necesitan | Comprar productos frescos de Chocolates Para Ti directamente desde Sucre con comodidad, rapidez y métodos de pago locales/internacionales. |
| El producto (ChocoTi-Digital) | Es un sistema e-commerce omnicanal y plataforma de gestión comercial integrada. |
| Que a diferencia de | Los canales indirectos informales, revendedores o la atención limitada a tiendas físicas tradicionales. |
| Nuestro producto ofrece | Un catálogo completo actualizado en tiempo real, personalización de regalística, pagos instantáneos con QR y despacho directo garantizando la frescura y calidad original de fábrica. |

---

## 3. Descripción de las partes interesadas (Stakeholders) y usuarios

### Resumen de las partes interesadas

| Grupo de interés | Descripción | Papel en el proyecto |
|---|---|---|
| Gerencia General | Directivos de Chocolates Para Ti encargados de la visión estratégica y presupuestos. | Aprobación de requerimientos principales, seguimiento de KPIs de retorno de inversión. |
| Departamento Comercial y Marketing | Personal encargado de promociones, catálogo, ventas e imagen institucional. | Definición de productos, precios, campañas promocionales y atención al cliente. |
| Encargados de Almacén y Logística | Personal en Sucre y sucursales encargados del inventario y despacho. | Operación del módulo de inventario, preparación de pedidos y gestión de envíos. |
| Equipo de Desarrollo y TI | Desarrolladores, administradores de sistemas e ingenieros de software. | Diseño, codificación, pruebas, despliegue y mantenimiento del sistema. |

### Resumen de los usuarios

- **Cliente Web Minorista (Consumidor Final):** persona natural que accede a la web para realizar compras individuales o de regalos familiares.
- **Cliente Corporativo:** empresas e instituciones que efectúan pedidos al por mayor para regalos navideños, eventos corporativos o souvenirs.
- **Administrador del Sistema:** usuario administrativo interno encargado de actualizar el catálogo, gestionar ofertas, autorizar despachos y analizar reportes.
- **Operador de Despacho:** personal operativo de almacenes que recibe las alertas de nuevos pedidos y actualiza el estado del empaquetado.

### Entorno del usuario

El entorno de interacción varía según el tipo de usuario:

- **Clientes finales:** interactuarán principalmente a través de dispositivos móviles (smartphones) y computadoras personales en entornos domésticos u oficinas, mediante navegadores web modernos (Chrome, Safari, Firefox) con conexiones Wi-Fi o datos móviles 4G/5G.
- **Usuarios internos (Administradores y Operadores):** trabajarán en entornos de oficina y almacén en la planta industrial de Sucre y agencias, utilizando PCs de escritorio y tabletas de inventario con navegadores web y conexión de red local/VPN segura.

### Perfiles de las partes interesadas y de los usuarios

#### Perfil 1: Cliente Web Minorista (Ejemplo: Turista / Consumidor Nacional)

- **Objetivos:** realizar compras rápidas de chocolates emblemáticos sin complicaciones.
- **Motivaciones:** desea regalar chocolates de Sucre a familiares en otra ciudad o recordar su visita a Sucre.
- **Problemas/Desafíos:** aptitud tecnológica media; espera pagos inmediatos con código QR.

#### Perfil 2: Cliente Corporativo (Ejemplo: Encargado de Compras de Empresa)

- **Objetivos:** adquirir lotes personalizados de chocolates con empaques institucionales y facturación adecuada.
- **Motivaciones:** cumplir con agendas corporativas y regalos de fin de año con un producto de alta reputación.
- **Problemas/Desafíos:** necesita cotizaciones rápidas, atención personalizada y garantías de fecha de entrega.

#### Perfil 3: Encargado de Almacén en Sucre

- **Objetivos:** procesar los pedidos de la web en menos de 24 horas y mantener sincronizado el stock físico.
- **Motivaciones:** evitar errores de despacho o ruptura de stock de productos de alta demanda.
- **Problemas/Desafíos:** interfaces complejas de los sistemas antiguos; requiere un panel de control intuitivo y ágil.

---

## 4. Características del producto

### Funcionalidades de alto nivel

Las características principales del sistema se agrupan en los siguientes módulos funcionales:

- **Módulo 1: Catálogo Digital Dinámico.** Búsqueda avanzada, categorización (Bombones, Barras, Regalos), visualización 3D/fotografía de alta resolución y sugerencias de maridaje o regalo.
- **Módulo 2: Carrito y Check-out Intuitivo.** Carrito de compras persistente, cálculo automático de costos de envío según destino (Sucre vs. resto de Bolivia) y aplicación de cupones.
- **Módulo 3: Pasarela de Pagos Integrada.** Sincronización de pagos con banca móvil mediante API de pago QR Simple y validación automática de comprobante.
- **Módulo 4: Gestión de Inventario.** Panel de control para actualizar existencias en tiempo real, alertas de stock mínimo e integración multi-almacén.
- **Módulo 5: Control de Envíos y Logística.** Generación de números de seguimiento (tracking), asignación de empresas de courier y notificaciones por WhatsApp/Email al cliente.
- **Módulo 6: Portal Corporativo B2B.** Sección dedicada para cotizaciones de volumen, carga de logotipos para personalizado y facturación con NIT.

### Requisitos del sistema

#### Requisitos Funcionales (RF)

- **RF-01 (Registro y Usuarios):** el sistema debe permitir a los clientes registrarse, autenticarse y gestionar sus direcciones de entrega.
- **RF-02 (Procesamiento de Pagos):** el sistema debe procesar pagos mediante códigos QR dinámicos 'Pago Simple' y confirmar la transacción de manera automática en menos de 10 segundos.
- **RF-03 (Sincronización de Stock):** el sistema debe descontar automáticamente del inventario las unidades vendidas en el e-commerce al confirmarse la compra.
- **RF-04 (Facturación Electrónica):** el sistema debe emitir la factura digital en línea en cumplimiento con las normativas del Servicio de Impuestos Nacionales (SIN).
- **RF-05 (Gestión de Productos):** el sistema debe ofrecer una sección de administración que permita agregar, modificar y dar de baja SKUs de chocolates.

#### Requisitos No Funcionales (RNF)

- **RNF-01 (Rendimiento y Usabilidad):** la interfaz debe ser completamente responsiva (adaptable a smartphones, tablets y escritorio) y cargar la página principal en menos de 2.5 segundos.
- **RNF-02 (Seguridad):** toda la transmisión de datos sensibles (credenciales, datos de pago) debe realizarse cifrada mediante HTTPS con certificado SSL/TLS 1.3.
- **RNF-03 (Fiabilidad y Disponibilidad):** el sistema debe mantener una disponibilidad del 99.5% (High Availability) durante todo el año, operando sobre arquitectura en la nube.
- **RNF-04 (Escalabilidad):** la plataforma debe soportar hasta 500 usuarios concurrentes en periodos de alta demanda (Fiestas Patrias, Navidad, San Valentín) sin degradación de rendimiento.

### Restricciones

- **Restricciones de plazo:** el proyecto debe desarrollarse e implementarse en un plazo máximo de 6 meses lectivos/calendario.
- **Restricciones presupuestarias:** el costo total de desarrollo, licenciamiento en la nube e integración de pasarelas no debe exceder el presupuesto asignado para la transformación digital de la empresa.
- **Restricciones normativas:** debe ser compatible obligatoriamente con el sistema de facturación en línea exigido por el Servicio de Impuestos Nacionales (SIN) en Bolivia.
- **Restricciones tecnológicas:** la arquitectura debe integrarse mediante servicios Web (APIs RESTful) con la base de datos central existente de Chocolates Para Ti.
