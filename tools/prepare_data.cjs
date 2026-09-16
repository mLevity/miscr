// Deterministic projection: preserve the canonical source files, ship only fields used by the UI.
const fs=require('node:fs');const path=require('node:path');
const root=path.resolve(__dirname,'..');const output=path.join(root,'src/data/generated');fs.mkdirSync(output,{recursive:true});
const fields={
  miscrits:['id','slug','name','aliases','elements','rarity','baseRanks','formIds'],
  forms:['id','familyId','stage','name','assetKey','minimumLevel'],
  spawns:['id','familyId','locationId','areaId','acquisition','schedule','precision','markerIds'],
  maps:['id','locationId','image','width','height','quality'],
  markers:['id','mapId','familyId','x','y','areaId','anchor'],
  locations:['id','name','kind','mapId'],
  areas:['id','locationId','name'],
  collections:['id','name','sourceGroup','requirements','rewards'],
  'family-variants':['familyId','variant'],
  'miscrit-abilities':['familyId','abilityId','order','unlockLevel'],
  abilities:['id','name','kind','element','ap','accuracyPercent','hits','turns','tags','descriptionEn','enchantDescriptionEn','enchant','rawEffects','calculationSupport'],
  relics:['id','name','requiredSlotLevel','statModifiers','specialEffectsText','costs','image']
};
for(const [name,keys] of Object.entries(fields)){const input=JSON.parse(fs.readFileSync(path.join(root,'data',name+'.json'),'utf8'));const projected=input.map(row=>Object.fromEntries(keys.map(key=>[key,row[key]])));fs.writeFileSync(path.join(output,name+'.json'),JSON.stringify(projected)+'\n');}
console.log(`Prepared ${Object.keys(fields).length} compact dictionaries`);
require('./build_tags.cjs').build();
