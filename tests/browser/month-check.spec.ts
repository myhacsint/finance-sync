import { test, expect } from '@playwright/test';
import { buildMonthCheck, monthCheckPeriod, result, type MonthAccountInput } from '../../src/dashboard-month-check.js';

const at=new Date('2026-09-08T12:00:00Z');
function fixture(month='2026-08') {
  const period=monthCheckPeriod(month,at);
  const base:MonthAccountInput={key:'bank-a',label:'Giro A',kind:'bank',currency:'EUR',sourceLabel:'Bank-Rohbelege',lastSuccessAt:at.toISOString(),
    balances:[{date:period.openingDate,amountMinor:10000,currency:'EUR',type:'CLBD',source:'Bank-Rohbeleg',dayClosed:true},{date:period.endDate,amountMinor:8000,currency:'EUR',type:'CLBD',source:'Bank-Rohbeleg',dayClosed:true}],
    movementMinor:-2000,actualMovementMinor:-2000,transactionCount:12,uncategorized:2,transferLinks:1,hasUnverifiedTransfer:false,
    coverage:result('unknown','Unklar','MISSING','Ein vollständiger Periodennachweis fehlt.'),issues:['Synthetischer Beleg für die Darstellungsprüfung.']};
  return {...buildMonthCheck([base,{...base,key:'bank-b',label:'Giro B',balances:[],uncategorized:0},
    {...base,key:'card',label:'Kreditkarte',kind:'card',balances:[],movementMinor:null},
    {...base,key:'paypal',label:'PayPal',kind:'paypal',balances:[],movementMinor:null}],period,at),actualState:'current'};
}
test.beforeEach(async({page})=>{
  expect((await page.request.post('/api/session',{headers:{authorization:'Bearer synthetic-browser-test',origin:'http://127.0.0.1:18083'}})).ok()).toBeTruthy();
});
test('month-check endpoint is read-only, authenticated, bounded and uncached',async({page,request})=>{
  expect((await request.get('/api/dashboard/month-check')).status()).toBe(401);
  const response=await page.request.get('/api/dashboard/month-check?month=2026-08');
  expect(response.ok()).toBeTruthy();expect(response.headers()['cache-control']).toBe('no-store');
  const data=await response.json();expect(data.state).toBe('empty');expect(data.accounts).toEqual([]);
  expect(JSON.stringify(data)).not.toMatch(/budgetId|account_id|relative_path|PRIVATE_SENTINEL/);
  expect((await page.request.get('/api/dashboard/month-check?month=3000-01')).status()).toBe(400);
  expect((await page.request.get('/api/dashboard/month-check?month=..%2Fsecrets')).status()).toBe(400);
  expect((await page.request.post('/api/dashboard/month-check',{headers:{origin:'http://127.0.0.1:18083'}})).status()).toBe(404);
});
test('monthly evidence, navigation, keyboard details and no writes',async({page},info)=>{
  const errors:string[]=[],writes:string[]=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('request',r=>{if(!['GET','HEAD'].includes(r.method()))writes.push(r.url());});
  await page.route('**/api/dashboard/month-check*',r=>r.fulfill({json:fixture(new URL(r.request().url()).searchParams.get('month')||'2026-08')}));
  await page.goto('/?reviewTab=month-check&checkMonth=2026-08#/review');
  await expect(page.getByRole('heading',{name:'Monatscheck',exact:true})).toBeVisible();
  await expect(page.getByText('Noch nicht vollständig prüfbar',{exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Nächster Monat',exact:true})).toBeDisabled();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBe(0);
  await page.screenshot({path:'test-results/month-check-'+info.project.name+'.png',fullPage:true});
  const detail=info.project.name==='mobile'?page.locator('.mc-mobile-toggle').filter({hasText:'Giro B'}):page.getByRole('button',{name:'Details zu Giro B'});
  await expect(detail).toHaveAttribute('aria-expanded','true');
  await detail.focus();await page.keyboard.press('Enter');await expect(detail).toHaveAttribute('aria-expanded','false');
  await detail.press('Enter');await expect(detail).toHaveAttribute('aria-expanded','true');
  const scope=info.project.name==='mobile'?page.locator('#mc-mobile-bank-b'):page.locator('#mc-selected');
  await scope.locator('summary').click();
  await expect(scope.getByText('Anfangssaldo · 31.07.2026')).toBeVisible();
  await expect(scope.getByText('Nicht prüfbar',{exact:true}).first()).toBeVisible();
  await page.getByRole('button',{name:'Vorheriger Monat',exact:true}).click();
  await expect(page.getByLabel('Prüfmonat',{exact:true})).toHaveValue('2026-07');
  await page.goBack();await expect(page.getByLabel('Prüfmonat',{exact:true})).toHaveValue('2026-08');
  await page.getByLabel('Prüfmonat',{exact:true}).selectOption('2026-06');
  await expect(page).toHaveURL(/checkMonth=2026-06/);
  await expect(page.getByLabel('Prüfmonat',{exact:true})).toHaveValue('2026-06');
  expect(errors).toEqual([]);expect(writes).toEqual([]);
});
test('loading, error, recovery and empty states retain tabs and never show zero balances',async({page},info)=>{
  let release!:()=>void;const wait=new Promise<void>(r=>release=r);
  await page.route('**/api/dashboard/month-check*',async r=>{await wait;await r.fulfill({status:503,json:{error:'Quellen aktuell nicht lesbar.'}});});
  await page.goto('/?reviewTab=month-check#/review');
  await expect(page.getByText('Belege und Kontenzuordnungen werden gelesen …')).toBeVisible();
  release();await expect(page.getByRole('heading',{name:'Monatscheck nicht verfügbar'})).toBeVisible();
  await expect(page.locator('#message')).toHaveText('Quellen aktuell nicht lesbar.');
  await expect(page.getByRole('link',{name:'Buchungen',exact:true})).toBeVisible();
  await page.screenshot({path:'test-results/month-check-error-'+info.project.name+'.png',fullPage:true});
  await page.unroute('**/api/dashboard/month-check*');await page.getByRole('button',{name:'Erneut versuchen'}).click();
  await expect(page.getByText('Keine Kontendaten für diesen Check',{exact:true})).toBeVisible();
  await expect(page.getByText('0,00 €',{exact:true})).toHaveCount(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBe(0);
});
