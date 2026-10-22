// usage: SIZE=w,h node cdp-scroll.mjs <url> <outDir> [targets.json]
// targets: [[name, "js expression returning a scrollY", waitMs], ...]; logs + exceptions printed
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
const [url, out, tfile] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const targets = JSON.parse(readFileSync(tfile, 'utf8'));
const CH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const port = 9300 + Math.floor(Math.random() * 400);
const proc = spawn(CH, ['--headless=new', `--remote-debugging-port=${port}`, '--hide-scrollbars', '--window-size=' + (process.env.SIZE || '1440,900'), '--user-data-dir=/tmp/cdp-' + port, 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let tabs; for (let i = 0; i < 40; i++) { try { tabs = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); break; } catch { await sleep(150); } }
const ws = new WebSocket(tabs.find(t => t.type === 'page').webSocketDebuggerUrl);
await new Promise(r => ws.onopen = r);
let id = 0; const pending = new Map(); const logs = [];
ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id) pending.get(d.id)?.(d); else if (d.method === 'Runtime.consoleAPICalled') logs.push(d.params.type + ': ' + d.params.args.map(a => a.value ?? a.description).join(' ')); else if (d.method === 'Runtime.exceptionThrown') logs.push('EXC: ' + (d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text)); };
const send = (method, params = {}) => new Promise(r => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async e => (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result?.result?.value;
await send('Runtime.enable'); await send('Page.enable');
await send('Page.navigate', { url });
await sleep(+(process.env.LOAD||2500));
await ev(`document.documentElement.style.scrollBehavior='auto'`);
for (const [name, expr, wait = 1500] of targets) {
  const y = await ev(expr);
  // step there in increments so scroll observers see the journey
  const cur = await ev('scrollY'); const n = 8;
  for (let k = 1; k <= n; k++) { await ev(`scrollTo(0, ${cur + (y - cur) * k / n})`); await sleep(60); }
  await sleep(wait);
  const info = await ev(`JSON.stringify({y:scrollY, ow: document.documentElement.scrollWidth > innerWidth})`);
  const s = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(`${out}/${name}.png`, Buffer.from(s.result.data, 'base64'));
  console.log(name, info);
}
if (logs.length) console.log(logs.slice(0, 30).join('\n'));
ws.close(); proc.kill();
