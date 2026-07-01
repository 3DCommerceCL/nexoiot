'use strict';
// ─────────────────────────────────────────────────────────────────────────────
// Nexo IoT — Guest Room App · Frontend
// Flujo: URL /room/:token → GET /api/room/:token → render controls → POST /api/room/:token/command
// ─────────────────────────────────────────────────────────────────────────────

// URL base del backend.
// En local (file:// o localhost:3000): usa '/api' (mismo origen).
// En GitHub Pages: pon la URL completa del backend en window.NEXO_API_URL dentro de index.html.
const API = ((window.NEXO_API_URL || '').replace(/\/$/, '') || '') + '/api';

// ── DATOS MOCK para modo estático (sin servidor) ──────────────────────────────
// Se usa cuando el archivo se abre directo desde el disco (file://)
const STATIC_DEMO = {
  roomId:    '101',
  roomName:  'Habitación 101',
  hotelName: 'Hotel Demo Plaza',
  guestName: 'Demo Huésped',
  checkin:   new Date(Date.now() - 1 * 86400000).toISOString(), // ayer
  checkout:  new Date(Date.now() + 2 * 86400000).toISOString(), // en 2 días
  lang:          'es',
  accessibility: 'none',
  demoMode:  true,
  plan:      'max_comfort',
  devices: {
    led_cama: {
      label: 'LED Bajo Cama', type: 'light_rgb', available: false,
      state: null
    },
    luz_techo: {
      label: 'Luz Techo', type: 'light_rgb', available: true,
      state: { on: true, intensity: 80, mode: 'white', colorTemp: 70, hue: 0, saturation: 1000 }
    },
    luz_velador1: {
      label: 'Luz Velador 1', type: 'light_rgb', available: true,
      state: { on: false, intensity: 70, mode: 'white', colorTemp: 30, hue: 0, saturation: 1000 }
    },
    luz_velador2: {
      label: 'Luz Velador 2', type: 'light_rgb', available: true,
      state: { on: false, intensity: 50, mode: 'white', colorTemp: 50, hue: 270, saturation: 1000 }
    },
    cortina: {
      label: 'Cortina', type: 'curtain', available: true,
      state: { control: 'stop', position: 45 }
    },
    enchufe: {
      label: 'Enchufe inteligente', type: 'switch_3ch', available: true,
      channels: ['🔥 Estufa', '🌸 Aromatizador'],
      state: { ch1: false, ch2: false }
    },
  },
};

// ── ESTADO GLOBAL ─────────────────────────────────────────────────────────────
const app = {
  token:   null,
  config:  {},   // { key: { type, label, channels, available } }
  devices: {},   // { key: estado normalizado del dispositivo }
  plan:    'base', // 'base' | 'premium' | 'max_comfort'
  lang:    'es',   // idioma del huésped: 'es' | 'en' | 'pt'
  a11y:    'none', // accesibilidad: 'none' | 'vision' | 'hearing'
  theme:   'auto', // tema: 'auto' | 'light' | 'dark'
  dnd:     false,  // No molestar
  alarmSensors: {}, // { deviceKey: bool } — alarma armada por sensor (puerta/ventana)
  favorites: [],  // claves de dispositivos marcados como favoritos (accesos directos)
  scenes:  {},    // escenas personalizadas/sobrescritas por el huésped (desde la API)
  data:    null,   // respuesta completa de la API (para re-render al cambiar idioma)
  _timers: {},   // debounce timers para sliders
  _wheelOpen: {}, // { key: bool } — selector de color RGB abierto/cerrado
  _placeholder: {}, // estado local de funciones del plan (no conectadas a dispositivos reales)
  _manual: {},   // { key: bool } — modo manual (control físico) para luces/enchufes
  _unlocked: {}, // { key: bool } — motor de cortina desbloqueado para mover a mano
  _curtainAnim: {}, // { key: intervalId } — animación en curso de la barra de posición
};

// ── IDIOMAS (i18n) ────────────────────────────────────────────────────────────
// LOCALES, PLAN_TIERS y planLevel vienen de shared.js
const LANG_NAMES = { es: 'Español', en: 'English', pt: 'Português' };

