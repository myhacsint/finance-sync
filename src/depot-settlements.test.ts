import test from 'node:test';
import assert from 'node:assert/strict';
import { FinanceDatabase } from './database.js';
import { depotSettlementReport } from './depot-settlements.js';

function fixture(delta = 0, memo = 'Wertpapierabrechnung Stück 3 ISIN US0378331005') {
  const db = new FinanceDatabase(':memory:');
  db.importActivities([{sourceId:'test',sourceActivityId:'unique',accountId:'depot',occurredAt:'2026-08-20',type:'DEPOT_RECE',symbol:'US0378331005',quantityAtomic:'3',atomicDecimals:0,amountMinor:30000n,currency:'EUR',rawHash:'synthetic'}]);
  db.importTransactions([{sourceId:'test',sourceTransactionId:'cash',accountId:'giro',bookedAt:'2026-08-21',amountMinor:BigInt(-30000-delta),currency:'EUR',payee:'DKB',memo,rawHash:'synthetic'}]);
  return db;
}
test('exact evidence matches without changing transactions',()=>{
 const db=fixture(); const before=db.query('SELECT * FROM transactions');
 assert.equal(depotSettlementReport(db)[0].status,'EVIDENCE_MATCH');
 assert.deepEqual(db.query('SELECT * FROM transactions'),before);db.close();
});
test('difference is review not inferred fee',()=>{
 const db=fixture(1000);const r=depotSettlementReport(db)[0];
 assert.equal(r.status,'REVIEW_REQUIRED');assert.equal(r.differenceMinor,1000);assert.equal(r.feeMinor,null);db.close();
});
test('amount alone is never enough',()=>{
 const db=fixture(0,'');assert.equal(depotSettlementReport(db)[0].status,'REVIEW_REQUIRED');db.close();
});
test('competing candidates are ambiguous',()=>{
 const db=fixture();db.importTransactions([{sourceId:'test',sourceTransactionId:'cash2',accountId:'other',bookedAt:'2026-08-21',amountMinor:-30000n,currency:'EUR',payee:'DKB',rawHash:'synthetic'}]);
 assert.equal(depotSettlementReport(db)[0].status,'AMBIGUOUS');db.close();
});
test('same reference is idempotent but economic corrections fail closed',()=>{
 const db=fixture();const activity={sourceId:'test',sourceActivityId:'unique',accountId:'depot',occurredAt:'2026-08-20',type:'DEPOT_RECE',symbol:'US0378331005',quantityAtomic:'3',atomicDecimals:0,amountMinor:30000n,currency:'EUR',rawHash:'another-report'};
 assert.equal(db.importActivities([activity]),0);
 assert.throws(()=>db.importActivities([{...activity,quantityAtomic:'4'}]),/Widersprüchlicher Depotumsatz/);
 assert.equal(db.query('SELECT COUNT(*) AS n FROM investment_activities')[0].n,1);db.close();
});
function policy(db:FinanceDatabase, pairs:unknown[]=[]){db.setSetting('dkb-depot-fee-policy:v1',JSON.stringify({sourceId:'test',confirmedAt:'2026-09-16T08:00:00Z',evidence:'USER_CONFIRMED',feeMinor:1000,currency:'EUR',pairs}));}
test('explicit fee rule only accepts correct sign and full securities evidence',()=>{
 const db=fixture(1000);policy(db);const result=depotSettlementReport(db)[0];
 assert.equal(result.status,'CONFIRMED_WITH_FEE');assert.equal(result.feeMinor,1000);assert.equal(result.feeEvidence,'USER_CONFIRMED_RULE');db.close();
 for(const [delta,memo] of [[-1000,'Wertpapierabrechnung Stück 3 ISIN US0378331005'],[1000,''],[900,'Wertpapierabrechnung Stück 3 ISIN US0378331005']] as const){
  const d=fixture(delta,memo);policy(d);assert.equal(depotSettlementReport(d)[0].feeMinor,null);d.close();
 }
});
test('specific confirmation binds complete economics and cannot survive changed data',()=>{
 const db=fixture(1000,'');const r=depotSettlementReport(db)[0];
 const pair={activityId:r.activityId,bankTransactionId:r.bankTransactionId,amountMinor:30000,bankAmountMinor:-31000,symbol:'US0378331005',quantityAtomic:'3',atomicDecimals:0,date:'2026-08-20'};
 policy(db,[pair]);assert.equal(depotSettlementReport(db)[0].feeEvidence,'USER_CONFIRMED_TRANSACTION');
 policy(db,[{...pair,quantityAtomic:'4'}]);assert.equal(depotSettlementReport(db)[0].feeMinor,null);db.close();
});
test('fee rule does not resolve multiple candidate ambiguity or another source',()=>{
 const db=fixture(1000);policy(db);db.importTransactions([{sourceId:'test',sourceTransactionId:'cash2',accountId:'other',bookedAt:'2026-08-21',amountMinor:-31000n,currency:'EUR',payee:'DKB',rawHash:'synthetic'}]);assert.equal(depotSettlementReport(db)[0].feeMinor,null);db.close();
 const other=fixture(1000);policy(other);other.db.prepare("UPDATE investment_activities SET source_id='other'").run();assert.equal(depotSettlementReport(other)[0].feeMinor,null);other.close();
});
