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
      label: 'Enchufe USB', type: 'switch_3ch', available: true,
      channels: ['Entrada 1', 'Entrada 2'],
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
    navScenes: 'Escenas',
    navClimate: 'Clima',
    navSettings: 'Ajustes',
    navSupport: 'Soporte',
    demoBanner: '🔵 Modo demostración — los cambios no se aplican a dispositivos reales',
    checkoutBtn: '🚪 Check-out',
    hello: 'Hola, {name} 👋',
    welcome: 'Bienvenido',
    checkoutLine: '📅 Check-out: {date} a las {time}',
    sectionControls: 'Controles',
    sectionPlan: 'Funciones del plan',
    sectionScenes: 'Escenas',
    sectionSettings: 'Ajustes',
    sectionSupport: 'Soporte',
    sectionServices: 'Servicios',
    dndTitle: 'No molestar',
    dndDesc: 'El personal de limpieza no ingresará a tu habitación mientras esté activo',
    doorAlarmTitle: 'Avisarme si se abre la puerta',
    doorAlarmDesc: 'Si tienes la app abierta, sonará una alerta apenas se abra la puerta de tu habitación',
    doorAlarmTriggeredTitle: '¡Se abrió la puerta!',
    doorAlarmTriggeredDesc: 'Activaste el aviso de puerta para esta estadía.',
    doorAlarmDismissBtn: 'Entendido',
    requestTowels: '🧺 Pedir toallas / amenities',
    requestRoomService: '🍽 Pedir room service',
    requestCleaning: '🧹 Pedir limpieza',
    requestLateCheckout: '🕐 Solicitar late checkout',
    requestMaintenance: '🔧 Reportar un problema',
    requestOther: '💬 Otra solicitud',
    requestNotePrompt: 'Describe brevemente tu solicitud:',
    sectionDirectorio: 'Qué ofrece el hotel',
    directorioEmpty: 'Sin servicios publicados todavía.',
    noDevicesMsg: 'Esta habitación no tiene dispositivos inteligentes. Usa Servicios para pedir lo que necesites a recepción.',
    noDevicesBtn: 'Ir a Servicios',
    toastRequestSent: 'Solicitud enviada a recepción',
    toastDndOn: 'No molestar activado',
    toastDndOff: 'No molestar desactivado',
    toastDoorAlarmOn: 'Aviso de puerta activado',
    toastDoorAlarmOff: 'Aviso de puerta desactivado',
    onbTitle: '¡Bienvenido!',
    onbScenes: 'Activa tus aparatos inteligentes desde aquí',
    onbSettings: 'Cambia idioma y accesibilidad desde Ajustes',
    onbSupport: 'Pide servicios o ayuda desde Soporte',
    onbGotIt: 'Entendido',
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
    sceneEditConfirm: '¿Guardar la configuración actual de tu habitación en la escena "{name}"? Se reemplazará la anterior.',
    sceneDeleteTitle: 'Eliminar escena',
    sceneDeleteConfirm: '¿Eliminar la escena "{name}"?',
    sceneResetTitle: 'Restaurar escena original',
    sceneResetConfirm: '¿Restaurar la escena "{name}" a su configuración original?',
    scenesHint: 'Toca una escena para activarla. Usa ✏️ para guardar la configuración actual de tu habitación en esa escena, o ➕ para crear una nueva.',
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
    voiceListening: 'Escuchando… toca el micrófono otra vez para enviar',
    voiceProcessing: 'Procesando tu comando…',
    voiceNotUnderstood: 'No identifiqué un comando. Intenta de nuevo, por ejemplo: abre la cortina.',
    toastVoiceUnsupported: 'El control por voz no es compatible con este navegador',
    toastVoiceMicDenied: 'No se pudo acceder al micrófono. Revisa los permisos.',
    reportProblemBtn: 'Reportar un problema con este dispositivo',
    reportTitle: 'Reportar un problema',
    reportIntroDesc: 'Vas a reportar un problema con: {device}. Recepción recibirá tu reporte de inmediato.',
    reportBackBtn: 'Atrás',
    reportContinueBtn: 'Continuar',
    reportSendBtn: 'Enviar',
    reportOptionsTitle: '¿Cuál es el problema?',
    reportNoOptionToast: 'Elige una opción antes de enviar',
    reportOtherTitle: 'Cuéntanos qué pasa',
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
    voiceOn: 'Asistente activo (Amazon Echo)',
    voiceOff: 'Modo privado — solo control por app',
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
    navScenes: 'Scenes',
    navClimate: 'Climate',
    navSettings: 'Settings',
    navSupport: 'Support',
    demoBanner: '🔵 Demo mode — changes are not applied to real devices',
    checkoutBtn: '🚪 Check-out',
    hello: 'Hello, {name} 👋',
    welcome: 'Welcome',
    checkoutLine: '📅 Check-out: {date} at {time}',
    sectionControls: 'Controls',
    sectionPlan: 'Plan features',
    sectionScenes: 'Scenes',
    sectionSettings: 'Settings',
    sectionSupport: 'Support',
    sectionServices: 'Services',
    dndTitle: 'Do Not Disturb',
    dndDesc: 'Housekeeping will not enter your room while this is active',
    doorAlarmTitle: 'Alert me if the door opens',
    doorAlarmDesc: 'If you have the app open, an alert will sound as soon as your room door opens',
    doorAlarmTriggeredTitle: 'The door opened!',
    doorAlarmTriggeredDesc: 'You turned on the door alert for this stay.',
    doorAlarmDismissBtn: 'Got it',
    requestTowels: '🧺 Request towels / amenities',
    requestRoomService: '🍽 Request room service',
    requestCleaning: '🧹 Request housekeeping',
    requestLateCheckout: '🕐 Request late checkout',
    requestMaintenance: '🔧 Report an issue',
    requestOther: '💬 Other request',
    requestNotePrompt: 'Briefly describe your request:',
    sectionDirectorio: 'What the hotel offers',
    directorioEmpty: 'No services published yet.',
    noDevicesMsg: 'This room has no smart devices. Use Services to ask the front desk for anything you need.',
    noDevicesBtn: 'Go to Services',
    toastRequestSent: 'Request sent to the front desk',
    toastDndOn: 'Do Not Disturb on',
    toastDndOff: 'Do Not Disturb off',
    toastDoorAlarmOn: 'Door alert turned on',
    toastDoorAlarmOff: 'Door alert turned off',
    onbTitle: 'Welcome!',
    onbScenes: 'Control your smart devices from here',
    onbSettings: 'Change language and accessibility from Settings',
    onbSupport: 'Request services or help from Support',
    onbGotIt: 'Got it',
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
    sceneEditConfirm: 'Save your room\'s current configuration to the scene "{name}"? This will replace the previous one.',
    sceneDeleteTitle: 'Delete scene',
    sceneDeleteConfirm: 'Delete the scene "{name}"?',
    sceneResetTitle: 'Reset scene to default',
    sceneResetConfirm: 'Reset the scene "{name}" to its original configuration?',
    scenesHint: 'Tap a scene to activate it. Use ✏️ to save your room\'s current configuration to that scene, or ➕ to create a new one.',
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
    voiceOn: 'Assistant active (Amazon Echo)',
    voiceOff: 'Private mode — app control only',
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
    navScenes: 'Cenas',
    navClimate: 'Clima',
    navSettings: 'Ajustes',
    navSupport: 'Suporte',
    demoBanner: '🔵 Modo demonstração — as mudanças não são aplicadas a dispositivos reais',
    checkoutBtn: '🚪 Check-out',
    hello: 'Olá, {name} 👋',
    welcome: 'Bem-vindo',
    checkoutLine: '📅 Check-out: {date} às {time}',
    sectionControls: 'Controles',
    sectionPlan: 'Funções do plano',
    sectionScenes: 'Cenas',
    sectionSettings: 'Ajustes',
    sectionSupport: 'Suporte',
    sectionServices: 'Serviços',
    dndTitle: 'Não perturbe',
    dndDesc: 'A equipe de limpeza não entrará no seu quarto enquanto estiver ativo',
    doorAlarmTitle: 'Avisar se a porta abrir',
    doorAlarmDesc: 'Se você tiver o app aberto, soará um alerta assim que a porta do seu quarto abrir',
    doorAlarmTriggeredTitle: 'A porta abriu!',
    doorAlarmTriggeredDesc: 'Você ativou o aviso de porta para esta estadia.',
    doorAlarmDismissBtn: 'Entendi',
    requestTowels: '🧺 Pedir toalhas / amenities',
    requestRoomService: '🍽 Pedir room service',
    requestCleaning: '🧹 Pedir limpeza',
    requestLateCheckout: '🕐 Solicitar late checkout',
    requestMaintenance: '🔧 Relatar um problema',
    requestOther: '💬 Outra solicitação',
    requestNotePrompt: 'Descreva brevemente sua solicitação:',
    sectionDirectorio: 'O que o hotel oferece',
    directorioEmpty: 'Nenhum serviço publicado ainda.',
    noDevicesMsg: 'Este quarto não possui dispositivos inteligentes. Use Serviços para pedir o que precisar à recepção.',
    noDevicesBtn: 'Ir para Serviços',
    toastRequestSent: 'Solicitação enviada à recepção',
    toastDndOn: 'Não perturbe ativado',
    toastDndOff: 'Não perturbe desativado',
    toastDoorAlarmOn: 'Aviso de porta ativado',
    toastDoorAlarmOff: 'Aviso de porta desativado',
    onbTitle: 'Bem-vindo!',
    onbScenes: 'Controle seus dispositivos inteligentes a partir daqui',
    onbSettings: 'Altere idioma e acessibilidade em Configurações',
    onbSupport: 'Solicite serviços ou ajuda em Suporte',
    onbGotIt: 'Entendi',
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
    sceneEditConfirm: 'Salvar a configuração atual do seu quarto na cena "{name}"? Isso substituirá a anterior.',
    sceneDeleteTitle: 'Excluir cena',
    sceneDeleteConfirm: 'Excluir a cena "{name}"?',
    sceneResetTitle: 'Restaurar cena original',
    sceneResetConfirm: 'Restaurar a cena "{name}" para sua configuração original?',
    scenesHint: 'Toque em uma cena para ativá-la. Use ✏️ para salvar a configuração atual do seu quarto nessa cena, ou ➕ para criar uma nova.',
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
    voiceOn: 'Assistente ativo (Amazon Echo)',
    voiceOff: 'Modo privado — controle apenas pelo app',
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