const I18N = {
  es: {
    loading: 'Cargando tu habitación…',
    errInvalidTitle: 'Enlace inválido o expirado',
    errInvalidSub: 'Este QR ya no es válido. Solicita un nuevo acceso en recepción.',
    errServerTitle: 'Sin conexión con el servidor',
    errServerSub: 'No se pudo conectar con el sistema. Verifica tu conexión WiFi o comunícate con recepción.',
    navRoom: 'Habitación',
    navSecurity: 'Seguridad',
    navScenes: 'Escenas',
    navClimate: 'Clima',
    navSettings: 'Ajustes',
    navSupport: 'Soporte',
    demoBanner: '🔵 Modo demostración — los cambios no se aplican a dispositivos reales',
    checkoutBtn: '🚪 Check-out',
    hello: 'Hola, {name} 👋',
    welcome: 'Bienvenido',
    checkoutLine: '📅 Check-out: {date} a las {time}',
    sectionControls: 'Controles inteligentes',
    sectionSecurity: 'Seguridad',
    sensorOpen: 'Abierta',
    sensorClosed: 'Cerrada',
    alarmSensorTitle: 'Avisarme si se abre',
    alarmSensorNote: 'Si tienes la app abierta, sonará una alerta apenas se abra este sensor',
    noSecuritySensorsMsg: 'Esta habitación no tiene sensores de puerta o ventana configurados.',
    sectionScenes: 'Escenas',
    sectionSettings: 'Ajustes',
    sectionSupport: 'Soporte',
    sectionServices: 'Servicios',
    dndTitle: 'No molestar',
    dndDesc: 'El personal de limpieza no ingresará a tu habitación mientras esté activo',
    doorAlarmTriggeredTitle: '¡Se abrió: {device}!',
    doorAlarmTriggeredDesc: 'Activaste el aviso para este sensor durante tu estadía.',
    doorAlarmDismissBtn: 'Entendido',
    requestTowels: '🧺 Pedir toallas / amenities',
    requestRoomService: '🍽 Pedir room service',
    requestCleaning: '🧹 Pedir limpieza',
    requestLateCheckout: '🕐 Solicitar late checkout',
    requestMaintenance: '🔧 Reportar un problema',
    requestOther: '💬 Otra solicitud',
    requestNotePrompt: 'Describe brevemente tu solicitud:',
    reportAppProblemBtn: '⚠️ Reportar un problema',
    reportAppProblemTitle: 'Reportar un problema',
    reportAppProblemDesc: 'Cuéntanos qué está fallando — le llega tanto al hotel como al equipo que mantiene esta app.',
    reportAppProblemPlaceholder: 'Describe el problema…',
    reportAppProblemSend: 'Enviar',
    reportAppProblemCancel: 'Cancelar',
    sectionDirectorio: 'Qué ofrece el hotel',
    directorioEmpty: 'Sin servicios publicados todavía.',
    noDevicesMsg: 'Esta habitación no tiene dispositivos inteligentes. Usa Servicios para pedir lo que necesites a recepción.',
    noDevicesBtn: 'Ir a Servicios',
    toastRequestSent: 'Solicitud enviada a recepción',
    toastDndOn: 'No molestar activado',
    toastDndOff: 'No molestar desactivado',
    toastSensorAlarmOn: 'Aviso de sensor activado',
    toastSensorAlarmOff: 'Aviso de sensor desactivado',
    toastAcAutoOff: 'Ventana abierta detectada: el aire acondicionado se apagó automáticamente',
    onbTitle: 'Bienvenido a {hotel}',
    onbGreet: 'Estimado/a {name}, es un placer recibirle. Esperamos que su estadía sea cómoda y memorable. Desde esta app puede controlar su habitación con total comodidad.',
    onbScenes: 'Activa tus aparatos inteligentes desde aquí',
    onbSettings: 'Cambia idioma y accesibilidad desde Ajustes',
    onbSupport: 'Pide servicios o ayuda desde Soporte',
    onbGotIt: 'Comenzar',
    tutChoiceTitle: '¿Sabes usar los controles smart?',
    tutChoiceDesc: 'Podemos guiarte paso a paso para encender una luz y mover la cortina.',
    tutStartBtn: '🎓 Iniciar tutorial',
    tutSkipBtn: 'Sé usar aparatos smart',
    tutExit: 'Salir',
    tutPrev: 'Anterior',
    tutNext: 'Siguiente',
    tutFinish: 'Finalizar',
    tutStepCount: 'Paso {n} de {total}',
    tutLightTitle: 'Encender una luz',
    tutLightDesc: 'Toca este interruptor para encender o apagar la luz. Cuando está encendida, puedes ajustar su intensidad y color.',
    tutCurtainOpenTitle: 'Abrir la cortina',
    tutCurtainOpenDesc: 'Toca este botón para abrir la cortina automáticamente.',
    tutCurtainStopTitle: 'Detener la cortina',
    tutCurtainStopDesc: 'Toca este botón para detener la cortina donde esté, sin que termine de abrirse o cerrarse.',
    tutCurtainCloseTitle: 'Cerrar la cortina',
    tutCurtainCloseDesc: 'Toca este botón para cerrar la cortina. También puedes usar el control deslizante para dejarla a media altura.',
    toastCurtainMaxOpen: 'Abierta al máximo',
    toastCurtainMaxClosed: 'Cerrada al mínimo',
    connOnline: 'En línea',
    connOffline: 'Sin conexión',
    toastOnline: 'Conexión restablecida',
    toastOffline: 'Sin conexión a internet',
    sectionFavorites: 'Accesos rápidos',
    favToggle: 'Marcar como favorito',
    toastFavMax: 'Máximo 3 accesos rápidos. Quita uno para agregar otro.',
    cdLeft: 'Faltan {t}',
    cdOverdue: 'Vencido hace {t}',
    cdNow: 'Venció ahora',
    sceneNightTitle: 'Noche',
    sceneNightDesc: 'Apaga las luces principales y enciende el LED bajo cama',
    sceneMorningTitle: 'Mañana',
    sceneMorningDesc: 'Abre la cortina y enciende las luces en tono cálido',
    sceneRelaxTitle: 'Relax',
    sceneRelaxDesc: 'Ambiente con luces de color suave y cortina a media altura',
    sceneOffTitle: 'Apagar todo',
    sceneOffDesc: 'Apaga todas las luces y enchufes de la habitación',
    sceneCustomDesc: 'Escena personalizada',
    sceneNewBtn: '➕ Crear nueva escena',
    sceneNewTitle: 'Nueva escena',
    sceneNewDesc: 'Se guardará la configuración actual de tu habitación con el nombre e ícono que elijas.',
    sceneNamePlaceholder: 'Nombre de la escena',
    sceneSaveBtn: 'Guardar',
    sceneCancelBtn: 'Cancelar',
    sceneEditTitle: 'Guardar estado actual',
    sceneDeleteTitle: 'Eliminar escena',
    sceneDeleteConfirm: '¿Eliminar la escena "{name}"?',
    sceneResetTitle: 'Restaurar escena original',
    sceneResetConfirm: '¿Restaurar la escena "{name}" a su configuración original?',
    scenesHint: 'Toca una escena para activarla. Usa ✏️ para guardar la configuración actual de tu habitación en esa escena, o ➕ para crear una nueva.',
    scenesConfigLabel: 'Ajusta los controles',
    scenesConfigHintCreate: 'Enciende, apaga o ajusta lo que quieras guardar en la escena nueva. Cuando esté como quieres, toca "Guardar".',
    scenesConfigHintEdit: 'Ajusta los controles como quieras que queden en "{name}" y luego guarda los cambios.',
    scenesConfigSaveCreate: 'Guardar esta configuración',
    scenesConfigSaveEdit: 'Guardar cambios en "{name}"',
    scenesConfigCancel: 'Cancelar',
    sceneHelpTitle: '¿Cómo funcionan las escenas?',
    sceneHelpText: 'Una escena aplica varios ajustes a la vez con un solo toque (por ejemplo, apagar todas las luces y cerrar la cortina para dormir). Tócala para activarla. Usa ✏️ para ajustar lo que guarda, 🕐 para programarla a una hora, o ➕ para crear una nueva.',
    reportSceneProblemPrompt: 'Describe el problema con la escena "{name}":',
    reportSceneProblemNote: 'Problema con la escena "{name}": {note}',
    toastSceneSaved: 'Escena guardada',
    toastSceneSaveFail: 'No se pudo guardar la escena',
    toastSceneDeleted: 'Escena eliminada',
    toastSceneDeleteFail: 'No se pudo eliminar la escena',
    toastSceneNameRequired: 'Escribe un nombre para la escena',
    toastSceneMax: 'Has alcanzado el máximo de escenas personalizadas',
    setHotel: 'Hotel',
    setRoom: 'Habitación',
    setGuest: 'Huésped',
    setCheckin: 'Check-in',
    setCheckout: 'Check-out',
    setMode: 'Modo',
    modeDemo: 'Demostración',
    modeLive: 'En vivo',
    language: 'Idioma',
    accessibility: 'Accesibilidad',
    a11yHearing: 'Auditiva',
    theme: 'Tema',
    themeAuto: 'Automático',
    themeLight: 'Claro',
    themeDark: 'Oscuro',
    a11yVisionNote: 'Texto y controles más grandes, con mayor contraste, para personas con baja visión. El botón de micrófono (esquina inferior derecha) crece y se vuelve la forma principal de controlar la habitación por voz.',
    a11yHearingNote: 'Avisos visuales destacados y de mayor duración en lugar de señales sonoras.',
    supportQuestion: '¿Necesitas ayuda con tu habitación o tienes alguna duda?',
    callReception: '💬 Escribir a recepción (WhatsApp)',
    callReceptionTel: '📞 Prefiero llamar por teléfono',
    callReceptionWaMsg: 'Hola, soy huésped de la habitación {room} en {hotel} y necesito ayuda.',
    callReceptionMsg: 'Para contactar a recepción, marca el interno 0 desde el teléfono de tu habitación o acércate a recepción.',
    callReceptionCitofono: '📞 Usar el citófono',
    callReceptionCitofonoMsg: 'Usa el citófono de tu habitación para comunicarte con recepción.',
    callReceptionBajar: '🚶 Bajar a recepción',
    callReceptionBajarMsg: 'Acércate a recepción, están atentos para ayudarte.',
    callReceptionOtra: '💬 Contactar a recepción',
    checkoutMsg: 'Para el check-out, por favor dirígete a recepción o llama al interno del hotel.',
    manualNote: 'Control manual activado — usa el interruptor físico de la habitación. Desactívalo para volver a controlarlo desde la app.',
    unlockNoteOn: 'Motor desbloqueado — mueve la cortina con la mano. Bloquéalo para volver a controlarla desde la app.',
    toastManualOn: 'Modo manual activado — luz fija en cálido, ahora se enciende/apaga con el interruptor físico',
    toastManualOff: 'Modo manual desactivado — control desde la app restaurado',
    toastUnlockOn: 'Motor desbloqueado — mueve la cortina con la mano',
    toastUnlockOff: 'Motor bloqueado — control desde la app restaurado',
    position: 'Posición',
    color: 'Color',
    curtainOpenBtn: '▲ Abrir',
    curtainStopBtn: '⏹ Parar',
    curtainCloseBtn: '▼ Cerrar',
    offlineDevice: 'Dispositivo no disponible',
    toastCmdFail: 'No se pudo ejecutar. Verifica la conexión.',
    toastScene: 'Escena aplicada',
    toastSceneFail: 'Algunos comandos fallaron',
    toastPreview: 'Vista previa — función no conectada a un dispositivo real',
    reportProblemBtn: 'Reportar un problema con este dispositivo',
    reportTitle: 'Reportar un problema',
    reportIntroDesc: 'Vas a reportar un problema con: {device}. Recepción recibirá tu reporte de inmediato.',
    reportBackBtn: 'Atrás',
    reportContinueBtn: 'Continuar',
    reportSendBtn: 'Enviar',
    reportOptionsTitle: '¿Cuál es el problema?',
    reportNoOptionToast: 'Elige una opción antes de enviar',
    reportOtherTitle: 'Cuéntanos qué pasa',
    reportPickDevice: '¿Qué dispositivo tiene el problema?',
    reportOtherPlaceholder: 'Describe el problema (opcional)',
    reportOptOtra: 'Otra',
    reportOptNoEnciende: 'No enciende',
    reportOptNoApaga: 'No se apaga',
    reportOptNoIntensidad: 'No cambia la intensidad',
    reportOptNoTemperatura: 'No cambia la temperatura de color',
    reportOptNoColores: 'No cambia de colores',
    reportOptNoAbre: 'No abre',
    reportOptNoCierra: 'No cierra',
    reportOptNoPara: 'No se detiene (Parar no funciona)',
    reportOptSeMueveSola: 'Se mueve sola',
    reportOptCanalNoResponde: 'Un canal no responde',
    reportOptNingunCanalResponde: 'Ningún canal responde',
    reportOptNoTemperaturaAC: 'No cambia la temperatura',
    reportOptNoEnfriaCalienta: 'No enfría ni calienta aunque esté encendido',
    themeActivateDark: 'Activar modo oscuro',
    themeDeactivateDark: 'Desactivar modo oscuro',
    scheduleBtn: 'Programar',
    helpBtn: 'Cómo se usa',
    enlargeBtn: 'Agrandar',
    helpCloseBtn: 'Volver',
    helpTextLight: 'Toca el interruptor para encender o apagar la luz. Cuando está encendida, desliza la barra para ajustar la intensidad y elige cálido, neutro o frío para el tono.',
    helpTextLED: 'Toca el interruptor para encender o apagar. Ajusta la intensidad con la barra, o toca "Color" para elegir un color desde la rueda.',
    helpTextCurtain: 'Usa ▲ para abrir, ⏹ para detener en cualquier punto, y ▼ para cerrar. La barra vertical muestra qué tan abierta está.',
    helpTextSwitch: 'Toca el interruptor para encender o apagar.',
    helpTextAC: 'Toca el interruptor para encender o apagar el aire acondicionado. Usa + y − para ajustar la temperatura.',
    helpTextGeneric: 'Toca el interruptor para encender o apagar este control.',
    helpTextTV: 'Toca el interruptor para encender o apagar la TV. Ajusta el volumen con la barra y elige la fuente (cable, streaming o HDMI).',
    helpTextBathroom: 'Toca el interruptor para encender o apagar la luz del baño. Con "Encendido automático" activado, se enciende sola al detectar presencia.',
    helpTextBidet: 'Toca el interruptor para precalentar el asiento del baño japonés antes de levantarte. El resto de las funciones se controla desde el panel del baño.',
    helpTextRug: 'Toca el interruptor para encender la alfombra calefaccionable y elige el nivel de calor.',
    helpTextClimateAuto: 'Si está activado, el aire acondicionado se apaga automáticamente al detectar que la ventana se abrió, para ahorrar energía.',
    heatedSeatOn: 'Asiento calefaccionado — encendido',
    heatedSeatOff: 'Asiento calefaccionado — apagado',
    bidetPanelNote: 'El resto de las funciones (lavado, secado, etc.) se controla desde el panel del baño.',
    scheduleTitle: 'Programar',
    scheduleDesc: 'Elige cuándo se debe encender o apagar: {device}.',
    scheduleDescScene: 'Elige cuándo activar esta escena: {device}.',
    scheduleTurnOn: 'Encender',
    scheduleTurnOff: 'Apagar',
    scheduleSendBtn: 'Programar',
    scheduleFrom: 'Desde',
    scheduleUntil: 'Hasta',
    scheduleAutoOff: 'Apagar/cerrar automáticamente',
    scheduleOnce: 'Solo una vez',
    scheduleWeekly: 'Días de la semana',
    scheduleNoTimeError: 'Elige una hora de inicio.',
    scheduleNoEndTimeError: 'Elige la hora hasta la que debe estar así.',
    scheduleSameTimeError: 'La hora de fin debe ser distinta a la de inicio.',
    scheduleNoDateError: 'Elige una fecha.',
    scheduleNoDaysError: 'Elige al menos un día de la semana.',
    scheduleDay_L: 'L', scheduleDay_M: 'M', scheduleDay_M2: 'M', scheduleDay_J: 'J',
    scheduleDay_V: 'V', scheduleDay_S: 'S', scheduleDay_D: 'D',
    scheduleDayShortL: 'Lun', scheduleDayShortM: 'Mar', scheduleDayShortM2: 'Mié', scheduleDayShortJ: 'Jue',
    scheduleDayShortV: 'Vie', scheduleDayShortS: 'Sáb', scheduleDayShortD: 'Dom',
    scheduleNonePending: 'Sin programaciones pendientes.',
    scheduleCancelBtn: 'Cancelar programación',
    toastScheduleSaved: 'Programado correctamente',
    toastScheduleCancelled: 'Programación cancelada',
    bathAutoNote: ' · Programada para encenderse automáticamente si hay alguien dentro',
    bathManualNote: 'Control manual activado — luz fija en cálido, ahora se enciende/apaga con el interruptor físico del baño.',
    acSection: 'Aire Acondicionado',
    autoSection: 'Automatizaciones',
    doorOpen: '🚪 Puerta abierta',
  },
  en: {
    loading: 'Loading your room…',
    errInvalidTitle: 'Invalid or expired link',
    errInvalidSub: 'This QR code is no longer valid. Please request a new access at the front desk.',
    errServerTitle: 'No connection to the server',
    errServerSub: 'We could not reach the system. Check your WiFi connection or contact the front desk.',
    navRoom: 'Room',
    navSecurity: 'Security',
    navScenes: 'Scenes',
    navClimate: 'Climate',
    navSettings: 'Settings',
    navSupport: 'Support',
    demoBanner: '🔵 Demo mode — changes are not applied to real devices',
    checkoutBtn: '🚪 Check-out',
    hello: 'Hello, {name} 👋',
    welcome: 'Welcome',
    checkoutLine: '📅 Check-out: {date} at {time}',
    sectionControls: 'Smart controls',
    sectionSecurity: 'Security',
    sensorOpen: 'Open',
    sensorClosed: 'Closed',
    alarmSensorTitle: 'Alert me if this opens',
    alarmSensorNote: 'If you have the app open, an alert will sound as soon as this sensor opens',
    noSecuritySensorsMsg: 'This room has no door or window sensors configured.',
    sectionScenes: 'Scenes',
    sectionSettings: 'Settings',
    sectionSupport: 'Support',
    sectionServices: 'Services',
    dndTitle: 'Do Not Disturb',
    dndDesc: 'Housekeeping will not enter your room while this is active',
    doorAlarmTriggeredTitle: '{device} opened!',
    doorAlarmTriggeredDesc: 'You turned on the alert for this sensor during this stay.',
    doorAlarmDismissBtn: 'Got it',
    requestTowels: '🧺 Request towels / amenities',
    requestRoomService: '🍽 Request room service',
    requestCleaning: '🧹 Request housekeeping',
    requestLateCheckout: '🕐 Request late checkout',
    requestMaintenance: '🔧 Report an issue',
    requestOther: '💬 Other request',
    requestNotePrompt: 'Briefly describe your request:',
    reportAppProblemBtn: '⚠️ Report a problem',
    reportAppProblemTitle: 'Report a problem',
    reportAppProblemDesc: "Tell us what's wrong — it reaches both the hotel and the team that maintains this app.",
    reportAppProblemPlaceholder: 'Describe the problem…',
    reportAppProblemSend: 'Send',
    reportAppProblemCancel: 'Cancel',
    sectionDirectorio: 'What the hotel offers',
    directorioEmpty: 'No services published yet.',
    noDevicesMsg: 'This room has no smart devices. Use Services to ask the front desk for anything you need.',
    noDevicesBtn: 'Go to Services',
    toastRequestSent: 'Request sent to the front desk',
    toastDndOn: 'Do Not Disturb on',
    toastDndOff: 'Do Not Disturb off',
    toastSensorAlarmOn: 'Sensor alert turned on',
    toastSensorAlarmOff: 'Sensor alert turned off',
    toastAcAutoOff: 'Open window detected: the AC turned off automatically',
    onbTitle: 'Welcome to {hotel}',
    onbGreet: 'Dear {name}, it\'s a pleasure to have you with us. We hope your stay is comfortable and memorable. From this app you can control your room at your convenience.',
    onbScenes: 'Control your smart devices from here',
    onbSettings: 'Change language and accessibility from Settings',
    onbSupport: 'Request services or help from Support',
    onbGotIt: 'Get started',
    tutChoiceTitle: 'Do you know how to use smart controls?',
    tutChoiceDesc: 'We can walk you through turning on a light and moving the curtain.',
    tutStartBtn: '🎓 Start tutorial',
    tutSkipBtn: 'I know how to use smart devices',
    tutExit: 'Exit',
    tutPrev: 'Back',
    tutNext: 'Next',
    tutFinish: 'Finish',
    tutStepCount: 'Step {n} of {total}',
    tutLightTitle: 'Turn on a light',
    tutLightDesc: 'Tap this switch to turn the light on or off. When it’s on, you can adjust its brightness and color.',
    tutCurtainOpenTitle: 'Open the curtain',
    tutCurtainOpenDesc: 'Tap this button to open the curtain automatically.',
    tutCurtainStopTitle: 'Stop the curtain',
    tutCurtainStopDesc: 'Tap this button to stop the curtain wherever it is, without finishing the open/close move.',
    tutCurtainCloseTitle: 'Close the curtain',
    tutCurtainCloseDesc: 'Tap this button to close the curtain. You can also use the slider to leave it halfway.',
    toastCurtainMaxOpen: 'Already fully open',
    toastCurtainMaxClosed: 'Already fully closed',
    connOnline: 'Online',
    connOffline: 'Offline',
    toastOnline: 'Connection restored',
    toastOffline: 'No internet connection',
    sectionFavorites: 'Quick access',
    favToggle: 'Mark as favorite',
    toastFavMax: 'Maximum of 3 quick shortcuts. Remove one to add another.',
    cdLeft: '{t} left',
    cdOverdue: 'Overdue by {t}',
    cdNow: 'Just expired',
    sceneNightTitle: 'Night',
    sceneNightDesc: 'Turns off the main lights and turns on the under-bed LED',
    sceneMorningTitle: 'Morning',
    sceneMorningDesc: 'Opens the curtain and turns on warm lights',
    sceneRelaxTitle: 'Relax',
    sceneRelaxDesc: 'Soft colored lights with the curtain at half height',
    sceneOffTitle: 'All off',
    sceneOffDesc: 'Turns off every light and outlet in the room',
    sceneCustomDesc: 'Custom scene',
    sceneNewBtn: '➕ Create new scene',
    sceneNewTitle: 'New scene',
    sceneNewDesc: 'The current configuration of your room will be saved with the name and icon you choose.',
    sceneNamePlaceholder: 'Scene name',
    sceneSaveBtn: 'Save',
    sceneCancelBtn: 'Cancel',
    sceneEditTitle: 'Save current state',
    sceneDeleteTitle: 'Delete scene',
    sceneDeleteConfirm: 'Delete the scene "{name}"?',
    sceneResetTitle: 'Reset scene to default',
    sceneResetConfirm: 'Reset the scene "{name}" to its original configuration?',
    scenesHint: 'Tap a scene to activate it. Use ✏️ to save your room\'s current configuration to that scene, or ➕ to create a new one.',
    scenesConfigLabel: 'Adjust the controls',
    scenesConfigHintCreate: 'Turn on, off, or adjust whatever you want saved in the new scene. When it looks right, tap "Save".',
    scenesConfigHintEdit: 'Adjust the controls the way you want them in "{name}", then save the changes.',
    scenesConfigSaveCreate: 'Save this configuration',
    scenesConfigSaveEdit: 'Save changes to "{name}"',
    scenesConfigCancel: 'Cancel',
    sceneHelpTitle: 'How do scenes work?',
    sceneHelpText: 'A scene applies several settings at once with a single tap (for example, turning off all lights and closing the curtain to sleep). Tap it to activate it. Use ✏️ to adjust what it saves, 🕐 to schedule it, or ➕ to create a new one.',
    reportSceneProblemPrompt: 'Describe the problem with the "{name}" scene:',
    reportSceneProblemNote: 'Problem with scene "{name}": {note}',
    toastSceneSaved: 'Scene saved',
    toastSceneSaveFail: 'Could not save the scene',
    toastSceneDeleted: 'Scene deleted',
    toastSceneDeleteFail: 'Could not delete the scene',
    toastSceneNameRequired: 'Enter a name for the scene',
    toastSceneMax: 'You have reached the maximum number of custom scenes',
    setHotel: 'Hotel',
    setRoom: 'Room',
    setGuest: 'Guest',
    setCheckin: 'Check-in',
    setCheckout: 'Check-out',
    setMode: 'Mode',
    modeDemo: 'Demo',
    modeLive: 'Live',
    language: 'Language',
    accessibility: 'Accessibility',
    a11yHearing: 'Hearing',
    theme: 'Theme',
    themeAuto: 'Automatic',
    themeLight: 'Light',
    themeDark: 'Dark',
    a11yVisionNote: 'Larger text and controls with higher contrast for low-vision guests. The microphone button (bottom-right corner) grows and becomes the main way to control the room by voice.',
    a11yHearingNote: 'Prominent, longer-lasting visual alerts instead of sound cues.',
    supportQuestion: 'Need help with your room or have any questions?',
    callReception: '💬 Message the front desk (WhatsApp)',
    callReceptionTel: '📞 I\'d rather call by phone',
    callReceptionWaMsg: 'Hi, I\'m a guest in room {room} at {hotel} and I need help.',
    callReceptionMsg: 'To contact the front desk, dial extension 0 from your room phone or stop by the reception.',
    callReceptionCitofono: '📞 Use the room intercom',
    callReceptionCitofonoMsg: 'Use your room intercom to reach the front desk.',
    callReceptionBajar: '🚶 Stop by the front desk',
    callReceptionBajarMsg: 'Come down to the front desk, we\'re ready to help.',
    callReceptionOtra: '💬 Contact the front desk',
    checkoutMsg: 'For check-out, please go to the front desk or call the hotel extension.',
    manualNote: 'Manual control enabled — use the physical switch in the room. Turn it off to control from the app again.',
    unlockNoteOn: 'Motor unlocked — move the curtain by hand. Lock it to control it from the app again.',
    toastManualOn: 'Manual mode enabled — light set to warm, now controlled by the physical switch',
    toastManualOff: 'Manual mode disabled — app control restored',
    toastUnlockOn: 'Motor unlocked — move the curtain by hand',
    toastUnlockOff: 'Motor locked — app control restored',
    position: 'Position',
    color: 'Color',
    curtainOpenBtn: '▲ Open',
    curtainStopBtn: '⏹ Stop',
    curtainCloseBtn: '▼ Close',
    offlineDevice: 'Device unavailable',
    toastCmdFail: 'Command failed. Check your connection.',
    toastScene: 'Scene applied',
    toastSceneFail: 'Some commands failed',
    toastPreview: 'Preview — feature not connected to a real device',
    voiceListening: 'Listening… tap the microphone again to send',
    voiceProcessing: 'Processing your command…',
    voiceNotUnderstood: 'I didn\'t recognize a command. Try again, for example: open the curtain.',
    toastVoiceUnsupported: 'Voice control isn\'t supported on this browser',
    toastVoiceMicDenied: 'Couldn\'t access the microphone. Check your permissions.',
    reportProblemBtn: 'Report a problem with this device',
    reportTitle: 'Report a problem',
    reportIntroDesc: 'You\'re about to report a problem with: {device}. The front desk will receive your report right away.',
    reportBackBtn: 'Back',
    reportContinueBtn: 'Continue',
    reportSendBtn: 'Send',
    reportOptionsTitle: 'What\'s the problem?',
    reportNoOptionToast: 'Choose an option before sending',
    reportOtherTitle: 'Tell us what\'s happening',
    reportPickDevice: 'Which device has the problem?',
    reportOtherPlaceholder: 'Describe the problem (optional)',
    reportOptOtra: 'Other',
    reportOptNoEnciende: 'Doesn\'t turn on',
    reportOptNoApaga: 'Doesn\'t turn off',
    reportOptNoIntensidad: 'Brightness won\'t change',
    reportOptNoTemperatura: 'Color temperature won\'t change',
    reportOptNoColores: 'Colors won\'t change',
    reportOptNoAbre: 'Won\'t open',
    reportOptNoCierra: 'Won\'t close',
    reportOptNoPara: 'Won\'t stop (Stop doesn\'t work)',
    reportOptSeMueveSola: 'Moves by itself',
    reportOptCanalNoResponde: 'One channel doesn\'t respond',
    reportOptNingunCanalResponde: 'No channel responds',
    reportOptNoTemperaturaAC: 'Temperature won\'t change',
    reportOptNoEnfriaCalienta: 'Doesn\'t cool or heat even though it\'s on',
    themeActivateDark: 'Turn on dark mode',
    themeDeactivateDark: 'Turn off dark mode',
    scheduleBtn: 'Schedule',
    helpBtn: 'How to use',
    enlargeBtn: 'Enlarge',
    helpCloseBtn: 'Back',
    helpTextLight: 'Tap the switch to turn the light on or off. While on, drag the bar to adjust brightness, and pick warm, neutral or cool for the tone.',
    helpTextLED: 'Tap the switch to turn it on or off. Adjust brightness with the bar, or tap "Color" to pick a color from the wheel.',
    helpTextCurtain: 'Use ▲ to open, ⏹ to stop at any point, and ▼ to close. The vertical bar shows how open it is.',
    helpTextSwitch: 'Tap the switch to turn it on or off.',
    helpTextAC: 'Tap the switch to turn the AC on or off. Use + and − to adjust the temperature.',
    helpTextGeneric: 'Tap the switch to turn this control on or off.',
    helpTextTV: 'Tap the switch to turn the TV on or off. Adjust the volume with the bar and pick a source (cable, streaming, or HDMI).',
    helpTextBathroom: 'Tap the switch to turn the bathroom light on or off. With "Auto on" enabled, it turns on by itself when it detects someone.',
    helpTextBidet: 'Tap the switch to pre-heat the bidet seat before getting up. Everything else is controlled from the bathroom panel.',
    helpTextRug: 'Tap the switch to turn on the heated rug and pick the heat level.',
    helpTextClimateAuto: 'When enabled, the AC turns off automatically as soon as the window is detected open, to save energy.',
    heatedSeatOn: 'Heated seat — on',
    heatedSeatOff: 'Heated seat — off',
    bidetPanelNote: 'Everything else (wash, dry, etc.) is controlled from the bathroom panel.',
    scheduleTitle: 'Schedule',
    scheduleDesc: 'Choose when it should turn on or off: {device}.',
    scheduleDescScene: 'Choose when to activate this scene: {device}.',
    scheduleTurnOn: 'Turn on',
    scheduleTurnOff: 'Turn off',
    scheduleSendBtn: 'Schedule',
    scheduleFrom: 'From',
    scheduleUntil: 'Until',
    scheduleAutoOff: 'Turn off/close automatically',
    scheduleOnce: 'Just once',
    scheduleWeekly: 'Days of the week',
    scheduleNoTimeError: 'Pick a start time.',
    scheduleNoEndTimeError: 'Pick the time it should end.',
    scheduleSameTimeError: 'End time must be different from start time.',
    scheduleNoDateError: 'Pick a date.',
    scheduleNoDaysError: 'Pick at least one day of the week.',
    scheduleDay_L: 'M', scheduleDay_M: 'T', scheduleDay_M2: 'W', scheduleDay_J: 'T',
    scheduleDay_V: 'F', scheduleDay_S: 'S', scheduleDay_D: 'S',
    scheduleDayShortL: 'Mon', scheduleDayShortM: 'Tue', scheduleDayShortM2: 'Wed', scheduleDayShortJ: 'Thu',
    scheduleDayShortV: 'Fri', scheduleDayShortS: 'Sat', scheduleDayShortD: 'Sun',
    scheduleNonePending: 'No scheduled commands pending.',
    scheduleCancelBtn: 'Cancel scheduled command',
    toastScheduleSaved: 'Scheduled successfully',
    toastScheduleCancelled: 'Scheduled command cancelled',
    bathAutoNote: ' · Set to turn on automatically when someone is inside',
    bathManualNote: 'Manual control enabled — light set to warm, now controlled by the physical bathroom switch.',
    acSection: 'Air Conditioning',
    autoSection: 'Automations',
    doorOpen: '🚪 Door open',
  },
  pt: {
    loading: 'Carregando seu quarto…',
    errInvalidTitle: 'Link inválido ou expirado',
    errInvalidSub: 'Este QR não é mais válido. Solicite um novo acesso na recepção.',
    errServerTitle: 'Sem conexão com o servidor',
    errServerSub: 'Não foi possível conectar ao sistema. Verifique sua conexão WiFi ou fale com a recepção.',
    navRoom: 'Quarto',
    navSecurity: 'Segurança',
    navScenes: 'Cenas',
    navClimate: 'Clima',
    navSettings: 'Ajustes',
    navSupport: 'Suporte',
    demoBanner: '🔵 Modo demonstração — as mudanças não são aplicadas a dispositivos reais',
    checkoutBtn: '🚪 Check-out',
    hello: 'Olá, {name} 👋',
    welcome: 'Bem-vindo',
    checkoutLine: '📅 Check-out: {date} às {time}',
    sectionControls: 'Controles inteligentes',
    sectionSecurity: 'Segurança',
    sensorOpen: 'Aberta',
    sensorClosed: 'Fechada',
    alarmSensorTitle: 'Avisar se isto abrir',
    alarmSensorNote: 'Se você tiver o app aberto, soará um alerta assim que este sensor abrir',
    noSecuritySensorsMsg: 'Este quarto não tem sensores de porta ou janela configurados.',
    sectionScenes: 'Cenas',
    sectionSettings: 'Ajustes',
    sectionSupport: 'Suporte',
    sectionServices: 'Serviços',
    dndTitle: 'Não perturbe',
    dndDesc: 'A equipe de limpeza não entrará no seu quarto enquanto estiver ativo',
    doorAlarmTriggeredTitle: '{device} abriu!',
    doorAlarmTriggeredDesc: 'Você ativou o aviso para este sensor durante esta estadia.',
    doorAlarmDismissBtn: 'Entendi',
    requestTowels: '🧺 Pedir toalhas / amenities',
    requestRoomService: '🍽 Pedir room service',
    requestCleaning: '🧹 Pedir limpeza',
    requestLateCheckout: '🕐 Solicitar late checkout',
    requestMaintenance: '🔧 Relatar um problema',
    requestOther: '💬 Outra solicitação',
    requestNotePrompt: 'Descreva brevemente sua solicitação:',
    reportAppProblemBtn: '⚠️ Reportar um problema',
    reportAppProblemTitle: 'Reportar um problema',
    reportAppProblemDesc: 'Conte-nos o que está errado — chega tanto ao hotel quanto à equipe que mantém este app.',
    reportAppProblemPlaceholder: 'Descreva o problema…',
    reportAppProblemSend: 'Enviar',
    reportAppProblemCancel: 'Cancelar',
    sectionDirectorio: 'O que o hotel oferece',
    directorioEmpty: 'Nenhum serviço publicado ainda.',
    noDevicesMsg: 'Este quarto não possui dispositivos inteligentes. Use Serviços para pedir o que precisar à recepção.',
    noDevicesBtn: 'Ir para Serviços',
    toastRequestSent: 'Solicitação enviada à recepção',
    toastDndOn: 'Não perturbe ativado',
    toastDndOff: 'Não perturbe desativado',
    toastSensorAlarmOn: 'Aviso de sensor ativado',
    toastSensorAlarmOff: 'Aviso de sensor desativado',
    toastAcAutoOff: 'Janela aberta detectada: o ar-condicionado desligou automaticamente',
    onbTitle: 'Bem-vindo ao {hotel}',
    onbGreet: 'Caro/a {name}, é um prazer recebê-lo/a. Esperamos que sua estadia seja confortável e inesquecível. Por este app você pode controlar seu quarto com toda comodidade.',
    onbScenes: 'Controle seus dispositivos inteligentes a partir daqui',
    onbSettings: 'Altere idioma e acessibilidade em Configurações',
    onbSupport: 'Solicite serviços ou ajuda em Suporte',
    onbGotIt: 'Começar',
    tutChoiceTitle: 'Você sabe usar os controles smart?',
    tutChoiceDesc: 'Podemos te guiar passo a passo para ligar uma luz e mover a cortina.',
    tutStartBtn: '🎓 Iniciar tutorial',
    tutSkipBtn: 'Já sei usar dispositivos smart',
    tutExit: 'Sair',
    tutPrev: 'Anterior',
    tutNext: 'Próximo',
    tutFinish: 'Finalizar',
    tutStepCount: 'Passo {n} de {total}',
    tutLightTitle: 'Ligar uma luz',
    tutLightDesc: 'Toque neste interruptor para ligar ou desligar a luz. Quando estiver ligada, você pode ajustar o brilho e a cor.',
    tutCurtainOpenTitle: 'Abrir a cortina',
    tutCurtainOpenDesc: 'Toque neste botão para abrir a cortina automaticamente.',
    tutCurtainStopTitle: 'Parar a cortina',
    tutCurtainStopDesc: 'Toque neste botão para parar a cortina onde estiver, sem terminar de abrir ou fechar.',
    tutCurtainCloseTitle: 'Fechar a cortina',
    tutCurtainCloseDesc: 'Toque neste botão para fechar a cortina. Você também pode usar o controle deslizante para deixá-la na metade.',
    toastCurtainMaxOpen: 'Já está totalmente aberta',
    toastCurtainMaxClosed: 'Já está totalmente fechada',
    connOnline: 'Online',
    connOffline: 'Sem conexão',
    toastOnline: 'Conexão restabelecida',
    toastOffline: 'Sem conexão com a internet',
    sectionFavorites: 'Acessos rápidos',
    favToggle: 'Marcar como favorito',
    toastFavMax: 'Máximo de 3 acessos rápidos. Remova um para adicionar outro.',
    cdLeft: 'Faltam {t}',
    cdOverdue: 'Vencido há {t}',
    cdNow: 'Venceu agora',
    sceneNightTitle: 'Noite',
    sceneNightDesc: 'Apaga as luzes principais e acende o LED sob a cama',
    sceneMorningTitle: 'Manhã',
    sceneMorningDesc: 'Abre a cortina e acende as luzes em tom quente',
    sceneRelaxTitle: 'Relax',
    sceneRelaxDesc: 'Ambiente com luzes coloridas suaves e cortina a meia altura',
    sceneOffTitle: 'Desligar tudo',
    sceneOffDesc: 'Apaga todas as luzes e tomadas do quarto',
    sceneCustomDesc: 'Cena personalizada',
    sceneNewBtn: '➕ Criar nova cena',
    sceneNewTitle: 'Nova cena',
    sceneNewDesc: 'A configuração atual do seu quarto será salva com o nome e ícone que você escolher.',
    sceneNamePlaceholder: 'Nome da cena',
    sceneSaveBtn: 'Salvar',
    sceneCancelBtn: 'Cancelar',
    sceneEditTitle: 'Salvar estado atual',
    sceneDeleteTitle: 'Excluir cena',
    sceneDeleteConfirm: 'Excluir a cena "{name}"?',
    sceneResetTitle: 'Restaurar cena original',
    sceneResetConfirm: 'Restaurar a cena "{name}" para sua configuração original?',
    scenesHint: 'Toque em uma cena para ativá-la. Use ✏️ para salvar a configuração atual do seu quarto nessa cena, ou ➕ para criar uma nova.',
    scenesConfigLabel: 'Ajuste os controles',
    scenesConfigHintCreate: 'Ligue, desligue ou ajuste o que quiser salvar na cena nova. Quando estiver como quiser, toque em "Salvar".',
    scenesConfigHintEdit: 'Ajuste os controles como quiser que fiquem em "{name}" e depois salve as alterações.',
    scenesConfigSaveCreate: 'Salvar esta configuração',
    scenesConfigSaveEdit: 'Salvar alterações em "{name}"',
    scenesConfigCancel: 'Cancelar',
    sceneHelpTitle: 'Como funcionam as cenas?',
    sceneHelpText: 'Uma cena aplica vários ajustes de uma vez com um único toque (por exemplo, desligar todas as luzes e fechar a cortina para dormir). Toque para ativá-la. Use ✏️ para ajustar o que ela salva, 🕐 para agendá-la, ou ➕ para criar uma nova.',
    reportSceneProblemPrompt: 'Descreva o problema com a cena "{name}":',
    reportSceneProblemNote: 'Problema com a cena "{name}": {note}',
    toastSceneSaved: 'Cena salva',
    toastSceneSaveFail: 'Não foi possível salvar a cena',
    toastSceneDeleted: 'Cena excluída',
    toastSceneDeleteFail: 'Não foi possível excluir a cena',
    toastSceneNameRequired: 'Digite um nome para a cena',
    toastSceneMax: 'Você atingiu o máximo de cenas personalizadas',
    setHotel: 'Hotel',
    setRoom: 'Quarto',
    setGuest: 'Hóspede',
    setCheckin: 'Check-in',
    setCheckout: 'Check-out',
    setMode: 'Modo',
    modeDemo: 'Demonstração',
    modeLive: 'Ao vivo',
    language: 'Idioma',
    accessibility: 'Acessibilidade',
    a11yHearing: 'Auditiva',
    theme: 'Tema',
    themeAuto: 'Automático',
    themeLight: 'Claro',
    themeDark: 'Escuro',
    a11yVisionNote: 'Texto e controles maiores, com mais contraste, para pessoas com baixa visão. O botão de microfone (canto inferior direito) cresce e passa a ser a forma principal de controlar o quarto por voz.',
    a11yHearingNote: 'Avisos visuais destacados e mais duradouros em vez de sinais sonoros.',
    supportQuestion: 'Precisa de ajuda com seu quarto ou tem alguma dúvida?',
    callReception: '💬 Mensagem para a recepção (WhatsApp)',
    callReceptionTel: '📞 Prefiro ligar por telefone',
    callReceptionWaMsg: 'Olá, sou hóspede do quarto {room} no {hotel} e preciso de ajuda.',
    callReceptionMsg: 'Para falar com a recepção, disque o ramal 0 do telefone do quarto ou vá até a recepção.',
    callReceptionCitofono: '📞 Usar o interfone',
    callReceptionCitofonoMsg: 'Use o interfone do seu quarto para falar com a recepção.',
    callReceptionBajar: '🚶 Ir até a recepção',
    callReceptionBajarMsg: 'Vá até a recepção, estamos prontos para ajudar.',
    callReceptionOtra: '💬 Contatar a recepção',
    checkoutMsg: 'Para o check-out, dirija-se à recepção ou ligue para o ramal do hotel.',
    manualNote: 'Controle manual ativado — use o interruptor físico do quarto. Desative para voltar a controlar pelo app.',
    unlockNoteOn: 'Motor destravado — mova a cortina com a mão. Trave para voltar a controlá-la pelo app.',
    toastManualOn: 'Modo manual ativado — luz fixa em tom quente, agora liga/desliga pelo interruptor físico',
    toastManualOff: 'Modo manual desativado — controle pelo app restaurado',
    toastUnlockOn: 'Motor destravado — mova a cortina com a mão',
    toastUnlockOff: 'Motor travado — controle pelo app restaurado',
    position: 'Posição',
    color: 'Cor',
    curtainOpenBtn: '▲ Abrir',
    curtainStopBtn: '⏹ Parar',
    curtainCloseBtn: '▼ Fechar',
    offlineDevice: 'Dispositivo indisponível',
    toastCmdFail: 'Não foi possível executar. Verifique a conexão.',
    toastScene: 'Cena aplicada',
    toastSceneFail: 'Alguns comandos falharam',
    toastPreview: 'Pré-visualização — função não conectada a um dispositivo real',
    voiceListening: 'Ouvindo… toque no microfone novamente para enviar',
    voiceProcessing: 'Processando seu comando…',
    voiceNotUnderstood: 'Não identifiquei um comando. Tente de novo, por exemplo: abra a cortina.',
    toastVoiceUnsupported: 'O controle por voz não é compatível com este navegador',
    toastVoiceMicDenied: 'Não foi possível acessar o microfone. Verifique as permissões.',
    reportProblemBtn: 'Reportar um problema com este dispositivo',
    reportTitle: 'Reportar um problema',
    reportIntroDesc: 'Você vai reportar um problema com: {device}. A recepção receberá seu reporte imediatamente.',
    reportBackBtn: 'Voltar',
    reportContinueBtn: 'Continuar',
    reportSendBtn: 'Enviar',
    reportOptionsTitle: 'Qual é o problema?',
    reportNoOptionToast: 'Escolha uma opção antes de enviar',
    reportOtherTitle: 'Conte o que está acontecendo',
    reportPickDevice: 'Qual dispositivo tem o problema?',
    reportOtherPlaceholder: 'Descreva o problema (opcional)',
    reportOptOtra: 'Outro',
    reportOptNoEnciende: 'Não liga',
    reportOptNoApaga: 'Não desliga',
    reportOptNoIntensidad: 'A intensidade não muda',
    reportOptNoTemperatura: 'A temperatura de cor não muda',
    reportOptNoColores: 'As cores não mudam',
    reportOptNoAbre: 'Não abre',
    reportOptNoCierra: 'Não fecha',
    reportOptNoPara: 'Não para (Parar não funciona)',
    reportOptSeMueveSola: 'Se move sozinha',
    reportOptCanalNoResponde: 'Um canal não responde',
    reportOptNingunCanalResponde: 'Nenhum canal responde',
    reportOptNoTemperaturaAC: 'A temperatura não muda',
    reportOptNoEnfriaCalienta: 'Não esfria nem esquenta mesmo ligado',
    themeActivateDark: 'Ativar modo escuro',
    themeDeactivateDark: 'Desativar modo escuro',
    scheduleBtn: 'Programar',
    helpBtn: 'Como usar',
    enlargeBtn: 'Ampliar',
    helpCloseBtn: 'Voltar',
    helpTextLight: 'Toque no interruptor para ligar ou desligar a luz. Quando ligada, arraste a barra para ajustar a intensidade e escolha quente, neutro ou frio para o tom.',
    helpTextLED: 'Toque no interruptor para ligar ou desligar. Ajuste a intensidade com a barra, ou toque em "Cor" para escolher uma cor na roda.',
    helpTextCurtain: 'Use ▲ para abrir, ⏹ para parar em qualquer ponto, e ▼ para fechar. A barra vertical mostra o quanto está aberta.',
    helpTextSwitch: 'Toque no interruptor para ligar ou desligar.',
    helpTextAC: 'Toque no interruptor para ligar ou desligar o ar-condicionado. Use + e − para ajustar a temperatura.',
    helpTextGeneric: 'Toque no interruptor para ligar ou desligar este controle.',
    helpTextTV: 'Toque no interruptor para ligar ou desligar a TV. Ajuste o volume na barra e escolha a fonte (cabo, streaming ou HDMI).',
    helpTextBathroom: 'Toque no interruptor para ligar ou desligar a luz do banheiro. Com "Ligar automático" ativado, ela liga sozinha ao detectar presença.',
    helpTextBidet: 'Toque no interruptor para pré-aquecer o assento antes de levantar. O resto das funções é controlado pelo painel do banheiro.',
    helpTextRug: 'Toque no interruptor para ligar o tapete aquecido e escolha o nível de calor.',
    helpTextClimateAuto: 'Se ativado, o ar-condicionado desliga automaticamente ao detectar que a janela foi aberta, para economizar energia.',
    heatedSeatOn: 'Assento aquecido — ligado',
    heatedSeatOff: 'Assento aquecido — desligado',
    bidetPanelNote: 'O resto das funções (lavar, secar, etc.) é controlado pelo painel do banheiro.',
    scheduleTitle: 'Programar',
    scheduleDesc: 'Escolha quando deve ligar ou desligar: {device}.',
    scheduleDescScene: 'Escolha quando ativar esta cena: {device}.',
    scheduleTurnOn: 'Ligar',
    scheduleTurnOff: 'Desligar',
    scheduleSendBtn: 'Programar',
    scheduleFrom: 'Das',
    scheduleUntil: 'Até',
    scheduleAutoOff: 'Desligar/fechar automaticamente',
    scheduleOnce: 'Só uma vez',
    scheduleWeekly: 'Dias da semana',
    scheduleNoTimeError: 'Escolha um horário de início.',
    scheduleNoEndTimeError: 'Escolha o horário em que deve terminar.',
    scheduleSameTimeError: 'O horário de término deve ser diferente do de início.',
    scheduleNoDateError: 'Escolha uma data.',
    scheduleNoDaysError: 'Escolha pelo menos um dia da semana.',
    scheduleDay_L: 'S', scheduleDay_M: 'T', scheduleDay_M2: 'Q', scheduleDay_J: 'Q',
    scheduleDay_V: 'S', scheduleDay_S: 'S', scheduleDay_D: 'D',
    scheduleDayShortL: 'Seg', scheduleDayShortM: 'Ter', scheduleDayShortM2: 'Qua', scheduleDayShortJ: 'Qui',
    scheduleDayShortV: 'Sex', scheduleDayShortS: 'Sáb', scheduleDayShortD: 'Dom',
    scheduleNonePending: 'Sem agendamentos pendentes.',
    scheduleCancelBtn: 'Cancelar agendamento',
    toastScheduleSaved: 'Agendado com sucesso',
    toastScheduleCancelled: 'Agendamento cancelado',
    bathAutoNote: ' · Programada para acender automaticamente se houver alguém dentro',
    bathManualNote: 'Controle manual ativado — luz fixa em tom quente, agora liga/desliga pelo interruptor físico do banheiro.',
    acSection: 'Ar-Condicionado',
    autoSection: 'Automações',
    doorOpen: '🚪 Porta aberta',
  },
};

