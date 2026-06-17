# Prompt 07 — Análisis competitivo multi-experto: NexoSuite PMS vs Little Hotelier vs Cloudbeds

> Este NO es un prompt de implementación — es un prompt de investigación/análisis estratégico.
> No requiere tocar código. El resultado esperado es un informe.

---

## Contexto para quien ejecute este prompt

NexoSuite es una plataforma chilena B2B que une dos módulos:
- **NexoSuite PMS**: reservas, calendario drag&drop, channel manager (en construcción, hoy en modo simulación esperando alta con SiteMinder), facturación electrónica SII (boletas/facturas/notas de crédito vía Tupana), tarifas por habitación/categoría/general, categorías de habitación por número de camas, pagos (Webpay Plus, Mercado Pago, manual), motor de reservas directo embebible.
- **NexoSuite IoT**: control de luces/cortinas/clima desde el celular del huésped vía QR sin app, dashboard de recepción en tiempo real, sistema de solicitudes de servicio (toallas, room service, limpieza, late checkout, reportar problema, otra solicitud).

Roles de usuario: superadmin (Nexo IoT, multi-hotel), owner (dueño de un hotel — ve todo de su hotel + configuración estratégica), recepción (operación diaria, sin acceso a tarifas/canales/reportes financieros).

Se adjuntan capturas de pantalla de **Little Hotelier (by SiteMinder)** mostrando: calendario por tipo de habitación, modal de detalle de reserva con pagos/huéspedes/notas/facturas, listado de reservas con filtros, servicio de limpieza, inventario de tarifas y disponibilidad por tipo de habitación con actualización colectiva, canales conectados (Booking.com, Expedia, Agoda, Hotelbeds, etc.), Channels Plus y Demand Plus (metabuscadores), reglas de rendimiento (cierre automático, límites de disponibilidad), pagos (transacciones, terminal virtual, pagos automáticos, métodos aceptados), informes (actividad diaria, rendimiento de reservas por mercado/canal/tipo de habitación, tarifas de la competencia, paridad de tarifas), planes tarifarios derivados (% o monto fijo desde una tarifa base), motor de reservas directas con códigos promocionales, y la app móvil (dashboard, calendario, reservas, cobro, cierre de habitaciones). También aparecen capturas de un módulo de interacción con huéspedes (tipo GuestJoy) con directorio de servicios, ofertas/upsell, encuestas de satisfacción y centro de mensajes multicanal (WhatsApp/SMS/email).

---

## Tu tarea

Convoca un panel de **5 expertos con perspectivas distintas** y haz que cada uno analice el mismo material desde su ángulo. No mezcles las voces — cada sección del informe debe sonar como ese experto específico, con su vocabulario y prioridades.

### 1. Gerente de hotel boutique chileno (10-60 habitaciones), 15 años de experiencia operativa
Le importa: facilidad de uso para personal con alta rotación, tiempo real de check-in/checkout, qué tan rápido se resuelve un problema de overbooking, si el sistema le ahorra llamadas telefónicas, si el precio es predecible (UF vs USD).

### 2. Revenue manager / especialista en distribución hotelera
Le importa: paridad de tarifas entre canales, reglas de rendimiento (yield management), profundidad de la integración con channel manager, calidad de los reportes de RevPAR/ADR/ocupación, tarifas derivadas y planes tarifarios anidados, rate shopping de competencia.

### 3. Arquitecto de software / evaluador técnico de plataformas SaaS hoteleras
Le importa: calidad de la arquitectura (multi-tenancy, roles, persistencia de datos), superficie de API, capacidad de integración (webhooks, API REST documentada), seguridad (control de acceso, manejo de pagos), deuda técnica visible, escalabilidad.

### 4. Especialista en experiencia del huésped (guest experience / hotel-tech UX)
Le importa: fricción en el flujo del huésped (¿necesita una app?, ¿cuántos clics para pedir algo?), personalización, comunicación durante la estadía, upsell no invasivo, accesibilidad e idiomas.

### 5. Asesor financiero/comercial para PYMEs hoteleras en Chile
Le importa: estructura de precios (mensual vs por habitación vs comisión por reserva), riesgo de tipo de cambio (USD vs UF vs CLP), costo total de propiedad a 12 y 24 meses para un hotel de 30 habitaciones, barreras de entrada/salida (permanencia mínima, portabilidad de datos), cumplimiento normativo chileno (SII, facturación electrónica) — este es el punto donde NexoSuite tiene ventaja estructural y el análisis debe ser honesto sobre si esa ventaja es sostenible o copiable.

---

## Qué debe cubrir cada experto

Para cada una de las 3 plataformas (NexoSuite PMS, Little Hotelier, Cloudbeds), desde su lente:

1. **Lo que observa que funciona bien** (con referencia concreta a una pantalla/feature de las capturas, o a una función conocida de Cloudbeds)
2. **Lo que le preocupa o ve como debilidad**
3. **Una pregunta que le haría al equipo de producto de esa plataforma**

Cloudbeds no tiene capturas adjuntas — investígalo activamente (web pública, documentación, comparativas de terceros, reviews en G2/Capterra) en vez de asumir desde memoria entrenada, ya que las plataformas SaaS cambian de features y precios con frecuencia.

---

## Matriz comparativa obligatoria

Al final del análisis de los 5 expertos, construye una tabla comparativa con estas filas (agrega las que el análisis revele como relevantes):

| Criterio | NexoSuite | Little Hotelier | Cloudbeds |
|---|---|---|---|
| Modelo de precio | | | |
| Moneda / riesgo cambiario | | | |
| Channel manager — canales soportados | | | |
| Facturación electrónica local (SII Chile) | | | |
| Motor de reservas directo | | | |
| Control de habitaciones inteligentes (IoT) | | | |
| App de huésped sin descarga | | | |
| Tarifas derivadas / por categoría | | | |
| Reglas de rendimiento automatizadas | | | |
| Reportes de revenue management | | | |
| Rate shopping de competencia | | | |
| App móvil nativa para el hotelero | | | |
| Roles y permisos granulares | | | |
| Soporte en español / local | | | |
| Tiempo de implementación estimado | | | |

---

## Conclusión obligatoria (no opcional, esta es la parte que más importa)

Cierra el informe con dos listas concretas, no genéricas:

### "Lo que nos distingue hoy" (defendible, no aspiracional)
Cada ítem debe explicar POR QUÉ es difícil de copiar rápido por Little Hotelier o Cloudbeds (ej: requiere presencia local + integración SII + certificación, no es solo una feature de UI).

### "Lo que tenemos que mejorar, priorizado"
Ordenado por impacto en cierre de ventas a corto plazo, no por facilidad técnica. Para cada ítem: qué exactamente vimos en Little Hotelier o sabemos de Cloudbeds que expone la brecha, y una estimación gruesa de esfuerzo (días/semanas) basada en lo que ya existe en el código de NexoSuite.

---

## Formato de entrega

Documento markdown. Las 5 voces de expertos claramente tituladas y diferenciadas. Tabla comparativa en formato tabla markdown. Las dos listas finales con viñetas, máximo 8 ítems cada una.