// ── CONTROL POR VOZ ────────────────────────────────────────────────────────
// Pensado primero como vía principal de control para huéspedes no videntes.
// Toggle (no "mantener presionado"): un toque inicia la grabación, otro la
// envía. El estado se anuncia en #voice-status (aria-live="assertive") para
// que un lector de pantalla narre cada paso sin que el huésped tenga que mirar.
const VOICE_MAX_MS = 8000;
let voiceRecorder  = null;
let voiceChunks    = [];
let voiceAutoStop  = null;

function voiceAnnounce(msg) {
  const el = document.getElementById('voice-status');
  if (el) el.textContent = msg;
}

function toggleVoiceRecording() {
  if (voiceRecorder && voiceRecorder.state === 'recording') stopVoiceRecording();
  else startVoiceRecording();
}

async function startVoiceRecording() {
  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
    showToast(t('toastVoiceUnsupported'), 'error');
    voiceAnnounce(t('toastVoiceUnsupported'));
    return;
  }
  const btn = document.getElementById('voice-btn');
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    voiceChunks = [];
    voiceRecorder = new MediaRecorder(stream);
    voiceRecorder.ondataavailable = e => { if (e.data.size) voiceChunks.push(e.data); };
    voiceRecorder.onstop = () => {
      stream.getTracks().forEach(track => track.stop());
      sendVoiceCommand(new Blob(voiceChunks, { type: voiceRecorder.mimeType || 'audio/webm' }));
    };
    voiceRecorder.start();
    btn?.classList.add('recording');
    btn?.setAttribute('aria-pressed', 'true');
    voiceAnnounce(t('voiceListening'));
    voiceAutoStop = setTimeout(stopVoiceRecording, VOICE_MAX_MS);
  } catch (err) {
    console.error('[VOZ]', err);
    showToast(t('toastVoiceMicDenied'), 'error');
    voiceAnnounce(t('toastVoiceMicDenied'));
  }
}

