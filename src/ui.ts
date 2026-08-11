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
      .expense-summary-band { grid-template-columns: 1fr repeat(3, 1fr); }
      .expense-period { grid-column: 1 / -1; border-bottom: 1px solid var(--line-soft); }
      .expense-summary-stat:first-of-type { border-left: 0; }
      .expense-workspace { grid-template-columns: minmax(250px, .8fr) minmax(460px, 1.4fr); }
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
          <button class="button quiet" id="refresh-button" type="button" onclick="refresh(true)" aria-label="Übersicht aktualisieren">
            <span aria-hidden="true">↻</span><span class="desktop-label">Aktualisieren</span>
          </button>
        </header>
        <div id="message" class="notice" role="status" aria-live="polite"></div>
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
  {label:"Vermögen",icon:"assets"},
  {label:"Analysen",icon:"analysis"},
  {label:"Datenstatus",icon:"status",view:"status"}
];
function activeView(){return location.hash==="#\/data-status"?"status":location.hash==="#\/spending"?"spending":"overview"}
function viewHref(view){return view==="status"?'#/data-status':view==="spending"?'#/spending':'#/overview'}
function navMarkup(){const current=activeView();return navItems.map(item=>item.view?'<a class="nav-item" href="'+viewHref(item.view)+'"'+(item.view===current?' aria-current="page"':'')+'>'+icons[item.icon]+'<span>'+item.label+'</span></a>':'<button class="nav-item" type="button" disabled title="Folgt in einem späteren Schritt">'+icons[item.icon]+'<span>'+item.label+'</span></button>').join("")}
function renderNavigation(){document.getElementById("desktop-nav").innerHTML=navMarkup();document.getElementById("mobile-nav").innerHTML=navMarkup()}
renderNavigation();

const legacyToken=localStorage.getItem("financeToken");
if(legacyToken&&!sessionStorage.getItem("financeToken"))sessionStorage.setItem("financeToken",legacyToken);
localStorage.removeItem("financeToken");
let token=sessionStorage.getItem("financeToken")||"";
let currentPreview=null;
let currentExpenseMonth="";

function requestToken(){
  const supplied=prompt("Finance Hub Verwaltungstoken eingeben");
  if(!supplied)return false;
  token=supplied.trim();
  sessionStorage.setItem("financeToken",token);
  return Boolean(token);
}
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
      <div><span class="wealth-label">Gesamtvermögen</span><strong class="wealth-value">'+moneyWhole(total)+'</strong><p class="wealth-date">Stand '+esc(formatDate(data.generatedAt))+' · Bankkonten und Anlagen</p></div>\
      <div class="wealth-composition"><div class="wealth-health">'+statusIcon(automaticOk?"ok":"warning")+'<span>'+(automaticOk?'Automatische Quellen aktuell':'Quellenstatus mit Hinweisen')+'</span></div>'+composition+'<div class="composition-legend"><span><i class="composition-cash"></i>Liquidität <strong>'+moneyWhole(data.cash.amountMinor)+'</strong></span><span><i class="composition-investments"></i>Anlagen <strong>'+moneyWhole(data.investments.amountMinor)+'</strong></span></div></div>\
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
    status:{title:"Datenstatus",subtitle:"Aktualität, offene Aufgaben und Systemzustand auf einen Blick."}
  }[view];
  document.title=content.title+" · Finance Hub";
  const eyebrow=document.getElementById("page-eyebrow");
  eyebrow.hidden=view!=="status";
  document.getElementById("page-title").textContent=content.title;
  document.getElementById("page-subtitle").textContent=content.subtitle;
  document.getElementById("refresh-button").setAttribute("aria-label",content.title+" aktualisieren");
}
function renderLoading(view){
  document.getElementById("dashboard").setAttribute("aria-busy","true");
  document.getElementById("dashboard").innerHTML=view==="overview"?'\
    <section class="wealth-overview" aria-label="Vermögensübersicht wird geladen"><div><div class="skeleton" style="width:52%;height:18px">Lädt</div><div class="skeleton" style="width:72%;height:48px;margin-top:10px">Lädt</div></div><div class="skeleton" style="width:100%;height:28px">Lädt</div></section>'
    :view==="spending"?'\
    <div class="expense-loading" aria-label="Ausgaben werden geladen"><section class="expense-summary-band"><div class="expense-period"><div class="skeleton" style="width:100%;height:44px">Lädt</div></div><div class="expense-summary-stat"><div class="skeleton" style="width:76%;height:16px">Lädt</div><div class="skeleton" style="width:58%;height:28px;margin-top:8px">Lädt</div></div><div class="expense-summary-stat"><div class="skeleton" style="width:68%;height:16px">Lädt</div><div class="skeleton" style="width:42%;height:28px;margin-top:8px">Lädt</div></div><div class="expense-summary-stat"><div class="skeleton" style="width:68%;height:16px">Lädt</div><div class="skeleton" style="width:42%;height:28px;margin-top:8px">Lädt</div></div></section><div class="expense-workspace"><section class="expense-pane expense-category-pane"><div class="skeleton" style="width:45%;height:24px">Lädt</div><div class="skeleton" style="width:100%;height:44px;margin-top:16px">Lädt</div><div class="skeleton" style="width:100%;height:250px;margin-top:12px">Lädt</div></section><section class="expense-pane expense-transactions-pane"><div class="skeleton" style="width:35%;height:24px">Lädt</div><div class="skeleton" style="width:100%;height:44px;margin-top:16px">Lädt</div><div class="skeleton" style="width:100%;height:330px;margin-top:12px">Lädt</div></section></div></div>'
    :'\
    <section class="status-overview" aria-label="Statusübersicht wird geladen"><div class="overview-main"><div class="skeleton" style="width:72%;height:28px">Lädt</div><div class="skeleton" style="width:42%;height:16px;margin-top:12px">Lädt</div></div><div class="overview-stats"><div class="stat"><strong>–</strong><span>Automatisch aktuell</span></div><div class="stat"><strong>–</strong><span>Aufgaben</span></div><div class="stat"><strong>–</strong><span>Historische Importe</span></div></div></section>';
}
async function refresh(force=false){
  const view=activeView();
  const button=document.getElementById("refresh-button");
  renderHeader(view);renderNavigation();renderLoading(view);
  const loadingLabel=view==="overview"?"Übersicht":view==="spending"?"Ausgaben":"Datenstatus";
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
    }else{
      const data=await call("/api/dashboard/status");renderDashboard(data);await loadManualSources();
    }
    msg("");
  }
  catch(error){if(view==="spending")renderSpendingError(error);else{msg(error.message,true);document.getElementById("dashboard").setAttribute("aria-busy","false")}}
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
