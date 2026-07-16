# IG DM Automation — Complete Extension with UI

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a full-featured Chrome extension (Manifest V3) that automates Instagram DM sending with a beautiful popup UI for configuration, automatic script injection, real-time progress tracking, and session recovery.

**Architecture:** Three-layer MV3 extension. **Popup** (UI layer) for configuration and progress display. **Content script** (ISOLATED world) for DOM automation on instagram.com/direct/* — reads config from chrome.storage, sends DMs via DOM manipulation, reports progress. **Service worker** (lightweight) for install/update handling. Communication via `chrome.storage.local` for state + `chrome.runtime.sendMessage` for commands (START/STOP).

**Tech Stack:** Vanilla JS (no framework needed), CSS custom properties, Chrome Extension APIs (storage, runtime, tabs, action). Manifest V3.

**Design tokens:** Dark theme, Inter/system font stack, 8px spacing scale, layered shadows, CSS animations under 200ms, 400px popup width.

---

## File Structure

```
ig-dm-extension/
├── manifest.json              # MV3 manifest: permissions, content_scripts, action, icons
├── icons/                     # Extension icons (16/48/128)
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── background/
│   └── service-worker.js      # Install handler, message relay fallback
├── content/
│   └── content.js             # Full DM engine: reads config, sends DMs, reports progress, recovery
├── popup/
│   ├── popup.html             # Popup structure
│   ├── popup.js               # Popup logic: form binding, Start/Stop, progress polling
│   └── popup.css              # All styling
└── core/
    ├── defaults.js             # Default configuration constants
    └── storage.js              # chrome.storage.local wrappers (getConfig, setConfig, getProgress, etc.)
```

**Total: 11 files** (3 icons + 8 source files). No build step. No dependencies.

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────┐
│  POPUP (popup.html + popup.js + popup.css)          │
│  • Form: message, delays, filters, mode             │
│  • Button: Start / Stop                             │
│  • Progress: sent / failed / remaining / status     │
│  • Reads/Writes chrome.storage.local                │
│  • Sends START/STOP commands via tabs.sendMessage   │
└──────────┬──────────────────────────┬───────────────┘
           │ chrome.storage.local      │ chrome.tabs.sendMessage
           ▼                           ▼
┌──────────────────────┐    ┌──────────────────────────┐
│  SERVICE WORKER      │    │  CONTENT SCRIPT           │
│  service-worker.js   │    │  content.js               │
│  • onInstalled       │    │  (injected at             │
│  • setDefaultConfig  │    │   instagram.com/direct/*) │
│                      │    │                            │
└──────────────────────┘    │  • Reads config from       │
                             │    chrome.storage.local    │
                             │  • Listens for START/STOP  │
                             │  • Runs DM automation      │
                             │  • Writes progress to      │
                             │    chrome.storage.local    │
                             │  • Auto-recovers session   │
                             │  • Handles CAPTCHA pause   │
                             │  • Supports dry-run        │
                             │  • Supports {nombre}       │
                             └────────────────────────────┘
```

**Data flow:**
1. User opens popup → popup reads config from `chrome.storage.local`
2. User edits config in popup → saved to `chrome.storage.local` on change
3. User clicks "Start" → popup sends `{ action: 'START' }` via `chrome.tabs.sendMessage` to content script
4. Content script reads config from `chrome.storage.local`, starts sending
5. Content script writes progress to `chrome.storage.local` after each message
6. Popup polls `chrome.storage.local` every 500ms to update progress display
7. User clicks "Stop" → popup sends `{ action: 'STOP' }`, content script stops gracefully
8. If page reloads: content script re-injects, checks for saved session in storage, auto-resumes

---

## Configuration Schema (stored in chrome.storage.local)

```javascript
// Key: 'igDmConfig'
{
  message: "¡Hey {nombre}! 👋\n\nVIERNES 17 LUAR LA L 🎤🎤\n...",
  personalized: true,        // Enable {nombre} placeholder
  delayMin: 4000,            // ms
  delayMax: 6000,            // ms
  maxMessages: 1500,         // Safety limit
  weeksBack: 3,              // Filter conversations older than N weeks
  skipGroups: true,          // Skip group chats
  dryRun: false,             // Write but don't send
  maxScrolls: 100,           // Max scroll iterations for collecting conversations
}

// Key: 'igDmProgress'
{
  status: 'idle',            // 'idle' | 'scanning' | 'sending' | 'paused' | 'stopped' | 'done'
  total: 0,                  // Total conversations to send
  current: 0,                // Current index
  sent: 0,
  failed: 0,
  errors: [],                // [{ name, error }]
  currentName: '',           // Currently sending to
  startedAt: null,           // Timestamp
}

// Key: 'igDmSession'
{
  conversations: [],         // [{ name, firstName, timestamp, timeDays, isGroup }]
  currentIndex: 0,
  sent: 0,
  failed: 0,
  errors: [],
}
```

---

## UI Design (Popup)

```
┌──────────────────────────────────────┐
│  🔥 IG DM Automator                  │  ← Header with gradient text
│  ─────────────────────────────────── │
│                                       │
│  📝 Mensaje                          │
│  ┌──────────────────────────────────┐│
│  │ ¡Hey {nombre}! 👋                ││  ← Textarea, 4 rows
│  │                                  ││
│  │ VIERNES 17 LUAR LA L 🎤🎤       ││
│  │ ...                              ││
│  └──────────────────────────────────┘│
│  ☐ Personalizado ({nombre})          │  ← Checkbox
│                                       │
│  ⚙️ Configuración                    │
│  ┌──────────────────────────────────┐│
│  │ Delay: [4000] — [6000] ms       ││  ← Two number inputs side by side
│  │ Max mensajes: [1500]             ││  ← Number input
│  │ Semanas atrás: [3]               ││  ← Number input
│  │ ☐ Saltar grupos                  ││  ← Checkbox
│  │ ☐ Dry run (no enviar)            ││  ← Checkbox
│  └──────────────────────────────────┘│
│                                       │
│  ┌──────────────────────────────────┐│
│  │  Estado: ● Listo                 ││  ← Status indicator with dot
│  │  Progreso: 45/200 (22%)          ││  ← Progress bar + text
│  │  ████████░░░░░░░░░░              ││
│  │  Enviados: 42  Fallidos: 3       ││
│  │  Actual: @carlos_garcia          ││  ← Current recipient
│  └──────────────────────────────────┘│
│                                       │
│  ┌────────────┐  ┌─────────────────┐ │
│  │ ▶ Iniciar  │  │  ⏹ Detener     │ │  ← Primary + Danger buttons
│  └────────────┘  └─────────────────┘ │
│                                       │
│  ─────────────────────────────────── │
│  v1.0 · Instagram DM Automator       │  ← Footer
└──────────────────────────────────────┘
```

**UI/UX rules applied (from @userinterface-wiki):**
- `visual-layered-shadows`: Cards use multi-layer shadows
- `visual-concentric-radius`: Outer card 12px, inner inputs 8px
- `visual-consistent-spacing-scale`: 8px base grid (4, 8, 12, 16, 24, 32)
- `duration-press-hover`: Buttons 150ms transition
- `easing-entrance-ease-out`: Status changes use ease-out
- `ux-doherty-under-400ms`: Progress polling at 500ms
- `ux-progressive-disclosure`: Advanced settings collapsed by default
- `type-tabular-nums-for-data`: Progress numbers use tabular-nums
- `visual-no-pure-black-shadow`: Shadows use rgba with tint
- `ux-fitts-target-size`: All interactive elements ≥ 32px height

---

## Tasks

### Task 0: Setup directory structure and icons

**Files:**
- Create: `ig-dm-extension/icons/` directory
- Create: `ig-dm-extension/background/` directory
- Create: `ig-dm-extension/content/` directory
- Create: `ig-dm-extension/popup/` directory
- Create: `ig-dm-extension/core/` directory
- Create: `ig-dm-extension/icons/icon16.png`
- Create: `ig-dm-extension/icons/icon48.png`
- Create: `ig-dm-extension/icons/icon128.png`

- [ ] **Step 1: Create directory structure**

```bash
mkdir -p ig-dm-extension/{icons,background,content,popup,core}
```

- [ ] **Step 2: Generate simple PNG icons (solid color placeholder)**

Use a script or manual creation. For now, create a simple SVG-to-PNG or use a base64-encoded minimal placeholder. Alternatively, generate via:

```bash
# Create minimal 16x16 PNG placeholder (purple gradient square)
# We'll use a Node script to generate these
node -e "
const fs = require('fs');
// Minimal valid PNG: 16x16 purple pixel
// For development, we can use a data URI approach or skip
// and just ensure manifest references exist
console.log('Icons placeholder — will be created with real icons in Task 10');
"
```

- [ ] **Step 3: Verify structure**

```bash
ls -la ig-dm-extension/icons/ ig-dm-extension/background/ ig-dm-extension/content/ ig-dm-extension/popup/ ig-dm-extension/core/
```

- [ ] **Step 4: Commit**

```bash
git add ig-dm-extension/
git commit -m "chore: scaffold extension directory structure"
```

---

### Task 1: Default configuration module

**Files:**
- Create: `ig-dm-extension/core/defaults.js`

- [ ] **Step 1: Write defaults.js**

```javascript
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
```

- [ ] **Step 2: Commit**

```bash
git add ig-dm-extension/core/defaults.js
git commit -m "feat: add default configuration module"
```

---

### Task 2: Storage helper module

**Files:**
- Create: `ig-dm-extension/core/storage.js`

- [ ] **Step 1: Write storage.js**

```javascript
// chrome.storage.local wrappers for IG DM Automator
// Keys: 'igDmConfig', 'igDmProgress', 'igDmSession'

var Storage = {
  // ── Config ──
  getConfig: function () {
    return chrome.storage.local.get('igDmConfig').then(function (data) {
      return data.igDmConfig || null;
    });
  },

  setConfig: function (config) {
    return chrome.storage.local.set({ igDmConfig: config });
  },

  // ── Progress ──
  getProgress: function () {
    return chrome.storage.local.get('igDmProgress').then(function (data) {
      return data.igDmProgress || null;
    });
  },

  setProgress: function (progress) {
    return chrome.storage.local.set({ igDmProgress: progress });
  },

  // ── Session (recovery) ──
  getSession: function () {
    return chrome.storage.local.get('igDmSession').then(function (data) {
      return data.igDmSession || null;
    });
  },

  setSession: function (session) {
    return chrome.storage.local.set({ igDmSession: session });
  },

  clearSession: function () {
    return chrome.storage.local.remove('igDmSession');
  },

  // ── Initialize defaults ──
  initDefaults: function () {
    return chrome.storage.local.get(['igDmConfig', 'igDmProgress']).then(function (data) {
      var promises = [];
      if (!data.igDmConfig) {
        promises.push(chrome.storage.local.set({ igDmConfig: DEFAULTS }));
      }
      if (!data.igDmProgress) {
        promises.push(chrome.storage.local.set({ igDmProgress: DEFAULT_PROGRESS }));
      }
      return Promise.all(promises);
    });
  }
};
```

- [ ] **Step 2: Commit**

```bash
git add ig-dm-extension/core/storage.js
git commit -m "feat: add chrome.storage helper module"
```

---

### Task 3: Manifest v3 with full permissions

**Files:**
- Modify: `ig-dm-extension/manifest.json` (rewrite)

- [ ] **Step 1: Rewrite manifest.json**

```json
{
  "manifest_version": 3,
  "name": "IG DM Automator",
  "version": "2.0",
  "description": "Automatiza el envío de mensajes directos en Instagram. Configura mensaje, delays, filtros y controla el progreso desde un popup.",
  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  },
  "permissions": [
    "storage",
    "tabs"
  ],
  "host_permissions": [
    "https://www.instagram.com/*",
    "https://instagram.com/*"
  ],
  "background": {
    "service_worker": "background/service-worker.js"
  },
  "content_scripts": [
    {
      "matches": [
        "https://www.instagram.com/direct/*",
        "https://instagram.com/direct/*"
      ],
      "js": ["core/defaults.js", "core/storage.js", "content/content.js"],
      "run_at": "document_idle"
    }
  ],
  "action": {
    "default_title": "IG DM Automator",
    "default_popup": "popup/popup.html",
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  },
  "web_accessible_resources": [
    {
      "resources": ["core/*"],
      "matches": ["https://www.instagram.com/*", "https://instagram.com/*"]
    }
  ]
}
```

- [ ] **Step 2: Remove old content.js reference** (we'll rewrite it in Task 4)

- [ ] **Step 3: Commit**

```bash
git add ig-dm-extension/manifest.json
git commit -m "feat: manifest v2.0 with storage, tabs permissions and popup action"
```

---

### Task 4: Content script — DM engine (core logic)

This is the largest task. We port the full DM automation from `scripts/ig-dm-oficial.js` into the content script, adapted to read config from `chrome.storage`, report progress via `chrome.storage`, and listen for START/STOP commands.

**Files:**
- Create: `ig-dm-extension/content/content.js`
- Modify: `ig-dm-extension/content.js` → DELETE (replaced by content/content.js)

- [ ] **Step 1: Delete old content.js**

```bash
rm ig-dm-extension/content.js
```

- [ ] **Step 2: Write content.js — Section A: Module scaffold + config reading**

```javascript
// ============================================================
// IG DM Automator — Content Script
// Runs on instagram.com/direct/* (ISOLATED world)
// Reads config from chrome.storage, manipulates Instagram DOM,
// reports progress back via chrome.storage
// ============================================================

// ── Global state ──
var _stopFlag = false;
var _config = null;
var _pendingConvs = null;
var _resolvePending = null;

// ── Load config from storage ──
async function loadConfig() {
  var data = await chrome.storage.local.get('igDmConfig');
  _config = data.igDmConfig || DEFAULTS;
  return _config;
}

// ── Save progress to storage ──
async function saveProgress(progress) {
  await chrome.storage.local.set({ igDmProgress: progress });
  // Also notify popup if open
  try { chrome.runtime.sendMessage({ action: 'PROGRESS', progress: progress }); } catch (e) {}
}

// ── Save session for recovery ──
async function saveSession(conversations, currentIndex, sent, failed, errors) {
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
}

// ── Load session ──
async function loadSession() {
  var data = await chrome.storage.local.get('igDmSession');
  return data.igDmSession || null;
}

async function clearSession() {
  await chrome.storage.local.remove('igDmSession');
}

// ── Message listener: START / STOP from popup ──
chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
  if (msg.action === 'START') {
    _stopFlag = false;
    igDmSender().then(function (result) {
      sendResponse(result || { sent: 0, failed: 0 });
    });
    return true; // async response
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
```

- [ ] **Step 3: Write content.js — Section B: Utilities (sleep, log, randomDelay, waitForElement)**

```javascript
// ── Utilities ──
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
```

- [ ] **Step 4: Write content.js — Section C: DOM inspection (getNotesThreshold, isNoteBubble, isNameText, checkHasTimestamp, findScrollContainer)**

```javascript
// ── DOM Inspection ──
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
```

- [ ] **Step 5: Write content.js — Section D: Conversation extraction + filtering**

Port `findConversationItems`, `extractTimestamp`, `parseTimestampToDays`, `extractConvInfo`, `scrollAndCollectConversations` from `ig-dm-oficial.js`, adapted to use `_config` instead of `IG_DM_CONFIG`. Keep all the filtering logic identical.

- [ ] **Step 6: Write content.js — Section E: Name extraction (personalized mode)**

Port `extractName`, `getFirstName`, `capitalize` from `ig-dm-personalized.js`. These run only if `_config.personalized` is true.

- [ ] **Step 7: Write content.js — Section F: Click conversation + write message + send**

Port `findAndClickConversation`, `writeMessage`, `sendMessage`, `checkForPopups` from `ig-dm-oficial.js`. The `writeMessage` function supports multi-line messages with all 4 fallback methods.

- [ ] **Step 8: Write content.js — Section G: Main igDmSender + igDmSender.confirm**

```javascript
// ── Main function ──
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
  await saveProgress({ status: 'scanning', total: 0, current: 0, sent: 0, failed: 0, errors: [], currentName: '', startedAt: Date.now() });

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
    await saveProgress({ status: 'done', total: 0, current: 0, sent: 0, failed: 0, errors: [], currentName: '', startedAt: Date.now() });
    return { sent: 0, failed: 0 };
  }

  // Step 3: Apply limits
  var maxCount = Math.min(_config.maxMessages, filtered.length);
  var targetConvs = filtered.slice(0, maxCount);

  log('\n[PASO 3] Resumen:', 'header');
  log('  Total a enviar: ' + targetConvs.length, 'info');
  log('  Modo: ' + (_config.dryRun ? 'DRY RUN (no envía)' : 'REAL'), _config.dryRun ? 'warn' : 'info');

  // Show name preview if personalized
  if (_config.personalized) {
    log('\nVista previa de nombres:', 'info');
    targetConvs.slice(0, 5).forEach(function (c, i) {
      log('  ' + (i + 1) + '. "' + c.name + '" → "¡Hey ' + c.firstName + '! 👋"', 'info');
    });
  }

  _pendingConvs = targetConvs;
  return new Promise(function (resolve) {
    _resolvePending = resolve;
    // Auto-confirm (popup already confirmed by clicking Start)
    igDmSender.confirm();
  });
}

// ── Confirm and run ──
igDmSender.confirm = async function () {
  var session = await loadSession();
  var targetConvs, startIndex, sent, failed, errors;

  if (session && session.conversations && session.conversations.length > 0) {
    log('%c🔄 SESIÓN RECUPERADA — reanudando tras recarga', 'color:#4CAF50;font-weight:bold');
    targetConvs = session.conversations;
    startIndex = session.currentIndex;
    sent = session.sent;
    failed = session.failed;
    errors = session.errors || [];
    log('  Reanudando desde ' + (startIndex + 1) + '/' + targetConvs.length, 'info');
  } else {
    targetConvs = _pendingConvs;
    if (!targetConvs || targetConvs.length === 0) {
      log('No hay conversaciones pendientes.', 'error');
      return;
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
      await clearSession();
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

    // Persist session after each message
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

    // Personalize if enabled
    var msg = _config.personalized
      ? _config.message.replace(/\{nombre\}/g, conv.firstName || 'amigo')
      : _config.message;

    // CAPTCHA check
    var popup = checkForPopups();
    if (popup === 'captcha') {
      log(progress + ' ⚠ CAPTCHA detectado. Pausando.', 'error');
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
      return;
    }

    try {
      log(progress + ' Buscando @' + conv.name + '...', 'info');
      var clicked = await findAndClickConversation(conv.name);
      if (!clicked) {
        log(progress + ' No encontrado. Saltando.', 'error');
        failed++;
        errors.push({ name: conv.name, error: 'Not found' });
        continue;
      }
      await sleep(2500 + Math.random() * 500);

      var input = await waitForElement('div[role="textbox"][contenteditable="true"]', 5000);
      if (!input) {
        log(progress + ' No input. Saltando.', 'error');
        failed++;
        errors.push({ name: conv.name, error: 'No input' });
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
        log(progress + ' DRY RUN — escrito a @' + conv.name, 'warn');
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
          log(progress + ' ❌ Falló a @' + conv.name, 'error');
          failed++;
          errors.push({ name: conv.name, error: 'Send failed' });
          input.textContent = '';
        }
      }

      var delay = randomDelay();
      log('  Esperando ' + (delay / 1000).toFixed(1) + 's...', 'info');
      await sleep(delay);
    } catch (err) {
      log(progress + ' Error: ' + err.message, 'error');
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
  log('\nHecho. ' + sent + ' mensajes enviados.', 'header');

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
};
```

- [ ] **Step 9: Write content.js — Section H: Auto-recovery on load**

```javascript
// ── Auto-recovery: check for saved session on page load ──
(async function autoRecover() {
  await sleep(3000);

  // Load config first
  await loadConfig();

  // Check for saved session
  var session = await loadSession();
  if (session && session.conversations && session.conversations.length > 0) {
    console.log('%c[IG-DM] 🔄 Sesión pendiente detectada. Auto-reanudando en 5s...', 'color:#4CAF50;font-weight:bold');
    console.log('%c[IG-DM] Para CANCELAR, abre el popup y haz clic en Detener', 'color:#FF9800;font-weight:bold');
    await sleep(5000);
    if (!_stopFlag) {
      igDmSender.confirm();
    }
  } else {
    console.log('%c[IG-DM] ✅ Extensión cargada. Configura el mensaje en el popup y haz clic en Iniciar.', 'color:#4CAF50');
  }
})();
```

- [ ] **Step 10: Verify content.js is complete**

```bash
wc -l ig-dm-extension/content/content.js
# Should be ~600-700 lines
```

- [ ] **Step 11: Commit**

```bash
git add ig-dm-extension/content/content.js
git rm ig-dm-extension/content.js 2>/dev/null; true
git commit -m "feat: rewrite content script as full DM engine with chrome.storage integration"
```

---

### Task 5: Service worker

**Files:**
- Create: `ig-dm-extension/background/service-worker.js`

- [ ] **Step 1: Write service-worker.js**

```javascript
// IG DM Automator — Service Worker
// Minimal: initializes default config on install

chrome.runtime.onInstalled.addListener(async function () {
  // Initialize default config if not set
  var data = await chrome.storage.local.get('igDmConfig');
  if (!data.igDmConfig) {
    await chrome.storage.local.set({ igDmConfig: DEFAULTS });
    console.log('[IG-DM-SW] Configuración por defecto inicializada');
  }

  // Initialize progress
  var progress = await chrome.storage.local.get('igDmProgress');
  if (!progress.igDmProgress) {
    await chrome.storage.local.set({ igDmProgress: DEFAULT_PROGRESS });
  }

  console.log('[IG-DM-SW] Service worker instalado. Extensión lista.');
});

// Optional: forward messages when popup is closed
// (not strictly needed since we use chrome.storage for state)
chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
  // PROGRESS messages are handled by the popup directly via storage polling,
  // but we relay them here in case popup is open and listening
  if (msg.action === 'PROGRESS') {
    // Just acknowledge — popup polls storage independently
    sendResponse({ ack: true });
  }
});
```

- [ ] **Step 2: Commit**

```bash
git add ig-dm-extension/background/service-worker.js
git commit -m "feat: add minimal service worker for install initialization"
```

---

### Task 6: Popup HTML structure

**Files:**
- Create: `ig-dm-extension/popup/popup.html`

- [ ] **Step 1: Write popup.html**

```html
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>IG DM Automator</title>
  <link rel="stylesheet" href="popup.css">
</head>
<body>
  <div class="container">
    <!-- Header -->
    <header class="header">
      <h1 class="header-title">🔥 IG DM Automator</h1>
      <span class="header-version">v2.0</span>
    </header>

    <!-- Message Section -->
    <section class="section">
      <label class="label" for="message">📝 Mensaje</label>
      <textarea id="message" class="textarea" rows="5" placeholder="Escribe tu mensaje aquí...&#10;&#10;Usa {nombre} para personalizar"></textarea>
      <div class="checkbox-row">
        <input type="checkbox" id="personalized">
        <label for="personalized">Personalizado (<code>{nombre}</code>)</label>
      </div>
    </section>

    <!-- Config Section -->
    <section class="section">
      <label class="label">⚙️ Configuración</label>
      <div class="config-grid">
        <div class="config-item">
          <label for="delayMin">Delay min (ms)</label>
          <input type="number" id="delayMin" class="input" min="500" max="30000" step="500">
        </div>
        <div class="config-item">
          <label for="delayMax">Delay max (ms)</label>
          <input type="number" id="delayMax" class="input" min="500" max="30000" step="500">
        </div>
        <div class="config-item">
          <label for="maxMessages">Max mensajes</label>
          <input type="number" id="maxMessages" class="input" min="1" max="5000">
        </div>
        <div class="config-item">
          <label for="weeksBack">Semanas atrás</label>
          <input type="number" id="weeksBack" class="input" min="1" max="52">
        </div>
      </div>
      <div class="checkbox-row">
        <input type="checkbox" id="skipGroups" checked>
        <label for="skipGroups">Saltar grupos</label>
      </div>
      <div class="checkbox-row">
        <input type="checkbox" id="dryRun">
        <label for="dryRun">🧪 Dry run (no enviar)</label>
      </div>
    </section>

    <!-- Progress Section -->
    <section class="section" id="progressSection">
      <label class="label">📊 Progreso</label>
      <div class="progress-card">
        <div class="status-row">
          <span class="status-dot" id="statusDot"></span>
          <span class="status-text" id="statusText">● Listo</span>
        </div>
        <div class="progress-info">
          <span id="progressFraction">0/0</span>
          <span id="progressPercent">(0%)</span>
        </div>
        <div class="progress-bar">
          <div class="progress-fill" id="progressFill" style="width: 0%"></div>
        </div>
        <div class="progress-stats">
          <span>✅ <span id="sentCount">0</span></span>
          <span>❌ <span id="failedCount">0</span></span>
        </div>
        <div class="current-recipient" id="currentRecipient" style="display:none">
          <span>Actual: <strong id="currentName">—</strong></span>
        </div>
      </div>
    </section>

    <!-- Actions -->
    <div class="actions">
      <button id="startBtn" class="btn btn-primary">▶ Iniciar</button>
      <button id="stopBtn" class="btn btn-danger" disabled>⏹ Detener</button>
    </div>

    <!-- Footer -->
    <footer class="footer">
      <span>Instagram DM Automator v2.0</span>
    </footer>
  </div>

  <script src="../core/defaults.js"></script>
  <script src="../core/storage.js"></script>
  <script src="popup.js"></script>
</body>
</html>
```

- [ ] **Step 2: Commit**

```bash
git add ig-dm-extension/popup/popup.html
git commit -m "feat: add popup HTML structure with all form controls"
```

---

### Task 7: Popup CSS — beautiful dark UI

**Files:**
- Create: `ig-dm-extension/popup/popup.css`

- [ ] **Step 1: Write popup.css**

Apply all relevant rules from @userinterface-wiki. Key design decisions:

- Dark theme (`#1a1a2e` bg, `#e0e0e0` text)
- Accent color: gradient purple-pink (`#7c3aed` → `#ec4899`)
- 8px spacing scale (4, 8, 12, 16, 24, 32)
- Cards: `border-radius: 12px`, layered shadows, `rgba(0,0,0,0.3)` + `rgba(124,58,237,0.1)`
- Inputs: `border-radius: 8px`, semi-transparent borders
- Buttons: 150ms ease-out transitions, `:active` scale(0.97)
- Progress bar: gradient fill, smooth width transition
- Font: system font stack, tabular-nums for counters
- Scrollbar: styled minimal
- Responsive: fixed 400px width (popup default)

Full CSS (~250 lines) covering: reset, container, header, sections, labels, textarea, inputs, checkboxes, config-grid, progress-card, status-dot (pulsing animation for 'sending'), progress-bar, buttons (primary + danger + disabled states), footer. All using CSS custom properties.

- [ ] **Step 2: Commit**

```bash
git add ig-dm-extension/popup/popup.css
git commit -m "feat: add popup CSS with dark theme, gradient accents, layered shadows"
```

---

### Task 8: Popup JS — form binding + start/stop + progress polling

**Files:**
- Create: `ig-dm-extension/popup/popup.js`

- [ ] **Step 1: Write popup.js — Section A: Initialization + config loading**

```javascript
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
}

// ── Save config to storage ──
async function saveConfig() {
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
}
```

- [ ] **Step 2: Write popup.js — Section B: Progress polling + UI update**

```javascript
// ── Poll progress from storage and update UI ──
async function updateProgress() {
  var data = await chrome.storage.local.get('igDmProgress');
  var p = data.igDmProgress || DEFAULT_PROGRESS;

  // Status dot + text
  var statusMap = {
    'idle':    { cls: 'idle',    text: '● Listo' },
    'scanning':{ cls: 'active',  text: '🔍 Escaneando...' },
    'sending': { cls: 'active',  text: '📨 Enviando...' },
    'paused':  { cls: 'paused',  text: '⚠ Pausado (CAPTCHA)' },
    'stopped': { cls: 'idle',    text: '⏹ Detenido' },
    'done':    { cls: 'done',    text: '✅ Completado' }
  };
  var state = statusMap[p.status] || statusMap['idle'];
  els.statusDot.className = 'status-dot ' + state.cls;
  els.statusText.textContent = state.text;

  // Progress
  els.progressFraction.textContent = p.current + '/' + p.total;
  var pct = p.total > 0 ? Math.round((p.current / p.total) * 100) : 0;
  els.progressPercent.textContent = '(' + pct + '%)';
  els.progressFill.style.width = pct + '%';

  // Counts
  els.sentCount.textContent = p.sent;
  els.failedCount.textContent = p.failed;

  // Current recipient
  if (p.currentName && p.status === 'sending') {
    els.currentRecipient.style.display = 'block';
    els.currentName.textContent = p.currentName;
  } else {
    els.currentRecipient.style.display = 'none';
  }

  // Button states
  var running = (p.status === 'scanning' || p.status === 'sending' || p.status === 'paused');
  els.startBtn.disabled = running;
  els.stopBtn.disabled = !running;
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
```

- [ ] **Step 3: Write popup.js — Section C: Start/Stop commands**

```javascript
// ── Get current Instagram Direct tab ──
async function getDirectTab() {
  var tabs = await chrome.tabs.query({ url: ['*://www.instagram.com/direct/*', '*://instagram.com/direct/*'] });
  return tabs[0] || null;
}

// ── Start ──
async function handleStart() {
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

  // Send START command to content script
  try {
    await chrome.tabs.sendMessage(tab.id, { action: 'START' });
  } catch (e) {
    console.error('Error sending START:', e);
  }
}

// ── Stop ──
async function handleStop() {
  var tab = _currentTabId ? await chrome.tabs.get(_currentTabId).catch(function () { return null; }) : null;
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
}

// ── Event listeners ──
els.startBtn.addEventListener('click', handleStart);
els.stopBtn.addEventListener('click', handleStop);

// Auto-save on input change
var inputs = [els.message, els.personalized, els.delayMin, els.delayMax, els.maxMessages, els.weeksBack, els.skipGroups, els.dryRun];
inputs.forEach(function (el) {
  el.addEventListener('change', saveConfig);
  if (el.tagName === 'TEXTAREA' || el.type === 'number') {
    el.addEventListener('blur', saveConfig);
  }
});
```

- [ ] **Step 4: Write popup.js — Section D: Init**

```javascript
// ── Initialize ──
(async function init() {
  await loadAndPopulate();
  startPolling();
})();

// Clean up polling when popup closes
window.addEventListener('unload', stopPolling);
```

- [ ] **Step 5: Commit**

```bash
git add ig-dm-extension/popup/popup.js
git commit -m "feat: add popup JS with form binding, start/stop, progress polling"
```

---

### Task 9: Integration testing

**Files:**
- Create: `ig-dm-extension/tests/test-storage.js`
- Create: `ig-dm-extension/tests/test-config-flow.html`

- [ ] **Step 1: Write test-storage.js** — unit tests for storage module (save/load config, save/load progress, session lifecycle)

- [ ] **Step 2: Write test-config-flow.html** — manual test page that simulates the popup + storage interaction

- [ ] **Step 3: Run tests and verify**

```bash
node ig-dm-extension/tests/test-storage.js
```

- [ ] **Step 4: Commit**

```bash
git add ig-dm-extension/tests/
git commit -m "test: add storage module unit tests and config flow test page"
```

---

### Task 10: Icons + final polish

**Files:**
- Create: `ig-dm-extension/icons/icon16.png`
- Create: `ig-dm-extension/icons/icon48.png`
- Create: `ig-dm-extension/icons/icon128.png`

- [ ] **Step 1: Generate icons**

Use a simple Node script to generate PNG icons with a gradient background + "DM" text, or use an online generator. For now, create minimal placeholder PNGs:

```bash
# Generate via Node (requires no dependencies — raw PNG binary)
node ig-dm-extension/scripts/generate-icons.js
```

If script generation is too complex, provide instructions to use a favicon generator.

- [ ] **Step 2: Verify extension loads in Chrome**

1. Go to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked" → select `ig-dm-extension/` folder
4. Verify extension appears with icon
5. Go to `instagram.com/direct/` → verify content script injects
6. Click extension icon → verify popup opens with UI

- [ ] **Step 3: Commit**

```bash
git add ig-dm-extension/icons/
git commit -m "feat: add extension icons and verify Chrome loading"
```

---

### Task 11: README update

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update README** with new v2.0 features, installation instructions, architecture diagram, and configuration reference.

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: update README for v2.0 with architecture and usage guide"
```

---

## Summary

| Task | Files | Description |
|------|-------|-------------|
| 0 | `icons/`, dirs | Directory scaffold |
| 1 | `core/defaults.js` | Default config + progress schema |
| 2 | `core/storage.js` | chrome.storage.local wrapper |
| 3 | `manifest.json` | MV3 manifest with all permissions |
| 4 | `content/content.js` | Full DM engine (~650 lines) |
| 5 | `background/service-worker.js` | Install initialization |
| 6 | `popup/popup.html` | Popup structure |
| 7 | `popup/popup.css` | Dark themed UI (~250 lines) |
| 8 | `popup/popup.js` | Form binding, start/stop, polling |
| 9 | `tests/` | Storage tests + manual test page |
| 10 | `icons/` | Extension icons + Chrome verification |
| 11 | `README.md` | Updated documentation |

**Total: 11 files created/modified. ~1,200 lines of new code.**

**What ships:**
- Popup UI with message editor, delay config, filters, dry run toggle, personalized mode
- Automatic script injection on `instagram.com/direct/*` (no console pasting)
- Real-time progress display (sent/failed/current recipient)
- Session recovery after page reload (via `chrome.storage.local`)
- CAPTCHA detection → pausing with UI feedback
- Start/Stop from popup
- All 3 original modes: dry-run, real, personalized
