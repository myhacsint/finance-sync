/* Read-only monthly review surface. Calculations and evidence decisions stay on the server. */
window.FinanceMonthCheck = (() => {
  let data = null;
  let selected = null;
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const svg = path => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">'+path+'</svg>';
  const arrow = svg('<path d="m9 5 7 7-7 7"/>');
  const warning = svg('<path d="M12 4 3 20h18L12 4Zm0 5v5m0 3v.1"/>');
  const documentIcon = svg('<path d="M6 3h9l4 4v14H6zM15 3v5h5M9 13h6M9 17h4"/>');
  const date = value => value ? new Intl.DateTimeFormat('de-DE',{timeZone:'Europe/Berlin',dateStyle:'medium'}).format(new Date(value)) : 'Nicht verfügbar';
  const money = (value, currency) => value === null ? 'Nicht prüfbar' : new Intl.NumberFormat('de-DE',{style:'currency',currency}).format(value/100);
  const label = month => new Intl.DateTimeFormat('de-DE',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(month+'-01T12:00:00Z'));
  const active = () => new URLSearchParams(location.search).get('reviewTab') === 'month-check';
  const month = () => new URLSearchParams(location.search).get('checkMonth') || undefined;
  function href(tab, monthValue) {
    const params = new URLSearchParams();
    if(tab === 'month-check')params.set('reviewTab',tab);
    if(monthValue)params.set('checkMonth',monthValue);
    return location.pathname+(params.size?'?'+params:'')+'#/review';
  }
  function tabs(isCheck = active()) {
    const paths=new URLSearchParams(location.search).get('reviewTab')==='payment-paths';
    return '<nav class="month-check-tabs" aria-label="Prüfbereich"><a data-mc-tab="bookings" href="'+href('bookings')+'"'+(!isCheck&&!paths?' aria-current="page"':'')+'>Buchungen</a><a data-mc-tab="month-check" href="'+href('month-check',month())+'"'+(isCheck?' aria-current="page"':'')+'>Monatscheck</a><a data-mc-tab="payment-paths" href="?reviewTab=payment-paths#/review"'+(paths?' aria-current="page"':'')+'>Zahlungswege</a></nav>';
  }
  const status = value => '<span class="mc-status mc-'+escape(value.state)+'"><span aria-hidden="true">'+({ok:'✓',difference:'!',unknown:'−',open:'…',na:'–',error:'!'}[value.state]||'−')+'</span>'+escape(value.label)+'</span>';
  function details(account) {
    const e = account.evidence;
    const title = account.balance.state === 'unknown' ? 'Warum nicht prüfbar?' : 'Prüfung & Belege';
    return '<div class="mc-detail-body"><div><h3>'+title+'</h3><p>'+escape(account.balance.reason)+'</p><p>'+escape(account.coverage.reason)+'</p><p>'+escape(account.assignment.reason)+'</p></div><div class="mc-provenance"><span>Quelle: '+escape(account.sourceLabel)+'</span><span>Zeitraum: '+date(data.startDate)+' – '+date(data.endDate)+'</span><span>Letzter erfolgreicher Quellstand: '+date(account.lastSuccessAt)+'</span></div></div><details class="mc-evidence"><summary>'+documentIcon+'Belege ansehen</summary><div><dl class="mc-evidence-grid"><div><dt>Anfangssaldo · '+date(data.openingDate)+'</dt><dd>'+money(e.opening?.amountMinor??null,account.currency)+'</dd></div><div><dt>Gebuchte Quellenbewegungen</dt><dd>'+money(e.movementMinor,account.currency)+'</dd></div><div><dt>Endsaldo · '+date(data.endDate)+'</dt><dd>'+money(e.closing?.amountMinor??null,account.currency)+'</dd></div><div><dt>Differenz zum Endsaldo</dt><dd>'+money(e.differenceMinor,account.currency)+'</dd></div><div><dt>Actual minus Quellenbewegungen</dt><dd>'+money(e.actualDifferenceMinor,account.currency)+'</dd></div><div><dt>Actual-Transferverknüpfungen</dt><dd>'+escape(e.transferLinks??'Nicht prüfbar')+'</dd></div></dl><ul>'+e.notes.map(n=>'<li>'+escape(n)+'</li>').join('')+'</ul><p>Keine Rohtexte oder Kontonummern in dieser Ansicht.</p></div></details>';
  }
  function render(next) {
    if(next.month!==data?.month)selected=null;
    data=next;
    if(selected!==false&&!data.accounts.some(a=>a.key===selected))selected=data.accounts.find(a=>a.balance.state==='unknown')?.key||data.accounts[0]?.key;
    const selectedAccount=data.accounts.find(a=>a.key===selected);
    const heading={empty:'Keine Kontendaten für diesen Check',partial:'Noch nicht vollständig prüfbar',difference:'Abweichung im Saldenabgleich',ok:'Prüfungen abgestimmt'}[data.state]||'Noch nicht vollständig prüfbar';
    const months=[];
    for(let m=data.latestMonth;m>='2024-01'||m>=data.month;m=shift(m,-1)){
      months.push(m);if(m==='2000-01')break;
    }
    const period='<div class="mc-period"><button class="button secondary mc-prev" type="button" data-mc-shift="-1" aria-label="Vorheriger Monat"'+(data.month==='2000-01'?' disabled':'')+'>'+arrow+'</button><label class="sr-only" for="mc-month">Prüfmonat</label><select id="mc-month" name="checkMonth">'+months.map(m=>'<option value="'+m+'"'+(m===data.month?' selected':'')+'>'+label(m)+'</option>').join('')+'</select><button class="button secondary" type="button" data-mc-shift="1" aria-label="Nächster Monat"'+(data.month>=data.latestMonth?' disabled':'')+'>'+arrow+'</button><span>'+(data.month===data.latestMonth?'Letzter abgeschlossener Monat':'Abgeschlossener Monat')+'</span></div>';
    const rows=data.accounts.map(a=>'<tr'+(a.key===selected?' class="is-selected"':'')+'><th scope="row">'+escape(a.label)+'</th><td>'+status(a.balance)+'</td><td>'+status(a.coverage)+'</td><td>'+status(a.assignment)+'</td><td><button type="button" class="mc-disclosure" data-mc-account="'+escape(a.key)+'" aria-label="Details zu '+escape(a.label)+'" aria-expanded="'+(a.key===selected)+'" aria-controls="mc-selected">'+arrow+'</button></td></tr>').join('');
    const mobile=data.accounts.map(a=>'<section class="mc-mobile-account"><button type="button" class="mc-mobile-toggle" data-mc-account="'+escape(a.key)+'" aria-expanded="'+(a.key===selected)+'" aria-controls="mc-mobile-'+escape(a.key)+'"><strong>'+escape(a.label)+'</strong>'+arrow+'</button><dl class="mc-account-statuses"><div><dt>Saldenabgleich</dt><dd>'+status(a.balance)+'</dd></div><div><dt>Belegabdeckung</dt><dd>'+status(a.coverage)+'</dd></div><div><dt>Zuordnung</dt><dd>'+status(a.assignment)+'</dd></div></dl><div id="mc-mobile-'+escape(a.key)+'"'+(a.key===selected?'':' hidden')+'>'+ (a.key===selected?details(a):'')+'</div></section>').join('');
    document.getElementById('dashboard').innerHTML=tabs(true)+'<div class="month-check">'+period+'<h2>Monatscheck</h2><section class="mc-summary mc-summary-'+escape(data.state)+'" aria-label="Prüfergebnis">'+warning+'<div><strong>'+heading+'</strong><p>Fehlende Belege sind keine bestätigten Datenlücken.</p>'+(data.actualState==='error'?'<p>Actual konnte nicht gelesen werden. Zahlungswege und Zuordnungen sind unvollständig.</p>':'')+'</div></section><section class="mc-accounts"><h2>Konten &amp; Zahlungswege</h2>'+(data.accounts.length?'<table class="mc-table"><thead><tr><th>Konto</th><th>Saldenabgleich</th><th>Belegabdeckung</th><th>Zuordnung</th><th>Details</th></tr></thead><tbody>'+rows+'</tbody></table><div class="mc-mobile-list">'+mobile+'</div>':'<p class="mc-empty">Für diesen Check sind keine verbundenen Konten lesbar. Prüfe die Quellen und Kontenzuordnung unter Status.</p>')+'</section>'+(selectedAccount?'<section class="mc-selected" id="mc-selected" aria-label="Ausgewähltes Konto"><h2>'+escape(selectedAccount.label)+'</h2>'+details(selectedAccount)+'</section>':'')+'<section class="mc-next"><h2>Nächste Schritte</h2><a href="'+href('bookings')+'" data-mc-tab="bookings">'+documentIcon+'<span>Offene Zuordnungen ansehen</span>'+arrow+'</a><a href="#/data-status">'+documentIcon+'<span>Beleg- und Quellenstatus ansehen</span>'+arrow+'</a></section><p class="mc-note">'+escape(data.note)+'</p><p class="mc-captured">Prüfstand: '+date(data.generatedAt)+' · Kennung '+escape(data.fingerprint.slice(0,8))+'</p></div>';
    document.getElementById('dashboard').setAttribute('aria-busy','false');
    const stamp=document.querySelector('.mc-captured');
    if(stamp)stamp.textContent='Prüfstand: '+new Date(data.generatedAt).toLocaleString('de-DE',{timeZone:'Europe/Berlin'})+' · '+(data.readCache?.hit?'Zwischengespeicherter Lesestand, höchstens 60 Sekunden. Aktualisieren liest neu.':'Neu gelesener Stand.')+' · Kennung '+data.fingerprint.slice(0,8);
  }
  function shift(m, delta){const [y,n]=m.split('-').map(Number);return new Date(Date.UTC(y,n-1+delta,1)).toISOString().slice(0,7)}
  function navigate(url){history.pushState(null,'',url);refresh();}
  document.addEventListener('click',event=>{
    const link=event.target.closest?.('[data-mc-tab]');
    if(link&&!event.ctrlKey&&!event.metaKey&&!event.shiftKey&&!event.altKey){event.preventDefault();navigate(link.href);return;}
    const account=event.target.closest?.('[data-mc-account]');
    if(account&&data){const key=account.dataset.mcAccount;selected=selected===key?false:key;const mobile=account.classList.contains('mc-mobile-toggle');render(data);document.querySelector((mobile?'.mc-mobile-list ':'.mc-table ')+'[data-mc-account="'+CSS.escape(key)+'"]')?.focus();return;}
    const button=event.target.closest?.('[data-mc-shift]');
    if(button&&!button.disabled&&data)navigate(href('month-check',shift(data.month,Number(button.dataset.mcShift))));
  });
  document.addEventListener('change',event=>{if(event.target.id==='mc-month')navigate(href('month-check',event.target.value))});
  function loading(){document.getElementById('dashboard').innerHTML=tabs(true)+'<section class="month-check mc-loading" aria-label="Monatscheck wird geladen"><h2>Monatscheck</h2><p role="status">Belege und Kontenzuordnungen werden gelesen …</p><div class="skeleton">Prüfung läuft</div></section>'}
  function error(message){document.getElementById('dashboard').innerHTML=tabs(true)+'<section class="month-check mc-error"><h2>Monatscheck nicht verfügbar</h2><p>'+escape(message)+'</p><button type="button" class="button" data-fh-click="refresh(true)">Erneut versuchen</button><a href="'+href('month-check')+'" data-mc-tab="month-check">Letzten abgeschlossenen Monat öffnen</a></section>';document.getElementById('dashboard').setAttribute('aria-busy','false')}
  return {active,month,tabs,render,loading,error};
})();
