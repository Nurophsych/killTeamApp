/* Stable portable team-pack JSON format. Any number of operatives, distinct team IDs. */
export function validatePack(pack){
 if(!pack||typeof pack!=='object'||Array.isArray(pack))throw Error('Team pack must be a JSON object.');
 if(pack.schema_version!==2)throw Error('This app needs schema_version: 2.');
 if(!pack.team||!(/^[a-z0-9][a-z0-9_-]{1,80}$/).test(pack.team.id||''))throw Error('Team requires a unique lowercase ID (letters, numbers, - or _).');
 if(typeof pack.team.name!=='string'||pack.team.name.length>100)throw Error('Team name is invalid.');
 if(!Array.isArray(pack.operatives)||!pack.operatives.length||pack.operatives.length>40)throw Error('Roster must contain 1 to 40 operatives.');
 const safeId=/^[A-Za-z0-9][A-Za-z0-9_-]{0,80}$/;
 const ids=new Set();for(const o of pack.operatives){
  if(!safeId.test(o.id||'')||ids.has(o.id)||typeof o.name!=='string')throw Error('Operative IDs must be unique and named.');ids.add(o.id);
  for(const k of ['apl','move','save','wounds'])if(!Number.isInteger(o.base?.[k])||o.base[k]<1||o.base[k]>99)throw Error(`Bad ${k} for ${o.id}`);
  if(!Array.isArray(o.weapons)||!Array.isArray(o.abilities))throw Error(`Missing weapons or abilities on ${o.id}`);
  for(const item of [...o.weapons,...o.abilities])if(!safeId.test(item.id||''))throw Error(`Invalid weapon or ability ID on ${o.id}`);
 }
 if(!pack.resources)throw Error('Missing team resources.');
 const resourceIds=new Set();for(const k of ['strategy','firefight','faction','equipment','benedictions']){
  if(!Array.isArray(pack.resources[k]))throw Error(`Missing ${k} list.`);
  for(const r of pack.resources[k]){if(!safeId.test(r.id||'')||resourceIds.has(r.id))throw Error(`Duplicate/invalid resource id: ${r.id}`);resourceIds.add(r.id)}
 }
 if(JSON.stringify(pack).length>2_000_000)throw Error('Team pack too large (2 MB limit).');
 return true;
}
