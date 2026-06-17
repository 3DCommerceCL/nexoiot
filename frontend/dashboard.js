'use strict';
// ─────────────────────────────────────────────────────────────────────────────
// Nexo IoT — Panel del Hotel
// Login con clave de administrador → ver habitaciones, controlar dispositivos
// y generar/finalizar accesos QR de huéspedes.
// ─────────────────────────────────────────────────────────────────────────────

const API_URL      = 'https://nexoiot-production.up.railway.app/api';
const FRONTEND_URL = 'https://3dcommercecl.github.io/nexoiot';
const SESSION_STORAGE = 'nexo_session'; // { token, rol, hotelId, nombre, email }
let HOTEL_ID = null; // se fija tras login: hotelId de la sesión (owner/recepcion) o ?hotel= de la URL (superadmin)
let currentRol = null; // 'superadmin' | 'owner' | 'recepcion', fijado tras login
const isOwnerOrSuper = () => currentRol === 'owner' || currentRol === 'superadmin';

const $ = id => document.getElementById(id);

// ── IDIOMA DEL PANEL (recepcionista) ──────────────────────────────────────────
// PLAN_TIERS, PLAN_LABELS, planLevel y LOCALES vienen de shared.js
const DASH_LANG_KEY = 'nexo_dash_lang';
let dashLang = localStorage.getItem(DASH_LANG_KEY) || 'es';

// ── TEMA DEL PANEL (claro / oscuro) ───────────────────────────────────────────
const DASH_THEME_KEY = 'nexo_dash_theme';

function applyDashTheme() {
  const dark = localStorage.getItem(DASH_THEME_KEY) === 'dark';
  document.body.classList.toggle('theme-dark', dark);
  const btn = document.getElementById('theme-toggle');
  if (btn) btn.textContent = dark ? '☀️' : '🌙';
}

function toggleDashTheme() {
  const dark = document.body.classList.toggle('theme-dark');
  localStorage.setItem(DASH_THEME_KEY, dark ? 'dark' : 'light');
  const btn = document.getElementById('theme-toggle');
  if (btn) btn.textContent = dark ? '☀️' : '🌙';
}

const DT = {
  es: {
    navOverview: 'Vista general',
    navRooms: 'Habitaciones',
    navSettings: 'Configuración',
    backToNexo: 'Panel Nexo IoT',
    sysActive: 'Sistema activo',
    connected: 'Conectado',
    newStay: '+ Nueva estadía',
    logout: 'Salir',
    loginDesc: 'Ingresa la clave de acceso entregada por Nexo IoT para administrar las habitaciones del hotel.',
    loginPh: 'Clave de acceso',
    loginBtn: 'Ingresar',
    loginErrEmpty: 'Ingresa la clave de acceso.',
    loginErrBad: 'Clave incorrecta o sin conexión.',
    kpiOccupied: 'Habitaciones ocupadas',
    kpiOccupancy: '{p}% de ocupación',
    kpiAvailable: 'Disponibles',
    kpiReady: 'Listas para check-in',
    kpiCheckouts: 'Check-outs hoy',
    kpiNoCheckouts: 'Sin check-outs hoy',
    bulkOffBtn: 'Apagar todo en estas habitaciones',
    bulkOffConfirm: '¿Apagar luces y enchufes en {n} habitación(es) con check-out hoy?',
    bulkOffDone: 'Listo: se apagaron {n} habitación(es)',
    bulkOffPartial: 'Se apagaron {ok} de {total} habitación(es); algunas fallaron',
    kpiTotal: 'Total habitaciones',
    kpiRegistered: 'Registradas en el sistema',
    roomShort: 'Hab {n}',
    requestsTitle: 'Solicitudes de huéspedes',
    requestTowels: 'Toallas / amenities',
    requestRoomService: 'Room service',
    requestCleaning: 'Limpieza',
    requestLateCheckout: 'Late checkout',
    requestMaintenance: 'Reporte de problema',
    requestOther: 'Otra solicitud',
    requestSub: 'Hab {room} · {guest} · {time}',
    requestResolveBtn: 'Resuelto ✓',
    requestResolved: 'Solicitud marcada como resuelta',
    noRequests: 'No hay solicitudes pendientes',
    dndBadge: 'No molestar',
    quickView: 'Habitaciones — vista rápida',
    filterAll: 'Todas',
    filterOccupied: 'Ocupadas',
    filterAvailable: 'Disponibles',
    searchPlaceholder: 'Buscar por habitación o huésped…',
    noSearchResults: 'No se encontraron habitaciones ni huéspedes con ese criterio',
    floor: 'Piso {n}',
    floorCount: '{n} habitaciones',
    badgeAvailable: 'Disponible',
    noGuest: 'Sin huésped — Piso {n}',
    qrActive: 'QR activo',
    viewBtn: 'Ver →',
    assignStay: '+ Asignar estadía',
    coToday: 'Hoy {t}',
    coTomorrow: 'Mañana {t}',
    coDays: 'En {n} días',
    roomTitle: 'Habitación {name}',
    checkoutPrefix: 'Check-out',
    loadingDevices: 'Cargando dispositivos…',
    loadDevError: 'Error al cargar dispositivos: {e}',
    devicesSection: 'Control de dispositivos',
    qrSection: 'Acceso QR de la estadía',
    activitySection: 'Actividad reciente',
    activityEmpty: 'Sin actividad registrada todavía.',
    activityCheckin: 'Check-in — QR generado',
    activityCheckout: 'Check-out',
    activityPrefsChanged: 'Preferencias actualizadas',
    activityServiceRequest: 'Solicitud de servicio',
    activityRequestResolved: 'Solicitud resuelta',
    activitySceneOff: 'Apagado masivo de dispositivos',
    newStayTitle: 'Nueva estadía',
    newStaySub: 'Asignar habitación y generar QR de acceso',
    prefsSection: 'Preferencias del huésped',
    guestLang: 'Idioma del huésped',
    guestA11y: 'Accesibilidad',
    a11yHearing: 'Auditiva (sordera)',
    a11yVisionHint: 'La app del huésped usará texto y controles grandes, con alto contraste.',
    a11yHearingHint: 'La app del huésped usará avisos visuales destacados y de mayor duración en lugar de sonidos.',
    prefsSaved: 'Preferencias actualizadas',
    qrLinkLabel: 'Link de acceso del huésped',
    waBtn: '📱 Enviar por WhatsApp',
    copyBtn: 'Copiar enlace',
    endStayBtn: '⏏ Finalizar estadía',
    copied: 'Enlace copiado',
    noPhone: 'El huésped no tiene teléfono registrado',
    endConfirm: '¿Finalizar la estadía y desactivar el acceso de este huésped?',
    endDone: 'Estadía finalizada',
    noRoomsAvail: 'No hay habitaciones disponibles',
    fRoom: 'Habitación disponible',
    fGuest: 'Nombre del huésped',
    fGuestPh: 'Nombre completo',
    fPhone: 'Teléfono WhatsApp',
    fCheckin: 'Check-in',
    fCheckout: 'Check-out',
    fErrFields: 'Completa nombre, check-in y check-out.',
    fErrDates: 'El check-out debe ser posterior al check-in.',
    fSubmit: 'Crear estadía y generar QR',
    fCreating: 'Creando estadía...',
    fNote: 'El QR queda disponible para enviar por WhatsApp una vez creada la estadía.',
    stayCreated: 'Estadía creada — QR listo para {name}',
    settingsTitle: 'Configuración del panel',
    panelLang: 'Idioma del panel',
    panelLangNote: 'Aplica solo a este panel de recepción. El idioma de cada huésped se configura al crear su estadía o desde el detalle de su habitación.',
    waMsg: '¡Hola {name}! Te damos la bienvenida a {hotel}. Aquí tienes el acceso al control inteligente de tu habitación: {url}',
    previewToast: 'Vista previa — función no conectada a un dispositivo real',
    devOffline: 'Sin conexión',
    manualNote: 'Control manual activado — el huésped usa el interruptor físico de la habitación.',
    unlockNote: 'Motor desbloqueado — la cortina se mueve a mano y no responde a la app.',
    openBtn: 'Abrir',
    stopBtn: 'Parar',
    closeBtn: 'Cerrar',
    doorOpenB: 'Abierta',
    doorClosedB: 'Cerrada',
    voiceOn: 'Asistente activo (Echo)',
    voiceOff: 'Modo privado — solo app',
    voiceDesc: 'Control con Amazon Echo. Disponible en el plan Premium.',
    bathDesc: 'Sensor de presencia + luz inteligente de baño. Incluido en Max Comfort.',
    bidetDesc: 'Bidé inteligente con asiento calefaccionado. Incluido en Max Comfort.',
    rugDesc: 'Alfombra con calefacción para pie de cama o baño. Incluida en Max Comfort.',
    climateTitle: 'Clima (AC + Ventana)',
    climateDesc: 'Control de aire acondicionado, sensor de ventana y automatizaciones. Incluido en el plan Premium.',
    langName_es: 'Español',
    langName_en: 'English',
    langName_pt: 'Português',
  },
  en: {
    navOverview: 'Overview',
    navRooms: 'Rooms',
    navSettings: 'Settings',
    backToNexo: 'Nexo IoT Panel',
    sysActive: 'System active',
    connected: 'Connected',
    newStay: '+ New stay',
    logout: 'Log out',
    loginDesc: 'Enter the access key provided by Nexo IoT to manage the hotel rooms.',
    loginPh: 'Access key',
    loginBtn: 'Sign in',
    loginErrEmpty: 'Enter the access key.',
    loginErrBad: 'Wrong key or no connection.',
    kpiOccupied: 'Occupied rooms',
    kpiOccupancy: '{p}% occupancy',
    kpiAvailable: 'Available',
    kpiReady: 'Ready for check-in',
    kpiCheckouts: 'Check-outs today',
    kpiNoCheckouts: 'No check-outs today',
    bulkOffBtn: 'Turn off all in these rooms',
    bulkOffConfirm: 'Turn off lights and outlets in {n} room(s) checking out today?',
    bulkOffDone: 'Done: {n} room(s) turned off',
    bulkOffPartial: '{ok} of {total} room(s) turned off; some failed',
    kpiTotal: 'Total rooms',
    kpiRegistered: 'Registered in the system',
    roomShort: 'Room {n}',
    requestsTitle: 'Guest requests',
    requestTowels: 'Towels / amenities',
    requestRoomService: 'Room service',
    requestCleaning: 'Housekeeping',
    requestLateCheckout: 'Late checkout',
    requestMaintenance: 'Issue report',
    requestOther: 'Other request',
    requestSub: 'Room {room} · {guest} · {time}',
    requestResolveBtn: 'Resolved ✓',
    requestResolved: 'Request marked as resolved',
    noRequests: 'No pending requests',
    dndBadge: 'Do Not Disturb',
    quickView: 'Rooms — quick view',
    filterAll: 'All',
    filterOccupied: 'Occupied',
    filterAvailable: 'Available',
    searchPlaceholder: 'Search by room or guest…',
    noSearchResults: 'No rooms or guests found matching that search',
    floor: 'Floor {n}',
    floorCount: '{n} rooms',
    badgeAvailable: 'Available',
    noGuest: 'No guest — Floor {n}',
    qrActive: 'QR active',
    viewBtn: 'View →',
    assignStay: '+ Assign stay',
    coToday: 'Today {t}',
    coTomorrow: 'Tomorrow {t}',
    coDays: 'In {n} days',
    roomTitle: 'Room {name}',
    checkoutPrefix: 'Check-out',
    loadingDevices: 'Loading devices…',
    loadDevError: 'Failed to load devices: {e}',
    devicesSection: 'Device control',
    qrSection: 'Stay QR access',
    activitySection: 'Recent activity',
    activityEmpty: 'No activity recorded yet.',
    activityCheckin: 'Check-in — QR generated',
    activityCheckout: 'Check-out',
    activityPrefsChanged: 'Preferences updated',
    activityServiceRequest: 'Service request',
    activityRequestResolved: 'Request resolved',
    activitySceneOff: 'Bulk device shutdown',
    newStayTitle: 'New stay',
    newStaySub: 'Assign a room and generate the access QR',
    prefsSection: 'Guest preferences',
    guestLang: 'Guest language',
    guestA11y: 'Accessibility',
    a11yHearing: 'Hearing (deafness)',
    a11yVisionHint: 'The guest app will use large text and controls with high contrast.',
    a11yHearingHint: 'The guest app will use prominent, longer-lasting visual alerts instead of sounds.',
    prefsSaved: 'Preferences updated',
    qrLinkLabel: 'Guest access link',
    waBtn: '📱 Send via WhatsApp',
    copyBtn: 'Copy link',
    endStayBtn: '⏏ End stay',
    copied: 'Link copied',
    noPhone: 'The guest has no registered phone',
    endConfirm: 'End the stay and deactivate this guest’s access?',
    endDone: 'Stay ended',
    noRoomsAvail: 'No rooms available',
    fRoom: 'Available room',
    fGuest: 'Guest name',
    fGuestPh: 'Full name',
    fPhone: 'WhatsApp phone',
    fCheckin: 'Check-in',
    fCheckout: 'Check-out',
    fErrFields: 'Fill in name, check-in and check-out.',
    fErrDates: 'Check-out must be after check-in.',
    fSubmit: 'Create stay and generate QR',
    fCreating: 'Creating stay...',
    fNote: 'The QR becomes available to send via WhatsApp once the stay is created.',
    stayCreated: 'Stay created — QR ready for {name}',
    settingsTitle: 'Panel settings',
    panelLang: 'Panel language',
    panelLangNote: 'Applies only to this reception panel. Each guest’s language is set when creating their stay or from their room details.',
    waMsg: 'Hello {name}! Welcome to {hotel}. Here is your access to your room’s smart controls: {url}',
    previewToast: 'Preview — feature not connected to a real device',
    devOffline: 'Offline',
    manualNote: 'Manual control enabled — the guest uses the physical switch in the room.',
    unlockNote: 'Motor unlocked — the curtain moves by hand and does not respond to the app.',
    openBtn: 'Open',
    stopBtn: 'Stop',
    closeBtn: 'Close',
    doorOpenB: 'Open',
    doorClosedB: 'Closed',
    voiceOn: 'Assistant active (Echo)',
    voiceOff: 'Private mode — app only',
    voiceDesc: 'Amazon Echo control. Available on the Premium plan.',
    bathDesc: 'Presence sensor + smart bathroom light. Included in Max Comfort.',
    bidetDesc: 'Smart bidet with heated seat. Included in Max Comfort.',
    rugDesc: 'Heated rug for bedside or bathroom. Included in Max Comfort.',
    climateTitle: 'Climate (AC + Window)',
    climateDesc: 'Air conditioning control, window sensor and automations. Included in the Premium plan.',
    langName_es: 'Español',
    langName_en: 'English',
    langName_pt: 'Português',
  },
  pt: {
    navOverview: 'Visão geral',
    navRooms: 'Quartos',
    navSettings: 'Configurações',
    backToNexo: 'Painel Nexo IoT',
    sysActive: 'Sistema ativo',
    connected: 'Conectado',
    newStay: '+ Nova estadia',
    logout: 'Sair',
    loginDesc: 'Digite a chave de acesso fornecida pela Nexo IoT para administrar os quartos do hotel.',
    loginPh: 'Chave de acesso',
    loginBtn: 'Entrar',
    loginErrEmpty: 'Digite a chave de acesso.',
    loginErrBad: 'Chave incorreta ou sem conexão.',
    kpiOccupied: 'Quartos ocupados',
    kpiOccupancy: '{p}% de ocupação',
    kpiAvailable: 'Disponíveis',
    kpiReady: 'Prontos para check-in',
    kpiCheckouts: 'Check-outs hoje',
    kpiNoCheckouts: 'Sem check-outs hoje',
    bulkOffBtn: 'Desligar tudo nesses quartos',
    bulkOffConfirm: 'Desligar luzes e tomadas em {n} quarto(s) com check-out hoje?',
    bulkOffDone: 'Pronto: {n} quarto(s) desligados',
    bulkOffPartial: '{ok} de {total} quarto(s) desligados; alguns falharam',
    kpiTotal: 'Total de quartos',
    kpiRegistered: 'Registrados no sistema',
    roomShort: 'Quarto {n}',
    requestsTitle: 'Solicitações dos hóspedes',
    requestTowels: 'Toalhas / amenities',
    requestRoomService: 'Room service',
    requestCleaning: 'Limpeza',
    requestLateCheckout: 'Late checkout',
    requestMaintenance: 'Relato de problema',
    requestOther: 'Outra solicitação',
    requestSub: 'Quarto {room} · {guest} · {time}',
    requestResolveBtn: 'Resolvido ✓',
    requestResolved: 'Solicitação marcada como resolvida',
    noRequests: 'Não há solicitações pendentes',
    dndBadge: 'Não perturbe',
    quickView: 'Quartos — visão rápida',
    filterAll: 'Todos',
    filterOccupied: 'Ocupados',
    filterAvailable: 'Disponíveis',
    searchPlaceholder: 'Buscar por quarto ou hóspede…',
    noSearchResults: 'Nenhum quarto ou hóspede encontrado com esse critério',
    floor: 'Andar {n}',
    floorCount: '{n} quartos',
    badgeAvailable: 'Disponível',
    noGuest: 'Sem hóspede — Andar {n}',
    qrActive: 'QR ativo',
    viewBtn: 'Ver →',
    assignStay: '+ Atribuir estadia',
    coToday: 'Hoje {t}',
    coTomorrow: 'Amanhã {t}',
    coDays: 'Em {n} dias',
    roomTitle: 'Quarto {name}',
    checkoutPrefix: 'Check-out',
    loadingDevices: 'Carregando dispositivos…',
    loadDevError: 'Erro ao carregar dispositivos: {e}',
    devicesSection: 'Controle de dispositivos',
    qrSection: 'Acesso QR da estadia',
    activitySection: 'Atividade recente',
    activityEmpty: 'Nenhuma atividade registrada ainda.',
    activityCheckin: 'Check-in — QR gerado',
    activityCheckout: 'Check-out',
    activityPrefsChanged: 'Preferências atualizadas',
    activityServiceRequest: 'Solicitação de serviço',
    activityRequestResolved: 'Solicitação resolvida',
    activitySceneOff: 'Desligamento em massa de dispositivos',
    newStayTitle: 'Nova estadia',
    newStaySub: 'Atribuir quarto e gerar QR de acesso',
    prefsSection: 'Preferências do hóspede',
    guestLang: 'Idioma do hóspede',
    guestA11y: 'Acessibilidade',
    a11yHearing: 'Auditiva (surdez)',
    a11yVisionHint: 'O app do hóspede usará texto e controles grandes, com alto contraste.',
    a11yHearingHint: 'O app do hóspede usará avisos visuais destacados e mais duradouros em vez de sons.',
    prefsSaved: 'Preferências atualizadas',
    qrLinkLabel: 'Link de acesso do hóspede',
    waBtn: '📱 Enviar por WhatsApp',
    copyBtn: 'Copiar link',
    endStayBtn: '⏏ Finalizar estadia',
    copied: 'Link copiado',
    noPhone: 'O hóspede não tem telefone registrado',
    endConfirm: 'Finalizar a estadia e desativar o acesso deste hóspede?',
    endDone: 'Estadia finalizada',
    noRoomsAvail: 'Não há quartos disponíveis',
    fRoom: 'Quarto disponível',
    fGuest: 'Nome do hóspede',
    fGuestPh: 'Nome completo',
    fPhone: 'Telefone WhatsApp',
    fCheckin: 'Check-in',
    fCheckout: 'Check-out',
    fErrFields: 'Preencha nome, check-in e check-out.',
    fErrDates: 'O check-out deve ser depois do check-in.',
    fSubmit: 'Criar estadia e gerar QR',
    fCreating: 'Criando estadia...',
    fNote: 'O QR fica disponível para enviar por WhatsApp assim que a estadia for criada.',
    stayCreated: 'Estadia criada — QR pronto para {name}',
    settingsTitle: 'Configurações do painel',
    panelLang: 'Idioma do painel',
    panelLangNote: 'Aplica-se apenas a este painel da recepção. O idioma de cada hóspede é definido ao criar a estadia ou no detalhe do quarto.',
    waMsg: 'Olá {name}! Bem-vindo ao {hotel}. Aqui está o acesso ao controle inteligente do seu quarto: {url}',
    previewToast: 'Pré-visualização — função não conectada a um dispositivo real',
    devOffline: 'Sem conexão',
    manualNote: 'Controle manual ativado — o hóspede usa o interruptor físico do quarto.',
    unlockNote: 'Motor destravado — a cortina se move com a mão e não responde ao app.',
    openBtn: 'Abrir',
    stopBtn: 'Parar',
    closeBtn: 'Fechar',
    doorOpenB: 'Aberta',
    doorClosedB: 'Fechada',
    voiceOn: 'Assistente ativo (Echo)',
    voiceOff: 'Modo privado — só app',
    voiceDesc: 'Controle com Amazon Echo. Disponível no plano Premium.',
    bathDesc: 'Sensor de presença + luz inteligente no banheiro. Incluído no Max Comfort.',
    bidetDesc: 'Bidê inteligente com assento aquecido. Incluído no Max Comfort.',
    rugDesc: 'Tapete com aquecimento para beira da cama ou banheiro. Incluído no Max Comfort.',
    climateTitle: 'Clima (AC + Janela)',
    climateDesc: 'Controle de ar-condicionado, sensor de janela e automações. Incluído no plano Premium.',
    langName_es: 'Español',
    langName_en: 'English',
    langName_pt: 'Português',
  },
};

