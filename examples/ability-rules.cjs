// Own mechanical adapter. Use explicit fields; never deep-merge untrusted keys.
'use strict';
function resolveAbility(a,enchanted=false){
 const e=enchanted?a.enchant||{}:{};
 const add=(base,delta)=>base==null?null:base+(delta??0);
 const extras=[...(a.rawEffects||[]),...(e.additional||[])];
 const tags=new Set(a.tags||[]);
 for(const x of e.additional||[]){const t=String(x.type||'unknown').toLowerCase();tags.add(t==='buff'&&x.ap<0?'debuff':t);}
 return {abilityId:a.id,enchanted,kind:a.kind,element:a.element,
 ap:add(a.ap,e.ap),accuracyPercent:add(a.accuracyPercent,e.accuracy),
 hits:add(a.hits,e.times),turns:add(a.turns,e.turns),
 cooldown:a.cooldown,maxUses:a.maxUses,effects:extras,tags:[...tags],
 calculationSupport:a.calculationSupport==='requires-effect-handler'?'requires-effect-handler':extras.length?'direct-component-only':a.calculationSupport};
}
module.exports={resolveAbility};
