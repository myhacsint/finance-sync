const icons={
  overview:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M4 13h6V4H4v9Zm0 7h6v-4H4v4Zm10 0h6v-9h-6v9Zm0-16v4h6V4h-6Z"/></svg>',
  expenses:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M4 5h16v14H4zM8 9h8M8 13h5"/></svg>',
  assets:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M4 19V9m5 10V5m6 14v-7m5 7V3"/></svg>',
  analysis:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m4 17 5-5 4 3 7-9M16 6h4v4"/></svg>',
  status:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="m8.5 12 2.2 2.2 4.8-5"/></svg>',
  bank:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m3 9 9-5 9 5M5 10v7m4-7v7m6-7v7m4-7v7M3 20h18"/></svg>',
  wallet:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M4 7h15a2 2 0 0 1 2 2v9H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h13v3M16 12h5"/></svg>',
  manual:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M6 3h9l4 4v14H6zM15 3v5h5M9 13h6M9 17h4"/></svg>',
  archive:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M4 7h16v13H4zM3 3h18v4H3zM9 11h6"/></svg>',
  chevron:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m7 10 5 5 5-5"/></svg>',
  search:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="11" cy="11" r="6"/><path d="m16 16 4 4"/></svg>',
  check:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="m6 12 4 4 8-9"/></svg>',
  warning:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 4 3 20h18L12 4Zm0 5v5m0 3v.1"/></svg>'
};
const navItems=[
  {label:"Übersicht",icon:"overview",view:"overview"},
  {label:"Ausgaben",icon:"expenses",view:"spending"},
  {label:"Vermögen",icon:"assets",view:"assets"},
  {label:"Prüfen",icon:"check",view:"review"},
  {label:"Planen",icon:"analysis",view:"lab"},
  {label:"Analysen",icon:"analysis",view:"analyses"},
  {label:"Status",icon:"status",view:"status"}
];
function activeView(){const hash=location.hash;return hash==="#/sutor-riester"?"sutor":hash==="#/pension-documents"?"pension":hash==="#/data-status"?"status":hash==="#/spending"?"spending":hash==="#/assets"?"assets":hash==="#/review"?"review":hash==="#/decision-lab"?"lab":hash==="#/analyses"?"analyses":"overview"}
function viewHref(view){return view==="status"?"#/data-status":view==="spending"?"#/spending":view==="assets"?"#/assets":view==="review"?"#/review":view==="lab"?"#/decision-lab":view==="analyses"?"#/analyses":"#/overview"}
function navMarkup(compact=false){const current=activeView();const navCurrent=current==="pension"||current==="sutor"?"status":current;const compactViews=current==="pension"||current==="sutor"||current==="status"?["overview","spending","assets","lab","status"]:["overview","spending","assets","review","lab"];const items=compact?navItems.filter(item=>compactViews.includes(item.view)):navItems;return items.map(item=>item.view?'<a class="nav-item" href="'+viewHref(item.view)+'"'+(item.view===navCurrent?' aria-current="page"':'')+'>'+icons[item.icon]+'<span>'+item.label+'</span></a>':'<button class="nav-item" type="button" disabled title="Folgt in einem späteren Schritt">'+icons[item.icon]+'<span>'+item.label+'</span></button>').join("")}
function renderNavigation(){document.getElementById("desktop-nav").innerHTML=navMarkup();document.getElementById("mobile-nav").innerHTML=navMarkup(true)}
renderNavigation();

const legacyToken=localStorage.getItem("financeToken");
if(legacyToken&&!sessionStorage.getItem("financeToken"))sessionStorage.setItem("financeToken",legacyToken);
localStorage.removeItem("financeToken");
let token=sessionStorage.getItem("financeToken")||"";
let currentPreview=null;
let currentMilesMorePreview=null;
let currentExpenseMonth="";
let currentAnalysisData=null;
let currentRecurringData=null;
let currentRecurringDetail=null;
let currentOptimizationData=null;
let currentCryptoData=null;
let currentDecisionLabData=null;
let currentReviewData=null;
let currentWealthHistory=null;
let wealthHistoryRange="1y";
let currentNewsletterData=null;
let currentPensionPreview=null;
let currentPensionImpact=null;
let currentPensionFileName="";
let currentSutorPreview=null;
let currentSutorRevisions=[];

function headerAction(){if(activeView()==="analyses"&&analysisSelection().view==="expense-structure")exportAnalysisCsv();else refresh(true)}

function requestToken(){
  const request=document.getElementById("token-request");
  const input=document.getElementById("token-input");
  request.setAttribute("aria-hidden","false");
  input.focus();
  return false;
}
function submitToken(event){
  event.preventDefault();
  const input=document.getElementById("token-input");
  const supplied=input.value.trim();
  if(!supplied)return;
  token=supplied;
  sessionStorage.setItem("financeToken",token);
  input.value="";
  document.getElementById("token-request").setAttribute("aria-hidden","true");
  refresh();
}
document.getElementById("token-form").addEventListener("submit",submitToken);
async function call(path,options={},retry=true){
  if(!token&&!requestToken())throw new Error("Für die Finance-Hub-Daten wird das Verwaltungstoken benötigt.");
  const headers={authorization:"Bearer "+token,...options.headers};
  if(!(options.body instanceof FormData)&&!headers["content-type"])headers["content-type"]="application/json";
  const response=await fetch(path,{...options,headers});
  let result={};
  try{result=await response.json()}catch{}
  if(response.status===401&&retry){sessionStorage.removeItem("financeToken");token="";if(requestToken())return call(path,options,false)}
  if(!response.ok)throw new Error(result.error||response.statusText);
  return result;
}
function esc(value){return String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]))}
function encoded(value){return encodeURIComponent(String(value))}
function formatDate(value,withTime=false){
  if(!value)return "Noch nicht vorhanden";
  const date=new Date(value);
  if(Number.isNaN(date.getTime()))return "Noch nicht vorhanden";
  return new Intl.DateTimeFormat("de-DE",withTime?{dateStyle:"medium",timeStyle:"short"}:{dateStyle:"medium"}).format(date);
}
function relativeTime(value){
  if(!value)return "Noch nie";
  const delta=new Date(value).getTime()-Date.now();
  if(Number.isNaN(delta))return "Unbekannt";
  const abs=Math.abs(delta);
  const formatter=new Intl.RelativeTimeFormat("de-DE",{numeric:"auto"});
  if(abs<60_000)return "gerade eben";
  if(abs<3_600_000)return formatter.format(Math.round(delta/60_000),"minute");
  if(abs<86_400_000)return formatter.format(Math.round(delta/3_600_000),"hour");
  return formatter.format(Math.round(delta/86_400_000),"day");
}
function formatBytes(bytes){
  if(!Number.isFinite(bytes))return "Unbekannt";
  const units=["B","KB","MB","GB","TB"];
  let value=bytes,index=0;
  while(value>=1024&&index<units.length-1){value/=1024;index+=1}
  return new Intl.NumberFormat("de-DE",{maximumFractionDigits:value>=100?0:1}).format(value)+" "+units[index];
}
function moneyWhole(minor){if(!Number.isFinite(minor))return "Nicht verfügbar";return new Intl.NumberFormat("de-DE",{style:"currency",currency:"EUR",maximumFractionDigits:0}).format(Number(minor)/100)}
function signedMoneyWhole(minor){if(!Number.isFinite(minor))return "Nicht verfügbar";return new Intl.NumberFormat("de-DE",{style:"currency",currency:"EUR",maximumFractionDigits:0,signDisplay:"always"}).format(Number(minor)/100)}
function signedMoney(minor){if(!Number.isFinite(minor))return "Nicht verfügbar";return new Intl.NumberFormat("de-DE",{style:"currency",currency:"EUR",minimumFractionDigits:2,maximumFractionDigits:2,signDisplay:"always"}).format(Number(minor)/100)}
function numberWhole(minor){if(!Number.isFinite(minor))return "–";return new Intl.NumberFormat("de-DE",{maximumFractionDigits:0}).format(Number(minor)/100)}
function cashflowSelection(){
  const params=new URLSearchParams(location.search);
  const requestedMonths=Number(params.get("cashflowMonths")||4);
  const requestedOffset=Number(params.get("cashflowOffset")||0);
  return {
    months:[4,6,12].includes(requestedMonths)?requestedMonths:4,
    offset:Number.isInteger(requestedOffset)?Math.max(0,Math.min(120,requestedOffset)):0
  };
}
function setCashflowRange(months,offset){
  const params=new URLSearchParams(location.search);
  const safeMonths=[4,6,12].includes(Number(months))?Number(months):4;
  const safeOffset=Math.max(0,Math.min(120,Math.trunc(Number(offset)||0)));
  if(safeMonths===4)params.delete("cashflowMonths");else params.set("cashflowMonths",String(safeMonths));
  if(safeOffset===0)params.delete("cashflowOffset");else params.set("cashflowOffset",String(safeOffset));
  const query=params.toString();
  history.pushState(null,"",(query?"?"+query:location.pathname)+location.hash);
  refresh();
}
function setCashflowMonths(value){const range=cashflowSelection();setCashflowRange(Number(value),range.offset)}
function shiftCashflow(months){const range=cashflowSelection();setCashflowRange(range.months,range.offset+Number(months))}
function spendingSelection(){
  const requestedOffset=Number(new URLSearchParams(location.search).get("spendingOffset")||0);
  return {offset:Number.isInteger(requestedOffset)?Math.max(0,Math.min(120,requestedOffset)):0};
}
function setSpendingOffset(offset){
  const params=new URLSearchParams(location.search);
  const safeOffset=Math.max(0,Math.min(120,Math.trunc(Number(offset)||0)));
  if(safeOffset===0)params.delete("spendingOffset");else params.set("spendingOffset",String(safeOffset));
  const query=params.toString();
  history.pushState(null,"",(query?"?"+query:location.pathname)+location.hash);
  refresh();
}
function shiftSpending(months){setSpendingOffset(spendingSelection().offset+Number(months))}
function shiftMonthKey(key,offset){
  const match=String(key||"").match(/^(\d{4})-(\d{2})$/);
  if(!match)return "";
  const date=new Date(Date.UTC(Number(match[1]),Number(match[2])-1+Number(offset),1));
  return date.getUTCFullYear()+"-"+String(date.getUTCMonth()+1).padStart(2,"0");
}
function spendingMonthOptions(latestMonth,selectedOffset){
  if(!latestMonth)return "";
  const offsets=Array.from({length:36},(_,offset)=>offset);
  if(selectedOffset>=36)offsets.push(selectedOffset);
  return offsets.map(offset=>{
    const key=shiftMonthKey(latestMonth,-offset);
    return '<option value="'+offset+'"'+(offset===selectedOffset?' selected':'')+'>'+esc(rangeMonth(key,{month:"long",year:"numeric"}))+'</option>';
  }).join("");
}
function expenseSelection(){
  const params=new URLSearchParams(location.search);
  const page=Number(params.get("expensePage")||1);
  return {
    month:params.get("expenseMonth")||"",
    period:params.get("expensePeriod")||"month",
    quarter:params.get("expenseQuarter")||"",
    year:params.get("expenseYear")||"",
    sort:params.get("expenseSort")||"date-desc",
    category:params.get("expenseCategory")||"all",
    account:params.get("expenseAccount")||"all",
    search:(params.get("expenseSearch")||"").slice(0,80),
    categorySearch:(params.get("expenseCategorySearch")||"").slice(0,80),
    expanded:params.get("expenseCategoriesExpanded")==="1",
    page:Number.isInteger(page)?Math.max(1,Math.min(100000,page)):1
  };
}
function setExpenseParams(changes,replace=false){
  const params=new URLSearchParams(location.search);
  const names={month:"expenseMonth",period:"expensePeriod",quarter:"expenseQuarter",year:"expenseYear",sort:"expenseSort",category:"expenseCategory",account:"expenseAccount",search:"expenseSearch",page:"expensePage"};
  Object.entries(changes).forEach(([key,value])=>{
    const name=names[key];if(!name)return;
    const text=String(value??"").trim();
    if(!text||text==="all"||(key==="page"&&text==="1"))params.delete(name);else params.set(name,text);
  });
  const query=params.toString();
  const url=(query?"?"+query:location.pathname)+location.hash;
  history[replace?"replaceState":"pushState"](null,"",url);
  refresh();
}
function setExpenseMonth(value){setExpenseParams({month:value,period:"month",category:"",page:1})}
function setExpensePeriod(period,value){
  if(period==="month")setExpenseParams({period:"month",month:value,quarter:"",year:value?String(value).slice(0,4):"",category:"",page:1});
  else if(period==="quarter")setExpenseParams({period:"quarter",quarter:value,month:"",year:String(value||"").slice(0,4),category:"",page:1});
  else if(period==="ytd")setExpenseParams({period:"ytd",year:value,month:"",quarter:"",category:"",page:1});
  else setExpenseParams({period:"year",year:value,month:"",quarter:"",category:"",page:1});
}
function setExpenseSort(value){setExpenseParams({sort:value,page:1})}
function toggleExpenseSort(column){
  const current=expenseSelection().sort||"date-desc";
  const [name,dir]=current.split("-");
  setExpenseSort(column===name&&dir==="desc"?column+"-asc":column+"-desc");
}
function shiftExpenseMonth(offset){
  const current=expenseSelection().month||currentExpenseMonth;
  if(!current)return;
  setExpenseMonth(shiftMonthKey(current,Number(offset)));
}
function setExpenseCategory(value){setExpenseParams({category:value,page:1})}
function setExpenseAccount(value){setExpenseParams({account:value,category:"",page:1})}
function setExpensePage(value){setExpenseParams({page:value})}
let expenseSearchTimer;
function updateExpenseSearch(value){
  clearTimeout(expenseSearchTimer);
  expenseSearchTimer=setTimeout(()=>setExpenseParams({search:String(value).slice(0,80),category:"",page:1},true),300);
}
function expenseSortHeader(column,label,sort){
  const current=sort||"date-desc";
  const active=current.startsWith(column+"-");
  const dir=active&&current.endsWith("-asc")?"aufsteigend":"absteigend";
  return '<th><button type="button" class="expense-sort'+(active?" is-active":"")+'" onclick="toggleExpenseSort(&quot;'+column+'&quot;)" aria-label="'+esc(label)+' '+dir+' sortieren">'+esc(label)+(active?(current.endsWith("-asc")?" ↑":" ↓"):"")+"</button></th>";
}
function expenseYearOptions(newestMonth,oldestMonth,selectedYear){
  const newest=Number(String(newestMonth||"").slice(0,4));
  const oldest=Number(String(oldestMonth||newestMonth||"").slice(0,4));
  if(!newest)return "";
  const years=[];
  for(let year=newest;year>=oldest;year-=1)years.push(year);
  return years.map(year=>'<option value="'+year+'"'+(String(year)===String(selectedYear)?" selected":"")+">"+year+"</option>").join("");
}
function expenseQuarterOptions(newestMonth,oldestMonth,selected){
  const newest=String(newestMonth||"");
  const oldest=String(oldestMonth||"");
  const years=[];
  for(let year=Number(newest.slice(0,4));year>=Number(oldest.slice(0,4)||newest.slice(0,4));year-=1)years.push(year);
  return years.flatMap(year=>[4,3,2,1].map(quarter=>{
    const start=year+"-"+String((quarter-1)*3+1).padStart(2,"0");
    const end=year+"-"+String(quarter*3).padStart(2,"0");
    if(end<oldest||start>newest)return "";
    const key=year+"-Q"+quarter;
    return '<option value="'+key+'"'+(key===selected?" selected":"")+">Q"+quarter+" "+year+"</option>";
  })).join("");
}
function expenseMonthOptions(latestMonth,oldestMonth,selectedMonth){
  if(!latestMonth)return "";
  const keys=Array.from({length:36},(_,offset)=>shiftMonthKey(latestMonth,-offset)).filter(key=>!oldestMonth||key>=oldestMonth);
  if(selectedMonth&&!keys.includes(selectedMonth))keys.push(selectedMonth);
  return keys.sort().reverse().map(key=>'<option value="'+key+'"'+(key===selectedMonth?' selected':'')+'>'+esc(rangeMonth(key,{month:"long",year:"numeric"}))+'</option>').join("");
}
function filterExpenseCategories(value){
  const needle=String(value||"").trim().toLocaleLowerCase("de-DE");
  document.querySelectorAll(".expense-category").forEach(row=>{row.hidden=Boolean(needle)&&!String(row.dataset.label||"").toLocaleLowerCase("de-DE").includes(needle)});
  const params=new URLSearchParams(location.search);
  if(needle)params.set("expenseCategorySearch",String(value).slice(0,80));else params.delete("expenseCategorySearch");
  const query=params.toString();
  history.replaceState(null,"",(query?"?"+query:location.pathname)+location.hash);
}
function toggleExpenseCategories(button){
  const list=document.getElementById("expense-category-pane");
  const expanded=list.classList.toggle("categories-expanded");
  button.setAttribute("aria-expanded",String(expanded));
  button.firstChild.textContent=expanded?"Weniger anzeigen":"Weitere anzeigen";
  const params=new URLSearchParams(location.search);
  if(expanded)params.set("expenseCategoriesExpanded","1");else params.delete("expenseCategoriesExpanded");
  const query=params.toString();
  history.replaceState(null,"",(query?"?"+query:location.pathname)+location.hash);
}
function assetSelection(){
  const requested=new URLSearchParams(location.search).get("assetArea")||"all";
  return ["all","cash","depots","pensions","crypto","precious-metals"].includes(requested)?requested:"all";
}
function setAssetArea(value){
  const area=["cash","depots","pensions","crypto","precious-metals"].includes(String(value))?String(value):"all";
  const params=new URLSearchParams(location.search);
  if(area==="all")params.delete("assetArea");else params.set("assetArea",area);
  const query=params.toString();
  history.pushState(null,"",(query?"?"+query:location.pathname)+location.hash);
  refresh();
}
function analysisSelection(){
  const params=new URLSearchParams(location.search);
  const period=Number(params.get("analysisPeriod")||0);
  const comparison=Number(params.get("analysisComparison")||0);
  const boundedParam=(name,fallback,min,max)=>{if(!params.has(name))return fallback;const value=Number(params.get(name));return Number.isFinite(value)?Math.max(min,Math.min(max,value)):fallback};
  return {
    view:["crypto-origin-tax","investment-newsletters"].includes(params.get("analysisView"))?params.get("analysisView"):"expense-structure",
    period:Number.isInteger(period)&&period>0?period:0,
    comparison:Number.isInteger(comparison)&&comparison>0?comparison:0,
    expanded:params.get("analysisCategoriesExpanded")==="1",
    position:params.get("analysisPosition")||"",
    rhythm:["monatlich","vierteljaehrlich","jaehrlich"].includes(params.get("recurringRhythm"))?params.get("recurringRhythm"):"alle",
    review:["alle","bestaetigt","kein-kandidat"].includes(params.get("recurringReview"))?params.get("recurringReview"):"moeglich",
    classification:["GRUNDBEDARF","GESTALTBAR","VERMEIDBAR","UNKLAR"].includes(params.get("recurringClassification"))?params.get("recurringClassification"):"alle",
    confidence:["hoch","mittel"].includes(params.get("recurringConfidence"))?params.get("recurringConfidence"):"alle",
    candidate:/^recurring-[a-f0-9]{18}$/.test(params.get("recurringCandidate")||"")?params.get("recurringCandidate"):"",
    decisionBasis:params.get("decisionBasis")==="ytd-plus-last-year"?"ytd-plus-last-year":"current-year",
    decisionReturn:boundedParam("decisionReturn",2,-5,10),
    decisionMonthly:boundedParam("decisionMonthly",0,-10000,10000),
    decisionOneTime:boundedParam("decisionOneTime",0,-1000000,1000000),
    fireTargetAge:boundedParam("fireTargetAge",60,50,67),
    fireActionKeys:(params.get("fireActionKeys")||"").split(",").filter(key=>/^recurring-[a-f0-9]{18}$/.test(key)),
    fireCategoryCuts:(params.get("fireCategoryCuts")||"").split(",").filter(value=>/^category-[a-f0-9]{10}:(10|25|50)$/.test(value)),
    fireOneTimeKeys:(params.get("fireOneTimeKeys")||"").split(",").filter(key=>/^position-[a-f0-9]{12}$/.test(key)),
    fireOpenGroups:(params.get("fireOpenGroups")||"").split(",").filter(value=>["recurring","variable","one-time"].includes(value)),
    fireCategory:/^category-[a-f0-9]{10}$/.test(params.get("fireCategory")||"")?params.get("fireCategory"):"",
    fireCategoryPeriod:params.get("fireCategoryPeriod")==="previous"?"previous":"current"
  };
}
function setAnalysisView(value){
  const params=new URLSearchParams(location.search);
  if(value==="decision-lab"){
    params.delete("analysisView");
    history.pushState(null,"",(params.toString()?"?"+params:"")+ "#/decision-lab");
    refresh();return;
  }
  if(value==="recurring-expenses"||value==="expense-optimizations"){
    params.delete("analysisView");
    if(value==="expense-optimizations")params.set("reviewTab","actions");
    else params.delete("reviewTab");
    history.pushState(null,"",(params.toString()?"?"+params:"")+ "#/review");
    refresh();return;
  }
  if(value==="crypto-origin-tax"||value==="investment-newsletters")params.set("analysisView",value);else params.delete("analysisView");
  params.delete("analysisPosition");params.delete("recurringCandidate");
  const query=params.toString();history.pushState(null,"",(query?"?"+query:location.pathname)+location.hash);refresh();
}
async function saveMerchantRule(){
  const pattern=document.getElementById("rule-pattern")?.value||"";
  const label=document.getElementById("rule-label")?.value||"";
  await call("/api/dashboard/merchant-rules",{method:"PUT",body:JSON.stringify({pattern,label})});refresh(true);
}
async function deleteMerchantRule(pattern){
  if(!confirm("Eigene Händlerregel wirklich löschen? Die Originalbuchungen bleiben unverändert."))return;
  await call("/api/dashboard/merchant-rules/"+encodeURIComponent(pattern),{method:"DELETE"});refresh(true);
}
async function closeReviewMonth(){
  const month=document.getElementById("review-close-month")?.value||"";
  const note=document.getElementById("review-close-note")?.value||"";
  const payrollReviewed=document.getElementById("review-close-payroll")?.checked===true;
  const cardReviewed=document.getElementById("review-close-card")?.checked===true;
  if(!payrollReviewed||!cardReviewed){msg("Bitte Gehaltszuordnung und Kreditkartenstand vor dem Abschluss bestätigen.",true);return;}
  if(!month||!confirm("Monat "+month+" als geprüft markieren? Der Abschluss kann später erneut gespeichert werden."))return;
  await call("/api/dashboard/review/close",{method:"PUT",body:JSON.stringify({month,note,payrollReviewed,cardReviewed})});msg("Monat mit Plan-vs.-Ist-Stand abgeschlossen.");refresh(true);
}
async function saveLifeEvent(){
  await call("/api/dashboard/events",{method:"PUT",body:JSON.stringify({name:document.getElementById("event-name")?.value||"",startMonth:document.getElementById("event-start")?.value||"",monthlyChangeMinor:Math.round(Number(document.getElementById("event-amount")?.value||0)*100)})});refresh(true);
}
async function deleteLifeEvent(id){
  if(!confirm("Ereignis wirklich löschen? Seine Wirkung entfällt aus zukünftigen Berechnungen."))return;
  await call("/api/dashboard/events/"+id,{method:"DELETE"});refresh(true);
}
async function refreshLifeEvents(){
  const box=document.getElementById("life-event-list");if(!box)return;
  try{
    const data=await call("/api/dashboard/events");
    const events=data.events||[];
    box.innerHTML=events.length?events.map(event=>'<article class="compact-manage-row"><div><strong>'+esc(event.name)+'</strong><span>Ab '+esc(event.startMonth)+' · '+signedMoneyWhole(event.monthlyChangeMinor)+' pro Monat</span></div><button class="button quiet small" type="button" onclick="deleteLifeEvent(&quot;'+esc(event.id)+'&quot;)">Löschen</button></article>').join(''):'<p class="empty">Noch keine gespeicherten Ereignisse.</p>';
  }catch(error){box.innerHTML='<p class="tone-warning">Ereignisse konnten nicht geladen werden.</p>'}
}
async function compareNamedScenarios(){
  const left=document.getElementById("compare-left")?.value||"";
  const right=document.getElementById("compare-right")?.value||"";
  const data=await call("/api/dashboard/scenarios/compare?left="+encodeURIComponent(left)+"&right="+encodeURIComponent(right));
  const box=document.getElementById("scenario-compare");
  if(box){
    const value=(minor)=>minor===null?'–':signedMoneyWhole(minor);
    box.innerHTML='<div class="scenario-compare-result"><strong>'+esc(data.left.name)+' → '+esc(data.right.name)+'</strong><span>FIRE-Ausstiegsalter: '+(data.outcomeDelta.exitAge===null?'–':(data.outcomeDelta.exitAge>0?'+':'')+data.outcomeDelta.exitAge+' Jahre')+'</span><span>Kapital am Zielalter: '+value(data.outcomeDelta.projectedCapitalAtTargetMinor)+'</span><span>Kapitallücke am Zielalter: '+value(data.outcomeDelta.capitalGapAtTargetMinor)+'</span><span>Jährliche Ziellücke: '+value(data.outcomeDelta.annualGapToTargetMinor)+'</span><span>20-Jahres-Pfad: '+value(data.outcomeDelta.trajectoryAfter20YearsMinor)+'</span><small>FIRE-Phasenmodell und 20-Jahres-Cashflow bleiben getrennt ausgewiesen.</small></div>';
  }
}
function milesMoreInput(){
  return {statementDate:document.getElementById("miles-date")?.value||"",text:document.getElementById("miles-text")?.value||""};
}
function resetMilesMorePreview(){
  currentMilesMorePreview=null;
  const preview=document.getElementById("miles-preview");
  const button=document.getElementById("miles-import-button");
  if(preview)preview.innerHTML="";
  if(button)button.disabled=true;
}
async function previewMilesMore(){
  const input=milesMoreInput();
  resetMilesMorePreview();
  const data=await call("/api/miles-more/preview",{method:"POST",body:JSON.stringify(input)});
  currentMilesMorePreview=input;
  const settlement=data.settlement||{};
  const settlementText=settlement.status==="ready"?'Eindeutiger Giro-Ausgleich: '+esc(settlement.sourceAccountName||'Girokonto')+' · '+esc(formatDate(settlement.date))+' · '+moneyWhole(settlement.amountMinor)+'. Er wird beim Import automatisch als interner Transfer verknüpft.':settlement.status==="already-linked"?'Der Giro-Ausgleich ist bereits als interner Transfer verknüpft.':settlement.status==="ambiguous"?'Mehrere mögliche Giro-Ausgleiche gefunden. Es wird keiner automatisch verknüpft.':'Kein eindeutiger Giro-Ausgleich gefunden. Es wird keiner automatisch verknüpft.';
  document.getElementById("miles-preview").innerHTML='<p>'+data.bookings+' Umsätze, Saldo '+moneyWhole(data.balanceMinor)+', '+data.categorized+' kategorisiert.</p><p class="'+(settlement.status==="ready"||settlement.status==="already-linked"?'tone-ok':'tone-warning')+'">'+settlementText+'</p><label style="display:flex;align-items:center;gap:8px;margin-top:12px"><input id="miles-confirm-check" type="checkbox" onchange="document.getElementById(&quot;miles-import-button&quot;).disabled=!this.checked"> Ich habe Abrechnungsdatum, Saldo, Anzahl und Ausgleichsvorschau geprüft.</label>';
}
async function importMilesMore(){
  const input=milesMoreInput();
  const confirmed=document.getElementById("miles-confirm-check")?.checked===true;
  if(!currentMilesMorePreview||currentMilesMorePreview.statementDate!==input.statementDate||currentMilesMorePreview.text!==input.text||!confirmed){msg("Bitte zuerst die aktuelle Vorschau prüfen und bestätigen.",true);return;}
  const button=document.getElementById("miles-import-button");
  if(button)button.disabled=true;
  try{
    const data=await call("/api/miles-more/import",{method:"POST",body:JSON.stringify(input)});
    document.getElementById("miles-text").value="";
    resetMilesMorePreview();
    const linked=data.settlement?.status==="ready"?' Giro-Ausgleich wurde verknüpft.':data.settlement?.status==="already-linked"?' Giro-Ausgleich war bereits verknüpft.':' Kein Giro-Ausgleich wurde automatisch verknüpft.';
    msg("Miles & More importiert: "+(data.added||0)+" Buchungen."+linked);
  }catch(error){msg(error.message,true);if(button)button.disabled=false}
}
function setReviewMonths(value){
  const params=new URLSearchParams(location.search);
  params.set("reviewMonths",String(value));
  const query=params.toString();history.pushState(null,"",(query?"?"+query:location.pathname)+location.hash);refresh();
}
function labView(){const value=new URLSearchParams(location.search).get("labView");return value==="year"||value==="path"?value:"fire"}
function setLabView(value){
  const params=new URLSearchParams(location.search);
  if(value==="fire")params.delete("labView");else params.set("labView",value);
  const query=params.toString();history.pushState(null,"",(query?"?"+query:location.pathname)+location.hash);refresh();
}
function applyAnalysisFilters(){
  const period=Number(document.getElementById("analysis-period")?.value||0);
  const comparison=Number(document.getElementById("analysis-comparison")?.value||0);
  const params=new URLSearchParams(location.search);
  if(period)params.set("analysisPeriod",String(period));else params.delete("analysisPeriod");
  if(comparison)params.set("analysisComparison",String(comparison));else params.delete("analysisComparison");
  params.delete("analysisPosition");
  const query=params.toString();
  history.pushState(null,"",(query?"?"+query:location.pathname)+location.hash);
  refresh();
}
function applyRecurringFilters(){
  const params=new URLSearchParams(location.search);
  const values={
    recurringRhythm:document.getElementById("recurring-rhythm")?.value||"alle",
    recurringReview:document.getElementById("recurring-review")?.value||"moeglich",
    recurringClassification:document.getElementById("recurring-classification")?.value||"alle",
    recurringConfidence:document.getElementById("recurring-confidence")?.value||"alle"
  };
  Object.entries(values).forEach(([name,value])=>{const defaultValue=name==="recurringReview"?"moeglich":"alle";if(value===defaultValue)params.delete(name);else params.set(name,value)});
  params.delete("recurringCandidate");
  const query=params.toString();history.pushState(null,"",(query?"?"+query:location.pathname)+location.hash);currentRecurringDetail=null;refresh();
}
function applyDecisionLab(event){
  event?.preventDefault();
  const params=new URLSearchParams(location.search);
  const basis=document.getElementById("decision-basis")?.value||"current-year";
  if(basis==="ytd-plus-last-year")params.set("decisionBasis",basis);else params.delete("decisionBasis");
  params.delete("decisionVariableShare");
  const values={
    decisionReturn:Number(document.getElementById("decision-return")?.value||2),
    decisionMonthly:Number(document.getElementById("decision-monthly")?.value||0),
    decisionOneTime:Number(document.getElementById("decision-one-time")?.value||0)
  };
  const rules={decisionReturn:[2,-5,10],decisionMonthly:[0,-10000,10000],decisionOneTime:[0,-1000000,1000000]};
  for(const [name,value] of Object.entries(values)){
    const [fallback,min,max]=rules[name];
    const safe=Number.isFinite(value)?Math.max(min,Math.min(max,value)):fallback;
    if(safe===fallback)params.delete(name);else params.set(name,String(safe));
  }
  const query=params.toString();history.pushState(null,"",(query?"?"+query:location.pathname)+location.hash);refresh();
}
function applyFireScenario(event){
  event?.preventDefault();
  const params=new URLSearchParams(location.search);
  const target=Math.max(50,Math.min(67,Number(document.getElementById("fire-target-age")?.value||60)));
  if(target===60)params.delete("fireTargetAge");else params.set("fireTargetAge",String(target));
  const keys=[...document.querySelectorAll('input[name="fire-action"]:checked')].map(input=>input.value).filter(key=>/^recurring-[a-f0-9]{18}$/.test(key));
  if(keys.length)params.set("fireActionKeys",keys.join(","));else params.set("fireActionKeys","none");
  const cuts=[...document.querySelectorAll('select[name="fire-category-cut"]')].map(input=>String(input.dataset.key||"")+":"+String(input.value||"0")).filter(value=>/^category-[a-f0-9]{10}:(10|25|50)$/.test(value));
  if(cuts.length)params.set("fireCategoryCuts",cuts.join(","));else params.delete("fireCategoryCuts");
  const oneTime=[...document.querySelectorAll('input[name="fire-one-time"]:checked')].map(input=>input.value).filter(key=>/^position-[a-f0-9]{12}$/.test(key));
  if(oneTime.length)params.set("fireOneTimeKeys",oneTime.join(","));else params.delete("fireOneTimeKeys");
  const query=params.toString();history.pushState(null,"",(query?"?"+query:location.pathname)+location.hash);refresh();
}
function toggleRecurringCandidate(key){
  const params=new URLSearchParams(location.search);
  const close=params.get("recurringCandidate")===key;
  if(close)params.delete("recurringCandidate");else params.set("recurringCandidate",key);
  const query=params.toString();history.replaceState(null,"",(query?"?"+query:location.pathname)+location.hash);
  if(close){currentRecurringDetail=null;if(currentRecurringData)renderRecurringExpenses(currentRecurringData);return}
  currentRecurringDetail=null;if(currentRecurringData)renderRecurringExpenses(currentRecurringData);loadRecurringDetail(key);
}
async function loadRecurringDetail(key){
  try{
    const data=await call("/api/dashboard/analyses/recurring-expenses/"+encoded(key));
    if(analysisSelection().candidate!==key)return;
    currentRecurringDetail=data;if(currentRecurringData)renderRecurringExpenses(currentRecurringData);
  }catch(error){msg(error.message,true)}
}
async function saveRecurringDecision(key,instance){
  const select=document.getElementById("recurring-decision-"+instance+"-"+key);
  const button=document.getElementById("recurring-save-"+instance+"-"+key);
  const decision=select?.value||"";
  if(!decision){select?.focus();msg("Bitte zuerst eine Entscheidung auswählen.",true);return}
  const evidenceHash=currentRecurringDetail?.candidate?.key===key
    ? currentRecurringDetail.candidate.evidence.evidenceHash
    : (currentRecurringData?.candidates||[]).find(item=>item.key===key)?.evidence?.evidenceHash
      || "";
  try{
    if(button)button.disabled=true;msg("Entscheidung wird gespeichert …");
    await call("/api/decisions/recurring-expenses/"+encoded(key),{method:"PUT",body:JSON.stringify({decision,expectedEvidenceHash:evidenceHash})});
    currentRecurringDetail=null;msg("Entscheidung gespeichert.");await refresh();
  }catch(error){msg(error.message,true);if(button)button.disabled=false}
}
function toggleAnalysisCategories(){
  const params=new URLSearchParams(location.search);
  if(params.get("analysisCategoriesExpanded")==="1")params.delete("analysisCategoriesExpanded");else params.set("analysisCategoriesExpanded","1");
  const query=params.toString();
  history.replaceState(null,"",(query?"?"+query:location.pathname)+location.hash);
  if(currentAnalysisData)renderAnalyses(currentAnalysisData);
}
function toggleAnalysisPosition(key){
  const params=new URLSearchParams(location.search);
  if(params.get("analysisPosition")===key)params.delete("analysisPosition");else params.set("analysisPosition",key);
  const query=params.toString();
  history.replaceState(null,"",(query?"?"+query:location.pathname)+location.hash);
  if(currentAnalysisData)renderAnalyses(currentAnalysisData);
}
function csvCell(value){const text=String(value??"");return /[";\\n]/.test(text)?'"'+text.replaceAll('"','""')+'"':text}
function exportAnalysisCsv(){
  if(analysisSelection().view==="crypto-origin-tax"){exportCryptoAnalysisCsv();return}
  if(!currentAnalysisData){msg("Die Analyse ist noch nicht geladen.",true);return}
  const data=currentAnalysisData;
  const rows=[["Bereich","Position","Kategorie","Klasse","Zeitraum","Betrag EUR","Status"]];
  data.categories.forEach(row=>rows.push(["Kategorie",row.label,"","",String(data.period.year),(row.periodMinor/100).toFixed(2).replace(".",","),data.period.estimate?"[SCHÄTZUNG]":"gemessen"]));
  data.positions.forEach(row=>rows.push(["Position",row.label,row.category,row.class,String(data.period.year),(row.amountMinor/100).toFixed(2).replace(".",","),row.estimate?"[SCHÄTZUNG]":"gemessen"]));
  const csv="\ufeff"+rows.map(row=>row.map(csvCell).join(";")).join("\\n");
  const link=document.createElement("a");
  link.href=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));
  link.download="ausgabenstruktur-"+data.period.year+"-vergleich-"+data.comparison.year+".csv";
  link.click();setTimeout(()=>URL.revokeObjectURL(link.href),0);
  msg("CSV für die aktuelle Auswahl wurde erstellt.");
}
function exportCryptoAnalysisCsv(){
  if(!currentCryptoData){msg("Die Kryptoanalyse ist noch nicht geladen.",true);return}
  const data=currentCryptoData;
  const rows=[["Bereich","Kennzahl","Wert","Einheit","Status"]];
  rows.push(["Bestand","Gesamtbestand",String(data.holdings.totalSol).replace(".",","),"SOL","Bestätigt"]);
  rows.push(["Bestand","Staking Rewards",String(data.holdings.rewardsSol).replace(".",","),"SOL","Bestätigt"]);
  rows.push(["Investment","SOL-Konvertierungsbasis",String(data.transition.conversionBasisEurPerSol).replace(".",","),"EUR/SOL","[SCHÄTZUNG]"]);
  rows.push(["Investment","Effektive Basis inklusive Staking",String(data.investment.effectiveBasisEurPerSol).replace(".",","),"EUR/SOL","[SCHÄTZUNG]"]);
  rows.push(["Cash-on-Cash","Netto-Fiatkapital",(data.investment.netFiatCapitalEurMinor/100).toFixed(2).replace(".",","),"EUR","Bestätigt"]);
  data.taxYears.forEach(year=>rows.push(["Steuerprüfung",String(year.year),year.referenceMinor===undefined?"":(year.referenceMinor/100).toFixed(2).replace(".",","),year.referenceMinor===undefined?"":"EUR",year.title+(year.estimate?" [SCHÄTZUNG]":"")]));
  const csv="\ufeff"+rows.map(row=>row.map(csvCell).join(";")).join("\\n");
  const link=document.createElement("a");
  link.href=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));
  link.download="krypto-herkunft-steuerstatus-stand-"+data.capturedAt.slice(0,10)+".csv";
  link.click();setTimeout(()=>URL.revokeObjectURL(link.href),0);
  msg("CSV für die Kryptoanalyse wurde erstellt.");
}
function rangeMonth(key,format){
  const match=String(key||"").match(/^(\d{4})-(\d{2})$/);
  if(!match)return "";
  return new Intl.DateTimeFormat("de-DE",format).format(new Date(Date.UTC(Number(match[1]),Number(match[2])-1,1)));
}
function cashflowRangeLabel(range){
  if(!range?.start||!range?.end)return "Gewählter Zeitraum";
  const startYear=String(range.start).slice(0,4),endYear=String(range.end).slice(0,4);
  const start=rangeMonth(range.start,{month:"long"});
  const end=rangeMonth(range.end,{month:"long",year:"numeric"});
  return startYear===endYear?start+"–"+end:rangeMonth(range.start,{month:"long",year:"numeric"})+"–"+end;
}
function cashflowRangeDetail(range){return range?.endPartial?rangeMonth(range.end,{month:"long"})+" bis heute":"Vollständige Monate"}
function dayMonth(value){if(!value)return "kein Stand";const date=new Date(value);if(Number.isNaN(date.getTime()))return "kein Stand";return new Intl.DateTimeFormat("de-DE",{day:"2-digit",month:"2-digit"}).format(date)}
function monthWord(value){if(!value)return "nicht bestätigt";const date=new Date(value);if(Number.isNaN(date.getTime()))return "nicht bestätigt";return new Intl.DateTimeFormat("de-DE",{month:"long"}).format(date)+" bestätigt"}
function stateInfo(source){
  const map={
    current:{label:"Aktuell",tone:"ok"},
    running:{label:"Läuft",tone:"warning"},
    action:{label:"Freigabe nötig",tone:"warning"},
    error:{label:"Fehler",tone:"critical"},
    disabled:{label:"Deaktiviert",tone:"warning"}
  };
  if(source.status==="current"&&source.actionPending)return {label:"Aktuell · Update offen",tone:"ok"};
  return map[source.status]||map.action;
}
function statusIcon(tone){return '<span class="status-icon tone-'+tone+'">'+(tone==="ok"?icons.check:icons.warning)+'</span>'}
function sourceIcon(source){return source.kind==="solana"?icons.wallet:source.kind==="manual"?icons.manual:icons.bank}
function msg(text,isError=false){const element=document.getElementById("message");element.textContent=text;element.classList.toggle("error",isError)}
function manualError(text=""){const element=document.getElementById("manual-error");if(element)element.textContent=text}

