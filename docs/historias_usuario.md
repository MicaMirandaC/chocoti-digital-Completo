# Historias de Usuario (HU) con Criterios de Aceptación
## Sistema E-Commerce y Gestión Omnicanal "ChocoTi-Digital"
### Metodología: RUP / AUP · Guía por Casos de Uso y Criterios Gherkin

---

## Módulo 1: Seguridad y Control de Acceso

### HU-01: Inicio de Sesión Seguro (Sin Exposición de Credenciales)
- **Como** usuario registrado (Administrador, Operador, Cliente Minorista o Corporativo),
- **Quiero** autenticarme en el sistema ingresando mi correo y contraseña,
- **Para** acceder a las funcionalidades y paneles correspondientes a mi rol asignado.

**Criterios de Aceptación (Gherkin):**
```gherkin
Escenario: Inicio de sesión exitoso con credenciales válidas
  Dado que me encuentro en el formulario de inicio de sesión
  Cuando ingreso un correo registrado y su contraseña correspondiente
  Y presiono el botón "Ingresar"
  Entonces el sistema genera un token JWT seguro con expiración
  Y me redirige al panel o vista correspondiente a mi rol (Admin, Almacén o Dashboard de Cliente)
  Y registra el acceso en la bitácora "logs_acceso" con estado "EXITOSO".

Escenario: Intento de inicio de sesión con credenciales inválidas (Sin fuga de información)
  Dado que me encuentro en el formulario de inicio de sesión
  Cuando ingreso un correo inexistente o una contraseña errónea
  Entonces el sistema responde con el mensaje genérico: "Correo o contraseña incorrectos"
  Y no revela si el correo electrónico existe en la base de datos
  Y registra el intento fallido en "logs_acceso" con estado "FALLIDO".

Escenario: Bloqueo de cuenta por intentos fallidos consecutivos
  Dado un usuario que acumula 5 intentos fallidos consecutivos de autenticación
  Cuando intenta iniciar sesión por sexta vez
  Entonces el sistema deniega el acceso con el mensaje: "Cuenta temporalmente bloqueada por seguridad"
  Y no permite nuevos intentos durante el periodo de enfriamiento (15 minutos).

Escenario: Cumplimiento de no exposición de credenciales
  Dado cualquier usuario que visita la aplicación
  Cuando inspecciona la pantalla de login, modales, código fuente HTML, placeholders o red
  Entonces no visualiza ninguna lista de cuentas de prueba, botones de auto-rellenado ni credenciales embebidas.
```

### HU-02: Registro Público de Clientes (Minorista y Corporativo)
- **Como** visitante del sitio web,
- **Quiero** crear una cuenta personal (Minorista) o empresarial (Corporativo),
- **Para** realizar compras con seguimiento, guardar mi lista de deseos e historiales.

**Criterios de Aceptación (Gherkin):**
```gherkin
Escenario: Registro de Cliente Minorista
  Dado que selecciono la pestaña "Crear cuenta minorista"
  Cuando ingreso nombre completo, correo único y contraseña de al menos 8 caracteres (con mayúscula, minúscula y número)
  Entonces el sistema crea la cuenta con rol CLIENTE_MINORISTA
  Y hashea la contraseña usando algoritmo bcrypt con salting.

Escenario: Registro de Cliente Corporativo con validación estricta
  Dado que selecciono la pestaña "Crear cuenta corporativa"
  Cuando ingreso nombre de contacto, correo, contraseña, Razón Social y NIT
  Entonces el sistema valida la obligatoriedad de la Razón Social y NIT
  Y asigna el rol CLIENTE_CORPORATIVO ignorando cualquier intento de manipulación del campo rol desde el cliente.
```

---

## Módulo 2: Notificaciones en Pantalla (Toasts)

### HU-03: Notificaciones Toast Accesibles y Reutilizables
- **Como** usuario que interactúa con la plataforma,
- **Quiero** recibir avisos no intrusivos al realizar acciones en el sistema,
- **Para** conocer el resultado inmediato de mis operaciones sin recurrir a cuadros de diálogo bloqueantes (alert).

