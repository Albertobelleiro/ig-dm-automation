// ============================================================
// INSTAGRAM DM AUTOMATION - PERSONALIZED WITH NAME
// Paste in browser console at instagram.com/direct/
// Uses {nombre} placeholder in the message
// ============================================================

const IG_DM_CONFIG = {
  mensaje: `¡Hey {nombre}! 👋

VIERNES 17 LUAR LA L 🎤🎤
IMAGEN PAGANDO ENTRADA

SÁBADO 18 COWBOY 🤠
TU FIESTA FAVORITA HA LLEGADO.

RECUERDA RESERVAR TU PLAZA.
PULSERA VIP + CONSUMICIÓN
https://chat.whatsapp.com/K6nVfphXdVr5o9DAZInWYu?mode=gi_t`,

  delayMin: 4000,
  delayMax: 6000,
  maxMensajes: 50,
  iniciarDesde: 0,
  semanasAtras: 3,
  saltarGrupos: true,
  dryRun: false,
};

// === STOP FLAG ===
window._igDmStop = false;
window.stopIGDM = function () {
  window._igDmStop = true;
  sessionStorage.removeItem('igDmSession');
  sessionStorage.removeItem('igDmScript');
  window.onbeforeunload = null;
  console.log('%c[IG-DM] STOP solicitado. Terminará después del mensaje actual.', 'color:#FF9800;font-weight:bold');
};

// === PREVENT PAGE RELOAD ===
window.onbeforeunload = function () {
  if (!window._igDmStop) {
    return 'El script de DMs está corriendo. ¿Seguro que quieres salir?';
  }
};

// === SAVE SCRIPT TO SESSION STORAGE FOR AUTO-RECOVERY ===
try {
  var _scriptSource = '';
  var _funcs = ['sleep', 'randomDelay', 'log', 'waitForElement', 'parseTimestampToDays', 'extractName', 'getFirstName', 'capitalize', 'findConversationItems', 'extractConvInfo', 'scrollConversationList', 'writeMessage', 'sendMessage', 'checkForPopups', 'saveSession', 'loadSession', 'clearSession', 'igDmSender'];
  _scriptSource += 'var IG_DM_CONFIG = ' + JSON.stringify(IG_DM_CONFIG) + ';\n';
  _scriptSource += 'window._igDmStop = false;\n';
  _scriptSource += 'window.stopIGDM = ' + stopIGDM.toString() + ';\n';
  _scriptSource += 'window.onbeforeunload = ' + (window.onbeforeunload ? window.onbeforeunload.toString() : 'null') + ';\n';
  for (var i = 0; i < _funcs.length; i++) {
    try {
      var fn = eval(_funcs[i]);
      if (typeof fn === 'function') {
        _scriptSource += 'var ' + _funcs[i] + ' = ' + fn.toString() + ';\n';
      }
    } catch (e) {}
  }
  if (typeof igDmSender !== 'undefined' && igDmSender.confirm) {
    _scriptSource += 'igDmSender.confirm = ' + igDmSender.confirm.toString() + ';\n';
  }
  _scriptSource += '\n// Auto-resume\n';
  _scriptSource += '(async function autoResume() { await sleep(3000); var session = loadSession(); if (session) { console.log("%c[IG-DM] Sesion pendiente. Auto-reanudando...", "color:#4CAF50;font-weight:bold"); await sleep(5000); if (!window._igDmStop) { igDmSender.confirm(); } } })();\n';
  sessionStorage.setItem('igDmScript', _scriptSource);
  console.log('%c[IG-DM] Script guardado en sessionStorage. La extension lo auto-inyectara tras una recarga.', 'color:#4CAF50');
} catch (e) {
  console.log('[IG-DM] No se pudo guardar el script:', e.message);
}

// === UTILS ===
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function randomDelay() {
  const ms = IG_DM_CONFIG.delayMin + Math.random() * (IG_DM_CONFIG.delayMax - IG_DM_CONFIG.delayMin);
  return Math.round(ms);
}

