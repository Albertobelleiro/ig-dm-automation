// IG DM Automator — Service Worker v2.1
// - Initializes config on install
// - Detects SPA navigation to /direct/ and injects content script if missing
// - Relays PING for liveness checks

// ── Install: seed defaults ──
chrome.runtime.onInstalled.addListener(async function () {
  try {
    var data = await chrome.storage.local.get('igDmConfig');
    if (!data.igDmConfig) {
      await chrome.storage.local.set({
        igDmConfig: {
          message: [
            '\u00a1Hey {nombre}! \ud83d\udc4b',
            '',
            'VIERNES 17 LUAR LA L \ud83c\udfa4\ud83c\udfa4',
            'IMAGEN PAGANDO ENTRADA',
            '',
            'S\u00c1BADO 18 COWBOY \ud83e\udd20',
            'TU FIESTA FAVORITA HA LLEGADO.',
            '',
            'RECUERDA RESERVAR TU PLAZA.',
            'PULSERA VIP + CONSUMICI\u00d3N',
            'https://chat.whatsapp.com/K6nVfphXdVr5o9DAZInWYu?mode=gi_t'
          ].join('\n'),
          mode: 'official',
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

    var progress = await chrome.storage.local.get('igDmProgress');
    if (!progress.igDmProgress) {
      await chrome.storage.local.set({
        igDmProgress: {
          status: 'idle', total: 0, current: 0, sent: 0, failed: 0,
          errors: [], currentName: '', startedAt: null
        }
      });
    }

    console.log('[IG-DM-SW] Service worker instalado.');
  } catch (e) {
    console.error('[IG-DM-SW] Error en instalaci\u00f3n:', e.message);
  }
});

// ── SPA navigation detection: inject content script on pushState / replaceState ──
// Instagram uses SPA routing. When the user navigates from feed to /direct/,
// the URL changes via pushState but no full page load occurs.
// MV3 content_scripts only inject on full page load, so we inject dynamically here.
// Injected in ISOLATED world to match manifest content_scripts.

var INJECT_FILES = ['core/defaults.js', 'core/storage.js', 'content/content.js'];

function tryInject(tabId) {
  // Ping first — if content script already responds, skip injection
  chrome.tabs.sendMessage(tabId, { action: 'PING' })
    .then(function () {
      // already injected, nothing to do
    })
    .catch(function () {
      chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: INJECT_FILES
      }).catch(function (e) {
        console.log('[IG-DM-SW] Inyecci\u00f3n fall\u00f3 (esperada si URL a\u00fan no es /direct/):', e.message);
      });
    });
}

// SPA pushState / replaceState navigation
chrome.webNavigation.onHistoryStateUpdated.addListener(function (details) {
  if (details.frameId !== 0) return;
  if (!/instagram\.com\/direct\//.test(details.url)) return;
  tryInject(details.tabId);
});

// SPA hash navigation (less common for Instagram but safety net)
chrome.webNavigation.onReferenceFragmentUpdated.addListener(function (details) {
  if (details.frameId !== 0) return;
  if (!/instagram\.com\/direct\//.test(details.url)) return;
  tryInject(details.tabId);
});

// ── Relay: service worker handles runtime messages ──
chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
  if (msg.action === 'PROGRESS') sendResponse({ ack: true });
  else if (msg.action === 'PING') sendResponse({ pong: true });
  return true; // keep channel open for async responses
});