**Criterios de Aceptación (Gherkin):**
```gherkin
Escenario: Presentación y autocierre de notificación de éxito
  Dado que el usuario completa una acción exitosa (ej. agregar al carrito)
  Cuando se dispara una notificación de tipo "Éxito" o "Información"
  Entonces el mensaje aparece en pantalla apilado en la esquina superior/inferior
  Y se cierra automáticamente tras transcurrir 3.5 segundos.

Escenario: Presentación de alerta o error con mayor permanencia
  Dado que ocurre un error de validación o del servidor
  Cuando se genera una notificación de tipo "Error" o "Advertencia"
  Entonces el toast permanece visible durante 6 segundos o hasta que el usuario pulse el botón de cierre "✕".

Escenario: Pausa de temporizador al interactuar con el mouse
  Dado un toast visible en pantalla
  Cuando el usuario sitúa el puntero del mouse sobre la notificación
  Entonces el temporizador de cierre automático se pausa
  Y se reanuda al retirar el cursor.
```

---

## Módulo 3: Catálogo Digital, Búsqueda y Lista de Deseos

### HU-04: Búsqueda y Filtrado Omnicanal de Chocolates
- **Como** visitante o cliente,
- **Quiero** explorar el catálogo oficial con buscador en tiempo real y filtros por categoría,
- **Para** encontrar rápidamente productos por nombre, SKU, descripción o variedad.

**Criterios de Aceptación (Gherkin):**
```gherkin
Escenario: Búsqueda insensible a mayúsculas y acentos
  Dado que el catálogo contiene productos como "Bolsa bombón con crema 100 g"
  Cuando el usuario busca "bombon" o "BOMBÓN"
  Entonces el sistema retorna todos los productos coincidentes ignorando tildes y mayúsculas.

Escenario: Indicador visual de disponibilidad de stock
  Dado que un producto tiene existencia disponible, inventario crítico o está sin stock
  Cuando se renderiza su tarjeta en el catálogo
  Entonces muestra claramente la etiqueta: "Disponible", "Pocas unidades" o "Agotado"
  Y deshabilita el botón "Agregar al carrito" si el estado es "Agotado".
```

### HU-05: Lista de Deseos (Favoritos) con Persistencia
- **Como** usuario visitante o autenticado,
- **Quiero** marcar productos con el botón de corazón y ver mi lista de deseos,
- **Para** guardar chocolates que deseo comprar en el futuro y transferirlos al carrito.

**Criterios de Aceptación (Gherkin):**
```gherkin
Escenario: Visitante guarda producto en favoritos
  Dado un usuario no autenticado (invitado)
  Cuando pulsa el icono de corazón en un producto
  Entonces el producto se guarda localmente en el almacenamiento del navegador (localStorage).

Escenario: Fusión automática de favoritos al iniciar sesión
  Dado un visitante con 2 productos en su lista de deseos local
  Cuando inicia sesión exitosamente en su cuenta
  Entonces el sistema sincroniza y fusiona la lista local con su lista persistida en base de datos.
```

---

## Módulo 4: Gestión de Inventario Multi-almacén y Kardex

### HU-06: Control de Stock por Almacén, Lotes y Alertas de Vencimiento
- **Como** Administrador u Operador de Almacén,
- **Quiero** visualizar las existencias por SKU en cada sucursal (Sucre, La Paz, Cochabamba, Santa Cruz) y controlar lotes,
- **Para** garantizar la rotación FEFO (primero en vencer, primero en salir) y evitar quiebres de inventario.

**Criterios de Aceptación (Gherkin):**
```gherkin
Escenario: Consulta restringida para Operador de Almacén
  Dado un usuario autenticado con rol OPERADOR_ALMACEN asignado a "Agencia La Paz"
  Cuando ingresa al módulo de inventario
  Entonces solo visualiza el stock y los movimientos de la "Agencia La Paz" y no de otros almacenes.

Escenario: Alerta de stock mínimo y lote próximo a vencer
  Dado un producto cuyo stock total en un almacén sea menor al "stock_minimo"
  Cuando el encargado revisa el inventario
  Entonces el sistema resalta el ítem con indicador visual de alerta ámbar/rojo.
```

### HU-07: Movimientos de Kardex y Trazabilidad
- **Como** Administrador u Operador,
- **Quiero** registrar entradas, salidas por venta, ajustes y traspasos entre almacenes con motivo y usuario,
- **Para** mantener una auditoría inmutable de cada unidad de chocolate que entra o sale de la empresa.

### HU-14: Cálculo de Stock Disponible Real y Límite de Compra
- **Como** comprador minorista o corporativo en la tienda digital,
- **Quiero** ver el stock disponible real calculado como `Stock Físico - Reservas Activas`,
- **Para** no intentar comprar unidades que ya están comprometidas en otros checkouts en curso y evitar sobreventas.