function wealthHistoryPoints(data,range){
  const points=data?.points||[];
  if(!points.length||range==="max")return points;
  const end=new Date(points.at(-1).date+"T12:00:00Z");
  let start=new Date(end);
  if(range==="1m")start.setUTCMonth(start.getUTCMonth()-1);
  else if(range==="ytd")start=new Date(Date.UTC(end.getUTCFullYear(),0,1,12));
  else start.setUTCFullYear(start.getUTCFullYear()-1);
  return points.filter(point=>new Date(point.date+"T12:00:00Z")>=start);
}
function renderWealthHistory(data){
  currentWealthHistory=data;
  const target=document.getElementById("wealth-history-content");
  if(!target)return;
  const points=wealthHistoryPoints(data,wealthHistoryRange);
  if(points.length<2){target.innerHTML='<div class="panel-unavailable"><p>Für diesen Zeitraum sind noch nicht genügend Werte vorhanden.</p></div>';return}
  const values=points.map(point=>Number(point.totalMinor));
  const min=Math.min(...values),max=Math.max(...values),span=Math.max(1,max-min);
  const x=index=>54+index/Math.max(1,points.length-1)*708;
  const y=value=>224-(value-min)/span*184;
  const segments=[];let current=[];let lastQuality="";
  points.forEach((point,index)=>{if(lastQuality&&point.quality!==lastQuality){if(current.length>1)segments.push({quality:lastQuality,points:current});current=[current.at(-1),[x(index),y(point.totalMinor)]]}else current.push([x(index),y(point.totalMinor)]);lastQuality=point.quality});
  if(current.length>1)segments.push({quality:lastQuality,points:current});
  const paths=segments.map(segment=>'<path class="wealth-history-line '+esc(segment.quality)+'" d="M'+segment.points.map(pair=>pair.map(value=>value.toFixed(1)).join(" ")).join("L")+'"/>').join("");
  const first=points[0],last=points.at(-1);
  const label='Vermögensentwicklung von '+formatDate(first.date)+' bis '+formatDate(last.date)+', von '+moneyWhole(first.totalMinor)+' auf '+moneyWhole(last.totalMinor)+'. Frühere unvollständige Abschnitte sind gestrichelt.';
  const rows=points.map(point=>'<tr><th>'+formatDate(point.date)+'</th><td>'+moneyWhole(point.totalMinor)+'</td><td>'+moneyWhole(point.cashMinor)+'</td><td>'+moneyWhole(point.investmentsMinor)+'</td><td>'+(point.quality==="measured"?'Gemessen':point.quality==="reconstructed"?'Rekonstruiert [SCHÄTZUNG]':'Unvollständig [SCHÄTZUNG]')+'</td></tr>').join("");
  target.innerHTML='<div class="wealth-history-summary"><span>'+esc(formatDate(first.date))+'</span><strong>'+moneyWhole(last.totalMinor)+'</strong><span>'+signedMoneyWhole(last.totalMinor-first.totalMinor)+'</span></div><figure class="wealth-history-chart"><svg viewBox="0 0 800 270" role="img" aria-label="'+esc(label)+'"><g class="wealth-history-grid"><path d="M54 40H762M54 132H762M54 224H762"/></g><g class="wealth-history-axis"><text x="46" y="44" text-anchor="end">'+numberWhole(max)+'</text><text x="46" y="136" text-anchor="end">'+numberWhole(Math.round((max+min)/2))+'</text><text x="46" y="228" text-anchor="end">'+numberWhole(min)+'</text><text x="54" y="254">'+esc(formatDate(first.date))+'</text><text x="762" y="254" text-anchor="end">'+esc(formatDate(last.date))+'</text></g>'+paths+'</svg><figcaption>'+esc(data.coverage.note)+' <span class="comparison-estimate">[SCHÄTZUNG]</span></figcaption></figure><div class="wealth-history-legend"><span><i class="measured"></i>Gemessen</span><span><i class="reconstructed"></i>Rekonstruiert</span><span><i class="partial"></i>Unvollständig</span></div><table class="sr-only"><caption>'+esc(label)+'</caption><thead><tr><th>Datum</th><th>Gesamt</th><th>Liquidität</th><th>Anlagen</th><th>Datenqualität</th></tr></thead><tbody>'+rows+'</tbody></table>';
}
function setWealthHistoryRange(range){
  if(!["1m","ytd","1y","max"].includes(range))return;
  wealthHistoryRange=range;
  document.querySelectorAll("[data-wealth-range]").forEach(button=>button.setAttribute("aria-pressed",String(button.dataset.wealthRange===range)));
  renderWealthHistory(currentWealthHistory);
}

function renderOverview(data,history){
  if(history?.points?.length&&Number.isFinite(data.totalMinor)){
    history={...history,points:[...history.points]};
    history.points[history.points.length-1]={
      ...history.points.at(-1),
      date:String(data.generatedAt).slice(0,10),
      totalMinor:Number(data.totalMinor),
      cashMinor:Number(data.cash.amountMinor),
      investmentsMinor:Number(data.investments.amountMinor),
      quality:"measured"
    };
  }
  const total=data.totalMinor;
  const totalParts=Number(data.cash.amountMinor||0)+Number(data.investments.amountMinor||0);
  const cashWidth=totalParts>0?Math.max(1,Number(data.cash.amountMinor||0)/totalParts*100):0;
  const composition=Number.isFinite(total)?'<div class="composition-bar" aria-hidden="true"><span class="composition-cash" style="width:'+cashWidth+'%"></span><span class="composition-investments" style="width:'+(100-cashWidth)+'%"></span></div>':'<div class="composition-missing">Aufteilung teilweise nicht verfügbar</div>';
  const automaticOk=data.automatic.total>0&&data.automatic.current===data.automatic.total;
  const actionDetails=data.manualActions.map(action=>esc(action.label.replace(" Riester","").replace(" Fondsrente",""))+" "+esc(dayMonth(action.capturedAt))).join(" · ");
  const action=data.manualActions.length?'\
    <section class="overview-action" aria-label="Vorsorgewerte prüfen"><span class="task-mark">'+icons.manual+'</span><div><strong>'+data.manualActions.length+' Vorsorgewerte prüfen</strong><p>'+actionDetails+'</p></div><a class="text-action" href="#/data-status"><span><span class="to-prefix">Zum </span>Datenstatus</span>'+icons.chevron+'</a></section>':'';
  const comparison=data.comparison||{effectiveDate:"",state:"partial",changeTotalMinor:null,parts:[],warnings:[]};
  const totalChangeTone=Number(comparison.changeTotalMinor)>0?"positive":Number(comparison.changeTotalMinor)<0?"negative":"neutral";
  const comparisonSummary=Number.isFinite(comparison.changeTotalMinor)
    ?'<div class="wealth-change-summary"><span>Seit '+esc(formatDate(comparison.effectiveDate))+'</span><strong class="wealth-change-'+totalChangeTone+'">'+signedMoneyWhole(comparison.changeTotalMinor)+'</strong><small>Vollständig abgestimmter Monatsvergleich</small></div>'
    :'<div class="wealth-change-summary"><span>Seit '+esc(formatDate(comparison.effectiveDate))+'</span><strong>Gesamtvergleich offen</strong><small>Unvollständige Anteile werden nicht summiert</small></div>';
  const comparisonParts=(comparison.parts||[]).map(part=>{
    const changeTone=Number(part.changeMinor)>0?"positive":Number(part.changeMinor)<0?"negative":"neutral";
    const value=Number.isFinite(part.changeMinor)?signedMoneyWhole(part.changeMinor):"Vergleich nicht verfügbar";
    const dates=(part.capturedDates||[]).map(value=>formatDate(value));
    const dateText=dates.length===0?"Stichtag nicht verfügbar":dates.length===1?"Stichtag "+dates[0]:"Stichtage "+dates[0]+" bis "+dates.at(-1);
    const valuation=part.valuation==="estimated"?'<span class="comparison-estimate">[SCHÄTZUNG]</span>':part.valuation==="confirmed"?"bestätigt":part.valuation==="measured"?"gemessen":"nicht verfügbar";
    const previous=Number.isFinite(part.previousMinor)?"Vergleichswert "+moneyWhole(part.previousMinor):"Kein belastbarer Vergleichswert";
    const quantity=Number.isFinite(part.quantity)?new Intl.NumberFormat("de-DE",{maximumFractionDigits:9}).format(part.quantity)+" SOL":null;
    const price=Number.isFinite(part.priceMinor)?new Intl.NumberFormat("de-DE",{style:"currency",currency:"EUR",minimumFractionDigits:2,maximumFractionDigits:2}).format(part.priceMinor/100)+"/SOL":null;
    const solDetail=quantity&&price?'<small>'+quantity+' · '+price+' am '+esc(formatDate(part.priceDate))+'</small>':'';
    const staking=Number(part.stakingRewardsQuantity)>0?'<small>'+new Intl.NumberFormat("de-DE",{maximumFractionDigits:9}).format(part.stakingRewardsQuantity)+' SOL erkannte Staking-Erträge enthalten</small>':'';
    return '<div class="wealth-comparison-part"><span>'+esc(part.label)+'</span><strong class="wealth-change-'+changeTone+'">'+value+'</strong><small>'+previous+' · '+esc(part.source)+'</small><small>'+esc(dateText)+' · '+valuation+'</small>'+solDetail+staking+'</div>';
  }).join("");
  const comparisonPanel='<details class="wealth-comparison"><summary><span><strong>Vermögensentwicklung im Detail</strong><small>Seit abgeschlossenem Stichtag '+esc(formatDate(comparison.effectiveDate))+'</small></span>'+icons.chevron+'</summary><div class="wealth-comparison-grid">'+comparisonParts+'</div><p class="panel-footer"><a class="panel-link" href="?assetArea=all#/assets">Alle Vermögenspositionen ansehen</a></p></details>';
  const bridge=data.wealthBridge;
  const wealthBridge=bridge?'<details class="wealth-bridge"><summary><span><strong>Vermögensbrücke '+esc(analysisMonthLabel(bridge.month))+'</strong><small>Vom letzten Monatsende zum aktuellen Stand</small></span><strong>'+signedMoneyWhole(bridge.currentTotalMinor-bridge.previousTotalMinor)+'</strong>'+icons.chevron+'</summary><div class="wealth-bridge-flow"><div><span>Start</span><strong>'+moneyWhole(bridge.previousTotalMinor)+'</strong></div><div><span>Cashflow</span><strong class="'+(bridge.cashflowNetMinor<0?'tone-warning':'tone-ok')+'">'+signedMoneyWhole(bridge.cashflowNetMinor)+'</strong></div><div><span>Marktwerte &amp; Stichtage</span><strong class="'+(bridge.valuationAndOtherMinor<0?'tone-warning':'tone-ok')+'">'+signedMoneyWhole(bridge.valuationAndOtherMinor)+' '+analysisEstimate(true)+'</strong></div><div><span>Heute</span><strong>'+moneyWhole(bridge.currentTotalMinor)+'</strong></div></div><p>Die Restkomponente enthält Marktbewegungen sowie Bewertungs- und Stichtagsunterschiede. Sie ist keine behauptete reine Rendite.</p></details>':'';
  const historyPanel='<details class="wealth-history" open><summary><span><strong>Vermögensverlauf</strong><small>Historie aus Actual, Ghostfolio und FinanceSync</small></span>'+icons.chevron+'</summary><div class="wealth-history-controls" role="group" aria-label="Zeitraum für Vermögensverlauf"><button type="button" data-wealth-range="1m" aria-pressed="false" onclick="setWealthHistoryRange(\'1m\')">1 M.</button><button type="button" data-wealth-range="ytd" aria-pressed="false" onclick="setWealthHistoryRange(\'ytd\')">YTD</button><button type="button" data-wealth-range="1y" aria-pressed="true" onclick="setWealthHistoryRange(\'1y\')">1 J.</button><button type="button" data-wealth-range="max" aria-pressed="false" onclick="setWealthHistoryRange(\'max\')">Max</button></div><div id="wealth-history-content" class="wealth-history-content" aria-live="polite"></div></details>';
  const months=data.cashflow.months||[];
  const selection=cashflowSelection();
  const range=data.cashflow.range||{months:months.length||selection.months,offset:selection.offset,start:months.at(0)?.key,end:months.at(-1)?.key,endPartial:Boolean(months.at(-1)?.partial)};
  const rangeLabel=cashflowRangeLabel(range);
  const rangeDetail=cashflowRangeDetail(range);
  const rangeAccessible=rangeLabel+". "+rangeDetail;
  const chartMax=Math.max(1,...months.flatMap(month=>[month.incomeMinor,month.spentMinor]));
  const chart=months.length?months.map(month=>'\
    <div class="cashflow-month"><div class="bar-pair">\
      <span class="chart-bar income" style="--bar-height:'+Math.max(2,month.incomeMinor/chartMax*100)+'%"><span class="chart-value">'+numberWhole(month.incomeMinor)+'</span></span>\
      <span class="chart-bar spent" style="--bar-height:'+Math.max(2,month.spentMinor/chartMax*100)+'%"><span class="chart-value">'+numberWhole(month.spentMinor)+'</span></span>\
    </div><span class="chart-month-label">'+esc(month.label)+(month.partial?'*':'')+'</span></div>').join(""):'';
  const chartTable=months.map(month=>'<tr><th>'+esc(month.label)+(month.partial?' bis heute':'')+'</th><td>'+moneyWhole(month.incomeMinor)+'</td><td>'+moneyWhole(month.spentMinor)+'</td></tr>').join("");
  const cashflow=data.cashflow.state==="current"?'\
    <div class="chart-legend"><span class="legend-key"><i style="background:var(--blue)"></i>Einnahmen</span><span class="legend-key"><i style="background:var(--orange)"></i>Ausgaben</span></div>\
    <div class="cashflow-chart" style="--month-count:'+months.length+'" role="img" aria-label="Einnahmen und Ausgaben. '+esc(rangeAccessible)+'">'+chart+'</div>\
    <table class="sr-only"><caption>Geldfluss: '+esc(rangeAccessible)+'</caption><thead><tr><th>Monat</th><th>Einnahmen</th><th>Ausgaben</th></tr></thead><tbody>'+chartTable+'</tbody></table>'
    :'<div class="panel-unavailable"><p>Geldfluss ist momentan nicht verfügbar.<br>Beim Aktualisieren wird der Abruf erneut versucht.</p></div>';
  const allocation=data.investments.allocation||[];
  const allocationMax=Math.max(1,...allocation.map(item=>item.amountMinor));
  const allocationRows=allocation.length?allocation.map(item=>'\
    <div class="allocation-row"><span>'+esc(item.label)+'</span><span class="allocation-track" aria-hidden="true"><i style="--width:'+item.amountMinor/allocationMax*100+'%"></i></span><strong>'+moneyWhole(item.amountMinor)+'</strong></div>').join("")
    :'<div class="panel-unavailable"><p>Die Vermögensaufteilung ist momentan nicht verfügbar.</p></div>';
  const categories=data.spending.categories||[];
  const selectedSpendingOffset=Number.isInteger(data.spending.monthOffset)?data.spending.monthOffset:spendingSelection().offset;
  const latestSpendingMonth=data.spending.latestMonth||shiftMonthKey(data.spending.month,selectedSpendingOffset);
  const spendingControls=data.spending.state==="current"?'\
    <div class="period-controls" aria-label="Monat für Ausgaben"><button class="range-previous" type="button" onclick="shiftSpending(1)" aria-label="Einen Ausgabenmonat zurück" title="Einen Monat zurück">'+icons.chevron+'</button><label class="sr-only" for="spending-month">Angezeigter Ausgabenmonat</label><select class="spending-window" id="spending-month" name="spending-month" autocomplete="off" onchange="setSpendingOffset(this.value)">'+spendingMonthOptions(latestSpendingMonth,selectedSpendingOffset)+'</select><button class="range-next" type="button" onclick="shiftSpending(-1)" aria-label="Einen Ausgabenmonat vor" title="Einen Monat vor"'+(selectedSpendingOffset===0?' disabled':'')+'>'+icons.chevron+'</button></div>':'';
  const spendingMax=Math.max(1,...categories.map(item=>item.amountMinor));
  const categoryRows=categories.map(item=>'\
    <div class="spending-row"><span>'+esc(item.label)+'</span><span class="spending-track" aria-hidden="true"><i style="--width:'+item.amountMinor/spendingMax*100+'%"></i></span><strong>'+moneyWhole(item.amountMinor)+'</strong></div>').join("");
  const spending=data.spending.state==="current"?'\
    <div class="spending-list">'+categoryRows+'<div class="spending-row spending-other"><span>Weitere Kategorien</span><span class="spending-track"></span><strong>'+moneyWhole(data.spending.remainingMinor)+'</strong></div></div>\
    <div class="panel-footer"><a class="panel-link" href="?expenseMonth='+esc(data.spending.month||'')+'#/spending">'+esc(data.spending.monthLabel||'Monat')+' im Detail ansehen</a></div>'
    :'<div class="panel-unavailable"><p>Die Ausgabenübersicht ist momentan nicht verfügbar.</p></div>';
  const freshnessStatus={
    current:{tone:"ok",label:"Aktuell"},
    confirmed:{tone:"warning",label:"Bestätigt"},
    warning:{tone:"warning",label:"Hinweis"},
    error:{tone:"critical",label:"Fehler"},
    unavailable:{tone:"critical",label:"Nicht verfügbar"}
  };
  const freshnessExceptions=data.freshness.filter(item=>item.status!=="current"&&item.status!=="confirmed");
  const freshnessRows=freshnessExceptions.length?freshnessExceptions.map(item=>{
    const info=freshnessStatus[item.status]||freshnessStatus.warning;
    const detail=item.status==="confirmed"?monthWord(item.capturedAt):(item.capturedAt&&new Date(item.capturedAt).toDateString()===new Date(data.generatedAt).toDateString()?"heute":formatDate(item.capturedAt));
    const icon=item.key==="cash"?icons.bank:item.key==="solana"?icons.wallet:item.key==="pensions"?icons.status:icons.assets;
    return '<div class="freshness-row">'+icon+'<div class="freshness-label"><strong>'+esc(item.label)+'</strong><span>· '+esc(detail)+'</span></div><div class="freshness-status tone-'+info.tone+'">'+statusIcon(info.tone)+'<span>'+(item.status==="confirmed"?esc(monthWord(item.capturedAt)):info.label)+'</span></div></div>';
  }).join(""):'<div class="freshness-ok">'+statusIcon("ok")+'<span>Alle automatischen Quellen sind aktuell.</span></div>';
  const warning=data.warnings.length?'<div class="overview-warning" role="status">Die Übersicht ist teilweise verfügbar: '+data.warnings.map(esc).join(" · ")+'</div>':'';
  document.getElementById("dashboard").innerHTML='\
    <section class="wealth-overview" aria-label="Vermögensübersicht">\
      <div><span class="wealth-label">Gesamtvermögen</span><strong class="wealth-value">'+moneyWhole(total)+'</strong><p class="wealth-date">Stand '+esc(formatDate(data.generatedAt))+' · Bankkonten und Anlagen</p>'+comparisonSummary+'</div>\
      <div class="wealth-composition"><div class="wealth-health">'+statusIcon(automaticOk?"ok":"warning")+'<span>'+(automaticOk?'Automatische Quellen aktuell':'Quellenstatus mit Hinweisen')+'</span></div>'+composition+'<div class="composition-legend"><span><i class="composition-cash"></i>Liquidität <strong>'+moneyWhole(data.cash.amountMinor)+'</strong></span><span><i class="composition-investments"></i>Anlagen <strong>'+moneyWhole(data.investments.amountMinor)+'</strong></span></div></div>\
      '+historyPanel+wealthBridge+comparisonPanel+'\
    </section>'+warning+action+'\
    <div class="overview-dashboard-grid">\
      <section class="overview-panel" data-month-count="'+months.length+'" aria-labelledby="cashflow-title"><div class="panel-header cashflow-panel-header"><div><h2 id="cashflow-title">Geldfluss</h2><p class="cashflow-period">'+esc(rangeLabel)+' <span aria-hidden="true">·</span> '+esc(rangeDetail)+'</p></div><div class="period-controls" aria-label="Zeitraum für Geldfluss"><button class="range-previous" type="button" onclick="shiftCashflow(1)" aria-label="Einen Monat zurück" title="Einen Monat zurück">'+icons.chevron+'</button><label class="sr-only" for="cashflow-window">Angezeigter Zeitraum</label><select class="cashflow-window" id="cashflow-window" name="cashflow-window" autocomplete="off" onchange="setCashflowMonths(this.value)"><option value="4"'+(range.months===4?' selected':'')+'>4 Monate</option><option value="6"'+(range.months===6?' selected':'')+'>6 Monate</option><option value="12"'+(range.months===12?' selected':'')+'>12 Monate</option></select><button class="range-next" type="button" onclick="shiftCashflow(-1)" aria-label="Einen Monat vor" title="Einen Monat vor"'+(range.offset===0?' disabled':'')+'>'+icons.chevron+'</button></div></div>'+cashflow+'</section>\
      <section class="overview-panel" aria-labelledby="allocation-title"><div class="panel-header"><h2 id="allocation-title">Vermögensaufteilung</h2><a class="panel-link" href="?assetArea=all#/assets">Details in Vermögen</a></div><div class="allocation-list">'+allocationRows+'</div></section>\
      <section class="overview-panel" aria-labelledby="spending-title"><div class="panel-header spending-panel-header"><div class="spending-summary"><h2 id="spending-title">Ausgaben</h2><strong>'+moneyWhole(data.spending.totalMinor)+'</strong></div>'+spendingControls+'</div>'+spending+'</section>\
      <section class="overview-panel" aria-labelledby="freshness-title"><div class="panel-header"><h2 id="freshness-title">Datenbasis</h2></div><div class="freshness-list">'+freshnessRows+'</div><p class="data-checked">Zuletzt geprüft '+esc(formatDate(data.generatedAt,true))+'</p></section>\
    </div>';
  document.getElementById("dashboard").setAttribute("aria-busy","false");
  renderWealthHistory(history);
}

