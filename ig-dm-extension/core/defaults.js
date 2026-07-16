// Default configuration for IG DM Automator
// Stored in chrome.storage.local under key 'igDmConfig'
var DEFAULTS = {
  message: [
    '¡Hey {nombre}! 👋',
    '',
    'VIERNES 17 LUAR LA L 🎤🎤',
    'IMAGEN PAGANDO ENTRADA',
    '',
    'SÁBADO 18 COWBOY 🤠',
    'TU FIESTA FAVORITA HA LLEGADO.',
    '',
    'RECUERDA RESERVAR TU PLAZA.',
    'PULSERA VIP + CONSUMICIÓN',
    'https://chat.whatsapp.com/K6nVfphXdVr5o9DAZInWYu?mode=gi_t'
  ].join('\n'),

  personalized: false,
  delayMin: 4000,
  delayMax: 6000,
  maxMessages: 1500,
  weeksBack: 3,
  skipGroups: true,
  dryRun: false,
  maxScrolls: 100
};

var DEFAULT_PROGRESS = {
  status: 'idle',       // 'idle' | 'scanning' | 'sending' | 'paused' | 'stopped' | 'done'
  total: 0,
  current: 0,
  sent: 0,
  failed: 0,
  errors: [],
  currentName: '',
  startedAt: null
};
