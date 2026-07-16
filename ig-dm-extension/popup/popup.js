// IG DM Automator — Popup Script
// Binds form controls, handles Start/Stop, polls progress from chrome.storage

// ── DOM refs ──
var els = {
  message: document.getElementById('message'),
  personalized: document.getElementById('personalized'),
  delayMin: document.getElementById('delayMin'),
  delayMax: document.getElementById('delayMax'),
  maxMessages: document.getElementById('maxMessages'),
  weeksBack: document.getElementById('weeksBack'),
  skipGroups: document.getElementById('skipGroups'),
  dryRun: document.getElementById('dryRun'),
  startBtn: document.getElementById('startBtn'),
  stopBtn: document.getElementById('stopBtn'),
  statusDot: document.getElementById('statusDot'),
  statusText: document.getElementById('statusText'),
  progressFraction: document.getElementById('progressFraction'),
  progressPercent: document.getElementById('progressPercent'),
  progressFill: document.getElementById('progressFill'),
  sentCount: document.getElementById('sentCount'),
  failedCount: document.getElementById('failedCount'),
  currentRecipient: document.getElementById('currentRecipient'),
  currentName: document.getElementById('currentName')
};

var _pollInterval = null;
var _currentTabId = null;

// ── Load config from storage and populate form ──
async function loadAndPopulate() {
  try {
    var data = await chrome.storage.local.get('igDmConfig');
    var config = data.igDmConfig || DEFAULTS;
    els.message.value = config.message || '';
    els.personalized.checked = config.personalized || false;
    els.delayMin.value = config.delayMin || 4000;
    els.delayMax.value = config.delayMax || 6000;
    els.maxMessages.value = config.maxMessages || 1500;
    els.weeksBack.value = config.weeksBack || 3;
    els.skipGroups.checked = config.skipGroups !== false;
    els.dryRun.checked = config.dryRun || false;
  } catch (e) {
    console.error('Error loading config:', e);
  }
}

// ── Save config to storage ──
async function saveConfig() {
  try {
    var config = {
      message: els.message.value,
      personalized: els.personalized.checked,
      delayMin: parseInt(els.delayMin.value) || 4000,
      delayMax: parseInt(els.delayMax.value) || 6000,
      maxMessages: parseInt(els.maxMessages.value) || 1500,
      weeksBack: parseInt(els.weeksBack.value) || 3,
      skipGroups: els.skipGroups.checked,
      dryRun: els.dryRun.checked,
      maxScrolls: 100
    };
    await chrome.storage.local.set({ igDmConfig: config });
  } catch (e) {
    console.error('Error saving config:', e);
  }
}

// ── Poll progress from storage and update UI ──
async function updateProgress() {
  try {
    var data = await chrome.storage.local.get('igDmProgress');
    var p = data.igDmProgress || DEFAULT_PROGRESS;

    // Status dot + text
    var statusMap = {
      'idle':     { cls: 'idle',   text: '● Listo' },
      'scanning': { cls: 'active', text: '🔍 Escaneando...' },
      'sending':  { cls: 'active', text: '📨 Enviando...' },
      'paused':   { cls: 'paused', text: '⚠ Pausado (CAPTCHA)' },
      'stopped':  { cls: 'idle',   text: '⏹ Detenido' },
      'done':     { cls: 'done',   text: '✅ Completado' }
    };
    var state = statusMap[p.status] || statusMap['idle'];
    els.statusDot.className = 'status-dot ' + state.cls;
    els.statusText.textContent = state.text;

    // Progress numbers
    els.progressFraction.textContent = p.current + '/' + p.total;
    var pct = p.total > 0 ? Math.round((p.current / p.total) * 100) : 0;
    els.progressPercent.textContent = '(' + pct + '%)';
    els.progressFill.style.width = pct + '%';

    // Counts
    els.sentCount.textContent = p.sent;
    els.failedCount.textContent = p.failed;

    // Current recipient
    if (p.currentName && (p.status === 'sending' || p.status === 'paused')) {
      els.currentRecipient.style.display = 'block';
      els.currentName.textContent = p.currentName;
    } else {
      els.currentRecipient.style.display = 'none';
    }

    // Button states
    var running = (p.status === 'scanning' || p.status === 'sending' || p.status === 'paused');
    els.startBtn.disabled = running;
    els.stopBtn.disabled = !running;
  } catch (e) {
    // Storage might not be available yet
  }
}

// ── Start polling ──
function startPolling() {
  updateProgress();
  _pollInterval = setInterval(updateProgress, 500);
}

// ── Stop polling ──
function stopPolling() {
  if (_pollInterval) {
    clearInterval(_pollInterval);
    _pollInterval = null;
  }
}

// ── Get current Instagram Direct tab ──
async function getDirectTab() {
  try {
    var tabs = await chrome.tabs.query({
      url: ['*://www.instagram.com/direct/*', '*://instagram.com/direct/*']
    });
    return tabs[0] || null;
  } catch (e) {
    return null;
  }
}

// ── Start sending ──
async function handleStart() {
  // Save config first
  await saveConfig();

  var tab = await getDirectTab();
  if (!tab) {
    alert('⚠ Abre Instagram Direct (instagram.com/direct/) primero.');
    return;
  }

  _currentTabId = tab.id;

  // Reset progress
  await chrome.storage.local.set({
    igDmProgress: {
      status: 'scanning',
      total: 0,
      current: 0,
      sent: 0,
      failed: 0,
      errors: [],
      currentName: '',
      startedAt: Date.now()
    }
  });

  // Clear any previous session
  await chrome.storage.local.remove('igDmSession');

  // Send START command to content script
  try {
    var response = await chrome.tabs.sendMessage(tab.id, { action: 'START' });
    console.log('START response:', response);
  } catch (e) {
    console.error('Error sending START:', e);
    alert('⚠ No se pudo iniciar. Recarga la página de Instagram Direct e inténtalo de nuevo.');
  }
}

// ── Stop sending ──
async function handleStop() {
  var tab = null;
  if (_currentTabId) {
    try {
      tab = await chrome.tabs.get(_currentTabId);
    } catch (e) {
      // Tab might be closed
    }
  }
  if (!tab) {
    tab = await getDirectTab();
  }

  if (tab) {
    try {
      await chrome.tabs.sendMessage(tab.id, { action: 'STOP' });
    } catch (e) {
      console.error('Error sending STOP:', e);
    }
  }

  // Update progress to stopped
  try {
    var data = await chrome.storage.local.get('igDmProgress');
    var p = data.igDmProgress || {};
    p.status = 'stopped';
    await chrome.storage.local.set({ igDmProgress: p });
    await chrome.storage.local.remove('igDmSession');
  } catch (e) {}
}

// ── Event listeners ──
els.startBtn.addEventListener('click', handleStart);
els.stopBtn.addEventListener('click', handleStop);

// Auto-save config on change
var autoSaveEls = [els.message, els.personalized, els.delayMin, els.delayMax,
  els.maxMessages, els.weeksBack, els.skipGroups, els.dryRun];

autoSaveEls.forEach(function (el) {
  var eventType = (el.tagName === 'TEXTAREA' || el.type === 'number') ? 'input' : 'change';
  el.addEventListener(eventType, saveConfig);
});

// ── Initialize ──
(async function init() {
  await loadAndPopulate();
  startPolling();
})();

// Clean up polling when popup closes
window.addEventListener('unload', stopPolling);