const dt    = makeTranslator(DT, () => dashLang);
const dtDev = makeDevLabel(DT, () => dashLang);

// Idiomas y modos de accesibilidad disponibles para huéspedes
const GUEST_LANGS = ['es', 'en', 'pt'];
const A11Y_MODES  = [['none', 'a11yNone'], ['vision', 'a11yVision'], ['hearing', 'a11yHearing']];

// title/desc son claves del diccionario DT que se resuelven al renderizar.
const PLAN_FEATURES_INFO = {
  voice:    { icon: '🔊', title: 'voiceTitle',   desc: 'voiceDesc',   minPlan: 'premium',     badge: 'PREMIUM' },
  bathroom: { icon: '🚿', title: 'bathTitle',    desc: 'bathDesc',    minPlan: 'max_comfort', badge: 'MAX COMFORT' },
  bidet:    { icon: '🚽', title: 'bidetTitle',   desc: 'bidetDesc',   minPlan: 'max_comfort', badge: 'MAX COMFORT' },
  rug:      { icon: '🔥', title: 'rugTitle',     desc: 'rugDesc',     minPlan: 'max_comfort', badge: 'MAX COMFORT' },
  climate:  { icon: '❄️', title: 'climateTitle', desc: 'climateDesc', minPlan: 'premium',     badge: 'PREMIUM' },
};

// ── ÍCONOS PERSONALIZADOS ─────────────────────────────────────────────────────
const ICON_BED = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 17v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5"/><path d="M2 17h20v3"/><path d="M2 20v-3"/><path d="M22 20v-3"/><path d="M4 10V6a1 1 0 0 1 1-1h6v5"/></svg>';
const ICON_LAMP = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 4h8l4 7H4z"/><line x1="12" y1="11" x2="12" y2="19"/><line x1="8" y1="21" x2="16" y2="21"/></svg>';
const ICON_CEILING_LAMP = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="2" x2="12" y2="7"/><path d="M6 16l2-9h8l2 9z"/><line x1="6" y1="16" x2="18" y2="16"/></svg>';

const DEV_ICON_OVERRIDES = {
  led_cama:     ICON_BED,
  luz_velador1: ICON_LAMP,
  luz_velador2: ICON_LAMP,
  luz_techo:    ICON_CEILING_LAMP,
};

const state = {
  view: 'overview',
  filter: 'all',
  search: '',
  sidebarCollapsed: false,
  currentRoom: null,   // { id, token, devices, plan }
  placeholder: {},     // estado local de funciones del plan (no conectadas a dispositivos reales)
};

let rooms = []; // [{ id, name, hotel, floor, guest: {...} | null }]
let categoriasCache = []; // [{ id, hotel_id, nombre, camas }]

// ── HELPERS ───────────────────────────────────────────────────────────────────
function getSession() {
  try { return JSON.parse(sessionStorage.getItem(SESSION_STORAGE) || 'null'); }
  catch { return null; }
}
function getToken() { return getSession()?.token || ''; }

const apiFetch = createApiFetch(API_URL, () => ({ 'Authorization': `Bearer ${getToken()}` }));

function toLocalInputValue(date) {
  const pad = n => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function checkoutInfo(iso) {
  const checkout = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((checkout.setHours(0,0,0,0) - new Date(now).setHours(0,0,0,0)) / 86400000);
  const time = new Date(iso).toLocaleTimeString(LOCALES[dashLang] || 'es-CL', { hour: '2-digit', minute: '2-digit' });
  if (diffDays <= 0) return { label: dt('coToday', { t: time }), urgency: 'today' };
  if (diffDays === 1) return { label: dt('coTomorrow', { t: time }), urgency: 'tomorrow' };
  return { label: dt('coDays', { n: diffDays }), urgency: 'later' };
}

function showToast(msg, type = '') {
  renderToast(msg, { type, axis: 'x' });
}

window.closeModal = function(id) {
  $(id).classList.add('hidden');
  if (id === 'modal-room') state.currentRoom = null;
};

// ── LOGIN ─────────────────────────────────────────────────────────────────────
async function login() {
  const email    = $('login-email').value.trim();
  const password = $('login-password').value;
  const error    = $('login-error');
  error.textContent = '';
  if (!email || !password) { error.textContent = dt('loginErrEmpty'); return; }

  try {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || 'Error de autenticación');

    sessionStorage.setItem(SESSION_STORAGE, JSON.stringify(body));
    HOTEL_ID = body.rol === 'superadmin'
      ? new URLSearchParams(location.search).get('hotel')
      : body.hotelId;

    applyRoleVisibility(body.rol);
    await loadRooms();
    $('login-screen').classList.add('hidden');
    $('sidebar').classList.remove('hidden');
    $('main').classList.remove('hidden');
    loadRequests();
  } catch (err) {
    sessionStorage.removeItem(SESSION_STORAGE);
    error.textContent = err.message || dt('loginErrBad');
  }
}

function applyRoleVisibility(rol) {
  currentRol = rol;
  const fullAccess = isOwnerOrSuper();
  document.querySelectorAll('.nav-item[data-role]').forEach(el => {
    el.classList.toggle('hidden', !fullAccess);
  });
  const back = $('back-to-nexo');
  if (back) back.classList.toggle('hidden', rol !== 'superadmin');
}

function logout() {
  apiFetch('/auth/logout', { method: 'POST' }).catch(() => {});
  sessionStorage.removeItem(SESSION_STORAGE);
  $('sidebar').classList.add('hidden');
  $('main').classList.add('hidden');
  $('login-screen').classList.remove('hidden');
  $('login-email').value = '';
  $('login-password').value = '';
}

// ── DATA ──────────────────────────────────────────────────────────────────────
async function loadRooms() {
  const qs = HOTEL_ID ? `?hotel=${encodeURIComponent(HOTEL_ID)}` : '';
  rooms = await apiFetch(`/admin/rooms${qs}`);
  // Ordenar por piso y número de habitación (101..120, 201..220, ...)
  rooms.sort((a, b) => {
    if (a.floor !== b.floor) return a.floor - b.floor;
    const numA = parseInt((a.name.match(/\d+/) || [0])[0], 10);
    const numB = parseInt((b.name.match(/\d+/) || [0])[0], 10);
    return numA - numB;
  });
  $('hotel-name').textContent = rooms[0]?.hotel || 'Panel del Hotel';
  await loadCategoriasCache();
  renderKPIs();
  renderRooms('overview');
  if (state.view === 'rooms') renderRooms('rooms', state.filter);
}

async function loadCategoriasCache() {
  if (!HOTEL_ID) return;
  try {
    categoriasCache = await apiFetch(`/admin/categorias?hotel=${encodeURIComponent(HOTEL_ID)}`);
  } catch { categoriasCache = []; }
}

// ── SOLICITUDES DE HUÉSPEDES ──────────────────────────────────────────────────
let requests = [];

async function loadRequests() {
  const qs = HOTEL_ID ? `?hotel=${encodeURIComponent(HOTEL_ID)}&status=pending` : '?status=pending';
  try {
    requests = await apiFetch(`/admin/requests${qs}`);
  } catch {
    requests = [];
  }
  renderRequests();
}

