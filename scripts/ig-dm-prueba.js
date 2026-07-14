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

  // 1. Check URL
  console.log('URL:', window.location.href);

  // 2. Find all elements with role attributes
  const roleEls = document.querySelectorAll('[role]');
  const roles = {};
  roleEls.forEach(el => {
    const r = el.getAttribute('role');
    roles[r] = (roles[r] || 0) + 1;
  });
  console.log('Roles found:', roles);

  // 3. Find scrollable divs
  const allDivs = document.querySelectorAll('div');
  const scrollables = [];
  for (const div of allDivs) {
    const style = window.getComputedStyle(div);
    if (style.overflowY === 'auto' || style.overflowY === 'scroll') {
      if (div.scrollHeight > div.clientHeight) {
        const rect = div.getBoundingClientRect();
        scrollables.push({
          tag: div.tagName,
          role: div.getAttribute('role'),
          class: div.className.substring(0, 60),
          left: Math.round(rect.left),
          top: Math.round(rect.top),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          scrollHeight: div.scrollHeight,
          clientHeight: div.clientHeight,
        });
      }
    }
  }
  console.log('Scrollable containers:', scrollables.length);
  scrollables.forEach((s, i) => console.log(`  ${i + 1}.`, s));

  // 4. Find elements with timestamp-like text
  const timestampEls = [];
  for (const div of allDivs) {
    const text = div.textContent.trim();
    if (text.length > 0 && text.length < 20) {
      if (/^\d+\s*[mhdw]/i.test(text) || /^now$/i.test(text) || /^active/i.test(text)) {
        const rect = div.getBoundingClientRect();
        timestampEls.push({
          text: text,
          tag: div.tagName,
          role: div.getAttribute('role'),
          top: Math.round(rect.top),
          left: Math.round(rect.left),
          parentRole: div.parentElement?.getAttribute('role'),
          parentClass: div.parentElement?.className?.substring(0, 40),
        });
      }
    }
  }
  console.log('Timestamp elements found:', timestampEls.length);
  timestampEls.slice(0, 15).forEach((t, i) => console.log(`  ${i + 1}.`, t));

  // 5. Find contenteditable inputs
  const inputs = document.querySelectorAll('[contenteditable="true"]');
  console.log('Contenteditable inputs:', inputs.length);
  inputs.forEach((el, i) => {
    const rect = el.getBoundingClientRect();
    console.log(`  ${i + 1}.`, {
      role: el.getAttribute('role'),
      ariaLabel: el.getAttribute('aria-label'),
      top: Math.round(rect.top),
      left: Math.round(rect.left),
    });
  });

  // 6. Find elements with dir="auto" (Instagram name containers)
  const dirAutoEls = document.querySelectorAll('[dir="auto"]');
  console.log('Elements with dir="auto":', dirAutoEls.length);
  const nameSamples = [];
  dirAutoEls.forEach(el => {
    const text = el.textContent.trim();
    if (text.length > 1 && text.length < 50) {
      const rect = el.getBoundingClientRect();
      if (rect.left < 400 && rect.top > 100) {
        nameSamples.push({
          text: text,
          tag: el.tagName,
          top: Math.round(rect.top),
          left: Math.round(rect.left),
        });
      }
    }
  });
  console.log('Name-like elements (left side, below notes):', nameSamples.length);
  nameSamples.slice(0, 10).forEach((n, i) => console.log(`  ${i + 1}.`, n));

  console.log('%c=== END DEBUG ===', 'color:#fff;font-weight:bold;font-size:14px');
  console.log('Copia este output y pásamelo para arreglar los selectores.');
};

// === CHECK IF ELEMENT IS A NOTE BUBBLE (not a conversation) ===
function isNoteBubble(el) {
  const rect = el.getBoundingClientRect();
  if (rect.top < 120) return true;

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

  if (rect.height < 60 && rect.width < 80) return true;
  return false;
}

