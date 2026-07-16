// IG DM Automator — Service Worker
// Minimal: initializes default config on install

chrome.runtime.onInstalled.addListener(async function () {
  try {
    // Initialize default config if not set
    var data = await chrome.storage.local.get('igDmConfig');
    if (!data.igDmConfig) {
      await chrome.storage.local.set({
        igDmConfig: {
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
        }
      });
    }

    // Initialize progress
    var progress = await chrome.storage.local.get('igDmProgress');
    if (!progress.igDmProgress) {
      await chrome.storage.local.set({
        igDmProgress: {
          status: 'idle',
          total: 0,
          current: 0,
          sent: 0,
          failed: 0,
          errors: [],
          currentName: '',
          startedAt: null
        }
      });
    }

    console.log('[IG-DM-SW] Service worker instalado. Extensión lista.');
  } catch (e) {
    console.error('[IG-DM-SW] Error en instalación:', e.message);
  }
});

// Relay PROGRESS messages (popup polls storage independently, this is fallback)
chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
  if (msg.action === 'PROGRESS') {
    sendResponse({ ack: true });
  }
});
