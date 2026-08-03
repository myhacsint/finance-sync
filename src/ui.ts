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
    .manual{margin-top:26px}.manual-grid{display:grid;grid-template-columns:220px 1fr;gap:12px}
    label{display:block;margin:0 0 6px;color:#cbd5e0}select,textarea{width:100%;background:#111722;color:#edf2f7;border:1px solid var(--line);border-radius:8px;padding:10px}
    textarea{min-height:210px;resize:vertical}.actions{display:flex;gap:10px;align-items:center;margin-top:12px;flex-wrap:wrap}
    .preview{margin-top:16px}.preview table{width:100%;border-collapse:collapse}.preview th,.preview td{padding:8px 6px;border-bottom:1px solid var(--line);text-align:left}
    .preview th:nth-child(n+3),.preview td:nth-child(n+3){text-align:right}.ok{color:var(--ok)}.warn{color:var(--wait)}.bad{color:var(--bad)}
    @media(max-width:700px){.manual-grid{grid-template-columns:1fr}.preview{overflow-x:auto}}
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
  <section id="manual-section" class="card manual" hidden>
    <h2>Vorsorge aktualisieren</h2>
    <p class="muted">Text aus der Depot- oder Vertragsansicht einfügen. Die erste Prüfung verändert noch keine Daten.</p>
    <div class="manual-grid">
      <div>
        <label for="manual-source">Vertrag</label>
        <select id="manual-source"></select>
      </div>
      <div>
        <label for="manual-text">Kopierter Text</label>
        <textarea id="manual-text" placeholder="Hier den vollständigen Text einfügen …"></textarea>
      </div>
    </div>
    <div class="actions">
      <button id="preview-button" onclick="previewManual()">Vorschau prüfen</button>
      <span class="muted">Noch kein Import</span>
    </div>
    <div id="manual-preview" class="preview"></div>
  </section>
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
  <div class="actions"><button onclick="sync('\${encodeURIComponent(s.id)}')" \${s.enabled?"":"disabled"}>Jetzt abrufen</button>
  \${s.kind==="dkb-fints"?\`<button onclick="preflightDkb('\${encodeURIComponent(s.id)}')">Lokal prüfen</button>\`:""}
  \${s.kind==="dkb-fints"&&s.enabled&&s.state==="WAITING_FOR_USER"?\`<button onclick="continueDkb('\${encodeURIComponent(s.id)}')">App-Freigabe prüfen</button>\`:""}</div></section>\`).join("")||'<section class="card">Noch keine Quellen konfiguriert.</section>'}catch(e){msg(e.message,true)}}
async function sync(id){try{msg("Abruf läuft …");const d=await call("/api/sync/"+id,{method:"POST"});msg(d.state==="WAITING_FOR_USER"?d.message+" Bitte in der DKB-App bestätigen und danach die Freigabe prüfen.":d.message);refresh()}catch(e){msg(e.message,true)}}
async function preflightDkb(id){try{msg("Lokale FinTS-Konfiguration wird geprüft …");const d=await call("/api/dkb-fints/preflight/"+id,{method:"POST"});msg(d.message);refresh()}catch(e){msg(e.message,true)}}
async function continueDkb(id){try{msg("DKB-App-Freigabe wird geprüft …");const d=await call("/api/dkb-fints/continue/"+id,{method:"POST",body:"{}"});msg(d.state==="WAITING_FOR_USER"?d.message+" Die Bestätigung ist noch nicht abgeschlossen.":d.message);refresh()}catch(e){msg(e.message,true)}}
async function exportNow(){try{await call("/api/export",{method:"POST"});msg("CSV-Dateien wurden aktualisiert.")}catch(e){msg(e.message,true)}}
async function reconcile(){try{const d=await call("/api/reconcile",{method:"POST"});msg(d.message)}catch(e){msg(e.message,true)}}
let currentPreview=null;
function money(minor,currency="EUR"){return new Intl.NumberFormat("de-DE",{style:"currency",currency}).format(Number(minor)/100)}
function decimal(atomic,decimals){const raw=String(atomic||"0").padStart(decimals+1,"0");const whole=raw.slice(0,-decimals)||"0";const fraction=decimals?","+raw.slice(-decimals):"";return whole.replace(/\\B(?=(\\d{3})+(?!\\d))/g,".")+fraction}
async function loadManualSources(){try{const d=await call("/api/manual-workflow/sources");if(!d.sources.length)return;document.getElementById("manual-section").hidden=false;document.getElementById("manual-source").innerHTML=d.sources.map(s=>\`<option value="\${esc(s.id)}">\${esc(s.label)}</option>\`).join("")}catch(e){msg(e.message,true)}}
async function previewManual(){try{
  currentPreview=null;document.getElementById("manual-preview").innerHTML="";msg("Text wird geprüft …");
  const sourceId=document.getElementById("manual-source").value;
  const text=document.getElementById("manual-text").value;
  const d=await call("/api/manual-workflow/preview",{method:"POST",body:JSON.stringify({sourceId,text})});
  currentPreview=d;
  const state=d.snapshotState==="equivalent"?"Dieser Stand ist bereits vollständig im Archiv vorhanden.":d.snapshotState==="new"?"Dieser Stichtag ist neu.":"Zu diesem Stichtag gibt es bereits abweichende Daten.";
  const rows=d.holdings.map(h=>\`<tr><td>\${esc(h.name)}<br><code>\${esc(h.symbol)}</code></td><td class="\${h.ghostfolioMapped?"ok":"bad"}">\${h.ghostfolioMapped?"zugeordnet":"Zuordnung fehlt"}</td><td>\${decimal(h.quantityAtomic,h.quantityDecimals)}</td><td>\${decimal(h.priceAtomic,h.priceDecimals)} \${esc(h.priceCurrency)}</td><td>\${money(h.marketValueMinor)}</td></tr>\`).join("");
  const warnings=d.warnings.map(w=>\`<p class="warn">\${esc(w)}</p>\`).join("");
  document.getElementById("manual-preview").innerHTML=\`
    <div class="row"><div><strong>\${esc(d.label)}</strong><div class="muted">Stichtag \${esc(new Date(d.capturedAt).toLocaleDateString("de-DE"))} · \${esc(state)}</div></div><strong>\${money(d.totalMinor)}</strong></div>
    \${warnings}<table><thead><tr><th>Position</th><th>Ghostfolio</th><th>Anteile</th><th>Kurs</th><th>Wert</th></tr></thead><tbody>\${rows}</tbody></table>
    <div class="actions"><label><input id="manual-confirm-check" type="checkbox" onchange="document.getElementById('manual-confirm-button').disabled=!this.checked"> Ich habe Stichtag, Gesamtwert und Positionen geprüft.</label>
    <button id="manual-confirm-button" onclick="confirmManual()" disabled>Bestätigt übernehmen</button></div>\`;
  if(!d.canConfirm)document.getElementById("manual-confirm-check").disabled=true;
  msg("Vorschau erstellt. Es wurden noch keine Daten verändert.");
}catch(e){msg(e.message,true)}}
async function confirmManual(){try{
  if(!currentPreview)return;document.getElementById("manual-confirm-button").disabled=true;msg("Bestätigter Stand wird übernommen …");
  const d=await call("/api/manual-workflow/confirm",{method:"POST",body:JSON.stringify({previewId:currentPreview.id})});
  document.getElementById("manual-text").value="";document.getElementById("manual-preview").innerHTML="";
  currentPreview=null;msg(d.message);refresh();
}catch(e){msg(e.message,true);if(document.getElementById("manual-confirm-button"))document.getElementById("manual-confirm-button").disabled=false}}
function msg(t,bad=false){const el=document.getElementById("message");el.textContent=t;el.style.color=bad?"var(--bad)":""}
refresh();
loadManualSources();
</script></body></html>`;
}
