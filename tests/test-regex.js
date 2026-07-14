const WebSocket = require('ws');
const http = require('http');

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
  
  // Test regex with raw string
  const expr = `(() => {
    const text = 'Carlos Garcia 5m';
    const re = /\\d+\\s*[mhdw]/i;
    return { text, match: text.match(re), reSource: re.source };
  })()`;
  
  console.log('Expression:', expr);
  
  const result = await send('Runtime.evaluate', {
    expression: expr,
    returnByValue: true,
  });
  
  console.log('Result:', JSON.stringify(result.result.value));
  
  // Now test with actual DOM
  const expr2 = `(() => {
    const items = document.querySelectorAll('[role="listitem"]');
    const text = items[0].textContent;
    const re = /\\d+\\s*[mhdw]/i;
    const match = text.match(re);
    return { textPreview: text.substring(0, 100), match: match ? match[0] : null, reSource: re.source };
  })()`;
  
  const result2 = await send('Runtime.evaluate', {
    expression: expr2,
    returnByValue: true,
  });
  
  console.log('DOM Result:', JSON.stringify(result2.result.value));
  
  ws.close();
}

main();
