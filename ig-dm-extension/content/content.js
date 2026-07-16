// ============================================================
// IG DM Automator — Content Script (ISOLATED world)
// Runs on instagram.com/direct/*
// Reads config from chrome.storage, manipulates Instagram DOM,
// reports progress back via chrome.storage + runtime messages
// ============================================================

// ── Global state ──
var _stopFlag = false;
var _running = false;   // guard against concurrent START / double-run
var _config = null;
var _pendingConvs = null;
var _resolvePending = null;

// ── Load config ──
async function loadConfig() {
  try {
    var data = await chrome.storage.local.get('igDmConfig');
    _config = data.igDmConfig || DEFAULTS;
  } catch (e) {
    _config = DEFAULTS;
  }
  return _config;
}

// ── Save progress ──
async function saveProgress(progress) {
  try {
    await chrome.storage.local.set({ igDmProgress: progress });
    try { chrome.runtime.sendMessage({ action: 'PROGRESS', progress: progress }); } catch (e) {}
  } catch (e) {}
}

// ── Session persistence (recovery) ──
async function saveSession(conversations, currentIndex, sent, failed, errors) {
  try {
    await chrome.storage.local.set({
      igDmSession: {
        conversations: conversations,
        currentIndex: currentIndex,
        sent: sent,
        failed: failed,
        errors: errors,
        timestamp: Date.now()
      }
    });
  } catch (e) {}
}

async function loadSession() {
  try {
    var data = await chrome.storage.local.get('igDmSession');
    return data.igDmSession || null;
  } catch (e) { return null; }
}

async function clearSession() {
  try {
    await chrome.storage.local.remove('igDmSession');
  } catch (e) {}
}

// ── Message listener: commands from popup ──
chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
  if (msg.action === 'PING') {
    sendResponse({ pong: true, running: _running });
    return false;
  }
  if (msg.action === 'START') {
    if (_running) { sendResponse({ alreadyRunning: true }); return false; }
    _stopFlag = false;
    _running = true;
    igDmSender().then(function (result) {
      _running = false;
      sendResponse(result || { sent: 0, failed: 0 });
    }).catch(function (e) {
      _running = false;
      sendResponse({ sent: 0, failed: 0, error: e.message });
    });
    return true;
  }
  if (msg.action === 'RESUME') {
    // Resume from a saved session without re-scanning.
    if (_running) { sendResponse({ alreadyRunning: true }); return false; }
    _stopFlag = false;
    _running = true;
    loadConfig().then(function () {
      return igDmSender.confirm();
    }).then(function (r) {
      _running = false;
      sendResponse(r || { resumed: true });
    }).catch(function (e) {
      _running = false;
      sendResponse({ error: e.message });
    });
    return true;
  }
  if (msg.action === 'STOP') {
    _stopFlag = true;
    sendResponse({ stopped: true });
    return false;
  }
  if (msg.action === 'GET_STATUS') {
    chrome.storage.local.get('igDmProgress').then(function (data) {
      sendResponse(data.igDmProgress || DEFAULT_PROGRESS);
    });
    return true;
  }
});

// ============================================================
// UTILITIES
// ============================================================
function sleep(ms) {
  return new Promise(function (r) { setTimeout(r, ms); });
}

function randomDelay() {
  var ms = _config.delayMin + Math.random() * (_config.delayMax - _config.delayMin);
  return Math.round(ms);
}

function log(msg, type) {
  var colors = {
    info: 'color:#2196F3',
    success: 'color:#4CAF50;font-weight:bold',
    error: 'color:#f44336;font-weight:bold',
    warn: 'color:#FF9800;font-weight:bold',
    header: 'color:#fff;font-size:14px;font-weight:bold'
  };
  var ts = new Date().toLocaleTimeString('es-ES');
  console.log('%c[' + ts + '] ' + msg, colors[type] || colors.info);
}

function waitForElement(selector, timeout) {
  timeout = timeout || 8000;
  return new Promise(function (resolve) {
    var start = Date.now();
    var check = function () {
      var el = document.querySelector(selector);
      if (el) return resolve(el);
      if (Date.now() - start > timeout) return resolve(null);
      setTimeout(check, 200);
    };
    check();
  });
}