const REQUEST_ICONS = { towels: '🧺', roomservice: '🍽', cleaning: '🧹', late_checkout: '🕐', maintenance: '🔧', other: '💬' };
const REQUEST_TITLE_KEY = {
  towels: 'requestTowels', roomservice: 'requestRoomService', cleaning: 'requestCleaning',
  late_checkout: 'requestLateCheckout', maintenance: 'requestMaintenance', other: 'requestOther',
};

function timeAgo(iso) {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso)) / 60000));
  if (mins < 1)  return '<1m';
  if (mins < 60) return `${mins}m`;
  return `${Math.round(mins / 60)}h`;
}

function renderRequests() {
  const list = $('requests-list');
  if (!list) return;
  if (!requests.length) {
    list.innerHTML = `<div class="request-empty">${dt('noRequests')}</div>`;
    return;
  }
  list.innerHTML = requests.map(r => `
    <div class="request-item" id="req-${r.id}">
      <span class="request-ico">${REQUEST_ICONS[r.type] || '🔔'}</span>
      <div class="request-body">
        <div class="request-title">${dt(REQUEST_TITLE_KEY[r.type] || 'requestOther')}</div>
        <div class="request-sub">${dt('requestSub', { room: r.roomName, guest: r.guestName, time: timeAgo(r.createdAt) })}</div>
        ${r.note ? `<div class="request-note">${r.note}</div>` : ''}
      </div>
      <button class="btn btn-sm btn-outline-teal" onclick="resolveRequest('${r.id}')">${dt('requestResolveBtn')}</button>
    </div>`).join('');
}

window.resolveRequest = async function(id) {
  try {
    await apiFetch(`/admin/requests/${id}/resolve`, { method: 'POST' });
    requests = requests.filter(r => r.id !== id);
    renderRequests();
    showToast(dt('requestResolved'), 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
};

const occupiedRooms  = () => rooms.filter(r => r.guest);
const availableRooms = () => rooms.filter(r => !r.guest);
const todayCheckouts = () => occupiedRooms().filter(r => checkoutInfo(r.guest.checkout).urgency === 'today');

// ── ACCIONES MASIVAS ──────────────────────────────────────────────────────────
window.bulkTurnOffCheckouts = async function() {
  const today = todayCheckouts();
  if (!today.length) return;
  if (!confirm(dt('bulkOffConfirm', { n: today.length }))) return;

  const results = await Promise.allSettled(
    today.map(r => apiFetch(`/admin/rooms/${r.id}/scene`, { method: 'POST', body: JSON.stringify({ scene: 'off' }) }))
  );
  const failed = results.filter(r => r.status === 'rejected').length;

  if (failed) {
    showToast(dt('bulkOffPartial', { ok: today.length - failed, total: today.length }), 'error');
  } else {
    showToast(dt('bulkOffDone', { n: today.length }), 'success');
  }
};

// ── KPIs ──────────────────────────────────────────────────────────────────────
function renderKPIs() {
  const occ   = occupiedRooms().length;
  const total = rooms.length;
  const pct   = total ? Math.round(occ / total * 100) : 0;
  const today = todayCheckouts();

  $('kpi-row').innerHTML = `
    <div class="kpi-card">
      <div class="kpi-label">${dt('kpiOccupied')}</div>
      <div class="kpi-value">${occ} <span style="font-size:16px;color:rgba(255,255,255,.6);font-weight:500">/ ${total}</span></div>
      <div class="kpi-prog-track"><div class="kpi-prog-fill" style="width:${pct}%"></div></div>
      <div class="kpi-sub">${dt('kpiOccupancy', { p: pct })}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">${dt('kpiAvailable')}</div>
      <div class="kpi-value">${availableRooms().length}</div>
      <div class="kpi-sub">${dt('kpiReady')}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">${dt('kpiCheckouts')}</div>
      <div class="kpi-value">${today.length}</div>
      <div class="kpi-sub">${today.map(r => dt('roomShort', { n: r.name })).join(' · ') || dt('kpiNoCheckouts')}</div>
      ${today.length ? `<button class="btn btn-sm btn-outline-teal" style="margin-top:10px;width:100%;border-color:rgba(255,255,255,.5);color:#fff" onclick="bulkTurnOffCheckouts()">${dt('bulkOffBtn')}</button>` : ''}
    </div>
    <div class="kpi-card">
      <div class="kpi-label">${dt('kpiTotal')}</div>
      <div class="kpi-value">${total}</div>
      <div class="kpi-sub">${dt('kpiRegistered')}</div>
    </div>
  `;
}

// ── ROOM GRID ─────────────────────────────────────────────────────────────────
function categoriaControlHtml(room) {
  const cat = categoriasCache.find(c => c.id === room.categoriaId);
  if (!isOwnerOrSuper()) {
    return cat ? `<span class="badge">🛏️ ${cat.nombre}</span>` : '';
  }
  const opts = ['<option value="">Sin categoría</option>']
    .concat(categoriasCache.map(c => `<option value="${c.id}" ${c.id === room.categoriaId ? 'selected' : ''}>${c.nombre} (${c.camas} cama${c.camas !== 1 ? 's' : ''})</option>`));
  return `<select class="form-input" style="font-size:10px;padding:3px 6px;height:auto;width:auto" onclick="event.stopPropagation()" onchange="assignCategoria('${room.id}', this.value)">${opts.join('')}</select>`;
}

function buildRoomCard(room) {
  const planBadge = `<span class="badge badge-plan">${PLAN_LABELS[room.plan] || 'Base'}</span>`;
  const categoriaBadge = categoriaControlHtml(room);
  if (room.guest) {
    const co = checkoutInfo(room.guest.checkout);
    // Badges de idioma y accesibilidad del huésped (solo cuando no son los predeterminados)
    const langBadge = room.guest.lang && room.guest.lang !== 'es'
      ? `<span class="badge">🌐 ${room.guest.lang.toUpperCase()}</span>` : '';
    const a11yBadge = room.guest.accessibility && room.guest.accessibility !== 'none'
      ? `<span class="badge" title="${dt(room.guest.accessibility === 'vision' ? 'a11yVision' : 'a11yHearing')}">${room.guest.accessibility === 'vision' ? '👁' : '🦻'}</span>` : '';
    const dndBadge = room.guest.dnd
      ? `<span class="badge" title="${dt('dndBadge')}">🔕</span>` : '';
    return `
    <div class="room-card" id="rc-${room.id}">
      <div class="rc-top">
        <span class="rc-num">${room.name}</span>
      </div>
      <div class="rc-badges"><span class="badge badge-floor">${dt('floor', { n: room.floor })}</span>${planBadge}${categoriaBadge}${langBadge}${a11yBadge}${dndBadge}</div>
      <div class="rc-guest">${room.guest.guestName}</div>
      <div class="rc-checkout ${co.urgency}">${co.urgency === 'today' ? '⚠️' : '🗓'} ${co.label}</div>
      <div class="rc-footer">
        <div class="qr-status active"><span class="qr-dot"></span>${dt('qrActive')}</div>
        <button class="btn btn-sm btn-ghost" onclick="openRoomModal('${room.id}')">${dt('viewBtn')}</button>
      </div>
    </div>`;
  }
  return `
  <div class="room-card" id="rc-${room.id}" style="border-style:dashed">
    <div class="rc-top">
      <span class="rc-num">${room.name}</span>
    </div>
    <div class="rc-badges"><span class="badge badge-available">${dt('badgeAvailable')}</span>${planBadge}${categoriaBadge}</div>
    <div class="rc-empty">${dt('noGuest', { n: room.floor })}</div>
    <button class="btn btn-sm btn-outline-teal" style="margin-top:auto" onclick="openNewStayModal('${room.id}')">${dt('assignStay')}</button>
  </div>`;
}

const expandedFloors = new Set();

window.toggleFloor = function(floor) {
  if (expandedFloors.has(floor)) expandedFloors.delete(floor);
  else expandedFloors.add(floor);
  renderRooms('rooms', state.filter);
};

function renderRooms(target = 'overview', filter = 'all') {
  let list = rooms;
  if (filter === 'occupied')  list = occupiedRooms();
  if (filter === 'available') list = availableRooms();

  const q = state.search.trim().toLowerCase();
  if (q) {
    list = list.filter(r =>
      r.name.toLowerCase().includes(q) ||
      (r.guest && r.guest.guestName.toLowerCase().includes(q)));
  }

  if (target === 'rooms') {
    if (q) {
      $(`room-grid-${target}`).innerHTML = list.length
        ? `<div class="room-grid">${list.map(buildRoomCard).join('')}</div>`
        : `<div class="no-results">${dt('noSearchResults')}</div>`;
      return;
    }

    const floors = [...new Set(list.map(r => r.floor))].sort((a, b) => a - b);
    $(`room-grid-${target}`).innerHTML = floors.map(floor => {
      const floorRooms = list.filter(r => r.floor === floor);
      const expanded = expandedFloors.has(floor);
      return `<div class="floor-group">
        <div class="floor-header" onclick="toggleFloor(${floor})">
          <span class="floor-chevron ${expanded ? 'open' : ''}">▸</span>
          <span class="floor-title">${dt('floor', { n: floor })}</span>
          <span class="floor-count">${dt('floorCount', { n: floorRooms.length })}</span>
        </div>
        <div class="room-grid floor-rooms ${expanded ? '' : 'collapsed'}">
          ${floorRooms.map(buildRoomCard).join('')}
        </div>
      </div>`;
    }).join('');
    return;
  }

  $(`room-grid-${target}`).innerHTML = list.map(buildRoomCard).join('');
}

// ── NAVIGATION ────────────────────────────────────────────────────────────────
const viewTitle = view =>
  ({
    overview: dt('navOverview'), rooms: dt('navRooms'), settings: dt('navSettings'), calendar: 'Calendario',
    channels: 'Canales OTA', booking: 'Motor de Reservas', pagos: 'Pagos', categorias: 'Categorías',
  }[view] || view);

// ── SIDEBAR MÓVIL (off-canvas) ───────────────────────────────────────────────
function toggleMobileSidebar() {
  $('sidebar').classList.toggle('mobile-open');
  $('sidebar-backdrop').classList.toggle('show');
}

function closeMobileSidebar() {
  $('sidebar').classList.remove('mobile-open');
  $('sidebar-backdrop').classList.remove('show');
}

function navigate(view) {
  state.view = view;
  document.querySelectorAll('.nav-item').forEach(el => el.classList.toggle('active', el.dataset.view === view));
  document.querySelectorAll('.view').forEach(el => el.classList.toggle('active', el.id === `view-${view}`));
  $('page-title').textContent = viewTitle(view);
  $('content').classList.toggle('cal-active', view === 'calendar');
  if (view === 'rooms') renderRooms('rooms', state.filter);
  if (view === 'calendar') initCalendar();
  if (view === 'channels') loadCanales();
  if (view === 'booking') loadBookingConfig();
  if (view === 'pagos') loadTransacciones();
  if (view === 'categorias') loadCategorias();
}

// ── IDIOMA DEL PANEL ──────────────────────────────────────────────────────────
function setDashLang(lang) {
  if (!DT[lang] || lang === dashLang) return;
  dashLang = lang;
  localStorage.setItem(DASH_LANG_KEY, lang);
  applyDashLang();
}

function applyDashLang() {
  document.documentElement.lang = dashLang;
  document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = dt(el.dataset.i18n); });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => { el.placeholder = dt(el.dataset.i18nPlaceholder); });
  $('page-title').textContent = viewTitle(state.view);
  const sel = $('panel-lang-select');
  if (sel) sel.value = dashLang;
  if (rooms.length) {
    renderKPIs();
    renderRooms('overview');
    if (state.view === 'rooms') renderRooms('rooms', state.filter);
  }
  renderRequests();
}

// ── ROOM MODAL ────────────────────────────────────────────────────────────────
window.openRoomModal = async function(roomId) {
  const room = rooms.find(r => r.id === roomId);
  if (!room || !room.guest) return;

  $('mr-title').textContent    = dt('roomTitle', { name: room.name });
  $('mr-subtitle').textContent = `${room.guest.guestName} · ${dt('checkoutPrefix')}: ${checkoutInfo(room.guest.checkout).label}`;
  $('dev-grid').innerHTML = `<div class="form-note">${dt('loadingDevices')}</div>`;
  $('climate-alert').classList.add('hidden');
  renderPrefsSection(room);
  $('modal-room').classList.remove('hidden');

  try {
    const data = await apiFetch(`/room/${room.guest.token}`, { headers: {} });
    state.currentRoom = { id: room.id, token: room.guest.token, devices: data.devices, plan: room.plan || 'base' };
    state.placeholder = {
      tv:       { on: false, vol: 30, source: 'cable' },
      voice:    { on: true },
      bathroom: { presence: false, lightOn: false, intensity: 60, colorTemp: 50, auto: true },
      bidet:    { on: false, heatedSeat: false, mode: null },
      rug:      { on: false, level: 'media' },
      climate:  { acOn: false, temp: 22, windowOpen: false, autoOff: true },
    };
    renderDevGrid();
    renderQRSection(room);
  } catch (err) {
    $('dev-grid').innerHTML = `<div class="form-note">${dt('loadDevError', { e: err.message })}</div>`;
  }
  renderActivitySection(room);
};

// ── PREFERENCIAS DEL HUÉSPED (idioma + accesibilidad de la estadía) ──────────
function renderPrefsSection(room) {
  const g = room.guest;
  const langOpts = GUEST_LANGS.map(l =>
    `<option value="${l}" ${(g.lang || 'es') === l ? 'selected' : ''}>${dt('langName_' + l)}</option>`).join('');
  const a11yOpts = A11Y_MODES.map(([v, k]) =>
    `<option value="${v}" ${(g.accessibility || 'none') === v ? 'selected' : ''}>${dt(k)}</option>`).join('');
  const hint = g.accessibility === 'vision' ? dt('a11yVisionHint')
    : g.accessibility === 'hearing' ? dt('a11yHearingHint') : '';

  $('prefs-section').innerHTML = `
    <div class="form-grid">
      <div class="form-group">
        <label class="form-label">${dt('guestLang')}</label>
        <select class="form-input" onchange="updateStayPrefs('${room.id}','lang',this.value)">${langOpts}</select>
      </div>
      <div class="form-group">
        <label class="form-label">${dt('guestA11y')}</label>
        <select class="form-input" onchange="updateStayPrefs('${room.id}','accessibility',this.value)">${a11yOpts}</select>
      </div>
    </div>
    ${hint ? `<p class="form-note">${hint}</p>` : ''}`;
}

