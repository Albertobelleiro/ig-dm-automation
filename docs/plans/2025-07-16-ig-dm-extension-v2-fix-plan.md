# IG DM Extension v2.1 — Fix Plan

> Investigación completa de bugs + plan de reparación.
> Usuario reportó: popup abre, click Iniciar → nada pasa, alert "no se pudo iniciar",
> progreso muestra "en ejecución" pero Stop no funciona, no detecta recarga de página.

---

## Root Cause Analysis

### Bug 1 (PRIMARY): Content script NO se inyecta en navegación SPA

**Qué pasa:**
Instagram es una SPA (Single Page Application). Cuando el usuario navega desde el feed (`instagram.com/`)
hasta Direct (`instagram.com/direct/inbox/`) mediante el enlace interno (pushState / replaceState),
**no hay recarga de página**. El content script de MV3 solo se inyecta en carga completa de página
que coincide con el patrón `*://www.instagram.com/direct/*`.

**Resultado:** El content script NUNCA se inyecta. El popup detecta la tab porque su URL es `/direct/`,
pero `chrome.tabs.sendMessage` lanza error "Receiving end does not exist". `sendToContent` reintenta
12 veces × 600ms = 7.2s, falla, muestra alert.

**Por qué es la causa raíz:**
- `handleStart()` en `popup.js` setea el progreso a `'scanning'` **ANTES** de verificar conexión
- El popup muestra "Escaneando" + botón Stop activado durante los 7.2s de reintentos
- El usuario cree que está corriendo cuando no hay content script
- Stop no funciona porque tampoco hay content script que lo reciba

**Confirmación con investigación:**
- Documentación Chrome MV3: content_scripts solo se inyectan en carga de página que coincide
  con el patrón de URL al momento del `document_idle`
- Artículo bulkmd.app: "Manifest V3 content scripts do not re-fire on SPA pushState navigation"
- Solución documentada: servicio worker detecta `webNavigation.onHistoryStateUpdated` +
  `chrome.scripting.executeScript` para inyección dinámica

### Bug 2: `sendToContent` sin timeout real

**Qué pasa:** `chrome.tabs.sendMessage` con `return true` (keepalive) mantiene el canal abierto
indefinidamente si el content script nunca llama a `sendResponse`. El `await` nunca resuelve.

**Impacto:** Si content script existe pero falla antes de llamar `sendResponse`, el popup se cuelga.
En la práctica es menos probable que Bug 1, pero es una falla de robustez.

### Bug 3: Progreso setea 'scanning' antes de confirmar content script

**Qué pasa:** `handleStart()`:
```js
await chrome.storage.local.set({ igDmProgress: { status: 'scanning', ... } }); // ← inmediato
var resp = await sendToContent(tab.id, { action: 'START' }, 12); // ← 7.2s después
```

**Resultado:** El polling de 500ms recoge 'scanning' inmediatamente y muestra UI de "corriendo".
El usuario ve que "está corriendo" pero en realidad START nunca llegó. Stop no funciona porque
no hay content script.

### Bug 4: `autoRecover` no se ejecuta tras SPA navigation

**Qué pasa:** El content script tiene `autoRecover()` que corre 3s después de la inyección.
Si el content script nunca se inyecta (SPA navigation), `autoRecover` nunca corre.
Si hay una sesión guardada, no se reanuda automáticamente.

**Impacto:** Si el usuario paró a medio camino, el banner de resume aparece (popup detecta
sesión desde storage), pero `autoRecover` no resuelve la sesión automáticamente.

### Bug 5 (menor): Popup no detecta correctamente tabs sin www

**Qué pasa:** Si el usuario abre `instagram.com/direct/` (sin www), el patrón de URL en
`content_scripts` cubre ambos (con y sin www). Pero `chrome.tabs.query` con
`url: ['*://www.instagram.com/direct/*', '*://instagram.com/direct/*']`
debería funcionar. **Confirmado que funciona.** No es bug, pero hay que verificar.

---

## Fix Plan

### Fix 1: Inyección dinámica del content script para SPA navigation

**Enfoque:** Service-worker detecta navegación SPA a `/direct/` e inyecta content script
vía `chrome.scripting.executeScript` si no está presente.

#### Changes necesarios:

**Manifest:**
- Añadir permisos: `"scripting"`, `"webNavigation"`
- `host_permissions` ya incluye `*://www.instagram.com/*` y `*://instagram.com/*`

