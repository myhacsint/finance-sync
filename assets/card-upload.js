window.FinanceCardUpload=(()=>{
 let preview=null,busy=false;
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const money=n=>new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR'}).format(n/100);
 function mount({call}){
  const host=document.getElementById('dashboard');
  document.getElementById('page-title').textContent='Kreditkartenabrechnung';
  document.getElementById('page-subtitle').textContent='PDF lokal prüfen und erst nach Bestätigung übernehmen.';
  const steps=active=>'<ol class="card-steps" aria-label="Importschritte">'+['Hochladen','Erkennen','Prüfen','Übernehmen'].map((s,i)=>`<li${i===active?' aria-current="step"':''}><b>${i+1}</b>${s}</li>`).join('')+'</ol>';
  const render=()=>{
   if(location.hash!=='#/card-documents')return;
   host.setAttribute('aria-busy',String(busy));
   if(!preview){host.innerHTML=steps(busy?1:0)+'<section class="section card-document"><h2>PDF hochladen</h2><p>Aktuell unterstützt: Miles &amp; More / Deutsche Bank. PDF bis 12 MB, höchstens 12 Seiten.</p><label class="card-file">Abrechnung auswählen<input type="file" accept="application/pdf" '+(busy?'disabled':'')+'></label><p role="status">'+(busy?'Datei wird sicher geprüft und lokal erkannt …':'Erst die Vorschau prüfen. Noch keine Buchung wird angelegt.')+'</p><p>Original und Volltext werden nach der Erkennung gelöscht. Nur bestätigte strukturierte Daten bleiben archiviert.</p><a class="button quiet" href="#/data-status">Zurück zum Datenstatus</a></section>';host.querySelector('input').addEventListener('change',upload);return;}
   const d=preview.document,s=d.statement,settlement=preview.settlement;
   const blocked=!d.canConfirm||['duplicate','conflict'].includes(preview.state)||!settlement||!['ready','already-linked'].includes(settlement.status);
   const warnings=[...d.warnings];
   if(settlement?.status==='ready')warnings.push('Vorgeschlagener Ausgleich vom Konto '+(settlement.sourceAccountName||'Girokonto')+'. Bitte mit der tatsächlichen Giro-Abbuchung vergleichen.');
   if(preview.state==='duplicate')warnings.push('Diese Abrechnung wurde bereits übernommen. Keine erneute Buchung.');
   if(preview.state==='conflict')warnings.push('Zum gleichen Abrechnungsdatum liegt ein anderer Stand vor. Keine automatische Überschreibung.');
   if(preview.state==='retry')warnings.push('Eine bestätigte Übernahme ist noch offen. Erneut prüfen setzt denselben Import mit stabilen IDs fort.');
   if(!settlement||!['ready','already-linked'].includes(settlement.status))warnings.push('Kein eindeutiger Zahlungsweg verfügbar. Übernahme gesperrt, damit Giro- und Kartenumsätze nicht doppelt zählen. Bitte Zahlungsweg zuerst in Actual klären.');
   host.innerHTML=steps(busy?3:2)+`<section class="section card-document"><h2>Abrechnung prüfen</h2><dl class="mc-evidence-grid"><div><dt>Abrechnungsdatum · Seite ${d.statementDatePage}</dt><dd>${esc(s.statementDate)}</dd></div><div><dt>Buchungen</dt><dd>${s.transactions.length}</dd></div><div><dt>Saldo</dt><dd>${money(s.balanceMinor)}</dd></div><div><dt>Belegzeitraum</dt><dd>${d.period?esc(d.period.from+' – '+d.period.to):'Nicht ausdrücklich angegeben'}</dd></div></dl>${warnings.map(w=>'<p class="notice tone-warning">'+esc(w)+'</p>').join('')}<div class="card-transactions">${s.transactions.map(t=>`<article><time>${esc(t.purchaseDate)}</time><strong>${esc(t.payee)}</strong><span>${money(t.amountMinor)}</span></article>`).join('')}</div><p>Erkennung: ${esc(d.extractionVersion)} · ${d.provenance.map(p=>`Seite ${p.page}: ${p.method==='native'?'PDF-Text':'OCR'}`).join(' · ')}. Vorschau gültig bis ${esc(new Date(preview.expiresAt).toLocaleTimeString('de-DE'))}.</p>${settlement?.status==='ready'?`<label class="card-confirm"><input id="card-link" type="checkbox"> Ich bestätige diesen Giro-Ausgleich: ${esc(settlement.date)} · ${money(settlement.amountMinor)}. Betrag und Datum allein sind kein Beweis.</label>`:settlement?.status==='already-linked'?'<p>Giro-Ausgleich bereits als Transfer verbunden.</p>':''}<label class="card-confirm"><input id="card-reviewed" type="checkbox" ${blocked?'disabled':''}> Ich habe Datum, Umsatzzeilen, Summe und Zahlungsweg geprüft.</label><div class="saved-view-controls"><button type="button" class="button secondary" id="card-cancel" ${busy?'disabled':''}>Abbrechen</button><button type="button" class="button" id="card-confirm" disabled>${busy?'Wird übernommen …':'Übernehmen'}</button></div><p role="status" aria-live="polite" id="card-message"></p></section>`;
   const confirm=host.querySelector('#card-confirm'),reviewed=host.querySelector('#card-reviewed'),link=host.querySelector('#card-link');
   const enabled=()=>{confirm.disabled=busy||blocked||!reviewed.checked||(link&&!link.checked);};
   reviewed.addEventListener('change',enabled);link?.addEventListener('change',enabled);
   host.querySelector('#card-cancel').addEventListener('click',async()=>{try{await call('/api/card-documents/previews/'+preview.id,{method:'DELETE'});preview=null;render();}catch(e){host.querySelector('#card-message').textContent=e.message;}});
   confirm.addEventListener('click',async()=>{if(confirm.disabled)return;busy=true;confirm.disabled=true;host.querySelector('#card-cancel').disabled=true;try{const result=await call('/api/card-documents/previews/'+preview.id+'/confirm',{method:'POST',body:JSON.stringify({confirmed:true,settlementKey:link?.checked?settlement.candidateKey:undefined})});preview=null;host.innerHTML=steps(3)+`<section class="section"><h2>${result.state==='duplicate'?'Bereits vorhanden':'Übernommen'}</h2><p>${result.added||0} neue Buchungen. Zahlungsweg wurde geprüft; keine zusätzliche Ausgabensumme aus der Giro-Sammelabbuchung.</p><a class="button" href="#/spending">Ausgaben ansehen</a><a class="button secondary" href="#/data-status">Datenstatus</a></section>`;}catch(e){host.querySelector('#card-message').textContent=e.message;host.querySelector('#card-cancel').disabled=false;confirm.disabled=false;}finally{busy=false;host.setAttribute('aria-busy','false');}});
  };
  async function upload(event){const file=event.target.files?.[0];if(!file)return;if(file.size>12*1024*1024){event.target.value='';host.querySelector('[role=status]').textContent='Die PDF ist größer als 12 MB.';return;}busy=true;render();try{const form=new FormData();form.append('document',file);preview=await call('/api/card-documents/previews',{method:'POST',body:form});}catch(e){busy=false;render();if(location.hash==='#/card-documents')host.querySelector('[role=status]').textContent=e.message;return;}busy=false;render();}
  render();
  if(!preview)call('/api/card-documents/receipts').then(data=>{
    if(preview||busy||location.hash!=='#/card-documents')return;
    const section=document.createElement('section');section.className='section card-document';section.style.marginTop='20px';
    section.innerHTML='<h2>Bisherige PDF-Übernahmen</h2>'+(data.receipts.length?data.receipts.map(r=>`<p>${esc(r.statementDate)} · ${r.bookings} Buchungen · ${r.state==='APPLIED'?'Übernommen':'Übernahme offen – dieselbe PDF erneut prüfen'}</p>`).join(''):'<p>Noch keine PDF-Übernahmen über diesen neuen Ablauf. Frühere Kartenimporte bleiben unverändert in Actual.</p>');host.append(section);
  }).catch(()=>{/* Authentication is handled by the shared request function. */});
 }
 return {mount};
})();
