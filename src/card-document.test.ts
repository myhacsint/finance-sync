import test from 'node:test';
import assert from 'node:assert/strict';
import {parseCardPages,cardDerivedText,cardSemanticHash,CardPreviews} from './card-document.js';
const text=`Umsatzabrechnung
Abrechnungsdatum
03. August 2026
PRIVATE_HEADER_SENTINEL 9999999999999999
03.07.2026 06.07.2026 Buchladen -10,00
04.07.2026 06.07.2026 Café -2,00
Saldo -12,00`;
const page=(textValue=text)=>[{page:1,text:textValue,method:'native' as const,confidence:1}];
test('card PDF extracts named German date, derived-only rows and explicit coverage only',()=>{
 const d=parseCardPages(page());assert.equal(d.statement.statementDate,'2026-08-03');assert.equal(d.statement.transactions.length,2);assert.equal(d.canConfirm,true);assert.equal(d.period,null);
 assert.ok(!JSON.stringify(d).includes('PRIVATE_HEADER_SENTINEL'));assert.ok(!JSON.stringify(d).includes('9999999999999999'));
 assert.equal(cardSemanticHash(d),cardSemanticHash(parseCardPages(page(text.replace('PRIVATE_HEADER_SENTINEL','OTHER_HEADER')))));
 assert.match(cardDerivedText(d),/Saldo -12,00/);
 const withPeriod=parseCardPages(page(text+'\nAbrechnungszeitraum: 01.07.2026 bis 31.07.2026'));assert.deepEqual(withPeriod.period,{from:'2026-07-01',to:'2026-07-31'});
});
test('uncertain OCR and repeated indistinguishable purchases block confirm; contradictory totals/dates fail',()=>{
 assert.equal(parseCardPages([{...page()[0],method:'ocr',confidence:0.99}]).canConfirm,false);
 assert.throws(()=>parseCardPages(page(text.replace('Saldo -12,00','Saldo -11,00'))));
 assert.throws(()=>parseCardPages(page(text+'\nAbrechnungsdatum\n04. August 2026')));
 assert.throws(()=>parseCardPages(page(text.replace('03. August 2026','31. Februar 2026'))));
 assert.equal(parseCardPages(page(text.replace('04.07.2026 06.07.2026 Café -2,00','03.07.2026 06.07.2026 Buchladen -10,00').replace('Saldo -12,00','Saldo -20,00'))).canConfirm,false);
});
test('card previews are bounded, disposable and retain no PDF or full text',()=>{
 const store=new CardPreviews(),d=parseCardPages(page());const p=store.create('a'.repeat(64),d);assert.equal(store.get(p.id),p);store.delete(p.id);assert.throws(()=>store.get(p.id));
 for(let i=0;i<8;i++)store.create(String(i).repeat(64),d);assert.throws(()=>store.create('f'.repeat(64),d));
});
test('explicit positive refunds are included, not silently dropped',()=>{
 const d=parseCardPages(page(text.replace('Saldo -12,00','07.07.2026 08.07.2026 Buchladen +5,00\nSaldo -7,00')));
 assert.equal(d.statement.transactions.length,3);assert.equal(d.statement.balanceMinor,-700);
});
