/* Shared, data-driven Kill Team battle engine. No DOM, network, or storage dependencies.
 * Rule text and faction-specific modifiers live in packs/*.json, not here.
 */
export class ActionError extends Error {}
const clone = x => structuredClone(x);
const fail = message => { throw new ActionError(message); };
const int = (v,lo=0,hi=999) => {
  if (typeof v === 'boolean' || v===null || v===undefined || String(v).trim()==='' || !Number.isInteger(Number(v))) fail('Expected a whole number.');
  const n=Number(v);if(n<lo||n>hi)fail(`Must be between ${lo} and ${hi}.`);return n;
};
const opGet=(c,b,id)=>{const op=c.operatives.find(x=>x.id===id),state=b.ops[id];if(!op||!state)fail('Unknown operative.');return [op,state]};
const resGet=(c,id)=>{for(const category of ['strategy','firefight','faction','equipment'])for(const r of c.resources[category])if(r.id===id)return [category,r];fail('Unknown resource.')};
const alive=s=>{if(s.wounds<=0)fail('Operative is incapacitated.');};
const rsGet=(b,id)=>b.resources[id]??(b.resources[id]={used_turn:0,used_battle:0,active:false,active_turn:null});
export function initialBattle(c){
 const ops={};for(const o of c.operatives){ops[o.id]={wounds:o.base.wounds,inspiring:false,activated:false,order:'engage',ap_spent:0,benedictions:[],abilities_used:{},flags:{},...clone(o.initial_state||{})}}
 return {turn:1,cp:c.team.start_cp??2,ops,resources:{},pending_martyrdom:[],notes:[],battle_name:'Battle 1',auto_success_turn:null};
}
export function remaining(c,b,r){const [cat]=resGet(c,r.id);const max=cat==='equipment'?r.quantity:r.max_uses;if(max===null||max===undefined||max===-1)return null;const s=b.resources[r.id]||{};const used=r.reset==='turn'?(s.used_turn||0):(s.used_battle||0);return Math.max(0,max-used)}
export function derived(op,s,b,c){
 const base=op.base, blessings=c.resources.benedictions||[];
 let apl=base.apl,move=base.move;
 for(const ben of blessings.filter(x=>s.benedictions.includes(x.name))){const m=ben.action?.modifier;if(m?.target==='operative'&&m.property==='apl')apl+=m.add||0;if(m?.target==='operative'&&m.property==='move')move+=m.add||0}
 for(const [name,mod] of Object.entries(c.team.rules?.flag_effects||{})){
  if(!s.flags[name]||mod.type!=='stat_modifier')continue;
  if(mod.when==='inspiring'&&!s.inspiring)continue;
  if(mod.stat==='move')move+=mod.add||0;
  if(mod.stat==='apl')apl+=mod.add||0;
 }
 const weapons=op.weapons.map(w=>{
  const rw={...w,rules_list:w.rules?w.rules.split(',').map(x=>x.trim()).filter(Boolean):[]};
  const addRule=r=>{if(r&&!rw.rules_list.includes(r))rw.rules_list.push(r)};
  if(s.inspiring)addRule(c.team.rules?.inspiration?.weapon_rule);
  for(const ben of blessings.filter(x=>s.benedictions.includes(x.name))){const m=ben.action?.modifier;if(m?.target==='weapons'&&m.add_rule)addRule(m.add_rule)}
  const sufferingId=c.team.rules?.suffering_resource_id;
  for(const cat of ['strategy','firefight','faction','equipment'])for(const r of c.resources[cat]){
   const effect=r.passive;if(!b.resources?.[r.id]?.active||effect?.type!=='weapon_rule')continue;
   if(effect.condition==='wounded_in_shoot_or_fight'&&s.wounds>=base.wounds)continue;
   addRule(effect.rule);
  }
  for(const [name,effect] of Object.entries(c.team.rules?.flag_effects||{})){
   if(!s.flags[name])continue;
   if(effect.type==='weapon_rule'&&(!effect.when||effect.when!=='wounded'||s.wounds<base.wounds))addRule(effect.rule);
   if(effect.type==='weapon_rule_by_value')addRule(effect.choices?.[s.flags[name]]);
  }
  for(const p of op.passives||[]){if(p.target!=='weapons')continue;if(p.when==='inspiring'&&!s.inspiring)continue;if(p.when_flag&&!s.flags[p.when_flag])continue;if(p.weapon_ids&&!p.weapon_ids.includes(w.id))continue;
   if(p.property&&Number.isFinite(p.add))rw[p.property]=(rw[p.property]||0)+p.add;
   if(p.add_rule)addRule(p.add_rule)
  }
  return rw;
 });
 return {...base,apl,move,ap_remaining:Math.max(0,apl-s.ap_spent),weapons,injured:s.wounds<base.wounds,incapacitated:s.wounds<=0};
}
const applyBlessing=(c,b,id,name,sourceId=null,rollFn=Math.random)=>{
 const [op,s]=opGet(c,b,id);alive(s);
 const ben=c.resources.benedictions.find(x=>x.name===name);if(!ben)fail('Unknown Benediction.');
 const a=ben.action||{type:'mark_use'};
 if((a.excluded_keywords||[]).some(x=>op.keywords.includes(x)))fail(`${op.name} cannot receive ${name}.`);
 let note='';
 if(a.type==='add_modifier'){
  if(s.benedictions.includes(name))fail('Benediction already active.');
  s.benedictions.push(name);
 }else if(a.type==='heal_roll'){
  const rolled=1+Math.floor(rollFn()*int(a.dice,1,100));const healing=rolled+int(a.bonus||0,0,99);
  s.wounds=Math.min(op.base.wounds,s.wounds+healing);note=` (healed ${healing}, now ${s.wounds})`;
 }else if(a.type==='manual_movement'){note=' (resolve permitted move on tabletop)';}
 if(sourceId&&b.pending_martyrdom.includes(sourceId))b.pending_martyrdom=b.pending_martyrdom.filter(x=>x!==sourceId);
 return `${op.name} received ${name}${note}`;
};
export function nextTurn(c,b){b.turn++;
 for(const s of Object.values(b.ops)){s.activated=false;s.ap_spent=0;for(const [key,definition] of Object.entries(s.flags)){
  const life=typeof definition==='object'?definition.duration:null;
  if((c.team.rules?.conditions||[]).some(x=>x.id===key&&['turn','activation','sequence'].includes(x.duration))||life==='turn'||life==='activation'||life==='sequence'||key==='fervent')delete s.flags[key];
 }}
 for(const cat of ['strategy','firefight','faction','equipment'])for(const r of c.resources[cat]){
  const rs=rsGet(b,r.id);rs.used_turn=0;if(r.duration==='turn'){rs.active=false;rs.active_turn=null}
 }
 return b;
}
export function applyAction(c,original,cmd,rollFn=Math.random){
 const b=clone(original),t=cmd?.type,id=cmd?.id;
 if(t==='set_cp'){b.cp=int(cmd.value);return [b,`CP set to ${b.cp}`]}
 if(t==='next_turn')return [nextTurn(c,b),`Turning point ${b.turn} started`];
 if(t==='set_turn'){const n=int(cmd.value,1,99);if(n<=b.turn)fail('Use Undo to reverse a turning point.');while(b.turn<n)nextTurn(c,b);return [b,`Advanced to turning point ${b.turn}`]}
 if(t==='battle_name'){b.battle_name=String(cmd.value||'New Battle').trim().slice(0,80);return [b,'Battle renamed']}
 if(t==='note'){const value=String(cmd.text||'').trim().slice(0,300);if(!value)fail('Empty note.');b.notes.unshift({turn:b.turn,text:value});return [b,'Battle note added']}
 if(['damage','heal','inspire','activate','order','spend_ap','charge','benediction','nullify','ability','set_flag','martyrdom','end_sequence'].includes(t)){
  const [op,s]=opGet(c,b,id),name=op.name;
  if(t==='damage'){const amount=int(cmd.amount??1,1,99),prior=s.wounds;s.wounds=Math.max(0,s.wounds-amount);
   if(prior>0&&s.wounds===0&&s.inspiring&&c.team.rules?.martyrdom?.enabled&&!b.pending_martyrdom.includes(id))b.pending_martyrdom.push(id);
   return [b,`${name} took ${prior-s.wounds} damage`];}
  if(t==='heal'){const amount=int(cmd.amount??1,1,99),prior=s.wounds;s.wounds=Math.min(op.base.wounds,s.wounds+amount);
   if(s.wounds>0)b.pending_martyrdom=b.pending_martyrdom.filter(x=>x!==id);
   return [b,`${name} recovered ${s.wounds-prior} wounds`];}
  if(t==='inspire'){const wanted=cmd.value===undefined?!s.inspiring:Boolean(cmd.value);if(wanted)alive(s);s.inspiring=wanted;return [b,`${name}: ${wanted?'INSPIRING':'inspiration removed'}`]}
  if(t==='activate'){alive(s);s.activated=cmd.value===undefined?!s.activated:Boolean(cmd.value);if(s.activated){for(const x of c.team.rules?.conditions||[])if(x.duration==='activation')delete s.flags[x.id];delete s.flags.fervent;}return [b,`${name}: ${s.activated?'activated':'ready'}`]}
  if(t==='order'){if(!['engage','conceal'].includes(cmd.value))fail('Invalid order.');s.order=cmd.value;return [b,`${name}: ${cmd.value.toUpperCase()} order`]}
  if(t==='spend_ap'){alive(s);const d=int(cmd.amount??1,-20,20),max=derived(op,s,b,c).apl;s.ap_spent=Math.max(0,Math.min(max,s.ap_spent+d));return [b,`${name}: ${derived(op,s,b,c).ap_remaining} AP remaining`]}
  if(t==='charge'){alive(s);if(derived(op,s,b,c).ap_remaining<1)fail('Not enough AP.');s.ap_spent++;
   if(c.team.rules?.inspiration?.on_charge)s.inspiring=true;
   return [b,`${name}: Charge (-1 AP)${s.inspiring?', INSPIRING':''}`]}
  if(t==='benediction')return [b,applyBlessing(c,b,id,cmd.name,cmd.source_id,rollFn)];
  if(t==='martyrdom'){b.pending_martyrdom=b.pending_martyrdom.filter(x=>x!==id);return [b,`Martyrdom prompt dismissed: ${name}`]}
  if(t==='end_sequence'){for(const x of c.team.rules?.conditions||[])if(['sequence','activation'].includes(x.duration))delete s.flags[x.id];delete s.flags.fervent;return [b,`${name}: sequence effects cleared`]}
  if(t==='set_flag'){const allowed=(c.team.rules?.conditions||[]).map(x=>x.id).concat(['fervent']);if(!allowed.includes(cmd.flag))fail('Unknown condition.');
   if(cmd.flag==='fervent'){if(!['','ceaseless','relentless'].includes(cmd.value))fail('Bad effect mode.');s.flags.fervent=cmd.value}
   else s.flags[cmd.flag]=Boolean(cmd.value);
   return [b,`${name}: ${cmd.flag} updated`];}
  // Legacy-compatible quick action: find the pack-defined increment-counter ability, not a hardcoded Censor.
  if(t==='nullify'){
   const ability=op.abilities.find(x=>x.action?.type==='increment_counter');if(!ability)fail('No counter action available.');
   return applyAction(c,b,{type:'ability',id,ability_id:ability.id},rollFn);
  }
  if(t==='ability'){
   alive(s);const a=op.abilities.find(x=>x.id===cmd.ability_id);if(!a)fail('Unknown ability.');
   if(a.limit==='turn'&&s.abilities_used[a.id]===b.turn)fail('Ability already used this turn.');
   if(a.limit==='battle'&&s.abilities_used[a.id])fail('Ability already used this battle.');
   const cost=int(a.cost_ap??0,0,9);if(derived(op,s,b,c).ap_remaining<cost)fail('Not enough AP.');
   const action=a.action||{type:'mark_use'};
   if(action.type==='increment_counter'){
    const old=s[action.counter]??action.min??0;if(old>=action.max)fail('Counter already at maximum.');s[action.counter]=Math.min(action.max,old+(action.by||1));
   }
   if(action.type==='inspire_target'){
    if(!cmd.recipient)fail('Select an operative to Inspire.');const [,target]=opGet(c,b,cmd.recipient);alive(target);target.inspiring=true;
   }
   if(action.type==='transfer_inspiration_benediction'){
    if(!cmd.source||!cmd.recipient||!cmd.benediction)fail('Choose source, recipient and Benediction.');
    const [,source]=opGet(c,b,cmd.source);alive(source);if(!source.inspiring)fail('The source is not Inspiring.');
    if(action.excluded?.includes(cmd.benediction))fail('That Benediction is excluded.');
    applyBlessing(c,b,cmd.recipient,cmd.benediction,null,rollFn);source.inspiring=false;
   }
   s.ap_spent+=cost;s.abilities_used[a.id]=a.limit==='battle'?true:b.turn;
   return [b,`${name} used ${a.name}${cmd.recipient?' on '+cmd.recipient:''}`];
  }
 }
 if(['resource_use','resource_adjust','resource_toggle'].includes(t)){
  const [cat,r]=resGet(c,id),rs=rsGet(b,id);
  if(t==='resource_adjust'){const value=int(cmd.remaining),max=cat==='equipment'?r.quantity:r.max_uses;
   if(max===null||max===-1||max===undefined)fail('This item is unlimited.');if(value>max)fail('Remaining exceeds configured maximum.');
   rs[r.reset==='turn'?'used_turn':'used_battle']=max-value;return [b,`${r.name}: ${value}/${max} remaining`];
  }
  if(t==='resource_toggle'){rs.active=!rs.active;rs.active_turn=rs.active?b.turn:null;return [b,`${r.name} ${rs.active?'activated':'ended'}`]}
  if(cat==='equipment'&&!r.equipped)fail('Select equipment in Editor before use.');
  const count=remaining(c,b,r);if(count!==null&&count<=0)fail('No uses remaining.');
  let cp=int(r.cost_cp||0,0,99),extra='';
  if(cmd.discount&&cmd.discount!=='none'){
   const d=(c.team.rules?.discounts||[]).find(x=>x.id===cmd.discount);if(!d)fail('Unknown discount.');
   const target=b.ops[d.operative];if(!target||target.wounds<=0||(d.requires_inspiring&&!target.inspiring)||d.category!==cat||(d.resource_id&&d.resource_id!==r.id))fail('Discount not available.');
   if(d.uses_per_turn&&target.abilities_used[d.tracked_ability]===b.turn)fail('Discount already used this turn.');
   if(d.uses_per_turn)target.abilities_used[d.tracked_ability]=b.turn;cp=0;
  }
  if(cp>b.cp)fail('Not enough CP.');
  const behavior=r.action||{type:'track'};
  if(['set_target_flag','roll_self_damage_inspire'].includes(behavior.type)){
   if(!cmd.target)fail('Select an operative.');const [target,ts]=opGet(c,b,cmd.target);alive(ts);
   if(behavior.type==='set_target_flag'){
    const v=behavior.mode_choices?cmd.mode||behavior.mode_choices[0]:true;
    if(behavior.mode_choices&&!behavior.mode_choices.includes(v))fail('Invalid effect mode.');ts.flags[behavior.flag]=v;extra=` on ${target.name}`;
   }else{
    if(behavior.only_one_success_per_turn&&b.auto_success_turn===b.turn)fail('This equipment already inspired an operative this turn.');
    const roll=1+Math.floor(rollFn()*(behavior.die||6)),damage=behavior.damage_rounding==='floor'?Math.floor(roll/(behavior.damage_divisor||2)):Math.ceil(roll/(behavior.damage_divisor||2)),before=ts.wounds;ts.wounds=Math.max(0,before-damage);
    if(before>0&&ts.wounds===0&&ts.inspiring&&c.team.rules?.martyrdom?.enabled&&!b.pending_martyrdom.includes(cmd.target))b.pending_martyrdom.push(cmd.target);
    if(roll>=(behavior.inspire_threshold||4)&&ts.wounds>0){ts.inspiring=true;b.auto_success_turn=b.turn}
    extra=` on ${target.name}: D6=${roll}, ${damage} damage${roll>=(behavior.inspire_threshold||4)&&ts.wounds>0?', now INSPIRING':''}`;
   }
  }
  b.cp-=cp;rs.used_turn++;rs.used_battle++;
  if(['turn','battle'].includes(r.duration)){rs.active=true;rs.active_turn=b.turn}
  return [b,`${r.name} used (-${cp} CP)${extra}`];
 }
 fail('Unsupported action.');
}
export function reconcileBattle(c,b){const fresh=initialBattle(c),out=clone(b);out.ops=out.ops||{};
 for(const op of c.operatives){if(!out.ops[op.id])out.ops[op.id]=fresh.ops[op.id];out.ops[op.id].wounds=Math.min(op.base.wounds,Math.max(0,out.ops[op.id].wounds));out.ops[op.id].flags||={};out.ops[op.id].abilities_used||={};out.ops[op.id].benedictions||=[];}
 for(const id of Object.keys(out.ops))if(!c.operatives.some(o=>o.id===id))delete out.ops[id];
 return out;
}
export function stateView(c,b,history=[]){const computed={},remain={};for(const o of c.operatives)computed[o.id]=derived(o,b.ops[o.id],b,c);
 for(const cat of ['strategy','firefight','faction','equipment'])for(const r of c.resources[cat])remain[r.id]=remaining(c,b,r);
 return {catalog:c,battle:b,computed,remaining:remain,log:history.slice(0,60).map(({at,label})=>({at,label})),server_version:'2.0-PWA'};
}