const t        = makeTranslator(I18N, () => app.lang);
const devLabel = makeDevLabel(I18N, () => app.lang);

// ── ESCENAS RÁPIDAS ───────────────────────────────────────────────────────────
const SCENES = {
  night: [
    { dev: 'luz_velador1', cmd: { on: false } },
    { dev: 'luz_velador2', cmd: { on: false } },
    { dev: 'luz_techo',    cmd: { on: false } },
    { dev: 'led_cama',     cmd: { on: true  } },
    { dev: 'cortina',      cmd: { control: 'close' }, optimistic: { position: 0 } },
  ],
  morning: [
    { dev: 'cortina',      cmd: { control: 'open' }, optimistic: { position: 100 } },
    { dev: 'luz_velador1', cmd: { on: true, intensity: 60, colorTemp: 70 } },
    { dev: 'luz_velador2', cmd: { on: true, intensity: 60, colorTemp: 70 } },
    { dev: 'luz_techo',    cmd: { on: true, intensity: 70, colorTemp: 80 } },
  ],
  relax: [
    { dev: 'luz_velador2', cmd: { on: true, hue: 270, saturation: 800 }, optimistic: { on: true, hue: 270, mode: 'colour' } },
    { dev: 'led_cama',     cmd: { on: true } },
    { dev: 'luz_velador1', cmd: { on: true, intensity: 15, colorTemp: 5 } },
    { dev: 'luz_techo',    cmd: { on: false } },
    { dev: 'cortina',      cmd: { position: 50 } },
  ],
  off: [
    { dev: 'luz_velador1', cmd: { on: false } },
    { dev: 'luz_velador2', cmd: { on: false } },
    { dev: 'luz_techo',    cmd: { on: false } },
    { dev: 'led_cama',     cmd: { on: false } },
    { dev: 'enchufe',      cmd: { ch1: false, ch2: false } },
  ],
};

// Metadatos de las escenas por defecto: ícono y textos (vía i18n)
const DEFAULT_SCENES_META = {
  night:   { ico: '🌙', titleKey: 'sceneNightTitle',   descKey: 'sceneNightDesc' },
  morning: { ico: '☀️', titleKey: 'sceneMorningTitle', descKey: 'sceneMorningDesc' },
  relax:   { ico: '🎬', titleKey: 'sceneRelaxTitle',   descKey: 'sceneRelaxDesc' },
  off:     { ico: '⚡', titleKey: 'sceneOffTitle',     descKey: 'sceneOffDesc' },
};
const DEFAULT_SCENE_IDS = Object.keys(DEFAULT_SCENES_META);

// Íconos disponibles para escenas personalizadas
const SCENE_ICON_CHOICES = ['🎬','🌙','☀️','🛋️','🧘','🎉','📖','☕','🍿','💡','🎵','🛏️'];

// Campos relevantes a capturar por tipo de dispositivo al guardar una escena
const SCENE_CAPTURE_FIELDS = {
  light:      ['on', 'intensity', 'colorTemp'],
  light_rgb:  ['on', 'intensity', 'colorTemp', 'hue', 'saturation', 'mode'],
  curtain:    ['position'],
  switch:     ['on'],
  switch_3ch: ['ch1', 'ch2', 'ch3'],
};

// Devuelve los pasos a aplicar para una escena (override del huésped si existe, sino el default)
function getSceneSteps(id) {
  const override = app.scenes[id];
  if (override) return override.steps;
  return SCENES[id] || null;
}

// Lista de escenas a mostrar en la vista, en orden: defaults primero, luego personalizadas
function getSceneList() {
  const list = DEFAULT_SCENE_IDS.map(id => ({
    id,
    icon:  DEFAULT_SCENES_META[id].ico,
    title: t(DEFAULT_SCENES_META[id].titleKey),
    desc:  t(DEFAULT_SCENES_META[id].descKey),
    isCustom: false,
    hasOverride: !!app.scenes[id],
  }));
  Object.entries(app.scenes).forEach(([id, scene]) => {
    if (DEFAULT_SCENE_IDS.includes(id)) return;
    list.push({
      id,
      icon:  scene.icon || '🎬',
      title: scene.name || t('sceneCustomDesc'),
      desc:  t('sceneCustomDesc'),
      isCustom: true,
      hasOverride: true,
    });
  });
  return list;
}

// Captura el estado actual de los dispositivos controlables como pasos de escena
function captureSceneSteps() {
  const steps = [];
  Object.entries(app.config).forEach(([dev, cfg]) => {
    if (!cfg.available) return;
    const fields = SCENE_CAPTURE_FIELDS[cfg.type];
    if (!fields) return;
    const s = app.devices[dev] || {};
    const cmd = {};
    fields.forEach(f => { if (s[f] !== undefined) cmd[f] = s[f]; });
    if (Object.keys(cmd).length) steps.push({ dev, cmd });
  });
  return steps;
}

// ── EXTRAER TOKEN DE LA URL ────────────────────────────────────────────────────
function getToken() {
  const m = window.location.pathname.match(/\/room\/([A-Za-z0-9_-]+)/i);
  if (m) return m[1];
  const p = new URLSearchParams(window.location.search);
  if (p.get('token')) return p.get('token');
  const h = window.location.hash.replace('#', '');
  return h.length >= 6 ? h : null;
}

// ── API CALLS ─────────────────────────────────────────────────────────────────
async function apiGet(token) {
  const res = await fetch(`${API}/room/${token}`);
  if (res.status === 401) throw new Error('TOKEN_INVALID');
  if (!res.ok) throw new Error(`HTTP_${res.status}`);
  return res.json();
}

// ── DIRECTORIO DE SERVICIOS DEL HOTEL ────────────────────────────────────────
async function loadDirectorioServicios() {
  const el = document.getElementById('servicios-directorio');
  if (!el || window.location.protocol === 'file:' || !app.token) return;
  try {
    const res = await fetch(`${API}/room/${app.token}/servicios`);
    if (!res.ok) return;
    const lista = await res.json();
    if (!lista.length) {
      el.innerHTML = `<div class="directorio-desc">${t('directorioEmpty')}</div>`;
      return;
    }
    el.innerHTML = lista.map(s => `
      <div class="directorio-item ${s.tipo === 'upsell' ? 'upsell' : ''}">
        <div>
          <div class="directorio-nombre">${s.tipo === 'upsell' ? '⭐ ' : ''}${s.nombre}</div>
          ${s.descripcion ? `<div class="directorio-desc">${s.descripcion}</div>` : ''}
        </div>
        ${s.precio_clp ? `<div class="directorio-precio">$${s.precio_clp.toLocaleString('es-CL')}</div>` : ''}
      </div>`).join('');
  } catch { /* directorio es informativo — falla en silencio, no bloquea el resto de la app */ }
}

async function apiCommand(device, command) {
  // En modo estático (file://) no hay servidor — simular éxito
  if (window.location.protocol === 'file:') return { success: true };

  const res = await fetch(`${API}/room/${app.token}/command`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ device, command }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'Error desconocido' }));
    throw new Error(body.error || `HTTP_${res.status}`);
  }
  return res.json();
}

// ── ANIMACIÓN DE LA BARRA DE CORTINA ──────────────────────────────────────────
// Las cortinas motorizadas tardan en moverse de verdad; antes la barra saltaba
// de inmediato al extremo. Esto la mueve gradualmente hasta el destino, y si se
// presiona Parar antes de llegar, queda congelada donde iba en ese momento.
const CURTAIN_TRAVEL_MS = 15000; // tiempo estimado para recorrer 0% → 100%

function stopCurtainAnim(key) {
  if (app._curtainAnim[key]) {
    clearInterval(app._curtainAnim[key]);
    delete app._curtainAnim[key];
  }
}

function animateCurtainTo(key, target) {
  stopCurtainAnim(key);
  const from = app.devices[key]?.position ?? 0;
  if (from === target) return;
  const duration = (Math.abs(target - from) / 100) * CURTAIN_TRAVEL_MS;
  const start = Date.now();

  app._curtainAnim[key] = setInterval(() => {
    const progress = Math.min(1, (Date.now() - start) / duration);
    const pos = Math.round(from + (target - from) * progress);
    app.devices[key].position = pos;

    const slider = document.querySelector(`input[data-action="curtain-pos"][data-key="${key}"]`);
    if (slider) slider.value = pos;
    const valEl = document.getElementById(`curtain-val-${key}`);
    if (valEl) valEl.textContent = pos + '%';

    if (progress >= 1) {
      stopCurtainAnim(key);
      updateCard(key); // refresca el texto de estado (Abierta/Cerrada) al llegar
    }
  }, 100);
}

async function curtainControl(key, ctrl) {
  const before = app.devices[key]?.position ?? 0;
  if (ctrl === 'open'  && before === 100) { showToast(t('toastCurtainMaxOpen'), ''); return; }
  if (ctrl === 'close' && before === 0)   { showToast(t('toastCurtainMaxClosed'), ''); return; }
  if (ctrl === 'stop') {
    stopCurtainAnim(key); // congela la posición donde iba la animación
  } else {
    animateCurtainTo(key, ctrl === 'open' ? 100 : 0);
  }
  try {
    await apiCommand(key, { control: ctrl });
  } catch (err) {
    stopCurtainAnim(key);
    app.devices[key].position = before;
    updateCard(key);
    showToast(t('toastCmdFail'), 'error');
    console.error('[CMD]', key, { control: ctrl }, err.message);
  }
}

// ── COMANDO CON OPTIMISTIC UI ─────────────────────────────────────────────────
async function doCmd(deviceKey, command) {
  const prev = { ...app.devices[deviceKey] };
  Object.assign(app.devices[deviceKey], command);
  updateCard(deviceKey);

  try {
    await apiCommand(deviceKey, command);
  } catch (err) {
    app.devices[deviceKey] = prev;
    updateCard(deviceKey);
    showToast(t('toastCmdFail'), 'error');
    console.error('[CMD]', deviceKey, command, err.message);
  }
}

// ── INIT ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  // ── MODO ESTÁTICO: archivo abierto directamente desde el disco ──────────────
  // Para un preview rápido sin servidor. En producción siempre corre con Node.
  if (window.location.protocol === 'file:') {
    renderApp(STATIC_DEMO);
    return;
  }

  // ── MODO NORMAL: con servidor Express ──────────────────────────────────────
  app.token = getToken();

  if (!app.token) {
    showError('invalid');
    return;
  }

  try {
    const data = await apiGet(app.token);
    renderApp(data);
  } catch (err) {
    showError(err.message === 'TOKEN_INVALID' ? 'invalid' : 'server');
  }
});

function renderApp(data) {
  app.data = data;

  // Construir estado — un dispositivo que el hotel ocultó no entra a app.config,
  // así que automáticamente queda afuera de la grilla, de las escenas nuevas,
  // de favoritos, etc. (todo eso ya opera solo sobre las claves de app.config).
  for (const [key, dev] of Object.entries(data.devices)) {
    if (dev.hidden) continue;
    app.config[key]  = { type: dev.type, label: dev.label, channels: dev.channels, available: dev.available, manualUnlock: !!dev.manualUnlock };
    app.devices[key] = dev.state ? { ...dev.state } : {};
  }

  app.plan = data.plan || 'base';
  app.scenes = data.scenes || {};

  // Idioma y accesibilidad del huésped (en modo estático, localStorage manda)
  app.lang = (window.location.protocol === 'file:' && localStorage.getItem('nexo_lang'))
    || data.lang || 'es';
  if (!I18N[app.lang]) app.lang = 'es';
  app.a11y = (window.location.protocol === 'file:' && localStorage.getItem('nexo_a11y'))
    || data.accessibility || 'none';
  app.dnd = data.dnd || false;
  app.alarmSensors = data.alarmSensors || {};

  try {
    app.favorites = JSON.parse(localStorage.getItem(`nexo_favs_${app.token || 'static'}`) || '[]');
  } catch { app.favorites = []; }

  app.theme = localStorage.getItem('nexo_theme') || 'auto';

  document.documentElement.lang = app.lang;
  applyA11y();
  applyTheme();
  setInterval(applyTheme, 10 * 60 * 1000);
  setInterval(refreshRoomState, 20 * 1000);
  applyTexts();

  startClock(new Date(data.checkout));

  // Banner demo
  if (data.demoMode) document.getElementById('demo-banner').style.display = 'block';

  // Grid de dispositivos (incluye funciones del plan y TV) y vista de clima
  renderGrid();
  renderFavorites();
  renderScenes();
  loadDirectorioServicios();
  renderClimateView();
  renderSecurityView();

  // Ocultar la sección "Clima" del menú si el plan de la habitación no la incluye
  if (planLevel(app.plan) < PLAN_TIERS.premium) {
    document.querySelector('.nav-item[data-view="climate"]')?.classList.add('hidden');
  }

  // Sin sensores de puerta/ventana: ocultar Seguridad del menú (no hay nada que armar).
  if (!securityDeviceKeys().length) {
    document.querySelector('.nav-item[data-view="security"]')?.classList.add('hidden');
  }

  // Sin dispositivos inteligentes instalados: ocultar Habitación/Escenas/Clima del menú
  // (no hay nada que controlar) y dejar Soporte como página principal de la app.
  if (!Object.keys(app.config).length) {
    document.querySelector('.nav-item[data-view="room"]')?.classList.add('hidden');
    document.querySelector('.nav-item[data-view="scenes"]')?.classList.add('hidden');
    document.querySelector('.nav-item[data-view="climate"]')?.classList.add('hidden');
    switchView('support');
  }

  // Mostrar app
  document.getElementById('loading-screen').style.display = 'none';
  document.getElementById('app').classList.remove('hidden');

  // Delegación de eventos para la vista de Escenas
  document.getElementById('scenes-grid').addEventListener('click', handleSceneGridClick);
  document.getElementById('scenes-grid').addEventListener('keydown', handleSceneGridKeydown);
  document.getElementById('scene-new-btn').addEventListener('click', () => expandScenesConfig('create'));
  document.getElementById('scene-modal-cancel').addEventListener('click', closeSceneModal);
  document.getElementById('scene-modal-save').addEventListener('click', saveNewScene);
  document.getElementById('scenes-config-save-btn').addEventListener('click', saveScenesConfig);
  document.getElementById('scenes-config-cancel-btn').addEventListener('click', collapseScenesConfig);

  const scenesDeviceGrid = document.getElementById('scenes-device-grid');
  scenesDeviceGrid.addEventListener('click',  handleGridClick);
  scenesDeviceGrid.addEventListener('input',  handleGridInput);
  scenesDeviceGrid.addEventListener('change', handleGridInput);
  scenesDeviceGrid.addEventListener('click',  handlePlanGridClick);
  scenesDeviceGrid.addEventListener('input',  handlePlanGridInput);
  scenesDeviceGrid.addEventListener('change', handlePlanGridInput);

  // Delegación de eventos para los controles del grid
  const grid = document.getElementById('device-grid');
  grid.addEventListener('click',  handleGridClick);
  grid.addEventListener('input',  handleGridInput);
  grid.addEventListener('change', handleGridInput);
  setupColorWheelDrag(grid);
  // La TV vive dentro de Controles inteligentes (no es un dispositivo Tuya
  // real, es un placeholder) — reusa el mismo manejador que las demás
  // funciones del plan, así que también se enlaza acá.
  grid.addEventListener('click',  handlePlanGridClick);
  grid.addEventListener('input',  handlePlanGridInput);
  grid.addEventListener('change', handlePlanGridInput);

  // El control agrandado (modal de accesibilidad) reusa los mismos manejadores
  // — es la misma tarjeta, solo más grande, con la misma data-key/data-action.
  const enlargeBody = document.getElementById('enlarge-modal-body');
  enlargeBody.addEventListener('click',  handleGridClick);
  enlargeBody.addEventListener('input',  handleGridInput);
  enlargeBody.addEventListener('change', handleGridInput);

  // Delegación de eventos para la barra de favoritos
  document.getElementById('favorites-bar')?.addEventListener('click', handleFavBarClick);

  // Delegación de eventos para la vista de Clima (Premium). También necesita
  // handleGridClick (no solo handlePlanGridClick) porque el botón de reportar
  // problema (featureIconsRow) usa data-action="report-problem", manejado ahí
  // — mismo motivo por el que #device-grid ya tiene ambos manejadores.
  const climateContent = document.getElementById('climate-content');
  climateContent.addEventListener('click',  handleGridClick);
  climateContent.addEventListener('click',  handlePlanGridClick);
  climateContent.addEventListener('input',  handlePlanGridInput);
  climateContent.addEventListener('change', handlePlanGridInput);
  setupColorWheelDrag(climateContent);

  // Delegación de eventos para la vista de Seguridad (armar/desarmar alarma)
  document.getElementById('security-content').addEventListener('click', handleGridClick);

  // Navegación (sidebar y vistas)
  initNav();

  // Onboarding: solo la primera vez que se abre el enlace de esta estadía
  if (!localStorage.getItem(`nexo_onboarded_${app.token || 'static'}`)) {
    document.getElementById('onboarding-overlay')?.classList.remove('hidden');
  }
}

