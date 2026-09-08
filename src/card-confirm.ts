import type {FinanceDatabase} from './database.js';
import {cardReceipt,cardReceiptKey,cardSemanticHash,cardDerivedText,type CardPreview} from './card-document.js';
import type {MilesMoreSettlementPreview} from './miles-more-import.js';
import type {MilesMoreStatement} from './miles-more-statement.js';
interface Ports {
 preview(text:string,date:string):Promise<{settlement:MilesMoreSettlementPreview}>;
 import(text:string,date:string,key:string|undefined,statement:MilesMoreStatement):Promise<{added:number}>;
}
/** Call under the server's single confirmation lock. Persist only confirmed intent. */
export async function confirmCardDocument(db:FinanceDatabase,preview:CardPreview,payload:{confirmed?:boolean;settlementKey?:string},ports:Ports){
 if(payload.confirmed!==true)throw new Error('Explizite Bestätigung fehlt');
 const document=preview.document,date=document.statement.statementDate;
 if(!document.canConfirm)throw new Error('Die Erkennung ist nicht sicher übernehmbar');
 const previous=cardReceipt(db,date),semanticHash=cardSemanticHash(document);
 if(previous&&previous.semanticHash!==semanticHash)throw new Error('Anderer Stand am gleichen Abrechnungsdatum. Keine Überschreibung.');
 if(previous?.state==='APPLIED')return {state:'duplicate',added:0,statementDate:date};
 const text=cardDerivedText(document),current=await ports.preview(text,date);
 if(current.settlement.status!=='already-linked'&&(!payload.settlementKey||payload.settlementKey!==current.settlement.candidateKey))throw new Error('Bitte den passenden Zahlungsweg ausdrücklich bestätigen. Ohne Zuordnung wird nicht importiert, um doppelte Ausgaben zu vermeiden.');
 const receipt={state:'PENDING',hash:preview.hash,semanticHash,confirmedAt:previous?.confirmedAt??new Date().toISOString(),action:'USER_CONFIRMED',document,settlementKey:payload.settlementKey??null};
 db.setSetting(cardReceiptKey(date),JSON.stringify(receipt));
 const imported=await ports.import(text,date,payload.settlementKey,document.statement);
 db.setSetting(cardReceiptKey(date),JSON.stringify({...receipt,state:'APPLIED',appliedAt:new Date().toISOString()}));
 return {state:'applied',added:imported.added,statementDate:date};
}
