// Auto-recovery test v2.0: validates v2.0 extension architecture
// Content script uses chrome.storage.local, message passing, autoRecover
// Legacy scripts (oficial, personalized, prueba) still validated for standalone use
var fs = require('fs');

var pass = 0, fail = 0;
function assert(name, condition, details) {
  if (condition) { console.log('  ✓ ' + name); pass++; }
  else { console.log('  ✗ ' + name + ' — ' + (details || '')); fail++; }
}

console.log('=== TEST: Extension v2.0 Architecture ===\n');

// ── Test 1: Session persistence logic ──
console.log('Test 1: Session persistence (pure logic)');

var storage = {};
function saveSession(convs, idx, sent, failed, errors) {
  storage['igDmSession'] = JSON.stringify({ conversations: convs, currentIndex: idx, sent: sent, failed: failed, errors: errors, timestamp: Date.now() });
}
function loadSession() {
  var d = storage['igDmSession']; return d ? JSON.parse(d) : null;
}
function clearSession() { delete storage['igDmSession']; }

var convs = [{ name: 'alice' }, { name: 'bob' }];
saveSession(convs, 1, 1, 0, []);
var s = loadSession();
assert('Session saved/loaded', s !== null);
assert('currentIndex: 1', s.currentIndex === 1);
assert('Next: bob', s.conversations[1].name === 'bob');
clearSession();
assert('Session cleared', loadSession() === null);
console.log();

// ── Test 2: content.js v2.0 compliance ──
console.log('Test 2: content.js v2.0 (chrome.storage, message passing, no eval)');