// ============================================================
// DOM INSPECTION
// ============================================================
function getNotesThreshold() {
  var headers = document.querySelectorAll('h1, h2');
  for (var i = 0; i < headers.length; i++) {
    var text = headers[i].textContent.trim().toLowerCase();
    if (text === 'mensajes' || text === 'messages') {
      return headers[i].getBoundingClientRect().bottom + 5;
    }
  }
  var sc = findScrollContainer();
  if (sc) return sc.getBoundingClientRect().top - 5;
  return 260;
}

function isNoteBubble(el) {
  var threshold = getNotesThreshold();
  var rect = el.getBoundingClientRect();
  if (rect.top < threshold) return true;
  var parent = el.parentElement;
  while (parent && parent !== document.body) {
    var style = window.getComputedStyle(parent);
    if ((style.overflowX === 'auto' || style.overflowX === 'scroll') &&
        parent.scrollWidth > parent.clientWidth &&
        parent.clientHeight < 120) {
      return true;
    }
    parent = parent.parentElement;
  }
  return false;
}

function isNameText(text) {
  if (!text || text.length < 1 || text.length > 50) return false;
  if (/^\d+\s*(m|min|h|d|w|sem|mes|mo|y|a)/i.test(text)) return false;
  if (/^(now|active|ahora|activo|en línea|en linea)/i.test(text)) return false;
  if (/^(mensajes|messages|tu nota|your note)/i.test(text)) return false;
  if (/^(tú|you)\s*:/i.test(text)) return false;
  if (/ha enviado/i.test(text)) return false;
  if (/le ha gustado/i.test(text)) return false;
  if (/new messages/i.test(text)) return false;
  if (/ha reaccionado/i.test(text)) return false;
  if (/archivo adjunto/i.test(text)) return false;
  if (/enviado un archivo/i.test(text)) return false;
  if (/^seen/i.test(text)) return false;
  if (/^visto/i.test(text)) return false;
  return true;
}

function checkHasTimestamp(el) {
  if (el.querySelector('time')) return true;
  var els = el.querySelectorAll('span, div, time, abbr, [dir="auto"]');
  for (var i = 0; i < els.length; i++) {
    var text = els[i].textContent.trim();
    if (text.length === 0 || text.length > 30) continue;
    if (els[i].children.length > 1) continue;
    if (/^\d+\s*(m|min|h|d|w|sem|mes|mo|y|a)/i.test(text)) return true;
    if (/^(now|active|ahora|activo)/i.test(text)) return true;
  }
  return false;
}

function findScrollContainer() {
  var allDivs = document.querySelectorAll('div');
  for (var i = 0; i < allDivs.length; i++) {
    var style = window.getComputedStyle(allDivs[i]);
    if (style.overflowY === 'auto' || style.overflowY === 'scroll') {
      if (allDivs[i].scrollHeight > allDivs[i].clientHeight) {
        var rect = allDivs[i].getBoundingClientRect();
        if (rect.left < 500 && rect.height > 200) return allDivs[i];
      }
    }
  }
  for (var j = 0; j < allDivs.length; j++) {
    var style2 = window.getComputedStyle(allDivs[j]);
    if (style2.overflowY === 'auto' || style2.overflowY === 'scroll') {
      if (allDivs[j].scrollHeight > allDivs[j].clientHeight && allDivs[j].clientHeight > 200) {
        var rect2 = allDivs[j].getBoundingClientRect();
        if (rect2.left < window.innerWidth / 2) return allDivs[j];
      }
    }
  }
  return null;
}