function log(msg, type = 'info') {
  const colors = {
    info: 'color:#2196F3',
    success: 'color:#4CAF50;font-weight:bold',
    error: 'color:#f44336;font-weight:bold',
    warn: 'color:#FF9800;font-weight:bold',
    header: 'color:#fff;font-size:14px;font-weight:bold',
  };
  const ts = new Date().toLocaleTimeString('es-ES');
  console.log(`%c[${ts}] ${msg}`, colors[type] || colors.info);
}

function waitForElement(selector, timeout = 8000) {
  return new Promise((resolve) => {
    const start = Date.now();
    const check = () => {
      const el = document.querySelector(selector);
      if (el) return resolve(el);
      if (Date.now() - start > timeout) return resolve(null);
      setTimeout(check, 200);
    };
    check();
  });
}

// === PARSE TIMESTAMP TO DAYS ===
function parseTimestampToDays(timeText) {
  if (!timeText) return 999;
  const t = timeText.trim().toLowerCase();

  if (t === 'now' || t === 'active now' || t === 'active') return 0;

  // Order matters: check "mo" (months) before "m" (minutes)
  let mo = t.match(/^(\d+)\s*mo/);
  if (mo) return parseInt(mo[1]) * 30;

  let m = t.match(/^(\d+)\s*m\b/);
  if (m) return 0;

  let h = t.match(/^(\d+)\s*h/);
  if (h) return 0;

  let d = t.match(/^(\d+)\s*d/);
  if (d) return parseInt(d[1]);

  let w = t.match(/^(\d+)\s*w/);
  if (w) return parseInt(w[1]) * 7;

  let y = t.match(/^(\d+)\s*y/);
  if (y) return parseInt(y[1]) * 365;

  return 999;
}

// === EXTRACT NAME FROM CONVERSATION ===
function extractName(item) {
  // Strategy 1: Look for span/div with dir="auto" (Instagram's name containers)
  const nameContainers = item.querySelectorAll('span, div[dir="auto"]');
  for (const el of nameContainers) {
    const text = el.textContent.trim();
    if (text.length > 0 && text.length < 100) {
      // Skip timestamps
      if (!/^\d+\s*[mhdw]/i.test(text) && text.toLowerCase() !== 'now' && text.toLowerCase() !== 'active') {
        // Skip message previews (usually longer or contain specific patterns)
        if (!/^(seen|visto|active|activo)/i.test(text)) {
          return text;
        }
      }
    }
  }

  // Strategy 2: Get the first text node
  const walker = document.createTreeWalker(item, NodeFilter.SHOW_TEXT, null);
  const firstText = walker.nextNode();
  if (firstText) {
    const text = firstText.textContent.trim();
    if (text.length > 0 && text.length < 100) {
      if (!/^\d+\s*[mhdw]/i.test(text) && text.toLowerCase() !== 'now') {
        return text;
      }
    }
  }

  return 'amigo';
}

// === GET FIRST NAME ONLY ===
function getFirstName(fullName) {
  // If it's a username (no spaces, maybe with _), clean it
  if (fullName.includes('_') || (!fullName.includes(' ') && fullName === fullName.toLowerCase())) {
    // It's likely a username like "carlos_garcia" -> "Carlos"
    const cleanName = fullName.replace(/_/g, ' ').trim();
    const firstWord = cleanName.split(' ')[0];
    return capitalize(firstWord);
  }

  // It's a display name like "Carlos García" -> "Carlos"
  const firstWord = fullName.split(' ')[0];
  return capitalize(firstWord);
}

function capitalize(name) {
  if (!name) return 'amigo';
  if (name === name.toUpperCase() && name.length > 1) {
    name = name.charAt(0) + name.slice(1).toLowerCase();
  } else {
    name = name.charAt(0).toUpperCase() + name.slice(1);
  }
  // Handle hyphenated names: "Jean-pierre" → "Jean-Pierre"
  return name.replace(/-(.)/g, (match, char) => '-' + char.toUpperCase());
}

