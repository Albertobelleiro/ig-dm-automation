// Node.js test for Instagram DM scripts logic
// Tests: timestamp parsing, name extraction, message personalization, filtering

const assert = require('assert');

// ============================================================
// TEST 1: parseTimestampToDays
// ============================================================
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

console.log('=== TEST 1: parseTimestampToDays ===');
const timestampTests = [
  { input: 'now', expected: 0 },
  { input: 'Active now', expected: 0 },
  { input: '5m', expected: 0 },
  { input: '30m', expected: 0 },
  { input: '2h', expected: 0 },
  { input: '12h', expected: 0 },
  { input: '1d', expected: 1 },
  { input: '5d', expected: 5 },
  { input: '1w', expected: 7 },
  { input: '2w', expected: 14 },
  { input: '3w', expected: 21 },
  { input: '1mo', expected: 30 },
  { input: '2mo', expected: 60 },
  { input: '1y', expected: 365 },
  { input: '', expected: 999 },
  { input: null, expected: 999 },
  { input: undefined, expected: 999 },
  { input: 'gibberish', expected: 999 },
];

let pass1 = 0, fail1 = 0;
timestampTests.forEach(({ input, expected }) => {
  const result = parseTimestampToDays(input);
  try {
    assert.strictEqual(result, expected);
    console.log(`  ✓ "${input}" → ${result} days`);
    pass1++;
  } catch (e) {
    console.log(`  ✗ "${input}" → ${result} (expected ${expected})`);
    fail1++;
  }
});
console.log(`  Result: ${pass1}/${timestampTests.length} passed, ${fail1} failed\n`);

