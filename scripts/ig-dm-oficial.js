// ============================================================
// INSTAGRAM DM AUTOMATION - MODO OFICIAL (REAL)
// ENVÍA MENSAJES REALES. Úsalo con cuidado.
// Pega en la consola de instagram.com/direct/
// ============================================================

const IG_DM_CONFIG = {
  mensaje: `VIERNES 17 LUAR LA L 🎤🎤
IMAGEN PAGANDO ENTRADA

SÁBADO 18 COWBOY 🤠
TU FIESTA FAVORITA HA LLEGADO.

RECUERDA RESERVAR TU PLAZA.
PULSERA VIP + CONSUMICIÓN
https://chat.whatsapp.com/K6nVfphXdVr5o9DAZInWYu?mode=gi_t`,

  delayMin: 4000,
  delayMax: 6000,
  maxMensajes: 1500,
  iniciarDesde: 0,
  semanasAtras: 3,
  saltarGrupos: true,
  dryRun: false,
  maxScrolls: 100,
};

// === STOP FLAG ===
window._igDmStop = false;
window.stopIGDM = function () {
  window._igDmStop = true;
  console.log('%c[IG-DM] STOP solicitado. Terminará después del mensaje actual.', 'color:#FF9800;font-weight:bold');
};

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

// === DEBUG: Inspect Instagram DOM ===
window.igDmDebug = function () {
  console.log('%c=== IG DM DEBUG ===', 'color:#fff;font-weight:bold;font-size:14px');
  console.log('URL:', window.location.href);
  const threshold = getNotesThreshold();
  console.log('Notes threshold:', threshold);
  const items = findConversationItems();
  console.log('Conversation items found:', items.length);
  for (let i = 0; i < Math.min(15, items.length); i++) {
    const info = extractConvInfo(items[i]);
    console.log(`  ${i + 1}.`, { name: info.name, timestamp: info.timestamp, timeDays: info.timeDays, isGroup: info.isGroup });
  }
  console.log('%c=== END DEBUG ===', 'color:#fff;font-weight:bold;font-size:14px');
};

// === GET NOTES THRESHOLD ===
function getNotesThreshold() {
  const headers = document.querySelectorAll('h1, h2');
  for (const h of headers) {
    const text = h.textContent.trim().toLowerCase();
    if (text === 'mensajes' || text === 'messages') {
      const rect = h.getBoundingClientRect();
      return rect.bottom + 5;
    }
  }
  const sc = findScrollContainer();
  if (sc) return sc.getBoundingClientRect().top - 5;
  return 260;
}

// === CHECK IF ELEMENT IS A NOTE BUBBLE ===
function isNoteBubble(el) {
  const threshold = getNotesThreshold();
  const rect = el.getBoundingClientRect();
  if (rect.top < threshold) return true;
  let parent = el.parentElement;
  while (parent && parent !== document.body) {
    const style = window.getComputedStyle(parent);
    if ((style.overflowX === 'auto' || style.overflowX === 'scroll') &&
        parent.scrollWidth > parent.clientWidth &&
        parent.clientHeight < 120) {
      return true;
    }
    parent = parent.parentElement;
  }
  return false;
}

// === CHECK IF TEXT IS A NAME ===
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

// === CHECK IF ELEMENT CONTAINS A TIMESTAMP ===
function checkHasTimestamp(el) {
  if (el.querySelector('time')) return true;
  const els = el.querySelectorAll('span, div, time, abbr, [dir="auto"]');
  for (const e of els) {
    const text = e.textContent.trim();
    if (text.length === 0 || text.length > 30) continue;
    if (e.children.length > 1) continue;
    if (/^\d+\s*(m|min|h|d|w|sem|mes|mo|y|a)/i.test(text)) return true;
    if (/^(now|active|ahora|activo)/i.test(text)) return true;
  }
  return false;
}