// ============================================================
// CONVERSATION EXTRACTION
// ============================================================
function findConversationItems() {
  var threshold = getNotesThreshold();
  var allDirAuto = document.querySelectorAll('[dir="auto"]');
  var nameEls = [];

  for (var i = 0; i < allDirAuto.length; i++) {
    var el = allDirAuto[i];
    var text = el.textContent.trim();
    if (!isNameText(text)) continue;
    var rect = el.getBoundingClientRect();
    if (rect.left > 500 || rect.left < 50) continue;
    if (rect.top < threshold) continue;
    nameEls.push(el);
  }

  log('Nombres candidatos: ' + nameEls.length, 'info');

  if (nameEls.length === 0) {
    log('No se encontraron nombres.', 'error');
    return [];
  }

  var items = [];
  var seen = new Set();

  for (var j = 0; j < nameEls.length; j++) {
    var nameEl = nameEls[j];
    var parent = nameEl.parentElement;
    var attempts = 0;
    while (parent && parent !== document.body && attempts < 15) {
      if (checkHasTimestamp(parent)) {
        var parentRect = parent.getBoundingClientRect();
        if (parentRect.left < 500 && parentRect.height > 30 && parentRect.height < 250) {
          if (!seen.has(parent) && !isNoteBubble(parent)) {
            seen.add(parent);
            items.push(parent);
          }
          break;
        }
      }
      parent = parent.parentElement;
      attempts++;
    }
  }

  var filtered = items.filter(function (item) {
    for (var k = 0; k < items.length; k++) {
      if (items[k] !== item && items[k].contains(item)) return false;
    }
    return true;
  });

  log('findConversationItems: ' + filtered.length + ' conversaciones encontradas', 'info');
  return filtered;
}

function extractTimestamp(item) {
  var timeEl = item.querySelector('time');
  if (timeEl) {
    var datetime = timeEl.getAttribute('datetime') || timeEl.getAttribute('title');
    if (datetime) {
      var date = new Date(datetime);
      if (!isNaN(date)) {
        var now = new Date();
        var diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
        return { text: timeEl.textContent.trim(), days: diffDays };
      }
    }
  }

  var allEls = item.querySelectorAll('span, div, time, abbr, [dir="auto"]');
  for (var i = 0; i < allEls.length; i++) {
    var text = allEls[i].textContent.trim();
    if (text.length === 0 || text.length > 30) continue;
    if (allEls[i].children.length > 1) continue;
    var days = parseTimestampToDays(text);
    if (days < 999) return { text: text, days: days };
  }

  return { text: '', days: 999 };
}

function parseTimestampToDays(timeText) {
  if (!timeText) return 999;
  var t = timeText.trim().toLowerCase();

  if (/^(activo|active|now|ahora)/i.test(t)) return 0;
  if (/^(en línea|en linea)/i.test(t)) return 0;

  var activeAgo = t.match(/hace\s*(\d+)\s*(m|min|h|d|w|sem|mes|mo)/);
  if (activeAgo) {
    var num = parseInt(activeAgo[1]);
    var unit = activeAgo[2];
    if (/^m/.test(unit)) return 0;
    if (/^h/.test(unit)) return 0;
    if (/^d/.test(unit)) return num;
    if (/^(w|sem)/.test(unit)) return num * 7;
    if (/^(mo|mes)/.test(unit)) return num * 30;
  }

  var mo = t.match(/^(\d+)\s*(mo|mes|meses)/);
  if (mo) return parseInt(mo[1]) * 30;

  var w = t.match(/^(\d+)\s*(w|sem|semana|semanas)/);
  if (w) return parseInt(w[1]) * 7;

  var d = t.match(/^(\d+)\s*d/);
  if (d) return parseInt(d[1]);

  var h = t.match(/^(\d+)\s*h/);
  if (h) return 0;

  var m = t.match(/^(\d+)\s*(min|minuto|minutos|m)/);
  if (m) return 0;

  var y = t.match(/^(\d+)\s*(y|a|año|años)/);
  if (y) return parseInt(y[1]) * 365;

  return 999;
}

function extractConvInfo(item) {
  var text = item.textContent || '';

  var nameEls = item.querySelectorAll('[dir="auto"]');
  var name = '';
  for (var i = 0; i < nameEls.length; i++) {
    var elText = nameEls[i].textContent.trim();
    if (isNameText(elText)) {
      name = elText;
      break;
    }
  }

  var ts = extractTimestamp(item);
  var isGroup = /group|grupo|\d+\s*(people|personas|miembros|members)/i.test(text);

  var info = {
    name: name || 'unknown',
    timestamp: ts.text,
    timeDays: ts.days,
    isGroup: isGroup
  };

  // Personalized mode: extract first name
  if (_config.personalized) {
    info.firstName = getFirstName(name);
  }

  return info;
}