window.updateStayPrefs = async function(roomId, prop, value) {
  const room = rooms.find(r => r.id === roomId);
  if (!room?.guest) return;
  room.guest[prop] = value;
  renderPrefsSection(room);
  try {
    await apiFetch(`/admin/token/${room.guest.token}/prefs`, {
      method: 'POST',
      body: JSON.stringify({ [prop]: value }),
    });
    showToast(dt('prefsSaved'), 'success');
    renderRooms('overview');
    if (state.view === 'rooms') renderRooms('rooms', state.filter);
  } catch (err) {
    showToast(err.message, 'error');
  }
};

const DEV_ICONS = {
  light: '💡', light_rgb: '💡', curtain: '🪟', switch_3ch: '🔌', switch: '🔌', door_sensor: '🚪',
};

function renderDevGrid() {
  const { devices, plan } = state.currentRoom;
  const cards = Object.entries(devices).map(([key, dev]) => buildDeviceCard(key, dev));
  cards.push(buildTVCard());
  cards.push(buildFeatureCard('voice',    PLAN_FEATURES_INFO.voice,    buildVoiceCard,    plan));
  if (planLevel(plan) >= PLAN_TIERS.premium) {
    cards.push(buildACCard());
    cards.push(buildWindowCard());
    cards.push(buildAutomationCard());
  } else {
    cards.push(buildLockedCard('climate', PLAN_FEATURES_INFO.climate, plan));
  }
  cards.push(buildFeatureCard('bathroom', PLAN_FEATURES_INFO.bathroom, buildBathroomCard, plan));
  cards.push(buildFeatureCard('bidet',    PLAN_FEATURES_INFO.bidet,    buildBidetCard,    plan));
  cards.push(buildFeatureCard('rug',      PLAN_FEATURES_INFO.rug,      buildRugCard,      plan));
  $('dev-grid').innerHTML = cards.join('');
  updateClimateAlert();
}

function updateClimateAlert() {
  const { plan } = state.currentRoom;
  const s = state.placeholder.climate;
  const active = planLevel(plan) >= PLAN_TIERS.premium && s.acOn && s.windowOpen;
  $('climate-alert').classList.toggle('hidden', !active);
}

// ── FUNCIONES DEL PLAN (placeholders no conectados a dispositivos reales) ────
function buildFeatureCard(key, info, builder, plan) {
  if (planLevel(plan) >= planLevel(info.minPlan)) return builder();
  return buildLockedCard(key, info, plan);
}

function buildLockedCard(key, info, plan) {
  return `<div class="dev-card feature-card locked">
    <div class="feature-lock-icon">${info.icon}</div>
    <div class="feature-lock-title">${dt(info.title)}</div>
    <div class="feature-lock-desc">${dt(info.desc)}</div>
    <span class="feature-plan-badge">${info.badge}</span>
  </div>`;
}

function buildTVCard() {
  const s = state.placeholder.tv;
  const sources = [
    { id: 'cable',   label: dt('tvCable') },
    { id: 'netflix', label: dt('tvStreaming') },
    { id: 'hdmi',    label: dt('tvHdmi') },
  ];
  return `<div class="dev-card">
    <div class="dev-card-head">
      <div class="dev-card-name"><span class="dev-card-ico">📺</span> TV</div>
      <div class="toggle-sw ${s.on ? 'on' : ''}" onclick="toggleFeature('tv')"></div>
    </div>
    <div class="${s.on ? '' : 'dev-dimmed'}">
      <div class="dev-status ${s.on ? 'on-label' : ''}">${s.on ? dt('onF') : dt('offF')}</div>
      <div class="slider-wrap">
        <input type="range" min="0" max="100" value="${s.vol}" ${s.on ? '' : 'disabled'}
          oninput="this.nextElementSibling.textContent=this.value+'%'"
          onchange="setFeatureVal('tv','vol',this.value)">
        <span class="slider-val">${s.vol}%</span>
      </div>
      <div class="source-row">
        ${sources.map(src => `<button class="source-btn ${s.source === src.id ? 'active' : ''}" onclick="setFeatureVal('tv','source','${src.id}')">${src.label}</button>`).join('')}
      </div>
    </div>
  </div>`;
}

function buildVoiceCard() {
  const s = state.placeholder.voice;
  return `<div class="dev-card">
    <div class="dev-card-head">
      <div class="dev-card-name"><span class="dev-card-ico">🔊</span> ${dt('voiceTitle')}</div>
      <div class="toggle-sw ${s.on ? 'on' : ''}" onclick="toggleFeature('voice')"></div>
    </div>
    <div class="dev-status ${s.on ? 'on-label' : ''}">${s.on ? dt('voiceOn') : dt('voiceOff')}</div>
    <div class="feature-row">
      <span class="feature-row-label"><span class="led-dot ${s.on ? 'on' : ''}"></span>${dt('ledIndicator')}</span>
      <span class="preview-tag">${s.on ? dt('onM') : dt('offM')}</span>
    </div>
  </div>`;
}

function buildBathroomCard() {
  const s = state.placeholder.bathroom;
  return `<div class="dev-card">
    <div class="dev-card-head">
      <div class="dev-card-name"><span class="dev-card-ico">🚿</span> ${dt('bathTitle')}</div>
      <div class="toggle-sw ${s.lightOn ? 'on' : ''}" onclick="toggleFeature('bathroom')"></div>
    </div>
    <div class="feature-row" style="cursor:pointer" onclick="togglePresence()">
      <span class="feature-row-label"><span class="led-dot ${s.presence ? 'on' : ''}"></span>${dt('presenceSensor')}</span>
      <span class="preview-tag">${s.presence ? dt('presenceYes') : dt('presenceNo')}</span>
    </div>
    <div class="feature-row">
      <span class="feature-row-label">${dt('bathAuto')}</span>
      <div class="toggle-sw ${s.auto ? 'on' : ''}" onclick="toggleBathroomAuto()"></div>
    </div>
    <div class="${s.lightOn ? '' : 'dev-dimmed'}">
      <div class="dev-status ${s.lightOn ? 'on-label' : ''}" style="margin-top:6px">${s.lightOn ? dt('lightOn') : dt('lightOff')}</div>
      <div class="slider-wrap">
        <input type="range" min="5" max="100" value="${s.intensity}" ${s.lightOn ? '' : 'disabled'}
          oninput="this.nextElementSibling.textContent=this.value+'%'"
          onchange="setFeatureVal('bathroom','intensity',this.value)">
        <span class="slider-val">${s.intensity}%</span>
      </div>
      <div class="ct-row">
        <button class="ct-btn ${s.colorTemp < 33 ? 'active' : ''}" onclick="setFeatureVal('bathroom','colorTemp',5)">${dt('warm')}</button>
        <button class="ct-btn ${s.colorTemp >= 33 && s.colorTemp < 66 ? 'active' : ''}" onclick="setFeatureVal('bathroom','colorTemp',50)">${dt('neutral')}</button>
        <button class="ct-btn ${s.colorTemp >= 66 ? 'active' : ''}" onclick="setFeatureVal('bathroom','colorTemp',95)">${dt('cold')}</button>
      </div>
    </div>
  </div>`;
}

function buildBidetCard() {
  const s = state.placeholder.bidet;
  return `<div class="dev-card">
    <div class="dev-card-head">
      <div class="dev-card-name"><span class="dev-card-ico">🚽</span> ${dt('bidetTitle')}</div>
      <div class="toggle-sw ${s.on ? 'on' : ''}" onclick="toggleFeature('bidet')"></div>
    </div>
    <div class="dev-status ${s.on ? 'on-label' : ''}">${s.on ? dt('onM') : dt('offM')}</div>
    <div class="${s.on ? '' : 'dev-dimmed'}">
      <div class="feature-row">
        <span class="feature-row-label">${dt('heatedSeat')}</span>
        <div class="toggle-sw ${s.heatedSeat ? 'on' : ''}" onclick="toggleHeatedSeat()"></div>
      </div>
      <div class="source-row">
        <button class="source-btn ${s.mode === 'wash' ? 'active' : ''}" onclick="setBidetMode('wash')">${dt('wash')}</button>
        <button class="source-btn ${s.mode === 'dry'  ? 'active' : ''}" onclick="setBidetMode('dry')">${dt('dry')}</button>
      </div>
    </div>
  </div>`;
}

function buildRugCard() {
  const s = state.placeholder.rug;
  const levels = [{ id: 'baja', label: dt('low') }, { id: 'media', label: dt('medium') }, { id: 'alta', label: dt('high') }];
  return `<div class="dev-card">
    <div class="dev-card-head">
      <div class="dev-card-name"><span class="dev-card-ico">🔥</span> ${dt('rugTitle')}</div>
      <div class="toggle-sw ${s.on ? 'on' : ''}" onclick="toggleFeature('rug')"></div>
    </div>
    <div class="dev-status ${s.on ? 'on-label' : ''}">${s.on ? dt('onF') : dt('offF')}</div>
    <div class="level-row ${s.on ? '' : 'dev-dimmed'}">
      ${levels.map(l => `<button class="level-btn ${s.level === l.id ? 'active' : ''}" onclick="setRugLevel('${l.id}')">${l.label}</button>`).join('')}
    </div>
  </div>`;
}

// ── CLIMA (AC + ventana + automatización, Premium+) ──────────────────────────
function buildACCard() {
  const s = state.placeholder.climate;
  return `<div class="dev-card">
    <div class="dev-card-head">
      <div class="dev-card-name"><span class="dev-card-ico">❄️</span> ${dt('acTitle')}</div>
      <div class="toggle-sw ${s.acOn ? 'on' : ''}" onclick="toggleClimateAC()"></div>
    </div>
    <div class="ac-temp-display"><div class="ac-temp-val ${s.acOn ? 'on' : ''}">${s.temp}°C</div></div>
    <div class="ac-temp-btns">
      <button class="ac-btn" ${s.acOn ? '' : 'disabled'} onclick="setClimateTemp(-1)">−</button>
      <span class="ac-range">16 – 30°C</span>
      <button class="ac-btn" ${s.acOn ? '' : 'disabled'} onclick="setClimateTemp(1)">+</button>
    </div>
  </div>`;
}

function buildWindowCard() {
  const s = state.placeholder.climate;
  return `<div class="dev-card">
    <div class="dev-card-head">
      <div class="dev-card-name"><span class="dev-card-ico">🪟</span> ${dt('windowTitle')}</div>
    </div>
    <div class="dev-status ${s.windowOpen ? '' : 'on-label'}">${s.windowOpen ? dt('windowOpen') : dt('windowClosed')}</div>
    <button class="curtain-btn" style="width:100%;margin-top:8px" onclick="toggleWindow()">${s.windowOpen ? dt('simulateClose') : dt('simulateOpen')}</button>
  </div>`;
}

function buildAutomationCard() {
  const s = state.placeholder.climate;
  return `<div class="dev-card" style="grid-column:1/-1">
    <div class="dev-card-head">
      <div class="dev-card-name"><span class="dev-card-ico">⚙️</span> ${dt('autoOffTitle')}</div>
      <div class="toggle-sw ${s.autoOff ? 'on' : ''}" onclick="toggleAutoOff()"></div>
    </div>
    <div class="dev-status">${dt('autoOffDesc')}</div>
  </div>`;
}

window.toggleClimateAC = function() {
  state.placeholder.climate.acOn = !state.placeholder.climate.acOn;
  renderDevGrid();
  previewToast();
};

window.setClimateTemp = function(delta) {
  const s = state.placeholder.climate;
  s.temp = Math.min(30, Math.max(16, s.temp + delta));
  renderDevGrid();
  previewToast();
};

window.toggleWindow = function() {
  state.placeholder.climate.windowOpen = !state.placeholder.climate.windowOpen;
  renderDevGrid();
  previewToast();
};

window.toggleAutoOff = function() {
  state.placeholder.climate.autoOff = !state.placeholder.climate.autoOff;
  renderDevGrid();
  previewToast();
};

function previewToast() { showToast(dt('previewToast'), ''); }

window.toggleFeature = function(key) {
  const s = state.placeholder[key];
  if (key === 'bathroom') s.lightOn = !s.lightOn; else s.on = !s.on;
  renderDevGrid();
  previewToast();
};

window.togglePresence = function() {
  state.placeholder.bathroom.presence = !state.placeholder.bathroom.presence;
  renderDevGrid();
  previewToast();
};

window.toggleBathroomAuto = function() {
  state.placeholder.bathroom.auto = !state.placeholder.bathroom.auto;
  renderDevGrid();
  previewToast();
};

window.toggleHeatedSeat = function() {
  state.placeholder.bidet.heatedSeat = !state.placeholder.bidet.heatedSeat;
  renderDevGrid();
  previewToast();
};

window.setBidetMode = function(mode) {
  const s = state.placeholder.bidet;
  s.mode = s.mode === mode ? null : mode;
  renderDevGrid();
  previewToast();
};

window.setRugLevel = function(level) {
  state.placeholder.rug.level = level;
  renderDevGrid();
  previewToast();
};

window.setFeatureVal = function(key, prop, val) {
  state.placeholder[key][prop] = (prop === 'vol' || prop === 'intensity' || prop === 'colorTemp') ? parseInt(val, 10) : val;
  if (prop === 'source' || prop === 'colorTemp') renderDevGrid();
  previewToast();
};

function buildManualRow(key, manual) {
  return `<div class="manual-row">
    <span>${dt('manualMode')}</span>
    <div class="toggle-sw toggle-sw-sm ${manual ? 'on' : ''}" onclick="toggleManual('${key}')"></div>
  </div>
  ${manual ? `<div class="manual-note">${dt('manualNote')}</div>` : ''}`;
}

function buildUnlockRow(key, unlocked) {
  return `<div class="manual-row">
    <span>${dt('unlockMotor')}</span>
    <div class="toggle-sw toggle-sw-sm ${unlocked ? 'on' : ''}" onclick="toggleUnlock('${key}')"></div>
  </div>
  ${unlocked ? `<div class="manual-note">${dt('unlockNote')}</div>` : ''}`;
}

