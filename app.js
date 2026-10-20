/* Kill Team Tactical Command · Offline first-party interface.
   All rules and data are supplied by the user's uploaded file.
   No third-party JS, assets, fonts, accounts or network calls. */
"use strict";
import {localAPI,initialize,listTeams,switchTeam,importTeamPack,exportCurrentPack} from './core/local-api.js';
import {validatePack} from './core/pack.js';
const S={data:null,page:"dashboard",selected:null,tab:"strategy",
 editorKind:"operative",editorId:null,editorNew:false,modal:null,search:""};
const $=id=>document.getElementById(id);
const E=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const escAttr=E;
const show=v=>v===null||v===undefined?"∞":v;
const trim=(s,n=130)=>String(s||"").length>n?String(s).slice(0,n-1)+"…":String(s||"");
const n=v=>Number(v)||0;
const opBy=id=>S.data.catalog.operatives.find(o=>o.id===id);
const resBy=id=>Object.values(S.data.catalog.resources).flat().find(r=>r.id===id);
function toast(msg,error=false){const t=document.createElement("div");t.className="toast"+(error?" error":"");t.textContent=msg;$("toast-root").appendChild(t);setTimeout(()=>t.remove(),3800);}
const api=(url,method="GET",body)=>localAPI(url,method,body);
async function refresh(){
 try{S.data=await api('/api/state');S.selected=S.selected||S.data.catalog.operatives[0].id;
  S.editorId=S.editorId||S.selected;render();}
 catch(ex){$('content').innerHTML=`<div class="alert danger">${E(ex.message)}. If this is the first launch, open the hosted app online once so the initial team pack installs.</div>`;}
}
async function update(path,method,body,notice){
  try{S.data=await api(path,method,body);render();if(notice)toast(notice);return true}
  catch(ex){toast(ex.message,true);return false}
}
const act=(v,notice)=>update("/api/action","POST",v,notice);
function goto(page){S.page=page;S.modal=null;render();$("content").focus({preventScroll:true});window.scrollTo(0,0);}
function opOpen(id){S.selected=id;goto("detail");}
function btn(text,action,cls="",extra=""){return `<button type="button" class="btn ${cls}" data-action="${E(action)}" ${extra}>${text}</button>`}
function pill(text,cls=""){return `<span class="tag ${cls}">${E(text)}</span>`}
function header(title,sub,actions="",kicker=null){
 return `<div class="hero"><div><div class="kicker">${E(kicker||S.data.catalog.team.subtitle||S.data.catalog.team.name)}</div><h1>${E(title)}</h1>${sub?`<p class="subhead">${E(sub)}</p>`:""}</div><div class="hero-actions">${actions}</div></div>`}
function sec(title,extra=""){return `<div class="section-title"><h2>${E(title)}</h2>${extra?`<span class="count">${E(extra)}</span>`:""}</div>`}
function operativeTile(op){
 const b=S.data.battle.ops[op.id],eff=S.data.computed[op.id],pct=Math.max(0,100*b.wounds/Math.max(1,eff.wounds));
 return `<button type="button" class="operative-tile" data-open-op="${E(op.id)}"><div class="tile-top"></div><div class="tile-body">
  <div class="tile-kicker">${E(op.keywords.slice(-1)[0])} // UNIT ${String(S.data.catalog.operatives.indexOf(op)+1).padStart(2,"0")}</div>
  <div class="tile-title">${E(op.name.replace("Insidiant ",""))}</div>
  <div class="tile-row"><span>WOUNDS</span><span>${b.wounds} / ${eff.wounds}</span></div>
  <div class="tile-bar"><i style="width:${pct}%"></i></div>
  <div class="tile-tags">${b.wounds<=0?pill("INCAPACITATED","tag-red"):b.inspiring?pill("INSPIRING","tag-orange"):pill("STANDBY")}
  ${b.activated?pill("ACTIVATED","tag-muted"):""}${b.benedictions.map(x=>pill(x,"tag-ok")).join("")}</div></div></button>`;
}
function render(){
 if(!S.data)return;
 $("turn-number").textContent=S.data.battle.turn;$("cp-number").textContent=S.data.battle.cp;
 document.querySelectorAll("[data-nav]").forEach(x=>x.classList.toggle("active",x.dataset.nav===S.page||(S.page==="detail"&&x.dataset.nav==="operatives")));
 document.querySelectorAll("[data-team-name]").forEach(x=>x.textContent=S.data.catalog.team.short_name||S.data.catalog.team.name);
 document.documentElement.style.setProperty('--orange', S.data.catalog.team.theme?.accent||S.data.catalog.team.theme?.orange||'#ff5a12');
 const titles={teams:"TEAM LIBRARY",dashboard:"BATTLE OVERVIEW",operatives:"ACTIVE ROSTER",detail:"OPERATIVE DATACARD",resources:"PLOYS & RULES",equipment:"EQUIPMENT STORAGE",editor:"ROSTER EDITOR",log:"BATTLE LOG"};
 $("top-page").textContent=titles[S.page]||"TACTICAL COMMAND";
 $("content").innerHTML=({
  dashboard:renderDashboard,operatives:renderRoster,detail:renderDetail,
  resources:()=>renderResources(S.tab),equipment:()=>renderResources("equipment"),
  editor:renderEditor,log:renderLog,teams:renderTeams
 }[S.page]||renderDashboard)();
 if(S.modal)renderModal();
}
function renderTeams(){
 return header("TEAM LIBRARY","Independent rosters, battles and backups. Import a schema v2 JSON file to install another faction.",
 btn("IMPORT TEAM PACK","import-team","btn-primary")+btn("EXPORT CURRENT PACK","export-team","btn-outline"))+
 `<div class="resource-grid">${(S.teams||[]).map(t=>`<article class="res-card ${t.id===S.data.catalog.team.id?'active':''}">
 <div class="kicker">${t.id===S.data.catalog.team.id?'ACTIVE TEAM':'INSTALLED TEAM'}</div><h3>${E(t.name)}</h3>
 <p class="muted small">Team ID: ${E(t.id)}</p>
 ${btn(t.id===S.data.catalog.team.id?'CURRENT TEAM':'ACTIVATE TEAM','switch-team','btn-primary',`data-id="${E(t.id)}" ${t.id===S.data.catalog.team.id?'disabled':''}`)}</article>`).join('')}</div>
 <div class="panel" style="margin-top:22px"><h3>ADD FUTURE FACTIONS</h3><p class="muted">To add another Kill Team, import a new <code>schema_version: 2</code> team pack. Each gets its own database record and battle progress. See <code>TEAM_PACK_GUIDE.md</code> in the source bundle.</p>
 <div class="action-band">${btn("IMPORT JSON TEAM PACK","import-team","btn-primary")}${btn("EXPORT CURRENT PACK","export-team","btn-outline")}${btn("EXPORT BATTLE BACKUP","export","btn-ghost")}</div></div>`;
}
function downloadJson(data,filename){const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
 const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),5000)}