// ============================================================
// NAME EXTRACTION (personalized mode)
// ============================================================
function getFirstName(fullName) {
  if (fullName.includes('_') || (!fullName.includes(' ') && fullName === fullName.toLowerCase())) {
    var cleanName = fullName.replace(/_/g, ' ').trim();
    var firstWord = cleanName.split(' ')[0];
    return capitalize(firstWord);
  }
  var firstWord = fullName.split(' ')[0];
  return capitalize(firstWord);
}

function capitalize(name) {
  if (!name) return 'amigo';
  if (name === name.toUpperCase() && name.length > 1) {
    name = name.charAt(0) + name.slice(1).toLowerCase();
  } else {
    name = name.charAt(0).toUpperCase() + name.slice(1);
  }
  return name.replace(/-(.)/g, function (match, char) { return '-' + char.toUpperCase(); });
}

// ============================================================
// SCROLL AND COLLECT CONVERSATIONS
// ============================================================
async function scrollAndCollectConversations() {
  var scrollContainer = findScrollContainer();
  if (!scrollContainer) {
    log('No se encontró contenedor de scroll.', 'error');
    return [];
  }

  var threshold = getNotesThreshold();
  var maxDays = _config.weeksBack * 7;
  var maxScrolls = _config.maxScrolls || 100;
  var collected = new Map();
  var lastScrollTop = -1;
  var stableCount = 0;
  var foundOlder = false;

  log('Contenedor de scroll encontrado. Recolectando...', 'info');

  for (var i = 0; i < maxScrolls; i++) {
    var allDirAuto = scrollContainer.querySelectorAll('[dir="auto"]');
    for (var j = 0; j < allDirAuto.length; j++) {
      var el = allDirAuto[j];
      var text = el.textContent.trim();
      if (!isNameText(text)) continue;
      var rect = el.getBoundingClientRect();
      if (rect.left > 500 || rect.left < 50) continue;
      if (rect.top < threshold) continue;
      if (rect.top > window.innerHeight + 200) continue;

      var parent = el.parentElement;
      var attempts = 0;
      while (parent && parent !== document.body && attempts < 15) {
        if (checkHasTimestamp(parent)) {
          var parentRect = parent.getBoundingClientRect();
          if (parentRect.left < 500 && parentRect.height > 30 && parentRect.height < 250) {
            if (!isNoteBubble(parent) && !collected.has(text)) {
              var info = extractConvInfo(parent);
              collected.set(text, info);
              if (info.timeDays > maxDays) {
                foundOlder = true;
                log('  Conversación antigua: ' + info.name + ' (' + info.timestamp + ', ' + info.timeDays + 'd)', 'warn');
              }
            }
            break;
          }
        }
        parent = parent.parentElement;
        attempts++;
      }
    }

    if (foundOlder) {
      log('Conversación antigua detectada. Scroll detenido en iteración ' + (i + 1) + '.', 'info');
      break;
    }

    scrollContainer.scrollTop = scrollContainer.scrollHeight;
    await sleep(1500);

    if (scrollContainer.scrollTop === lastScrollTop) {
      stableCount++;
      if (stableCount >= 2) {
        log('Scroll estabilizado. No hay más conversaciones.', 'info');
        break;
      }
    } else {
      stableCount = 0;
    }
    lastScrollTop = scrollContainer.scrollTop;

    if (i % 10 === 0 && i > 0) {
      log('  Scroll ' + i + '/' + maxScrolls + '... ' + collected.size + ' recolectadas', 'info');
    }
  }

  scrollContainer.scrollTop = 0;
  await sleep(500);

  var result = [];
  collected.forEach(function (v) { result.push(v); });

  // Deduplicate by name
  var seenNames = new Set();
  var deduped = result.filter(function (c) {
    if (seenNames.has(c.name)) return false;
    seenNames.add(c.name);
    return true;
  });

  log('Recolección completada: ' + deduped.length + ' conversaciones', 'info');
  return deduped;
}