function expenseDate(value){
  const parts=String(value||"").split("-");
  if(parts.length!==3)return esc(value);
  return new Intl.DateTimeFormat("de-DE",{day:"2-digit",month:"2-digit",year:"numeric",timeZone:"UTC"}).format(new Date(Date.UTC(Number(parts[0]),Number(parts[1])-1,Number(parts[2]))));
}function expenseAmount(minor){
  const value=Number(minor)||0;
  return new Intl.NumberFormat("de-DE",{style:"currency",currency:"EUR",signDisplay:value<0?"always":"auto"}).format(-value/100);
}
function expenseState(title,text,action,label,tone="critical"){
  return '<section class="expense-state" role="status"><div class="expense-state-inner">'+statusIcon(tone)+'<h2>'+esc(title)+'</h2><p>'+esc(text)+'</p>'+(action?'<button class="button secondary" type="button" onclick="'+action+'">'+esc(label)+'</button>':'')+'</div></section>';
}
function renderSpendingError(error){
  document.getElementById("dashboard").innerHTML=expenseState("Nicht verfügbar","Die Buchungen konnten nicht geladen werden. Bitte versuche es erneut.","refresh(true)","Erneut versuchen");
  document.getElementById("dashboard").setAttribute("aria-busy","false");
  msg(error?.message||"Die Ausgaben konnten nicht geladen werden.",true);
}
function renderSpending(data){
  currentExpenseMonth=data.month;
  const uiState=expenseSelection();
  const empty=data.summary.bookings===0;
  const period=data.period||{kind:"month",key:data.month,label:data.monthLabel,startMonth:data.month,endMonth:data.month,currentMonth:data.month,latestCompleteMonth:data.latestMonth,oldestMonth:data.oldestMonth,complete:true};
  const periodKind=expenseSelection().period||period.kind||"month";
  const newestMonth=period.currentMonth||data.month;
  const monthControls='<div class="period-controls expense-period-controls" aria-label="Ausgabenzeitraum"><div class="lab-nav" role="tablist">'+[["month","Monat"],["quarter","Quartal"],["ytd","YTD"],["year","Jahr"]].map(([key,label])=>'<button type="button" class="lab-nav-item" aria-current="'+String(periodKind===key)+'" onclick="setExpensePeriod(&quot;'+key+'&quot;,'+(key==="month"?"&quot;"+esc(period.endMonth||data.month)+"&quot;":key==="quarter"?"&quot;"+(period.key.includes("Q")?period.key:period.endMonth.slice(0,4)+"-Q"+Math.ceil(Number((period.endMonth||data.month).slice(5))/3))+"&quot;":"&quot;"+(period.endMonth||data.month).slice(0,4)+"&quot;")+')">'+label+"</button>").join("")+'</div>'+(periodKind==="month"?'<label class="sr-only" for="expense-month">Monat</label><select id="expense-month" autocomplete="off" onchange="setExpensePeriod(&quot;month&quot;,this.value)">'+expenseMonthOptions(newestMonth,data.oldestMonth,period.endMonth||data.month)+"</select>":periodKind==="quarter"?'<label class="sr-only" for="expense-quarter">Quartal</label><select id="expense-quarter" autocomplete="off" onchange="setExpensePeriod(&quot;quarter&quot;,this.value)">'+expenseQuarterOptions(newestMonth,data.oldestMonth,period.key)+"</select>":'<label class="sr-only" for="expense-year">Jahr</label><select id="expense-year" autocomplete="off" onchange="setExpensePeriod(&quot;'+periodKind+'&quot;,this.value)">'+expenseYearOptions(newestMonth,data.oldestMonth,(period.endMonth||data.month).slice(0,4))+"</select>")+(period.complete?"":'<span class="analysis-estimate">laufender Monat</span>')+"</div>";
  const summary='<section class="expense-summary-band" aria-label="Ausgabenübersicht für '+esc(data.monthLabel)+'"><div class="expense-period">'+monthControls+'</div><div class="expense-summary-stat"><span>Gesamtausgaben</span><strong>'+(empty?'–':moneyWhole(data.summary.totalMinor))+'</strong></div><div class="expense-summary-stat"><span>Buchungen</span><strong>'+(empty?'–':esc(data.summary.bookings))+'</strong></div><div class="expense-summary-stat"><span>Kategorisiert</span><strong>'+(empty?'–':esc(data.summary.categorizedPercent)+' %')+'</strong></div></section>';
  const medical=data.medical&&( !data.selection||data.selection.category==="all"||(data.categories||[]).some(category=>category.selected&&category.label==="Arzt & Apotheke"))?'<section class="expense-summary-band" aria-label="Arzt netto"><div class="expense-summary-stat"><span>Arzt brutto</span><strong>'+moneyWhole(data.medical.grossMinor)+'</strong></div><div class="expense-summary-stat"><span>Oldenburger erstattet</span><strong>'+moneyWhole(data.medical.reimbursedMinor)+'</strong></div><div class="expense-summary-stat"><span>Netto / Selbstbehalt</span><strong>'+moneyWhole(data.medical.netMinor)+'</strong></div></section>':'';
  if(empty){
    document.getElementById("dashboard").innerHTML=summary+medical+'<div style="margin-top:12px">'+expenseState("Keine Buchungen","Für diesen Monat liegen keine Buchungen vor. Wähle einen anderen Monat.","document.getElementById(&quot;expense-month&quot;).focus()","Monat wechseln","warning")+'</div>';
    document.getElementById("dashboard").setAttribute("aria-busy","false");
    return;
  }
  const selectedCategory=data.categories.find(category=>category.selected)?.label||"Alle Kategorien";
  const maxCategory=Math.max(1,...data.categories.filter(category=>category.key!=="all").map(category=>Math.max(0,category.amountMinor)));
  const categoryRows=data.categories.map((category,index)=>{
    const width=category.key==="all"?0:Math.max(1,Math.round(Math.max(0,category.amountMinor)/maxCategory*100));
    return '<button class="expense-category'+(category.key==="all"?' expense-category-all':'')+'" type="button" data-label="'+esc(category.label)+'" aria-current="'+String(category.selected)+'" onclick="setExpenseCategory(&quot;'+esc(category.key)+'&quot;)"><span class="expense-category-main"><span class="expense-category-check">'+icons.check+'</span><span class="expense-category-name">'+esc(category.label)+'</span><strong>'+moneyWhole(category.amountMinor)+'</strong></span><span class="expense-category-track" aria-hidden="true"><i style="--width:'+width+'%"></i></span></button>';
  }).join("");
  const more=data.categories.length>6?'<button class="expense-category-more" type="button" aria-expanded="'+String(uiState.expanded)+'" onclick="toggleExpenseCategories(this)"><span>'+(uiState.expanded?'Weniger anzeigen':'Weitere anzeigen')+'</span>'+icons.chevron+'</button>':'';
  const accounts='<option value="all"'+(data.selection.account==="all"?' selected':'')+'>Alle Konten</option>'+data.accounts.map(account=>'<option value="'+esc(account.key)+'"'+(account.key===data.selection.account?' selected':'')+'>'+esc(account.label)+'</option>').join("");
  const groups=data.merchantGroups||[];
  const merchantRows=groups.map(group=>'<details class="fire-merchant-group expense-merchant-group"><summary><span class="fire-merchant-main"><strong>'+esc(group.label)+'</strong><small>'+group.bookings+' '+(group.bookings===1?'Buchung':'Buchungen')+'</small></span><strong>'+expenseAmount(group.amountMinor)+'</strong>'+icons.chevron+'</summary><div class="fire-merchant-bookings" aria-label="Einzelbuchungen für '+esc(group.label)+'">'+(group.transactions||[]).map(row=>'<div class="fire-booking-row"><time datetime="'+esc(row.date)+'">'+expenseDate(row.date)+'</time><span>'+esc(row.merchant)+(row.account?' · '+esc(row.account):'')+(row.category?' · '+esc(row.category):'')+'</span><strong class="expense-amount'+(row.amountMinor<0?' expense-refund':'')+'">'+expenseAmount(row.amountMinor)+'</strong></div>').join("")+'</div></details>').join("");
  const sortBar='<div class="expense-sort-bar" aria-label="Buchungen sortieren"><table class="expense-table"><thead><tr>'+expenseSortHeader("date","Datum",uiState.sort)+expenseSortHeader("merchant","Händler",uiState.sort)+expenseSortHeader("amount","Betrag",uiState.sort)+'</tr></thead></table></div>';
  const transactionBody=groups.length?sortBar+'<div class="fire-merchant-list" aria-label="Händlergruppen">'+merchantRows+'</div>':expenseState("Keine Treffer","Für diese Filter liegen keine Buchungen vor.","setExpenseParams({category:&quot;&quot;,account:&quot;&quot;,search:&quot;&quot;,page:1})","Filter zurücksetzen","warning");
  const page=data.pagination;
  const pagination='<div class="expense-pagination"><span>'+page.from+'–'+page.to+' von '+page.total+' Gruppen</span><div class="expense-pagination-actions"><button class="page-previous" type="button" onclick="setExpensePage('+(page.page-1)+')" aria-label="Vorherige Buchungsseite"'+(page.page<=1?' disabled':'')+'>'+icons.chevron+'</button><button class="page-next" type="button" onclick="setExpensePage('+(page.page+1)+')" aria-label="Nächste Buchungsseite"'+(page.page>=page.pages?' disabled':'')+'>'+icons.chevron+'</button></div></div>';
  document.getElementById("dashboard").innerHTML=summary+medical+'<div class="expense-workspace"><section class="expense-pane expense-category-pane'+(uiState.expanded?' categories-expanded':'')+'" id="expense-category-pane" aria-labelledby="expense-categories-title"><div class="expense-pane-heading"><h2 id="expense-categories-title">Kategorien</h2></div><label class="expense-search"><span class="sr-only">Kategorie suchen</span>'+icons.search+'<input type="search" name="expense-category-search" value="'+esc(uiState.categorySearch)+'" autocomplete="off" placeholder="Kategorie suchen …" oninput="filterExpenseCategories(this.value)"></label><div class="expense-category-list">'+categoryRows+'</div>'+more+'</section><section class="expense-pane expense-transactions-pane" aria-labelledby="expense-transactions-title"><div class="expense-pane-heading"><h2 id="expense-transactions-title">Händler und Dienste</h2><p>'+esc(selectedCategory)+' · '+groups.length+' Gruppen · '+data.filtered.bookings+' Buchungen · größte Summe zuerst</p></div><div class="expense-toolbar"><label class="expense-search"><span class="sr-only">Händler oder Buchung suchen</span>'+icons.search+'<input type="search" name="expense-transaction-search" value="'+esc(data.selection.search)+'" autocomplete="off" placeholder="Händler oder Buchung suchen …" oninput="updateExpenseSearch(this.value)"></label><label><span class="sr-only">Konto filtern</span><select name="expense-account" autocomplete="off" onchange="setExpenseAccount(this.value)">'+accounts+'</select></label></div>'+transactionBody+pagination+'</section></div>';
  if(uiState.categorySearch)filterExpenseCategories(uiState.categorySearch);
  document.getElementById("dashboard").setAttribute("aria-busy","false");
}

function assetStatusLabel(state,capturedAt){
  if(state==="confirmed")return "Bestätigt";
  if(state==="stale")return "Veraltet";
  if(state==="error")return "Abruf fehlgeschlagen";
  if(state==="unavailable")return "Nicht verfügbar";
  return "Aktuell";
}
function assetAreaStatusLabel(state){
  return state==="confirmed"?"Bestätigt":state==="stale"?"Veraltet":state==="error"?"Fehler":state==="unavailable"?"Nicht verfügbar":"Aktuell";
}
function assetAreaIcon(area){return area==="cash"?icons.bank:area==="crypto"?icons.wallet:area==="pensions"?icons.manual:icons.assets}
function assetQuantity(value){return new Intl.NumberFormat("de-DE",{maximumFractionDigits:6}).format(Number(value))}
function assetPerformancePercent(value){return new Intl.NumberFormat("de-DE",{minimumFractionDigits:1,maximumFractionDigits:2,signDisplay:"always"}).format(Number(value))+" %"}
function assetPerformanceTone(value){return Number(value)<0?"loss":Number(value)>0?"gain":"flat"}
function assetPerformanceLabel(minor,percent){
  if(!Number.isFinite(minor)||!Number.isFinite(percent))return "Performance nicht verfügbar";
  const label=Number(minor)<0?"Verlust":Number(minor)>0?"Gewinn":"Unverändert";
  return label+" "+signedMoney(minor)+" ("+assetPerformancePercent(percent)+")";
}
function assetHoldingRows(position){
  const rows=position.holdings||[];
  return rows.length?'<div class="asset-holding-list" aria-label="Einzelpositionen von '+esc(position.label)+'">'+rows.map(holding=>'<div class="asset-holding"><span><strong>'+esc(holding.label)+'</strong><small>'+esc(holding.symbol)+' · '+assetQuantity(holding.quantity)+' Stück · Kurs '+money(holding.marketPriceMinor)+'</small><small>Einstand '+money(holding.investmentMinor)+' · Brutto '+signedMoney(holding.grossPerformanceMinor)+' · Dividenden '+money(holding.dividendMinor)+'</small></span><span class="asset-holding-values"><strong>'+money(holding.valueMinor)+'</strong><small class="asset-performance '+assetPerformanceTone(holding.netPerformanceMinor)+'">'+assetPerformanceLabel(holding.netPerformanceMinor,holding.netPerformancePercent)+'</small></span></div>').join('')+'</div>':'<div class="asset-holding-empty">Ghostfolio liefert für dieses Depot aktuell keine Einzelpositionen.</div>';
}
function toggleAssetHoldings(id,button){
  const row=document.getElementById(id);
  if(!row)return;
  const opening=row.hidden;
  row.hidden=!opening;
  button.setAttribute("aria-expanded",String(opening));
}
function renderAssetsError(error){
  document.getElementById("dashboard").innerHTML=expenseState("Nicht verfügbar","Die Vermögenswerte konnten nicht geladen werden. Bitte versuche es erneut.","refresh(true)","Erneut versuchen");
  document.getElementById("dashboard").setAttribute("aria-busy","false");
  msg(error?.message||"Die Vermögenswerte konnten nicht geladen werden.",true);
}
function renderAssets(data){
  const selection=assetSelection();
  const selectedArea=data.areas.find(area=>area.key===selection);
  const filtered=selection==="all"?data.positions:data.positions.filter(position=>position.area===selection);
  const allocationLabel=data.areas.map(area=>area.label+" "+(area.amountMinor===null?"nicht verfügbar":moneyWhole(area.amountMinor))).join(", ");
  const segments=data.totalMinor===null?"":data.areas.map(area=>{
    const width=area.amountMinor===null||data.totalMinor<=0?0:Math.max(0,area.amountMinor/data.totalMinor*100);
    return '<span class="area-'+area.key+'" style="width:'+width+'%;background:var(--area-color)" title="'+esc(area.label)+'"></span>';
  }).join("");
  const legend=data.areas.map(area=>'<div class="assets-legend-item area-'+area.key+'"><i aria-hidden="true"></i><span>'+esc(area.label)+'</span><strong>'+(area.amountMinor===null?'–':moneyWhole(area.amountMinor))+'</strong></div>').join("");
  const summaryStatus=data.state==="partial"
    ? '<span class="tone-critical">Teilweise nicht verfügbar</span>'
    : data.state==="stale"
      ? '<span class="tone-warning">Werte teilweise veraltet</span>'
      : '<strong>'+data.summary.automaticCurrent+' automatische Quellen aktuell</strong> · '+data.summary.confirmed+' bestätigt';
  const historyDetail=data.marketHistory?.latestDate?'Marktwerte täglich archiviert bis '+formatDate(data.marketHistory.latestDate):'Marktwertarchiv wird aufgebaut';
  const summary='<section class="assets-summary" aria-label="Vermögensübersicht"><div class="assets-total"><span>Gesamtvermögen</span><strong>'+(data.totalMinor===null?'–':moneyWhole(data.totalMinor))+'</strong><small>Basis: letzte verfügbare Werte · '+esc(historyDetail)+'</small></div><div class="assets-allocation"><p class="assets-status-line">'+summaryStatus+'</p><div class="assets-bar" role="img" aria-label="'+esc(allocationLabel)+'">'+segments+'</div><div class="assets-legend">'+legend+'</div></div></section>';
  const areaButtons=data.areas.map(area=>{
    const active=area.key===selection;
    return '<button class="asset-area-button area-'+area.key+'" type="button" aria-current="'+String(active)+'" onclick="setAssetArea(&quot;'+area.key+'&quot;)"><span class="asset-area-title"><i class="asset-area-dot" aria-hidden="true"></i>'+esc(area.label)+'</span><span class="asset-area-value"><strong>'+(area.amountMinor===null?'–':moneyWhole(area.amountMinor))+'</strong><span>'+(area.percent===null?'–':new Intl.NumberFormat("de-DE",{maximumFractionDigits:1}).format(area.percent)+' %')+'</span></span><span class="asset-area-meta">'+area.positions+' '+(area.positions===1?'Position':'Positionen')+' · '+esc(assetAreaStatusLabel(area.status))+'</span></button>';
  }).join("");
  const options='<option value="all"'+(selection==="all"?' selected':'')+'>Alle Bereiche</option>'+data.areas.map(area=>'<option value="'+area.key+'"'+(selection===area.key?' selected':'')+'>'+esc(area.label)+'</option>').join("");
  const confirmedDates=data.positions.filter(position=>position.area==="pensions"&&(position.confirmedAt||position.capturedAt)).map(position=>position.confirmedAt||position.capturedAt).sort();
  const notice=data.state==="partial"
    ? '<div class="assets-notice"><span>'+esc(data.warnings[0]||"Teilwerte sind nicht verfügbar")+'</span><a href="#/data-status">Zum Datenstatus</a></div>'
    : confirmedDates.length&&(selection==="all"||selection==="pensions")
      ? '<div class="assets-notice"><span>Vorsorgewerte zuletzt am '+esc(formatDate(confirmedDates.at(-1)))+' bestätigt</span><a href="#/data-status">Zum Datenstatus</a></div>'
      : '';
  const desktopRows=filtered.map(position=>{const cost=Number.isFinite(position.acquisitionCostMinor)?'<span class="asset-state-text">Kauf '+(position.acquisitionCostEstimated?'ca. ':'')+moneyWhole(position.acquisitionCostMinor)+(position.detail?' · '+esc(position.detail):'')+'</span>':position.detail?'<span class="asset-state-text">'+esc(position.detail)+'</span>':'';const confirmed=Number.isFinite(position.confirmedAmountMinor)?'<span class="asset-state-text">Vertragswert '+moneyWhole(position.confirmedAmountMinor)+' bestätigt am '+esc(formatDate(position.confirmedAt))+'</span>':'';const performance=Number.isFinite(position.netPerformanceMinor)?'<span class="asset-state-text asset-performance '+assetPerformanceTone(position.netPerformanceMinor)+'">'+assetPerformanceLabel(position.netPerformanceMinor,position.netPerformancePercent)+'</span>':'';const expandable=position.area==="depots"&&Array.isArray(position.holdings);const holdingId="asset-holdings-"+position.key;const label=expandable?'<button class="asset-position-toggle" type="button" aria-expanded="false" aria-controls="'+holdingId+'" onclick="toggleAssetHoldings(&quot;'+holdingId+'&quot;,this)">'+assetAreaIcon(position.area)+'<span>'+esc(position.label)+cost+'</span>'+icons.chevron+'</button>':assetAreaIcon(position.area)+' '+esc(position.label)+cost;const main='<tr class="asset-position-row"><td title="'+esc(position.label)+'">'+label+'</td><td><span class="asset-area-cell area-'+position.area+'"><i class="asset-area-dot" aria-hidden="true"></i>'+esc(position.areaLabel)+'</span></td><td>'+(position.amountMinor===null?'–':moneyWhole(position.amountMinor))+performance+confirmed+'</td><td>'+esc(position.capturedAt?formatDate(position.capturedAt):"–")+'<span class="asset-state-text">'+esc(assetStatusLabel(position.status,position.capturedAt))+'</span></td><td>'+esc(position.basis)+(position.valuationSource?'<span class="asset-state-text">'+esc(position.valuationSource)+'</span>':'')+'</td></tr>';return main+(expandable?'<tr class="asset-holdings-row" id="'+holdingId+'" hidden><td colspan="5">'+assetHoldingRows(position)+'</td></tr>':'')}).join("");
  const mobileRows=filtered.map(position=>{const cost=Number.isFinite(position.acquisitionCostMinor)?' · Kauf '+(position.acquisitionCostEstimated?'ca. ':'')+moneyWhole(position.acquisitionCostMinor):'';const confirmed=Number.isFinite(position.confirmedAmountMinor)?' · Vertragswert '+moneyWhole(position.confirmedAmountMinor)+' bestätigt '+formatDate(position.confirmedAt):'';const performance=Number.isFinite(position.netPerformanceMinor)?'<span class="asset-performance '+assetPerformanceTone(position.netPerformanceMinor)+'">'+assetPerformanceLabel(position.netPerformanceMinor,position.netPerformancePercent)+'</span>':'';const content='<strong>'+esc(position.label)+'</strong><span class="asset-mobile-value"><strong>'+(position.amountMinor===null?'–':moneyWhole(position.amountMinor))+'</strong>'+performance+'</span><span class="asset-mobile-meta area-'+position.area+'">'+esc(position.areaLabel)+' · '+esc(position.basis)+(position.valuationSource?' · '+esc(position.valuationSource):'')+'</span><span class="asset-mobile-meta">'+esc(position.detail||'')+cost+confirmed+' · '+esc(position.capturedAt?formatDate(position.capturedAt):"–")+'</span>';return position.area==="depots"&&Array.isArray(position.holdings)?'<details class="assets-mobile-row assets-mobile-depot"><summary>'+content+icons.chevron+'</summary>'+assetHoldingRows(position)+'</details>':'<article class="assets-mobile-row">'+content+'</article>'}).join("");
  const positionBody=filtered.length
    ? '<div class="assets-table-wrap"><table class="assets-table"><thead><tr><th>Position</th><th>Bereich</th><th>Wert</th><th>Stichtag</th><th>Datenbasis</th></tr></thead><tbody>'+desktopRows+'</tbody></table></div><div class="assets-mobile-list">'+mobileRows+'</div>'
    : expenseState("Keine Positionen","Für den gewählten Bereich liegen keine Werte vor.","setAssetArea(&quot;all&quot;)","Alle Bereiche anzeigen","warning");
  const title=selectedArea?selectedArea.label:"Bestände";
  document.getElementById("dashboard").innerHTML=summary+'<div class="assets-workspace"><section class="assets-pane assets-area-pane" aria-labelledby="assets-areas-title"><h2 id="assets-areas-title">Vermögensbereiche</h2><label class="assets-mobile-filter"><span class="sr-only">Vermögensbereich auswählen</span><select name="asset-area" autocomplete="off" onchange="setAssetArea(this.value)">'+options+'</select></label><div class="asset-area-list">'+areaButtons+'</div></section><section class="assets-pane" aria-labelledby="assets-positions-title"><div class="assets-pane-header"><div><h2 id="assets-positions-title">'+esc(title)+'</h2><p>'+(selection==="all"?'Alle Bereiche':esc(selectedArea?.label||""))+' · '+filtered.length+' '+(filtered.length===1?'Position':'Positionen')+'</p></div></div>'+notice+positionBody+'</section></div>';
  document.getElementById("dashboard").setAttribute("aria-busy","false");
}

