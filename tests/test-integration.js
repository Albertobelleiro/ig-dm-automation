// Integration test with jsdom - simulates real Instagram DOM
const { JSDOM } = require('jsdom');
const fs = require('fs');

// Load the test HTML
const html = fs.readFileSync('./test-instagram-dm.html', 'utf-8');

const dom = new JSDOM(html, {
  url: 'https://www.instagram.com/direct/',
  runScripts: 'dangerously',
  resources: 'usable',
  pretendToBeVisual: true,
});

const { window } = dom;
const { document } = window;

// Mock execCommand for jsdom (not natively implemented)
// Track focused element manually since jsdom focus() is unreliable
let _mockFocusedEl = null;
const _origFocus = window.HTMLElement.prototype.focus;
window.HTMLElement.prototype.focus = function() {
  _mockFocusedEl = this;
  _origFocus.call(this);
};

document.execCommand = function(command, showUI, value) {
  if (command === 'insertText') {
    const active = _mockFocusedEl || document.activeElement;
    if (active && (active.isContentEditable || active.getAttribute('contenteditable') === 'true')) {
      active.textContent = (active.textContent || '') + (value || '');
      active.dispatchEvent(new window.Event('input', { bubbles: true }));
      return true;
    }
  }
  if (command === 'delete') {
    const active = _mockFocusedEl || document.activeElement;
    if (active && (active.isContentEditable || active.getAttribute('contenteditable') === 'true')) {
      active.textContent = '';
      active.dispatchEvent(new window.Event('input', { bubbles: true }));
      return true;
    }
  }
  return false;
};

