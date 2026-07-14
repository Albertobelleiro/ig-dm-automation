// ============================================================
// INSTAGRAM DM AUTOMATION - MODO PRUEBA (DRY RUN)
// NO ENVÍA MENSAJES REALES. Solo escribe y borra.
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
  maxMensajes: 50,
  iniciarDesde: 0,
  semanasAtras: 3,
  saltarGrupos: true,
  dryRun: true,
  maxScrolls: 10,
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

// === PARSE TIMESTAMP TO DAYS ===
function parseTimestampToDays(timeText) {
  if (!timeText) return 999;
  const t = timeText.trim().toLowerCase();

  if (t === 'now' || t === 'active now' || t === 'active') return 0;

  // Order matters: check "mo" (months) before "m" (minutes)
  let mo = t.match(/^(\d+)\s*mo/);
  if (mo) return parseInt(mo[1]) * 30;

  // Minutes
  let m = t.match(/^(\d+)\s*m\b/);
  if (m) return 0;

  // Hours
  let h = t.match(/^(\d+)\s*h/);
  if (h) return 0;

  // Days
  let d = t.match(/^(\d+)\s*d/);
  if (d) return parseInt(d[1]);

  // Weeks
  let w = t.match(/^(\d+)\s*w/);
  if (w) return parseInt(w[1]) * 7;

  // Years
  let y = t.match(/^(\d+)\s*y/);
  if (y) return parseInt(y[1]) * 365;

  return 999;
}

// === DEBUG: Inspect Instagram DOM ===
window.igDmDebug = function () {
  console.log('%c=== IG DM DEBUG ===', 'color:#fff;font-weight:bold;font-size:14px');
  console.log('URL:', window.location.href);

  // Find scrollable container
  const scrollContainer = findScrollContainer();
  console.log('Scroll container:', scrollContainer ? {
    left: Math.round(scrollContainer.getBoundingClientRect().left),
    top: Math.round(scrollContainer.getBoundingClientRect().top),
    scrollHeight: scrollContainer.scrollHeight,
    clientHeight: scrollContainer.clientHeight,
  } : 'NOT FOUND');

  // Find timestamp spans
  const allEls = document.querySelectorAll('span, div, time');
  const timestamps = [];
  for (const el of allEls) {
    const text = el.textContent.trim();
    if (text.length > 0 && text.length < 15) {
      if (/^\d+\s*[mhdw]/i.test(text) || /^now$/i.test(text) || /^active/i.test(text)) {
        const rect = el.getBoundingClientRect();
        timestamps.push({ text, tag: el.tagName, top: Math.round(rect.top), left: Math.round(rect.left) });
      }
    }
  }
  console.log('Timestamps found:', timestamps.length);
  timestamps.slice(0, 20).forEach((t, i) => console.log(`  ${i + 1}.`, t));

  // Find conversation items using new approach
  const items = findConversationItems();
  console.log('Conversation items found:', items.length);
  items.slice(0, 10).forEach((item, i) => {
    const info = extractConvInfo(item);
    console.log(`  ${i + 1}.`, { name: info.name, timestamp: info.timestamp, timeDays: info.timeDays, isGroup: info.isGroup });
  });

  console.log('%c=== END DEBUG ===', 'color:#fff;font-weight:bold;font-size:14px');
};

// === FIND SCROLL CONTAINER ===
function findScrollContainer() {
  const allDivs = document.querySelectorAll('div');

  // Strategy 1: scrollable div in left panel with content
  for (const div of allDivs) {
    const style = window.getComputedStyle(div);
    if (style.overflowY === 'auto' || style.overflowY === 'scroll') {
      if (div.scrollHeight > div.clientHeight) {
        const rect = div.getBoundingClientRect();
        if (rect.left < 500 && rect.height > 200) return div;
      }
    }
  }

  // Strategy 2: any scrollable div in left half
  for (const div of allDivs) {
    const style = window.getComputedStyle(div);
    if (style.overflowY === 'auto' || style.overflowY === 'scroll') {
      if (div.scrollHeight > div.clientHeight && div.clientHeight > 200) {
        const rect = div.getBoundingClientRect();
        if (rect.left < window.innerWidth / 2) return div;
      }
    }
  }

  // Strategy 3: role="list" or role="navigation"
  const containers = document.querySelectorAll('[role="list"], [role="navigation"], [role="listbox"]');
  for (const container of containers) {
    const rect = container.getBoundingClientRect();
    if (rect.left < 500 && rect.height > 200) return container;
  }

  return null;
}

