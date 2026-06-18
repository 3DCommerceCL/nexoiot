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
    tutCurtainCloseTitle: 'Cerrar la cortina',
    tutCurtainCloseDesc: 'Toca este botón para cerrar la cortina. También puedes usar el control deslizante para dejarla a media altura.',
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
    a11yVisionNote: 'Texto y controles más grandes, con mayor contraste, para personas con baja visión.',
    a11yHearingNote: 'Avisos visuales destacados y de mayor duración en lugar de señales sonoras.',
    supportQuestion: '¿Necesitas ayuda con tu habitación o tienes alguna duda?',
    callReception: '📞 Llamar a recepción',
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
    tutCurtainCloseTitle: 'Close the curtain',
    tutCurtainCloseDesc: 'Tap this button to close the curtain. You can also use the slider to leave it halfway.',
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
    a11yVisionNote: 'Larger text and controls with higher contrast for low-vision guests.',
    a11yHearingNote: 'Prominent, longer-lasting visual alerts instead of sound cues.',
    supportQuestion: 'Need help with your room or have any questions?',
    callReception: '📞 Call the front desk',
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
    tutCurtainCloseTitle: 'Fechar a cortina',
    tutCurtainCloseDesc: 'Toque neste botão para fechar a cortina. Você também pode usar o controle deslizante para deixá-la na metade.',
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
    a11yVisionNote: 'Texto e controles maiores, com mais contraste, para pessoas com baixa visão.',
    a11yHearingNote: 'Avisos visuais destacados e mais duradouros em vez de sinais sonoros.',
    supportQuestion: 'Precisa de ajuda com seu quarto ou tem alguma dúvida?',
    callReception: '📞 Ligar para a recepção',
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

  try {
    app.favorites = JSON.parse(localStorage.getItem(`nexo_favs_${app.token || 'static'}`) || '[]');
  } catch { app.favorites = []; }

  app.theme = localStorage.getItem('nexo_theme') || 'auto';

  document.documentElement.lang = app.lang;
  applyA11y();
  applyTheme();
  setInterval(applyTheme, 10 * 60 * 1000);
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
  document.getElementById('scene-new-btn').addEventListener('click', openSceneModal);
  document.getElementById('scene-modal-cancel').addEventListener('click', closeSceneModal);
  document.getElementById('scene-modal-save').addEventListener('click', saveNewScene);

  // Delegación de eventos para los controles del grid
  const grid = document.getElementById('device-grid');
  grid.addEventListener('click',  handleGridClick);
  grid.addEventListener('input',  handleGridInput);
  grid.addEventListener('change', handleGridInput);

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

  document.getElementById('dnd-toggle')?.classList.toggle('on', app.dnd);

  renderPrefsRows();
}

// ── SELECTORES DE IDIOMA Y ACCESIBILIDAD (vista Ajustes) ─────────────────────
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
  savePrefs({ lang });
}

