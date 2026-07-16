// Unit tests: defaults, storage schema, and key consistency
// Run: node ig-dm-extension/tests/test-schema.js
var fs = require('fs');
var path = require('path');

var pass = 0, fail = 0;
function assert(name, condition, detail) {
  if (condition) { console.log('  ✓ ' + name); pass++; }
  else { console.log('  ✗ ' + name + ' — ' + (detail || '')); fail++; }
}

console.log('=== Schema & Integration Tests ===\n');

// ── Test 1: Defaults schema ──
console.log('Test 1: Defaults schema');
var defaultsPath = path.join(__dirname, '..', 'core', 'defaults.js');
var defaultsContent = fs.readFileSync(defaultsPath, 'utf-8');

// Simulate loading defaults
eval(defaultsContent);

assert('DEFAULTS exists', typeof DEFAULTS === 'object');
assert('DEFAULTS.message is string', typeof DEFAULTS.message === 'string');
assert('DEFAULTS.personalized is boolean', typeof DEFAULTS.personalized === 'boolean');
assert('DEFAULTS.delayMin is number', typeof DEFAULTS.delayMin === 'number');
assert('DEFAULTS.delayMax is number', typeof DEFAULTS.delayMax === 'number');
assert('DEFAULTS.maxMessages is number', typeof DEFAULTS.maxMessages === 'number');
assert('DEFAULTS.weeksBack is number', typeof DEFAULTS.weeksBack === 'number');
assert('DEFAULTS.skipGroups is boolean', typeof DEFAULTS.skipGroups === 'boolean');
assert('DEFAULTS.dryRun is boolean', typeof DEFAULTS.dryRun === 'boolean');
assert('DEFAULTS.maxScrolls is number', typeof DEFAULTS.maxScrolls === 'number');

assert('DEFAULT_PROGRESS exists', typeof DEFAULT_PROGRESS === 'object');
assert('DEFAULT_PROGRESS.status is idle', DEFAULT_PROGRESS.status === 'idle');
assert('DEFAULT_PROGRESS.total is 0', DEFAULT_PROGRESS.total === 0);
assert('DEFAULT_PROGRESS.current is 0', DEFAULT_PROGRESS.current === 0);
assert('DEFAULT_PROGRESS.sent is 0', DEFAULT_PROGRESS.sent === 0);
assert('DEFAULT_PROGRESS.failed is 0', DEFAULT_PROGRESS.failed === 0);
assert('DEFAULT_PROGRESS.errors is array', Array.isArray(DEFAULT_PROGRESS.errors));
console.log();

// ── Test 2: Storage module exists ──
console.log('Test 2: Storage module structure');
var storagePath = path.join(__dirname, '..', 'core', 'storage.js');
var storageContent = fs.readFileSync(storagePath, 'utf-8');
assert('Storage exists', storageContent.includes('var Storage'));
assert('Has getConfig', storageContent.includes('getConfig:'));
assert('Has setConfig', storageContent.includes('setConfig:'));
assert('Has getProgress', storageContent.includes('getProgress:'));
assert('Has setProgress', storageContent.includes('setProgress:'));
assert('Has getSession', storageContent.includes('getSession:'));
assert('Has setSession', storageContent.includes('setSession:'));
assert('Has clearSession', storageContent.includes('clearSession:'));
assert('Has initDefaults', storageContent.includes('initDefaults:'));
console.log();