// === CHECK IF ELEMENT IS A NOTE BUBBLE ===
function isNoteBubble(el) {
  const rect = el.getBoundingClientRect();

  // Notes are above the "Mensajes" header (typically top < 270)
  // Use 260 as threshold to be safe
  if (rect.top < 260) return true;

  // Check for horizontal scroll parent (notes scroll horizontally)
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

// === FIND CONVERSATION ITEMS ===
function findConversationItems() {
  const scrollContainer = findScrollContainer();
  if (!scrollContainer) {
    log('No se encontró contenedor de scroll. Ejecuta igDmDebug() para diagnosticar.', 'error');
    return [];
  }

  // Find all timestamp-like elements (spans, divs, time) inside the scroll container
  const allEls = scrollContainer.querySelectorAll('span, div, time');
  const timestampEls = [];

  for (const el of allEls) {
    const text = el.textContent.trim();
    if (text.length === 0 || text.length > 15) continue;

    // Match timestamps: "5m", "2 d", "1h", "3 w", "now", "Active now"
    if (/^\d+\s*[mhdw]/i.test(text) || /^now$/i.test(text) || /^active\s*now$/i.test(text)) {
      const rect = el.getBoundingClientRect();
      if (rect.left < 500 && rect.top > 260) {
        timestampEls.push(el);
      }
    }
  }

  log(`Timestamps encontrados: ${timestampEls.length}`, 'info');

  if (timestampEls.length === 0) {
    log('No se encontraron timestamps. Ejecuta igDmDebug() para diagnosticar.', 'error');
    return [];
  }

  // For each timestamp, walk up to find the conversation item container
  // The conversation item is the element that:
  // 1. Contains the timestamp
  // 2. Is a direct child (or close descendant) of the scroll container
  // 3. Also contains a name (dir="auto" element)
  const items = [];
  const seen = new Set();

  for (const tsEl of timestampEls) {
    let parent = tsEl.parentElement;
    let attempts = 0;

    while (parent && parent !== document.body && attempts < 10) {
      // Check if this parent is the scroll container itself (too broad)
      if (parent === scrollContainer) break;

      // Check if parent is a direct child of scroll container
      if (parent.parentElement === scrollContainer) {
        // Verify it has a name-like element (dir="auto")
        const nameEl = parent.querySelector('[dir="auto"]');
        if (nameEl && !isNoteBubble(parent)) {
          if (!seen.has(parent)) {
            seen.add(parent);
            items.push(parent);
          }
          break;
        }
      }

      // Also check if parent contains dir="auto" and is small enough to be one item
      const parentText = parent.textContent || '';
      if (parentText.length > 5 && parentText.length < 300) {
        const nameEl = parent.querySelector('[dir="auto"]');
        if (nameEl && !isNoteBubble(parent)) {
          const parentRect = parent.getBoundingClientRect();
          if (parentRect.left < 500 && parentRect.top > 260 && parentRect.height < 150) {
            if (!seen.has(parent)) {
              seen.add(parent);
              items.push(parent);
            }
            break;
          }
        }
      }

      parent = parent.parentElement;
      attempts++;
    }
  }

  // Deduplicate: remove items that are children of other items
  const filtered = items.filter((item) => {
    return !items.some((other) => other !== item && other.contains(item));
  });

  log(`findConversationItems: ${filtered.length} conversaciones encontradas`, 'info');
  return filtered;
}

// === EXTRACT CONVERSATION INFO ===
function extractConvInfo(item) {
  const text = item.textContent || '';

  // Extract timestamp
  const timeMatch = text.match(/(\d+\s*[mhdw]|now|active)/i);
  const timestamp = timeMatch ? timeMatch[1] : '';

  // Extract name - usually the first meaningful text line
  // Try to find the name element
  const nameEl = item.querySelector('span, div[dir="auto"]') || item;
  let name = '';

  // Try multiple strategies to get the name
  const spans = item.querySelectorAll('span, div[dir="auto"]');
  for (const span of spans) {
    const spanText = span.textContent.trim();
    if (spanText.length > 0 && spanText.length < 100) {
      // Skip if it looks like a timestamp
      if (!/^\d+\s*[mhdw]/i.test(spanText) && spanText.toLowerCase() !== 'now' && spanText.toLowerCase() !== 'active') {
        name = spanText;
        break;
      }
    }
  }

  // Check if it's a group
  const isGroup = /group|grupo/i.test(text) || text.includes('·') || item.querySelectorAll('img, [style*="border-radius"]').length > 1;

  return {
    name: name || 'unknown',
    timestamp: timestamp,
    timeDays: parseTimestampToDays(timestamp),
    isGroup: isGroup,
    element: item,
  };
}

// === SCROLL CONVERSATION LIST ===
async function scrollConversationList() {
  const scrollContainer = findScrollContainer();

  if (!scrollContainer) {
    log('No se encontró contenedor de scroll. Ejecuta igDmDebug() para diagnosticar.', 'error');
    return;
  }

  log(`Contenedor de scroll encontrado. Iniciando scroll...`, 'info');
  let lastHeight = 0;
  const maxScrolls = IG_DM_CONFIG.maxScrolls || 10;
  for (let i = 0; i < maxScrolls; i++) {
    scrollContainer.scrollTop = scrollContainer.scrollHeight;
    await sleep(1500);
    if (scrollContainer.scrollHeight === lastHeight) break;
    lastHeight = scrollContainer.scrollHeight;
    if (i % 10 === 0 && i > 0) log(`  Scroll ${i}/${maxScrolls}... (${scrollContainer.scrollHeight}px)`, 'info');
  }
  log(`Scroll completado. Altura final: ${scrollContainer.scrollHeight}px`, 'info');
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

  // Step 1: Scroll to load all conversations
  log('\n[PASO 1] Cargando conversaciones...', 'header');
  await scrollConversationList();
  await sleep(1000);

  // Step 2: Find and filter conversations
  log('[PASO 2] Filtrando conversaciones...', 'header');
  let items = findConversationItems();
  log(`Encontradas ${items.length} conversaciones totales`, 'info');

  // Extract info and filter
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
  console.log('%c╔══════════════════════════════════════════════╗', 'color:#FF9800');
  console.log('%c║  IG DM - MODO PRUEBA (DRY RUN)              ║', 'color:#FF9800;font-weight:bold;font-size:13px');
  console.log('%c║  NO ENVÍA MENSAJES REALES                   ║', 'color:#FF9800;font-size:11px');
  console.log('%c╚══════════════════════════════════════════════╝', 'color:#FF9800');
  console.log('%cMáximo: 50 conversaciones. Ejecuta igDmSender() para empezar.', 'color:#4CAF50');