// === FIND CONVERSATION ITEMS ===
function findConversationItems() {
  const allDivs = document.querySelectorAll('div');
  const items = [];

  for (const div of allDivs) {
    const role = div.getAttribute('role');
    if (role === 'listitem' || role === 'button') {
      const text = div.textContent || '';
      if (text.length > 2 && text.length < 500) {
        const hasTimestamp = /\d+\s*[mhdw]/i.test(text) || /now/i.test(text);
        if (hasTimestamp) {
          items.push(div);
        }
      }
    }
  }

  if (items.length === 0) {
    const listContainers = document.querySelectorAll('[role="list"], [role="listbox"], [role="navigation"]');
    for (const container of listContainers) {
      const children = container.querySelectorAll('div');
      for (const child of children) {
        const text = child.textContent || '';
        if (text.length > 2 && text.length < 500) {
          const hasTimestamp = /\d+\s*[mhdw]/i.test(text) || /now/i.test(text);
          if (hasTimestamp && child.children.length >= 2) {
            items.push(child);
            break;
          }
        }
      }
    }
  }

  // Deduplicate
  const filtered = items.filter((item) => {
    return !items.some((other) => other !== item && other.contains(item));
  });

  return filtered;
}

// === EXTRACT CONVERSATION INFO ===
function extractConvInfo(item) {
  const text = item.textContent || '';

  const timeMatch = text.match(/(\d+\s*[mhdw]|now|active)/i);
  const timestamp = timeMatch ? timeMatch[1] : '';

  const fullName = extractName(item);

  const isGroup = /group|grupo/i.test(text) || text.includes('·') || item.querySelectorAll('img, [style*="border-radius"]').length > 1;

  return {
    name: fullName,
    firstName: getFirstName(fullName),
    timestamp: timestamp,
    timeDays: parseTimestampToDays(timestamp),
    isGroup: isGroup,
    element: item,
  };
}

// === SCROLL CONVERSATION LIST ===
async function scrollConversationList() {
  const scrollables = document.querySelectorAll('div');
  let scrollContainer = null;

  for (const div of scrollables) {
    const style = window.getComputedStyle(div);
    if (style.overflowY === 'auto' || style.overflowY === 'scroll') {
      const text = div.textContent || '';
      if (text.length > 100 && div.scrollHeight > div.clientHeight) {
        const rect = div.getBoundingClientRect();
        if (rect.left < 400) {
          scrollContainer = div;
          break;
        }
      }
    }
  }

  if (!scrollContainer) {
    log('No se encontró contenedor de scroll para la lista de conversaciones', 'warn');
    return;
  }

  let lastHeight = 0;
  for (let i = 0; i < 10; i++) {
    scrollContainer.scrollTop = scrollContainer.scrollHeight;
    await sleep(1500);
    if (scrollContainer.scrollHeight === lastHeight) {
      break;
    }
    lastHeight = scrollContainer.scrollHeight;
  }
  log(`Scroll completado. Altura final: ${scrollContainer.scrollHeight}px`, 'info');
}

// === WRITE MESSAGE INTO CONTENTEDITABLE ===
async function writeMessage(input, text) {
  input.focus();
  await sleep(200);

  input.textContent = '';

  // Method 1: execCommand insertText
  try {
    const success = document.execCommand('insertText', false, text);
    if (success && input.textContent.trim().length > 0) {
      return true;
    }
  } catch (e) {}

  // Method 2: textContent + InputEvent
  try {
    input.textContent = text;
    input.dispatchEvent(
      new InputEvent('input', {
        bubbles: true,
        cancelable: true,
        inputType: 'insertText',
        data: text,
      })
    );
    if (input.textContent.trim().length > 0) {
      return true;
    }
  } catch (e) {}

  // Method 3: Paste simulation
  try {
    const dt = new DataTransfer();
    dt.setData('text/plain', text);
    const pasteEvent = new ClipboardEvent('paste', {
      bubbles: true,
      cancelable: true,
      clipboardData: dt,
    });
    input.dispatchEvent(pasteEvent);
    if (input.textContent.trim().length > 0) {
      return true;
    }
  } catch (e) {}

  // Method 4: Character by character
  try {
    input.focus();
    for (const char of text) {
      document.execCommand('insertText', false, char);
    }
    if (input.textContent.trim().length > 0) {
      return true;
    }
  } catch (e) {}

  return false;
}