// ── TEXTOS LOCALIZADOS (header, sidebar, ajustes y estáticos) ────────────────
function applyTexts() {
  // Elementos estáticos marcados con data-i18n en index.html
  document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => { el.placeholder = t(el.dataset.i18nPlaceholder); });

  const d = app.data;
  if (!d) return;
  const loc = LOCALES[app.lang] || 'es-CL';

  // Onboarding: insertar nombre del hotel y saludo personalizado
  const onbTitleEl = document.getElementById('onb-title');
  const onbGreetEl = document.getElementById('onb-greet');
  const guestFirst = (d.guestName || '').split(' ')[0] || t('welcome');
  if (onbTitleEl) onbTitleEl.textContent = t('onbTitle', { hotel: d.hotelName });
  if (onbGreetEl) onbGreetEl.textContent = t('onbGreet', { name: guestFirst, hotel: d.hotelName });

  document.getElementById('hotel-name').textContent = d.hotelName;
  document.getElementById('room-name').textContent  = d.roomName;
  document.getElementById('guest-name').textContent = d.guestName
    ? t('hello', { name: d.guestName.split(' ')[0] })
    : t('welcome');

  document.getElementById('sidebar-hotel').textContent = d.hotelName;
  document.getElementById('sidebar-room').textContent  = d.roomName;

  const co     = new Date(d.checkout);
  const coDate = co.toLocaleDateString(loc, { weekday: 'long', day: 'numeric', month: 'long' });
  const coTime = co.toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit' });
  document.getElementById('checkout-info').textContent = t('checkoutLine', { date: coDate, time: coTime });

  document.getElementById('set-hotel').textContent    = d.hotelName;
  document.getElementById('set-room').textContent     = d.roomName;
  document.getElementById('set-guest').textContent    = d.guestName;
  document.getElementById('set-checkout').textContent = `${coDate}, ${coTime}`;
  document.getElementById('set-mode').textContent     = d.demoMode ? t('modeDemo') : t('modeLive');
  if (d.checkin) {
    const ci = new Date(d.checkin);
    document.getElementById('set-checkin').textContent =
      `${ci.toLocaleDateString(loc, { weekday: 'long', day: 'numeric', month: 'long' })}, ` +
      `${ci.toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit' })}`;
  }

  // Sensor de puerta en header
  if (d.devices.puerta?.state?.open) {
    const ds = document.getElementById('door-status');
    ds.style.display = 'flex';
    ds.textContent   = t('doorOpen');
  }

  document.getElementById('demo-banner').textContent = t('demoBanner');

  updateConnStatus();

  document.querySelectorAll('[data-action="toggle-dnd"]').forEach(el => el.classList.toggle('on', app.dnd));
  renderHomeServices();
  applyContactMethod();

  renderPrefsRows();
}

// El método para contactar a recepción lo define cada hotel (whatsapp/citófono/
// bajar a recepción/otro) — solo "whatsapp" usa el botón secundario de llamar
// por teléfono, el resto son mensajes informativos sin acción externa.
function applyContactMethod() {
  const btn    = document.getElementById('call-reception-btn');
  const telBtn = document.getElementById('call-reception-tel');
  if (!btn) return;
  const method = app.data?.contactMethod || 'whatsapp';
  telBtn?.classList.toggle('hidden', method !== 'whatsapp');
  if (method === 'whatsapp') {
    btn.textContent = t('callReception');
  } else if (method === 'citofono') {
    btn.textContent = t('callReceptionCitofono');
  } else if (method === 'bajar_recepcion') {
    btn.textContent = t('callReceptionBajar');
  } else {
    btn.textContent = t('callReceptionOtra');
  }
}

// ── SELECTORES DE IDIOMA Y ACCESIBILIDAD (vista Ajustes) ─────────────────────
// Copia de la sección "Servicios" (no molestar, solicitudes) directo en la
// página de Inicio, debajo de los dispositivos — sin el bloque de contactar a
// recepción, que sigue viviendo solo en la pestaña Soporte. Los ids llevan
// sufijo -home y se sincronizan con su par en Soporte vía toggleDnd. La
// alarma de puerta/ventana se mudó completa a la pestaña Seguridad.
function renderHomeServices() {
  const el = document.getElementById('home-services');
  if (!el) return;
  el.innerHTML = `
    <div class="device-card full-width" id="dnd-card-home">
      <div class="card-head">
        <div class="card-ico-name"><span class="card-ico">🔔</span><span class="card-label">${t('dndTitle')}</span></div>
        <div class="toggle ${app.dnd ? 'on' : ''}" id="dnd-toggle-home" data-action="toggle-dnd"></div>
      </div>
      <div class="card-status">${t('dndDesc')}</div>
    </div>
    <div class="support-card" style="padding:24px 32px;gap:10px">
      <button class="support-btn" id="request-towels-btn-home" style="width:100%">${t('requestTowels')}</button>
      <button class="support-btn" id="request-roomservice-btn-home" style="width:100%">${t('requestRoomService')}</button>
      <button class="support-btn" id="request-cleaning-btn-home" style="width:100%">${t('requestCleaning')}</button>
      <button class="support-btn" id="request-late-checkout-btn-home" style="width:100%">${t('requestLateCheckout')}</button>
      <button class="support-btn" id="request-maintenance-btn-home" style="width:100%">${t('requestMaintenance')}</button>
      <button class="support-btn" id="request-other-btn-home" style="width:100%">${t('requestOther')}</button>
    </div>`;

  document.getElementById('dnd-toggle-home').addEventListener('click', toggleDnd);
  document.getElementById('request-towels-btn-home').addEventListener('click', () => sendServiceRequest('towels'));
  document.getElementById('request-roomservice-btn-home').addEventListener('click', () => sendServiceRequest('roomservice'));
  document.getElementById('request-cleaning-btn-home').addEventListener('click', () => sendServiceRequest('cleaning'));
  document.getElementById('request-late-checkout-btn-home').addEventListener('click', () => sendServiceRequest('late_checkout'));
  document.getElementById('request-maintenance-btn-home').addEventListener('click', () => sendServiceRequestWithNote('maintenance'));
  document.getElementById('request-other-btn-home').addEventListener('click', () => sendServiceRequestWithNote('other'));
}

// ── SEGURIDAD (sensores de puerta/ventana) ───────────────────────────────────
function securityDeviceKeys() {
  return Object.keys(app.config).filter(k => ['door_sensor', 'window_sensor'].includes(app.config[k].type));
}

function buildSecuritySensorCard(key) {
  const cfg   = app.config[key];
  const open  = !!app.devices[key]?.open;
  const armed = !!app.alarmSensors[key];
  return `<div class="device-card full-width" id="security-card-${key}">
    <div class="card-head">
      <div class="card-ico-name"><span class="card-ico">${cfg.type === 'door_sensor' ? '🚪' : '🪟'}</span><span class="card-label">${devLabel(key, cfg)}</span></div>
    </div>
    <div class="card-status-row">
      <span class="card-status ${open ? 'on' : ''}">${open ? t('sensorOpen') : t('sensorClosed')}</span>
    </div>
    <div class="manual-row">
      <span>${t('alarmSensorTitle')}</span>
      <div class="toggle toggle-sm ${armed ? 'on' : ''}" data-key="${key}" data-action="toggle-sensor-alarm"></div>
    </div>
    ${armed ? `<div class="manual-note">${t('alarmSensorNote')}</div>` : ''}
  </div>`;
}

function renderSecurityView() {
  const el = document.getElementById('security-content');
  if (!el) return;
  const keys = securityDeviceKeys();
  el.innerHTML = `
    <div class="section-label">${t('sectionSecurity')}</div>
    ${keys.length
      ? `<div class="device-grid">${keys.map(buildSecuritySensorCard).join('')}</div>`
      : `<div class="support-card" style="text-align:center"><span class="support-card-ico">🛡️</span><p>${t('noSecuritySensorsMsg')}</p></div>`}
  `;
}

function rerenderSecurityCard(key) {
  const el = document.getElementById(`security-card-${key}`);
  if (el) el.outerHTML = buildSecuritySensorCard(key);
}

function toggleSensorAlarm(key) {
  app.alarmSensors[key] = !app.alarmSensors[key];
  rerenderSecurityCard(key);
  showToast(app.alarmSensors[key] ? t('toastSensorAlarmOn') : t('toastSensorAlarmOff'), '');
  savePrefs({ alarmSensors: { [key]: app.alarmSensors[key] } });
}

function renderPrefsRows() {
  const langEl = document.getElementById('lang-options');
  if (langEl) {
    langEl.innerHTML = Object.keys(I18N).map(l =>
      `<button class="pref-btn ${app.lang === l ? 'active' : ''}" data-lang="${l}">${LANG_NAMES[l]}</button>`
    ).join('');
  }
  const a11yEl = document.getElementById('a11y-options');
  if (a11yEl) {
    const modes = [['none', 'a11yNone'], ['vision', 'a11yVision'], ['hearing', 'a11yHearing']];
    a11yEl.innerHTML = modes.map(([m, k]) =>
      `<button class="pref-btn ${app.a11y === m ? 'active' : ''}" data-a11y="${m}">${t(k)}</button>`
    ).join('');
  }
  const note = document.getElementById('a11y-note');
  if (note) {
    note.textContent = app.a11y === 'vision' ? t('a11yVisionNote')
      : app.a11y === 'hearing' ? t('a11yHearingNote') : '';
    note.style.display = app.a11y === 'none' ? 'none' : 'block';
  }
  const themeEl = document.getElementById('theme-options');
  if (themeEl) {
    const modes = [['auto', 'themeAuto'], ['light', 'themeLight'], ['dark', 'themeDark']];
    themeEl.innerHTML = modes.map(([m, k]) =>
      `<button class="pref-btn ${app.theme === m ? 'active' : ''}" data-theme="${m}">${t(k)}</button>`
    ).join('');
  }
}