function renderAnalysesError(error){
  currentAnalysisData=null;
  document.getElementById("dashboard").innerHTML=expenseState("Nicht verfügbar","Die Ausgabenstruktur konnte nicht geladen werden. Bitte versuche es erneut.","refresh(true)","Erneut versuchen");
  document.getElementById("dashboard").setAttribute("aria-busy","false");
  msg(error?.message||"Die Analyse konnte nicht geladen werden.",true);
}
function newsletterSource(item){return item.source||(/hkcm|hopf|klinkm/i.test(item.subject+" "+item.sender)?"HKCM":/friedrich/i.test(item.subject+" "+item.sender)?"Friedrich Report":"Newsletter")}
function newsletterGroups(data){
  const normalized=value=>String(value||"").toLocaleUpperCase("de-DE").replace(/[^A-Z0-9ÄÖÜ]/g,"");
  const prices=new Map((data.prices||[]).flatMap(price=>[[normalized(price.symbol),price],[normalized(price.name),price]]));
  const groups=new Map();
  (data.items||[]).forEach(item=>(item.theses||[]).forEach(thesis=>{
    const key=(thesis.ticker||thesis.instrument).trim().toLocaleUpperCase("de-DE");
    const group=groups.get(key)||{key,instrument:thesis.instrument,ticker:thesis.ticker,assetClass:thesis.assetClass,items:[],theses:[],sources:new Set(),evidence:[],risks:[],catalysts:[]};
    group.items.push(item);group.theses.push(thesis);group.sources.add(newsletterSource(item));
    group.evidence.push(...(thesis.evidence||[]).map(text=>({text,item})));group.risks.push(...(thesis.risks||[]));group.catalysts.push(...(thesis.catalysts||[]));
    groups.set(key,group);
  }));
  return [...groups.values()].map(group=>{
    group.items.sort((a,b)=>String(b.receivedAt).localeCompare(String(a.receivedAt)));
    const latest=group.items[0];const thesis=group.theses[0];
    group.latest=latest;group.thesis=thesis;group.price=prices.get(normalized(group.ticker))||prices.get(normalized(group.instrument))||null;
    group.state=group.items.every(item=>item.state==="REVIEWED")?"REVIEWED":group.items.every(item=>item.state==="DISMISSED")?"DISMISSED":"UNREVIEWED";
    return group;
  }).sort((a,b)=>String(b.latest.receivedAt).localeCompare(String(a.latest.receivedAt)));
}
function newsletterStance(value){return {BULLISH:"Bullisch",BEARISH:"Bärisch",NEUTRAL:"Neutral",MIXED:"Widersprüchlich"}[value]||value}
function newsletterState(value){return {UNREVIEWED:"Ungeprüft",REVIEWED:"Geprüft",DISMISSED:"Ausgeblendet"}[value]||value}
function newsletterSelection(){const params=new URLSearchParams(location.search);return {source:params.get("newsletterSource")||"all",state:params.get("newsletterState")||"UNREVIEWED",search:(params.get("newsletterSearch")||"").slice(0,80),open:params.get("newsletterOpen")||""}}
function setNewsletterFilters(changes){const params=new URLSearchParams(location.search);const names={source:"newsletterSource",state:"newsletterState",search:"newsletterSearch",open:"newsletterOpen"};Object.entries(changes).forEach(([key,value])=>{const name=names[key],text=String(value||"").trim();if(!text||text==="all"||(key==="state"&&text==="UNREVIEWED"))params.delete(name);else params.set(name,text)});history.pushState(null,"",(params.toString()?"?"+params:location.pathname)+location.hash);renderInvestmentNewsletters(currentNewsletterData)}
function toggleNewsletter(key){const state=newsletterSelection();setNewsletterFilters({open:state.open===key?"":key})}
async function setNewsletterGroupState(key,state){const group=newsletterGroups(currentNewsletterData).find(item=>item.key===key);if(!group)return;await Promise.all(group.items.map(item=>call("/api/dashboard/investment-newsletters/"+encodeURIComponent(item.messageId)+"/state",{method:"PATCH",body:JSON.stringify({state})})));msg(state==="REVIEWED"?"Auswertung als geprüft markiert.":"Auswertung ausgeblendet.");const data=await call("/api/dashboard/investment-newsletters?limit=500");renderInvestmentNewsletters(data)}
function renderInvestmentNewsletters(data){
  currentNewsletterData=data;const selection=newsletterSelection();let groups=newsletterGroups(data);
  groups=groups.filter(group=>(selection.source==="all"||group.sources.has(selection.source))&&(selection.state==="all"||group.state===selection.state)&&(!selection.search||(group.instrument+" "+(group.ticker||"")+" "+group.assetClass).toLocaleLowerCase("de-DE").includes(selection.search.toLocaleLowerCase("de-DE"))));
  const toolbar='<section class="newsletter-toolbar" aria-label="Investment-Cockpit Filter"><label>Ansicht<select onchange="setAnalysisView(this.value)"><option value="expense-structure">Ausgabenstruktur</option><option value="investment-newsletters" selected>Investment-Cockpit</option><option value="crypto-origin-tax">Krypto · Herkunft &amp; Steuerstatus</option></select></label><label>Quelle<select onchange="setNewsletterFilters({source:this.value})"><option value="all">Alle</option><option value="HKCM"'+(selection.source==="HKCM"?' selected':'')+'>HKCM</option><option value="Friedrich Report"'+(selection.source==="Friedrich Report"?' selected':'')+'>Friedrich Report</option></select></label><label>Status<select onchange="setNewsletterFilters({state:this.value})"><option value="UNREVIEWED"'+(selection.state==="UNREVIEWED"?' selected':'')+'>Ungeprüft</option><option value="REVIEWED"'+(selection.state==="REVIEWED"?' selected':'')+'>Geprüft</option><option value="DISMISSED"'+(selection.state==="DISMISSED"?' selected':'')+'>Ausgeblendet</option><option value="all"'+(selection.state==="all"?' selected':'')+'>Alle</option></select></label><label>Suche<input type="search" value="'+esc(selection.search)+'" placeholder="Titel, Instrument, Thema" onsearch="setNewsletterFilters({search:this.value})" onblur="setNewsletterFilters({search:this.value})"></label></section>';
  const totalTheses=(data.items||[]).reduce((sum,item)=>sum+(item.theses||[]).length,0);
  const meta='<div class="newsletter-meta"><strong>'+(data.items||[]).length+' Auswertungen</strong><span>'+totalTheses+' Thesen</span><span>Stand '+esc(formatDate(data.generatedAt,true))+'</span><span>[KI-AUSWERTUNG]</span></div>';
  const totalGroups=groups.length;groups=groups.slice(0,20);
  const rows=groups.map(group=>{const open=selection.open===group.key,thesis=group.thesis,price=group.price;const current=price?money(price.priceMinor,price.currency):'Nicht verfügbar';const target=thesis.targetZone||'Nicht genannt';const sources=[...group.sources].join(' · ');const evidence=group.evidence.slice(0,8).map(entry=>'<blockquote><strong>'+esc(newsletterSource(entry.item))+' · '+esc(formatDate(entry.item.receivedAt))+'</strong><span>'+esc(entry.item.subject)+'</span><p>'+esc(entry.text)+'</p></blockquote>').join('');const detail='<div class="newsletter-detail"><section><h3>Synthese <small>[KI-AUSWERTUNG]</small></h3><p>'+esc(group.latest.summary)+'</p><dl><div><dt>Aktueller Kurs</dt><dd>'+esc(current)+(price?' · '+esc(formatDate(price.capturedAt))+' · '+esc(price.source||'Ghostfolio'):'')+'</dd></div><div><dt>Zielkurs / Zielzone</dt><dd>'+esc(target)+'</dd></div><div><dt>Einstiegszone</dt><dd>'+esc(thesis.entryZone||'Nicht genannt')+'</dd></div><div><dt>Invalidierung</dt><dd>'+esc(thesis.invalidation||'Nicht genannt')+'</dd></div></dl></section><section><h3>Chancen und Risiken</h3><strong>Katalysatoren</strong><ul>'+[...new Set(group.catalysts)].slice(0,6).map(value=>'<li>'+esc(value)+'</li>').join('')+'</ul><strong>Unsicherheiten</strong><ul>'+[...new Set([...group.risks,...group.items.flatMap(item=>item.uncertainties||[])])].slice(0,8).map(value=>'<li>'+esc(value)+'</li>').join('')+'</ul></section><section><details><summary>Belege aus '+group.items.length+' Newslettern'+icons.chevron+'</summary>'+evidence+'</details></section><div class="newsletter-actions"><button class="button" type="button" onclick="setNewsletterGroupState(&quot;'+esc(group.key)+'&quot;,&quot;REVIEWED&quot;)">Prüfen</button><button class="button secondary" type="button" onclick="setNewsletterGroupState(&quot;'+esc(group.key)+'&quot;,&quot;DISMISSED&quot;)">Ausblenden</button></div></div>';return '<article class="newsletter-row'+(open?' is-open':'')+'"><button type="button" class="newsletter-row-toggle" aria-expanded="'+open+'" onclick="toggleNewsletter(&quot;'+esc(group.key)+'&quot;)"><span><strong>'+esc(group.instrument)+'</strong><small>'+esc(group.ticker||group.assetClass)+'</small></span><span><small>Quelle</small>'+esc(sources)+'</span><span class="stance-'+String(thesis.stance).toLowerCase()+'"><small>Einschätzung</small>'+esc(newsletterStance(thesis.stance))+'</span><span><small>Aktueller Kurs</small>'+esc(current)+'</span><span><small>Zielkurs</small>'+esc(target)+'</span><span><small>Horizont</small>'+esc(thesis.horizon||'Nicht genannt')+'</span><span><small>Unterstützt von</small>'+group.items.length+' Newsletter</span><span><small>Status</small>'+esc(newsletterState(group.state))+'</span>'+icons.chevron+'</button>'+(open?detail:'')+'</article>'}).join('');
  const remainder=totalGroups>groups.length?'<p class="newsletter-remainder">20 von '+totalGroups+' Thesengruppen sichtbar · Suche oder Filter nutzen, um weitere gezielt aufzurufen.</p>':'';
  document.getElementById("dashboard").innerHTML=toolbar+meta+(rows?'<section class="newsletter-list" aria-label="Newsletter-Thesen">'+rows+'</section>'+remainder:expenseState("Keine Treffer","Für diese Filter liegen keine Investment-Thesen vor.","setNewsletterFilters({source:&quot;all&quot;,state:&quot;all&quot;,search:&quot;&quot;})","Alle anzeigen","warning"));document.getElementById("dashboard").setAttribute("aria-busy","false");
}
function analysisYearOptions(years,selected,excluded){
  return years.map(year=>'<option value="'+year+'"'+(year===selected?' selected':'')+(year===excluded?' disabled':'')+'>'+year+'</option>').join("");
}
function analysisEstimate(value){return ''}
function analysisMonthLabel(value){
  const match=String(value||"").match(/^(\d{4})-(\d{2})$/);
  if(!match)return esc(value);
  return new Intl.DateTimeFormat("de-DE",{month:"short",year:"numeric",timeZone:"UTC"}).format(new Date(Date.UTC(Number(match[1]),Number(match[2])-1,1)));
}
function renderAnalyses(data){
  currentAnalysisData=data;
  const state=analysisSelection();
  const periodOptions=analysisYearOptions(data.availableYears,data.selection.periodYear,0);
  const comparisonOptions=analysisYearOptions(data.availableYears,data.selection.comparisonYear,data.selection.periodYear);
  const toolbar='<section class="analysis-toolbar" aria-label="Analysefilter"><label>Ansicht<select name="analysis-view" onchange="setAnalysisView(this.value)"><option value="expense-structure" selected>Ausgabenstruktur</option><option value="investment-newsletters">Investment-Cockpit</option><option value="crypto-origin-tax">Krypto · Herkunft &amp; Steuerstatus</option></select></label><label>Zeitraum<select id="analysis-period" name="analysis-period" autocomplete="off">'+periodOptions+'</select></label><label>Vergleich<select id="analysis-comparison" name="analysis-comparison" autocomplete="off">'+comparisonOptions+'</select></label><button class="button" type="button" onclick="applyAnalysisFilters()">Anwenden</button></section>';
  const change=data.changePercent===null?'–':new Intl.NumberFormat("de-DE",{signDisplay:"always",maximumFractionDigits:1}).format(data.changePercent)+' %';
  const changeTone=data.changePercent===null?'':data.changePercent<=0?' tone-ok':' tone-warning';
  const summary='<section class="analysis-summary" aria-label="Zusammenfassung Ausgabenstruktur"><div><span>Wirtschaftliche Ausgaben '+esc(data.period.label)+'</span><strong class="analysis-total">'+(data.state==="empty"?'–':moneyWhole(data.period.totalMinor))+'</strong><p class="analysis-basis">Gebucht, Zusatzwerte einbezogen, interne Überträge ausgeschlossen '+analysisEstimate(data.period.estimate)+'</p></div><div><span>Veränderung zu '+esc(data.comparison.label)+' '+analysisEstimate(data.comparison.estimate)+'</span><strong class="'+changeTone+'">'+change+'</strong></div><div><span>Nicht zuordenbar</span><strong>'+new Intl.NumberFormat("de-DE",{maximumFractionDigits:1}).format(data.unknownPercent)+' %</strong><p class="analysis-basis">'+moneyWhole(data.unknownMinor)+'</p></div></section>';
  if(data.state==="empty"){
    document.getElementById("dashboard").innerHTML=toolbar+summary+'<div style="margin-top:12px">'+expenseState("Keine Ausgaben","Für den gewählten Zeitraum liegen keine auswertbaren Ausgaben vor.","document.getElementById(&quot;analysis-period&quot;).focus()","Zeitraum wechseln","warning")+'</div>';
    document.getElementById("dashboard").setAttribute("aria-busy","false");return;
  }
  const rankedCategories=[...data.categories].sort((left,right)=>Math.abs(right.periodMinor-right.comparisonMinor)-Math.abs(left.periodMinor-left.comparisonMinor));
  const visibleCategories=state.expanded?rankedCategories:rankedCategories.slice(0,8);
  const maxCategory=Math.max(1,...visibleCategories.flatMap(row=>[Math.max(0,row.periodMinor),Math.max(0,row.comparisonMinor)]));
  const categoryRows=visibleCategories.map(row=>{const delta=row.periodMinor-row.comparisonMinor;return '<div class="analysis-category"><span class="analysis-category-label" title="'+esc(row.label)+'">'+esc(row.label)+'<small class="'+(delta>0?'tone-warning':'tone-ok')+'">'+signedMoneyWhole(delta)+'</small></span><span class="analysis-bar-pair" aria-hidden="true"><span class="analysis-bar"><i style="--width:'+Math.max(1,Math.max(0,row.periodMinor)/maxCategory*100)+'%"></i></span><span class="analysis-bar comparison"><i style="--width:'+Math.max(1,Math.max(0,row.comparisonMinor)/maxCategory*100)+'%"></i></span></span><span class="analysis-category-values"><span>'+moneyWhole(row.periodMinor)+'</span><span>'+moneyWhole(row.comparisonMinor)+'</span></span></div>'}).join("");
  const categoryMore=data.categories.length>8?'<button class="analysis-more" type="button" onclick="toggleAnalysisCategories()">'+(state.expanded?'Weniger Kategorien':'Alle '+data.categories.length+' Kategorien anzeigen')+'</button>':'';
  const categories='<section class="analysis-panel" aria-labelledby="analysis-categories-title"><div class="analysis-panel-head"><div><h2 id="analysis-categories-title">Größte Veränderungen nach Kategorie</h2><p>Nach absoluter Abweichung sortiert · Vergleich der gewählten Zeiträume</p></div><div class="analysis-legend"><span><i style="background:var(--blue)"></i>'+esc(data.period.label)+'</span><span><i style="background:#53647f"></i>'+esc(data.comparison.label)+analysisEstimate(data.comparison.estimate)+'</span></div></div><div class="analysis-bars">'+categoryRows+'</div>'+categoryMore+'</section>';
  const maxClass=Math.max(1,...data.classes.map(row=>Math.max(0,row.amountMinor)));
  const classRows=data.classes.map(row=>'<div class="analysis-class-row"><span>'+esc(row.label)+'</span><strong>'+moneyWhole(row.amountMinor)+' · '+new Intl.NumberFormat("de-DE",{maximumFractionDigits:1}).format(row.percent)+' %</strong><span class="analysis-class-track" aria-hidden="true"><i style="--width:'+Math.max(1,Math.max(0,row.amountMinor)/maxClass*100)+'%"></i></span></div>').join("");
  const classes='<section class="analysis-panel" aria-labelledby="analysis-classes-title"><div class="analysis-panel-head"><div><h2 id="analysis-classes-title">Ausgabenklassen</h2><p>Veränderbarkeit der Positionen</p></div></div><div class="analysis-class-list">'+classRows+'</div></section>';
  const positions=data.positions.slice(0,12);
  const desktopRows=positions.map(row=>{
    const open=state.position===row.key;
    const months=row.months.length?row.months.map(month=>'<span>'+analysisMonthLabel(month.month)+' <strong>'+moneyWhole(month.amountMinor)+'</strong></span>').join(""):'<span>Keine Monatswerte verfügbar</span>';
    return '<tr class="analysis-position-row" tabindex="0" role="button" aria-expanded="'+String(open)+'" onclick="toggleAnalysisPosition(&quot;'+esc(row.key)+'&quot;)" onkeydown="if(event.key===&quot;Enter&quot;||event.key===&quot; &quot;){event.preventDefault();toggleAnalysisPosition(&quot;'+esc(row.key)+'&quot;)}"><td>'+esc(row.label)+' '+analysisEstimate(row.estimate)+'</td><td>'+esc(row.category)+'</td><td>'+esc(row.class)+'</td><td>'+moneyWhole(row.amountMinor)+'</td><td>'+icons.chevron+'</td></tr><tr class="analysis-position-detail"'+(open?'':' hidden')+'><td colspan="5"><div class="analysis-months">'+months+'</div></td></tr>';
  }).join("");
  const mobileRows=positions.map(row=>{
    const open=state.position===row.key;
    const months=row.months.map(month=>'<span>'+analysisMonthLabel(month.month)+' <strong>'+moneyWhole(month.amountMinor)+'</strong></span>').join("");
    return '<button class="analysis-mobile-row" type="button" aria-expanded="'+String(open)+'" onclick="toggleAnalysisPosition(&quot;'+esc(row.key)+'&quot;)"><span class="analysis-mobile-main"><strong>'+esc(row.label)+' '+analysisEstimate(row.estimate)+'</strong><strong>'+moneyWhole(row.amountMinor)+'</strong><span class="analysis-mobile-meta">'+esc(row.category)+' · '+esc(row.class)+'</span></span><span class="analysis-mobile-detail analysis-months">'+months+'</span></button>';
  }).join("");
  const positionPanel='<section class="analysis-panel analysis-positions" aria-labelledby="analysis-positions-title"><div class="analysis-panel-head"><div><h2 id="analysis-positions-title">Größte Positionen</h2><p>Die zwölf größten Positionen im gewählten Zeitraum · Zeile öffnen für Monatswerte</p></div></div><table class="analysis-position-table"><thead><tr><th>Position</th><th>Kategorie</th><th>Klasse</th><th>Betrag</th><th><span class="sr-only">Details</span></th></tr></thead><tbody>'+desktopRows+'</tbody></table><div class="analysis-mobile-positions">'+mobileRows+'</div></section>';
  const warnings=data.warnings.map(warning=>'<div class="analysis-warning" role="status">'+icons.warning+'<span>'+esc(warning)+'</span></div>').join("");
  document.getElementById("dashboard").innerHTML=toolbar+summary+'<div class="analysis-grid">'+categories+classes+'</div>'+positionPanel+warnings;
  document.getElementById("dashboard").setAttribute("aria-busy","false");
}

