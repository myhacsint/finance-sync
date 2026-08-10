export function renderUi(): string {
  return `<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="theme-color" content="#080d19">
  <link rel="icon" type="image/png" href="/assets/finance-hub-mark.png">
  <title>Datenstatus · Finance Hub</title>
  <style>
    :root {
      color-scheme: dark;
      --canvas: #080d19;
      --sidebar: #0c1221;
      --surface: #111a2c;
      --surface-2: #151f33;
      --surface-3: #1a263c;
      --line: #26334a;
      --line-soft: #1d293d;
      --text: #f4f7fb;
      --muted: #9caac0;
      --subtle: #6f7f98;
      --blue: #3b82f6;
      --blue-soft: #1a335d;
      --green: #55d49b;
      --green-soft: #12372f;
      --amber: #f5bd62;
      --amber-soft: #3f2f17;
      --red: #ff7b83;
      --red-soft: #442129;
      --radius: 16px;
      --shadow: 0 18px 48px rgba(0, 0, 0, .2);
    }
    * { box-sizing: border-box; -webkit-tap-highlight-color: rgba(59, 130, 246, .18); }
    html { scroll-behavior: smooth; }
    body {
      margin: 0;
      min-width: 320px;
      background: var(--canvas);
      color: var(--text);
      font: 15px/1.55 Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      -webkit-font-smoothing: antialiased;
    }
    button, select, textarea, input { font: inherit; touch-action: manipulation; }
    button { color: inherit; }
    a { color: inherit; }
    .skip-link {
      position: fixed;
      top: 10px;
      left: 10px;
      z-index: 100;
      padding: 10px 14px;
      border-radius: 10px;
      background: var(--text);
      color: var(--canvas);
      transform: translateY(-160%);
    }
    .skip-link:focus { transform: translateY(0); }
    .app { min-height: 100vh; }
    .sidebar {
      position: fixed;
      inset: 0 auto 0 0;
      z-index: 20;
      display: flex;
      width: 252px;
      flex-direction: column;
      border-right: 1px solid var(--line-soft);
      background: var(--sidebar);
      padding: 26px 18px 22px;
    }
    .brand { display: flex; align-items: center; gap: 12px; padding: 0 10px 28px; }
    .brand img { width: 34px; height: 34px; object-fit: contain; }
    .brand strong { display: block; font-size: 17px; letter-spacing: -.02em; }
    .brand span { display: block; color: var(--subtle); font-size: 12px; }
    .nav-list { display: grid; gap: 5px; margin: 0; padding: 0; list-style: none; }
    .nav-item {
      display: flex;
      width: 100%;
      min-height: 46px;
      align-items: center;
      gap: 12px;
      border: 0;
      border-radius: 11px;
      padding: 0 13px;
      background: transparent;
      color: var(--muted);
      text-decoration: none;
      text-align: left;
    }
    .nav-item svg { width: 19px; height: 19px; flex: 0 0 auto; }
    .nav-item[aria-current="page"] { background: var(--blue-soft); color: #dceaff; }
    .nav-item:disabled { cursor: not-allowed; opacity: .58; }
    .nav-spacer { flex: 1; }
    .side-links { display: grid; gap: 7px; border-top: 1px solid var(--line-soft); padding-top: 18px; }
    .side-links .nav-item { font-size: 13px; }
    .content { margin-left: 252px; min-height: 100vh; }
    .content-inner { width: min(1180px, 100%); margin: 0 auto; padding: 52px 48px 72px; }
    .page-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 24px; margin-bottom: 26px; }
    .eyebrow { margin: 0 0 5px; color: var(--blue); font-size: 12px; font-weight: 700; letter-spacing: .09em; text-transform: uppercase; }
    h1, h2, h3 { margin: 0; scroll-margin-top: 24px; line-height: 1.2; letter-spacing: -.025em; text-wrap: balance; }
    h1 { font-size: clamp(30px, 4vw, 42px); }
    h2 { font-size: 21px; }
    h3 { font-size: 16px; }
    p { margin: 0; }
    .subtitle { margin-top: 8px; color: var(--muted); }
    .button {
      display: inline-flex;
      min-height: 44px;
      align-items: center;
      justify-content: center;
      gap: 8px;
      border: 1px solid transparent;
      border-radius: 11px;
      padding: 0 15px;
      background: var(--blue);
      color: white;
      font-weight: 700;
      cursor: pointer;
      transition: border-color .16s ease, background .16s ease, transform .16s ease;
    }
    .button:hover:not(:disabled) { background: #4d8df5; transform: translateY(-1px); }
    .button:active:not(:disabled) { transform: translateY(0); }
    .button.secondary { border-color: var(--line); background: var(--surface); color: var(--text); }
    .button.secondary:hover:not(:disabled) { border-color: #3b4d6a; background: var(--surface-2); }
    .button.quiet { border-color: var(--line); background: transparent; color: var(--muted); }
    .button.small { min-height: 38px; padding: 0 12px; font-size: 13px; }
    .button:disabled { cursor: not-allowed; opacity: .48; }
    .button svg { width: 17px; height: 17px; }
    :focus-visible { outline: 3px solid rgba(96, 165, 250, .7); outline-offset: 2px; }
    .notice {
      min-height: 24px;
      margin: -10px 0 18px;
      color: var(--muted);
      font-size: 14px;
    }
    .notice.error { color: var(--red); }
    .overview {
      display: grid;
      grid-template-columns: minmax(0, 1.7fr) minmax(360px, 1fr);
      gap: 1px;
      overflow: hidden;
      border: 1px solid var(--line);
      border-radius: var(--radius);
      background: var(--line);
      box-shadow: var(--shadow);
    }
    .overview-main, .overview-stats { background: var(--surface); }
    .overview-main { padding: 27px 30px; }
    .overall-line { display: flex; align-items: center; gap: 11px; }
    .overall-line h2 { font-size: clamp(19px, 2vw, 24px); }
    .status-icon {
      display: inline-grid;
      width: 28px;
      height: 28px;
      flex: 0 0 auto;
      place-items: center;
      border-radius: 50%;
    }
    .status-icon svg { width: 16px; height: 16px; }
    .tone-ok { color: var(--green); }
    .tone-warning { color: var(--amber); }
    .tone-critical { color: var(--red); }
    .status-icon.tone-ok { background: var(--green-soft); }
    .status-icon.tone-warning { background: var(--amber-soft); }
    .status-icon.tone-critical { background: var(--red-soft); }
    .checked-at { margin-top: 9px; color: var(--muted); }
    .overview-stats { display: grid; grid-template-columns: repeat(3, 1fr); }
    .stat { display: grid; align-content: center; min-height: 112px; padding: 20px; border-left: 1px solid var(--line-soft); }
    .stat strong { font-size: 27px; line-height: 1; letter-spacing: -.04em; }
    .stat span { margin-top: 8px; color: var(--muted); font-size: 12px; }
    .section { margin-top: 38px; }
    .section-heading { display: flex; align-items: end; justify-content: space-between; gap: 16px; margin-bottom: 14px; }
    .section-heading p { margin-top: 6px; color: var(--muted); font-size: 13px; }
    .task-list { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 13px; }
    .task-card {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr) auto;
      align-items: center;
      gap: 15px;
      min-height: 104px;
      border: 1px solid var(--line);
      border-radius: 14px;
      background: var(--surface);
      padding: 18px;
    }
    .task-mark {
      display: grid;
      width: 42px;
      height: 42px;
      place-items: center;
      border-radius: 12px;
      background: var(--amber-soft);
      color: var(--amber);
    }
    .task-mark svg { width: 20px; height: 20px; }
    .task-card p { margin-top: 5px; color: var(--muted); font-size: 13px; }
    .source-list { overflow: hidden; border: 1px solid var(--line); border-radius: var(--radius); background: var(--surface); }
    .source-row + .source-row { border-top: 1px solid var(--line-soft); }
    .source-summary {
      display: grid;
      grid-template-columns: minmax(180px, 1.1fr) minmax(130px, .7fr) minmax(180px, 1.3fr) auto;
      align-items: center;
      gap: 20px;
      min-height: 78px;
      padding: 15px 18px;
      list-style: none;
      cursor: pointer;
    }
    .source-summary::-webkit-details-marker { display: none; }
    .source-title { display: flex; min-width: 0; align-items: center; gap: 11px; }
    .source-icon {
      display: grid;
      width: 36px;
      height: 36px;
      flex: 0 0 auto;
      place-items: center;
      border-radius: 10px;
      background: var(--surface-3);
      color: #b9c7dc;
    }
    .source-icon svg { width: 18px; height: 18px; }
    .source-title strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .state-label { display: inline-flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 700; }
    .state-dot { width: 8px; height: 8px; border-radius: 50%; background: currentColor; box-shadow: 0 0 0 4px currentColor inset; }
    .source-result { overflow: hidden; color: var(--muted); font-size: 13px; text-overflow: ellipsis; white-space: nowrap; }
    .details-label { display: inline-flex; align-items: center; gap: 6px; color: var(--muted); font-size: 13px; }
    .details-label svg { width: 15px; height: 15px; transition: transform .16s ease; }
    details[open] .details-label svg { transform: rotate(180deg); }
    .source-details { display: flex; align-items: center; justify-content: space-between; gap: 18px; border-top: 1px solid var(--line-soft); padding: 16px 18px 18px 65px; background: #0e1728; }
    .source-meta { display: grid; grid-template-columns: repeat(2, minmax(130px, 1fr)); gap: 18px; color: var(--muted); font-size: 13px; }
    .source-meta strong { display: block; margin-top: 3px; overflow-wrap: anywhere; color: var(--text); font-weight: 600; }
    .actions { display: flex; flex-wrap: wrap; gap: 9px; }
    .historical {
      border: 1px solid var(--line);
      border-radius: 14px;
      background: var(--surface);
    }
    .historical summary { display: flex; min-height: 64px; align-items: center; justify-content: space-between; gap: 16px; padding: 12px 18px; cursor: pointer; list-style: none; }
    .historical summary::-webkit-details-marker { display: none; }
    .historical strong { display: flex; align-items: center; gap: 10px; }
    .historical p { padding: 0 18px 18px 48px; color: var(--muted); font-size: 13px; }
    .system-band {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      overflow: hidden;
      border: 1px solid var(--line);
      border-radius: var(--radius);
      background: var(--surface);
    }
    .system-item { min-height: 98px; padding: 18px; }
    .system-item + .system-item { border-left: 1px solid var(--line-soft); }
    .system-item span { color: var(--muted); font-size: 12px; }
    .system-state { display: flex; align-items: center; gap: 8px; margin-top: 10px; font-weight: 700; }
    .management { border: 1px solid var(--line); border-radius: var(--radius); background: var(--surface); }
    .management > summary { min-height: 60px; padding: 17px 20px; cursor: pointer; list-style: none; font-weight: 700; }
    .management > summary::-webkit-details-marker { display: none; }
    .management-body { border-top: 1px solid var(--line-soft); padding: 22px; }
    .management-tools { display: flex; flex-wrap: wrap; gap: 10px; }
    .manual-workflow { margin-top: 28px; }
    .manual-workflow > p { margin-top: 7px; color: var(--muted); }
    .manual-grid { display: grid; grid-template-columns: 230px minmax(0, 1fr); gap: 14px; margin-top: 18px; }
    label { display: block; margin-bottom: 7px; color: var(--muted); font-size: 13px; font-weight: 600; }
    select, textarea {
      width: 100%;
      border: 1px solid var(--line);
      border-radius: 11px;
      background: #0d1525;
      color: var(--text);
      padding: 11px 12px;
    }
    select { min-height: 44px; }
    textarea { min-height: 200px; resize: vertical; }
    .preview { margin-top: 18px; overflow-x: auto; }
    .preview table { width: 100%; border-collapse: collapse; min-width: 680px; }
    .preview th, .preview td { padding: 10px 8px; border-bottom: 1px solid var(--line-soft); text-align: left; }
    .preview th { color: var(--muted); font-size: 12px; }
    .preview th:nth-child(n+3), .preview td:nth-child(n+3) { text-align: right; font-variant-numeric: tabular-nums; }
    code { color: #bfcae0; font-size: 12px; }
    .empty { border: 1px dashed var(--line); border-radius: 14px; padding: 22px; color: var(--muted); text-align: center; }
    .skeleton { position: relative; overflow: hidden; background: var(--surface-2); color: transparent; border-radius: 7px; }
    .skeleton::after { content: ""; position: absolute; inset: 0; background: linear-gradient(90deg, transparent, rgba(255,255,255,.05), transparent); animation: shimmer 1.4s infinite; }
    @keyframes shimmer { from { transform: translateX(-100%); } to { transform: translateX(100%); } }
    .mobile-nav { display: none; }
    @media (max-width: 980px) {
      .sidebar { width: 216px; }
      .content { margin-left: 216px; }
      .content-inner { padding: 38px 28px 68px; }
      .overview { grid-template-columns: 1fr; }
      .source-summary { grid-template-columns: minmax(170px, 1fr) minmax(120px, .6fr) auto; }
      .source-result { display: none; }
      .task-list { grid-template-columns: 1fr; }
      .system-band { grid-template-columns: repeat(2, 1fr); }
      .system-item:nth-child(3) { border-left: 0; border-top: 1px solid var(--line-soft); }
      .system-item:nth-child(4) { border-top: 1px solid var(--line-soft); }
    }
    @media (max-width: 720px) {
      body { padding-bottom: 76px; }
      .sidebar { display: none; }
      .content { margin-left: 0; }
      .content-inner { padding: 28px 18px 42px; }
      .page-header { align-items: center; }
      .page-header .subtitle { max-width: 270px; }
      .button .desktop-label { display: none; }
      .overview-main { padding: 22px 20px; }
      .overview-stats { grid-template-columns: repeat(3, 1fr); }
      .stat { min-height: 92px; padding: 14px 12px; }
      .stat strong { font-size: 23px; }
      .task-card { grid-template-columns: auto minmax(0, 1fr); }
      .task-card .button { grid-column: 1 / -1; width: 100%; }
      .source-summary { grid-template-columns: minmax(0, 1fr) auto; gap: 10px; min-height: 72px; padding: 13px 14px; }
      .state-label { justify-self: end; }
      .details-label { display: none; }
      .source-details { display: grid; padding: 15px; }
      .source-meta { grid-template-columns: 1fr; gap: 10px; }
      .source-details .actions .button { flex: 1 1 150px; }
      .system-band { grid-template-columns: 1fr 1fr; }
      .system-item { min-height: 88px; padding: 15px; }
      .manual-grid { grid-template-columns: 1fr; }
      .mobile-nav {
        position: fixed;
        inset: auto 0 0;
        z-index: 30;
        display: grid;
        grid-template-columns: repeat(5, 1fr);
        min-height: 68px;
        border-top: 1px solid var(--line);
        background: rgba(10, 16, 29, .97);
        backdrop-filter: blur(14px);
        padding-bottom: env(safe-area-inset-bottom);
      }
      .mobile-nav .nav-item { display: grid; min-width: 0; min-height: 68px; justify-items: center; align-content: center; gap: 3px; border-radius: 0; padding: 5px 2px; font-size: 10px; text-align: center; }
      .mobile-nav .nav-item svg { width: 19px; height: 19px; }
      .mobile-nav .nav-item[aria-current="page"] { background: transparent; color: #77a9ff; }
    }
    @media (max-width: 420px) {
      .content-inner { padding-inline: 14px; }
      .overview-stats { grid-template-columns: 1fr; }
      .stat { min-height: 66px; border-left: 0; border-top: 1px solid var(--line-soft); grid-template-columns: 48px 1fr; align-items: center; }
      .stat span { margin-top: 0; }
      .system-band { grid-template-columns: 1fr; }
      .system-item + .system-item { border-left: 0; border-top: 1px solid var(--line-soft); }
      h1 { font-size: 30px; }
    }
    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after { scroll-behavior: auto !important; animation-duration: .01ms !important; animation-iteration-count: 1 !important; transition-duration: .01ms !important; }
    }
  </style>
</head>
<body>
  <a class="skip-link" href="#main-content">Zum Inhalt springen</a>
  <div class="app">
    <aside class="sidebar" aria-label="Hauptnavigation">
      <div class="brand"><img src="/assets/finance-hub-mark.png" alt="" width="34" height="34" fetchpriority="high"><div><strong>Finance Hub</strong><span>Privater Finanzbereich</span></div></div>
      <nav><ul class="nav-list" id="desktop-nav"></ul></nav>
      <div class="nav-spacer"></div>
      <div class="side-links" aria-label="Verbundene Anwendungen">
        <button class="nav-item" type="button" disabled title="Direktlink folgt in einem späteren Schritt">Actual Budget</button>
        <button class="nav-item" type="button" disabled title="Direktlink folgt in einem späteren Schritt">Ghostfolio</button>
      </div>
    </aside>
    <main class="content" id="main-content">
      <div class="content-inner">
        <header class="page-header">
          <div><p class="eyebrow">Finance Hub</p><h1>Datenstatus</h1><p class="subtitle">Aktualität, offene Aufgaben und Systemzustand auf einen Blick.</p></div>
          <button class="button quiet" id="refresh-button" type="button" onclick="refresh()" aria-label="Datenstatus aktualisieren">
            <span aria-hidden="true">↻</span><span class="desktop-label">Aktualisieren</span>
          </button>
        </header>
        <div id="message" class="notice" role="status" aria-live="polite"></div>
        <div id="dashboard" aria-busy="true">
          <section class="overview" aria-label="Statusübersicht">
            <div class="overview-main"><div class="skeleton" style="width:72%;height:28px">Lädt</div><div class="skeleton" style="width:42%;height:16px;margin-top:12px">Lädt</div></div>
            <div class="overview-stats"><div class="stat"><strong>–</strong><span>Automatisch aktuell</span></div><div class="stat"><strong>–</strong><span>Aufgaben</span></div><div class="stat"><strong>–</strong><span>Historische Importe</span></div></div>
          </section>
        </div>
      </div>
    </main>
    <nav class="mobile-nav" id="mobile-nav" aria-label="Mobile Hauptnavigation"></nav>
  </div>
<script>
const icons={
  overview:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M4 13h6V4H4v9Zm0 7h6v-4H4v4Zm10 0h6v-9h-6v9Zm0-16v4h6V4h-6Z"/></svg>',
  expenses:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M4 5h16v14H4zM8 9h8M8 13h5"/></svg>',
  assets:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M4 19V9m5 10V5m6 14v-7m5 7V3"/></svg>',
  analysis:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m4 17 5-5 4 3 7-9M16 6h4v4"/></svg>',
  status:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="m8.5 12 2.2 2.2 4.8-5"/></svg>',
  bank:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m3 9 9-5 9 5M5 10v7m4-7v7m6-7v7m4-7v7M3 20h18"/></svg>',
  wallet:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M4 7h15a2 2 0 0 1 2 2v9H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h13v3M16 12h5"/></svg>',
  manual:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M6 3h9l4 4v14H6zM15 3v5h5M9 13h6M9 17h4"/></svg>',
  archive:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M4 7h16v13H4zM3 3h18v4H3zM9 11h6"/></svg>',
  chevron:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m7 10 5 5 5-5"/></svg>',
  check:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="m6 12 4 4 8-9"/></svg>',
  warning:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 4 3 20h18L12 4Zm0 5v5m0 3v.1"/></svg>'
};
const navItems=[
  {label:"Übersicht",icon:"overview"},
  {label:"Ausgaben",icon:"expenses"},
  {label:"Vermögen",icon:"assets"},
  {label:"Analysen",icon:"analysis"},
  {label:"Datenstatus",icon:"status",active:true}
];
function navMarkup(){return navItems.map(item=>'<button class="nav-item" type="button" '+(item.active?'aria-current="page"':'disabled title="Folgt in einem späteren Schritt"')+'>'+icons[item.icon]+'<span>'+item.label+'</span></button>').join("")}
document.getElementById("desktop-nav").innerHTML=navMarkup();
document.getElementById("mobile-nav").innerHTML=navMarkup();

const legacyToken=localStorage.getItem("financeToken");
if(legacyToken&&!sessionStorage.getItem("financeToken"))sessionStorage.setItem("financeToken",legacyToken);
localStorage.removeItem("financeToken");
let token=sessionStorage.getItem("financeToken")||"";
let currentPreview=null;

function requestToken(){
  const supplied=prompt("Finance Hub Verwaltungstoken eingeben");
  if(!supplied)return false;
  token=supplied.trim();
  sessionStorage.setItem("financeToken",token);
  return Boolean(token);
}
async function call(path,options={},retry=true){
  if(!token&&!requestToken())throw new Error("Für den Datenstatus wird das Verwaltungstoken benötigt.");
  const response=await fetch(path,{...options,headers:{authorization:"Bearer "+token,"content-type":"application/json",...options.headers}});
  let result={};
  try{result=await response.json()}catch{}
  if(response.status===401&&retry){sessionStorage.removeItem("financeToken");token="";if(requestToken())return call(path,options,false)}
  if(!response.ok)throw new Error(result.error||response.statusText);
  return result;
}
function esc(value){return String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]))}
function encoded(value){return encodeURIComponent(String(value))}
function formatDate(value,withTime=false){
  if(!value)return "Noch nicht vorhanden";
  const date=new Date(value);
  if(Number.isNaN(date.getTime()))return "Noch nicht vorhanden";
  return new Intl.DateTimeFormat("de-DE",withTime?{dateStyle:"medium",timeStyle:"short"}:{dateStyle:"medium"}).format(date);
}
function relativeTime(value){
  if(!value)return "Noch nie";
  const delta=new Date(value).getTime()-Date.now();
  if(Number.isNaN(delta))return "Unbekannt";
  const abs=Math.abs(delta);
  const formatter=new Intl.RelativeTimeFormat("de-DE",{numeric:"auto"});
  if(abs<60_000)return "gerade eben";
  if(abs<3_600_000)return formatter.format(Math.round(delta/60_000),"minute");
  if(abs<86_400_000)return formatter.format(Math.round(delta/3_600_000),"hour");
  return formatter.format(Math.round(delta/86_400_000),"day");
}
function formatBytes(bytes){
  if(!Number.isFinite(bytes))return "Unbekannt";
  const units=["B","KB","MB","GB","TB"];
  let value=bytes,index=0;
  while(value>=1024&&index<units.length-1){value/=1024;index+=1}
  return new Intl.NumberFormat("de-DE",{maximumFractionDigits:value>=100?0:1}).format(value)+" "+units[index];
}
function stateInfo(source){
  const map={
    current:{label:"Aktuell",tone:"ok"},
    running:{label:"Läuft",tone:"warning"},
    action:{label:"Freigabe nötig",tone:"warning"},
    error:{label:"Fehler",tone:"critical"},
    disabled:{label:"Deaktiviert",tone:"warning"}
  };
  return map[source.status]||map.action;
}
function statusIcon(tone){return '<span class="status-icon tone-'+tone+'">'+(tone==="ok"?icons.check:icons.warning)+'</span>'}
function sourceIcon(source){return source.kind==="solana"?icons.wallet:source.kind==="manual"?icons.manual:icons.bank}
function msg(text,isError=false){const element=document.getElementById("message");element.textContent=text;element.classList.toggle("error",isError)}
function manualError(text=""){const element=document.getElementById("manual-error");if(element)element.textContent=text}

function renderTask(task){
  return '<article class="task-card"><span class="task-mark">'+icons.manual+'</span><div><h3>'+esc(task.label)+'</h3><p>Letzter bestätigter Wert: '+esc(formatDate(task.valueDate))+'</p></div><button class="button secondary" type="button" onclick="openManual(&quot;'+encoded(task.id)+'&quot;)">Werte aktualisieren</button></article>';
}
function renderSource(source){
  const info=stateInfo(source);
  const approval=source.supportsDkbApproval&&source.state==="WAITING_FOR_USER"?'<button class="button small" type="button" onclick="continueDkb(&quot;'+encoded(source.id)+'&quot;)">App-Freigabe prüfen</button>':'';
  const preflight=source.supportsDkbApproval?'<button class="button secondary small" type="button" onclick="preflightDkb(&quot;'+encoded(source.id)+'&quot;)">Konfiguration prüfen</button>':'';
  return '<details class="source-row"><summary class="source-summary"><div class="source-title"><span class="source-icon">'+sourceIcon(source)+'</span><strong>'+esc(source.label)+'</strong></div><span class="state-label tone-'+info.tone+'"><span class="state-dot"></span>'+info.label+'</span><span class="source-result">'+esc(source.message)+'</span><span class="details-label">Details '+icons.chevron+'</span></summary><div class="source-details"><div class="source-meta"><span>Letzter Erfolg<strong title="'+esc(formatDate(source.lastSuccessAt,true))+'">'+esc(relativeTime(source.lastSuccessAt))+'</strong></span><span>Ergebnis<strong>'+esc(source.message)+'</strong></span></div><div class="actions"><button class="button small" type="button" onclick="syncSource(&quot;'+encoded(source.id)+'&quot;)">Jetzt abrufen</button>'+preflight+approval+'</div></div></details>';
}
function systemItem(label,status,detail){
  const tone=status==="ok"?"ok":status==="warning"?"warning":"critical";
  const text=status==="ok"?"In Ordnung":status==="warning"?"Hinweis":"Handlungsbedarf";
  return '<div class="system-item"><span>'+esc(label)+'</span><div class="system-state tone-'+tone+'"><span class="state-dot"></span>'+text+'</div>'+(detail?'<span>'+esc(detail)+'</span>':'')+'</div>';
}
function renderDashboard(data){
  const overallTone=data.overall==="ok"?"ok":data.overall==="warning"?"warning":"critical";
  const tasks=data.tasks.length?data.tasks.map(renderTask).join(""):'<div class="empty">Aktuell sind keine manuellen Werte zu aktualisieren.</div>';
  const sources=data.automatic.length?data.automatic.map(renderSource).join(""):'<div class="empty">Noch keine automatische Quelle aktiv.</div>';
  const archiveDetail=data.system.archiveTotalBytes>0?formatBytes(data.system.archiveFreeBytes)+" frei":"Speicherstatus unbekannt";
  const backupDetail=data.system.backupLastSuccessAt?"Zuletzt "+relativeTime(data.system.backupLastSuccessAt):"Noch kein Lauf sichtbar";
  document.getElementById("dashboard").innerHTML='\
    <section class="overview" aria-label="Statusübersicht">\
      <div class="overview-main"><div class="overall-line">'+statusIcon(overallTone)+'<h2>'+esc(data.headline)+'</h2></div><p class="checked-at">Zuletzt geprüft: '+esc(formatDate(data.generatedAt,true))+'</p></div>\
      <div class="overview-stats"><div class="stat"><strong>'+data.summary.automaticCurrent+'<span class="tone-'+(data.summary.automaticCurrent===data.summary.automaticTotal?'ok':'warning')+'"> / '+data.summary.automaticTotal+'</span></strong><span>Automatisch aktuell</span></div><div class="stat"><strong>'+data.summary.tasks+'</strong><span>Aufgaben</span></div><div class="stat"><strong>'+data.summary.historicalImports+'</strong><span>Historische Importe</span></div></div>\
    </section>\
    <section class="section" aria-labelledby="tasks-title"><div class="section-heading"><div><h2 id="tasks-title">Offene Aufgaben</h2><p>Vertragswerte, die bewusst bestätigt werden müssen.</p></div></div><div class="task-list">'+tasks+'</div></section>\
    <section class="section" aria-labelledby="sources-title"><div class="section-heading"><div><h2 id="sources-title">Automatische Quellen</h2><p>Banken, Depots und Wallets mit geplantem Abruf.</p></div></div><div class="source-list">'+sources+'</div></section>\
    <section class="section" aria-labelledby="history-title"><div class="section-heading"><div><h2 id="history-title">Historische Daten</h2></div></div><details class="historical"><summary><strong>'+icons.archive+'Historische CSV-Importe</strong><span class="details-label">'+data.historical.count+' Quellen '+icons.chevron+'</span></summary><p>'+data.historical.count+' deaktivierte Importquellen bleiben im lückenlosen Archiv erhalten.'+(data.historical.lastSuccessAt?' Letzter Import: '+esc(formatDate(data.historical.lastSuccessAt))+'.':'')+'</p></details></section>\
    <section class="section" aria-labelledby="system-title"><div class="section-heading"><div><h2 id="system-title">Systemzustand</h2></div></div><div class="system-band">'+systemItem("FinanceSync",data.system.financeSync)+systemItem("Datenbank",data.system.database)+systemItem("Backup",data.system.backup,backupDetail)+systemItem("Archivspeicher",data.system.archive,archiveDetail)+'</div></section>\
    <section class="section"><details class="management" id="management"><summary>Verwaltung und manuelle Eingabe</summary><div class="management-body"><div class="management-tools"><button class="button secondary" type="button" onclick="exportNow()">CSV neu erzeugen</button><button class="button secondary" type="button" onclick="reconcile()">Interne Überträge abgleichen</button></div><section class="manual-workflow" id="manual-section" hidden><h2>Vorsorge aktualisieren</h2><p>Text aus der Depot- oder Vertragsansicht einfügen. Die Vorschau verändert noch keine Daten.</p><div class="manual-grid"><div><label for="manual-source">Vertrag</label><select id="manual-source" name="manual-source" autocomplete="off"></select></div><div><label for="manual-text">Kopierter Text</label><textarea id="manual-text" name="manual-text" autocomplete="off" spellcheck="false" placeholder="Hier den vollständigen Text einfügen …"></textarea></div></div><div class="actions" style="margin-top:12px"><button class="button" id="preview-button" type="button" onclick="previewManual()">Vorschau prüfen</button><span style="color:var(--muted)">Noch kein Import</span></div><div id="manual-error" class="notice error" role="status" aria-live="polite"></div><div id="manual-preview" class="preview"></div></section></div></details></section>';
  document.getElementById("dashboard").setAttribute("aria-busy","false");
}

async function refresh(){
  const button=document.getElementById("refresh-button");
  button.disabled=true;msg("Datenstatus wird aktualisiert …");
  try{const data=await call("/api/dashboard/status");renderDashboard(data);await loadManualSources();msg("")}
  catch(error){msg(error.message,true);document.getElementById("dashboard").setAttribute("aria-busy","false")}
  finally{button.disabled=false}
}
async function syncSource(id){try{msg("Abruf läuft …");const result=await call("/api/sync/"+id,{method:"POST"});msg(result.message);await refresh()}catch(error){msg(error.message,true)}}
async function preflightDkb(id){try{msg("FinTS-Konfiguration wird geprüft …");const result=await call("/api/dkb-fints/preflight/"+id,{method:"POST"});msg(result.message);await refresh()}catch(error){msg(error.message,true)}}
async function continueDkb(id){try{msg("DKB-App-Freigabe wird geprüft …");const result=await call("/api/dkb-fints/continue/"+id,{method:"POST",body:"{}"});msg(result.message);await refresh()}catch(error){msg(error.message,true)}}
async function exportNow(){try{await call("/api/export",{method:"POST"});msg("CSV-Dateien wurden aktualisiert.")}catch(error){msg(error.message,true)}}
async function reconcile(){try{const result=await call("/api/reconcile",{method:"POST"});msg(result.message)}catch(error){msg(error.message,true)}}
function money(minor,currency="EUR"){return new Intl.NumberFormat("de-DE",{style:"currency",currency}).format(Number(minor)/100)}
function decimal(atomic,decimals){const raw=String(atomic||"0").padStart(decimals+1,"0");const whole=raw.slice(0,-decimals)||"0";const fraction=decimals?","+raw.slice(-decimals):"";return whole.replace(/\\B(?=(\\d{3})+(?!\\d))/g,".")+fraction}
async function loadManualSources(){
  try{const data=await call("/api/manual-workflow/sources");const section=document.getElementById("manual-section");if(!data.sources.length){section.hidden=true;return}section.hidden=false;document.getElementById("manual-source").innerHTML=data.sources.map(source=>'<option value="'+esc(source.id)+'">'+esc(source.label)+'</option>').join("")}
  catch(error){msg(error.message,true)}
}
function openManual(id){
  const management=document.getElementById("management");management.open=true;
  const select=document.getElementById("manual-source");select.value=decodeURIComponent(id);
  const reduced=window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  document.getElementById("manual-section").scrollIntoView({behavior:reduced?"auto":"smooth",block:"start"});
  setTimeout(()=>document.getElementById("manual-text").focus(),250);
}
async function previewManual(){
  try{
    currentPreview=null;manualError();document.getElementById("manual-preview").innerHTML="";msg("Text wird geprüft …");
    const sourceId=document.getElementById("manual-source").value;
    const text=document.getElementById("manual-text").value;
    const data=await call("/api/manual-workflow/preview",{method:"POST",body:JSON.stringify({sourceId,text})});
    currentPreview=data;
    const snapshotState=data.snapshotState==="equivalent"?"Dieser Stand ist bereits vollständig im Archiv vorhanden.":data.snapshotState==="new"?"Dieser Stichtag ist neu.":"Zu diesem Stichtag gibt es bereits abweichende Daten.";
    const rows=data.holdings.map(holding=>'<tr><td>'+esc(holding.name)+'<br><code>'+esc(holding.symbol)+'</code></td><td class="tone-'+(holding.ghostfolioMapped?'ok':'critical')+'">'+(holding.ghostfolioMapped?'Zugeordnet':'Zuordnung fehlt')+'</td><td>'+decimal(holding.quantityAtomic,holding.quantityDecimals)+'</td><td>'+decimal(holding.priceAtomic,holding.priceDecimals)+' '+esc(holding.priceCurrency)+'</td><td>'+money(holding.marketValueMinor)+'</td></tr>').join("");
    const warnings=data.warnings.map(warning=>'<p class="tone-warning">'+esc(warning)+'</p>').join("");
    document.getElementById("manual-preview").innerHTML='<div style="display:flex;justify-content:space-between;gap:16px"><div><strong>'+esc(data.label)+'</strong><div style="color:var(--muted)">Stichtag '+esc(formatDate(data.capturedAt))+' · '+esc(snapshotState)+'</div></div><strong>'+money(data.totalMinor)+'</strong></div>'+warnings+'<table><thead><tr><th>Position</th><th>Ghostfolio</th><th>Anteile</th><th>Kurs</th><th>Wert</th></tr></thead><tbody>'+rows+'</tbody></table><div class="actions" style="margin-top:14px"><label style="display:flex;align-items:center;gap:8px"><input id="manual-confirm-check" type="checkbox" onchange="document.getElementById(&quot;manual-confirm-button&quot;).disabled=!this.checked"> Ich habe Stichtag, Gesamtwert und Positionen geprüft.</label><button class="button" id="manual-confirm-button" type="button" onclick="confirmManual()" disabled>Bestätigt übernehmen</button></div>';
    if(!data.canConfirm)document.getElementById("manual-confirm-check").disabled=true;
    msg("Vorschau erstellt. Es wurden noch keine Daten verändert.");
  }catch(error){manualError(error.message);msg("Die Vorschau konnte nicht erstellt werden.",true)}
}
async function confirmManual(){
  try{
    if(!currentPreview)return;
    document.getElementById("manual-confirm-button").disabled=true;msg("Bestätigter Stand wird übernommen …");
    const result=await call("/api/manual-workflow/confirm",{method:"POST",body:JSON.stringify({previewId:currentPreview.id})});
    document.getElementById("manual-text").value="";document.getElementById("manual-preview").innerHTML="";currentPreview=null;msg(result.message);await refresh();
  }catch(error){manualError(error.message);msg("Der bestätigte Stand konnte nicht übernommen werden.",true);const button=document.getElementById("manual-confirm-button");if(button)button.disabled=false}
}
window.addEventListener("beforeunload",event=>{
  const textarea=document.getElementById("manual-text");
  if(textarea&&textarea.value.trim()){event.preventDefault();event.returnValue=""}
});
refresh();
</script>
</body>
</html>`;
}
