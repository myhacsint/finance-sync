function connectedAppUrl(publicBaseUrl: string | undefined, port: number): string {
  const url = new URL(publicBaseUrl || "http://localhost:8080");
  url.port = String(port);
  url.pathname = "/";
  url.search = "";
  url.hash = "";
  return url.toString();
}

export function renderUi(publicBaseUrl?: string): string {
  const actualUrl = connectedAppUrl(publicBaseUrl, 5006);
  const ghostfolioUrl = connectedAppUrl(publicBaseUrl, 3333);
  return `<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="theme-color" content="#080d19">
  <link rel="icon" type="image/png" href="/assets/finance-hub-mark.png">
  <title>Übersicht · Finance Hub</title>
  <link rel="stylesheet" href="/assets/app.css?v=0.43.1">
</head>
<body>
  <a class="skip-link" href="#main-content">Zum Inhalt springen</a>
  <div class="app">
    <aside class="sidebar" aria-label="Hauptnavigation">
      <div class="brand"><img src="/assets/finance-hub-mark.png" alt="" width="34" height="34" fetchpriority="high"><div><strong>Finance Hub</strong><span>Privater Finanzbereich</span></div></div>
      <nav><ul class="nav-list" id="desktop-nav"></ul></nav>
      <div class="nav-spacer"></div>
      <div class="side-links" aria-label="Verbundene Anwendungen">
        <a class="nav-item" href="${actualUrl}" target="_blank" rel="noopener noreferrer" title="Actual Budget in einem neuen Tab öffnen">Actual Budget</a>
        <a class="nav-item" href="${ghostfolioUrl}" target="_blank" rel="noopener noreferrer" title="Ghostfolio in einem neuen Tab öffnen">Ghostfolio</a>
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
<script src="/assets/app.js?v=0.43.1" defer></script>
</body>
</html>`;
}
