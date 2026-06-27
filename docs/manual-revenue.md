# Manual de Usuario — Revenue Manager
**NexoSuite PMS · Versión para uso operativo**

---

## ¿Qué es este manual?

Este manual es para el Revenue Manager del hotel. Cubre las cinco vistas a las que tienes acceso: Overview, Tarifas, Motor de Reservas, Canales OTA e Informes.

---

## 1. Inicio de sesión

1. Abre el navegador en tu computador.
2. Ingresa la dirección web del sistema (ej. `hotel.nexosuite.app`).
3. Escribe tu usuario y contraseña.
4. Haz clic en **Ingresar**.

Al entrar verás el menú con tus cinco secciones disponibles.

---

## 2. Vista Overview

Panel de estado general del hotel. Te muestra en tiempo real:
- Habitaciones ocupadas, libres y bloqueadas
- Check-ins y check-outs del día
- Ocupación actual como porcentaje

Úsalo al inicio de cada jornada para tener contexto antes de tomar decisiones de precio.

---

## 3. Vista Tarifas — Grilla de precios

La grilla es la herramienta de ajuste diario. Muestra una tabla donde cada columna es un día y cada fila es una habitación o categoría.

### Editar un precio individual

1. Haz clic en la celda del día y habitación que quieres editar.
2. Escribe el nuevo precio.
3. Confirma con Enter.

### Modo Rango (editar varios días a la vez)

Usa este modo para aplicar un mismo precio a un bloque de fechas:

1. Activa el modo **Rango** (ícono de calendario 📅 en la barra de herramientas).
2. Haz clic en el **primer día** del rango.
3. Haz clic en el **último día** del rango.
4. Ingresa el precio en el campo que aparece.
5. Haz clic en **Aplicar**.

El precio se aplica a todas las celdas del rango seleccionado.

### Jerarquía de precios

Cuando existen precios definidos en distintos niveles, el sistema aplica este orden de prioridad:

```
Override por habitación individual
        ↓ (si no hay override por habitación)
Override por categoría
        ↓ (si no hay override por categoría)
Tarifa de rango (definida en Motor de Reservas)
```

El precio más específico siempre gana.

---

## 4. Motor de Reservas

El Motor tiene tres subsecciones: **Tarifas**, **Tarifas Avanzadas** y **Reglas de Cierre**.

### 4.1 Tarifas (temporadas base)

Aquí defines las tarifas base que aplican por períodos de tiempo. Cada tarifa base incluye:

- **Nombre** (ej. "Temporada Alta Verano 2027")
- **Fechas de vigencia** — fecha de inicio y fin
- **Días de la semana** — puedes aplicar la tarifa solo a ciertos días (ej. precio distinto fines de semana)
- **Ámbito:**
  - Todas las habitaciones
  - Una categoría específica
  - Una habitación específica

#### Crear una nueva temporada

1. Ve a Motor de Reservas → **Tarifas**.
2. Haz clic en **Nueva tarifa**.
3. Completa el nombre, las fechas de vigencia y el precio.
4. Selecciona el ámbito (todas / categoría / habitación específica).
5. Selecciona los días de la semana si aplica (o deja todos marcados).
6. Guarda.

La tarifa entra en vigor automáticamente en las fechas indicadas.

> Para temporada alta, crea la tarifa con al least 30-45 días de anticipación para que los canales OTA puedan sincronizarla antes de que arranque la demanda.

### 4.2 Tarifas Avanzadas

Tarifas derivadas que se calculan a partir de una tarifa base. Dos tipos:

**Descuentos o aumentos porcentuales**
- Ej. "Tarifa No Reembolsable = Tarifa Base − 15%"
- Útil para crear planes de precio distintos sin duplicar toda la configuración.

**Precio por mínimo de noches**
- Ej. "Si la reserva es de 3 noches o más, precio por noche = $X"
- Incentiva estadías más largas en períodos de alta demanda.

Para crear una tarifa avanzada:
1. Ve a Motor de Reservas → **Tarifas Avanzadas**.
2. Haz clic en **Nueva tarifa avanzada**.
3. Selecciona la tarifa base de referencia.
4. Define la regla (porcentaje o mínimo de noches) y el valor.
5. Guarda.

### 4.3 Reglas de Cierre

Permiten bloquear automáticamente la disponibilidad cuando se cumplen ciertas condiciones. Ejemplos de uso:

- Cerrar disponibilidad de habitaciones simples cuando la ocupación supera el 90%
- No aceptar reservas de 1 noche en fines de semana de alta demanda