**Service-worker (`background/service-worker.js`):**
```js
// Detectar navegación SPA a Direct
chrome.webNavigation.onHistoryStateUpdated.addListener(function(details) {
  if (details.frameId !== 0) return; // solo frame principal
  if (!/instagram\.com\/direct\//.test(details.url)) return;

  // Ping para ver si content script ya está inyectado
  chrome.tabs.sendMessage(details.tabId, { action: 'PING' })
    .then(function(r) { /* ya está inyectado, ok */ })
    .catch(function() {
      // No inyectado → inyectar ahora
      chrome.scripting.executeScript({
        target: { tabId: details.tabId },
        files: ['core/defaults.js', 'core/storage.js', 'content/content.js']
      }).catch(function(e) {
        console.error('[IG-DM-SW] Error inyectando content script:', e.message);
      });
    });
});

// También detectar cambios de URL directos (no solo pushState)
chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
  if (changeInfo.url && /instagram\.com\/direct\//.test(changeInfo.url)) {
    // Content script injection handled by webNavigation above,
    // but this is a safety net for edge cases
    chrome.tabs.sendMessage(tabId, { action: 'PING' })
      .catch(function() {
        chrome.scripting.executeScript({
          target: { tabId: tabId },
          files: ['core/defaults.js', 'core/storage.js', 'content/content.js']
        }).catch(function() {});
      });
  }
});
```

**Content script (`content/content.js`):**
- Añadir handler para `PING` action → responde inmediatamente `{ pong: true }`

### Fix 2: `handleStart` con detección de content script

**Flujo nuevo:**
1. Save config
2. Find Direct tab (open if needed)
3. **PING** content script (retry 15 × 500ms = 7.5s)
4. If no PING response → intentar inyectar dinámicamente (vía service worker o popup)
5. If still no response → mostrar error claro: "No se pudo conectar con Instagram Direct"
6. Send START
7. Wait for START response (con timeout)
8. If response → ok
9. If no response → revert progress a idle, mostrar error

**popup.js changes:**
```js
async function handleStart() {
  await saveConfig();
  
  var tab = await getOrCreateTab();
  
  // Step 1: Ping content script (retry loop with real timeout)
  var pong = await pingContentScript(tab.id, 15);  // 7.5s total
  if (!pong) {
    alert('⚠ No se pudo conectar con Instagram.\n\n' +
      'Asegúrate de que la pestaña de Instagram Direct esté\n' +
      'totalmente cargada. Si el problema persiste, recarga la página.');
    return;
  }

  // Step 2: Only NOW set progress and clear session
  await chrome.storage.local.set({
    igDmProgress: { status: 'scanning', total: 0, current: 0, sent: 0, failed: 0,
      errors: [], currentName: '', startedAt: Date.now() }
  });
  await chrome.storage.local.remove('igDmSession');

  // Step 3: Send START with timeout
  var resp = await sendWithTimeout(tab.id, { action: 'START' }, 5000, 1);
  if (!resp) {
    await chrome.storage.local.set({
      igDmProgress: { status: 'idle', total: 0, current: 0, sent: 0, failed: 0,
        errors: [], currentName: '', startedAt: null }
    });
    alert('⚠ No se pudo iniciar el envío en Instagram Direct.\n\n' +
      'Prueba a recargar la página de Instagram Direct y vuelve a intentarlo.');
    return;
  }
  // Success — progress polling will now show actual status from content script
}
```

### Fix 3: `sendToContent` con timeout real

La función actual solo reintenta en error de conexión. El fix: timeout por intento.

```js
async function sendWithTimeout(tabId, message, timeoutMs, retries) {
  retries = retries || 1;
  timeoutMs = timeoutMs || 5000;

  for (var i = 0; i < retries; i++) {
    try {
      var result = await Promise.race([
        chrome.tabs.sendMessage(tabId, message),
        new Promise(function(_, reject) {
          setTimeout(function() { reject(new Error('timeout')); }, timeoutMs);
        })
      ]);
      return result;
    } catch (e) {
      if (i >= retries - 1) return null;
      await sleep(600);
    }
  }
  return null;
}
```

### Fix 4: `handleStop` con display de error

Si Stop falla (no content script), el popup debe revertir el progreso a idle
en vez de dejar el estado 'scanning' colgado.

