/* Restricted action dispatch: no eval, Function constructor or inline JavaScript. */
function registerUiActions(actions){
  function argument(token,element,event){
    token=token.trim();
    if(token==="this")return element;
    if(token==="event")return event;
    if(token==="this.value")return element.value;
    if(token==="this.checked")return element.checked;
    if(token==="true")return true;
    if(token==="false")return false;
    if(token==="null")return null;
    if(/^-?\d+(?:\.\d+)?$/.test(token))return Number(token);
    if(/^"(?:[^"\\]|\\.)*"$/.test(token))return JSON.parse(token);
    if(/^'[^'\\]*'$/.test(token))return token.slice(1,-1);
    throw new Error("Ungültige Bedienaktion");
  }
  for(const type of ["click","change","submit","input","keydown"]){
    document.addEventListener(type,event=>{
      const element=event.target.closest?.('[data-fh-'+type+']');
      if(!element||element.disabled)return;
      const text=element.getAttribute('data-fh-'+type);
      const match=/^([a-zA-Z][\w]*)\((.*)\)$/.exec(text);
      if(!match||!Object.hasOwn(actions,match[1]))return;
      if(type==="submit")event.preventDefault();
      try{
        const tokens=match[2].trim()?match[2].match(/"(?:[^"\\]|\\.)*"|'[^'\\]*'|[^,]+/g):[];
        actions[match[1]](...tokens.map(token=>argument(token,element,event)));
      }catch{
        const message=document.getElementById("message");
        if(message){message.textContent="Diese Aktion konnte nicht ausgeführt werden. Bitte Ansicht neu laden.";message.classList.add("visible");}
      }
    });
  }
}
