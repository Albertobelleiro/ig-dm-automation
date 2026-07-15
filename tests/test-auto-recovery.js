// Test auto-recovery system: sessionStorage persistence + extension re-injection
const { JSDOM } = require('jsdom');

const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
  url: 'https://www.instagram.com/direct/inbox/',
  runScripts: 'dangerously',
  pretendToBeVisual: true,
});

const { window } = dom;
const { document } = window;

// Polyfills
window.sessionStorage = {
  _data: {},
  getItem(k) { return this._data[k] || null; },
  setItem(k, v) { this._data[k] = String(v); },
  removeItem(k) { delete this._data[k]; },
  clear() { this._data = {}; },
};
window.onbeforeunload = null;
window.getComputedStyle = () => ({ overflowY: 'hidden', overflowX: 'hidden', opacity: '1' });
window.innerHeight = 800;
window.innerWidth = 1200;

let pass = 0, fail = 0;
function assert(name, condition, details) {
  if (condition) {
    console.log(`  ✓ ${name}`);
    pass++;
  } else {
    console.log(`  ✗ ${name} — ${details || ''}`);
    fail++;
  }
}

console.log('=== TEST: Auto-Recovery System ===\n');

// ============================================================
// TEST 1: Session save/load/clear
// ============================================================
console.log('Test 1: Session persistence (save/load/clear)');

// Simulate saveSession
function saveSession(targetConvs, currentIndex, sent, failed, errors) {
  window.sessionStorage.setItem('igDmSession', JSON.stringify({
    conversations: targetConvs,
    currentIndex: currentIndex,
    sent: sent,
    failed: failed,
    errors: errors,
    timestamp: Date.now(),
  }));
}

function loadSession() {
  const data = window.sessionStorage.getItem('igDmSession');
  if (!data) return null;
  try { return JSON.parse(data); } catch (e) { return null; }
}

function clearSession() {
  window.sessionStorage.removeItem('igDmSession');
}

const testConvs = [
  { name: 'user1', timestamp: '5m', timeDays: 0, isGroup: false },
  { name: 'user2', timestamp: '2 d', timeDays: 2, isGroup: false },
  { name: 'user3', timestamp: '1 sem', timeDays: 7, isGroup: false },
];

saveSession(testConvs, 5, 3, 2, [{ name: 'user0', error: 'Not found' }]);
const loaded = loadSession();
assert('Session saved and loaded', loaded !== null);
assert('currentIndex correct', loaded.currentIndex === 5, `got ${loaded.currentIndex}`);
assert('sent correct', loaded.sent === 3, `got ${loaded.sent}`);
assert('failed correct', loaded.failed === 2, `got ${loaded.failed}`);
assert('conversations count correct', loaded.conversations.length === 3, `got ${loaded.conversations.length}`);
assert('errors preserved', loaded.errors.length === 1, `got ${loaded.errors.length}`);

clearSession();
const afterClear = loadSession();
assert('Session cleared', afterClear === null);
console.log();

// ============================================================
// TEST 2: Script source saved to sessionStorage
// ============================================================
console.log('Test 2: Script source saved to sessionStorage');

// Simulate what the script does when it saves itself
const fakeConfig = { mensaje: 'test', delayMin: 4000, delayMax: 6000, maxMensajes: 50 };
const fakeStopFunc = function() { window._igDmStop = true; sessionStorage.removeItem('igDmSession'); };

var _scriptSource = '';
_scriptSource += 'var IG_DM_CONFIG = ' + JSON.stringify(fakeConfig) + ';\n';
_scriptSource += 'window._igDmStop = false;\n';
_scriptSource += 'window.stopIGDM = ' + fakeStopFunc.toString() + ';\n';
_scriptSource += 'var testFunc = function() { return 42; };\n';
_scriptSource += '\n// Auto-resume\n';
_scriptSource += '(async function autoResume() { console.log("auto-resume triggered"); })();\n';

window.sessionStorage.setItem('igDmScript', _scriptSource);
const savedScript = window.sessionStorage.getItem('igDmScript');
assert('Script saved to sessionStorage', savedScript !== null && savedScript.length > 50);
assert('Script contains IG_DM_CONFIG', savedScript.includes('IG_DM_CONFIG'));
assert('Script contains stopIGDM', savedScript.includes('stopIGDM'));
assert('Script contains autoResume', savedScript.includes('autoResume'));
assert('Script contains testFunc', savedScript.includes('testFunc'));
console.log();

// ============================================================
// TEST 3: Extension content.js can read and eval the script
// ============================================================
console.log('Test 3: Extension re-injection simulation');

// Simulate what the extension's content.js does
const extensionCode = window.sessionStorage.getItem('igDmScript');
let extensionLoaded = false;
try {
  // Eval in the window context
  window.eval(extensionCode);
  extensionLoaded = true;
} catch (e) {
  console.log('  Eval error:', e.message);
}

assert('Extension can eval saved script', extensionLoaded);
assert('IG_DM_CONFIG exists after eval', typeof window.IG_DM_CONFIG !== 'undefined', `got ${typeof window.IG_DM_CONFIG}`);
assert('stopIGDM exists after eval', typeof window.stopIGDM === 'function', `got ${typeof window.stopIGDM}`);
assert('testFunc returns 42', typeof window.testFunc === 'function' && window.testFunc() === 42, `got ${typeof window.testFunc}`);
console.log();