// Wait for the page scripts to execute
setTimeout(() => {
  console.log('=== INTEGRATION TEST: Instagram DM Simulator ===\n');

  // Test 1: Verify conversations were rendered
  const convItems = document.querySelectorAll('.conv-item');
  console.log(`Test 1: Conversations rendered: ${convItems.length}`);
  console.log(`  Expected: 25, Got: ${convItems.length}`);
  console.log(`  Result: ${convItems.length === 25 ? 'PASS' : 'FAIL'}\n`);

  // Test 2: Find the message input (contenteditable)
  const input = document.querySelector('div[role="textbox"][contenteditable="true"]');
  console.log(`Test 2: Message input found`);
  console.log(`  role: ${input?.getAttribute('role')}`);
  console.log(`  contenteditable: ${input?.getAttribute('contenteditable')}`);
  console.log(`  aria-label: ${input?.getAttribute('aria-label')}`);
  console.log(`  Result: ${input ? 'PASS' : 'FAIL'}\n`);

  // Test 3: Find the Send button
  const sendBtn = document.querySelector('div[role="button"]');
  console.log(`Test 3: Send button found`);
  console.log(`  text: "${sendBtn?.textContent}"`);
  console.log(`  Result: ${sendBtn ? 'PASS' : 'FAIL'}\n`);

  // Test 4: Test execCommand insertText
  console.log(`Test 4: execCommand insertText`);
  input.focus();
  const testMsg = 'Test message 🎤🤠';
  const success = document.execCommand('insertText', false, testMsg);
  console.log(`  execCommand returned: ${success}`);
  console.log(`  Input content: "${input.textContent}"`);
  console.log(`  Result: ${input.textContent.includes('Test message') ? 'PASS' : 'FAIL'}\n`);

  // Clear input
  input.textContent = '';

  // Test 5: Test fallback - textContent + InputEvent
  console.log(`Test 5: Fallback textContent + InputEvent`);
  input.focus();
  input.textContent = testMsg;
  input.dispatchEvent(new window.InputEvent('input', {
    bubbles: true,
    cancelable: true,
    inputType: 'insertText',
    data: testMsg,
  }));
  console.log(`  Input content: "${input.textContent}"`);
  console.log(`  Result: ${input.textContent.includes('Test message') ? 'PASS' : 'FAIL'}\n`);

  // Clear input
  input.textContent = '';

  // Test 6: Test multi-line message with emojis and URL
  console.log(`Test 6: Multi-line message with emojis and URL`);
  const fullMsg = `VIERNES 17 LUAR LA L 🎤🎤
IMAGEN PAGANDO ENTRADA

SÁBADO 18 COWBOY 🤠
TU FIESTA FAVORITA HA LLEGADO.

RECUERDA RESERVAR TU PLAZA.
PULSERA VIP + CONSUMICIÓN
https://chat.whatsapp.com/K6nVfphXdVr5o9DAZInWYu?mode=gi_t`;

  input.focus();
  document.execCommand('insertText', false, fullMsg);
  const inputContent = input.textContent;
  console.log(`  Lines: ${inputContent.split('\n').length}`);
  console.log(`  Has emoji 🎤: ${inputContent.includes('🎤')}`);
  console.log(`  Has emoji 🤠: ${inputContent.includes('🤠')}`);
  console.log(`  Has URL: ${inputContent.includes('https://chat.whatsapp.com')}`);
  console.log(`  Has "VIERNES 17": ${inputContent.includes('VIERNES 17')}`);
  console.log(`  Has "SÁBADO 18": ${inputContent.includes('SÁBADO 18')}`);
  console.log(`  Result: ${inputContent === fullMsg ? 'PASS' : 'FAIL'}\n`);

  // Clear input
  input.textContent = '';

  // Test 7: Test clicking a conversation and verifying it opens
  console.log(`Test 7: Click conversation and verify chat opens`);
  const firstConv = convItems[0];
  const convName = firstConv.dataset.convDisplayName;
  firstConv.click();
  const headerName = document.getElementById('chatHeaderName').textContent;
  console.log(`  Clicked: ${convName}`);
  console.log(`  Header shows: ${headerName}`);
  console.log(`  Result: ${headerName === convName ? 'PASS' : 'FAIL'}\n`);

  // Test 8: Test send button activation after typing
  console.log(`Test 8: Send button activation`);
  input.focus();
  document.execCommand('insertText', false, 'Hello');
  // Simulate input event (React listener)
  input.dispatchEvent(new window.Event('input', { bubbles: true }));
  const sendBtnActive = document.getElementById('sendBtn');
  const isActive = sendBtnActive.classList.contains('active');
  console.log(`  Send button active: ${isActive}`);
  console.log(`  Result: ${isActive ? 'PASS' : 'FAIL'}\n`);

  // Test 9: Test sending message (click Send)
  console.log(`Test 9: Send message via button click`);
  const messagesBefore = document.querySelectorAll('.chat-msg.sent').length;
  sendBtnActive.click();
  const messagesAfter = document.querySelectorAll('.chat-msg.sent').length;
  const inputEmpty = input.textContent.trim().length === 0;
  console.log(`  Messages before: ${messagesBefore}, after: ${messagesAfter}`);
  console.log(`  Input empty after send: ${inputEmpty}`);
  console.log(`  Result: ${messagesAfter > messagesBefore && inputEmpty ? 'PASS' : 'FAIL'}\n`);

  // Test 10: Test Enter key to send
  console.log(`Test 10: Send message via Enter key`);
  input.focus();
  document.execCommand('insertText', false, 'Test via Enter');
  input.dispatchEvent(new window.Event('input', { bubbles: true }));
  const beforeEnter = document.querySelectorAll('.chat-msg.sent').length;
  input.dispatchEvent(new window.KeyboardEvent('keydown', {
    key: 'Enter', code: 'Enter', keyCode: 13, which: 13,
    bubbles: true, cancelable: true,
  }));
  const afterEnter = document.querySelectorAll('.chat-msg.sent').length;
  console.log(`  Messages before: ${beforeEnter}, after: ${afterEnter}`);
  console.log(`  Result: ${afterEnter > beforeEnter ? 'PASS' : 'FAIL'}\n`);

  // Test 11: Test timestamp parsing from DOM
  console.log(`Test 11: Timestamp parsing from DOM`);
  const timeElements = document.querySelectorAll('.conv-time');
  let timePass = 0, timeFail = 0;
  timeElements.forEach((el, i) => {
    const timeText = el.textContent.trim();
    const conv = convItems[i];
    const expectedDays = parseInt(conv.dataset.convTimeDays);
    
    // Parse using our function
    function parseTimestampToDays(timeText) {
      if (!timeText) return 999;
      const t = timeText.trim().toLowerCase();
      if (t === 'now' || t === 'active now' || t === 'active') return 0;
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
    
    const parsed = parseTimestampToDays(timeText);
    if (parsed === expectedDays) {
      timePass++;
    } else {
      timeFail++;
      console.log(`  ✗ "${timeText}" → ${parsed} (expected ${expectedDays})`);
    }
  });
  console.log(`  Parsed ${timeElements.length} timestamps: ${timePass} correct, ${timeFail} wrong`);
  console.log(`  Result: ${timeFail === 0 ? 'PASS' : 'FAIL'}\n`);

  // Test 12: Test group detection
  console.log(`Test 12: Group detection`);
  const groupConvs = [...convItems].filter(item => item.dataset.isGroup === 'true');
  console.log(`  Group conversations found: ${groupConvs.length}`);
  console.log(`  Expected: 2 (grupo_fiesta, grupo_chicas)`);
  console.log(`  Result: ${groupConvs.length === 2 ? 'PASS' : 'FAIL'}\n`);

  // Test 13: Test filtering (3 weeks = 21 days, skip groups)
  console.log(`Test 13: Full filtering (3 weeks, skip groups)`);
  const maxDays = 21;
  const filtered = [...convItems].filter(item => {
    const days = parseInt(item.dataset.convTimeDays);
    const isGroup = item.dataset.isGroup === 'true';
    return days <= maxDays && !isGroup;
  });
  console.log(`  Total: ${convItems.length}, Filtered: ${filtered.length}`);
  console.log(`  Expected: 20 (25 total - 2 groups - 3 older than 21 days)`);
  filtered.forEach((item, i) => {
    console.log(`    ${i + 1}. ${item.dataset.convDisplayName} (${item.dataset.convTime}, ${item.dataset.convTimeDays}d)`);
  });
  console.log(`  Result: ${filtered.length === 20 ? 'PASS' : 'FAIL'}\n`);

  // Summary
  console.log('═══════════════════════════════════════════');
  console.log('  INTEGRATION TESTS COMPLETE');
  console.log('═══════════════════════════════════════════');
  
  process.exit(0);
}, 2000);