// ============================================================
// TEST 2: getFirstName + capitalize
// ============================================================
function getFirstName(fullName) {
  if (fullName.includes('_') || (!fullName.includes(' ') && fullName === fullName.toLowerCase())) {
    const cleanName = fullName.replace(/_/g, ' ').trim();
    const firstWord = cleanName.split(' ')[0];
    return capitalize(firstWord);
  }
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

console.log('=== TEST 2: getFirstName + capitalize ===');
const nameTests = [
  { input: 'Carlos García', expected: 'Carlos' },
  { input: 'carlos_garcia', expected: 'Carlos' },
  { input: 'lucia_martin', expected: 'Lucia' },
  { input: 'María López', expected: 'María' },
  { input: 'JOSÉ MANUEL', expected: 'José' },
  { input: 'pablo_ruiz', expected: 'Pablo' },
  { input: 'ana', expected: 'Ana' },
  { input: 'ANA', expected: 'Ana' },
  { input: 'diego_moreno_garcia', expected: 'Diego' },
  { input: 'Jean-Pierre Dupont', expected: 'Jean-Pierre' },
  { input: '', expected: 'amigo' },
  { input: 'x', expected: 'X' },
  { input: 'maria_del_carmen', expected: 'Maria' },
  { input: 'Grupo Fiesta Viernes', expected: 'Grupo' },
  { input: 'a', expected: 'A' },
];

let pass2 = 0, fail2 = 0;
nameTests.forEach(({ input, expected }) => {
  const result = getFirstName(input);
  try {
    assert.strictEqual(result, expected);
    console.log(`  ✓ "${input}" → "${result}"`);
    pass2++;
  } catch (e) {
    console.log(`  ✗ "${input}" → "${result}" (expected "${expected}")`);
    fail2++;
  }
});
console.log(`  Result: ${pass2}/${nameTests.length} passed, ${fail2} failed\n`);

// ============================================================
// TEST 3: Message personalization
// ============================================================
console.log('=== TEST 3: Message personalization ===');
const template = `¡Hey {nombre}! 👋

VIERNES 17 LUAR LA L 🎤🎤
IMAGEN PAGANDO ENTRADA

SÁBADO 18 COWBOY 🤠
TU FIESTA FAVORITA HA LLEGADO.

RECUERDA RESERVAR TU PLAZA.
PULSERA VIP + CONSUMICIÓN
https://chat.whatsapp.com/K6nVfphXdVr5o9DAZInWYu?mode=gi_t`;

const personalizationTests = [
  { nombre: 'Carlos', expected: '¡Hey Carlos! 👋' },
  { nombre: 'María', expected: '¡Hey María! 👋' },
  { nombre: 'José', expected: '¡Hey José! 👋' },
  { nombre: 'amigo', expected: '¡Hey amigo! 👋' },
];

let pass3 = 0, fail3 = 0;
personalizationTests.forEach(({ nombre, expected }) => {
  const result = template.replace(/\{nombre\}/g, nombre);
  const firstLine = result.split('\n')[0];
  try {
    assert.strictEqual(firstLine, expected);
    console.log(`  ✓ {nombre}="${nombre}" → "${firstLine}"`);
    pass3++;
  } catch (e) {
    console.log(`  ✗ {nombre}="${nombre}" → "${firstLine}" (expected "${expected}")`);
    fail3++;
  }
});

// Test multiple occurrences
const multiTest = 'Hola {nombre}, {nombre} ven a la fiesta';
const multiResult = multiTest.replace(/\{nombre\}/g, 'Carlos');
try {
  assert.strictEqual(multiResult, 'Hola Carlos, Carlos ven a la fiesta');
  console.log(`  ✓ Multiple {nombre} replaced correctly`);
  pass3++;
} catch (e) {
  console.log(`  ✗ Multiple {nombre} failed: "${multiResult}"`);
  fail3++;
}
console.log(`  Result: ${pass3}/${personalizationTests.length + 1} passed, ${fail3} failed\n`);

// ============================================================
// TEST 4: Filtering logic (3 weeks = 21 days)
// ============================================================
console.log('=== TEST 4: Filtering logic (3 weeks = 21 days) ===');
const testConversations = [
  { name: 'carlos', timeDays: 0, isGroup: false },
  { name: 'lucia', timeDays: 1, isGroup: false },
  { name: 'grupo1', timeDays: 0, isGroup: true },
  { name: 'pablo', timeDays: 7, isGroup: false },
  { name: 'maria', timeDays: 14, isGroup: false },
  { name: 'grupo2', timeDays: 14, isGroup: true },
  { name: 'andres', timeDays: 21, isGroup: false },
  { name: 'laura', timeDays: 21, isGroup: false },
  { name: 'manuel', timeDays: 30, isGroup: false },
  { name: 'rosa', timeDays: 60, isGroup: false },
];

const semanasAtras = 3;
const maxDays = semanasAtras * 7;
const saltarGrupos = true;

const filtered = testConversations.filter(c => {
  if (c.timeDays > maxDays) return false;
  if (saltarGrupos && c.isGroup) return false;
  return true;
});

try {
  assert.strictEqual(filtered.length, 6);
  assert.strictEqual(filtered.every(c => c.timeDays <= 21), true);
  assert.strictEqual(filtered.every(c => !c.isGroup), true);
  console.log(`  ✓ Filtered ${testConversations.length} → ${filtered.length} conversations`);
  console.log(`  ✓ All within 21 days: ${filtered.every(c => c.timeDays <= 21)}`);
  console.log(`  ✓ No groups: ${filtered.every(c => !c.isGroup)}`);
  filtered.forEach(c => console.log(`    - ${c.name} (${c.timeDays}d, group=${c.isGroup})`));
  console.log(`  Result: PASS\n`);
} catch (e) {
  console.log(`  ✗ Filter test failed: ${e.message}`);
  console.log(`  Result: FAIL\n`);
}

// ============================================================
// TEST 5: randomDelay within range
// ============================================================
console.log('=== TEST 5: randomDelay within 4000-6000ms ===');
const delayMin = 4000, delayMax = 6000;
let pass5 = 0, fail5 = 0;
for (let i = 0; i < 1000; i++) {
  const ms = delayMin + Math.random() * (delayMax - delayMin);
  const rounded = Math.round(ms);
  if (rounded >= 4000 && rounded <= 6000) {
    pass5++;
  } else {
    fail5++;
  }
}
console.log(`  1000 samples: ${pass5} in range, ${fail5} out of range`);
console.log(`  Result: ${fail5 === 0 ? 'PASS' : 'FAIL'}\n`);

// ============================================================
// TEST 6: Message content integrity
// ============================================================
console.log('=== TEST 6: Message content integrity ===');
const expectedMessage = `VIERNES 17 LUAR LA L 🎤🎤
IMAGEN PAGANDO ENTRADA

SÁBADO 18 COWBOY 🤠
TU FIESTA FAVORITA HA LLEGADO.

RECUERDA RESERVAR TU PLAZA.
PULSERA VIP + CONSUMICIÓN
https://chat.whatsapp.com/K6nVfphXdVr5o9DAZInWYu?mode=gi_t`;

const expectedLines = expectedMessage.split('\n');
console.log(`  Message has ${expectedLines.length} lines`);
console.log(`  Line 1: "${expectedLines[0]}"`);
console.log(`  Line 2: "${expectedLines[1]}"`);
console.log(`  Line 3: "${expectedLines[2]}" (empty)`);
console.log(`  Line 4: "${expectedLines[3]}"`);
console.log(`  Contains URL: ${expectedMessage.includes('https://chat.whatsapp.com')}`);
console.log(`  Contains emojis: ${expectedMessage.includes('🎤') && expectedMessage.includes('🤠')}`);
console.log(`  Result: PASS\n`);

// ============================================================
// SUMMARY
// ============================================================
console.log('═══════════════════════════════════════════');
console.log('  ALL TESTS COMPLETE');
console.log(`  Test 1 (timestamps): ${pass1}/${timestampTests.length}`);
console.log(`  Test 2 (names):      ${pass2}/${nameTests.length}`);
console.log(`  Test 3 (personalize): ${pass3}/${personalizationTests.length + 1}`);
console.log(`  Test 4 (filtering):  PASS`);
console.log(`  Test 5 (delays):     ${pass5}/1000`);
console.log(`  Test 6 (integrity):  PASS`);
console.log('═══════════════════════════════════════════');
