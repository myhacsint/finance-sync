import {test,expect} from '@playwright/test';
import {parseCardPages} from '../../src/card-document.js';
const document=parseCardPages([{page:1,method:'native',confidence:1,text:'Abrechnungsdatum\n03. August 2026\n01.07.2026 02.07.2026 Buchladen -24,00\n03.07.2026 04.07.2026 Café -8,00\nSaldo -32,00'}]);
test.beforeEach(async({page})=>{await page.request.post('/api/session',{headers:{authorization:'Bearer synthetic-browser-test',origin:'http://127.0.0.1:18083'}});});
test('card upload desktop/mobile empty, preview and explicit settlement confirmation',async({page},info)=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 let confirmations=0;
 await page.route('**/api/card-documents/previews',r=>r.fulfill({json:{id:'00000000-0000-0000-0000-000000000001',hash:'a'.repeat(64),expiresAt:'2099-01-01T12:00:00Z',document,state:'new',settlement:{status:'ready',date:'2026-08-06',amountMinor:3200,candidateKey:'b'.repeat(64)}}}));
 await page.route('**/api/card-documents/previews/*/confirm',async r=>{confirmations++;expect(r.request().postDataJSON()).toEqual({confirmed:true,settlementKey:'b'.repeat(64)});await r.fulfill({json:{state:'applied',added:2}});});
 await page.goto('/#/card-documents');
 await expect(page.getByRole('heading',{name:'PDF hochladen'})).toBeVisible();
 await page.screenshot({path:'test-results/card-empty-'+info.project.name+'.png',fullPage:true});
 await page.getByLabel('Abrechnung auswählen').setInputFiles({name:'synthetic.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4 synthetic fixture intercepted by test')});
 await expect(page.getByRole('heading',{name:'Abrechnung prüfen'})).toBeVisible();
 const confirm=page.getByRole('button',{name:'Übernehmen',exact:true});await expect(confirm).toBeDisabled();
 await page.getByLabel('Ich habe Datum, Umsatzzeilen, Summe und Zahlungsweg geprüft.').check();await expect(confirm).toBeDisabled();
 await page.locator('#card-link').check();await expect(confirm).toBeEnabled();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBe(0);
 await page.screenshot({path:'test-results/card-review-'+info.project.name+'.png',fullPage:true});
 await confirm.click();await expect(page.getByRole('heading',{name:'Übernommen',exact:true})).toBeVisible();expect(confirmations).toBe(1);expect(errors).toEqual([]);
});
test('uncertain card extraction and duplicate cannot be confirmed',async({page})=>{
 await page.route('**/api/card-documents/previews',r=>r.fulfill({json:{id:'00000000-0000-0000-0000-000000000001',expiresAt:'2099-01-01T12:00:00Z',document:{...document,canConfirm:false,warnings:['OCR unsicher']},state:'duplicate',settlement:null}}));
 await page.goto('/#/card-documents');await page.getByLabel('Abrechnung auswählen').setInputFiles({name:'synthetic.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4 synthetic fixture')});
 await expect(page.getByText('OCR unsicher',{exact:true})).toBeVisible();await expect(page.locator('#card-reviewed')).toBeDisabled();await expect(page.locator('#card-confirm')).toBeDisabled();
});
test('saved view API rejects arbitrary fields and read requests require authentication',async({page,request})=>{
 expect((await request.get('/api/dashboard/saved-views')).status()).toBe(401);
 const headers={origin:'http://127.0.0.1:18083'};
 const created=await page.request.post('/api/dashboard/saved-views',{headers,data:{name:'Synthetische Testansicht',filters:{period:'year',year:'2026',category:'all',account:'all'}}});expect(created.status()).toBe(201);
 const row=await created.json();expect((await page.request.get('/api/dashboard/saved-views')).headers()['cache-control']).toBe('no-store');
 expect((await page.request.post('/api/dashboard/saved-views',{headers,data:{name:'x',filters:{search:'private'}}})).status()).toBe(400);
 expect((await page.request.delete('/api/dashboard/saved-views/'+row.id,{headers})).status()).toBe(200);
});
test('payment paths remain read-only and distinguish ambiguity',async({page},info)=>{
 await page.route('**/api/dashboard/payment-paths*',r=>r.fulfill({json:{startDate:'2026-03-01',endDate:'2026-09-08',generatedAt:'2026-09-08T10:00:00Z',suggestions:[{from:'Girokonto',to:'PayPal',fromDate:'2026-08-01',toDate:'2026-08-02',amountMinor:2400,dayDifference:1,state:'ambiguous',reasons:['PayPal-Hinweis','Betragsgleichheit'],note:'Keine Änderung.'}],truncated:false}}));
 const writes:string[]=[];page.on('request',r=>{if(r.method()!=='GET')writes.push(r.url());});
 await page.goto('/?reviewTab=payment-paths#/review');await expect(page.getByRole('heading',{name:'Zahlungswege prüfen'})).toBeVisible();
 await page.getByText('Begründung ansehen',{exact:true}).click();await expect(page.getByText('Keine Änderung.',{exact:true})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBe(0);
 await page.screenshot({path:'test-results/payment-paths-'+info.project.name+'.png',fullPage:true});expect(writes).toEqual([]);
});
test('saved view controls persist and load filters on desktop and mobile',async({page},info)=>{
 await page.route('**/api/dashboard/spending*',r=>r.fulfill({json:{month:'2026-08',monthLabel:'August 2026',latestMonth:'2026-08',oldestMonth:'2026-01',summary:{bookings:0,totalMinor:0,categorizedPercent:0},selection:{account:'all',category:'all',search:'',sort:'date-desc'}}}));
 await page.goto('/?expenseMonth=2026-08#/spending');await expect(page.getByRole('heading',{name:'Gespeicherte Ansichten'})).toBeVisible();
 await page.getByLabel('Name der neuen Ansicht').fill('Test Haushalt '+info.project.name);await page.getByRole('button',{name:'Ansicht speichern',exact:true}).click();await expect(page.getByText('Ansicht gespeichert.',{exact:true})).toBeVisible();
 await page.getByLabel('Ansicht wählen').selectOption({label:'Test Haushalt '+info.project.name});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBe(0);
 await page.screenshot({path:'test-results/saved-views-'+info.project.name+'.png',fullPage:true});
 await page.getByRole('button',{name:'Laden',exact:true}).click();await expect(page).toHaveURL(/expenseMonth=2026-08/);
 await page.getByLabel('Ansicht wählen').selectOption({label:'Test Haushalt '+info.project.name});await page.getByRole('button',{name:'Entfernen',exact:true}).click();await page.getByRole('button',{name:'Wirklich entfernen?',exact:true}).click();await expect(page.getByText('Ansicht entfernt. Buchungen bleiben unverändert.',{exact:true})).toBeVisible();
});
test('late card confirmation never replaces a newly selected route',async({page})=>{
 let release!:()=>void,started=false;const gate=new Promise<void>(r=>release=r);
 await page.route('**/api/card-documents/previews',r=>r.fulfill({json:{id:'00000000-0000-0000-0000-000000000001',expiresAt:'2099-01-01T12:00:00Z',document,state:'new',settlement:{status:'already-linked'}}}));
 await page.route('**/api/card-documents/previews/*/confirm',async r=>{started=true;await gate;await r.fulfill({json:{state:'applied',added:2}});});
 await page.route('**/api/dashboard/assets*',r=>r.fulfill({status:503,json:{error:'Synthetic unavailable'}}));
 await page.goto('/#/card-documents');await page.getByLabel('Abrechnung auswählen').setInputFiles({name:'synthetic.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4 synthetic fixture')});
 await page.locator('#card-reviewed').check();await page.locator('#card-confirm').click();await expect.poll(()=>started).toBe(true);
 await page.getByRole('link',{name:'Vermögen',exact:true}).click();await expect(page.getByRole('heading',{name:'Nicht verfügbar',exact:true})).toBeVisible();
 const response=page.waitForResponse(r=>r.url().endsWith('/confirm'));release();await response;
 await expect(page.getByRole('heading',{name:'Nicht verfügbar',exact:true})).toBeVisible();await expect(page.getByRole('heading',{name:'Übernommen',exact:true})).toHaveCount(0);
});