async function importPackFile(file){if(!file)return;try{const pack=JSON.parse(await file.text());validatePack(pack);
 let state;
 try{state=await importTeamPack(pack)}catch(err){
  if(err.message!=='TEAM_ALREADY_EXISTS')throw err;
  if(!confirm('This team already exists. Replace its source rules and roster with the imported JSON? Current battle progress will be preserved where possible. Export a backup first.'))return;
  state=await importTeamPack(pack,{replaceExisting:true});
 }
 S.data=state;S.selected=state.catalog.operatives[0].id;S.editorId=S.selected;S.teams=await listTeams();goto('dashboard');toast('Team pack installed: '+pack.team.name);
 }catch(error){toast(error.message,true)}}
function chooseTeamFile(){const file=document.createElement('input');file.type='file';file.accept='.json,application/json';file.onchange=()=>importPackFile(file.files[0]);file.click()}
function renderDashboard(){
 const c=S.data.catalog,b=S.data.battle,ops=c.operatives,alive=ops.filter(o=>b.ops[o.id].wounds>0).length,
 inspired=ops.filter(o=>b.ops[o.id].inspiring&&b.ops[o.id].wounds>0).length,
 activeResources=Object.values(b.resources).filter(x=>x.active).length,
 pending=b.pending_martyrdom||[];
 return header(c.team.name,"Fixed roster · live battle state · offline on this device",
  btn("↻ NEXT TURN","next-turn","btn-primary")+btn("↶ UNDO","undo","btn-ghost")+
  btn("NEW BATTLE","new-battle","btn-outline"))+
  (pending.length?`<div class="alert danger"><b>MARTYRDOM TRIGGERED:</b> ${pending.map(id=>E(opBy(id)?.name||id)).join(", ")} was Inspiring when incapacitated. Resolve a Benediction on an eligible surviving operative. <button class="read-link" data-action="benediction">CHOOSE BENEDICTION ↗</button></div>`:"")+
 `<div class="grid stats-grid">
  ${stat("OPERATIVES ALIVE",String(alive).padStart(2,"0"),"/ "+String(ops.length).padStart(2,"0"))}
  ${stat("INSPIRING",String(inspired).padStart(2,"0"),"OPERATIVES",true)}
  ${stat("TURNING POINT",String(b.turn).padStart(2,"0"),"/ "+c.team.max_turn)}
  ${stat("ACTIVE PLOYS",String(activeResources).padStart(2,"0"),"EFFECTS",true)}
 </div>`+
 sec("TACTICAL ROSTER",ops.length+" FIXED OPERATIVES")+
 `<div class="roster-grid">${ops.map(operativeTile).join("")}</div>`+
 `<div class="dashboard-lower"><div>${sec("ACTIVE STRATEGY EFFECTS")}<div class="panel">`+
 [...c.resources.strategy,...c.resources.firefight].filter(r=>b.resources[r.id]?.active)
 .map(r=>`<div class="resource-row"><div><strong>${E(r.name)}</strong><small>Active since TP ${b.resources[r.id].active_turn} · ${E(r.duration)}</small></div>${btn("DETAILS","detail-resource","btn-small",`data-id="${r.id}"`)}</div>`).join("")+
 (!Object.values(b.resources).some(x=>x.active)?`<p class="muted small">No time-limited ploys active. Select PLOYS & RULES to activate one.</p>`:"")+
 `</div></div><div>${sec("COMMAND NOTICES")}<div class="panel"><p class="small muted">Rule effects that depend on distance, enemy keywords, dice results, or table positioning still require your confirmation. Calculable changes are applied automatically.</p>${btn("MANAGE PLOYS","nav","btn-outline",`data-page="resources"`)}
 <div class="divider"></div><div class="small muted">LATEST ACTION</div><p class="small">${E(S.data.log[0]?.label||"Awaiting your first battle action.")}</p>
 ${btn("VIEW LOG","nav","btn-small",`data-page="log"`)}</div></div></div>`;
}
function stat(label,num,unit,accent=false){return `<div class="stats-card"><div class="label">${label}</div><div class="stat-number ${accent?"accent":""}">${E(num)}</div><div class="stat-unit">${E(unit)}</div></div>`}
function renderRoster(){
 return header("OPERATIVE ROSTER","Your fixed team roster. Select an operative to open their interactive datacard.",
  btn("EDIT BASE STATS","nav","btn-outline",`data-page="editor"`))+
  `<div class="roster-grid">${S.data.catalog.operatives.map(operativeTile).join("")}</div>`;
}
function renderDetail(){
 const op=opBy(S.selected);if(!op)return "<p>Operative not found.</p>";
 const b=S.data.battle.ops[op.id],eff=S.data.computed[op.id],max=eff.wounds,pct=Math.max(0,100*b.wounds/Math.max(1,max));
 const woundColour=b.wounds<=0?"tag-red":b.wounds<max?"tag-orange":"tag-ok";
 const counterAbility=op.abilities.find(a=>a.action?.type==="increment_counter");
 const hasNull=Boolean(counterAbility);
 const conditionFlags=["suffering","unshakeable","holy_resilience"].filter(f=>b.flags[f]);
 const activeBenedictions=b.benedictions||[];
 const specialAct=a=>{
   const type=a.action?.type||"mark_use";
   if(type==="increment_counter")return btn("PERFORM "+a.name+" · "+a.cost_ap+" AP","ability-use","btn-primary",`data-id="${E(a.id)}"`);
   if(type==="inspire_target"||type==="transfer_inspiration_benediction")return btn("ACTIVATE & CHOOSE TARGET","ability-target","btn-outline",`data-id="${E(a.id)}"`);
   return a.cost_ap>0?btn("MARK USED ("+a.cost_ap+" AP)","ability-use","btn-outline",`data-id="${E(a.id)}"`):
      (a.limit!=="none"?btn("MARK USED","ability-use","btn-outline",`data-id="${E(a.id)}"`):"");
 };
 return header(op.name,op.keywords.join(" · "),
   btn("← ROSTER","nav","btn-ghost",`data-page="operatives"`)+btn("EDIT DATACARD","edit-op","btn-outline",`data-id="${op.id}"`))+
 `<div class="datacard">
  <div class="datacard-top"><div class="datacard-head"><h2>${E(op.name)}</h2><p>${E(op.lore)}</p></div>
  ${cardStat("APL",eff.apl,"▽")}${cardStat("MOVE",eff.move+'"',"➤")}${cardStat("SAVE",eff.save+"+","⬡")}
  ${cardStat("WOUNDS",b.wounds+" / "+max,"♦")}</div>
  <div class="datacard-middle"><div style="overflow-x:auto"><table class="weapon-table"><thead><tr><th>WEAPON</th><th>ATK</th><th>HIT</th><th>DMG</th><th>WEAPON RULES / ACTIVE EFFECTS</th></tr></thead>
  <tbody>${eff.weapons.map(w=>`<tr><td>${w.kind==="ranged"?"◬":"⚔"} ${E(w.name)}</td><td>${E(w.atk)}</td><td>${E(w.hit)}</td><td>${w.damage_normal}/<span class="${(w.damage_crit!==op.weapons.find(z=>z.id===w.id)?.damage_crit)?"modified":""}">${w.damage_crit}</span></td>
  <td>${w.rules_list.map(x=>`<span class="${["Severe","Ceaseless","Balanced","Relentless"].includes(x)?"modified":""}" title="Select a keyword to look up its full rule">${E(x)}</span>`).join(" · ")}</td></tr>`).join("")}</tbody></table></div></div>
  <div class="datacard-bottom"><span><b>${E(op.keywords[0]||S.data.catalog.team.name)}</b> · ${E(op.keywords.slice(1).join(" · "))}</span><span>Ø ${op.base_mm}mm</span></div>
 </div>
 <div class="op-controls">
  <div class="control-card"><h3>♦ WOUNDS</h3><div class="big-counter"><strong>${b.wounds} <span class="muted small">/ ${max}</span></strong><div class="buttons-inline">${btn("−1","damage","btn-square",`data-id="${op.id}"`)}${btn("+1","heal","btn-square",`data-id="${op.id}"`)}</div></div>
  <div class="progress"><i style="width:${pct}%"></i></div><div class="buttons-inline">${btn("−3 DAMAGE","damage","btn-small",`data-id="${op.id}" data-amount="3"`)}${btn("+3 HEAL","heal","btn-small",`data-id="${op.id}" data-amount="3"`)}</div>
  </div>
  <div class="control-card"><h3>⚡ ACTION POINTS</h3><div class="big-counter"><strong>${eff.ap_remaining} <span class="muted small">/ ${eff.apl}</span></strong><div class="buttons-inline">
  ${btn("−","spend-ap","btn-square",`data-id="${op.id}" data-amount="1"`)}${btn("+","spend-ap","btn-square",`data-id="${op.id}" data-amount="-1"`)}</div></div>
  <div class="buttons-inline" style="margin-top:13px">${btn("CHARGE · −1 AP","charge","btn-small btn-primary",`data-id="${op.id}"`)}${btn(b.activated?"MARK READY":"MARK ACTIVATED","activate","btn-small",`data-id="${op.id}"`)}</div></div>
  <div class="control-card"><h3>✦ STATUS & ORDER</h3><div class="pill-list">${pill(b.wounds<=0?"INCAPACITATED":b.inspiring?"INSPIRING":"NORMAL",woundColour)}${b.activated?pill("ACTIVATED"):""}${activeBenedictions.map(x=>pill(x,"tag-orange")).join("")}</div>
  <div class="buttons-inline" style="margin-top:13px">${btn(b.inspiring?"REMOVE INSPIRING":"BECOME INSPIRING","inspire","btn-small",`data-id="${op.id}"`)}
  ${btn(b.order==="engage"?"ENGAGE ●":"ENGAGE","order","btn-small "+(b.order==="engage"?"active":""),`data-id="${op.id}" data-value="engage"`)}
  ${btn(b.order==="conceal"?"CONCEAL ●":"CONCEAL","order","btn-small "+(b.order==="conceal"?"active":""),`data-id="${op.id}" data-value="conceal"`)}</div></div>
 </div>
 ${hasNull?`<div class="panel"><div class="section-title" style="margin:0 0 8px"><h2>${E(counterAbility.name.toUpperCase())}</h2><span class="count">${b[counterAbility.action.counter]??0} / ${counterAbility.action.max}</span></div>
  <p class="small muted">${E(counterAbility.description)} Confirm tabletop restrictions before activating.</p>
  <div class="pill-list">${Array.from({length:counterAbility.action.max},(_,i)=>i+1).map(i=>pill(i+'"',i<=(b[counterAbility.action.counter]??0)?"tag-orange":"tag-muted")).join("")}</div>
  <div class="action-band">${btn(E(counterAbility.name)+" · "+counterAbility.cost_ap+" AP","ability-use","btn-primary",`data-id="${E(counterAbility.id)}"`)}</div></div>`:""}
 ${sec("BENEDICTIONS & CONDITIONS")}${activeBenedictions.length||conditionFlags.length?
 `<div class="panel pill-list">${activeBenedictions.map(x=>pill(x,"tag-orange")).join("")}${conditionFlags.map(x=>pill(x,"tag-orange")).join("")}</div>`:
 `<div class="panel small muted">No additional conditions active. Benedictions automatically update the stat block above.</div>`}
 <div class="action-band">${S.data.catalog.resources.benedictions.length?btn("✦ GRANT BENEDICTION","benediction","btn-outline",`data-id="${op.id}"`):""}
 ${btn("CONDITIONAL EFFECTS","conditions","btn-ghost",`data-id="${op.id}"`)}
 ${(b.flags.fervent||b.flags.unshakeable)?btn("END SEQUENCE / EFFECT","end-sequence","btn-small",`data-id="${op.id}"`):""}</div>
 ${sec("OPERATIVE ABILITIES",String(op.abilities.length).padStart(2,"0")+" RECORDS")}
 ${op.abilities.map(a=>`<div class="rule-block"><div class="res-heading"><h4>${E(a.name)}${a.cost_ap?` <span class="orange">· ${a.cost_ap} AP</span>`:""}</h4>
 ${a.limit!=="none"?pill(a.limit==="turn"?(b.abilities_used[a.id]===S.data.battle.turn?"USED THIS TP":"ONCE / TP"):(b.abilities_used[a.id]?"USED":"ONCE / BATTLE")):""}</div>
 <p>${E(a.description)}</p><div class="buttons-inline">${specialAct(a)}</div></div>`).join("")}
 <div class="alert">Stat modifications marked in orange are computed from the current battle state. Attack eligibility, range, line of sight, and dice outcomes must still be determined at the table.</div>`;
}
function cardStat(label,value,symbol){return `<div class="datacard-stat"><small>${E(label)}</small><b><span>${E(symbol)}</span> ${E(value)}</b></div>`}

