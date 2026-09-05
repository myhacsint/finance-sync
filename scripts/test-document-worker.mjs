// Container integration gate: synthetic documents only; no production mounts.
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { extractSutorPdfDocument } from "../dist/pension-extractor.js";
import { runParserWorker } from "../dist/parser-worker-client.js";
import { scanMalware } from "../dist/pension-security.js";

function pdf(pages=12, active=false){
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R "+(active?"/OpenAction << /S /JavaScript /JS (test) >> ":"")+">>",
    "<< /Type /Pages /Count "+pages+" /Kids ["+Array.from({length:pages},(_,i)=>(4+i*2)+" 0 R").join(" ")+"] >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"
  ];
  for(let page=0;page<pages;page++){
    const text=page===0?"BT /F1 8 Tf 20 700 Td 12 TL "+Array.from({length:12},()=>"(Synthetic document cover without personal data.) Tj T*").join(" ")+" ET":"";
    objects.push("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 800] /Resources << /Font << /F1 3 0 R >> >> /Contents "+(5+page*2)+" 0 R >>");
    objects.push("<< /Length "+text.length+" >>\nstream\n"+text+"\nendstream");
  }
  let body="%PDF-1.4\n";const offsets=[0];
  objects.forEach((obj,index)=>{offsets.push(Buffer.byteLength(body));body+=(index+1)+" 0 obj\n"+obj+"\nendobj\n";});
  const xref=Buffer.byteLength(body);
  body+="xref\n0 "+offsets.length+"\n0000000000 65535 f \n"+offsets.slice(1).map(n=>String(n).padStart(10,"0")+" 00000 n \n").join("");
  body+="trailer\n<< /Size "+offsets.length+" /Root 1 0 R >>\nstartxref\n"+xref+"\n%%EOF\n";
  return body;
}
const root=mkdtempSync(join(process.env.FINANCE_PARSER_WORK_DIR,"finance-pension-gate-"));
try{
  const file=join(root,"synthetic.pdf");
  writeFileSync(file,pdf(),{mode:0o600});
  const result=await extractSutorPdfDocument(file,root);
  assert.equal(result.pageCount,12);
  assert.equal(result.pages[0].method,"native");
  assert.equal(result.pages[11].method,"ocr");
  writeFileSync(file,pdf(1,true),{mode:0o600});
  await assert.rejects(extractSutorPdfDocument(file,root),/PDF_ACTIVE_CONTENT/);
  writeFileSync(file,pdf(13),{mode:0o600});
  await assert.rejects(extractSutorPdfDocument(file,root),/PDF_TOO_MANY_PAGES/);
  writeFileSync(file,pdf(1),{mode:0o600});
  const restricted=join(root,"restricted.pdf");
  await runParserWorker("/usr/bin/qpdf",["--encrypt","","owner-synthetic","256","--extract=n","--print=full","--",file,restricted]);
  assert.equal((await extractSutorPdfDocument(restricted,root)).pageCount,1);
  const locked=join(root,"locked.pdf");
  await runParserWorker("/usr/bin/qpdf",["--encrypt","user-synthetic","owner-synthetic","256","--",file,locked]);
  await assert.rejects(extractSutorPdfDocument(locked,root),/PDF_ENCRYPTED/);
  await assert.rejects(runParserWorker("/usr/bin/curl",["https://example.com"]),/SECURITY_PARSER_COMMAND/);
  const eicar=join(root,"synthetic-antivirus-test.txt");
  writeFileSync(eicar,Buffer.from("WDVPIVAlQEFQWzRcUFpYNTQoUF4pN0NDKTd9JEVJQ0FSLVNUQU5EQVJELUFOVElWSVJVUy1URVNULUZJTEUhJEgrSCo=","base64"),{mode:0o600});
  await assert.rejects(scanMalware(eicar),/SECURITY_MALWARE_DETECTED/);
  assert.equal(readdirSync(join(process.env.FINANCE_PARSER_WORK_DIR,".queue")).filter(n=>/\.(request|result|tmp)$/.test(n)).length,0);
  console.log("PASS: native/mixed-12-page/OCR, active content, page limit, PDF permissions/password, command allowlist, malware fail-closed, queue cleanup");
}finally{rmSync(root,{recursive:true,force:true});}
