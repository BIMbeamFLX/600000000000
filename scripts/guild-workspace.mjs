// SPDX-License-Identifier: MIT
// Loopback-only demo host. Fixed fictional member; never use this server for production authentication.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { GuildStore } from '../napplets/host/guild-store.mjs';
import { ExternalJournal } from '../napplets/host/external-journal.mjs';
import { guildCapability } from '../napplets/host/guild-capability.mjs';
import { workspaceTools } from '../napplets/workspace-tools.mjs';

const port = Number(process.env.GUILD_PORT ?? 4175);
const origin = `http://127.0.0.1:${port}`;
const token = randomBytes(32).toString('hex');
const dbPath = process.env.GUILD_DEMO_DB ?? fileURLToPath(new URL('../.guild-demo.sqlite', import.meta.url));
const store = new GuildStore(dbPath, [{ id: 'demo-organizer', roles: ['member', 'officer'] }, { id: 'demo-member', roles: ['member'] }], () => 1);
const journal = new ExternalJournal(dbPath);
const actor = () => ({ memberId: 'demo-organizer', version: 1 });
const capabilities = Object.fromEntries(Object.keys(workspaceTools).map(tool => [tool, guildCapability(store, journal, actor, tool)]));
const bridge = `<script>
const pending=new Map();let sequence=0;
window.napplet={guild:Object.fromEntries(['read','command','group'].map(method=>[method,payload=>new Promise((resolve,reject)=>{
 const id=++sequence;const timeout=setTimeout(()=>{pending.delete(id);reject(Error('Host request timed out. Reload before repeating a mutation.'));},15000);
 pending.set(id,{resolve,reject,timeout});parent.postMessage({type:'guild-demo-request',id,method,payload},${JSON.stringify(origin)});
})]))};
addEventListener('message',event=>{if(event.source!==parent||event.origin!==${JSON.stringify(origin)}||event.data?.type!=='guild-demo-response')return;
 const slot=pending.get(event.data.id);if(!slot)return;clearTimeout(slot.timeout);pending.delete(event.data.id);event.data.error?slot.reject(Error(event.data.error)):slot.resolve(event.data.result);});
</script>`;
function home(url) {
  const selected = (url.searchParams.get('tools') ?? 'chapters,calendar,tasks').split(',').filter(tool => Object.hasOwn(workspaceTools, tool));
  const links = Object.entries(workspaceTools).map(([key, tool]) => `<a href="/?tools=${key}">${tool.title}</a>`).join(' ');
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>600B Guild Workspace</title>
  <style>body{margin:0;font:16px Arial;background:#f7931a;color:#1b1b19}header,nav{padding:18px}nav{display:flex;flex-wrap:wrap;gap:14px}a{color:inherit}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,420px),1fr));gap:16px;padding:16px}iframe{width:100%;height:1050px;border:2px solid #1b1b19;box-sizing:border-box}</style>
  <header><b>600.wtf / GUILD WORKSPACE</b><p>LOCAL DEMO · fictional members · no real groups, balances or purchases. Changes persist in a local SQLite file.</p></header><nav>${links}</nav><main>${selected.map(tool => `<iframe title="${workspaceTools[tool].title}" data-tool="${tool}" sandbox="allow-scripts" src="/tool/${tool}"></iframe>`).join('')}</main>
  <script>addEventListener('message',async event=>{const frame=[...document.querySelectorAll('iframe')].find(frame=>frame.contentWindow===event.source);
  if(!frame||event.origin!=='null'||event.data?.type!=='guild-demo-request')return;const {id,method,payload}=event.data;
  if(!Number.isSafeInteger(id)||!['read','command','group'].includes(method))return;
  try{const response=await fetch('/api',{method:'POST',headers:{'Content-Type':'application/json','X-Guild-Demo':${JSON.stringify(token)}},body:JSON.stringify({tool:frame.dataset.tool,method,payload})});
  const result=await response.json();frame.contentWindow.postMessage({type:'guild-demo-response',id,...result},'*');}
  catch{frame.contentWindow.postMessage({type:'guild-demo-response',id,error:'Local host unavailable'},'*');}});</script></html>`;
}
const server = createServer(async (request, response) => {
  try {
    if (request.headers.host !== `127.0.0.1:${port}`) { response.writeHead(403).end(); return; }
    const url = new URL(request.url, origin);
    response.setHeader('Cache-Control', 'no-store'); response.setHeader('X-Content-Type-Options', 'nosniff');
    if (request.method === 'GET' && url.pathname === '/') {
      response.setHeader('X-Frame-Options', 'DENY'); response.writeHead(200, { 'Content-Type': 'text/html' }).end(home(url)); return;
    }
    if (request.method === 'GET' && url.pathname.startsWith('/tool/')) {
      const tool = url.pathname.slice(6);
      if (!Object.hasOwn(workspaceTools, tool)) { response.writeHead(404).end(); return; }
      const html = await readFile(new URL(`../napplets/dist/${tool}/index.html`, import.meta.url), 'utf8');
      response.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'none'; img-src data:");
      response.writeHead(200, { 'Content-Type': 'text/html' }).end(html.replace('<head>', '<head>' + bridge)); return;
    }
    if (request.method === 'POST' && url.pathname === '/api') {
      if (request.headers.origin !== origin || request.headers['x-guild-demo'] !== token) { response.writeHead(403).end(); return; }
      let body = ''; for await (const chunk of request) { body += chunk; if (Buffer.byteLength(body) > 8192) { response.writeHead(413).end(); return; } }
      const data = JSON.parse(body);
      if (!Object.hasOwn(capabilities, data.tool) || !['read', 'command', 'group'].includes(data.method)) throw Error('Unknown tool capability');
      try { const result = await capabilities[data.tool][data.method](data.payload); response.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ result })); }
      catch (error) { response.writeHead(400, { 'Content-Type': 'application/json' }).end(JSON.stringify({ error: error.message })); }
      return;
    }
    response.writeHead(404).end();
  } catch { response.writeHead(500, { 'Content-Type': 'application/json' }).end(JSON.stringify({ error: 'Local workspace request failed.' })); }
});
server.listen(port, '127.0.0.1', () => console.log(`Local guild workspace: ${origin}`));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => { store.close(); journal.close(); process.exit(0); }));