// === SEND MESSAGE ===
async function sendMessage(input) {
  // Method 1: Click Send button
  const allButtons = document.querySelectorAll('div[role="button"], button');
  for (const btn of allButtons) {
    const btnText = btn.textContent.trim().toLowerCase();
    if (btnText === 'send' || btnText === 'enviar') {
      const style = window.getComputedStyle(btn);
      if (parseFloat(style.opacity) > 0.5) {
        btn.click();
        await sleep(500);
        return input.textContent.trim().length === 0;
      }
    }
  }

  // Method 2: Simulate Enter key
  try {
    input.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Enter',
        code: 'Enter',
        keyCode: 13,
        which: 13,
        bubbles: true,
        cancelable: true,
      })
    );
    input.dispatchEvent(
      new KeyboardEvent('keypress', {
        key: 'Enter',
        code: 'Enter',
        keyCode: 13,
        which: 13,
        bubbles: true,
        cancelable: true,
      })
    );
    input.dispatchEvent(
      new KeyboardEvent('keyup', {
        key: 'Enter',
        code: 'Enter',
        keyCode: 13,
        which: 13,
        bubbles: true,
        cancelable: true,
      })
    );
    await sleep(500);
    return input.textContent.trim().length === 0;
  } catch (e) {
    return false;
  }
}

// === CHECK FOR POPUPS ===
function checkForPopups() {
  const dialog = document.querySelector('div[role="dialog"]');
  if (dialog) {
    const text = dialog.textContent.toLowerCase();
    if (text.includes('challenge') || text.includes('verify') || text.includes('captcha') || text.includes('security')) {
      return 'captcha';
    }
    if (text.includes('not now') || text.includes('ahora no')) {
      const notNow = [...dialog.querySelectorAll('button, div[role="button"]')].find((b) =>
        /not now|ahora no/i.test(b.textContent)
      );
      if (notNow) notNow.click();
      return 'dismissed';
    }
    return 'popup';
  }
  return null;
}

// === SESSION PERSISTENCE ===
function saveSession(targetConvs, currentIndex, sent, failed, errors) {
  sessionStorage.setItem('igDmSession', JSON.stringify({
    conversations: targetConvs,
    currentIndex: currentIndex,
    sent: sent,
    failed: failed,
    errors: errors,
    timestamp: Date.now(),
  }));
}

function loadSession() {
  var data = sessionStorage.getItem('igDmSession');
  if (!data) return null;
  try { return JSON.parse(data); } catch (e) { return null; }
}

function clearSession() {
  sessionStorage.removeItem('igDmSession');
}

