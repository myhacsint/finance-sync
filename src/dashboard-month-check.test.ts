import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import { checkMonthAccount, buildMonthCheck, monthCheckPeriod, result, type MonthAccountInput } from "./dashboard-month-check.js";
import { bankBalanceEvidence, readVerifiedMonthRaw, readMonthEvidence, monthAccountKey } from "./month-check-evidence.js";
import { FinanceDatabase } from "./database.js";
import { readActualSpendingRange } from "./dashboard-spending.js";
import type { AppConfig } from "./types.js";
const now = new Date("2026-09-08T10:00:00Z"), period = monthCheckPeriod("2026-08", now);
function input(overrides: Partial<MonthAccountInput> = {}): MonthAccountInput {
  return {key:"a",label:"Giro A",kind:"bank",currency:"EUR",sourceLabel:"Bank-Rohbelege",lastSuccessAt:null,
    balances:[{date:"2026-07-31",amountMinor:10000,currency:"EUR",type:"CLBD",source:"Bank-Rohbeleg",dayClosed:true}, {date:"2026-08-31",amountMinor:8000,currency:"EUR",type:"CLBD",source:"Bank-Rohbeleg",dayClosed:true}],
    movementMinor:-2000,transactionCount:2,actualMovementMinor:-2000,uncategorized:0,transferLinks:0,hasUnverifiedTransfer:false,
    coverage:result("unknown","Unklar","COVERAGE_UNKNOWN","Kein vollständiger Periodennachweis"),issues:[],...overrides};
}
test("month-check uses Berlin closed calendar months, leap year and rejects invalid future dates",()=>{
  assert.equal(monthCheckPeriod(undefined,new Date("2026-08-31T22:01:00Z")).month,"2026-08");
  assert.equal(monthCheckPeriod(undefined,new Date("2026-08-31T21:59:00Z")).month,"2026-07");
  assert.equal(monthCheckPeriod("2024-02",now).endDate,"2024-02-29");
  assert.equal(monthCheckPeriod("2026-01",now).openingDate,"2025-12-31");
  assert.equal(monthCheckPeriod("2026-03",now).endDate,"2026-03-31");
  for(const month of ["2026-09","2026-13","2026-00","../secret","1999-12",""])assert.throws(()=>monthCheckPeriod(month,now));
});
test("independent closing balances reconcile cents, transfers included and net-zero is not completeness",()=>{
  assert.equal(checkMonthAccount(input(),period).balance.state,"ok");
  assert.equal(buildMonthCheck([input()],period,now).state,"partial");
  assert.equal(checkMonthAccount(input({movementMinor:-1999}),period).evidence.differenceMinor,1);
  assert.equal(checkMonthAccount(input({movementMinor:-1999}),period).balance.state,"difference");
  assert.equal(checkMonthAccount(input({movementMinor:0,balances:input().balances.map(b=>({...b,amountMinor:10000}))}),period).balance.state,"ok");
});
test("available, intraday, missing, conflicting, mixed currencies and mapping ambiguity never pass",()=>{
  for (const dayClosed of [undefined, false]) assert.equal(checkMonthAccount(input({balances:input().balances.map(b=>({...b,dayClosed}))}),period).balance.state,"unknown");
  for(const type of ["CLAV","ITAV","ITBD","UNKNOWN"]){
    assert.equal(checkMonthAccount(input({balances:input().balances.map(b=>({...b,type}))}),period).balance.state,"unknown");
  }
  assert.equal(checkMonthAccount(input({balances:[]}),period).evidence.differenceMinor,null);
  assert.equal(checkMonthAccount(input({balances:[...input().balances,{...input().balances[0],amountMinor:9999}]}),period).balance.code,"BOUNDARY_CONFLICT");
  assert.equal(checkMonthAccount(input({currency:"USD"}),period).balance.state,"unknown");
  assert.equal(checkMonthAccount(input({mappingAmbiguous:true}),period).balance.state,"unknown");
  assert.equal(checkMonthAccount(input({movementMinor:NaN}),period).balance.state,"unknown");
  assert.equal(checkMonthAccount(input({movementMinor:Number.MAX_SAFE_INTEGER}),period).balance.state,"unknown");
});
test("assignment, delivery discrepancy and missing Actual remain independent from balance",()=>{
  assert.equal(checkMonthAccount(input({uncategorized:2}),period).assignment.state,"open");
  assert.equal(checkMonthAccount(input({uncategorized:null}),period).assignment.state,"unknown");
  assert.equal(checkMonthAccount(input({actualMovementMinor:-2001}),period).evidence.actualDifferenceMinor,-1);
  assert.equal(checkMonthAccount(input({actualMovementMinor:-2001}),period).assignment.state,"open");
  assert.equal(checkMonthAccount(input({hasUnverifiedTransfer:true}),period).assignment.state,"open");
});
test("Amazon enrichment has no balance contribution, historical card/paypal gaps cannot be solved by categorization",()=>{
  assert.equal(checkMonthAccount(input({kind:"enrichment"}),period).balance.state,"na");
  for(const kind of ["card","paypal"] as const)assert.equal(buildMonthCheck([input({kind,balances:[],uncategorized:0})],period,now).state,"partial");
  assert.equal(buildMonthCheck([],period,now).state,"empty");
  const before=buildMonthCheck([input()],period,now);
  assert.notEqual(before.fingerprint,buildMonthCheck([input({movementMinor:-2100})],period,now).fingerprint);
  assert.equal(before.fingerprint,buildMonthCheck([input()],period,new Date("2026-09-09")).fingerprint);
});
test("raw bank extraction allows only structured non-PII dated evidence, never a timestamp fallback",()=>{
  const raw={secret:"PRIVATE_SENTINEL",balances:{privateId:{balances:[
    {balance_type:"CLBD",reference_date:"2026-07-31",balance_amount:{amount:"100.01",currency:"EUR"},name:"PRIVATE_SENTINEL"},
    {balance_type:"CLBD",last_change_date_time:"2026-08-31T10:00:00Z",balance_amount:{amount:"100.01",currency:"EUR"}},
    {balance_type:"CLBD",reference_date:"2026-08-31",balance_amount:{amount:"100.001",currency:"EUR"}}
  ]}}};
  const parsed=bankBalanceEvidence(raw,"privateId");
  assert.equal(parsed[0].dayClosed,false);
  assert.equal(bankBalanceEvidence(raw,"privateId","2026-07-31T06:30:00Z")[0].dayClosed,false);
  assert.equal(bankBalanceEvidence(raw,"privateId","2026-07-31T22:01:00Z")[0].dayClosed,true);
  assert.equal(parsed.length,1);assert.equal(parsed[0].amountMinor,10001);
  assert.ok(!JSON.stringify(parsed).includes("PRIVATE_SENTINEL"));assert.ok(!JSON.stringify(parsed).includes("privateId"));
  assert.deepEqual(bankBalanceEvidence(null,"x"),[]);
});
test("local raw reader enforces integrity, traversal and file bounds without altering files",()=>{
  const root=mkdtempSync(join(tmpdir(),"month-proof-"));
  try{
    const body='{"test":true}',hash=createHash("sha256").update(body).digest("hex");
    writeFileSync(join(root,"raw.json"),body);
    assert.deepEqual(readVerifiedMonthRaw(root,"raw.json",hash).raw,{test:true});
    assert.throws(()=>readVerifiedMonthRaw(root,"raw.json","0".repeat(64)));
    symlinkSync("/etc/hosts",join(root,"escape.json"));
    assert.throws(()=>readVerifiedMonthRaw(root,"escape.json",hash));
    writeFileSync(join(root,"big.json"),Buffer.alloc(8*1024*1024+1));
    assert.throws(()=>readVerifiedMonthRaw(root,"big.json",hash));
  }finally{rmSync(root,{recursive:true,force:true});}
});
test("evidence adapter is no-write, handles duplicate mappings and legacy payment sources without guessing",()=>{
  const root=mkdtempSync(join(tmpdir(),"month-db-")),db=new FinanceDatabase(join(root,"test.sqlite"));
  try{
    const config:AppConfig={port:0,timezone:"Europe/Berlin",sources:[{id:"bank",kind:"enable-banking",enabled:true}],actual:{enabled:true,serverUrl:"http://localhost",budgetId:"test",dataDir:root,accountMap:{privateId:"actual"}}};
    db.registerSource("bank","enable-banking",true);
    db.db.prepare("INSERT INTO balances(source_id,account_id,captured_at,amount_minor,currency,raw_hash) VALUES (?,?,?,?,?,?)").run("bank","privateId","2026-08-31",500,"EUR","raw");
    const before=db.db.prepare("SELECT total_changes() AS n").get();
    const a=readMonthEvidence(db,config,root,period,{startDate:period.startDate,endDate:period.endDate,generatedAt:now.toISOString(),lines:[],catalog:[],accounts:[{key:monthAccountKey("actual"),label:"DKB Einzel"},{key:"card",label:"Miles More"},{key:"pp",label:"PayPal"},{key:"az",label:"Amazon"}],monthCheckAccounts:[]});
    assert.deepEqual(db.db.prepare("SELECT total_changes() AS n").get(),before);
    assert.equal(a.length,4);assert.equal(a[0].balances.length,0);
    assert.deepEqual(a.slice(1).map(i=>i.kind),["card","paypal","enrichment"]);
    assert.ok(!JSON.stringify(a).includes("privateId"));
    assert.ok(a.every(i=>i.coverage.state!=="ok"));
    assert.equal(a[3].coverage.state,"na");
    db.db.prepare("INSERT INTO balances(source_id,account_id,captured_at,amount_minor,currency,raw_hash) VALUES (?,?,?,?,?,?)").run("bank","privateId","2026-08-31",500,"USD","raw-usd");
    assert.ok(readMonthEvidence(db,config,root,period,null).every(i=>i.mappingAmbiguous));
  }finally{db.db.close();rmSync(root,{recursive:true,force:true});}
});
test("Actual monthly audit includes refunds and linked transfers once, excludes split children and opening balance, makes no writes",async()=>{
  const calls:string[]=[];
  const snapshot=await readActualSpendingRange({enabled:true,serverUrl:"http://unused",budgetId:"unused",dataDir:"unused",accountMap:{}},period.startDate,period.endDate,now,{
    mode:"review",monthCheck:true,password:"synthetic",loadApi:async()=>({
      async init(){calls.push("init")},async downloadBudget(){calls.push("download")},async shutdown(){calls.push("shutdown")},
      async getAccounts(){return [{id:"a",name:"Giro A"},{id:"off",name:"Vorsorge",offbudget:true}]},
      async getCategories(){return [{id:"c",name:"Einkäufe"}]},async getPayees(){return []},
      async getTransactions(){return [
        {id:"start",account:"a",date:"2026-08-01",amount:10000,starting_balance_flag:true},
        {id:"transfer",account:"a",date:"2026-08-03",amount:-1000,transfer_id:"linked"},
        {id:"refund",account:"a",date:"2026-08-04",amount:500,category:"c"},
        {id:"parent",account:"a",date:"2026-08-05",amount:-300,is_parent:true,subtransactions:[{id:"child",account:"a",date:"2026-08-05",amount:-300,category:"c"}]},
        {id:"child",account:"a",date:"2026-08-05",amount:-300,is_child:true,category:"c"}
      ]}
    })
  });
  assert.equal(snapshot.monthCheckAccounts?.[0].movementMinor,-800);
  assert.equal(snapshot.monthCheckAccounts?.[0].transactions,3);
  assert.equal(snapshot.monthCheckAccounts?.[0].transferLinks,1);
  assert.equal(snapshot.monthCheckAccounts?.length,1);
  assert.deepEqual(calls,["init","download","shutdown"]);
});
test("archived boundary evidence is hash-verified, reconciled read-only and fails closed on corruption",()=>{
  const root=mkdtempSync(join(tmpdir(),"month-archive-")),db=new FinanceDatabase(join(root,"test.sqlite"));
  try{
    const config:AppConfig={port:0,timezone:"Europe/Berlin",sources:[{id:"bank",kind:"enable-banking",enabled:true}],actual:{enabled:true,serverUrl:"http://localhost",budgetId:"test",dataDir:root,accountMap:{privateId:"actual"}}};
    db.registerSource("bank","enable-banking",true);
    db.db.prepare("INSERT INTO balances(source_id,account_id,captured_at,amount_minor,currency,raw_hash) VALUES (?,?,?,?,?,?)").run("bank","privateId","2026-08-31",8000,"EUR","raw");
    db.db.prepare("INSERT INTO transactions(source_id,account_id,booked_at,amount_minor,currency,raw_hash,identity_key) VALUES (?,?,?,?,?,?,?)").run("bank","privateId","2026-08-10",-2000,"EUR","raw","tx");
    const raw=JSON.stringify({privateName:"PRIVATE_SENTINEL",balances:{privateId:{balances:input().balances.map(b=>({balance_type:b.type,reference_date:b.date,balance_amount:{amount:(b.amountMinor/100).toFixed(2),currency:b.currency}}))}}});
    const hash=createHash("sha256").update(raw).digest("hex");writeFileSync(join(root,"raw.json"),raw);
    db.db.prepare("INSERT INTO raw_objects(hash,source_id,fetched_at,media_type,relative_path) VALUES (?,?,?,?,?)").run(hash,"bank","2026-09-01T12:00:00Z","application/json","raw.json");
    const before=db.db.prepare("SELECT total_changes() AS n").get();
    const checked=buildMonthCheck(readMonthEvidence(db,config,root,period,null),period,now);
    assert.equal(checked.accounts[0].balance.state,"ok");assert.equal(checked.accounts[0].evidence.differenceMinor,0);
    assert.equal(checked.accounts[0].assignment.state,"unknown");
    assert.ok(!/privateId|PRIVATE_SENTINEL|raw.json/.test(JSON.stringify(checked)));
    assert.deepEqual(db.db.prepare("SELECT total_changes() AS n").get(),before);
    writeFileSync(join(root,"raw.json"),"corrupt");
    const broken=buildMonthCheck(readMonthEvidence(db,config,root,period,null),period,now);
    assert.equal(broken.accounts[0].balance.state,"unknown");assert.equal(broken.accounts[0].evidence.differenceMinor,null);
    assert.deepEqual(db.db.prepare("SELECT total_changes() AS n").get(),before);
  }finally{db.db.close();rmSync(root,{recursive:true,force:true});}
});
