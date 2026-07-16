// IG DM Automator — Popup Script v2.1
// PING-first handshake, timeout-safe sendToContent, force-reset, auto-reload

// ── DOM refs ──
var els = {
  modeTabs: document.getElementById('modeTabs'),
  modeHint: document.getElementById('modeHint'),
  emptyState: document.getElementById('emptyState'),
  workUI: document.getElementById('workUI'),
  openDirectBtn: document.getElementById('openDirectBtn'),
  reloadDirectBtn: document.getElementById('reloadDirectBtn'),
  resetBtn: document.getElementById('resetBtn'),
  message: document.getElementById('message'),
  delayMin: document.getElementById('delayMin'),
  delayMax: document.getElementById('delayMax'),
  maxMessages: document.getElementById('maxMessages'),
  weeksBack: document.getElementById('weeksBack'),
  skipGroups: document.getElementById('skipGroups'),
  startBtn: document.getElementById('startBtn'),
  stopBtn: document.getElementById('stopBtn'),
  statusDot: document.getElementById('statusDot'),
  statusPill: document.getElementById('statusPill'),
  statusText: document.getElementById('statusText'),
  progressFraction: document.getElementById('progressFraction'),
  progressPercent: document.getElementById('progressPercent'),
  progressFill: document.getElementById('progressFill'),
  sentCount: document.getElementById('sentCount'),
  failedCount: document.getElementById('failedCount'),
  currentRecipient: document.getElementById('currentRecipient'),
  currentName: document.getElementById('currentName'),
  resumeBanner: document.getElementById('resumeBanner'),
  resumeBtn: document.getElementById('resumeBtn'),
  resumeRemaining: document.getElementById('resumeRemaining'),
  resumeSub: document.getElementById('resumeSub')
};

var _pollInterval = null;
var _currentTabId = null;
var _mode = 'official';

// Mode → derived flags
var MODE_FLAGS = {
  official: { dryRun: false, personalized: false, hint: 'Envío real · sin personalizar' },
  dryrun:   { dryRun: true,  personalized: false, hint: 'Prueba · no se envía nada' },
  custom:   { dryRun: false, personalized: true,  hint: 'Envío real · con {nombre}' }
};

var DIRECT_URL = 'https://www.instagram.com/direct/inbox/';
var DIRECT_TAB_PATTERNS = ['*://www.instagram.com/direct/*', '*://instagram.com/direct/*'];

// ── Sleep helper ──
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

// ── Load config from storage and populate form ──
async function loadAndPopulate() {
  try {
    var data = await chrome.storage.local.get('igDmConfig');
    var config = data.igDmConfig || DEFAULTS;
    _mode = config.mode || 'official';
    setMode(_mode, false);
    els.message.value = config.message || '';
    els.delayMin.value = config.delayMin || 4000;
    els.delayMax.value = config.delayMax || 6000;
    els.maxMessages.value = config.maxMessages || 1500;
    els.weeksBack.value = config.weeksBack || 3;
    els.skipGroups.checked = config.skipGroups !== false;
  } catch (e) {
    console.error('Error loading config:', e);
  }
}

// ── Save config to storage ──
async function saveConfig() {
  try {
    var flags = MODE_FLAGS[_mode] || MODE_FLAGS.official;
    var config = {
      mode: _mode,
      personalized: flags.personalized,
      dryRun: flags.dryRun,
      message: els.message.value,
      delayMin: parseInt(els.delayMin.value) || 4000,
      delayMax: parseInt(els.delayMax.value) || 6000,
      maxMessages: parseInt(els.maxMessages.value) || 1500,
      weeksBack: parseInt(els.weeksBack.value) || 3,
      skipGroups: els.skipGroups.checked,
      maxScrolls: 100
    };
    await chrome.storage.local.set({ igDmConfig: config });
  } catch (e) {
    console.error('Error saving config:', e);
  }
}

// ── Mode switching ──
function setMode(mode, ensureNombre) {
  _mode = mode;
  var tabs = els.modeTabs.querySelectorAll('.tab');
  tabs.forEach(function (t) { t.classList.toggle('is-active', t.dataset.mode === mode); });
  els.modeHint.textContent = (MODE_FLAGS[mode] || MODE_FLAGS.official).hint;

  if (mode === 'custom' && ensureNombre) {
    var msg = els.message.value || '';
    if (!msg.includes('{nombre}')) {
      els.message.value = '\u00a1Hey {nombre}! \ud83d\udc4b\n\n' + msg;
    }
  }
}

// ── Find a Direct tab ──
async function getDirectTab() {
  try {
    var tabs = await chrome.tabs.query({ url: DIRECT_TAB_PATTERNS });
    return tabs[0] || null;
  } catch (e) { return null; }
}

// ── Send a message to a tab with timeout ──
function sendWithTimeout(tabId, message, timeoutMs) {
  timeoutMs = timeoutMs || 5000;
  return Promise.race([
    chrome.tabs.sendMessage(tabId, message),
    new Promise(function (_, reject) {
      setTimeout(function () { reject(new Error('timeout')); }, timeoutMs);
    })
  ]);
}

