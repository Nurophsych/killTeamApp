import {get,put} from './storage.js';
import {validatePack} from './pack.js';
import {initialBattle,applyAction,reconcileBattle,stateView} from './engine.js';
const copy=x=>structuredClone(x),stamp=()=>new Date().toISOString();
let currentTeam,loaded;
async function registry(){return (await get('team-registry'))||[]}
export async function listTeams(){return (await registry()).map(x=>copy(x))}
async function installTeam(pack,{replace=false}={}){
 validatePack(pack);
 const id=pack.team.id,current=await registry();
 if(current.some(x=>x.id===id)&&!replace)throw Error('This team ID already exists. Use a different ID or import a full backup.');
 await put('team:'+id,{catalog:copy(pack),battle:initialBattle(pack),history:[]});
 const next=current.filter(x=>x.id!==id).concat([{id,name:pack.team.name,short_name:pack.team.short_name||pack.team.name}]);
 await put('team-registry',next);return id;
}
export async function initialize(){
 let ids=await registry();if(!ids.length){
  const res=await fetch('./packs/index.json',{cache:'no-store'});if(!res.ok)throw Error('Bundled team index unavailable.');
  const index=await res.json();
  for(const filename of index.featured){const url='./packs/'+filename,res=await fetch(url);if(!res.ok)throw Error('Could not load '+filename);await installTeam(await res.json())}
  ids=await registry();
 }
 if(!ids.length){currentTeam=null;loaded=null;return null;}
 currentTeam=await get('active-team')||ids[0]?.id;
 if(!ids.some(x=>x.id===currentTeam))currentTeam=ids[0]?.id;
 await put('active-team',currentTeam);loaded=await get('team:'+currentTeam);
 if(!loaded)throw Error('Your selected team is missing. Restore a backup.');return snapshot();
}
export async function switchTeam(id){if(!(await registry()).some(x=>x.id===id))throw Error('Team not installed.');
 currentTeam=id;await put('active-team',id);loaded=await get('team:'+id);return snapshot()}
const snapshot=()=>stateView(loaded.catalog,loaded.battle,loaded.history);
async function save(){await put('team:'+currentTeam,loaded)}
async function mutate(path,method,body){
 if(!loaded)throw Error('Local database has not started.');
 if(path==='/api/state')return snapshot();
 if(path==='/api/export')return {format:'killteam-command-center-backup',version:2,catalog:copy(loaded.catalog),battle:copy(loaded.battle),team_id:currentTeam};
 if(path==='/api/action'&&method==='POST'){
  const [battle,label]=applyAction(loaded.catalog,loaded.battle,body);
  loaded.history.unshift({at:stamp(),label,before:copy(loaded.battle)});loaded.history=loaded.history.slice(0,100);loaded.battle=battle;await save();return snapshot();
 }
 if(path==='/api/undo'&&method==='POST'){
  const h=loaded.history.shift();if(!h)throw Error('Nothing to undo.');loaded.battle=h.before;await save();return snapshot();
 }
 if(path==='/api/reset'&&method==='POST'){
  loaded.history.unshift({at:stamp(),label:'New battle started',before:copy(loaded.battle)});loaded.history=loaded.history.slice(0,100);
  loaded.battle=initialBattle(loaded.catalog);loaded.battle.battle_name=String(body?.name||'New Battle').slice(0,80);await save();return snapshot();
 }
 if(path==='/api/catalog'&&method==='PUT'){
  validatePack(body.catalog);if(body.catalog.team.id!==currentTeam)throw Error('Cannot rename a team ID in the editor. Export it as a new team pack.');
  loaded.catalog=copy(body.catalog);loaded.battle=reconcileBattle(loaded.catalog,loaded.battle);await save();
  const teams=await registry();const item=teams.find(x=>x.id===currentTeam);if(item){item.name=loaded.catalog.team.name;await put('team-registry',teams)}return snapshot();
 }
 if(path==='/api/import'&&method==='POST'){
  if(body.format!=='killteam-command-center-backup'||!body.catalog||!body.battle)throw Error('Invalid backup file.');
  // Legacy backups lacked schema_version; assign after validating structure. This preserves the original catalog.
  const cat=copy(body.catalog);
  if(!cat.schema_version&&body.version===1){
   // Migrate v1 edited values while restoring generic rule descriptors from bundled v2.
   // Only the original team can be migrated this way, since its pack defines these IDs.
   const baseline=loaded.catalog;
   cat.schema_version=2;cat.team.rules=copy(baseline.team.rules||{});
   cat.team.short_name=baseline.team.short_name;
   for(const op of cat.operatives){
    const original=baseline.operatives.find(x=>x.id===op.id);
    if(!original)throw Error('Legacy backup has unknown operative '+op.id);
    op.initial_state=copy(original.initial_state||{});op.passives=copy(original.passives||[]);
    for(const a of op.abilities){const source=original.abilities.find(x=>x.id===a.id);a.action=copy(source?.action||{type:'mark_use'});}
   }
   for(const kind of ['strategy','firefight','faction','equipment','benedictions'])for(const item of cat.resources[kind]){
    const source=baseline.resources[kind].find(x=>x.id===item.id);
    if(source){if(source.action)item.action=copy(source.action);if(source.passive)item.passive=copy(source.passive);if(source.help)item.help=source.help}
   }
  }
  validatePack(cat);
  if(cat.team.id!==currentTeam)throw Error('Backup belongs to a different team. Import its team pack first and select that team.');
  loaded.catalog=cat;loaded.battle=reconcileBattle(cat,body.battle);loaded.history=[];await save();return snapshot();
 }
 throw Error('Unsupported local request: '+path);
}
// A familiar interface preserved from the v1 UI, but all actions are local IndexedDB transactions.
// Synchronous queue prevents double taps racing the same battle state.
let queue=Promise.resolve();
export function localAPI(path,method='GET',body){
 const pending=queue.then(()=>mutate(path,method,body));queue=pending.catch(()=>{});return pending;
}
export async function importTeamPack(pack,{replaceExisting=false}={}){
 validatePack(pack);
 const id=pack.team.id,already=(await registry()).some(x=>x.id===id);
 if(already){
  if(!replaceExisting)throw Error('TEAM_ALREADY_EXISTS');
  const old=await get('team:'+id);
  await put('team:'+id,{catalog:copy(pack),battle:reconcileBattle(pack,old.battle),history:old.history||[]});
  const r=await registry();const x=r.find(x=>x.id===id);x.name=pack.team.name;x.short_name=pack.team.short_name||pack.team.name;
  await put('team-registry',r);return switchTeam(id);
 }
 await installTeam(pack);return switchTeam(id);
}

export async function exportCurrentPack(){if(!loaded)throw Error('No team selected.');return copy(loaded.catalog)}
