import test from "node:test";
import assert from "node:assert/strict";
import {checkBankCoverage, type BankRequestEvidence} from "./bank-coverage.js";
const base:BankRequestEvidence={version:1,strategy:"default",requestedFrom:"2026-08-01",requestedTo:"2026-08-31",startedAt:"2026-09-01T06:00:00Z",completedAt:"2026-09-01T06:01:00Z",pages:2,paginationComplete:true,observedFrom:"2026-08-03",observedTo:"2026-08-27",transactions:10};
const check=(rows:BankRequestEvidence[])=>checkBankCoverage([{requestEvidence:{account:rows}}],"account","2026-08-01","2026-08-31");
test("coverage records explicit completed period independently of observed booking dates",()=>{
  assert.equal(check([base]).code,"REQUEST_RANGE_COMPLETE");
  assert.equal(check([{...base,strategy:"longest",requestedTo:null}]).state,"unknown");
  assert.equal(check([{...base,requestedFrom:null}]).state,"unknown");
  assert.equal(check([{...base,completedAt:"2026-08-31T06:00:00Z"}]).state,"unknown");
  assert.equal(check([{...base,paginationComplete:false}]).state,"open");
  assert.equal(check([]).code,"REQUEST_COVERAGE_UNRECORDED");
});
test("adjacent windows combine; missing days and unrelated accounts cannot certify a month",()=>{
  assert.equal(check([{...base,requestedTo:"2026-08-15"},{...base,requestedFrom:"2026-08-16"}]).state,"ok");
  assert.equal(check([{...base,requestedTo:"2026-08-14"},{...base,requestedFrom:"2026-08-16"}]).state,"unknown");
  assert.equal(checkBankCoverage([{requestEvidence:{other:[base]}}],"account","2026-08-01","2026-08-31").state,"unknown");
});