// ── Ping content script — retry until it responds or we give up ──
async function pingContentScript(tabId, retries) {
  retries = retries || 15;
  for (var i = 0; i < retries; i++) {
    try {
      var resp = await sendWithTimeout(tabId, { action: 'PING' }, 3000);
      if (resp && resp.pong) return resp;
    } catch (e) {
      // Not ready yet — wait and retry
    }
    await sleep(600);
  }
  return null;
}

// ── Send START (will not set progress until content script confirms) ──
async function handleStart() {
  await saveConfig();

  // Step 1: Find or open Direct tab
  var tab = await getDirectTab();
  if (!tab) {
    await chrome.tabs.create({ url: DIRECT_URL, active: true });
    return; // popup may close; user clicks Iniciar again on next popup open
  }
  _currentTabId = tab.id;

  // Step 2: Verify content script is alive via PING
  var pong = await pingContentScript(tab.id, 15); // ~10s total
  if (!pong) {
    // Last resort: service worker should have auto-injected via webNavigation.
    // If it still didn't work, ask user to reload the page.
    alert(
      '\u26a0 No se pudo conectar con Instagram Direct.\n\n' +
      'Aseg\u00farate de que la pesta\u00f1a de Instagram Direct est\u00e9 ' +
      'totalmente cargada y visible.\n\n' +
      'Prueba: pulsa "Recargar" abajo para refrescar la p\u00e1gina.'
    );
    return;
  }

  // Step 3: Only NOW set progress to scanning and clear old session
  await chrome.storage.local.set({
    igDmProgress: {
      status: 'scanning', total: 0, current: 0, sent: 0, failed: 0,
      errors: [], currentName: '', startedAt: Date.now()
    }
  });
  await chrome.storage.local.remove('igDmSession');

  // Step 4: Send START with timeout
  try {
    var resp = await sendWithTimeout(tab.id, { action: 'START' }, 6000);
    if (!resp) {
      throw new Error('No response');
    }
  } catch (e) {
    // Revert progress to idle if START never reached content script
    await chrome.storage.local.set({
      igDmProgress: {
        status: 'idle', total: 0, current: 0, sent: 0, failed: 0,
        errors: [], currentName: '', startedAt: null
      }
    });
    alert(
      '\u26a0 No se pudo iniciar el env\u00edo.\n\n' +
      'Recarga la p\u00e1gina de Instagram Direct e int\u00e9ntalo de nuevo.'
    );
    return;
  }
  // If we reach here, START was delivered successfully.
  // Progress updates come from the content script via storage polling.
}

// ── Resume from a saved session ──
async function handleResume() {
  var tab = await getDirectTab();
  if (!tab) {
    await chrome.tabs.create({ url: DIRECT_URL, active: true });
    return;
  }
  _currentTabId = tab.id;

  // Ping first to ensure content script exists
  var pong = await pingContentScript(tab.id, 8);
  if (!pong) {
    alert('\u26a0 No se pudo reanudar. Recarga la p\u00e1gina de Instagram Direct.');
    return;
  }

  try {
    await sendWithTimeout(tab.id, { action: 'RESUME' }, 5000);
  } catch (e) {
    // resume might hang or timeout — silently fail, polling will show the truth
  }
}

// ── Stop sending ──
async function handleStop() {
  // Try to find the content script tab
  var tab = null;
  if (_currentTabId) { try { tab = await chrome.tabs.get(_currentTabId); } catch (e) {} }
  if (!tab) tab = await getDirectTab();

  if (tab) {
    try {
      await sendWithTimeout(tab.id, { action: 'STOP' }, 3000);
      // Content script will keep the session and set status 'stopped'.
      return; // polling shows resume banner
    } catch (e) {
      // Content script not reachable — force-reset below
    }
  }

  // Force-reset: no content script or tab gone
  await chrome.storage.local.set({
    igDmProgress: {
      status: 'idle', total: 0, current: 0, sent: 0, failed: 0,
      errors: [], currentName: '', startedAt: null
    }
  });
}

// ── Force-reset progress (clears stuck state) ──
async function handleReset() {
  await chrome.storage.local.set({
    igDmProgress: {
      status: 'idle', total: 0, current: 0, sent: 0, failed: 0,
      errors: [], currentName: '', startedAt: null
    }
  });
  await chrome.storage.local.remove('igDmSession');
}

// ── Reload Direct tab ──
async function handleReload() {
  var tab = await getDirectTab();
  if (tab) {
    await chrome.tabs.reload(tab.id);
  } else {
    await chrome.tabs.create({ url: DIRECT_URL, active: true });
  }
}

// ── Wait for a tab to finish loading ──
function waitTabLoaded(tabId) {
  return new Promise(function (resolve) {
    var done = false;
    function finish() {
      if (done) return;
      done = true;
      chrome.tabs.onUpdated.removeListener(onUpdated);
      resolve();
    }
    function onUpdated(id, info) {
      if (id === tabId && info.status === 'complete') finish();
    }
    chrome.tabs.onUpdated.addListener(onUpdated);
    setTimeout(finish, 8000);
  });
}

