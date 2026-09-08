import test from 'node:test';import assert from 'node:assert/strict';
import {paymentSuggestions,type PaymentRow} from './payment-paths.js';
const accounts=[{id:'bank',name:'Girokonto'},{id:'pp',name:'PayPal'},{id:'card',name:'Kreditkarte'}];
const rows:PaymentRow[]=[{id:'private-bank-id',account:'bank',date:'2026-08-01',amount:-10000,payee:'PayPal'},{id:'private-pp-id',account:'pp',date:'2026-08-02',amount:10000}];
test('payment suggestions need platform evidence, opposite amounts, dates and distinct accounts, no writes or identifiers',()=>{
 const r=paymentSuggestions(accounts,rows);assert.equal(r.suggestions.length,1);assert.equal(r.suggestions[0].state,'suggestion');assert.ok(!JSON.stringify(r).includes('private-'));assert.equal(rows[0].transfer_id,undefined);
 assert.equal(paymentSuggestions(accounts,rows.map(t=>({...t,payee:undefined}))).suggestions.length,0);
 assert.equal(paymentSuggestions(accounts,rows.map(t=>({...t,transfer_id:'linked'}))).suggestions.length,0);
 assert.equal(paymentSuggestions(accounts,rows.map(t=>t.amount>0?{...t,date:'2026-08-20'}:t)).suggestions.length,0);
});
test('multiple plausible counterparts are all ambiguous; split and off-budget rows excluded',()=>{
 const r=paymentSuggestions(accounts,[...rows,{...rows[1],id:'second'}]);assert.ok(r.suggestions.every(s=>s.state==='ambiguous'));
 assert.equal(paymentSuggestions(accounts,rows.map(t=>({...t,is_child:true}))).suggestions.length,0);
 assert.equal(paymentSuggestions(accounts.map(a=>({...a,offbudget:true})),rows).suggestions.length,0);
});
