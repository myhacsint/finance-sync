/* Saved filter recipes only: no balances, search text or credentials in storage. */
window.FinanceSavedViews = (() => {
  const escape = value => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  async function mount({call,selection,apply}) {
    const host=document.getElementById('dashboard');
    const box=document.createElement('section');box.className='section saved-views';box.setAttribute('aria-label','Gespeicherte Ausgabenansichten');
    box.innerHTML='<h2>Gespeicherte Ansichten</h2><p>Zeitraum, Konto, Kategorie und Sortierung wiederverwenden. Suchtexte werden nicht gespeichert.</p><div class="saved-view-controls"><label>Ansicht wählen<select id="saved-view-select"><option value="">Aktuelle Filter</option></select></label><button class="button secondary" type="button" id="saved-view-load">Laden</button><button class="button quiet" type="button" id="saved-view-delete" disabled>Entfernen</button></div><form class="saved-view-controls"><label>Name der neuen Ansicht<input name="view-name" maxlength="60" required autocomplete="off" placeholder="z. B. Haushalt im Quartal"></label><button class="button secondary" type="submit">Ansicht speichern</button></form><p role="status" aria-live="polite" class="saved-view-message"></p>';
    host.prepend(box);
    const select=box.querySelector('select'),message=box.querySelector('[role=status]'),remove=box.querySelector('#saved-view-delete');
    let rows=[];
    const update=async()=>{const data=await call('/api/dashboard/saved-views');rows=data.views;select.innerHTML='<option value="">Aktuelle Filter</option>'+rows.map(r=>`<option value="${escape(r.id)}">${escape(r.name)}</option>`).join('');remove.disabled=true;};
    select.addEventListener('change',()=>{remove.disabled=!select.value;remove.textContent='Entfernen';delete remove.dataset.confirm;});
    box.querySelector('#saved-view-load').addEventListener('click',()=>{const row=rows.find(r=>r.id===select.value);if(row)apply({month:'',period:'month',quarter:'',year:'',category:'all',account:'all',sort:'date-desc',search:'',page:1,...row.filters});else message.textContent='Bitte zuerst eine gespeicherte Ansicht auswählen.';});
    remove.addEventListener('click',async()=>{const row=rows.find(r=>r.id===select.value);if(!row)return;if(remove.dataset.confirm!==row.id){remove.dataset.confirm=row.id;remove.textContent='Wirklich entfernen?';message.textContent='Nur die gespeicherte Ansicht wird entfernt, keine Buchung.';return;}remove.disabled=true;try{await call('/api/dashboard/saved-views/'+encodeURIComponent(row.id),{method:'DELETE'});await update();remove.textContent='Entfernen';delete remove.dataset.confirm;message.textContent='Ansicht entfernt. Buchungen bleiben unverändert.';}catch(e){message.textContent=e.message;remove.disabled=false;}});
    box.querySelector('form').addEventListener('submit',async event=>{event.preventDefault();const button=event.currentTarget.querySelector('button');button.disabled=true;try{const filters=Object.fromEntries(['month','period','quarter','year','sort','account','category'].map(k=>[k,String(selection[k]||'')]));await call('/api/dashboard/saved-views',{method:'POST',body:JSON.stringify({name:box.querySelector('input').value,filters})});await update();message.textContent='Ansicht gespeichert.';}catch(e){message.textContent=e.message;}finally{button.disabled=false;}});
    try{await update();}catch(e){message.textContent='Gespeicherte Ansichten konnten nicht geladen werden. '+e.message;}
  }
  return {mount};
})();