// ============================================================
// CLICK, WRITE, SEND
// ============================================================
async function findAndClickConversation(name) {
  var scrollContainer = findScrollContainer();
  if (!scrollContainer) return false;

  var threshold = getNotesThreshold();
  var maxAttempts = 80;

  scrollContainer.scrollTop = 0;
  await sleep(800);

  for (var attempt = 0; attempt < maxAttempts; attempt++) {
    var allDirAuto = scrollContainer.querySelectorAll('[dir="auto"]');
    for (var i = 0; i < allDirAuto.length; i++) {
      var el = allDirAuto[i];
      var text = el.textContent.trim();
      if (text !== name) continue;
      if (!isNameText(text)) continue;

      var rect = el.getBoundingClientRect();
      if (rect.left > 500 || rect.left < 50) continue;
      if (rect.top < threshold) continue;
      if (rect.top > window.innerHeight + 200) continue;

      var parent = el.parentElement;
      var attempts2 = 0;
      while (parent && parent !== document.body && attempts2 < 15) {
        if (checkHasTimestamp(parent)) {
          var parentRect = parent.getBoundingClientRect();
          if (parentRect.left < 500 && parentRect.height > 30 && parentRect.height < 250) {
            if (!isNoteBubble(parent)) {
              parent.click();
              return true;
            }
          }
        }
        parent = parent.parentElement;
        attempts2++;
      }
    }
    scrollContainer.scrollTop += 400;
    await sleep(500);
  }
  return false;
}

async function writeMessage(input, text) {
  for (var attempt = 0; attempt < 3; attempt++) {
    input.click();
    await sleep(300 + attempt * 200);
    input.focus();
    await sleep(200);

    try { document.execCommand('selectAll', false, null); document.execCommand('delete', false, null); } catch (e) {}
    input.textContent = '';
    input.innerHTML = '';
    await sleep(150);

    // Method 1: Paste simulation
    try {
      var dt = new DataTransfer();
      dt.setData('text/plain', text);
      input.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: dt }));
      await sleep(300);
      if (input.textContent.trim().length > 0 && (input.innerHTML.includes('<') || input.textContent.includes('\n'))) return true;
    } catch (e) {}

    try { document.execCommand('selectAll', false, null); document.execCommand('delete', false, null); } catch (e) {}
    input.innerHTML = '';
    await sleep(150);

    // Method 2: Line by line with Enter key
    try {
      var lines = text.split('\n');
      for (var li = 0; li < lines.length; li++) {
        if (lines[li].length > 0) document.execCommand('insertText', false, lines[li]);
        if (li < lines.length - 1) {
          input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true }));
          input.dispatchEvent(new KeyboardEvent('keypress', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true }));
          input.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true }));
          await sleep(50);
        }
      }
      await sleep(200);
      if (input.textContent.trim().length > 0 && input.innerHTML.includes('<')) return true;
    } catch (e) {}

    try { document.execCommand('selectAll', false, null); document.execCommand('delete', false, null); } catch (e) {}
    input.innerHTML = '';
    await sleep(150);

    // Method 3: insertParagraph
    try {
      var lines2 = text.split('\n');
      for (var lj = 0; lj < lines2.length; lj++) {
        if (lines2[lj].length > 0) document.execCommand('insertText', false, lines2[lj]);
        if (lj < lines2.length - 1) { document.execCommand('insertParagraph', false, null); await sleep(50); }
      }
      await sleep(200);
      if (input.textContent.trim().length > 0 && input.innerHTML.includes('<')) return true;
    } catch (e) {}

    try { document.execCommand('selectAll', false, null); document.execCommand('delete', false, null); } catch (e) {}
    input.innerHTML = '';
    await sleep(150);

    // Method 4: insertLineBreak
    try {
      var lines3 = text.split('\n');
      for (var lk = 0; lk < lines3.length; lk++) {
        if (lines3[lk].length > 0) document.execCommand('insertText', false, lines3[lk]);
        if (lk < lines3.length - 1) { document.execCommand('insertLineBreak', false, null); await sleep(50); }
      }
      await sleep(200);
      if (input.textContent.trim().length > 0) return true;
    } catch (e) {}

    if (attempt < 2) { log('  Reintento escritura (' + (attempt + 2) + '/3)...', 'warn'); await sleep(1000); }
  }
  return false;
}

