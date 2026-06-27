# Manual de Usuario — Mayordomo / Conserje
**NexoSuite PMS · Versión para uso operativo**

---

## ¿Qué es este manual?

Este manual es para el mayordomo o conserje del hotel. Cubre las tres vistas a las que tienes acceso y cómo usarlas en tu turno para atender a los huéspedes y gestionar las habitaciones.

---

## 1. Inicio de sesión

1. Abre el navegador en la tablet o computador del hotel.
2. Ingresa la dirección web del sistema (ej. `hotel.nexosuite.app`).
3. Escribe tu usuario y contraseña.
4. Haz clic en **Ingresar**.

Al entrar verás el menú con tres secciones: **Habitaciones**, **Mensajes** y **Overview**.

---

## 2. Las tres vistas disponibles

### Habitaciones
Panel principal. Muestra todas las habitaciones del hotel con su estado actual y acceso a controles de dispositivos IoT.

### Mensajes
Bandeja de solicitudes enviadas por los huéspedes desde la app de la habitación (televisor, tablet o pantalla de bienvenida). Aquí gestionas y resuelves los pedidos.

### Overview
Panel de estado general del hotel: ocupación, estados de habitaciones, resumen operativo. Útil para tener el contexto completo al inicio del turno.

---

## 3. Vista Habitaciones

### Qué muestra cada tarjeta

Cada habitación aparece como una tarjeta con:
- Nombre o número de habitación
- Estado actual (ocupada, libre, en aseo, etc.)
- Huésped activo (si hay alguien hospedado)
- Acceso a controles de dispositivos

### Controlar dispositivos IoT

Desde la tarjeta de cada habitación puedes controlar los dispositivos instalados:

| Dispositivo | Acciones disponibles |
|-------------|---------------------|
| **Luces** | Encender / Apagar / Ajustar intensidad (%) |
| **Cortinas** | Subir / Bajar / Posición intermedia |
| **Temperatura** | Subir o bajar grados del termostato |
| **TV** | Encender / Apagar |

Para controlar un dispositivo:
1. Busca la habitación en el panel.
2. Abre la tarjeta o el panel de dispositivos de esa habitación.
3. Usa los controles correspondientes.
4. El cambio se aplica en tiempo real sobre el dispositivo físico.

> Usa el control de dispositivos cuando un huésped llame a recepción pidiendo ayuda con algo que no puede manejar desde la app de su habitación.

### Ejecutar escenas predefinidas

Las escenas son combinaciones de ajustes de dispositivos que se aplican con un solo toque. Por ejemplo:

- **Bienvenida** — luces encendidas al 80%, cortinas abiertas, temperatura en 21°C, TV apagada
- **Noche** — luces tenues, cortinas cerradas, temperatura confortable
- **No molestar** — ajustes discretos, notificaciones pausadas

Para ejecutar una escena:
1. Abre la tarjeta de la habitación.
2. Busca el selector de escenas.
3. Toca la escena que corresponde.

Solo puedes ejecutar escenas en habitaciones **ocupadas**.

### Programar comandos

Puedes programar que un dispositivo haga algo a una hora específica. Ejemplo: calentar la habitación 30 minutos antes del check-in.

Para programar:
1. Abre la habitación.
2. Selecciona el dispositivo.
3. Elige la opción **Programar**.
4. Ingresa la hora de ejecución y la acción deseada.
5. Confirma.

El sistema ejecutará el comando automáticamente a la hora indicada, aunque tú no estés mirando la pantalla en ese momento.

---

## 4. Vista Mensajes

### Qué es

Los huéspedes pueden enviar solicitudes directamente desde la app de su habitación. Esas solicitudes llegan aquí, a tu bandeja de Mensajes.

### Tipos de solicitudes frecuentes

- Toallas o artículos de habitación
- Room service
- Solicitud de despertador
- Asistencia general
- Late checkout (salida tardía)

### Cómo atender una solicitud

1. Abre la vista **Mensajes**.
2. Verás la lista de solicitudes con la habitación, el tipo y la hora de envío.
3. Lee el detalle de la solicitud.
4. Atiéndela de forma presencial o coordina con quien corresponda.
5. Cuando esté resuelta, toca **Marcar como resuelta**.

La solicitud desaparece de los pendientes y queda en el historial con tu nombre y la hora de resolución.

### Badge de notificación

Cuando llega una solicitud nueva, aparece un badge (círculo con número) sobre el ícono de **Mensajes** en el menú. Revisa inmediatamente cuando lo veas.

> Nunca dejes solicitudes sin atender por más de 10-15 minutos. El sistema registra el tiempo de respuesta.

---

## 5. Flujo de trabajo típico en el turno

### Al iniciar el turno

1. Abre **Overview** para ver el estado general: habitaciones ocupadas, libres, próximos check-ins y check-outs.
2. Abre **Mensajes** y revisa si hay solicitudes pendientes del turno anterior.
3. Atiende cualquier solicitud urgente antes de continuar.

### Durante el turno

- Mantén la vista **Mensajes** activa o revisa el badge frecuentemente.
- Responde solicitudes en el orden en que llegan, priorizando urgencias (asistencia médica, fallas de dispositivos).
- Si un huésped llama directamente a recepción para pedir control de dispositivos, usa el panel de **Habitaciones** para atenderlo de inmediato.

### Antes de cada check-in

1. Abre la vista **Habitaciones**.
2. Busca la habitación que recibirá al huésped.
3. Verifica que el estado sea **Limpia**.
4. Ejecuta la escena **Bienvenida** entre 5 y 10 minutos antes de la llegada.
5. Si necesitas que la habitación esté a una temperatura específica antes, programa el termostato con antelación.

---

## 6. Preguntas frecuentes

**¿Puedo controlar dispositivos en habitaciones vacías?**
Sí. Puedes controlar dispositivos en cualquier habitación. Las escenas predefinidas, sin embargo, están pensadas para habitaciones ocupadas.

**¿Qué hago si un dispositivo no responde al control?**
Primero intenta de nuevo después de 10 segundos. Si sigue sin responder, reporta la falla al técnico o administrador. No intentes apagar y encender el dispositivo físicamente sin autorización.

**¿Puedo ver el historial de solicitudes resueltas?**
Sí, en la vista Mensajes hay una sección de historial donde puedes ver todas las solicitudes anteriores con su estado y tiempo de respuesta.

**¿Qué pasa si la app no carga?**
Recarga la página con F5 o el botón de recarga del navegador. Si persiste, avisa al administrador. Mientras tanto, atiende las solicitudes de forma presencial hasta que se restablezca el sistema.

**¿El sistema me avisa si llega una solicitud cuando no estoy mirando la pantalla?**
El badge en el menú se actualiza automáticamente. Si tienes la pantalla visible, lo verás en el momento. Se recomienda mantener la app abierta durante todo el turno.

---

*Manual de uso interno — NexoSuite PMS*
