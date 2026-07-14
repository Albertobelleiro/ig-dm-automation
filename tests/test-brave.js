const WebSocket = require('ws');
const fs = require('fs');
const http = require('http');

// Get the page WebSocket URL
function getPageWsUrl() {
  return new Promise((resolve, reject) => {
    http.get('http://localhost:9222/json/list', (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const pages = JSON.parse(data);
          const page = pages.find(p => p.url.includes('test-instagram-dm'));
          resolve(page ? page.webSocketDebuggerUrl : null);
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

// Send CDP command
function sendCommand(ws, method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = Math.floor(Math.random() * 1000000);
    const handler = (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.id === id) {
        ws.removeListener('message', handler);
        if (msg.error) reject(new Error(JSON.stringify(msg.error)));
        else resolve(msg.result);
      }
    };
    ws.on('message', handler);
    ws.send(JSON.stringify({ id, method, params }));
  });
}

// Evaluate JS in the page
async function evaluate(ws, expression) {
  const result = await sendCommand(ws, 'Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  return result.result.value;
}

async function main() {
  console.log('Connecting to Brave...\n');
  const wsUrl = await getPageWsUrl();
  if (!wsUrl) {
    console.error('No page found. Make sure test-instagram-dm.html is open in Brave.');
    process.exit(1);
  }
  console.log('Connected to:', wsUrl, '\n');

  const ws = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => {
    ws.on('open', resolve);
    ws.on('error', reject);
  });

  // Enable Runtime
  await sendCommand(ws, 'Runtime.enable');

  // Read the generic script
  const genericScript = fs.readFileSync('./ig-dm-generic.js', 'utf-8');
  // Read the personalized script
  const personalizedScript = fs.readFileSync('./ig-dm-personalized.js', 'utf-8');

  // ============================================================
  // TEST SUITE
  // ============================================================
  console.log('=== REAL BROWSER TEST: Instagram DM Scripts ===\n');

  // Test 1: Page loaded correctly
  console.log('Test 1: Page loaded');
  const title = await evaluate(ws, 'document.title');
  console.log(`  Title: "${title}"`);
  console.log(`  Result: ${title === 'Instagram DM Simulator' ? 'PASS' : 'FAIL'}\n`);

  // Test 2: Conversations rendered
  console.log('Test 2: Conversations rendered');
  const convCount = await evaluate(ws, 'document.querySelectorAll(".conv-item").length');
  console.log(`  Count: ${convCount}`);
  console.log(`  Result: ${convCount === 25 ? 'PASS' : 'FAIL'}\n`);

  // Test 3: Message input found with correct attributes
  console.log('Test 3: Message input (contenteditable)');
  const inputInfo = await evaluate(ws, `(() => {
    const el = document.querySelector('div[role="textbox"][contenteditable="true"]');
    if (!el) return null;
    return {
      role: el.getAttribute('role'),
      contenteditable: el.getAttribute('contenteditable'),
      ariaLabel: el.getAttribute('aria-label'),
      hasLexical: el.hasAttribute('data-lexical-editor'),
    };
  })()`);
  console.log(`  role: ${inputInfo?.role}`);
  console.log(`  contenteditable: ${inputInfo?.contenteditable}`);
  console.log(`  aria-label: ${inputInfo?.ariaLabel}`);
  console.log(`  data-lexical-editor: ${inputInfo?.hasLexical}`);
  console.log(`  Result: ${inputInfo?.role === 'textbox' && inputInfo?.contenteditable === 'true' ? 'PASS' : 'FAIL'}\n`);

  // Test 4: execCommand insertText (REAL browser, not mocked)
  console.log('Test 4: execCommand insertText (real browser)');
  const execResult = await evaluate(ws, `(() => {
    const input = document.querySelector('div[role="textbox"][contenteditable="true"]');
    input.focus();
    input.textContent = '';
    const success = document.execCommand('insertText', false, 'Test message 🎤🤠');
    return { success, content: input.textContent, length: input.textContent.length };
  })()`);
  console.log(`  execCommand returned: ${execResult.success}`);
  console.log(`  Content: "${execResult.content}"`);
  console.log(`  Length: ${execResult.length}`);
  console.log(`  Result: ${execResult.content.includes('Test message') && execResult.content.includes('🎤') ? 'PASS' : 'FAIL'}\n`);

  // Test 5: Multi-line message with emojis and URL
  console.log('Test 5: Multi-line message with emojis and URL');
  const multiResult = await evaluate(ws, `(() => {
    const input = document.querySelector('div[role="textbox"][contenteditable="true"]');
    input.focus();
    input.textContent = '';
    const msg = 'VIERNES 17 LUAR LA L 🎤🎤\\nIMAGEN PAGANDO ENTRADA\\n\\nSÁBADO 18 COWBOY 🤠\\nTU FIESTA FAVORITA HA LLEGADO.\\n\\nRECUERDA RESERVAR TU PLAZA.\\nPULSERA VIP + CONSUMICIÓN\\nhttps://chat.whatsapp.com/K6nVfphXdVr5o9DAZInWYu?mode=gi_t';
    document.execCommand('insertText', false, msg);
    const content = input.textContent;
    // In a real contenteditable, \\n may become <br> or <div> tags
    // Check innerHTML for <br> or <div> as line breaks
    const html = input.innerHTML;
    const hasBrOrDiv = html.includes('<br') || html.includes('<div');
    return {
      textLines: content.split('\\n').length,
      hasBrOrDiv: hasBrOrDiv,
      hasEmoji1: content.includes('🎤'),
      hasEmoji2: content.includes('🤠'),
      hasURL: content.includes('https://chat.whatsapp.com'),
      hasVIERNES: content.includes('VIERNES 17'),
      hasSABADO: content.includes('SÁBADO 18'),
      content: content,
      html: html.substring(0, 200),
    };
  })()`);
  console.log(`  Text lines: ${multiResult.textLines}`);
  console.log(`  Has <br>/<div> in HTML: ${multiResult.hasBrOrDiv}`);
  console.log(`  Has 🎤: ${multiResult.hasEmoji1}`);
  console.log(`  Has 🤠: ${multiResult.hasEmoji2}`);
  console.log(`  Has URL: ${multiResult.hasURL}`);
  console.log(`  Has "VIERNES 17": ${multiResult.hasVIERNES}`);
  console.log(`  Has "SÁBADO 18": ${multiResult.hasSABADO}`);
  console.log(`  HTML preview: ${multiResult.html.substring(0, 100)}...`);
  // PASS if all content is present (regardless of line break format)
  const test5Pass = multiResult.hasEmoji1 && multiResult.hasEmoji2 && multiResult.hasURL && multiResult.hasVIERNES && multiResult.hasSABADO;
  console.log(`  Result: ${test5Pass ? 'PASS' : 'FAIL'}\n`);

  // Test 6: Send button activates after typing
  console.log('Test 6: Send button activation');
  const btnResult = await evaluate(ws, `(() => {
    const input = document.querySelector('div[role="textbox"][contenteditable="true"]');
    input.focus();
    input.textContent = '';
    document.execCommand('insertText', false, 'Hello');
    // Dispatch input event (simulator listens for this)
    input.dispatchEvent(new Event('input', { bubbles: true }));
    const btn = document.getElementById('sendBtn');
    return { active: btn.classList.contains('active'), opacity: window.getComputedStyle(btn).opacity };
  })()`);
  console.log(`  Active class: ${btnResult.active}`);
  console.log(`  Opacity: ${btnResult.opacity}`);
  console.log(`  Result: ${btnResult.active ? 'PASS' : 'FAIL'}\n`);

  // Test 7: Send message via button click
  console.log('Test 7: Send message via button click');
  const sendResult = await evaluate(ws, `(() => {
    const input = document.querySelector('div[role="textbox"][contenteditable="true"]');
    input.focus();
    input.textContent = '';
    document.execCommand('insertText', false, 'Test send via button');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    const before = document.querySelectorAll('.chat-msg.sent').length;
    const btn = document.getElementById('sendBtn');
    btn.click();
    const after = document.querySelectorAll('.chat-msg.sent').length;
    const inputEmpty = input.textContent.trim().length === 0;
    return { before, after, inputEmpty, sentText: document.querySelectorAll('.chat-msg.sent')[after-1]?.textContent };
  })()`);
  console.log(`  Messages before: ${sendResult.before}, after: ${sendResult.after}`);
  console.log(`  Input empty: ${sendResult.inputEmpty}`);
  console.log(`  Sent text: "${sendResult.sentText}"`);
  console.log(`  Result: ${sendResult.after > sendResult.before && sendResult.inputEmpty ? 'PASS' : 'FAIL'}\n`);

  // Test 8: Send message via Enter key
  console.log('Test 8: Send message via Enter key');
  const enterResult = await evaluate(ws, `(() => {
    const input = document.querySelector('div[role="textbox"][contenteditable="true"]');
    input.focus();
    input.textContent = '';
    document.execCommand('insertText', false, 'Test send via Enter');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    const before = document.querySelectorAll('.chat-msg.sent').length;
    input.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Enter', code: 'Enter', keyCode: 13, which: 13,
      bubbles: true, cancelable: true,
    }));
    const after = document.querySelectorAll('.chat-msg.sent').length;
    return { before, after };
  })()`);
  console.log(`  Messages before: ${enterResult.before}, after: ${enterResult.after}`);
  console.log(`  Result: ${enterResult.after > enterResult.before ? 'PASS' : 'FAIL'}\n`);

  // Test 9: Click conversation and verify it opens
  console.log('Test 9: Click conversation opens chat');
  const clickResult = await evaluate(ws, `(() => {
    const items = document.querySelectorAll('.conv-item');
    const third = items[2]; // Lucía Martín
    third.click();
    return {
      name: third.dataset.convDisplayName,
      header: document.getElementById('chatHeaderName').textContent,
    };
  })()`);
  console.log(`  Clicked: ${clickResult.name}`);
  console.log(`  Header: ${clickResult.header}`);
  console.log(`  Result: ${clickResult.name === clickResult.header ? 'PASS' : 'FAIL'}\n`);

  // Test 10: Timestamp parsing from real DOM
  console.log('Test 10: Timestamp parsing from DOM');
  const timeResult = await evaluate(ws, `(() => {
    function parseTimestampToDays(timeText) {
      if (!timeText) return 999;
      const t = timeText.trim().toLowerCase();
      if (t === 'now' || t === 'active now' || t === 'active') return 0;
      let mo = t.match(/^(\\d+)\\s*mo/);
      if (mo) return parseInt(mo[1]) * 30;
      let m = t.match(/^(\\d+)\\s*m\\b/);
      if (m) return 0;
      let h = t.match(/^(\\d+)\\s*h/);
      if (h) return 0;
      let d = t.match(/^(\\d+)\\s*d/);
      if (d) return parseInt(d[1]);
      let w = t.match(/^(\\d+)\\s*w/);
      if (w) return parseInt(w[1]) * 7;
      let y = t.match(/^(\\d+)\\s*y/);
      if (y) return parseInt(y[1]) * 365;
      return 999;
    }
    const items = document.querySelectorAll('.conv-item');
    let correct = 0, wrong = 0;
    const details = [];
    items.forEach(item => {
      const timeEl = item.querySelector('.conv-time');
      const timeText = timeEl ? timeEl.textContent.trim() : '';
      const expected = parseInt(item.dataset.convTimeDays);
      const parsed = parseTimestampToDays(timeText);
      if (parsed === expected) correct++;
      else { wrong++; details.push({ timeText, expected, parsed }); }
    });
    return { total: items.length, correct, wrong, details };
  })()`);
  console.log(`  Total: ${timeResult.total}, Correct: ${timeResult.correct}, Wrong: ${timeResult.wrong}`);
  if (timeResult.details.length > 0) {
    timeResult.details.forEach(d => console.log(`  ✗ "${d.timeText}" → ${d.parsed} (expected ${d.expected})`));
  }
  console.log(`  Result: ${timeResult.wrong === 0 ? 'PASS' : 'FAIL'}\n`);

  // Test 11: Group detection
  console.log('Test 11: Group detection');
  const groupResult = await evaluate(ws, `(() => {
    const items = document.querySelectorAll('.conv-item');
    const groups = [...items].filter(i => i.dataset.isGroup === 'true');
    return { total: items.length, groups: groups.length, groupNames: groups.map(g => g.dataset.convDisplayName) };
  })()`);
  console.log(`  Total: ${groupResult.total}, Groups: ${groupResult.groups}`);
  console.log(`  Group names: ${groupResult.groupNames.join(', ')}`);
  console.log(`  Result: ${groupResult.groups === 2 ? 'PASS' : 'FAIL'}\n`);

  // Test 12: Full filtering (3 weeks, skip groups)
  console.log('Test 12: Full filtering (3 weeks, skip groups)');
  const filterResult = await evaluate(ws, `(() => {
    const items = document.querySelectorAll('.conv-item');
    const maxDays = 21;
    const filtered = [...items].filter(item => {
      const days = parseInt(item.dataset.convTimeDays);
      const isGroup = item.dataset.isGroup === 'true';
      return days <= maxDays && !isGroup;
    });
    return { total: items.length, filtered: filtered.length, names: filtered.map(f => f.dataset.convDisplayName + ' (' + f.dataset.convTime + ')') };
  })()`);
  console.log(`  Total: ${filterResult.total}, Filtered: ${filterResult.filtered}`);
  filterResult.names.forEach((n, i) => console.log(`    ${i+1}. ${n}`));
  console.log(`  Result: ${filterResult.filtered === 20 ? 'PASS' : 'FAIL'}\n`);

  // Test 13: Load and run the GENERIC script
  console.log('Test 13: Load generic script');
  // We need to inject the script but NOT auto-run igDmSender
  // The script just defines functions and prints a message
  const genericLoadResult = await evaluate(ws, `(() => {
    try {
      ${genericScript}
      return { loaded: true, configExists: typeof IG_DM_CONFIG !== 'undefined', senderExists: typeof igDmSender === 'function', stopExists: typeof stopIGDM === 'function' };
    } catch(e) {
      return { loaded: false, error: e.message };
    }
  })()`);
  console.log(`  Loaded: ${genericLoadResult.loaded}`);
  console.log(`  IG_DM_CONFIG exists: ${genericLoadResult.configExists}`);
  console.log(`  igDmSender exists: ${genericLoadResult.senderExists}`);
  console.log(`  stopIGDM exists: ${genericLoadResult.stopExists}`);
  console.log(`  Result: ${genericLoadResult.loaded && genericLoadResult.configExists && genericLoadResult.senderExists ? 'PASS' : 'FAIL'}\n`);

  // Test 14: Run igDmSender() in dry-run mode
  console.log('Test 14: Run igDmSender() in dry-run mode');
  // Set dryRun to true for safety
  await evaluate(ws, 'IG_DM_CONFIG.dryRun = true; IG_DM_CONFIG.maxMensajes = 3;');
  // Run igDmSender without awaitPromise (it returns a pending Promise)
  await sendCommand(ws, 'Runtime.evaluate', {
    expression: 'igDmSender();',
    awaitPromise: false,
  });
  // Wait for it to process
  await new Promise(r => setTimeout(r, 5000));
  const dryRunResult = await evaluate(ws, `(() => {
    const pending = window._igDmPending;
    if (pending) {
      return {
        pendingCount: pending.length,
        firstThree: pending.slice(0, 3).map(c => ({ name: c.name, timeDays: c.timeDays, isGroup: c.isGroup })),
      };
    }
    return { pendingCount: 0, error: 'No pending conversations' };
  })()`);
  console.log(`  Pending count: ${dryRunResult.pendingCount}`);
  if (dryRunResult.firstThree) {
    dryRunResult.firstThree.forEach((c, i) => {
      console.log(`    ${i+1}. name="${c.name}", days=${c.timeDays}, group=${c.isGroup}`);
    });
  }
  console.log(`  Result: ${dryRunResult.pendingCount > 0 && dryRunResult.pendingCount <= 20 ? 'PASS' : 'FAIL'}\n`);

  // Test 15: Confirm and run dry-run (sends 3 messages in dry mode)
  console.log('Test 15: Dry-run send (3 messages, no actual send)');
  await evaluate(ws, 'IG_DM_CONFIG.delayMin = 100; IG_DM_CONFIG.delayMax = 200;');
  // Run confirm without awaitPromise
  await sendCommand(ws, 'Runtime.evaluate', {
    expression: 'igDmSender.confirm();',
    awaitPromise: false,
  });
  // Wait for it to finish (3 messages * ~300ms each = ~1s, plus overhead)
  await new Promise(r => setTimeout(r, 8000));
  const drySendResult = await evaluate(ws, `(() => {
    // Check if _igDmPending was cleared (means it finished)
    const finished = window._igDmPending === null;
    // Count sent messages in DOM
    const sentCount = document.querySelectorAll('.chat-msg.sent').length;
    return { finished, sentCount };
  })()`);
  console.log(`  Finished: ${drySendResult.finished}`);
  console.log(`  Sent messages in DOM: ${drySendResult.sentCount}`);
  console.log(`  Result: ${drySendResult.finished && drySendResult.sentCount >= 3 ? 'PASS' : 'FAIL'}\n`);

  // Test 16: Load and run the PERSONALIZED script
  console.log('Test 16: Load personalized script');
  // Need to reset state first
  await evaluate(ws, 'window._igDmStop = false; window._igDmPending = null; window._igDmResolve = null;');
  const personalizedLoadResult = await evaluate(ws, `(() => {
    try {
      ${personalizedScript}
      return { loaded: true, hasPlaceholder: IG_DM_CONFIG.mensaje.includes('{nombre}'), senderExists: typeof igDmSender === 'function' };
    } catch(e) {
      return { loaded: false, error: e.message };
    }
  })()`);
  console.log(`  Loaded: ${personalizedLoadResult.loaded}`);
  console.log(`  Has {nombre} placeholder: ${personalizedLoadResult.hasPlaceholder}`);
  console.log(`  igDmSender exists: ${personalizedLoadResult.senderExists}`);
  console.log(`  Result: ${personalizedLoadResult.loaded && personalizedLoadResult.hasPlaceholder ? 'PASS' : 'FAIL'}\n`);

  // Test 17: Name extraction and personalization
  console.log('Test 17: Name extraction and personalization');
  await evaluate(ws, `(() => {
    IG_DM_CONFIG.dryRun = true;
    IG_DM_CONFIG.maxMensajes = 3;
    IG_DM_CONFIG.delayMin = 100;
    IG_DM_CONFIG.delayMax = 200;
  })()`);
  // Run igDmSender without awaitPromise
  await sendCommand(ws, 'Runtime.evaluate', {
    expression: 'igDmSender();',
    awaitPromise: false,
  });
  await new Promise(r => setTimeout(r, 5000));
  const nameResult = await evaluate(ws, `(() => {
    const pending = window._igDmPending;
    if (pending && pending.length > 0) {
      const samples = pending.slice(0, 5).map(c => {
        const personalized = IG_DM_CONFIG.mensaje.replace(/\\{nombre\\}/g, c.firstName);
        return {
          fullName: c.name,
          firstName: c.firstName,
          firstLine: personalized.split('\\n')[0],
        };
      });
      return { count: pending.length, samples };
    }
    return { count: 0, error: 'No pending' };
  })()`);
  console.log(`  Pending: ${nameResult.count}`);
  if (nameResult.samples) {
    nameResult.samples.forEach((s, i) => {
      console.log(`    ${i+1}. "${s.fullName}" → firstName="${s.firstName}" → "${s.firstLine}"`);
    });
  }
  const allPersonalized = nameResult.samples?.every(s => s.firstLine.includes(s.firstName));
  console.log(`  Result: ${nameResult.count > 0 && allPersonalized ? 'PASS' : 'FAIL'}\n`);

  // Test 18: Personalized dry-run send
  console.log('Test 18: Personalized dry-run send');
  await evaluate(ws, 'IG_DM_CONFIG.delayMin = 100; IG_DM_CONFIG.delayMax = 200;');
  await sendCommand(ws, 'Runtime.evaluate', {
    expression: 'igDmSender.confirm();',
    awaitPromise: false,
  });
  await new Promise(r => setTimeout(r, 8000));
  const personalizedSendResult = await evaluate(ws, `(() => {
    const finished = window._igDmPending === null;
    const sentCount = document.querySelectorAll('.chat-msg.sent').length;
    return { finished, sentCount };
  })()`);
  console.log(`  Finished: ${personalizedSendResult.finished}`);
  console.log(`  Total sent messages in DOM: ${personalizedSendResult.sentCount}`);
  console.log(`  Result: ${personalizedSendResult.finished ? 'PASS' : 'FAIL'}\n`);

  // Test 19: stopIGDM function
  console.log('Test 19: stopIGDM function');
  const stopResult = await evaluate(ws, `(() => {
    window._igDmStop = false;
    stopIGDM();
    return window._igDmStop;
  })()`);
  console.log(`  _igDmStop after stopIGDM(): ${stopResult}`);
  console.log(`  Result: ${stopResult === true ? 'PASS' : 'FAIL'}\n`);

  // Test 20: Verify sent messages in DOM (from dry-run tests)
  console.log('Test 20: Verify messages in DOM');
  const domMsgResult = await evaluate(ws, `(() => {
    const sent = document.querySelectorAll('.chat-msg.sent');
    return { count: sent.length, texts: [...sent].map(m => m.textContent.substring(0, 50)) };
  })()`);
  console.log(`  Sent messages in DOM: ${domMsgResult.count}`);
  domMsgResult.texts.forEach((t, i) => console.log(`    ${i+1}. "${t}..."`));
  console.log(`  Result: ${domMsgResult.count > 0 ? 'PASS' : 'FAIL'}\n`);

  // ============================================================
  // SUMMARY
  // ============================================================
  console.log('══════════════════════════════════════════════════');
  console.log('  REAL BROWSER TESTS COMPLETE (Brave)');
  console.log('══════════════════════════════════════════════════');

  ws.close();
  process.exit(0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