async function sendMessage(input) {
  // Method 1: Click Send button
  var allButtons = document.querySelectorAll('div[role="button"], button');
  for (var i = 0; i < allButtons.length; i++) {
    var btn = allButtons[i];
    var btnText = btn.textContent.trim().toLowerCase();
    if (btnText === 'send' || btnText === 'enviar') {
      var style = window.getComputedStyle(btn);
      if (parseFloat(style.opacity) > 0.5) {
        btn.click();
        await sleep(500);
        return input.textContent.trim().length === 0;
      }
    }
  }

  // Method 2: Enter key
  try {
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true }));
    input.dispatchEvent(new KeyboardEvent('keypress', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true }));
    input.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true }));
    await sleep(500);
    return input.textContent.trim().length === 0;
  } catch (e) {
    return false;
  }
}

function checkForPopups() {
  var dialog = document.querySelector('div[role="dialog"]');
  if (dialog) {
    var text = dialog.textContent.toLowerCase();
    if (text.includes('challenge') || text.includes('verify') || text.includes('captcha') || text.includes('security')) {
      return 'captcha';
    }
    if (text.includes('not now') || text.includes('ahora no')) {
      var buttons = dialog.querySelectorAll('button, div[role="button"]');
      for (var i = 0; i < buttons.length; i++) {
        if (/not now|ahora no/i.test(buttons[i].textContent)) {
          buttons[i].click();
        }
      }
      return 'dismissed';
    }
    return 'popup';
  }
  return null;
}

// ============================================================
// MAIN FUNCTION
// ============================================================
async function igDmSender() {
  await loadConfig();
  _stopFlag = false;

  console.log('%c╔══════════════════════════════════════════╗', 'color:#fff');
  console.log('%c║  IG DM AUTOMATOR v2.0                    ║', 'color:#fff;font-weight:bold');
  console.log('%c╚══════════════════════════════════════════╝', 'color:#fff');

  log('Configuración:', 'header');
  log('  Mensaje: "' + _config.message.substring(0, 60) + '..."');
  log('  Personalizado: ' + _config.personalized);
  log('  Delay: ' + _config.delayMin + '-' + _config.delayMax + 'ms');
  log('  Max mensajes: ' + _config.maxMessages);
  log('  Semanas atrás: ' + _config.weeksBack);
  log('  Saltar grupos: ' + _config.skipGroups);
  log('  Dry run: ' + _config.dryRun);

  // Step 1: Scan conversations
  await saveProgress({
    status: 'scanning', total: 0, current: 0, sent: 0, failed: 0,
    errors: [], currentName: '', startedAt: Date.now()
  });

  log('\n[PASO 1] Escaneando conversaciones...', 'header');
  var conversations = await scrollAndCollectConversations();
  log('Encontradas ' + conversations.length + ' conversaciones totales', 'info');

  // Step 2: Filter
  var maxDays = _config.weeksBack * 7;
  var filtered = conversations.filter(function (c) {
    if (c.timeDays > maxDays) return false;
    if (_config.skipGroups && c.isGroup) return false;
    return true;
  });

  log('Filtradas: ' + filtered.length + ' conversaciones en últimas ' + _config.weeksBack + ' semanas', 'success');

  if (filtered.length === 0) {
    log('No hay conversaciones que cumplan los criterios.', 'error');
    await saveProgress({
      status: 'done', total: 0, current: 0, sent: 0, failed: 0,
      errors: [], currentName: '', startedAt: Date.now()
    });
    return { sent: 0, failed: 0 };
  }

  // Step 3: Apply limits
  var maxCount = Math.min(_config.maxMessages, filtered.length);
  var targetConvs = filtered.slice(0, maxCount);

  log('\n[PASO 3] Resumen:', 'header');
  log('  Total a enviar: ' + targetConvs.length, 'info');
  log('  Modo: ' + (_config.dryRun ? 'DRY RUN (no envía)' : 'REAL'), _config.dryRun ? 'warn' : 'info');

  // Preview names if personalized
  if (_config.personalized && targetConvs.length > 0) {
    log('\nVista previa de nombres:', 'info');
    var previewCount = Math.min(5, targetConvs.length);
    for (var p = 0; p < previewCount; p++) {
      log('  ' + (p + 1) + '. "' + targetConvs[p].name + '" → "¡Hey ' + targetConvs[p].firstName + '! 👋"', 'info');
    }
  }

  _pendingConvs = targetConvs;

  // Auto-confirm (popup already confirmed by clicking Start)
  return igDmSender.confirm();
}

