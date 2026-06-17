# Auditoría exhaustiva de funciones — Little Hotelier vs NexoSuite

> Extraído función por función de las capturas compartidas (demo `littlehotelier.com/es/lh-demo/` + app móvil + módulo de engagement tipo GuestJoy). Cada ítem está marcado:
> - ✅ **Ya existe** en NexoSuite (equivalente funcional)
> - 🆕 **No existe** — candidato a agregar, con prioridad (Alta/Media/Baja) y esfuerzo estimado relativo al código ya construido

---

## 1. Calendario

| Función observada | Estado NexoSuite | Prioridad |
|---|---|---|
| Vista por rango de días configurable (14 días, etc.) | ✅ FullCalendar resourceTimeline ya soporta esto | — |
| Agrupación de habitaciones por **tipo** (colapsable) | 🆕 Hoy se listan habitaciones sueltas, no agrupadas por categoría en el calendario | **Alta** — ya existe el concepto de categoría, falta agrupar visualmente. Esfuerzo bajo |
| Drag handle para reordenar tipos de habitación | 🆕 | Baja |
| Buscador de reservas/huésped dentro del calendario | 🆕 | Media — esfuerzo bajo (filtrar eventos cargados) |
| Contador "No asignada" (reservas sin habitación fija) | 🆕 No existe el concepto de reserva sin habitación asignada | Baja |
| Botón "Cierre de habitación" directo desde el calendario | ✅ Bloqueos existen (`room_blocks`) pero el acceso es solo vía API, no hay botón en el calendario | Media — UI faltante, backend ya listo |
| Navegación con múltiples saltos («‹ hoy › ») | ✅ FullCalendar lo trae nativo | — |
| Reservas como barras de color por estado, arrastrables | ✅ Ya implementado (Cloudbeds-style) | — |

## 2. Detalle de reserva (modal)