function buildDeviceCard(key, dev) {
  const ico = DEV_ICON_OVERRIDES[key] || DEV_ICONS[dev.type] || '🔧';
  if (!dev.available) {
    return `<div class="dev-card">
      <div class="dev-card-head"><div class="dev-card-name"><span class="dev-card-ico">${ico}</span> ${dtDev(key, dev)}</div></div>
      <div class="dev-status">${dt('devOffline')}</div>
    </div>`;
  }
  switch (dev.type) {
    case 'light':
    case 'light_rgb':
      return buildLightCard(key, dev, ico);
    case 'curtain':
      return buildCurtainCard(key, dev, ico);
    case 'switch_3ch':
      return buildMultiSwitchCard(key, dev, ico);
    case 'switch':
      return buildSwitchCard(key, dev, ico);
    case 'door_sensor':
      return buildDoorCard(dev, ico, key);
    default:
      return '';
  }
}

function buildLightCard(key, dev, ico) {
  const on = dev.state.on;
  const manual = !!dev.state.manual;
  return `<div class="dev-card">
    <div class="dev-card-head">
      <div class="dev-card-name"><span class="dev-card-ico">${ico}</span> ${dtDev(key, dev)}</div>
      <div class="toggle-sw ${on ? 'on' : ''} ${manual ? 'disabled' : ''}" onclick="toggleLight('${key}', ${!on})"></div>
    </div>
    <div class="${on && !manual ? '' : 'dev-dimmed'}">
      <div class="dev-status ${on && !manual ? 'on-label' : ''}">${manual ? dt('manualMode') : (on ? dt('onF') : dt('offF'))}</div>
      <div class="slider-wrap">
        <input type="range" min="0" max="100" value="${dev.state.intensity}" ${on && !manual ? '' : 'disabled'}
          oninput="this.nextElementSibling.textContent=this.value+'%'"
          onchange="setIntensity('${key}', this.value)">
        <span class="slider-val">${dev.state.intensity}%</span>
      </div>
    </div>
    ${buildManualRow(key, manual)}
  </div>`;
}

function buildCurtainCard(key, dev, ico) {
  const pct = dev.state.position;
  const unlocked = !!dev.state.unlocked;
  const label = unlocked ? dt('manualShort') : (pct === 0 ? dt('curtainClosed') : pct === 100 ? dt('curtainOpened') : dt('curtainPct', { p: pct }));
  return `<div class="dev-card">
    <div class="dev-card-head">
      <div class="dev-card-name"><span class="dev-card-ico">${ico}</span> ${dtDev(key, dev)}</div>
    </div>
    <div class="curtain-btns">
      <button class="curtain-btn" onclick="setCurtain('${key}','open')" ${unlocked ? 'disabled' : ''}>${dt('openBtn')}</button>
      <button class="curtain-btn" onclick="setCurtain('${key}','stop')" ${unlocked ? 'disabled' : ''}>${dt('stopBtn')}</button>
      <button class="curtain-btn" onclick="setCurtain('${key}','close')" ${unlocked ? 'disabled' : ''}>${dt('closeBtn')}</button>
    </div>
    <div class="curtain-track"><div class="curtain-fill" style="width:${pct}%"></div></div>
    <div class="curtain-label">${label}</div>
    ${buildUnlockRow(key, unlocked)}
    ${buildAllowManualUnlockRow(key, !!dev.manualUnlock)}
  </div>`;
}

// Configuración del hotel: permite (o no) que el huésped vea y use el
// desbloqueo manual del motor de esta cortina en su app.
function buildAllowManualUnlockRow(key, allowed) {
  return `<div class="manual-row">
    <span>${dt('allowManualUnlock')}</span>
    <div class="toggle-sw toggle-sw-sm ${allowed ? 'on' : ''}" onclick="toggleAllowManualUnlock('${key}')"></div>
  </div>
  <div class="manual-note">${dt('allowManualUnlockNote')}</div>`;
}

function buildMultiSwitchCard(key, dev, ico) {
  const labels = dev.channels || ['Canal 1', 'Canal 2', 'Canal 3'];
  const chKeys = ['ch1', 'ch2', 'ch3'].slice(0, labels.length);
  const manual = !!dev.state.manual;
  const rows = chKeys.map((ch, i) => {
    const on = dev.state[ch];
    return `<div style="display:flex;align-items:center;justify-content:space-between;${i ? 'margin-top:8px' : ''}">
      <span class="dev-status ${on && !manual ? 'on-label' : ''}" style="margin:0">${labels[i]}</span>
      <div class="toggle-sw ${on ? 'on' : ''} ${manual ? 'disabled' : ''}" onclick="toggleMultiSwitch('${key}','${ch}', ${!on})"></div>
    </div>`;
  }).join('');
  return `<div class="dev-card">
    <div class="dev-card-head">
      <div class="dev-card-name"><span class="dev-card-ico">${ico}</span> ${dtDev(key, dev)}</div>
    </div>
    ${rows}
    ${buildManualRow(key, manual)}
  </div>`;
}

function buildSwitchCard(key, dev, ico) {
  const on = dev.state.on;
  const manual = !!dev.state.manual;
  return `<div class="dev-card">
    <div class="dev-card-head">
      <div class="dev-card-name"><span class="dev-card-ico">${ico}</span> ${dtDev(key, dev)}</div>
      <div class="toggle-sw ${on ? 'on' : ''} ${manual ? 'disabled' : ''}" onclick="toggleSwitch('${key}', ${!on})"></div>
    </div>
    <div class="dev-status ${on && !manual ? 'on-label' : ''}">${manual ? dt('manualMode') : (on ? dt('onM') : dt('offM'))}</div>
    ${buildManualRow(key, manual)}
  </div>`;
}

function buildDoorCard(dev, ico, key) {
  const open = dev.state.open;
  return `<div class="dev-card">
    <div class="dev-card-head">
      <div class="dev-card-name"><span class="dev-card-ico">${ico}</span> ${dtDev(key, dev)}</div>
    </div>
    <div class="door-badge ${open ? 'open' : 'closed'}">${open ? dt('doorOpenB') : dt('doorClosedB')}</div>
  </div>`;
}

// ── DEVICE COMMANDS ───────────────────────────────────────────────────────────
async function sendCommand(device, command) {
  const { token } = state.currentRoom;
  await fetch(`${API_URL}/room/${token}/command`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ device, command }),
  });
}

window.toggleLight = async function(key, on) {
  state.currentRoom.devices[key].state.on = on;
  renderDevGrid();
  await sendCommand(key, { on });
};

window.setIntensity = async function(key, val) {
  state.currentRoom.devices[key].state.intensity = parseInt(val, 10);
  await sendCommand(key, { intensity: parseInt(val, 10) });
};

window.toggleMultiSwitch = async function(key, ch, on) {
  state.currentRoom.devices[key].state[ch] = on;
  renderDevGrid();
  await sendCommand(key, { [ch === 'ch1' ? 'ch1' : ch === 'ch2' ? 'ch2' : 'ch3']: on });
};

window.toggleSwitch = async function(key, on) {
  state.currentRoom.devices[key].state.on = on;
  renderDevGrid();
  await sendCommand(key, { on });
};

window.setCurtain = async function(key, control) {
  await sendCommand(key, { control });
  if (control === 'open')  state.currentRoom.devices[key].state.position = 100;
  if (control === 'close') state.currentRoom.devices[key].state.position = 0;
  renderDevGrid();
};

window.toggleManual = async function(key) {
  const dev = state.currentRoom.devices[key];
  dev.state.manual = !dev.state.manual;
  if (dev.state.manual && (dev.type === 'light' || dev.type === 'light_rgb')) {
    // En modo manual la luz queda fija encendida en cálido: el interruptor
    // físico la enciende/apaga como una luz normal.
    dev.state.on = true;
    dev.state.colorTemp = 5;
    renderDevGrid();
    await sendCommand(key, { on: true, mode: 'white', colorTemp: 5 });
    return;
  }
  renderDevGrid();
};

window.toggleUnlock = function(key) {
  const dev = state.currentRoom.devices[key];
  dev.state.unlocked = !dev.state.unlocked;
  renderDevGrid();
};

window.toggleAllowManualUnlock = async function(key) {
  const dev = state.currentRoom.devices[key];
  const allowed = !dev.manualUnlock;
  dev.manualUnlock = allowed;
  renderDevGrid();
  try {
    await apiFetch(`/admin/rooms/${state.currentRoom.id}/devices/${key}/manual-unlock`, {
      method: 'POST',
      body: JSON.stringify({ allowed }),
    });
  } catch (err) {
    dev.manualUnlock = !allowed;
    renderDevGrid();
    showToast(err.message, 'error');
  }
};

// ── ACTIVITY LOG ──────────────────────────────────────────────────────────────
const ACTIVITY_ICONS = {
  checkin: '🟢', checkout: '🔴', prefs_changed: '⚙️',
  service_request: '🛎', request_resolved: '✅', scene_off: '🔌',
};
const ACTIVITY_LABELS = {
  checkin: 'activityCheckin', checkout: 'activityCheckout', prefs_changed: 'activityPrefsChanged',
  service_request: 'activityServiceRequest', request_resolved: 'activityRequestResolved', scene_off: 'activitySceneOff',
};

function activityDetailText(item) {
  if (item.type === 'service_request' || item.type === 'request_resolved') {
    return dt(item.detail === 'roomservice' ? 'requestRoomService' : 'requestTowels');
  }
  return item.detail || '';
}

