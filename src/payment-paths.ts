import {createHash} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
export interface PaymentRow {id:string;account:string;date:string;amount:number;payee?:string;notes?:string;transfer_id?:string|null;is_child?:boolean;is_parent?:boolean;starting_balance_flag?:boolean}
interface Account {id:string;name:string;offbudget?:boolean;closed?:boolean}
const kind=(name:string)=>/paypal/i.test(name)?'paypal':/kreditkarte|miles|mastercard|visa/i.test(name)?'card':/giro|dkb|comdirect/i.test(name)?'bank':'other';
const label=(name:string)=>kind(name)==='paypal'?'PayPal':kind(name)==='card'?'Kreditkarte':/gemeinschaft/i.test(name)?'Giro Gemeinschaft':'Girokonto';
export function paymentSuggestions(accounts:Account[],rows:PaymentRow[]){
 const included=accounts.filter(a=>!a.offbudget&&!a.closed&&kind(a.name)!=='other');
 const map=new Map(included.map(a=>[a.id,a]));
 const tx=rows.filter(r=>map.has(r.account)&&!r.transfer_id&&!r.is_child&&!r.is_parent&&!r.starting_balance_flag&&Number.isSafeInteger(r.amount)&&r.amount!==0&&Number.isFinite(Date.parse(r.date)));
 const positives=new Map<number,PaymentRow[]>();for(const r of tx.filter(r=>r.amount>0))positives.set(r.amount,[...(positives.get(r.amount)??[]),r]);
 const matches:Array<{left:PaymentRow;right:PaymentRow;gap:number;proof:string}>=[];
 let truncated=false;
 for(const left of tx.filter(r=>r.amount<0))for(const right of positives.get(-left.amount)??[]){
  if(left.account===right.account)continue;
  const target=kind(map.get(right.account)!.name),origin=kind(map.get(left.account)!.name);
  if(target==='bank'||target===origin)continue;
  const gap=Math.abs(Date.parse(left.date)-Date.parse(right.date))/86400000;
  if(gap>10)continue;
  const text=`${left.payee??''} ${left.notes??''}`;
  const platform=target==='paypal'?/paypal/i.test(text):/miles|kreditkart|mastercard|visa/i.test(text);
  if(!platform)continue; // Amount and date alone never establish even a proposed path.
  if(matches.length>=200){truncated=true;break;}
  matches.push({left,right,gap,proof:target==='paypal'?'PayPal-Hinweis auf der Belastung':'Kartenhinweis auf der Belastung'});
 }
 const counts=new Map<string,number>();for(const m of matches)for(const r of [m.left,m.right])counts.set(r.id,(counts.get(r.id)??0)+1);
 return {suggestions:matches.slice(0,100).map(m=>({
  key:createHash('sha256').update(m.left.id+'|'+m.right.id).digest('hex').slice(0,24),
  from:label(map.get(m.left.account)!.name),to:label(map.get(m.right.account)!.name),
  fromDate:m.left.date,toDate:m.right.date,amountMinor:-m.left.amount,dayDifference:m.gap,
  state:counts.get(m.left.id)!>1||counts.get(m.right.id)!>1?'ambiguous':'suggestion',
  reasons:[m.proof,'Gegenläufige Beträge stimmen auf den Cent','Datumsabstand höchstens zehn Tage'],
  note:'Nur Vorschlag. Verwendung und Gegenbuchung in Actual prüfen; keine Buchung wurde geändert.'
 })),truncated:truncated||matches.length>100};
}
interface PaymentApi {
 init(o:{dataDir:string;serverURL:string;password:string}):Promise<unknown>;downloadBudget(id:string):Promise<unknown>;
 getAccounts():Promise<Account[]>;getPayees():Promise<Array<{id:string;name:string}>>;
 getTransactions(account:string,start:string,end:string):Promise<PaymentRow[]>;shutdown():Promise<void>;
}
export async function readPaymentPaths(options:{serverURL:string;password:string;budgetId:string;loadApi:()=>Promise<PaymentApi>},now=new Date()){
 const dir=mkdtempSync(join(tmpdir(),'finance-payment-read-')),api=await options.loadApi();let initialized=false;
 try{
  await api.init({dataDir:dir,serverURL:options.serverURL,password:options.password});initialized=true;await api.downloadBudget(options.budgetId);
  const accounts=await api.getAccounts(),payees=new Map((await api.getPayees()).map(p=>[p.id,p.name]));
  const end=now.toISOString().slice(0,10),start=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth()-6,1)).toISOString().slice(0,10);
  const rows:PaymentRow[]=[];
  for(const account of accounts.filter(a=>!a.offbudget&&!a.closed&&kind(a.name)!=='other')){
   rows.push(...(await api.getTransactions(account.id,start,end)).map(t=>({...t,account:account.id,payee:payees.get(t.payee??'')??t.payee})));
   if(rows.length>20000)throw new Error('Prüfumfang überschritten');
  }
  return {generatedAt:now.toISOString(),startDate:start,endDate:end,...paymentSuggestions(accounts,rows),readonly:true};
 }finally{if(initialized)await api.shutdown().catch(()=>undefined);rmSync(dir,{recursive:true,force:true});}
}
