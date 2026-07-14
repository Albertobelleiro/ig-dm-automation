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
    return new Promise((resolve) => {
      const myId = ++id;
      ws.on('message', (data) => {
        const msg = JSON.parse(data);
        if (msg.id === myId) resolve(msg.result);
      });
      ws.send(JSON.stringify({ id: myId, method, params }));
    });
  }
  
  await send('Runtime.enable');
  
  // Load the generic script
  const script = fs.readFileSync('./ig-dm-generic.js', 'utf-8');
  await send('Runtime.evaluate', { expression: script, returnByValue: true });
  
  // Now test findConversationItems
  const result = await send('Runtime.evaluate', {
    expression: `(() => {
      const items = findConversationItems();
      return {
        count: items.length,
        details: items.slice(0, 5).map(item => {
          const info = extractConvInfo(item);
          return { name: info.name, timestamp: info.timestamp, timeDays: info.timeDays, isGroup: info.isGroup };
        }),
      };
    })()`,
    returnByValue: true,
  });
  
  console.log('findConversationItems result:', JSON.stringify(result.result.value, null, 2));
  
  ws.close();
}

main();
