const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');

function getPageWsUrl() {
  return new Promise((resolve, reject) => {
    http.get('http://localhost:9222/json/list', (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        const pages = JSON.parse(data);
        const page = pages.find(p => p.url.includes('test-instagram-dm'));
        resolve(page ? page.webSocketDebuggerUrl : null);
      });
    }).on('error', reject);
  });
}

async function main() {
  const wsUrl = await getPageWsUrl();
  const ws = new WebSocket(wsUrl);
  await new Promise(r => ws.on('open', r));
  
  let id = 0;
  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const myId = ++id;
      const handler = (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.id === myId) {
            ws.removeListener('message', handler);
            if (msg.error) reject(new Error(JSON.stringify(msg.error)));
            else resolve(msg.result);
        }
      };
      ws.on('message', handler);
      ws.send(JSON.stringify({ id: myId, method, params }));
    });
  }
  
  await send('Runtime.enable');
  
  // Collect console logs
  const consoleLogs = [];
  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());
      if (msg.method === 'Runtime.consoleAPICalled') {
        const args = msg.params.args.map(a => a.value || a.description || '').join(' ');
        consoleLogs.push(args);
      }
    } catch(e) {}
  });

  // Helper to evaluate
  async function evaluate(expression) {
    const result = await send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: false,
    });
    return result.result.value;
  }

  console.log('=== FULL BROWSER TEST WITH SCRIPT EXECUTION ===\n');

  // Load generic script
  const genericScript = fs.readFileSync('./ig-dm-generic.js', 'utf-8');
  await evaluate(genericScript);
  console.log('Generic script loaded.\n');

  // Configure for dry-run test
  await evaluate(`(() => {
    IG_DM_CONFIG.dryRun = true;
    IG_DM_CONFIG.maxMensajes = 3;
    IG_DM_CONFIG.delayMin = 200;
    IG_DM_CONFIG.delayMax = 400;
  })()`);

  // Run igDmSender (non-blocking, it returns a Promise that waits for confirm)
  await send('Runtime.evaluate', {
    expression: 'igDmSender();',
    awaitPromise: false,
  });

  // Wait for scroll + find + filter to complete
  console.log('Waiting for igDmSender() to process...');
  await new Promise(r => setTimeout(r, 8000));

  // Check pending conversations
  const pending = await evaluate(`(() => {
    const p = window._igDmPending;
    return p ? {
      count: p.length,
      items: p.slice(0, 5).map(c => ({ name: c.name, timeDays: c.timeDays, isGroup: c.isGroup }))
    } : { count: 0 };
  })()`);
  
  console.log('\nTest 14: igDmSender() found conversations:');
  console.log(`  Pending count: ${pending.count}`);
  if (pending.items) {
    pending.items.forEach((c, i) => console.log(`    ${i+1}. ${c.name} (${c.timeDays}d, group=${c.isGroup})`));
  }
  console.log(`  Result: ${pending.count > 0 ? 'PASS' : 'FAIL'}\n`);

  // Now confirm and run dry-run
  console.log('Test 15: Dry-run send (3 messages):');
  consoleLogs.length = 0; // clear logs
  
  await send('Runtime.evaluate', {
    expression: 'igDmSender.confirm();',
    awaitPromise: false,
  });
  
  // Wait for 3 messages to be processed (200-400ms delay each + 1.5-2s click delay)
  await new Promise(r => setTimeout(r, 12000));
  
  const afterConfirm = await evaluate(`(() => {
    return {
      finished: window._igDmPending === null,
      sentInDom: document.querySelectorAll('.chat-msg.sent').length,
    };
  })()`);
  
  console.log(`  Finished: ${afterConfirm.finished}`);
  console.log(`  Messages in DOM: ${afterConfirm.sentInDom}`);
  console.log(`  Result: ${afterConfirm.finished && afterConfirm.sentInDom >= 3 ? 'PASS' : 'FAIL'}\n`);

  // Show console logs from the script
  console.log('Console logs from script:');
  consoleLogs.slice(0, 20).forEach(l => console.log(`  ${l}`));

  // Now test personalized script
  console.log('\nTest 16-18: Personalized script');
  
  // Reset state
  await evaluate(`(() => {
    window._igDmStop = false;
    window._igDmPending = null;
    window._igDmResolve = null;
  })()`);

  const personalizedScript = fs.readFileSync('./ig-dm-personalized.js', 'utf-8');
  await evaluate(personalizedScript);
  
  await evaluate(`(() => {
    IG_DM_CONFIG.dryRun = true;
    IG_DM_CONFIG.maxMensajes = 3;
    IG_DM_CONFIG.delayMin = 200;
    IG_DM_CONFIG.delayMax = 400;
  })()`);

  await send('Runtime.evaluate', {
    expression: 'igDmSender();',
    awaitPromise: false,
  });
  
  await new Promise(r => setTimeout(r, 8000));
  
  const pendingPersonalized = await evaluate(`(() => {
    const p = window._igDmPending;
    if (!p) return { count: 0 };
    return {
      count: p.length,
      samples: p.slice(0, 5).map(c => {
        const msg = IG_DM_CONFIG.mensaje.replace(/\\{nombre\\}/g, c.firstName);
        return { fullName: c.name, firstName: c.firstName, firstLine: msg.split('\\n')[0] };
      }),
    };
  })()`);

  console.log(`  Pending: ${pendingPersonalized.count}`);
  if (pendingPersonalized.samples) {
    pendingPersonalized.samples.forEach((s, i) => {
      console.log(`    ${i+1}. "${s.fullName}" → "${s.firstName}" → "${s.firstLine}"`);
    });
  }
  const allPersonalized = pendingPersonalized.samples?.every(s => s.firstLine.includes(s.firstName));
  console.log(`  Result: ${pendingPersonalized.count > 0 && allPersonalized ? 'PASS' : 'FAIL'}\n`);

  // Confirm personalized dry-run
  console.log('Test 18: Personalized dry-run send:');
  consoleLogs.length = 0;
  
  await send('Runtime.evaluate', {
    expression: 'igDmSender.confirm();',
    awaitPromise: false,
  });
  
  await new Promise(r => setTimeout(r, 12000));
  
  const afterPersonalized = await evaluate(`(() => {
    return {
      finished: window._igDmPending === null,
      sentInDom: document.querySelectorAll('.chat-msg.sent').length,
    };
  })()`);
  
  console.log(`  Finished: ${afterPersonalized.finished}`);
  console.log(`  Total messages in DOM: ${afterPersonalized.sentInDom}`);
  console.log(`  Result: ${afterPersonalized.finished ? 'PASS' : 'FAIL'}\n`);

  // Show personalized logs
  console.log('Console logs from personalized script:');
  consoleLogs.slice(0, 20).forEach(l => console.log(`  ${l}`));

  // Test stop
  console.log('Test 19: stopIGDM():');
  const stopResult = await evaluate(`(() => {
    window._igDmStop = false;
    stopIGDM();
    return window._igDmStop;
  })()`);
  console.log(`  _igDmStop: ${stopResult}`);
  console.log(`  Result: ${stopResult ? 'PASS' : 'FAIL'}\n`);

  // Summary
  console.log('═══════════════════════════════════════════');
  console.log('  FULL BROWSER TEST COMPLETE');
  console.log('═══════════════════════════════════════════');

  ws.close();
  process.exit(0);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