**Criterios de Aceptación (Gherkin):**
```gherkin
Escenario: Cálculo de disponibilidad real en catálogo y ficha de producto
  Dado un producto con 100 unidades en inventario físico
  Y 20 unidades comprometidas en reservas activas no expiradas
  Cuando el usuario consulta el producto o abre el modal de detalle
  Entonces el sistema reporta exactamente 80 unidades disponibles
  Y establece el límite máximo del selector de cantidad en 80.

Escenario: Validación estricta en servidor al añadir al carrito y al reservar
  Dado un cliente que intenta añadir o pagar una cantidad mayor al disponible real
  Cuando envía la petición al backend
  Entonces el servidor rechaza la operación con código HTTP 422
  Y devuelve el mensaje: "Stock insuficiente para la cantidad solicitada (Disponible: X)".
```

---

## Módulo 5: Checkout, Reserva Temporal y Métodos de Pago

### HU-08: Checkout Omnicanal con Reserva Temporal de Stock
- **Como** comprador (cliente con cuenta o invitado),
- **Quiero** tramitar el pedido seleccionando modalidad de entrega y método de pago,
- **Para** adquirir mis chocolates asegurando temporalmente la disponibilidad del producto.

**Criterios de Aceptación (Gherkin):**
```gherkin
Escenario: Elección de flujo de identificación en Checkout
  Dado que el usuario tiene artículos en el carrito y presiona "Pagar"
  Cuando se despliega la consulta "¿Ya tienes una cuenta?"
  Entonces ofrece tres opciones claras: "Iniciar sesión", "Crear cuenta" o "Continuar como invitado".

Escenario: Reserva temporal al seleccionar Pago QR (Simulado)
  Dado que el usuario selecciona el método de pago QR Simple
  Cuando genera la orden de compra
  Entonces el sistema reserva el stock de los productos por 15 minutos
  Y muestra un contador regresivo visible
  Y al completarse la confirmación automática, descuenta el stock definitivamente y genera la guía de envío.

Escenario: Selección de Transferencia Bancaria
  Dado que el usuario elige pago por Transferencia Bancaria
  Cuando confirma su pedido
  Entonces el sistema reserva el stock por 24 horas
  Y muestra las instrucciones y código de referencia del pedido
  Y permite adjuntar el comprobante (imagen/PDF máx 2 MB) o número de transacción
  Y fija el estado en "Pendiente de verificación".

Escenario: Selección de Efectivo en Tienda
  Dado que el usuario selecciona "Recoger en agencia propia"
  Cuando elige la opción de "Pago en efectivo en tienda"
  Entonces el sistema valida que sea una agencia propia (Tipo P)
  Y reserva el stock durante 48 horas
  Y si no se efectiviza en dicho lapso, pasa automáticamente a estado "Expirado" y libera el stock.
```

### HU-08B: Pasarela QR Simple con Polling y Cuenta Regresiva
- **Como** comprador en línea,
- **Quiero** pagar escaneando un código QR dinámico con temporizador de 15 minutos,
- **Para** concretar mi compra al instante desde cualquier aplicación bancaria nacional (BCP, BNB, Banco Unión, Mercantil, etc.).

**Criterios de Aceptación (Gherkin):**
```gherkin
Escenario: Generación de QR dinámico y polling automático
  Dado que el usuario elige pagar con "Código QR"
  Cuando se genera el intento de pago en la pasarela
  Entonces se muestra el código QR con el monto exacto en Bs y una cuenta regresiva de 15 minutos
  Y el frontend sondea el estado del pago cada 3 segundos sin bloquear la interfaz.

Escenario: Vencimiento de QR sin pago
  Dado un código QR generado que alcanza los 15 minutos sin confirmación
  Cuando el contador llega a 00:00
  Entonces el backend transiciona el estado_pago a "VENCIDO" y el estado_pedido a "EXPIRADO"
  Y libera automáticamente las reservas de stock asociadas.
```

### HU-08C: Depósito Bancario y Verificación por Operador de Almacén
- **Como** cliente que prefiere transferencia o depósito en ventanilla bancaria,
- **Quiero** registrar los datos de mi depósito y adjuntar mi comprobante digital (máx 2MB),
- **Para** que el personal de almacén valide los fondos y proceda con el despacho.