function stopVoiceRecording() {
  if (!voiceRecorder || voiceRecorder.state !== 'recording') return;
  clearTimeout(voiceAutoStop);
  const btn = document.getElementById('voice-btn');
  btn?.classList.remove('recording');
  btn?.classList.add('processing');
  btn?.setAttribute('aria-pressed', 'false');
  voiceAnnounce(t('voiceProcessing'));
  voiceRecorder.stop();
}

async function sendVoiceCommand(blob) {
  const btn = document.getElementById('voice-btn');
  try {
    const res = await fetch(`${API}/room/${app.token}/voice-command`, {
      method:  'POST',
      headers: { 'Content-Type': blob.type || 'audio/webm' },
      body:    blob,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = data.error || t('toastCmdFail');
      showToast(msg, 'error');
      voiceAnnounce(msg);
      return;
    }
    if (!data.entendido) {
      const msg = data.mensaje || t('voiceNotUnderstood');
      showToast(msg, '');
      voiceAnnounce(msg);
      return;
    }
    applyVoiceCommand(data.device, data.command);
    showToast(data.accion, 'success');
    voiceAnnounce(data.accion);
  } catch (err) {
    console.error('[VOZ]', err);
    showToast(t('toastCmdFail'), 'error');
    voiceAnnounce(t('toastCmdFail'));
  } finally {
    btn?.classList.remove('processing');
  }
}

// Refleja en la UI el comando que el servidor ya ejecutó por voz (sin volver a
// llamar a /command — el servidor lo hizo como parte de /voice-command).
function applyVoiceCommand(device, command) {
  if (!app.devices[device]) return;
  if (Object.prototype.hasOwnProperty.call(command, 'control')) {
    if (command.control === 'stop') stopCurtainAnim(device);
    else animateCurtainTo(device, command.control === 'open' ? 100 : 0);
  } else {
    Object.assign(app.devices[device], command);
    updateCard(device);
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

  // Construir estado
  for (const [key, dev] of Object.entries(data.devices)) {
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
  app.doorAlarm = data.doorAlarm || false;

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

  // Grid de dispositivos
  renderGrid();
  renderFavorites();
  renderScenes();
  loadDirectorioServicios();

  // Funciones del plan (placeholders) y vista de clima
  renderPlanGrid();
  renderClimateView();

  // Ocultar la sección "Clima" del menú si el plan de la habitación no la incluye
  if (planLevel(app.plan) < PLAN_TIERS.premium) {
    document.querySelector('.nav-item[data-view="climate"]')?.classList.add('hidden');
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
  document.getElementById('scene-new-btn').addEventListener('click', openSceneModal);
  document.getElementById('scene-modal-cancel').addEventListener('click', closeSceneModal);
  document.getElementById('scene-modal-save').addEventListener('click', saveNewScene);

  // Delegación de eventos para los controles del grid
  const grid = document.getElementById('device-grid');
  grid.addEventListener('click',  handleGridClick);
  grid.addEventListener('input',  handleGridInput);
  grid.addEventListener('change', handleGridInput);
  // La TV vive dentro de Controles inteligentes (no es un dispositivo Tuya
  // real, es un placeholder) — reusa el mismo manejador que las demás
  // funciones del plan, así que también se enlaza acá.
  grid.addEventListener('click',  handlePlanGridClick);
  grid.addEventListener('input',  handlePlanGridInput);
  grid.addEventListener('change', handlePlanGridInput);

  // Delegación de eventos para la barra de favoritos
  document.getElementById('favorites-bar')?.addEventListener('click', handleFavBarClick);

  // Delegación de eventos para las funciones del plan (placeholders)
  const planGrid = document.getElementById('plan-grid');
  planGrid.addEventListener('click',  handlePlanGridClick);
  planGrid.addEventListener('input',  handlePlanGridInput);
  planGrid.addEventListener('change', handlePlanGridInput);

  // Delegación de eventos para la vista de Clima (Premium)
  const climateContent = document.getElementById('climate-content');
  climateContent.addEventListener('click',  handlePlanGridClick);
  climateContent.addEventListener('input',  handlePlanGridInput);
  climateContent.addEventListener('change', handlePlanGridInput);

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
  document.querySelectorAll('[data-action="toggle-door-alarm"]').forEach(el => el.classList.toggle('on', app.doorAlarm));
  renderHomeServices();

  renderPrefsRows();
}

// ── SELECTORES DE IDIOMA Y ACCESIBILIDAD (vista Ajustes) ─────────────────────
// Copia de la sección "Servicios" (no molestar, alarma de puerta, solicitudes)
// directo en la página de Inicio, debajo de los dispositivos — sin el bloque de
// contactar a recepción, que sigue viviendo solo en la pestaña Soporte. Los ids
// llevan sufijo -home y se sincronizan con sus pares en Soporte vía toggleDnd/
// toggleDoorAlarm (que ya no asumen un único elemento por acción).
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
    <div class="device-card full-width" id="door-alarm-card-home">
      <div class="card-head">
        <div class="card-ico-name"><span class="card-ico">🚨</span><span class="card-label">${t('doorAlarmTitle')}</span></div>
        <div class="toggle ${app.doorAlarm ? 'on' : ''}" id="door-alarm-toggle-home" data-action="toggle-door-alarm"></div>
      </div>
      <div class="card-status">${t('doorAlarmDesc')}</div>
    </div>
    <div class="support-card" style="padding:24px 32px;gap:10px">
      <button class="support-btn" id="request-towels-btn-home" style="width:100%">🧺 ${t('requestTowels')}</button>
      <button class="support-btn" id="request-roomservice-btn-home" style="width:100%">🍽 ${t('requestRoomService')}</button>
      <button class="support-btn" id="request-cleaning-btn-home" style="width:100%">🧹 ${t('requestCleaning')}</button>
      <button class="support-btn" id="request-late-checkout-btn-home" style="width:100%">🕐 ${t('requestLateCheckout')}</button>
      <button class="support-btn" id="request-maintenance-btn-home" style="width:100%">🔧 ${t('requestMaintenance')}</button>
      <button class="support-btn" id="request-other-btn-home" style="width:100%">💬 ${t('requestOther')}</button>
    </div>`;

  document.getElementById('dnd-toggle-home').addEventListener('click', toggleDnd);
  document.getElementById('door-alarm-toggle-home').addEventListener('click', toggleDoorAlarm);
  document.getElementById('request-towels-btn-home').addEventListener('click', () => sendServiceRequest('towels'));
  document.getElementById('request-roomservice-btn-home').addEventListener('click', () => sendServiceRequest('roomservice'));
  document.getElementById('request-cleaning-btn-home').addEventListener('click', () => sendServiceRequest('cleaning'));
  document.getElementById('request-late-checkout-btn-home').addEventListener('click', () => sendServiceRequest('late_checkout'));
  document.getElementById('request-maintenance-btn-home').addEventListener('click', () => sendServiceRequestWithNote('maintenance'));
  document.getElementById('request-other-btn-home').addEventListener('click', () => sendServiceRequestWithNote('other'));
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
  renderPlanGrid();
  renderClimateView();
  renderScenes();
  renderHomeServices();
  savePrefs({ lang });
}

// ── NO MOLESTAR ───────────────────────────────────────────────────────────────
function toggleDnd() {
  app.dnd = !app.dnd;
  document.querySelectorAll('[data-action="toggle-dnd"]').forEach(el => el.classList.toggle('on', app.dnd));
  showToast(app.dnd ? t('toastDndOn') : t('toastDndOff'), '');
  savePrefs({ dnd: app.dnd });
}

// ── ALARMA DE PUERTA ──────────────────────────────────────────────────────────
// La app no recibe push real (sin Service Worker con Web Push) — mientras la
// tenga abierta, un polling cada 20s detecta si la puerta pasó de cerrada a
// abierta y, si la alarma está armada, dispara un aviso visual+sonoro local y
// avisa al backend para que recepción también lo vea (door-alarm-triggered).
let doorAlarmAudioCtx  = null;
let doorAlarmBeepTimer = null;

function toggleDoorAlarm() {
  app.doorAlarm = !app.doorAlarm;
  document.querySelectorAll('[data-action="toggle-door-alarm"]').forEach(el => el.classList.toggle('on', app.doorAlarm));
  showToast(app.doorAlarm ? t('toastDoorAlarmOn') : t('toastDoorAlarmOff'), '');
  savePrefs({ doorAlarm: app.doorAlarm });
}

async function refreshRoomState() {
  if (window.location.protocol === 'file:' || !app.token) return;
  const wasOpen = !!app.devices?.puerta?.open;
  try {
    const data = await apiGet(app.token);
    app.data    = data;
    app.devices = data.devices;
    renderGrid();
    const isOpenNow = !!app.devices?.puerta?.open;
    if (!wasOpen && isOpenNow && app.doorAlarm) {
      triggerDoorAlarmUI();
      fetch(`${API}/room/${app.token}/door-alarm-triggered`, { method: 'POST' }).catch(() => {});
    }
  } catch { /* la próxima vuelta del polling reintenta sola */ }
}

function triggerDoorAlarmUI() {
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
  reportState = { key, step: 'intro', option: null, otherText: '' };
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
  const label = devLabel(key, cfg);
  const card  = document.getElementById('report-modal-card');

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
  const label = devLabel(key, app.config[key] || {});
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
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => positionTutorial(target, step), 300);
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

  // Control por voz: un toque para empezar a grabar, otro para enviar
  // (toggle en vez de "mantener presionado" — más fiable con lectores de pantalla,
  // que activan botones con un toque discreto y no con gestos de pulsación sostenida).
  document.getElementById('voice-btn')?.addEventListener('click', toggleVoiceRecording);
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

function favBtn(key) {
  const active = app.favorites.includes(key);
  return `<button type="button" class="fav-btn ${active ? 'active' : ''}" data-key="${key}" data-action="toggle-favorite" aria-label="${t('favToggle')}">${active ? '★' : '☆'}</button>`;
}

function reportBtn(key) {
  return `<button type="button" class="report-btn" data-key="${key}" data-action="report-problem" aria-label="${t('reportProblemBtn')}">⚠️</button>`;
}

function scheduleBtn(key) {
  return `<button type="button" class="report-btn" onclick="event.stopPropagation();scheduleOnOff('${key}')" aria-label="${t('scheduleBtn')}">🕐</button>`;
}

function saveFavorites() {
  try { localStorage.setItem(`nexo_favs_${app.token || 'static'}`, JSON.stringify(app.favorites)); } catch {}
}

function renderFavorites() {
  const bar = document.getElementById('favorites-bar');
  if (!bar) return;
  const items = app.favorites
    .map(key => ({ key, cfg: app.config[key] }))
    .filter(({ key, cfg }) => cfg && app.devices[key]);

  if (!items.length) {
    bar.classList.add('hidden');
    bar.innerHTML = '';
    return;
  }

  bar.classList.remove('hidden');
  bar.innerHTML = `
    <div class="favorites-label">${t('sectionFavorites')}</div>
    <div class="favorites-row">${items.map(({ key, cfg }) => buildFavChip(key, cfg)).join('')}</div>`;
}

function buildFavChip(key, cfg) {
  const s = app.devices[key] || {};
  const prop = cfg.type === 'switch_3ch' ? 'ch1' : 'on';
  const on = !!s[prop];
  const ico = cfg.type === 'ac' ? '❄️' : cfg.type === 'switch' || cfg.type === 'switch_3ch' ? '🔌' : deviceIcon(key, '💡');
  return `<button type="button" class="fav-chip ${on ? 'on' : ''}" data-key="${key}" data-prop="${prop}" data-action="fav-toggle">
    <span class="fav-chip-ico">${ico}</span><span class="fav-chip-label">${devLabel(key, cfg)}</span>
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
  const keys = [
    ...CARD_ORDER.filter(k => app.config[k]),
    ...Object.keys(app.config).filter(k => !CARD_ORDER.includes(k) && k !== 'puerta'),
  ];
  if (!keys.length) {
    grid.innerHTML = `
      <div class="support-card" style="text-align:center">
        <span class="support-card-ico">🛎️</span>
        <p>${t('noDevicesMsg')}</p>
        <button class="support-btn" onclick="switchView('support')">${t('noDevicesBtn')}</button>
      </div>` + buildTVCard();
    return;
  }
  grid.innerHTML = keys.map(buildCard).join('') + buildTVCard();
}

function updateCard(key) {
  const el = document.getElementById(`card-${key}`);
  if (el) el.outerHTML = buildCard(key);
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
      <div class="card-head-actions">${reportBtn(key)}</div>
    </div>
    <div class="offline-label">${t('offlineDevice')}</div>
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
      <div class="card-ico-name">
        <span class="card-ico">${deviceIcon(key, '💡')}</span>
        <span class="card-label">${devLabel(key, cfg)}</span>
      </div>
      <div class="card-head-actions">
        ${favBtn(key)}
        ${reportBtn(key)}
        ${scheduleBtn(key)}
        <div class="toggle ${on ? 'on' : ''} ${manual ? 'disabled' : ''}" data-key="${key}" data-action="toggle-light"></div>
      </div>
    </div>
    <div class="card-status ${on && !manual ? 'on' : ''}">${manual ? t('manualMode') : (on ? t('onF') : t('offF'))}</div>
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
  </div>`;
}

// ── LED RGB CARD ──────────────────────────────────────────────────────────────
const WHEEL_RADIUS = 56; // px, debe coincidir con el tamaño definido en CSS

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
      <div class="card-ico-name">
        <span class="card-ico">${deviceIcon(key, '💡')}</span>
        <span class="card-label">${devLabel(key, cfg)}</span>
      </div>
      <div class="card-head-actions">
        ${favBtn(key)}
        ${reportBtn(key)}
        ${scheduleBtn(key)}
        <div class="toggle ${on ? 'on' : ''} ${manual ? 'disabled' : ''}" data-key="${key}" data-action="toggle-light"></div>
      </div>
    </div>
    <div class="card-status ${on && !manual ? 'on' : ''}">${manual ? t('manualMode') : (on ? t('onM') : t('offM'))}</div>
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
        </div>
      </div>` : ''}` : ''}
    ${manualRow(key)}
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
      <div class="card-head-actions">
        ${reportBtn(key)}
        <button type="button" class="report-btn" onclick="event.stopPropagation();scheduleCurtain('${key}')" aria-label="${t('scheduleBtn')}">🕐</button>
        <span class="card-status" style="margin:0">${unlocked ? t('manualShort') : lbl}</span>
      </div>
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
      <div class="card-head-actions">
        ${favBtn(key)}
        ${reportBtn(key)}
        ${scheduleBtn(key)}
        <div class="toggle ${on ? 'on' : ''} ${manual ? 'disabled' : ''}" data-key="${key}" data-action="toggle-switch"></div>
      </div>
    </div>
    <div class="card-status ${on && !manual ? 'on' : ''}">${manual ? t('manualMode') : (on ? t('onM') : t('offM'))}</div>
    ${manualRow(key)}
  </div>`;
}

// ── SWITCH MULTI-CANAL (2 o 3 canales) ───────────────────────────────────────
function buildSwitch3CHCard(key) {
  const s    = app.devices[key] || {};
  const cfg  = app.config[key];
  // Usar los canales definidos en config; si no hay, asumir 3
  const chs  = cfg.channels || ['Canal 1', 'Canal 2', 'Canal 3'];
  const vals = [s.ch1, s.ch2, s.ch3];
  const manual = !!app._manual[key];
  const anyOn = !manual && vals.slice(0, chs.length).some(Boolean);

  // Un solo canal: el enchufe controla una única función (ej. 🔥 Estufa) — se
  // muestra como una tarjeta simple de ícono+nombre+toggle, igual que un switch
  // normal, sin el encabezado "Enchufe" que solo tenía sentido con varios canales.
  if (chs.length === 1) {
    const on = !manual && vals[0];
    return `<div class="device-card ${on ? 'on' : ''}" id="card-${key}">
      <div class="card-head">
        <div class="card-ico-name"><span class="card-label">${chs[0]}</span></div>
        <div class="card-head-actions">
          ${favBtn(key)}
          ${reportBtn(key)}
          <button type="button" class="report-btn" onclick="event.stopPropagation();scheduleChannel('${key}', 0)" aria-label="${t('scheduleBtn')}">🕐</button>
          <div class="toggle ${vals[0] ? 'on' : ''} ${manual ? 'disabled' : ''}" data-key="${key}" data-action="toggle-ch1"></div>
        </div>
      </div>
      <div class="card-status ${on ? 'on' : ''}">${manual ? t('manualMode') : (vals[0] ? t('onM') : t('offM'))}</div>
      ${manualRow(key)}
    </div>`;
  }

  // Generar una fila por cada canal definido (no siempre 3)
  const rows = chs.map((label, i) => `
    <div class="ch-row">
      <span class="ch-label">${label}</span>
      <div style="display:flex;align-items:center;gap:10px">
        <button type="button" class="report-btn" onclick="event.stopPropagation();scheduleChannel('${key}', ${i})" aria-label="${t('scheduleBtn')}">🕐</button>
        <div class="toggle ${vals[i] ? 'on' : ''} ${manual ? 'disabled' : ''}" data-key="${key}" data-action="toggle-ch${i + 1}"></div>
      </div>
    </div>`).join('');

  const ico = chs.length <= 2 ? '🔌' : '⚡';

  return `<div class="device-card full-width ${anyOn ? 'on' : ''}" id="card-${key}">
    <div class="card-head">
      <div class="card-ico-name"><span class="card-ico">${ico}</span><span class="card-label">${devLabel(key, cfg)}</span></div>
      <div class="card-head-actions">${favBtn(key)}${reportBtn(key)}</div>
    </div>
    ${rows}
    ${manualRow(key)}
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
      <div class="card-head-actions">
        ${favBtn(key)}
        ${reportBtn(key)}
        ${scheduleBtn(key)}
        <div class="toggle ${on ? 'on' : ''}" data-key="${key}" data-action="toggle-ac"></div>
      </div>
    </div>
    <div class="ac-temp-display">
      <div class="ac-temp-val ${on ? 'on' : ''}">${temp}°C</div>
    </div>
    <div class="ac-temp-btns">
      <button class="ac-btn" data-key="${key}" data-temp="-1" ${on ? '' : 'disabled'}>−</button>
      <span class="ac-range">16 – 30°C</span>
      <button class="ac-btn" data-key="${key}" data-temp="+1" ${on ? '' : 'disabled'}>+</button>
    </div>
  </div>`;
}

// ── FUNCIONES DEL PLAN (placeholders no conectados a dispositivos reales) ────
const PLAN_FEATURES_INFO = {
  voice:    { minPlan: 'premium' },
  bathroom: { minPlan: 'max_comfort' },
  bidet:    { minPlan: 'max_comfort' },
  rug:      { minPlan: 'max_comfort' },
};

function renderPlanGrid() {
  const grid = document.getElementById('plan-grid');
  grid.innerHTML = [
    buildFeatureCard('voice',    PLAN_FEATURES_INFO.voice,    buildVoiceCard),
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
      <div class="toggle ${s.on ? 'on' : ''}" data-feature="tv" data-action="toggle"></div>
    </div>
    <div class="card-status ${s.on ? 'on' : ''}">${s.on ? t('onF') : t('offF')}</div>
    ${s.on ? `
      <div class="slider-lbl">${t('volume')}</div>
      <div class="slider-row">
        <input type="range" min="0" max="100" value="${s.vol}" data-feature="tv" data-action="vol">
        <span class="slider-val">${s.vol}%</span>
      </div>
      <div class="source-row">
        ${sources.map(src => `<button class="source-btn ${s.source === src.id ? 'active' : ''}" data-feature="tv" data-action="source" data-source="${src.id}">${src.label}</button>`).join('')}
      </div>` : ''}
  </div>`;
}

// ── CONTROL POR VOZ (Echo) ────────────────────────────────────────────────────
function buildVoiceCard() {
  const s = app._placeholder.voice ?? (app._placeholder.voice = { on: true });
  return `<div class="device-card ${s.on ? 'on' : ''}" id="feature-voice">
    <div class="card-head">
      <div class="card-ico-name"><span class="card-ico">🔊</span><span class="card-label">${t('voiceTitle')}</span></div>
      <div class="toggle ${s.on ? 'on' : ''}" data-feature="voice" data-action="toggle"></div>
    </div>
    <div class="card-status ${s.on ? 'on' : ''}">${s.on ? t('voiceOn') : t('voiceOff')}</div>
    <div class="feature-row">
      <span class="feature-row-label"><span class="led-dot ${s.on ? 'on' : ''}"></span>${t('ledIndicator')}</span>
      <span class="preview-tag">${s.on ? t('onM') : t('offM')}</span>
    </div>
  </div>`;
}

// ── BAÑO INTELIGENTE (sensor de presencia + luz) ─────────────────────────────
function buildBathroomCard() {
  const s = app._placeholder.bathroom ?? (app._placeholder.bathroom = { presence: false, lightOn: false, intensity: 60, colorTemp: 50, auto: true, manual: false });
  const manual = !!s.manual;
  return `<div class="device-card full-width ${s.lightOn ? 'on' : ''}" id="feature-bathroom">
    <div class="card-head">
      <div class="card-ico-name"><span class="card-ico">🚿</span><span class="card-label">${t('bathTitle')}</span></div>
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
    <div class="card-status ${s.lightOn ? 'on' : ''}" style="margin-top:8px">${manual ? t('manualMode') : (s.lightOn ? t('lightOn') : t('lightOff'))}${s.auto && !manual ? t('bathAutoNote') : ''}</div>
    ${s.lightOn && !manual ? `
    <div class="slider-lbl">${t('intensity')}</div>
    <div class="slider-row">
      <input type="range" min="5" max="100" value="${s.intensity}" data-feature="bathroom" data-action="intensity">
      <span class="slider-val">${s.intensity}%</span>
    </div>
    <div class="ct-row">
      <button class="ct-btn ${s.colorTemp < 33 ? 'active' : ''}" data-feature="bathroom" data-action="ct" data-ct="5">${t('warm')}</button>
      <button class="ct-btn ${s.colorTemp >= 33 && s.colorTemp < 66 ? 'active' : ''}" data-feature="bathroom" data-action="ct" data-ct="50">${t('neutral')}</button>
      <button class="ct-btn ${s.colorTemp >= 66 ? 'active' : ''}" data-feature="bathroom" data-action="ct" data-ct="95">${t('cold')}</button>
    </div>` : ''}
    <div class="manual-row">
      <span>${t('manualMode')}</span>
      <div class="toggle toggle-sm ${manual ? 'on' : ''}" data-feature="bathroom" data-action="manual"></div>
    </div>
    ${manual ? `<div class="manual-note">${t('bathManualNote')}</div>` : ''}
  </div>`;
}

// ── BAÑO JAPONÉS (bidé inteligente) ──────────────────────────────────────────
function buildBidetCard() {
  const s = app._placeholder.bidet ?? (app._placeholder.bidet = { on: false, heatedSeat: false, mode: null });
  return `<div class="device-card ${s.on ? 'on' : ''}" id="feature-bidet">
    <div class="card-head">
      <div class="card-ico-name"><span class="card-ico">🚽</span><span class="card-label">${t('bidetTitle')}</span></div>
      <div class="toggle ${s.on ? 'on' : ''}" data-feature="bidet" data-action="toggle"></div>
    </div>
    <div class="card-status ${s.on ? 'on' : ''}">${s.on ? t('onM') : t('offM')}</div>
    ${s.on ? `
    <div class="feature-row">
      <span class="feature-row-label">${t('heatedSeat')}</span>
      <div class="toggle ${s.heatedSeat ? 'on' : ''}" data-feature="bidet" data-action="heated"></div>
    </div>
    <div class="source-row">
      <button class="source-btn ${s.mode === 'wash' ? 'active' : ''}" data-feature="bidet" data-action="mode" data-mode="wash">${t('wash')}</button>
      <button class="source-btn ${s.mode === 'dry'  ? 'active' : ''}" data-feature="bidet" data-action="mode" data-mode="dry">${t('dry')}</button>
    </div>` : ''}
  </div>`;
}

// ── ALFOMBRA CALEFACCIONABLE ──────────────────────────────────────────────────
function buildRugCard() {
  const s = app._placeholder.rug ?? (app._placeholder.rug = { on: false, level: 'media' });
  const levels = [{ id: 'baja', label: t('low') }, { id: 'media', label: t('medium') }, { id: 'alta', label: t('high') }];
  return `<div class="device-card ${s.on ? 'on' : ''}" id="feature-rug">
    <div class="card-head">
      <div class="card-ico-name"><span class="card-ico">🔥</span><span class="card-label">${t('rugTitle')}</span></div>
      <div class="toggle ${s.on ? 'on' : ''}" data-feature="rug" data-action="toggle"></div>
    </div>
    <div class="card-status ${s.on ? 'on' : ''}">${s.on ? t('onF') : t('offF')}</div>
    ${s.on ? `
    <div class="level-row">
      ${levels.map(l => `<button class="level-btn ${s.level === l.id ? 'active' : ''}" data-feature="rug" data-action="level" data-level="${l.id}">${l.label}</button>`).join('')}
    </div>` : ''}
  </div>`;
}

// ── VISTA CLIMA (AC + sensor de ventana + automatizaciones, Premium+) ────────
function renderClimateView() {
  const el = document.getElementById('climate-content');

  // Sin plan Premium+ esta vista no es accesible (el nav-item está oculto),
  // pero se deja vacía por seguridad si se llegara a invocar.
  if (planLevel(app.plan) < PLAN_TIERS.premium) {
    el.innerHTML = '';
    return;
  }

  const s = app._placeholder.climate ?? (app._placeholder.climate = { acOn: false, temp: 22, windowOpen: false, autoOff: true });

  el.innerHTML = `
    <div class="section-label">${t('acSection')}</div>
    <div class="device-grid">
      <div class="device-card ${s.acOn ? 'on' : ''}" id="feature-ac">
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
      </div>
      <div class="device-card ${s.windowOpen ? '' : 'on'}" id="feature-window">
        <div class="card-head">
          <div class="card-ico-name"><span class="card-ico">🪟</span><span class="card-label">${t('windowTitle')}</span></div>
        </div>
        <div class="card-status ${s.windowOpen ? '' : 'on'}">${s.windowOpen ? t('windowOpen') : t('windowClosed')}</div>
        <button class="curtain-btn" style="margin-top:8px;width:100%" data-feature="climate" data-action="window-toggle">${s.windowOpen ? t('simulateClose') : t('simulateOpen')}</button>
      </div>
    </div>
    <div class="section-label" style="margin-top:18px">${t('autoSection')}</div>
    <div class="device-grid">
      <div class="device-card full-width">
        <div class="card-head">
          <div class="card-ico-name"><span class="card-ico">⚙️</span><span class="card-label">${t('autoOffTitle')}</span></div>
          <div class="toggle ${s.autoOff ? 'on' : ''}" data-feature="climate" data-action="auto-toggle"></div>
        </div>
        <div class="card-status">${t('autoOffDesc')}</div>
      </div>
    </div>
  `;
}

// ── EVENTOS: FUNCIONES DEL PLAN (placeholders) ───────────────────────────────
function rerenderFeature(key) {
  const builders = { tv: buildTVCard, voice: buildVoiceCard, bathroom: buildBathroomCard, bidet: buildBidetCard, rug: buildRugCard };
  const el = document.getElementById(`feature-${key}`);
  if (el && builders[key]) el.outerHTML = builders[key]();
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

  const heated = e.target.closest('[data-action="heated"]');
  if (heated) {
    app._placeholder.bidet.heatedSeat = !app._placeholder.bidet.heatedSeat;
    rerenderFeature('bidet');
    showPreviewToast();
    return;
  }

  const mode = e.target.closest('[data-action="mode"]');
  if (mode) {
    const s = app._placeholder.bidet;
    s.mode = s.mode === mode.dataset.mode ? null : mode.dataset.mode;
    rerenderFeature('bidet');
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

  const winTog = e.target.closest('[data-action="window-toggle"]');
  if (winTog) {
    app._placeholder.climate.windowOpen = !app._placeholder.climate.windowOpen;
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
    const idx = app.favorites.indexOf(key);
    if (idx >= 0) {
      app.favorites.splice(idx, 1);
    } else {
      if (app.favorites.length >= FAV_MAX) {
        showToast(t('toastFavMax'), '');
        return;
      }
      app.favorites.push(key);
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

  // Click en la rueda de color → calcular hue desde el ángulo
  const wheel = e.target.closest('[data-action="pick-color"]');
  if (wheel) {
    const key  = wheel.dataset.key;
    const rect = wheel.getBoundingClientRect();
    const dx   = e.clientX - (rect.left + rect.width / 2);
    const dy   = e.clientY - (rect.top  + rect.height / 2);
    let hue    = Math.atan2(dx, -dy) * (180 / Math.PI);
    if (hue < 0) hue += 360;
    doCmd(key, { on: true, hue: Math.round(hue), saturation: 1000, mode: 'colour' });
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

// ── ESCENAS ───────────────────────────────────────────────────────────────────
function renderScenes() {
  const grid = document.getElementById('scenes-grid');
  grid.innerHTML = getSceneList().map(scene => {
    const scheduleAction = `<button class="scene-action-btn" onclick="event.stopPropagation();scheduleScene('${scene.id}')" title="${t('scheduleBtn')}" aria-label="${t('scheduleBtn')}">🕐</button>`;
    const actions = (scene.isCustom
      ? `<button class="scene-action-btn" data-scene-action="edit"   data-scene="${scene.id}" title="${t('sceneEditTitle')}"   aria-label="${t('sceneEditTitle')}">✏️</button>
         <button class="scene-action-btn" data-scene-action="delete" data-scene="${scene.id}" title="${t('sceneDeleteTitle')}" aria-label="${t('sceneDeleteTitle')}">🗑️</button>`
      : `<button class="scene-action-btn" data-scene-action="edit" data-scene="${scene.id}" title="${t('sceneEditTitle')}" aria-label="${t('sceneEditTitle')}">✏️</button>
         ${scene.hasOverride ? `<button class="scene-action-btn" data-scene-action="reset" data-scene="${scene.id}" title="${t('sceneResetTitle')}" aria-label="${t('sceneResetTitle')}">↺</button>` : ''}`) + scheduleAction;

    // div, no button: el botón externo no puede contener los botones internos
    // de editar/eliminar (✏️/🗑️/↺) — un <button> dentro de otro <button> es
    // inválido en HTML5 y el navegador cierra el externo antes de tiempo,
    // dejando ícono/título/descripción como hijos sueltos de la grilla.
    return `<div class="scene-card" role="button" tabindex="0" data-scene="${scene.id}" aria-label="${scene.title}">
      <div class="scene-card-actions">${actions}</div>
      <span class="scene-card-ico">${scene.icon}</span>
      <span class="scene-card-title">${scene.title}</span>
      <span class="scene-card-desc">${scene.desc}</span>
    </div>`;
  }).join('');
}

function handleSceneGridClick(e) {
  const actionBtn = e.target.closest('[data-scene-action]');
  if (actionBtn) {
    e.stopPropagation();
    const id = actionBtn.dataset.scene;
    const action = actionBtn.dataset.sceneAction;
    if (action === 'edit')   return confirmSaveSceneOverride(id);
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

// Sobrescribe una escena existente (default o personalizada) con el estado actual de la habitación
async function confirmSaveSceneOverride(id) {
  const scene = getSceneList().find(s => s.id === id);
  if (!scene) return;
  if (!confirm(t('sceneEditConfirm', { name: scene.title }))) return;

  const steps = captureSceneSteps();
  try {
    const res = await apiSaveScene({ id, name: scene.title, icon: scene.icon, steps });
    if (!app.scenes[id]) app.scenes[id] = {};
    app.scenes[id].steps = steps;
    if (scene.isCustom) {
      app.scenes[id].name = scene.title;
      app.scenes[id].icon = scene.icon;
    }
    renderScenes();
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