// === MAIN FUNCTION ===
async function igDmSender() {
  window._igDmStop = false;

  console.log('%c╔══════════════════════════════════════════════════╗', 'color:#fff');
  console.log('%c║  INSTAGRAM DM AUTOMATION - PERSONALIZED MESSAGE ║', 'color:#fff;font-weight:bold');
  console.log('%c╚══════════════════════════════════════════════════╝', 'color:#fff');

  log(`Configuración:`, 'header');
  log(`  Mensaje: "${IG_DM_CONFIG.mensaje.substring(0, 50)}..."`);
  log(`  Placeholder: {nombre} será reemplazado por el primer nombre del contacto`);
  log(`  Delay: ${IG_DM_CONFIG.delayMin}-${IG_DM_CONFIG.delayMax}ms`);
  log(`  Max mensajes: ${IG_DM_CONFIG.maxMensajes}`);
  log(`  Semanas atrás: ${IG_DM_CONFIG.semanasAtras}`);
  log(`  Saltar grupos: ${IG_DM_CONFIG.saltarGrupos}`);
  log(`  Dry run: ${IG_DM_CONFIG.dryRun}`);
  log(`  Iniciar desde: ${IG_DM_CONFIG.iniciarDesde}`);

  // Step 1: Scroll to load all conversations
  log('\n[PASO 1] Cargando conversaciones...', 'header');
  await scrollConversationList();
  await sleep(1000);

  // Step 2: Find and filter conversations
  log('[PASO 2] Filtrando conversaciones...', 'header');
  let items = findConversationItems();
  log(`Encontradas ${items.length} conversaciones totales`, 'info');

  let conversations = items.map(extractConvInfo);
  const maxDays = IG_DM_CONFIG.semanasAtras * 7;

  conversations = conversations.filter((c) => {
    if (c.timeDays > maxDays) return false;
    if (IG_DM_CONFIG.saltarGrupos && c.isGroup) return false;
    return true;
  });

  log(`Filtradas: ${conversations.length} conversaciones en últimas ${IG_DM_CONFIG.semanasAtras} semanas`, 'success');

  // Show name extraction preview
  if (conversations.length > 0) {
    log('\nVista previa de nombres extraídos:', 'info');
    conversations.slice(0, 10).forEach((c, i) => {
      log(`  ${i + 1}. "${c.name}" → "¡Hey ${c.firstName}! 👋"`, 'info');
    });
    if (conversations.length > 10) {
      log(`  ... y ${conversations.length - 10} más`, 'info');
    }
  }

  if (conversations.length === 0) {
    log('No hay conversaciones que cumplan los criterios. Abortando.', 'error');
    return;
  }

  const startIdx = Math.min(IG_DM_CONFIG.iniciarDesde, conversations.length - 1);
  const maxCount = Math.min(IG_DM_CONFIG.maxMensajes, conversations.length - startIdx);
  const targetConvs = conversations.slice(startIdx, startIdx + maxCount);

  log('\n[PASO 3] Resumen:', 'header');
  log(`  Total a enviar: ${targetConvs.length}`, 'info');
  log(`  Modo: ${IG_DM_CONFIG.dryRun ? 'DRY RUN (no envía)' : 'REAL'}`, IG_DM_CONFIG.dryRun ? 'warn' : 'info');
  log(`\nPara confirmar y empezar, ejecuta: igDmSender.confirm()`, 'warn');
  log(`Para cancelar, ejecuta: stopIGDM()`, 'warn');

  window._igDmPending = targetConvs;

  return new Promise((resolve) => {
    window._igDmResolve = resolve;
  });
}