// ── NO MOLESTAR ───────────────────────────────────────────────────────────────
function toggleDnd() {
  app.dnd = !app.dnd;
  document.getElementById('dnd-toggle')?.classList.toggle('on', app.dnd);
  showToast(app.dnd ? t('toastDndOn') : t('toastDndOff'), '');
  savePrefs({ dnd: app.dnd });
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
  if (btn) btn.textContent = dark ? '☀️' : '🌙';
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
    selector: () => document.querySelector('#device-grid .device-card:not(.offline) [data-action="toggle-light"]'),
    titleKey: 'tutLightTitle',
    descKey:  'tutLightDesc',
  },
  {
    view: 'room',
    selector: () => document.querySelector('#device-grid .curtain-btn[data-curtain="open"]'),
    titleKey: 'tutCurtainOpenTitle',
    descKey:  'tutCurtainOpenDesc',
  },
  {
    view: 'room',
    selector: () => document.querySelector('#device-grid .curtain-btn[data-curtain="close"]'),
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

  // Botón de soporte: llamar a recepción
  document.getElementById('call-reception-btn')?.addEventListener('click', () => {
    alert(t('callReceptionMsg'));
  });

  // No molestar y solicitudes de servicio
  document.getElementById('dnd-toggle')?.addEventListener('click', toggleDnd);
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

function favBtn(key) {
  const active = app.favorites.includes(key);
  return `<button type="button" class="fav-btn ${active ? 'active' : ''}" data-key="${key}" data-action="toggle-favorite" aria-label="${t('favToggle')}">${active ? '★' : '☆'}</button>`;
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
const CARD_ORDER = ['luz_velador1','luz_velador2','led_cama','luz_techo','cortina','enchufe'];

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
      </div>`;
    return;
  }
  grid.innerHTML = keys.map(buildCard).join('');
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
    <div class="card-head"><div class="card-ico-name"><span class="card-ico">⚠️</span><span class="card-label">${devLabel(key, cfg)}</span></div></div>
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

  return `<div class="device-card full-width" id="card-${key}">
    <div class="card-head">
      <div class="card-ico-name"><span class="card-ico">🪟</span><span class="card-label">${devLabel(key, cfg)}</span></div>
      <span class="card-status" style="margin:0">${unlocked ? t('manualShort') : lbl}</span>
    </div>
    <div class="curtain-btns">
      <button class="curtain-btn" data-key="${key}" data-curtain="open" ${unlocked ? 'disabled' : ''}>${t('curtainOpenBtn')}</button>
      <button class="curtain-btn stop-btn" data-key="${key}" data-curtain="stop" ${unlocked ? 'disabled' : ''}>${t('curtainStopBtn')}</button>
      <button class="curtain-btn" data-key="${key}" data-curtain="close" ${unlocked ? 'disabled' : ''}>${t('curtainCloseBtn')}</button>
    </div>
    <div class="slider-lbl">${t('position')}</div>
    <div class="slider-row">
      <input type="range" min="0" max="100" value="${pos}"
        data-key="${key}" data-action="curtain-pos" ${unlocked ? 'disabled' : ''}>
      <span class="slider-val" id="curtain-val-${key}">${pos}%</span>
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

  // Generar una fila por cada canal definido (no siempre 3)
  const rows = chs.map((label, i) => `
    <div class="ch-row">
      <span class="ch-label">${label}</span>
      <div class="toggle ${vals[i] ? 'on' : ''} ${manual ? 'disabled' : ''}" data-key="${key}" data-action="toggle-ch${i + 1}"></div>
    </div>`).join('');

  const ico = chs.length <= 2 ? '🔌' : '⚡';

  return `<div class="device-card full-width ${anyOn ? 'on' : ''}" id="card-${key}">
    <div class="card-head">
      <div class="card-ico-name"><span class="card-ico">${ico}</span><span class="card-label">${devLabel(key, cfg)}</span></div>
      <div class="card-head-actions">${favBtn(key)}</div>
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
    buildTVCard(),
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
    const actions = scene.isCustom
      ? `<button class="scene-action-btn" data-scene-action="edit"   data-scene="${scene.id}" title="${t('sceneEditTitle')}"   aria-label="${t('sceneEditTitle')}">✏️</button>
         <button class="scene-action-btn" data-scene-action="delete" data-scene="${scene.id}" title="${t('sceneDeleteTitle')}" aria-label="${t('sceneDeleteTitle')}">🗑️</button>`
      : `<button class="scene-action-btn" data-scene-action="edit" data-scene="${scene.id}" title="${t('sceneEditTitle')}" aria-label="${t('sceneEditTitle')}">✏️</button>
         ${scene.hasOverride ? `<button class="scene-action-btn" data-scene-action="reset" data-scene="${scene.id}" title="${t('sceneResetTitle')}" aria-label="${t('sceneResetTitle')}">↺</button>` : ''}`;

    return `<button class="scene-card" data-scene="${scene.id}" aria-label="${scene.title}">
      <div class="scene-card-actions">${actions}</div>
      <span class="scene-card-ico">${scene.icon}</span>
      <span class="scene-card-title">${scene.title}</span>
      <span class="scene-card-desc">${scene.desc}</span>
    </button>`;
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
