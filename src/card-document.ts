import {createHash,randomUUID} from 'node:crypto';
import type {PensionTextPage} from './drv-pension-parser.js';
import {parseMilesMoreStatement,type MilesMoreStatement} from './miles-more-statement.js';
import type {FinanceDatabase} from './database.js';
const VERSION='miles-pdf-v1';
const iso=(s:string)=>{const [d,m,y]=s.split('.');return `${y}-${m}-${d}`;};
const months=['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
const clean=(s:string)=>s.replace(/\b[A-Z]{2}\d{2}(?:\s?\d){11,30}\b/gi,'••••').replace(/\b\d{6,}\b/g,'••••').replace(/[\x00-\x1f]/g,' ').slice(0,160);
export interface CardDocument {
 statement:MilesMoreStatement;statementDatePage:number;period:{from:string;to:string}|null;
 provenance:Array<{page:number;method:string;confidence:number}>;warnings:string[];canConfirm:boolean;extractionVersion:string;
}
export function parseCardPages(pages:PensionTextPage[]):CardDocument {
 const dates:Array<{date:string;page:number}>=[];
 for(const page of pages){const lines=page.text.split(/\r?\n/);for(let i=0;i<lines.length;i++){
  if(!/Abrechnungsdatum/i.test(lines[i]))continue;
  const segment=lines.slice(i,i+3).filter(l=>!/^\s*\d{2}\.\d{2}\.\d{4}\s+\d{2}\.\d{2}\.\d{4}/.test(l)).join('\n');
  for(const m of segment.matchAll(/\b(\d{2})\.\s*(Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)\s+(20\d{2})\b/g))dates.push({date:`${m[3]}-${String(months.indexOf(m[2])+1).padStart(2,'0')}-${m[1]}`,page:page.page});
  for(const m of segment.matchAll(/\b\d{2}\.\d{2}\.20\d{2}\b/g))dates.push({date:iso(m[0]),page:page.page});
 }}
 const unique=[...new Set(dates.map(d=>d.date))];
 if(unique.length!==1)throw new Error('Abrechnungsdatum fehlt oder ist mehrdeutig. Bitte Original-PDF prüfen.');
 const statement=parseMilesMoreStatement(pages.map(p=>p.text).join('\n'),unique[0]);
 const candidateLines=pages.flatMap(p=>p.text.split(/\r?\n/)).filter(l=>/^\s*\d{2}\.\d{2}\.\d{4}\s+\d{2}\.\d{2}\.\d{4}/.test(l));
 if(candidateLines.length!==statement.transactions.length)throw new Error('Nicht alle Umsatzzeilen sind eindeutig lesbar');
 if(new Date(statement.statementDate+'T12:00:00Z').toISOString().slice(0,10)!==statement.statementDate)throw new Error('Ungültiges Abrechnungsdatum');
 if(statement.transactions.some(t=>!Number.isSafeInteger(t.amountMinor)||![t.purchaseDate,t.bookingDate].every(d=>Number.isFinite(Date.parse(d))&&new Date(d+'T12:00:00Z').toISOString().slice(0,10)===d)||t.bookingDate>statement.statementDate||t.purchaseDate>t.bookingDate))throw new Error('Buchungsdatum oder Betrag ist nicht plausibel');
 const warnings:string[]=[];
 const periods=pages.flatMap(p=>[...p.text.matchAll(/(?:Abrechnungszeitraum|Zeitraum)\s*:?\s*(\d{2}\.\d{2}\.\d{4})\s*(?:bis|[-–])\s*(\d{2}\.\d{2}\.\d{4})/gi)].map(m=>({from:iso(m[1]),to:iso(m[2])})));
 const period=periods.length && periods.every(p=>JSON.stringify(p)===JSON.stringify(periods[0])) ? periods[0] : null;
 if(period && (period.from>period.to||period.to>statement.statementDate||![period.from,period.to].every(d=>Number.isFinite(Date.parse(d))&&new Date(d+'T12:00:00Z').toISOString().slice(0,10)===d)))throw new Error('Abrechnungszeitraum ist widersprüchlich');
 if(!period)warnings.push('Kein expliziter Abrechnungszeitraum erkannt. Buchungsdaten und Abrechnungsdatum sind kein Vollständigkeitsnachweis für einen Kalendermonat.');
 const uncertain=pages.some(p=>p.method==='ocr');
 if(uncertain)warnings.push('OCR-Erkennung: im ersten sicheren Ausbau nicht übernehmbar. Bitte das digital erzeugte Original-PDF verwenden.');
 if(new Set(statement.transactions.map(t=>t.importedId)).size!==statement.transactions.length)warnings.push('Identische Umsatzzeilen: ohne eindeutige Referenzen ist keine sichere Übernahme möglich.');
 // Only allowlisted transaction fields survive. Header, names and account numbers never do.
 for(const t of statement.transactions){t.payee=clean(t.payee);t.rawPayee=clean(t.rawPayee);}
 return {statement,statementDatePage:dates[0].page,period,provenance:pages.map(p=>({page:p.page,method:p.method,confidence:p.confidence})),warnings,
  canConfirm:!uncertain&&new Set(statement.transactions.map(t=>t.importedId)).size===statement.transactions.length,
  extractionVersion:VERSION};
}
export function cardDerivedText(document:CardDocument):string {
 const de=(v:string)=>v.split('-').reverse().join('.');
 const amount=(v:number)=>(v/100).toFixed(2).replace('.',',');
 return document.statement.transactions.map(t=>`${de(t.purchaseDate)} ${de(t.bookingDate)} ${t.rawPayee} ${amount(t.amountMinor)}`).join('\n')+`\nSaldo ${amount(document.statement.balanceMinor)}`;
}
export interface CardPreview {id:string;hash:string;createdAt:string;expiresAt:string;document:CardDocument}
export class CardPreviews {
 private values=new Map<string,CardPreview>();
 private timer=setInterval(()=>this.prune(),60_000).unref();
 private prune(){for(const [k,v] of this.values)if(Date.parse(v.expiresAt)<Date.now())this.values.delete(k);}
 create(hash:string,document:CardDocument){this.prune();if(this.values.size>=8)throw new Error('Zu viele offene Vorschauen');const now=Date.now();const row={id:randomUUID(),hash,document,createdAt:new Date(now).toISOString(),expiresAt:new Date(now+20*60_000).toISOString()};this.values.set(row.id,row);return row;}
 get(id:string){this.prune();const value=this.values.get(id);if(!value)throw new Error('Vorschau abgelaufen; bitte erneut hochladen');return value;}
 delete(id:string){this.values.delete(id);}
}
export const cardReceiptKey=(date:string)=>`card-document:${date}`;
export const cardSemanticHash=(document:CardDocument)=>createHash('sha256').update(cardDerivedText(document)).digest('hex');
export function cardReceipt(db:FinanceDatabase,date:string):{state:string;hash:string;semanticHash:string;confirmedAt:string}|null{
 const value=db.getSetting(cardReceiptKey(date));return value?JSON.parse(value):null;
}
export function listCardReceipts(db:FinanceDatabase){
 return db.query("SELECT value FROM settings WHERE key LIKE 'card-document:%' ORDER BY key DESC LIMIT 120").flatMap(row=>{
  try {const r=JSON.parse(String(row.value)) as {state:string;confirmedAt:string;document:CardDocument};
   return [{state:r.state,confirmedAt:r.confirmedAt,statementDate:r.document.statement.statementDate,period:r.document.period,bookings:r.document.statement.transactions.length,balanceMinor:r.document.statement.balanceMinor}];
  }catch{return [];}
 });
}