| Función | Estado | Prioridad |
|---|---|---|
| Tabs: Detalles/Huéspedes/Servicios/Extras/**Pagos**/Notas/**Facturas** | ✅ Parcial — cobros sí están integrados (Webpay/MP/manual), pero no como tab separado con historial visual; Facturas no existe (es el prompt 06 SII, sin implementar) | Alta para Facturas |
| Adultos/Niños/Bebés (no solo "huésped") | 🆕 Hoy solo `guest_name`, sin desglose de ocupantes | Media |
| Persona extra (cargo adicional) | 🆕 | Baja |
| Descuento (monto o %) | 🆕 No hay campo de descuento en una reserva | Media |
| **Resumen de pago en vivo**: total habitación + extras − descuento + comisión tarjeta = total, recibido, pendiente | 🆕 Hoy se ve la lista de transacciones pero no un resumen visual de saldo pendiente calculado | **Alta** — esto es lo que más le falta al modal de reserva actual |
| Comisiones por pago con tarjeta (recargo visible) | 🆕 | Baja |
| Origen de la reserva visible (Booking.com, Directo, etc.) | ✅ Campo `source` ya existe en `reservas` | — |
| Datos de documento de identidad / dirección completa | 🆕 | Baja (relevante para facturación SII — sí lo vamos a necesitar ahí) |
| Comentarios del huésped (campo libre) | ✅ Campo `notes` ya existe | — |
| Imprimir / enviar por correo desde el modal | 🆕 | Baja |

## 3. Listado de reservas (vista tabla, no calendario)

| Función | Estado | Prioridad |
|---|---|---|
| Vista de **lista** de todas las reservas (no solo calendario) | 🆕 Hoy solo existe la vista calendario; no hay una tabla filtrable de reservas | **Alta** — útil para recepción que busca una reserva específica sin desplazarse por fechas |
| Filtros: nombre, referencia, N° factura, tipo de fecha, estado, rango, fuente | 🆕 | Media (depende de construir la vista de lista primero) |
| Exportar reservas a CSV | 🆕 | Baja |
| Contador total de resultados | 🆕 | Baja |

## 4. Habitaciones y tarifas (inventario)

| Función | Estado | Prioridad |
|---|---|---|
| Grid tipo habitación × tarifa × fecha con disponibilidad editable inline | 🆕 Hoy las tarifas se gestionan una por una en un modal, no hay grilla editable | Media — alto valor pero esfuerzo medio-alto (UI de grilla) |
| **Actualización colectiva** (cambiar precio de un rango de fechas + días de semana específicos, a múltiples tarifas/categorías a la vez) | 🆕 Hoy hay que crear una tarifa nueva por cada caso | **Alta** — ahorra muchísimo tiempo operativo, ya identificado en el análisis competitivo anterior |
| **Tarifas derivadas** (% o monto fijo desde una tarifa base, propagado a varios tipos de habitación) | 🆕 Las tarifas hoy son independientes; ya prioricé esto antes | Alta |
| Múltiples rangos de fecha en una sola tarifa/regla | 🆕 Hoy una tarifa = un solo rango desde/hasta | Media |
| Indicador de cuántos canales tiene mapeada cada tarifa | ✅ Existe a nivel de canal completo, no por tarifa individual | Baja |

## 5. Distribución / Canales OTA

| Función | Estado | Prioridad |
|---|---|---|
| Lista de canales conectados con estado, días conectado, N° habitaciones mapeadas | ✅ Ya implementado (vista Canales OTA) | — |
| Catálogo de "todos los canales disponibles" (374) para conectar nuevos | 🆕 Hoy solo se puede crear canal de una lista fija de 5 nombres | Baja (depende de SiteMinder real) |
| **Channels Plus** (agregador que cobra solo por reserva completada, sin mensualidad) | 🆕 No aplica hasta tener SiteMinder real conectado | Bloqueado — no es prioridad de código, es de negocio/alta con SiteMinder |
| **Demand Plus** (metabuscadores: Google Hotel Ads, Tripadvisor, Trivago) | 🆕 | Baja — requiere alta con Google Hotel Center, no es solo código |
| **Reglas de rendimiento**: cierre automático por disponibilidad, límite de venta, límite de disponibilidad por cantidad/% | 🆕 Ninguna regla automática existe hoy | **Alta** — ya priorizado en el análisis competitivo, es lo más cercano a "revenue management" que falta |

## 6. Pagos

| Función | Estado | Prioridad |
|---|---|---|
| Transacciones (listado con filtros) | ✅ Vista Pagos ya lo tiene | — |
| Terminal virtual (cobrar manualmente con tarjeta sin reserva asociada) | 🆕 | Baja |
| Pagos automáticos (cobrar X días antes del check-in automáticamente) | 🆕 | Media — valioso para reducir no-shows, pero requiere guardar tarjeta (tokenización) |
| **Solicitudes de pago** (enviar link de cobro al huésped) | ✅ Ya existe vía Mercado Pago + WhatsApp | — |
| Métodos aceptados configurables por tipo de tarjeta con recargo | 🆕 | Baja |
| Facturas (descarga de comprobante) | 🆕 Pendiente de SII (prompt 06) | Alta (es el mismo trabajo de SII) |
| Impuestos configurables | 🆕 | Baja |

## 7. Reservas directas (motor de reservas)

| Función | Estado | Prioridad |
|---|---|---|
| Página pública de reserva con selector de fecha/habitación/huéspedes | ✅ Ya existe (`booking-engine.html`) | — |
| **Códigos promocionales** | 🆕 | Media |
| **Servicios adicionales** vendibles en la reserva (desayuno, transfer, etc.) | 🆕 | Media |
| Tarifas de reserva directa por tipo de habitación, marcadas como "añadida/sin añadir" | 🆕 Hoy toda tarifa creada aplica automáticamente, no hay paso de "publicar" | Baja |
| Creador de páginas web (page builder) | 🆕 | Baja — fuera de alcance, no es core de un PMS |
| Mostrar 2+ opciones de tarifa por habitación al huésped (ej: con/sin desayuno) con "cancele gratis"/"pague después" | 🆕 Hoy se muestra una sola tarifa resuelta por habitación | Media |

## 8. Huéspedes (CRM básico)

| Función | Estado | Prioridad |
|---|---|---|
| Buscador global de huéspedes (nombre/email/teléfono/N° reserva) | 🆕 No existe una vista de huéspedes transversal a reservas | Media |
| Historial de reservas por huésped (huésped recurrente) | 🆕 | Media |
| Exportar base de huéspedes | 🆕 | Baja |

## 9. Informes

| Función | Estado | Prioridad |
|---|---|---|
| Informes de actividad diaria (entradas, salidas, pagos, transacciones, huéspedes) | 🆕 Solo existe el reporte de Pagos; no hay reporte de llegadas/salidas del día | Media |
| **Rendimiento de reservas**: ingresos, ADR, ALOS, tiempo entre reserva y llegada, reservas canceladas, con comparación de período | 🆕 | Media-Alta — son los KPIs que un revenue manager pide primero |
| Desglose por mercado emisor (mapa de países), canal, tipo de habitación, plan tarifario | 🆕 | Baja (depende de tener datos reales de canales primero) |
| Comparación interanual (mismo período año anterior) | 🆕 | Baja |
| **Rate shopping de competencia** | 🆕 | Baja — requiere fuente de datos externa (scraping o servicio pagado), no es solo desarrollo interno |
| **Paridad de tarifas** entre canal directo y OTAs | 🆕 | Bloqueado — depende de tener canales reales conectados |
| Exportar informes a CSV | 🆕 | Baja |

## 10. Housekeeping (servicio de limpieza)

| Función | Estado | Prioridad |
|---|---|---|
| Vista de estado de habitación (ocupada/solo entradas/etc.) por día | 🆕 No existe ningún estado de limpieza hoy | **Alta** — ya priorizado en el análisis competitivo, pedido explícito por el "gerente de hotel" |
| Estado del servicio de limpieza editable por habitación (dropdown) | 🆕 | Alta — mismo punto |
| Notas por habitación para housekeeping | 🆕 | Media |
| Filtro por estado de habitación / estado de limpieza | 🆕 | Baja |
| Imprimir informe de housekeeping | 🆕 | Baja |

## 11. Comunicación y experiencia del huésped (módulo tipo GuestJoy)

| Función | Estado | Prioridad |
|---|---|---|
| **Directorio de servicios del hotel** (desayuno, gimnasio, lavandería, transfer, etc.) navegable por el huésped | 🆕 NexoSuite tiene "solicitar a recepción" pero no un directorio informativo de servicios | Media — complementa bien lo ya construido |
| **Ofertas especiales / upsell** (mejorar habitación, tours, spa, con precio rebajado) | 🆕 | Media — monetización adicional, pero requiere tener un catálogo de productos del hotel |
| **Centro de mensajes unificado** (WhatsApp/SMS/email en una sola bandeja para el staff) | 🆕 Hoy las solicitudes llegan como notificación simple en el panel, no hay conversación bidireccional | Media-Alta — valioso pero requiere integración con WhatsApp Business API (costo/complejidad real) |
| **Formulario de check-in previo** con firma digital y términos y condiciones | 🆕 | Media |
| **Cumplimiento normativo** (envío automático de datos de huésped a la autoridad/policía local) | 🆕 No aplica directo a Chile de la misma forma, pero hay que verificar si existe una obligación similar (registro de extranjeros, etc.) | Baja — investigar primero si aplica en Chile |
| **Encuestas de satisfacción post-estadía** con link a TripAdvisor/Google | 🆕 | Media — fácil de construir sobre el sistema de email que ya falta (ver más abajo) |
| Envío de correos automatizados (bienvenida, pre-llegada, post-estadía) | 🆕 NexoSuite no tiene ningún sistema de email automatizado hoy | Media-Alta — es la base para ofertas, encuestas y confirmaciones; hoy ni siquiera la confirmación de reserva envía email (está marcado COMPLETAR en el código) |
| Panel de control de engagement (KPIs de correos enviados, pedidos, valoraciones, ingresos por upsell) | 🆕 | Baja (depende de construir lo anterior primero) |

## 12. App móvil

| Función | Estado | Prioridad |
|---|---|---|
| App nativa iOS/Android para el hotelero | 🆕 NexoSuite es web responsive, no hay app nativa | Media — una PWA instalable cubriría el 80% del valor con mucho menos esfuerzo que apps nativas |
| Dashboard con llegadas/salidas/cancelaciones/reservas nuevas del día | 🆕 Existe "Vista general" en el panel web, pero no optimizada para uso desde el celular en movimiento | Baja (ya hay algo equivalente, falta optimización móvil) |
| Calendario drag&drop funcional en móvil | ✅ Si se hace responsive, el calendario actual ya es touch-friendly (FullCalendar lo soporta) | — |
| Cobro y registro de pago desde el móvil | ✅ Ya existe en el modal de reserva, funciona en móvil por ser web responsive | — |
| Cierre de habitación con sincronización automática a canales (anti-overbooking) | ✅ El bloqueo ya invalida la caché de disponibilidad; falta solo el botón visible | Media |

---

## Resumen priorizado (para discutir próximos pasos)

### Quick wins (esfuerzo bajo, ya hay backend o estructura de datos lista)
1. Agrupar habitaciones por categoría en el calendario
2. Botón "Cierre de habitación" visible desde el calendario (backend ya existe)
3. Resumen de pago en vivo dentro del modal de reserva (total/recibido/pendiente)
4. Vista de lista de reservas con filtros (complementa el calendario)

### Construir a continuación (alto impacto, esfuerzo medio)
5. Housekeeping básico (estado de limpieza por habitación)
6. Actualización colectiva de tarifas (rango de fechas + días de semana)
7. Tarifas derivadas (% sobre tarifa base, multi-categoría)
8. Reglas de rendimiento simples (cierre automático por disponibilidad)
9. Sistema de email transaccional (confirmación de reserva, base para todo lo demás de comunicación)

### Más adelante / depende de otros hitos
10. Informes de rendimiento (ADR/ALOS/ingresos) — útil pero menos urgente que lo operativo
11. CRM de huéspedes (buscador transversal + historial)
12. Directorio de servicios + ofertas/upsell para el huésped
13. Centro de mensajes unificado — requiere evaluar costo de WhatsApp Business API
14. App móvil — evaluar PWA antes que nativa

### Bloqueado por terceros, no es trabajo de código
- Channels Plus / Demand Plus — depende de SiteMinder real
- Rate shopping de competencia — depende de un proveedor de datos externo
- Paridad de tarifas — depende de tener canales reales conectados