var contentJs = fs.readFileSync('/Volumes/SSD/malalts/ig-dm-extension/content/content.js', 'utf-8');
var contentNoComments = contentJs.replace(/\/\/.*$|\/\*[\s\S]*?\*\//gm, '');
var hasEval = /\beval\s*\(/.test(contentNoComments);
assert('No eval() in code', !hasEval, 'eval() blocked by MV3 CSP');
assert('Uses chrome.storage.local', contentJs.includes('chrome.storage.local'));
assert('Reads igDmConfig from storage', contentJs.includes("chrome.storage.local.get('igDmConfig')"));
assert('Writes igDmProgress to storage', contentJs.includes('igDmProgress'));
assert('Writes igDmSession for recovery', contentJs.includes('igDmSession'));
assert('Listens for START command', contentJs.includes("action === 'START'"));
assert('Listens for STOP command', contentJs.includes("action === 'STOP'"));
assert('Has autoRecover on load', contentJs.includes('async function autoRecover'));
assert('Has igDmSender', contentJs.includes('async function igDmSender'));
assert('Has igDmSender.confirm', contentJs.includes('igDmSender.confirm'));
assert('Supports personalized mode', contentJs.includes('_config.personalized'));
assert('Supports dry run', contentJs.includes('_config.dryRun'));
assert('Has writeMessage (4 methods)', contentJs.includes('async function writeMessage'));
assert('Has sendMessage', contentJs.includes('async function sendMessage'));
assert('Has parseTimestampToDays', contentJs.includes('function parseTimestampToDays'));
assert('Has checkForPopups (CAPTCHA)', contentJs.includes('function checkForPopups'));
assert('Has _running guard', contentJs.includes('var _running = false'));
assert('Listens for RESUME command', contentJs.includes("action === 'RESUME'"));
assert('STOP keeps session (no clearSession on stop)', !/if \(_stopFlag\)[^;]*clearSession/.test(contentJs));
assert('autoRecover respects stopped status', contentJs.includes("lastStatus === 'stopped'"));
console.log();

// ── Test 3: manifest.json v2.0 validation ──
console.log('Test 3: manifest.json v2.0');

var manifest = JSON.parse(fs.readFileSync('/Volumes/SSD/malalts/ig-dm-extension/manifest.json', 'utf-8'));
assert('manifest_version: 3', manifest.manifest_version === 3);
assert('version: 2.0', manifest.version === '2.0');
assert('Has storage permission', manifest.permissions.includes('storage'));
assert('Has tabs permission', manifest.permissions.includes('tabs'));
assert('Has host_permissions', Array.isArray(manifest.host_permissions));
assert('Has content_scripts', Array.isArray(manifest.content_scripts));
var cs = manifest.content_scripts[0];
assert('Loads core/defaults.js', cs.js.includes('core/defaults.js'));
assert('Loads core/storage.js', cs.js.includes('core/storage.js'));
assert('Loads content/content.js', cs.js.includes('content/content.js'));
assert('Matches instagram.com/direct', cs.matches.some(function (m) { return m.includes('instagram.com/direct'); }));
assert('run_at: document_idle', cs.run_at === 'document_idle');
assert('Has action popup', manifest.action && manifest.action.default_popup);
assert('Has service_worker', manifest.background && manifest.background.service_worker);
assert('Has icons', manifest.icons && manifest.icons['16'] && manifest.icons['48'] && manifest.icons['128']);
console.log();

// ── Test 4: Popup files ──
console.log('Test 4: Popup UI files');

assert('popup.html exists', fs.existsSync('/Volumes/SSD/malalts/ig-dm-extension/popup/popup.html'));
assert('popup.css exists', fs.existsSync('/Volumes/SSD/malalts/ig-dm-extension/popup/popup.css'));
assert('popup.js exists', fs.existsSync('/Volumes/SSD/malalts/ig-dm-extension/popup/popup.js'));

var popupJs = fs.readFileSync('/Volumes/SSD/malalts/ig-dm-extension/popup/popup.js', 'utf-8');
assert('Has handleStart', popupJs.includes('async function handleStart'));
assert('Has handleStop', popupJs.includes('async function handleStop'));
assert('Has handleResume', popupJs.includes('async function handleResume'));
assert('Has updateProgress', popupJs.includes('async function updateProgress'));
assert('Has saveConfig', popupJs.includes('async function saveConfig'));
assert('Has progress polling 500ms', popupJs.includes(', 500)') && popupJs.includes('setInterval'));
assert('Sends START via tabs.sendMessage', popupJs.includes("action: 'START'"));
assert('Sends STOP via tabs.sendMessage', popupJs.includes("action: 'STOP'"));
assert('Sends RESUME via tabs.sendMessage', popupJs.includes("action: 'RESUME'"));
assert('Has mode flags', popupJs.includes('MODE_FLAGS'));
assert('Reads config from storage', popupJs.includes("chrome.storage.local.get('igDmConfig')"));
assert('Has status dot states', popupJs.includes('status-dot') || popupJs.includes('statusDot'));

var popupHtml = fs.readFileSync('/Volumes/SSD/malalts/ig-dm-extension/popup/popup.html', 'utf-8');
assert('Has message textarea', popupHtml.includes('id="message"'));
assert('Has delay inputs', popupHtml.includes('id="delayMin"') && popupHtml.includes('id="delayMax"'));
assert('Has start/stop buttons', popupHtml.includes('id="startBtn"') && popupHtml.includes('id="stopBtn"'));
assert('Has progress section', popupHtml.includes('progressSection'));
assert('Has mode tabs', popupHtml.includes('id="modeTabs"'));
assert('Has resume banner', popupHtml.includes('id="resumeBanner"'));
assert('Has empty state', popupHtml.includes('id="emptyState"'));
assert('Has openDirect button', popupHtml.includes('id="openDirectBtn"'));
assert('Loads core scripts', popupHtml.includes('../core/defaults.js') && popupHtml.includes('../core/storage.js'));
console.log();

// ── Test 5: Service worker ──
console.log('Test 5: Service worker');

var sw = fs.readFileSync('/Volumes/SSD/malalts/ig-dm-extension/background/service-worker.js', 'utf-8');
assert('Has onInstalled', sw.includes('chrome.runtime.onInstalled'));
assert('Initializes config', sw.includes("chrome.storage.local.set"));
assert('Initializes progress', sw.includes('igDmProgress'));
console.log();

// ── Test 6: Legacy scripts still intact ──
console.log('Test 6: Legacy scripts (standalone mode)');

['oficial', 'personalized', 'prueba'].forEach(function (name) {
  var path = '/Volumes/SSD/malalts/scripts/ig-dm-' + name + '.js';
  assert(name + ': exists', fs.existsSync(path));
  var content = fs.readFileSync(path, 'utf-8');
  assert(name + ': has igDmSender', content.includes('function igDmSender') || content.includes('async function igDmSender'));
  assert(name + ': has stopIGDM', content.includes('stopIGDM'));
});
console.log();

// ── Test 7: Complete file inventory ──
console.log('Test 7: Complete file inventory');

var expected = [
  'manifest.json',
  'icons/icon16.png', 'icons/icon48.png', 'icons/icon128.png',
  'core/defaults.js', 'core/storage.js',
  'content/content.js',
  'background/service-worker.js',
  'popup/popup.html', 'popup/popup.css', 'popup/popup.js',
  'tests/test-schema.js'
];
var root = '/Volumes/SSD/malalts/ig-dm-extension';
expected.forEach(function (f) {
  assert(f + ' exists', fs.existsSync(root + '/' + f));
});
assert('Old content.js removed from root', !fs.existsSync(root + '/content.js'));
console.log();

// ── Summary ──
console.log('═══════════════════════════════════════════');
console.log('  TESTS: ' + pass + ' passed, ' + fail + ' failed');
console.log('═══════════════════════════════════════════');
process.exit(fail > 0 ? 1 : 0);