// === FIND CONVERSATION ITEMS ===
function findConversationItems() {
  const allDivs = document.querySelectorAll('div');
  const items = [];

  // Strategy 1: Look for elements with role="listitem" or role="button" that have timestamps
  for (const div of allDivs) {
    const role = div.getAttribute('role');
    if (role === 'listitem' || role === 'button' || role === 'link') {
      const text = div.textContent || '';
      if (text.length > 2 && text.length < 500) {
        const hasTimestamp = /\d+\s*[mhdw]/i.test(text) || /now/i.test(text) || /active/i.test(text);
        if (hasTimestamp) {
          if (isNoteBubble(div)) continue;
          const rect = div.getBoundingClientRect();
          if (rect.top < 120) continue;
          if (rect.left > 500) continue; // Must be in left panel
          items.push(div);
        }
      }
    }
  }

  // Strategy 2: Look for elements with dir="auto" (names) and find their parent containers
  if (items.length === 0) {
    log('Strategy 1 falló. Probando strategy 2 (dir="auto")...', 'warn');
    const nameEls = document.querySelectorAll('[dir="auto"]');
    for (const nameEl of nameEls) {
      const text = nameEl.textContent.trim();
      if (text.length < 1 || text.length > 100) continue;
      // Skip timestamps
      if (/^\d+\s*[mhdw]/i.test(text) || /^now$/i.test(text) || /^active/i.test(text)) continue;
      // Skip message previews
      if (/^(seen|visto)/i.test(text)) continue;

      const rect = nameEl.getBoundingClientRect();
      if (rect.left > 500 || rect.top < 120) continue;

      // Walk up to find the clickable parent container
      let parent = nameEl.parentElement;
      let attempts = 0;
      while (parent && attempts < 8) {
        const parentText = parent.textContent || '';
        const parentRect = parent.getBoundingClientRect();
        // Parent should contain a timestamp and be in the left panel
        if (parentText.length > 5 && parentText.length < 500 &&
            /\d+\s*[mhdw]/i.test(parentText) &&
            parentRect.left < 500 && parentRect.top > 120) {
          if (!isNoteBubble(parent)) {
            items.push(parent);
          }
          break;
        }
        parent = parent.parentElement;
        attempts++;
      }
    }
  }

  // Strategy 3: Look for any div in the left panel with a timestamp and multiple children
  if (items.length === 0) {
    log('Strategy 2 falló. Probando strategy 3 (broad scan)...', 'warn');
    for (const div of allDivs) {
      const text = div.textContent || '';
      if (text.length < 10 || text.length > 500) continue;
      const rect = div.getBoundingClientRect();
      if (rect.left > 500 || rect.top < 120) continue;
      if (div.children.length < 2) continue;

      const hasTimestamp = /\d+\s*[mhdw]/i.test(text) || /now/i.test(text);
      if (hasTimestamp && !isNoteBubble(div)) {
        items.push(div);
      }
    }
  }

  // Deduplicate
  const filtered = items.filter((item) => {
    return !items.some((other) => other !== item && other.contains(item));
  });

  // Final filter
  const cleanItems = filtered.filter((item) => !isNoteBubble(item));

  log(`findConversationItems: ${cleanItems.length} items encontrados`, 'info');
  return cleanItems;
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
  const allDivs = document.querySelectorAll('div');
  let scrollContainer = null;

  // Strategy 1: Find scrollable div in the left panel (overflowY auto/scroll)
  for (const div of allDivs) {
    const style = window.getComputedStyle(div);
    if (style.overflowY === 'auto' || style.overflowY === 'scroll') {
      const text = div.textContent || '';
      if (text.length > 100 && div.scrollHeight > div.clientHeight) {
        const rect = div.getBoundingClientRect();
        if (rect.left < 500) {
          scrollContainer = div;
          break;
        }
      }
    }
  }

  // Strategy 2: Find any scrollable div that contains conversation-like content
  if (!scrollContainer) {
    log('Strategy 1 scroll falló. Probando strategy 2...', 'warn');
    for (const div of allDivs) {
      const style = window.getComputedStyle(div);
      if (style.overflowY === 'auto' || style.overflowY === 'scroll') {
        if (div.scrollHeight > div.clientHeight && div.clientHeight > 200) {
          const rect = div.getBoundingClientRect();
          // Must be in the left half of the screen and have decent height
          if (rect.left < window.innerWidth / 2 && rect.height > 200) {
            scrollContainer = div;
            break;
          }
        }
      }
    }
  }

  // Strategy 3: Look for div with role="list" or role="navigation" that's scrollable
  if (!scrollContainer) {
    log('Strategy 2 scroll falló. Probando strategy 3...', 'warn');
    const containers = document.querySelectorAll('[role="list"], [role="navigation"], [role="listbox"]');
    for (const container of containers) {
      const rect = container.getBoundingClientRect();
      if (rect.left < 500 && rect.height > 200) {
        // Try to scroll it
        container.scrollTop = container.scrollHeight;
        await sleep(100);
        if (container.scrollTop > 0) {
          scrollContainer = container;
          break;
        }
        // Also check if any child is scrollable
        for (const child of container.querySelectorAll('div')) {
          const childStyle = window.getComputedStyle(child);
          if (childStyle.overflowY === 'auto' || childStyle.overflowY === 'scroll') {
            if (child.scrollHeight > child.clientHeight) {
              scrollContainer = child;
              break;
            }
          }
        }
        if (scrollContainer) break;
      }
    }
  }

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
    if (scrollContainer.scrollHeight === lastHeight) {
      break;
    }
    lastHeight = scrollContainer.scrollHeight;
    if (i % 10 === 0 && i > 0) {
      log(`  Scroll ${i}/${maxScrolls}... (${scrollContainer.scrollHeight}px)`, 'info');
    }
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
