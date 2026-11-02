// 用 CDP 触摸事件真实模拟手机滑动，验证翻页是否生效
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const PORT = 9333;
const PAGE = 'file:///' + path.join(ROOT, 'app/src/main/assets/index.html').replace(/\\/g, '/');

const edge = spawn(EDGE, [
  '--headless=new',
  '--disable-gpu',
  '--hide-scrollbars',
  `--remote-debugging-port=${PORT}`,
  '--user-data-dir=' + path.join(ROOT, '.tmp-edge-profile'),
  'about:blank'
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getWsUrl() {
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      const list = await res.json();
      const page = list.find((t) => t.type === 'page');
      if (page) return page.webSocketDebuggerUrl;
    } catch (e) { /* retry */ }
    await sleep(250);
  }
  throw new Error('devtools not ready');
}

let seq = 0;
function rpc(ws, method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++seq;
    const onMsg = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id !== id) return;
      ws.removeEventListener('message', onMsg);
      if (msg.error) reject(new Error(method + ': ' + JSON.stringify(msg.error)));
      else resolve(msg.result);
    };
    ws.addEventListener('message', onMsg);
    ws.send(JSON.stringify({ id, method, params }));
  });
}

const wsUrl = await getWsUrl();
const ws = new WebSocket(wsUrl);
await new Promise((r) => ws.addEventListener('open', r));

await rpc(ws, 'Page.enable');
await rpc(ws, 'Runtime.enable');
await rpc(ws, 'Emulation.setDeviceMetricsOverride', {
  width: 393, height: 873, deviceScaleFactor: 3, mobile: true
});
await rpc(ws, 'Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });

const results = [];
function check(name, ok, extra = '') {
  results.push({ name, ok, extra });
  console.log(ok ? '  PASS' : '  FAIL', name, extra);
}

async function evalJs(expr) {
  const r = await rpc(ws, 'Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  return r.result.value;
}

async function swipe(x1, y1, x2, y2) {
  await rpc(ws, 'Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x1, y: y1, id: 1 }] });
  const steps = 6;
  for (let i = 1; i <= steps; i++) {
    const x = x1 + (x2 - x1) * (i / steps);
    const y = y1 + (y2 - y1) * (i / steps);
    await rpc(ws, 'Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y, id: 1 }] });
    await sleep(16);
  }
  await rpc(ws, 'Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await sleep(350);
}

console.log('loading', PAGE);
await rpc(ws, 'Page.navigate', { url: PAGE });
await sleep(1200);

const total = await evalJs('window.MAO_CARDS ? window.MAO_CARDS.length : -1');
check('数据已加载 18506 条', total === 18506, 'total=' + total);

const q1 = await evalJs('document.getElementById("quote").textContent');
check('首屏有语录', !!q1 && q1.length > 8);

await swipe(320, 500, 90, 505); // 左滑 -> 下一条
const q2 = await evalJs('document.getElementById("quote").textContent');
check('左滑切换了内容', q1 !== q2, (q2 || '').slice(0, 18));

await swipe(80, 500, 320, 505); // 右滑 -> 上一条
const q3 = await evalJs('document.getElementById("quote").textContent');
check('右滑回到上一条', q3 === q1, (q3 || '').slice(0, 18));

// 点击“下一条”按钮
await evalJs('document.getElementById("nextBtn").click()');
await sleep(300);
const q4 = await evalJs('document.getElementById("quote").textContent');
check('按钮翻页生效', q4 !== q1 && q4 === q2, (q4 || '').slice(0, 18));

// 竖滑不应翻页（交给滚动）
const beforeV = await evalJs('document.getElementById("quote").textContent');
await rpc(ws, 'Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 200, y: 600, id: 2 }] });
for (let i = 1; i <= 5; i++) {
  await rpc(ws, 'Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 202, y: 600 - i * 20, id: 2 }] });
  await sleep(16);
}
await rpc(ws, 'Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
await sleep(300);
const afterV = await evalJs('document.getElementById("quote").textContent');
check('竖滑不误触翻页', beforeV === afterV);

// 检查横向溢出
const overflow = await evalJs('document.documentElement.scrollWidth - document.documentElement.clientWidth');
check('无横向溢出', overflow <= 0, 'overflow=' + overflow);

const shot = await rpc(ws, 'Page.captureScreenshot', { format: 'png' });
fs.writeFileSync(path.join(ROOT, 'shot-mobile.png'), Buffer.from(shot.data, 'base64'));

ws.close();
edge.kill('SIGKILL');

const failed = results.filter((r) => !r.ok).length;
console.log(failed === 0 ? '\nALL UI TESTS PASSED' : `\n${failed} UI TEST(S) FAILED`);
process.exit(failed === 0 ? 0 : 1);
