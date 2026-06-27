# Manual de Recepción — NexoSuite PMS

**Rol:** Recepción  
**Versión:** Junio 2026

---

## Índice

1. [Acceso al panel](#1-acceso-al-panel)
2. [Panel principal (Overview)](#2-panel-principal-overview)
3. [Habitaciones](#3-habitaciones)
4. [Aseo (Housekeeping)](#4-aseo-housekeeping)
5. [Calendario de reservas](#5-calendario-de-reservas)
6. [Reservas](#6-reservas)
7. [Nueva estadía: crear reserva manualmente](#7-nueva-estadía-crear-reserva-manualmente)
8. [Check-in](#8-check-in)
9. [Pre check-in (link QR)](#9-pre-check-in-link-qr)
10. [Check-out](#10-check-out)
11. [Pagos](#11-pagos)
12. [Facturación: boletas y facturas](#12-facturación-boletas-y-facturas)
13. [Importar reservas desde CSV](#13-importar-reservas-desde-csv)
14. [CRM de huéspedes](#14-crm-de-huéspedes)
15. [Mensajes y solicitudes](#15-mensajes-y-solicitudes)
16. [Log de actividad](#16-log-de-actividad)
17. [Configuración personal](#17-configuración-personal)
18. [Flujo del turno de recepción](#18-flujo-del-turno-de-recepción)
19. [Situaciones comunes](#19-situaciones-comunes)
20. [Lo que NO corresponde a este rol](#20-lo-que-no-corresponde-a-este-rol)

---

## 1. Acceso al panel

### Ingresar al sistema

1. Navega a la URL del panel (la dirección que te entregó el hotel).
2. Ingresa tu **correo electrónico** y **contraseña**.
3. Haz clic en **Iniciar sesión**.

Si olvidaste tu contraseña, usa el enlace **¿Olvidaste tu contraseña?** en la pantalla de inicio. El sistema te enviará un correo con instrucciones.

> **Equipo compartido:** Si el computador de recepción es de uso compartido, cierra siempre sesión al finalizar tu turno para proteger la privacidad de los huéspedes.

### Cerrar sesión

Haz clic en el ícono de usuario en la esquina inferior del menú lateral y selecciona **Cerrar sesión**.

---

## 2. Panel principal (Overview)

La primera pantalla que verás al ingresar es el **Overview**, el panel en tiempo real del hotel. Aquí puedes ver de un vistazo el estado de todas las habitaciones.

### Tarjetas KPI (parte superior)

| Indicador | Qué muestra |
|---|---|
| **Ocupadas** | Habitaciones con huésped activo en este momento |
| **Libres** | Habitaciones disponibles para nuevo check-in |
| **Por limpiar** | Habitaciones que aún no tienen estado "Limpia" |
| **Check-ins hoy** | Llegadas confirmadas para hoy |
| **Check-outs hoy** | Salidas que deben procesarse hoy |

### Grilla de habitaciones

Cada habitación aparece como una **tarjeta** con:

- **Número y nombre** de la habitación
- **Estado de ocupación** (libre, ocupada, bloqueada)
- **Estado de aseo** (limpia, sucia, en proceso)
- **Nombre del huésped** si está ocupada
- **Hora de check-out** si aplica

Haz clic en cualquier tarjeta para abrir el detalle de la habitación o la reserva activa.

### Uso recomendado en apertura de turno

Al comenzar tu turno, revisa:

1. Las tarjetas **Check-outs hoy** para saber a quién debes cobrar y dar salida.
2. Las tarjetas **Check-ins hoy** para preparar la bienvenida.
3. Las habitaciones marcadas **Por limpiar** para coordinar con el equipo de aseo.

---

## 3. Habitaciones

En el menú lateral, **Habitaciones** muestra la misma grilla que el Overview pero con opciones de acción directa sobre cada habitación.

### Lo que puedes hacer desde las tarjetas

- **Ver el detalle** de la reserva activa (clic en la tarjeta).
- **Cambiar el estado de aseo** directamente desde la tarjeta (ver sección 4).
- **Crear un bloqueo** sobre una habitación libre (por mantención, reserva directa, etc.).
- **Iniciar check-in** si hay una reserva vigente para hoy.
- **Iniciar check-out** si el huésped debe salir.

### Filtros disponibles

Puedes filtrar la vista por:

- Estado de ocupación (libres / ocupadas / bloqueadas)
- Estado de aseo (limpia / sucia / en proceso)
- Categoría de habitación

> **Nota:** No puedes crear, editar ni eliminar habitaciones o categorías. Esas acciones las realiza el Administrador o el Owner.

---

## 4. Aseo (Housekeeping)

El estado de limpieza de cada habitación se puede cambiar directamente desde la tarjeta, sin necesidad de entrar a ningún submenú.

### Cambiar estado de aseo

1. Ubica la habitación en la grilla (Overview o sección Habitaciones).
2. Haz clic en el **indicador de aseo** de la tarjeta (el ícono o badge de color).
3. Selecciona el nuevo estado:
   - **Limpia** — lista para recibir huéspedes.
   - **Sucia** — requiere limpieza.
   - **En proceso** — el equipo de aseo está trabajando en este momento.

El cambio se guarda de inmediato y es visible para todos los usuarios del sistema.

### Estados de aseo y su significado

| Estado | Color | Cuándo usarlo |
|---|---|---|
| Limpia | Verde | Habitación lista para check-in |
| Sucia | Rojo | Después de un check-out o cuando se requiere limpieza |
| En proceso | Amarillo | Cuando el equipo de aseo ya ingresó a la habitación |

> También puedes acceder a la sección **Aseo** en el menú lateral para ver el listado completo de habitaciones y sus estados de limpieza en formato de tabla.

---

## 5. Calendario de reservas

El **Calendario** muestra todas las reservas en una vista de línea de tiempo, muy útil para ver disponibilidad y detectar bloqueos.

### Navegación

- Usa las **flechas** de los lados para avanzar o retroceder semanas.
- Puedes cambiar entre vista **semanal** y **mensual** con los botones de la parte superior.
- Cada barra de color representa una reserva; al hacer clic aparece un resumen rápido.

### Crear un bloqueo desde el calendario

Si necesitas bloquear una habitación (por mantención, inspección, etc.) sin que aparezca como disponible:

1. Haz clic en el rango de fechas que quieres bloquear sobre la fila de la habitación.
2. Selecciona **Crear bloqueo**.
3. Agrega un motivo (opcional pero recomendado).
4. Confirma.

El bloqueo aparece en el calendario con un color diferente al de las reservas regulares.

> **No confundas** un bloqueo con una reserva: el bloqueo no genera cobro ni ficha de huésped.

---

## 6. Reservas

La sección **Reservas** muestra el listado completo de todas las reservas del hotel, con filtros para encontrar rápidamente lo que necesitas.

### Filtros disponibles

- **Fecha** de entrada o salida
- **Estado** (pendiente, confirmada, en casa, completada, cancelada)
- **Nombre** del huésped
- **Número de habitación**
- **Canal** (directa, OTA, manual)

### Acciones desde el listado

Desde el listado puedes:

- Hacer clic en una reserva para **abrir el modal de detalle**.
- Usar el botón **+ Nueva estadía** para crear una reserva manual.
- Usar el botón **Importar CSV** para cargar reservas en lote.

### Modal de reserva — 3 pestañas

Al abrir cualquier reserva, el modal tiene tres pestañas:

| Pestaña | Contenido |
|---|---|
| **Detalle** | Datos del huésped, habitación, fechas, observaciones |
| **Pagos** | Historial de cobros, estado del pago y botones para cobrar o emitir documentos |
| **Pre check-in** | Estado del formulario QR que el huésped completó desde su celular |

---

## 7. Nueva estadía: crear reserva manualmente

Usa esta función cuando el huésped llega sin reserva previa o cuando quieres registrar una reserva tomada por teléfono o en persona.

### Pasos

1. En la sección **Reservas**, haz clic en **+ Nueva estadía**.
2. Completa los datos del formulario:

   - **Habitación**: selecciona la habitación deseada del desplegable.
   - **Fecha de entrada** y **fecha de salida**: usa el mini-calendario integrado.
   - **Nombre del huésped**, correo electrónico y teléfono.
   - **Número de personas**.
   - **Observaciones** (peticiones especiales, notas internas).

3. El sistema calculará automáticamente el **monto estimado** según la grilla de tarifas configurada.
4. Haz clic en **Crear reserva**.

### Mini-calendario y días sin tarifa

Al seleccionar fechas, el mini-calendario puede mostrar algunos días **bloqueados** o con el tooltip **"Falta definir tarifa"**. Esto significa que el Administrador no ha configurado precio para esas fechas.

> Si el huésped quiere hospedarse en fechas sin tarifa, comunícaselo al Administrador para que configure la tarifa antes de crear la reserva.

### Monto estimado automático

El precio total que ves en el formulario se calcula multiplicando las noches por la tarifa de cada noche según la grilla. No edites este campo manualmente a menos que el Administrador te autorice un precio especial.

---

## 8. Check-in

El check-in registra formalmente la llegada del huésped y activa la habitación.

### Pasos

1. Abre la reserva correspondiente (desde el listado de Reservas o desde la tarjeta en el Overview).
2. Verifica en la pestaña **Detalle** que los datos del huésped sean correctos.
3. Revisa la pestaña **Pre check-in** para confirmar si el huésped ya completó el formulario QR (ver sección 9).
4. Si todo está en orden, haz clic en el botón **Check-in**.
5. Confirma la acción en el diálogo que aparece.

La habitación cambia de estado a **Ocupada** y la reserva pasa a **En casa**.

### Qué hacer después del check-in

- Entrega al huésped el código QR de su habitación (si el hotel usa acceso inteligente).
- Informa los horarios de desayuno, checkout y servicios disponibles.
- Registra cualquier solicitud especial en las **observaciones** de la reserva.

---

## 9. Pre check-in (link QR)

El pre check-in permite al huésped completar sus datos de registro desde su propio celular antes de llegar, ahorrando tiempo en la recepción.

### Enviar el link QR al huésped

1. Abre la reserva en el modal.
2. Ve a la pestaña **Pre check-in**.
3. Copia el **link QR** o descarga el código QR.
4. Envíalo al huésped por WhatsApp, correo o el canal que prefiera.

### Qué completa el huésped en el formulario

- RUT o pasaporte
- Dirección de residencia
- Número de personas que se hospedan
- Firma digital (si está habilitada)

### Revisar si el huésped completó el formulario

1. Abre la reserva.
2. Ve a la pestaña **Pre check-in**.
3. Si el estado muestra **Completado**, los datos ya están listos.
4. Si muestra **Pendiente**, el huésped aún no ha llenado el formulario.

> Si el huésped llegó sin completarlo, puedes pedirle que lo complete en recepción usando el código QR impreso, o bien ingresar los datos manualmente en la pestaña **Detalle** de la reserva.

---

## 10. Check-out

El check-out registra la salida del huésped y libera la habitación.

### Pasos

1. Abre la reserva correspondiente.
2. Revisa en la pestaña **Pagos** que el saldo esté saldado (monto pagado = monto total).
3. Si hay saldo pendiente, cobra primero (ver sección 11).
4. Si corresponde emitir boleta o factura, hazlo en este momento (ver sección 12).
5. Haz clic en **Check-out**.
6. Confirma la acción.

La habitación pasa a estado **Libre** y el estado de aseo se marca automáticamente como **Sucia** para que el equipo de limpieza sepa que debe prepararla.

### Después del check-out

- Despide al huésped con cordialidad.
- Cambia el estado de aseo de **Sucia** a **En proceso** cuando el equipo ingrese a limpiar.
- Cambia a **Limpia** cuando la habitación esté lista.

---

## 11. Pagos

La pestaña **Pagos** dentro del modal de reserva centraliza todos los cobros y el historial de transacciones de esa reserva.

### Ver el estado de pago

Al abrir la pestaña Pagos verás:

- **Monto total** de la reserva.
- **Monto pagado** hasta ahora.
- **Saldo pendiente**.
- **Historial** de transacciones anteriores (fecha, método, monto, estado).

### Métodos de pago disponibles

#### Webpay (pago online del huésped)

1. En la pestaña Pagos, haz clic en **Cobrar con Webpay**.
2. El sistema genera un link de pago seguro.
3. El huésped puede pagar con tarjeta de crédito o débito desde su dispositivo.
4. Una vez aprobado, el pago aparece automáticamente en el historial.

> Útil cuando el huésped tiene tarjeta pero prefiere pagar desde su celular, o para pagos a distancia (antes del check-in).

#### Mercado Pago (link por WhatsApp)

1. En la pestaña Pagos, haz clic en **Generar link Mercado Pago**.
2. Copia el link generado.
3. Envíalo al huésped por WhatsApp u otro canal.
4. El huésped paga con el método que prefiera (tarjeta, transferencia, etc.).
5. El pago se registra automáticamente al confirmarse.

> Ideal para pagos anticipados o cuando el huésped no está presente en recepción.

#### Pago manual (efectivo u otro ya recibido)

Usa este método cuando el huésped ya pagó en efectivo y solo necesitas registrarlo en el sistema.

1. En la pestaña Pagos, haz clic en **Registrar pago manual**.
2. Ingresa el **monto** recibido.
3. Selecciona el **método** (efectivo, transferencia, otro).
4. Agrega una **nota** si es necesario (ej.: "pagó en efectivo antes de check-in").
5. Haz clic en **Guardar**.

> El pago manual no genera cargo electrónico; solo deja registro en el sistema de que el dinero fue recibido.

---

## 12. Facturación: boletas y facturas

La emisión de documentos tributarios se hace **manualmente** desde la pestaña Pagos del modal de reserva. No se emiten de forma automática.

### Emitir una boleta

1. Abre la reserva.
2. Ve a la pestaña **Pagos**.
3. Haz clic en **Emitir boleta**.
4. Verifica el monto y los datos del receptor.
5. Confirma la emisión.

La boleta queda registrada en el historial de pagos y puede descargarse en PDF para entregar al huésped.

### Emitir una factura

1. Abre la reserva.
2. Ve a la pestaña **Pagos**.
3. Haz clic en **Emitir factura**.
4. Ingresa los datos de la empresa receptora:
   - RUT empresa
   - Razón social
   - Giro
   - Dirección
5. Confirma la emisión.

> **Importante:** Para emitir facturas, el hotel debe tener configurada su integración con el SII. Si el botón no aparece o hay un error, contacta al Administrador.

### Cuándo emitir el documento

- Lo más habitual es emitir la boleta o factura durante el **check-out**.
- También puedes emitirla en cualquier momento anterior si el huésped lo solicita.
- Si el huésped pide factura, confirma los datos de la empresa **antes** de emitir; una factura emitida con datos incorrectos solo puede ser corregida por el Administrador.

---

## 13. Importar reservas desde CSV

Esta función permite cargar múltiples reservas a la vez desde un archivo Excel o CSV. Útil para traspasar reservas de otra plataforma o cargar bloqueos masivos.

### Pasos

1. En la sección **Reservas**, haz clic en **Importar CSV**.
2. Descarga la **plantilla de ejemplo** para ver el formato requerido.
3. Completa la plantilla con las reservas (una fila por reserva).
4. Sube el archivo desde el botón **Seleccionar archivo**.
5. Revisa la **previsualización** que muestra el sistema antes de importar.
6. Si todo está correcto, confirma con **Importar**.

### Columnas requeridas en el CSV

| Columna | Descripción |
|---|---|
| habitacion | Número o nombre de la habitación |
| nombre_huesped | Nombre completo |
| email | Correo del huésped (puede dejarse vacío) |
| fecha_entrada | Formato AAAA-MM-DD |
| fecha_salida | Formato AAAA-MM-DD |
| monto | Monto total de la reserva |
| notas | Campo libre (opcional) |

> Si hay filas con errores, el sistema te mostrará cuáles son antes de importar. Corrige el CSV y vuelve a subirlo.

---

## 14. CRM de huéspedes

La sección **Huéspedes** guarda el historial de todos los huéspedes que han pasado por el hotel, con sus reservas y notas.

### Buscar un huésped

1. Ve a **Huéspedes** en el menú lateral.
2. Usa el buscador por nombre, RUT o correo electrónico.
3. Haz clic en el resultado para abrir el perfil.

### Ver perfil del huésped

El perfil muestra:

- Datos de contacto (nombre, correo, teléfono, RUT)
- **Historial de estadías** (fechas, habitación, monto)
- **Notas** guardadas por el equipo

### Agregar una nota

1. Abre el perfil del huésped.
2. Haz clic en **Agregar nota**.
3. Escribe la nota (preferencias, alergias, situaciones especiales, etc.).
4. Guarda.

Las notas son visibles para todos los usuarios del sistema, así que toda la información relevante queda disponible para los próximos turnos.

> **Buena práctica:** Si un huésped tiene preferencias especiales (almohada extra, piso alto, alérgico a mascotas), agrégalas como nota para que el equipo esté preparado en futuras visitas.

---

## 15. Mensajes y solicitudes

La sección **Mensajes** centraliza las solicitudes que los huéspedes envían desde la app del hotel o desde su habitación.

### Ver solicitudes

1. Ve a **Mensajes** en el menú lateral.
2. Las solicitudes aparecen listadas con:
   - Habitación de origen
   - Nombre del huésped
   - Tipo de solicitud (servicio a la habitación, mantención, consulta, etc.)
   - Hora de llegada
   - Estado (pendiente / en proceso / resuelta)

### Gestionar una solicitud

1. Haz clic en la solicitud para abrirla.
2. Lee el mensaje del huésped.
3. Responde si es necesario o coordina internamente.
4. Cambia el estado a **En proceso** cuando estés atendiendo.
5. Cambia a **Resuelta** cuando se haya completado.

> Mantén las solicitudes resueltas al día. Un huésped sin respuesta genera mala experiencia y puede reflejarse en las reseñas.

---

## 16. Log de actividad

El **Log de actividad** registra todas las acciones realizadas en el sistema por los distintos usuarios: check-ins, check-outs, cambios de estado, pagos registrados, etc.

> **Acceso condicional:** Esta sección solo es visible si el Owner o Administrador te asignó el permiso `informes.ver`. Si no ves esta opción en el menú, es porque ese permiso no está habilitado para tu usuario.

### Cómo usar el log

1. Ve a **Log de actividad** en el menú lateral.
2. Filtra por **fecha**, **usuario** o **tipo de acción**.
3. Usa el log para verificar si una acción fue realizada correctamente o para rastrear cambios.

---

## 17. Configuración personal

Puedes ajustar tus preferencias personales sin necesidad de permisos especiales.

### Cambiar idioma del panel

1. Ve a **Configuración** en el menú lateral.
2. En la sección **Preferencias**, selecciona el idioma deseado.
3. Guarda los cambios. El panel se recargará en el nuevo idioma.

### Cambiar tu contraseña

1. Ve a **Configuración** en el menú lateral.
2. En la sección **Seguridad**, haz clic en **Cambiar contraseña**.
3. Ingresa tu contraseña actual.
4. Ingresa y confirma la nueva contraseña.
5. Guarda.

> No puedes editar tu correo electrónico ni cambiar tu rol. Esas acciones las realiza el Administrador.

---

## 18. Flujo del turno de recepción

Esta sección describe el flujo típico de un turno en un hotel boutique. Úsala como guía diaria.

### Apertura de turno

1. Inicia sesión en el sistema.
2. Revisa el **Overview**: ¿cuántas habitaciones ocupadas, cuántos check-outs y check-ins hoy?
3. Identifica las habitaciones con estado **Sucia** que aún no han sido limpiadas.
4. Coordina con el equipo de aseo el orden de prioridades (habitaciones con check-in temprano primero).
5. Revisa los **Mensajes** para ver si quedaron solicitudes pendientes del turno anterior.

### Durante el turno — Check-ins

1. Cuando llega un huésped con reserva:
   - Busca la reserva en el listado o pídele su nombre.
   - Verifica que la habitación esté **Limpia** y disponible.
   - Revisa si el huésped completó el **pre check-in** (pestaña Pre check-in).
   - Realiza el **check-in** desde la reserva.
   - Entrega el código de acceso o llave y la información del hotel.
2. Para huéspedes sin reserva previa:
   - Crea una **Nueva estadía** con los datos del huésped.
   - Cobra el pago correspondiente.
   - Realiza el check-in.

### Durante el turno — Atención general

- Revisa periódicamente la sección **Mensajes** y resuelve solicitudes.
- Registra pagos recibidos en las reservas correspondientes (pestaña Pagos).
- Actualiza el estado de aseo de las habitaciones conforme el equipo va terminando.
- Agrega notas en reservas si ocurre algo relevante (huésped llegó tarde, solicitud especial, etc.).

### Check-outs del día

1. Identifica en el **Overview** qué habitaciones tienen check-out hoy.
2. Para cada check-out:
   - Abre la reserva y verifica que el saldo esté pagado.
   - Si hay saldo pendiente, cobra antes de procesar la salida.
   - Emite boleta o factura si el huésped la solicita.
   - Haz clic en **Check-out**.
3. Marca la habitación como **Sucia** para que el equipo de aseo la atienda.

### Cierre de turno

1. Verifica que todas las solicitudes de Mensajes estén resueltas o en proceso con nota del estado.
2. Agrega una **nota en las reservas activas** que necesiten seguimiento (ej.: "huésped solicitó desayuno en habitación mañana a las 8:00").
3. Cierra sesión.

---

## 19. Situaciones comunes

### ¿Qué hago si el pago con Webpay fue rechazado?

El huésped puede intentarlo nuevamente desde el mismo link (mientras esté vigente) o puedes generar un nuevo cobro. También puedes ofrecer el link de **Mercado Pago** como alternativa, o recibir el pago en efectivo y registrarlo como pago manual. Verifica con el huésped que su tarjeta tenga fondos o que no esté bloqueada para compras online.

### ¿Qué hago si el huésped no completó el pre check-in?

Tienes dos opciones:
- Pedirle que escanee el código QR en recepción y complete el formulario desde su celular ahí mismo.
- Ingresar los datos manualmente en la pestaña **Detalle** de la reserva mientras el huésped te dicta la información.

El pre check-in no es obligatorio para procesar el check-in, pero sí es recomendado para tener los datos de registro completos.

### ¿Qué hago si el huésped llega y su habitación no está lista (sucia)?

1. Informa al huésped que la habitación está en preparación y ofrécele esperar en un área cómoda.
2. Avisa al equipo de aseo que esa habitación es prioridad.
3. Registra el check-in de todas formas si ya es la hora de entrada, para que la reserva quede activa en el sistema.
4. Cuando la habitación esté lista, actualiza el estado a **Limpia** y acompaña al huésped.

### ¿Qué hago si el huésped pide factura pero ya emití la boleta?

Una vez emitida una boleta, no puedes anularla desde tu rol. Contacta al **Administrador** para que gestione la anulación ante el SII y emita la factura correspondiente. Evita esta situación preguntando siempre antes del checkout si el huésped necesita factura.

### ¿Qué hago si una fecha del calendario está bloqueada para nueva estadía?

Si el mini-calendario muestra un día bloqueado con el mensaje **"Falta definir tarifa"**, significa que el Administrador no ha configurado precio para esas fechas. Debes comunicárselo para que configure la tarifa. No puedes crear la reserva para esas fechas hasta que la tarifa esté configurada.

### ¿Qué hago si hay una reserva duplicada?

Verifica en el listado de Reservas que efectivamente sean duplicados (mismo huésped, mismas fechas, misma habitación). Agrega una nota en ambas reservas indicando que son duplicadas y avisa al Administrador para que elimine la que corresponda. No canceles reservas sin autorización.

### ¿Qué hago si el link de Mercado Pago expiró antes de que el huésped pagara?

Genera un nuevo link desde la pestaña **Pagos** de la reserva. Los links tienen un tiempo de expiración determinado por la configuración del hotel. Puedes generar el link cuantas veces sea necesario.

### ¿Qué hago si el huésped pide un comprobante de pago pero no quiere boleta?

Desde la pestaña **Pagos**, puedes descargar o imprimir el **historial de pagos** de la reserva como comprobante interno. Si el huésped necesita un documento tributario, deberás emitir boleta o factura.

### ¿Qué hago si me equivoqué en el monto al registrar un pago manual?

Contacta al **Administrador** para que corrija o anule el pago en el sistema. No intentes compensar el error con otro pago manual.

### ¿Qué hago si el sistema no me deja hacer check-out porque hay saldo pendiente?

El sistema puede bloquear el check-out cuando hay pagos sin saldar. Verifica en la pestaña **Pagos** el saldo exacto y cóbralo antes de proceder. Si hay un error en el monto total (distinto a lo que se acordó con el huésped), avisa al Administrador.

---

## 20. Lo que NO corresponde a este rol

Para mantener el orden y la integridad del sistema, hay funciones que están fuera del alcance del rol de Recepción:

| Acción | Quién la realiza |
|---|---|
| Crear, editar o eliminar habitaciones | Administrador / Owner |
| Crear o editar categorías de habitación | Administrador / Owner |
| Configurar tarifas o grilla de precios | Administrador / Revenue Manager |
| Ver informes de rendimiento (RevPAR, ADR, etc.) | Administrador / Revenue Manager / Owner |
| Configurar canales OTA | Administrador / Owner |
| Configurar el motor de reservas directas | Administrador / Owner |
| Ver la facturación general del hotel | Administrador / Owner |
| Crear, editar o eliminar usuarios del equipo | Administrador / Owner |
| Asignar o cambiar roles a otros usuarios | Administrador / Owner |
| Anular boletas o facturas emitidas | Administrador / Owner |

Si necesitas que se realice alguna de estas acciones, comunícate con tu Administrador o con el Owner del hotel.

---

*Manual de uso — NexoSuite PMS · Rol Recepción · Versión Junio 2026*  
*Para soporte técnico, contacta al equipo NexoSuite.*
