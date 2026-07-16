// Test auto-recovery system v1.1: session persistence + extension validation
// Key change: content.js now uses <script> tag injection instead of eval()
// Key change: personalized script now has save/recovery mechanism
const fs = require('fs');

let pass = 0, fail = 0;
function assert(name, condition, details) {
  if (condition) {
    console.log('  ✓ ' + name);
    pass++;
  } else {
    console.log('  ✗ ' + name + ' — ' + (details || ''));
    fail++;
  }
}

console.log('=== TEST: Auto-Recovery System v1.1 ===\n');

// ============================================================
// TEST 1: Session save/load/clear (pure logic, no DOM needed)
// ============================================================
console.log('Test 1: Session persistence (pure logic)');

// In-memory storage to simulate sessionStorage
var storage = {};

function saveSession(targetConvs, currentIndex, sent, failed, errors) {
  storage['igDmSession'] = JSON.stringify({
    conversations: targetConvs,
    currentIndex: currentIndex,
    sent: sent,
    failed: failed,
    errors: errors,
    timestamp: Date.now(),
  });
}

function loadSession() {
  var data = storage['igDmSession'];
  if (!data) return null;
  try { return JSON.parse(data); } catch (e) { return null; }
}

function clearSession() {
  delete storage['igDmSession'];
}

var testConvs = [
  { name: 'user1', firstName: 'User1', timestamp: '5m', timeDays: 0, isGroup: false },
  { name: 'user2', firstName: 'User2', timestamp: '2 d', timeDays: 2, isGroup: false },
];

saveSession(testConvs, 5, 3, 2, [{ name: 'user0', error: 'Not found' }]);
var loaded = loadSession();
assert('Session saved and loaded', loaded !== null);
assert('currentIndex: 5', loaded.currentIndex === 5, 'got ' + loaded.currentIndex);
assert('sent: 3', loaded.sent === 3, 'got ' + loaded.sent);
assert('failed: 2', loaded.failed === 2, 'got ' + loaded.failed);
assert('2 conversations', loaded.conversations.length === 2, 'got ' + loaded.conversations.length);
assert('1 error preserved', loaded.errors.length === 1, 'got ' + loaded.errors.length);

clearSession();
assert('Session cleared', loadSession() === null);

// Re-save and verify resume scenario
saveSession(testConvs, 1, 1, 0, []);
var resume = loadSession();
assert('Resume: index 1', resume.currentIndex === 1);
assert('Resume: next conv is user2', resume.conversations[1].name === 'user2');
console.log();

// ============================================================
// TEST 2: content.js must NOT use eval() (MV3 CSP compliance)
// ============================================================
console.log('Test 2: content.js CSP compliance (no eval)');