```js
async function handleStop() {
  var tab = await getDirectTab();
  if (tab) {
    try {
      await chrome.tabs.sendMessage(tab.id, { action: 'STOP' });
      return; // content script manejará el stop
    } catch (e) {
      // No content script → el stop no tiene efecto. Resetear progreso.
    }
  }
  // Force-reset progress
  await chrome.storage.local.set({
    igDmProgress: { status: 'idle', total: 0, current: 0, sent: 0, failed: 0,
      errors: [], currentName: '', startedAt: null }
  });
}
```

### Fix 5: `autoRecover` con SPA re-detección

El content script actualmente corre `autoRecover()` al inyectarse (3s delay).
Cuando se inyecta por SPA navigation (via Fix 1), también debe correr.

**Ya cubierto por Fix 1:** `chrome.scripting.executeScript` ejecuta el archivo
completo, que incluye el `autoRecover()` al final.

Pero hay un edge case: si el content script se inyecta en carga inicial de página,
y luego el usuario SPA-navega DENTRO de /direct/ (cambia de inbox a una conversación),
no necesitamos re-ejecutar autoRecover. El content script ya está corriendo.

**Fix:** `autoRecover` solo corre si no está ya corriendo (`_running` check + flag).

### Fix 6: Botón de "Forzar reinicio" en popup

Si el estado se queda colgado (progreso en 'scanning' pero sin content script),
el popup debe permitir un reset forzado.

**UI:** Cuando el estado es 'scanning' o 'sending' pero el PING no responde después
de 3 intentos, mostrar un enlace/botón "Reiniciar estado" que force reset a idle.

### Fix 7: Botón de recarga directa de página

Si el content script no responde, ofrecer "Recargar Instagram Direct" como acción
rápida en el popup.

---

## Files Modified

| File | Changes |
|------|---------|
| `manifest.json` | Add `scripting` + `webNavigation` permissions |
| `background/service-worker.js` | Add `webNavigation.onHistoryStateUpdated` + `tabs.onUpdated` for auto-injection; PING relay |
| `content/content.js` | Add `PING` handler; minor guard improvements |
| `popup/popup.html` | Add "Forzar reinicio" / "Recargar" buttons |
| `popup.css` | Styles for new buttons |
| `popup.js` | Rewrite `handleStart` (PING-first flow); rewrite `handleStop` (force-reset); add `sendWithTimeout`; add `pingContentScript`; add reload/force-reset handlers |
| `tests/test-schema.js` | Update assertions for new permissions+PING |
| `tests/test-auto-recovery.js` | Update assertions for new behavior |

---

## Edge Cases Covered

1. **SPA navigation feed→direct:** Service worker inyecta content script via scripting API ✓
2. **Direct page load (fresh):** Content_scripts pattern inyecta como antes ✓
3. **Content script no responde PING:** handleStart no setea 'scanning' → no estado colgado ✓
4. **Cliente pulsa Stop sin content script:** Force-reset a idle ✓
5. **Sesión guardada tras recarga:** autoRecover corre 3s tras inyección (Fix 1) ✓
6. **Múltiples tabs de Direct:** Primer tab encontrado usado. Si falla, mensaje claro ✓
7. **Popup abierto sin tab de Direct:** Estado vacío con "Abrir Instagram Direct" ✓
8. **Timeout real en sendMessage:** Promise.race con 5s timeout, no más hangs ✓
9. **Progreso colgado:** Botón "Forzar reinicio" visible tras PING fallido ✓

---

## Verification Criteria

1. ✅ Abrir popup sin Direct tab → empty state → botón abre la tab
2. ✅ Abrir popup con Direct tab (carga completa) → PING responde → Iniciar funciona
3. ✅ Navegación SPA (feed→Direct) → popup detecta → PING falla → inyección → funciona
4. ✅ START envía → content script responde → progreso real desde storage
5. ✅ STOP recibe content script → sesión guardada → Reanudar visible
6. ✅ STOP sin content script → force-reset a idle
7. ✅ Recarga de página mid-run → autoRecover reanuda automáticamente
8. ✅ No content script responde → timeout 5s → error claro, no estado colgado
9. ✅ Progreso no se setea a 'scanning' hasta que content script confirma

---

## Implementation Order

1. `manifest.json` — permissions
2. `background/service-worker.js` — webNavigation + scripting injection
3. `content/content.js` — PING handler
4. `popup.js` — sendWithTimeout, pingContentScript, handleStart rewrite, handleStop rewrite
5. `popup.html` + `popup.css` — extra buttons
6. `tests/` — update assertions
7. Verify: run tests, manual Chrome test