// === CONFIRM AND RUN ===
igDmSender.confirm = async function () {
  var existingSession = loadSession();
  var targetConvs, startIndex, sent, failed, errors;

  if (existingSession && !window._igDmPending) {
    log('%c🔄 SESIÓN RECUPERADA — reanudando tras recarga de página', 'color:#4CAF50;font-weight:bold');
    targetConvs = existingSession.conversations;
    startIndex = existingSession.currentIndex;
    sent = existingSession.sent;
    failed = existingSession.failed;
    errors = existingSession.errors || [];
    log('  Reanudando desde ' + (startIndex + 1) + '/' + targetConvs.length, 'info');
    log('  Enviados hasta ahora: ' + sent + ', Fallidos: ' + failed, 'info');
  } else {
    targetConvs = window._igDmPending;
    if (!targetConvs) {
      console.log('%c[IG-DM] No hay envío pendiente. Ejecuta igDmSender() primero.', 'color:#f44336');
      return;
    }
    startIndex = 0;
    sent = 0;
    failed = 0;
    errors = [];
  }

  var skipped = 0;

  log('\n[INICIO] Enviando mensajes personalizados...', 'header');

  for (var i = startIndex; i < targetConvs.length; i++) {
    if (window._igDmStop) {
      log(`STOP detectado. Finalizando después de ${sent} mensajes enviados.`, 'warn');
      break;
    }

    const conv = targetConvs[i];
    const progress = `[${i + 1}/${targetConvs.length}]`;

    // Persist progress after each message (so recovery can resume)
    saveSession(targetConvs, i, sent, failed, errors);

    // Personalize message
    const personalizedMsg = IG_DM_CONFIG.mensaje.replace(/\{nombre\}/g, conv.firstName);

    const popup = checkForPopups();
    if (popup === 'captcha') {
      log(`${progress} CAPTCHA/Challenge detectado. Pausando. Resuelve y ejecuta igDmSender.confirm() de nuevo.`, 'error');
      saveSession(targetConvs, i, sent, failed, errors);
      window._igDmPending = targetConvs.slice(i);
      return;
    }

    try {
      log(`${progress} Abriendo conversación con @${conv.name} (Hola ${conv.firstName}!)...`, 'info');
      conv.element.click();
      await sleep(1500 + Math.random() * 500);

      const input = await waitForElement('div[role="textbox"][contenteditable="true"]', 5000);
      if (!input) {
        log(`${progress} No se encontró el input. Saltando.`, 'error');
        failed++;
        errors.push({ name: conv.name, error: 'No input found' });
        continue;
      }

      const written = await writeMessage(input, personalizedMsg);
      if (!written) {
        log(`${progress} No se pudo escribir. Saltando.`, 'error');
        failed++;
        errors.push({ name: conv.name, error: 'Write failed' });
        continue;
      }

      if (input.textContent.trim().length === 0) {
        log(`${progress} Input vacío después de escribir. Saltando.`, 'error');
        failed++;
        errors.push({ name: conv.name, error: 'Empty after write' });
        continue;
      }

      if (IG_DM_CONFIG.dryRun) {
        log(`${progress} DRY RUN - Mensaje escrito a @${conv.name}: "${personalizedMsg.substring(0, 40)}..."`, 'warn');
        input.textContent = '';
        sent++;
        await sleep(randomDelay());
        continue;
      }

      const sent_ok = await sendMessage(input);
      if (sent_ok) {
        log(`${progress} Enviado a @${conv.name} (${conv.firstName})`, 'success');
        sent++;
      } else {
        log(`${progress} Falló envío a @${conv.name}. Reintentando...`, 'warn');
        await sleep(1000);
        const retry = await sendMessage(input);
        if (retry) {
          log(`${progress} Enviado a @${conv.name} (retry)`, 'success');
          sent++;
        } else {
          log(`${progress} Falló envío a @${conv.name}. Saltando.`, 'error');
          failed++;
          errors.push({ name: conv.name, error: 'Send failed' });
          input.textContent = '';
        }
      }

      const delay = randomDelay();
      log(`  Esperando ${(delay / 1000).toFixed(1)}s...`, 'info');
      await sleep(delay);
    } catch (err) {
      log(`${progress} Error con @${conv.name}: ${err.message}`, 'error');
      failed++;
      errors.push({ name: conv.name, error: err.message });
    }
  }

  console.log('%c╔══════════════════════════════════════════╗', 'color:#fff');
  console.log('%c║  RESUMEN FINAL                           ║', 'color:#fff;font-weight:bold;font-size:14px');
  console.log('%c╚══════════════════════════════════════════╝', 'color:#fff');
  log(`  Enviados: ${sent}`, 'success');
  log(`  Fallidos: ${failed}`, 'error');
  log(`  Saltados: ${skipped}`, 'warn');
  if (errors.length > 0) {
    log(`  Detalle de errores:`, 'warn');
    errors.forEach((e) => log(`    @${e.name}: ${e.error}`, 'error'));
  }
  log(`\nHecho. ${sent} mensajes personalizados enviados.`, 'header');

  clearSession();
  window._igDmPending = null;
  if (window._igDmResolve) {
    window._igDmResolve({ sent, failed, skipped, errors });
    window._igDmResolve = null;
  }
};

// === AUTO-RESUME CHECK ===
(async function autoResume() {
  await sleep(3000);
  var session = loadSession();
  if (session) {
    console.log('%c[IG-DM] Sesión pendiente detectada. Auto-reanudando en 5 segundos...', 'color:#4CAF50;font-weight:bold');
    console.log('%c[IG-DM] Para CANCELAR, ejecuta: stopIGDM()', 'color:#FF9800;font-weight:bold');
    await sleep(5000);
    if (!window._igDmStop) {
      igDmSender.confirm();
    }
  }
})();

console.log('%c╔══════════════════════════════════════════════════════╗', 'color:#fff');
console.log('%c║  INSTAGRAM DM AUTOMATION - PERSONALIZED WITH NAME   ║', 'color:#fff;font-weight:bold;font-size:13px');
console.log('%c╚══════════════════════════════════════════════════════╝', 'color:#fff');
console.log('%cUsa {nombre} en el mensaje como placeholder.', 'color:#FF9800');
console.log('%cEjemplo: "¡Hey {nombre}! Este viernes..."', 'color:#888');
console.log('%cEjecuta igDmSender() para empezar.', 'color:#4CAF50');