**Criterios de Aceptación (Gherkin):**
```gherkin
Escenario: Subida de comprobante bancario por el cliente
  Dado un pedido en estado "PENDIENTE_PAGO" con método "TRANSFERENCIA"
  Cuando el cliente carga un archivo de comprobante (JPG, PNG o PDF menor a 2MB), banco origen y número de operación
  Entonces el sistema almacena el intento en "pagos_intentos" y asigna estado "PENDIENTE".

Escenario: Validación por Operador de Almacén o Administrador
  Dado un comprobante registrado en la bandeja del almacén asignado
  Cuando el Operador de Almacén verifica el abono en cuenta bancaria y pulsa "Aprobar Pago"
  Entonces el estado_pago pasa a "PAGADO", el estado_pedido pasa a "PAGADO"
  Y el sistema registra al usuario que validó y la fecha/hora en la bitácora inmutable.
```

### HU-08D: Pasarela Internacional PayPal Sandbox (Conversión BOB a USD)
- **Como** comprador en el exterior o turista,
- **Quiero** pagar con tarjeta de crédito/débito internacional o cuenta PayPal en dólares americanos (USD),
- **Para** comprar chocolates de Sucre de manera segura desde cualquier país.

**Criterios de Aceptación (Gherkin):**
```gherkin
Escenario: Conversión automática de moneda y botón PayPal
  Dado un carrito con total en Bolivianos (ej. 139.20 Bs)
  Cuando el cliente selecciona "PayPal (USD)"
  Entonces el sistema convierte el monto a USD con la tasa oficial configurada (6.96 Bs/USD -> $20.00 USD)
  Y despliega los botones oficiales de PayPal Smart Payment Buttons.

Escenario: Captura y sincronización de orden PayPal v2
  Dado que el comprador autoriza el pago en el modal de PayPal Sandbox
  Cuando el backend ejecuta la captura (Capture Order v2)
  Entonces verifica el estatus COMPLETED con la API de PayPal
  Y actualiza el pedido a "PAGADO", guardando referencia externa y payload en "pagos_intentos".
```

---

## Módulo 6: Notificaciones de Compra (Email y WhatsApp)

### HU-09: Envío de Notificaciones de Confirmación Multicanal
- **Como** cliente que ha realizado una compra,
- **Quiero** recibir un correo con el detalle del pedido y un enlace directo a WhatsApp,
- **Para** contar con el respaldo de mi compra y coordinar la entrega de manera ágil.

**Criterios de Aceptación (Gherkin):**
```gherkin
Escenario: Despacho de correo transaccional vía Adaptador
  Dado un pedido confirmado en el sistema
  Cuando se ejecuta el servicio de notificación por correo
  Entonces el adaptador HTTPS envía el correo con la nota de venta e instrucciones
  Y si la API externa no está configurada, respalda el mensaje en la tabla "bandeja_simulada" sin romper el flujo.

Escenario: Generación de enlace a WhatsApp wa.me
  Dado un pedido registrado con código "PED-XXXX"
  Cuando el cliente presiona el botón "Enviar resumen por WhatsApp"
  Entonces se abre una pestaña nueva hacia `https://wa.me/59171163789` con el texto codificado
  Y contiene el resumen exacto: número de pedido, productos, total en Bs y método de pago.
```

---

## Módulo 7: Planillas de Venta e Impresión

### HU-10: Planilla de Control de Ventas y Comprobante Imprimible
- **Como** Administrador o Cliente,
- **Quiero** consultar el historial de ventas con filtros avanzados e imprimir la nota de compra,
- **Para** fines de control operativo y respaldo del cliente.

**Criterios de Aceptación (Gherkin):**
```gherkin
Escenario: Impresión limpia optimizada con @media print
  Dado que el usuario se encuentra visualizando el comprobante de venta
  Cuando presiona el botón "Imprimir Comprobante"
  Entonces se activa la vista de impresión en tamaño carta
  Y oculta barras de navegación, botones, menús y elementos decorativos
  Y resalta la advertencia obligatoria: "DOCUMENTO NO VÁLIDO PARA CRÉDITO FISCAL - NOTA DE ENTREGA".
```

---

## Módulo 8: Puntos de Venta (Solo Direcciones, Sin Mapas)

### HU-11: Directorio Nacional de Puntos de Venta
- **Como** cliente interesado en compras presenciales o recojo de pedidos,
- **Quiero** consultar los 47 puntos de venta clasificados por departamento y tipo (Propio, Aliado, Cadena),
- **Para** ubicar la tienda más cercana conociendo su dirección escrita y teléfono.

**Criterios de Aceptación (Gherkin):**
```gherkin
Escenario: Ausencia total de mapas incrustados
  Dado que el usuario ingresa a la sección "Puntos de Venta"
  Cuando navega por las ciudades (Sucre, La Paz, Cochabamba, Santa Cruz, etc.)
  Entonces la información se despliega exclusivamente en formato de tarjetas y tablas con texto legible
  Y no se carga ninguna librería ni iframe de Google Maps ni proveedores cartográficos.