// Guarda idioma/accesibilidad en el servidor (o localStorage en modo estático)
async function savePrefs(prefs) {
  if (window.location.protocol === 'file:') {
    if (prefs.lang)          localStorage.setItem('nexo_lang', prefs.lang);
    if (prefs.accessibility) localStorage.setItem('nexo_a11y', prefs.accessibility);
    return;
  }
  try {
    await fetch(`${API}/room/${app.token}/prefs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(prefs),
    });
  } catch { /* mejor esfuerzo: la preferencia ya quedó aplicada localmente */ }
}

function setLang(lang) {
  if (!I18N[lang] || lang === app.lang) return;
  app.lang = lang;
  document.documentElement.lang = lang;
  applyTexts();
  renderGrid();
  renderClimateView();
  renderSecurityView();
  renderScenes();
  renderHomeServices();
  applyContactMethod();
  savePrefs({ lang });
}

// ── NO MOLESTAR ───────────────────────────────────────────────────────────────
function toggleDnd() {
  app.dnd = !app.dnd;
  document.querySelectorAll('[data-action="toggle-dnd"]').forEach(el => el.classList.toggle('on', app.dnd));
  showToast(app.dnd ? t('toastDndOn') : t('toastDndOff'), '');
  savePrefs({ dnd: app.dnd });
}

// ── ALARMA DE SENSORES DE SEGURIDAD (puerta/ventana) ─────────────────────────
// La app no recibe push real (sin Service Worker con Web Push) — mientras la
// tenga abierta, un polling cada 20s detecta si algún sensor armado pasó de
// cerrado a abierto y dispara un aviso visual+sonoro local, más un aviso al
// backend para que recepción también lo vea (door-alarm-triggered).
let doorAlarmAudioCtx  = null;
let doorAlarmBeepTimer = null;

async function refreshRoomState() {
  if (window.location.protocol === 'file:' || !app.token) return;
  const prevDevices = app.devices;
  try {
    const data = await apiGet(app.token);
    app.data    = data;
    app.devices = data.devices;
    renderGrid();
    if (!document.getElementById('view-security').classList.contains('hidden')) renderSecurityView();

    for (const key of securityDeviceKeys()) {
      const wasOpen   = !!prevDevices[key]?.open;
      const isOpenNow = !!app.devices[key]?.open;
      if (!wasOpen && isOpenNow && app.alarmSensors[key]) {
        triggerDoorAlarmUI(key);
        fetch(`${API}/room/${app.token}/door-alarm-triggered`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ deviceKey: key }),
        }).catch(() => {});
      }
    }

    // Automatización de Clima: ventana abierta + apagado automático activo + AC encendido.
    const s = app._placeholder.climate;
    const anyWindowOpen = securityDeviceKeys().some(k => app.config[k].type === 'window_sensor' && app.devices[k]?.open);
    if (s?.autoOff && s?.acOn && anyWindowOpen) {
      s.acOn = false;
      if (!document.getElementById('view-climate').classList.contains('hidden')) renderClimateView();
      showToast(t('toastAcAutoOff'), '');
    }
  } catch { /* la próxima vuelta del polling reintenta sola */ }
}

function triggerDoorAlarmUI(key) {
  const label = devLabel(key, app.config[key]);
  document.getElementById('door-alarm-overlay-title').textContent = t('doorAlarmTriggeredTitle', { device: label });
  document.getElementById('door-alarm-overlay-desc').textContent  = t('doorAlarmTriggeredDesc', { device: label });
  document.getElementById('door-alarm-overlay')?.classList.remove('hidden');
  playDoorAlarmBeep();
  doorAlarmBeepTimer = setInterval(playDoorAlarmBeep, 1500);
}

function dismissDoorAlarm() {
  document.getElementById('door-alarm-overlay')?.classList.add('hidden');
  clearInterval(doorAlarmBeepTimer);
  doorAlarmBeepTimer = null;
}

// Tono generado con Web Audio (sin archivo de audio que cargar/mantener).
function playDoorAlarmBeep() {
  try {
    doorAlarmAudioCtx = doorAlarmAudioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const osc  = doorAlarmAudioCtx.createOscillator();
    const gain = doorAlarmAudioCtx.createGain();
    osc.type = 'square';
    osc.frequency.value = 880;
    gain.gain.value = 0.15;
    osc.connect(gain).connect(doorAlarmAudioCtx.destination);
    osc.start();
    osc.stop(doorAlarmAudioCtx.currentTime + 0.4);
  } catch { /* navegador sin Web Audio o sin permiso de audio todavía — no es crítico */ }
}

// ── SOLICITUDES DE SERVICIO ───────────────────────────────────────────────────
// Cubre toda la comunicación habitual huésped↔recepción durante la estadía,
// con o sin domótica: toallas, room service, limpieza, late checkout,
// reportar un problema y solicitudes libres (las dos últimas con nota).
async function sendServiceRequest(type, note = '') {
  if (window.location.protocol === 'file:') {
    showToast(t('toastRequestSent'), 'success');
    return;
  }
  try {
    const res = await fetch(`${API}/room/${app.token}/request`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ type, note }),
    });
    if (!res.ok) throw new Error();
    showToast(t('toastRequestSent'), 'success');
  } catch {
    showToast(t('toastCmdFail'), 'error');
  }
}

// Tipos que requieren describir el pedido antes de enviarlo.
function sendServiceRequestWithNote(type) {
  const note = (window.prompt(t('requestNotePrompt')) || '').trim();
  if (!note) return; // cancelado o vacío — no se envía
  sendServiceRequest(type, note);
}

// ── REPORTAR PROBLEMA GENERAL (app/PMS) — llega al hotel Y al admin de la app ──
function openAppProblemModal() {
  document.getElementById('app-problem-text').value = '';
  document.getElementById('app-problem-modal-overlay').classList.remove('hidden');
}

function closeAppProblemModal() {
  document.getElementById('app-problem-modal-overlay').classList.add('hidden');
}

async function submitAppProblem() {
  const note = document.getElementById('app-problem-text').value.trim();
  if (!note) return;
  await sendServiceRequest('app_problem', note);
  closeAppProblemModal();
}

// ── REPORTAR PROBLEMA DE DISPOSITIVO ─────────────────────────────────────────
// Asistente de 3 pasos (intro → opciones → "otra") que termina enviando una
// solicitud tipo 'maintenance' con el dispositivo y el motivo en la nota —
// reutiliza el mismo pipeline de solicitudes que ya ve recepción en Mensajes,
// sin necesitar un endpoint ni un tipo de solicitud nuevos.
const REPORT_OPTIONS = {
  light:      ['noEnciende', 'noApaga', 'noIntensidad', 'noTemperatura'],
  light_rgb:  ['noEnciende', 'noApaga', 'noIntensidad', 'noColores'],
  curtain:    ['noAbre', 'noCierra', 'noPara', 'seMueveSola'],
  switch:     ['noEnciende', 'noApaga'],
  switch_3ch: ['canalNoResponde', 'ningunCanalResponde'],
  ac:         ['noEnciende', 'noApaga', 'noTemperaturaAC', 'noEnfriaCalienta'],
};
const REPORT_OPTION_LABELS = {
  noEnciende: 'reportOptNoEnciende', noApaga: 'reportOptNoApaga',
  noIntensidad: 'reportOptNoIntensidad', noTemperatura: 'reportOptNoTemperatura',
  noColores: 'reportOptNoColores', noAbre: 'reportOptNoAbre', noCierra: 'reportOptNoCierra',
  noPara: 'reportOptNoPara', seMueveSola: 'reportOptSeMueveSola',
  canalNoResponde: 'reportOptCanalNoResponde', ningunCanalResponde: 'reportOptNingunCanalResponde',
  noTemperaturaAC: 'reportOptNoTemperaturaAC', noEnfriaCalienta: 'reportOptNoEnfriaCalienta',
};

let reportState = null; // { key, step, option, otherText }

function openReportModal(key) {
  reportState = { key, step: key ? 'intro' : 'pick-device', option: null, otherText: '' };
  renderReportModal();
  document.getElementById('report-modal-overlay').classList.remove('hidden');
}

function closeReportModal() {
  document.getElementById('report-modal-overlay').classList.add('hidden');
  reportState = null;
}

function renderReportModal() {
  if (!reportState) return;
  const { key, step, option } = reportState;
  const cfg   = app.config[key] || {};
  const label = featureOrDeviceLabel(key);
  const card  = document.getElementById('report-modal-card');

  if (step === 'pick-device') {
    const devOpts = Object.entries(app.config)
      .map(([k, cfg]) => `<button type="button" class="report-option" data-pick="${k}">${devLabel(k, cfg)}</button>`)
      .join('');
    card.innerHTML = `
      <div class="onboarding-ico">⚠️</div>
      <h2>${t('reportTitle')}</h2>
      <p class="scene-modal-desc">${t('reportPickDevice')}</p>
      <div class="report-options" id="report-pick-list">${devOpts}</div>
      <div class="scene-modal-actions">
        <button class="support-btn" id="report-modal-back">${t('reportBackBtn')}</button>
      </div>`;
    document.getElementById('report-pick-list').querySelectorAll('[data-pick]').forEach(btn => {
      btn.onclick = () => { reportState.key = btn.dataset.pick; reportState.step = 'intro'; renderReportModal(); };
    });
    document.getElementById('report-modal-back').onclick = closeReportModal;
    return;
  }

  if (step === 'intro') {
    card.innerHTML = `
      <div class="onboarding-ico">⚠️</div>
      <h2>${t('reportTitle')}</h2>
      <p class="scene-modal-desc">${t('reportIntroDesc', { device: label })}</p>
      <div class="scene-modal-actions">
        <button class="support-btn" id="report-modal-back">${t('reportBackBtn')}</button>
        <button class="support-btn" id="report-modal-next">${t('reportContinueBtn')}</button>
      </div>`;
    document.getElementById('report-modal-back').onclick = closeReportModal;
    document.getElementById('report-modal-next').onclick = () => { reportState.step = 'options'; renderReportModal(); };
    return;
  }

  if (step === 'options') {
    const optKeys = REPORT_OPTIONS[cfg.type] || REPORT_OPTIONS.light;
    const optsHtml = optKeys
      .map(k => `<button type="button" class="report-option ${option === k ? 'active' : ''}" data-opt="${k}">${t(REPORT_OPTION_LABELS[k])}</button>`)
      .concat(`<button type="button" class="report-option ${option === 'otra' ? 'active' : ''}" data-opt="otra">${t('reportOptOtra')}</button>`)
      .join('');

    card.innerHTML = `
      <div class="onboarding-ico">⚠️</div>
      <h2>${t('reportOptionsTitle')}</h2>
      <div class="report-options" id="report-options-list">${optsHtml}</div>
      <div class="scene-modal-actions">
        <button class="support-btn" id="report-modal-back">${t('reportBackBtn')}</button>
        <button class="support-btn" id="report-modal-send">${t('reportSendBtn')}</button>
      </div>`;

    document.getElementById('report-options-list').querySelectorAll('.report-option').forEach(btn => {
      btn.onclick = () => { reportState.option = btn.dataset.opt; renderReportModal(); };
    });
    document.getElementById('report-modal-back').onclick = () => { reportState.step = 'intro'; renderReportModal(); };
    document.getElementById('report-modal-send').onclick = () => {
      if (!reportState.option) { showToast(t('reportNoOptionToast'), 'error'); return; }
      if (reportState.option === 'otra') { reportState.step = 'other'; renderReportModal(); return; }
      submitReport();
    };
    return;
  }

  if (step === 'other') {
    card.innerHTML = `
      <div class="onboarding-ico">⚠️</div>
      <h2>${t('reportOtherTitle')}</h2>
      <textarea class="report-other-textarea" id="report-other-text" placeholder="${t('reportOtherPlaceholder')}" rows="4"></textarea>
      <div class="scene-modal-actions">
        <button class="support-btn" id="report-modal-back">${t('reportBackBtn')}</button>
        <button class="support-btn" id="report-modal-send">${t('reportSendBtn')}</button>
      </div>`;
    document.getElementById('report-modal-back').onclick = () => { reportState.step = 'options'; renderReportModal(); };
    document.getElementById('report-modal-send').onclick = () => {
      reportState.otherText = document.getElementById('report-other-text').value.trim();
      submitReport();
    };
  }
}

function submitReport() {
  const { key, option, otherText } = reportState;
  const label = featureOrDeviceLabel(key);
  const detail = option === 'otra'
    ? (otherText ? `${t('reportOptOtra')}: ${otherText}` : t('reportOptOtra'))
    : t(REPORT_OPTION_LABELS[option]);
  sendServiceRequest('maintenance', `${label} — ${detail}`);
  closeReportModal();
}

// ── PROGRAMAR DISPOSITIVOS Y ESCENAS ─────────────────────────────────────────
// Modal genérico: rango horario (desde/hasta, con apagado automático opcional)
// + repetición (una vez en una fecha, o ciertos días de la semana). Para
// escenas no hay "hasta" (aplicar una escena no tiene un inverso natural) — se
// disparan solo a la hora de inicio, con o sin repetición. buildPasos(valor)
// siempre arma el array de pasos {dev,cmd} que espera el backend (mismo
// formato que ya usa applyScene()); buildPasosFin(valor) es su inverso.
const SCHEDULE_DIAS = [
  { value: 1, key: 'L' }, { value: 2, key: 'M' }, { value: 3, key: 'M2' },
  { value: 4, key: 'J' }, { value: 5, key: 'V' }, { value: 6, key: 'S' }, { value: 0, key: 'D' },
];
let scheduleState = null;

function openScheduleModal({ descripcion, choices, buildPasos, buildPasosFin, matches }) {
  scheduleState = {
    descripcion, choices, buildPasos, buildPasosFin, matches,
    selected: choices ? choices[0].value : null,
    horaInicio: '', horaFin: '', apagarAuto: false,
    repetir: 'once', fecha: new Date().toISOString().slice(0, 10), diasSel: [],
  };
  renderScheduleModal();
  document.getElementById('schedule-modal-overlay').classList.remove('hidden');
}

function closeScheduleModal() {
  document.getElementById('schedule-modal-overlay').classList.add('hidden');
  scheduleState = null;
}

function renderScheduleModal() {
  if (!scheduleState) return;
  const { descripcion, choices, selected, apagarAuto, repetir, diasSel, buildPasosFin } = scheduleState;
  const card = document.getElementById('schedule-modal-card');

  const choicesHtml = choices ? `
    <div class="report-options" id="schedule-onoff">
      ${choices.map(c => `<button type="button" class="report-option ${c.value === selected ? 'active' : ''}" data-value="${c.value}">${c.label}</button>`).join('')}
    </div>` : '';

  const autoOffHtml = buildPasosFin ? `
    <label class="schedule-check-row">
      <input type="checkbox" id="schedule-auto-off" ${apagarAuto ? 'checked' : ''}>
      <span>${t('scheduleAutoOff')}</span>
    </label>
    ${apagarAuto ? `
      <label class="schedule-label">${t('scheduleUntil')}</label>
      <input type="time" class="scene-name-input" id="schedule-time-end" value="${scheduleState.horaFin}">` : ''}` : '';

  const repeatBodyHtml = repetir === 'weekly' ? `
    <div class="schedule-days-row">
      ${SCHEDULE_DIAS.map(d => `<button type="button" class="schedule-day-btn ${diasSel.includes(d.value) ? 'active' : ''}" data-day="${d.value}">${t('scheduleDay_' + d.key)}</button>`).join('')}
    </div>` : `
    <input type="date" class="scene-name-input" id="schedule-date" min="${new Date().toISOString().slice(0, 10)}" value="${scheduleState.fecha}">`;

  card.innerHTML = `
    <div class="onboarding-ico">🕐</div>
    <h2>${t('scheduleTitle')}</h2>
    <p class="scene-modal-desc">${t(choices ? 'scheduleDesc' : 'scheduleDescScene', { device: descripcion })}</p>
    ${choicesHtml}
    <label class="schedule-label">${t('scheduleFrom')}</label>
    <input type="time" class="scene-name-input" id="schedule-time-start" value="${scheduleState.horaInicio}">
    ${autoOffHtml}
    <div class="report-options" id="schedule-repeat">
      <button type="button" class="report-option ${repetir === 'once' ? 'active' : ''}" data-repeat="once">${t('scheduleOnce')}</button>
      <button type="button" class="report-option ${repetir === 'weekly' ? 'active' : ''}" data-repeat="weekly">${t('scheduleWeekly')}</button>
    </div>
    ${repeatBodyHtml}
    <div class="form-error" id="schedule-error" style="color:#E5484D;font-size:12px;margin:8px 0"></div>
    <div class="scene-modal-actions">
      <button class="support-btn" id="schedule-modal-back">${t('reportBackBtn')}</button>
      <button class="support-btn" id="schedule-modal-send">${t('scheduleSendBtn')}</button>
    </div>
    <div id="schedule-pending-list" style="margin-top:16px"></div>`;

  if (choices) {
    document.querySelectorAll('#schedule-onoff .report-option').forEach(btn => {
      btn.onclick = () => { scheduleState.selected = btn.dataset.value; renderScheduleModal(); };
    });
  }
  document.getElementById('schedule-time-start').oninput = e => { scheduleState.horaInicio = e.target.value; };
  if (buildPasosFin) {
    document.getElementById('schedule-auto-off').onchange = e => { scheduleState.apagarAuto = e.target.checked; renderScheduleModal(); };
    if (apagarAuto) document.getElementById('schedule-time-end').oninput = e => { scheduleState.horaFin = e.target.value; };
  }
  document.querySelectorAll('#schedule-repeat .report-option').forEach(btn => {
    btn.onclick = () => { scheduleState.repetir = btn.dataset.repeat; renderScheduleModal(); };
  });
  if (repetir === 'weekly') {
    document.querySelectorAll('.schedule-day-btn').forEach(btn => {
      btn.onclick = () => {
        const d = parseInt(btn.dataset.day, 10);
        const idx = scheduleState.diasSel.indexOf(d);
        if (idx >= 0) scheduleState.diasSel.splice(idx, 1); else scheduleState.diasSel.push(d);
        renderScheduleModal();
      };
    });
  } else {
    document.getElementById('schedule-date').oninput = e => { scheduleState.fecha = e.target.value; };
  }
  document.getElementById('schedule-modal-back').onclick = closeScheduleModal;
  document.getElementById('schedule-modal-send').onclick = submitSchedule;

  loadPendingSchedules();
}

async function submitSchedule() {
  const errEl = document.getElementById('schedule-error');
  errEl.textContent = '';
  const { descripcion, buildPasos, buildPasosFin, selected, horaInicio, horaFin, apagarAuto, repetir, fecha, diasSel } = scheduleState;

  if (!horaInicio) { errEl.textContent = t('scheduleNoTimeError'); return; }
  if (apagarAuto && !horaFin) { errEl.textContent = t('scheduleNoEndTimeError'); return; }
  if (apagarAuto && horaFin === horaInicio) { errEl.textContent = t('scheduleSameTimeError'); return; }
  if (repetir === 'once' && !fecha) { errEl.textContent = t('scheduleNoDateError'); return; }
  if (repetir === 'weekly' && !diasSel.length) { errEl.textContent = t('scheduleNoDaysError'); return; }

  const body = {
    descripcion,
    pasosInicio: buildPasos(selected),
    pasosFin: apagarAuto && buildPasosFin ? buildPasosFin(selected) : null,
    horaInicio, horaFin: apagarAuto ? horaFin : null,
    repetir, fecha: repetir === 'once' ? fecha : null, diasSemana: repetir === 'weekly' ? diasSel : null,
  };

  try {
    const res = await fetch(`${API}/room/${app.token}/schedule`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error');
    showToast(t('toastScheduleSaved'), 'success');
    loadPendingSchedules();
  } catch (err) {
    errEl.textContent = err.message;
  }
}

const SCHEDULE_DIAS_CORTAS = ['scheduleDayShortD', 'scheduleDayShortL', 'scheduleDayShortM', 'scheduleDayShortM2', 'scheduleDayShortJ', 'scheduleDayShortV', 'scheduleDayShortS'];

function formatScheduleRow(c) {
  const rango = c.hora_fin ? `${c.hora_inicio}–${c.hora_fin}` : c.hora_inicio;
  const cuando = c.repetir === 'once'
    ? new Date(c.fecha + 'T00:00:00').toLocaleDateString(undefined, { day: '2-digit', month: '2-digit' })
    : JSON.parse(c.dias_semana).map(d => t(SCHEDULE_DIAS_CORTAS[d])).join(', ');
  return `${rango} · ${cuando}`;
}

async function loadPendingSchedules() {
  const list = document.getElementById('schedule-pending-list');
  if (!list || !scheduleState) return;
  try {
    const res = await fetch(`${API}/room/${app.token}/schedule`);
    const all = await res.json();
    const propios = (Array.isArray(all) ? all : []).filter(scheduleState.matches);
    if (!propios.length) { list.innerHTML = `<div class="scenes-hint">${t('scheduleNonePending')}</div>`; return; }
    list.innerHTML = propios.map(c => `<div class="ch-row">
        <span class="ch-label">${c.descripcion} · ${formatScheduleRow(c)}</span>
        <button type="button" class="report-btn" onclick="cancelSchedule('${c.id}')" aria-label="${t('scheduleCancelBtn')}">✕</button>
      </div>`).join('');
  } catch {
    list.innerHTML = '';
  }
}

window.cancelSchedule = async function(id) {
  try {
    await fetch(`${API}/room/${app.token}/schedule/${id}`, { method: 'DELETE' });
    showToast(t('toastScheduleCancelled'), '');
    loadPendingSchedules();
  } catch (err) {
    showToast(err.message, 'error');
  }
};

// Atajos por tipo de dispositivo — arman los `opts` que espera openScheduleModal().
window.scheduleOnOff = function(key) {
  openScheduleModal({
    descripcion: devLabel(key, app.config[key] || {}),
    choices: [{ value: 'true', label: t('scheduleTurnOn') }, { value: 'false', label: t('scheduleTurnOff') }],
    buildPasos:    v => [{ dev: key, cmd: { on: v === 'true' } }],
    buildPasosFin: v => [{ dev: key, cmd: { on: v !== 'true' } }],
    matches: c => { try { return JSON.parse(c.pasos_inicio).some(s => s.dev === key && 'on' in s.cmd); } catch { return false; } },
  });
};

window.scheduleChannel = function(key, ch) {
  const cfg = app.config[key] || {};
  const label = (cfg.channels && cfg.channels[ch]) || devLabel(key, cfg);
  openScheduleModal({
    descripcion: label,
    choices: [{ value: 'true', label: t('scheduleTurnOn') }, { value: 'false', label: t('scheduleTurnOff') }],
    buildPasos:    v => [{ dev: key, cmd: { [`ch${ch + 1}`]: v === 'true' } }],
    buildPasosFin: v => [{ dev: key, cmd: { [`ch${ch + 1}`]: v !== 'true' } }],
    matches: c => { try { return JSON.parse(c.pasos_inicio).some(s => s.dev === key && `ch${ch + 1}` in s.cmd); } catch { return false; } },
  });
};

window.scheduleCurtain = function(key) {
  openScheduleModal({
    descripcion: devLabel(key, app.config[key] || {}),
    choices: [{ value: 'open', label: t('curtainOpenBtn') }, { value: 'close', label: t('curtainCloseBtn') }],
    buildPasos:    v => [{ dev: key, cmd: { control: v } }],
    buildPasosFin: v => [{ dev: key, cmd: { control: v === 'open' ? 'close' : 'open' } }],
    matches: c => { try { return JSON.parse(c.pasos_inicio).some(s => s.dev === key && 'control' in s.cmd); } catch { return false; } },
  });
};

window.scheduleScene = function(sceneId) {
  const scene = getSceneList().find(s => s.id === sceneId);
  if (!scene) return;
  openScheduleModal({
    descripcion: scene.title,
    choices: null,
    buildPasos: () => getSceneSteps(sceneId),
    buildPasosFin: null,
    matches: c => c.descripcion === scene.title,
  });
};

function setA11y(mode) {
  if (mode === app.a11y) return;
  app.a11y = mode;
  applyA11y();
  renderPrefsRows();
  savePrefs({ accessibility: mode });
}

// Presets visuales según discapacidad: baja visión (texto/controles grandes,
// alto contraste) y auditiva (avisos visuales destacados y más duraderos).
function applyA11y() {
  document.body.classList.toggle('a11y-vision',  app.a11y === 'vision');
  document.body.classList.toggle('a11y-hearing', app.a11y === 'hearing');
}

// ── TEMA (claro / oscuro / automático según la hora) ─────────────────────────
// En modo "auto", entre las 20:00 y las 07:00 (hora local del dispositivo) se
// aplica el tema oscuro. En "light"/"dark" el huésped fija el tema manualmente.
function applyTheme() {
  let dark;
  if (app.theme === 'dark') dark = true;
  else if (app.theme === 'light') dark = false;
  else {
    const hour = new Date().getHours();
    dark = hour >= 20 || hour < 7;
  }
  document.body.classList.toggle('theme-dark', dark);
  const btn = document.getElementById('theme-toggle-btn');
  if (btn) {
    btn.textContent = dark ? '☀️' : '🌙';
    const label = dark ? t('themeDeactivateDark') : t('themeActivateDark');
    btn.title = label;
    btn.setAttribute('aria-label', label);
  }
}

function setTheme(mode) {
  if (mode === app.theme) return;
  app.theme = mode;
  localStorage.setItem('nexo_theme', mode);
  applyTheme();
  renderPrefsRows();
}

// ── INDICADOR DE ESTADO DE CONEXIÓN ───────────────────────────────────────────
function updateConnStatus() {
  const el = document.getElementById('conn-status');
  if (!el) return;
  const online = navigator.onLine;
  el.classList.toggle('offline', !online);
  el.innerHTML = `<span class="conn-dot"></span>${online ? t('connOnline') : t('connOffline')}`;
}

window.addEventListener('online', () => {
  updateConnStatus();
  showToast(t('toastOnline'), 'success');
});
window.addEventListener('offline', () => {
  updateConnStatus();
  showToast(t('toastOffline'), 'error');
});

// Clicks en los selectores de idioma/accesibilidad/tema
document.addEventListener('click', e => {
  const lb = e.target.closest('[data-lang]');
  if (lb) { setLang(lb.dataset.lang); return; }
  const ab = e.target.closest('[data-a11y]');
  if (ab) { setA11y(ab.dataset.a11y); return; }
  const tb = e.target.closest('[data-theme]');
  if (tb) setTheme(tb.dataset.theme);
});

// ── NAVEGACIÓN: SIDEBAR Y VISTAS ──────────────────────────────────────────────
function switchView(view) {
  document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
  document.getElementById(`view-${view}`)?.classList.remove('hidden');
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.querySelector(`.nav-item[data-view="${view}"]`)?.classList.add('active');

  if (view === 'scenes') {
    const key = `nexo_scenes_onboarded_${app.token || 'static'}`;
    if (!localStorage.getItem(key)) {
      localStorage.setItem(key, '1');
      openSceneHelpModal();
    }
  }
}

// ── TUTORIAL GUIADO (encender una luz / mover la cortina) ────────────────────
const TUTORIAL_STEPS = [
  {
    view: 'room',
    selector: () => document.querySelector('[data-key="luz_techo"][data-action="toggle-light"]'),
    titleKey: 'tutLightTitle',
    descKey:  'tutLightDesc',
  },
  {
    view: 'room',
    selector: () => document.querySelector('#device-grid [data-curtain="open"]'),
    titleKey: 'tutCurtainOpenTitle',
    descKey:  'tutCurtainOpenDesc',
  },
  {
    view: 'room',
    selector: () => document.querySelector('#device-grid [data-curtain="stop"]'),
    titleKey: 'tutCurtainStopTitle',
    descKey:  'tutCurtainStopDesc',
  },
  {
    view: 'room',
    selector: () => document.querySelector('#device-grid [data-curtain="close"]'),
    titleKey: 'tutCurtainCloseTitle',
    descKey:  'tutCurtainCloseDesc',
  },
];

let tutorialStep = 0;

function startTutorial() {
  tutorialStep = 0;
  showTutorialStep();
}

function showTutorialStep() {
  // Saltar pasos cuyo dispositivo no existe en esta habitación
  while (tutorialStep < TUTORIAL_STEPS.length && !TUTORIAL_STEPS[tutorialStep].selector()) {
    tutorialStep++;
  }
  if (tutorialStep >= TUTORIAL_STEPS.length) return endTutorial();

  const step = TUTORIAL_STEPS[tutorialStep];
  switchView(step.view);
  document.getElementById('tutorial-overlay').classList.remove('hidden');

  requestAnimationFrame(() => {
    const target = step.selector();
    if (!target) { tutorialStep++; return showTutorialStep(); }
    target.scrollIntoView({ behavior: 'instant', block: 'center' });
    // rAF extra para que el browser confirme el layout después del scroll
    requestAnimationFrame(() => positionTutorial(target, step));
  });
}

function positionTutorial(target, step) {
  const highlight = document.getElementById('tutorial-highlight');
  const tooltip   = document.getElementById('tutorial-tooltip');
  const pad = 6;

  const rect = target.getBoundingClientRect();
  highlight.style.top    = `${rect.top - pad}px`;
  highlight.style.left   = `${rect.left - pad}px`;
  highlight.style.width  = `${rect.width + pad * 2}px`;
  highlight.style.height = `${rect.height + pad * 2}px`;

  document.getElementById('tutorial-title').textContent = t(step.titleKey);
  document.getElementById('tutorial-desc').textContent  = t(step.descKey);
  document.getElementById('tutorial-step-count').textContent =
    t('tutStepCount', { n: tutorialStep + 1, total: TUTORIAL_STEPS.length });
  document.getElementById('tutorial-prev').style.visibility = tutorialStep === 0 ? 'hidden' : 'visible';
  document.getElementById('tutorial-next').textContent =
    tutorialStep === TUTORIAL_STEPS.length - 1 ? t('tutFinish') : t('tutNext');

  const tooltipRect = tooltip.getBoundingClientRect();
  let top = rect.bottom + pad + 14;
  if (top + tooltipRect.height > window.innerHeight - 12) {
    top = rect.top - pad - tooltipRect.height - 14;
  }
  top = Math.max(12, top);
  let left = rect.left + rect.width / 2 - tooltipRect.width / 2;
  left = Math.max(12, Math.min(left, window.innerWidth - tooltipRect.width - 12));
  tooltip.style.top  = `${top}px`;
  tooltip.style.left = `${left}px`;
}

function endTutorial() {
  document.getElementById('tutorial-overlay')?.classList.add('hidden');
  document.getElementById('tutorial-choice-overlay')?.classList.add('hidden');
  localStorage.setItem(`nexo_onboarded_${app.token || 'static'}`, '1');
}

function initNav() {
  const sidebar  = document.getElementById('sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  const burger   = document.getElementById('hamburger-btn');

  function openSidebar()  { sidebar.classList.add('open');    backdrop.classList.add('open'); }
  function closeSidebar() { sidebar.classList.remove('open'); backdrop.classList.remove('open'); }

  burger.addEventListener('click', openSidebar);
  backdrop.addEventListener('click', closeSidebar);

  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      switchView(item.dataset.view);
      closeSidebar();
    });
  });

  // Botón de soporte: contactar a recepción — WhatsApp como vía principal
  // (mismo canal que ya usa recepción para responder desde el Centro de
  // Mensajes), con llamada telefónica real como respaldo. Si el hotel no
  // configuró un teléfono, se degrada al mensaje genérico de siempre.
  document.getElementById('call-reception-btn')?.addEventListener('click', (e) => {
    e.preventDefault();
    const method = app.data?.contactMethod || 'whatsapp';
    if (method === 'citofono') { alert(t('callReceptionCitofonoMsg')); return; }
    if (method === 'bajar_recepcion') { alert(t('callReceptionBajarMsg')); return; }
    if (method === 'otro') { alert(app.data?.contactMessage || t('callReceptionMsg')); return; }
    const phone = app.data?.hotelPhone;
    if (!phone) { alert(t('callReceptionMsg')); return; }
    const digits = phone.replace(/[^0-9]/g, '');
    const msg = t('callReceptionWaMsg', { room: app.data?.roomName || '', hotel: app.data?.hotelName || '' });
    window.open(`https://wa.me/${digits}?text=${encodeURIComponent(msg)}`, '_blank');
  });
  document.getElementById('call-reception-tel')?.addEventListener('click', (e) => {
    e.preventDefault();
    const phone = app.data?.hotelPhone;
    if (!phone) { alert(t('callReceptionMsg')); return; }
    window.location.href = `tel:${phone}`;
  });

  // No molestar y solicitudes de servicio
  document.getElementById('dnd-toggle')?.addEventListener('click', toggleDnd);
  document.getElementById('door-alarm-toggle')?.addEventListener('click', toggleDoorAlarm);
  document.getElementById('door-alarm-dismiss')?.addEventListener('click', dismissDoorAlarm);
  document.getElementById('request-towels-btn')?.addEventListener('click', () => sendServiceRequest('towels'));
  document.getElementById('request-roomservice-btn')?.addEventListener('click', () => sendServiceRequest('roomservice'));
  document.getElementById('request-cleaning-btn')?.addEventListener('click', () => sendServiceRequest('cleaning'));
  document.getElementById('request-late-checkout-btn')?.addEventListener('click', () => sendServiceRequest('late_checkout'));
  document.getElementById('request-maintenance-btn')?.addEventListener('click', () => sendServiceRequestWithNote('maintenance'));
  document.getElementById('request-other-btn')?.addEventListener('click', () => sendServiceRequestWithNote('other'));

  document.getElementById('report-app-problem-btn')?.addEventListener('click', openAppProblemModal);
  document.getElementById('app-problem-cancel')?.addEventListener('click', closeAppProblemModal);
  document.getElementById('app-problem-send')?.addEventListener('click', submitAppProblem);

  // Botones globales del header: ⚠️ reportar y ❓ tutorial
  document.getElementById('btn-global-report')?.addEventListener('click', () => openReportModal(null));
  document.getElementById('btn-global-tutorial')?.addEventListener('click', () => {
    document.getElementById('onboarding-overlay')?.classList.add('hidden');
    document.getElementById('tutorial-choice-overlay')?.classList.remove('hidden');
  });

  // Onboarding: al cerrar el mensaje de bienvenida, ofrecer el tutorial guiado
  document.getElementById('onboarding-dismiss')?.addEventListener('click', () => {
    document.getElementById('onboarding-overlay')?.classList.add('hidden');
    document.getElementById('tutorial-choice-overlay')?.classList.remove('hidden');
  });

  // El huésped ya sabe usar los controles smart: no mostrar el tutorial
  document.getElementById('tutorial-skip-btn')?.addEventListener('click', () => {
    document.getElementById('tutorial-choice-overlay')?.classList.add('hidden');
    localStorage.setItem(`nexo_onboarded_${app.token || 'static'}`, '1');
  });

  // Iniciar el tutorial guiado paso a paso
  document.getElementById('tutorial-start-btn')?.addEventListener('click', () => {
    document.getElementById('tutorial-choice-overlay')?.classList.add('hidden');
    startTutorial();
  });

  // Navegación y salida del tutorial guiado
  document.getElementById('tutorial-exit-btn')?.addEventListener('click', endTutorial);
  document.getElementById('tutorial-next')?.addEventListener('click', () => {
    if (tutorialStep >= TUTORIAL_STEPS.length - 1) return endTutorial();
    tutorialStep++;
    showTutorialStep();
  });
  document.getElementById('tutorial-prev')?.addEventListener('click', () => {
    if (tutorialStep === 0) return;
    tutorialStep--;
    showTutorialStep();
  });
  // Reenviar el clic al control real resaltado (luz/cortina) cuando cae dentro
  // del recuadro destacado, para que el huésped pueda probarlo de verdad en
  // vez de que el overlay del tutorial absorba el clic sin hacer nada.
  document.getElementById('tutorial-overlay')?.addEventListener('click', (e) => {
    if (e.target.closest('.tutorial-tooltip') || e.target.closest('.tutorial-exit-btn')) return;
    const step   = TUTORIAL_STEPS[tutorialStep];
    const target = step?.selector();
    if (!target) return;
    const rect = target.getBoundingClientRect();
    if (e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom) {
      target.click();
    }
  });
  window.addEventListener('resize', () => {
    if (document.getElementById('tutorial-overlay').classList.contains('hidden')) return;
    const step = TUTORIAL_STEPS[tutorialStep];
    const target = step?.selector();
    if (target) positionTutorial(target, step);
  });

  // Acceso rápido al tema desde el encabezado (alterna claro/oscuro)
  document.getElementById('theme-toggle-btn')?.addEventListener('click', () => {
    const dark = document.body.classList.contains('theme-dark');
    setTheme(dark ? 'light' : 'dark');
  });

}