async function renderActivitySection(room) {
  $('activity-log').innerHTML = `<div class="form-note">${dt('loadingDevices')}</div>`;
  try {
    const log = await apiFetch(`/admin/rooms/${room.id}/activity`);
    if (!log.length) {
      $('activity-log').innerHTML = `<div class="form-note" style="padding:14px">${dt('activityEmpty')}</div>`;
      return;
    }
    const locale = LOCALES[dashLang] || 'es-CL';
    $('activity-log').innerHTML = log.map(item => {
      const when = new Date(item.at).toLocaleString(locale, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
      const detail = activityDetailText(item);
      return `<div class="activity-item">
        <span class="activity-ico">${ACTIVITY_ICONS[item.type] || '•'}</span>
        <div class="activity-body">
          <div class="activity-text">${dt(ACTIVITY_LABELS[item.type] || item.type)}</div>
          ${detail ? `<div class="activity-detail">${detail}</div>` : ''}
        </div>
        <div class="activity-time">${when}</div>
      </div>`;
    }).join('');
  } catch (err) {
    $('activity-log').innerHTML = `<div class="form-note">${dt('loadDevError', { e: err.message })}</div>`;
  }
}

// ── QR SECTION ────────────────────────────────────────────────────────────────
function renderQRSection(room) {
  const url = `${FRONTEND_URL}/?token=${room.guest.token}`;
  $('mr-qr-section').classList.remove('hidden');
  $('qr-section').innerHTML = `
    <div class="qr-canvas"><img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(url)}" alt="QR"></div>
    <div class="qr-info">
      <div class="qr-info-label">${dt('qrLinkLabel')}</div>
      <div class="qr-url">${url}</div>
      <div class="qr-actions">
        <button class="btn btn-primary btn-sm" id="qr-wa-btn">${dt('waBtn')}</button>
        <button class="btn btn-outline btn-sm" id="qr-copy-btn">${dt('copyBtn')}</button>
        <button class="btn btn-danger-outline btn-sm" id="qr-end-btn">${dt('endStayBtn')}</button>
      </div>
    </div>
  `;

  $('qr-copy-btn').onclick = () => {
    navigator.clipboard.writeText(url).then(() => showToast(dt('copied'), 'success'));
  };

  const waBtn = $('qr-wa-btn');
  const digits = (room.guest.phone || '').replace(/[^\d]/g, '');
  if (digits) {
    const msg = dt('waMsg', { name: room.guest.guestName, hotel: room.hotel || 'tu hotel', url });
    waBtn.onclick = () => window.open(`https://wa.me/${digits}?text=${encodeURIComponent(msg)}`, '_blank');
  } else {
    waBtn.disabled = true;
    waBtn.title = dt('noPhone');
  }

  $('qr-end-btn').onclick = () => endStay(room.id, room.guest.token);
}

async function endStay(roomId, token) {
  if (!confirm(dt('endConfirm'))) return;
  try {
    await apiFetch(`/admin/token/${token}`, { method: 'DELETE' });
    closeModal('modal-room');
    await loadRooms();
    showToast(dt('endDone'), 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ── NEW STAY MODAL ────────────────────────────────────────────────────────────
window.openNewStayModal = function(preselectId = null) {
  renderNewStayForm(preselectId);
  $('modal-new-stay').classList.remove('hidden');
};

function renderNewStayForm(preselectId) {
  const avail = availableRooms();
  if (avail.length === 0) {
    $('new-stay-form-wrap').innerHTML = `<div class="placeholder-view" style="height:160px"><div class="ph-ico">🏨</div><p>${dt('noRoomsAvail')}</p></div>`;
    return;
  }
  const opts = avail.map(r => `<option value="${r.id}" ${r.id === preselectId ? 'selected' : ''}>${r.name}</option>`).join('');
  const now      = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 3600 * 1000);
  const langOpts = GUEST_LANGS.map(l => `<option value="${l}" ${l === 'es' ? 'selected' : ''}>${dt('langName_' + l)}</option>`).join('');
  const a11yOpts = A11Y_MODES.map(([v, k]) => `<option value="${v}" ${v === 'none' ? 'selected' : ''}>${dt(k)}</option>`).join('');

  $('new-stay-form-wrap').innerHTML = `
    <div class="form-grid">
      <div class="form-group full">
        <label class="form-label">${dt('fRoom')}</label>
        <select class="form-input" id="ns-room">${opts}</select>
      </div>
      <div class="form-group">
        <label class="form-label">${dt('fGuest')}</label>
        <input class="form-input" id="ns-guest" type="text" placeholder="${dt('fGuestPh')}">
      </div>
      <div class="form-group">
        <label class="form-label">${dt('fPhone')}</label>
        <input class="form-input" id="ns-phone" type="tel" placeholder="+56 9 1234 5678">
      </div>
      <div class="form-group">
        <label class="form-label">${dt('fCheckin')}</label>
        <input class="form-input" id="ns-checkin" type="datetime-local" value="${toLocalInputValue(now)}">
      </div>
      <div class="form-group">
        <label class="form-label">${dt('fCheckout')}</label>
        <input class="form-input" id="ns-checkout" type="datetime-local" value="${toLocalInputValue(tomorrow)}">
      </div>
      <div class="form-group">
        <label class="form-label">${dt('guestLang')}</label>
        <select class="form-input" id="ns-lang">${langOpts}</select>
      </div>
      <div class="form-group">
        <label class="form-label">${dt('guestA11y')}</label>
        <select class="form-input" id="ns-a11y">${a11yOpts}</select>
      </div>
    </div>
    <div class="form-error" id="ns-error"></div>
    <button class="btn btn-primary" style="width:100%;padding:12px;font-size:14px" id="ns-submit">
      ${dt('fSubmit')}
    </button>
    <p class="form-note" style="margin-top:10px;text-align:center">
      ${dt('fNote')}
    </p>
  `;

  $('ns-submit').addEventListener('click', submitNewStay);
}

async function submitNewStay() {
  const error    = $('ns-error');
  error.textContent = '';

  const roomId   = $('ns-room').value;
  const guest    = $('ns-guest').value.trim();
  const phone    = $('ns-phone').value.trim();
  const checkin  = $('ns-checkin').value;
  const checkout = $('ns-checkout').value;
  const lang     = $('ns-lang').value;
  const accessibility = $('ns-a11y').value;

  if (!guest || !checkin || !checkout) {
    error.textContent = dt('fErrFields');
    return;
  }
  if (new Date(checkout) <= new Date(checkin)) {
    error.textContent = dt('fErrDates');
    return;
  }

  const btn = $('ns-submit');
  btn.innerHTML = `<span class="spinner"></span> ${dt('fCreating')}`;
  btn.disabled = true;

  try {
    const result = await apiFetch('/admin/token', {
      method: 'POST',
      body: JSON.stringify({ roomId, guestName: guest, phone, checkin, checkout, lang, accessibility }),
    });
    closeModal('modal-new-stay');
    await loadRooms();
    showToast(dt('stayCreated', { name: guest }), 'success');

    const room = rooms.find(r => r.id === roomId);
    if (room && room.guest) openRoomModal(roomId);
  } catch (err) {
    error.textContent = err.message;
    btn.textContent = dt('fSubmit');
    btn.disabled = false;
  }
}

// ── CALENDARIO ────────────────────────────────────────────────────────────────
let fcInstance    = null;
let occupancyMap  = new Map(); // clave: "roomId:YYYY-MM-DD" → reservaId

function buildOccupancyMap(list) {
  occupancyMap = new Map();
  for (const r of list) {
    if (r.status === 'cancelled' || r.status === 'checked_out') continue;
    let d = new Date(r.checkin + 'T00:00:00');
    const end = new Date(r.checkout + 'T00:00:00');
    while (d < end) {
      occupancyMap.set(`${r.room_id}:${d.toISOString().slice(0, 10)}`, r.id);
      d.setDate(d.getDate() + 1);
    }
  }
}

function reservaToEvent(r) {
  const today = new Date().toISOString().slice(0, 10);
  const isCoToday = r.checkout.slice(0, 10) === today;
  return {
    id: r.id,
    resourceId: r.room_id,
    title: r.guest_name,
    start: r.checkin,
    end: r.checkout,
    classNames: ['ev-' + r.status, ...(isCoToday && r.status !== 'cancelled' ? ['ev-checkout-today'] : [])],
    extendedProps: r,
  };
}

function initCalendar() {
  if (!window.FullCalendar) return;

  if (fcInstance) {
    fcInstance.updateSize();
    return;
  }

  const container = $('fc-container');
  const hotelId   = HOTEL_ID || rooms[0]?.hotel || '';
  const hotelQs   = hotelId ? `hotel=${encodeURIComponent(hotelId)}&` : '';

  fcInstance = new FullCalendar.Calendar(container, {
    schedulerLicenseKey: 'CC-Attribution-NonCommercial-NoDerivatives',
    initialView: 'resourceTimelineWeek',
    resources: rooms.map(r => ({ id: r.id, title: `${r.name} · P${r.floor}` })),
    events: async (info, success, fail) => {
      try {
        const from = info.startStr.slice(0, 10);
        const to   = info.endStr.slice(0, 10);
        const list = await apiFetch(`/admin/reservas?${hotelQs}from=${from}&to=${to}`);
        buildOccupancyMap(list);
        success(list.map(reservaToEvent));
      } catch (e) { fail(e); }
    },
    editable: true,
    eventResizableFromStart: true,
    eventAllow: (dropInfo, draggedEvent) => {
      const newRoomId = dropInfo.resource?.id;
      if (!newRoomId) return false;
      let d = new Date(dropInfo.start);
      const end = new Date(dropInfo.end);
      while (d < end) {
        const key     = `${newRoomId}:${d.toISOString().slice(0, 10)}`;
        const blocked = occupancyMap.get(key);
        if (blocked && blocked !== draggedEvent.id) return false;
        d.setDate(d.getDate() + 1);
      }
      return true;
    },
    expandRows: true,
    stickyHeaderDates: true,
    height: () => document.getElementById('fc-container').offsetHeight || 600,
    resourceAreaHeaderContent: 'Habitación',
    resourceAreaWidth: '150px',
    headerToolbar: {
      left:   'prev,next today',
      center: 'title',
      right:  'resourceTimelineWeek,resourceTimelineMonth',
    },
    buttonText: { today: 'Hoy', week: 'Semana', month: 'Mes' },
    firstDay: 1,
    eventDrop:   info => patchReservaDate(info),
    eventResize: info => patchReservaDate(info),
    dateClick: info => {
      openReservaModal(null, { roomId: info.resource?.id, date: info.dateStr });
    },
    eventClick: info => {
      openReservaModal(info.event.extendedProps);
    },
  });

  fcInstance.render();
}

async function patchReservaDate(info) {
  const ev   = info.event;
  const body = {
    checkin:  ev.startStr.slice(0, 10),
    checkout: ev.endStr.slice(0, 10),
    room_id:  ev.getResources()[0]?.id,
  };
  try {
    await apiFetch(`/admin/reservas/${ev.id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  } catch (err) {
    info.revert();
    showToast(err.message, 'error');
  }
}

// Modal de reserva: null = nueva, objeto = edición
function openReservaModal(reserva = null, prefill = {}) {
  const isNew = !reserva;
  $('rv-title').textContent    = isNew ? 'Nueva reserva' : `Reserva — ${reserva.guest_name}`;
  $('rv-subtitle').textContent = isNew ? '' : `ID: ${reserva.id}`;

  // Selector de habitaciones
  const roomOpts = rooms.map(r =>
    `<option value="${r.id}" ${(reserva?.room_id || prefill.roomId) === r.id ? 'selected' : ''}>${r.name} (P${r.floor})</option>`
  ).join('');
  $('rv-room').innerHTML = roomOpts;

  // Campos
  $('rv-guest').value    = reserva?.guest_name   || '';
  $('rv-email').value    = reserva?.guest_email  || '';
  $('rv-phone').value    = reserva?.guest_phone  || '';
  $('rv-checkin').value  = (reserva?.checkin  || prefill.date || '').slice(0, 10);
  $('rv-checkout').value = (reserva?.checkout || '').slice(0, 10);
  $('rv-notes').value    = reserva?.notes        || '';
  $('rv-error').textContent = '';

  // Botones de estado (solo en edición)
  const statusRow = $('rv-status-row');
  const STATUSES  = [
    { id: 'confirmed',   label: 'Confirmada' },
    { id: 'pending',     label: 'Pendiente' },
    { id: 'checked_in',  label: 'Check-in' },
    { id: 'checked_out', label: 'Check-out' },
  ];
  if (!isNew) {
    statusRow.innerHTML = STATUSES.map(s =>
      `<button class="status-btn ${reserva.status === s.id ? 'active' : ''}" data-status="${s.id}">${s.label}</button>`
    ).join('');
    statusRow.querySelectorAll('.status-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        statusRow.querySelectorAll('.status-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });
  } else {
    statusRow.innerHTML = '';
  }

  // Guardar
  const saveBtn = $('rv-save');
  saveBtn.onclick = () => submitReservaModal(reserva?.id || null);

  // Cancelar reserva (solo en edición)
  const cancelBtn = $('rv-cancel-stay');
  if (!isNew && reserva.status !== 'cancelled') {
    cancelBtn.classList.remove('hidden');
    cancelBtn.onclick = () => cancelReservaModal(reserva.id);
  } else {
    cancelBtn.classList.add('hidden');
  }

  // Cobros (solo en edición, reserva ya existe en SQLite)
  $('rv-cobros-section').classList.toggle('hidden', isNew);
  if (!isNew) renderCobrosSection(reserva);

  $('modal-reserva').classList.remove('hidden');
}

async function submitReservaModal(existingId) {
  const error    = $('rv-error');
  error.textContent = '';
  const guest    = $('rv-guest').value.trim();
  const checkin  = $('rv-checkin').value;
  const checkout = $('rv-checkout').value;
  const roomId   = $('rv-room').value;

  if (!guest || !checkin || !checkout) { error.textContent = 'Completa nombre, check-in y check-out.'; return; }
  if (checkin >= checkout)             { error.textContent = 'El check-out debe ser posterior al check-in.'; return; }

  const hotelId      = HOTEL_ID || rooms[0]?.hotel || '';
  const activeStatus = $('rv-status-row').querySelector('.status-btn.active')?.dataset.status || 'confirmed';
  const email        = $('rv-email').value.trim() || undefined;
  const phone        = $('rv-phone').value.trim() || undefined;
  const notes        = $('rv-notes').value.trim() || undefined;

  // POST usa camelCase (así lo espera el backend); PATCH usa snake_case
  const postBody = { hotelId, roomId, guestName: guest, guestEmail: email, guestPhone: phone, checkin, checkout, notes };
  const patchBody = { room_id: roomId, guest_name: guest, guest_email: email, guest_phone: phone, checkin, checkout, notes, status: activeStatus };

  const saveBtn = $('rv-save');
  saveBtn.disabled = true;
  saveBtn.innerHTML = '<span class="spinner"></span>';

  try {
    if (existingId) {
      await apiFetch(`/admin/reservas/${existingId}`, { method: 'PATCH', body: JSON.stringify(patchBody) });
    } else {
      await apiFetch('/admin/reservas', { method: 'POST', body: JSON.stringify(postBody) });
    }
    closeModal('modal-reserva');
    if (fcInstance) fcInstance.refetchEvents();
    showToast(existingId ? 'Reserva actualizada' : 'Reserva creada', 'success');
  } catch (err) {
    error.textContent = err.message;
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = 'Guardar';
  }
}

async function cancelReservaModal(id) {
  if (!confirm('¿Cancelar esta reserva?')) return;
  try {
    await apiFetch(`/admin/reservas/${id}`, { method: 'DELETE' });
    closeModal('modal-reserva');
    if (fcInstance) fcInstance.refetchEvents();
    showToast('Reserva cancelada', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ── COBROS (Webpay / Mercado Pago / manual) ──────────────────────────────────
const TRANS_TIPO_LABEL = { webpay: 'Tarjeta', mercadopago: 'Mercado Pago', efectivo: 'Efectivo', transferencia: 'Transferencia' };
const TRANS_ESTADO_LABEL = { pendiente: 'Pendiente', aprobado: 'Aprobado', rechazado: 'Rechazado', anulado: 'Anulado' };

function renderCobrosSection(reserva) {
  $('rv-monto-clp').value = '';
  $('rv-cobro-error').textContent = '';
  $('rv-manual-form').classList.add('hidden');
  $('rv-manual-ref').value = '';

  $('rv-pagar-webpay').onclick = () => pagarWebpay(reserva.id);
  $('rv-link-mp').onclick      = () => enviarLinkMP(reserva.id);
  $('rv-toggle-manual').onclick = () => $('rv-manual-form').classList.toggle('hidden');
  $('rv-manual-confirm').onclick = () => registrarPagoManual(reserva.id);

  loadTransacciones(reserva.id);
}

async function loadTransacciones(reservaId) {
  try {
    const lista = await apiFetch(`/admin/reservas/${reservaId}/transacciones`);
    renderTransaccionesList(lista);
  } catch {
    $('rv-transacciones-list').innerHTML = '';
  }
}

function renderTransaccionesList(lista) {
  if (!lista.length) {
    $('rv-transacciones-list').innerHTML = '<div class="form-note">Sin cobros registrados todavía.</div>';
    return;
  }
  $('rv-transacciones-list').innerHTML = lista.map(t => `
    <div class="trans-row">
      <span class="trans-tipo">${TRANS_TIPO_LABEL[t.tipo] || t.tipo}</span>
      <span class="trans-monto">$${t.monto_clp.toLocaleString('es-CL')} CLP</span>
      <span class="trans-badge ${t.estado}">${TRANS_ESTADO_LABEL[t.estado] || t.estado}</span>
      <span class="trans-date">${new Date(t.created_at).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' })}</span>
    </div>`).join('');
}

function getMonto() {
  const v = parseInt($('rv-monto-clp').value, 10);
  if (!v || v < 1) { $('rv-cobro-error').textContent = 'Ingresa un monto válido en CLP.'; return null; }
  $('rv-cobro-error').textContent = '';
  return v;
}

async function pagarWebpay(reservaId) {
  const montoCLP = getMonto();
  if (!montoCLP) return;
  const btn = $('rv-pagar-webpay');
  btn.disabled = true;
  try {
    const { url, token } = await apiFetch(`/admin/reservas/${reservaId}/pago/webpay`, {
      method: 'POST', body: JSON.stringify({ montoCLP }),
    });
    // Webpay Plus exige un form POST con token_ws — no un GET con query string
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = url;
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = 'token_ws';
    input.value = token;
    form.appendChild(input);
    document.body.appendChild(form);
    form.submit();
  } catch (err) {
    $('rv-cobro-error').textContent = err.message;
    btn.disabled = false;
  }
}

async function enviarLinkMP(reservaId) {
  const montoCLP = getMonto();
  if (!montoCLP) return;
  const btn = $('rv-link-mp');
  btn.disabled = true;
  try {
    const { linkPago } = await apiFetch(`/admin/reservas/${reservaId}/pago/link-mp`, {
      method: 'POST', body: JSON.stringify({ montoCLP }),
    });
    const phoneDigits = ($('rv-phone').value || '').replace(/\D/g, '');
    const waPhone = phoneDigits ? (phoneDigits.startsWith('56') ? phoneDigits : '56' + phoneDigits.replace(/^0/, '')) : '';
    const msg = `Hola ${$('rv-guest').value.trim()}, puedes completar el pago de tu reserva aquí: ${linkPago}`;
    window.open(`https://wa.me/${waPhone}?text=${encodeURIComponent(msg)}`, '_blank');
    await loadTransacciones(reservaId);
  } catch (err) {
    $('rv-cobro-error').textContent = err.message;
  } finally {
    btn.disabled = false;
  }
}

async function registrarPagoManual(reservaId) {
  const montoCLP = getMonto();
  if (!montoCLP) return;
  const tipo = $('rv-manual-tipo').value;
  const referencia = $('rv-manual-ref').value.trim() || undefined;
  const btn = $('rv-manual-confirm');
  btn.disabled = true;
  try {
    await apiFetch(`/admin/reservas/${reservaId}/pago/manual`, {
      method: 'POST', body: JSON.stringify({ montoCLP, tipo, referencia }),
    });
    $('rv-manual-form').classList.add('hidden');
    $('rv-monto-clp').value = '';
    showToast('Pago registrado', 'success');
    await loadTransacciones(reservaId);
  } catch (err) {
    $('rv-cobro-error').textContent = err.message;
  } finally {
    btn.disabled = false;
  }
}

// ── RETORNO DE PAGO (Webpay redirige aquí con ?pago=...&reserva=...) ────────
function checkPagoReturn() {
  const qs = new URLSearchParams(location.search);
  const pago = qs.get('pago');
  if (!pago) return;
  const MSG = {
    aprobado:  ['Pago aprobado correctamente', 'success'],
    rechazado: ['Pago rechazado por el banco', 'error'],
    cancelado: ['Pago cancelado por el usuario', 'error'],
    error:     ['Ocurrió un error al procesar el pago', 'error'],
  };
  const [msg, kind] = MSG[pago] || ['Resultado de pago desconocido', 'error'];
  showToast(msg, kind);
  // Limpiar query string para no repetir el toast al refrescar
  const url = new URL(location.href);
  url.searchParams.delete('pago');
  url.searchParams.delete('reserva');
  history.replaceState({}, '', url);
}

// ── CLOCK ─────────────────────────────────────────────────────────────────────
// ── CANALES OTA (vista owner — hotel fijo = HOTEL_ID) ────────────────────────
const CANAL_ICONS = { booking: '🏨', airbnb: '🏡', expedia: '✈️', despegar: '🌎', directo: '🔗' };
const CANAL_NAMES = { booking: 'Booking.com', airbnb: 'Airbnb', expedia: 'Expedia', despegar: 'Despegar.com', directo: 'Reserva directa' };
let currentCanalId = null;

function syncAge(iso) {
  if (!iso) return 'Nunca sincronizado';
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60000) return 'hace menos de 1 min';
  if (diff < 3600000) return `hace ${Math.round(diff / 60000)} min`;
  if (diff < 86400000) return `hace ${Math.round(diff / 3600000)} h`;
  return `hace ${Math.round(diff / 86400000)} d`;
}

async function loadCanales() {
  if (!HOTEL_ID) return;
  try {
    const lista = await apiFetch(`/admin/canales?hotel=${encodeURIComponent(HOTEL_ID)}`);
    renderCanales(lista);
  } catch (err) {
    showToast('Error cargando canales: ' + err.message, 'error');
  }
}

function renderCanales(lista) {
  if (!lista.length) {
    $('canal-grid').innerHTML = '<div class="form-note">Sin canales configurados. Haz clic en "Agregar canal" para conectar una OTA.</div>';
    return;
  }
  $('canal-grid').innerHTML = lista.map(c => {
    const lastSync = c.syncStatus;
    const hasError = lastSync?.status === 'error';
    const statusBadge = !c.activo
      ? '<span class="badge badge-inactive">Inactivo</span>'
      : hasError
        ? '<span class="badge badge-error">Error sync</span>'
        : '<span class="badge badge-active">Activo</span>';
    return `
    <div class="canal-card${hasError ? ' canal-error' : ''}">
      <div class="canal-top">
        <div class="canal-name">${CANAL_ICONS[c.nombre] || '🔗'} ${CANAL_NAMES[c.nombre] || c.nombre}</div>
        ${statusBadge}
      </div>
      <div class="canal-sync${hasError ? ' has-error' : ''}">
        Última sync: ${syncAge(lastSync?.created_at)}
        ${hasError ? `<br><span style="color:var(--alert)">${lastSync.error || 'Error desconocido'}</span>` : ''}
      </div>
      <div class="canal-mappings">${c.mappings} habitación${c.mappings !== 1 ? 'es' : ''} mapeada${c.mappings !== 1 ? 's' : ''}</div>
      <div class="canal-actions">
        <button class="btn btn-outline btn-sm" onclick="syncNow('${c.id}', this)">↻ Sync</button>
        <button class="btn btn-outline btn-sm" onclick="openCanalConfig('${c.id}', '${c.nombre}')">Configurar</button>
        <button class="btn btn-outline btn-sm" onclick="toggleCanal('${c.id}', ${c.activo})">${c.activo ? 'Desactivar' : 'Activar'}</button>
        <button class="btn btn-outline btn-sm" style="color:var(--alert)" onclick="deleteCanal('${c.id}', '${CANAL_NAMES[c.nombre] || c.nombre}')">Eliminar</button>
      </div>
    </div>`;
  }).join('');
}

window.syncNow = async function(canalId, btn) {
  const prev = btn.textContent;
  btn.textContent = '…';
  btn.disabled = true;
  try {
    const r = await apiFetch(`/admin/canales/${canalId}/sync-now`, { method: 'POST' });
    showToast(`Sync completado: ${r.mapeadas} hab. actualizadas (${r.desde} → ${r.hasta})`, 'success');
    await loadCanales();
  } catch (err) {
    showToast('Error en sync: ' + err.message, 'error');
  } finally {
    btn.textContent = prev;
    btn.disabled = false;
  }
};

window.toggleCanal = async function(canalId, activo) {
  try {
    await apiFetch(`/admin/canales/${canalId}`, { method: 'PATCH', body: JSON.stringify({ activo: activo ? 0 : 1 }) });
    await loadCanales();
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
  }
};

window.deleteCanal = async function(canalId, nombre) {
  if (!confirm(`¿Eliminar canal "${nombre}"? También se borrarán todos sus mapeos de habitaciones.`)) return;
  try {
    await apiFetch(`/admin/canales/${canalId}`, { method: 'DELETE' });
    showToast('Canal eliminado', 'success');
    await loadCanales();
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
  }
};

function openAddCanalModal() {
  $('ac-property-id').value = '';
  $('ac-error').textContent = '';
  $('modal-add-canal').classList.remove('hidden');
}

async function submitAddCanal() {
  const nombre     = $('ac-nombre').value;
  const propertyId = $('ac-property-id').value.trim();
  $('ac-error').textContent = '';
  try {
    await apiFetch('/admin/canales', {
      method: 'POST',
      body: JSON.stringify({ hotelId: HOTEL_ID, nombre, config: { siteminder_property_id: propertyId || null } }),
    });
    closeModal('modal-add-canal');
    showToast('Canal agregado correctamente', 'success');
    await loadCanales();
  } catch (err) {
    $('ac-error').textContent = err.message;
  }
}

window.openCanalConfig = async function(canalId, nombre) {
  currentCanalId = canalId;
  $('cc-title').textContent = `Configurar — ${CANAL_NAMES[nombre] || nombre}`;
  $('modal-canal-config').classList.remove('hidden');

  document.querySelectorAll('.modal-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === 'mappings'));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === 'tab-mappings'));

  try {
    const roomsList = await apiFetch(`/admin/rooms?hotel=${encodeURIComponent(HOTEL_ID)}`);
    $('map-room-id').innerHTML = roomsList.length
      ? roomsList.map(r => `<option value="${r.id}">${r.name} (${r.id})</option>`).join('')
      : '<option value="">Sin habitaciones</option>';
  } catch { $('map-room-id').innerHTML = '<option value="">Error cargando habitaciones</option>'; }

  await reloadMappings();
};

async function reloadMappings() {
  if (!currentCanalId) return;
  try {
    const mappings = await apiFetch(`/admin/canales/${currentCanalId}/mappings`);
    $('mapping-list').innerHTML = mappings.length
      ? mappings.map(m => `
          <div class="mapping-row">
            <span class="mapping-room">${m.room_id}</span>
            <span class="mapping-ota">→ OTA: ${m.ota_room_id}${m.ota_rate_id ? ` / ${m.ota_rate_id}` : ''}</span>
            <button class="mapping-del" onclick="deleteMapping('${m.id}')" title="Eliminar">✕</button>
          </div>`)
        .join('')
      : '<div class="form-note">Sin habitaciones mapeadas todavía.</div>';
  } catch { $('mapping-list').innerHTML = '<div class="form-note">Error cargando mapeos.</div>'; }
}

window.deleteMapping = async function(mappingId) {
  try {
    await apiFetch(`/admin/canales/mappings/${mappingId}`, { method: 'DELETE' });
    await reloadMappings();
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
  }
};

async function addMapping() {
  const roomId    = $('map-room-id').value;
  const otaRoomId = $('map-ota-room-id').value.trim();
  const otaRateId = $('map-ota-rate-id').value.trim();
  $('map-error').textContent = '';
  if (!roomId || !otaRoomId) { $('map-error').textContent = 'Selecciona la habitación e ingresa el ID OTA.'; return; }
  try {
    await apiFetch(`/admin/canales/${currentCanalId}/mappings`, {
      method: 'POST',
      body: JSON.stringify({ roomId, otaRoomId, otaRateId: otaRateId || undefined }),
    });
    $('map-ota-room-id').value = '';
    $('map-ota-rate-id').value = '';
    await reloadMappings();
    await loadCanales();
  } catch (err) {
    $('map-error').textContent = err.message;
  }
}

async function loadSyncLog() {
  if (!currentCanalId) return;
  try {
    const logs = await apiFetch(`/admin/canales/${currentCanalId}/sync-status`);
    $('sync-log-list').innerHTML = logs.length
      ? logs.map(l => `
          <div class="mapping-row" style="${l.status === 'error' ? 'border-left:3px solid var(--alert)' : ''}">
            <span class="mapping-room" style="flex:none;width:100px">${l.tipo.replace('_', ' ')}</span>
            <span class="mapping-ota" style="flex:1">${l.status === 'error' ? (l.error || 'Error') : 'OK'}</span>
            <span style="font-size:10px;color:var(--text3);white-space:nowrap">${new Date(l.created_at).toLocaleString('es-CL')}</span>
          </div>`)
        .join('')
      : '<div class="form-note">Sin registros de sincronización.</div>';
  } catch { $('sync-log-list').innerHTML = '<div class="form-note">Error cargando log.</div>'; }
}

// ── MOTOR DE RESERVAS (vista owner — hotel fijo = HOTEL_ID) ──────────────────
const PUBLIC_BOOKING_URL = 'https://nexoiot-production.up.railway.app';

async function loadBookingConfig() {
  if (!HOTEL_ID) return;
  $('bk-save-err').textContent = '';
  try {
    const cfg = await apiFetch(`/admin/booking-config/${HOTEL_ID}`);
    $('bk-activo').checked = !!cfg.activo;
    $('bk-titulo').value   = cfg.titulo || '';
    $('bk-color1').value   = cfg.color_primario || '#009D71';
    $('bk-color2').value   = cfg.color_secundario || '#102943';
    $('bk-logo').value     = cfg.logo_url || '';
    $('bk-policy').value   = cfg.politica_cancel || '';
  } catch (err) {
    showToast('Error cargando configuración: ' + err.message, 'error');
  }

  $('bk-direct-url').textContent = `${PUBLIC_BOOKING_URL}/reservar/${HOTEL_ID}`;
  $('bk-embed-code').textContent =
`<div id="smartrooms-widget" data-hotel="${HOTEL_ID}"></div>
<script src="${PUBLIC_BOOKING_URL}/widget.js" async><\/script>`;

  await loadTarifas();
}

async function saveBookingConfig() {
  if (!HOTEL_ID) return;
  $('bk-save-err').textContent = '';
  try {
    await apiFetch(`/admin/booking-config/${HOTEL_ID}`, {
      method: 'PUT',
      body: JSON.stringify({
        activo:           $('bk-activo').checked ? 1 : 0,
        titulo:           $('bk-titulo').value.trim() || null,
        color_primario:   $('bk-color1').value,
        color_secundario: $('bk-color2').value,
        logo_url:         $('bk-logo').value.trim() || null,
        politica_cancel:  $('bk-policy').value.trim() || null,
      }),
    });
    showToast('Configuración guardada', 'success');
  } catch (err) {
    $('bk-save-err').textContent = err.message;
  }
}

function copyEmbedCode() {
  const text = $('bk-embed-code').textContent;
  navigator.clipboard.writeText(text)
    .then(() => showToast('Código copiado al portapapeles', 'success'))
    .catch(() => showToast('No se pudo copiar. Selecciona el texto manualmente.', 'error'));
}

// ── CATEGORÍAS DE HABITACIÓN ──────────────────────────────────────────────────
window.assignCategoria = async function(roomId, categoriaId) {
  try {
    await apiFetch(`/admin/rooms/${roomId}/categoria`, {
      method: 'PATCH', body: JSON.stringify({ categoriaId: categoriaId || null }),
    });
    const room = rooms.find(r => r.id === roomId);
    if (room) room.categoriaId = categoriaId || null;
    showToast('Categoría actualizada', 'success');
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
    await loadRooms();
  }
};

async function loadCategorias() {
  await loadCategoriasCache();
  renderCategorias();
}

function renderCategorias() {
  if (!categoriasCache.length) {
    $('categorias-list').innerHTML = '<div class="form-note">Sin categorías configuradas. Crea una para poder asignarla a tus habitaciones y fijarle una tarifa.</div>';
    return;
  }
  $('categorias-list').innerHTML = categoriasCache.map(c => {
    const nRooms = rooms.filter(r => r.categoriaId === c.id).length;
    return `
    <div class="mapping-row" style="margin-bottom:6px">
      <span class="mapping-room">${c.nombre}</span>
      <span class="mapping-ota">${c.camas} cama${c.camas !== 1 ? 's' : ''} · ${nRooms} habitación${nRooms !== 1 ? 'es' : ''} asignada${nRooms !== 1 ? 's' : ''}</span>
      <button class="btn btn-outline btn-sm" style="margin-right:6px" onclick="openEditCategoriaModal('${c.id}')">Editar</button>
      <button class="mapping-del" onclick="deleteCategoria('${c.id}')" title="Eliminar">✕</button>
    </div>`;
  }).join('');
}

function openAddCategoriaModal() {
  $('cg-title').textContent = 'Agregar categoría';
  $('cg-nombre').value = '';
  $('cg-camas').value = 1;
  $('cg-error').textContent = '';
  $('cg-save').onclick = submitCategoria;
  $('modal-categoria').classList.remove('hidden');
}

window.openEditCategoriaModal = function(id) {
  const cat = categoriasCache.find(c => c.id === id);
  if (!cat) return;
  $('cg-title').textContent = 'Editar categoría';
  $('cg-nombre').value = cat.nombre;
  $('cg-camas').value = cat.camas;
  $('cg-error').textContent = '';
  $('cg-save').onclick = () => submitCategoria(id);
  $('modal-categoria').classList.remove('hidden');
};

async function submitCategoria(existingId) {
  $('cg-error').textContent = '';
  const nombre = $('cg-nombre').value.trim();
  const camas  = parseInt($('cg-camas').value) || 0;
  if (!nombre) { $('cg-error').textContent = 'Ingresa un nombre.'; return; }
  if (camas <= 0) { $('cg-error').textContent = 'Ingresa un número de camas válido.'; return; }

  try {
    if (existingId) {
      await apiFetch(`/admin/categorias/${existingId}`, { method: 'PATCH', body: JSON.stringify({ nombre, camas }) });
    } else {
      await apiFetch('/admin/categorias', { method: 'POST', body: JSON.stringify({ hotelId: HOTEL_ID, nombre, camas }) });
    }
    closeModal('modal-categoria');
    showToast(existingId ? 'Categoría actualizada' : 'Categoría creada', 'success');
    await loadCategorias();
  } catch (err) {
    $('cg-error').textContent = err.message;
  }
}

window.deleteCategoria = async function(id) {
  const nRooms = rooms.filter(r => r.categoriaId === id).length;
  const aviso = nRooms ? ` ${nRooms} habitación${nRooms !== 1 ? 'es' : ''} quedará${nRooms !== 1 ? 'n' : ''} sin categoría.` : '';
  if (!confirm(`¿Eliminar esta categoría?${aviso} Las tarifas asociadas se desactivarán.`)) return;
  try {
    await apiFetch(`/admin/categorias/${id}`, { method: 'DELETE' });
    showToast('Categoría eliminada', 'success');
    await loadRooms();
    renderCategorias();
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
  }
};

async function loadTarifas() {
  try {
    const lista = await apiFetch(`/admin/tarifas?hotel=${encodeURIComponent(HOTEL_ID)}`);
    renderTarifas(lista);
  } catch {
    $('tarifas-list').innerHTML = '<div class="form-note">Error cargando tarifas.</div>';
  }
}

function renderTarifas(lista) {
  if (!lista.length) {
    $('tarifas-list').innerHTML = '<div class="form-note">Sin tarifas configuradas. Sin tarifas, el motor de reservas no muestra precios.</div>';
    return;
  }
  $('tarifas-list').innerHTML = lista.map(t => {
    const ambito = t.room_id
      ? `Hab. ${t.room_id}`
      : t.categoria_id
        ? `Categoría: ${categoriasCache.find(c => c.id === t.categoria_id)?.nombre || t.categoria_id}`
        : 'Todo el hotel';
    return `
    <div class="mapping-row" style="margin-bottom:6px">
      <span class="mapping-room">${t.nombre}</span>
      <span class="mapping-ota">${ambito} · ${t.precio_uf} UF/noche · ${t.desde} → ${t.hasta} · min ${t.min_noches} noche${t.min_noches !== 1 ? 's' : ''}</span>
      <span class="badge ${t.activa ? 'badge-active' : 'badge-inactive'}" style="margin-right:6px">${t.activa ? 'Activa' : 'Inactiva'}</span>
      <button class="mapping-del" onclick="deleteTarifa('${t.id}')" title="Eliminar">✕</button>
    </div>`;
  }).join('');
}

window.deleteTarifa = async function(id) {
  if (!confirm('¿Eliminar esta tarifa?')) return;
  try {
    await apiFetch(`/admin/tarifas/${id}`, { method: 'DELETE' });
    await loadTarifas();
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
  }
};

function updateTarifaAmbitoFields() {
  const ambito = $('tf-ambito').value;
  $('tf-categoria-field').classList.toggle('hidden', ambito !== 'categoria');
  $('tf-room-field').classList.toggle('hidden', ambito !== 'room');
}

async function openAddTarifaModal() {
  $('tf-error').textContent = '';
  $('tf-nombre').value = '';
  $('tf-precio').value = '';
  $('tf-desde').value  = new Date().toISOString().slice(0, 10);
  $('tf-hasta').value  = new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10);
  $('tf-min').value    = 1;
  $('tf-ambito').value = 'general';
  updateTarifaAmbitoFields();

  $('tf-categoria').innerHTML = categoriasCache.length
    ? categoriasCache.map(c => `<option value="${c.id}">${c.nombre} (${c.camas} cama${c.camas !== 1 ? 's' : ''})</option>`).join('')
    : '<option value="">Sin categorías creadas</option>';

  try {
    const roomsList = await apiFetch(`/admin/rooms?hotel=${encodeURIComponent(HOTEL_ID)}`);
    $('tf-room').innerHTML = roomsList.map(r => `<option value="${r.id}">${r.name} (${r.id})</option>`).join('');
  } catch { $('tf-room').innerHTML = ''; }

  $('modal-tarifa').classList.remove('hidden');
}

async function submitTarifa() {
  $('tf-error').textContent = '';
  const nombre    = $('tf-nombre').value.trim();
  const precioUF  = parseFloat($('tf-precio').value);
  const desde     = $('tf-desde').value;
  const hasta     = $('tf-hasta').value;
  const minNoches = parseInt($('tf-min').value) || 1;
  const ambito    = $('tf-ambito').value;
  const roomId       = ambito === 'room'       ? $('tf-room').value       : undefined;
  const categoriaId  = ambito === 'categoria'  ? $('tf-categoria').value  : undefined;

  if (!nombre) { $('tf-error').textContent = 'Ingresa un nombre para la tarifa.'; return; }
  if (!precioUF || precioUF <= 0) { $('tf-error').textContent = 'Ingresa un precio válido en UF.'; return; }
  if (!desde || !hasta || desde >= hasta) { $('tf-error').textContent = 'Rango de fechas inválido.'; return; }
  if (ambito === 'categoria' && !categoriaId) { $('tf-error').textContent = 'Crea al menos una categoría primero (sección Categorías).'; return; }

  try {
    await apiFetch('/admin/tarifas', {
      method: 'POST',
      body: JSON.stringify({ hotelId: HOTEL_ID, roomId, categoriaId, nombre, precioUF, desde, hasta, minNoches }),
    });
    closeModal('modal-tarifa');
    showToast('Tarifa agregada', 'success');
    await loadTarifas();
  } catch (err) {
    $('tf-error').textContent = err.message;
  }
}

// ── PAGOS (reporte hotel-wide — vista owner) ─────────────────────────────────
const TRANS_TIPO_LABEL_PG   = { webpay: 'Tarjeta (Webpay)', mercadopago: 'Mercado Pago', efectivo: 'Efectivo', transferencia: 'Transferencia' };
const TRANS_ESTADO_LABEL_PG = { pendiente: 'Pendiente', aprobado: 'Aprobado', rechazado: 'Rechazado', anulado: 'Anulado' };

async function loadTransacciones() {
  if (!HOTEL_ID) return;
  const desde = $('pg-desde').value;
  const hasta = $('pg-hasta').value;
  let qs = `?hotel=${encodeURIComponent(HOTEL_ID)}`;
  if (desde) qs += `&desde=${desde}`;
  if (hasta) qs += `&hasta=${hasta}`;

  try {
    const lista = await apiFetch(`/admin/transacciones${qs}`);
    renderPagosKPI(lista);
    renderPagosList(lista);
  } catch (err) {
    $('pg-list').innerHTML = `<div class="form-note">Error: ${err.message}</div>`;
  }
}

function renderPagosKPI(lista) {
  const aprobadas = lista.filter(t => t.estado === 'aprobado');
  const totalCLP   = aprobadas.reduce((s, t) => s + t.monto_clp, 0);
  const pendientes = lista.filter(t => t.estado === 'pendiente').length;
  const porTipo    = aprobadas.reduce((acc, t) => { acc[t.tipo] = (acc[t.tipo] || 0) + 1; return acc; }, {});
  const tipoTop    = Object.entries(porTipo).sort((a, b) => b[1] - a[1])[0];

  $('pg-kpi-row').innerHTML = `
    <div class="kpi-card">
      <div class="kpi-label">Total cobrado</div>
      <div class="kpi-value">$${totalCLP.toLocaleString('es-CL')}</div>
      <div class="kpi-sub">${aprobadas.length} transacciones aprobadas</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Pendientes</div>
      <div class="kpi-value">${pendientes}</div>
      <div class="kpi-sub">Esperando confirmación</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Medio más usado</div>
      <div class="kpi-value" style="font-size:18px">${tipoTop ? (TRANS_TIPO_LABEL_PG[tipoTop[0]] || tipoTop[0]) : '—'}</div>
      <div class="kpi-sub">${tipoTop ? `${tipoTop[1]} cobros` : 'Sin datos'}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Total transacciones</div>
      <div class="kpi-value">${lista.length}</div>
      <div class="kpi-sub">En el rango seleccionado</div>
    </div>`;
}

function renderPagosList(lista) {
  if (!lista.length) {
    $('pg-list').innerHTML = '<div class="form-note">Sin transacciones en este rango.</div>';
    return;
  }
  $('pg-list').innerHTML = lista.map(t => `
    <div class="mapping-row" style="margin-bottom:6px">
      <span class="mapping-room" style="width:130px;flex:none">${TRANS_TIPO_LABEL_PG[t.tipo] || t.tipo}</span>
      <span class="mapping-ota" style="flex:1">${t.guest_name || 'Sin nombre'} · $${t.monto_clp.toLocaleString('es-CL')} CLP</span>
      <span class="badge ${t.estado === 'aprobado' ? 'badge-active' : t.estado === 'pendiente' ? '' : 'badge-error'}" style="margin-right:8px">${TRANS_ESTADO_LABEL_PG[t.estado] || t.estado}</span>
      <span style="font-size:10px;color:var(--text3);white-space:nowrap">${new Date(t.created_at).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' })}</span>
    </div>`).join('');
}

function startClock() {
  const update = () => {
    const n = new Date();
    const locale = LOCALES[dashLang] || 'es-CL';
    const t = n.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const d = n.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' });
    $('clock').textContent = `${d} · ${t}`;
  };
  update();
  setInterval(update, 1000);
}

// ── INIT ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  $('login-btn').addEventListener('click', login);
  $('login-email').addEventListener('keydown', e => { if (e.key === 'Enter') login(); });
  $('login-password').addEventListener('keydown', e => { if (e.key === 'Enter') login(); });
  $('logout-btn').addEventListener('click', logout);
  $('btn-new-stay').addEventListener('click', () => openNewStayModal());

  $('sb-toggle').addEventListener('click', () => {
    if (window.innerWidth <= 900) {
      toggleMobileSidebar();
    } else {
      state.sidebarCollapsed = !state.sidebarCollapsed;
      $('sidebar').classList.toggle('collapsed', state.sidebarCollapsed);
    }
  });

  $('sidebar-backdrop').addEventListener('click', () => closeMobileSidebar());

  applyDashTheme();
  $('theme-toggle').addEventListener('click', toggleDashTheme);

  document.querySelectorAll('.nav-item').forEach(el => {
    el.addEventListener('click', () => {
      navigate(el.dataset.view);
      closeMobileSidebar();
    });
  });

  document.querySelectorAll('#filter-bar .filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.filter = btn.dataset.filter;
      document.querySelectorAll('#filter-bar .filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderRooms('rooms', state.filter);
    });
  });

  $('room-search').addEventListener('input', e => {
    state.search = e.target.value;
    renderRooms('rooms', state.filter);
  });

  ['modal-room', 'modal-new-stay', 'modal-reserva', 'modal-add-canal', 'modal-canal-config', 'modal-tarifa', 'modal-categoria'].forEach(id => {
    $(id).addEventListener('click', e => { if (e.target === $(id)) closeModal(id); });
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') document.querySelectorAll('.modal-overlay:not(.hidden)').forEach(m => closeModal(m.id));
  });

  const panelLangSelect = $('panel-lang-select');
  if (panelLangSelect) panelLangSelect.addEventListener('change', e => setDashLang(e.target.value));

  // Canales OTA
  $('btn-add-canal').addEventListener('click', openAddCanalModal);
  $('ac-cancel').addEventListener('click', () => closeModal('modal-add-canal'));
  $('ac-save').addEventListener('click', submitAddCanal);
  $('cc-close').addEventListener('click', () => closeModal('modal-canal-config'));
  $('btn-add-mapping').addEventListener('click', addMapping);
  document.querySelectorAll('.modal-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.modal-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      $('tab-' + tab.dataset.tab).classList.add('active');
      if (tab.dataset.tab === 'log') loadSyncLog();
    });
  });

  // Motor de reservas
  $('bk-save').addEventListener('click', saveBookingConfig);
  $('bk-copy').addEventListener('click', copyEmbedCode);
  $('bk-add-tarifa').addEventListener('click', openAddTarifaModal);
  $('tf-cancel').addEventListener('click', () => closeModal('modal-tarifa'));
  $('tf-save').addEventListener('click', submitTarifa);
  $('tf-ambito').addEventListener('change', updateTarifaAmbitoFields);

  // Pagos
  $('pg-filtrar').addEventListener('click', loadTransacciones);

  // Categorías de habitación
  $('btn-add-categoria').addEventListener('click', openAddCategoriaModal);
  $('cg-cancel').addEventListener('click', () => closeModal('modal-categoria'));

  applyDashLang();
  startClock();

  const session = getSession();
  if (session) {
    HOTEL_ID = session.rol === 'superadmin'
      ? new URLSearchParams(location.search).get('hotel')
      : session.hotelId;
    applyRoleVisibility(session.rol);
    loadRooms()
      .then(() => {
        $('login-screen').classList.add('hidden');
        $('sidebar').classList.remove('hidden');
        $('main').classList.remove('hidden');
        loadRequests();
        checkPagoReturn();
      })
      .catch(() => sessionStorage.removeItem(SESSION_STORAGE));
  }

  // Solicitudes de huéspedes: refrescar periódicamente
  setInterval(() => { if (getSession()) loadRequests(); }, 20_000);
});
