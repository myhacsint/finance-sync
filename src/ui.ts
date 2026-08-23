import { uiStyles } from "./ui/styles.js";
import { uiClient } from "./ui/client.js";

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
${uiStyles()}
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
${uiClient()}
</script>
</body>
</html>`;
}