// ── ÍCONOS PERSONALIZADOS ─────────────────────────────────────────────────────
const ICON_BED = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 17v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5"/><path d="M2 17h20v3"/><path d="M2 20v-3"/><path d="M22 20v-3"/><path d="M4 10V6a1 1 0 0 1 1-1h6v5"/></svg>';
const ICON_LAMP = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 4h8l4 7H4z"/><line x1="12" y1="11" x2="12" y2="19"/><line x1="8" y1="21" x2="16" y2="21"/></svg>';
const ICON_CEILING_LAMP = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="2" x2="12" y2="7"/><path d="M6 16l2-9h8l2 9z"/><line x1="6" y1="16" x2="18" y2="16"/></svg>';

const DEVICE_ICON_OVERRIDES = {
  led_cama:     ICON_BED,
  luz_velador1: ICON_LAMP,
  luz_velador2: ICON_LAMP,
  luz_techo:    ICON_CEILING_LAMP,
};
const deviceIcon = (key, fallback) => DEVICE_ICON_OVERRIDES[key] || fallback;

// ── FAVORITOS (accesos directos) ─────────────────────────────────────────────
const FAV_MAX = 3;

// channel: índice de canal para dispositivos multi-canal (enchufe con Estufa/
// Aromatizador en canales separados) — sin esto, favoritear cualquier canal
// marcaba el mismo "enchufe" genérico y la barra de accesos rápidos no podía
// saber cuál de los dos era ni mostrar su nombre real.
function favBtn(key, channel) {
  const favId = channel != null ? `${key}:${channel}` : key;
  const active = app.favorites.includes(favId);
  return `<button type="button" class="fav-btn ${active ? 'active' : ''}" data-key="${key}" ${channel != null ? `data-channel="${channel}"` : ''} data-action="toggle-favorite" aria-label="${t('favToggle')}">${active ? '★' : '☆'}</button>`;
}

function reportBtn(key) {
  return `<button type="button" class="report-btn" data-key="${key}" data-action="report-problem" aria-label="${t('reportProblemBtn')}">⚠️</button>`;
}

function scheduleBtn(key) {
  return `<button type="button" class="report-btn" onclick="event.stopPropagation();scheduleOnOff('${key}')" aria-label="${t('scheduleBtn')}">🕐</button>`;
}

function helpBtn(key) {
  return `<button type="button" class="report-btn" onclick="event.stopPropagation();openHelpModal('${key}')" aria-label="${t('helpBtn')}">❓</button>`;
}

function enlargeBtn(key) {
  return `<button type="button" class="report-btn" onclick="event.stopPropagation();openEnlargeModal('${key}')" aria-label="${t('enlargeBtn')}">🔍</button>`;
}

// Fila de iconos común a toda tarjeta de dispositivo — separada de card-head para
// que el interruptor principal nunca se vea forzado a compartir espacio con ellos
// (eso era lo que rompía el layout cuando la etiqueta del dispositivo era larga).
function cardIconsRow(key, scheduleHtml, channel) {
  return `<div class="card-icons-row">${favBtn(key, channel)}${scheduleHtml}</div>`;
}

function featureIconsRow(_key) {
  return '';
}

const HELP_TEXT_BY_TYPE = {
  light: 'helpTextLight', light_rgb: 'helpTextLED', curtain: 'helpTextCurtain',
  switch: 'helpTextSwitch', switch_3ch: 'helpTextSwitch', ac: 'helpTextAC',
};

window.openHelpModal = function(key) {
  const cfg = app.config[key];
  document.getElementById('help-modal-title').textContent = featureOrDeviceLabel(key);
  const textKey = cfg ? HELP_TEXT_BY_TYPE[cfg.type] : HELP_TEXT_BY_FEATURE[key];
  document.getElementById('help-modal-body').textContent = t(textKey || 'helpTextGeneric');
  document.getElementById('help-modal-overlay').classList.remove('hidden');
};

window.closeHelpModal = function() {
  document.getElementById('help-modal-overlay').classList.add('hidden');
};

let enlargedKey = null;

window.openEnlargeModal = function(key) {
  enlargedKey = key;
  document.getElementById('enlarge-modal-title').textContent = featureOrDeviceLabel(key);
  document.getElementById('enlarge-modal-body').innerHTML = app.config[key] ? buildCard(key) : (PLACEHOLDER_BUILDERS[key]?.() || '');
  document.getElementById('enlarge-modal-overlay').classList.remove('hidden');
};

window.closeEnlargeModal = function() {
  enlargedKey = null;
  document.getElementById('enlarge-modal-overlay').classList.add('hidden');
};

function saveFavorites() {
  try { localStorage.setItem(`nexo_favs_${app.token || 'static'}`, JSON.stringify(app.favorites)); } catch {}
}

function renderFavorites() {
  const bar = document.getElementById('favorites-bar');
  if (!bar) return;
  const items = app.favorites
    .map(favId => {
      const [key, channel] = favId.split(':');
      return { key, channel: channel !== undefined ? Number(channel) : null, cfg: app.config[key] };
    })
    .filter(({ key, cfg }) => cfg && app.devices[key]);

  if (!items.length) {
    bar.classList.add('hidden');
    bar.innerHTML = '';
    return;
  }

  bar.classList.remove('hidden');
  bar.innerHTML = `
    <div class="favorites-label">${t('sectionFavorites')}</div>
    <div class="favorites-row">${items.map(({ key, cfg, channel }) => buildFavChip(key, cfg, channel)).join('')}</div>`;
}

function buildFavChip(key, cfg, channel) {
  const s = app.devices[key] || {};
  const prop = channel != null ? `ch${channel + 1}` : (cfg.type === 'switch_3ch' ? 'ch1' : 'on');
  const on = !!s[prop];
  // El nombre de cada canal (ej. "🔥 Estufa") ya trae su propio emoji — un ícono
  // genérico aparte se vería duplicado, así que el chip de canal no lleva uno.
  const label = channel != null ? (cfg.channels?.[channel] || devLabel(key, cfg)) : devLabel(key, cfg);
  const icoHtml = channel != null ? '' : `<span class="fav-chip-ico">${cfg.type === 'ac' ? '❄️' : cfg.type === 'switch' || cfg.type === 'switch_3ch' ? '🔌' : deviceIcon(key, '💡')}</span>`;
  return `<button type="button" class="fav-chip ${on ? 'on' : ''}" data-key="${key}" data-prop="${prop}" data-action="fav-toggle">
    ${icoHtml}<span class="fav-chip-label">${label}</span>
  </button>`;
}

function handleFavBarClick(e) {
  const chip = e.target.closest('[data-action="fav-toggle"]');
  if (!chip) return;
  const key  = chip.dataset.key;
  const prop = chip.dataset.prop;
  doCmd(key, { [prop]: !app.devices[key]?.[prop] });
  renderFavorites();
}

// ── MODO MANUAL (luces / enchufes) ───────────────────────────────────────────
function manualRow(key) {
  const manual = !!app._manual[key];
  return `<div class="manual-row">
    <span>${t('manualMode')}</span>
    <div class="toggle toggle-sm ${manual ? 'on' : ''}" data-key="${key}" data-action="toggle-manual"></div>
  </div>
  ${manual ? `<div class="manual-note">${t('manualNote')}</div>` : ''}`;
}

// ── MOTOR DE CORTINA DESBLOQUEADO ─────────────────────────────────────────────
// Solo se muestra si el hotel habilitó el modo manual para esta cortina
// (checkbox "Permitir modo manual" en el panel del hotel).
function unlockRow(key) {
  if (!app.config[key]?.manualUnlock) return '';
  const unlocked = !!app._unlocked[key];
  return `<div class="manual-row">
    <span>${t('unlockMotor')}</span>
    <div class="toggle toggle-sm ${unlocked ? 'on' : ''}" data-key="${key}" data-action="toggle-unlock"></div>
  </div>
  ${unlocked ? `<div class="manual-note">${t('unlockNoteOn')}</div>` : ''}`;
}

// ── RENDER GRID ────────────────────────────────────────────────────────────────
const CARD_ORDER = ['luz_techo','luz_velador2','led_cama','luz_velador1','cortina','enchufe'];

function renderGrid() {
  const grid = document.getElementById('device-grid');
  const securityKeys = securityDeviceKeys();
  // El enchufe (Estufa/Aromatizador) se inserta a mano junto a TV, no en su
  // posición de CARD_ORDER — ver más abajo.
  const keys = [
    ...CARD_ORDER.filter(k => app.config[k] && k !== 'enchufe'),
    ...Object.keys(app.config).filter(k => !CARD_ORDER.includes(k) && k !== 'enchufe' && !securityKeys.includes(k)),
  ];
  if (!keys.length) {
    grid.innerHTML = `
      <div class="support-card" style="text-align:center">
        <span class="support-card-ico">🛎️</span>
        <p>${t('noDevicesMsg')}</p>
        <button class="support-btn" onclick="switchView('support')">${t('noDevicesBtn')}</button>
      </div>` + buildTVCard() + (app.config.enchufe ? buildCard('enchufe') : '') + buildPlanFeatureCards();
    return;
  }
  // TV pareja con Cortina (misma fila en la grilla de 2 columnas), y el enchufe
  // (Estufa/Aromatizador) va justo después de TV — si no hay cortina, ambos
  // arrancan la grilla.
  const cards = keys.map(buildCard);
  const cortinaPos = keys.indexOf('cortina');
  cards.splice(cortinaPos >= 0 ? cortinaPos + 1 : cards.length, 0,
    buildTVCard() + (app.config.enchufe ? buildCard('enchufe') : ''));
  grid.innerHTML = cards.join('') + buildPlanFeatureCards();
}

function updateCard(key) {
  const cfg = app.config[key];
  // El enchufe inteligente se reparte en varias tarjetas (una por canal/función)
  // — hay que refrescarlas todas, no solo una, porque comparten estado (ej.
  // "Modo manual" es del dispositivo completo, no de un canal en particular).
  if (cfg && cfg.type === 'switch_3ch') {
    const chs = cfg.channels || ['Canal 1', 'Canal 2', 'Canal 3'];
    chs.forEach((label, i) => {
      const el = document.getElementById(`card-${key}-${i}`);
      if (el) el.outerHTML = buildSwitchChannelCard(key, i, label);
    });
    if (scenesConfigMode) renderScenesConfigGrid();
    return;
  }
  const el = document.getElementById(`card-${key}`);
  if (el) el.outerHTML = buildCard(key);
  if (enlargedKey === key) document.getElementById('enlarge-modal-body').innerHTML = buildCard(key);
  if (scenesConfigMode) renderScenesConfigGrid();
}

function buildCard(key) {
  const cfg = app.config[key];
  if (!cfg) return '';
  if (!cfg.available) return buildOfflineCard(key, cfg);
  switch (cfg.type) {
    case 'light':     return buildLightCard(key);
    case 'light_rgb': return buildLEDCard(key);
    case 'curtain':   return buildCurtainCard(key);
    case 'switch':    return buildSwitchCard(key);
    case 'switch_3ch':return buildSwitch3CHCard(key);
    case 'ac':        return buildACCard(key);
    default:          return '';
  }
}

function buildOfflineCard(key, cfg) {
  return `<div class="device-card offline" id="card-${key}">
    <div class="card-head">
      <div class="card-ico-name"><span class="card-ico">⚠️</span><span class="card-label">${devLabel(key, cfg)}</span></div>
    </div>
    <div class="offline-label">${t('offlineDevice')}</div>
    <div class="card-icons-row">${reportBtn(key)}${helpBtn(key)}</div>
  </div>`;
}

// ── LIGHT CARD ────────────────────────────────────────────────────────────────
function buildLightCard(key) {
  const s   = app.devices[key] || {};
  const cfg = app.config[key];
  const on  = s.on;
  const int = s.intensity ?? 50;
  const ct  = s.colorTemp ?? 50;
  const manual = !!app._manual[key];

  return `<div class="device-card ${on && !manual ? 'on' : ''}" id="card-${key}">
    <div class="card-head">
      <div class="card-ico-name"><span class="card-ico">${deviceIcon(key, '💡')}</span><span class="card-label">${devLabel(key, cfg)}</span></div>
    </div>
    <div class="card-status-row">
      <span class="card-status ${on && !manual ? 'on' : ''}">${manual ? t('manualMode') : (on ? t('onF') : t('offF'))}</span>
      <div class="toggle ${on ? 'on' : ''} ${manual ? 'disabled' : ''}" data-key="${key}" data-action="toggle-light"></div>
    </div>
    ${on && !manual ? `
      <div class="slider-lbl">${t('intensity')}</div>
      <div class="slider-row">
        <input type="range" min="5" max="100" value="${int}"
          data-key="${key}" data-action="intensity">
        <span class="slider-val">${int}%</span>
      </div>
      <div class="ct-row">
        <button class="ct-btn ${ct < 33 ? 'active' : ''}" data-key="${key}" data-ct="5">${t('warm')}</button>
        <button class="ct-btn ${ct >= 33 && ct < 66 ? 'active' : ''}" data-key="${key}" data-ct="50">${t('neutral')}</button>
        <button class="ct-btn ${ct >= 66 ? 'active' : ''}" data-key="${key}" data-ct="95">${t('cold')}</button>
      </div>` : ''}
    ${manualRow(key)}
    ${cardIconsRow(key, scheduleBtn(key))}
  </div>`;
}

// ── LED RGB CARD ──────────────────────────────────────────────────────────────
const WHEEL_RADIUS = 55; // radio medio del anillo: (70px outer + 40px inner) / 2

function buildLEDCard(key) {
  const s   = app.devices[key] || {};
  const cfg = app.config[key];
  const on  = s.on;
  const int = s.intensity ?? 50;
  const ct  = s.colorTemp ?? 50;
  const mode = s.mode ?? 'white';
  const hue  = s.hue ?? 0;
  const sat  = s.saturation ?? 1000;
  const wheelOpen = !!app._wheelOpen[key];
  const manual = !!app._manual[key];

  const isColour    = mode === 'colour';
  const colorPreview = `hsl(${hue}, 100%, 50%)`;

  // Posición del cursor sobre la rueda de color (hue=0 arriba, sentido horario)
  const r     = (sat / 1000) * WHEEL_RADIUS;
  const angle = (hue * Math.PI) / 180;
  const cx    = Math.sin(angle) * r;
  const cy    = -Math.cos(angle) * r;

  return `<div class="device-card ${on && !manual ? 'on' : ''}" id="card-${key}">
    <div class="card-head">
      <div class="card-ico-name"><span class="card-ico">${deviceIcon(key, '💡')}</span><span class="card-label">${devLabel(key, cfg)}</span></div>
    </div>
    <div class="card-status-row">
      <span class="card-status ${on && !manual ? 'on' : ''}">${manual ? t('manualMode') : (on ? t('onM') : t('offM'))}</span>
      <div class="toggle ${on ? 'on' : ''} ${manual ? 'disabled' : ''}" data-key="${key}" data-action="toggle-light"></div>
    </div>
    ${on && !manual ? `
      <div class="slider-lbl">${t('intensity')}</div>
      <div class="slider-row">
        <input type="range" min="5" max="100" value="${int}"
          data-key="${key}" data-action="intensity">
        <span class="slider-val">${int}%</span>
      </div>
      <div class="ct-row">
        <button class="ct-btn ${!isColour && ct < 33 ? 'active' : ''}" data-key="${key}" data-ct="5">${t('warm')}</button>
        <button class="ct-btn ${!isColour && ct >= 33 && ct < 66 ? 'active' : ''}" data-key="${key}" data-ct="50">${t('neutral')}</button>
        <button class="ct-btn ${!isColour && ct >= 66 ? 'active' : ''}" data-key="${key}" data-ct="95">${t('cold')}</button>
        <button class="ct-btn color-toggle-btn ${wheelOpen ? 'open' : ''}" data-key="${key}" data-action="toggle-wheel"
          style="${isColour ? `border-color:${colorPreview};color:${colorPreview}` : ''}">
          <span class="color-dot" style="background:${colorPreview}"></span> ${t('color')}
        </button>
      </div>
      ${wheelOpen ? `
      <div class="color-wheel-wrap">
        <div class="color-wheel" data-key="${key}" data-action="pick-color">
          <div class="color-wheel-cursor" style="transform: translate(${cx}px, ${cy}px); background:${colorPreview}"></div>
          <div class="color-wheel-center" style="background:${colorPreview}"></div>
        </div>
      </div>` : ''}` : ''}
    ${manualRow(key)}
    ${cardIconsRow(key, scheduleBtn(key))}
  </div>`;
}

// ── CURTAIN CARD ──────────────────────────────────────────────────────────────
function buildCurtainCard(key) {
  const s   = app.devices[key] || {};
  const cfg = app.config[key];
  const pos = s.position ?? 0;
  const lbl = pos === 0 ? t('curtainClosed') : pos === 100 ? t('curtainOpened') : t('curtainPct', { p: pos });
  const unlocked = !!app._unlocked[key];

  return `<div class="device-card" id="card-${key}">
    <div class="card-head">
      <div class="card-ico-name"><span class="card-ico">🪟</span><span class="card-label">${devLabel(key, cfg)}</span></div>
      <span class="card-status" style="margin:0">${unlocked ? t('manualShort') : lbl}</span>
    </div>
    <div class="curtain-vcontrol">
      <div class="curtain-vbtns">
        <button class="curtain-vbtn" data-key="${key}" data-curtain="open" ${unlocked ? 'disabled' : ''}>${t('curtainOpenBtn')}</button>
        <button class="curtain-vbtn stop-vbtn" data-key="${key}" data-curtain="stop" ${unlocked ? 'disabled' : ''}>${t('curtainStopBtn')}</button>
        <button class="curtain-vbtn" data-key="${key}" data-curtain="close" ${unlocked ? 'disabled' : ''}>${t('curtainCloseBtn')}</button>
      </div>
      <div class="curtain-vslider-wrap">
        <div class="curtain-vtrack">
          <input type="range" class="curtain-vslider" min="0" max="100" value="${pos}"
            data-key="${key}" data-action="curtain-pos" ${unlocked ? 'disabled' : ''}>
        </div>
        <span class="curtain-vval" id="curtain-val-${key}">${pos}%</span>
      </div>
    </div>
    ${unlockRow(key)}
    ${cardIconsRow(key, `<button type="button" class="report-btn" onclick="event.stopPropagation();scheduleCurtain('${key}')" aria-label="${t('scheduleBtn')}">🕐</button>`)}
  </div>`;
}

