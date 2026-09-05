import { test, expect } from '@playwright/test';

test.beforeEach(async ({page}) => {
  const response=await page.request.post('/api/session',{headers:{authorization:'Bearer synthetic-browser-test',origin:'http://127.0.0.1:18083'}});
  expect(response.ok()).toBeTruthy();
});

test('Sutor empty state, stable navigation, CSP and session privacy', async ({page}, info) => {
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  const response=await page.goto('/#/sutor-riester');
  await expect(page.getByRole('heading',{name:'Monatlichen Sutor-Depotauszug prüfen'})).toBeVisible();
  expect(response?.headers()['content-security-policy']).toContain("script-src-attr 'none'");
  expect(await page.evaluate(()=>({local:localStorage.getItem('financeToken'),session:sessionStorage.getItem('financeToken')}))).toEqual({local:null,session:null});
  const cookie=(await page.context().cookies()).find(c=>c.name==='finance_session');
  expect(cookie?.httpOnly).toBeTruthy();
  if(info.project.name==='mobile'){
    await page.locator('.mobile-more summary').click();
    await expect(page.locator('.mobile-more-menu').getByRole('link',{name:'Analysen'})).toBeVisible();
    await expect(page.locator('.mobile-more-menu').getByRole('link',{name:'Prüfen'})).toBeVisible();
  }
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBe(0);
  expect(errors).toEqual([]);
});

test('late request cannot replace the current route', async ({page}) => {
  let release!:()=>void;
  const waiting=new Promise<void>(r=>release=r);
  await page.route('**/api/dashboard/wealth-history',async route=>{await waiting;await route.fulfill({status:500,json:{error:'synthetic delayed failure'}}).catch(()=>{});});
  await page.goto('/#/overview');
  await page.locator('a[href="#/assets"]').filter({visible:true}).first().click();
  release();
  await expect(page.getByRole('heading',{name:'Vermögen',exact:true})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Geldfluss',exact:true})).toHaveCount(0);
});

test('cookie writes require same origin', async ({request}) => {
  const login=await request.post('/api/session',{headers:{authorization:'Bearer synthetic-browser-test',origin:'http://127.0.0.1:18083'}});
  expect(login.status()).toBe(200);
  expect((await request.post('/api/backup',{headers:{origin:'https://invalid.example'}})).status()).toBe(403);
});

test('invalid upload field returns an error and the server stays available', async ({page}) => {
  const response=await page.request.post('/api/pension-documents/previews',{
    headers:{origin:'http://127.0.0.1:18083'},
    multipart:{file:{name:'synthetic.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.7 synthetic invalid field '.repeat(10))}}
  });
  expect(response.status()).toBe(400);
  expect((await page.request.get('/health')).status()).toBe(200);
});

test('Council read endpoints remain accessible without token or session', async ({request}) => {
  expect((await request.get('/api/dashboard/status')).status()).toBe(401);
  const portfolio=await request.get('/api/v1/council/portfolio');
  // The empty synthetic config has no crypto data; reaching this domain error
  // proves that no authentication barrier was added to the Council endpoint.
  expect(portfolio.status()).toBe(503);
  expect(await portfolio.json()).toEqual({error:'Kryptoanalyse ist nicht konfiguriert'});
  expect((await request.get('/api/v1/council/investment-cockpit')).status()).toBe(200);
});

test('populated overview charts fit mobile and delegated period controls work', async ({page},info) => {
  const base=await (await page.request.get('/api/dashboard/overview')).json();
  const overview={...base,state:'current',totalMinor:12500000,cash:{amountMinor:2500000,source:'FinanceSync'},investments:{amountMinor:10000000,source:'Ghostfolio',allocation:[]},
    cashflow:{state:'current',source:'Actual',months:[
      {key:'2026-08',label:'Aug',incomeMinor:500000,spentMinor:300000,partial:false},
      {key:'2026-09',label:'Sep',incomeMinor:400000,spentMinor:200000,partial:true}
    ],range:{months:2,offset:0,start:'2026-08',end:'2026-09',endPartial:true}},
    spending:{state:'current',source:'Actual',month:'2026-08',monthLabel:'August',monthOffset:0,latestMonth:'2026-08',totalMinor:300000,categories:[{label:'Lebensmittel',amountMinor:300000}],remainingMinor:0}};
  await page.route('**/api/dashboard/overview*',r=>r.fulfill({json:overview}));
  await page.route('**/api/dashboard/wealth-history*',r=>r.fulfill({json:{
    generatedAt:'2026-09-05T12:00:00Z',
    coverage:{start:'2026-08-31',completeFrom:'2026-08-31',note:'Synthetischer Prüfstand'},
    points:[{date:'2026-08-31',cashMinor:2000000,investmentsMinor:10000000,totalMinor:12000000,quality:'reconstructed'},{date:'2026-09-05',cashMinor:2500000,investmentsMinor:10000000,totalMinor:12500000,quality:'measured'}]
  }}));
  await page.goto('/#/overview');
  await expect(page.getByRole('heading',{name:'Geldfluss',exact:true})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBe(0);
  await expect(page.locator('svg[aria-label*="Vermögensentwicklung"]')).toBeVisible();
  await page.locator('[data-fh-click="setWealthHistoryRange(\'max\')"]').click();
  await page.screenshot({path:'test-results/overview-'+info.project.name+'.png',fullPage:true});
  await page.locator('#refresh-button').click();
  await expect(page.getByRole('heading',{name:'Geldfluss',exact:true})).toBeVisible();
});
