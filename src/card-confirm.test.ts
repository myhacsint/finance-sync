import test from 'node:test';import assert from 'node:assert/strict';
import {FinanceDatabase} from './database.js';import {confirmCardDocument} from './card-confirm.js';import {CardPreviews,parseCardPages,cardReceipt} from './card-document.js';
test('card confirmation is explicit, journaled, duplicate-safe and recoverable after external failure',async()=>{
 const db=new FinanceDatabase(':memory:');try{
 const document=parseCardPages([{page:1,method:'native',confidence:1,text:'Abrechnungsdatum\n03. August 2026\n\n01.07.2026 02.07.2026 Buchladen -10,00\nSaldo -10,00'}]);
 const preview=new CardPreviews().create('a'.repeat(64),document);let imports=0,fail=true;
 const ports={preview:async()=>({settlement:{status:'ready' as const,candidateKey:'b'.repeat(64),amountMinor:1000,date:'2026-08-05',sourceAccountName:'Giro',candidates:1}}),import:async()=>{imports++;if(fail)throw new Error('synthetic failure');return{added:1};}};
 await assert.rejects(confirmCardDocument(db,preview,{},ports));await assert.rejects(confirmCardDocument(db,preview,{confirmed:true},ports));assert.equal(imports,0);assert.equal(cardReceipt(db,'2026-08-03'),null);
 await assert.rejects(confirmCardDocument(db,preview,{confirmed:true,settlementKey:'b'.repeat(64)},ports));assert.equal(cardReceipt(db,'2026-08-03')?.state,'PENDING');
 fail=false;await confirmCardDocument(db,preview,{confirmed:true,settlementKey:'b'.repeat(64)},ports);assert.equal(cardReceipt(db,'2026-08-03')?.state,'APPLIED');
 const duplicate=await confirmCardDocument(db,preview,{confirmed:true},ports);assert.equal(duplicate.state,'duplicate');assert.equal(imports,2);
 const altered={...preview,document:{...document,statement:{...document.statement,balanceMinor:-999}}};await assert.rejects(confirmCardDocument(db,altered,{confirmed:true},ports),/Keine Überschreibung/);
 assert.ok(db.getSetting('card-document:2026-08-03')?.includes('USER_CONFIRMED'));
 }finally{db.db.close();}
});
