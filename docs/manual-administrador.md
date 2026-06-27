# Manual de Administrador — NexoSuite PMS

**Rol:** Owner / Administrador principal  
**Versión:** Junio 2026

---

## Índice

1. [Acceso al panel](#1-acceso-al-panel)
2. [Panel principal (Overview)](#2-panel-principal-overview)
3. [Habitaciones](#3-habitaciones)
4. [Aseo (Housekeeping)](#4-aseo-housekeeping)
5. [Categorías de habitación](#5-categorías-de-habitación)
6. [Calendario](#6-calendario)
7. [Reservas](#7-reservas)
8. [Importar reservas desde CSV](#8-importar-reservas-desde-csv)
9. [Grilla de tarifas](#9-grilla-de-tarifas)
10. [Motor de reservas directas](#10-motor-de-reservas-directas)
11. [Canales OTA](#11-canales-ota)
12. [Pagos](#12-pagos)
13. [Facturación SII](#13-facturación-sii)
14. [Informes de rendimiento](#14-informes-de-rendimiento)
15. [CRM de huéspedes](#15-crm-de-huéspedes)
16. [Servicios del hotel](#16-servicios-del-hotel)
17. [Mensajes y solicitudes](#17-mensajes-y-solicitudes)
18. [Log de actividad](#18-log-de-actividad)
19. [Equipo: usuarios y roles](#19-equipo-usuarios-y-roles)
20. [Configuración](#20-configuración)
21. [Referencia de permisos](#21-referencia-de-permisos)
22. [Preguntas frecuentes](#22-preguntas-frecuentes)

---

## 1. Acceso al panel

### Ingresar al sistema

1. Navega a la URL del panel (la dirección que te entregó el equipo NexoSuite).
2. Ingresa tu **correo electrónico** y **contraseña**.
3. Haz clic en **Iniciar sesión**.

El sistema recuerda tu sesión hasta que cierres sesión manualmente. Si trabajas en un equipo compartido, cierra siempre sesión al terminar.

### Cerrar sesión

Haz clic en el ícono de usuario en la esquina inferior del menú lateral y selecciona **Cerrar sesión**, o busca el botón **Salir** en la parte superior.

---

## 2. Panel principal (Overview)

La vista de inicio muestra el estado en tiempo real de todas las habitaciones del hotel.

### Tarjetas KPI (parte superior)

| Indicador | Qué mide |
|---|---|
| **Ocupadas** | Habitaciones con huésped activo ahora mismo |
| **Libres** | Habitaciones sin huésped disponibles para check-in |
| **DND** | Habitaciones con "No molestar" activado |
| **Solicitudes** | Pedidos de huéspedes pendientes de respuesta |

### Tarjetas de habitación

Cada tarjeta muestra:
- **Nombre de la habitación** (ej. 101, Suite Vista)
- **Nombre del huésped** si está ocupada
- **Hora de checkout** estimada
- **Estado de aseo** (color de borde: verde = limpia, rojo = sucia, amarillo = en proceso)
- **Ícono de DND** si el huésped activó No molestar
- **Alertas de dispositivos** (puerta abierta, temperatura fuera de rango, etc.)

### Acciones rápidas

- **Haz clic en una tarjeta** de habitación ocupada → abre el modal de control (dispositivos IoT, mensajes, check-out).
- **Botón "Nueva estadía"** (esquina superior derecha) → crear un check-in directo sin reserva previa.
- **Botón de actualizar** → fuerza recarga de todos los datos.

---

## 3. Habitaciones

Menú lateral → **Habitaciones**

Vista en lista de todas las habitaciones. Permite gestionar la configuración de cada habitación y filtrar por estado.

### Filtros disponibles

| Filtro | Muestra |
|---|---|
| Todas | Todas las habitaciones |
| Ocupadas | Solo con huésped activo |
| Libres | Sin huésped |
| Limpieza pendiente | Estado de aseo ≠ Limpia |

### Buscar habitación

Escribe en el campo de búsqueda para filtrar por nombre o número de habitación.

### Acciones por habitación

**Habitación ocupada:**
- Ver datos del huésped (nombre, idioma, preferencias de accesibilidad)
- Controlar dispositivos IoT (luces, cortinas, temperatura, TV, etc.)
- Ejecutar escenas predefinidas (ej. "Bienvenida", "Noche")
- Programar comandos para una hora específica
- Enviar mensaje al huésped vía QR/app
- Registrar check-out

**Habitación libre:**
- Asignar categoría
- Cambiar estado de aseo
- Crear bloqueo (mantenimiento, limpieza profunda, etc.)

### Selección múltiple (bulk)

Activa el modo **Selección múltiple** (botón en la barra de filtros) para asignar la misma categoría a varias habitaciones a la vez. Útil al configurar el hotel por primera vez.

---

## 4. Aseo (Housekeeping)

Menú lateral → **Aseo**

Vista optimizada para móvil, diseñada para que el personal de limpieza registre el estado de cada habitación sin necesidad de acceso a funciones administrativas.

### Estados de aseo

| Estado | Significado |
|---|---|
| 🟢 **Limpia** | Lista para recibir huésped |
| 🔴 **Sucia** | Requiere limpieza |
| 🟡 **En proceso** | Personal trabajando ahora |
| 🔵 **Inspección** | Limpia, pendiente de revisión supervisora |

### Filtrar por estado

Usa los botones de la barra superior (Todas / Sucias / En proceso / Inspección / Limpias) para ver solo las habitaciones en ese estado.

### Cambiar estado de una habitación

En cada tarjeta aparecen los 4 botones de estado. Toca el estado nuevo → el cambio se guarda inmediatamente y queda registrado con tu nombre y la hora.

### Información de cada tarjeta

- Nombre de la habitación y badge de estado actual
- Huésped activo (si hay) y hora de checkout
- Quién hizo el último cambio y cuándo

> **Consejo:** Asigna el rol **Personal de aseo** a los miembros del equipo de limpieza. Solo verán esta vista al iniciar sesión, sin acceso al resto del panel.

---

## 5. Categorías de habitación

Menú lateral → **Categorías**

Las categorías agrupan habitaciones con características similares (tipo de cama, vista, capacidad). Son la base para asignar tarifas en bloque.

### Crear una categoría

1. Haz clic en **+ Nueva categoría**.
2. Ingresa nombre (ej. "Doble Vista Mar"), número de camas, descripción.
3. Guarda.

### Asignar habitaciones a una categoría

Desde la vista **Habitaciones**, usa selección múltiple para asignar la categoría a varias habitaciones a la vez, o edita cada habitación individualmente.

### Efecto en tarifas

Cuando asignas precio a una categoría en la grilla de tarifas, todas las habitaciones de esa categoría heredan ese precio para esa fecha. Los overrides por habitación individual tienen prioridad.

---

## 6. Calendario

Menú lateral → **Calendario**

Vista de calendario mensual que muestra todas las reservas activas de todas las habitaciones.

### Navegar por el calendario

- **Flechas ← →**: cambiar de mes.
- **Haz clic en una reserva**: abre el detalle de la reserva.
- **Haz clic en un día libre**: inicia una nueva reserva para esa fecha.

### Crear un bloqueo desde el calendario

1. Haz clic en el botón **Cierre de habitación**.
2. Selecciona habitación, fechas de inicio/fin, motivo (mantenimiento, limpieza, reservado, otro) y notas internas.
3. Guarda. El período aparece bloqueado en el calendario y en el sistema de disponibilidad.

### Eliminar un bloqueo

Haz clic en el bloqueo en el calendario → ícono de eliminar → confirma.

---

## 7. Reservas

Menú lateral → **Reservas**

Lista completa de todas las reservas del hotel con filtros y búsqueda.

### Filtros disponibles

- **Buscar por huésped**: nombre o email.
- **Estado**: Todas / Confirmada / Pendiente / Check-in / Check-out / Cancelada.
- **Fuente**: todas las fuentes u origen específico (Booking.com, Airbnb, directo, importación, etc.).
- **Rango de fechas**: filtra por fecha de check-in.

### Crear una reserva nueva

1. Desde **Reservas** haz clic en **Nueva estadía**, o desde el **Overview** usa el botón del mismo nombre.
2. Selecciona la habitación.
3. Elige fecha de check-in y check-out en el mini calendario (los días sin tarifa aparecen deshabilitados con un tooltip indicándolo).
4. El campo **Monto a cobrar** se calcula automáticamente según las tarifas configuradas.
5. Completa el nombre del huésped, email, teléfono, notas internas y método de pago.
6. Haz clic en **Crear reserva**.

### Ver y editar una reserva

Haz clic en cualquier fila de la lista. El modal de reserva muestra:

**Pestaña Detalle:**
- Fechas, habitación, estado, fuente de la reserva.
- Botones de check-in / check-out.
- Campo de notas internas.

**Pestaña Pagos:**
- Historial de transacciones.
- Botones para cobrar: Webpay (pago con tarjeta online), Mercado Pago (link de pago), o pago manual (efectivo / transferencia ya recibida).
- Resumen del monto total vs. pagado vs. pendiente.

**Pestaña Pre check-in:**
- Link de pre check-in QR para compartir con el huésped.
- Datos que el huésped registró (si lo completó): RUT/pasaporte, dirección, número de personas.

### Estados de una reserva

| Estado | Descripción |
|---|---|
| **Confirmada** | Reserva activa, huésped no ha llegado |
| **Pendiente** | Reserva creada, pago o confirmación pendiente |
| **Check-in** | Huésped presente en el hotel |
| **Check-out** | Huésped se fue, estadía completada |
| **Cancelada** | Reserva anulada |

### Cancelar una reserva

Desde el modal de detalle → botón **Cancelar reserva** → confirma. La habitación vuelve a estar disponible para nuevas reservas.

---

## 8. Importar reservas desde CSV

Útil para migrar desde otro sistema (Cloudbeds, MiniHotel, Excel, etc.) sin tener que ingresar cada reserva a mano.

### Formato del archivo

El archivo CSV debe tener estos encabezados en la primera fila. El separador puede ser coma (`,`) o punto y coma (`;`):

```
checkin,checkout,nombre,habitacion,email,telefono,monto_clp,notas,fuente
```

| Columna | Tipo | Requerido | Ejemplo |
|---|---|---|---|
| `checkin` | Fecha YYYY-MM-DD | ✅ | `2026-07-01` |
| `checkout` | Fecha YYYY-MM-DD | ✅ | `2026-07-03` |
| `nombre` | Texto | ✅ | `Juan Pérez` |
| `habitacion` | Nombre exacto de la hab. | ✅ | `101` |
| `email` | Email | — | `juan@mail.com` |
| `telefono` | Teléfono | — | `+56912345678` |
| `monto_clp` | Número entero en CLP | — | `150000` |
| `notas` | Texto libre | — | `Cama extra solicitada` |
| `fuente` | Texto | — | `Booking.com` |

> **El nombre de la habitación debe coincidir exactamente** con el nombre que tiene en el sistema (ej. si en el sistema es "Hab. 101", escribe "Hab. 101", no "101").

### Pasos para importar

1. Ve a **Reservas** → botón **📥 Importar CSV**.
2. Haz clic en **⬇ Descargar plantilla** para obtener un archivo de ejemplo listo para completar.
3. Completa la plantilla con tus datos y guárdala.
4. En el modal, arrastra el archivo al área indicada o haz clic para seleccionarlo.
5. Haz clic en **Importar**.
6. El sistema mostrará cuántas reservas se crearon exitosamente y listará las filas que no pudieron importarse con el motivo (conflicto de disponibilidad, habitación no encontrada, fechas inválidas, etc.).

> Si una reserva tiene `monto_clp`, se registrará automáticamente como un pago manual aprobado (transferencia).

---

## 9. Grilla de tarifas

Menú lateral → **Tarifas**

La grilla de tarifas es donde defines los precios por noche para cada habitación o categoría en cada fecha específica.

### Cómo funciona la jerarquía de precios

```
Override por habitación individual (prioridad máxima)
  ↓
Override por categoría
  ↓
Tarifa de rango (rangos de fecha configurados en Motor de Reservas)
```

### Navegar la grilla

- **Selector Habitación / Categoría** (arriba a la izquierda): elige si ver precios individuales por habitación o por categoría.
- **Flechas ← Semana / Semana →**: avanza o retrocede de semana en semana.

### Editar el precio de un día

1. Haz clic en la celda del día y habitación que quieres editar.
2. Escribe el precio en **UF** y presiona Enter.
3. Aparecen dos opciones:
   - **Solo este día**: aplica el precio solo a esa fecha.
   - **Hasta fecha…**: abre el modal para definir un rango con fecha fin.

### Editar un rango de días (modo Rango)

1. Haz clic en el botón **📅 Rango** en la barra de herramientas.
2. Haz clic en la primera celda del rango (el día de inicio).
3. Haz clic en la última celda del rango (el día de fin) — deben ser de la misma fila (misma habitación o categoría).
4. Las celdas seleccionadas se resaltan en verde.
5. Ingresa el precio en UF y haz clic en **Aplicar**.

> Las celdas con precio especial (override) se muestran con fondo diferente al resto.

### Limpiar sobreprecios

Para volver al precio base de un rango, edita la celda y elimina el valor. El sistema volverá a usar la tarifa de rango configurada.

---

## 10. Motor de reservas directas

Menú lateral → **Motor de Reservas**

Configura y gestiona el sistema de reservas online que los huéspedes pueden usar directamente desde tu sitio web.

### Pestaña Tarifas

Aquí defines las tarifas base por rango de fecha (temporadas):

1. Haz clic en **+ Nueva tarifa**.
2. Define: nombre, ámbito (todas las habitaciones, por categoría, o por habitación individual), precio en UF, fechas de vigencia y días de la semana que aplica.
3. Las tarifas de rango sirven como precio base; los overrides de la grilla tienen prioridad sobre ellas.

### Pestaña Tarifas avanzadas

Para crear reglas más complejas:
- **Derivada porcentual**: precio de una habitación como porcentaje del precio de otra (ej. Suite = Doble + 30%).
- **Por mínimo de noches**: precio distinto si la estadía dura más de N noches.

### Pestaña Configuración

Activa o desactiva el motor de reservas, define el antelación mínima (cuánto tiempo antes puede reservar un huésped), y personaliza el mensaje de bienvenida.

**Código de integración:** botón **Copiar código** → pega el código en tu sitio web para insertar el widget de reservas como iFrame.

**Vista previa:** actualiza el botón **Actualizar preview** para ver cómo queda el widget de reservas.

### Pestaña Encuesta de salida

Configura las preguntas que se envían automáticamente al huésped al hacer check-out.

### Pestaña Reglas de cierre

Define reglas automáticas que cierran la disponibilidad en ciertas condiciones (ej. no permitir check-in el mismo día después de las 18:00).

---

## 11. Canales OTA

Menú lateral → **Canales OTA**

Gestiona la integración con Booking.com, Airbnb y otros canales de venta online.

### Agregar un canal

1. Haz clic en **+ Agregar canal**.
2. Selecciona el tipo de canal (Booking.com, Airbnb, etc.).
3. Ingresa las credenciales de API del canal (ID de propiedad, API key).
4. Guarda.

### Mapeo de habitaciones

Cada canal necesita saber qué habitación del sistema corresponde a qué habitación en el canal externo:

1. Haz clic en el canal → **Configurar**.
2. En la pestaña **Mapeo de habitaciones**, empareja cada habitación del sistema con el ID correspondiente del canal.

### Sincronización manual

Dentro de la configuración de cada canal, el botón **Sincronizar ahora** envía la disponibilidad y tarifas actuales al canal. El sistema también sincroniza automáticamente cuando se crea o cancela una reserva.

### Log de sincronización

La pestaña **Log** muestra el historial de sincronizaciones: fecha, operación, resultado (éxito o error) y detalle del error si lo hay.

---

## 12. Pagos

Menú lateral → **Pagos**

Historial de todas las transacciones registradas en el sistema.

### Filtrar transacciones

- **Fecha desde / hasta**: rango de fechas de la transacción.
- El botón **Filtrar** aplica el rango.

### Métodos de pago disponibles

| Método | Cuándo usarlo |
|---|---|
| **Webpay Plus** | Cobro online con tarjeta. El huésped paga en la página de Transbank. |
| **Mercado Pago** | Genera un link de pago para enviar por WhatsApp/email. |
| **Efectivo / Transferencia** | Registra manualmente un pago ya recibido. |

### Registrar un pago manual

Desde el modal de la reserva → pestaña **Pagos** → **Registrar pago manual**:
1. Ingresa el monto en CLP.
2. Selecciona el tipo (Efectivo o Transferencia).
3. Ingresa la referencia (número de transferencia, folio, etc.) — opcional.
4. Guarda.

### Estados de una transacción

| Estado | Significado |
|---|---|
| **Pendiente** | Iniciada, no confirmada aún |
| **Aprobado** | Pago recibido y confirmado |
| **Rechazado** | Pago fallido (tarjeta rechazada, etc.) |
| **Anulado** | Transacción revertida |

---

## 13. Facturación SII

Menú lateral → **Facturación**

Gestiona la emisión de boletas y facturas electrónicas chilenas vía integración con el SII (Tupana API).

### Configuración inicial (primera vez)

1. Ve a **Facturación** → pestaña **Configuración**.
2. Ingresa: RUT del hotel, razón social, giro, dirección, resolución SII (número y fecha), y las credenciales de Tupana.
3. Guarda. El sistema quedará habilitado para emitir documentos tributarios.

### Emitir una boleta

Desde el modal de una reserva → sección de pagos → botón **Emitir boleta**:
- El sistema genera la boleta electrónica automáticamente con los datos de la reserva.
- El documento queda registrado y disponible para descarga en PDF.

### Emitir una factura

Mismo proceso pero con el botón **Emitir factura**. Se solicitarán además los datos tributarios del cliente (RUT empresa, razón social, giro).

### Historial de documentos

La vista principal de **Facturación** muestra todos los documentos emitidos con filtro por fecha. Puedes descargar cualquier documento desde ahí.

> **Nota importante:** La emisión de boleta/factura es un paso manual separado del cobro. Que un huésped haya pagado por Webpay no genera automáticamente una boleta — debes emitirla desde el panel.

---

## 14. Informes de rendimiento

Menú lateral → **Informes**

Analiza el desempeño financiero y operacional del hotel.

### Definir el período

1. Selecciona **Fecha desde** y **Fecha hasta**.
2. Haz clic en **Calcular**.

### Indicadores KPI

| Indicador | Fórmula | Interpretación |
|---|---|---|
| **Ingresos** | Suma de pagos aprobados | Total facturado en el período |
| **RevPAR** | Ingresos ÷ (hab. totales × días) | Ingreso por habitación disponible — el indicador más importante de eficiencia hotelera |
| **ADR** | Ingresos ÷ noches ocupadas | Tarifa promedio cobrada por noche ocupada |
| **Ocupación** | Noches ocupadas ÷ noches disponibles | % de uso real de la capacidad |
| **ALOS** | Noches ocupadas ÷ reservas activas | Duración promedio de estadía |
| **Reservas** | Cantidad de reservas activas | Excluye canceladas |
| **Canceladas** | Reservas con estado cancelado | — |

Cada KPI muestra también la variación porcentual respecto al período inmediatamente anterior de igual duración (▲ mejor / ▼ peor, con color verde/rojo).

### Tabla de tendencia semanal

Cuando el período seleccionado supera los 14 días, aparece una tabla que desglosa los mismos indicadores semana a semana. Útil para identificar semanas de alta o baja demanda.

### Exportar / usar los datos

Los informes son visuales dentro del panel. Para usarlos en un reporte externo, puedes tomar captura de pantalla o anotar los valores manualmente. La exportación directa a Excel está en el roadmap futuro.

---

## 15. CRM de huéspedes

Menú lateral → **Huéspedes**

Base de datos de todos los huéspedes que han pasado por el hotel.

### Buscar un huésped

Escribe nombre o email en el campo de búsqueda. La búsqueda se ejecuta automáticamente mientras escribes.

### Perfil de un huésped

Haz clic en cualquier huésped para ver:
- Historial de estadías (fechas, habitaciones, montos).
- Notas internas agregadas por el equipo.
- Resultados de la encuesta de salida (si completó).
- Preferencias registradas (idioma, accesibilidad, etc.).

### Agregar notas internas

Desde el perfil del huésped → campo de notas → escribe y guarda. Las notas son visibles solo para el equipo, no para el huésped. Útil para registrar preferencias especiales, incidentes, etc.

---

## 16. Servicios del hotel

Menú lateral → **Servicios**

Directorio de servicios del hotel que se muestra a los huéspedes desde la app de habitación (menú QR).

### Tipos de servicio

- **Upsell**: servicios con costo adicional (masajes, traslados, amenidades).
- **Informativo**: horarios de restaurante, piscina, Wi-Fi, políticas del hotel.

### Agregar un servicio

1. Haz clic en **+ Nuevo servicio**.
2. Ingresa nombre, descripción, precio (si aplica), categoría y si está activo.
3. Guarda.

Los huéspedes pueden ver esta información desde la app de habitación sin necesidad de llamar a recepción.

---

## 17. Mensajes y solicitudes

Menú lateral → **Mensajes**

Registro de todas las solicitudes enviadas por huéspedes desde la app de habitación (toallas, room service, late checkout, etc.).

### Ver solicitudes pendientes

El número de solicitudes pendientes aparece como badge en el ítem de Mensajes del menú y en el KPI del Overview.

### Resolver una solicitud

1. Haz clic en la solicitud.
2. Lee el detalle.
3. Haz clic en **Marcar como resuelta**.
4. El huésped puede ver en su app que su solicitud fue atendida.

### Filtrar por estado

- **Pendientes**: no atendidas aún.
- **Resueltas**: ya gestionadas.
- **Todas**: vista completa.

---

## 18. Log de actividad

Menú lateral → **Log de actividad**

Registro maestro de todos los eventos del sistema. Es la bitácora de auditoría completa.

### Tipos de evento registrados

| Tipo | Descripción |
|---|---|
| `checkin` | Huésped hizo check-in |
| `checkout` | Huésped hizo check-out |
| `device_command` | Comando enviado a un dispositivo (quién, qué, cuándo) |
| `device_command_error` | Error al ejecutar un comando de dispositivo |
| `housekeeping_changed` | Cambio de estado de aseo (quién lo cambió) |
| `service_request` | Solicitud recibida del huésped |
| `request_resolved` | Solicitud marcada como resuelta |
| `scene_off` | Escena apagada |
| `scheduled_command` | Comando programado ejecutado automáticamente |
| `prefs_changed` | Huésped cambió preferencias en la app |

### Filtrar el log

- **Buscar**: texto libre en el detalle del evento.
- **Habitación**: filtrar por habitación específica.
- **Tipo de evento**: seleccionar solo el tipo que te interesa.

### Uso principal del log

- Verificar quién envió un comando a un dispositivo ante una queja.
- Auditar el historial de limpieza de una habitación.
- Revisar la actividad de una habitación ante un incidente con un huésped.

---

## 19. Equipo: usuarios y roles

Menú lateral → **Equipo**

Gestión de todos los usuarios del sistema y los roles de acceso.

### Roles del sistema

Hay dos tipos de roles:

**Roles fijos (no editables):**

| Rol | Acceso |
|---|---|
| **Owner** | Acceso completo a todas las funciones |
| **Recepción** | Reservas, check-in/out, pagos, huéspedes, mensajes, alarmas |

**Roles personalizados:** creados por el owner con permisos específicos (ver sección 21).

### Agregar un miembro del equipo

1. Haz clic en **+ Nuevo miembro**.
2. Ingresa nombre, email y contraseña temporal.
3. Asigna el rol (owner, recepción, o uno de los roles personalizados creados).
4. Guarda.

El nuevo usuario podrá iniciar sesión con el email y contraseña asignados.

### Editar o eliminar un miembro

Haz clic en el miembro → **Editar** para cambiar nombre, contraseña o rol. O **Eliminar** para revocar acceso.

### Crear un rol personalizado

1. En la sección **Roles** → haz clic en **+ Nuevo rol**.
2. Escribe un nombre para el rol (ej. "Recepcionista de fin de semana").
3. **Opcionalmente**, selecciona una **plantilla** para pre-marcar los permisos más comunes:

   | Plantilla | Permisos preconfigurados |
   |---|---|
   | Personal de aseo | Gestionar aseo |
   | Mayordomo / Conserje | Gestionar solicitudes, Controlar dispositivos |
   | Revenue manager | Gestionar tarifas, Ver informes, Gestionar canales |
   | Supervisor / Gerente de turno | Solicitudes, Dispositivos, Reservas, Pagos, Huéspedes, Alarmas |

4. Ajusta los checkboxes según necesites.
5. Guarda.

### Editar un rol personalizado

Haz clic en el rol → **Editar** → modifica los permisos → Guarda. El cambio afecta inmediatamente a todos los usuarios con ese rol.

---

## 20. Configuración

Menú lateral → **Configuración** (ícono de tuerca)

Configuración personal de tu cuenta: idioma del panel, preferencias de notificación, y cambio de contraseña.

---

## 21. Referencia de permisos

Los permisos disponibles para roles personalizados son:

| Permiso | Qué permite |
|---|---|
| **Gestionar aseo** | Ver y cambiar estados de limpieza. Da acceso a la vista Aseo. |
| **Gestionar solicitudes** | Ver y resolver pedidos de huéspedes. |
| **Controlar dispositivos** | Escenas, desbloqueo manual, ocultar dispositivos, programar comandos. |
| **Gestionar reservas** | Crear, editar, cancelar reservas. Check-in/out. Bloqueos de disponibilidad. |
| **Gestionar tarifas** | Precios en la grilla, categorías, reglas de rendimiento. |
| **Gestionar pagos** | Cobros, boletas, facturas, documentos tributarios. |
| **Gestionar huéspedes** | Perfiles, notas y encuestas del CRM. |
| **Ver alarmas** | Ver y reconocer alertas de puerta/ventana abierta. |
| **Gestionar canales de venta** | Configurar Booking.com, Airbnb y otros canales OTA. |
| **Gestionar configuración** | Marca, contacto, facturación, encuesta, directorio de servicios. |
| **Ver informes** | Acceso a los reportes de rendimiento y al log de actividad. |

> Los roles fijos **Owner** y **Recepción** tienen acceso independientemente de estos permisos. Los permisos solo aplican a roles personalizados.

---

## 22. Preguntas frecuentes

**¿Qué pasa si un huésped paga por Webpay pero no aparece la boleta?**  
La boleta debe emitirse manualmente desde el modal de la reserva → sección Pagos → botón Emitir boleta. El pago y la boleta son pasos separados en el sistema.

**¿Puedo tener el mismo usuario en varios hoteles?**  
Sí. Si el sistema gestiona más de un hotel, el superadmin puede asignar acceso por hotel. Contacta al equipo NexoSuite para configurar acceso multi-hotel.

**¿Cómo sé si la sincronización con Booking.com funcionó?**  
Ve a **Canales OTA** → selecciona el canal → pestaña **Log**. Verás cada sincronización con su resultado. Si hay errores repetidos, verifica que las credenciales del canal sigan siendo válidas (las APIs de los canales expiran o cambian con el tiempo).

**¿Qué pasa si importo un CSV con fechas que ya están reservadas?**  
El sistema omite esas filas automáticamente y las lista en el reporte de resultados con el motivo "Habitación no disponible en esas fechas". Las demás filas sin conflicto sí se importan.

**¿Puedo deshacer una importación CSV?**  
No hay un botón de deshacer masivo. Si importaste por error, deberás cancelar cada reserva manualmente desde la lista de Reservas. Por eso se recomienda verificar primero el CSV con pocos registros antes de importar volúmenes grandes.

**¿Con qué frecuencia se actualiza el panel automáticamente?**  
Las solicitudes de huéspedes se actualizan cada 20 segundos. Las habitaciones se actualizan cada 2 minutos. Puedes forzar una actualización inmediata con el botón de actualizar del Overview.

**¿Puedo cambiar el nombre de una habitación?**  
Sí, desde la configuración de la habitación individual. Ten en cuenta que si tienes reservas importadas por CSV que usan el nombre anterior, deberán actualizarse antes de nuevas importaciones.

**¿Qué dispositivos IoT son compatibles?**  
El sistema es compatible con dispositivos del ecosistema **Tuya** (luces, cortinas, TV, termostatos, enchufes inteligentes, sensores de puerta/ventana, sensores de temperatura) y **Aqara**. Consulta al equipo técnico para el inventario de modelos específicos disponibles en Chile.

---

*Manual generado para uso interno — NexoSuite PMS · Junio 2026*
