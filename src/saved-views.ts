import { randomUUID } from "node:crypto";
import type { FinanceDatabase } from "./database.js";

export interface SavedView { id:string; name:string; filters:Record<string,string>; updatedAt:string }
const key = "dashboard:saved-expense-views:v1";
const rules:Record<string,RegExp> = {
  month:/^\d{4}-(0[1-9]|1[0-2])$/,
  period:/^(month|quarter|year|ytd)$/,
  quarter:/^\d{4}-Q[1-4]$/,
  year:/^20\d{2}$/,
  sort:/^(date|merchant|amount)-(asc|desc)$/,
  account:/^(all|account-[a-f0-9]{12})$/,
  category:/^(all|uncategorized|category-[a-f0-9]{12})$/
};
export function validateView(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Ungültige Ansicht");
  const value = input as {name?:unknown;filters?:unknown};
  const name=String(value.name ?? "").trim();
  if (!name || name.length>60 || /[<>\x00-\x1f]|\b\d{6,}\b/.test(name)) throw new Error("Bitte einen kurzen Namen ohne persönliche Kennzeichen eingeben");
  if (!value.filters || typeof value.filters!=="object" || Array.isArray(value.filters)) throw new Error("Ungültige Filter");
  const filters:Record<string,string>={};
  for(const [field,raw] of Object.entries(value.filters)) {
    if(!rules[field] || typeof raw!=="string" || (raw && !rules[field].test(raw))) throw new Error("Nicht unterstützter Ansichtsfilter");
    if(raw)filters[field]=raw;
  }
  return {name,filters};
}
export function listSavedViews(db:FinanceDatabase):SavedView[] {
  try { const rows=JSON.parse(db.getSetting(key) ?? "[]"); return Array.isArray(rows) ? rows.slice(0,30) : []; } catch { return []; }
}
export function saveView(db:FinanceDatabase,input:unknown):SavedView {
  const valid=validateView(input);
  return db.atomic(()=>{
    const rows=listSavedViews(db);
    if(rows.length>=30)throw new Error("Maximal 30 Ansichten; bitte zuerst eine entfernen");
    if(rows.some(r=>r.name.toLocaleLowerCase("de")===valid.name.toLocaleLowerCase("de")))throw new Error("Dieser Ansichtsname existiert bereits");
    const row={...valid,id:randomUUID(),updatedAt:new Date().toISOString()};
    db.setSetting(key,JSON.stringify([...rows,row]));return row;
  });
}
export function deleteView(db:FinanceDatabase,id:string) {
  if(!/^[a-f0-9-]{36}$/.test(id))throw new Error("Ungültige Ansicht");
  db.atomic(()=>db.setSetting(key,JSON.stringify(listSavedViews(db).filter(r=>r.id!==id))));
}