Escenario: Filtrado de recojo en checkout exclusivo agencias Tipo P
  Dado que el comprador elige "Recoger en agencia" en el checkout
  Cuando despliega la lista de sucursales disponibles
  Entonces el sistema lista únicamente las Agencias Propias (Tipo P) de Sucre y La Paz
  Y no permite seleccionar puntos aliados ni cadenas comerciales.
```

---

## Módulo 9: Seguimiento y Tracking de Envíos

### HU-12: Consulta Pública de Guía de Envío en Tiempo Real
- **Como** destinatario de una compra con despacho nacional,
- **Quiero** ingresar el código de guía en el buscador de rastreo,
- **Para** verificar el estado actual de mi paquete sin inventar estados inexistentes.

**Criterios de Aceptación (Gherkin):**
```gherkin
Escenario: Consulta de guía existente
  Dado un código de guía real registrado en la base de datos (ej. "GUIA-SUC-1002")
  Cuando el usuario consulta el tracking
  Entonces el sistema responde con la cronología real de eventos del paquete (Preparación, Despachado, En tránsito, Entregado).

Escenario: Consulta de guía inexistente
  Dado un código de guía que no existe en el sistema
  Cuando el usuario envía el formulario de consulta
  Entonces se muestra el mensaje claro: "Guía no encontrada. Verifique el código ingresado"
  Y utiliza inserción segura con textContent evitando cualquier inyección de código XSS.
```

---

## Módulo 10: Cotizaciones B2B Corporativas

### HU-13: Solicitud y Gestión de Cotizaciones al por Mayor
- **Como** representante corporativo o institucional,
- **Quiero** enviar solicitudes de cotización para regalos empresariales y eventos,
- **Para** obtener precios mayoristas y personalización de cajas institucionales.

---

## Módulo 11: Picking, Preparación y Política FEFO

### HU-15: Picking por Almacén Asignado y Selección de Lotes FEFO
- **Como** Preparador de Pedidos (`PREPARADOR_PEDIDOS`),
- **Quiero** acceder a la cola de pedidos pagados de mi almacén asignado y completar el checklist de picking,
- **Para** retirar físicamente de estantería los productos asignando lotes según política FEFO (First Expired, First Out) y marcar el pedido como PREPARADO.

**Criterios de Aceptación (Gherkin):**
```gherkin
Escenario: Cola de preparación aislada por almacén
  Dado un usuario autenticado con rol PREPARADOR_PEDIDOS ligado a Planta Sucre (almacen_id = 1)
  Cuando accede al módulo de preparación
  Entonces visualiza únicamente pedidos en estado "PAGADO" asignados a Sucre
  Y no tiene visibilidad de pedidos de La Paz ni otras sucursales.

Escenario: Checklist interactivo de picking con sugerencia FEFO
  Dado un pedido en preparación
  Cuando el preparador marca cada SKU y cantidad recolectada
  Entonces el sistema sugiere automáticamente los lotes con fecha de vencimiento más próxima
  Y al completar el checklist, permite registrar incidencias de stock o transicionar a "PREPARADO".

Escenario: Control de transiciones no autorizadas
  Dado un preparador que intenta pasar directamente a "EMPACADO" o "ENTREGADO"
  Cuando envía la solicitud
  Entonces el servidor rechaza con HTTP 403 Forbidden ("Acceso denegado. Rol no autorizado para este estado").
```

---

## Módulo 12: Control de Calidad, Empaque y Embalaje Térmico

### HU-16: Checklist de Empaque, Tarjetas Personalizadas y Rotulado
- **Como** Empacador (`EMPACADOR`),
- **Quiero** recibir los pedidos en estado PREPARADO, validar su contenido y aplicar el embalaje adecuado (cajas, empaque térmico, tarjeta dedicatoria),
- **Para** asegurar la preservación del chocolate y la presentación corporativa antes de despachar.

**Criterios de Aceptación (Gherkin):**
```gherkin
Escenario: Checklist de control de calidad y aislamiento térmico
  Dado un pedido en estado "PREPARADO" con destino a zona cálida (Santa Cruz) o en temporada estival
  Cuando el empacador inicia el embalaje
  Entonces el sistema marca obligatoriamente la casilla "Empaque Térmico con gel refrigerante"
  Y requiere marcar los ítems de verificación (sellado de caja, protección contra golpes, peso total en kg).