function solAmount(value){return new Intl.NumberFormat("de-DE",{minimumFractionDigits:0,maximumFractionDigits:9}).format(Number(value))}
function perSol(value,currency="EUR"){return new Intl.NumberFormat("de-DE",{style:"currency",currency,minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(value))+"/SOL"}
function confidenceLabel(value){return value==="Bestaetigt"?"Bestätigt":String(value)}
function cryptoTaxStatus(status){
  const labels={review:"Prüfung nötig","likely-tax-free":"Wahrscheinlich steuerfrei","below-threshold":"Unter Freigrenze","future-filing":"Für Erklärung vormerken"};
  return '<span class="crypto-status crypto-status-'+esc(status)+'">'+esc(labels[status]||status)+'</span>';
}
function renderCryptoError(error){
  currentCryptoData=null;
  document.getElementById("dashboard").innerHTML=expenseState("Nicht verfügbar","Die Kryptoanalyse konnte nicht geladen werden. Die rekonstruierte Datenbasis bleibt davon unverändert.","refresh(true)","Erneut versuchen");
  document.getElementById("dashboard").setAttribute("aria-busy","false");
  msg(error?.message||"Die Kryptoanalyse konnte nicht geladen werden.",true);
}
function renderCryptoAnalysis(data){
  currentCryptoData=data;
  const toolbar='<section class="analysis-toolbar crypto-toolbar" aria-label="Auswahl und Datenstand der Kryptoanalyse"><label>Ansicht<select name="analysis-view" autocomplete="off" onchange="setAnalysisView(this.value)"><option value="expense-structure">Ausgabenstruktur</option><option value="investment-newsletters">Investment-Cockpit</option><option value="crypto-origin-tax" selected>Krypto · Herkunft &amp; Steuerstatus</option></select></label><div class="crypto-toolbar-meta"><span>Prüfumfang</span><strong>Ab '+data.selection.scopeStartYear+'</strong></div><div class="crypto-toolbar-meta"><span>Rekonstruktionsstand</span><strong>'+esc(formatDate(data.capturedAt,true))+'</strong></div></section>';
  const summary='<section class="analysis-summary crypto-summary" aria-label="Zusammenfassung der Solana-Position"><div><span>Aktueller Gesamtbestand zum Rekonstruktionsstand</span><strong class="analysis-total">'+solAmount(data.holdings.totalSol)+' SOL</strong><p class="analysis-basis">Quelle: '+esc(data.source)+' · Stake ist kein Abfluss</p></div><div><span>Davon Staking Rewards</span><strong>'+solAmount(data.holdings.rewardsSol)+' SOL</strong><p class="analysis-basis">'+new Intl.NumberFormat("de-DE",{maximumFractionDigits:2}).format(data.holdings.rewardsPercent)+' % des Bestands</p></div><div><span>In Stake-Accounts</span><strong>'+solAmount(data.holdings.stakeTotalSol)+' SOL</strong><p class="analysis-basis">Deaktiviert: '+solAmount(data.holdings.inactiveStakeSol)+' SOL</p></div></section>';
  const investment='<section class="analysis-panel" aria-labelledby="crypto-investment-title"><div class="analysis-panel-head"><div><h2 id="crypto-investment-title">Investmentbasis</h2><p>Ökonomische Average-Cost-Sicht, getrennt von der Steuerbasis</p></div></div><div class="crypto-basis-list"><div class="crypto-basis-row"><div><strong>A. Übergang ETH → SOL</strong><span>Marktwert beim Übergang / erhaltene SOL '+analysisEstimate(true)+'</span></div><strong>'+perSol(data.transition.conversionBasisEurPerSol)+'<small>'+perSol(data.transition.conversionBasisUsdPerSol,"USD")+'</small></strong></div><div class="crypto-basis-row"><div><strong>B. Effektiv inklusive Staking</strong><span>Fortgeführte Kapitalbasis / heutiger Bestand '+analysisEstimate(true)+'</span></div><strong>'+perSol(data.investment.effectiveBasisEurPerSol)+'<small>'+perSol(data.investment.effectiveBasisUsdPerSol,"USD")+'</small></strong></div><div class="crypto-basis-row"><div><strong>C. Netto-Fiatkapital</strong><span>Einzahlungen abzüglich bestätigter Fiat-Auszahlungen · keine steuerliche Cost Basis</span></div><strong>'+money(data.investment.netFiatCapitalEurMinor)+'<small>'+perSol(data.investment.netFiatPerCurrentSolEur)+'</small></strong></div></div><div class="crypto-break-even"><span>Break-even der heutigen Position vor Steuern und Verkaufskosten '+analysisEstimate(true)+'</span><strong>'+perSol(data.investment.breakEvenEurPerSol)+'</strong></div></section>';
  const holdings='<section class="analysis-panel" aria-labelledby="crypto-holdings-title"><div class="analysis-panel-head"><div><h2 id="crypto-holdings-title">Bestandszusammensetzung</h2><p>Mengen sind nicht mit Anschaffungskosten gleichzusetzen</p></div></div><div class="crypto-holdings-list"><div class="crypto-holding-row"><div><strong>Liquide</strong><span>Hauptwallet</span></div><strong>'+solAmount(data.holdings.liquidSol)+' SOL</strong></div><div class="crypto-holding-row"><div><strong>Aktiv delegiert</strong><span>Native Stake-Delegation</span></div><strong>'+solAmount(data.holdings.delegatedSol)+' SOL</strong></div><div class="crypto-holding-row"><div><strong>Noch nicht delegiert</strong><span>Jito-Tips im Stake-Account</span></div><strong>'+solAmount(data.holdings.undelegatedStakeSol)+' SOL</strong></div><div class="crypto-holding-row"><div><strong>Rent-Reserve</strong><span>Grundsätzlich bei Kontoschließung rückholbar</span></div><strong>'+solAmount(data.holdings.rentReserveSol)+' SOL</strong></div><div class="crypto-holding-row"><div><strong>Gekauft oder konvertiert</strong><span>Heutiger Bestand vor Rewards</span></div><strong>'+solAmount(data.holdings.acquiredOrConvertedSol)+' SOL</strong></div></div></section>';
  const taxRows=data.taxYears.map(year=>'<tr><td><strong>'+year.year+'</strong></td><td>'+cryptoTaxStatus(year.status)+'</td><td class="crypto-tax-reference">'+(year.referenceMinor===undefined?'–':money(year.referenceMinor)+(year.estimate?' '+analysisEstimate(true):''))+(year.referenceLabel?'<small>'+esc(year.referenceLabel)+'</small>':'')+'</td><td>'+esc(confidenceLabel(year.confidence))+'</td><td><strong>'+esc(year.title)+'</strong><br><span class="crypto-tax-detail">'+esc(year.detail)+'</span></td></tr>').join("");
  const taxCards=data.taxYears.map(year=>'<article class="crypto-tax-card"><div class="crypto-tax-card-head"><strong>'+year.year+'</strong>'+cryptoTaxStatus(year.status)+'</div><h3>'+esc(year.title)+'</h3><p>'+esc(year.detail)+'</p><p class="crypto-tax-reference">'+(year.referenceMinor===undefined?'Kein belastbarer Betrag':money(year.referenceMinor)+(year.estimate?' '+analysisEstimate(true):''))+(year.referenceLabel?' · '+esc(year.referenceLabel):'')+'</p><p>Belegstatus: '+esc(confidenceLabel(year.confidence))+'</p></article>').join("");
  const tax='<section class="analysis-panel crypto-tax" aria-labelledby="crypto-tax-title"><div class="analysis-panel-head"><div><h2 id="crypto-tax-title">Steuerliche Prüfspur '+data.selection.scopeStartYear+' ff.</h2><p>Keine Steuerschuld, sondern der dokumentierte Prüfstatus je Kalenderjahr</p></div></div><table class="crypto-tax-table"><thead><tr><th scope="col">Jahr</th><th scope="col">Status</th><th scope="col">Referenz</th><th scope="col">Beleglage</th><th scope="col">Einordnung</th></tr></thead><tbody>'+taxRows+'</tbody></table><div class="crypto-tax-mobile">'+taxCards+'</div></section>';
  const evidenceRows=data.evidence.map(item=>'<div class="crypto-evidence-item"><span>'+esc(confidenceLabel(item.confidence))+'</span><strong>'+esc(item.label)+'</strong><p>'+esc(item.detail)+'</p></div>').join("");
  const evidence='<section class="analysis-panel crypto-tax" aria-labelledby="crypto-evidence-title"><div class="analysis-panel-head"><div><h2 id="crypto-evidence-title">Datenbasis &amp; Belegstatus</h2><p>Öffentliche Blockchain-Daten und lokale Exporte, ohne Wallet-Adressen im Browser</p></div></div><div class="crypto-evidence">'+evidenceRows+'</div></section>';
  const warnings=data.warnings.map(warning=>'<div class="analysis-warning" role="status">'+icons.warning+'<span>'+esc(warning)+'</span></div>').join("");
  document.getElementById("dashboard").innerHTML=toolbar+summary+'<div class="crypto-layout">'+investment+holdings+'</div>'+tax+evidence+warnings;
  document.getElementById("dashboard").setAttribute("aria-busy","false");
}

function renderRecurringError(error){
  currentRecurringData=null;currentRecurringDetail=null;
  document.getElementById("dashboard").innerHTML=expenseState("Nicht verfügbar","Die regelmäßigen Ausgaben konnten nicht geladen werden. Bitte versuche es erneut.","refresh(true)","Erneut versuchen");
  document.getElementById("dashboard").setAttribute("aria-busy","false");
  msg(error?.message||"Die regelmäßigen Ausgaben konnten nicht geladen werden.",true);
}
function selectedOption(value,current,label){return '<option value="'+value+'"'+(value===current?' selected':'')+'>'+label+'</option>'}
function recurringDecisionOptions(current){
  return '<option value=""'+(!current?' selected':'')+' disabled>Bitte auswählen</option>'
    +selectedOption("GRUNDBEDARF",current,"Grundbedarf")
    +selectedOption("GESTALTBAR",current,"Gestaltbar")
    +selectedOption("VERMEIDBAR",current,"Vermeidbar")
    +selectedOption("UNKLAR",current,"Unklar")
    +selectedOption("KEIN_KANDIDAT",current,"Kein Kandidat");
}
function recurringDetailMarkup(candidate,detail,instance){
  if(!detail||detail.candidate.key!==candidate.key)return '<div class="recurring-detail" aria-live="polite"><div class="skeleton" style="height:120px">Details werden geladen …</div></div>';
  const item=detail.candidate;
  const decision=item.decision&&!item.decision.stale?item.decision.value:"";
  const stale=item.decision?.stale?'<div class="analysis-warning" role="status">'+icons.warning+'<span>Die frühere Entscheidung passt nicht mehr zur aktuellen Beleglage und muss erneut bestätigt werden.</span></div>':'';
  const reasons=item.markingReasons.map(reason=>'<li>'+esc(reason)+'</li>').join("");
  const payments=detail.payments.map(payment=>'<div class="recurring-payment"><span>'+esc(formatDate(payment.date))+'</span><span>'+esc(payment.category)+(payment.kind==="refund"?' · Erstattung':payment.kind==="exception"?' · Ausnahme':'')+'</span><strong>'+money(payment.amountMinor)+'</strong></div>').join("");
  return '<div class="recurring-detail">'+stale+'<div class="recurring-detail-grid"><div><span>Beobachtungsfenster</span><strong>'+esc(formatDate(item.observation.startDate))+'–'+esc(formatDate(item.observation.endDate))+'</strong></div><div><span>Treffer / Ausnahmen</span><strong>'+item.observation.occurrences+' / '+item.observation.exceptions+'</strong></div><div><span>Spanne</span><strong>'+money(item.amount.minMinor)+'–'+money(item.amount.maxMinor)+'</strong></div><div><span>Beleglage</span><strong>'+esc(item.evidence.label)+' · '+esc(item.evidence.source)+'</strong></div><div><span>Rhythmussicherheit</span><strong>'+esc(item.rhythm.confidence==='hoch'?'Hoch':'Mittel')+'</strong></div><div><span>Klassifikationssicherheit</span><strong>'+esc(item.classification.confidence==='nutzerbestaetigt'?'Vom Nutzer bestätigt':'Unbestätigt')+'</strong></div><div><span>Letzte Zahlung</span><strong>'+esc(formatDate(item.observation.lastPaymentDate))+' · '+money(item.amount.lastMinor)+'</strong></div><div><span>Typischer Abstand</span><strong>'+item.rhythm.typicalDays+' Tage</strong></div></div><ul class="recurring-reasons">'+reasons+'</ul><div class="recurring-decision"><label for="recurring-decision-'+instance+'-'+esc(item.key)+'">Nutzerentscheidung<select id="recurring-decision-'+instance+'-'+esc(item.key)+'" name="recurring-decision" autocomplete="off">'+recurringDecisionOptions(decision)+'</select><p>Erst eine gespeicherte Auswahl bestätigt die Einordnung. Bis dahin bleibt der Treffer eine mögliche regelmäßige Zahlung.</p></label><button class="button" id="recurring-save-'+instance+'-'+esc(item.key)+'" type="button" onclick="saveRecurringDecision(&quot;'+esc(item.key)+'&quot;,&quot;'+instance+'&quot;)">Entscheidung speichern</button></div><div class="recurring-payment-list" aria-label="Beitragende Zahlungen">'+payments+'</div></div>';
}
function renderRecurringExpenses(data){
  currentRecurringData=data;
  const state=analysisSelection();
  const toolbar='<section class="analysis-toolbar recurring-toolbar" aria-label="Filter für regelmäßige Ausgaben"><label>Ansicht<select name="analysis-view" autocomplete="off" onchange="setAnalysisView(this.value)"><option value="expense-structure">Ausgabenstruktur</option><option value="crypto-origin-tax">Krypto · Herkunft &amp; Steuerstatus</option></select></label><label>Rhythmus<select id="recurring-rhythm" name="recurring-rhythm" autocomplete="off">'+selectedOption("alle",data.selection.rhythm,"Alle")+selectedOption("monatlich",data.selection.rhythm,"Monatlich")+selectedOption("vierteljaehrlich",data.selection.rhythm,"Vierteljährlich")+selectedOption("jaehrlich",data.selection.rhythm,"Jährlich")+'</select></label><label>Prüfstatus<select id="recurring-review" name="recurring-review" autocomplete="off">'+selectedOption("moeglich",data.selection.review,"Möglich")+selectedOption("bestaetigt",data.selection.review,"Bestätigt")+selectedOption("kein-kandidat",data.selection.review,"Kein Kandidat")+selectedOption("alle",data.selection.review,"Alle")+'</select></label><label>Einordnung<select id="recurring-classification" name="recurring-classification" autocomplete="off">'+selectedOption("alle",data.selection.classification,"Alle")+selectedOption("GRUNDBEDARF",data.selection.classification,"Grundbedarf")+selectedOption("GESTALTBAR",data.selection.classification,"Gestaltbar")+selectedOption("VERMEIDBAR",data.selection.classification,"Vermeidbar")+selectedOption("UNKLAR",data.selection.classification,"Unklar")+'</select></label><label>Rhythmussicherheit<select id="recurring-confidence" name="recurring-confidence" autocomplete="off">'+selectedOption("alle",data.selection.confidence,"Alle")+selectedOption("hoch",data.selection.confidence,"Hoch")+selectedOption("mittel",data.selection.confidence,"Mittel")+'</select></label><button class="button" type="button" onclick="applyRecurringFilters()">Anwenden</button></section>';
  const summary='<section class="recurring-summary" aria-label="Prüfbestand"><div><span>Mögliche regelmäßige Zahlungen</span><strong>'+data.summary.possible+'</strong></div><div><span>Vom Nutzer bestätigt</span><strong>'+data.summary.confirmed+'</strong></div><div><span>Als kein Kandidat markiert</span><strong>'+data.summary.notCandidate+'</strong></div></section>';
  const freshness='<div class="recurring-freshness"><span>Quelle: '+esc(data.source)+'</span><span>Beobachtet: '+esc(formatDate(data.freshness.windowStart))+'–'+esc(formatDate(data.freshness.windowEnd))+'</span><span>Letzter vollständiger Monat: '+esc(analysisMonthLabel(data.freshness.lastCompleteMonth))+'</span><span>Stand: '+esc(formatDate(data.freshness.lastSuccessfulAt,true))+'</span></div>';
  const warnings=data.warnings.map(warning=>'<div class="analysis-warning" role="status">'+icons.warning+'<span>'+esc(warning)+'</span></div>').join("");
  if(!data.candidates.length){
    const title=data.summary.possible+data.summary.confirmed+data.summary.notCandidate===0?"Keine stabilen Kandidaten":"Keine Treffer für diese Filter";
    const detail=title==="Keine stabilen Kandidaten"?"Im Beobachtungsfenster wurde keine ausreichend stabile und aktuelle Zahlungsfolge erkannt.":"Passe die Filter an, um andere Prüfstände anzuzeigen.";
    document.getElementById("dashboard").innerHTML=toolbar+summary+freshness+warnings+'<div style="margin-top:12px">'+expenseState(title,detail,"document.getElementById(&quot;recurring-rhythm&quot;).focus()","Filter prüfen","warning")+'</div>';
    document.getElementById("dashboard").setAttribute("aria-busy","false");return;
  }
  const desktopRows=data.candidates.map(candidate=>{
    const open=state.candidate===candidate.key;
    const detail=open?recurringDetailMarkup(candidate,currentRecurringDetail,"desktop"):"";
    return '<tr class="recurring-row" data-open="'+String(open)+'"><td><button class="recurring-open" type="button" aria-expanded="'+String(open)+'" onclick="toggleRecurringCandidate(&quot;'+esc(candidate.key)+'&quot;)"><strong>'+esc(candidate.label)+'</strong><span class="recurring-mobile-meta">'+esc(candidate.statusLabel)+'</span></button></td><td>'+esc(candidate.rhythm.label)+'<div class="recurring-mobile-meta">Sicherheit '+esc(candidate.rhythm.confidence)+'</div></td><td>'+money(candidate.amount.typicalMinor)+'</td><td>'+money(candidate.amount.lastMinor)+'</td><td><span class="recurring-status"><strong>'+esc(candidate.classification.label)+'</strong><span>'+esc(candidate.classification.confidence==='nutzerbestaetigt'?'Nutzerbestätigt':'Noch unbestätigt')+'</span></span></td><td aria-hidden="true">'+icons.chevron+'</td></tr><tr class="recurring-detail-row"'+(open?'':' hidden')+'><td colspan="6">'+detail+'</td></tr>';
  }).join("");
  const mobileRows=data.candidates.map(candidate=>{
    const open=state.candidate===candidate.key;
    return '<button class="recurring-mobile-row" type="button" aria-expanded="'+String(open)+'" onclick="toggleRecurringCandidate(&quot;'+esc(candidate.key)+'&quot;)"><span class="recurring-mobile-main"><strong>'+esc(candidate.label)+'</strong><strong>'+money(candidate.amount.typicalMinor)+'</strong><span class="recurring-mobile-meta">'+esc(candidate.rhythm.label)+' · '+esc(candidate.classification.label)+' · '+esc(candidate.statusLabel)+'</span></span></button><div class="recurring-mobile-detail">'+(open?recurringDetailMarkup(candidate,currentRecurringDetail,"mobile"):'')+'</div>';
  }).join("");
  const panel='<section class="analysis-panel recurring-panel" aria-labelledby="recurring-list-title"><div class="analysis-panel-head"><div><h2 id="recurring-list-title">Regelmäßige Ausgaben prüfen</h2><p>'+data.summary.visible+' sichtbare Treffer · keine Summenbildung vor Bestätigung</p></div></div><table class="recurring-table"><thead><tr><th scope="col">Zahlung / Gruppe</th><th scope="col">Rhythmus</th><th scope="col">Typisch</th><th scope="col">Zuletzt</th><th scope="col">Einordnung</th><th scope="col"><span class="sr-only">Details</span></th></tr></thead><tbody>'+desktopRows+'</tbody></table><div class="recurring-mobile-list">'+mobileRows+'</div></section>';
  document.getElementById("dashboard").innerHTML=toolbar+summary+freshness+panel+warnings;
  document.getElementById("dashboard").setAttribute("aria-busy","false");
  if(state.candidate&&(!currentRecurringDetail||currentRecurringDetail.candidate?.key!==state.candidate))loadRecurringDetail(state.candidate);
}

function optimizationStatusOptions(current){
  return selectedOption("PRUEFEN",current,"Prüfen")
    +selectedOption("GEPLANT",current,"Kündigung / Änderung geplant")
    +selectedOption("GEKUENDIGT",current,"Gekündigt / umgesetzt")
    +selectedOption("BEIBEHALTEN",current,"Bewusst beibehalten");
}
function optimizationPriorityOptions(current){
  return '<option value=""'+(!current?' selected':'')+'>Nicht gesetzt</option>'
    +selectedOption("HOCH",current,"Hoch")
    +selectedOption("MITTEL",current,"Mittel")
    +selectedOption("NIEDRIG",current,"Niedrig");
}
async function saveRecurringOptimization(key){
  const item=currentOptimizationData?.items?.find(row=>row.key===key);
  if(!item){msg("Der Eintrag ist nicht mehr aktuell.",true);return}
  const status=document.getElementById("optimization-status-"+key)?.value||"PRUEFEN";
  const effectiveDate=document.getElementById("optimization-date-"+key)?.value||null;
  const savingsText=(document.getElementById("optimization-savings-"+key)?.value||"").trim().replace(",",".");
  const savingsNumber=savingsText===""?null:Number(savingsText);
  if(savingsNumber!==null&&(!Number.isFinite(savingsNumber)||savingsNumber<0)){
    msg("Bitte eine gültige jährliche Entlastung eingeben.",true);return
  }
  const priority=document.getElementById("optimization-priority-"+key)?.value||null;
  const button=document.getElementById("optimization-save-"+key);
  try{
    button.disabled=true;msg("Maßnahme wird gespeichert …");
    const data=await call("/api/decisions/recurring-expenses/"+encoded(key)+"/optimization",{
      method:"PUT",
      body:JSON.stringify({
        status,
        effectiveDate,
        expectedAnnualSavingsMinor:savingsNumber===null?null:Math.round(savingsNumber*100),
        priority,
        expectedEvidenceHash:item.evidenceHash
      })
    });
    if(activeView()==="review"){msg("Maßnahme gespeichert.");await refresh();return}
    renderRecurringOptimizations(data);msg("Maßnahme gespeichert.");
  }catch(error){msg(error.message,true);if(button)button.disabled=false}
}
function renderRecurringOptimizations(data){
  currentOptimizationData=data;
  const toolbar='<section class="analysis-toolbar optimization-toolbar" aria-label="Optimierungsliste"><label>Ansicht<select name="analysis-view" autocomplete="off" onchange="setAnalysisView(this.value)"><option value="expense-structure">Ausgabenstruktur</option><option value="crypto-origin-tax">Krypto · Herkunft &amp; Steuerstatus</option></select></label></section>';
  const savings=data.summary.expectedAnnualSavingsMinor===null?'Noch offen':money(data.summary.expectedAnnualSavingsMinor)+' <small>[SCHÄTZUNG]</small>';
  const summary='<section class="recurring-summary optimization-summary" aria-label="Optimierungsstand"><div><span>Prüfbare Ausgaben</span><strong>'+data.summary.candidates+'</strong></div><div><span>Entschiedene Maßnahmen</span><strong>'+data.summary.actioned+'</strong></div><div><span>Erwartete jährliche Entlastung</span><strong>'+savings+'</strong></div></section>';
  const freshness='<div class="recurring-freshness"><span>Quelle: '+esc(data.source)+'</span><span>Beobachtet bis: '+esc(formatDate(data.freshness.windowEnd))+'</span><span>Stand: '+esc(formatDate(data.generatedAt,true))+'</span></div>';
  const warnings=data.warnings.map(warning=>'<div class="analysis-warning" role="status">'+icons.warning+'<span>'+esc(warning)+'</span></div>').join("");
  if(!data.items.length){
    document.getElementById("dashboard").innerHTML=toolbar+summary+freshness+'<div style="margin-top:12px">'+expenseState("Keine prüfbaren Ausgaben","Bestätige zuerst gestaltbare, vermeidbare oder unklare regelmäßige Ausgaben.","setAnalysisView(&quot;recurring-expenses&quot;)","Ausgaben prüfen","warning")+'</div>'+warnings;
    document.getElementById("dashboard").setAttribute("aria-busy","false");return;
  }
  const cards=data.items.map(item=>{
    const saved=item.optimization&&!item.optimization.stale?item.optimization:null;
    const status=saved?.status||"PRUEFEN";
    const date=saved?.effectiveDate||"";
    const savingsValue=saved?.expectedAnnualSavingsMinor===null||saved?.expectedAnnualSavingsMinor===undefined?"":(saved.expectedAnnualSavingsMinor/100).toFixed(2);
    const stale=item.optimization?.stale?'<p class="optimization-stale" role="status">Die Beleglage hat sich geändert. Bitte Maßnahme erneut bestätigen.</p>':'';
    return '<article class="optimization-card"><div class="optimization-title"><strong>'+esc(item.label)+'</strong><span>'+esc(item.classification.label)+' · '+esc(item.rhythm.label)+'</span><span>Jahreskosten '+money(item.estimatedAnnualCostMinor)+' <small>[SCHÄTZUNG]</small></span><small>'+(saved?'Zuletzt gespeichert '+esc(formatDate(saved.updatedAt,true)):'Noch keine Maßnahme gespeichert')+'</small></div><label>Status<select id="optimization-status-'+esc(item.key)+'" autocomplete="off">'+optimizationStatusOptions(status)+'</select></label><label>Wirksam ab / Enddatum<input id="optimization-date-'+esc(item.key)+'" type="date" value="'+esc(date)+'"></label><label>Jährliche Entlastung in € <span>[SCHÄTZUNG]</span><input id="optimization-savings-'+esc(item.key)+'" type="number" inputmode="decimal" min="0" step="0.01" value="'+esc(savingsValue)+'" placeholder="Noch offen"></label><label>Priorität<select id="optimization-priority-'+esc(item.key)+'" autocomplete="off">'+optimizationPriorityOptions(saved?.priority||"")+'</select></label><button class="button" id="optimization-save-'+esc(item.key)+'" type="button" onclick="saveRecurringOptimization(&quot;'+esc(item.key)+'&quot;)">Maßnahme speichern</button>'+stale+'</article>';
  }).join("");
  const panel='<section class="optimization-list" aria-label="Prüfbare Optimierungsmaßnahmen">'+cards+'</section>';
  document.getElementById("dashboard").innerHTML=toolbar+summary+freshness+panel+warnings;
  document.getElementById("dashboard").setAttribute("aria-busy","false");
}
function renderOptimizationError(error){
  currentOptimizationData=null;
  document.getElementById("dashboard").innerHTML=expenseState("Nicht verfügbar","Die Optimierungsliste konnte nicht geladen werden. Bitte versuche es erneut.","refresh(true)","Erneut versuchen");
  document.getElementById("dashboard").setAttribute("aria-busy","false");
  msg(error?.message||"Die Optimierungsliste konnte nicht geladen werden.",true);
}

function decisionDuration(months){if(months===null)return "Nicht aufgebraucht";if(months===0)return "Sofort";const years=Math.floor(months/12);const rest=months%12;return (years?years+" "+(years===1?"Jahr":"Jahre")+(rest?" und ":""):"")+(rest?rest+" "+(rest===1?"Monat":"Monate"):"")}
function decisionPath(series,key,maxValue){return series.map((point,index)=>{const x=58+point.year/20*704;const y=24+(1-Math.max(0,point[key])/maxValue)*218;return (index?"L":"M")+x.toFixed(1)+" "+y.toFixed(1)}).join(" ")}
function decisionChart(data){
  const maxValue=Math.max(1,...data.series.flatMap(point=>[point.baselineMinor,point.scenarioMinor]));
  const baselinePath=decisionPath(data.series,"baselineMinor",maxValue);
  const scenarioPath=decisionPath(data.series,"scenarioMinor",maxValue);
  const top=moneyWhole(maxValue);const middle=moneyWhole(Math.round(maxValue/2));
  const label="20-Jahres-Projektion [SCHÄTZUNG]. Aktueller Trend nach 20 Jahren "+moneyWhole(data.series.at(-1).baselineMinor)+", Szenario "+moneyWhole(data.series.at(-1).scenarioMinor)+".";
  return '<figure class="decision-chart"><div class="decision-legend" aria-hidden="true"><span><i class="baseline"></i>Aktueller Trend</span><span><i class="scenario"></i>Szenario</span></div><svg viewBox="0 0 800 286" role="img" aria-label="'+esc(label)+'"><g class="decision-grid"><path d="M58 24H762M58 133H762M58 242H762"/><path d="M58 24V242M234 24V242M410 24V242M586 24V242M762 24V242"/></g><g class="decision-axis"><text x="50" y="28" text-anchor="end">'+esc(top)+'</text><text x="50" y="137" text-anchor="end">'+esc(middle)+'</text><text x="50" y="246" text-anchor="end">0 €</text><text x="58" y="270" text-anchor="middle">Heute</text><text x="234" y="270" text-anchor="middle">5 J.</text><text x="410" y="270" text-anchor="middle">10 J.</text><text x="586" y="270" text-anchor="middle">15 J.</text><text x="762" y="270" text-anchor="middle">20 J.</text></g><path class="decision-line baseline" d="'+baselinePath+'"/><path class="decision-line scenario" d="'+scenarioPath+'"/></svg><figcaption>'+esc(label)+'</figcaption></figure>';
}
function fireExit(age){return age===null?'Nicht vor 67':'Mit '+age}
function fireCapitalGoal(goal){
  if(!goal||goal.projectedCapitalMinor===null||goal.requiredCapitalMinor===null||goal.differenceMinor===null){
    return '<div class="fire-capital-goal"><span>Kapitalziel</span><b>Nicht verfügbar</b></div>';
  }
  const positive=goal.differenceMinor>=0;
  return '<div class="fire-capital-goal"><span>Erwartet frei mit '+goal.age+'</span><b>'+moneyWhole(goal.projectedCapitalMinor)+'</b><span>Benötigtes FIRE-Kapital</span><b>'+moneyWhole(goal.requiredCapitalMinor)+'</b><span>'+(positive?'Puffer':'Kapitallücke')+'</span><b class="'+(positive?'tone-ok':'tone-warning')+'">'+moneyWhole(Math.abs(goal.differenceMinor))+'</b><span>Heutige Kaufkraft · Basisjahr 2026</span><b>'+analysisEstimate(true)+'</b></div>';
}
function rememberFireGroup(element,key){
  const params=new URLSearchParams(location.search);
  const groups=new Set((params.get("fireOpenGroups")||"").split(",").filter(value=>["recurring","variable","one-time"].includes(value)));
  if(element.open)groups.add(key);else groups.delete(key);
  if(groups.size)params.set("fireOpenGroups",[...groups].join(","));else params.delete("fireOpenGroups");
  const query=params.toString();history.replaceState(null,"",(query?"?"+query:location.pathname)+location.hash);
}
function toggleFireCategoryDetail(key){
  const params=new URLSearchParams(location.search);
  if(params.get("fireCategory")===key){params.delete("fireCategory");params.delete("fireCategoryPeriod");}
  else{
    params.set("fireCategory",key);params.delete("fireCategoryPeriod");
    const groups=new Set((params.get("fireOpenGroups")||"").split(",").filter(Boolean));groups.add("variable");
    params.set("fireOpenGroups",[...groups].join(","));
  }
  const query=params.toString();history.replaceState(null,"",(query?"?"+query:location.pathname)+location.hash);
  if(currentDecisionLabData)renderDecisionLab(currentDecisionLabData);
}
function setFireCategoryDetailPeriod(value){
  const params=new URLSearchParams(location.search);
  if(value==="previous")params.set("fireCategoryPeriod","previous");else params.delete("fireCategoryPeriod");
  const query=params.toString();history.replaceState(null,"",(query?"?"+query:location.pathname)+location.hash);
  if(currentDecisionLabData)renderDecisionLab(currentDecisionLabData);
}
function fireBookingRows(rows){
  return rows.map(row=>'<div class="fire-booking-row"><time datetime="'+esc(row.date)+'">'+esc(formatDate(row.date))+'</time><span>'+esc(row.merchant)+(row.estimate?' '+analysisEstimate(true):'')+'</span><strong>'+money(row.amountMinor)+'</strong></div>').join('');
}
function fireMerchantRows(groups){
  return groups.map(group=>'<details class="fire-merchant-group"><summary><span class="fire-merchant-main"><strong>'+esc(group.label)+'</strong><small>'+group.bookings+' '+(group.bookings===1?'Buchung':'Buchungen')+(group.estimate?' · '+analysisEstimate(true):'')+'</small></span><strong>'+money(group.amountMinor)+'</strong>'+icons.chevron+'</summary><div class="fire-merchant-bookings" aria-label="Einzelbuchungen für '+esc(group.label)+'">'+fireBookingRows(group.transactions)+'</div></details>').join('');
}
function monthReasons(last,current){
  const block=(title,items)=>!items||!items.length?'':'<div class="decision-breakdown-note"><strong>'+esc(title)+'</strong> '+items.map(item=>esc(item.label)).join(' ')+'</div>';
  return block('Letzter Monat',last&&last.explanations)+block('Aktueller Monat',current&&current.explanations);
}
function renderFireTracking(fire){
  const state=analysisSelection();
  const gap=fire.central.annualGapToTargetMinor;
  const current=fire.central.currentExitAge;
  const scenario=fire.central.scenarioExitAge;
  const years=fire.central.yearsGained;
  const targetOptions=Array.from({length:18},(_,index)=>{const age=50+index;return '<option value="'+age+'" '+(age===fire.targetAge?'selected ':'')+'>'+age+' Jahre</option>'}).join('');
  const bandRows=fire.returnBand.map(row=>'<tr><td>'+(row.realReturnBps/100).toLocaleString('de-DE')+' % real</td><td>'+esc(fireExit(row.currentExitAge))+'</td><td>'+esc(fireExit(row.scenarioExitAge))+'</td></tr>').join('');
  const actionRows=fire.actions.map(action=>{
    const checked=fire.selectedActionKeys.includes(action.key);
    const disabled=!action.selectable;
    const coverage=gap&&action.expectedAnnualSavingsMinor!==null?Math.min(100,Math.round(action.expectedAnnualSavingsMinor/gap*100)):null;
    const impact=action.yearsGained&&action.yearsGained>0?action.yearsGained+' '+(action.yearsGained===1?'Jahr':'Jahre')+' früher':coverage!==null?coverage+' % der aktuellen Ziel-Lücke':'Mögliche Entlastung erst nach Prüfung';
    const effect=checked&&action.expectedAnnualSavingsMinor!==null?money(action.expectedAnnualSavingsMinor)+' / Jahr':action.expectedAnnualSavingsMinor!==null?money(action.expectedAnnualSavingsMinor)+' möglich':'Noch offen';
    return '<label class="fire-row fire-action-'+esc(action.leverQuality)+'"><input type="checkbox" name="fire-action" value="'+esc(action.key)+'" '+(checked?'checked ':'')+(disabled?'disabled ':'')+'><span class="fire-row-main"><strong>'+esc(action.label)+'</strong><small>'+esc(action.leverLabel)+' · '+esc(action.classificationLabel)+'</small></span><span class="fire-row-metric fire-row-cost"><small>Jahreskosten</small><strong>'+money(action.estimatedAnnualCostMinor)+' '+analysisEstimate(true)+'</strong></span><span class="fire-row-metric fire-row-choice"><small>Maßnahme</small><strong>'+esc(action.statusLabel)+'</strong></span><span class="fire-row-metric fire-row-effect"><small>Angesetzte Wirkung</small><strong>'+effect+'</strong><small>'+esc(impact)+' '+analysisEstimate(true)+'</small></span></label>';
  }).join('');
  const noActions='<div class="fire-empty">Noch keine bestätigten Optimierungsmaßnahmen verfügbar.</div>';
  const variableRows=fire.variableCategories.map(category=>{
    const options=[0,10,25,50].map(value=>'<option value="'+value+'" '+(value===category.selectedReductionPercent?'selected ':'')+'>'+(value===0?'Keine Reduktion':value+' % reduzieren')+'</option>').join('');
    const saving=category.annualSavingsMinor>0?money(category.annualSavingsMinor)+' / Jahr':'Nicht angesetzt';
    const impact=category.yearsGained&&category.yearsGained>0?category.yearsGained+' '+(category.yearsGained===1?'Jahr':'Jahre')+' früher':'Wirkung nach Auswahl';
    const excluded=category.recurringSavingsExcludedMinor>0?' · bereits laufend angesetzt '+money(category.recurringSavingsExcludedMinor):'';
    const open=state.fireCategory===category.key;
    const previous=state.fireCategoryPeriod==="previous";
    const transactions=previous?category.previousTransactions:category.currentTransactions;
    const merchantGroups=previous?category.previousMerchantGroups:category.currentMerchantGroups;
    const periodLabel=previous?category.previousPeriodLabel:category.currentPeriodLabel;
    const detail=open?'<div class="fire-category-detail"><div class="fire-category-detail-head"><div><h5>Händler und Dienste · '+esc(category.label)+'</h5><p>'+merchantGroups.length+' '+(merchantGroups.length===1?'Gruppe':'Gruppen')+' · '+transactions.length+' Buchungen · '+money(transactions.reduce((sum,row)=>sum+row.amountMinor,0))+' · größte Summe zuerst</p></div><div class="fire-period-switch" aria-label="Zeitraum für Kategorie"><button type="button" aria-pressed="'+String(!previous)+'" onclick="setFireCategoryDetailPeriod(&quot;current&quot;)">'+esc(category.currentPeriodLabel)+'</button><button type="button" aria-pressed="'+String(previous)+'" onclick="setFireCategoryDetailPeriod(&quot;previous&quot;)">'+esc(category.previousPeriodLabel)+'</button></div></div><div class="fire-merchant-list" aria-label="Händlergruppen '+esc(periodLabel)+'">'+(merchantGroups.length?fireMerchantRows(merchantGroups):'<div class="fire-empty">In diesem Zeitraum liegen keine Buchungen vor.</div>')+'</div></div>':'';
    return '<div class="fire-row"><button class="fire-row-drill" type="button" aria-label="Buchungen für '+esc(category.label)+' '+(open?'ausblenden':'anzeigen')+'" aria-expanded="'+String(open)+'" onclick="toggleFireCategoryDetail(&quot;'+esc(category.key)+'&quot;)">'+icons.chevron+'</button><span class="fire-row-main"><strong>'+esc(category.label)+'</strong><small>'+esc(category.currentPeriodLabel)+' '+money(category.currentPeriodMinor)+' · '+esc(category.previousPeriodLabel)+' '+money(category.previousYearMinor)+'</small></span><span class="fire-row-metric fire-row-cost"><small>Geglättete Jahresbasis</small><strong>'+money(category.planningAnnualMinor)+' '+analysisEstimate(true)+'</strong><small>'+excluded.replace(/^ · /,'')+'</small></span><span class="fire-row-metric fire-row-choice"><small>Maßnahme</small><select name="fire-category-cut" data-key="'+esc(category.key)+'" aria-label="Reduktion für '+esc(category.label)+'">'+options+'</select></span><span class="fire-row-metric fire-row-effect"><small>Angesetzte Wirkung</small><strong>'+saving+'</strong><small>'+esc(impact)+' '+analysisEstimate(true)+'</small></span>'+detail+'</div>';
  }).join('');
  const oneTimeRows=fire.oneTimeCandidates.map(item=>{
    const impact=item.yearsGained&&item.yearsGained>0?item.yearsGained+' '+(item.yearsGained===1?'Jahr':'Jahre')+' früher':'Einmalige Kapitalwirkung';
    const counted=item.selected?money(item.countedOneTimeMinor):'Nicht angesetzt';
    return '<label class="fire-row"><input type="checkbox" name="fire-one-time" value="'+esc(item.key)+'" '+(item.selected?'checked ':'')+'><span class="fire-row-main"><strong>'+esc(item.label)+'</strong><small>'+esc(item.category)+' · '+analysisMonthLabel(item.month)+'</small></span><span class="fire-row-metric fire-row-cost"><small>Beobachteter Betrag</small><strong>'+money(item.observedMinor)+' '+analysisEstimate(true)+'</strong></span><span class="fire-row-metric fire-row-choice"><small>Maßnahme</small><strong>'+(item.selected?'Einmalig vermeiden':'Nicht ausgewählt')+'</strong></span><span class="fire-row-metric fire-row-effect"><small>Angesetzte Wirkung</small><strong>'+counted+'</strong><small>'+esc(impact)+' '+analysisEstimate(true)+'</small></span></label>';
  }).join('');
  const recurringCosts=fire.actions.reduce((sum,item)=>sum+item.estimatedAnnualCostMinor,0);
  const variableCosts=fire.variableCategories.reduce((sum,item)=>sum+item.planningAnnualMinor,0);
  const oneTimeCosts=fire.oneTimeCandidates.reduce((sum,item)=>sum+item.observedMinor,0);
  const group=(key,title,description,count,costLabel,cost,effectLabel,effect,rows,empty)=>'<details class="fire-lever-group" '+((state.fireOpenGroups.includes(key)||(key==="variable"&&state.fireCategory))?'open ':'')+'ontoggle="rememberFireGroup(this,&quot;'+key+'&quot;)"><summary class="fire-lever-summary"><span class="fire-lever-summary-main"><strong>'+esc(title)+'</strong><small>'+count+' '+(count===1?'Eintrag':'Einträge')+' · '+esc(description)+'</small></span><span class="fire-lever-summary-metric"><span>'+esc(costLabel)+'</span><strong>'+moneyWhole(cost)+'</strong></span><span class="fire-lever-summary-metric"><span>'+esc(effectLabel)+'</span><strong>'+moneyWhole(effect)+'</strong></span>'+icons.chevron+'</summary><div class="fire-action-list">'+(rows||empty)+'</div></details>';
  const nextChecks=(fire.nextChecks||[]).map(item=>'<article class="review-candidate"><div><strong>'+esc(item.label)+'</strong><span>'+esc(item.classificationLabel)+' · '+esc(item.reason)+'</span></div><strong>'+moneyWhole(item.estimatedAnnualCostMinor)+'</strong></article>').join('')||'<div class="empty">Keine offenen prüfbaren Hebel.</div>';
  const gapClose=fire.gapClose;
  const gapBox=gapClose?'<section class="analysis-panel" aria-labelledby="fire-gap-title"><div class="analysis-panel-head"><div><h3 id="fire-gap-title">Lücke '+esc(String(gapClose.currentExitAge??"?"))+' → '+esc(String(gapClose.targetAge))+'</h3><p>Nur bestätigte laufende Hebel zählen.</p></div></div><div class="recurring-summary"><div><span>Noch nötig / Monat</span><strong>'+(gapClose.remainingMonthlyMinor==null?'–':moneyWhole(gapClose.remainingMonthlyMinor))+'</strong></div><div><span>Bestätigt / Jahr</span><strong>'+moneyWhole(gapClose.confirmedAnnualMinor)+'</strong></div><div><span>Rest / Jahr</span><strong>'+(gapClose.remainingAnnualMinor==null?'–':moneyWhole(gapClose.remainingAnnualMinor))+'</strong></div></div></section>':'';
  const nextInbox='<section class="analysis-panel" aria-labelledby="fire-next-title"><div class="analysis-panel-head"><div><h3 id="fire-next-title">Nächste 5 prüfbare Dinge</h3><p>Nur diese Liste ist ein Arbeitsvorrat. Prozentschnitte und vergangene Einmalposten zählen nicht.</p></div></div><div class="review-candidate-list">'+nextChecks+'</div></section>';
  const recurringGroup=group('recurring','Laufende Verträge und Abos','gespeicherte Maßnahmen',fire.actions.length,'Jahreskosten',recurringCosts,'Angesetzt / Jahr',fire.selectedRecurringAnnualSavingsMinor,actionRows,noActions);
  const variableGroup=group('variable','Variable Ausgabenkategorien','Beobachtung, zählt nicht ins Szenario',fire.variableCategories.length,'Planungsbasis / Jahr',variableCosts,'Angesetzt / Jahr',fire.selectedVariableAnnualSavingsMinor,variableRows,'<div class="fire-empty">Keine dispositiven Kategorien im aktuellen Zeitraum verfügbar.</div>');
  const oneTimeGroup=group('one-time','Historische Einzelposten','Vergangenheit, zählt nicht als Ersparnis',fire.oneTimeCandidates.length,'Beobachtete Beträge',oneTimeCosts,'Einmalig angesetzt',fire.selectedOneTimeSavingsMinor,oneTimeRows,'<div class="fire-empty">Keine geeigneten Einzelposten verfügbar.</div>');
  const basis=fire.basis.map(item=>'<li>'+esc(item)+'</li>').join('');
  const warnings=fire.warnings.map(warning=>'<div class="analysis-warning" role="status">'+icons.warning+'<span>'+esc(warning)+'</span></div>').join('');
  return '<section class="analysis-panel fire-cockpit" aria-labelledby="fire-title"><div class="analysis-panel-head"><div><h2 id="fire-title">FIRE-Kurs und konkrete Stellschrauben</h2><p>Ausstiegsalter und Kapitalziele kommen nur aus dem FIRE-Phasenmodell, nicht aus der 20-Jahres-Linie.</p></div><span class="fire-model">'+esc(fire.modelVersion)+' · nur dieses Modell · '+analysisEstimate(true)+'</span></div><div class="fire-course"><div><span>Aktueller Kurs</span><strong class="'+(current!==null&&current<=fire.targetAge?'tone-ok':'tone-warning')+'">'+esc(fireExit(current))+'</strong><small>Bei 3 % Realrendite, ohne Erbschaft</small>'+fireCapitalGoal(fire.central.currentCapitalGoal)+'</div><div><span>Zielalter</span><strong>'+fire.targetAge+'</strong><small>Aktuell gewähltes Arbeitsziel</small>'+fireCapitalGoal(fire.central.targetCapitalGoal)+'</div><div><span>Lücke zum Ziel</span><strong class="'+(gap===0?'tone-ok':'tone-warning')+'">'+(gap===null?'–':moneyWhole(gap)+' / Jahr')+'</strong><small>'+(fire.central.monthlyGapToTargetMinor===null?'Nicht verfügbar':moneyWhole(fire.central.monthlyGapToTargetMinor)+' pro Monat')+' '+analysisEstimate(true)+'</small></div><div><span>Mit ausgewählten Hebeln</span><strong class="'+(scenario!==null&&scenario<=fire.targetAge?'tone-ok':'tone-warning')+'">'+esc(fireExit(scenario))+'</strong><small>'+moneyWhole(fire.selectedAnnualSavingsMinor)+' jährlich · '+moneyWhole(fire.selectedOneTimeSavingsMinor)+' einmalig · '+(years===null?'Wirkung offen':years+' Jahre gewonnen')+'</small></div></div><div class="fire-capital"><div><span>Überbrückungskapital heute</span><strong>'+(fire.bridgeCapitalMinor===null?'–':moneyWhole(fire.bridgeCapitalMinor))+'</strong><small>Liquidität, Depots, Krypto und Gold</small></div><div><span>Gebundene Vorsorge</span><strong>'+(fire.lockedPensionMinor===null?'–':moneyWhole(fire.lockedPensionMinor))+'</strong><small>Separat zu den vorgesehenen Leistungszeitpunkten</small></div><div><span>Aktuelle Ausgaben-Hochrechnung</span><strong>'+(fire.liveProjectedAnnualExpensesMinor===null?'–':moneyWhole(fire.liveProjectedAnnualExpensesMinor))+'</strong><small>Normalisiert '+(fire.normalizedAnnualExpensesMinor===null?'–':moneyWhole(fire.normalizedAnnualExpensesMinor))+' '+analysisEstimate(true)+'</small></div><div><span>Tragbar beim Zielalter</span><strong>'+(fire.central.maximumExpensesAtTargetMinor===null?'–':moneyWhole(fire.central.maximumExpensesAtTargetMinor))+'</strong><small>Bei 3 % real '+analysisEstimate(true)+'</small></div></div><div class="fire-workspace"><form class="fire-controls" onsubmit="applyFireScenario(event)"><label for="fire-target-age">Gewünschtes Zielalter<select id="fire-target-age" autocomplete="off">'+targetOptions+'</select></label><div class="fire-band"><table><thead><tr><th scope="col">Renditeband</th><th scope="col">Aktuell</th><th scope="col">Mit Hebeln</th></tr></thead><tbody>'+bandRows+'</tbody></table></div><button class="button" type="submit">FIRE-Szenario aktualisieren</button></form><div class="fire-levers"><div class="fire-levers-head"><div><h3>Reale Ausgabenhebel</h3><p>Nur bestätigte laufende Maßnahmen zählen. Kategorieprozente und historische Einzelposten sind Beobachtung, kein Szenario.</p></div><strong>'+moneyWhole(fire.selectedAnnualSavingsMinor)+' / Jahr</strong></div><div class="fire-lever-groups">'+gapBox+nextInbox+recurringGroup+variableGroup+oneTimeGroup+'</div></div></div><div class="fire-pension-link"><div><strong>Gesetzliche Rentenannahmen</strong><span>Dokumentbasiert, versioniert und nur nach Bestätigung aktiv.</span></div><a class="button secondary" href="#/pension-documents">Renteninformation prüfen</a></div><details class="fire-basis"><summary>Modellannahmen und Grenzen</summary><ul>'+basis+'</ul></details>'+warnings+'</section>';
}

function reviewCategoryOptions(categories, selected){
  return '<option value="">Kategorie wählen</option>'+categories.map(category=>'<option value="'+esc(category.key)+'"'+(category.key===selected?' selected':'')+'>'+esc(category.group)+' · '+esc(category.name)+'</option>').join("");
}
async function saveReviewTransaction(lineId){
  const categoryKey=document.getElementById("review-category-"+lineId)?.value||"";
  const aliasTo=(document.getElementById("review-alias-"+lineId)?.value||"").trim();
  const button=document.getElementById("review-save-"+lineId);
  try{
    if(button)button.disabled=true;msg("Buchung wird in Actual gespeichert …");
    const data=await call("/api/dashboard/review/transaction",{method:"PUT",body:JSON.stringify({lineId,categoryKey:categoryKey||undefined,aliasTo:aliasTo||undefined,payeeName:aliasTo||undefined})});
    renderReview(data);msg("In Actual gespeichert.");
  }catch(error){msg(error.message,true);if(button)button.disabled=false}
}
function renderReviewError(error){
  currentReviewData=null;
  document.getElementById("dashboard").innerHTML=expenseState("Nicht verfügbar","Die Prüfliste konnte nicht geladen werden. Bitte versuche es erneut.","refresh(true)","Erneut versuchen");
  document.getElementById("dashboard").setAttribute("aria-busy","false");
  msg(error?.message||"Die Prüfliste konnte nicht geladen werden.",true);
}
function renderReview(data){
  currentReviewData=data;
  currentRecurringData=data.recurring;
  currentOptimizationData=data.optimizations;
  const months=data.window?.months||6;
  const lastClose=(data.monthCloses&&data.monthCloses[0])?data.monthCloses[0]:null;
  const closeSnapshot=lastClose?.snapshot?'<div class="month-close-snapshot"><strong>Fixierter Stand '+esc(lastClose.month)+'</strong><span>Ist '+signedMoneyWhole(lastClose.snapshot.actualNetMinor)+' · Plan '+signedMoneyWhole(lastClose.snapshot.expectedNetMinor)+' · Abweichung '+signedMoneyWhole(lastClose.snapshot.actualNetMinor-lastClose.snapshot.expectedNetMinor)+'</span><small>'+lastClose.snapshot.uncategorizedBookings+' offene Buchungen beim Abschluss · '+esc(formatDate(lastClose.closedAt,true))+'</small></div>':'';
  const closeBar='<section class="month-close"><div class="analysis-toolbar" aria-label="Monatsabschluss"><label>Monat abschließen<input id="review-close-month" type="month" value="'+(data.window&&data.window.endMonth?data.window.endMonth:"")+'"></label><label>Notiz<input id="review-close-note" maxlength="200" placeholder="Offene Punkte, z. B. Kartenstand"></label><label class="check-label"><input id="review-close-payroll" type="checkbox"> Gehaltsmonate geprüft</label><label class="check-label"><input id="review-close-card" type="checkbox"> Kreditkarte geprüft/notiert</label><button class="button secondary" type="button" onclick="closeReviewMonth()">Stand einfrieren</button></div>'+closeSnapshot+'</section>';
  const ruleRows=(data.merchantRules||[]).map(rule=>'<tr><td>'+esc(rule.pattern)+'</td><td>'+esc(rule.label)+'</td><td>'+(rule.deletable?'<button class="button quiet small" type="button" onclick="deleteMerchantRule(&quot;'+esc(rule.pattern)+'&quot;)">Löschen</button>':'<span class="badge">Standard</span>')+'</td></tr>').join('');
  const rulesBox='<section class="analysis-panel" aria-label="Händlerregeln"><div class="analysis-panel-head"><div><h3>Händlerregeln</h3><p>Muster im Namen wird zum Anzeigenamen.</p></div></div><table class="expense-table"><thead><tr><th>Muster</th><th>Name</th><th></th></tr></thead><tbody>'+ruleRows+'</tbody></table><div class="analysis-toolbar"><input id="rule-pattern" placeholder="amazon" maxlength="80"><input id="rule-label" placeholder="Amazon" maxlength="80"><button class="button secondary" type="button" onclick="saveMerchantRule()">Regel speichern</button></div></section>';
  const taxonomy='<p class="review-taxonomy">Eine Taxonomie: Grundbedarf · Gestaltbar · Vermeidbar · Unklar · Kein Kandidat. Maßnahmen gelten nur für gestaltbare, vermeidbare oder unklare bestätigte Ausgaben.</p>';
  const windowBar='<section class="analysis-toolbar" aria-label="Prüffenster"><label>Zeitraum<select id="review-months" onchange="setReviewMonths(this.value)"><option value="3"'+(months===3?' selected':'')+'>3 Monate</option><option value="6"'+(months===6?' selected':'')+'>6 Monate</option><option value="12"'+(months===12?' selected':'')+'>12 Monate</option><option value="24"'+(months===24?' selected':'')+'>24 Monate</option></select><small>'+esc(data.window?.startDate||'')+'–'+esc(data.window?.endDate||'')+'</small></label></section>';
  const summary='<section class="recurring-summary" aria-label="Offene Prüfungen"><div><span>Offen gesamt</span><strong>'+data.counts.open+'</strong></div><div><span>Ausgaben ohne Kategorie</span><strong>'+(data.counts.uncategorizedExpenses??data.counts.uncategorized)+'</strong></div><div><span>Einnahmen ohne Kategorie</span><strong>'+(data.counts.uncategorizedIncome??0)+'</strong></div><div><span>Regelmäßige / Maßnahmen</span><strong>'+data.counts.recurringOpen+' / '+data.counts.optimizationsOpen+'</strong></div></section>';
  const bookingRow=(line,income)=>{
    const fieldId=esc(line.id);
    const cats=(data.categories||[]).filter(category=>income?category.isIncome:!category.isIncome);
    return '<article class="review-booking"><div><strong>'+esc(line.merchant)+'</strong><span>'+esc(formatDate(line.date))+' · '+esc(line.accountLabel)+(line.notes?' · '+esc(line.notes):'')+'</span></div><strong>'+(income?'+':'')+money(line.amountMinor)+'</strong><label>Actual-Kategorie<select id="review-category-'+fieldId+'" autocomplete="off">'+reviewCategoryOptions(cats,line.categoryKey==="uncategorized"?"":line.categoryKey)+'</select></label><label>Händler bündeln als<input id="review-alias-'+fieldId+'" value="'+esc(line.merchant)+'" maxlength="80"></label><button class="button" id="review-save-'+fieldId+'" type="button" onclick="saveReviewTransaction(&quot;'+esc(line.id)+'&quot;)">In Actual speichern</button></article>';
  };
  const expenseRows=(data.uncategorizedExpenses||data.uncategorized||[]).map(line=>bookingRow(line,false)).join("")||'<div class="empty">Keine unkategorisierten Ausgaben im gewählten Zeitraum.</div>';
  const incomeRows=(data.uncategorizedIncome||[]).map(line=>bookingRow(line,true)).join("")||'<div class="empty">Keine unkategorisierten Einnahmen im gewählten Zeitraum.</div>';
  const bookings='<details class="work-section"'+((data.counts.uncategorizedExpenses??data.counts.uncategorized)>0?' open':'')+'><summary><span><strong>Ausgaben ohne Kategorie</strong><small>Schreibt nach Actual; Händleralias gilt zusätzlich in FinanceSync.</small></span><b>'+(data.counts.uncategorizedExpenses??data.counts.uncategorized)+'</b>'+icons.chevron+'</summary><div class="work-section-body review-booking-list">'+expenseRows+'</div></details><details class="work-section"'+((data.counts.uncategorizedIncome??0)>0?' open':'')+'><summary><span><strong>Einnahmen ohne Kategorie</strong><small>Gehalt, Kindergeld, Erstattungen und andere Zuflüsse.</small></span><b>'+(data.counts.uncategorizedIncome??0)+'</b>'+icons.chevron+'</summary><div class="work-section-body review-booking-list">'+incomeRows+'</div></details>';
  const recurringItems=(data.recurring?.candidates||[]).map(item=>'<article class="review-candidate"><div><strong>'+esc(item.label)+'</strong><span>'+esc(item.rhythm.label)+' · typisch '+money(item.amount.typicalMinor)+' · '+esc(item.statusLabel)+'</span></div><label>Einordnung<select id="recurring-decision-review-'+esc(item.key)+'" autocomplete="off">'+recurringDecisionOptions(item.decision?.value||"")+'</select></label><button class="button secondary" type="button" onclick="saveRecurringDecision(&quot;'+esc(item.key)+'&quot;,&quot;review&quot;)">Speichern</button></article>').join("")||'<div class="empty">Keine offenen regelmäßigen Kandidaten.</div>';
  const recurring='<details class="work-section"><summary><span><strong>Regelmäßige Ausgaben</strong><small>Keine Summenbildung vor Bestätigung.</small></span><b>'+esc(String(data.recurring?.summary?.possible??0))+'</b>'+icons.chevron+'</summary><div class="work-section-body review-candidate-list">'+recurringItems+'</div></details>';
  const actionItems=(data.optimizations?.items||[]).slice(0,20).map(item=>{
    const saved=item.optimization&&!item.optimization.stale?item.optimization:null;
    return '<article class="optimization-card"><div class="optimization-title"><strong>'+esc(item.label)+'</strong><span>'+esc(item.classification.label)+' · '+esc(item.rhythm.label)+'</span><span>Jahreskosten '+money(item.estimatedAnnualCostMinor)+' <small>[SCHÄTZUNG]</small></span></div><label>Status<select id="optimization-status-'+esc(item.key)+'" autocomplete="off">'+optimizationStatusOptions(saved?.status||"PRUEFEN")+'</select></label><label>Jährliche Entlastung in € <span>[SCHÄTZUNG]</span><input id="optimization-savings-'+esc(item.key)+'" type="number" inputmode="decimal" min="0" step="0.01" value="'+(saved?.expectedAnnualSavingsMinor==null?"":(saved.expectedAnnualSavingsMinor/100).toFixed(2))+'"></label><label>Priorität<select id="optimization-priority-'+esc(item.key)+'" autocomplete="off">'+optimizationPriorityOptions(saved?.priority||"")+'</select></label><input id="optimization-date-'+esc(item.key)+'" type="hidden" value="'+esc(saved?.effectiveDate||"")+'"><button class="button" id="optimization-save-'+esc(item.key)+'" type="button" onclick="saveRecurringOptimization(&quot;'+esc(item.key)+'&quot;)">Maßnahme speichern</button></article>';
  }).join("")||'<div class="empty">Keine offenen Maßnahmen. Bestätige zuerst gestaltbare oder vermeidbare Ausgaben.</div>';
  const actions='<details class="work-section"><summary><span><strong>Maßnahmen</strong><small>Zweiter Schritt nach der Einordnung.</small></span><b>'+data.counts.optimizationsOpen+'</b>'+icons.chevron+'</summary><div class="work-section-body optimization-list">'+actionItems+'</div></details>';
  const management='<details class="management review-management"><summary>Prüfen verwalten</summary><div class="management-body">'+windowBar+closeBar+taxonomy+rulesBox+'</div></details>';
  document.getElementById("dashboard").innerHTML=summary+bookings+recurring+actions+management;
  document.getElementById("dashboard").setAttribute("aria-busy","false");
}
function fillNamedScenarios(selected){const select=document.getElementById("named-scenario");if(!select||!window.namedScenarios)return;select.innerHTML='<option value="">Aktuelles Labor</option>'+window.namedScenarios.map(item=>'<option value="'+esc(item.id)+'"'+(item.id===selected?' selected':'')+'>'+esc(item.name)+'</option>').join("");}
async function refreshNamedScenarios(selected){const data=await call("/api/dashboard/scenarios");window.namedScenarios=data.scenarios||[];fillNamedScenarios(selected);['compare-left','compare-right'].forEach(id=>{const el=document.getElementById(id);if(!el||!window.namedScenarios)return;el.innerHTML=(window.namedScenarios||[]).map(item=>'<option value="'+esc(item.id)+'">'+esc(item.name)+'</option>').join('');});}
async function saveNamedScenario(){const name=(document.getElementById("scenario-name")?.value||"").trim();const selection=analysisSelection();const saved=await call("/api/dashboard/scenarios",{method:"PUT",body:JSON.stringify({name,trendBasis:selection.decisionBasis,realReturnBps:Math.round(selection.decisionReturn*100),monthlyChangeMinor:Math.round(selection.decisionMonthly*100),oneTimeMinor:Math.round(selection.decisionOneTime*100),fireTargetAge:selection.fireTargetAge,fireActionKeys:selection.fireActionKeys,fireCategoryCuts:selection.fireCategoryCuts,fireOneTimeKeys:selection.fireOneTimeKeys})});document.getElementById("scenario-name").value="";await refreshNamedScenarios(saved.id);msg("Szenario gespeichert.");}
function applyNamedScenario(id){const scenario=(window.namedScenarios||[]).find(item=>item.id===id);if(!scenario)return;const inputs=scenario.inputs||{};const params=new URLSearchParams(location.search);params.set("decisionBasis",inputs.trendBasis||"current-year");params.set("decisionReturn",String((inputs.realReturnBps??200)/100));params.set("decisionMonthly",String((inputs.monthlyChangeMinor??0)/100));params.set("decisionOneTime",String((inputs.oneTimeMinor??0)/100));params.set("fireTargetAge",String(inputs.fireTargetAge??60));if(inputs.fireActionKeys&&inputs.fireActionKeys.length)params.set("fireActionKeys",inputs.fireActionKeys.join(","));else params.set("fireActionKeys","none");if(inputs.fireCategoryCuts&&inputs.fireCategoryCuts.length)params.set("fireCategoryCuts",inputs.fireCategoryCuts.join(","));else params.delete("fireCategoryCuts");if(inputs.fireOneTimeKeys&&inputs.fireOneTimeKeys.length)params.set("fireOneTimeKeys",inputs.fireOneTimeKeys.join(","));else params.delete("fireOneTimeKeys");history.replaceState(null,"",(params.toString()?"?"+params:"")+location.hash);refresh();}
function renderDecisionLab(data){
  currentDecisionLabData=data;
  const currentLab=labView();
  const estimateBanner='<p class="analysis-estimate-banner" role="note">Modellzahlen sind Schätzungen [SCHÄTZUNG].</p>';
  const scenarioBar='<details class="management scenario-management"><summary>Szenarien und Ereignisse verwalten</summary><div class="management-body"><section class="analysis-toolbar" aria-label="Gespeicherte Szenarien"><label>Szenario<select id="named-scenario" onchange="applyNamedScenario(this.value)"><option value="">Aktuelles Labor</option></select></label><label>Name<input id="scenario-name" maxlength="80" placeholder="z. B. Krippe endet"></label><button class="button secondary" type="button" onclick="saveNamedScenario()">Szenario speichern</button></section><section class="analysis-toolbar" aria-label="Ereignisse"><label>Ereignis<input id="event-name" placeholder="Krippe endet"></label><label>Ab<input id="event-start" type="month"></label><label>€ / Monat<input id="event-amount" type="number" step="1"></label><button class="button secondary" type="button" onclick="saveLifeEvent()">Ereignis speichern</button></section><div id="life-event-list" class="compact-manage-list"><p class="empty">Ereignisse werden geladen …</p></div><section class="analysis-toolbar" aria-label="Szenarien vergleichen"><label>Ausgang<select id="compare-left" aria-label="Ausgangsszenario"></select></label><label>Vergleich<select id="compare-right" aria-label="Vergleichsszenario"></select></label><button class="button secondary" type="button" onclick="compareNamedScenarios()">Vergleichen</button><div id="scenario-compare"></div></section></div></details>';
  const toolbar='<nav class="lab-nav" aria-label="Laborbereiche"><button class="button '+(currentLab==="fire"?'':'secondary')+'" type="button" onclick="setLabView(&quot;fire&quot;)">FIRE-Kurs</button><button class="button '+(currentLab==="year"?'':'secondary')+'" type="button" onclick="setLabView(&quot;year&quot;)">Jahresausblick</button><button class="button '+(currentLab==="path"?'':'secondary')+'" type="button" onclick="setLabView(&quot;path&quot;)">Trajektorie</button></nav>';
  const trend=data.basis.selectedTrend;
  const period=trend.periodStart&&trend.periodEnd
    ? trend.periodStart===trend.periodEnd?analysisMonthLabel(trend.periodEnd):analysisMonthLabel(trend.periodStart)+'–'+analysisMonthLabel(trend.periodEnd)
    : 'nicht verfügbar';
  const monthlyLabel=trend.monthlyMetric==='median'?'Typischer Monat · Median-Saldo':'Monatsdurchschnitt';
  const summary='<section class="analysis-summary decision-summary" aria-label="Ausgangslage für die Projektion"><div><span>Finanzvermögen heute</span><strong class="analysis-total">'+(data.basis.startingAssetsMinor===null?'–':moneyWhole(data.basis.startingAssetsMinor))+'</strong><p class="analysis-basis">Ohne Immobilien · '+esc(data.scope.includes.join(", "))+' '+analysisEstimate(true)+'</p></div><div><span>Bilanz · '+esc(period)+'</span><strong class="'+(trend.netMinor<0?'tone-warning':'tone-ok')+'">'+(trend.netMinor===null?'–':signedMoneyWhole(trend.netMinor))+'</strong><p class="analysis-basis">Einnahmen '+(trend.incomeMinor===null?'–':moneyWhole(trend.incomeMinor))+' · Ausgaben '+(trend.expensesMinor===null?'–':moneyWhole(trend.expensesMinor))+'</p></div><div><span>'+esc(monthlyLabel)+'</span><strong class="'+(trend.averageMonthlyNetMinor<0?'tone-warning':'tone-ok')+'">'+(trend.averageMonthlyNetMinor===null?'–':signedMoneyWhole(trend.averageMonthlyNetMinor))+'</strong><p class="analysis-basis">Einnahmen '+(trend.monthlyIncomeMinor===null?'–':moneyWhole(trend.monthlyIncomeMinor))+' · Ausgaben '+(trend.monthlyExpensesMinor===null?'–':moneyWhole(trend.monthlyExpensesMinor))+'</p></div><div><span>Projektionsbasis</span><strong class="'+(trend.annualizedNetMinor<0?'tone-warning':'tone-ok')+'">'+(trend.annualizedNetMinor===null?'–':signedMoneyWhole(trend.annualizedNetMinor))+' / Jahr</strong><p class="analysis-basis">Aus '+esc(monthlyLabel.toLowerCase())+' '+analysisEstimate(true)+'</p></div></section>';
  const annual=data.basis.annualOutlook;
  const fire=renderFireTracking(data.fire);
  const annualRow=(label,values,highlight,estimate)=>'<tr class="'+(highlight?'projected':'')+'"><td>'+esc(label)+(estimate?' '+analysisEstimate(true):'')+'</td><td data-label="Einnahmen">'+(values.incomeMinor===null?'–':moneyWhole(values.incomeMinor))+'</td><td data-label="Ausgaben">'+(values.expensesMinor===null?'–':moneyWhole(values.expensesMinor))+'</td><td data-label="Saldo" class="'+(values.netMinor<0?'tone-warning':'tone-ok')+'">'+(values.netMinor===null?'–':signedMoneyWhole(values.netMinor))+'</td></tr>';
  const annualMonths=annual.year===null?'':Array.from({length:12},(_,index)=>'<span class="'+(index<annual.completedMonths?'complete':'')+'" aria-hidden="true">'+(index+1)+'</span>').join('');
  const annualVariance=annual.varianceToExpected.netMinor;
  const annualVarianceText=annualVariance===null?'Nicht verfügbar':annualVariance===0?'Genau auf dem Medianpfad':signedMoneyWhole(Math.abs(annualVariance))+' '+(annualVariance>0?'über':'unter')+' dem Medianpfad';
  const annualMonthRows=(annual.months||[]).map(month=>'<tr class="'+(month.complete?'':'partial')+'"><td>'+analysisMonthLabel(month.month)+(month.complete?'':'<span class="partial-label">bis '+formatDate(month.throughDate)+'</span>')+'</td><td data-label="Einnahmen">'+moneyWhole(month.incomeMinor)+'</td><td data-label="Ausgaben">'+moneyWhole(month.expensesMinor)+'</td><td data-label="Saldo" class="'+(month.netMinor<0?'tone-warning':'tone-ok')+'">'+signedMoneyWhole(month.netMinor)+'</td></tr>').join('');
  const annualMonthHistory=annual.available?'<details class="decision-monthly-history"><summary><span class="decision-monthly-history-summary"><strong>Monatsverlauf anzeigen</strong><span>'+esc(annual.completedMonths)+' abgeschlossene Monate'+(annual.currentMonthExcluded?' · laufender Monat separat':'')+'</span></span><strong class="'+(annual.actualToDate.netMinor<0?'tone-warning':'tone-ok')+'">'+signedMoneyWhole(annual.actualToDate.netMinor)+'</strong>'+icons.chevron+'</summary><div class="decision-context-grid"><table class="decision-context-table"><thead><tr><th scope="col">Monat</th><th scope="col">Einnahmen</th><th scope="col">Ausgaben</th><th scope="col">Saldo</th></tr></thead><tbody>'+annualMonthRows+'</tbody></table></div></details>':'';
  const annualPanel=annual.available?'<section class="analysis-panel decision-annual" aria-labelledby="decision-annual-title"><div class="analysis-panel-head"><div><h2 id="decision-annual-title">Jahresausblick '+esc(annual.year)+'</h2><p>Cashflow-Modell. '+esc(annual.completedMonths)+' abgeschlossene Monate bis '+analysisMonthLabel(annual.throughMonth)+' · laufender Monat nicht eingerechnet.</p></div></div><div class="decision-annual-progress" aria-label="'+esc(annual.completedMonths)+' von 12 Monaten abgeschlossen">'+annualMonths+'</div><div class="decision-context-grid" style="margin-top:14px"><table class="decision-context-table decision-annual-table"><thead><tr><th scope="col">Jahressicht</th><th scope="col">Einnahmen</th><th scope="col">Ausgaben</th><th scope="col">Saldo</th></tr></thead><tbody>'+annualRow('Ist bis '+analysisMonthLabel(annual.throughMonth),annual.actualToDate,false,false)+annualRow('Median-Pfad bis '+analysisMonthLabel(annual.throughMonth),annual.expectedToDate,false,true)+annualRow('Hochrechnung Jahresende',annual.projectedYearEnd,true,true)+annualRow('Median × 12 · Referenz',annual.medianFullYear,false,true)+'</tbody></table></div><div class="decision-annual-variance"><span>Ist-Saldo gegenüber erwartetem Pfad</span><strong class="'+(annualVariance<0?'tone-warning':'tone-ok')+'">'+esc(annualVarianceText)+'</strong></div>'+annualMonthHistory+'<p class="decision-breakdown-note">Die Jahresend-Hochrechnung verbindet den echten Stand der abgeschlossenen Monate mit dem typischen Median-Monat für die verbleibenden '+esc(annual.remainingMonths)+' Monate. Der laufende Monat bleibt bis zum Abschluss separat.</p></section>':'';
  if(data.series.length===0){
    const warnings=data.warnings.map(warning=>'<div class="analysis-warning" role="status">'+icons.warning+'<span>'+esc(warning)+'</span></div>').join("");
    document.getElementById("dashboard").innerHTML=estimateBanner+toolbar+summary+(currentLab==="year"?annualPanel:fire)+scenarioBar+'<div style="margin-top:12px">'+expenseState("Projektion nicht verfügbar","Für eine Trajektorie werden ein vollständiger Vermögensstand und eine vollständige Sparratenbasis benötigt.","refresh(true)","Neu prüfen","warning")+'</div>'+warnings;
    refreshNamedScenarios().catch(()=>{});refreshLifeEvents();
    document.getElementById("dashboard").setAttribute("aria-busy","false");return;
  }
  const trendOptions=data.basis.trendOptions.map(option=>'<option value="'+esc(option.key)+'" '+(option.key===data.inputs.trendBasis?'selected ':'')+(!option.available?'disabled ':'')+'>'+esc(option.label)+'</option>').join("");
  const assumptions='<section class="analysis-panel decision-assumptions" aria-labelledby="decision-assumptions-title"><div class="analysis-panel-head"><div><h2 id="decision-assumptions-title">Basis und Annahmen</h2><p>Historische Entwicklung auswählen und als Szenario verändern.</p></div></div><form onsubmit="applyDecisionLab(event)"><label for="decision-basis">Ausgangsbasis<select id="decision-basis" name="decision-basis" autocomplete="off" onchange="applyDecisionLab(event)">'+trendOptions+'</select><small>'+esc(trend.description)+' · '+(trend.months===1?'1 vollständiger Monat':trend.months+' vollständige Monate')+'.</small></label><label for="decision-return">Realrendite pro Jahr (%)<input id="decision-return" name="decision-return" type="number" inputmode="decimal" autocomplete="off" min="-5" max="10" step="0.1" value="'+esc(data.inputs.realReturnBps/100)+'"><small>Nach Inflation; konservativer Startwert 2 %.</small></label><label for="decision-monthly">Monatliche Veränderung (€)<input id="decision-monthly" name="decision-monthly" type="number" inputmode="decimal" autocomplete="off" min="-10000" max="10000" step="10" value="'+esc(data.inputs.monthlyChangeMinor/100)+'"><small>Positiv spart mehr; negativ erhöht laufende Ausgaben.</small></label><label for="decision-one-time">Einmaliger Zu- oder Abfluss (€)<input id="decision-one-time" name="decision-one-time" type="number" inputmode="decimal" autocomplete="off" min="-1000000" max="1000000" step="100" value="'+esc(data.inputs.oneTimeMinor/100)+'"><small>Negativ für eine Ausgabe, positiv für zusätzliches Vermögen.</small></label><button class="button" type="submit">Szenario berechnen</button></form></section>';
  const baselineEnd=data.series.at(-1).baselineMinor;const scenarioEnd=data.series.at(-1).scenarioMinor;
  const depletion=(data.depletion.baselineAfterMonths!==null||data.depletion.scenarioAfterMonths!==null)?'<div class="analysis-warning decision-depletion" role="status">'+icons.warning+'<span>Finanzvermögen aufgebraucht: Basis '+esc(decisionDuration(data.depletion.baselineAfterMonths))+' · Szenario '+esc(decisionDuration(data.depletion.scenarioAfterMonths))+'. Eine Verschuldung wird nicht unterstellt.</span></div>':'';
  const projection='<section class="analysis-panel decision-projection" aria-labelledby="decision-projection-title"><div class="analysis-panel-head"><div><h2 id="decision-projection-title">Finanzvermögen über 20 Jahre</h2><p>Aktueller Trend '+moneyWhole(baselineEnd)+' · Szenario '+moneyWhole(scenarioEnd)+' '+analysisEstimate(true)+'</p></div></div>'+decisionChart(data)+depletion+'</section>';
  const typical=data.basis.trendOptions.find(option=>option.key==='current-year');
  const last=data.basis.lastMonthComparison;const current=data.basis.currentMonthProgress;
  const contextRow=(label,income,expenses,net)=>'<tr><td>'+esc(label)+'</td><td data-label="Einnahmen">'+(income===null?'–':moneyWhole(income))+'</td><td data-label="Ausgaben">'+(expenses===null?'–':moneyWhole(expenses))+'</td><td data-label="Saldo" class="'+(net<0?'tone-warning':'tone-ok')+'">'+(net===null?'–':signedMoneyWhole(net))+'</td></tr>';
  const currentIncomeNote=current.excludedIncomeMinor>0?' Im aktuellen Monat sind '+moneyWhole(current.excludedIncomeMinor)+' noch nicht eindeutig zugeordnete Einnahmen nicht im Saldo enthalten.':'';
  const currentCardNote=current.pendingCardExpensesMinor>0?' Darin enthalten: '+money(current.pendingCardExpensesMinor)+' vorläufiger offener Stand '+esc(current.pendingCardLabel||'Kreditkarte')+' vom '+esc(formatDate(current.pendingCardCapturedAt))+'. Die Einzelkategorien folgen mit der Abrechnung.':'';
  const comparison='<section class="analysis-panel" aria-labelledby="decision-comparison-title"><div class="analysis-panel-head"><div><h2 id="decision-comparison-title">Plan vs. Ist</h2><p>20-Jahres-Cashflow, nicht FIRE-Phasenmodell. Warum der Monat vom typischen Pfad abweicht.</p></div></div><div class="decision-context-grid"><table class="decision-context-table"><thead><tr><th scope="col">Zeitraum</th><th scope="col">Einnahmen</th><th scope="col">Ausgaben</th><th scope="col">Saldo</th></tr></thead><tbody>'+contextRow('Typischer Monat · Median-Saldo',typical?.monthlyIncomeMinor??null,typical?.monthlyExpensesMinor??null,typical?.averageMonthlyNetMinor??null)+contextRow('Letzter vollständiger Monat · '+(last.month?analysisMonthLabel(last.month):'–'),last.incomeMinor,last.expensesMinor,last.netMinor)+contextRow('Aktueller Monat bis heute · '+(current.throughDate?formatDate(current.throughDate):'–'),current.incomeMinor,current.expensesMinor,current.netMinor)+'</tbody></table></div><p class="decision-breakdown-note">Der typische Monat ist ein tatsächlich beobachteter Monat nahe dem Median-Saldo, damit Einnahmen minus Ausgaben exakt dem gezeigten Saldo entsprechen. Letzter Monat gegenüber typisch: Einnahmen '+(last.incomeDifferenceMinor===null?'–':signedMoneyWhole(last.incomeDifferenceMinor))+' · Ausgaben '+(last.expensesDifferenceMinor===null?'–':signedMoneyWhole(last.expensesDifferenceMinor))+' · Saldo '+(last.netDifferenceMinor===null?'–':signedMoneyWhole(last.netDifferenceMinor))+'. Der aktuelle Monat ist unvollständig und fließt nicht in die Projektion ein.'+currentCardNote+currentIncomeNote+'</p>'+monthReasons(last,current)+'</section>';
  const income=trend.incomeBreakdown;const wealth=trend.wealthBuilding;
  const breakdownRow=(label,value)=>'<div class="decision-breakdown-row"><span>'+esc(label)+'</span><strong>'+(value===null?'–':moneyWhole(value))+'</strong></div>';
  const breakdown='<section class="analysis-panel" aria-labelledby="decision-breakdown-title"><div class="analysis-panel-head"><div><h2 id="decision-breakdown-title">Was in die Monatsbasis einfließt</h2><p>Durchschnittliche beziehungsweise typische Monatswerte der gewählten Basis.</p></div></div><div class="decision-breakdown"><div><h3>Einnahmen</h3><div class="decision-breakdown-list">'+breakdownRow('Regelmäßige Arbeitseinkommen',income?.workRegularMinor??null)+breakdownRow('Variable Arbeits- und Haushaltseinnahmen',income?.workVariableMinor??null)+breakdownRow('Sonstige regelmäßige Einnahmen',income?.otherRegularMinor??null)+breakdownRow('Sonstige variable Einnahmen',income?.otherVariableMinor??null)+breakdownRow('Zweckgebundene Zuflüsse',income?.earmarkedFundingMinor??null)+breakdownRow('Kapitalerträge · ausgeschlossen',income?.investmentReturnsExcludedMinor??null)+'</div></div><div><h3>Vermögensbildung</h3><div class="decision-breakdown-list">'+breakdownRow('Gebuchte Depot- und Vorsorgezuflüsse',wealth?.bookedInvestingMinor??null)+breakdownRow('Weitere feste Anlagezuflüsse',wealth?.committedInvestingMinor??null)+breakdownRow('Davon zweckgebunden finanziert',wealth?.earmarkedFundingMinor??null)+breakdownRow('Davon eigener Haushaltsanteil',wealth?.householdContributionMinor??null)+breakdownRow('Mitarbeiteraktienvorteil',wealth?.employeeStockBenefitMinor??null)+'</div><p class="decision-breakdown-note">Depotkäufe sind Vermögensbildung und kein Konsum. Der Preisvorteil aus Mitarbeiteraktien ist derzeit nicht separat verfügbar; er wird nur erfasst, wenn er als eigener Arbeitgeberzufluss gebucht ist.</p></div></div></section>';
  const milestones=data.milestones.map(item=>'<article class="decision-milestone"><span>Nach '+item.year+' '+(item.year===1?'Jahr':'Jahren')+'</span><div><small>Trend</small><strong>'+moneyWhole(item.baselineMinor)+'</strong></div><div><small>Szenario</small><strong>'+moneyWhole(item.scenarioMinor)+'</strong></div><p class="'+(item.differenceMinor<0?'tone-warning':'tone-ok')+'">Differenz '+signedMoneyWhole(item.differenceMinor)+' '+analysisEstimate(true)+'</p></article>').join("");
  const basisNotes=data.basisNotes.map(note=>'<li>'+esc(note)+'</li>').join("");
  const notes='<section class="analysis-panel decision-details" aria-labelledby="decision-details-title"><div class="analysis-panel-head"><div><h2 id="decision-details-title">Meilensteine und Datenbasis</h2><p>Exakte Werte ergänzen die Trenddarstellung.</p></div></div><div class="decision-milestones">'+milestones+'</div><div class="decision-source"><p>Vermögensstand '+esc(formatDate(data.freshness.assetsGeneratedAt,true))+' · Zahlungsbasis '+esc(formatDate(data.freshness.cashflowGeneratedAt,true))+' · Quelle '+esc(data.source)+'</p><ul>'+basisNotes+'</ul></div></section>';
  const warnings=data.warnings.map(warning=>'<div class="analysis-warning" role="status">'+icons.warning+'<span>'+esc(warning)+'</span></div>').join("");
  const labBody=currentLab==="year"?annualPanel+'<div class="decision-context">'+comparison+breakdown+'</div>'
    :currentLab==="path"?'<div class="decision-layout">'+assumptions+projection+'</div>'+notes
    :fire;
  document.getElementById("dashboard").innerHTML=estimateBanner+toolbar+summary+labBody+scenarioBar+warnings;refreshNamedScenarios().catch(()=>{});refreshLifeEvents();
  document.getElementById("dashboard").setAttribute("aria-busy","false");
}
function renderDecisionLabError(error){
  currentDecisionLabData=null;
  document.getElementById("dashboard").innerHTML=expenseState("Nicht verfügbar","Das Entscheidungslabor konnte nicht geladen werden. Bitte versuche es erneut.","refresh(true)","Erneut versuchen");
  document.getElementById("dashboard").setAttribute("aria-busy","false");
  msg(error?.message||"Das Entscheidungslabor konnte nicht geladen werden.",true);
}

function renderTask(task){
  return '<article class="task-card"><span class="task-mark">'+icons.manual+'</span><div><h3>'+esc(task.label)+'</h3><p>Letzter bestätigter Wert: '+esc(formatDate(task.valueDate))+'</p></div><button class="button secondary" type="button" onclick="openManual(&quot;'+encoded(task.id)+'&quot;)">Werte aktualisieren</button></article>';
}

const pensionValidationLabels={
  FIELD_MISSING:"Nicht automatisch erkannt. Bitte den Wert aus der Renteninformation eintragen.",
  FIELD_AMBIGUOUS:"Mehrere mögliche Werte erkannt",
  DATE_INVALID:"Datum ist ungültig",
  VALUE_INVALID:"Wert ist ungültig",
  DATA_AFTER_DOCUMENT:"Datenstand liegt nach dem Dokumentdatum",
  PENSION_NOT_FUTURE:"Rentenbeginn liegt nicht nach dem Dokumentdatum",
  POINTS_VALUE_MISMATCH:"Entgeltpunkte × Rentenwert weichen von der erworbenen Rente ab",
  FORECAST_BELOW_EARNED:"Prognose liegt unter der bereits erworbenen Rente"
};
function pensionStep(active){const item=(number,label)=>'<li class="'+(active>=number?'done ':'')+(active===number?'active':'')+'"'+(active===number?' aria-current="step"':'')+'><span>'+number+'</span>'+label+'</li>';return '<ol class="pension-steps" aria-label="Fortschritt">'+item(1,'Hochladen')+item(2,'Erkennen')+item(3,'Prüfen')+item(4,'Übernehmen')+'</ol>'}
function pensionHistory(revisions){
  if(!revisions?.length)return '<div class="pension-history-empty">Noch keine bestätigte Renteninformation vorhanden.</div>';
  return '<div class="pension-history-list">'+revisions.map(revision=>{const documentDate=revision.fields?.find(field=>field.key==="documentDate")?.value;return '<article><div><strong>Renteninformation '+esc(documentDate?formatDate(documentDate):"")+'</strong><span>Bestätigt '+esc(formatDate(revision.confirmedAt,true))+' · '+esc(revision.extractionVersion)+'</span></div><span class="state-label tone-ok"><span class="state-dot"></span>Bestätigt</span></article>'}).join("")+'</div>';
}
function renderPensionHome(revisions=[]){
  currentPensionPreview=null;currentPensionImpact=null;currentPensionFileName="";
  document.getElementById("dashboard").innerHTML=pensionStep(1)+'<section class="pension-security-note" role="note">'+icons.check+'<div><strong>Privat verarbeitet</strong><span>Das Dokument wird ausschließlich auf deinem Finance-Hub-Server verarbeitet und danach gelöscht.</span></div></section><section class="pension-upload-panel" aria-labelledby="pension-upload-title"><div class="pension-upload-copy"><span class="pension-document-icon">'+icons.manual+'</span><div><h2 id="pension-upload-title">Neue Renteninformation prüfen</h2><p>PDF, JPEG oder PNG · maximal 12 MB · maximal 6 PDF-Seiten</p></div></div><form id="pension-upload-form" onsubmit="uploadPension(event)"><label class="pension-file-control" for="pension-document"><span>Datei auswählen</span><input id="pension-document" name="document" type="file" accept="application/pdf,image/jpeg,image/png" required onchange="pensionFileSelected(this)"></label><span id="pension-selected-file" class="pension-selected-file">Noch keine Datei ausgewählt</span><button class="button" type="submit">Sicher prüfen</button></form><ul class="pension-privacy-list"><li>Versicherungsnummer, Adresse und QR-/Barcode-Inhalte werden nicht gespeichert.</li><li>Nur bestätigte Werte, Quelle/Seite, Dokumenthash und Revision bleiben erhalten.</li><li>FIRE-Auswirkungen sind eine Vorschau [SCHÄTZUNG] und ändern noch nichts.</li></ul></section><section class="pension-history" aria-labelledby="pension-history-title"><div class="section-heading"><div><h2 id="pension-history-title">Bestätigte Revisionen</h2><p>Jede Übernahme bleibt nachvollziehbar und wird nie still überschrieben.</p></div></div>'+pensionHistory(revisions)+'</section>';
  document.getElementById("dashboard").setAttribute("aria-busy","false");
}
function pensionFileSelected(input){const file=input.files?.[0];currentPensionFileName=file?.name||"";const label=document.getElementById("pension-selected-file");if(label)label.textContent=file?file.name+" · "+formatBytes(file.size):"Noch keine Datei ausgewählt"}
function renderPensionProcessing(){
  document.getElementById("dashboard").innerHTML=pensionStep(2)+'<section class="pension-processing" role="status" aria-live="polite"><div class="pension-spinner" aria-hidden="true"></div><h2>Dokument wird sicher geprüft …</h2><p>Format, aktive Inhalte, Schadcode und Seiten werden geprüft. Anschließend werden die DRV-Werte lokal erkannt.</p><strong>'+esc(currentPensionFileName||"Ausgewählte Datei")+'</strong></section>';
  document.getElementById("dashboard").setAttribute("aria-busy","true");
}
async function uploadPension(event){
  event.preventDefault();const input=document.getElementById("pension-document");const file=input?.files?.[0];if(!file)return;
  if(file.size>12*1024*1024){msg("Die Datei ist größer als 12 MB.",true);return}
  currentPensionFileName=file.name;renderPensionProcessing();msg("Dokument wird lokal geprüft …");
  try{const form=new FormData();form.append("document",file);currentPensionPreview=await call("/api/pension-documents/previews",{method:"POST",body:form});currentPensionImpact=null;renderPensionReview();msg("")}
  catch(error){renderPensionHome([]);msg(error.message,true)}
}
function pensionDisplayValue(field){
  if(!field.value)return "";
  if(field.unit==="date")return field.value;
  if(field.unit==="points")return String(field.value).replace(".",",");
  return new Intl.NumberFormat("de-DE",{minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(field.value)/100);
}
function pensionFieldRow(field){
  const codes=field.validatorCodes||[];const warningId='pension-field-warning-'+field.key;const warning=codes.length?'<div class="pension-field-warning" id="'+esc(warningId)+'" role="alert">'+icons.warning+'<span>'+codes.map(code=>esc(pensionValidationLabels[code]||"Bitte Wert prüfen")).join(" · ")+'</span></div>':'';
  const type=field.unit==="date"?'date':'text';const inputmode=field.unit==="date"?'':' inputmode="decimal"';const step=field.unit==="points"?'0.0001':'0.01';
  const missing=!field.value;const describedBy=codes.length?' aria-describedby="'+esc(warningId)+'"':'';
  return '<div class="pension-field '+(codes.length?'needs-review':'verified')+'"><div class="pension-field-heading"><label for="pension-field-'+esc(field.key)+'">'+esc(field.label)+'</label><span class="confidence '+esc(field.confidenceLabel)+'">'+(field.confidenceLabel==="hoch"?icons.check:icons.warning)+esc(field.confidenceLabel)+'</span></div><div class="pension-field-control"><input id="pension-field-'+esc(field.key)+'" name="'+esc(field.key)+'" type="'+type+'"'+inputmode+' step="'+step+'" autocomplete="off" value="'+esc(pensionDisplayValue(field))+'" placeholder="'+(missing?'Bitte eintragen':'')+'"'+(codes.length?' aria-invalid="true"':'')+describedBy+' onblur="updatePensionField(&quot;'+esc(field.key)+'&quot;,this.value)"><span class="pension-unit">'+(field.unit==="points"?"Punkte":field.unit==="date"?"":field.unit==="EUR_POINT"?"€ / Punkt":"€ / Monat")+'</span><span class="pension-source">'+(field.page?'Seite '+field.page:'Nicht erkannt')+'</span></div>'+warning+'</div>';
}
function pensionImpactMarkup(impact){
  if(!impact)return '<section class="pension-impact pending" aria-labelledby="pension-impact-title"><h2 id="pension-impact-title">Auswirkung auf FIRE <span>[SCHÄTZUNG]</span></h2><p>Prüfe zuerst alle markierten Werte. Danach wird die Alt-neu-Auswirkung ohne Speicherung berechnet.</p></section>';
  const exit=value=>value===null?'Nicht verfügbar':'Exit mit '+value;
  const pension=value=>value===null?'Nicht verfügbar':money(value)+' / Monat';
  return '<section class="pension-impact" aria-labelledby="pension-impact-title"><h2 id="pension-impact-title">Auswirkung auf FIRE <span>[SCHÄTZUNG]</span></h2><div class="pension-impact-table"><div></div><strong>Bisherige Annahme</strong><strong>Neue Vorschau</strong><span>Exit-Alter</span><b>'+esc(exit(impact.previous.exitAge))+'</b><b class="tone-ok">'+esc(exit(impact.proposed.exitAge))+'</b><span>Monatliche Rente ab Start</span><b>'+pension(impact.previous.monthlyPensionAtStartMinor)+'</b><b class="tone-ok">'+pension(impact.proposed.monthlyPensionAtStartMinor)+'</b><span>Kapitalbedarf am Zielalter</span><b>'+moneyWhole(impact.previous.requiredCapitalAtTargetMinor)+'</b><b class="tone-ok">'+moneyWhole(impact.proposed.requiredCapitalAtTargetMinor)+'</b></div><div class="pension-preview-only">Nur Vorschau · noch nichts übernommen</div><details><summary>Modellannahmen und Quellen '+icons.chevron+'</summary><ul>'+impact.assumptions.map(value=>'<li>'+esc(value)+'</li>').join("")+'</ul></details></section>';
}
function renderPensionReview(){
  const preview=currentPensionPreview;if(!preview)return;
  if(preview.duplicate){document.getElementById("dashboard").innerHTML=pensionStep(3)+'<section class="pension-duplicate">'+icons.warning+'<h2>Dokument bereits bestätigt</h2><p>Diese Datei wurde bereits am '+esc(formatDate(preview.duplicate.confirmedAt,true))+' übernommen. Es wurde keine neue Vorschau oder Revision angelegt.</p><div class="actions"><button class="button secondary" type="button" onclick="discardPension()">Zur Übersicht</button></div></section>';document.getElementById("dashboard").setAttribute("aria-busy","false");return}
  const secure=Math.max(0,preview.fields.filter(field=>field.confidenceLabel==="hoch"&&!field.validatorCodes.length).length);const missing=preview.fields.filter(field=>!field.value).length;const review=Math.max(0,preview.fields.length-secure-missing);
  const fields=preview.fields.map(pensionFieldRow).join("");
  const action=currentPensionImpact?'<label class="pension-confirm-check"><input id="pension-confirm-check" type="checkbox" onchange="document.getElementById(&quot;pension-confirm-button&quot;).disabled=!this.checked"><span>Ich habe alle markierten Werte und die Vorschau geprüft.</span></label><button class="button" id="pension-confirm-button" type="button" onclick="confirmPension()" disabled>Werte bestätigen und übernehmen</button>':'<button class="button" type="button" onclick="previewPensionFire()"'+(preview.canPreview?'':' disabled')+'>FIRE-Auswirkung berechnen</button>';
  document.getElementById("dashboard").innerHTML=pensionStep(3)+'<section class="pension-security-note" role="note">'+icons.check+'<div><strong>Privat verarbeitet · kein externer Upload</strong><span>Rohdatei und Volltext wurden nach der Extraktion gelöscht.</span></div></section><div class="pension-review-layout"><div><section class="pension-document-summary"><span class="pension-document-icon">'+icons.manual+'</span><div><h2>'+esc(currentPensionFileName||"Renteninformation")+'</h2><p>'+preview.pageCount+' '+(preview.pageCount===1?'Seite':'Seiten')+' · '+formatBytes(preview.sizeBytes)+'</p><span>Hash geprüft · kein Duplikat</span></div></section><section class="pension-fields" aria-labelledby="pension-fields-title"><div class="pension-fields-summary"><div><h2 id="pension-fields-title">'+preview.fields.length+' Pflichtwerte</h2><p><span class="confidence hoch">'+icons.check+secure+' sicher</span> <span class="confidence prüfen">'+icons.warning+review+' prüfen</span> <span class="confidence fehlt">'+icons.warning+missing+' fehlen</span></p></div></div>'+fields+'</section></div><aside>'+pensionImpactMarkup(currentPensionImpact)+'<section class="pension-confirm"><h2>Hinweise &amp; Einverständnis</h2><ul><li>Identifikationsmerkmale werden nicht gespeichert.</li><li>Adresse und QR-/Barcode-Inhalte werden nicht gespeichert.</li><li>Nur bestätigte Werte werden übernommen.</li></ul>'+action+'<button class="button secondary" type="button" onclick="discardPension()">Abbrechen</button></section></aside></div>';
  document.getElementById("dashboard").setAttribute("aria-busy","false");
}
async function updatePensionField(key,value){
  if(!currentPensionPreview)return;try{currentPensionPreview=await call("/api/pension-documents/previews/"+currentPensionPreview.id+"/fields/"+key,{method:"PATCH",body:JSON.stringify({value})});currentPensionImpact=null;renderPensionReview();msg("Korrigierter Wert wurde nur in der Vorschau aktualisiert.")}
  catch(error){msg(error.message,true);const input=document.getElementById("pension-field-"+key);if(input){input.setAttribute("aria-invalid","true");input.focus()}}
}
async function previewPensionFire(){
  if(!currentPensionPreview)return;try{msg("FIRE-Auswirkung wird ohne Speicherung berechnet …");const result=await call("/api/pension-documents/previews/"+currentPensionPreview.id+"/fire-preview",{method:"POST",body:"{}"});currentPensionPreview=result.preview;currentPensionImpact=result.impact;renderPensionReview();msg("Vorschau berechnet. Noch wurde nichts übernommen.")}
  catch(error){msg(error.message,true)}
}
async function confirmPension(){
  if(!currentPensionPreview||!document.getElementById("pension-confirm-check")?.checked)return;
  const button=document.getElementById("pension-confirm-button");button.disabled=true;button.textContent="Wird übernommen …";
  try{const result=await call("/api/pension-documents/previews/"+currentPensionPreview.id+"/confirm",{method:"POST",body:JSON.stringify({confirmed:true})});currentPensionPreview=null;currentPensionImpact=null;document.getElementById("dashboard").innerHTML=pensionStep(4)+'<section class="pension-success" role="status">'+icons.check+'<h2>Renteninformation übernommen</h2><p>Die bestätigten Werte sind als neue, nachvollziehbare Revision aktiv. Das Rohdokument wurde nicht gespeichert.</p><div class="actions"><a class="button" href="?labView=fire#/decision-lab">FIRE-Kurs öffnen</a><button class="button secondary" type="button" onclick="refresh()">Revisionen ansehen</button></div></section>';msg(result.created?"Bestätigte Revision wurde aktiviert.":"Diese Revision war bereits vorhanden.")}
  catch(error){button.disabled=false;button.textContent="Werte bestätigen und übernehmen";msg(error.message,true)}
}
async function discardPension(){
  const id=currentPensionPreview?.id;currentPensionPreview=null;currentPensionImpact=null;if(id){try{await call("/api/pension-documents/previews/"+id,{method:"DELETE",body:"{}"})}catch{}}
  await refresh();
}
const sutorValidationLabels={
  OCR_REVIEW_REQUIRED:"Die Tabelle wurde per OCR erkannt und kann in diesem MVP nicht automatisch bestätigt werden. Bitte eine maschinenlesbare PDF verwenden oder den manuellen Textimport nutzen.",
  ISIN_INVALID:"Die ISIN-Prüfziffer ist ungültig.",QUANTITY_INVALID:"Die Stückzahl ist ungültig.",PRICE_INVALID:"Der Kurs ist ungültig.",
  MARKET_VALUE_INVALID:"Der Positionswert ist ungültig.",FX_MISSING:"Für einen USD-Kurs fehlt der EUR/USD-Kurs.",
  POSITION_VALUE_MISMATCH:"Stückzahl, Kurs und EUR-Wert stimmen nicht centgenau überein.",
  GHOSTFOLIO_TARGET_MISSING:"Das Ghostfolio-Zielkonto ist noch nicht konfiguriert.",
  GHOSTFOLIO_MAPPING_MISSING:"Mindestens eine ISIN benötigt zuerst eine bestätigte Ghostfolio-Zuordnung.",
  SNAPSHOT_EQUIVALENT:"Dieser Stand ist bereits vollständig vorhanden.",SNAPSHOT_CONFLICT:"Zu diesem Stichtag gibt es bereits abweichende Daten."
};
function sutorHistory(revisions){
  if(!revisions?.length)return '<div class="pension-history-empty">Noch kein per PDF bestätigter Sutor-Stand vorhanden.</div>';
  return '<div class="pension-history-list">'+revisions.map(revision=>'<article><div><strong>Sutor-Stand '+esc(formatDate(revision.statementDate))+'</strong><span>'+revision.positionCount+' Positionen · bestätigt '+esc(formatDate(revision.confirmedAt,true))+' · '+esc(revision.extractionVersion)+'</span></div><span class="state-label tone-ok"><span class="state-dot"></span>Bestätigt</span></article>').join("")+'</div>';
}
function renderSutorHome(revisions=[]){
  currentSutorPreview=null;currentSutorRevisions=revisions;
  document.getElementById("dashboard").innerHTML=pensionStep(1)+'<section class="pension-security-note" role="note">'+icons.check+'<div><strong>Privat verarbeitet</strong><span>PDF und Volltext werden nach der lokalen Erkennung gelöscht. Gespeichert werden nur bestätigte strukturierte Werte.</span></div></section><section class="pension-upload-panel" aria-labelledby="sutor-upload-title"><div class="pension-upload-copy"><span class="pension-document-icon">'+icons.manual+'</span><div><h2 id="sutor-upload-title">Monatlichen Sutor-Depotauszug prüfen</h2><p>PDF · maximal 12 MB · maximal 12 Seiten</p></div></div><form id="sutor-upload-form" onsubmit="uploadSutor(event)"><label class="pension-file-control" for="sutor-document"><span>PDF auswählen</span><input id="sutor-document" name="document" type="file" accept="application/pdf" required onchange="sutorFileSelected(this)"></label><span id="sutor-selected-file" class="pension-selected-file">Noch keine PDF ausgewählt</span><button class="button" type="submit">Sicher prüfen</button></form><ul class="pension-privacy-list"><li>Name, Adresse, Depotnummer, IBAN und Umsatzseiten gelangen nicht in die Oberfläche.</li><li>Positionen werden dynamisch über gültige ISIN erkannt; neue ISIN werden niemals still zugeordnet.</li><li>Der bestätigte Sutor-Stand ist Referenz und Zeitreihe. Der aktuelle Vermögenswert kommt aus Ghostfolio; beide Werte werden nicht addiert.</li></ul></section><section class="pension-history" aria-labelledby="sutor-history-title"><div class="section-heading"><div><h2 id="sutor-history-title">Bestätigte PDF-Stände</h2><p>Der bisherige manuelle Textimport bleibt als Fallback unter Datenstatus erhalten.</p></div></div>'+sutorHistory(revisions)+'</section>';
  document.getElementById("dashboard").setAttribute("aria-busy","false");
}
function sutorFileSelected(input){const label=document.getElementById("sutor-selected-file");if(label)label.textContent=input.files?.[0]?"PDF ausgewählt":"Noch keine PDF ausgewählt"}
function renderSutorProcessing(){
  document.getElementById("dashboard").innerHTML=pensionStep(2)+'<section class="pension-processing" role="status" aria-live="polite"><div class="pension-spinner" aria-hidden="true"></div><h2>Sutor-PDF wird sicher geprüft …</h2><p>Format, Schadcode, aktive Inhalte, Seiten und Bestandstabelle werden ausschließlich lokal geprüft.</p></section>';
  document.getElementById("dashboard").setAttribute("aria-busy","true");
}
async function uploadSutor(event){
  event.preventDefault();const file=document.getElementById("sutor-document")?.files?.[0];if(!file)return;
  if(file.size>12*1024*1024){msg("Die PDF ist größer als 12 MB.",true);return}
  renderSutorProcessing();msg("Sutor-PDF wird lokal geprüft …");
  try{const form=new FormData();form.append("document",file);currentSutorPreview=await call("/api/sutor-documents/previews",{method:"POST",body:form});renderSutorReview();msg("")}
  catch(error){renderSutorHome(currentSutorRevisions);msg(error.message,true)}
}
function sutorSignedMoney(minor){const value=Number(minor);return (value>0?"+":"")+money(value)}
function sutorPositionRow(position){
  const warnings=[...(position.validatorCodes||[])];if(!position.ghostfolioMapped)warnings.push("GHOSTFOLIO_MAPPING_MISSING");
  const warning=warnings.length?'<div class="sutor-row-warning" role="alert">'+warnings.map(code=>esc(sutorValidationLabels[code]||"Bitte Position prüfen")).join(" · ")+'</div>':'';
  const state=position.ghostfolioMapped?'Zugeordnet':'Zuordnung erforderlich';
  return '<tr class="'+(warnings.length?'needs-review':'')+'"><td><strong>'+esc(position.fundName)+'</strong><code>'+esc(position.isin)+'</code>'+warning+'</td><td><span class="tone-'+(position.ghostfolioMapped?'ok':'warning')+'">'+state+'</span></td><td>'+decimal(position.quantityAtomic,position.quantityDecimals)+'</td><td>'+decimal(position.priceAtomic,position.priceDecimals)+' '+esc(position.priceCurrency)+'</td><td>'+money(position.marketValueMinor)+'</td><td>Seite '+position.provenance.page+' · '+(position.provenance.method==="native"?'Text':'OCR')+'</td></tr>';
}
function sutorPositionCard(position){
  const warnings=[...(position.validatorCodes||[])];if(!position.ghostfolioMapped)warnings.push("GHOSTFOLIO_MAPPING_MISSING");
  return '<article class="sutor-position-card '+(warnings.length?'needs-review':'')+'"><h3>'+esc(position.fundName)+'</h3><code>'+esc(position.isin)+'</code><dl><div><dt>Anteile</dt><dd>'+decimal(position.quantityAtomic,position.quantityDecimals)+'</dd></div><div><dt>Kurs</dt><dd>'+decimal(position.priceAtomic,position.priceDecimals)+' '+esc(position.priceCurrency)+'</dd></div><div><dt>Wert</dt><dd>'+money(position.marketValueMinor)+'</dd></div><div><dt>Quelle</dt><dd>Seite '+position.provenance.page+'</dd></div></dl><p class="tone-'+(position.ghostfolioMapped?'ok':'warning')+'">'+(position.ghostfolioMapped?'Ghostfolio zugeordnet':'Ghostfolio-Zuordnung erforderlich')+'</p>'+(warnings.length?'<div class="sutor-row-warning" role="alert">'+warnings.map(code=>esc(sutorValidationLabels[code]||"Bitte Position prüfen")).join(" · ")+'</div>':'')+'</article>';
}
function renderSutorReview(){
  const preview=currentSutorPreview;if(!preview)return;
  if(preview.duplicate||preview.snapshotState==="equivalent"){
    document.getElementById("dashboard").innerHTML=pensionStep(3)+'<section class="pension-duplicate" role="status" aria-live="polite">'+icons.warning+'<h2>Stand bereits vorhanden</h2><p>Der Dokumenthash oder der vollständige Stand ist bereits bestätigt beziehungsweise im Archiv vorhanden. Es wurde nichts verändert.</p><button class="button secondary" type="button" onclick="discardSutor()">Zur Übersicht</button></section>';document.getElementById("dashboard").setAttribute("aria-busy","false");return
  }
  if(preview.snapshotState==="conflict"){
    document.getElementById("dashboard").innerHTML=pensionStep(3)+'<section class="pension-duplicate" role="status" aria-live="polite">'+icons.warning+'<h2>Abweichender Stand am selben Stichtag</h2><p>Für '+esc(formatDate(preview.statementDate))+' existieren bereits andere Werte. Eine Übernahme ist gesperrt.</p><button class="button secondary" type="button" onclick="discardSutor()">Zur Übersicht</button></section>';document.getElementById("dashboard").setAttribute("aria-busy","false");return
  }
  const rows=preview.positions.map(sutorPositionRow).join("");const cards=preview.positions.map(sutorPositionCard).join("");
  const warnings=preview.warnings.map(code=>'<div class="pension-field-warning" role="alert">'+icons.warning+'<span>'+esc(sutorValidationLabels[code]||"Bitte Sutor-Stand prüfen")+'</span></div>').join("");
  const previous=preview.previous?money(preview.previous.contractValueMinor)+' · '+formatDate(preview.previous.statementDate):"Noch kein vorheriger Stand";
  const delta=preview.deltaMinor===null?"–":sutorSignedMoney(preview.deltaMinor);
  const action='<label class="pension-confirm-check"><input id="sutor-confirm-check" type="checkbox" onchange="document.getElementById(&quot;sutor-confirm-button&quot;).disabled=!this.checked||!currentSutorPreview.canConfirm"><span>Ich habe Stichtag, Summen, Positionen und Zuordnungen geprüft.</span></label><button class="button" id="sutor-confirm-button" type="button" onclick="confirmSutor()" disabled>Stand bestätigen und übernehmen</button>';
  document.getElementById("dashboard").innerHTML=pensionStep(3)+'<section class="pension-security-note" role="note">'+icons.check+'<div><strong>Privat verarbeitet · Original gelöscht</strong><span>Im Browser stehen nur die abgeleiteten Bestandswerte und ihre Seitenherkunft.</span></div></section><div class="pension-review-layout sutor-review-layout"><div><section class="pension-document-summary"><span class="pension-document-icon">'+icons.manual+'</span><div><h2>Sutor-Depotauszug</h2><p>'+preview.pageCount+' Seiten · Stichtag '+esc(formatDate(preview.statementDate))+'</p><span>'+preview.positions.length+' ISIN-Positionen · '+(preview.extractionMethod==="native"?'Maschinenlesbarer Text':'OCR · Prüfung erforderlich')+'</span></div></section><section class="sutor-position-panel" aria-labelledby="sutor-positions-title"><div class="pension-fields-summary"><h2 id="sutor-positions-title">Erkannte Positionen</h2><p>Bestandstabelle; Umsatzseiten wurden nicht importiert.</p></div><div class="sutor-position-table-wrap"><table><thead><tr><th>Position</th><th>Ghostfolio</th><th>Anteile</th><th>Kurs</th><th>EUR-Wert</th><th>Quelle</th></tr></thead><tbody>'+rows+'</tbody></table></div><div class="sutor-position-cards">'+cards+'</div></section></div><aside><section class="sutor-delta"><h2>Stand &amp; Delta</h2><dl><div><dt>Kurswert gesamt</dt><dd>'+money(preview.totalMarketValueMinor)+'</dd></div><div><dt>Geldsaldo</dt><dd>'+money(preview.cashMinor)+'</dd></div><div><dt>Vertragswert</dt><dd>'+money(preview.contractValueMinor)+'</dd></div><div><dt>Vorheriger Stand</dt><dd>'+esc(previous)+'</dd></div><div><dt>Delta</dt><dd>'+esc(delta)+'</dd></div></dl><p>Referenz/Zeitreihe. Der Ghostfolio-Marktwert bleibt der einzige aktuelle Vermögenswert.</p></section><section class="pension-confirm"><h2>Prüfen &amp; übernehmen</h2>'+warnings+action+'<button class="button secondary" type="button" onclick="discardSutor()">Abbrechen</button></section></aside></div>';
  document.getElementById("dashboard").setAttribute("aria-busy","false");
}
async function confirmSutor(){
  if(!currentSutorPreview||!document.getElementById("sutor-confirm-check")?.checked||!currentSutorPreview.canConfirm)return;
  const button=document.getElementById("sutor-confirm-button");button.disabled=true;msg("Bestätigter Sutor-Stand wird übernommen …");
  try{const result=await call("/api/sutor-documents/previews/"+currentSutorPreview.id+"/confirm",{method:"POST",body:JSON.stringify({confirmed:true})});currentSutorPreview=null;document.getElementById("dashboard").innerHTML=pensionStep(4)+'<section class="pension-success" role="status" aria-live="polite">'+icons.check+'<h2>Sutor-Stand übernommen</h2><p>'+esc(result.message||"Der bestätigte Stand ist versioniert und mit USER_CONFIRMED protokolliert.")+'</p><a class="button secondary" href="#/assets">Vermögen öffnen</a></section>';msg("Sutor-Stand wurde bestätigt.")}
  catch(error){msg(error.message,true);button.disabled=false}
}
async function discardSutor(){
  const id=currentSutorPreview?.id;currentSutorPreview=null;if(id){try{await call("/api/sutor-documents/previews/"+id,{method:"DELETE",body:"{}"})}catch{}}
  await refresh();
}
function renderSource(source){
  const info=stateInfo(source);
  const approval=source.supportsDkbApproval&&source.actionPending?'<button class="button small" type="button" onclick="continueDkb(&quot;'+encoded(source.id)+'&quot;)">App-Freigabe prüfen</button>':'';
  const preflight=source.supportsDkbApproval?'<button class="button secondary small" type="button" onclick="preflightDkb(&quot;'+encoded(source.id)+'&quot;)">Konfiguration prüfen</button>':'';
  return '<details class="source-row"><summary class="source-summary"><div class="source-title"><span class="source-icon">'+sourceIcon(source)+'</span><strong>'+esc(source.label)+'</strong></div><span class="state-label tone-'+info.tone+'"><span class="state-dot"></span>'+info.label+'</span><span class="source-result">'+esc(source.message)+'</span><span class="details-label">Details '+icons.chevron+'</span></summary><div class="source-details"><div class="source-meta"><span>Letzter Erfolg<strong title="'+esc(formatDate(source.lastSuccessAt,true))+'">'+esc(relativeTime(source.lastSuccessAt))+'</strong></span><span>Ergebnis<strong>'+esc(source.message)+'</strong></span></div><div class="actions"><button class="button small" type="button" onclick="syncSource(&quot;'+encoded(source.id)+'&quot;)">Jetzt abrufen</button>'+preflight+approval+'</div></div></details>';
}
function systemItem(label,status,detail){
  const tone=status==="ok"?"ok":status==="warning"?"warning":"critical";
  const text=status==="ok"?"In Ordnung":status==="warning"?"Hinweis":"Handlungsbedarf";
  return '<div class="system-item"><span>'+esc(label)+'</span><div class="system-state tone-'+tone+'"><span class="state-dot"></span>'+text+'</div>'+(detail?'<span>'+esc(detail)+'</span>':'')+'</div>';
}
function renderDashboard(data){
  const overallTone=data.overall==="ok"?"ok":data.overall==="warning"?"warning":"critical";
  const tasks=data.tasks.length?data.tasks.map(renderTask).join(""):'<div class="empty">Aktuell sind keine manuellen Werte zu aktualisieren.</div>';
  const sources=data.automatic.length?data.automatic.map(renderSource).join(""):'<div class="empty">Noch keine automatische Quelle aktiv.</div>';
  const archiveDetail=data.system.archiveTotalBytes>0?formatBytes(data.system.archiveFreeBytes)+" frei":"Speicherstatus unbekannt";
  const backupDetail=data.system.backupLastSuccessAt?"Zuletzt "+relativeTime(data.system.backupLastSuccessAt):"Noch kein Lauf sichtbar";
  document.getElementById("dashboard").innerHTML='\
    <section class="status-overview" aria-label="Statusübersicht">\
      <div class="overview-main"><div class="overall-line">'+statusIcon(overallTone)+'<h2>'+esc(data.headline)+'</h2></div><p class="checked-at">Zuletzt geprüft: '+esc(formatDate(data.generatedAt,true))+'</p></div>\
      <div class="overview-stats"><div class="stat"><strong>'+data.summary.automaticCurrent+'<span class="tone-'+(data.summary.automaticCurrent===data.summary.automaticTotal?'ok':'warning')+'"> / '+data.summary.automaticTotal+'</span></strong><span>Automatisch aktuell</span></div><div class="stat"><strong>'+data.summary.tasks+'</strong><span>Aufgaben</span></div><div class="stat"><strong>'+data.summary.historicalImports+'</strong><span>Historische Importe</span></div></div>\
    </section>\
    <section class="section" aria-labelledby="pension-documents-title"><div class="section-heading"><div><h2 id="pension-documents-title">Renteninformationen</h2><p>DRV-Werte sicher erkennen, prüfen und als FIRE-Annahme bestätigen.</p></div><a class="button secondary" href="#/pension-documents">Renteninformation prüfen</a></div></section>\
    <section class="section" aria-labelledby="sutor-documents-title"><div class="section-heading"><div><h2 id="sutor-documents-title">Sutor Riester</h2><p>Monatlichen Depotauszug sicher als PDF prüfen und bestätigen.</p></div><a class="button secondary" href="#/sutor-riester">Sutor-PDF prüfen</a></div></section>\
    <section class="section" aria-labelledby="tasks-title"><div class="section-heading"><div><h2 id="tasks-title">Offene Aufgaben</h2><p>Vertragswerte, die bewusst bestätigt werden müssen.</p></div></div><div class="task-list">'+tasks+'</div></section>\
    <section class="section" aria-labelledby="sources-title"><div class="section-heading"><div><h2 id="sources-title">Automatische Quellen</h2><p>Banken, Depots und Wallets mit geplantem Abruf.</p></div></div><div class="source-list">'+sources+'</div></section>\
    <section class="section" aria-labelledby="history-title"><div class="section-heading"><div><h2 id="history-title">Historische Daten</h2></div></div><details class="historical"><summary><strong>'+icons.archive+'Historische CSV-Importe</strong><span class="details-label">'+data.historical.count+' Quellen '+icons.chevron+'</span></summary><p>'+data.historical.count+' deaktivierte Importquellen bleiben im lückenlosen Archiv erhalten.'+(data.historical.lastSuccessAt?' Letzter Import: '+esc(formatDate(data.historical.lastSuccessAt))+'.':'')+'</p></details></section>\
    <section class="section" aria-labelledby="system-title"><div class="section-heading"><div><h2 id="system-title">Systemzustand</h2></div></div><div class="system-band">'+systemItem("FinanceSync",data.system.financeSync)+systemItem("Datenbank",data.system.database)+systemItem("Backup",data.system.backup,backupDetail)+systemItem("Archivspeicher",data.system.archive,archiveDetail)+'</div></section>\
    <section class="section"><details class="management" id="management"><summary>Verwaltung und manuelle Eingabe</summary><div class="management-body"><div class="management-tools"><button class="button secondary" type="button" onclick="exportNow()">CSV neu erzeugen</button><button class="button secondary" type="button" onclick="reconcile()">Interne Überträge abgleichen</button></div><section class="manual-workflow" id="miles-section"><h2>Miles &amp; More Abrechnung</h2><p>Text der Kreditkartenabrechnung einfügen. Vorschau ändert noch nichts.</p><div class="manual-grid"><div><label for="miles-date">Abrechnungsdatum</label><input id="miles-date" type="date" oninput="resetMilesMorePreview()"></div><div><label for="miles-text">Abrechnungstext</label><textarea id="miles-text" oninput="resetMilesMorePreview()" placeholder="Hier die Umsätze inkl. Saldo einfügen …"></textarea></div></div><div class="actions" style="margin-top:12px"><button class="button" type="button" onclick="previewMilesMore()">Vorschau prüfen</button><button class="button secondary" id="miles-import-button" type="button" onclick="importMilesMore()" disabled>In Actual importieren</button></div><div id="miles-preview" class="preview"></div></section><section class="manual-workflow" id="manual-section" hidden><h2>Manuelle Vorsorge-Eingabe (Fallback)</h2><p>Für Sutor ist der sichere PDF-Import der bevorzugte Weg. Diese Texteingabe bleibt für ältere ISIN-lose Depotbestände und Alte Leipziger erhalten.</p><div class="manual-grid"><div><label for="manual-source">Vertrag</label><select id="manual-source" name="manual-source" autocomplete="off"></select></div><div><label for="manual-text">Kopierter Text</label><textarea id="manual-text" name="manual-text" autocomplete="off" spellcheck="false" placeholder="Hier den vollständigen Text einfügen …"></textarea></div></div><div class="actions" style="margin-top:12px"><button class="button" id="preview-button" type="button" onclick="previewManual()">Vorschau prüfen</button><span style="color:var(--muted)">Noch kein Import</span></div><div id="manual-error" class="notice error" role="status" aria-live="polite"></div><div id="manual-preview" class="preview"></div></section></div></details></section>';
  document.getElementById("dashboard").setAttribute("aria-busy","false");
}

function renderHeader(view){
  const content={
    overview:{title:"Übersicht",subtitle:"Finanzen, Vermögen und offene Punkte auf einen Blick."},
    spending:{title:"Ausgaben",subtitle:"Kategorien und zugehörige Buchungen nachvollziehen."},
    assets:{title:"Vermögen",subtitle:"Konten, Anlagen und Vorsorge mit nachvollziehbaren Stichtagen."},
    review:{title:"Prüfen",subtitle:"Eine Inbox für offene Buchungen, regelmäßige Ausgaben und Maßnahmen."},
    lab:{title:"Planen",subtitle:"Finanzielle Entscheidungen über 20 Jahre als nachvollziehbare Szenarien vergleichen."},
    analyses:{title:"Analysen",subtitle:"Ausgaben verstehen und Veränderungen nachvollziehen."},
    status:{title:"Datenstatus",subtitle:"Aktualität, offene Aufgaben und Systemzustand auf einen Blick."}
    ,pension:{title:"Renteninformation prüfen",subtitle:"DRV-Werte lokal erkennen, nachvollziehen und bewusst übernehmen."}
    ,sutor:{title:"Sutor Riester prüfen",subtitle:"Monatlichen Depotauszug lokal erkennen, nachvollziehen und bewusst übernehmen."}
  }[view];
  if(view==="analyses"&&analysisSelection().view==="crypto-origin-tax")content.subtitle="Krypto-Herkunft, Investmentbasis und Steuerstatus nachvollziehen.";
  if(view==="analyses"&&analysisSelection().view==="investment-newsletters")content.subtitle="Newsletter-Signale prüfen, einordnen und nachvollziehen.";
  document.title=content.title+" · Finance Hub";
  const eyebrow=document.getElementById("page-eyebrow");
  eyebrow.hidden=view!=="status"&&view!=="pension"&&view!=="sutor";
  document.getElementById("page-title").textContent=content.title;
  document.getElementById("page-subtitle").textContent=content.subtitle;
  const action=document.getElementById("refresh-button");
  const analysisExport=view==="analyses"&&analysisSelection().view==="expense-structure";
  action.hidden=view==="pension"||view==="sutor";
  action.setAttribute("aria-label",analysisExport?"Aktuelle Analyse als CSV exportieren":content.title+" aktualisieren");
  action.querySelector("[aria-hidden]").textContent=analysisExport?"↓":"↻";
  action.querySelector(".desktop-label").textContent=analysisExport?"CSV exportieren":"Aktualisieren";
}
function renderLoading(view){
  document.getElementById("dashboard").setAttribute("aria-busy","true");
  document.getElementById("dashboard").innerHTML=view==="overview"?'\
    <section class="wealth-overview" aria-label="Vermögensübersicht wird geladen"><div><div class="skeleton" style="width:52%;height:18px">Lädt</div><div class="skeleton" style="width:72%;height:48px;margin-top:10px">Lädt</div></div><div class="skeleton" style="width:100%;height:28px">Lädt</div></section>'
    :view==="spending"?'\
    <div class="expense-loading" aria-label="Ausgaben werden geladen"><section class="expense-summary-band"><div class="expense-period"><div class="skeleton" style="width:100%;height:44px">Lädt</div></div><div class="expense-summary-stat"><div class="skeleton" style="width:76%;height:16px">Lädt</div><div class="skeleton" style="width:58%;height:28px;margin-top:8px">Lädt</div></div><div class="expense-summary-stat"><div class="skeleton" style="width:68%;height:16px">Lädt</div><div class="skeleton" style="width:42%;height:28px;margin-top:8px">Lädt</div></div><div class="expense-summary-stat"><div class="skeleton" style="width:68%;height:16px">Lädt</div><div class="skeleton" style="width:42%;height:28px;margin-top:8px">Lädt</div></div></section><div class="expense-workspace"><section class="expense-pane expense-category-pane"><div class="skeleton" style="width:45%;height:24px">Lädt</div><div class="skeleton" style="width:100%;height:44px;margin-top:16px">Lädt</div><div class="skeleton" style="width:100%;height:250px;margin-top:12px">Lädt</div></section><section class="expense-pane expense-transactions-pane"><div class="skeleton" style="width:35%;height:24px">Lädt</div><div class="skeleton" style="width:100%;height:44px;margin-top:16px">Lädt</div><div class="skeleton" style="width:100%;height:330px;margin-top:12px">Lädt</div></section></div></div>'
    :view==="assets"?'\
    <div aria-label="Vermögen wird geladen"><section class="assets-summary"><div><div class="skeleton" style="width:48%;height:18px">Lädt</div><div class="skeleton" style="width:75%;height:48px;margin-top:10px">Lädt</div></div><div><div class="skeleton" style="width:100%;height:30px">Lädt</div><div class="skeleton" style="width:100%;height:48px;margin-top:14px">Lädt</div></div></section><div class="assets-workspace"><section class="assets-pane"><div class="skeleton" style="width:58%;height:24px">Lädt</div><div class="skeleton" style="width:100%;height:360px;margin-top:14px">Lädt</div></section><section class="assets-pane"><div class="skeleton" style="width:35%;height:24px">Lädt</div><div class="skeleton" style="width:100%;height:390px;margin-top:14px">Lädt</div></section></div></div>'
    :view==="analyses"?'\
    <div aria-label="Analyse wird geladen"><section class="analysis-toolbar"><div class="skeleton" style="height:44px">Lädt</div><div class="skeleton" style="height:44px">Lädt</div><div class="skeleton" style="height:44px">Lädt</div><div class="skeleton" style="height:44px">Lädt</div></section><section class="analysis-summary"><div><div class="skeleton" style="width:62%;height:18px">Lädt</div><div class="skeleton" style="width:72%;height:45px;margin-top:8px">Lädt</div></div><div><div class="skeleton" style="width:76%;height:18px">Lädt</div><div class="skeleton" style="width:50%;height:28px;margin-top:8px">Lädt</div></div><div><div class="skeleton" style="width:70%;height:18px">Lädt</div><div class="skeleton" style="width:45%;height:28px;margin-top:8px">Lädt</div></div></section><div class="analysis-grid"><section class="analysis-panel"><div class="skeleton" style="width:42%;height:24px">Lädt</div><div class="skeleton" style="width:100%;height:310px;margin-top:20px">Lädt</div></section><section class="analysis-panel"><div class="skeleton" style="width:52%;height:24px">Lädt</div><div class="skeleton" style="width:100%;height:310px;margin-top:20px">Lädt</div></section></div></div>'
    :'\
    <section class="status-overview" aria-label="Statusübersicht wird geladen"><div class="overview-main"><div class="skeleton" style="width:72%;height:28px">Lädt</div><div class="skeleton" style="width:42%;height:16px;margin-top:12px">Lädt</div></div><div class="overview-stats"><div class="stat"><strong>–</strong><span>Automatisch aktuell</span></div><div class="stat"><strong>–</strong><span>Aufgaben</span></div><div class="stat"><strong>–</strong><span>Historische Importe</span></div></div></section>';
}
async function refresh(force=false){
  const view=activeView();
  const button=document.getElementById("refresh-button");
  renderHeader(view);renderNavigation();renderLoading(view);
  const loadingLabel=view==="overview"?"Übersicht":view==="spending"?"Ausgaben":view==="assets"?"Vermögen":view==="review"?"Prüfen":view==="lab"?"Planung":view==="analyses"?"Analyse":view==="pension"?"Renteninformationen":view==="sutor"?"Sutor Riester":"Datenstatus";
  button.disabled=true;msg(loadingLabel+" wird aktualisiert …");
  try{
    if(view==="overview"){
      const range=cashflowSelection();
      const params=new URLSearchParams({months:String(range.months),offset:String(range.offset)});
      params.set("spendingOffset",String(spendingSelection().offset));
      if(force)params.set("refresh","1");
      const historyParams=force?"?refresh=1":"";
      const [data,history]=await Promise.all([call("/api/dashboard/overview?"+params.toString()),call("/api/dashboard/wealth-history"+historyParams)]);renderOverview(data,history);
    }else if(view==="spending"){
      const selection=expenseSelection();
      const params=new URLSearchParams();
      if(selection.month)params.set("month",selection.month);
      if(selection.period&&selection.period!=="month")params.set("period",selection.period);
      if(selection.quarter)params.set("quarter",selection.quarter);
      if(selection.year)params.set("year",selection.year);
      if(selection.sort&&selection.sort!=="date-desc")params.set("sort",selection.sort);
      if(selection.category!=="all")params.set("category",selection.category);
      if(selection.account!=="all")params.set("account",selection.account);
      if(selection.search)params.set("search",selection.search);
      if(selection.page>1)params.set("page",String(selection.page));
      if(force)params.set("refresh","1");
      const data=await call("/api/dashboard/spending?"+params.toString());renderSpending(data);
    }else if(view==="assets"){
      const data=await call("/api/dashboard/assets"+(force?"?refresh=1":""));renderAssets(data);
    }else if(view==="review"){
      const params=new URLSearchParams();
      const months=Number(new URLSearchParams(location.search).get("reviewMonths")||6);
      if([3,6,12,24].includes(months))params.set("months",String(months));
      if(force)params.set("refresh","1");
      const data=await call("/api/dashboard/review"+(params.toString()?"?"+params:""));renderReview(data);
    }else if(view==="lab"){
      const selection=analysisSelection();
      const params=new URLSearchParams();
      params.set("trendBasis",selection.decisionBasis);
      params.set("realReturnBps",String(Math.round(selection.decisionReturn*100)));
      params.set("monthlyChangeMinor",String(Math.round(selection.decisionMonthly*100)));
      params.set("oneTimeMinor",String(Math.round(selection.decisionOneTime*100)));
      params.set("fireTargetAge",String(selection.fireTargetAge));
      if(selection.fireActionKeys.length)params.set("fireActionKeys",selection.fireActionKeys.join(","));
      else if(new URLSearchParams(location.search).has("fireActionKeys"))params.set("fireActionKeys","none");
      if(selection.fireCategoryCuts.length)params.set("fireCategoryCuts",selection.fireCategoryCuts.join(","));
      if(selection.fireOneTimeKeys.length)params.set("fireOneTimeKeys",selection.fireOneTimeKeys.join(","));
      if(force)params.set("refresh","1");
      const data=await call("/api/dashboard/analyses/decision-lab?"+params.toString());renderDecisionLab(data);
    }else if(view==="pension"){
      if(currentPensionPreview)renderPensionReview();else{const data=await call("/api/pension-documents/revisions");renderPensionHome(data.revisions||[])}
    }else if(view==="sutor"){
      if(currentSutorPreview)renderSutorReview();else{const data=await call("/api/sutor-documents/revisions");renderSutorHome(data.revisions||[])}
    }else if(view==="analyses"){
      const selection=analysisSelection();
      const params=new URLSearchParams();
      if(selection.view==="decision-lab"){
        params.set("trendBasis",selection.decisionBasis);
        params.set("realReturnBps",String(Math.round(selection.decisionReturn*100)));
        params.set("monthlyChangeMinor",String(Math.round(selection.decisionMonthly*100)));
        params.set("oneTimeMinor",String(Math.round(selection.decisionOneTime*100)));
        params.set("fireTargetAge",String(selection.fireTargetAge));
        if(selection.fireActionKeys.length)params.set("fireActionKeys",selection.fireActionKeys.join(","));
        else if(new URLSearchParams(location.search).has("fireActionKeys"))params.set("fireActionKeys","none");
        if(selection.fireCategoryCuts.length)params.set("fireCategoryCuts",selection.fireCategoryCuts.join(","));
        if(selection.fireOneTimeKeys.length)params.set("fireOneTimeKeys",selection.fireOneTimeKeys.join(","));
        if(force)params.set("refresh","1");
        const data=await call("/api/dashboard/analyses/decision-lab?"+params.toString());renderDecisionLab(data);
      }else if(selection.view==="investment-newsletters"){
        const data=await call("/api/dashboard/investment-newsletters?limit=500");renderInvestmentNewsletters(data);
      }else if(selection.view==="crypto-origin-tax"){
        const data=await call("/api/dashboard/analyses/crypto-position");renderCryptoAnalysis(data);
      }else if(selection.view==="expense-optimizations"){
        const data=await call("/api/dashboard/analyses/recurring-expenses/optimizations"+(force?"?refresh=1":""));renderRecurringOptimizations(data);
      }else if(selection.view==="recurring-expenses"){
        if(selection.rhythm!=="alle")params.set("rhythm",selection.rhythm);
        if(selection.review!=="moeglich")params.set("review",selection.review);
        if(selection.classification!=="alle")params.set("classification",selection.classification);
        if(selection.confidence!=="alle")params.set("confidence",selection.confidence);
        if(force)params.set("refresh","1");
        currentRecurringDetail=null;
        const data=await call("/api/dashboard/analyses/recurring-expenses?"+params.toString());renderRecurringExpenses(data);
      }else{
        if(selection.period)params.set("period",String(selection.period));
        if(selection.comparison)params.set("comparison",String(selection.comparison));
        if(force)params.set("refresh","1");
        const data=await call("/api/dashboard/analyses?"+params.toString());renderAnalyses(data);
      }
    }else{
      const data=await call("/api/dashboard/status");renderDashboard(data);await loadManualSources();
    }
    msg("");
  }
  catch(error){if(view==="spending")renderSpendingError(error);else if(view==="assets")renderAssetsError(error);else if(view==="review")renderReviewError(error);else if(view==="lab")renderDecisionLabError(error);else if(view==="analyses"&&analysisSelection().view==="crypto-origin-tax")renderCryptoError(error);else if(view==="analyses"&&analysisSelection().view==="investment-newsletters"){document.getElementById("dashboard").innerHTML=expenseState("Nicht verfügbar","Das Investment-Cockpit konnte nicht geladen werden.","refresh(true)","Erneut versuchen");msg(error.message,true)}else if(view==="analyses")renderAnalysesError(error);else{msg(error.message,true);document.getElementById("dashboard").setAttribute("aria-busy","false")}}
  finally{button.disabled=false}
}
async function wait(ms){return new Promise(resolve=>setTimeout(resolve,ms))}
async function finishDkbApproval(id){
  for(let attempt=1;attempt<=24;attempt+=1){
    msg("Bitte in der DKB-App freigeben · automatische Prüfung "+attempt+"/24 …");
    await wait(attempt===1?4000:5000);
    const result=await call("/api/dkb-fints/continue/"+id,{method:"POST",body:"{}"});
    if(result.state!=="WAITING_FOR_USER")return result;
  }
  throw new Error("Die DKB-Freigabe wurde nach zwei Minuten noch nicht bestätigt. Der offene Vorgang kann später mit ‚App-Freigabe prüfen‘ fortgesetzt werden.");
}
async function syncSource(id){try{msg("Abruf läuft …");let result=await call("/api/sync/"+id,{method:"POST"});if(result.state==="WAITING_FOR_USER"&&result.decoupled)result=await finishDkbApproval(id);msg(result.message);await refresh(true)}catch(error){msg(error.message,true);await refresh()}}
async function preflightDkb(id){try{msg("FinTS-Konfiguration wird geprüft …");const result=await call("/api/dkb-fints/preflight/"+id,{method:"POST"});msg(result.message);await refresh()}catch(error){msg(error.message,true)}}
async function continueDkb(id){try{msg("DKB-App-Freigabe wird geprüft …");const result=await call("/api/dkb-fints/continue/"+id,{method:"POST",body:"{}"});msg(result.message);await refresh()}catch(error){msg(error.message,true)}}
async function exportNow(){try{await call("/api/export",{method:"POST"});msg("CSV-Dateien wurden aktualisiert.")}catch(error){msg(error.message,true)}}
async function reconcile(){try{const result=await call("/api/reconcile",{method:"POST"});msg(result.message)}catch(error){msg(error.message,true)}}
function money(minor,currency="EUR"){return new Intl.NumberFormat("de-DE",{style:"currency",currency}).format(Number(minor)/100)}
function decimal(atomic,decimals){const raw=String(atomic||"0").padStart(decimals+1,"0");const whole=raw.slice(0,-decimals)||"0";const fraction=decimals?","+raw.slice(-decimals):"";return whole.replace(/\B(?=(\d{3})+(?!\d))/g,".")+fraction}
async function loadManualSources(){
  try{const data=await call("/api/manual-workflow/sources");const section=document.getElementById("manual-section");if(!data.sources.length){section.hidden=true;return}section.hidden=false;document.getElementById("manual-source").innerHTML=data.sources.map(source=>'<option value="'+esc(source.id)+'">'+esc(source.label)+'</option>').join("")}
  catch(error){msg(error.message,true)}
}
function openManual(id){
  const management=document.getElementById("management");management.open=true;
  const select=document.getElementById("manual-source");select.value=decodeURIComponent(id);
  const reduced=window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  document.getElementById("manual-section").scrollIntoView({behavior:reduced?"auto":"smooth",block:"start"});
  setTimeout(()=>document.getElementById("manual-text").focus(),250);
}
async function previewManual(){
  try{
    currentPreview=null;manualError();document.getElementById("manual-preview").innerHTML="";msg("Text wird geprüft …");
    const sourceId=document.getElementById("manual-source").value;
    const text=document.getElementById("manual-text").value;
    const data=await call("/api/manual-workflow/preview",{method:"POST",body:JSON.stringify({sourceId,text})});
    currentPreview=data;
    const snapshotState=data.snapshotState==="equivalent"?"Dieser Stand ist bereits vollständig im Archiv vorhanden.":data.snapshotState==="new"?"Dieser Stichtag ist neu.":"Zu diesem Stichtag gibt es bereits abweichende Daten.";
    const rows=data.holdings.map(holding=>'<tr><td>'+esc(holding.name)+'<br><code>'+esc(holding.symbol)+'</code></td><td class="tone-'+(holding.ghostfolioMapped?'ok':'critical')+'">'+(holding.ghostfolioMapped?'Zugeordnet':'Zuordnung fehlt')+'</td><td>'+decimal(holding.quantityAtomic,holding.quantityDecimals)+'</td><td>'+decimal(holding.priceAtomic,holding.priceDecimals)+' '+esc(holding.priceCurrency)+'</td><td>'+money(holding.marketValueMinor)+'</td></tr>').join("");
    const warnings=data.warnings.map(warning=>'<p class="tone-warning">'+esc(warning)+'</p>').join("");
    document.getElementById("manual-preview").innerHTML='<div style="display:flex;justify-content:space-between;gap:16px"><div><strong>'+esc(data.label)+'</strong><div style="color:var(--muted)">Stichtag '+esc(formatDate(data.capturedAt))+' · '+esc(snapshotState)+'</div></div><strong>'+money(data.totalMinor)+'</strong></div>'+warnings+'<table><thead><tr><th>Position</th><th>Ghostfolio</th><th>Anteile</th><th>Kurs</th><th>Wert</th></tr></thead><tbody>'+rows+'</tbody></table><div class="actions" style="margin-top:14px"><label style="display:flex;align-items:center;gap:8px"><input id="manual-confirm-check" type="checkbox" onchange="document.getElementById(&quot;manual-confirm-button&quot;).disabled=!this.checked"> Ich habe Stichtag, Gesamtwert und Positionen geprüft.</label><button class="button" id="manual-confirm-button" type="button" onclick="confirmManual()" disabled>Bestätigt übernehmen</button></div>';
    if(!data.canConfirm)document.getElementById("manual-confirm-check").disabled=true;
    msg("Vorschau erstellt. Es wurden noch keine Daten verändert.");
  }catch(error){manualError(error.message);msg("Die Vorschau konnte nicht erstellt werden.",true)}
}
async function confirmManual(){
  try{
    if(!currentPreview)return;
    document.getElementById("manual-confirm-button").disabled=true;msg("Bestätigter Stand wird übernommen …");
    const result=await call("/api/manual-workflow/confirm",{method:"POST",body:JSON.stringify({previewId:currentPreview.id})});
    document.getElementById("manual-text").value="";document.getElementById("manual-preview").innerHTML="";currentPreview=null;msg(result.message);await refresh();
  }catch(error){manualError(error.message);msg("Der bestätigte Stand konnte nicht übernommen werden.",true);const button=document.getElementById("manual-confirm-button");if(button)button.disabled=false}
}
window.addEventListener("beforeunload",event=>{
  const textarea=document.getElementById("manual-text");
  if(textarea&&textarea.value.trim()){event.preventDefault();event.returnValue=""}
});
window.addEventListener("hashchange",()=>{
  renderNavigation();
  refresh();
  const title=document.getElementById("page-title");
  title.tabIndex=-1;
  title.focus({preventScroll:true});
});
window.addEventListener("popstate",()=>refresh());
function migrateLegacyRoutes(){
  const params=new URLSearchParams(location.search);
  const view=params.get("analysisView");
  if(view==="decision-lab"){
    params.delete("analysisView");
    const query=params.toString();
    history.replaceState(null,"",(query?"?"+query:location.pathname)+"#/decision-lab");
  }else if(view==="recurring-expenses"||view==="expense-optimizations"){
    params.delete("analysisView");
    const query=params.toString();
    history.replaceState(null,"",(query?"?"+query:location.pathname)+"#/review");
  }
}
migrateLegacyRoutes();
if(!location.hash)history.replaceState(null,"","#/overview");
refresh();