// ── Test 3: Content script structure ──
console.log('Test 3: Content script structure');
var contentPath = path.join(__dirname, '..', 'content', 'content.js');
var contentContent = fs.readFileSync(contentPath, 'utf-8');
var contentLines = contentContent.split('\n').length;
assert('Content script >800 lines', contentLines > 800, 'got ' + contentLines + ' lines');
assert('Has loadConfig', contentContent.includes('async function loadConfig'));
assert('Has saveProgress', contentContent.includes('async function saveProgress'));
assert('Has saveSession', contentContent.includes('async function saveSession'));
assert('Has loadSession', contentContent.includes('async function loadSession'));
assert('Has igDmSender', contentContent.includes('async function igDmSender'));
assert('Has confirm', contentContent.includes('igDmSender.confirm'));
assert('Has autoRecover', contentContent.includes('async function autoRecover'));
assert('Has START listener', contentContent.includes("msg.action === 'START'"));
assert('Has STOP listener', contentContent.includes("msg.action === 'STOP'"));
assert('Has personalized support', contentContent.includes('_config.personalized'));
assert('Has dryRun support', contentContent.includes('_config.dryRun'));
assert('Has writeMessage', contentContent.includes('async function writeMessage'));
assert('Has sendMessage', contentContent.includes('async function sendMessage'));
assert('Has parseTimestampToDays', contentContent.includes('function parseTimestampToDays'));
assert('No eval() in actual code', !/^\s*eval\s*\(/.test(contentContent.split('\n').filter(function(l) { return !/^\s*\/\//.test(l) && !/^\s*\*/.test(l); }).join('\n')));
console.log();

// ── Test 4: Popup files exist ──
console.log('Test 4: Popup files');
var popupHtml = path.join(__dirname, '..', 'popup', 'popup.html');
var popupCss = path.join(__dirname, '..', 'popup', 'popup.css');
var popupJs = path.join(__dirname, '..', 'popup', 'popup.js');
assert('popup.html exists', fs.existsSync(popupHtml));
assert('popup.css exists', fs.existsSync(popupCss));
assert('popup.js exists', fs.existsSync(popupJs));
var popupJsContent = fs.readFileSync(popupJs, 'utf-8');
assert('Has handleStart', popupJsContent.includes('async function handleStart'));
assert('Has handleStop', popupJsContent.includes('async function handleStop'));
assert('Has handleResume', popupJsContent.includes('async function handleResume'));
assert('Has updateProgress', popupJsContent.includes('async function updateProgress'));
assert('Has saveConfig', popupJsContent.includes('async function saveConfig'));
assert('Has mode support', popupJsContent.includes('MODE_FLAGS') && popupJsContent.includes('setMode'));
assert('Has RESUME action', popupJsContent.includes("action: 'RESUME'"));
assert('Has progress polling 500ms', popupJsContent.includes(', 500)') && popupJsContent.includes('setInterval'));
console.log();

// ── Test 5: Manifest validation ──
console.log('Test 5: Manifest validation');
var manifestPath = path.join(__dirname, '..', 'manifest.json');
var manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
assert('manifest_version: 3', manifest.manifest_version === 3);
assert('version: 2.0', manifest.version === '2.0');
assert('Has storage permission', manifest.permissions.includes('storage'));
assert('Has tabs permission', manifest.permissions.includes('tabs'));
assert('Has host_permissions', Array.isArray(manifest.host_permissions));
assert('Has service_worker', manifest.background && manifest.background.service_worker);
assert('Has content_scripts', Array.isArray(manifest.content_scripts));
assert('Content scripts load defaults.js', manifest.content_scripts[0].js.includes('core/defaults.js'));
assert('Content scripts load storage.js', manifest.content_scripts[0].js.includes('core/storage.js'));
assert('Content scripts load content.js', manifest.content_scripts[0].js.includes('content/content.js'));
assert('Has action popup', manifest.action && manifest.action.default_popup);
console.log();

// ── Test 6: All files present ──
console.log('Test 6: Complete file inventory');
var extRoot = path.join(__dirname, '..');
var expectedFiles = [
  'manifest.json',
  'icons/icon16.png',
  'icons/icon48.png',
  'icons/icon128.png',
  'core/defaults.js',
  'core/storage.js',
  'content/content.js',
  'background/service-worker.js',
  'popup/popup.html',
  'popup/popup.css',
  'popup/popup.js'
];
expectedFiles.forEach(function (f) {
  assert(f + ' exists', fs.existsSync(path.join(extRoot, f)));
});
console.log();

// ── Test 7: No legacy files ──
console.log('Test 7: No legacy files');
assert('Old content.js removed', !fs.existsSync(path.join(extRoot, 'content.js')));
console.log();

// ── Summary ──
console.log('═══════════════════════════════════════════');
console.log('  TESTS: ' + pass + ' passed, ' + fail + ' failed');
console.log('═══════════════════════════════════════════');
process.exit(fail > 0 ? 1 : 0);