// ── Poll progress + session from storage and update UI ──
async function updateProgress() {
  try {
    var data = await chrome.storage.local.get(['igDmProgress', 'igDmSession']);
    var p = data.igDmProgress || DEFAULT_PROGRESS;
    var session = data.igDmSession || null;

    // Status dot + pill + text
    var statusMap = {
      'idle':     { cls: 'idle',   pill: 'idle',    text: 'Listo' },
      'scanning': { cls: 'active', pill: 'active',  text: 'Escaneando' },
      'sending':  { cls: 'active', pill: 'active',  text: 'Enviando' },
      'paused':   { cls: 'paused', pill: 'paused',  text: 'Pausado (CAPTCHA)' },
      'stopped':  { cls: 'idle',   pill: 'idle',    text: 'Detenido' },
      'done':     { cls: 'done',   pill: 'done',    text: 'Completado' }
    };
    var state = statusMap[p.status] || statusMap['idle'];
    els.statusDot.className = 'status-dot ' + state.cls;
    els.statusPill.className = 'status-pill ' + state.pill;
    els.statusText.textContent = state.text;

    // Progress numbers
    els.progressFraction.textContent = p.current + '/' + p.total;
    var pct = p.total > 0 ? Math.round((p.current / p.total) * 100) : 0;
    els.progressPercent.textContent = pct + '%';
    els.progressFill.style.width = pct + '%';
    els.sentCount.textContent = p.sent;
    els.failedCount.textContent = p.failed;

    // Current recipient
    if (p.currentName && (p.status === 'sending' || p.status === 'paused')) {
      els.currentRecipient.style.display = '';
      els.currentName.textContent = p.currentName;
    } else {
      els.currentRecipient.style.display = 'none';
    }

    // Resume banner: session exists + not running + stopped/paused/idle
    var running = (p.status === 'scanning' || p.status === 'sending');
    var canResume = !!session && !running && (p.status === 'stopped' || p.status === 'paused' || p.status === 'idle');
    if (canResume) {
      els.resumeBanner.hidden = false;
      var remaining = (p.total || (session && session.conversations ? session.conversations.length : 0)) - p.current;
      if (p.status === 'paused') {
        els.resumeBanner.querySelector('.resume-title').textContent = 'CAPTCHA pendiente';
        els.resumeSub.innerHTML = 'Resu\u00e9lvelo en la p\u00e1gina y pulsa Reanudar';
      } else {
        els.resumeBanner.querySelector('.resume-title').textContent = 'Sesi\u00f3n pausada';
        els.resumeSub.innerHTML = 'Quedan <b>' + Math.max(0, remaining) + '</b> mensajes';
      }
    } else {
      els.resumeBanner.hidden = true;
    }

    // Button states
    els.startBtn.disabled = running;
    els.stopBtn.disabled = !running;
    els.stopBtn.classList.toggle('is-danger', running);
  } catch (e) {
    // storage might not be ready
  }
}

// ── Empty-state detection ──
async function refreshEmptyState() {
  var tab = await getDirectTab();
  if (!tab) {
    els.emptyState.hidden = false;
    els.workUI.hidden = true;
  } else {
    els.emptyState.hidden = true;
    els.workUI.hidden = false;
    _currentTabId = tab.id;
  }
}

// ── Polling ──
function startPolling() {
  updateProgress();
  refreshEmptyState();
  _pollInterval = setInterval(function () {
    updateProgress();
    refreshEmptyState();
  }, 500);
}
function stopPolling() {
  if (_pollInterval) { clearInterval(_pollInterval); _pollInterval = null; }
}

// ── Event listeners ──
els.startBtn.addEventListener('click', handleStart);
els.stopBtn.addEventListener('click', handleStop);
els.resumeBtn.addEventListener('click', handleResume);
els.openDirectBtn.addEventListener('click', async function () {
  await chrome.tabs.create({ url: DIRECT_URL, active: true });
});
els.reloadDirectBtn.addEventListener('click', handleReload);
els.resetBtn.addEventListener('click', handleReset);

// Mode tabs
els.modeTabs.addEventListener('click', function (e) {
  var tab = e.target.closest('.tab');
  if (!tab) return;
  var mode = tab.dataset.mode;
  setMode(mode, true);
  saveConfig();
});

// Auto-save config on input
var autoSaveEls = [els.message, els.delayMin, els.delayMax, els.maxMessages, els.weeksBack, els.skipGroups];
autoSaveEls.forEach(function (el) {
  var ev = (el.tagName === 'TEXTAREA' || el.type === 'number') ? 'input' : 'change';
  el.addEventListener(ev, saveConfig);
});

// ── Initialize ──
(async function init() {
  await loadAndPopulate();
  startPolling();
})();

window.addEventListener('unload', stopPolling);