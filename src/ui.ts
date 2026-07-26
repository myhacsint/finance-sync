export function renderUi(): string {
  return `<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>FinanceSync</title>
  <style>
    :root{color-scheme:dark;--bg:#10131a;--card:#1a202c;--line:#30394a;--ok:#5ee29a;--wait:#ffd166;--bad:#ff6b6b}
    *{box-sizing:border-box}body{margin:0;font:15px system-ui;background:var(--bg);color:#edf2f7}
    main{max-width:1050px;margin:0 auto;padding:32px 18px}h1{margin:0 0 4px;font-size:28px}
    .muted{color:#aab4c4}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(270px,1fr));gap:14px;margin-top:22px}
    .card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:16px}
    .row{display:flex;justify-content:space-between;gap:12px;align-items:start}
    .state{font-weight:700;font-size:12px;letter-spacing:.04em}.SUCCESS,.READY{color:var(--ok)}
    .WAITING_FOR_USER{color:var(--wait)}.ERROR{color:var(--bad)}
    button{background:#4c7dff;color:#fff;border:0;border-radius:8px;padding:9px 12px;cursor:pointer}
    button:disabled{opacity:.5}.toolbar{display:flex;gap:10px;margin-top:22px}.message{min-height:22px;margin-top:14px}
    code{font-size:12px;color:#cbd5e0}
  </style>
</head>
<body><main>
  <h1>FinanceSync</h1>
  <div class="muted">Archiv, Synchronisation und Exporte</div>
  <div class="toolbar">
    <button onclick="refresh()">Status aktualisieren</button>
    <button onclick="exportNow()">CSV neu erzeugen</button>
    <button onclick="reconcile()">Interne Überträge abgleichen</button>
  </div>
  <div id="message" class="message muted"></div>
  <div id="sources" class="grid"></div>
</main>
<script>
const token=localStorage.getItem("financeToken")||prompt("FinanceSync Verwaltungs-Token");
if(token)localStorage.setItem("financeToken",token);
const headers={authorization:"Bearer "+token,"content-type":"application/json"};
async function call(path,options={}){const r=await fetch(path,{...options,headers:{...headers,...options.headers}});const j=await r.json();if(!r.ok)throw new Error(j.error||r.statusText);return j}
function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
async function refresh(){try{const d=await call("/api/status");document.getElementById("sources").innerHTML=d.sources.map(s=>\`
  <section class="card"><div class="row"><strong>\${esc(s.id)}</strong><span class="state \${esc(s.state)}">\${esc(s.state)}</span></div>
  <p>\${esc(s.message||"Noch kein Abruf")}</p><div class="muted">Letzter Erfolg</div><code>\${esc(s.last_success_at||"–")}</code>
  <p><button onclick="sync('\${encodeURIComponent(s.id)}')">Jetzt abrufen</button></p></section>\`).join("")||'<section class="card">Noch keine Quellen konfiguriert.</section>'}catch(e){msg(e.message,true)}}
async function sync(id){try{msg("Abruf läuft …");const d=await call("/api/sync/"+id,{method:"POST"});msg(d.message);refresh()}catch(e){msg(e.message,true)}}
async function exportNow(){try{await call("/api/export",{method:"POST"});msg("CSV-Dateien wurden aktualisiert.")}catch(e){msg(e.message,true)}}
async function reconcile(){try{const d=await call("/api/reconcile",{method:"POST"});msg(d.message)}catch(e){msg(e.message,true)}}
function msg(t,bad=false){const el=document.getElementById("message");el.textContent=t;el.style.color=bad?"var(--bad)":""}
refresh();
</script></body></html>`;
}