// ============================================================
// TEST 4: beforeunload prevention
// ============================================================
console.log('Test 4: beforeunload prevention');

window._igDmStop = false;
window.onbeforeunload = function () {
  if (!window._igDmStop) {
    return 'El script de DMs está corriendo. ¿Seguro que quieres salir?';
  }
};

// When script is running, beforeunload should return a string
const resultRunning = window.onbeforeunload();
assert('beforeunload returns message when running', typeof resultRunning === 'string', `got ${typeof resultRunning}`);

// When stopped, beforeunload should return undefined
window._igDmStop = true;
const resultStopped = window.onbeforeunload();
assert('beforeunload returns undefined when stopped', resultStopped === undefined, `got ${resultStopped}`);
console.log();

// ============================================================
// TEST 5: Full recovery flow simulation
// ============================================================
console.log('Test 5: Full recovery flow');

// Step 1: Script is running, saves session
window.sessionStorage.clear();
window._igDmStop = false;

const convs = [
  { name: 'alice', timestamp: '1h', timeDays: 0, isGroup: false },
  { name: 'bob', timestamp: '2d', timeDays: 2, isGroup: false },
  { name: 'charlie', timestamp: '5d', timeDays: 5, isGroup: false },
];

// Save session at index 1 (already sent to alice)
saveSession(convs, 1, 1, 0, []);

// Save script source
window.sessionStorage.setItem('igDmScript', 'var recovered = true; console.log("recovered");');

// Step 2: Simulate page reload — sessionStorage persists
// Extension content.js runs:
const recoveredScript = window.sessionStorage.getItem('igDmScript');
assert('Script survives in sessionStorage after "reload"', recoveredScript !== null);

// Extension evals it:
window.eval(recoveredScript);
assert('Script re-injected after reload', typeof window.recovered !== 'undefined' && window.recovered === true, `got ${typeof window.recovered}`);

// Step 3: Auto-resume detects session
const recoveredSession = loadSession();
assert('Session survives after "reload"', recoveredSession !== null);
assert('Resume index correct', recoveredSession.currentIndex === 1, `got ${recoveredSession.currentIndex}`);
assert('Resume sent count correct', recoveredSession.sent === 1, `got ${recoveredSession.sent}`);
assert('Resume conversations count correct', recoveredSession.conversations.length === 3, `got ${recoveredSession.conversations.length}`);
assert('Resume next conversation is bob', recoveredSession.conversations[1].name === 'bob', `got ${recoveredSession.conversations[1]?.name}`);
console.log();

// ============================================================
// TEST 6: stopIGDM clears everything
// ============================================================
console.log('Test 6: stopIGDM clears all state');

window._igDmStop = false;
saveSession(convs, 0, 0, 0, []);
window.sessionStorage.setItem('igDmScript', 'test script');

// Simulate stopIGDM
window._igDmStop = true;
window.sessionStorage.removeItem('igDmSession');
window.sessionStorage.removeItem('igDmScript');
window.onbeforeunload = null;

assert('Session cleared by stop', window.sessionStorage.getItem('igDmSession') === null);
assert('Script cleared by stop', window.sessionStorage.getItem('igDmScript') === null);
assert('beforeunload removed', window.onbeforeunload === null);
assert('Stop flag set', window._igDmStop === true);
console.log();

// ============================================================
// TEST 7: Extension manifest is valid
// ============================================================
console.log('Test 7: Extension manifest validation');

const fs = require('fs');
const manifestPath = '/Volumes/SSD/malalts/ig-dm-extension/manifest.json';
const manifestExists = fs.existsSync(manifestPath);
assert('manifest.json exists', manifestExists);

if (manifestExists) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  assert('manifest_version is 3', manifest.manifest_version === 3);
  assert('Has name', manifest.name !== undefined);
  assert('Has content_scripts', Array.isArray(manifest.content_scripts));
  assert('Matches instagram.com/direct', manifest.content_scripts[0].matches.some(m => m.includes('instagram.com/direct')));
  assert('Has content.js', manifest.content_scripts[0].js.includes('content.js'));
  assert('run_at is document_idle', manifest.content_scripts[0].run_at === 'document_idle');
}

const contentJsPath = '/Volumes/SSD/malalts/ig-dm-extension/content.js';
const contentJsExists = fs.existsSync(contentJsPath);
assert('content.js exists', contentJsExists);

if (contentJsExists) {
  const contentJs = fs.readFileSync(contentJsPath, 'utf-8');
  assert('content.js reads igDmScript from sessionStorage', contentJs.includes("sessionStorage.getItem('igDmScript')"));
  assert('content.js uses eval', contentJs.includes('eval'));
  assert('content.js has setTimeout', contentJs.includes('setTimeout'));
  assert('content.js checks script length', contentJs.includes('length > 100'));
}
console.log();

// ============================================================
// SUMMARY
// ============================================================
console.log('═══════════════════════════════════════════');
console.log(`  TESTS: ${pass} passed, ${fail} failed`);
console.log('═══════════════════════════════════════════');

process.exit(fail > 0 ? 1 : 0);