function renderResources(which){
 const section=which||"strategy";const c=S.data.catalog,b=S.data.battle;
 const allTabs=[["strategy","STRATEGY PLOYS"],["firefight","FIREFIGHT PLOYS"],["faction","FACTION RULES"],["equipment","EQUIPMENT"]];
 const sectionDesc={strategy:"Team-wide tactical effects paid for with command points.",firefight:"Conditional plays used in shooting, fighting and operative activations.",faction:"Persistent faction mechanics and Benedictions.",equipment:"Track equipped gear, charges, consumables and once-per-battle resources."};
 const nav=section!=="equipment"?`<div class="rule-tabs">${allTabs.map(([id,t])=>`<button class="tab ${section===id?"active":""}" data-tab="${id}">${t}</button>`).join("")}</div>`:"";
 return header(section==="equipment"?"EQUIPMENT":"PLOYS & FACTION RULES",sectionDesc[section],
   btn("OPEN EDITOR","edit-kind","btn-outline",`data-kind="${section}"`))+
   nav+
   (section==="faction"?`<div class="panel"><div class="section-title" style="margin:0 0 8px"><h2>BENEDICTIONS</h2></div>
       <p class="muted small">Select an operative to apply an available Benediction. The rules engine updates supported stats automatically.</p>
       <div class="action-band">${btn("GRANT BENEDICTION","benediction","btn-primary")}</div>
       <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(185px,1fr))">${c.resources.benedictions.map(x=>`<div class="rule-block"><h4>${E(x.name)}</h4><p>${E(x.description)}</p></div>`).join("")}</div></div>`:"")+
   `<div class="resource-grid">${c.resources[section].map(r=>renderResCard(r,section)).join("")}</div>`;
}
function renderResCard(r,section){
 const rs=S.data.battle.resources[r.id]||{used_battle:0,used_turn:0,active:false};
 const remaining=S.data.remaining[r.id];
 const usage=remaining===null?"UNLIMITED":`${remaining} / ${section==="equipment"?r.quantity:r.max_uses}`;
 const isGear=section==="equipment",selected=!isGear||r.equipped;
 const isPassive=section==="faction", canUse=!isPassive&&selected&&(remaining===null||remaining>0);
 const active=rs.active;
 return `<article class="res-card ${active?"active":""} ${isGear&&r.equipped?"equipped":""}">
 <div class="res-heading"><div><div class="kicker">${section.toUpperCase()} ${r.cost_cp?`· ${r.cost_cp} CP`:""}</div><h3>${E(r.name)}</h3></div>
 ${active?pill("ACTIVE","tag-orange"):isGear?pill(selected?"SELECTED":"NOT SELECTED",selected?"tag-ok":"tag-muted"):pill(isPassive?"PASSIVE":"READY")}</div>
 <p>${E(trim(r.description,176))}</p>
 <div class="res-meta">${pill(`RESET: ${String(r.reset).toUpperCase()}`)}${pill(`DURATION: ${String(r.duration).toUpperCase()}`)}${!isPassive?pill(`USES: ${usage}`):""}</div>
 <div class="divider"></div><div class="res-actions">
 ${btn("RULE DETAILS","detail-resource","btn-small",`data-id="${E(r.id)}"`)}
 ${!isPassive?btn(isGear?"USE EQUIPMENT":`ACTIVATE · ${r.cost_cp} CP`,"use-resource","btn-primary btn-small",`data-id="${E(r.id)}" ${canUse?"":"disabled"}`):""}
 ${!isPassive&&selected&&remaining!==null?`${btn("−","adjust-resource","btn-small btn-square",`data-id="${E(r.id)}" data-step="-1"`)}<span class="counter">${remaining} LEFT</span>${btn("+","adjust-resource","btn-small btn-square",`data-id="${E(r.id)}" data-step="1"`)}`:""}
 ${active?btn("END EFFECT","toggle-resource","btn-small",`data-id="${E(r.id)}"`):""}
 ${btn("EDIT","edit-resource","btn-small",`data-id="${E(r.id)}"`)}</div></article>`;
}
function renderLog(){
 return header("BATTLE LOG","Every tracked action is logged with a one-click undo for the latest change.",
 btn("↶ UNDO LAST ACTION","undo","btn-primary")+
 btn("EXPORT BACKUP","export","btn-outline")+
 btn("NEW BATTLE","new-battle","btn-ghost"))+
 `<div class="panel"><h3>RECENT ACTIONS</h3><div class="log-list">${S.data.log.length?S.data.log.map(l=>`<div class="log-line"><span>${E(l.label)}</span><time>${E(l.at.slice(0,16).replace("T"," "))} UTC</time></div>`).join(""):`<p class="muted">No actions recorded yet.</p>`}</div></div>
 <div class="alert">Undo restores the battle state before the last tracked action. Catalog edits are saved immediately and are not rolled back by battle undo. Export a JSON backup before making major roster changes.</div>`;
}
function field(label,name,value,type="text",extra=""){
 const val=value===null||value===undefined?"":value;
 return `<div class="field"><label for="fld-${E(name)}">${E(label)}</label>${type==="textarea"?
 `<textarea id="fld-${E(name)}" name="${E(name)}" rows="4" ${extra}>${E(val)}</textarea>`:
 `<input id="fld-${E(name)}" name="${E(name)}" type="${E(type)}" value="${escAttr(val)}" ${extra}>`}</div>`;
}
function selectedEditorData(){
 if(S.editorKind==="operative")return opBy(S.editorId)||S.data.catalog.operatives[0];
 return S.data.catalog.resources[S.editorKind]?.find(x=>x.id===S.editorId);
}
function editNav(kind,id){
 S.editorKind=kind;S.editorId=id||(kind==="operative"?S.data.catalog.operatives[0]?.id:S.data.catalog.resources[kind][0]?.id);
 S.editorNew=false;goto("editor");
}
function renderEditor(){
 const kinds=[["operative","OPERATIVES"],["strategy","STRATEGY"],["firefight","FIREFIGHT"],["faction","FACTION"],["equipment","EQUIPMENT"]];
 const current=selectedEditorData();
 const opts=S.editorKind==="operative"?S.data.catalog.operatives:S.data.catalog.resources[S.editorKind];
 return header("ROSTER EDITOR","Edit weapon profiles, rule text, AP/CP costs, durations, use limits and quantities. All changes persist on this device.",
 btn("EXPORT BACKUP","export","btn-outline")+btn("IMPORT BACKUP","import","btn-ghost"))+
 `<div class="rule-tabs">${kinds.map(([k,name])=>`<button class="tab ${S.editorKind===k?"active":""}" data-editor-kind="${k}">${name}</button>`).join("")}</div>
 <div class="editor-shell">
  <div class="editor-picker">
   ${opts.map(x=>`<button type="button" class="${S.editorId===x.id&&!S.editorNew?"active":""}" data-editor-select="${E(x.id)}">${E(x.name)}</button>`).join("")}
   ${S.editorKind!=="operative"?`<button type="button" class="${S.editorNew?"active":""}" data-action="new-resource">＋ NEW ENTRY</button>`:""}
  </div>
  <div class="panel">${S.editorNew?editorNewForm():S.editorKind==="operative"?editorOpForm(current):editorResForm(current)}</div>
 </div>
 <div class="action-band">${btn("EXPORT ALL DATA","export","btn-small")}${btn("IMPORT RESTORE FILE","import","btn-small")}</div>
 <div class="alert">Editor settings change your permanent roster catalog. During a battle, wounds, AP, Inspiring, equipment uses and active buffs are stored separately. This is how we avoid accidentally rewriting the rules every time someone gets punched by a power sword.</div>`;
}
function editorOpForm(o){
 if(!o)return "<p>Unknown operative.</p>";
 return `<form id="editor-form" data-edit="operative">
 <div class="section-title" style="margin:0 0 12px"><h2>${E(o.name)}</h2><span class="count">FIXED OPERATIVE</span></div>
 <div class="form-grid">${field("Display name","name",o.name)}${field("Base size (mm)","base_mm",o.base_mm,"number","min=1 max=100")}</div>
 ${field("Background / flavour text","lore",o.lore,"textarea")}
 ${field("Keywords (comma separated)","keywords",o.keywords.join(", "))}
 ${sec("BASE STATS")}
 <div class="form-grid">${field("APL","apl",o.base.apl,"number","min=1 max=99")}${field('Move (inches)',"move",o.base.move,"number","min=1 max=99")}
 ${field("Save target","save",o.base.save,"number","min=1 max=99")}${field("Maximum wounds","wounds",o.base.wounds,"number","min=1 max=99")}</div>
 ${sec("WEAPON PROFILES",String(o.weapons.length))}
 ${o.weapons.map((w,i)=>`<div class="weapon-editor"><div class="weapon-fields">
 ${field("Weapon name",`w${i}_name`,w.name)}${field("ATK",`w${i}_atk`,w.atk,"number","min=0 max=99")}
 ${field("HIT",`w${i}_hit`,w.hit)}${field("NORMAL DMG",`w${i}_damage_normal`,w.damage_normal,"number","min=0 max=99")}
 ${field("CRIT DMG",`w${i}_damage_crit`,w.damage_crit,"number","min=0 max=99")}</div>
 ${field("Weapon rules",`w${i}_rules`,w.rules)}
 ${field("Type (ranged or melee)",`w${i}_kind`,w.kind)}</div>`).join("")}
 ${sec("ABILITIES",String(o.abilities.length))}
 ${o.abilities.map((a,i)=>`<div class="weapon-editor"><div class="form-grid">${field("Ability name",`a${i}_name`,a.name)}${field("AP cost",`a${i}_cost_ap`,a.cost_ap,"number","min=0 max=9")}</div>
 ${field("Complete description",`a${i}_description`,a.description,"textarea")}</div>`).join("")}
 <div class="action-band"><button type="submit" class="btn btn-primary">SAVE DATACARD CHANGES</button></div></form>`;
}
function editorResForm(r){
 if(!r)return "<p>No entry in this category.</p>";
 const gear=S.editorKind==="equipment";
 return `<form id="editor-form" data-edit="resource">
 <div class="section-title" style="margin:0 0 12px"><h2>${E(r.name)}</h2></div>
 ${field("Rule / Equipment name","name",r.name)}
 ${field("Short introduction / flavour","lore",r.lore||"","textarea")}
 ${field("Full official rule / editable details","description",r.description,"textarea")}
 <div class="form-grid">${field("CP cost","cost_cp",r.cost_cp,"number","min=0 max=99")}
 ${field(gear?"Starting quantity / charges":"Maximum uses (blank = unlimited)","limit",gear?r.quantity:r.max_uses,"number",gear?"min=-1 max=999":"min=0 max=999")}
 <div class="field"><label>Reset counter</label><select name="reset"><option value="turn" ${r.reset==="turn"?"selected":""}>Every turning point</option><option value="battle" ${r.reset==="battle"?"selected":""}>Every battle</option><option value="manual" ${r.reset==="manual"?"selected":""}>Manual only</option></select></div>
 <div class="field"><label>Effect duration</label><select name="duration">${["instant","turn","battle","passive"].map(x=>`<option value="${x}" ${r.duration===x?"selected":""}>${x}</option>`).join("")}</select></div></div>
 ${gear?`<label class="check-row"><input type="checkbox" name="equipped" ${r.equipped?"checked":""}> Select this equipment for battle</label>
 <p class="small muted">Equipment that isn't selected remains in the catalog, but cannot be used in Battle Mode.</p>`:""}
 <div class="action-band"><button type="submit" class="btn btn-primary">SAVE RULE CHANGES</button>${btn("DETAILS","detail-resource","btn-outline",`data-id="${r.id}"`)}</div>
 </form>`;
}
function editorNewForm(){
 return `<form id="editor-form" data-edit="new">
 <h2>NEW ${E(S.editorKind.toUpperCase())} ENTRY</h2>
 <p class="small muted">Add an extra custom rule or item to this fixed Kill Team.</p>
 ${field("Name","name","")}${field("Description","description","","textarea")}${field("CP cost","cost_cp",0,"number","min=0 max=99")}
 ${field(S.editorKind==="equipment"?"Quantity":"Maximum uses (blank=unlimited)","limit",S.editorKind==="equipment"?1:"","number","min=0 max=999")}
 <button class="btn btn-primary" type="submit">ADD TO CATALOG</button></form>`;
}
function saveEditor(form){
 const fd=new FormData(form),get=k=>String(fd.get(k)||"").trim(),toInt=(k,fallback)=>Number.isFinite(Number(get(k)))&&get(k)!==""?Math.trunc(Number(get(k))):fallback;
 const cloned=JSON.parse(JSON.stringify(S.data.catalog));
 if(S.editorNew){
  if(!get("name"))return toast("Entry needs a name.",true);
  const kind=S.editorKind, id=`custom_${kind}_${Date.now()}`;
  cloned.resources[kind].push({id,name:get("name"),lore:"",description:get("description"),category:kind,
   cost_cp:toInt("cost_cp",0),max_uses:kind==="equipment"?null:(get("limit")===""?null:toInt("limit",null)),
   quantity:kind==="equipment"?toInt("limit",1):0,equipped:kind!=="equipment",
   reset:"battle",duration:"instant"});
  S.editorNew=false;S.editorId=id;
 }else if(S.editorKind==="operative"){
  const o=cloned.operatives.find(o=>o.id===S.editorId);
  o.name=get("name");o.lore=get("lore");o.base_mm=toInt("base_mm",32);
  o.keywords=get("keywords").split(",").map(x=>x.trim()).filter(Boolean);
  for(const k of ["apl","move","save","wounds"])o.base[k]=toInt(k,o.base[k]);
  o.weapons.forEach((w,i)=>{for(const k of ["name","hit","rules","kind"])w[k]=get(`w${i}_${k}`);
    for(const k of ["atk","damage_normal","damage_crit"])w[k]=toInt(`w${i}_${k}`,w[k]);});
  o.abilities.forEach((a,i)=>{for(const k of ["name","description"])a[k]=get(`a${i}_${k}`);a.cost_ap=toInt(`a${i}_cost_ap`,0)});
 }else{
  const r=cloned.resources[S.editorKind].find(r=>r.id===S.editorId);
  r.name=get("name");r.lore=get("lore");r.description=get("description");r.cost_cp=toInt("cost_cp",0);
  r.reset=get("reset")||"battle";r.duration=get("duration")||"instant";
  if(S.editorKind==="equipment"){r.quantity=toInt("limit",1);r.equipped=fd.has("equipped")}
  else r.max_uses=get("limit")===""?null:toInt("limit",null);
 }
 update("/api/catalog","PUT",{catalog:cloned},"Catalog saved offline");
}

function selectHTML(id,options,selected){
 return `<select id="${E(id)}">${options.map(o=>`<option value="${E(o.value)}" ${o.value===selected?"selected":""}>${E(o.label)}</option>`).join("")}</select>`}
function pop(title,body,actions=""){
 S.modal={title,body,actions};renderModal();
}
function renderModal(){
 const m=S.modal;
 if(!m){$("modal-root").hidden=true;return;}
 $("modal-root").hidden=false;
 $("modal-root").innerHTML=`<div class="modal" role="dialog" aria-modal="true" aria-label="${E(m.title)}">
 <div class="modal-head"><h2>${E(m.title)}</h2><button class="modal-close" data-action="close-modal" aria-label="Close">×</button></div>
 <div class="modal-body">${m.body}</div><div class="modal-actions">${m.actions||btn("CLOSE","close-modal")}</div></div>`;
}
function closeModal(){S.modal=null;$("modal-root").hidden=true;$("modal-root").innerHTML="";}
function detailResource(id){
 const r=resBy(id);if(!r)return;
 pop(r.name,`<div class="kicker">${E(r.category.toUpperCase())} // ${E(r.cost_cp)} COMMAND POINTS</div>
 ${r.lore?`<p class="small muted" style="font-style:italic">${E(r.lore)}</p>`:""}
 <p class="rule-description">${E(r.description)}</p>
 <div class="divider"></div><div class="pill-list">${pill("RESET: "+r.reset)}${pill("DURATION: "+r.duration)}
 ${r.category==="equipment"?pill("QTY: "+(r.quantity===-1?"UNLIMITED":r.quantity)):""}</div>`,
 btn("CLOSE","close-modal")+btn("EDIT RULE","edit-resource","btn-outline",`data-id="${E(r.id)}"`)
 +(r.category!=="faction"?btn("ACTIVATE / USE","use-resource","btn-primary",`data-id="${E(r.id)}"`):""));
}
function benModal(defaultId=null){
 const options=S.data.catalog.operatives.filter(o=>S.data.battle.ops[o.id].wounds>0).map(o=>({label:o.name,value:o.id}));
 if(!options.length)return toast("No surviving operatives are available.",true);
 const sourceOptions=[{label:"Manual grant / Speak of Her Deeds",value:""},
  ...(S.data.battle.pending_martyrdom||[]).map(id=>({label:"Martyrdom: "+opBy(id)?.name,value:id}))];
 const blessings=S.data.catalog.resources.benedictions;
 if(!blessings.length)return toast("This team has no Benedictions.",true);
 pop("GRANT BENEDICTION",`<p class="small muted">Ardour changes APL immediately; Wrath adds Ceaseless; Restoration rolls D3+2 and heals; Exigence records a free movement action. Check the Martyrdom eligibility range on the tabletop.</p>
 <div class="field"><label>Recipient</label>${selectHTML("ben-target",options,defaultId||options[0].value)}</div>
 <div class="field"><label>Benediction</label>${selectHTML("ben-choice",blessings.map(x=>({label:x.name+" · "+trim(x.description,85),value:x.name})),"Ardour")}</div>
 <div class="field"><label>Trigger source</label>${selectHTML("ben-source",sourceOptions,sourceOptions.length>1?sourceOptions[1].value:"")}</div>
 <p class="small muted">If this came from the Denuncia's Speak of Her Deeds, use that operative ability instead so its Inspiring transfer is tracked correctly.</p>`,
 btn("CANCEL","close-modal")+btn("APPLY BENEDICTION","confirm-benediction","btn-primary"));
}
function resourceModal(id){
 const r=resBy(id);
 if(!r)return;
 if(r.category==="equipment"&&!r.equipped){return toast("Select this equipment in the Roster Editor first.",true)}
 const b=S.data.battle,ops=S.data.catalog.operatives.filter(x=>b.ops[x.id].wounds>0),
 needsTarget=["set_target_flag","roll_self_damage_inspire"].includes(r.action?.type);
 const discountOptions=[{label:"Normal CP cost",value:"none"}];
 for(const d of S.data.catalog.team.rules?.discounts||[]){
  const source=b.ops[d.operative];if(!source||source.wounds<=0||(d.requires_inspiring&&!source.inspiring)||d.category!==r.category||(d.resource_id&&d.resource_id!==r.id))continue;
  if(d.uses_per_turn&&source.abilities_used[d.tracked_ability]===b.turn)continue;
  discountOptions.push({label:d.label+": 0 CP ("+(d.description||"verify eligibility")+")",value:d.id});
 }
 const help=r.help||"Confirm eligible targets, range, line of sight, conditions, and dice results on the tabletop.";
 pop("ACTIVATE: "+r.name,`<p class="rule-description">${E(r.description)}</p>
 <div class="alert">${E(help)}</div>
 ${discountOptions.length>1?`<div class="field"><label>CP cost / discounts</label>${selectHTML("res-discount",discountOptions,"none")}</div>`:""}
 ${needsTarget?`<div class="field"><label>Selected operative</label>${selectHTML("res-target",ops.map(x=>({label:x.name,value:x.id})),ops[0]?.id)}</div>`:""}
 ${r.action?.mode_choices?.length?`<div class="field"><label>Enemy keyword context</label>${selectHTML("res-mode",[{label:"Non-IMPERIUM: Ceaseless",value:"ceaseless"},{label:"Enemy also CHAOS / PSYKER: Relentless",value:"relentless"}],"ceaseless")}</div>`:""}
 <p class="small muted">Current CP: ${b.cp} · Usage remaining: ${show(S.data.remaining[r.id])}</p>`,
 btn("CANCEL","close-modal")+btn("CONFIRM & APPLY","confirm-resource","btn-primary",`data-id="${E(id)}"`));
}
function conditionsModal(id){
 const o=opBy(id),b=S.data.battle.ops[id],conditions=S.data.catalog.team.rules?.conditions||[];
 pop("CONDITIONAL EFFECTS: "+o.name,`<p class="small muted">These conditions represent information you confirm on the physical tabletop. Temporary effects clear when you advance a turning point.</p>
 ${conditions.map(({id:f,label})=>`<label class="check-row" style="padding:9px 0">
 <input type="checkbox" data-set-flag="${f}" data-id="${id}" ${b.flags[f]?"checked":""}>
 ${E(label)}</label>`).join("")}
 <p class="small muted">Enemy-target-specific buffs and defensive effects remain contextual. The app doesn't pretend to track where your opponent's miniatures are.</p>`,
 btn("CLOSE","close-modal"));
}
function abilityTargetModal(abilityId){
 const op=opBy(S.selected),a=op.abilities.find(x=>x.id===abilityId);
 if(!a)return;
 const options=S.data.catalog.operatives.filter(x=>S.data.battle.ops[x.id].wounds>0).map(x=>({value:x.id,label:x.name}));
 let extra="";
 if(a.action?.type==="transfer_inspiration_benediction"){
   const inspired=options.filter(x=>S.data.battle.ops[x.value].inspiring);
   extra=`<div class="field"><label>Transfer inspiration FROM</label>${selectHTML("ability-source",inspired,"")}</div>
   <div class="field"><label>Benediction to grant</label>${selectHTML("ability-blessing",S.data.catalog.resources.benedictions.filter(x=>!a.action.excluded?.includes(x.name)).map(x=>({value:x.name,label:x.name})), "Wrath")}</div>`;
 }
 pop("USE: "+a.name,`<p class="rule-description">${E(a.description)}</p>${extra}
 <div class="field"><label>Target operative</label>${selectHTML("ability-target",options,options[0]?.value)}</div>
 <div class="alert">Check range, visibility and control range before confirming.</div>`,
 btn("CANCEL","close-modal")+btn("CONFIRM ABILITY","confirm-ability","btn-primary",`data-id="${E(abilityId)}"`));
}
async function exportData(){
 try{
  const exported=await api("/api/export");
  const blob=new Blob([JSON.stringify(exported,null,2)],{type:"application/json"});
  const url=URL.createObjectURL(blob),a=document.createElement("a");
  a.href=url;a.download=S.data.catalog.team.id+"-backup-"+new Date().toISOString().slice(0,10)+".json";document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),5000);
  toast("Full roster and battle backup exported");
 }catch(err){toast(err.message,true)}
}
async function importData(file){
 if(!file)return;
 try{
  const json=JSON.parse(await file.text());
  if(!confirm("Replace the current roster AND battle data with this backup? This cannot be undone."))return;
  if(await update("/api/import","POST",json,"Backup restored")){closeModal();goto("dashboard")}
 }catch(err){toast("Invalid backup: "+err.message,true)}
}
function askNewBattle(){
 pop("START A NEW BATTLE",`<p class="small">Reset wounds, action points, ploy uses, Inspiration, Benedictions and temporary effects. Your permanent roster and custom equipment setup will not change.</p>
 ${field("Name of next battle","new-battle-name","Battle "+new Date().toLocaleDateString())}`,
 btn("CANCEL","close-modal")+btn("RESET BATTLE","confirm-new-battle","btn-danger"));
}
async function clickAction(target){
 const action=target.dataset.action,id=target.dataset.id,amount=n(target.dataset.amount)||1;
 if(action==="nav")return goto(target.dataset.page);
 if(action==="import-team")return chooseTeamFile();
 if(action==="export-team"){try{return downloadJson(await exportCurrentPack(),S.data.catalog.team.id+'-team-pack.json')}catch(ex){return toast(ex.message,true)}}
 if(action==="switch-team"){try{const state=await switchTeam(id);S.data=state;S.selected=state.catalog.operatives[0].id;S.editorId=S.selected;S.editorKind='operative';goto('dashboard');return toast('Active team: '+state.catalog.team.name)}catch(ex){return toast(ex.message,true)}}
 if(action==="close-modal")return closeModal();
 if(action==="damage"||action==="heal")return act({type:action,id,amount});
 if(action==="spend-ap")return act({type:"spend_ap",id,amount:n(target.dataset.amount)});
 if(action==="activate")return act({type:"activate",id});
 if(action==="charge")return act({type:"charge",id});
 if(action==="inspire")return act({type:"inspire",id});
 if(action==="order")return act({type:"order",id,value:target.dataset.value});
 if(action==="nullify")return toast("Use the operative ability button.",true);
 if(action==="end-sequence")return act({type:"end_sequence",id});
 if(action==="adjust-resource"){
   const remaining=S.data.remaining[id];
   if(remaining===null)return toast("This entry has unlimited uses.",true);
   const max=(resBy(id)?.category==="equipment"?resBy(id).quantity:resBy(id)?.max_uses)||0;
   return act({type:"resource_adjust",id,remaining:Math.max(0,Math.min(max,remaining+n(target.dataset.step)))});
 }
 if(action==="next-turn")return act({type:"next_turn"},"Next turning point started");
 if(action==="undo")return update("/api/undo","POST",{},"Undid last battle action");
 if(action==="new-battle")return askNewBattle();
 if(action==="confirm-new-battle"){const name=$("fld-new-battle-name")?.value||"New Battle";closeModal();return update("/api/reset","POST",{name},"New battle started")}
 if(action==="benediction")return benModal(id);
 if(action==="confirm-benediction"){
  const data={type:"benediction",id:$("ben-target").value,name:$("ben-choice").value,source_id:$("ben-source").value};
  closeModal();return act(data);
 }
 if(action==="conditions")return conditionsModal(id);
 if(action==="ability-target")return abilityTargetModal(id);
 if(action==="ability-use"){return act({type:"ability",id:S.selected,ability_id:id})}
 if(action==="confirm-ability"){
  const data={type:"ability",id:S.selected,ability_id:id,recipient:$("ability-target")?.value,
  source:$("ability-source")?.value,benediction:$("ability-blessing")?.value};
  closeModal();return act(data);
 }
 if(action==="detail-resource")return detailResource(id);
 if(action==="use-resource")return resourceModal(id);
 if(action==="confirm-resource"){
  const data={type:"resource_use",id,discount:$("res-discount")?.value||"none",
  target:$("res-target")?.value,mode:$("res-mode")?.value};
  closeModal();return act(data);
 }
 if(action==="toggle-resource")return act({type:"resource_toggle",id});
 if(action==="edit-resource"){
  const r=resBy(id);closeModal();return editNav(r.category,id);
 }
 if(action==="edit-op")return editNav("operative",id);
 if(action==="edit-kind")return editNav(target.dataset.kind);
 if(action==="new-resource"){S.editorNew=true;S.editorId=null;return render();}
 if(action==="export")return exportData();
 if(action==="import"){
  const file=document.createElement("input");file.type="file";file.accept=".json,application/json";
  file.onchange=()=>importData(file.files[0]);file.click();return;
 }
}
document.addEventListener("click",async event=>{
 const nav=event.target.closest("[data-nav]");
 if(nav){goto(nav.dataset.nav);return}
 const open=event.target.closest("[data-open-op]");
 if(open){opOpen(open.dataset.openOp);return}
 const tab=event.target.closest("[data-tab]");
 if(tab){S.tab=tab.dataset.tab;goto("resources");return}
 const editKind=event.target.closest("[data-editor-kind]");
 if(editKind){S.editorKind=editKind.dataset.editorKind;S.editorNew=false;
 S.editorId=S.editorKind==="operative"?S.data.catalog.operatives[0]?.id:S.data.catalog.resources[S.editorKind][0]?.id;render();return}
 const editSelection=event.target.closest("[data-editor-select]");
 if(editSelection){S.editorId=editSelection.dataset.editorSelect;S.editorNew=false;render();return}
 const action=event.target.closest("[data-action]");
 if(action){event.preventDefault();await clickAction(action)}
});
document.addEventListener("submit",e=>{
 if(e.target.id==="editor-form"){e.preventDefault();saveEditor(e.target)}
});
document.addEventListener("change",async e=>{
 const el=e.target;
 if(el.matches("[data-set-flag]")){
   await act({type:"set_flag",id:el.dataset.id,flag:el.dataset.setFlag,value:el.checked});
   // Keep modal open with updated values.
   conditionsModal(el.dataset.id);
 }
});
$("cp-minus").addEventListener("click",()=>S.data?act({type:"set_cp",value:Math.max(0,S.data.battle.cp-1)}):toast("Import a team first.",true));
$("cp-plus").addEventListener("click",()=>S.data?act({type:"set_cp",value:S.data.battle.cp+1}):toast("Import a team first.",true));
$("next-turn-mini").addEventListener("click",()=>S.data?act({type:"next_turn"},"Next turning point started"):toast("Import a team first.",true));
$("turn-back").addEventListener("click",()=>toast("Use Undo in the battle log to reverse the latest turn."));
$("modal-root").addEventListener("click",e=>{if(e.target===$("modal-root"))closeModal()});
document.addEventListener("keydown",e=>{if(e.key==="Escape")closeModal()});
(async()=>{
 try{S.data=await initialize();S.teams=await listTeams();
 if(S.data){S.selected=S.data.catalog.operatives[0].id;S.editorId=S.selected;render();}
 else{$('content').innerHTML=`<div class="hero"><div><div class="kicker">OFFLINE DATASLATE</div><h1>INSTALL YOUR FIRST TEAM</h1><p class="subhead">This is the private deployment shell. Import a team pack JSON from the Files app. Your roster and battle data stay on this device.</p></div></div><div class="panel" style="max-width:680px"><h3>NO TEAM PACK INSTALLED</h3><p class="muted">Download your team pack file to your device, then tap Import Team Pack. It is never uploaded to a server.</p><button class="btn btn-primary" data-action="import-team">IMPORT TEAM PACK JSON</button></div>`;}
 
 if('serviceWorker' in navigator&&window.isSecureContext){navigator.serviceWorker.register('./service-worker.js').catch(err=>console.warn('Offline worker:',err));}
 }catch(ex){$('content').innerHTML=`<div class="alert danger">Cannot initialize offline data: ${E(ex.message)}<br>Open the hosted app over HTTPS once to install the bundled team data.</div>`;}
})();