Para crear una regla:
1. Ve a Motor de Reservas → **Reglas de Cierre**.
2. Haz clic en **Nueva regla**.
3. Define la condición y la acción de cierre.
4. Activa la regla.

---

## 5. Vista Canales OTA

Gestiona la conexión con canales externos (Booking.com, Airbnb, Expedia, etc.).

### Mapeo de habitaciones

Antes de sincronizar, cada habitación del PMS debe estar mapeada a su equivalente en cada canal OTA. Si una habitación no está mapeada, no se publica ni sincroniza.

Para revisar o editar el mapeo:
1. Ve a **Canales OTA**.
2. Selecciona el canal.
3. Revisa que cada habitación del PMS tenga un equivalente asignado en el canal.

### Sincronización manual

En condiciones normales, la sincronización es automática. Si necesitas forzarla:
1. Selecciona el canal.
2. Haz clic en **Sincronizar ahora**.
3. Espera la confirmación de éxito.

### Revisar si la sincronización OTA está funcionando

1. Ve a **Canales OTA**.
2. Selecciona el canal que quieres revisar.
3. Busca el indicador de **última sincronización exitosa** (fecha y hora).
4. Si la última sincronización fue hace más de 2 horas, puede haber un problema.
5. Revisa el **log de errores** de ese canal para identificar la causa.

Errores comunes en el log:
- **Habitación sin mapeo** — falta asignar el equivalente en el canal
- **Credenciales expiradas** — las claves de conexión con el canal deben renovarse
- **Timeout de conexión** — problema temporal de red, vuelve a intentar con sincronización manual

Si el error persiste tras una sincronización manual, contacta al administrador del sistema.

---

## 6. Vista Informes

### Métricas disponibles

| Métrica | Qué mide |
|---------|----------|
| **RevPAR** | Ingreso por habitación disponible (ocupada o no) |
| **ADR** | Tarifa diaria promedio de las habitaciones vendidas |
| **Ocupación** | Porcentaje de habitaciones vendidas sobre el total |
| **ALOS** | Estadía promedio en noches |

También verás:
- Comparación con el período anterior
- Tabla de tendencia semanal

### Cómo interpretar el RevPAR

RevPAR = Ingresos totales ÷ (habitaciones totales × días del período)

Es el indicador más importante porque combina precio y ocupación. Guía para interpretarlo:

| Situación | Qué puede significar |
|-----------|----------------------|
| Sube ocupación, baja ADR | RevPAR puede caer aunque estés lleno. Estás vendiendo barato. |
| Sube ADR, baja ocupación | Posible sobreprecio. Evalúa si la pérdida de ocupación compensa. |
| Suben ambos | Óptimo. Estrategia funcionando. |
| Bajan ambos | Revisar precios y disponibilidad con urgencia. |

El objetivo es maximizar RevPAR, no solo uno de sus componentes.

---

## 7. Cómo ajustar precios para temporada alta

**Recomendación de proceso:**

1. **Anticipa con 30-60 días** — crea la tarifa de temporada alta en el Motor de Reservas antes de que comience.
2. **Define el rango de fechas exacto** de la temporada.
3. **Segmenta por días si es necesario** — los fines de semana suelen justificar precios más altos que los días de semana.
4. **Configura un precio base** en Motor de Reservas → Tarifas.
5. **Ajusta habitaciones o categorías con precio diferente** usando la grilla (override por categoría u habitación).
6. **Crea tarifas avanzadas si ofreces planes** — no reembolsable con descuento, estadía mínima 3 noches con precio especial, etc.
7. **Sincroniza manualmente** con los canales OTA para confirmar que los precios se publicaron correctamente.
8. **Revisa los Informes** una semana después de activar la temporada para ver si la ocupación y el ADR se mueven como esperabas.

---

## 8. Preguntas frecuentes

**¿Qué pasa si cambio un precio en la grilla y también hay una tarifa de temporada activa?**
El override de la grilla tiene mayor prioridad. El precio que pusiste en la grilla se aplica sobre la tarifa de temporada.

**¿Cómo sé si un canal OTA recibió mis nuevos precios?**
Ve a Canales OTA, selecciona el canal y revisa la fecha y hora de la última sincronización exitosa. Si sincronizó después de tu cambio de precio, llegó correctamente.

**¿Puedo ver la ocupación futura en los informes?**
Los informes muestran datos históricos. Para ver disponibilidad futura, usa la grilla de tarifas que también refleja las reservas existentes por día.

**¿Las reglas de cierre afectan reservas ya confirmadas?**
No. Las reglas de cierre solo bloquean nuevas reservas. Las reservas existentes no se cancelan.

---

*Manual de uso interno — NexoSuite PMS*