// ============================================================
// CONFIRM AND RUN
// ============================================================
igDmSender.confirm = async function () {
  var session = await loadSession();
  var targetConvs, startIndex, sent, failed, errors;

  if (session && session.conversations && session.conversations.length > 0) {
    log('%c🔄 SESIÓN RECUPERADA — reanudando tras recarga de página', 'color:#4CAF50;font-weight:bold');
    targetConvs = session.conversations;
    startIndex = session.currentIndex;
    sent = session.sent;
    failed = session.failed;
    errors = session.errors || [];
    log('  Reanudando desde ' + (startIndex + 1) + '/' + targetConvs.length, 'info');
    log('  Enviados hasta ahora: ' + sent + ', Fallidos: ' + failed, 'info');
  } else {
    targetConvs = _pendingConvs;
    if (!targetConvs || targetConvs.length === 0) {
      log('No hay conversaciones pendientes.', 'error');
      return { sent: 0, failed: 0 };
    }
    startIndex = 0;
    sent = 0;
    failed = 0;
    errors = [];
  }

  var skipped = 0;
  await saveProgress({
    status: 'sending',
    total: targetConvs.length,
    current: startIndex,
    sent: sent,
    failed: failed,
    errors: errors,
    currentName: targetConvs[startIndex] ? targetConvs[startIndex].name : '',
    startedAt: Date.now()
  });

  log('\n[INICIO] Enviando mensajes...', 'header');

  for (var i = startIndex; i < targetConvs.length; i++) {
    if (_stopFlag) {
      log('⏹ STOP detectado. Finalizando después de ' + sent + ' enviados.', 'warn');
      // Keep the session so the user can RESUME later — only Iniciar (fresh) clears it.
      _running = false;
      await saveProgress({
        status: 'stopped',
        total: targetConvs.length,
        current: i,
        sent: sent,
        failed: failed,
        errors: errors,
        currentName: '',
        startedAt: Date.now()
      });
      break;
    }

    var conv = targetConvs[i];
    var progress = '[' + (i + 1) + '/' + targetConvs.length + ']';

    // Persist session after each message (for recovery)
    await saveSession(targetConvs, i, sent, failed, errors);
    await saveProgress({
      status: 'sending',
      total: targetConvs.length,
      current: i,
      sent: sent,
      failed: failed,
      errors: errors,
      currentName: conv.name,
      startedAt: Date.now()
    });

    // Personalize message if enabled
    var msg = _config.personalized
      ? _config.message.replace(/\{nombre\}/g, conv.firstName || 'amigo')
      : _config.message;

    // CAPTCHA check
    var popup = checkForPopups();
    if (popup === 'captcha') {
      log(progress + ' ⚠ CAPTCHA/Challenge detectado. Pausando.', 'error');
      // Keep session (resume-able). Release the running lock so RESUME can re-enter.
      _running = false;
      await saveProgress({
        status: 'paused',
        total: targetConvs.length,
        current: i,
        sent: sent,
        failed: failed,
        errors: errors,
        currentName: conv.name,
        startedAt: Date.now()
      });
      return { sent: sent, failed: failed, paused: true };
    }

    try {
      log(progress + ' Buscando @' + conv.name + '...', 'info');
      var clicked = await findAndClickConversation(conv.name);
      if (!clicked) {
        log(progress + ' No encontrado @' + conv.name + '. Saltando.', 'error');
        failed++;
        errors.push({ name: conv.name, error: 'Not found in list' });
        continue;
      }
      await sleep(2500 + Math.random() * 500);

      var input = await waitForElement('div[role="textbox"][contenteditable="true"]', 5000);
      if (!input) {
        log(progress + ' No se encontró el input. Saltando.', 'error');
        failed++;
        errors.push({ name: conv.name, error: 'No input found' });
        continue;
      }

      var written = await writeMessage(input, msg);
      if (!written || input.textContent.trim().length === 0) {
        log(progress + ' No se pudo escribir. Saltando.', 'error');
        failed++;
        errors.push({ name: conv.name, error: 'Write failed' });
        continue;
      }

      if (_config.dryRun) {
        log(progress + ' 🧪 DRY RUN — escrito a @' + conv.name, 'warn');
        input.textContent = '';
        sent++;
        await sleep(randomDelay());
        continue;
      }

      var sentOk = await sendMessage(input);
      if (sentOk) {
        log(progress + ' ✅ Enviado a @' + conv.name, 'success');
        sent++;
      } else {
        log(progress + ' Reintentando...', 'warn');
        await sleep(1000);
        var retry = await sendMessage(input);
        if (retry) {
          log(progress + ' ✅ Enviado (retry) a @' + conv.name, 'success');
          sent++;
        } else {
          log(progress + ' ❌ Falló envío a @' + conv.name, 'error');
          failed++;
          errors.push({ name: conv.name, error: 'Send failed' });
          input.textContent = '';
        }
      }

      var delay = randomDelay();
      log('  Esperando ' + (delay / 1000).toFixed(1) + 's...', 'info');
      await sleep(delay);
    } catch (err) {
      log(progress + ' Error con @' + conv.name + ': ' + err.message, 'error');
      failed++;
      errors.push({ name: conv.name, error: err.message });
    }
  }

  // ── Done ──
  console.log('%c╔══════════════════════════════════════════╗', 'color:#fff');
  console.log('%c║  RESUMEN FINAL                           ║', 'color:#fff;font-weight:bold;font-size:14px');
  console.log('%c╚══════════════════════════════════════════╝', 'color:#fff');
  log('  Enviados: ' + sent, 'success');
  log('  Fallidos: ' + failed, 'error');
  if (errors.length > 0) {
    log('  Detalle de errores:', 'warn');
    errors.forEach(function (e) { log('    @' + e.name + ': ' + e.error, 'error'); });
  }
  log('\nHecho. ' + sent + ' mensajes enviados.', 'header');

  _running = false;
  await clearSession();
  await saveProgress({
    status: 'done',
    total: targetConvs.length,
    current: targetConvs.length,
    sent: sent,
    failed: failed,
    errors: errors,
    currentName: '',
    startedAt: Date.now()
  });

  _pendingConvs = null;
  if (_resolvePending) {
    _resolvePending({ sent: sent, failed: failed, errors: errors });
    _resolvePending = null;
  }

  return { sent: sent, failed: failed, errors: errors };
};

