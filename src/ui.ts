export function renderUi(): string {
  return `<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="theme-color" content="#080d19">
  <link rel="icon" type="image/png" href="/assets/finance-hub-mark.png">
  <title>Übersicht · Finance Hub</title>
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
      --orange: #f47a4f;
      --orange-soft: #4a271f;
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
    .nav-item:hover:not(:disabled) { background: var(--surface-2); color: var(--text); }
    .nav-item[aria-current="page"] { background: var(--blue-soft); color: #dceaff; }
    .nav-item:disabled { cursor: not-allowed; opacity: .58; }
    .nav-spacer { flex: 1; }
    .side-links { display: grid; gap: 7px; border-top: 1px solid var(--line-soft); padding-top: 18px; }
    .side-links .nav-item { font-size: 13px; }
    .content { margin-left: 252px; min-height: 100vh; }
    .content-inner { width: 100%; margin: 0 auto; padding: 30px 36px 54px 54px; }
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
    .notice:empty { display: none; }
    .token-request {
      display: none;
      max-width: 520px;
      margin: 0 0 22px;
      padding: 18px;
      border: 1px solid var(--line);
      border-radius: 13px;
      background: var(--surface);
      box-shadow: var(--shadow);
    }
    .token-request[aria-hidden="false"] { display: block; }
    .token-request h2 { font-size: 17px; }
    .token-request p { margin: 7px 0 15px; color: var(--muted); font-size: 14px; }
    .token-request label { display: block; margin-bottom: 7px; font-size: 13px; font-weight: 700; }
    .token-request-row { display: flex; gap: 10px; }
    .token-request input {
      min-width: 0;
      flex: 1;
      min-height: 44px;
      border: 1px solid var(--line);
      border-radius: 11px;
      padding: 0 12px;
      background: var(--surface-2);
      color: var(--text);
      font: inherit;
    }
    @media (max-width: 520px) { .token-request-row { display: grid; } }
    .status-overview {
      display: grid;
      grid-template-columns: minmax(0, 1.7fr) minmax(360px, 1fr);
      gap: 1px;
      overflow: hidden;
      border: 1px solid var(--line);
      border-radius: var(--radius);
      background: var(--line);
      box-shadow: var(--shadow);
    }
    .status-overview .overview-main, .status-overview .overview-stats { background: var(--surface); }
    .status-overview .overview-main { padding: 27px 30px; }
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
    .expense-loading .skeleton::after { display: none; }
    @keyframes shimmer { from { transform: translateX(-100%); } to { transform: translateX(100%); } }
    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }
    .wealth-overview {
      display: grid;
      grid-template-columns: minmax(300px, .7fr) minmax(420px, 1.3fr);
      align-items: center;
      gap: 42px;
      min-height: 168px;
      border: 1px solid var(--line);
      border-radius: var(--radius);
      background: var(--surface);
      padding: 26px 30px;
      box-shadow: var(--shadow);
    }
    .wealth-label { color: #dfe7f4; font-size: 16px; font-weight: 600; }
    .wealth-value {
      display: block;
      margin-top: 4px;
      font-size: clamp(38px, 5vw, 52px);
      line-height: 1.05;
      letter-spacing: -.045em;
      font-variant-numeric: tabular-nums;
    }
    .wealth-date { margin-top: 8px; color: var(--muted); font-size: 13px; }
    .wealth-composition { min-width: 0; }
    .wealth-health { display: flex; justify-content: flex-end; align-items: center; gap: 8px; margin-bottom: 20px; color: var(--muted); font-size: 13px; }
    .wealth-health .status-icon { width: 20px; height: 20px; }
    .composition-bar { display: flex; width: 100%; height: 28px; overflow: hidden; border-radius: 4px; background: #405274; }
    .composition-bar span { display: block; min-width: 2px; }
    .composition-missing {
      display: flex;
      min-height: 28px;
      align-items: center;
      border: 1px dashed #405274;
      border-radius: 4px;
      color: var(--muted);
      font-size: 12px;
      padding: 0 10px;
    }
    .composition-cash { background: var(--blue); }
    .composition-investments { background: #526b96; }
    .composition-legend { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; margin-top: 12px; color: var(--muted); }
    .composition-legend span { display: flex; align-items: center; gap: 8px; min-width: 0; }
    .composition-legend i { width: 10px; height: 10px; flex: 0 0 auto; border-radius: 2px; }
    .composition-legend strong { color: var(--text); font-variant-numeric: tabular-nums; }
    .wealth-change-summary { margin-top: 15px; }
    .wealth-change-summary span, .wealth-change-summary small { display: block; color: var(--muted); font-size: 12px; }
    .wealth-change-summary strong { display: block; margin: 2px 0; font-size: 20px; font-variant-numeric: tabular-nums; }
    .wealth-change-positive { color: var(--green); }
    .wealth-change-negative { color: var(--orange); }
    .wealth-change-neutral { color: var(--text); }
    .wealth-comparison { grid-column: 1 / -1; border-top: 1px solid var(--line-soft); padding-top: 18px; }
    .wealth-comparison-head { display: flex; align-items: baseline; justify-content: space-between; gap: 16px; margin-bottom: 12px; }
    .wealth-comparison-head h2 { font-size: 16px; }
    .wealth-comparison-head p { color: var(--muted); font-size: 12px; }
    .wealth-comparison-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; }
    .wealth-comparison-part { min-width: 0; border-left: 2px solid #405274; padding-left: 12px; }
    .wealth-comparison-part > span { display: block; color: var(--muted); font-size: 12px; }
    .wealth-comparison-part > strong { display: block; margin: 2px 0 3px; font-size: 17px; font-variant-numeric: tabular-nums; }
    .wealth-comparison-part small { display: block; color: var(--muted); font-size: 11px; line-height: 1.45; }
    .wealth-comparison-part .comparison-estimate { color: var(--amber); font-weight: 800; }
    .overview-action {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr) auto;
      align-items: center;
      gap: 14px;
      min-height: 74px;
      margin-top: 14px;
      border: 1px solid #7b5316;
      border-radius: 13px;
      background: #2b2115;
      padding: 14px 18px;
    }
    .overview-action .task-mark { width: 38px; height: 38px; border-radius: 9px; }
    .overview-action strong { display: block; font-size: 16px; }
    .overview-action p { margin-top: 2px; color: #b9a98f; font-size: 13px; }
    .text-action {
      display: inline-flex;
      min-height: 44px;
      align-items: center;
      gap: 7px;
      border: 0;
      background: transparent;
      color: var(--amber);
      font-weight: 700;
      cursor: pointer;
      text-decoration: none;
    }
    .text-action:hover { color: #ffd07d; }
    .text-action svg { width: 16px; height: 16px; transform: rotate(-90deg); }
    .overview-dashboard-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 14px; margin-top: 14px; }
    .overview-panel { min-width: 0; border: 1px solid var(--line); border-radius: 13px; background: var(--surface); padding: 20px 22px; }
    .panel-header { display: flex; min-height: 28px; align-items: flex-start; justify-content: space-between; gap: 16px; }
    .panel-header h2 { font-size: 19px; }
    .panel-meta, .panel-link { color: #7fb0ff; font-size: 13px; }
    .panel-link[aria-disabled="true"] { cursor: not-allowed; opacity: .75; }
    .cashflow-panel-header { align-items: center; }
    .cashflow-period { margin-top: 4px; color: var(--muted); font-size: 13px; }
    .period-controls { display: flex; align-items: center; gap: 6px; }
    .period-controls button, .period-controls select {
      min-width: 44px;
      min-height: 44px;
      border: 1px solid var(--line);
      border-radius: 9px;
      background: #111c30;
      color: var(--text);
      font: inherit;
    }
    .period-controls button { display: grid; place-items: center; cursor: pointer; }
    .period-controls button:hover:not(:disabled), .period-controls select:hover { border-color: #60769a; background: #17243a; }
    .period-controls button:disabled { cursor: not-allowed; opacity: .38; }
    .period-controls button svg { width: 18px; height: 18px; }
    .period-controls .range-previous svg { transform: rotate(90deg); }
    .period-controls .range-next svg { transform: rotate(-90deg); }
    .cashflow-window { min-width: 112px !important; padding: 0 34px 0 12px; cursor: pointer; }
    .chart-legend { display: flex; flex-wrap: wrap; gap: 18px; margin-top: 8px; color: var(--muted); font-size: 13px; }
    .legend-key { display: inline-flex; align-items: center; gap: 7px; }
    .legend-key i { display: block; width: 10px; height: 10px; border-radius: 2px; }
    .cashflow-chart {
      display: grid;
      grid-template-columns: repeat(var(--month-count, 4), minmax(0, 1fr));
      align-items: end;
      gap: 16px;
      min-height: 154px;
      margin-top: 8px;
      padding: 20px 8px 0;
      border-bottom: 1px solid #51607a;
    }
    .cashflow-month { display: grid; grid-template-rows: 110px auto; align-items: end; min-width: 0; }
    .bar-pair { display: flex; height: 110px; align-items: end; justify-content: center; gap: 6px; }
    .chart-bar { position: relative; width: min(32px, 42%); height: max(2px, var(--bar-height)); border-radius: 3px 3px 0 0; }
    .chart-bar.income { background: var(--blue); }
    .chart-bar.spent { background: var(--orange); }
    .chart-value { position: absolute; inset: auto 50% calc(100% + 4px) auto; transform: translateX(50%); color: var(--text); font-size: 11px; font-weight: 700; white-space: nowrap; font-variant-numeric: tabular-nums; }
    .chart-month-label { padding-top: 8px; color: var(--muted); text-align: center; font-size: 12px; }
    @media (min-width: 981px) {
      .overview-panel[data-month-count="12"] { grid-column: 1 / -1; }
      .chart-legend { gap: 24px; margin-top: 18px; font-size: 15px; }
      .legend-key { gap: 9px; }
      .legend-key i { width: 12px; height: 12px; }
      .cashflow-chart { min-height: 230px; margin-top: 12px; padding: 38px 12px 0; }
      .cashflow-month { grid-template-rows: 166px auto; }
      .bar-pair { height: 166px; gap: 14px; }
      .chart-bar { width: clamp(18px, 36%, 88px); }
      .chart-value { font-size: 15px; }
      .chart-month-label { padding-top: 12px; font-size: 16px; }
    }
    .allocation-list, .spending-list { display: grid; gap: 18px; margin-top: 26px; }
    .allocation-row { display: grid; grid-template-columns: 78px minmax(60px, 1fr) auto; align-items: center; gap: 14px; }
    .allocation-track, .spending-track { height: 12px; overflow: hidden; border-radius: 3px; background: #1a263b; }
    .allocation-track i { display: block; width: var(--width); height: 100%; border-radius: inherit; background: #6f88b4; }
    .allocation-row strong, .spending-row strong { font-variant-numeric: tabular-nums; }
    .spending-list { gap: 12px; margin-top: 22px; }
    .spending-panel-header { align-items: center; }
    .spending-summary { display: flex; align-items: baseline; gap: 12px; }
    .spending-summary strong { font-size: 15px; font-variant-numeric: tabular-nums; white-space: nowrap; }
    .spending-window { min-width: 142px !important; padding: 0 34px 0 12px; cursor: pointer; }
    .spending-row { display: grid; grid-template-columns: minmax(130px, .9fr) minmax(80px, 1.6fr) auto; align-items: center; gap: 14px; font-size: 13px; }
    .spending-track { height: 9px; }
    .spending-track i { display: block; width: var(--width); height: 100%; border-radius: inherit; background: var(--orange); }
    .spending-other { margin-top: 14px; padding-top: 13px; border-top: 1px solid var(--line-soft); }
    .spending-other .spending-track { visibility: hidden; }
    .panel-footer { display: flex; justify-content: flex-end; margin-top: 14px; }
    .freshness-list { margin-top: 16px; border: 1px solid var(--line-soft); border-radius: 9px; }
    .freshness-row { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 12px; min-height: 46px; padding: 8px 12px; }
    .freshness-row + .freshness-row { border-top: 1px solid var(--line-soft); }
    .freshness-row > svg { width: 20px; height: 20px; color: #d2dbea; }
    .freshness-label { display: flex; flex-wrap: wrap; gap: 6px; }
    .freshness-label span { color: var(--muted); }
    .freshness-status { display: inline-flex; align-items: center; gap: 7px; font-size: 13px; font-weight: 700; white-space: nowrap; }
    .freshness-status .status-icon { width: 20px; height: 20px; }
    .freshness-status .status-icon svg { width: 13px; height: 13px; }
    .data-checked { margin-top: 13px; color: var(--muted); font-size: 12px; }
    .panel-unavailable { display: grid; min-height: 190px; place-items: center; color: var(--muted); text-align: center; }
    .overview-warning { margin: 14px 0 0; border: 1px solid #7b5316; border-radius: 10px; padding: 12px 14px; background: #2b2115; color: #dcc8a6; }
    .expense-summary-band {
      display: grid;
      grid-template-columns: minmax(290px, 1.2fr) repeat(3, minmax(150px, .8fr));
      align-items: stretch;
      overflow: hidden;
      border: 1px solid var(--line);
      border-radius: var(--radius);
      background: var(--surface);
      box-shadow: var(--shadow);
    }
    .expense-period { display: flex; align-items: center; padding: 20px; }
    .expense-period .period-controls { width: 100%; }
    .expense-period select { flex: 1; min-width: 150px; cursor: pointer; }
    .expense-summary-stat { display: grid; align-content: center; min-height: 104px; border-left: 1px solid var(--line-soft); padding: 18px 22px; }
    .expense-summary-stat span { color: var(--muted); font-size: 13px; }
    .expense-summary-stat strong { margin-top: 5px; font-size: 25px; line-height: 1.1; font-variant-numeric: tabular-nums; }
    .expense-workspace {
      display: grid;
      grid-template-columns: minmax(300px, .75fr) minmax(620px, 1.9fr);
      gap: 12px;
      margin-top: 12px;
    }
    .expense-pane { min-width: 0; border: 1px solid var(--line); border-radius: 13px; background: var(--surface); }
    .expense-category-pane { padding: 18px 16px; }
    .expense-transactions-pane { padding: 18px 16px 12px; }
    .expense-pane-heading { margin-bottom: 12px; }
    .expense-pane-heading h2 { font-size: 19px; }
    .expense-pane-heading p { margin-top: 3px; color: var(--muted); font-size: 13px; }
    .expense-search { position: relative; display: block; margin: 0; }
    .expense-search svg { position: absolute; top: 50%; left: 12px; width: 18px; height: 18px; color: var(--muted); transform: translateY(-50%); pointer-events: none; }
    .expense-search input {
      width: 100%;
      min-height: 44px;
      border: 1px solid var(--line);
      border-radius: 9px;
      background: #0d1525;
      color: var(--text);
      padding: 10px 12px 10px 39px;
    }
    .expense-search input::placeholder { color: var(--muted); opacity: 1; }
    .expense-category-list { display: grid; gap: 4px; margin-top: 12px; }
    .expense-category {
      display: grid;
      width: 100%;
      min-height: 58px;
      gap: 6px;
      border: 1px solid transparent;
      border-radius: 9px;
      padding: 9px 10px;
      background: transparent;
      color: var(--text);
      text-align: left;
      cursor: pointer;
    }
    .expense-category:hover { background: var(--surface-2); }
    .expense-category[aria-current="true"] { border-color: #4f91ff; background: #162b4c; }
    .expense-category-main { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 8px; }
    .expense-category-check { display: none; width: 20px; height: 20px; place-items: center; border-radius: 50%; background: var(--blue); color: #07111f; }
    .expense-category-check svg { width: 13px; height: 13px; }
    .expense-category[aria-current="true"] .expense-category-check { display: grid; }
    .expense-category-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .expense-category strong { font-variant-numeric: tabular-nums; white-space: nowrap; }
    .expense-category-track { height: 7px; overflow: hidden; border-radius: 3px; background: #1a263b; }
    .expense-category-track i { display: block; width: var(--width); height: 100%; border-radius: inherit; background: var(--orange); }
    .expense-category-all { min-height: 46px; align-content: center; }
    .expense-category-all .expense-category-track { display: none; }
    .expense-category-more { display: none; width: 100%; min-height: 44px; border: 0; background: transparent; color: #7fb0ff; cursor: pointer; }
    .expense-category-more:hover { background: var(--surface-2); }
    .expense-category-more svg { width: 16px; height: 16px; margin-left: 4px; vertical-align: middle; }
    .expense-toolbar { display: grid; grid-template-columns: minmax(260px, 1.5fr) minmax(160px, .65fr); gap: 10px; margin-bottom: 12px; }
    .expense-toolbar label { margin: 0; }
    .expense-toolbar select { min-height: 44px; cursor: pointer; }
    .expense-table-wrap { overflow-x: auto; border: 1px solid var(--line-soft); border-radius: 9px; }
    .expense-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    .expense-table th, .expense-table td { padding: 9px 12px; border-bottom: 1px solid var(--line-soft); text-align: left; }
    .expense-table tr:last-child td { border-bottom: 0; }
    .expense-table th { color: var(--muted); font-size: 12px; font-weight: 500; }
    .expense-table th:nth-child(1) { width: 16%; }
    .expense-table th:nth-child(2) { width: 24%; }
    .expense-table th:nth-child(3) { width: 23%; }
    .expense-table th:nth-child(4) { width: 22%; }
    .expense-table th:nth-child(5) { width: 15%; }
    .expense-table th:last-child, .expense-table td:last-child { text-align: right; }
    .expense-table td { overflow: hidden; font-size: 13px; text-overflow: ellipsis; white-space: nowrap; }
    .expense-amount { font-variant-numeric: tabular-nums; white-space: nowrap; }
    .expense-refund { color: var(--green); }
    .expense-mobile-list { display: none; overflow: hidden; border: 1px solid var(--line-soft); border-radius: 9px; }
    .expense-mobile-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 3px 10px; min-height: 78px; align-content: center; padding: 11px 12px; }
    .expense-mobile-row + .expense-mobile-row { border-top: 1px solid var(--line-soft); }
    .expense-mobile-row strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .expense-mobile-row .expense-date { color: var(--muted); font-size: 12px; }
    .expense-mobile-meta { overflow: hidden; color: var(--muted); font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
    .expense-pagination { display: flex; min-height: 52px; align-items: center; justify-content: space-between; gap: 14px; padding-top: 9px; color: var(--muted); }
    .expense-pagination span { font-variant-numeric: tabular-nums; }
    .expense-pagination-actions { display: flex; gap: 7px; }
    .expense-pagination button { display: grid; width: 44px; height: 44px; place-items: center; border: 1px solid var(--line); border-radius: 9px; background: #111c30; cursor: pointer; }
    .expense-pagination button:disabled { cursor: not-allowed; opacity: .38; }
    .expense-pagination button:hover:not(:disabled) { border-color: #3b4d6a; background: var(--surface-2); }
    .expense-pagination svg { width: 17px; height: 17px; }
    .expense-pagination .page-previous svg { transform: rotate(90deg); }
    .expense-pagination .page-next svg { transform: rotate(-90deg); }
    .expense-state { display: grid; min-height: 390px; place-items: center; border: 1px solid var(--line); border-radius: 13px; background: var(--surface); padding: 32px; text-align: center; }
    .expense-state-inner { max-width: 440px; }
    .expense-state .status-icon { width: 48px; height: 48px; margin: 0 auto 18px; }
    .expense-state .status-icon svg { width: 24px; height: 24px; }
    .expense-state h2 { font-size: 20px; }
    .expense-state p { margin: 7px 0 18px; color: var(--muted); }
    .assets-summary {
      display: grid;
      grid-template-columns: minmax(250px, .8fr) minmax(520px, 2fr);
      gap: 28px;
      align-items: center;
      border: 1px solid var(--line);
      border-radius: var(--radius);
      padding: 24px 26px;
      background: var(--surface);
      box-shadow: var(--shadow);
    }
    .assets-total span { display: block; color: var(--muted); font-size: 13px; }
    .assets-total strong { display: block; margin-top: 5px; font-size: clamp(34px, 4vw, 48px); line-height: 1.05; font-variant-numeric: tabular-nums; }
    .assets-total small { display: block; margin-top: 9px; color: var(--muted); }
    .assets-allocation { min-width: 0; }
    .assets-status-line { margin-bottom: 14px; color: var(--muted); text-align: right; }
    .assets-status-line strong { color: var(--green); font-weight: 600; }
    .assets-bar { display: flex; width: 100%; height: 30px; overflow: hidden; border-radius: 7px; background: var(--surface-3); }
    .assets-bar span { display: block; min-width: 0; height: 100%; }
    .assets-legend { display: grid; grid-template-columns: repeat(4, minmax(110px, 1fr)); gap: 12px; margin-top: 14px; }
    .assets-legend-item { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 2px 8px; color: var(--muted); }
    .assets-legend-item i, .asset-area-dot { width: 10px; height: 10px; align-self: center; border-radius: 2px; background: var(--area-color); }
    .assets-legend-item strong { grid-column: 2; color: var(--text); font-variant-numeric: tabular-nums; }
    .area-cash { --area-color: #3b82f6; }
    .area-depots { --area-color: #43c6ad; }
    .area-pensions { --area-color: #9b75e8; }
    .area-crypto { --area-color: #ff842b; }
    .area-precious-metals { --area-color: #d4a72c; }
    .assets-workspace { display: grid; grid-template-columns: minmax(260px, .72fr) minmax(650px, 2.2fr); gap: 12px; margin-top: 12px; }
    .assets-pane { min-width: 0; border: 1px solid var(--line); border-radius: 13px; background: var(--surface); padding: 18px 16px; }
    .assets-pane h2 { font-size: 19px; }
    .asset-area-list { display: grid; gap: 7px; margin-top: 14px; }
    .asset-area-button {
      display: grid;
      width: 100%;
      min-height: 104px;
      gap: 7px;
      border: 1px solid var(--line-soft);
      border-radius: 10px;
      padding: 13px;
      background: #0e1829;
      color: var(--text);
      text-align: left;
      cursor: pointer;
    }
    .asset-area-button:hover { border-color: #3b4d6a; background: var(--surface-2); }
    .asset-area-button[aria-current="true"] { border-color: #4f91ff; background: #162b4c; }
    .asset-area-title { display: flex; align-items: center; gap: 8px; font-weight: 700; }
    .asset-area-value { display: flex; justify-content: space-between; gap: 12px; font-variant-numeric: tabular-nums; }
    .asset-area-meta { color: var(--muted); font-size: 12px; }
    .assets-mobile-filter { display: none; margin-top: 14px; }
    .assets-mobile-filter select { min-height: 44px; cursor: pointer; }
    .assets-pane-header { display: flex; align-items: end; justify-content: space-between; gap: 16px; margin-bottom: 12px; }
    .assets-pane-header p { margin-top: 3px; color: var(--muted); font-size: 13px; }
    .assets-notice { display: flex; min-height: 50px; align-items: center; justify-content: space-between; gap: 18px; margin-bottom: 14px; border: 1px solid #7b5316; border-radius: 9px; padding: 11px 14px; background: #2b2115; color: #e6d3af; }
    .assets-notice a { color: var(--amber); font-weight: 700; text-decoration: none; }
    .assets-table-wrap { overflow-x: auto; border: 1px solid var(--line-soft); border-radius: 9px; }
    .assets-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    .assets-table th, .assets-table td { padding: 12px; border-bottom: 1px solid var(--line-soft); text-align: left; }
    .assets-table tr:last-child td { border-bottom: 0; }
    .assets-table th { color: var(--muted); font-size: 12px; font-weight: 500; }
    .assets-table th:nth-child(1) { width: 27%; }
    .assets-table th:nth-child(2) { width: 17%; }
    .assets-table th:nth-child(3) { width: 18%; }
    .assets-table th:nth-child(4) { width: 18%; }
    .assets-table th:nth-child(5) { width: 20%; }
    .assets-table td { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .assets-table td:first-child svg { width: 18px; height: 18px; margin-right: 8px; color: var(--blue); vertical-align: middle; }
    .assets-table td:nth-child(3) { font-weight: 700; font-variant-numeric: tabular-nums; }
    .asset-area-cell { display: inline-flex; align-items: center; gap: 7px; color: var(--muted); }
    .asset-state-text { display: block; color: var(--muted); font-size: 11px; }
    .assets-mobile-list { display: none; overflow: hidden; border: 1px solid var(--line-soft); border-radius: 9px; }
    .assets-mobile-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 3px 12px; min-height: 92px; align-content: center; padding: 13px; }
    .assets-mobile-row + .assets-mobile-row { border-top: 1px solid var(--line-soft); }
    .assets-mobile-row strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .assets-mobile-row .asset-mobile-value { font-size: 17px; font-variant-numeric: tabular-nums; }
    .asset-mobile-meta { color: var(--muted); font-size: 12px; }
    .analysis-toolbar {
      display: grid;
      grid-template-columns: minmax(220px, 1.4fr) repeat(2, minmax(150px, .7fr)) auto;
      gap: 12px;
      align-items: end;
      border: 1px solid var(--line);
      border-radius: var(--radius);
      background: var(--surface);
      padding: 16px;
    }
    .analysis-toolbar label { margin: 0; }
    .analysis-toolbar select { cursor: pointer; }
    .analysis-summary {
      display: grid;
      grid-template-columns: minmax(280px, 1.4fr) repeat(2, minmax(170px, .7fr));
      overflow: hidden;
      margin-top: 12px;
      border: 1px solid var(--line);
      border-radius: var(--radius);
      background: var(--surface);
      box-shadow: var(--shadow);
    }
    .analysis-summary > div { min-height: 122px; padding: 22px 24px; }
    .analysis-summary > div + div { border-left: 1px solid var(--line-soft); }
    .analysis-summary span { color: var(--muted); font-size: 13px; }
    .analysis-summary strong { display: block; margin-top: 5px; font-size: 29px; line-height: 1.05; font-variant-numeric: tabular-nums; }
    .analysis-summary .analysis-total { font-size: clamp(38px, 4vw, 48px); }
    .analysis-basis { margin-top: 9px; color: var(--muted); font-size: 12px; }
    .analysis-estimate { color: var(--amber); font-weight: 800; letter-spacing: .02em; }
    .analysis-grid { display: grid; grid-template-columns: minmax(0, 1.45fr) minmax(320px, .7fr); gap: 12px; margin-top: 12px; }
    .analysis-panel { min-width: 0; border: 1px solid var(--line); border-radius: 13px; background: var(--surface); padding: 20px 22px; }
    .analysis-panel-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 19px; }
    .analysis-panel-head p { margin-top: 4px; color: var(--muted); font-size: 13px; }
    .analysis-legend { display: flex; flex-wrap: wrap; gap: 15px; color: var(--muted); font-size: 12px; }
    .analysis-legend i { display: inline-block; width: 10px; height: 10px; margin-right: 6px; border-radius: 2px; }
    .analysis-bars { display: grid; gap: 17px; }
    .analysis-category { display: grid; grid-template-columns: minmax(135px, .6fr) minmax(180px, 1.4fr) minmax(84px, auto); align-items: center; gap: 14px; }
    .analysis-category-label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .analysis-bar-pair { display: grid; gap: 5px; }
    .analysis-bar { height: 8px; overflow: hidden; border-radius: 3px; background: #1a263b; }
    .analysis-bar i { display: block; width: var(--width); height: 100%; border-radius: inherit; background: var(--blue); }
    .analysis-bar.comparison i { background: #53647f; }
    .analysis-category-values { display: grid; gap: 2px; text-align: right; font-size: 12px; font-variant-numeric: tabular-nums; }
    .analysis-category-values span:last-child { color: var(--muted); }
    .analysis-more { width: 100%; min-height: 44px; margin-top: 12px; border: 0; background: transparent; color: #7fb0ff; cursor: pointer; }
    .analysis-class-list { display: grid; gap: 14px; }
    .analysis-class-row { display: grid; grid-template-columns: minmax(110px, 1fr) auto; gap: 6px 14px; }
    .analysis-class-row strong { font-variant-numeric: tabular-nums; }
    .analysis-class-track { grid-column: 1 / -1; height: 9px; overflow: hidden; border-radius: 3px; background: #1a263b; }
    .analysis-class-track i { display: block; width: var(--width); height: 100%; border-radius: inherit; background: #6d86b1; }
    .analysis-positions { margin-top: 12px; }
    .analysis-position-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    .analysis-position-table th, .analysis-position-table td { padding: 12px 14px; border-bottom: 1px solid var(--line-soft); text-align: left; }
    .analysis-position-table th { color: var(--muted); font-size: 12px; font-weight: 500; }
    .analysis-position-table th:nth-child(1) { width: 34%; }
    .analysis-position-table th:nth-child(2) { width: 22%; }
    .analysis-position-table th:nth-child(3) { width: 20%; }
    .analysis-position-table th:nth-child(4) { width: 18%; }
    .analysis-position-table th:last-child { width: 6%; }
    .analysis-position-table td:nth-child(4) { font-weight: 700; font-variant-numeric: tabular-nums; }
    .analysis-position-button { display: contents; }
    .analysis-position-row { cursor: pointer; }
    .analysis-position-row:hover { background: var(--surface-2); }
    .analysis-position-row td:last-child { text-align: right; color: var(--muted); }
    .analysis-position-row td:last-child svg { width: 17px; height: 17px; transform: rotate(-90deg); transition: transform .16s ease; }
    .analysis-position-row[aria-expanded="true"] td:last-child svg { transform: rotate(0); }
    .analysis-position-detail[hidden] { display: none; }
    .analysis-position-detail td { padding: 14px 18px 18px; background: #0e1728; }
    .analysis-months { display: flex; flex-wrap: wrap; gap: 8px 16px; color: var(--muted); font-size: 12px; }
    .analysis-months strong { margin-left: 4px; color: var(--text); }
    .analysis-mobile-positions { display: none; }
    .analysis-warning { display: flex; gap: 11px; margin-top: 12px; border: 1px solid #7b5316; border-radius: 11px; background: #2b2115; padding: 13px 15px; color: #e6d3af; }
    .analysis-warning svg { width: 19px; height: 19px; flex: 0 0 auto; color: var(--amber); }
    .crypto-toolbar { grid-template-columns: minmax(260px, 1.4fr) repeat(2, minmax(170px, .7fr)); }
    .crypto-toolbar-meta { min-height: 44px; display: grid; align-content: center; gap: 2px; border-left: 1px solid var(--line-soft); padding-left: 16px; }
    .crypto-toolbar-meta span { color: var(--muted); font-size: 12px; }
    .crypto-toolbar-meta strong { font-size: 14px; }
    .crypto-summary .analysis-total { font-size: clamp(34px, 3.5vw, 46px); }
    .crypto-summary strong { white-space: nowrap; }
    .crypto-layout { display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(360px, .9fr); gap: 12px; margin-top: 12px; }
    .crypto-basis-list { display: grid; }
    .crypto-basis-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 5px 20px; padding: 15px 0; border-top: 1px solid var(--line-soft); }
    .crypto-basis-row:first-child { border-top: 0; padding-top: 0; }
    .crypto-basis-row > div { display: grid; gap: 3px; }
    .crypto-basis-row > span { color: var(--muted); font-size: 12px; }
    .crypto-basis-row > strong { grid-column: 2; grid-row: 1 / span 2; align-self: center; text-align: right; font-size: 21px; font-variant-numeric: tabular-nums; }
    .crypto-basis-row > strong small { display: block; margin-top: 3px; color: var(--muted); font-size: 11px; font-weight: 500; }
    .crypto-break-even { display: flex; align-items: center; justify-content: space-between; gap: 18px; margin-top: 10px; border: 1px solid #245ea8; border-radius: 9px; background: #11294a; padding: 13px 15px; }
    .crypto-break-even span { color: #b8c9e3; font-size: 12px; }
    .crypto-break-even strong { font-size: 20px; font-variant-numeric: tabular-nums; white-space: nowrap; }
    .crypto-holdings-list { display: grid; }
    .crypto-holding-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 3px 14px; min-height: 55px; align-content: center; border-top: 1px solid var(--line-soft); }
    .crypto-holding-row:first-child { border-top: 0; }
    .crypto-holding-row > div { display: grid; gap: 3px; }
    .crypto-holding-row span { color: var(--muted); font-size: 12px; }
    .crypto-holding-row > strong { grid-column: 2; grid-row: 1 / span 2; align-self: center; font-variant-numeric: tabular-nums; }
    .crypto-tax { margin-top: 12px; }
    .crypto-tax-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    .crypto-tax-table th, .crypto-tax-table td { padding: 13px 12px; border-top: 1px solid var(--line-soft); text-align: left; vertical-align: top; }
    .crypto-tax-table th { border-top: 0; color: var(--muted); font-size: 12px; font-weight: 500; }
    .crypto-tax-table th:nth-child(1) { width: 9%; }
    .crypto-tax-table th:nth-child(2) { width: 24%; }
    .crypto-tax-table th:nth-child(3) { width: 22%; }
    .crypto-tax-table th:nth-child(4) { width: 18%; }
    .crypto-tax-table th:nth-child(5) { width: 27%; }
    .crypto-tax-table td { font-size: 13px; }
    .crypto-tax-table td:first-child, .crypto-tax-reference { font-variant-numeric: tabular-nums; }
    .crypto-tax-reference small { display: block; margin-top: 3px; color: var(--muted); }
    .crypto-tax-detail { color: var(--muted); }
    .crypto-status { display: inline-flex; min-height: 28px; align-items: center; border: 1px solid var(--line); border-radius: 999px; padding: 4px 9px; font-size: 12px; font-weight: 700; }
    .crypto-status-review { border-color: #8a5916; background: #332313; color: #ffbd55; }
    .crypto-status-likely-tax-free { border-color: #1c6a58; background: #102d29; color: #63d7bd; }
    .crypto-status-below-threshold { border-color: #365c93; background: #142641; color: #9cc2ff; }
    .crypto-status-future-filing { border-color: #6b4d96; background: #251b36; color: #c9a8ff; }
    .crypto-tax-mobile { display: none; }
    .crypto-evidence { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); overflow: hidden; border: 1px solid var(--line-soft); border-radius: 9px; }
    .crypto-evidence-item { min-height: 94px; padding: 14px; }
    .crypto-evidence-item + .crypto-evidence-item { border-left: 1px solid var(--line-soft); }
    .crypto-evidence-item span { display: block; color: var(--muted); font-size: 12px; }
    .crypto-evidence-item strong { display: block; margin-top: 5px; }
    .crypto-evidence-item p { margin-top: 5px; color: var(--muted); font-size: 12px; }
    .recurring-toolbar { grid-template-columns: minmax(220px, 1.25fr) repeat(4, minmax(130px, .65fr)) auto; }
    .recurring-summary {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      overflow: hidden;
      margin-top: 12px;
      border: 1px solid var(--line);
      border-radius: var(--radius);
      background: var(--surface);
    }
    .recurring-summary > div { min-height: 94px; padding: 18px 22px; }
    .recurring-summary > div + div { border-left: 1px solid var(--line-soft); }
    .recurring-summary span { display: block; color: var(--muted); font-size: 13px; }
    .recurring-summary strong { display: block; margin-top: 4px; font-size: 28px; font-variant-numeric: tabular-nums; }
    .recurring-freshness { display: flex; flex-wrap: wrap; gap: 7px 18px; margin-top: 12px; color: var(--muted); font-size: 12px; }
    .recurring-panel { margin-top: 12px; }
    .recurring-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    .recurring-table th, .recurring-table td { padding: 13px 12px; border-bottom: 1px solid var(--line-soft); text-align: left; vertical-align: middle; }
    .recurring-table th { color: var(--muted); font-size: 12px; font-weight: 500; }
    .recurring-table th:nth-child(1) { width: 29%; }
    .recurring-table th:nth-child(2) { width: 16%; }
    .recurring-table th:nth-child(3), .recurring-table th:nth-child(4) { width: 14%; }
    .recurring-table th:nth-child(5) { width: 21%; }
    .recurring-table th:last-child { width: 6%; }
    .recurring-row:hover { background: var(--surface-2); }
    .recurring-open {
      display: grid;
      width: 100%;
      min-height: 44px;
      align-content: center;
      border: 0;
      background: transparent;
      color: var(--text);
      padding: 0;
      text-align: left;
      cursor: pointer;
    }
    .recurring-row td:nth-child(3), .recurring-row td:nth-child(4) { font-weight: 700; font-variant-numeric: tabular-nums; }
    .recurring-row td:last-child { color: var(--muted); text-align: right; }
    .recurring-row td:last-child svg { width: 17px; height: 17px; transform: rotate(-90deg); transition: transform .16s ease; }
    .recurring-row[data-open="true"] td:last-child svg { transform: rotate(0); }
    .recurring-status { display: grid; gap: 2px; }
    .recurring-status strong { font-size: 13px; }
    .recurring-status span { color: var(--muted); font-size: 12px; }
    .recurring-detail-row[hidden] { display: none; }
    .recurring-detail-row td { padding: 0; background: #0e1728; }
    .recurring-detail { padding: 19px 20px 22px; }
    .recurring-detail-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 1px; overflow: hidden; border: 1px solid var(--line-soft); border-radius: 10px; background: var(--line-soft); }
    .recurring-detail-grid > div { min-height: 76px; padding: 12px 14px; background: var(--surface); }
    .recurring-detail-grid span { display: block; color: var(--muted); font-size: 11px; }
    .recurring-detail-grid strong { display: block; margin-top: 4px; font-size: 14px; font-variant-numeric: tabular-nums; }
    .recurring-reasons { margin: 16px 0 0; padding-left: 20px; color: var(--muted); }
    .recurring-reasons li + li { margin-top: 4px; }
    .recurring-decision { display: flex; align-items: end; gap: 12px; margin-top: 18px; padding-top: 17px; border-top: 1px solid var(--line-soft); }
    .recurring-decision label { min-width: min(330px, 100%); }
    .recurring-decision p { margin-top: 5px; color: var(--muted); font-size: 12px; }
    .recurring-payment-list { display: grid; gap: 0; margin-top: 18px; border: 1px solid var(--line-soft); border-radius: 10px; }
    .recurring-payment { display: grid; grid-template-columns: 140px minmax(0, 1fr) auto; gap: 12px; padding: 10px 13px; border-bottom: 1px solid var(--line-soft); font-size: 13px; }
    .recurring-payment:last-child { border-bottom: 0; }
    .recurring-payment span:nth-child(2) { color: var(--muted); }
    .recurring-payment strong { font-variant-numeric: tabular-nums; }
    .recurring-mobile-list { display: none; }
    .recurring-mobile-row { border: 0; border-bottom: 1px solid var(--line-soft); background: transparent; color: var(--text); padding: 14px; text-align: left; cursor: pointer; }
    .recurring-mobile-row:last-child { border-bottom: 0; }
    .recurring-mobile-main { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 4px 12px; }
    .recurring-mobile-main > strong:last-of-type { font-variant-numeric: tabular-nums; }
    .recurring-mobile-meta { color: var(--muted); font-size: 12px; }
    .recurring-mobile-detail { display: none; padding: 0 14px 16px; background: #0e1728; }
    .recurring-mobile-row[aria-expanded="true"] + .recurring-mobile-detail { display: block; }
    .optimization-toolbar { grid-template-columns: minmax(260px, 1fr); }
    .optimization-summary { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .optimization-list { display: grid; gap: 12px; margin-top: 12px; }
    .optimization-card { display: grid; grid-template-columns: repeat(4, minmax(145px, 1fr)) auto; gap: 14px; align-items: end; padding: 18px; border: 1px solid var(--line); border-radius: var(--radius); background: var(--surface); }
    .optimization-title { grid-column: 1 / -1; align-self: center; }
    .optimization-title span, .optimization-title small { display: block; margin-top: 4px; color: var(--muted); }
    .optimization-title small { font-size: 11px; }
    .optimization-card label { color: var(--muted); font-size: 12px; }
    .optimization-card select, .optimization-card input { width: 100%; margin-top: 6px; }
    .optimization-stale { grid-column: 1 / -1; color: #ffbd55; font-size: 12px; }
    .decision-toolbar { grid-template-columns: minmax(260px, 1fr); }
    .decision-summary { grid-template-columns: 1.2fr repeat(3, 1fr); }
    .fire-cockpit { margin-top: 12px; }
    .fire-model { color: var(--muted); font-size: 12px; white-space: nowrap; }
    .fire-course, .fire-capital { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); overflow: hidden; margin-top: 14px; border: 1px solid var(--line-soft); border-radius: 10px; }
    .fire-course > div, .fire-capital > div { min-width: 0; padding: 15px 16px; }
    .fire-course > div + div, .fire-capital > div + div { border-left: 1px solid var(--line-soft); }
    .fire-course span, .fire-capital span { display: block; color: var(--muted); font-size: 11px; }
    .fire-course strong, .fire-capital strong { display: block; margin-top: 6px; font-size: 21px; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
    .fire-course small, .fire-capital small { display: block; margin-top: 5px; color: var(--muted); line-height: 1.4; }
    .fire-capital { margin-top: 0; border-top: 0; border-radius: 0 0 10px 10px; background: var(--surface-2); }
    .fire-course { border-radius: 10px 10px 0 0; }
    .fire-workspace { display: grid; grid-template-columns: minmax(230px, .43fr) minmax(0, 1.57fr); gap: 18px; margin-top: 20px; }
    .fire-controls { display: grid; align-content: start; gap: 14px; padding-right: 18px; border-right: 1px solid var(--line-soft); }
    .fire-controls label { color: var(--muted); font-size: 12px; }
    .fire-controls select { width: 100%; min-height: 44px; margin-top: 6px; }
    .fire-controls .button { width: 100%; }
    .fire-band { overflow: hidden; border: 1px solid var(--line-soft); border-radius: 9px; }
    .fire-band table { width: 100%; border-collapse: collapse; font-size: 12px; }
    .fire-band th, .fire-band td { padding: 9px 8px; border-bottom: 1px solid var(--line-soft); text-align: right; font-variant-numeric: tabular-nums; }
    .fire-band tr:last-child td { border-bottom: 0; }
    .fire-band th { color: var(--muted); font-weight: 500; }
    .fire-band th:first-child, .fire-band td:first-child { text-align: left; }
    .fire-levers-head { display: flex; align-items: start; justify-content: space-between; gap: 18px; }
    .fire-levers-head p { margin-top: 4px; color: var(--muted); font-size: 12px; }
    .fire-levers-head > strong { font-size: 18px; font-variant-numeric: tabular-nums; white-space: nowrap; }
    .fire-lever-groups { display: grid; gap: 8px; margin-top: 12px; }
    .fire-lever-group { overflow: hidden; border: 1px solid var(--line-soft); border-radius: 10px; background: rgba(255,255,255,.012); }
    .fire-lever-summary { display: grid; grid-template-columns: minmax(0, 1fr) auto auto 20px; gap: 14px; align-items: center; min-height: 60px; padding: 9px 12px; cursor: pointer; list-style: none; }
    .fire-lever-summary::-webkit-details-marker { display: none; }
    .fire-lever-summary:focus-visible { outline: 2px solid var(--blue); outline-offset: -3px; }
    .fire-lever-summary-main { display: grid; gap: 2px; }
    .fire-lever-summary-main strong { font-size: 14px; }
    .fire-lever-summary-main small, .fire-lever-summary-metric span { color: var(--muted); font-size: 11px; }
    .fire-lever-summary-metric { display: grid; gap: 2px; min-width: 118px; text-align: right; }
    .fire-lever-summary-metric strong { font-size: 13px; font-variant-numeric: tabular-nums; }
    .fire-lever-summary svg { width: 18px; height: 18px; color: var(--muted); transform: rotate(-90deg); transition: transform .16s ease; }
    .fire-lever-group[open] .fire-lever-summary svg { transform: rotate(0); }
    .fire-action-list { display: grid; border-top: 1px solid var(--line-soft); }
    .fire-row { display: grid; grid-template-columns: 30px minmax(145px, 1.25fr) minmax(125px, .75fr) minmax(145px, .8fr) minmax(145px, .8fr); gap: 10px; align-items: center; min-height: 62px; padding: 8px 12px; border-bottom: 1px solid var(--line-soft); }
    .fire-row:last-child { border-bottom: 0; }
    .fire-row > input { width: 18px; height: 18px; accent-color: #6ea8ff; }
    .fire-row:has(input:disabled) { opacity: .68; }
    .fire-row-main, .fire-row-metric { display: grid; gap: 2px; min-width: 0; }
    .fire-row-main strong { overflow-wrap: anywhere; }
    .fire-row-main small, .fire-row-metric small { color: var(--muted); font-size: 11px; line-height: 1.3; }
    .fire-row-metric strong { font-size: 13px; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
    .fire-row-metric select { width: 100%; min-height: 44px; }
    .fire-row-effect { text-align: right; }
    .fire-row-drill { min-width: 44px; min-height: 44px; padding: 0; border: 1px solid var(--line-soft); border-radius: 8px; background: transparent; color: var(--text); cursor: pointer; }
    .fire-row-drill svg { width: 17px; height: 17px; transform: rotate(-90deg); transition: transform .16s ease; }
    .fire-row-drill[aria-expanded="true"] svg { transform: rotate(0); }
    .fire-category-detail { grid-column: 1 / -1; margin: 0 -12px -8px; padding: 13px 16px 15px 52px; border-top: 1px solid var(--line-soft); background: #0e1728; }
    .fire-category-detail-head { display: flex; align-items: center; justify-content: space-between; gap: 14px; }
    .fire-category-detail-head h5 { margin: 0; font-size: 13px; }
    .fire-category-detail-head p { margin-top: 3px; color: var(--muted); font-size: 11px; }
    .fire-period-switch { display: flex; gap: 4px; padding: 3px; border: 1px solid var(--line-soft); border-radius: 8px; }
    .fire-period-switch button { min-height: 36px; padding: 0 10px; border: 0; border-radius: 6px; background: transparent; color: var(--muted); cursor: pointer; }
    .fire-period-switch button[aria-pressed="true"] { background: var(--surface-2); color: var(--text); }
    .fire-booking-list { margin-top: 10px; border: 1px solid var(--line-soft); border-radius: 8px; }
    .fire-booking-row { display: grid; grid-template-columns: 92px minmax(0, 1fr) auto; gap: 12px; align-items: center; min-height: 42px; padding: 7px 10px; border-bottom: 1px solid var(--line-soft); }
    .fire-booking-row:last-child { border-bottom: 0; }
    .fire-booking-row time, .fire-booking-row small { color: var(--muted); font-size: 11px; }
    .fire-booking-row strong { font-variant-numeric: tabular-nums; }
    .fire-booking-more { border-top: 1px solid var(--line-soft); }
    .fire-booking-more summary { min-height: 44px; padding: 13px 10px; color: var(--blue); cursor: pointer; }
    .fire-booking-more .fire-booking-row { border-top: 1px solid var(--line-soft); border-bottom: 0; }
    .fire-action-umgesetzt { box-shadow: inset 3px 0 #5cc99a; }
    .fire-action-klar { box-shadow: inset 3px 0 #6ea8ff; }
    .fire-action-pruefen { box-shadow: inset 3px 0 #d8a24d; }
    .fire-empty { padding: 18px 0; color: var(--muted); }
    .fire-basis { margin-top: 18px; padding-top: 14px; border-top: 1px solid var(--line-soft); color: var(--muted); font-size: 12px; }
    .fire-basis summary { min-height: 44px; cursor: pointer; color: var(--text); }
    .fire-basis ul { margin: 0; padding: 0 0 0 18px; }
    .fire-basis li + li { margin-top: 5px; }
    .decision-context { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 12px; margin-top: 12px; }
    .decision-context-grid { overflow: hidden; border: 1px solid var(--line-soft); border-radius: 10px; }
    .decision-context-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    .decision-context-table th, .decision-context-table td { min-height: 52px; padding: 11px 12px; border-bottom: 1px solid var(--line-soft); text-align: right; font-variant-numeric: tabular-nums; }
    .decision-context-table tr:last-child td { border-bottom: 0; }
    .decision-context-table th { background: var(--surface-2); color: var(--muted); font-size: 12px; font-weight: 500; }
    .decision-context-table th:first-child, .decision-context-table td:first-child { width: 42%; color: var(--muted); text-align: left; }
    .decision-annual { margin-top: 12px; }
    .decision-annual-progress { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 4px; }
    .decision-annual-progress span { min-width: 26px; padding: 4px 7px; border: 1px solid var(--line-soft); border-radius: 999px; color: var(--muted); font-size: 11px; text-align: center; }
    .decision-annual-progress .complete { border-color: #405274; background: #17233a; color: var(--text); }
    .decision-annual-table tr.projected td { background: rgba(110,168,255,.06); }
    .decision-annual-variance { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 12px; align-items: baseline; margin-top: 14px; padding: 13px 14px; border: 1px solid var(--line-soft); border-radius: 10px; background: var(--surface-2); }
    .decision-annual-variance span { color: var(--muted); font-size: 12px; }
    .decision-annual-variance strong { font-size: 18px; font-variant-numeric: tabular-nums; }
    .decision-breakdown { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
    .decision-breakdown-list { display: grid; align-content: start; }
    .decision-breakdown-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 14px; padding: 9px 0; border-bottom: 1px solid var(--line-soft); }
    .decision-breakdown-row:last-child { border-bottom: 0; }
    .decision-breakdown-row span { color: var(--muted); font-size: 12px; }
    .decision-breakdown-row strong { font-variant-numeric: tabular-nums; }
    .decision-breakdown-note { margin-top: 12px; color: var(--muted); font-size: 11px; line-height: 1.5; }
    .decision-layout { display: grid; grid-template-columns: minmax(280px, .62fr) minmax(0, 1.38fr); gap: 12px; margin-top: 12px; }
    .decision-assumptions form { display: grid; gap: 16px; }
    .decision-assumptions label { margin: 0; color: var(--muted); font-size: 12px; }
    .decision-assumptions input, .decision-assumptions select { width: 100%; min-height: 44px; margin-top: 6px; font-variant-numeric: tabular-nums; }
    .decision-assumptions small { display: block; margin-top: 5px; color: var(--muted); font-size: 11px; line-height: 1.45; }
    .decision-assumptions .button { width: 100%; margin-top: 2px; }
    .decision-chart { margin: 0; }
    .decision-chart svg { display: block; width: 100%; min-height: 270px; }
    .decision-chart figcaption { margin-top: 8px; color: var(--muted); font-size: 12px; }
    .decision-grid path { fill: none; stroke: var(--line-soft); stroke-width: 1; }
    .decision-axis { fill: var(--muted); font-size: 11px; }
    .decision-line { fill: none; stroke-width: 3; vector-effect: non-scaling-stroke; }
    .decision-line.baseline { stroke: #7f91ad; }
    .decision-line.scenario { stroke: #6ea8ff; stroke-dasharray: 9 6; }
    .decision-legend { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 10px 18px; margin-bottom: 4px; color: var(--muted); font-size: 12px; }
    .decision-legend span { display: inline-flex; align-items: center; gap: 7px; }
    .decision-legend i { width: 28px; height: 0; border-top: 3px solid #7f91ad; }
    .decision-legend i.scenario { border-top-color: #6ea8ff; border-top-style: dashed; }
    .decision-depletion { margin-top: 10px; }
    .decision-details { margin-top: 12px; }
    .decision-milestones { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); overflow: hidden; border: 1px solid var(--line-soft); border-radius: 10px; }
    .decision-milestone { min-width: 0; padding: 15px; }
    .decision-milestone + .decision-milestone { border-left: 1px solid var(--line-soft); }
    .decision-milestone > span { color: var(--muted); font-size: 12px; }
    .decision-milestone > div { display: grid; grid-template-columns: auto minmax(0, 1fr); align-items: baseline; gap: 8px; margin-top: 10px; }
    .decision-milestone small { color: var(--muted); }
    .decision-milestone strong { overflow: hidden; font-size: 17px; font-variant-numeric: tabular-nums; text-overflow: ellipsis; }
    .decision-milestone p { margin-top: 10px; font-size: 12px; }
    .decision-source { display: grid; grid-template-columns: minmax(0, .85fr) minmax(0, 1.15fr); gap: 20px; margin-top: 18px; padding-top: 17px; border-top: 1px solid var(--line-soft); color: var(--muted); font-size: 12px; }
    .decision-source ul { margin: 0; padding-left: 18px; }
    .decision-source li + li { margin-top: 5px; }
    .mobile-nav { display: none; }
    @media (max-width: 980px) {
      .sidebar { width: 216px; }
      .content { margin-left: 216px; }
      .content-inner { padding: 32px 28px 68px; }
      .status-overview { grid-template-columns: 1fr; }
      .source-summary { grid-template-columns: minmax(170px, 1fr) minmax(120px, .6fr) auto; }
      .source-result { display: none; }
      .task-list { grid-template-columns: 1fr; }
      .system-band { grid-template-columns: repeat(2, 1fr); }
      .wealth-overview { grid-template-columns: 1fr; gap: 24px; }
      .wealth-comparison { grid-column: 1; }
      .wealth-comparison-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .expense-summary-band { grid-template-columns: 1fr repeat(3, 1fr); }
      .expense-period { grid-column: 1 / -1; border-bottom: 1px solid var(--line-soft); }
      .expense-summary-stat:first-of-type { border-left: 0; }
      .expense-workspace { grid-template-columns: minmax(250px, .8fr) minmax(460px, 1.4fr); }
      .assets-summary { grid-template-columns: 1fr; gap: 20px; }
      .assets-status-line { text-align: left; }
      .assets-workspace { grid-template-columns: minmax(230px, .7fr) minmax(480px, 1.5fr); }
      .analysis-grid { grid-template-columns: 1fr; }
      .crypto-layout { grid-template-columns: 1fr; }
      .decision-layout { grid-template-columns: 1fr; }
      .decision-context { grid-template-columns: 1fr; }
      .decision-milestones { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .decision-milestone:nth-child(3) { border-left: 0; border-top: 1px solid var(--line-soft); }
      .decision-milestone:nth-child(4) { border-top: 1px solid var(--line-soft); }
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
      .status-overview .overview-main { padding: 22px 20px; }
      .status-overview .overview-stats { grid-template-columns: repeat(3, 1fr); }
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
      .wealth-overview { min-height: 0; padding: 22px 20px; }
      .wealth-composition { margin-top: 2px; }
      .wealth-health { justify-content: flex-start; margin-bottom: 16px; }
      .wealth-comparison-grid { grid-template-columns: 1fr; gap: 12px; }
      .wealth-comparison-head { align-items: flex-start; flex-direction: column; gap: 3px; }
      .overview-action { gap: 10px; padding: 12px 14px; }
      .overview-action .task-mark { width: 36px; height: 36px; }
      .overview-action strong { font-size: 14px; white-space: nowrap; }
      .overview-action p { font-size: 11px; white-space: nowrap; }
      .overview-action .text-action { padding: 0; font-size: 12px; }
      .overview-action .to-prefix { display: none; }
      .overview-dashboard-grid { grid-template-columns: 1fr; }
      .expense-summary-band { grid-template-columns: repeat(3, 1fr); }
      .expense-period { padding: 16px; }
      .expense-summary-stat { min-height: 88px; padding: 14px 12px; }
      .expense-summary-stat strong { font-size: 21px; }
      .expense-workspace { grid-template-columns: 1fr; }
      .expense-category-pane, .expense-transactions-pane { padding: 18px 16px; }
      .expense-category:nth-of-type(n+7) { display: none; }
      .categories-expanded .expense-category:nth-of-type(n+7) { display: grid; }
      .expense-category-more { display: block; }
      .categories-expanded .expense-category-more svg { transform: rotate(180deg); }
      .expense-table-wrap { display: none; }
      .expense-mobile-list { display: block; }
      .expense-toolbar { grid-template-columns: 1fr; }
      .assets-workspace { grid-template-columns: 1fr; }
      .assets-area-pane { padding: 16px; }
      .asset-area-list { display: none; }
      .assets-mobile-filter { display: block; }
      .assets-table-wrap { display: none; }
      .assets-mobile-list { display: block; }
      .analysis-toolbar { grid-template-columns: 1fr 1fr; }
      .analysis-toolbar > label:first-child { grid-column: 1 / -1; }
      .analysis-toolbar .button { width: 100%; }
      .analysis-summary { grid-template-columns: 1fr 1fr; }
      .analysis-summary > div:first-child { grid-column: 1 / -1; }
      .analysis-summary > div:nth-child(2) { border-left: 0; border-top: 1px solid var(--line-soft); }
      .analysis-summary > div:nth-child(3) { border-top: 1px solid var(--line-soft); }
      .analysis-position-table { display: none; }
      .analysis-mobile-positions { display: grid; overflow: hidden; border: 1px solid var(--line-soft); border-radius: 9px; }
      .analysis-mobile-row { border: 0; border-bottom: 1px solid var(--line-soft); background: transparent; color: var(--text); padding: 14px; text-align: left; cursor: pointer; }
      .analysis-mobile-row:last-child { border-bottom: 0; }
      .analysis-mobile-main { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 4px 12px; }
      .analysis-mobile-main strong:last-child { font-variant-numeric: tabular-nums; }
      .analysis-mobile-meta { color: var(--muted); font-size: 12px; }
      .analysis-mobile-detail { display: none; margin-top: 10px; }
      .analysis-mobile-row[aria-expanded="true"] .analysis-mobile-detail { display: flex; }
      .crypto-toolbar { grid-template-columns: 1fr 1fr; }
      .crypto-toolbar > label { grid-column: 1 / -1; }
      .crypto-evidence { grid-template-columns: 1fr; }
      .crypto-evidence-item + .crypto-evidence-item { border-left: 0; border-top: 1px solid var(--line-soft); }
      .recurring-toolbar { grid-template-columns: 1fr 1fr; }
      .recurring-toolbar > label:first-child { grid-column: 1 / -1; }
      .recurring-toolbar .button { width: 100%; }
      .recurring-table { display: none; }
      .recurring-mobile-list { display: grid; overflow: hidden; border: 1px solid var(--line-soft); border-radius: 9px; }
      .recurring-detail-grid { grid-template-columns: 1fr 1fr; }
      .recurring-decision { align-items: stretch; flex-direction: column; }
      .recurring-decision .button { width: 100%; }
      .optimization-card { grid-template-columns: 1fr 1fr; }
      .optimization-title { grid-column: 1 / -1; }
      .optimization-card .button { width: 100%; }
      .decision-summary { grid-template-columns: 1fr 1fr; }
      .decision-summary > div:first-child { grid-column: 1 / -1; }
      .decision-chart svg { min-height: 230px; }
      .decision-source { grid-template-columns: 1fr; gap: 12px; }
      .fire-course, .fire-capital { grid-template-columns: 1fr 1fr; }
      .fire-course > div:nth-child(3), .fire-course > div:nth-child(4), .fire-capital > div:nth-child(3), .fire-capital > div:nth-child(4) { border-top: 1px solid var(--line-soft); }
      .fire-course > div:nth-child(3), .fire-capital > div:nth-child(3) { border-left: 0; }
      .fire-workspace { grid-template-columns: 1fr; }
      .fire-controls { grid-template-columns: minmax(180px, .45fr) minmax(0, 1fr); padding-right: 0; padding-bottom: 18px; border-right: 0; border-bottom: 1px solid var(--line-soft); }
      .fire-controls .button { grid-column: 1 / -1; }
      .overview-panel { padding: 18px 16px; }
      .overview-panel .panel-header { gap: 8px; }
      .overview-panel .panel-header h2 { font-size: 18px; }
      .overview-panel .panel-link { font-size: 12px; white-space: nowrap; }
      .cashflow-panel-header { display: grid; grid-template-columns: minmax(0, 1fr) auto; }
      .period-controls button, .period-controls select { min-height: 44px; }
      .cashflow-chart { gap: 8px; padding-inline: 0; }
      .allocation-row { grid-template-columns: 82px minmax(54px, 1fr) auto; gap: 10px; }
      .spending-row { grid-template-columns: minmax(118px, 1fr) minmax(55px, 1fr) auto; gap: 8px; }
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
      .status-overview .overview-stats { grid-template-columns: 1fr; }
      .stat { min-height: 66px; border-left: 0; border-top: 1px solid var(--line-soft); grid-template-columns: 48px 1fr; align-items: center; }
      .stat span { margin-top: 0; }
      .system-band { grid-template-columns: 1fr; }
      .system-item + .system-item { border-left: 0; border-top: 1px solid var(--line-soft); }
      h1 { font-size: 30px; }
      .wealth-value { font-size: 40px; }
      .cashflow-panel-header { grid-template-columns: 1fr; }
      .period-controls { margin-top: 10px; }
      .cashflow-window { flex: 1; }
      .spending-panel-header { display: grid; grid-template-columns: 1fr; }
      .spending-window { flex: 1; }
      .cashflow-chart { min-height: 154px; }
      .cashflow-month { grid-template-rows: 110px auto; }
      .bar-pair { height: 110px; }
      .chart-value { font-size: 10px; }
      .spending-row { grid-template-columns: minmax(0, 1fr) auto; }
      .spending-track { display: none; }
      .expense-summary-band { grid-template-columns: 1fr; }
      .expense-summary-stat { min-height: 68px; border-left: 0; border-top: 1px solid var(--line-soft); grid-template-columns: minmax(0, 1fr) auto; align-items: center; }
      .expense-summary-stat strong { margin-top: 0; }
      .expense-period .period-controls { display: grid; grid-template-columns: 44px minmax(0, 1fr) 44px; }
      .expense-category { min-height: 62px; }
      .expense-mobile-row { grid-template-columns: minmax(0, 1fr) auto; }
      .assets-summary { padding: 20px 18px; }
      .assets-legend { grid-template-columns: repeat(2, minmax(120px, 1fr)); }
      .assets-pane-header { align-items: start; }
      .assets-notice { align-items: flex-start; flex-direction: column; gap: 5px; }
      .analysis-toolbar { grid-template-columns: 1fr; }
      .analysis-toolbar > label:first-child { grid-column: auto; }
      .analysis-summary { grid-template-columns: 1fr; }
      .analysis-summary > div:first-child { grid-column: auto; }
      .analysis-summary > div + div { border-left: 0; border-top: 1px solid var(--line-soft); }
      .crypto-toolbar { grid-template-columns: 1fr; }
      .crypto-toolbar > label { grid-column: auto; }
      .crypto-toolbar-meta { border-left: 0; border-top: 1px solid var(--line-soft); padding: 12px 0 0; }
      .crypto-basis-row { grid-template-columns: 1fr; }
      .crypto-basis-row > strong { grid-column: 1; grid-row: auto; margin-top: 4px; text-align: left; }
      .crypto-holding-row { grid-template-columns: 1fr; padding: 11px 0; }
      .crypto-holding-row > strong { grid-column: 1; grid-row: auto; margin-top: 4px; }
      .crypto-break-even { align-items: flex-start; flex-direction: column; gap: 5px; }
      .crypto-tax-table { display: none; }
      .crypto-tax-mobile { display: grid; }
      .crypto-tax-card { padding: 15px 0; border-top: 1px solid var(--line-soft); }
      .crypto-tax-card:first-child { border-top: 0; padding-top: 0; }
      .crypto-tax-card-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
      .crypto-tax-card h3 { margin-top: 10px; font-size: 16px; }
      .crypto-tax-card p { margin-top: 5px; color: var(--muted); font-size: 13px; }
      .crypto-tax-card .crypto-tax-reference { margin-top: 9px; color: var(--text); }
      .recurring-toolbar { grid-template-columns: 1fr; }
      .recurring-toolbar > label:first-child { grid-column: auto; }
      .recurring-summary { grid-template-columns: 1fr; }
      .recurring-summary > div { min-height: 72px; }
      .recurring-summary > div + div { border-left: 0; border-top: 1px solid var(--line-soft); }
      .optimization-card { grid-template-columns: 1fr; }
      .optimization-title { grid-column: auto; }
      .decision-summary { grid-template-columns: 1fr; }
      .decision-summary > div:first-child { grid-column: auto; }
      .decision-milestones { grid-template-columns: 1fr; }
      .decision-breakdown { grid-template-columns: 1fr; }
      .decision-context-table th, .decision-context-table td { padding: 9px 6px; font-size: 11px; }
      .decision-context-table th:first-child, .decision-context-table td:first-child { width: 38%; }
      .decision-context-table thead { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
      .decision-context-table tbody tr { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); padding: 9px 8px; }
      .decision-context-table tbody tr + tr { border-top: 1px solid var(--line-soft); }
      .decision-context-table tbody td { padding: 5px 3px; border: 0; text-align: right; }
      .decision-context-table tbody td:first-child { grid-column: 1 / -1; width: auto; padding: 3px 3px 8px; border-bottom: 1px solid var(--line-soft); text-align: left; }
      .decision-context-table tbody td:not(:first-child)::before { display: block; margin-bottom: 2px; color: var(--muted); font-size: 10px; font-weight: 400; content: attr(data-label); }
      .decision-annual-variance { grid-template-columns: 1fr; gap: 3px; }
      .decision-annual-variance strong { min-width: 0; overflow-wrap: anywhere; }
      .decision-milestone + .decision-milestone { border-left: 0; border-top: 1px solid var(--line-soft); }
      .decision-chart svg { min-height: 205px; }
      .decision-axis { font-size: 10px; }
      .fire-model { white-space: normal; }
      .fire-course, .fire-capital { grid-template-columns: 1fr; }
      .fire-course > div + div, .fire-capital > div + div, .fire-course > div:nth-child(3), .fire-course > div:nth-child(4), .fire-capital > div:nth-child(3), .fire-capital > div:nth-child(4) { border-top: 1px solid var(--line-soft); border-left: 0; }
      .fire-controls { grid-template-columns: 1fr; }
      .fire-controls .button { grid-column: auto; }
      .fire-levers-head { display: grid; }
      .fire-lever-summary { grid-template-columns: minmax(0, 1fr) 18px; gap: 8px; min-height: 68px; }
      .fire-lever-summary-metric { min-width: 0; text-align: left; }
      .fire-lever-summary-metric:nth-of-type(1) { grid-column: 1; }
      .fire-lever-summary-metric:nth-of-type(2) { grid-column: 1; }
      .fire-lever-summary > svg { grid-column: 2; grid-row: 1 / span 3; }
      .fire-row { grid-template-columns: 44px minmax(0, 1fr) minmax(0, 1fr); gap: 7px 10px; padding: 11px 12px; }
      .fire-row > input, .fire-row-drill { grid-column: 1; grid-row: 1; }
      .fire-row-main { grid-column: 2 / -1; grid-row: 1; align-self: center; }
      .fire-row-cost { grid-column: 2; }
      .fire-row-choice { grid-column: 2 / -1; }
      .fire-row-effect { grid-column: 3; text-align: left; }
      .fire-category-detail { grid-column: 1 / -1; margin: 4px -12px -11px; padding: 13px 12px 15px; }
      .fire-category-detail-head { display: grid; }
      .fire-period-switch { width: 100%; }
      .fire-period-switch button { flex: 1; }
      .fire-booking-row { grid-template-columns: 78px minmax(0, 1fr) auto; gap: 8px; padding: 8px; }
      .recurring-detail-grid { grid-template-columns: 1fr; }
      .recurring-payment { grid-template-columns: 1fr auto; }
      .recurring-payment span:nth-child(2) { grid-column: 1 / -1; grid-row: 2; }
      .analysis-category { grid-template-columns: minmax(0, 1fr) auto; gap: 7px 10px; }
      .analysis-bar-pair { grid-column: 1 / -1; grid-row: 2; }
      .analysis-category-values { grid-column: 2; grid-row: 1; }
      .freshness-label { flex-wrap: nowrap; font-size: 12px; }
      .freshness-status { font-size: 12px; }
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
          <div><p class="eyebrow" id="page-eyebrow" hidden>Finance Hub</p><h1 id="page-title">Übersicht</h1><p class="subtitle" id="page-subtitle">Finanzen, Vermögen und offene Punkte auf einen Blick.</p></div>
          <button class="button quiet" id="refresh-button" type="button" onclick="headerAction()" aria-label="Übersicht aktualisieren">
            <span aria-hidden="true">↻</span><span class="desktop-label">Aktualisieren</span>
          </button>
        </header>
        <div id="message" class="notice" role="status" aria-live="polite"></div>
        <section class="token-request" id="token-request" aria-hidden="true" aria-labelledby="token-request-title">
          <h2 id="token-request-title">Zugang zum Finance Hub</h2>
          <p>Gib den Verwaltungstoken ein. Er bleibt nur für diese Browsersitzung gespeichert.</p>
          <form id="token-form">
            <label for="token-input">Verwaltungstoken</label>
            <div class="token-request-row">
              <input id="token-input" type="password" autocomplete="off" spellcheck="false" required>
              <button class="button" type="submit">Daten laden</button>
            </div>
          </form>
        </section>
        <div id="dashboard" aria-busy="true">
          <section class="wealth-overview" aria-label="Vermögensübersicht">
            <div><div class="skeleton" style="width:52%;height:18px">Lädt</div><div class="skeleton" style="width:72%;height:48px;margin-top:10px">Lädt</div></div>
            <div class="skeleton" style="width:100%;height:28px">Lädt</div>
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
  search:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="11" cy="11" r="6"/><path d="m16 16 4 4"/></svg>',
  check:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="m6 12 4 4 8-9"/></svg>',
  warning:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 4 3 20h18L12 4Zm0 5v5m0 3v.1"/></svg>'
};
const navItems=[
  {label:"Übersicht",icon:"overview",view:"overview"},
  {label:"Ausgaben",icon:"expenses",view:"spending"},
  {label:"Vermögen",icon:"assets",view:"assets"},
  {label:"Analysen",icon:"analysis",view:"analyses"},
  {label:"Datenstatus",icon:"status",view:"status"}
];
function activeView(){return location.hash==="#\/data-status"?"status":location.hash==="#\/spending"?"spending":location.hash==="#\/assets"?"assets":location.hash==="#\/analyses"?"analyses":"overview"}
function viewHref(view){return view==="status"?'#/data-status':view==="spending"?'#/spending':view==="assets"?'#/assets':view==="analyses"?'#/analyses':'#/overview'}
function navMarkup(){const current=activeView();return navItems.map(item=>item.view?'<a class="nav-item" href="'+viewHref(item.view)+'"'+(item.view===current?' aria-current="page"':'')+'>'+icons[item.icon]+'<span>'+item.label+'</span></a>':'<button class="nav-item" type="button" disabled title="Folgt in einem späteren Schritt">'+icons[item.icon]+'<span>'+item.label+'</span></button>').join("")}
function renderNavigation(){document.getElementById("desktop-nav").innerHTML=navMarkup();document.getElementById("mobile-nav").innerHTML=navMarkup()}
renderNavigation();

const legacyToken=localStorage.getItem("financeToken");
if(legacyToken&&!sessionStorage.getItem("financeToken"))sessionStorage.setItem("financeToken",legacyToken);
localStorage.removeItem("financeToken");
let token=sessionStorage.getItem("financeToken")||"";
let currentPreview=null;
let currentExpenseMonth="";
let currentAnalysisData=null;
let currentRecurringData=null;
let currentRecurringDetail=null;
let currentOptimizationData=null;
let currentCryptoData=null;
let currentDecisionLabData=null;

function headerAction(){if(activeView()==="analyses"&&!['recurring-expenses','expense-optimizations','decision-lab'].includes(analysisSelection().view))exportAnalysisCsv();else refresh(true)}

function requestToken(){
  const request=document.getElementById("token-request");
  const input=document.getElementById("token-input");
  request.setAttribute("aria-hidden","false");
  input.focus();
  return false;
}
function submitToken(event){
  event.preventDefault();
  const input=document.getElementById("token-input");
  const supplied=input.value.trim();
  if(!supplied)return;
  token=supplied;
  sessionStorage.setItem("financeToken",token);
  input.value="";
  document.getElementById("token-request").setAttribute("aria-hidden","true");
  refresh();
}
document.getElementById("token-form").addEventListener("submit",submitToken);
async function call(path,options={},retry=true){
  if(!token&&!requestToken())throw new Error("Für die Finance-Hub-Daten wird das Verwaltungstoken benötigt.");
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
function moneyWhole(minor){if(!Number.isFinite(minor))return "Nicht verfügbar";return new Intl.NumberFormat("de-DE",{style:"currency",currency:"EUR",maximumFractionDigits:0}).format(Number(minor)/100)}
function signedMoneyWhole(minor){if(!Number.isFinite(minor))return "Nicht verfügbar";return new Intl.NumberFormat("de-DE",{style:"currency",currency:"EUR",maximumFractionDigits:0,signDisplay:"always"}).format(Number(minor)/100)}
function numberWhole(minor){if(!Number.isFinite(minor))return "–";return new Intl.NumberFormat("de-DE",{maximumFractionDigits:0}).format(Number(minor)/100)}
function cashflowSelection(){
  const params=new URLSearchParams(location.search);
  const requestedMonths=Number(params.get("cashflowMonths")||4);
  const requestedOffset=Number(params.get("cashflowOffset")||0);
  return {
    months:[4,6,12].includes(requestedMonths)?requestedMonths:4,
    offset:Number.isInteger(requestedOffset)?Math.max(0,Math.min(120,requestedOffset)):0
  };
}
function setCashflowRange(months,offset){
  const params=new URLSearchParams(location.search);
  const safeMonths=[4,6,12].includes(Number(months))?Number(months):4;
  const safeOffset=Math.max(0,Math.min(120,Math.trunc(Number(offset)||0)));
  if(safeMonths===4)params.delete("cashflowMonths");else params.set("cashflowMonths",String(safeMonths));
  if(safeOffset===0)params.delete("cashflowOffset");else params.set("cashflowOffset",String(safeOffset));
  const query=params.toString();
  history.pushState(null,"",(query?"?"+query:location.pathname)+location.hash);
  refresh();
}
function setCashflowMonths(value){const range=cashflowSelection();setCashflowRange(Number(value),range.offset)}
function shiftCashflow(months){const range=cashflowSelection();setCashflowRange(range.months,range.offset+Number(months))}
function spendingSelection(){
  const requestedOffset=Number(new URLSearchParams(location.search).get("spendingOffset")||0);
  return {offset:Number.isInteger(requestedOffset)?Math.max(0,Math.min(120,requestedOffset)):0};
}
function setSpendingOffset(offset){
  const params=new URLSearchParams(location.search);
  const safeOffset=Math.max(0,Math.min(120,Math.trunc(Number(offset)||0)));
  if(safeOffset===0)params.delete("spendingOffset");else params.set("spendingOffset",String(safeOffset));
  const query=params.toString();
  history.pushState(null,"",(query?"?"+query:location.pathname)+location.hash);
  refresh();
}
function shiftSpending(months){setSpendingOffset(spendingSelection().offset+Number(months))}
function shiftMonthKey(key,offset){
  const match=String(key||"").match(/^(\\d{4})-(\\d{2})$/);
  if(!match)return "";
  const date=new Date(Date.UTC(Number(match[1]),Number(match[2])-1+Number(offset),1));
  return date.getUTCFullYear()+"-"+String(date.getUTCMonth()+1).padStart(2,"0");
}
function spendingMonthOptions(latestMonth,selectedOffset){
  if(!latestMonth)return "";
  const offsets=Array.from({length:36},(_,offset)=>offset);
  if(selectedOffset>=36)offsets.push(selectedOffset);
  return offsets.map(offset=>{
    const key=shiftMonthKey(latestMonth,-offset);
    return '<option value="'+offset+'"'+(offset===selectedOffset?' selected':'')+'>'+esc(rangeMonth(key,{month:"long",year:"numeric"}))+'</option>';
  }).join("");
}
function expenseSelection(){
  const params=new URLSearchParams(location.search);
  const page=Number(params.get("expensePage")||1);
  return {
    month:params.get("expenseMonth")||"",
    category:params.get("expenseCategory")||"all",
    account:params.get("expenseAccount")||"all",
    search:(params.get("expenseSearch")||"").slice(0,80),
    categorySearch:(params.get("expenseCategorySearch")||"").slice(0,80),
    expanded:params.get("expenseCategoriesExpanded")==="1",
    page:Number.isInteger(page)?Math.max(1,Math.min(100000,page)):1
  };
}
function setExpenseParams(changes,replace=false){
  const params=new URLSearchParams(location.search);
  const names={month:"expenseMonth",category:"expenseCategory",account:"expenseAccount",search:"expenseSearch",page:"expensePage"};
  Object.entries(changes).forEach(([key,value])=>{
    const name=names[key];if(!name)return;
    const text=String(value??"").trim();
    if(!text||text==="all"||(key==="page"&&text==="1"))params.delete(name);else params.set(name,text);
  });
  const query=params.toString();
  const url=(query?"?"+query:location.pathname)+location.hash;
  history[replace?"replaceState":"pushState"](null,"",url);
  refresh();
}
function setExpenseMonth(value){setExpenseParams({month:value,category:"",page:1})}
function shiftExpenseMonth(offset){
  const current=expenseSelection().month||currentExpenseMonth;
  if(!current)return;
  setExpenseMonth(shiftMonthKey(current,Number(offset)));
}
function setExpenseCategory(value){setExpenseParams({category:value,page:1})}
function setExpenseAccount(value){setExpenseParams({account:value,category:"",page:1})}
function setExpensePage(value){setExpenseParams({page:value})}
let expenseSearchTimer;
function updateExpenseSearch(value){
  clearTimeout(expenseSearchTimer);
  expenseSearchTimer=setTimeout(()=>setExpenseParams({search:String(value).slice(0,80),category:"",page:1},true),300);
}
function expenseMonthOptions(latestMonth,oldestMonth,selectedMonth){
  if(!latestMonth)return "";
  const keys=Array.from({length:36},(_,offset)=>shiftMonthKey(latestMonth,-offset)).filter(key=>!oldestMonth||key>=oldestMonth);
  if(selectedMonth&&!keys.includes(selectedMonth))keys.push(selectedMonth);
  return keys.sort().reverse().map(key=>'<option value="'+key+'"'+(key===selectedMonth?' selected':'')+'>'+esc(rangeMonth(key,{month:"long",year:"numeric"}))+'</option>').join("");
}
function filterExpenseCategories(value){
  const needle=String(value||"").trim().toLocaleLowerCase("de-DE");
  document.querySelectorAll(".expense-category").forEach(row=>{row.hidden=Boolean(needle)&&!String(row.dataset.label||"").toLocaleLowerCase("de-DE").includes(needle)});
  const params=new URLSearchParams(location.search);
  if(needle)params.set("expenseCategorySearch",String(value).slice(0,80));else params.delete("expenseCategorySearch");
  const query=params.toString();
  history.replaceState(null,"",(query?"?"+query:location.pathname)+location.hash);
}
function toggleExpenseCategories(button){
  const list=document.getElementById("expense-category-pane");
  const expanded=list.classList.toggle("categories-expanded");
  button.setAttribute("aria-expanded",String(expanded));
  button.firstChild.textContent=expanded?"Weniger anzeigen":"Weitere anzeigen";
  const params=new URLSearchParams(location.search);
  if(expanded)params.set("expenseCategoriesExpanded","1");else params.delete("expenseCategoriesExpanded");
  const query=params.toString();
  history.replaceState(null,"",(query?"?"+query:location.pathname)+location.hash);
}
function assetSelection(){
  const requested=new URLSearchParams(location.search).get("assetArea")||"all";
  return ["all","cash","depots","pensions","crypto"].includes(requested)?requested:"all";
}
function setAssetArea(value){
  const area=["cash","depots","pensions","crypto"].includes(String(value))?String(value):"all";
  const params=new URLSearchParams(location.search);
  if(area==="all")params.delete("assetArea");else params.set("assetArea",area);
  const query=params.toString();
  history.pushState(null,"",(query?"?"+query:location.pathname)+location.hash);
  refresh();
}
function analysisSelection(){
  const params=new URLSearchParams(location.search);
  const period=Number(params.get("analysisPeriod")||0);
  const comparison=Number(params.get("analysisComparison")||0);
  const boundedParam=(name,fallback,min,max)=>{if(!params.has(name))return fallback;const value=Number(params.get(name));return Number.isFinite(value)?Math.max(min,Math.min(max,value)):fallback};
  return {
    view:params.get("analysisView")==="recurring-expenses"?"recurring-expenses":params.get("analysisView")==="expense-optimizations"?"expense-optimizations":params.get("analysisView")==="crypto-origin-tax"?"crypto-origin-tax":params.get("analysisView")==="decision-lab"?"decision-lab":"expense-structure",
    period:Number.isInteger(period)&&period>0?period:0,
    comparison:Number.isInteger(comparison)&&comparison>0?comparison:0,
    expanded:params.get("analysisCategoriesExpanded")==="1",
    position:params.get("analysisPosition")||"",
    rhythm:["monatlich","vierteljaehrlich","jaehrlich"].includes(params.get("recurringRhythm"))?params.get("recurringRhythm"):"alle",
    review:["alle","bestaetigt","kein-kandidat"].includes(params.get("recurringReview"))?params.get("recurringReview"):"moeglich",
    classification:["GRUNDBEDARF","GESTALTBAR","VERMEIDBAR","UNKLAR"].includes(params.get("recurringClassification"))?params.get("recurringClassification"):"alle",
    confidence:["hoch","mittel"].includes(params.get("recurringConfidence"))?params.get("recurringConfidence"):"alle",
    candidate:/^recurring-[a-f0-9]{18}$/.test(params.get("recurringCandidate")||"")?params.get("recurringCandidate"):"",
    decisionBasis:params.get("decisionBasis")==="ytd-plus-last-year"?"ytd-plus-last-year":"current-year",
    decisionReturn:boundedParam("decisionReturn",2,-5,10),
    decisionMonthly:boundedParam("decisionMonthly",0,-10000,10000),
    decisionOneTime:boundedParam("decisionOneTime",0,-1000000,1000000),
    fireTargetAge:boundedParam("fireTargetAge",60,50,67),
    fireActionKeys:(params.get("fireActionKeys")||"").split(",").filter(key=>/^recurring-[a-f0-9]{18}$/.test(key)),
    fireCategoryCuts:(params.get("fireCategoryCuts")||"").split(",").filter(value=>/^category-[a-f0-9]{10}:(10|25|50)$/.test(value)),
    fireOneTimeKeys:(params.get("fireOneTimeKeys")||"").split(",").filter(key=>/^position-[a-f0-9]{12}$/.test(key)),
    fireOpenGroups:(params.get("fireOpenGroups")||"").split(",").filter(value=>["recurring","variable","one-time"].includes(value)),
    fireCategory:/^category-[a-f0-9]{10}$/.test(params.get("fireCategory")||"")?params.get("fireCategory"):"",
    fireCategoryPeriod:params.get("fireCategoryPeriod")==="previous"?"previous":"current"
  };
}
function setAnalysisView(value){
  const params=new URLSearchParams(location.search);
  if(value==="recurring-expenses"||value==="expense-optimizations"||value==="crypto-origin-tax"||value==="decision-lab")params.set("analysisView",value);else params.delete("analysisView");
  params.delete("analysisPosition");params.delete("recurringCandidate");
  const query=params.toString();history.pushState(null,"",(query?"?"+query:location.pathname)+location.hash);refresh();
}
function applyAnalysisFilters(){
  const period=Number(document.getElementById("analysis-period")?.value||0);
  const comparison=Number(document.getElementById("analysis-comparison")?.value||0);
  const params=new URLSearchParams(location.search);
  if(period)params.set("analysisPeriod",String(period));else params.delete("analysisPeriod");
  if(comparison)params.set("analysisComparison",String(comparison));else params.delete("analysisComparison");
  params.delete("analysisPosition");
  const query=params.toString();
  history.pushState(null,"",(query?"?"+query:location.pathname)+location.hash);
  refresh();
}
function applyRecurringFilters(){
  const params=new URLSearchParams(location.search);
  const values={
    recurringRhythm:document.getElementById("recurring-rhythm")?.value||"alle",
    recurringReview:document.getElementById("recurring-review")?.value||"moeglich",
    recurringClassification:document.getElementById("recurring-classification")?.value||"alle",
    recurringConfidence:document.getElementById("recurring-confidence")?.value||"alle"
  };
  Object.entries(values).forEach(([name,value])=>{const defaultValue=name==="recurringReview"?"moeglich":"alle";if(value===defaultValue)params.delete(name);else params.set(name,value)});
  params.delete("recurringCandidate");
  const query=params.toString();history.pushState(null,"",(query?"?"+query:location.pathname)+location.hash);currentRecurringDetail=null;refresh();
}
function applyDecisionLab(event){
  event?.preventDefault();
  const params=new URLSearchParams(location.search);
  const basis=document.getElementById("decision-basis")?.value||"current-year";
  if(basis==="ytd-plus-last-year")params.set("decisionBasis",basis);else params.delete("decisionBasis");
  params.delete("decisionVariableShare");
  const values={
    decisionReturn:Number(document.getElementById("decision-return")?.value||2),
    decisionMonthly:Number(document.getElementById("decision-monthly")?.value||0),
    decisionOneTime:Number(document.getElementById("decision-one-time")?.value||0)
  };
  const rules={decisionReturn:[2,-5,10],decisionMonthly:[0,-10000,10000],decisionOneTime:[0,-1000000,1000000]};
  for(const [name,value] of Object.entries(values)){
    const [fallback,min,max]=rules[name];
    const safe=Number.isFinite(value)?Math.max(min,Math.min(max,value)):fallback;
    if(safe===fallback)params.delete(name);else params.set(name,String(safe));
  }
  const query=params.toString();history.pushState(null,"",(query?"?"+query:location.pathname)+location.hash);refresh();
}
function applyFireScenario(event){
  event?.preventDefault();
  const params=new URLSearchParams(location.search);
  const target=Math.max(50,Math.min(67,Number(document.getElementById("fire-target-age")?.value||60)));
  if(target===60)params.delete("fireTargetAge");else params.set("fireTargetAge",String(target));
  const keys=[...document.querySelectorAll('input[name="fire-action"]:checked')].map(input=>input.value).filter(key=>/^recurring-[a-f0-9]{18}$/.test(key));
  if(keys.length)params.set("fireActionKeys",keys.join(","));else params.set("fireActionKeys","none");
  const cuts=[...document.querySelectorAll('select[name="fire-category-cut"]')].map(input=>String(input.dataset.key||"")+":"+String(input.value||"0")).filter(value=>/^category-[a-f0-9]{10}:(10|25|50)$/.test(value));
  if(cuts.length)params.set("fireCategoryCuts",cuts.join(","));else params.delete("fireCategoryCuts");
  const oneTime=[...document.querySelectorAll('input[name="fire-one-time"]:checked')].map(input=>input.value).filter(key=>/^position-[a-f0-9]{12}$/.test(key));
  if(oneTime.length)params.set("fireOneTimeKeys",oneTime.join(","));else params.delete("fireOneTimeKeys");
  const query=params.toString();history.pushState(null,"",(query?"?"+query:location.pathname)+location.hash);refresh();
}
function toggleRecurringCandidate(key){
  const params=new URLSearchParams(location.search);
  const close=params.get("recurringCandidate")===key;
  if(close)params.delete("recurringCandidate");else params.set("recurringCandidate",key);
  const query=params.toString();history.replaceState(null,"",(query?"?"+query:location.pathname)+location.hash);
  if(close){currentRecurringDetail=null;if(currentRecurringData)renderRecurringExpenses(currentRecurringData);return}
  currentRecurringDetail=null;if(currentRecurringData)renderRecurringExpenses(currentRecurringData);loadRecurringDetail(key);
}
async function loadRecurringDetail(key){
  try{
    const data=await call("/api/dashboard/analyses/recurring-expenses/"+encoded(key));
    if(analysisSelection().candidate!==key)return;
    currentRecurringDetail=data;if(currentRecurringData)renderRecurringExpenses(currentRecurringData);
  }catch(error){msg(error.message,true)}
}
async function saveRecurringDecision(key,instance){
  const select=document.getElementById("recurring-decision-"+instance+"-"+key);
  const button=document.getElementById("recurring-save-"+instance+"-"+key);
  const decision=select?.value||"";
  if(!decision){select?.focus();msg("Bitte zuerst eine Entscheidung auswählen.",true);return}
  const evidenceHash=currentRecurringDetail?.candidate?.key===key?currentRecurringDetail.candidate.evidence.evidenceHash:"";
  try{
    button.disabled=true;msg("Entscheidung wird gespeichert …");
    await call("/api/decisions/recurring-expenses/"+encoded(key),{method:"PUT",body:JSON.stringify({decision,expectedEvidenceHash:evidenceHash})});
    currentRecurringDetail=null;msg("Entscheidung gespeichert.");await refresh();
  }catch(error){msg(error.message,true);if(button)button.disabled=false}
}
function toggleAnalysisCategories(){
  const params=new URLSearchParams(location.search);
  if(params.get("analysisCategoriesExpanded")==="1")params.delete("analysisCategoriesExpanded");else params.set("analysisCategoriesExpanded","1");
  const query=params.toString();
  history.replaceState(null,"",(query?"?"+query:location.pathname)+location.hash);
  if(currentAnalysisData)renderAnalyses(currentAnalysisData);
}
function toggleAnalysisPosition(key){
  const params=new URLSearchParams(location.search);
  if(params.get("analysisPosition")===key)params.delete("analysisPosition");else params.set("analysisPosition",key);
  const query=params.toString();
  history.replaceState(null,"",(query?"?"+query:location.pathname)+location.hash);
  if(currentAnalysisData)renderAnalyses(currentAnalysisData);
}
function csvCell(value){const text=String(value??"");return /[";\\n]/.test(text)?'"'+text.replaceAll('"','""')+'"':text}
function exportAnalysisCsv(){
  if(analysisSelection().view==="crypto-origin-tax"){exportCryptoAnalysisCsv();return}
  if(!currentAnalysisData){msg("Die Analyse ist noch nicht geladen.",true);return}
  const data=currentAnalysisData;
  const rows=[["Bereich","Position","Kategorie","Klasse","Zeitraum","Betrag EUR","Status"]];
  data.categories.forEach(row=>rows.push(["Kategorie",row.label,"","",String(data.period.year),(row.periodMinor/100).toFixed(2).replace(".",","),data.period.estimate?"[SCHÄTZUNG]":"gemessen"]));
  data.positions.forEach(row=>rows.push(["Position",row.label,row.category,row.class,String(data.period.year),(row.amountMinor/100).toFixed(2).replace(".",","),row.estimate?"[SCHÄTZUNG]":"gemessen"]));
  const csv="\ufeff"+rows.map(row=>row.map(csvCell).join(";")).join("\\n");
  const link=document.createElement("a");
  link.href=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));
  link.download="ausgabenstruktur-"+data.period.year+"-vergleich-"+data.comparison.year+".csv";
  link.click();setTimeout(()=>URL.revokeObjectURL(link.href),0);
  msg("CSV für die aktuelle Auswahl wurde erstellt.");
}
function exportCryptoAnalysisCsv(){
  if(!currentCryptoData){msg("Die Kryptoanalyse ist noch nicht geladen.",true);return}
  const data=currentCryptoData;
  const rows=[["Bereich","Kennzahl","Wert","Einheit","Status"]];
  rows.push(["Bestand","Gesamtbestand",String(data.holdings.totalSol).replace(".",","),"SOL","Bestätigt"]);
  rows.push(["Bestand","Staking Rewards",String(data.holdings.rewardsSol).replace(".",","),"SOL","Bestätigt"]);
  rows.push(["Investment","SOL-Konvertierungsbasis",String(data.transition.conversionBasisEurPerSol).replace(".",","),"EUR/SOL","[SCHÄTZUNG]"]);
  rows.push(["Investment","Effektive Basis inklusive Staking",String(data.investment.effectiveBasisEurPerSol).replace(".",","),"EUR/SOL","[SCHÄTZUNG]"]);
  rows.push(["Cash-on-Cash","Netto-Fiatkapital",(data.investment.netFiatCapitalEurMinor/100).toFixed(2).replace(".",","),"EUR","Bestätigt"]);
  data.taxYears.forEach(year=>rows.push(["Steuerprüfung",String(year.year),year.referenceMinor===undefined?"":(year.referenceMinor/100).toFixed(2).replace(".",","),year.referenceMinor===undefined?"":"EUR",year.title+(year.estimate?" [SCHÄTZUNG]":"")]));
  const csv="\ufeff"+rows.map(row=>row.map(csvCell).join(";")).join("\\n");
  const link=document.createElement("a");
  link.href=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));
  link.download="krypto-herkunft-steuerstatus-stand-"+data.capturedAt.slice(0,10)+".csv";
  link.click();setTimeout(()=>URL.revokeObjectURL(link.href),0);
  msg("CSV für die Kryptoanalyse wurde erstellt.");
}
function rangeMonth(key,format){
  const match=String(key||"").match(/^(\\d{4})-(\\d{2})$/);
  if(!match)return "";
  return new Intl.DateTimeFormat("de-DE",format).format(new Date(Date.UTC(Number(match[1]),Number(match[2])-1,1)));
}
function cashflowRangeLabel(range){
  if(!range?.start||!range?.end)return "Gewählter Zeitraum";
  const startYear=String(range.start).slice(0,4),endYear=String(range.end).slice(0,4);
  const start=rangeMonth(range.start,{month:"long"});
  const end=rangeMonth(range.end,{month:"long",year:"numeric"});
  return startYear===endYear?start+"–"+end:rangeMonth(range.start,{month:"long",year:"numeric"})+"–"+end;
}
function cashflowRangeDetail(range){return range?.endPartial?rangeMonth(range.end,{month:"long"})+" bis heute":"Vollständige Monate"}
function dayMonth(value){if(!value)return "kein Stand";const date=new Date(value);if(Number.isNaN(date.getTime()))return "kein Stand";return new Intl.DateTimeFormat("de-DE",{day:"2-digit",month:"2-digit"}).format(date)}
function monthWord(value){if(!value)return "nicht bestätigt";const date=new Date(value);if(Number.isNaN(date.getTime()))return "nicht bestätigt";return new Intl.DateTimeFormat("de-DE",{month:"long"}).format(date)+" bestätigt"}
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

function renderOverview(data){
  const total=data.totalMinor;
  const totalParts=Number(data.cash.amountMinor||0)+Number(data.investments.amountMinor||0);
  const cashWidth=totalParts>0?Math.max(1,Number(data.cash.amountMinor||0)/totalParts*100):0;
  const composition=Number.isFinite(total)?'<div class="composition-bar" aria-hidden="true"><span class="composition-cash" style="width:'+cashWidth+'%"></span><span class="composition-investments" style="width:'+(100-cashWidth)+'%"></span></div>':'<div class="composition-missing">Aufteilung teilweise nicht verfügbar</div>';
  const automaticOk=data.automatic.total>0&&data.automatic.current===data.automatic.total;
  const actionDetails=data.manualActions.map(action=>esc(action.label.replace(" Riester","").replace(" Fondsrente",""))+" "+esc(dayMonth(action.capturedAt))).join(" · ");
  const action=data.manualActions.length?'\
    <section class="overview-action" aria-label="Vorsorgewerte prüfen"><span class="task-mark">'+icons.manual+'</span><div><strong>'+data.manualActions.length+' Vorsorgewerte prüfen</strong><p>'+actionDetails+'</p></div><a class="text-action" href="#/data-status"><span><span class="to-prefix">Zum </span>Datenstatus</span>'+icons.chevron+'</a></section>':'';
  const comparison=data.comparison||{effectiveDate:"",state:"partial",changeTotalMinor:null,parts:[],warnings:[]};
  const totalChangeTone=Number(comparison.changeTotalMinor)>0?"positive":Number(comparison.changeTotalMinor)<0?"negative":"neutral";
  const comparisonSummary=Number.isFinite(comparison.changeTotalMinor)
    ?'<div class="wealth-change-summary"><span>Seit '+esc(formatDate(comparison.effectiveDate))+'</span><strong class="wealth-change-'+totalChangeTone+'">'+signedMoneyWhole(comparison.changeTotalMinor)+'</strong><small>Vollständig abgestimmter Monatsvergleich</small></div>'
    :'<div class="wealth-change-summary"><span>Seit '+esc(formatDate(comparison.effectiveDate))+'</span><strong>Gesamtvergleich offen</strong><small>Unvollständige Anteile werden nicht summiert</small></div>';
  const comparisonParts=(comparison.parts||[]).map(part=>{
    const changeTone=Number(part.changeMinor)>0?"positive":Number(part.changeMinor)<0?"negative":"neutral";
    const value=Number.isFinite(part.changeMinor)?signedMoneyWhole(part.changeMinor):"Vergleich nicht verfügbar";
    const dates=(part.capturedDates||[]).map(value=>formatDate(value));
    const dateText=dates.length===0?"Stichtag nicht verfügbar":dates.length===1?"Stichtag "+dates[0]:"Stichtage "+dates[0]+" bis "+dates.at(-1);
    const valuation=part.valuation==="estimated"?'<span class="comparison-estimate">[SCHÄTZUNG]</span>':part.valuation==="confirmed"?"bestätigt":part.valuation==="measured"?"gemessen":"nicht verfügbar";
    const previous=Number.isFinite(part.previousMinor)?"Vergleichswert "+moneyWhole(part.previousMinor):"Kein belastbarer Vergleichswert";
    const quantity=Number.isFinite(part.quantity)?new Intl.NumberFormat("de-DE",{maximumFractionDigits:9}).format(part.quantity)+" SOL":null;
    const price=Number.isFinite(part.priceMinor)?new Intl.NumberFormat("de-DE",{style:"currency",currency:"EUR",minimumFractionDigits:2,maximumFractionDigits:2}).format(part.priceMinor/100)+"/SOL":null;
    const solDetail=quantity&&price?'<small>'+quantity+' · '+price+' am '+esc(formatDate(part.priceDate))+'</small>':'';
    const staking=Number(part.stakingRewardsQuantity)>0?'<small>'+new Intl.NumberFormat("de-DE",{maximumFractionDigits:9}).format(part.stakingRewardsQuantity)+' SOL erkannte Staking-Erträge enthalten</small>':'';
    return '<div class="wealth-comparison-part"><span>'+esc(part.label)+'</span><strong class="wealth-change-'+changeTone+'">'+value+'</strong><small>'+previous+' · '+esc(part.source)+'</small><small>'+esc(dateText)+' · '+valuation+'</small>'+solDetail+staking+'</div>';
  }).join("");
  const comparisonPanel='<section class="wealth-comparison" aria-labelledby="wealth-comparison-title"><div class="wealth-comparison-head"><h2 id="wealth-comparison-title">Monatsvergleich</h2><p>Letztes vollständiges Monatsende · '+esc(formatDate(comparison.effectiveDate))+'</p></div><div class="wealth-comparison-grid">'+comparisonParts+'</div></section>';
  const months=data.cashflow.months||[];
  const selection=cashflowSelection();
  const range=data.cashflow.range||{months:months.length||selection.months,offset:selection.offset,start:months.at(0)?.key,end:months.at(-1)?.key,endPartial:Boolean(months.at(-1)?.partial)};
  const rangeLabel=cashflowRangeLabel(range);
  const rangeDetail=cashflowRangeDetail(range);
  const rangeAccessible=rangeLabel+". "+rangeDetail;
  const chartMax=Math.max(1,...months.flatMap(month=>[month.incomeMinor,month.spentMinor]));
  const chart=months.length?months.map(month=>'\
    <div class="cashflow-month"><div class="bar-pair">\
      <span class="chart-bar income" style="--bar-height:'+Math.max(2,month.incomeMinor/chartMax*100)+'%"><span class="chart-value">'+numberWhole(month.incomeMinor)+'</span></span>\
      <span class="chart-bar spent" style="--bar-height:'+Math.max(2,month.spentMinor/chartMax*100)+'%"><span class="chart-value">'+numberWhole(month.spentMinor)+'</span></span>\
    </div><span class="chart-month-label">'+esc(month.label)+(month.partial?'*':'')+'</span></div>').join(""):'';
  const chartTable=months.map(month=>'<tr><th>'+esc(month.label)+(month.partial?' bis heute':'')+'</th><td>'+moneyWhole(month.incomeMinor)+'</td><td>'+moneyWhole(month.spentMinor)+'</td></tr>').join("");
  const cashflow=data.cashflow.state==="current"?'\
    <div class="chart-legend"><span class="legend-key"><i style="background:var(--blue)"></i>Einnahmen</span><span class="legend-key"><i style="background:var(--orange)"></i>Ausgaben</span></div>\
    <div class="cashflow-chart" style="--month-count:'+months.length+'" role="img" aria-label="Einnahmen und Ausgaben. '+esc(rangeAccessible)+'">'+chart+'</div>\
    <table class="sr-only"><caption>Geldfluss: '+esc(rangeAccessible)+'</caption><thead><tr><th>Monat</th><th>Einnahmen</th><th>Ausgaben</th></tr></thead><tbody>'+chartTable+'</tbody></table>'
    :'<div class="panel-unavailable"><p>Geldfluss ist momentan nicht verfügbar.<br>Beim Aktualisieren wird der Abruf erneut versucht.</p></div>';
  const allocation=data.investments.allocation||[];
  const allocationMax=Math.max(1,...allocation.map(item=>item.amountMinor));
  const allocationRows=allocation.length?allocation.map(item=>'\
    <div class="allocation-row"><span>'+esc(item.label)+'</span><span class="allocation-track" aria-hidden="true"><i style="--width:'+item.amountMinor/allocationMax*100+'%"></i></span><strong>'+moneyWhole(item.amountMinor)+'</strong></div>').join("")
    :'<div class="panel-unavailable"><p>Die Vermögensaufteilung ist momentan nicht verfügbar.</p></div>';
  const categories=data.spending.categories||[];
  const selectedSpendingOffset=Number.isInteger(data.spending.monthOffset)?data.spending.monthOffset:spendingSelection().offset;
  const latestSpendingMonth=data.spending.latestMonth||shiftMonthKey(data.spending.month,selectedSpendingOffset);
  const spendingControls=data.spending.state==="current"?'\
    <div class="period-controls" aria-label="Monat für Ausgaben"><button class="range-previous" type="button" onclick="shiftSpending(1)" aria-label="Einen Ausgabenmonat zurück" title="Einen Monat zurück">'+icons.chevron+'</button><label class="sr-only" for="spending-month">Angezeigter Ausgabenmonat</label><select class="spending-window" id="spending-month" name="spending-month" autocomplete="off" onchange="setSpendingOffset(this.value)">'+spendingMonthOptions(latestSpendingMonth,selectedSpendingOffset)+'</select><button class="range-next" type="button" onclick="shiftSpending(-1)" aria-label="Einen Ausgabenmonat vor" title="Einen Monat vor"'+(selectedSpendingOffset===0?' disabled':'')+'>'+icons.chevron+'</button></div>':'';
  const spendingMax=Math.max(1,...categories.map(item=>item.amountMinor));
  const categoryRows=categories.map(item=>'\
    <div class="spending-row"><span>'+esc(item.label)+'</span><span class="spending-track" aria-hidden="true"><i style="--width:'+item.amountMinor/spendingMax*100+'%"></i></span><strong>'+moneyWhole(item.amountMinor)+'</strong></div>').join("");
  const spending=data.spending.state==="current"?'\
    <div class="spending-list">'+categoryRows+'<div class="spending-row spending-other"><span>Weitere Kategorien</span><span class="spending-track"></span><strong>'+moneyWhole(data.spending.remainingMinor)+'</strong></div></div>\
    <div class="panel-footer"><a class="panel-link" href="#/spending">Alle Ausgaben ansehen</a></div>'
    :'<div class="panel-unavailable"><p>Die Ausgabenübersicht ist momentan nicht verfügbar.</p></div>';
  const freshnessStatus={
    current:{tone:"ok",label:"Aktuell"},
    confirmed:{tone:"warning",label:"Bestätigt"},
    warning:{tone:"warning",label:"Hinweis"},
    error:{tone:"critical",label:"Fehler"},
    unavailable:{tone:"critical",label:"Nicht verfügbar"}
  };
  const freshnessRows=data.freshness.map(item=>{
    const info=freshnessStatus[item.status]||freshnessStatus.warning;
    const detail=item.status==="confirmed"?monthWord(item.capturedAt):(item.capturedAt&&new Date(item.capturedAt).toDateString()===new Date(data.generatedAt).toDateString()?"heute":formatDate(item.capturedAt));
    const icon=item.key==="cash"?icons.bank:item.key==="solana"?icons.wallet:item.key==="pensions"?icons.status:icons.assets;
    return '<div class="freshness-row">'+icon+'<div class="freshness-label"><strong>'+esc(item.label)+'</strong><span>· '+esc(detail)+'</span></div><div class="freshness-status tone-'+info.tone+'">'+statusIcon(info.tone)+'<span>'+(item.status==="confirmed"?esc(monthWord(item.capturedAt)):info.label)+'</span></div></div>';
  }).join("");
  const warning=data.warnings.length?'<div class="overview-warning" role="status">Die Übersicht ist teilweise verfügbar: '+data.warnings.map(esc).join(" · ")+'</div>':'';
  document.getElementById("dashboard").innerHTML='\
    <section class="wealth-overview" aria-label="Vermögensübersicht">\
      <div><span class="wealth-label">Gesamtvermögen</span><strong class="wealth-value">'+moneyWhole(total)+'</strong><p class="wealth-date">Stand '+esc(formatDate(data.generatedAt))+' · Bankkonten und Anlagen</p>'+comparisonSummary+'</div>\
      <div class="wealth-composition"><div class="wealth-health">'+statusIcon(automaticOk?"ok":"warning")+'<span>'+(automaticOk?'Automatische Quellen aktuell':'Quellenstatus mit Hinweisen')+'</span></div>'+composition+'<div class="composition-legend"><span><i class="composition-cash"></i>Liquidität <strong>'+moneyWhole(data.cash.amountMinor)+'</strong></span><span><i class="composition-investments"></i>Anlagen <strong>'+moneyWhole(data.investments.amountMinor)+'</strong></span></div></div>\
      '+comparisonPanel+'\
    </section>'+warning+action+'\
    <div class="overview-dashboard-grid">\
      <section class="overview-panel" data-month-count="'+months.length+'" aria-labelledby="cashflow-title"><div class="panel-header cashflow-panel-header"><div><h2 id="cashflow-title">Geldfluss</h2><p class="cashflow-period">'+esc(rangeLabel)+' <span aria-hidden="true">·</span> '+esc(rangeDetail)+'</p></div><div class="period-controls" aria-label="Zeitraum für Geldfluss"><button class="range-previous" type="button" onclick="shiftCashflow(1)" aria-label="Einen Monat zurück" title="Einen Monat zurück">'+icons.chevron+'</button><label class="sr-only" for="cashflow-window">Angezeigter Zeitraum</label><select class="cashflow-window" id="cashflow-window" name="cashflow-window" autocomplete="off" onchange="setCashflowMonths(this.value)"><option value="4"'+(range.months===4?' selected':'')+'>4 Monate</option><option value="6"'+(range.months===6?' selected':'')+'>6 Monate</option><option value="12"'+(range.months===12?' selected':'')+'>12 Monate</option></select><button class="range-next" type="button" onclick="shiftCashflow(-1)" aria-label="Einen Monat vor" title="Einen Monat vor"'+(range.offset===0?' disabled':'')+'>'+icons.chevron+'</button></div></div>'+cashflow+'</section>\
      <section class="overview-panel" aria-labelledby="allocation-title"><div class="panel-header"><h2 id="allocation-title">Vermögensaufteilung</h2><span class="panel-link" aria-disabled="true" title="Der Vermögensbereich folgt als eigener Schritt">Details in Vermögen</span></div><div class="allocation-list">'+allocationRows+'</div></section>\
      <section class="overview-panel" aria-labelledby="spending-title"><div class="panel-header spending-panel-header"><div class="spending-summary"><h2 id="spending-title">Ausgaben</h2><strong>'+moneyWhole(data.spending.totalMinor)+'</strong></div>'+spendingControls+'</div>'+spending+'</section>\
      <section class="overview-panel" aria-labelledby="freshness-title"><div class="panel-header"><h2 id="freshness-title">Datenbasis</h2></div><div class="freshness-list">'+freshnessRows+'</div><p class="data-checked">Zuletzt geprüft '+esc(formatDate(data.generatedAt,true))+'</p></section>\
    </div>';
  document.getElementById("dashboard").setAttribute("aria-busy","false");
}

function expenseDate(value){
  const match=String(value||"").match(/^(\\d{4})-(\\d{2})-(\\d{2})$/);
  if(!match)return esc(value);
  return new Intl.DateTimeFormat("de-DE",{day:"2-digit",month:"2-digit",year:"numeric",timeZone:"UTC"}).format(new Date(Date.UTC(Number(match[1]),Number(match[2])-1,Number(match[3]))));
}
function expenseAmount(minor){
  const value=Number(minor)||0;
  return new Intl.NumberFormat("de-DE",{style:"currency",currency:"EUR",signDisplay:value<0?"always":"auto"}).format(-value/100);
}
function expenseState(title,text,action,label,tone="critical"){
  return '<section class="expense-state" role="status"><div class="expense-state-inner">'+statusIcon(tone)+'<h2>'+esc(title)+'</h2><p>'+esc(text)+'</p>'+(action?'<button class="button secondary" type="button" onclick="'+action+'">'+esc(label)+'</button>':'')+'</div></section>';
}
function renderSpendingError(error){
  document.getElementById("dashboard").innerHTML=expenseState("Nicht verfügbar","Die Buchungen konnten nicht geladen werden. Bitte versuche es erneut.","refresh(true)","Erneut versuchen");
  document.getElementById("dashboard").setAttribute("aria-busy","false");
  msg(error?.message||"Die Ausgaben konnten nicht geladen werden.",true);
}
function renderSpending(data){
  currentExpenseMonth=data.month;
  const uiState=expenseSelection();
  const empty=data.summary.bookings===0;
  const monthControls='<div class="period-controls" aria-label="Ausgabenmonat"><button class="range-previous" type="button" onclick="shiftExpenseMonth(-1)" aria-label="Einen Ausgabenmonat zurück" title="Einen Ausgabenmonat zurück"'+(data.month<=data.oldestMonth?' disabled':'')+'>'+icons.chevron+'</button><label class="sr-only" for="expense-month">Angezeigter Ausgabenmonat</label><select id="expense-month" name="expense-month" autocomplete="off" onchange="setExpenseMonth(this.value)">'+expenseMonthOptions(data.latestMonth,data.oldestMonth,data.month)+'</select><button class="range-next" type="button" onclick="shiftExpenseMonth(1)" aria-label="Einen Ausgabenmonat vor" title="Einen Ausgabenmonat vor"'+(data.month>=data.latestMonth?' disabled':'')+'>'+icons.chevron+'</button></div>';
  const summary='<section class="expense-summary-band" aria-label="Ausgabenübersicht für '+esc(data.monthLabel)+'"><div class="expense-period">'+monthControls+'</div><div class="expense-summary-stat"><span>Gesamtausgaben</span><strong>'+(empty?'–':moneyWhole(data.summary.totalMinor))+'</strong></div><div class="expense-summary-stat"><span>Buchungen</span><strong>'+(empty?'–':esc(data.summary.bookings))+'</strong></div><div class="expense-summary-stat"><span>Kategorisiert</span><strong>'+(empty?'–':esc(data.summary.categorizedPercent)+' %')+'</strong></div></section>';
  if(empty){
    document.getElementById("dashboard").innerHTML=summary+'<div style="margin-top:12px">'+expenseState("Keine Buchungen","Für diesen Monat liegen keine Buchungen vor. Wähle einen anderen Monat.","document.getElementById(&quot;expense-month&quot;).focus()","Monat wechseln","warning")+'</div>';
    document.getElementById("dashboard").setAttribute("aria-busy","false");
    return;
  }
  const selectedCategory=data.categories.find(category=>category.selected)?.label||"Alle Kategorien";
  const maxCategory=Math.max(1,...data.categories.filter(category=>category.key!=="all").map(category=>Math.max(0,category.amountMinor)));
  const categoryRows=data.categories.map((category,index)=>{
    const width=category.key==="all"?0:Math.max(1,Math.round(Math.max(0,category.amountMinor)/maxCategory*100));
    return '<button class="expense-category'+(category.key==="all"?' expense-category-all':'')+'" type="button" data-label="'+esc(category.label)+'" aria-current="'+String(category.selected)+'" onclick="setExpenseCategory(&quot;'+esc(category.key)+'&quot;)"><span class="expense-category-main"><span class="expense-category-check">'+icons.check+'</span><span class="expense-category-name">'+esc(category.label)+'</span><strong>'+moneyWhole(category.amountMinor)+'</strong></span><span class="expense-category-track" aria-hidden="true"><i style="--width:'+width+'%"></i></span></button>';
  }).join("");
  const more=data.categories.length>6?'<button class="expense-category-more" type="button" aria-expanded="'+String(uiState.expanded)+'" onclick="toggleExpenseCategories(this)"><span>'+(uiState.expanded?'Weniger anzeigen':'Weitere anzeigen')+'</span>'+icons.chevron+'</button>':'';
  const accounts='<option value="all"'+(data.selection.account==="all"?' selected':'')+'>Alle Konten</option>'+data.accounts.map(account=>'<option value="'+esc(account.key)+'"'+(account.key===data.selection.account?' selected':'')+'>'+esc(account.label)+'</option>').join("");
  const desktopRows=data.transactions.map(row=>'<tr><td>'+expenseDate(row.date)+'</td><td title="'+esc(row.merchant)+'">'+esc(row.merchant)+'</td><td title="'+esc(row.account)+'">'+esc(row.account)+'</td><td title="'+esc(row.category)+'">'+esc(row.category)+'</td><td class="expense-amount'+(row.amountMinor<0?' expense-refund':'')+'">'+expenseAmount(row.amountMinor)+'</td></tr>').join("");
  const mobileRows=data.transactions.map(row=>'<article class="expense-mobile-row"><span class="expense-date">'+expenseDate(row.date)+'</span><span class="expense-amount'+(row.amountMinor<0?' expense-refund':'')+'">'+expenseAmount(row.amountMinor)+'</span><strong>'+esc(row.merchant)+'</strong><span></span><span class="expense-mobile-meta">'+esc(row.account)+' · '+esc(row.category)+'</span></article>').join("");
  const transactionBody=data.transactions.length?'<div class="expense-table-wrap"><table class="expense-table"><thead><tr><th>Datum</th><th>Händler</th><th>Konto</th><th>Kategorie</th><th>Betrag</th></tr></thead><tbody>'+desktopRows+'</tbody></table></div><div class="expense-mobile-list">'+mobileRows+'</div>':expenseState("Keine Treffer","Für diese Filter liegen keine Buchungen vor.","setExpenseParams({category:&quot;&quot;,account:&quot;&quot;,search:&quot;&quot;,page:1})","Filter zurücksetzen","warning");
  const page=data.pagination;
  const pagination='<div class="expense-pagination"><span>'+page.from+'–'+page.to+' von '+page.total+'</span><div class="expense-pagination-actions"><button class="page-previous" type="button" onclick="setExpensePage('+(page.page-1)+')" aria-label="Vorherige Buchungsseite"'+(page.page<=1?' disabled':'')+'>'+icons.chevron+'</button><button class="page-next" type="button" onclick="setExpensePage('+(page.page+1)+')" aria-label="Nächste Buchungsseite"'+(page.page>=page.pages?' disabled':'')+'>'+icons.chevron+'</button></div></div>';
  document.getElementById("dashboard").innerHTML=summary+'<div class="expense-workspace"><section class="expense-pane expense-category-pane'+(uiState.expanded?' categories-expanded':'')+'" id="expense-category-pane" aria-labelledby="expense-categories-title"><div class="expense-pane-heading"><h2 id="expense-categories-title">Kategorien</h2></div><label class="expense-search"><span class="sr-only">Kategorie suchen</span>'+icons.search+'<input type="search" name="expense-category-search" value="'+esc(uiState.categorySearch)+'" autocomplete="off" placeholder="Kategorie suchen …" oninput="filterExpenseCategories(this.value)"></label><div class="expense-category-list">'+categoryRows+'</div>'+more+'</section><section class="expense-pane expense-transactions-pane" aria-labelledby="expense-transactions-title"><div class="expense-pane-heading"><h2 id="expense-transactions-title">Buchungen</h2><p>'+esc(selectedCategory)+' · '+data.filtered.bookings+' Buchungen</p></div><div class="expense-toolbar"><label class="expense-search"><span class="sr-only">Händler oder Buchung suchen</span>'+icons.search+'<input type="search" name="expense-transaction-search" value="'+esc(data.selection.search)+'" autocomplete="off" placeholder="Händler oder Buchung suchen …" oninput="updateExpenseSearch(this.value)"></label><label><span class="sr-only">Konto filtern</span><select name="expense-account" autocomplete="off" onchange="setExpenseAccount(this.value)">'+accounts+'</select></label></div>'+transactionBody+pagination+'</section></div>';
  if(uiState.categorySearch)filterExpenseCategories(uiState.categorySearch);
  document.getElementById("dashboard").setAttribute("aria-busy","false");
}

function assetStatusLabel(state,capturedAt){
  if(state==="confirmed")return "Bestätigt";
  if(state==="stale")return "Veraltet";
  if(state==="error")return "Abruf fehlgeschlagen";
  if(state==="unavailable")return "Nicht verfügbar";
  return "Aktuell";
}
function assetAreaStatusLabel(state){
  return state==="confirmed"?"Bestätigt":state==="stale"?"Veraltet":state==="error"?"Fehler":state==="unavailable"?"Nicht verfügbar":"Aktuell";
}
function assetAreaIcon(area){return area==="cash"?icons.bank:area==="crypto"?icons.wallet:area==="pensions"?icons.manual:icons.assets}
function renderAssetsError(error){
  document.getElementById("dashboard").innerHTML=expenseState("Nicht verfügbar","Die Vermögenswerte konnten nicht geladen werden. Bitte versuche es erneut.","refresh(true)","Erneut versuchen");
  document.getElementById("dashboard").setAttribute("aria-busy","false");
  msg(error?.message||"Die Vermögenswerte konnten nicht geladen werden.",true);
}
function renderAssets(data){
  const selection=assetSelection();
  const selectedArea=data.areas.find(area=>area.key===selection);
  const filtered=selection==="all"?data.positions:data.positions.filter(position=>position.area===selection);
  const allocationLabel=data.areas.map(area=>area.label+" "+(area.amountMinor===null?"nicht verfügbar":moneyWhole(area.amountMinor))).join(", ");
  const segments=data.totalMinor===null?"":data.areas.map(area=>{
    const width=area.amountMinor===null||data.totalMinor<=0?0:Math.max(0,area.amountMinor/data.totalMinor*100);
    return '<span class="area-'+area.key+'" style="width:'+width+'%;background:var(--area-color)" title="'+esc(area.label)+'"></span>';
  }).join("");
  const legend=data.areas.map(area=>'<div class="assets-legend-item area-'+area.key+'"><i aria-hidden="true"></i><span>'+esc(area.label)+'</span><strong>'+(area.amountMinor===null?'–':moneyWhole(area.amountMinor))+'</strong></div>').join("");
  const summaryStatus=data.state==="partial"
    ? '<span class="tone-critical">Teilweise nicht verfügbar</span>'
    : data.state==="stale"
      ? '<span class="tone-warning">Werte teilweise veraltet</span>'
      : '<strong>'+data.summary.automaticCurrent+' automatische Quellen aktuell</strong> · '+data.summary.confirmed+' bestätigt';
  const historyDetail=data.marketHistory?.latestDate?'Marktwerte täglich archiviert bis '+formatDate(data.marketHistory.latestDate):'Marktwertarchiv wird aufgebaut';
  const summary='<section class="assets-summary" aria-label="Vermögensübersicht"><div class="assets-total"><span>Gesamtvermögen</span><strong>'+(data.totalMinor===null?'–':moneyWhole(data.totalMinor))+'</strong><small>Basis: letzte verfügbare Werte · '+esc(historyDetail)+'</small></div><div class="assets-allocation"><p class="assets-status-line">'+summaryStatus+'</p><div class="assets-bar" role="img" aria-label="'+esc(allocationLabel)+'">'+segments+'</div><div class="assets-legend">'+legend+'</div></div></section>';
  const areaButtons=data.areas.map(area=>{
    const active=area.key===selection;
    return '<button class="asset-area-button area-'+area.key+'" type="button" aria-current="'+String(active)+'" onclick="setAssetArea(&quot;'+(active?'all':area.key)+'&quot;)"><span class="asset-area-title"><i class="asset-area-dot" aria-hidden="true"></i>'+esc(area.label)+'</span><span class="asset-area-value"><strong>'+(area.amountMinor===null?'–':moneyWhole(area.amountMinor))+'</strong><span>'+(area.percent===null?'–':new Intl.NumberFormat("de-DE",{maximumFractionDigits:1}).format(area.percent)+' %')+'</span></span><span class="asset-area-meta">'+area.positions+' '+(area.positions===1?'Position':'Positionen')+' · '+esc(assetAreaStatusLabel(area.status))+'</span></button>';
  }).join("");
  const options='<option value="all"'+(selection==="all"?' selected':'')+'>Alle Bereiche</option>'+data.areas.map(area=>'<option value="'+area.key+'"'+(selection===area.key?' selected':'')+'>'+esc(area.label)+'</option>').join("");
  const confirmedDates=data.positions.filter(position=>position.area==="pensions"&&(position.confirmedAt||position.capturedAt)).map(position=>position.confirmedAt||position.capturedAt).sort();
  const notice=data.state==="partial"
    ? '<div class="assets-notice"><span>'+esc(data.warnings[0]||"Teilwerte sind nicht verfügbar")+'</span><a href="#/data-status">Zum Datenstatus</a></div>'
    : confirmedDates.length&&(selection==="all"||selection==="pensions")
      ? '<div class="assets-notice"><span>Vorsorgewerte zuletzt am '+esc(formatDate(confirmedDates.at(-1)))+' bestätigt</span><a href="#/data-status">Zum Datenstatus</a></div>'
      : '';
  const desktopRows=filtered.map(position=>{const cost=Number.isFinite(position.acquisitionCostMinor)?'<span class="asset-state-text">Kauf '+(position.acquisitionCostEstimated?'ca. ':'')+moneyWhole(position.acquisitionCostMinor)+(position.detail?' · '+esc(position.detail):'')+'</span>':position.detail?'<span class="asset-state-text">'+esc(position.detail)+'</span>':'';const confirmed=Number.isFinite(position.confirmedAmountMinor)?'<span class="asset-state-text">Vertragswert '+moneyWhole(position.confirmedAmountMinor)+' bestätigt am '+esc(formatDate(position.confirmedAt))+'</span>':'';return '<tr><td title="'+esc(position.label)+'">'+assetAreaIcon(position.area)+' '+esc(position.label)+cost+'</td><td><span class="asset-area-cell area-'+position.area+'"><i class="asset-area-dot" aria-hidden="true"></i>'+esc(position.areaLabel)+'</span></td><td>'+(position.amountMinor===null?'–':moneyWhole(position.amountMinor))+confirmed+'</td><td>'+esc(position.capturedAt?formatDate(position.capturedAt):"–")+'<span class="asset-state-text">'+esc(assetStatusLabel(position.status,position.capturedAt))+'</span></td><td>'+esc(position.basis)+(position.valuationSource?'<span class="asset-state-text">'+esc(position.valuationSource)+'</span>':'')+'</td></tr>'}).join("");
  const mobileRows=filtered.map(position=>{const cost=Number.isFinite(position.acquisitionCostMinor)?' · Kauf '+(position.acquisitionCostEstimated?'ca. ':'')+moneyWhole(position.acquisitionCostMinor):'';const confirmed=Number.isFinite(position.confirmedAmountMinor)?' · Vertragswert '+moneyWhole(position.confirmedAmountMinor)+' bestätigt '+formatDate(position.confirmedAt):'';return '<article class="assets-mobile-row"><strong>'+esc(position.label)+'</strong><strong class="asset-mobile-value">'+(position.amountMinor===null?'–':moneyWhole(position.amountMinor))+'</strong><span class="asset-mobile-meta area-'+position.area+'">'+esc(position.areaLabel)+' · '+esc(position.basis)+(position.valuationSource?' · '+esc(position.valuationSource):'')+'</span><span class="asset-mobile-meta">'+esc(position.detail||'')+cost+confirmed+' · '+esc(position.capturedAt?formatDate(position.capturedAt):"–")+'</span></article>'}).join("");
  const positionBody=filtered.length
    ? '<div class="assets-table-wrap"><table class="assets-table"><thead><tr><th>Position</th><th>Bereich</th><th>Wert</th><th>Stichtag</th><th>Datenbasis</th></tr></thead><tbody>'+desktopRows+'</tbody></table></div><div class="assets-mobile-list">'+mobileRows+'</div>'
    : expenseState("Keine Positionen","Für den gewählten Bereich liegen keine Werte vor.","setAssetArea(&quot;all&quot;)","Alle Bereiche anzeigen","warning");
  const title=selectedArea?selectedArea.label:"Bestände";
  document.getElementById("dashboard").innerHTML=summary+'<div class="assets-workspace"><section class="assets-pane assets-area-pane" aria-labelledby="assets-areas-title"><h2 id="assets-areas-title">Vermögensbereiche</h2><label class="assets-mobile-filter"><span class="sr-only">Vermögensbereich auswählen</span><select name="asset-area" autocomplete="off" onchange="setAssetArea(this.value)">'+options+'</select></label><div class="asset-area-list">'+areaButtons+'</div></section><section class="assets-pane" aria-labelledby="assets-positions-title"><div class="assets-pane-header"><div><h2 id="assets-positions-title">'+esc(title)+'</h2><p>'+(selection==="all"?'Alle Bereiche':esc(selectedArea?.label||""))+' · '+filtered.length+' '+(filtered.length===1?'Position':'Positionen')+'</p></div></div>'+notice+positionBody+'</section></div>';
  document.getElementById("dashboard").setAttribute("aria-busy","false");
}

function renderAnalysesError(error){
  currentAnalysisData=null;
  document.getElementById("dashboard").innerHTML=expenseState("Nicht verfügbar","Die Ausgabenstruktur konnte nicht geladen werden. Bitte versuche es erneut.","refresh(true)","Erneut versuchen");
  document.getElementById("dashboard").setAttribute("aria-busy","false");
  msg(error?.message||"Die Analyse konnte nicht geladen werden.",true);
}
function analysisYearOptions(years,selected,excluded){
  return years.map(year=>'<option value="'+year+'"'+(year===selected?' selected':'')+(year===excluded?' disabled':'')+'>'+year+'</option>').join("");
}
function analysisEstimate(value){return value?'<span class="analysis-estimate">[SCHÄTZUNG]</span>':''}
function analysisMonthLabel(value){
  const match=String(value||"").match(/^(\\d{4})-(\\d{2})$/);
  if(!match)return esc(value);
  return new Intl.DateTimeFormat("de-DE",{month:"short",year:"numeric",timeZone:"UTC"}).format(new Date(Date.UTC(Number(match[1]),Number(match[2])-1,1)));
}
function renderAnalyses(data){
  currentAnalysisData=data;
  const state=analysisSelection();
  const periodOptions=analysisYearOptions(data.availableYears,data.selection.periodYear,0);
  const comparisonOptions=analysisYearOptions(data.availableYears,data.selection.comparisonYear,data.selection.periodYear);
  const toolbar='<section class="analysis-toolbar" aria-label="Analysefilter"><label>Ansicht<select name="analysis-view" onchange="setAnalysisView(this.value)"><option value="expense-structure" selected>Ausgabenstruktur</option><option value="recurring-expenses">Regelmäßige Ausgaben prüfen</option><option value="expense-optimizations">Optimierungsliste</option><option value="decision-lab">Entscheidungslabor</option><option value="crypto-origin-tax">Krypto · Herkunft &amp; Steuerstatus</option></select></label><label>Zeitraum<select id="analysis-period" name="analysis-period" autocomplete="off">'+periodOptions+'</select></label><label>Vergleich<select id="analysis-comparison" name="analysis-comparison" autocomplete="off">'+comparisonOptions+'</select></label><button class="button" type="button" onclick="applyAnalysisFilters()">Anwenden</button></section>';
  const change=data.changePercent===null?'–':new Intl.NumberFormat("de-DE",{signDisplay:"always",maximumFractionDigits:1}).format(data.changePercent)+' %';
  const changeTone=data.changePercent===null?'':data.changePercent<=0?' tone-ok':' tone-warning';
  const summary='<section class="analysis-summary" aria-label="Zusammenfassung Ausgabenstruktur"><div><span>Wirtschaftliche Ausgaben '+esc(data.period.label)+'</span><strong class="analysis-total">'+(data.state==="empty"?'–':moneyWhole(data.period.totalMinor))+'</strong><p class="analysis-basis">Gebucht, Zusatzwerte einbezogen, interne Überträge ausgeschlossen '+analysisEstimate(data.period.estimate)+'</p></div><div><span>Veränderung zu '+esc(data.comparison.label)+' '+analysisEstimate(data.comparison.estimate)+'</span><strong class="'+changeTone+'">'+change+'</strong></div><div><span>Nicht zuordenbar</span><strong>'+new Intl.NumberFormat("de-DE",{maximumFractionDigits:1}).format(data.unknownPercent)+' %</strong><p class="analysis-basis">'+moneyWhole(data.unknownMinor)+'</p></div></section>';
  if(data.state==="empty"){
    document.getElementById("dashboard").innerHTML=toolbar+summary+'<div style="margin-top:12px">'+expenseState("Keine Ausgaben","Für den gewählten Zeitraum liegen keine auswertbaren Ausgaben vor.","document.getElementById(&quot;analysis-period&quot;).focus()","Zeitraum wechseln","warning")+'</div>';
    document.getElementById("dashboard").setAttribute("aria-busy","false");return;
  }
  const visibleCategories=state.expanded?data.categories:data.categories.slice(0,8);
  const maxCategory=Math.max(1,...visibleCategories.flatMap(row=>[Math.max(0,row.periodMinor),Math.max(0,row.comparisonMinor)]));
  const categoryRows=visibleCategories.map(row=>'<div class="analysis-category"><span class="analysis-category-label" title="'+esc(row.label)+'">'+esc(row.label)+'</span><span class="analysis-bar-pair" aria-hidden="true"><span class="analysis-bar"><i style="--width:'+Math.max(1,Math.max(0,row.periodMinor)/maxCategory*100)+'%"></i></span><span class="analysis-bar comparison"><i style="--width:'+Math.max(1,Math.max(0,row.comparisonMinor)/maxCategory*100)+'%"></i></span></span><span class="analysis-category-values"><span>'+moneyWhole(row.periodMinor)+'</span><span>'+moneyWhole(row.comparisonMinor)+'</span></span></div>').join("");
  const categoryMore=data.categories.length>8?'<button class="analysis-more" type="button" onclick="toggleAnalysisCategories()">'+(state.expanded?'Weniger Kategorien':'Alle '+data.categories.length+' Kategorien anzeigen')+'</button>':'';
  const categories='<section class="analysis-panel" aria-labelledby="analysis-categories-title"><div class="analysis-panel-head"><div><h2 id="analysis-categories-title">Ausgaben nach Kategorie</h2><p>Direkter Vergleich der gewählten Zeiträume</p></div><div class="analysis-legend"><span><i style="background:var(--blue)"></i>'+esc(data.period.label)+'</span><span><i style="background:#53647f"></i>'+esc(data.comparison.label)+analysisEstimate(data.comparison.estimate)+'</span></div></div><div class="analysis-bars">'+categoryRows+'</div>'+categoryMore+'</section>';
  const maxClass=Math.max(1,...data.classes.map(row=>Math.max(0,row.amountMinor)));
  const classRows=data.classes.map(row=>'<div class="analysis-class-row"><span>'+esc(row.label)+'</span><strong>'+moneyWhole(row.amountMinor)+' · '+new Intl.NumberFormat("de-DE",{maximumFractionDigits:1}).format(row.percent)+' %</strong><span class="analysis-class-track" aria-hidden="true"><i style="--width:'+Math.max(1,Math.max(0,row.amountMinor)/maxClass*100)+'%"></i></span></div>').join("");
  const classes='<section class="analysis-panel" aria-labelledby="analysis-classes-title"><div class="analysis-panel-head"><div><h2 id="analysis-classes-title">Ausgabenklassen</h2><p>Veränderbarkeit der Positionen</p></div></div><div class="analysis-class-list">'+classRows+'</div></section>';
  const positions=data.positions.slice(0,12);
  const desktopRows=positions.map(row=>{
    const open=state.position===row.key;
    const months=row.months.length?row.months.map(month=>'<span>'+analysisMonthLabel(month.month)+' <strong>'+moneyWhole(month.amountMinor)+'</strong></span>').join(""):'<span>Keine Monatswerte verfügbar</span>';
    return '<tr class="analysis-position-row" tabindex="0" role="button" aria-expanded="'+String(open)+'" onclick="toggleAnalysisPosition(&quot;'+esc(row.key)+'&quot;)" onkeydown="if(event.key===&quot;Enter&quot;||event.key===&quot; &quot;){event.preventDefault();toggleAnalysisPosition(&quot;'+esc(row.key)+'&quot;)}"><td>'+esc(row.label)+' '+analysisEstimate(row.estimate)+'</td><td>'+esc(row.category)+'</td><td>'+esc(row.class)+'</td><td>'+moneyWhole(row.amountMinor)+'</td><td>'+icons.chevron+'</td></tr><tr class="analysis-position-detail"'+(open?'':' hidden')+'><td colspan="5"><div class="analysis-months">'+months+'</div></td></tr>';
  }).join("");
  const mobileRows=positions.map(row=>{
    const open=state.position===row.key;
    const months=row.months.map(month=>'<span>'+analysisMonthLabel(month.month)+' <strong>'+moneyWhole(month.amountMinor)+'</strong></span>').join("");
    return '<button class="analysis-mobile-row" type="button" aria-expanded="'+String(open)+'" onclick="toggleAnalysisPosition(&quot;'+esc(row.key)+'&quot;)"><span class="analysis-mobile-main"><strong>'+esc(row.label)+' '+analysisEstimate(row.estimate)+'</strong><strong>'+moneyWhole(row.amountMinor)+'</strong><span class="analysis-mobile-meta">'+esc(row.category)+' · '+esc(row.class)+'</span></span><span class="analysis-mobile-detail analysis-months">'+months+'</span></button>';
  }).join("");
  const positionPanel='<section class="analysis-panel analysis-positions" aria-labelledby="analysis-positions-title"><div class="analysis-panel-head"><div><h2 id="analysis-positions-title">Größte Positionen</h2><p>Die zwölf größten Positionen im gewählten Zeitraum · Zeile öffnen für Monatswerte</p></div></div><table class="analysis-position-table"><thead><tr><th>Position</th><th>Kategorie</th><th>Klasse</th><th>Betrag</th><th><span class="sr-only">Details</span></th></tr></thead><tbody>'+desktopRows+'</tbody></table><div class="analysis-mobile-positions">'+mobileRows+'</div></section>';
  const warnings=data.warnings.map(warning=>'<div class="analysis-warning" role="status">'+icons.warning+'<span>'+esc(warning)+'</span></div>').join("");
  document.getElementById("dashboard").innerHTML=toolbar+summary+'<div class="analysis-grid">'+categories+classes+'</div>'+positionPanel+warnings;
  document.getElementById("dashboard").setAttribute("aria-busy","false");
}

function solAmount(value){return new Intl.NumberFormat("de-DE",{minimumFractionDigits:0,maximumFractionDigits:9}).format(Number(value))}
function perSol(value,currency="EUR"){return new Intl.NumberFormat("de-DE",{style:"currency",currency,minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(value))+"/SOL"}
function confidenceLabel(value){return value==="Bestaetigt"?"Bestätigt":String(value)}
function cryptoTaxStatus(status){
  const labels={review:"Prüfung nötig","likely-tax-free":"Wahrscheinlich steuerfrei","below-threshold":"Unter Freigrenze","future-filing":"Für Erklärung vormerken"};
  return '<span class="crypto-status crypto-status-'+esc(status)+'">'+esc(labels[status]||status)+'</span>';
}
function renderCryptoError(error){
  currentCryptoData=null;
  document.getElementById("dashboard").innerHTML=expenseState("Nicht verfügbar","Die Kryptoanalyse konnte nicht geladen werden. Die rekonstruierte Datenbasis bleibt davon unverändert.","refresh(true)","Erneut versuchen");
  document.getElementById("dashboard").setAttribute("aria-busy","false");
  msg(error?.message||"Die Kryptoanalyse konnte nicht geladen werden.",true);
}
function renderCryptoAnalysis(data){
  currentCryptoData=data;
  const toolbar='<section class="analysis-toolbar crypto-toolbar" aria-label="Auswahl und Datenstand der Kryptoanalyse"><label>Ansicht<select name="analysis-view" autocomplete="off" onchange="setAnalysisView(this.value)"><option value="expense-structure">Ausgabenstruktur</option><option value="recurring-expenses">Regelmäßige Ausgaben prüfen</option><option value="expense-optimizations">Optimierungsliste</option><option value="decision-lab">Entscheidungslabor</option><option value="crypto-origin-tax" selected>Krypto · Herkunft &amp; Steuerstatus</option></select></label><div class="crypto-toolbar-meta"><span>Prüfumfang</span><strong>Ab '+data.selection.scopeStartYear+'</strong></div><div class="crypto-toolbar-meta"><span>Rekonstruktionsstand</span><strong>'+esc(formatDate(data.capturedAt,true))+'</strong></div></section>';
  const summary='<section class="analysis-summary crypto-summary" aria-label="Zusammenfassung der Solana-Position"><div><span>Aktueller Gesamtbestand zum Rekonstruktionsstand</span><strong class="analysis-total">'+solAmount(data.holdings.totalSol)+' SOL</strong><p class="analysis-basis">Quelle: '+esc(data.source)+' · Stake ist kein Abfluss</p></div><div><span>Davon Staking Rewards</span><strong>'+solAmount(data.holdings.rewardsSol)+' SOL</strong><p class="analysis-basis">'+new Intl.NumberFormat("de-DE",{maximumFractionDigits:2}).format(data.holdings.rewardsPercent)+' % des Bestands</p></div><div><span>In Stake-Accounts</span><strong>'+solAmount(data.holdings.stakeTotalSol)+' SOL</strong><p class="analysis-basis">Deaktiviert: '+solAmount(data.holdings.inactiveStakeSol)+' SOL</p></div></section>';
  const investment='<section class="analysis-panel" aria-labelledby="crypto-investment-title"><div class="analysis-panel-head"><div><h2 id="crypto-investment-title">Investmentbasis</h2><p>Ökonomische Average-Cost-Sicht, getrennt von der Steuerbasis</p></div></div><div class="crypto-basis-list"><div class="crypto-basis-row"><div><strong>A. Übergang ETH → SOL</strong><span>Marktwert beim Übergang / erhaltene SOL '+analysisEstimate(true)+'</span></div><strong>'+perSol(data.transition.conversionBasisEurPerSol)+'<small>'+perSol(data.transition.conversionBasisUsdPerSol,"USD")+'</small></strong></div><div class="crypto-basis-row"><div><strong>B. Effektiv inklusive Staking</strong><span>Fortgeführte Kapitalbasis / heutiger Bestand '+analysisEstimate(true)+'</span></div><strong>'+perSol(data.investment.effectiveBasisEurPerSol)+'<small>'+perSol(data.investment.effectiveBasisUsdPerSol,"USD")+'</small></strong></div><div class="crypto-basis-row"><div><strong>C. Netto-Fiatkapital</strong><span>Einzahlungen abzüglich bestätigter Fiat-Auszahlungen · keine steuerliche Cost Basis</span></div><strong>'+money(data.investment.netFiatCapitalEurMinor)+'<small>'+perSol(data.investment.netFiatPerCurrentSolEur)+'</small></strong></div></div><div class="crypto-break-even"><span>Break-even der heutigen Position vor Steuern und Verkaufskosten '+analysisEstimate(true)+'</span><strong>'+perSol(data.investment.breakEvenEurPerSol)+'</strong></div></section>';
  const holdings='<section class="analysis-panel" aria-labelledby="crypto-holdings-title"><div class="analysis-panel-head"><div><h2 id="crypto-holdings-title">Bestandszusammensetzung</h2><p>Mengen sind nicht mit Anschaffungskosten gleichzusetzen</p></div></div><div class="crypto-holdings-list"><div class="crypto-holding-row"><div><strong>Liquide</strong><span>Hauptwallet</span></div><strong>'+solAmount(data.holdings.liquidSol)+' SOL</strong></div><div class="crypto-holding-row"><div><strong>Aktiv delegiert</strong><span>Native Stake-Delegation</span></div><strong>'+solAmount(data.holdings.delegatedSol)+' SOL</strong></div><div class="crypto-holding-row"><div><strong>Noch nicht delegiert</strong><span>Jito-Tips im Stake-Account</span></div><strong>'+solAmount(data.holdings.undelegatedStakeSol)+' SOL</strong></div><div class="crypto-holding-row"><div><strong>Rent-Reserve</strong><span>Grundsätzlich bei Kontoschließung rückholbar</span></div><strong>'+solAmount(data.holdings.rentReserveSol)+' SOL</strong></div><div class="crypto-holding-row"><div><strong>Gekauft oder konvertiert</strong><span>Heutiger Bestand vor Rewards</span></div><strong>'+solAmount(data.holdings.acquiredOrConvertedSol)+' SOL</strong></div></div></section>';
  const taxRows=data.taxYears.map(year=>'<tr><td><strong>'+year.year+'</strong></td><td>'+cryptoTaxStatus(year.status)+'</td><td class="crypto-tax-reference">'+(year.referenceMinor===undefined?'–':money(year.referenceMinor)+(year.estimate?' '+analysisEstimate(true):''))+(year.referenceLabel?'<small>'+esc(year.referenceLabel)+'</small>':'')+'</td><td>'+esc(confidenceLabel(year.confidence))+'</td><td><strong>'+esc(year.title)+'</strong><br><span class="crypto-tax-detail">'+esc(year.detail)+'</span></td></tr>').join("");
  const taxCards=data.taxYears.map(year=>'<article class="crypto-tax-card"><div class="crypto-tax-card-head"><strong>'+year.year+'</strong>'+cryptoTaxStatus(year.status)+'</div><h3>'+esc(year.title)+'</h3><p>'+esc(year.detail)+'</p><p class="crypto-tax-reference">'+(year.referenceMinor===undefined?'Kein belastbarer Betrag':money(year.referenceMinor)+(year.estimate?' '+analysisEstimate(true):''))+(year.referenceLabel?' · '+esc(year.referenceLabel):'')+'</p><p>Belegstatus: '+esc(confidenceLabel(year.confidence))+'</p></article>').join("");
  const tax='<section class="analysis-panel crypto-tax" aria-labelledby="crypto-tax-title"><div class="analysis-panel-head"><div><h2 id="crypto-tax-title">Steuerliche Prüfspur '+data.selection.scopeStartYear+' ff.</h2><p>Keine Steuerschuld, sondern der dokumentierte Prüfstatus je Kalenderjahr</p></div></div><table class="crypto-tax-table"><thead><tr><th scope="col">Jahr</th><th scope="col">Status</th><th scope="col">Referenz</th><th scope="col">Beleglage</th><th scope="col">Einordnung</th></tr></thead><tbody>'+taxRows+'</tbody></table><div class="crypto-tax-mobile">'+taxCards+'</div></section>';
  const evidenceRows=data.evidence.map(item=>'<div class="crypto-evidence-item"><span>'+esc(confidenceLabel(item.confidence))+'</span><strong>'+esc(item.label)+'</strong><p>'+esc(item.detail)+'</p></div>').join("");
  const evidence='<section class="analysis-panel crypto-tax" aria-labelledby="crypto-evidence-title"><div class="analysis-panel-head"><div><h2 id="crypto-evidence-title">Datenbasis &amp; Belegstatus</h2><p>Öffentliche Blockchain-Daten und lokale Exporte, ohne Wallet-Adressen im Browser</p></div></div><div class="crypto-evidence">'+evidenceRows+'</div></section>';
  const warnings=data.warnings.map(warning=>'<div class="analysis-warning" role="status">'+icons.warning+'<span>'+esc(warning)+'</span></div>').join("");
  document.getElementById("dashboard").innerHTML=toolbar+summary+'<div class="crypto-layout">'+investment+holdings+'</div>'+tax+evidence+warnings;
  document.getElementById("dashboard").setAttribute("aria-busy","false");
}

function renderRecurringError(error){
  currentRecurringData=null;currentRecurringDetail=null;
  document.getElementById("dashboard").innerHTML=expenseState("Nicht verfügbar","Die regelmäßigen Ausgaben konnten nicht geladen werden. Bitte versuche es erneut.","refresh(true)","Erneut versuchen");
  document.getElementById("dashboard").setAttribute("aria-busy","false");
  msg(error?.message||"Die regelmäßigen Ausgaben konnten nicht geladen werden.",true);
}
function selectedOption(value,current,label){return '<option value="'+value+'"'+(value===current?' selected':'')+'>'+label+'</option>'}
function recurringDecisionOptions(current){
  return '<option value=""'+(!current?' selected':'')+' disabled>Bitte auswählen</option>'
    +selectedOption("GRUNDBEDARF",current,"Grundbedarf")
    +selectedOption("GESTALTBAR",current,"Gestaltbar")
    +selectedOption("VERMEIDBAR",current,"Vermeidbar")
    +selectedOption("UNKLAR",current,"Unklar")
    +selectedOption("KEIN_KANDIDAT",current,"Kein Kandidat");
}
function recurringDetailMarkup(candidate,detail,instance){
  if(!detail||detail.candidate.key!==candidate.key)return '<div class="recurring-detail" aria-live="polite"><div class="skeleton" style="height:120px">Details werden geladen …</div></div>';
  const item=detail.candidate;
  const decision=item.decision&&!item.decision.stale?item.decision.value:"";
  const stale=item.decision?.stale?'<div class="analysis-warning" role="status">'+icons.warning+'<span>Die frühere Entscheidung passt nicht mehr zur aktuellen Beleglage und muss erneut bestätigt werden.</span></div>':'';
  const reasons=item.markingReasons.map(reason=>'<li>'+esc(reason)+'</li>').join("");
  const payments=detail.payments.map(payment=>'<div class="recurring-payment"><span>'+esc(formatDate(payment.date))+'</span><span>'+esc(payment.category)+(payment.kind==="refund"?' · Erstattung':payment.kind==="exception"?' · Ausnahme':'')+'</span><strong>'+money(payment.amountMinor)+'</strong></div>').join("");
  return '<div class="recurring-detail">'+stale+'<div class="recurring-detail-grid"><div><span>Beobachtungsfenster</span><strong>'+esc(formatDate(item.observation.startDate))+'–'+esc(formatDate(item.observation.endDate))+'</strong></div><div><span>Treffer / Ausnahmen</span><strong>'+item.observation.occurrences+' / '+item.observation.exceptions+'</strong></div><div><span>Spanne</span><strong>'+money(item.amount.minMinor)+'–'+money(item.amount.maxMinor)+'</strong></div><div><span>Beleglage</span><strong>'+esc(item.evidence.label)+' · '+esc(item.evidence.source)+'</strong></div><div><span>Rhythmussicherheit</span><strong>'+esc(item.rhythm.confidence==='hoch'?'Hoch':'Mittel')+'</strong></div><div><span>Klassifikationssicherheit</span><strong>'+esc(item.classification.confidence==='nutzerbestaetigt'?'Vom Nutzer bestätigt':'Unbestätigt')+'</strong></div><div><span>Letzte Zahlung</span><strong>'+esc(formatDate(item.observation.lastPaymentDate))+' · '+money(item.amount.lastMinor)+'</strong></div><div><span>Typischer Abstand</span><strong>'+item.rhythm.typicalDays+' Tage</strong></div></div><ul class="recurring-reasons">'+reasons+'</ul><div class="recurring-decision"><label for="recurring-decision-'+instance+'-'+esc(item.key)+'">Nutzerentscheidung<select id="recurring-decision-'+instance+'-'+esc(item.key)+'" name="recurring-decision" autocomplete="off">'+recurringDecisionOptions(decision)+'</select><p>Erst eine gespeicherte Auswahl bestätigt die Einordnung. Bis dahin bleibt der Treffer eine mögliche regelmäßige Zahlung.</p></label><button class="button" id="recurring-save-'+instance+'-'+esc(item.key)+'" type="button" onclick="saveRecurringDecision(&quot;'+esc(item.key)+'&quot;,&quot;'+instance+'&quot;)">Entscheidung speichern</button></div><div class="recurring-payment-list" aria-label="Beitragende Zahlungen">'+payments+'</div></div>';
}
function renderRecurringExpenses(data){
  currentRecurringData=data;
  const state=analysisSelection();
  const toolbar='<section class="analysis-toolbar recurring-toolbar" aria-label="Filter für regelmäßige Ausgaben"><label>Ansicht<select name="analysis-view" autocomplete="off" onchange="setAnalysisView(this.value)"><option value="expense-structure">Ausgabenstruktur</option><option value="recurring-expenses" selected>Regelmäßige Ausgaben prüfen</option><option value="expense-optimizations">Optimierungsliste</option><option value="decision-lab">Entscheidungslabor</option><option value="crypto-origin-tax">Krypto · Herkunft &amp; Steuerstatus</option></select></label><label>Rhythmus<select id="recurring-rhythm" name="recurring-rhythm" autocomplete="off">'+selectedOption("alle",data.selection.rhythm,"Alle")+selectedOption("monatlich",data.selection.rhythm,"Monatlich")+selectedOption("vierteljaehrlich",data.selection.rhythm,"Vierteljährlich")+selectedOption("jaehrlich",data.selection.rhythm,"Jährlich")+'</select></label><label>Prüfstatus<select id="recurring-review" name="recurring-review" autocomplete="off">'+selectedOption("moeglich",data.selection.review,"Möglich")+selectedOption("bestaetigt",data.selection.review,"Bestätigt")+selectedOption("kein-kandidat",data.selection.review,"Kein Kandidat")+selectedOption("alle",data.selection.review,"Alle")+'</select></label><label>Einordnung<select id="recurring-classification" name="recurring-classification" autocomplete="off">'+selectedOption("alle",data.selection.classification,"Alle")+selectedOption("GRUNDBEDARF",data.selection.classification,"Grundbedarf")+selectedOption("GESTALTBAR",data.selection.classification,"Gestaltbar")+selectedOption("VERMEIDBAR",data.selection.classification,"Vermeidbar")+selectedOption("UNKLAR",data.selection.classification,"Unklar")+'</select></label><label>Rhythmussicherheit<select id="recurring-confidence" name="recurring-confidence" autocomplete="off">'+selectedOption("alle",data.selection.confidence,"Alle")+selectedOption("hoch",data.selection.confidence,"Hoch")+selectedOption("mittel",data.selection.confidence,"Mittel")+'</select></label><button class="button" type="button" onclick="applyRecurringFilters()">Anwenden</button></section>';
  const summary='<section class="recurring-summary" aria-label="Prüfbestand"><div><span>Mögliche regelmäßige Zahlungen</span><strong>'+data.summary.possible+'</strong></div><div><span>Vom Nutzer bestätigt</span><strong>'+data.summary.confirmed+'</strong></div><div><span>Als kein Kandidat markiert</span><strong>'+data.summary.notCandidate+'</strong></div></section>';
  const freshness='<div class="recurring-freshness"><span>Quelle: '+esc(data.source)+'</span><span>Beobachtet: '+esc(formatDate(data.freshness.windowStart))+'–'+esc(formatDate(data.freshness.windowEnd))+'</span><span>Letzter vollständiger Monat: '+esc(analysisMonthLabel(data.freshness.lastCompleteMonth))+'</span><span>Stand: '+esc(formatDate(data.freshness.lastSuccessfulAt,true))+'</span></div>';
  const warnings=data.warnings.map(warning=>'<div class="analysis-warning" role="status">'+icons.warning+'<span>'+esc(warning)+'</span></div>').join("");
  if(!data.candidates.length){
    const title=data.summary.possible+data.summary.confirmed+data.summary.notCandidate===0?"Keine stabilen Kandidaten":"Keine Treffer für diese Filter";
    const detail=title==="Keine stabilen Kandidaten"?"Im Beobachtungsfenster wurde keine ausreichend stabile und aktuelle Zahlungsfolge erkannt.":"Passe die Filter an, um andere Prüfstände anzuzeigen.";
    document.getElementById("dashboard").innerHTML=toolbar+summary+freshness+warnings+'<div style="margin-top:12px">'+expenseState(title,detail,"document.getElementById(&quot;recurring-rhythm&quot;).focus()","Filter prüfen","warning")+'</div>';
    document.getElementById("dashboard").setAttribute("aria-busy","false");return;
  }
  const desktopRows=data.candidates.map(candidate=>{
    const open=state.candidate===candidate.key;
    const detail=open?recurringDetailMarkup(candidate,currentRecurringDetail,"desktop"):"";
    return '<tr class="recurring-row" data-open="'+String(open)+'"><td><button class="recurring-open" type="button" aria-expanded="'+String(open)+'" onclick="toggleRecurringCandidate(&quot;'+esc(candidate.key)+'&quot;)"><strong>'+esc(candidate.label)+'</strong><span class="recurring-mobile-meta">'+esc(candidate.statusLabel)+'</span></button></td><td>'+esc(candidate.rhythm.label)+'<div class="recurring-mobile-meta">Sicherheit '+esc(candidate.rhythm.confidence)+'</div></td><td>'+money(candidate.amount.typicalMinor)+'</td><td>'+money(candidate.amount.lastMinor)+'</td><td><span class="recurring-status"><strong>'+esc(candidate.classification.label)+'</strong><span>'+esc(candidate.classification.confidence==='nutzerbestaetigt'?'Nutzerbestätigt':'Noch unbestätigt')+'</span></span></td><td aria-hidden="true">'+icons.chevron+'</td></tr><tr class="recurring-detail-row"'+(open?'':' hidden')+'><td colspan="6">'+detail+'</td></tr>';
  }).join("");
  const mobileRows=data.candidates.map(candidate=>{
    const open=state.candidate===candidate.key;
    return '<button class="recurring-mobile-row" type="button" aria-expanded="'+String(open)+'" onclick="toggleRecurringCandidate(&quot;'+esc(candidate.key)+'&quot;)"><span class="recurring-mobile-main"><strong>'+esc(candidate.label)+'</strong><strong>'+money(candidate.amount.typicalMinor)+'</strong><span class="recurring-mobile-meta">'+esc(candidate.rhythm.label)+' · '+esc(candidate.classification.label)+' · '+esc(candidate.statusLabel)+'</span></span></button><div class="recurring-mobile-detail">'+(open?recurringDetailMarkup(candidate,currentRecurringDetail,"mobile"):'')+'</div>';
  }).join("");
  const panel='<section class="analysis-panel recurring-panel" aria-labelledby="recurring-list-title"><div class="analysis-panel-head"><div><h2 id="recurring-list-title">Regelmäßige Ausgaben prüfen</h2><p>'+data.summary.visible+' sichtbare Treffer · keine Summenbildung vor Bestätigung</p></div></div><table class="recurring-table"><thead><tr><th scope="col">Zahlung / Gruppe</th><th scope="col">Rhythmus</th><th scope="col">Typisch</th><th scope="col">Zuletzt</th><th scope="col">Einordnung</th><th scope="col"><span class="sr-only">Details</span></th></tr></thead><tbody>'+desktopRows+'</tbody></table><div class="recurring-mobile-list">'+mobileRows+'</div></section>';
  document.getElementById("dashboard").innerHTML=toolbar+summary+freshness+panel+warnings;
  document.getElementById("dashboard").setAttribute("aria-busy","false");
  if(state.candidate&&(!currentRecurringDetail||currentRecurringDetail.candidate?.key!==state.candidate))loadRecurringDetail(state.candidate);
}

function optimizationStatusOptions(current){
  return selectedOption("PRUEFEN",current,"Prüfen")
    +selectedOption("GEPLANT",current,"Kündigung / Änderung geplant")
    +selectedOption("GEKUENDIGT",current,"Gekündigt / umgesetzt")
    +selectedOption("BEIBEHALTEN",current,"Bewusst beibehalten");
}
function optimizationPriorityOptions(current){
  return '<option value=""'+(!current?' selected':'')+'>Nicht gesetzt</option>'
    +selectedOption("HOCH",current,"Hoch")
    +selectedOption("MITTEL",current,"Mittel")
    +selectedOption("NIEDRIG",current,"Niedrig");
}
async function saveRecurringOptimization(key){
  const item=currentOptimizationData?.items?.find(row=>row.key===key);
  if(!item){msg("Der Eintrag ist nicht mehr aktuell.",true);return}
  const status=document.getElementById("optimization-status-"+key)?.value||"PRUEFEN";
  const effectiveDate=document.getElementById("optimization-date-"+key)?.value||null;
  const savingsText=(document.getElementById("optimization-savings-"+key)?.value||"").trim().replace(",",".");
  const savingsNumber=savingsText===""?null:Number(savingsText);
  if(savingsNumber!==null&&(!Number.isFinite(savingsNumber)||savingsNumber<0)){
    msg("Bitte eine gültige jährliche Entlastung eingeben.",true);return
  }
  const priority=document.getElementById("optimization-priority-"+key)?.value||null;
  const button=document.getElementById("optimization-save-"+key);
  try{
    button.disabled=true;msg("Maßnahme wird gespeichert …");
    const data=await call("/api/decisions/recurring-expenses/"+encoded(key)+"/optimization",{
      method:"PUT",
      body:JSON.stringify({
        status,
        effectiveDate,
        expectedAnnualSavingsMinor:savingsNumber===null?null:Math.round(savingsNumber*100),
        priority,
        expectedEvidenceHash:item.evidenceHash
      })
    });
    renderRecurringOptimizations(data);msg("Maßnahme gespeichert.");
  }catch(error){msg(error.message,true);if(button)button.disabled=false}
}
function renderRecurringOptimizations(data){
  currentOptimizationData=data;
  const toolbar='<section class="analysis-toolbar optimization-toolbar" aria-label="Optimierungsliste"><label>Ansicht<select name="analysis-view" autocomplete="off" onchange="setAnalysisView(this.value)"><option value="expense-structure">Ausgabenstruktur</option><option value="recurring-expenses">Regelmäßige Ausgaben prüfen</option><option value="expense-optimizations" selected>Optimierungsliste</option><option value="decision-lab">Entscheidungslabor</option><option value="crypto-origin-tax">Krypto · Herkunft &amp; Steuerstatus</option></select></label></section>';
  const savings=data.summary.expectedAnnualSavingsMinor===null?'Noch offen':money(data.summary.expectedAnnualSavingsMinor)+' <small>[SCHÄTZUNG]</small>';
  const summary='<section class="recurring-summary optimization-summary" aria-label="Optimierungsstand"><div><span>Prüfbare Ausgaben</span><strong>'+data.summary.candidates+'</strong></div><div><span>Entschiedene Maßnahmen</span><strong>'+data.summary.actioned+'</strong></div><div><span>Erwartete jährliche Entlastung</span><strong>'+savings+'</strong></div></section>';
  const freshness='<div class="recurring-freshness"><span>Quelle: '+esc(data.source)+'</span><span>Beobachtet bis: '+esc(formatDate(data.freshness.windowEnd))+'</span><span>Stand: '+esc(formatDate(data.generatedAt,true))+'</span></div>';
  const warnings=data.warnings.map(warning=>'<div class="analysis-warning" role="status">'+icons.warning+'<span>'+esc(warning)+'</span></div>').join("");
  if(!data.items.length){
    document.getElementById("dashboard").innerHTML=toolbar+summary+freshness+'<div style="margin-top:12px">'+expenseState("Keine prüfbaren Ausgaben","Bestätige zuerst gestaltbare, vermeidbare oder unklare regelmäßige Ausgaben.","setAnalysisView(&quot;recurring-expenses&quot;)","Ausgaben prüfen","warning")+'</div>'+warnings;
    document.getElementById("dashboard").setAttribute("aria-busy","false");return;
  }
  const cards=data.items.map(item=>{
    const saved=item.optimization&&!item.optimization.stale?item.optimization:null;
    const status=saved?.status||"PRUEFEN";
    const date=saved?.effectiveDate||"";
    const savingsValue=saved?.expectedAnnualSavingsMinor===null||saved?.expectedAnnualSavingsMinor===undefined?"":(saved.expectedAnnualSavingsMinor/100).toFixed(2);
    const stale=item.optimization?.stale?'<p class="optimization-stale" role="status">Die Beleglage hat sich geändert. Bitte Maßnahme erneut bestätigen.</p>':'';
    return '<article class="optimization-card"><div class="optimization-title"><strong>'+esc(item.label)+'</strong><span>'+esc(item.classification.label)+' · '+esc(item.rhythm.label)+'</span><span>Jahreskosten '+money(item.estimatedAnnualCostMinor)+' <small>[SCHÄTZUNG]</small></span><small>'+(saved?'Zuletzt gespeichert '+esc(formatDate(saved.updatedAt,true)):'Noch keine Maßnahme gespeichert')+'</small></div><label>Status<select id="optimization-status-'+esc(item.key)+'" autocomplete="off">'+optimizationStatusOptions(status)+'</select></label><label>Wirksam ab / Enddatum<input id="optimization-date-'+esc(item.key)+'" type="date" value="'+esc(date)+'"></label><label>Jährliche Entlastung in € <span>[SCHÄTZUNG]</span><input id="optimization-savings-'+esc(item.key)+'" type="number" inputmode="decimal" min="0" step="0.01" value="'+esc(savingsValue)+'" placeholder="Noch offen"></label><label>Priorität<select id="optimization-priority-'+esc(item.key)+'" autocomplete="off">'+optimizationPriorityOptions(saved?.priority||"")+'</select></label><button class="button" id="optimization-save-'+esc(item.key)+'" type="button" onclick="saveRecurringOptimization(&quot;'+esc(item.key)+'&quot;)">Maßnahme speichern</button>'+stale+'</article>';
  }).join("");
  const panel='<section class="optimization-list" aria-label="Prüfbare Optimierungsmaßnahmen">'+cards+'</section>';
  document.getElementById("dashboard").innerHTML=toolbar+summary+freshness+panel+warnings;
  document.getElementById("dashboard").setAttribute("aria-busy","false");
}
function renderOptimizationError(error){
  currentOptimizationData=null;
  document.getElementById("dashboard").innerHTML=expenseState("Nicht verfügbar","Die Optimierungsliste konnte nicht geladen werden. Bitte versuche es erneut.","refresh(true)","Erneut versuchen");
  document.getElementById("dashboard").setAttribute("aria-busy","false");
  msg(error?.message||"Die Optimierungsliste konnte nicht geladen werden.",true);
}

function signedMoneyWhole(value){return new Intl.NumberFormat("de-DE",{style:"currency",currency:"EUR",maximumFractionDigits:0,signDisplay:"always"}).format(Number(value||0)/100)}
function decisionDuration(months){if(months===null)return "Nicht aufgebraucht";if(months===0)return "Sofort";const years=Math.floor(months/12);const rest=months%12;return (years?years+" "+(years===1?"Jahr":"Jahre")+(rest?" und ":""):"")+(rest?rest+" "+(rest===1?"Monat":"Monate"):"")}
function decisionPath(series,key,maxValue){return series.map((point,index)=>{const x=58+point.year/20*704;const y=24+(1-Math.max(0,point[key])/maxValue)*218;return (index?"L":"M")+x.toFixed(1)+" "+y.toFixed(1)}).join(" ")}
function decisionChart(data){
  const maxValue=Math.max(1,...data.series.flatMap(point=>[point.baselineMinor,point.scenarioMinor]));
  const baselinePath=decisionPath(data.series,"baselineMinor",maxValue);
  const scenarioPath=decisionPath(data.series,"scenarioMinor",maxValue);
  const top=moneyWhole(maxValue);const middle=moneyWhole(Math.round(maxValue/2));
  const label="20-Jahres-Projektion [SCHÄTZUNG]. Aktueller Trend nach 20 Jahren "+moneyWhole(data.series.at(-1).baselineMinor)+", Szenario "+moneyWhole(data.series.at(-1).scenarioMinor)+".";
  return '<figure class="decision-chart"><div class="decision-legend" aria-hidden="true"><span><i class="baseline"></i>Aktueller Trend</span><span><i class="scenario"></i>Szenario</span></div><svg viewBox="0 0 800 286" role="img" aria-label="'+esc(label)+'"><g class="decision-grid"><path d="M58 24H762M58 133H762M58 242H762"/><path d="M58 24V242M234 24V242M410 24V242M586 24V242M762 24V242"/></g><g class="decision-axis"><text x="50" y="28" text-anchor="end">'+esc(top)+'</text><text x="50" y="137" text-anchor="end">'+esc(middle)+'</text><text x="50" y="246" text-anchor="end">0 €</text><text x="58" y="270" text-anchor="middle">Heute</text><text x="234" y="270" text-anchor="middle">5 J.</text><text x="410" y="270" text-anchor="middle">10 J.</text><text x="586" y="270" text-anchor="middle">15 J.</text><text x="762" y="270" text-anchor="middle">20 J.</text></g><path class="decision-line baseline" d="'+baselinePath+'"/><path class="decision-line scenario" d="'+scenarioPath+'"/></svg><figcaption>'+esc(label)+'</figcaption></figure>';
}
function fireExit(age){return age===null?'Nicht vor 67':'Mit '+age}
function rememberFireGroup(element,key){
  const params=new URLSearchParams(location.search);
  const groups=new Set((params.get("fireOpenGroups")||"").split(",").filter(value=>["recurring","variable","one-time"].includes(value)));
  if(element.open)groups.add(key);else groups.delete(key);
  if(groups.size)params.set("fireOpenGroups",[...groups].join(","));else params.delete("fireOpenGroups");
  const query=params.toString();history.replaceState(null,"",(query?"?"+query:location.pathname)+location.hash);
}
function toggleFireCategoryDetail(key){
  const params=new URLSearchParams(location.search);
  if(params.get("fireCategory")===key){params.delete("fireCategory");params.delete("fireCategoryPeriod");}
  else{
    params.set("fireCategory",key);params.delete("fireCategoryPeriod");
    const groups=new Set((params.get("fireOpenGroups")||"").split(",").filter(Boolean));groups.add("variable");
    params.set("fireOpenGroups",[...groups].join(","));
  }
  const query=params.toString();history.replaceState(null,"",(query?"?"+query:location.pathname)+location.hash);
  if(currentDecisionLabData)renderDecisionLab(currentDecisionLabData);
}
function setFireCategoryDetailPeriod(value){
  const params=new URLSearchParams(location.search);
  if(value==="previous")params.set("fireCategoryPeriod","previous");else params.delete("fireCategoryPeriod");
  const query=params.toString();history.replaceState(null,"",(query?"?"+query:location.pathname)+location.hash);
  if(currentDecisionLabData)renderDecisionLab(currentDecisionLabData);
}
function fireBookingRows(rows){
  return rows.map(row=>'<div class="fire-booking-row"><time datetime="'+esc(row.date)+'">'+esc(formatDate(row.date))+'</time><span>'+esc(row.merchant)+(row.estimate?' '+analysisEstimate(true):'')+'</span><strong>'+money(row.amountMinor)+'</strong></div>').join('');
}
function renderFireTracking(fire){
  const state=analysisSelection();
  const gap=fire.central.annualGapToTargetMinor;
  const current=fire.central.currentExitAge;
  const scenario=fire.central.scenarioExitAge;
  const years=fire.central.yearsGained;
  const targetOptions=Array.from({length:18},(_,index)=>{const age=50+index;return '<option value="'+age+'" '+(age===fire.targetAge?'selected ':'')+'>'+age+' Jahre</option>'}).join('');
  const bandRows=fire.returnBand.map(row=>'<tr><td>'+(row.realReturnBps/100).toLocaleString('de-DE')+' % real</td><td>'+esc(fireExit(row.currentExitAge))+'</td><td>'+esc(fireExit(row.scenarioExitAge))+'</td></tr>').join('');
  const actionRows=fire.actions.map(action=>{
    const checked=fire.selectedActionKeys.includes(action.key);
    const disabled=!action.selectable;
    const coverage=gap&&action.expectedAnnualSavingsMinor!==null?Math.min(100,Math.round(action.expectedAnnualSavingsMinor/gap*100)):null;
    const impact=action.yearsGained&&action.yearsGained>0?action.yearsGained+' '+(action.yearsGained===1?'Jahr':'Jahre')+' früher':coverage!==null?coverage+' % der aktuellen Ziel-Lücke':'Mögliche Entlastung erst nach Prüfung';
    const effect=checked&&action.expectedAnnualSavingsMinor!==null?money(action.expectedAnnualSavingsMinor)+' / Jahr':action.expectedAnnualSavingsMinor!==null?money(action.expectedAnnualSavingsMinor)+' möglich':'Noch offen';
    return '<label class="fire-row fire-action-'+esc(action.leverQuality)+'"><input type="checkbox" name="fire-action" value="'+esc(action.key)+'" '+(checked?'checked ':'')+(disabled?'disabled ':'')+'><span class="fire-row-main"><strong>'+esc(action.label)+'</strong><small>'+esc(action.leverLabel)+' · '+esc(action.classificationLabel)+'</small></span><span class="fire-row-metric fire-row-cost"><small>Jahreskosten</small><strong>'+money(action.estimatedAnnualCostMinor)+' '+analysisEstimate(true)+'</strong></span><span class="fire-row-metric fire-row-choice"><small>Maßnahme</small><strong>'+esc(action.statusLabel)+'</strong></span><span class="fire-row-metric fire-row-effect"><small>Angesetzte Wirkung</small><strong>'+effect+'</strong><small>'+esc(impact)+' '+analysisEstimate(true)+'</small></span></label>';
  }).join('');
  const noActions='<div class="fire-empty">Noch keine bestätigten Optimierungsmaßnahmen verfügbar.</div>';
  const variableRows=fire.variableCategories.map(category=>{
    const options=[0,10,25,50].map(value=>'<option value="'+value+'" '+(value===category.selectedReductionPercent?'selected ':'')+'>'+(value===0?'Keine Reduktion':value+' % reduzieren')+'</option>').join('');
    const saving=category.annualSavingsMinor>0?money(category.annualSavingsMinor)+' / Jahr':'Nicht angesetzt';
    const impact=category.yearsGained&&category.yearsGained>0?category.yearsGained+' '+(category.yearsGained===1?'Jahr':'Jahre')+' früher':'Wirkung nach Auswahl';
    const excluded=category.recurringSavingsExcludedMinor>0?' · bereits laufend angesetzt '+money(category.recurringSavingsExcludedMinor):'';
    const open=state.fireCategory===category.key;
    const previous=state.fireCategoryPeriod==="previous";
    const transactions=previous?category.previousTransactions:category.currentTransactions;
    const periodLabel=previous?category.previousPeriodLabel:category.currentPeriodLabel;
    const visible=transactions.slice(0,10);const remaining=transactions.slice(10);
    const detail=open?'<div class="fire-category-detail"><div class="fire-category-detail-head"><div><h5>Buchungen · '+esc(category.label)+'</h5><p>'+transactions.length+' Buchungen · '+money(transactions.reduce((sum,row)=>sum+row.amountMinor,0))+' · größte zuerst</p></div><div class="fire-period-switch" aria-label="Zeitraum für Kategorie"><button type="button" aria-pressed="'+String(!previous)+'" onclick="setFireCategoryDetailPeriod(&quot;current&quot;)">'+esc(category.currentPeriodLabel)+'</button><button type="button" aria-pressed="'+String(previous)+'" onclick="setFireCategoryDetailPeriod(&quot;previous&quot;)">'+esc(category.previousPeriodLabel)+'</button></div></div><div class="fire-booking-list" aria-label="Buchungen '+esc(periodLabel)+'">'+(visible.length?fireBookingRows(visible):'<div class="fire-empty">In diesem Zeitraum liegen keine Buchungen vor.</div>')+(remaining.length?'<details class="fire-booking-more"><summary>Weitere '+remaining.length+' Buchungen anzeigen</summary>'+fireBookingRows(remaining)+'</details>':'')+'</div></div>':'';
    return '<div class="fire-row"><button class="fire-row-drill" type="button" aria-label="Buchungen für '+esc(category.label)+' anzeigen" aria-expanded="'+String(open)+'" onclick="toggleFireCategoryDetail(&quot;'+esc(category.key)+'&quot;)">'+icons.chevron+'</button><span class="fire-row-main"><strong>'+esc(category.label)+'</strong><small>'+esc(category.currentPeriodLabel)+' '+money(category.currentPeriodMinor)+' · '+esc(category.previousPeriodLabel)+' '+money(category.previousYearMinor)+'</small></span><span class="fire-row-metric fire-row-cost"><small>Geglättete Jahresbasis</small><strong>'+money(category.planningAnnualMinor)+' '+analysisEstimate(true)+'</strong><small>'+excluded.replace(/^ · /,'')+'</small></span><span class="fire-row-metric fire-row-choice"><small>Maßnahme</small><select name="fire-category-cut" data-key="'+esc(category.key)+'" aria-label="Reduktion für '+esc(category.label)+'">'+options+'</select></span><span class="fire-row-metric fire-row-effect"><small>Angesetzte Wirkung</small><strong>'+saving+'</strong><small>'+esc(impact)+' '+analysisEstimate(true)+'</small></span>'+detail+'</div>';
  }).join('');
  const oneTimeRows=fire.oneTimeCandidates.map(item=>{
    const impact=item.yearsGained&&item.yearsGained>0?item.yearsGained+' '+(item.yearsGained===1?'Jahr':'Jahre')+' früher':'Einmalige Kapitalwirkung';
    const counted=item.selected?money(item.countedOneTimeMinor):'Nicht angesetzt';
    return '<label class="fire-row"><input type="checkbox" name="fire-one-time" value="'+esc(item.key)+'" '+(item.selected?'checked ':'')+'><span class="fire-row-main"><strong>'+esc(item.label)+'</strong><small>'+esc(item.category)+' · '+analysisMonthLabel(item.month)+'</small></span><span class="fire-row-metric fire-row-cost"><small>Beobachteter Betrag</small><strong>'+money(item.observedMinor)+' '+analysisEstimate(true)+'</strong></span><span class="fire-row-metric fire-row-choice"><small>Maßnahme</small><strong>'+(item.selected?'Einmalig vermeiden':'Nicht ausgewählt')+'</strong></span><span class="fire-row-metric fire-row-effect"><small>Angesetzte Wirkung</small><strong>'+counted+'</strong><small>'+esc(impact)+' '+analysisEstimate(true)+'</small></span></label>';
  }).join('');
  const recurringCosts=fire.actions.reduce((sum,item)=>sum+item.estimatedAnnualCostMinor,0);
  const variableCosts=fire.variableCategories.reduce((sum,item)=>sum+item.planningAnnualMinor,0);
  const oneTimeCosts=fire.oneTimeCandidates.reduce((sum,item)=>sum+item.observedMinor,0);
  const group=(key,title,description,count,costLabel,cost,effectLabel,effect,rows,empty)=>'<details class="fire-lever-group" '+((state.fireOpenGroups.includes(key)||(key==="variable"&&state.fireCategory))?'open ':'')+'ontoggle="rememberFireGroup(this,&quot;'+key+'&quot;)"><summary class="fire-lever-summary"><span class="fire-lever-summary-main"><strong>'+esc(title)+'</strong><small>'+count+' '+(count===1?'Eintrag':'Einträge')+' · '+esc(description)+'</small></span><span class="fire-lever-summary-metric"><span>'+esc(costLabel)+'</span><strong>'+moneyWhole(cost)+'</strong></span><span class="fire-lever-summary-metric"><span>'+esc(effectLabel)+'</span><strong>'+moneyWhole(effect)+'</strong></span>'+icons.chevron+'</summary><div class="fire-action-list">'+(rows||empty)+'</div></details>';
  const recurringGroup=group('recurring','Laufende Verträge und Abos','gespeicherte Maßnahmen',fire.actions.length,'Jahreskosten',recurringCosts,'Angesetzt / Jahr',fire.selectedRecurringAnnualSavingsMinor,actionRows,noActions);
  const variableGroup=group('variable','Variable Ausgabenkategorien','Teilreduktion und Buchungsdetails',fire.variableCategories.length,'Planungsbasis / Jahr',variableCosts,'Angesetzt / Jahr',fire.selectedVariableAnnualSavingsMinor,variableRows,'<div class="fire-empty">Keine dispositiven Kategorien im aktuellen Zeitraum verfügbar.</div>');
  const oneTimeGroup=group('one-time','Historische Einzelposten','Vergangene Ausgaben werden nicht rückwirkend gespart',fire.oneTimeCandidates.length,'Beobachtete Beträge',oneTimeCosts,'Einmalig angesetzt',fire.selectedOneTimeSavingsMinor,oneTimeRows,'<div class="fire-empty">Keine geeigneten Einzelposten verfügbar.</div>');
  const basis=fire.basis.map(item=>'<li>'+esc(item)+'</li>').join('');
  const warnings=fire.warnings.map(warning=>'<div class="analysis-warning" role="status">'+icons.warning+'<span>'+esc(warning)+'</span></div>').join('');
  return '<section class="analysis-panel fire-cockpit" aria-labelledby="fire-title"><div class="analysis-panel-head"><div><h2 id="fire-title">FIRE-Kurs und konkrete Stellschrauben</h2><p>Welche Ausgabenänderung das früheste tragfähige Ausstiegsalter tatsächlich verändert.</p></div><span class="fire-model">'+esc(fire.modelVersion)+' · '+analysisEstimate(true)+'</span></div><div class="fire-course"><div><span>Aktueller Kurs</span><strong class="'+(current!==null&&current<=fire.targetAge?'tone-ok':'tone-warning')+'">'+esc(fireExit(current))+'</strong><small>Bei 3 % Realrendite, ohne Erbschaft</small></div><div><span>Zielalter</span><strong>'+fire.targetAge+'</strong><small>Aktuell gewähltes Arbeitsziel</small></div><div><span>Lücke zum Ziel</span><strong class="'+(gap===0?'tone-ok':'tone-warning')+'">'+(gap===null?'–':moneyWhole(gap)+' / Jahr')+'</strong><small>'+(fire.central.monthlyGapToTargetMinor===null?'Nicht verfügbar':moneyWhole(fire.central.monthlyGapToTargetMinor)+' pro Monat')+' '+analysisEstimate(true)+'</small></div><div><span>Mit ausgewählten Hebeln</span><strong class="'+(scenario!==null&&scenario<=fire.targetAge?'tone-ok':'tone-warning')+'">'+esc(fireExit(scenario))+'</strong><small>'+moneyWhole(fire.selectedAnnualSavingsMinor)+' jährlich · '+moneyWhole(fire.selectedOneTimeSavingsMinor)+' einmalig · '+(years===null?'Wirkung offen':years+' Jahre gewonnen')+'</small></div></div><div class="fire-capital"><div><span>Überbrückungskapital heute</span><strong>'+(fire.bridgeCapitalMinor===null?'–':moneyWhole(fire.bridgeCapitalMinor))+'</strong><small>Liquidität, Depots, Krypto und Gold</small></div><div><span>Gebundene Vorsorge</span><strong>'+(fire.lockedPensionMinor===null?'–':moneyWhole(fire.lockedPensionMinor))+'</strong><small>Separat zu den vorgesehenen Leistungszeitpunkten</small></div><div><span>Aktuelle Ausgaben-Hochrechnung</span><strong>'+(fire.liveProjectedAnnualExpensesMinor===null?'–':moneyWhole(fire.liveProjectedAnnualExpensesMinor))+'</strong><small>Normalisiert '+(fire.normalizedAnnualExpensesMinor===null?'–':moneyWhole(fire.normalizedAnnualExpensesMinor))+' '+analysisEstimate(true)+'</small></div><div><span>Tragbar beim Zielalter</span><strong>'+(fire.central.maximumExpensesAtTargetMinor===null?'–':moneyWhole(fire.central.maximumExpensesAtTargetMinor))+'</strong><small>Bei 3 % real '+analysisEstimate(true)+'</small></div></div><div class="fire-workspace"><form class="fire-controls" onsubmit="applyFireScenario(event)"><label for="fire-target-age">Gewünschtes Zielalter<select id="fire-target-age" autocomplete="off">'+targetOptions+'</select></label><div class="fire-band"><table><thead><tr><th scope="col">Renditeband</th><th scope="col">Aktuell</th><th scope="col">Mit Hebeln</th></tr></thead><tbody>'+bandRows+'</tbody></table></div><button class="button" type="submit">FIRE-Szenario aktualisieren</button></form><div class="fire-levers"><div class="fire-levers-head"><div><h3>Reale Ausgabenhebel</h3><p>Grundbedarf bleibt ausgeschlossen. Variable Kategorien und Einzelposten werden erst nach deiner Auswahl angesetzt.</p></div><strong>'+moneyWhole(fire.selectedAnnualSavingsMinor)+' / Jahr</strong></div><div class="fire-lever-groups">'+recurringGroup+variableGroup+oneTimeGroup+'</div></div></div><details class="fire-basis"><summary>Modellannahmen und Grenzen</summary><ul>'+basis+'</ul></details>'+warnings+'</section>';
}
function renderDecisionLab(data){
  currentDecisionLabData=data;
  const toolbar='<section class="analysis-toolbar decision-toolbar" aria-label="Entscheidungslabor"><label>Ansicht<select name="analysis-view" autocomplete="off" onchange="setAnalysisView(this.value)"><option value="expense-structure">Ausgabenstruktur</option><option value="recurring-expenses">Regelmäßige Ausgaben prüfen</option><option value="expense-optimizations">Optimierungsliste</option><option value="decision-lab" selected>Entscheidungslabor</option><option value="crypto-origin-tax">Krypto · Herkunft &amp; Steuerstatus</option></select></label></section>';
  const trend=data.basis.selectedTrend;
  const period=trend.periodStart&&trend.periodEnd
    ? trend.periodStart===trend.periodEnd?analysisMonthLabel(trend.periodEnd):analysisMonthLabel(trend.periodStart)+'–'+analysisMonthLabel(trend.periodEnd)
    : 'nicht verfügbar';
  const monthlyLabel=trend.monthlyMetric==='median'?'Typischer Monat · Median-Saldo':'Monatsdurchschnitt';
  const summary='<section class="analysis-summary decision-summary" aria-label="Ausgangslage für die Projektion"><div><span>Finanzvermögen heute</span><strong class="analysis-total">'+(data.basis.startingAssetsMinor===null?'–':moneyWhole(data.basis.startingAssetsMinor))+'</strong><p class="analysis-basis">Ohne Immobilien · '+esc(data.scope.includes.join(", "))+' '+analysisEstimate(true)+'</p></div><div><span>Bilanz · '+esc(period)+'</span><strong class="'+(trend.netMinor<0?'tone-warning':'tone-ok')+'">'+(trend.netMinor===null?'–':signedMoneyWhole(trend.netMinor))+'</strong><p class="analysis-basis">Einnahmen '+(trend.incomeMinor===null?'–':moneyWhole(trend.incomeMinor))+' · Ausgaben '+(trend.expensesMinor===null?'–':moneyWhole(trend.expensesMinor))+'</p></div><div><span>'+esc(monthlyLabel)+'</span><strong class="'+(trend.averageMonthlyNetMinor<0?'tone-warning':'tone-ok')+'">'+(trend.averageMonthlyNetMinor===null?'–':signedMoneyWhole(trend.averageMonthlyNetMinor))+'</strong><p class="analysis-basis">Einnahmen '+(trend.monthlyIncomeMinor===null?'–':moneyWhole(trend.monthlyIncomeMinor))+' · Ausgaben '+(trend.monthlyExpensesMinor===null?'–':moneyWhole(trend.monthlyExpensesMinor))+'</p></div><div><span>Projektionsbasis</span><strong class="'+(trend.annualizedNetMinor<0?'tone-warning':'tone-ok')+'">'+(trend.annualizedNetMinor===null?'–':signedMoneyWhole(trend.annualizedNetMinor))+' / Jahr</strong><p class="analysis-basis">Aus '+esc(monthlyLabel.toLowerCase())+' '+analysisEstimate(true)+'</p></div></section>';
  const annual=data.basis.annualOutlook;
  const fire=renderFireTracking(data.fire);
  const annualRow=(label,values,highlight,estimate)=>'<tr class="'+(highlight?'projected':'')+'"><td>'+esc(label)+(estimate?' '+analysisEstimate(true):'')+'</td><td data-label="Einnahmen">'+(values.incomeMinor===null?'–':moneyWhole(values.incomeMinor))+'</td><td data-label="Ausgaben">'+(values.expensesMinor===null?'–':moneyWhole(values.expensesMinor))+'</td><td data-label="Saldo" class="'+(values.netMinor<0?'tone-warning':'tone-ok')+'">'+(values.netMinor===null?'–':signedMoneyWhole(values.netMinor))+'</td></tr>';
  const annualMonths=annual.year===null?'':Array.from({length:12},(_,index)=>'<span class="'+(index<annual.completedMonths?'complete':'')+'" aria-hidden="true">'+(index+1)+'</span>').join('');
  const annualVariance=annual.varianceToExpected.netMinor;
  const annualVarianceText=annualVariance===null?'Nicht verfügbar':annualVariance===0?'Genau auf dem Medianpfad':signedMoneyWhole(Math.abs(annualVariance))+' '+(annualVariance>0?'über':'unter')+' dem Medianpfad';
  const annualPanel=annual.available?'<section class="analysis-panel decision-annual" aria-labelledby="decision-annual-title"><div class="analysis-panel-head"><div><h2 id="decision-annual-title">Jahresausblick '+esc(annual.year)+'</h2><p>'+esc(annual.completedMonths)+' abgeschlossene Monate bis '+analysisMonthLabel(annual.throughMonth)+' · laufender Monat nicht eingerechnet.</p></div></div><div class="decision-annual-progress" aria-label="'+esc(annual.completedMonths)+' von 12 Monaten abgeschlossen">'+annualMonths+'</div><div class="decision-context-grid" style="margin-top:14px"><table class="decision-context-table decision-annual-table"><thead><tr><th scope="col">Jahressicht</th><th scope="col">Einnahmen</th><th scope="col">Ausgaben</th><th scope="col">Saldo</th></tr></thead><tbody>'+annualRow('Ist bis '+analysisMonthLabel(annual.throughMonth),annual.actualToDate,false,false)+annualRow('Median-Pfad bis '+analysisMonthLabel(annual.throughMonth),annual.expectedToDate,false,true)+annualRow('Hochrechnung Jahresende',annual.projectedYearEnd,true,true)+annualRow('Median × 12 · Referenz',annual.medianFullYear,false,true)+'</tbody></table></div><div class="decision-annual-variance"><span>Ist-Saldo gegenüber erwartetem Pfad</span><strong class="'+(annualVariance<0?'tone-warning':'tone-ok')+'">'+esc(annualVarianceText)+'</strong></div><p class="decision-breakdown-note">Die Jahresend-Hochrechnung verbindet den echten Stand der abgeschlossenen Monate mit dem typischen Median-Monat für die verbleibenden '+esc(annual.remainingMonths)+' Monate. Der laufende Monat bleibt bis zum Abschluss separat.</p></section>':'';
  if(data.series.length===0){
    const warnings=data.warnings.map(warning=>'<div class="analysis-warning" role="status">'+icons.warning+'<span>'+esc(warning)+'</span></div>').join("");
    document.getElementById("dashboard").innerHTML=toolbar+summary+fire+annualPanel+'<div style="margin-top:12px">'+expenseState("Projektion nicht verfügbar","Für eine Trajektorie werden ein vollständiger Vermögensstand und eine vollständige Sparratenbasis benötigt.","refresh(true)","Neu prüfen","warning")+'</div>'+warnings;
    document.getElementById("dashboard").setAttribute("aria-busy","false");return;
  }
  const trendOptions=data.basis.trendOptions.map(option=>'<option value="'+esc(option.key)+'" '+(option.key===data.inputs.trendBasis?'selected ':'')+(!option.available?'disabled ':'')+'>'+esc(option.label)+'</option>').join("");
  const assumptions='<section class="analysis-panel decision-assumptions" aria-labelledby="decision-assumptions-title"><div class="analysis-panel-head"><div><h2 id="decision-assumptions-title">Basis und Annahmen</h2><p>Historische Entwicklung auswählen und als Szenario verändern.</p></div></div><form onsubmit="applyDecisionLab(event)"><label for="decision-basis">Ausgangsbasis<select id="decision-basis" name="decision-basis" autocomplete="off" onchange="applyDecisionLab(event)">'+trendOptions+'</select><small>'+esc(trend.description)+' · '+(trend.months===1?'1 vollständiger Monat':trend.months+' vollständige Monate')+'.</small></label><label for="decision-return">Realrendite pro Jahr (%)<input id="decision-return" name="decision-return" type="number" inputmode="decimal" autocomplete="off" min="-5" max="10" step="0.1" value="'+esc(data.inputs.realReturnBps/100)+'"><small>Nach Inflation; konservativer Startwert 2 %.</small></label><label for="decision-monthly">Monatliche Veränderung (€)<input id="decision-monthly" name="decision-monthly" type="number" inputmode="decimal" autocomplete="off" min="-10000" max="10000" step="10" value="'+esc(data.inputs.monthlyChangeMinor/100)+'"><small>Positiv spart mehr; negativ erhöht laufende Ausgaben.</small></label><label for="decision-one-time">Einmaliger Zu- oder Abfluss (€)<input id="decision-one-time" name="decision-one-time" type="number" inputmode="decimal" autocomplete="off" min="-1000000" max="1000000" step="100" value="'+esc(data.inputs.oneTimeMinor/100)+'"><small>Negativ für eine Ausgabe, positiv für zusätzliches Vermögen.</small></label><button class="button" type="submit">Szenario berechnen</button></form></section>';
  const baselineEnd=data.series.at(-1).baselineMinor;const scenarioEnd=data.series.at(-1).scenarioMinor;
  const depletion=(data.depletion.baselineAfterMonths!==null||data.depletion.scenarioAfterMonths!==null)?'<div class="analysis-warning decision-depletion" role="status">'+icons.warning+'<span>Finanzvermögen aufgebraucht: Basis '+esc(decisionDuration(data.depletion.baselineAfterMonths))+' · Szenario '+esc(decisionDuration(data.depletion.scenarioAfterMonths))+'. Eine Verschuldung wird nicht unterstellt.</span></div>':'';
  const projection='<section class="analysis-panel decision-projection" aria-labelledby="decision-projection-title"><div class="analysis-panel-head"><div><h2 id="decision-projection-title">Finanzvermögen über 20 Jahre</h2><p>Aktueller Trend '+moneyWhole(baselineEnd)+' · Szenario '+moneyWhole(scenarioEnd)+' '+analysisEstimate(true)+'</p></div></div>'+decisionChart(data)+depletion+'</section>';
  const typical=data.basis.trendOptions.find(option=>option.key==='current-year');
  const last=data.basis.lastMonthComparison;const current=data.basis.currentMonthProgress;
  const contextRow=(label,income,expenses,net)=>'<tr><td>'+esc(label)+'</td><td data-label="Einnahmen">'+(income===null?'–':moneyWhole(income))+'</td><td data-label="Ausgaben">'+(expenses===null?'–':moneyWhole(expenses))+'</td><td data-label="Saldo" class="'+(net<0?'tone-warning':'tone-ok')+'">'+(net===null?'–':signedMoneyWhole(net))+'</td></tr>';
  const currentIncomeNote=current.excludedIncomeMinor>0?' Im aktuellen Monat sind '+moneyWhole(current.excludedIncomeMinor)+' noch nicht eindeutig zugeordnete Einnahmen nicht im Saldo enthalten.':'';
  const currentCardNote=current.pendingCardExpensesMinor>0?' Darin enthalten: '+money(current.pendingCardExpensesMinor)+' vorläufiger offener Stand '+esc(current.pendingCardLabel||'Kreditkarte')+' vom '+esc(formatDate(current.pendingCardCapturedAt))+'. Die Einzelkategorien folgen mit der Abrechnung.':'';
  const comparison='<section class="analysis-panel" aria-labelledby="decision-comparison-title"><div class="analysis-panel-head"><div><h2 id="decision-comparison-title">Monate einordnen</h2><p>Aktueller Stand und letzter vollständiger Monat gegenüber einem realen typischen Referenzmonat.</p></div></div><div class="decision-context-grid"><table class="decision-context-table"><thead><tr><th scope="col">Zeitraum</th><th scope="col">Einnahmen</th><th scope="col">Ausgaben</th><th scope="col">Saldo</th></tr></thead><tbody>'+contextRow('Typischer Monat · Median-Saldo',typical?.monthlyIncomeMinor??null,typical?.monthlyExpensesMinor??null,typical?.averageMonthlyNetMinor??null)+contextRow('Letzter vollständiger Monat · '+(last.month?analysisMonthLabel(last.month):'–'),last.incomeMinor,last.expensesMinor,last.netMinor)+contextRow('Aktueller Monat bis heute · '+(current.throughDate?formatDate(current.throughDate):'–'),current.incomeMinor,current.expensesMinor,current.netMinor)+'</tbody></table></div><p class="decision-breakdown-note">Der typische Monat ist ein tatsächlich beobachteter Monat nahe dem Median-Saldo, damit Einnahmen minus Ausgaben exakt dem gezeigten Saldo entsprechen. Letzter Monat gegenüber typisch: Einnahmen '+(last.incomeDifferenceMinor===null?'–':signedMoneyWhole(last.incomeDifferenceMinor))+' · Ausgaben '+(last.expensesDifferenceMinor===null?'–':signedMoneyWhole(last.expensesDifferenceMinor))+' · Saldo '+(last.netDifferenceMinor===null?'–':signedMoneyWhole(last.netDifferenceMinor))+'. Der aktuelle Monat ist unvollständig und fließt nicht in die Projektion ein.'+currentCardNote+currentIncomeNote+'</p></section>';
  const income=trend.incomeBreakdown;const wealth=trend.wealthBuilding;
  const breakdownRow=(label,value)=>'<div class="decision-breakdown-row"><span>'+esc(label)+'</span><strong>'+(value===null?'–':moneyWhole(value))+'</strong></div>';
  const breakdown='<section class="analysis-panel" aria-labelledby="decision-breakdown-title"><div class="analysis-panel-head"><div><h2 id="decision-breakdown-title">Was in die Monatsbasis einfließt</h2><p>Durchschnittliche beziehungsweise typische Monatswerte der gewählten Basis.</p></div></div><div class="decision-breakdown"><div><h3>Einnahmen</h3><div class="decision-breakdown-list">'+breakdownRow('Regelmäßige Arbeitseinkommen',income?.workRegularMinor??null)+breakdownRow('Variable Arbeits- und Haushaltseinnahmen',income?.workVariableMinor??null)+breakdownRow('Sonstige regelmäßige Einnahmen',income?.otherRegularMinor??null)+breakdownRow('Sonstige variable Einnahmen',income?.otherVariableMinor??null)+breakdownRow('Zweckgebundene Zuflüsse',income?.earmarkedFundingMinor??null)+breakdownRow('Kapitalerträge · ausgeschlossen',income?.investmentReturnsExcludedMinor??null)+'</div></div><div><h3>Vermögensbildung</h3><div class="decision-breakdown-list">'+breakdownRow('Gebuchte Depot- und Vorsorgezuflüsse',wealth?.bookedInvestingMinor??null)+breakdownRow('Weitere feste Anlagezuflüsse',wealth?.committedInvestingMinor??null)+breakdownRow('Davon zweckgebunden finanziert',wealth?.earmarkedFundingMinor??null)+breakdownRow('Davon eigener Haushaltsanteil',wealth?.householdContributionMinor??null)+breakdownRow('Mitarbeiteraktienvorteil',wealth?.employeeStockBenefitMinor??null)+'</div><p class="decision-breakdown-note">Depotkäufe sind Vermögensbildung und kein Konsum. Der Preisvorteil aus Mitarbeiteraktien ist derzeit nicht separat verfügbar; er wird nur erfasst, wenn er als eigener Arbeitgeberzufluss gebucht ist.</p></div></div></section>';
  const milestones=data.milestones.map(item=>'<article class="decision-milestone"><span>Nach '+item.year+' '+(item.year===1?'Jahr':'Jahren')+'</span><div><small>Trend</small><strong>'+moneyWhole(item.baselineMinor)+'</strong></div><div><small>Szenario</small><strong>'+moneyWhole(item.scenarioMinor)+'</strong></div><p class="'+(item.differenceMinor<0?'tone-warning':'tone-ok')+'">Differenz '+signedMoneyWhole(item.differenceMinor)+' '+analysisEstimate(true)+'</p></article>').join("");
  const basisNotes=data.basisNotes.map(note=>'<li>'+esc(note)+'</li>').join("");
  const notes='<section class="analysis-panel decision-details" aria-labelledby="decision-details-title"><div class="analysis-panel-head"><div><h2 id="decision-details-title">Meilensteine und Datenbasis</h2><p>Exakte Werte ergänzen die Trenddarstellung.</p></div></div><div class="decision-milestones">'+milestones+'</div><div class="decision-source"><p>Vermögensstand '+esc(formatDate(data.freshness.assetsGeneratedAt,true))+' · Zahlungsbasis '+esc(formatDate(data.freshness.cashflowGeneratedAt,true))+' · Quelle '+esc(data.source)+'</p><ul>'+basisNotes+'</ul></div></section>';
  const warnings=data.warnings.map(warning=>'<div class="analysis-warning" role="status">'+icons.warning+'<span>'+esc(warning)+'</span></div>').join("");
  document.getElementById("dashboard").innerHTML=toolbar+summary+fire+annualPanel+'<div class="decision-context">'+comparison+breakdown+'</div><div class="decision-layout">'+assumptions+projection+'</div>'+notes+warnings;
  document.getElementById("dashboard").setAttribute("aria-busy","false");
}
function renderDecisionLabError(error){
  currentDecisionLabData=null;
  document.getElementById("dashboard").innerHTML=expenseState("Nicht verfügbar","Das Entscheidungslabor konnte nicht geladen werden. Bitte versuche es erneut.","refresh(true)","Erneut versuchen");
  document.getElementById("dashboard").setAttribute("aria-busy","false");
  msg(error?.message||"Das Entscheidungslabor konnte nicht geladen werden.",true);
}

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
    <section class="status-overview" aria-label="Statusübersicht">\
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

function renderHeader(view){
  const content={
    overview:{title:"Übersicht",subtitle:"Finanzen, Vermögen und offene Punkte auf einen Blick."},
    spending:{title:"Ausgaben",subtitle:"Kategorien und zugehörige Buchungen nachvollziehen."},
    assets:{title:"Vermögen",subtitle:"Konten, Anlagen und Vorsorge mit nachvollziehbaren Stichtagen."},
    analyses:{title:"Analysen",subtitle:"Ausgaben verstehen und Veränderungen nachvollziehen."},
    status:{title:"Datenstatus",subtitle:"Aktualität, offene Aufgaben und Systemzustand auf einen Blick."}
  }[view];
  if(view==="analyses"&&analysisSelection().view==="crypto-origin-tax")content.subtitle="Krypto-Herkunft, Investmentbasis und Steuerstatus nachvollziehen.";
  if(view==="analyses"&&analysisSelection().view==="expense-optimizations")content.subtitle="Prüfbare Ausgaben in konkrete, nachvollziehbare Maßnahmen überführen.";
  if(view==="analyses"&&analysisSelection().view==="decision-lab")content.subtitle="Finanzielle Entscheidungen über 20 Jahre als nachvollziehbare Szenarien vergleichen.";
  document.title=content.title+" · Finance Hub";
  const eyebrow=document.getElementById("page-eyebrow");
  eyebrow.hidden=view!=="status";
  document.getElementById("page-title").textContent=content.title;
  document.getElementById("page-subtitle").textContent=content.subtitle;
  const action=document.getElementById("refresh-button");
  const analysisExport=view==="analyses"&&!['recurring-expenses','expense-optimizations','decision-lab'].includes(analysisSelection().view);
  action.setAttribute("aria-label",analysisExport?"Aktuelle Analyse als CSV exportieren":content.title+" aktualisieren");
  action.querySelector("[aria-hidden]").textContent=analysisExport?"↓":"↻";
  action.querySelector(".desktop-label").textContent=analysisExport?"CSV exportieren":"Aktualisieren";
}
function renderLoading(view){
  document.getElementById("dashboard").setAttribute("aria-busy","true");
  document.getElementById("dashboard").innerHTML=view==="overview"?'\
    <section class="wealth-overview" aria-label="Vermögensübersicht wird geladen"><div><div class="skeleton" style="width:52%;height:18px">Lädt</div><div class="skeleton" style="width:72%;height:48px;margin-top:10px">Lädt</div></div><div class="skeleton" style="width:100%;height:28px">Lädt</div></section>'
    :view==="spending"?'\
    <div class="expense-loading" aria-label="Ausgaben werden geladen"><section class="expense-summary-band"><div class="expense-period"><div class="skeleton" style="width:100%;height:44px">Lädt</div></div><div class="expense-summary-stat"><div class="skeleton" style="width:76%;height:16px">Lädt</div><div class="skeleton" style="width:58%;height:28px;margin-top:8px">Lädt</div></div><div class="expense-summary-stat"><div class="skeleton" style="width:68%;height:16px">Lädt</div><div class="skeleton" style="width:42%;height:28px;margin-top:8px">Lädt</div></div><div class="expense-summary-stat"><div class="skeleton" style="width:68%;height:16px">Lädt</div><div class="skeleton" style="width:42%;height:28px;margin-top:8px">Lädt</div></div></section><div class="expense-workspace"><section class="expense-pane expense-category-pane"><div class="skeleton" style="width:45%;height:24px">Lädt</div><div class="skeleton" style="width:100%;height:44px;margin-top:16px">Lädt</div><div class="skeleton" style="width:100%;height:250px;margin-top:12px">Lädt</div></section><section class="expense-pane expense-transactions-pane"><div class="skeleton" style="width:35%;height:24px">Lädt</div><div class="skeleton" style="width:100%;height:44px;margin-top:16px">Lädt</div><div class="skeleton" style="width:100%;height:330px;margin-top:12px">Lädt</div></section></div></div>'
    :view==="assets"?'\
    <div aria-label="Vermögen wird geladen"><section class="assets-summary"><div><div class="skeleton" style="width:48%;height:18px">Lädt</div><div class="skeleton" style="width:75%;height:48px;margin-top:10px">Lädt</div></div><div><div class="skeleton" style="width:100%;height:30px">Lädt</div><div class="skeleton" style="width:100%;height:48px;margin-top:14px">Lädt</div></div></section><div class="assets-workspace"><section class="assets-pane"><div class="skeleton" style="width:58%;height:24px">Lädt</div><div class="skeleton" style="width:100%;height:360px;margin-top:14px">Lädt</div></section><section class="assets-pane"><div class="skeleton" style="width:35%;height:24px">Lädt</div><div class="skeleton" style="width:100%;height:390px;margin-top:14px">Lädt</div></section></div></div>'
    :view==="analyses"?'\
    <div aria-label="Analyse wird geladen"><section class="analysis-toolbar"><div class="skeleton" style="height:44px">Lädt</div><div class="skeleton" style="height:44px">Lädt</div><div class="skeleton" style="height:44px">Lädt</div><div class="skeleton" style="height:44px">Lädt</div></section><section class="analysis-summary"><div><div class="skeleton" style="width:62%;height:18px">Lädt</div><div class="skeleton" style="width:72%;height:45px;margin-top:8px">Lädt</div></div><div><div class="skeleton" style="width:76%;height:18px">Lädt</div><div class="skeleton" style="width:50%;height:28px;margin-top:8px">Lädt</div></div><div><div class="skeleton" style="width:70%;height:18px">Lädt</div><div class="skeleton" style="width:45%;height:28px;margin-top:8px">Lädt</div></div></section><div class="analysis-grid"><section class="analysis-panel"><div class="skeleton" style="width:42%;height:24px">Lädt</div><div class="skeleton" style="width:100%;height:310px;margin-top:20px">Lädt</div></section><section class="analysis-panel"><div class="skeleton" style="width:52%;height:24px">Lädt</div><div class="skeleton" style="width:100%;height:310px;margin-top:20px">Lädt</div></section></div></div>'
    :'\
    <section class="status-overview" aria-label="Statusübersicht wird geladen"><div class="overview-main"><div class="skeleton" style="width:72%;height:28px">Lädt</div><div class="skeleton" style="width:42%;height:16px;margin-top:12px">Lädt</div></div><div class="overview-stats"><div class="stat"><strong>–</strong><span>Automatisch aktuell</span></div><div class="stat"><strong>–</strong><span>Aufgaben</span></div><div class="stat"><strong>–</strong><span>Historische Importe</span></div></div></section>';
}
async function refresh(force=false){
  const view=activeView();
  const button=document.getElementById("refresh-button");
  renderHeader(view);renderNavigation();renderLoading(view);
  const loadingLabel=view==="overview"?"Übersicht":view==="spending"?"Ausgaben":view==="assets"?"Vermögen":view==="analyses"?"Analyse":"Datenstatus";
  button.disabled=true;msg(loadingLabel+" wird aktualisiert …");
  try{
    if(view==="overview"){
      const range=cashflowSelection();
      const params=new URLSearchParams({months:String(range.months),offset:String(range.offset)});
      params.set("spendingOffset",String(spendingSelection().offset));
      if(force)params.set("refresh","1");
      const data=await call("/api/dashboard/overview?"+params.toString());renderOverview(data);
    }else if(view==="spending"){
      const selection=expenseSelection();
      const params=new URLSearchParams();
      if(selection.month)params.set("month",selection.month);
      if(selection.category!=="all")params.set("category",selection.category);
      if(selection.account!=="all")params.set("account",selection.account);
      if(selection.search)params.set("search",selection.search);
      if(selection.page>1)params.set("page",String(selection.page));
      if(force)params.set("refresh","1");
      const data=await call("/api/dashboard/spending?"+params.toString());renderSpending(data);
    }else if(view==="assets"){
      const data=await call("/api/dashboard/assets"+(force?"?refresh=1":""));renderAssets(data);
    }else if(view==="analyses"){
      const selection=analysisSelection();
      const params=new URLSearchParams();
      if(selection.view==="decision-lab"){
        params.set("trendBasis",selection.decisionBasis);
        params.set("realReturnBps",String(Math.round(selection.decisionReturn*100)));
        params.set("monthlyChangeMinor",String(Math.round(selection.decisionMonthly*100)));
        params.set("oneTimeMinor",String(Math.round(selection.decisionOneTime*100)));
        params.set("fireTargetAge",String(selection.fireTargetAge));
        if(selection.fireActionKeys.length)params.set("fireActionKeys",selection.fireActionKeys.join(","));
        else if(new URLSearchParams(location.search).has("fireActionKeys"))params.set("fireActionKeys","none");
        if(selection.fireCategoryCuts.length)params.set("fireCategoryCuts",selection.fireCategoryCuts.join(","));
        if(selection.fireOneTimeKeys.length)params.set("fireOneTimeKeys",selection.fireOneTimeKeys.join(","));
        if(force)params.set("refresh","1");
        const data=await call("/api/dashboard/analyses/decision-lab?"+params.toString());renderDecisionLab(data);
      }else if(selection.view==="crypto-origin-tax"){
        const data=await call("/api/dashboard/analyses/crypto-position");renderCryptoAnalysis(data);
      }else if(selection.view==="expense-optimizations"){
        const data=await call("/api/dashboard/analyses/recurring-expenses/optimizations"+(force?"?refresh=1":""));renderRecurringOptimizations(data);
      }else if(selection.view==="recurring-expenses"){
        if(selection.rhythm!=="alle")params.set("rhythm",selection.rhythm);
        if(selection.review!=="moeglich")params.set("review",selection.review);
        if(selection.classification!=="alle")params.set("classification",selection.classification);
        if(selection.confidence!=="alle")params.set("confidence",selection.confidence);
        if(force)params.set("refresh","1");
        currentRecurringDetail=null;
        const data=await call("/api/dashboard/analyses/recurring-expenses?"+params.toString());renderRecurringExpenses(data);
      }else{
        if(selection.period)params.set("period",String(selection.period));
        if(selection.comparison)params.set("comparison",String(selection.comparison));
        if(force)params.set("refresh","1");
        const data=await call("/api/dashboard/analyses?"+params.toString());renderAnalyses(data);
      }
    }else{
      const data=await call("/api/dashboard/status");renderDashboard(data);await loadManualSources();
    }
    msg("");
  }
  catch(error){if(view==="spending")renderSpendingError(error);else if(view==="assets")renderAssetsError(error);else if(view==="analyses"&&analysisSelection().view==="recurring-expenses")renderRecurringError(error);else if(view==="analyses"&&analysisSelection().view==="expense-optimizations")renderOptimizationError(error);else if(view==="analyses"&&analysisSelection().view==="decision-lab")renderDecisionLabError(error);else if(view==="analyses"&&analysisSelection().view==="crypto-origin-tax")renderCryptoError(error);else if(view==="analyses")renderAnalysesError(error);else{msg(error.message,true);document.getElementById("dashboard").setAttribute("aria-busy","false")}}
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
window.addEventListener("hashchange",()=>{
  renderNavigation();
  refresh();
  const title=document.getElementById("page-title");
  title.tabIndex=-1;
  title.focus({preventScroll:true});
});
window.addEventListener("popstate",()=>refresh());
if(!location.hash)history.replaceState(null,"","#/overview");
refresh();
</script>
</body>
</html>`;
}