Escenario: Tarjeta dedicatoria personalizada
  Dado un pedido donde el cliente solicitó dedicatoria o mensaje de regalo
  Cuando el empacador abre la orden
  Entonces el sistema muestra el texto exacto ingresado por el comprador para su impresión/inclusión en el paquete.

Escenario: Transición a LISTO_DESPACHO o LISTO_RECOJO
  Dado el checklist completado satisfactoriamente
  Cuando el empacador finaliza el empaque
  Entonces si el pedido es ENVIO_DOMICILIO transiciona a "LISTO_DESPACHO"
  Y si es RECOJO_AGENCIA transiciona a "LISTO_RECOJO".
```

---

## Módulo 13: Despacho, Courier y Retiro en Agencia

### HU-17: Asignación de Courier y Acta Digital de Entrega a Domicilio
- **Como** Despachador (`DESPACHADOR_ENTREGA`),
- **Quiero** asignar el courier de transporte, generar la guía y registrar el acta digital de entrega con foto y documento receptor,
- **Para** contar con respaldo jurídico y formal de la entrega del pedido al cliente final.

**Criterios de Aceptación (Gherkin):**
```gherkin
Escenario: Registro de despacho y generación de guía
  Dado un pedido en estado "LISTO_DESPACHO"
  Cuando el despachador asigna el courier y número de guía de transporte
  Entonces el pedido transiciona a "DESPACHADO" y se registra en "pedido_entregas" y "notificaciones_logs".

Escenario: Registro de entrega exitosa con acta digital
  Dado un paquete entregado en destino
  Cuando el despachador registra nombre y CI del receptor, con fotografía de respaldo opcional
  Entonces el estado_pedido transiciona a "ENTREGADO"
  Y la fecha_entrega queda auditada inmutablemente.

Escenario: Registro de entrega fallida
  Dado un courier que no encuentra al destinatario tras el intento
  Cuando se reporta la novedad
  Entonces se incrementa el contador "intentos_realizados" (máximo 3)
  Y si llega a 3 intentos sin éxito, transiciona a "DEVUELTO" y se devuelve stock a almacén.
```

### HU-18: Retiro Seguro en Agencia con Validación de Código Corto
- **Como** Despachador o Encargado de Agencia Propia,
- **Quiero** validar el código corto de retiro presentado por el cliente en ventanilla,
- **Para** entregar el pedido únicamente a la persona facultada y evitar fraudes o entregas erróneas.

**Criterios de Aceptación (Gherkin):**
```gherkin
Escenario: Validación exitosa de código de retiro
  Dado un cliente que se presenta en la Agencia Central de Sucre con el código de retiro "RET-7892"
  Cuando el despachador ingresa el código en la pantalla de despacho
  Entonces el sistema valida la vigencia dentro de "fecha_limite_retiro"
  Y marca "codigo_retiro_validado = 1", transicionando el pedido a "ENTREGADO".

Escenario: Código de retiro expirado
  Dado un pedido en agencia que superó el plazo máximo de retiro (48 horas tras estar listo)
  Cuando se consulta el código
  Entonces el sistema advierte estado "EXPIRADO" y bloquea la entrega sin autorización de administración.
```

---

## Módulo 14: Cierre Definitivo de Pedidos y Auto-Finalización

### HU-19: Cierre Definitivo de Pedidos y Auto-Finalización tras 7 Días
- **Como** Administrador o Cliente satisfecho,
- **Quiero** confirmar la conformidad del pedido o permitir que el sistema lo auto-finalice tras 7 días de entregado,
- **Para** dar por concluido el ciclo de vida de la transacción y habilitar encuestas o cierre contable.

**Criterios de Aceptación (Gherkin):**
```gherkin
Escenario: Confirmación de conformidad manual por el cliente
  Dado un cliente con un pedido en estado "ENTREGADO"
  Cuando ingresa a su panel y pulsa "Confirmar Recepción y Cerrar Pedido"
  Entonces el estado_pedido transiciona a "FINALIZADO" y se registra la fecha_finalizado.

Escenario: Auto-finalización tras 7 días sin reclamo
  Dado un pedido en estado "ENTREGADO" con más de 7 días transcurridos desde fecha_entrega
  Cuando se ejecuta la tarea programada de cierre del sistema
  Entonces transiciona automáticamente a "FINALIZADO" con usuario NULL y motivo "AUTO_FINALIZACION_7_DIAS".
```