// ============================================================
// AUTO-RECOVERY ON PAGE LOAD
// ============================================================
// ============================================================
// AUTO-RECOVERY ON PAGE LOAD
// Only auto-resumes if the page was reloaded mid-run. If the user
// explicitly STOPPED, leave it stopped so they can resume manually.
// ============================================================
(async function autoRecover() {
  await sleep(3000);

  try {
    await loadConfig();

    var session = await loadSession();
    if (!session || !session.conversations || session.conversations.length === 0) {
      console.log('%c[IG-DM] ✅ Extensión cargada. Abre el popup y haz clic en Iniciar.', 'color:#4CAF50');
      return;
    }

    // Check the last known status before the reload
    var progData = await chrome.storage.local.get('igDmProgress');
    var lastStatus = (progData.igDmProgress && progData.igDmProgress.status) || 'idle';

    if (lastStatus === 'stopped') {
      console.log('%c[IG-DM] ⏹ Sesión detenida previamente. Usa “Reanudar” en el popup para continuar.', 'color:#FF9800;font-weight:bold');
      return; // intentional stop — do not auto-resume
    }

    // Mid-run reload (crash / Instagram refreshed the page) → auto-resume
    if (lastStatus === 'paused') {
      console.log('%c[IG-DM] ⚠ CAPTCHA pendiente. Resuélvelo y usa “Reanudar” en el popup.', 'color:#FF9800;font-weight:bold');
      return; // wait for user, don't auto-resume into a captcha
    }

    console.log('%c[IG-DM] 🔄 Sesión pendiente detectada. Auto-reanudando en 5s...', 'color:#4CAF50;font-weight:bold');
    console.log('%c[IG-DM] Para CANCELAR, abre el popup y haz clic en Detener', 'color:#FF9800;font-weight:bold');
    await sleep(5000);
    if (!_stopFlag) {
      _running = true;
      igDmSender.confirm().then(function () { _running = false; }).catch(function () { _running = false; });
    }
  } catch (e) {
    console.log('[IG-DM] Error en autoRecover:', e.message);
  }
})();