// === FIND SCROLL CONTAINER ===
function findScrollContainer() {
  const allDivs = document.querySelectorAll('div');
  for (const div of allDivs) {
    const style = window.getComputedStyle(div);
    if (style.overflowY === 'auto' || style.overflowY === 'scroll') {
      if (div.scrollHeight > div.clientHeight) {
        const rect = div.getBoundingClientRect();
        if (rect.left < 500 && rect.height > 200) return div;
      }
    }
  }
  for (const div of allDivs) {
    const style = window.getComputedStyle(div);
    if (style.overflowY === 'auto' || style.overflowY === 'scroll') {
      if (div.scrollHeight > div.clientHeight && div.clientHeight > 200) {
        const rect = div.getBoundingClientRect();
        if (rect.left < window.innerWidth / 2) return div;
      }
    }
  }
  return null;
}

// === FIND CONVERSATION ITEMS ===
function findConversationItems() {
  const threshold = getNotesThreshold();
  const allDirAuto = document.querySelectorAll('[dir="auto"]');
  const nameEls = [];

  for (const el of allDirAuto) {
    const text = el.textContent.trim();
    if (!isNameText(text)) continue;
    const rect = el.getBoundingClientRect();
    if (rect.left > 500 || rect.left < 50) continue;
    if (rect.top < threshold) continue;
    nameEls.push(el);
  }

  log(`Nombres candidatos: ${nameEls.length}`, 'info');

  if (nameEls.length === 0) {
    log('No se encontraron nombres. Ejecuta igDmDebug() para diagnosticar.', 'error');
    return [];
  }

  const items = [];
  const seen = new Set();

  for (const nameEl of nameEls) {
    let parent = nameEl.parentElement;
    let attempts = 0;
    while (parent && parent !== document.body && attempts < 15) {
      if (checkHasTimestamp(parent)) {
        const parentRect = parent.getBoundingClientRect();
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

  const filtered = items.filter((item) => {
    return !items.some((other) => other !== item && other.contains(item));
  });

  log(`findConversationItems: ${filtered.length} conversaciones encontradas`, 'info');
  return filtered;
}

// === EXTRACT TIMESTAMP FROM CONVERSATION ITEM ===
function extractTimestamp(item) {
  const timeEl = item.querySelector('time');
  if (timeEl) {
    const datetime = timeEl.getAttribute('datetime') || timeEl.getAttribute('title');
    if (datetime) {
      const date = new Date(datetime);
      if (!isNaN(date)) {
        const now = new Date();
        const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
        return { text: timeEl.textContent.trim(), days: diffDays };
      }
    }
  }

  const allEls = item.querySelectorAll('span, div, time, abbr, [dir="auto"]');
  for (const el of allEls) {
    const text = el.textContent.trim();
    if (text.length === 0 || text.length > 30) continue;
    if (el.children.length > 1) continue;
    const days = parseTimestampToDays(text);
    if (days < 999) return { text, days };
  }

  return { text: '', days: 999 };
}

// === PARSE TIMESTAMP TO DAYS (English + Spanish) ===
function parseTimestampToDays(timeText) {
  if (!timeText) return 999;
  const t = timeText.trim().toLowerCase();

  if (/^(activo|active|now|ahora)/i.test(t)) return 0;
  if (/^(en línea|en linea)/i.test(t)) return 0;

  let activeAgo = t.match(/hace\s*(\d+)\s*(m|min|h|d|w|sem|mes|mo)/);
  if (activeAgo) {
    const num = parseInt(activeAgo[1]);
    const unit = activeAgo[2];
    if (/^m/.test(unit)) return 0;
    if (/^h/.test(unit)) return 0;
    if (/^d/.test(unit)) return num;
    if (/^(w|sem)/.test(unit)) return num * 7;
    if (/^(mo|mes)/.test(unit)) return num * 30;
  }

  let mo = t.match(/^(\d+)\s*(mo|mes|meses)/);
  if (mo) return parseInt(mo[1]) * 30;

  let w = t.match(/^(\d+)\s*(w|sem|semana|semanas)/);
  if (w) return parseInt(w[1]) * 7;

  let d = t.match(/^(\d+)\s*d/);
  if (d) return parseInt(d[1]);

  let h = t.match(/^(\d+)\s*h/);
  if (h) return 0;

  let m = t.match(/^(\d+)\s*(min|minuto|minutos|m)/);
  if (m) return 0;

  let y = t.match(/^(\d+)\s*(y|a|año|años)/);
  if (y) return parseInt(y[1]) * 365;

  return 999;
}

// === EXTRACT CONVERSATION INFO ===
function extractConvInfo(item) {
  const text = item.textContent || '';

  const nameEls = item.querySelectorAll('[dir="auto"]');
  let name = '';
  for (const el of nameEls) {
    const elText = el.textContent.trim();
    if (isNameText(elText)) {
      name = elText;
      break;
    }
  }

  const ts = extractTimestamp(item);

  const isGroup = /group|grupo|\d+\s*(people|personas|miembros|members)/i.test(text);

  return {
    name: name || 'unknown',
    timestamp: ts.text,
    timeDays: ts.days,
    isGroup: isGroup,
    element: item,
  };
}

// === SCROLL AND COLLECT CONVERSATIONS ===
async function scrollAndCollectConversations() {
  const scrollContainer = findScrollContainer();
  if (!scrollContainer) {
    log('No se encontró contenedor de scroll. Ejecuta igDmDebug() para diagnosticar.', 'error');
    return [];
  }

  const threshold = getNotesThreshold();
  const maxDays = IG_DM_CONFIG.semanasAtras * 7;
  const maxScrolls = IG_DM_CONFIG.maxScrolls || 100;
  const collected = new Map();
  let lastScrollTop = -1;
  let stableCount = 0;
  let foundOlder = false;

  log(`Contenedor de scroll encontrado. Iniciando recolección...`, 'info');

  for (let i = 0; i < maxScrolls; i++) {
    const allDirAuto = scrollContainer.querySelectorAll('[dir="auto"]');
    for (const el of allDirAuto) {
      const text = el.textContent.trim();
      if (!isNameText(text)) continue;
      const rect = el.getBoundingClientRect();
      if (rect.left > 500 || rect.left < 50) continue;
      if (rect.top < threshold) continue;
      if (rect.top > window.innerHeight + 200) continue;

      let parent = el.parentElement;
      let attempts = 0;
      while (parent && parent !== document.body && attempts < 15) {
        if (checkHasTimestamp(parent)) {
          const parentRect = parent.getBoundingClientRect();
          if (parentRect.left < 500 && parentRect.height > 30 && parentRect.height < 250) {
            if (!isNoteBubble(parent) && !collected.has(parent)) {
              const info = extractConvInfo(parent);
              collected.set(parent, info);
              if (info.timeDays > maxDays) {
                foundOlder = true;
                log(`  Encontrada conversación antigua: ${info.name} (${info.timestamp}, ${info.timeDays}d) — deteniendo scroll`, 'warn');
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
      log(`Conversación antigua detectada. Scroll detenido en iteración ${i + 1}.`, 'info');
      break;
    }

    scrollContainer.scrollTop = scrollContainer.scrollHeight;
    await sleep(1500);

    if (scrollContainer.scrollTop === lastScrollTop) {
      stableCount++;
      if (stableCount >= 2) {
        log(`Scroll estabilizado. No hay más conversaciones.`, 'info');
        break;
      }
    } else {
      stableCount = 0;
    }
    lastScrollTop = scrollContainer.scrollTop;

    if (i % 10 === 0 && i > 0) log(`  Scroll ${i}/${maxScrolls}... ${collected.size} conversaciones recolectadas`, 'info');
  }

  scrollContainer.scrollTop = 0;
  await sleep(500);

  const items = [...collected.keys()];
  const filtered = items.filter((item) => {
    return !items.some((other) => other !== item && other.contains(item));
  });

  log(`Recolección completada: ${filtered.length} conversaciones totales`, 'info');
  return filtered;
}

// === WRITE MESSAGE INTO CONTENTEDITABLE ===
async function writeMessage(input, text) {
  input.focus();
  await sleep(200);

  // Clear any existing content
  input.textContent = '';

  // Method 1: execCommand insertText (most reliable for Lexical)
  try {
    const success = document.execCommand('insertText', false, text);
    if (success && input.textContent.trim().length > 0) {
      return true;
    }
  } catch (e) {
    // Continue to fallback
  }

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
  } catch (e) {
    // Continue to fallback
  }

  // Method 3: Paste simulation with DataTransfer
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
  } catch (e) {
    // Continue to fallback
  }

  // Method 4: Character by character with execCommand
  try {
    input.focus();
    for (const char of text) {
      document.execCommand('insertText', false, char);
    }
    if (input.textContent.trim().length > 0) {
      return true;
    }
  } catch (e) {
    // All methods failed
  }

  return false;
}

// === SEND MESSAGE ===
async function sendMessage(input) {
  // Method 1: Click Send button
  const allButtons = document.querySelectorAll('div[role="button"], button');
  for (const btn of allButtons) {
    const btnText = btn.textContent.trim().toLowerCase();
    if (btnText === 'send' || btnText === 'enviar') {
      // Check if button is enabled (not disabled/opacity)
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
  // Check for common Instagram popups
  const dialog = document.querySelector('div[role="dialog"]');
  if (dialog) {
    const text = dialog.textContent.toLowerCase();
    if (text.includes('challenge') || text.includes('verify') || text.includes('captcha') || text.includes('security')) {
      return 'captcha';
    }
    if (text.includes('not now') || text.includes('ahora no')) {
      // Try to dismiss
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

// === MAIN FUNCTION ===
async function igDmSender() {
  window._igDmStop = false;

  console.log('%c╔══════════════════════════════════════════╗', 'color:#fff');
  console.log('%c║  INSTAGRAM DM AUTOMATION - GENERIC       ║', 'color:#fff;font-weight:bold');
  console.log('%c╚══════════════════════════════════════════╝', 'color:#fff');

  log(`Configuración:`, 'header');
  log(`  Mensaje: "${IG_DM_CONFIG.mensaje.substring(0, 40)}..."`);
  log(`  Delay: ${IG_DM_CONFIG.delayMin}-${IG_DM_CONFIG.delayMax}ms`);
  log(`  Max mensajes: ${IG_DM_CONFIG.maxMensajes}`);
  log(`  Semanas atrás: ${IG_DM_CONFIG.semanasAtras}`);
  log(`  Saltar grupos: ${IG_DM_CONFIG.saltarGrupos}`);
  log(`  Dry run: ${IG_DM_CONFIG.dryRun}`);
  log(`  Iniciar desde: ${IG_DM_CONFIG.iniciarDesde}`);

  // Step 1+2: Scroll and collect conversations simultaneously
  log('\n[PASO 1] Cargando y filtrando conversaciones...', 'header');
  let items = await scrollAndCollectConversations();
  log(`Encontradas ${items.length} conversaciones totales`, 'info');

  let conversations = items.map(extractConvInfo);
  const maxDays = IG_DM_CONFIG.semanasAtras * 7;

  conversations = conversations.filter((c) => {
    if (c.timeDays > maxDays) return false;
    if (IG_DM_CONFIG.saltarGrupos && c.isGroup) return false;
    return true;
  });

  log(`Filtradas: ${conversations.length} conversaciones en últimas ${IG_DM_CONFIG.semanasAtras} semanas`, 'success');

  if (conversations.length === 0) {
    log('No hay conversaciones que cumplan los criterios. Abortando.', 'error');
    return;
  }

  // Apply start offset
  const startIdx = Math.min(IG_DM_CONFIG.iniciarDesde, conversations.length - 1);
  const maxCount = Math.min(IG_DM_CONFIG.maxMensajes, conversations.length - startIdx);
  const targetConvs = conversations.slice(startIdx, startIdx + maxCount);

  // Step 3: Show summary and wait for confirmation
  log('\n[PASO 3] Resumen:', 'header');
  log(`  Total a enviar: ${targetConvs.length}`, 'info');
  log(`  Modo: ${IG_DM_CONFIG.dryRun ? 'DRY RUN (no envía)' : 'REAL'}`, IG_DM_CONFIG.dryRun ? 'warn' : 'info');
  log(`\nPara confirmar y empezar, ejecuta: igDmSender.confirm()`, 'warn');
  log(`Para cancelar, ejecuta: stopIGDM()`, 'warn');

  // Store for confirmation
  window._igDmPending = targetConvs;

  // Wait for confirmation
  return new Promise((resolve) => {
    window._igDmResolve = resolve;
  });
}

// === CONFIRM AND RUN ===
igDmSender.confirm = async function () {
  const targetConvs = window._igDmPending;
  if (!targetConvs) {
    console.log('%c[IG-DM] No hay envío pendiente. Ejecuta igDmSender() primero.', 'color:#f44336');
    return;
  }

  log('\n[INICIO] Enviando mensajes...', 'header');

  let sent = 0;
  let failed = 0;
  let skipped = 0;
  const errors = [];

  for (let i = 0; i < targetConvs.length; i++) {
    if (window._igDmStop) {
      log(`STOP detectado. Finalizando después de ${sent} mensajes enviados.`, 'warn');
      break;
    }

    const conv = targetConvs[i];
    const progress = `[${i + 1}/${targetConvs.length}]`;

    // Check for popups
    const popup = checkForPopups();
    if (popup === 'captcha') {
      log(`${progress} CAPTCHA/Challenge detectado. Pausando. Resuelve el captcha y ejecuta igDmSender.confirm() de nuevo.`, 'error');
      window._igDmPending = targetConvs.slice(i);
      return;
    }

    try {
      // Click conversation
      log(`${progress} Abriendo conversación con @${conv.name}...`, 'info');
      conv.element.click();
      await sleep(1500 + Math.random() * 500);

      // Find message input
      const input = await waitForElement('div[role="textbox"][contenteditable="true"]', 5000);
      if (!input) {
        log(`${progress} No se encontró el input de mensaje. Saltando.`, 'error');
        failed++;
        errors.push({ name: conv.name, error: 'No input found' });
        continue;
      }

      // Write message
      const written = await writeMessage(input, IG_DM_CONFIG.mensaje);
      if (!written) {
        log(`${progress} No se pudo escribir el mensaje. Saltando.`, 'error');
        failed++;
        errors.push({ name: conv.name, error: 'Write failed' });
        continue;
      }

      // Verify content
      if (input.textContent.trim().length === 0) {
        log(`${progress} El input está vacío después de escribir. Saltando.`, 'error');
        failed++;
        errors.push({ name: conv.name, error: 'Empty after write' });
        continue;
      }

      if (IG_DM_CONFIG.dryRun) {
        log(`${progress} DRY RUN - Mensaje escrito a @${conv.name} (no enviado)`, 'warn');
        // Clear the input so it doesn't accidentally send
        input.textContent = '';
        sent++;
        await sleep(randomDelay());
        continue;
      }

      // Send message
      const sent_ok = await sendMessage(input);
      if (sent_ok) {
        log(`${progress} Enviado a @${conv.name}`, 'success');
        sent++;
      } else {
        log(`${progress} Falló el envío a @${conv.name}. Intentando de nuevo...`, 'warn');
        // Retry once
        await sleep(1000);
        const retry = await sendMessage(input);
        if (retry) {
          log(`${progress} Enviado a @${conv.name} (retry)`, 'success');
          sent++;
        } else {
          log(`${progress} Falló el envío a @${conv.name}. Saltando.`, 'error');
          failed++;
          errors.push({ name: conv.name, error: 'Send failed' });
          // Clear input
          input.textContent = '';
        }
      }

      // Rate limit delay
      const delay = randomDelay();
      log(`  Esperando ${(delay / 1000).toFixed(1)}s...`, 'info');
      await sleep(delay);
    } catch (err) {
      log(`${progress} Error con @${conv.name}: ${err.message}`, 'error');
      failed++;
      errors.push({ name: conv.name, error: err.message });
    }
  }

  // Final summary
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
  log(`\nHecho. ${sent} mensajes enviados en total.`, 'header');

  window._igDmPending = null;
  if (window._igDmResolve) {
    window._igDmResolve({ sent, failed, skipped, errors });
    window._igDmResolve = null;
  }
};

// Auto-start info
  console.log('%c╔══════════════════════════════════════════════╗', 'color:#f44336');
  console.log('%c║  IG DM - MODO OFICIAL (REAL)                ║', 'color:#f44336;font-weight:bold;font-size:13px');
  console.log('%c║  ENVÍA MENSAJES REALES                       ║', 'color:#f44336;font-size:11px');
  console.log('%c╚══════════════════════════════════════════════╝', 'color:#f44336');
  console.log('%cMáximo: 1500 conversaciones. Ejecuta igDmSender() para empezar.', 'color:#4CAF50');
  console.log('%cPara PARAR: stopIGDM()', 'color:#FF9800');