var contentJs = fs.readFileSync('/Volumes/SSD/malalts/ig-dm-extension/content.js', 'utf-8');
// Strip comments before checking for eval (comments mention eval() as context)
var codeNoComments = contentJs.replace(/\/\/.*$|\/\*[\s\S]*?\*\//gm, '');
var hasEval = /\beval\s*\(/.test(codeNoComments);
assert('content.js does NOT use eval()', !hasEval, 'eval() is blocked by MV3 CSP');
assert('content.js uses createElement("script")', contentJs.includes("createElement('script')"));
assert('content.js uses textContent', contentJs.includes('textContent'));
assert('content.js reads from sessionStorage', contentJs.includes("sessionStorage.getItem('igDmScript')"));
assert('content.js has recovery marker', contentJs.includes('__ig_dm_recovery_marker'));
assert('content.js has setTimeout', contentJs.includes('setTimeout'));
assert('content.js has SPA navigation handler', contentJs.includes('setInterval') && contentJs.includes('location.href'));
console.log();

// ============================================================
// TEST 3: manifest.json validation
// ============================================================
console.log('Test 3: manifest.json validation');

var manifest = JSON.parse(fs.readFileSync('/Volumes/SSD/malalts/ig-dm-extension/manifest.json', 'utf-8'));
assert('manifest_version: 3', manifest.manifest_version === 3);
assert('version >= 1.1', parseFloat(manifest.version) >= 1.1, 'got ' + manifest.version);
assert('Has content_scripts', Array.isArray(manifest.content_scripts));
assert('Matches instagram.com/direct', manifest.content_scripts[0].matches.some(function (m) { return m.includes('instagram.com/direct'); }));
assert('Has content.js in js array', manifest.content_scripts[0].js.includes('content.js'));
assert('run_at: document_idle', manifest.content_scripts[0].run_at === 'document_idle');
assert('Has host_permissions', Array.isArray(manifest.host_permissions));
console.log();

// ============================================================
// TEST 4: Personalized script has recovery mechanism
// ============================================================
console.log('Test 4: Personalized script recovery');

var personalized = fs.readFileSync('/Volumes/SSD/malalts/scripts/ig-dm-personalized.js', 'utf-8');
assert('Has saveSession', personalized.includes('function saveSession'));
assert('Has loadSession', personalized.includes('function loadSession'));
assert('Has clearSession', personalized.includes('function clearSession'));
assert('Saves script to sessionStorage', personalized.includes("setItem('igDmScript'"));
assert('Saves session to sessionStorage', personalized.includes("setItem('igDmSession'"));
assert('Has onbeforeunload', personalized.includes('window.onbeforeunload'));
assert('Has auto-resume check', personalized.includes('autoResume'));
assert('Confirm handles existingSession', personalized.includes('existingSession'));
assert('Saves progress in loop', personalized.includes('saveSession(targetConvs, i, sent, failed, errors)'));
assert('stopIGDM clears sessionStorage', personalized.includes("removeItem('igDmSession')"));
console.log();

// ============================================================
// TEST 5: Oficial script has recovery mechanism
// ============================================================
console.log('Test 5: Oficial script recovery');

var oficial = fs.readFileSync('/Volumes/SSD/malalts/scripts/ig-dm-oficial.js', 'utf-8');
assert('Has saveSession', oficial.includes('function saveSession'));
assert('Has loadSession', oficial.includes('function loadSession'));
assert('Saves script to sessionStorage', oficial.includes("setItem('igDmScript'"));
assert('Has beforeunload', oficial.includes('window.onbeforeunload'));
assert('Has auto-resume', oficial.includes('autoResume'));
assert('Confirm handles existingSession', oficial.includes('existingSession'));
console.log();

// ============================================================
// TEST 6: Prueba script has recovery mechanism
// ============================================================
console.log('Test 6: Prueba script recovery');

var prueba = fs.readFileSync('/Volumes/SSD/malalts/scripts/ig-dm-prueba.js', 'utf-8');
assert('Has saveSession', prueba.includes('function saveSession'));
assert('Has loadSession', prueba.includes('function loadSession'));
assert('Saves script to sessionStorage', prueba.includes("setItem('igDmScript'"));
assert('Has beforeunload', prueba.includes('window.onbeforeunload'));
console.log();

// ============================================================
// TEST 7: stopIGDM clears all state (verify in all 3 scripts)
// ============================================================
console.log('Test 7: stopIGDM clears state in all scripts');

var scripts = [
  { name: 'oficial', content: oficial },
  { name: 'personalized', content: personalized },
  { name: 'prueba', content: prueba },
];

scripts.forEach(function (s) {
  var hasRemoveSession = s.content.includes("removeItem('igDmSession')") || s.content.includes('removeItem("igDmSession")');
  var hasRemoveScript = s.content.includes("removeItem('igDmScript')") || s.content.includes('removeItem("igDmScript")');
  assert(s.name + ': removes igDmSession in stop', hasRemoveSession);
  assert(s.name + ': removes igDmScript in stop', hasRemoveScript);
});
console.log();

// ============================================================
// TEST 8: Recovery key consistency across all files
// ============================================================
console.log('Test 8: Key name consistency');

var KEY = 'igDmScript';
var SESSION_KEY = 'igDmSession';

// Check all files use the same keys
var allFiles = {
  'content.js': contentJs,
  'ig-dm-oficial.js': oficial,
  'ig-dm-personalized.js': personalized,
  'ig-dm-prueba.js': prueba,
};

Object.keys(allFiles).forEach(function (filename) {
  var file = allFiles[filename];
  // Check the save key is consistent (all files must use 'igDmScript')
  var usesScriptKey = file.includes("'" + KEY + "'") || file.includes('"' + KEY + '"');
  assert(filename + ': uses key "' + KEY + '"', usesScriptKey);
  // Session key is only used by the DM scripts, not content.js
  if (filename !== 'content.js') {
    var usesSessionKey = file.includes("'" + SESSION_KEY + "'") || file.includes('"' + SESSION_KEY + '"');
    assert(filename + ': uses key "' + SESSION_KEY + '"', usesSessionKey);
  }
});
console.log();

// ============================================================
// SUMMARY
// ============================================================
console.log('═══════════════════════════════════════════');
console.log('  TESTS: ' + pass + ' passed, ' + fail + ' failed');
console.log('═══════════════════════════════════════════');

process.exit(fail > 0 ? 1 : 0);