// ── SWITCH CARD ───────────────────────────────────────────────────────────────
function buildSwitchCard(key) {
  const s   = app.devices[key] || {};
  const cfg = app.config[key];
  const on  = s.on;
  const manual = !!app._manual[key];

  return `<div class="device-card ${on && !manual ? 'on' : ''}" id="card-${key}">
    <div class="card-head">
      <div class="card-ico-name"><span class="card-ico">${on ? '🔌' : '⬜'}</span><span class="card-label">${devLabel(key, cfg)}</span></div>
    </div>
    <div class="card-status-row">
      <span class="card-status ${on && !manual ? 'on' : ''}">${manual ? t('manualMode') : (on ? t('onM') : t('offM'))}</span>
      <div class="toggle ${on ? 'on' : ''} ${manual ? 'disabled' : ''}" data-key="${key}" data-action="toggle-switch"></div>
    </div>
    ${manualRow(key)}
    ${cardIconsRow(key, scheduleBtn(key))}
  </div>`;
}

// ── SWITCH MULTI-CANAL (2 o 3 canales) ───────────────────────────────────────
// El enchufe inteligente es el mecanismo, no el aparato — cada canal controla
// una función distinta (🔥 Estufa, 🌸 Aromatizador, etc.), así que cada uno se
// muestra como su propia tarjeta independiente (ícono+nombre+toggle), igual
// que un switch normal, en vez de agruparlos en una sola tarjeta con filas.
function buildSwitch3CHCard(key) {
  const cfg = app.config[key];
  const chs = cfg.channels || ['Canal 1', 'Canal 2', 'Canal 3'];
  return chs.map((label, i) => buildSwitchChannelCard(key, i, label)).join('');
}

function buildSwitchChannelCard(key, i, label) {
  const s = app.devices[key] || {};
  const vals = [s.ch1, s.ch2, s.ch3];
  const manual = !!app._manual[key];
  const on = !manual && vals[i];
  return `<div class="device-card ${on ? 'on' : ''}" id="card-${key}-${i}">
    <div class="card-head">
      <span class="card-label">${label}</span>
    </div>
    <div class="card-status-row">
      <span class="card-status ${on ? 'on' : ''}">${manual ? t('manualMode') : (vals[i] ? t('onM') : t('offM'))}</span>
      <div class="toggle ${vals[i] ? 'on' : ''} ${manual ? 'disabled' : ''}" data-key="${key}" data-action="toggle-ch${i + 1}"></div>
    </div>
    ${manualRow(key)}
    ${cardIconsRow(key, `<button type="button" class="report-btn" onclick="event.stopPropagation();scheduleChannel('${key}', ${i})" aria-label="${t('scheduleBtn')}">🕐</button>`, i)}
  </div>`;
}

// ── AC CARD ───────────────────────────────────────────────────────────────────
function buildACCard(key) {
  const s   = app.devices[key] || {};
  const cfg = app.config[key];
  const on  = s.on;
  const temp = s.temp ?? 22;

  return `<div class="device-card ${on ? 'on' : ''}" id="card-${key}">
    <div class="card-head">
      <div class="card-ico-name"><span class="card-ico">❄️</span><span class="card-label">${devLabel(key, cfg)}</span></div>
    </div>
    <div class="card-status-row">
      <span class="card-status ${on ? 'on' : ''}">${on ? t('onM') : t('offM')}</span>
      <div class="toggle ${on ? 'on' : ''}" data-key="${key}" data-action="toggle-ac"></div>
    </div>
    <div class="ac-temp-display">
      <div class="ac-temp-val ${on ? 'on' : ''}">${temp}°C</div>
    </div>
    <div class="ac-temp-btns">
      <button class="ac-btn" data-key="${key}" data-temp="-1" ${on ? '' : 'disabled'}>−</button>
      <span class="ac-range">16 – 30°C</span>
      <button class="ac-btn" data-key="${key}" data-temp="+1" ${on ? '' : 'disabled'}>+</button>
    </div>
    ${cardIconsRow(key, scheduleBtn(key))}
  </div>`;
}

// ── FUNCIONES DEL PLAN (placeholders no conectados a dispositivos reales) ────
const PLAN_FEATURES_INFO = {
  bathroom: { minPlan: 'max_comfort' },
  bidet:    { minPlan: 'max_comfort' },
  rug:      { minPlan: 'max_comfort' },
};

function buildPlanFeatureCards() {
  return [
    buildFeatureCard('bathroom', PLAN_FEATURES_INFO.bathroom, buildBathroomCard),
    buildFeatureCard('bidet',    PLAN_FEATURES_INFO.bidet,    buildBidetCard),
    buildFeatureCard('rug',      PLAN_FEATURES_INFO.rug,      buildRugCard),
  ].join('');
}

// Si la habitación no tiene el plan requerido, la función se oculta por
// completo (sin indicar que existe) para no exponer al huésped funciones
// no disponibles en su estadía.
function buildFeatureCard(key, info, builder) {
  if (planLevel(app.plan) >= planLevel(info.minPlan)) return builder();
  return '';
}

// ── TV ────────────────────────────────────────────────────────────────────────
function buildTVCard() {
  const s = app._placeholder.tv ?? (app._placeholder.tv = { on: false, vol: 30, source: 'cable' });
  const sources = [
    { id: 'cable',   label: t('tvCable') },
    { id: 'netflix', label: t('tvStreaming') },
    { id: 'hdmi',    label: t('tvHdmi') },
  ];
  return `<div class="device-card ${s.on ? 'on' : ''}" id="feature-tv">
    <div class="card-head">
      <div class="card-ico-name"><span class="card-ico">📺</span><span class="card-label">TV</span></div>
    </div>
    <div class="card-status-row">
      <span class="card-status ${s.on ? 'on' : ''}">${s.on ? t('onF') : t('offF')}</span>
      <div class="toggle ${s.on ? 'on' : ''}" data-feature="tv" data-action="toggle"></div>
    </div>
    ${s.on ? `
      <div class="slider-lbl">${t('volume')}</div>
      <div class="slider-row">
        <input type="range" min="0" max="100" value="${s.vol}" data-feature="tv" data-action="vol">
        <span class="slider-val">${s.vol}%</span>
      </div>
      <div class="source-row">
        ${sources.map(src => `<button class="source-btn ${s.source === src.id ? 'active' : ''}" data-feature="tv" data-action="source" data-source="${src.id}">${src.label}</button>`).join('')}
      </div>` : ''}
    ${featureIconsRow('tv')}
  </div>`;
}

// ── BAÑO INTELIGENTE (sensor de presencia + luz) ─────────────────────────────
function buildBathroomCard() {
  const s = app._placeholder.bathroom ?? (app._placeholder.bathroom = {
    presence: false, lightOn: false, intensity: 60, colorTemp: 50, auto: true, manual: false,
    mode: 'white', hue: 0, saturation: 1000,
  });
  const manual = !!s.manual;
  const isColour = s.mode === 'colour';
  const wheelOpen = !!app._wheelOpen.bathroom;
  const colorPreview = `hsl(${s.hue}, 100%, 50%)`;
  const r     = (s.saturation / 1000) * WHEEL_RADIUS;
  const angle = (s.hue * Math.PI) / 180;
  const cx    = Math.sin(angle) * r;
  const cy    = -Math.cos(angle) * r;
  return `<div class="device-card full-width ${s.lightOn ? 'on' : ''}" id="feature-bathroom">
    <div class="card-head">
      <div class="card-ico-name"><span class="card-ico">🚿</span><span class="card-label">${t('bathTitle')}</span></div>
    </div>
    <div class="card-status-row">
      <span class="card-status ${s.lightOn ? 'on' : ''}">${manual ? t('manualMode') : (s.lightOn ? t('lightOn') : t('lightOff'))}${s.auto && !manual ? t('bathAutoNote') : ''}</span>
      <div class="toggle ${s.lightOn ? 'on' : ''} ${manual ? 'disabled' : ''}" data-feature="bathroom" data-action="toggle"></div>
    </div>
    <div class="feature-row" data-action="presence" style="cursor:pointer">
      <span class="feature-row-label"><span class="led-dot ${s.presence ? 'on' : ''}"></span>${t('presenceSensor')}</span>
      <span class="preview-tag">${s.presence ? t('presenceYes') : t('presenceNo')}</span>
    </div>
    <div class="feature-row">
      <span class="feature-row-label">${t('bathAuto')}</span>
      <div class="toggle ${s.auto ? 'on' : ''} ${manual ? 'disabled' : ''}" data-feature="bathroom" data-action="auto"></div>
    </div>
    ${s.lightOn && !manual ? `
    <div class="slider-lbl">${t('intensity')}</div>
    <div class="slider-row">
      <input type="range" min="5" max="100" value="${s.intensity}" data-feature="bathroom" data-action="intensity">
      <span class="slider-val">${s.intensity}%</span>
    </div>
    <div class="ct-row">
      <button class="ct-btn ${!isColour && s.colorTemp < 33 ? 'active' : ''}" data-feature="bathroom" data-action="ct" data-ct="5">${t('warm')}</button>
      <button class="ct-btn ${!isColour && s.colorTemp >= 33 && s.colorTemp < 66 ? 'active' : ''}" data-feature="bathroom" data-action="ct" data-ct="50">${t('neutral')}</button>
      <button class="ct-btn ${!isColour && s.colorTemp >= 66 ? 'active' : ''}" data-feature="bathroom" data-action="ct" data-ct="95">${t('cold')}</button>
      <button class="ct-btn color-toggle-btn ${wheelOpen ? 'open' : ''}" data-feature="bathroom" data-action="toggle-wheel"
        style="${isColour ? `border-color:${colorPreview};color:${colorPreview}` : ''}">
        <span class="color-dot" style="background:${colorPreview}"></span> ${t('color')}
      </button>
    </div>
    ${wheelOpen ? `
    <div class="color-wheel-wrap">
      <div class="color-wheel" data-feature="bathroom" data-action="pick-color">
        <div class="color-wheel-cursor" style="transform: translate(${cx}px, ${cy}px); background:${colorPreview}"></div>
        <div class="color-wheel-center" style="background:${colorPreview}"></div>
      </div>
    </div>` : ''}` : ''}
    <div class="manual-row">
      <span>${t('manualMode')}</span>
      <div class="toggle toggle-sm ${manual ? 'on' : ''}" data-feature="bathroom" data-action="manual"></div>
    </div>
    ${manual ? `<div class="manual-note">${t('bathManualNote')}</div>` : ''}
    ${featureIconsRow('bathroom')}
  </div>`;
}

// ── BAÑO JAPONÉS (bidé inteligente) ──────────────────────────────────────────
// Solo expone el asiento calefaccionado; el resto se opera desde el panel físico.
function buildBidetCard() {
  const s = app._placeholder.bidet ?? (app._placeholder.bidet = { on: false });
  return `<div class="device-card ${s.on ? 'on' : ''}" id="feature-bidet">
    <div class="card-head">
      <div class="card-ico-name"><span class="card-ico">🚽</span><span class="card-label">${t('bidetTitle')}</span></div>
    </div>
    <div class="card-status-row">
      <span class="card-status ${s.on ? 'on' : ''}">${s.on ? t('heatedSeatOn') : t('heatedSeatOff')}</span>
      <div class="toggle ${s.on ? 'on' : ''}" data-feature="bidet" data-action="toggle"></div>
    </div>
    <p class="form-note" style="margin:0 0 10px">${t('bidetPanelNote')}</p>
    ${featureIconsRow('bidet')}
  </div>`;
}

// ── ALFOMBRA CALEFACCIONABLE ──────────────────────────────────────────────────
function buildRugCard() {
  const s = app._placeholder.rug ?? (app._placeholder.rug = { on: false, level: 'media' });
  const levels = [{ id: 'baja', label: t('low') }, { id: 'media', label: t('medium') }, { id: 'alta', label: t('high') }];
  return `<div class="device-card ${s.on ? 'on' : ''}" id="feature-rug">
    <div class="card-head">
      <div class="card-ico-name"><span class="card-ico">🔥</span><span class="card-label">${t('rugTitle')}</span></div>
    </div>
    <div class="card-status-row">
      <span class="card-status ${s.on ? 'on' : ''}">${s.on ? t('onF') : t('offF')}</span>
      <div class="toggle ${s.on ? 'on' : ''}" data-feature="rug" data-action="toggle"></div>
    </div>
    ${s.on ? `
    <div class="level-row">
      ${levels.map(l => `<button class="level-btn ${s.level === l.id ? 'active' : ''}" data-feature="rug" data-action="level" data-level="${l.id}">${l.label}</button>`).join('')}
    </div>` : ''}
    ${featureIconsRow('rug')}
  </div>`;
}

// ── VISTA CLIMA (AC + sensor de ventana + automatizaciones, Premium+) ────────
function buildClimateACCard() {
  const s = app._placeholder.climate;
  return `<div class="device-card ${s.acOn ? 'on' : ''}" id="feature-climateAc">
    <div class="card-head">
      <div class="card-ico-name"><span class="card-ico">❄️</span><span class="card-label">${t('acTitle')}</span></div>
      <div class="toggle ${s.acOn ? 'on' : ''}" data-feature="climate" data-action="ac-toggle"></div>
    </div>
    <div class="ac-temp-display"><div class="ac-temp-val ${s.acOn ? 'on' : ''}">${s.temp}°C</div></div>
    <div class="ac-temp-btns">
      <button class="ac-btn" data-feature="climate" data-action="ac-temp" data-delta="-1" ${s.acOn ? '' : 'disabled'}>−</button>
      <span class="ac-range">16 – 30°C</span>
      <button class="ac-btn" data-feature="climate" data-action="ac-temp" data-delta="1" ${s.acOn ? '' : 'disabled'}>+</button>
    </div>
    ${featureIconsRow('climateAc')}
  </div>`;
}

function buildClimateAutoCard() {
  const s = app._placeholder.climate;
  return `<div class="device-card full-width" id="feature-climateAuto">
    <div class="card-head">
      <div class="card-ico-name"><span class="card-ico">⚙️</span><span class="card-label">${t('autoOffTitle')}</span></div>
      <div class="toggle ${s.autoOff ? 'on' : ''}" data-feature="climate" data-action="auto-toggle"></div>
    </div>
    <div class="card-status">${t('autoOffDesc')}</div>
    ${featureIconsRow('climateAuto')}
  </div>`;
}

function renderClimateView() {
  const el = document.getElementById('climate-content');

  // Sin plan Premium+ esta vista no es accesible (el nav-item está oculto),
  // pero se deja vacía por seguridad si se llegara a invocar.
  if (planLevel(app.plan) < PLAN_TIERS.premium) {
    el.innerHTML = '';
    return;
  }

  app._placeholder.climate ?? (app._placeholder.climate = { acOn: false, temp: 22, autoOff: true });

  el.innerHTML = `
    <div class="section-label">${t('acSection')}</div>
    <div class="device-grid">${buildClimateACCard()}</div>
    <div class="section-label" style="margin-top:18px">${t('autoSection')}</div>
    <div class="device-grid">${buildClimateAutoCard()}</div>
  `;

  // Si una de estas tarjetas está agrandada, refrescar también el modal —
  // mismo criterio que rerenderFeature() para tv/baño/bidé/alfombra.
  if (['climateAc', 'climateAuto'].includes(enlargedKey)) {
    document.getElementById('enlarge-modal-body').innerHTML = PLACEHOLDER_BUILDERS[enlargedKey]();
  }
}

// ── EVENTOS: FUNCIONES DEL PLAN (placeholders) ───────────────────────────────
// Mismo mapa que usan openEnlargeModal()/featureOrDeviceLabel() para que las
// "funciones del plan" (no son dispositivos Tuya reales, viven en
// app._placeholder en vez de app.config) tengan ayuda/reportar/agrandar igual
// que cualquier tarjeta de Controles.
const PLACEHOLDER_BUILDERS = {
  tv: buildTVCard, bathroom: buildBathroomCard, bidet: buildBidetCard, rug: buildRugCard,
  climateAc: buildClimateACCard, climateAuto: buildClimateAutoCard,
};
const PLACEHOLDER_TITLE_KEY = {
  tv: null, bathroom: 'bathTitle', bidet: 'bidetTitle', rug: 'rugTitle',
  climateAc: 'acTitle', climateAuto: 'autoOffTitle',
};
const HELP_TEXT_BY_FEATURE = {
  tv: 'helpTextTV', bathroom: 'helpTextBathroom', bidet: 'helpTextBidet', rug: 'helpTextRug',
  climateAc: 'helpTextAC', climateAuto: 'helpTextClimateAuto',
};

function featureOrDeviceLabel(key) {
  if (app.config[key]) return devLabel(key, app.config[key]);
  if (key in PLACEHOLDER_TITLE_KEY) return PLACEHOLDER_TITLE_KEY[key] ? t(PLACEHOLDER_TITLE_KEY[key]) : 'TV';
  return key;
}

function rerenderFeature(key) {
  const el = document.getElementById(`feature-${key}`);
  if (el && PLACEHOLDER_BUILDERS[key]) el.outerHTML = PLACEHOLDER_BUILDERS[key]();
  if (enlargedKey === key) document.getElementById('enlarge-modal-body').innerHTML = PLACEHOLDER_BUILDERS[key]();
}

function showPreviewToast() {
  showToast(t('toastPreview'), '');
}

function handlePlanGridClick(e) {
  const tog = e.target.closest('[data-action="toggle"]');
  if (tog) {
    const key = tog.dataset.feature;
    const s = app._placeholder[key];
    if (key === 'bathroom') s.lightOn = !s.lightOn;
    else s.on = !s.on;
    rerenderFeature(key);
    showPreviewToast();
    return;
  }

  const bathroomManual = e.target.closest('[data-feature="bathroom"][data-action="manual"]');
  if (bathroomManual) {
    const s = app._placeholder.bathroom;
    s.manual = !s.manual;
    if (s.manual) {
      // En modo manual la luz queda fija encendida en cálido: el interruptor
      // físico la enciende/apaga como una luz normal.
      s.lightOn = true;
      s.colorTemp = 5;
    }
    rerenderFeature('bathroom');
    showPreviewToast();
    return;
  }

  const bathroomAuto = e.target.closest('[data-feature="bathroom"][data-action="auto"]');
  if (bathroomAuto) {
    app._placeholder.bathroom.auto = !app._placeholder.bathroom.auto;
    rerenderFeature('bathroom');
    showPreviewToast();
    return;
  }

  const bathroomCt = e.target.closest('[data-feature="bathroom"][data-action="ct"]');
  if (bathroomCt) {
    app._placeholder.bathroom.colorTemp = parseInt(bathroomCt.dataset.ct);
    app._placeholder.bathroom.mode = 'white';
    app._wheelOpen.bathroom = false; // cerrar la rueda de color al elegir temperatura
    rerenderFeature('bathroom');
    showPreviewToast();
    return;
  }

  // Mismo selector de color que las luces RGB reales, pero sobre el placeholder.
  const bathroomWheelBtn = e.target.closest('[data-feature="bathroom"][data-action="toggle-wheel"]');
  if (bathroomWheelBtn) {
    const s = app._placeholder.bathroom;
    const wasOpen = !!app._wheelOpen.bathroom;
    app._wheelOpen.bathroom = !wasOpen;
    if (!wasOpen && s.mode !== 'colour') {
      s.mode = 'colour';
      s.lightOn = true;
    }
    rerenderFeature('bathroom');
    showPreviewToast();
    return;
  }


  const presence = e.target.closest('[data-action="presence"]');
  if (presence) {
    app._placeholder.bathroom.presence = !app._placeholder.bathroom.presence;
    rerenderFeature('bathroom');
    showPreviewToast();
    return;
  }

  const src = e.target.closest('[data-action="source"]');
  if (src) {
    app._placeholder.tv.source = src.dataset.source;
    rerenderFeature('tv');
    showPreviewToast();
    return;
  }

  const level = e.target.closest('[data-action="level"]');
  if (level) {
    app._placeholder.rug.level = level.dataset.level;
    rerenderFeature('rug');
    showPreviewToast();
    return;
  }

  const acTog = e.target.closest('[data-action="ac-toggle"]');
  if (acTog) {
    app._placeholder.climate.acOn = !app._placeholder.climate.acOn;
    renderClimateView();
    showPreviewToast();
    return;
  }

  const acTemp = e.target.closest('[data-action="ac-temp"]');
  if (acTemp && !acTemp.disabled) {
    const s = app._placeholder.climate;
    s.temp = Math.min(30, Math.max(16, s.temp + parseInt(acTemp.dataset.delta)));
    renderClimateView();
    showPreviewToast();
    return;
  }

  const autoTog = e.target.closest('[data-action="auto-toggle"]');
  if (autoTog) {
    app._placeholder.climate.autoOff = !app._placeholder.climate.autoOff;
    renderClimateView();
    showPreviewToast();
    return;
  }
}

function handlePlanGridInput(e) {
  const vol = e.target.closest('input[data-feature="tv"][data-action="vol"]');
  if (vol) {
    const val = parseInt(vol.value);
    const valEl = vol.parentElement?.querySelector('.slider-val');
    if (valEl) valEl.textContent = val + '%';
    app._placeholder.tv.vol = val;
    return;
  }

  const intensity = e.target.closest('input[data-feature="bathroom"][data-action="intensity"]');
  if (intensity) {
    const val = parseInt(intensity.value);
    const valEl = intensity.parentElement?.querySelector('.slider-val');
    if (valEl) valEl.textContent = val + '%';
    app._placeholder.bathroom.intensity = val;
    return;
  }
}

