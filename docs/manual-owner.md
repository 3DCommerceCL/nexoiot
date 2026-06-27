# Manual de Uso — NexoSuite PMS
## Rol: Owner (Administrador del Hotel)

---

## Índice

1. [¿Qué es NexoSuite y para qué sirve?](#1-qué-es-nexosuite-y-para-qué-sirve)
2. [Cómo leer el panel principal (Overview)](#2-cómo-leer-el-panel-principal-overview)
3. [Gestión de habitaciones](#3-gestión-de-habitaciones)
4. [Aseo y housekeeping](#4-aseo-y-housekeeping)
5. [Categorías de habitaciones](#5-categorías-de-habitaciones)
6. [Calendario de ocupación](#6-calendario-de-ocupación)
7. [Reservas](#7-reservas)
8. [Tarifas](#8-tarifas)
9. [Motor de Reservas y widget web](#9-motor-de-reservas-y-widget-web)
10. [Canales OTA (Booking.com, Airbnb)](#10-canales-ota-bookingcom-airbnb)
11. [Pagos](#11-pagos)
12. [Facturación SII](#12-facturación-sii)
13. [Informes y KPIs](#13-informes-y-kpis)
14. [Huéspedes CRM](#14-huéspedes-crm)
15. [Servicios y upsell](#15-servicios-y-upsell)
16. [Mensajes de huéspedes](#16-mensajes-de-huéspedes)
17. [Log de actividad](#17-log-de-actividad)
18. [Equipo y permisos](#18-equipo-y-permisos)
19. [Configuración de su cuenta](#19-configuración-de-su-cuenta)
20. [Flujos de trabajo por turno](#20-flujos-de-trabajo-por-turno)
21. [Cómo interpretar el RevPAR y tomar decisiones](#21-cómo-interpretar-el-revpar-y-tomar-decisiones)
22. [Preguntas frecuentes](#22-preguntas-frecuentes)

---

## 1. ¿Qué es NexoSuite y para qué sirve?

NexoSuite PMS es el sistema central de gestión de su hotel. Desde aquí usted puede:

- Ver en tiempo real qué habitaciones están ocupadas, libres o en limpieza.
- Crear, modificar y cancelar reservas.
- Cobrar a los huéspedes y emitir boletas o facturas electrónicas al SII.
- Controlar a su equipo de recepción, aseo y otros roles.
- Publicar tarifas en canales como Booking.com y Airbnb.
- Revisar reportes de ingresos, ocupación y rendimiento.

El sistema funciona en cualquier navegador web (Chrome, Edge, Safari). No requiere instalar nada en su computador.

---

## 2. Cómo leer el panel principal (Overview)

Al ingresar, lo primero que verá es el **Overview**. Es su "tablero de control" del día.

### Indicadores superiores (KPIs en tiempo real)

| Indicador | Qué significa |
|---|---|
| **Ocupadas** | Habitaciones con un huésped activo en este momento |
| **Libres** | Disponibles para nueva reserva o check-in |
| **DND** | "No molestar" — el huésped activó el aviso desde su habitación |
| **Solicitudes pendientes** | Mensajes o pedidos de huéspedes sin responder |

Estos números se actualizan solos. No necesita recargar la página.

### Tarjetas de habitaciones

Debajo de los indicadores verá una cuadrícula con una tarjeta por habitación. Cada tarjeta muestra:

- **Número y nombre** de la habitación
- **Estado de ocupación**: libre (verde), ocupada (azul), bloqueada (gris)
- **Huésped activo**: nombre y fecha de salida estimada
- **Estado de aseo**: limpia / sucia / en proceso / pendiente inspección
- **Alertas activas**: DND, solicitud sin resolver, alarma de dispositivo

> **Consejo práctico:** Al comenzar el día revise esta pantalla. Si ve muchas tarjetas en rojo o con alertas, dirija su atención a esas habitaciones antes de comenzar el turno normal.

---

## 3. Gestión de habitaciones

Menú lateral → **Habitaciones**

Aquí encontrará la lista completa de todas las habitaciones del hotel con filtros para trabajar de forma ordenada.

### Filtros disponibles

- **Todas** — vista completa
- **Ocupadas** — solo las que tienen huésped activo
- **Libres** — disponibles ahora
- **Limpieza pendiente** — habitaciones que necesitan atención de aseo

Use el **buscador** si necesita ir directo a una habitación por número o nombre.

### Asignación masiva de categorías

Si tiene varias habitaciones del mismo tipo (por ejemplo, diez habitaciones "doble estándar"), puede seleccionarlas todas a la vez:

1. Marque la casilla a la izquierda de cada habitación que desea agrupar.
2. Una vez seleccionadas, aparecerá la opción **"Asignar categoría"**.
3. Elija la categoría correspondiente y confirme.

Esto es especialmente útil cuando acaba de agregar habitaciones nuevas al sistema y necesita clasificarlas rápido.

---

## 4. Aseo y housekeeping

Menú lateral → **Aseo**

Esta sección es para usted y para su supervisora de aseo. Muestra el estado de limpieza de cada habitación en formato de tarjetas visuales.

### Estados de aseo

| Estado | Significado |
|---|---|
| **Limpia** | Lista para recibir huésped |
| **Sucia** | Pendiente de limpieza (check-out reciente u ocupada) |
| **En proceso** | La camarera está limpiando en este momento |
| **Inspección** | Limpieza terminada, esperando revisión del supervisor |

### Barra de resumen

En la parte superior verá un conteo rápido de cuántas habitaciones hay en cada estado. Esto le permite saber en 5 segundos cuántas están listas versus cuántas siguen en proceso.

### Cómo usar esta vista en la práctica

- Al iniciar el turno de mañana: filtre por **"Sucia"** para ver cuántas habitaciones necesitan atención después de los check-outs.
- Al mediodía: filtre por **"Inspección"** para ver qué habitaciones esperan revisión antes de que lleguen huéspedes.
- Antes del cierre: confirme que todas las habitaciones con check-in programado para mañana estén en estado **"Limpia"**.

---

## 5. Categorías de habitaciones

Menú lateral → **Categorías**

Las categorías son los "tipos" de habitación de su hotel. Ejemplos típicos:

- Simple estándar
- Doble estándar
- Suite matrimonial
- Cabaña familiar

### Por qué son importantes

Las categorías son la base del sistema de tarifas. Cuando usted define una tarifa, la aplica a una categoría completa (no necesariamente a cada habitación individual). Esto ahorra mucho tiempo cuando tiene varias habitaciones del mismo tipo.

### Cómo crear una categoría

1. Haga clic en **"Nueva categoría"**.
2. Escriba el nombre (por ejemplo, "Suite Junior").
3. Agregue una descripción breve si lo desea.
4. Guarde.

Luego, desde la sección **Habitaciones**, asigne las habitaciones correspondientes a esa categoría.

---

## 6. Calendario de ocupación

Menú lateral → **Calendario**

Vista mensual que muestra todas las reservas del hotel distribuidas por día.

### Cómo usarlo

- **Clic en un día vacío** → abre el formulario para crear una nueva reserva en esa fecha.
- **Clic en una reserva existente** → abre el detalle de esa reserva (puede ver huésped, habitación, monto, estado de pago).

### Cierre de habitación

En la parte superior del calendario encontrará el botón **"Cierre de habitación"**. Úselo cuando necesite bloquear una habitación por mantenimiento, remodelación u otro motivo:

1. Haga clic en **"Cierre de habitación"**.
2. Seleccione la habitación.
3. Elija las fechas de inicio y fin del bloqueo.
4. Agregue un motivo (opcional pero recomendado para el log).
5. Confirme.

Las fechas bloqueadas no aparecerán como disponibles en el motor de reservas ni en los canales OTA.

---

## 7. Reservas

Menú lateral → **Reservas**

Esta es una de las secciones más usadas del día a día. Aquí ve todas las reservas (pasadas, presentes y futuras) y puede crear nuevas.

### Lista de reservas

Use los filtros para encontrar reservas rápidamente:

- Por estado: pendiente, confirmada, check-in activo, check-out, cancelada
- Por fecha de llegada o salida
- Por nombre del huésped

### Crear una nueva reserva

1. Haga clic en **"Nueva reserva"** (o en un día vacío desde el Calendario).
2. Busque o ingrese el huésped (nombre, RUT, email).
3. Seleccione la habitación.
4. Elija las fechas en el **mini-calendario**. Los días sin tarifa configurada aparecerán bloqueados y no se podrán seleccionar. Si necesita habilitar fechas, primero vaya a **Tarifas** (ver sección 8).
5. El sistema calculará el **monto total automáticamente** según la tarifa vigente para esas fechas.
6. Confirme la reserva.

### Pestañas del modal de reserva

Al abrir una reserva verá tres pestañas:

| Pestaña | Contenido |
|---|---|
| **Detalle** | Datos del huésped, habitación, fechas, estado, notas |
| **Pagos** | Historial de cobros de esta reserva, agregar pago manual |
| **Pre check-in** | Información que el huésped completó antes de llegar (documento, auto, etc.) |

### Importar reservas desde CSV

Si migra desde otro sistema o recibe reservas en planilla, puede importarlas en bloque:

1. Dentro de **Reservas**, haga clic en **"Importar CSV"**.
2. Descargue la **plantilla** para ver el formato exacto que necesita.
3. Complete la plantilla con sus reservas.
4. Arrastre el archivo a la zona indicada o haga clic para buscarlo.
5. El sistema mostrará un resumen: cuántas reservas se importaron correctamente y cuáles se omitieron (con el motivo de cada error).

---

## 8. Tarifas

Menú lateral → **Tarifas**

Aquí define cuánto cobra por noche en cada habitación o categoría. Esto afecta directamente el cálculo automático al crear una reserva y lo que se muestra en el motor de reservas web.

### Vista de grilla semanal

Verá una tabla con los días de la semana en columnas y las habitaciones o categorías en filas. Cada celda muestra la tarifa para ese día.

### Editar una tarifa

**Celda individual:** haga clic directamente sobre el monto de un día específico, escríbalo y guarde.

**Modo Rango de días:** útil para definir tarifas de temporada sin editar celda por celda:

1. Active el modo **"Rango de días"**.
2. Seleccione la fecha de inicio y fin.
3. Elija si aplica a habitación específica, a una categoría o a todos.
4. Ingrese el monto.
5. Guarde.

### Jerarquía de tarifas (importante)

El sistema respeta este orden de prioridad al calcular el precio de una reserva:

1. **Override de habitación** (tarifa específica para esa habitación en esa fecha) — tiene prioridad máxima
2. **Override de categoría** (tarifa para el tipo de habitación en esa fecha)
3. **Tarifa de rango** (tarifa general para un período)

Ejemplo: si la Suite 201 tiene una tarifa específica de $120.000 para el 14 de febrero, pero la categoría "Suite" tiene $100.000 para esa fecha, el sistema usará $120.000 para esa habitación.

---

## 9. Motor de Reservas y widget web

Menú lateral → **Motor de Reservas**

Esta sección controla las reservas que llegan directamente desde su sitio web, sin pasar por Booking.com ni Airbnb (sin comisiones).

### Pestañas disponibles

#### Tarifas base por rango de fechas
Define los precios públicos que verán los visitantes de su sitio web. Funciona igual que la sección Tarifas pero orientado al canal directo.

#### Tarifas avanzadas (derivadas/porcentuales)
Permite crear variaciones automáticas. Por ejemplo:
- "Para reservas de 7 noches o más, aplicar 10% de descuento"
- "Los viernes y sábados, cobrar 20% más que la tarifa base"

No necesita calcular manualmente: el sistema aplica el porcentaje sobre la tarifa base.

#### Configuración del widget
El widget es el "motor de búsqueda" que se instala en su sitio web para que los huéspedes puedan buscar disponibilidad y reservar. Aquí puede personalizar:
- Colores para que coincida con su marca
- Idioma
- Habitaciones visibles al público

Su equipo de diseño web puede instalar el widget con el código que genera esta pantalla.

#### Encuesta de salida
Configure las preguntas que se enviarán automáticamente a los huéspedes después del check-out. Los resultados quedan en la sección **Huéspedes CRM**.

#### Reglas de cierre
Define condiciones automáticas para cerrar la disponibilidad. Ejemplos:
- "Cerrar reservas con menos de 24 horas de anticipación"
- "No aceptar estadías de 1 noche los viernes"

---

## 10. Canales OTA (Booking.com, Airbnb)

Menú lateral → **Canales OTA**

OTA significa "Online Travel Agency" (agencia de viajes en línea). Desde aquí conecta su hotel con Booking.com, Airbnb u otras plataformas para que la disponibilidad y tarifas se sincronicen.

### Agregar un canal

1. Haga clic en **"Agregar canal"**.
2. Seleccione la plataforma (Booking.com, Airbnb, etc.).
3. Siga las instrucciones para conectar su cuenta de esa plataforma.

### Mapeo de habitaciones

Una vez conectado el canal, debe indicar a NexoSuite qué habitación de su sistema corresponde a qué listado en la plataforma externa. Esto se llama "mapeo":

- Habitación 101 en NexoSuite → "Habitación doble con vista al mar" en Booking.com

Haga este mapeo una vez y el sistema lo recordará.

### Sincronización manual

Si nota que una plataforma no refleja los últimos cambios de disponibilidad, use el botón **"Sincronizar"** para forzar una actualización inmediata. Normalmente la sincronización ocurre sola, pero este botón le da control cuando lo necesite.

### Log del canal

Cada acción de sincronización queda registrada: qué se envió, a qué hora, si fue exitosa o tuvo error. Esto le permite rastrear si una discrepancia en Booking.com se debe a un error de sincronización.

> **Importante:** Cuando una reserva entra por Booking.com o Airbnb, aparece automáticamente en su lista de **Reservas** con la fuente indicada. No necesita ingresarla manualmente.

---

## 11. Pagos

Menú lateral → **Pagos**

Historial completo de todas las transacciones del hotel.

### Métodos de pago disponibles

| Método | Descripción |
|---|---|
| **Webpay Plus** | Pago con tarjeta de crédito/débito en línea (Transbank) |
| **Mercado Pago** | Pago en línea con tarjeta o transferencia |
| **Manual efectivo** | Registro de pago recibido en efectivo |
| **Manual transferencia** | Registro de transferencia bancaria recibida |

### Estados de pago

| Estado | Significado |
|---|---|
| **Pendiente** | El huésped aún no ha pagado |
| **Aprobado** | Pago confirmado y acreditado |
| **Rechazado** | La transacción falló (tarjeta sin fondos, datos incorrectos, etc.) |
| **Anulado** | Pago que existía pero fue revertido |

### Registrar un pago manual

Cuando un huésped paga en efectivo o hace una transferencia:

1. Abra la reserva correspondiente (desde Reservas → pestaña Pagos).
2. Haga clic en **"Agregar pago"**.
3. Seleccione el método (efectivo o transferencia).
4. Ingrese el monto y la fecha.
5. Guarde.

El pago quedará registrado en el historial y el saldo pendiente de la reserva se actualizará.

### Filtros del historial

Use los filtros de fecha y estado para revisar, por ejemplo, todos los pagos aprobados del mes o todos los pendientes de la semana.

---

## 12. Facturación SII

Menú lateral → **Facturación SII**

Desde aquí emite documentos tributarios electrónicos (boletas y facturas) conectado al SII a través de Tupana.

### Configuración inicial

Antes de emitir documentos, su representante de NexoSuite debe configurar sus credenciales de Tupana y los datos de su empresa. Esto se hace una sola vez.

### Cómo emitir una boleta o factura

La emisión se hace desde el **modal de la reserva**, no desde esta sección directamente:

1. Abra la reserva (menú Reservas → clic en la reserva).
2. Dentro del modal, busque la opción **"Emitir documento"**.
3. Elija el tipo: boleta o factura.
4. Si es factura, ingrese los datos del receptor (RUT empresa, razón social, giro, dirección).
5. Confirme el monto y emita.

### Punto importante: emisión manual

> **La emisión de documentos es manual.** El sistema NO genera automáticamente una boleta cuando usted registra un pago. Usted debe hacerlo en el momento que corresponda (generalmente al momento del check-out o cuando el huésped lo solicite).

### Historial de documentos

En la sección **Facturación SII** puede revisar todos los documentos emitidos, filtrar por fecha y descargar copias en PDF.

---

## 13. Informes y KPIs

Menú lateral → **Informes**

Esta sección le entrega los números clave del negocio para que pueda tomar decisiones informadas.

### KPIs disponibles

| Indicador | Qué mide |
|---|---|
| **Ingresos** | Total facturado en el período seleccionado |
| **RevPAR** | Ingreso por habitación disponible (ver sección 21) |
| **ADR** | Tarifa diaria promedio cobrada por habitación ocupada |
| **Ocupación** | Porcentaje de habitaciones ocupadas sobre el total disponible |
| **ALOS** | Estadía promedio en noches (Average Length of Stay) |
| **Reservas** | Cantidad total de reservas en el período |
| **Canceladas** | Cantidad de reservas canceladas en el período |

### Comparación con período anterior

Cada KPI muestra una flecha y un porcentaje en **verde** (mejoró) o **rojo** (empeoró) respecto al período anterior equivalente. Esto le permite ver de un vistazo si va mejor o peor que la semana o mes pasado.

### Tabla de tendencia semanal

Si selecciona un período mayor a 14 días, aparece una tabla que muestra la evolución semana a semana. Útil para identificar semanas flojas y semanas fuertes.

### Cómo seleccionar el período

Use el selector de fechas en la parte superior para elegir el rango que desea analizar: última semana, último mes, temporada, año completo, o fechas personalizadas.

---

## 14. Huéspedes CRM

Menú lateral → **Huéspedes**

Base de datos de todos los huéspedes que han pasado por su hotel.

### Búsqueda

Busque por nombre o email. El sistema le muestra los resultados mientras escribe.

### Ficha de huésped

Al hacer clic en un huésped verá:

- **Historial de estadías**: todas las veces que ha estado en su hotel, con fecha, habitación y monto.
- **Notas internas**: puede escribir observaciones que solo ve su equipo (preferencias especiales, observaciones de comportamiento, etc.). El huésped no ve estas notas.
- **Encuestas de salida**: respuestas que el huésped completó después de su estadía.

### Para qué sirve en el día a día

- Identificar huéspedes recurrentes para darles un trato especial.
- Recordar preferencias antes de que lleguen (habitación preferida, almohada extra, etc.).
- Resolver disputas revisando el historial completo de pagos y estadías.

---

## 15. Servicios y upsell

Menú lateral → **Servicios**

Directorio de servicios que se mostrará a los huéspedes en la app de habitación (si su hotel tiene dispositivos NexoSmart instalados).

### Dos tipos de servicios

1. **Informativos**: información para el huésped (horario del desayuno, número de recepción, reglas del hotel, mapa del lugar).
2. **Upsell**: servicios que el huésped puede solicitar y que generan un ingreso adicional (tour, traslado al aeropuerto, late check-out, desayuno en habitación, etc.).

### Agregar un servicio

1. Haga clic en **"Nuevo servicio"**.
2. Ingrese nombre, descripción y foto (opcional).
3. Si es upsell, ingrese el precio.
4. Defina si está disponible todos los días o en horarios específicos.
5. Guarde.

Los cambios aparecen en la app de habitación de inmediato.

---

## 16. Mensajes de huéspedes

Menú lateral → **Mensajes**

Cuando un huésped hace una solicitud desde la app de habitación (por ejemplo, "necesito toallas extras" o "favor apagar el climatizador de pasillo"), el mensaje llega aquí.

### Vista de mensajes

- **Pendientes**: solicitudes sin responder. El ícono de Mensajes en el menú lateral muestra un **badge con el número** de pendientes para que no se le escape ninguno.
- **Resueltas**: solicitudes que ya fueron atendidas y marcadas como resueltas.

### Responder y resolver una solicitud

1. Haga clic en el mensaje.
2. Lea el pedido del huésped.
3. Asigne a un miembro del equipo si corresponde.
4. Una vez atendido, marque como **"Resuelto"**.

> **Consejo:** Revise esta sección al menos cada hora durante el turno activo. Un huésped que espera mucho sin respuesta es una reseña negativa en potencia.

---

## 17. Log de actividad

Menú lateral → **Log de actividad**

Registro cronológico de todo lo que ocurre en el sistema. Útil para auditorías y para investigar qué pasó en un momento específico.

### Tipos de eventos registrados

| Evento | Descripción |
|---|---|
| `checkin` | Se realizó un check-in |
| `checkout` | Se realizó un check-out |
| `device_command` | Se envió un comando a un dispositivo (ej: encender AC) |
| `housekeeping_changed` | Cambió el estado de aseo de una habitación |
| Otros | Cambios de tarifa, creación de reservas, pagos, etc. |

### Para qué sirve

- **Investigar un problema**: "¿Quién cambió el estado de la habitación 205?" → búsquelo en el log.
- **Auditar a su equipo**: verifique que los check-ins y check-outs se registraron a la hora correcta.
- **Resolver disputas con huéspedes**: confirme con exactitud cuándo entró o salió alguien.

---

## 18. Equipo y permisos

Menú lateral → **Equipo**

Administre quién puede acceder al sistema y qué puede hacer cada persona.

### Roles fijos del sistema

| Rol | Acceso |
|---|---|
| **Owner** | Acceso completo a todas las secciones (usted) |
| **Recepción** | Acceso operativo: reservas, check-in/out, pagos, mensajes |

### Roles personalizados

Puede crear roles adaptados a su hotel usando las plantillas predefinidas:

| Plantilla | Para quién |
|---|---|
| **Personal de aseo** | Camareras y supervisoras de housekeeping |
| **Mayordomo / Conserje** | Atención de solicitudes y servicios |
| **Revenue manager** | Gestión de tarifas e informes |
| **Supervisor** | Supervisión de equipo y reportes operativos |

### Cómo agregar un miembro al equipo

1. Haga clic en **"Nuevo usuario"**.
2. Ingrese nombre, email y rol.
3. El sistema enviará un correo de invitación al nuevo usuario con sus credenciales temporales.

### Cómo cambiar el rol de un usuario existente

1. Haga clic sobre el usuario.
2. Seleccione el nuevo rol en el desplegable.
3. Guarde.

> **Importante:** Solo el Owner puede crear, editar y eliminar usuarios. Si un empleado se va de la empresa, elimínelo del sistema de inmediato desde esta sección.

---

## 19. Configuración de su cuenta

Menú lateral → **Configuración**

Opciones personales de su perfil:

- **Idioma del sistema**: cambie entre español e inglés u otros idiomas disponibles.
- **Cambiar contraseña**: hágalo periódicamente por seguridad. Recomendamos cambiarla cada 3 meses.

> **Consejo de seguridad:** No comparta su contraseña con nadie. Si necesita dar acceso a alguien, créele su propio usuario en la sección Equipo.

---

## 20. Flujos de trabajo por turno

Esta sección describe cómo usar NexoSuite en la práctica durante un día de operación hotelera típico.

---

### Turno de mañana (apertura)

**Objetivo:** conocer el estado del hotel al comenzar el día y preparar los check-ins y check-outs del día.

**Pasos recomendados:**

1. **Overview** → revise los KPIs de la noche: cuántas habitaciones ocupadas, si hay alertas activas o DND activos que no se desactivaron.

2. **Reservas** → filtre por "check-out hoy" para saber cuántas habitaciones se liberarán y a qué hora.

3. **Reservas** → filtre por "check-in hoy" para preparar la recepción: tenga listas las llaves o accesos digitales, revise si hay pre check-in completado (pestaña Pre check-in de cada reserva).

4. **Aseo** → revise cuántas habitaciones están en estado "Sucia" (las del check-out de ayer que no se limpiaron de noche). Coordine con su supervisora de aseo cuántas camareras necesita.

5. **Mensajes** → revise si quedaron solicitudes pendientes del turno nocturno sin resolver.

6. **Log de actividad** → revise rápidamente si ocurrió algo inusual durante la noche (alarmas, eventos fuera de horario).

---

### Turno de tarde

**Objetivo:** ejecutar check-ins, resolver solicitudes, mantener operación fluida.

**Pasos recomendados:**

1. **Reservas** → procese los check-ins del día a medida que lleguen los huéspedes. Abra la reserva, confirme los datos, registre el método de pago en la pestaña Pagos si corresponde.

2. **Aseo** → verifique que las habitaciones de los check-ins del día estén en estado "Limpia" antes de asignarlas. Si alguna sigue "En proceso" o "Inspección", coordine con aseo.

3. **Mensajes** → monitoree activamente. Responda las solicitudes entrantes a medida que lleguen.

4. **Pagos** → registre los pagos en efectivo o transferencia que ingresen durante el día. No espere al cierre para hacerlo, ya que el saldo de cada reserva debe reflejar lo real.

5. **Facturación SII** → emita boletas o facturas cuando los huéspedes las soliciten, generalmente al momento del check-out.

---

### Cierre de turno / cierre de caja

**Objetivo:** cuadrar el día, dejar todo preparado para la noche y el día siguiente.

**Pasos recomendados:**

1. **Pagos** → revise todos los pagos del día. Filtre por la fecha de hoy y confirme que los pagos en efectivo y transferencia registrados coincidan con lo que tiene en caja física.

2. **Reservas** → asegúrese de que todos los check-outs del día estén marcados como tal. Una reserva "activa" para una habitación que ya se liberó bloquea la disponibilidad.

3. **Aseo** → confirme que todas las habitaciones que tuvieron check-out hoy están en proceso de limpieza o ya limpias. Las que se limpiarán mañana temprano deben quedar en "Sucia" para que la supervisora de mañana las vea de inmediato.

4. **Informes** → revise rápidamente los KPIs del día: ingresos, ocupación, ADR. Compare con el día anterior (la comparación verde/rojo es instantánea).

5. **Mensajes** → resuelva o delegue todos los mensajes pendientes antes de cerrar turno.

6. **Overview** → deje la pantalla en Overview si hay un encargado nocturno. Es la vista que permite monitorear el hotel de un vistazo.

---

### Planificación semanal (recomendado: lunes)

1. **Informes** → seleccione la semana pasada. Revise RevPAR, ocupación y ADR. Compare con la semana anterior.

2. **Tarifas** → ajuste tarifas para las próximas 2-3 semanas según la demanda esperada (eventos locales, temporada, feriados).

3. **Calendario** → identifique fechas con baja ocupación y considere promociones o descuentos en el Motor de Reservas.

4. **Huéspedes CRM** → revise si hay huéspedes recurrentes con estadía próxima para prepararles una bienvenida especial.

5. **Equipo** → confirme turnos y permisos si algún usuario cambia de rol esa semana.

---

## 21. Cómo interpretar el RevPAR y tomar decisiones

El **RevPAR** (Revenue Per Available Room, Ingreso por Habitación Disponible) es el indicador más importante de la salud de su hotel. Le conviene entenderlo bien.

### Cómo se calcula

```
RevPAR = Ingresos totales ÷ Total de habitaciones disponibles en el período
```

**Ejemplo:** Si su hotel tiene 10 habitaciones, operó 7 días, y los ingresos de esa semana fueron $2.100.000:

```
RevPAR = $2.100.000 ÷ (10 habitaciones × 7 días)
RevPAR = $2.100.000 ÷ 70
RevPAR = $30.000 por habitación por noche
```

Esto significa que en promedio, cada habitación disponible (ocupada o vacía) generó $30.000 por noche.

### Por qué es mejor que mirar solo la ocupación

Un hotel puede tener 90% de ocupación pero cobrar tarifas muy bajas, lo que da un RevPAR bajo. Otro hotel puede tener 60% de ocupación pero cobrar el doble por noche y tener un RevPAR más alto. El RevPAR captura ambos factores al mismo tiempo.

### Cómo usarlo para tomar decisiones

#### RevPAR sube semana a semana (comparación verde)
- **¿Qué pasó?** Subió la ocupación, subió la tarifa, o ambas.
- **Acción:** Si está cerca del 100% de ocupación y el RevPAR sube, tiene espacio para subir tarifas la próxima vez que tenga alta demanda. No regale habitaciones cuando todas se llenan igual.

#### RevPAR baja semana a semana (comparación roja)
- **¿Qué pasó?** Bajó la ocupación, bajó la tarifa promedio, o ambas.
- **Acción:** Primero identifique la causa: ¿bajó la ocupación? → revise si hay tarifas sin configurar o si la competencia está más barata. ¿Bajó el ADR? → revise si se hicieron muchos descuentos manuales.

#### RevPAR muy bajo con ocupación alta
- Está llenando el hotel pero cobrando poco. Suba tarifas gradualmente y mida el impacto.

#### RevPAR muy bajo con ocupación baja
- Situación de baja demanda. Considere: reducir tarifas temporalmente, activar una promoción en el Motor de Reservas, o publicar en más canales OTA.

### ADR y ocupación como complemento

| Situación | ADR | Ocupación | Diagnóstico | Acción |
|---|---|---|---|---|
| RevPAR alto | Alto | Alta | Excelente momento | Suba tarifas en fechas futuras similares |
| RevPAR medio | Alto | Baja | Tarifa buena, faltan reservas | Más visibilidad en canales, promociones |
| RevPAR medio | Bajo | Alta | Lleno pero barato | Suba tarifas, reduzca descuentos |
| RevPAR bajo | Bajo | Baja | Período flojo | Reducir tarifas, activar canales OTA, ofertas |

### ALOS (estadía promedio)

El ALOS le dice cuántas noches se queda en promedio cada huésped. Si su ALOS sube, está recibiendo estadías más largas, lo que generalmente reduce costos operativos (menos check-ins, menos limpieza de cambio).

- ALOS bajo (1-2 noches): muchos check-ins y check-outs, más trabajo operativo, más gastos de limpieza.
- ALOS alto (4+ noches): operación más tranquila, ingresos más predecibles.

Si quiere subir el ALOS, puede crear tarifas con descuento para estadías largas en el **Motor de Reservas → Tarifas avanzadas**.

---

## 22. Preguntas frecuentes

**¿Por qué el sistema no me deja seleccionar ciertas fechas al crear una reserva?**
Esas fechas no tienen tarifa configurada. Vaya a **Tarifas** y defina el precio para ese rango de fechas. Alternativamente, use el **Motor de Reservas → Tarifas base por rango** si es para reservas web.

**¿Cómo cancelo una reserva?**
Abra la reserva desde la sección **Reservas**, haga clic en la opción de cancelar dentro del modal y confirme. Si hay pagos asociados, decida si aplica reembolso y regístrelo en la pestaña Pagos.

**Un huésped pagó pero el sistema dice "pendiente". ¿Qué hago?**
Si el pago fue en efectivo o transferencia y usted ya lo recibió, regístrelo manualmente: abra la reserva, vaya a la pestaña **Pagos**, haga clic en "Agregar pago", seleccione el método y el monto. Si fue por Webpay o Mercado Pago y falló, el huésped debe intentar nuevamente.

**¿Cómo sé si Booking.com ya recibió mis cambios de tarifa?**
Vaya a **Canales OTA**, seleccione el canal y revise el **log**. Verá la última sincronización exitosa con hora y fecha.

**¿Puedo borrar un usuario del equipo?**
Sí. Vaya a **Equipo**, haga clic en el usuario y seleccione la opción de eliminar o desactivar. El usuario ya no podrá ingresar al sistema.

**¿El sistema emite boletas automáticamente cuando cobro?**
No. La emisión de documentos tributarios es siempre manual. Usted debe ir al modal de la reserva y emitir la boleta o factura en el momento que corresponda.

**¿Puedo ver las reseñas que dejaron los huéspedes?**
Las respuestas de las encuestas de salida están en **Huéspedes CRM**, en la ficha de cada huésped. Las reseñas públicas de Booking.com o Airbnb debe verlas directamente en esas plataformas.

**¿Qué pasa si cierro el navegador a mitad de una reserva?**
Los cambios no guardados se pierden. Siempre guarde antes de cerrar. Si la reserva fue creada (apareció en la lista), está grabada aunque cierre el navegador.

**¿Cómo bloqueo una habitación para mantenimiento sin que aparezca disponible?**
Use el botón **"Cierre de habitación"** en el **Calendario**. Seleccione la habitación y las fechas. Las fechas bloqueadas no aparecerán en el motor de reservas ni en los canales OTA.

**¿Con qué frecuencia debo revisar los informes?**
Recomendamos: resumen diario al cierre de turno (5 minutos), análisis semanal los lunes (15-20 minutos), revisión mensual completa el primer día de cada mes.

---

*Manual de uso NexoSuite PMS — Rol Owner*
*Versión: Junio 2026*