// ── EVENT: CLICK EN EL GRID ───────────────────────────────────────────────────
function handleGridClick(e) {
  // Reportar un problema con el dispositivo
  const reportBtnEl = e.target.closest('[data-action="report-problem"]');
  if (reportBtnEl) { openReportModal(reportBtnEl.dataset.key); return; }

  // Marcar/desmarcar favorito (acceso directo)
  const favBtnEl = e.target.closest('[data-action="toggle-favorite"]');
  if (favBtnEl) {
    const key = favBtnEl.dataset.key;
    const channel = favBtnEl.dataset.channel;
    const favId = channel !== undefined ? `${key}:${channel}` : key;
    const idx = app.favorites.indexOf(favId);
    if (idx >= 0) {
      app.favorites.splice(idx, 1);
    } else {
      if (app.favorites.length >= FAV_MAX) {
        showToast(t('toastFavMax'), '');
        return;
      }
      app.favorites.push(favId);
    }
    saveFavorites();
    updateCard(key);
    renderFavorites();
    return;
  }

  // Modo manual (luces / enchufes)
  const manualTog = e.target.closest('[data-action="toggle-manual"]');
  if (manualTog) {
    const key = manualTog.dataset.key;
    app._manual[key] = !app._manual[key];
    const type = app.config[key]?.type;
    if (app._manual[key] && (type === 'light' || type === 'light_rgb')) {
      // En modo manual la luz queda fija encendida en cálido: el interruptor
      // físico la enciende/apaga como una luz normal.
      doCmd(key, { on: true, mode: 'white', colorTemp: 5 });
    } else {
      updateCard(key);
    }
    showToast(app._manual[key] ? t('toastManualOn') : t('toastManualOff'), '');
    return;
  }

  // Motor de cortina desbloqueado (manual)
  const unlockTog = e.target.closest('[data-action="toggle-unlock"]');
  if (unlockTog) {
    const key = unlockTog.dataset.key;
    app._unlocked[key] = !app._unlocked[key];
    updateCard(key);
    showToast(app._unlocked[key] ? t('toastUnlockOn') : t('toastUnlockOff'), '');
    return;
  }

  // Armar/desarmar alarma de un sensor de puerta/ventana (pestaña Seguridad)
  const sensorAlarmTog = e.target.closest('[data-action="toggle-sensor-alarm"]');
  if (sensorAlarmTog) {
    toggleSensorAlarm(sensorAlarmTog.dataset.key);
    return;
  }

  // Toggle genérico de luz/LED
  const tog = e.target.closest('[data-action^="toggle-light"]');
  if (tog) {
    const key = tog.dataset.key;
    doCmd(key, { on: !app.devices[key]?.on });
    return;
  }

  // Toggle de enchufe
  const sw = e.target.closest('[data-action="toggle-switch"]');
  if (sw) { doCmd(sw.dataset.key, { on: !app.devices[sw.dataset.key]?.on }); return; }

  // Toggle AC
  const ac = e.target.closest('[data-action="toggle-ac"]');
  if (ac) { doCmd(ac.dataset.key, { on: !app.devices[ac.dataset.key]?.on }); return; }

  // Toggle canales switch_3ch
  ['1','2','3'].forEach(n => {
    const ch = e.target.closest(`[data-action="toggle-ch${n}"]`);
    if (ch) {
      const key = ch.dataset.key;
      const prop = `ch${n}`;
      doCmd(key, { [prop]: !app.devices[key]?.[prop] });
    }
  });

  // Color temp buttons
  const ctBtn = e.target.closest('[data-ct]');
  if (ctBtn) {
    const key = ctBtn.dataset.key;
    const ct  = parseInt(ctBtn.dataset.ct);
    const cmd = { colorTemp: ct, mode: 'white' };
    if (!app.devices[key]?.on) cmd.on = true;
    app._wheelOpen[key] = false; // cerrar la rueda de color al elegir temperatura
    doCmd(key, cmd);
    return;
  }

  // Botones de cortina (open/stop/close) — la barra se anima gradualmente, ver curtainControl()
  const cBtn = e.target.closest('[data-curtain]');
  if (cBtn) {
    curtainControl(cBtn.dataset.key, cBtn.dataset.curtain);
    return;
  }

  // Toggle del selector de color (rueda)
  const wheelBtn = e.target.closest('[data-action="toggle-wheel"]');
  if (wheelBtn) {
    const key = wheelBtn.dataset.key;
    const wasOpen   = !!app._wheelOpen[key];
    const isColour  = app.devices[key]?.mode === 'colour';
    app._wheelOpen[key] = !wasOpen;

    // Al abrir la rueda, activar modo color de inmediato (deselecciona Cálido/Neutro/Frío)
    if (!wasOpen && !isColour) {
      const hue = app.devices[key]?.hue ?? 0;
      const sat = app.devices[key]?.saturation ?? 1000;
      doCmd(key, { on: true, hue, saturation: sat, mode: 'colour' });
    } else {
      updateCard(key);
    }
    return;
  }

  // AC +/−
  const acBtn = e.target.closest('[data-temp]');
  if (acBtn && !acBtn.disabled) {
    const key    = acBtn.dataset.key;
    const delta  = parseInt(acBtn.dataset.temp);
    const newTemp = Math.min(30, Math.max(16, (app.devices[key]?.temp ?? 22) + delta));
    doCmd(key, { temp: newTemp });
    return;
  }

  // Click en el fondo de la tarjeta (no en un control interactivo) → modal ampliado
  const cardEl = e.target.closest('.device-card');
  if (cardEl && !e.target.closest('button, input, label, select, [data-action], [data-curtain], [data-ct], [data-temp]')) {
    const raw = cardEl.id.replace(/^(card-|feature-)/, '');
    if (raw) openEnlargeModal(raw);
  }
}

// ── EVENT: INPUT EN EL GRID (sliders) ────────────────────────────────────────
function handleGridInput(e) {
  // Slider de intensidad
  const intSlider = e.target.closest('input[data-action="intensity"]');
  if (intSlider) {
    const key = intSlider.dataset.key;
    const val = parseInt(intSlider.value);
    // Actualizar display inmediatamente
    const valEl = intSlider.parentElement?.querySelector('.slider-val');
    if (valEl) valEl.textContent = val + '%';
    // Debounce a 250ms
    clearTimeout(app._timers[`int-${key}`]);
    app._timers[`int-${key}`] = setTimeout(() => doCmd(key, { intensity: val }), 250);
    return;
  }

  // Slider de posición de cortina
  const curtainSlider = e.target.closest('input[data-action="curtain-pos"]');
  if (curtainSlider) {
    const key = curtainSlider.dataset.key;
    stopCurtainAnim(key); // el huésped toma control manual — cancela cualquier animación en curso
    const pos = parseInt(curtainSlider.value);
    const valEl = document.getElementById(`curtain-val-${key}`);
    if (valEl) valEl.textContent = pos + '%';
    clearTimeout(app._timers[`curtain-${key}`]);
    app._timers[`curtain-${key}`] = setTimeout(() => {
      app.devices[key].position = pos;
      doCmd(key, { position: pos });
    }, 250);
  }
}

// ── COLOR WHEEL DRAG ─────────────────────────────────────────────────────────
// Permite arrastrar el cursor sobre el anillo para cambiar el color en tiempo real.
// Usa PointerEvents (captura mouse + touch con una sola API).
let _wheelDragging = false;

function applyColorFromWheel(wheel, clientX, clientY) {
  const rect = wheel.getBoundingClientRect();
  const dx = clientX - (rect.left + rect.width / 2);
  const dy = clientY - (rect.top  + rect.height / 2);
  let hue = Math.atan2(dx, -dy) * (180 / Math.PI);
  if (hue < 0) hue += 360;
  hue = Math.round(hue);

  // Actualizar cursor y centro optimistamente sin esperar re-render
  const cursor = wheel.querySelector('.color-wheel-cursor');
  const center = wheel.querySelector('.color-wheel-center');
  const color  = `hsl(${hue}, 100%, 50%)`;
  const angle  = (hue * Math.PI) / 180;
  const cx = Math.sin(angle) * WHEEL_RADIUS;
  const cy = -Math.cos(angle) * WHEEL_RADIUS;
  if (cursor) cursor.style.transform = `translate(${cx}px, ${cy}px)`;
  if (center) center.style.background = color;
  if (cursor) cursor.style.background = color;

  // Enviar comando (con debounce propio de doCmd)
  const key     = wheel.dataset.key;
  const feature = wheel.dataset.feature;
  if (key) {
    clearTimeout(app._timers[`wheel-${key}`]);
    app._timers[`wheel-${key}`] = setTimeout(
      () => doCmd(key, { on: true, hue, saturation: 1000, mode: 'colour' }), 80
    );
  } else if (feature === 'bathroom') {
    clearTimeout(app._timers['wheel-bathroom']);
    app._timers['wheel-bathroom'] = setTimeout(
      () => setBathroomColor(hue), 80
    );
  }
}

function setBathroomColor(hue) {
  const s = app._placeholder.bathroom;
  s.hue = hue; s.saturation = 1000; s.mode = 'colour'; s.lightOn = true;
  rerenderFeature('bathroom');
  showPreviewToast();
}

function setupColorWheelDrag(container) {
  container.addEventListener('pointerdown', e => {
    const wheel = e.target.closest('[data-action="pick-color"]');
    if (!wheel) return;
    _wheelDragging = true;
    wheel.setPointerCapture(e.pointerId);
    applyColorFromWheel(wheel, e.clientX, e.clientY);
  });
  container.addEventListener('pointermove', e => {
    if (!_wheelDragging) return;
    const wheel = e.target.closest('[data-action="pick-color"]');
    if (!wheel) return;
    applyColorFromWheel(wheel, e.clientX, e.clientY);
  });
  container.addEventListener('pointerup',    () => { _wheelDragging = false; });
  container.addEventListener('pointercancel',() => { _wheelDragging = false; });
}

// ── ESCENAS ───────────────────────────────────────────────────────────────────
function renderScenes() {
  const grid = document.getElementById('scenes-grid');
  grid.innerHTML = getSceneList().map(scene => {
    const titleEsc = scene.title.replace(/'/g, "\\'");
    const scheduleAction = `<button class="scene-action-btn" onclick="event.stopPropagation();scheduleScene('${scene.id}')" title="${t('scheduleBtn')}" aria-label="${t('scheduleBtn')}">🕐</button>`;
    const helpAction = `<button class="scene-action-btn" onclick="event.stopPropagation();openSceneHelpModal()" title="${t('helpBtn')}" aria-label="${t('helpBtn')}">❓</button>`;
    const reportAction = `<button class="scene-action-btn" onclick="event.stopPropagation();reportSceneProblem('${titleEsc}')" title="${t('reportProblemBtn')}" aria-label="${t('reportProblemBtn')}">⚠️</button>`;
    const actions = (scene.isCustom
      ? `<button class="scene-action-btn" data-scene-action="edit"   data-scene="${scene.id}" title="${t('sceneEditTitle')}"   aria-label="${t('sceneEditTitle')}">✏️</button>
         <button class="scene-action-btn" data-scene-action="delete" data-scene="${scene.id}" title="${t('sceneDeleteTitle')}" aria-label="${t('sceneDeleteTitle')}">🗑️</button>`
      : `<button class="scene-action-btn" data-scene-action="edit" data-scene="${scene.id}" title="${t('sceneEditTitle')}" aria-label="${t('sceneEditTitle')}">✏️</button>
         ${scene.hasOverride ? `<button class="scene-action-btn" data-scene-action="reset" data-scene="${scene.id}" title="${t('sceneResetTitle')}" aria-label="${t('sceneResetTitle')}">↺</button>` : ''}`) + scheduleAction + helpAction + reportAction;

    // div, no button: el botón externo no puede contener los botones internos
    // de editar/eliminar (✏️/🗑️/↺) — un <button> dentro de otro <button> es
    // inválido en HTML5 y el navegador cierra el externo antes de tiempo,
    // dejando ícono/título/descripción como hijos sueltos de la grilla.
    return `<div class="scene-card" role="button" tabindex="0" data-scene="${scene.id}" aria-label="${scene.title}">
      <span class="scene-card-ico">${scene.icon}</span>
      <span class="scene-card-title">${scene.title}</span>
      <span class="scene-card-desc">${scene.desc}</span>
      <div class="scene-card-actions">${actions}</div>
    </div>`;
  }).join('');
}

window.openSceneHelpModal = function() {
  document.getElementById('help-modal-title').textContent = t('sceneHelpTitle');
  document.getElementById('help-modal-body').textContent = t('sceneHelpText');
  document.getElementById('help-modal-overlay').classList.remove('hidden');
};

window.reportSceneProblem = function(sceneTitle) {
  const note = (window.prompt(t('reportSceneProblemPrompt', { name: sceneTitle })) || '').trim();
  if (!note) return;
  sendServiceRequest('maintenance', t('reportSceneProblemNote', { name: sceneTitle, note }));
};

function handleSceneGridClick(e) {
  const actionBtn = e.target.closest('[data-scene-action]');
  if (actionBtn) {
    e.stopPropagation();
    const id = actionBtn.dataset.scene;
    const action = actionBtn.dataset.sceneAction;
    if (action === 'edit')   return expandScenesConfig(id);
    if (action === 'delete') return confirmDeleteScene(id);
    if (action === 'reset')  return confirmDeleteScene(id);
    return;
  }
  const card = e.target.closest('.scene-card');
  if (card) applyScene(card.dataset.scene);
}

// .scene-card ya no es un <button> nativo (ver renderScenes) — se restaura
// la activación por teclado (Enter/Espacio) que el navegador daba gratis.
function handleSceneGridKeydown(e) {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  const card = e.target.closest('.scene-card');
  if (!card) return;
  e.preventDefault();
  applyScene(card.dataset.scene);
}

async function applyScene(sceneId) {
  const steps = getSceneSteps(sceneId);
  if (!steps) return;

  const btn = document.querySelector(`.scene-card[data-scene="${sceneId}"]`);
  if (btn) btn.classList.add('loading');

  // Filtrar solo los dispositivos que existen en esta habitación
  const validSteps = steps.filter(({ dev }) => app.config[dev]);

  // Optimistic: aplicar estados localmente
  validSteps.forEach(({ dev, cmd, optimistic }) => {
    Object.assign(app.devices[dev], cmd, optimistic || {});
  });
  renderGrid();

  try {
    await Promise.all(validSteps.map(({ dev, cmd }) => apiCommand(dev, cmd)));
    showToast(t('toastScene'), 'success');
  } catch {
    showToast(t('toastSceneFail'), 'error');
  } finally {
    if (btn) btn.classList.remove('loading');
  }
}

// Guarda el estado actual de la habitación como pasos de una escena (nueva o existente)
async function apiSaveScene(payload) {
  if (window.location.protocol === 'file:') return { success: true, id: payload.id || `custom_${Date.now()}` };
  const res = await fetch(`${API}/room/${app.token}/scenes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('SAVE_SCENE_FAILED');
  return res.json();
}

async function apiDeleteScene(id) {
  if (window.location.protocol === 'file:') return { success: true };
  const res = await fetch(`${API}/room/${app.token}/scenes/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('DELETE_SCENE_FAILED');
  return res.json();
}

// ── CONTROLES EMBEBIDOS EN ESCENAS (ajustar y guardar sin cambiar de pestaña) ──
// null cuando está colapsado; 'create' al crear una escena nueva; el id de la
// escena cuando se está editando una existente.
let scenesConfigMode = null;

function scenesConfigDeviceKeys() {
  const securityKeys = securityDeviceKeys();
  return [
    ...CARD_ORDER.filter(k => app.config[k]),
    ...Object.keys(app.config).filter(k => !CARD_ORDER.includes(k) && !securityKeys.includes(k)),
  ];
}

function renderScenesConfigGrid() {
  document.getElementById('scenes-device-grid').innerHTML = scenesConfigDeviceKeys().map(buildCard).join('');
}

function expandScenesConfig(mode) {
  scenesConfigMode = mode;
  const isEdit = mode !== 'create';
  const scene = isEdit ? getSceneList().find(s => s.id === mode) : null;
  document.getElementById('scenes-config-label').textContent = t('scenesConfigLabel');
  document.getElementById('scenes-config-hint').textContent = isEdit
    ? t('scenesConfigHintEdit', { name: scene?.title || '' })
    : t('scenesConfigHintCreate');
  document.getElementById('scenes-config-save-btn').textContent = isEdit
    ? t('scenesConfigSaveEdit', { name: scene?.title || '' })
    : t('scenesConfigSaveCreate');
  renderScenesConfigGrid();
  const section = document.getElementById('scenes-config-section');
  section.classList.remove('hidden');
  section.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function collapseScenesConfig() {
  scenesConfigMode = null;
  document.getElementById('scenes-config-section').classList.add('hidden');
}

// Botón "Guardar" dentro de la sección expandida — crea (abre el modal de
// nombre/ícono de siempre) o sobrescribe una escena existente directamente.
async function saveScenesConfig() {
  if (scenesConfigMode === 'create') {
    openSceneModal();
    return;
  }
  const id = scenesConfigMode;
  const scene = getSceneList().find(s => s.id === id);
  if (!scene) return;
  const steps = captureSceneSteps();
  try {
    await apiSaveScene({ id, name: scene.title, icon: scene.icon, steps });
    if (!app.scenes[id]) app.scenes[id] = {};
    app.scenes[id].steps = steps;
    if (scene.isCustom) {
      app.scenes[id].name = scene.title;
      app.scenes[id].icon = scene.icon;
    }
    renderScenes();
    collapseScenesConfig();
    showToast(t('toastSceneSaved'), 'success');
  } catch {
    showToast(t('toastSceneSaveFail'), 'error');
  }
}

// Elimina una escena personalizada, o restaura una escena por defecto a su configuración original
async function confirmDeleteScene(id) {
  const scene = getSceneList().find(s => s.id === id);
  if (!scene) return;
  const msg = scene.isCustom ? t('sceneDeleteConfirm', { name: scene.title }) : t('sceneResetConfirm', { name: scene.title });
  if (!confirm(msg)) return;

  try {
    await apiDeleteScene(id);
    delete app.scenes[id];
    renderScenes();
    showToast(t('toastSceneDeleted'), 'success');
  } catch {
    showToast(t('toastSceneDeleteFail'), 'error');
  }
}

// ── MODAL: NUEVA ESCENA ───────────────────────────────────────────────────────
let sceneModalIcon = SCENE_ICON_CHOICES[0];

function openSceneModal() {
  const nameInput = document.getElementById('scene-name-input');
  nameInput.value = '';
  sceneModalIcon = SCENE_ICON_CHOICES[0];

  const picker = document.getElementById('scene-icon-picker');
  picker.innerHTML = SCENE_ICON_CHOICES.map((ico, i) =>
    `<button type="button" class="scene-icon-opt ${i === 0 ? 'active' : ''}" data-icon="${ico}">${ico}</button>`
  ).join('');
  picker.querySelectorAll('.scene-icon-opt').forEach(btn => {
    btn.addEventListener('click', () => {
      picker.querySelectorAll('.scene-icon-opt').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      sceneModalIcon = btn.dataset.icon;
    });
  });

  document.getElementById('scene-modal-overlay').classList.remove('hidden');
  nameInput.focus();
}

function closeSceneModal() {
  document.getElementById('scene-modal-overlay').classList.add('hidden');
}

async function saveNewScene() {
  const name = document.getElementById('scene-name-input').value.trim();
  if (!name) {
    showToast(t('toastSceneNameRequired'), 'error');
    return;
  }
  const customCount = Object.keys(app.scenes).filter(id => !DEFAULT_SCENE_IDS.includes(id)).length;
  if (customCount >= 6) {
    showToast(t('toastSceneMax'), 'error');
    return;
  }

  const steps = captureSceneSteps();
  try {
    const result = await apiSaveScene({ name, icon: sceneModalIcon, steps });
    app.scenes[result.id] = { name, icon: sceneModalIcon, steps };
    renderScenes();
    closeSceneModal();
    collapseScenesConfig();
    showToast(t('toastSceneSaved'), 'success');
  } catch {
    showToast(t('toastSceneSaveFail'), 'error');
  }
}

// ── RELOJ EN TIEMPO REAL ──────────────────────────────────────────────────────
function startClock(checkoutDate) {
  const clockEl     = document.getElementById('live-clock');
  const countdownEl = document.getElementById('checkout-countdown');
  const coInfoEl    = document.getElementById('checkout-info');

  function tick() {
    const now  = new Date();
    const diff = checkoutDate - now; // ms

    // Hora actual (24 h para evitar confusión con a.m./p.m.)
    clockEl.textContent = now.toLocaleTimeString('es-CL', {
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
    });

    if (diff > 0) {
      const d  = Math.floor(diff / 86_400_000);
      const h  = Math.floor((diff % 86_400_000) / 3_600_000);
      const m  = Math.floor((diff % 3_600_000)  / 60_000);
      const s  = Math.floor((diff % 60_000)      / 1_000);

      if (diff > 86_400_000) {
        // Más de 24 h → mostrar días para que se entienda de inmediato
        countdownEl.textContent = t('cdLeft', { t: `${d}d ${h}h ${m}m` });
        countdownEl.className   = 'countdown ok';
        coInfoEl.className      = 'checkout-info';
      } else if (diff > 14_400_000) {
        // 4 h – 24 h
        countdownEl.textContent = t('cdLeft', { t: `${h}h ${m}m` });
        countdownEl.className   = 'countdown ok';
        coInfoEl.className      = 'checkout-info';
      } else if (diff > 1_800_000) {
        // 30 min – 4 h
        countdownEl.textContent = t('cdLeft', { t: `${h > 0 ? h + 'h ' : ''}${m}m` });
        countdownEl.className   = 'countdown soon';
        coInfoEl.className      = 'checkout-info soon';
      } else {
        // Menos de 30 min — urgente con segundos
        countdownEl.textContent = t('cdLeft', { t: `${m}m ${s}s` });
        countdownEl.className   = 'countdown urgent';
        coInfoEl.className      = 'checkout-info soon';
      }
    } else {
      // Pasó el checkout
      const over = Math.abs(diff);
      const oh   = Math.floor(over / 3_600_000);
      const om   = Math.floor((over % 3_600_000) / 60_000);
      const os   = Math.floor((over % 60_000)    / 1_000);

      countdownEl.textContent = oh > 0
        ? t('cdOverdue', { t: `${oh}h ${om}m` })
        : om > 0
          ? t('cdOverdue', { t: `${om}m ${os}s` })
          : t('cdNow');
      countdownEl.className = 'countdown expired';
      coInfoEl.className    = 'checkout-info urgent';
    }
  }

  tick();
  setInterval(tick, 1000);
}

// ── CHECKOUT BUTTON ───────────────────────────────────────────────────────────
document.addEventListener('click', e => {
  if (e.target.closest('.checkout-btn')) {
    alert(t('checkoutMsg'));
  }
});

// ── ERROR SCREENS ─────────────────────────────────────────────────────────────
function showError(type) {
  document.getElementById('loading-screen').style.display = 'none';
  const es = document.getElementById('error-screen');
  es.classList.remove('hidden');

  if (type === 'invalid') {
    document.getElementById('err-icon').textContent  = '🔒';
    document.getElementById('err-title').textContent = t('errInvalidTitle');
    document.getElementById('err-sub').textContent   = t('errInvalidSub');
  } else {
    document.getElementById('err-icon').textContent  = '📡';
    document.getElementById('err-title').textContent = t('errServerTitle');
    document.getElementById('err-sub').textContent   = t('errServerSub');
  }
}

// ── TOAST ─────────────────────────────────────────────────────────────────────
function showToast(msg, type = '') {
  // Con accesibilidad auditiva los avisos visuales duran más
  const duration = app.a11y === 'hearing' ? 7000 : 3000;
  renderToast(msg, { type, axis: 'y', duration });
}
