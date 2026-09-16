#!/usr/bin/env python3
"""Offline integrity/reference validator. Python 3 stdlib only.
Implements only the JSON Schema keywords used by this kit; not a general validator.
Unknown schema keywords fail, so extensions cannot silently bypass validation.
"""
import json,re,hashlib,sys,math,datetime
from pathlib import Path
from html.parser import HTMLParser
ROOT=Path(__file__).resolve().parents[1]
ERRORS=[];CHECKS=0

def check(value,message):
 global CHECKS
 CHECKS+=1
 if not value:ERRORS.append(message)

def load(p):return json.loads((ROOT/p).read_text(encoding='utf-8'))
SUPPORTED={'$schema','$id','title','description','type','properties','required','additionalProperties','anyOf','enum','const','items','maxItems','minItems','uniqueItems','minimum','maximum','maxLength','minLength','pattern','format'}
def validate(v,s,path='$'):
 for k in s:
  if k not in SUPPORTED:raise ValueError('Unsupported schema keyword '+k+' at '+path)
 if 'anyOf' in s:
  reasons=[]
  for option in s['anyOf']:
   try:validate(v,option,path);break
   except ValueError as e:reasons.append(str(e))
  else:raise ValueError(path+': no anyOf match: '+'; '.join(reasons))
 if 'enum' in s and v not in s['enum']:raise ValueError(path+': invalid enum '+repr(v))
 if 'const' in s and v!=s['const']:raise ValueError(path+': invalid const')
 t=s.get('type')
 ok={'null':v is None,'object':isinstance(v,dict),'array':isinstance(v,list),'string':isinstance(v,str),'boolean':isinstance(v,bool),'integer':isinstance(v,int) and not isinstance(v,bool),'number':isinstance(v,(int,float)) and not isinstance(v,bool) and math.isfinite(v)}
 if t and not ok.get(t,False):raise ValueError(path+': expected '+t+', got '+type(v).__name__)
 if isinstance(v,dict):
  props=s.get('properties',{})
  for k in s.get('required',[]):
   if k not in v:raise ValueError(path+': missing '+k)
  for k,x in v.items():
   if k in props:validate(x,props[k],path+'.'+k)
   elif s.get('additionalProperties') is False:raise ValueError(path+': unknown property '+k)
   elif isinstance(s.get('additionalProperties'),dict):validate(x,s['additionalProperties'],path+'.'+k)
 if isinstance(v,list):
  if len(v)<s.get('minItems',0) or len(v)>s.get('maxItems',math.inf):raise ValueError(path+': invalid array length')
  if s.get('uniqueItems') and len({json.dumps(x,sort_keys=True) for x in v})!=len(v):raise ValueError(path+': duplicate item')
  if 'items' in s:
   for i,x in enumerate(v):validate(x,s['items'],path+'['+str(i)+']')
 if isinstance(v,str):
  if len(v)<s.get('minLength',0) or len(v)>s.get('maxLength',math.inf):raise ValueError(path+': invalid string length')
  if 'pattern' in s and not re.search(s['pattern'],v):raise ValueError(path+': pattern mismatch '+v)
  if s.get('format')=='date':datetime.date.fromisoformat(v)
  if s.get('format')=='date-time':
   dt=datetime.datetime.fromisoformat(v.replace('Z','+00:00'))
   if dt.tzinfo is None:raise ValueError(path+': timezone required')
 if isinstance(v,(int,float)) and not isinstance(v,bool):
  if v<s.get('minimum',-math.inf) or v>s.get('maximum',math.inf):raise ValueError(path+': outside numeric range')

def main():
 data={p.stem:load(p.relative_to(ROOT)) for p in (ROOT/'data').glob('*.json')}
 for p in (ROOT/'schemas').glob('*.schema.json'):
  target=ROOT/'data'/(p.name.replace('.schema.json','.json'))
  if p.name=='profile-export.schema.json':target=ROOT/'examples/profile-export.json'
  if p.name=='build-preset.schema.json':continue
  if target.exists():
   try:validate(json.loads(target.read_text(encoding='utf-8')),json.loads(p.read_text(encoding='utf-8')),str(target.relative_to(ROOT)));check(True,'schema')
   except (ValueError,TypeError) as e:check(False,str(e))
 sample=load('examples/profile-export.json')
 for preset in sample['presets']:
  try:validate(preset,load('schemas/build-preset.schema.json'));check(True,'preset schema')
  except ValueError as e:check(False,str(e))
 ids={}
 for name,rows in data.items():
  if isinstance(rows,list) and rows and isinstance(rows[0],dict) and 'id' in rows[0]:
   ids[name]={r['id']:r for r in rows};check(len(ids[name])==len(rows),name+': duplicate ID')
 def ref(kind,key,context,nullable=False):check((nullable and key is None) or key in ids[kind],context+': unresolved '+str(key))
 for f in data['miscrits']:
  for fid in f['formIds']:
   ref('forms',fid,f['id']);check(ids['forms'].get(fid,{}).get('familyId')==f['id'],'form ownership '+fid)
 for f in data['forms']:ref('miscrits',f['familyId'],f['id'])
 for b in data['miscrit-abilities']:
  ref('miscrits',b['familyId'],'ability binding');ref('abilities',b['abilityId'],'ability binding')
 for a in data['areas']:ref('locations',a['locationId'],a['id'])
 for l in data['locations']:ref('maps',l['mapId'],l['id'],True)
 for m in data['maps']:ref('locations',m['locationId'],m['id']);check((ROOT/m['image']).is_file(),'missing map '+m['image'])
 for m in data['markers']:
  ref('maps',m['mapId'],m['id']);ref('miscrits',m['familyId'],m['id'],True);ref('areas',m['areaId'],m['id'],True)
  check(0<=m['x']<=1 and 0<=m['y']<=1,m['id']+' outside map')
  if m['areaId']:check(ids['areas'][m['areaId']]['locationId']==ids['maps'][m['mapId']]['locationId'],m['id']+' area map mismatch')
 for s in data['spawns']:
  ref('miscrits',s['familyId'],s['id'],True);ref('areas',s['areaId'],s['id']);ref('locations',s['locationId'],s['id'])
  check(ids['areas'][s['areaId']]['locationId']==s['locationId'],s['id']+' area location mismatch')
  for mid in s['markerIds']:
   ref('markers',mid,s['id']);m=ids['markers'].get(mid,{})
   check(m.get('familyId')==s['familyId'],s['id']+' marker family mismatch')
   check(ids['maps'][m['mapId']]['locationId']==s['locationId'],s['id']+' marker location mismatch')
 for r in data['relics']:
  if r['image']:check((ROOT/r['image']).is_file(),'missing relic '+r['image'])
 for c in data['collections']:
  for r in c['requirements']:
   ref('miscrits',r['familyId'],c['id'],True);ref('forms',r['formId'],c['id'],True)
 for a in data['aliases']:ref('miscrits',a['familyId'],'alias '+a['query'])
 for b in data['base-stats']:
  ref('miscrits',b['familyId'],'base stats');check(b['ranks']==ids['miscrits'][b['familyId']]['baseRanks'],'rank duplicate mismatch')
 class Links(HTMLParser):
  def handle_starttag(self,tag,attrs):
   for k,v in attrs:
    if k in ['href','src'] and v and not v.startswith(('#','https:','http:','data:','mailto:')):
     target=(self.base/v.split('#')[0]).resolve();check(target.is_relative_to(ROOT.resolve()) and target.is_file(),'broken HTML link: '+str(target))
 # Standalone kit HTML has file-relative links. The new Vite application has HTTP
 # routes and is verified by build/browser checks; do not scan dependencies/dist.
 manifest=load('manifest.json')
 for item in manifest['files']:
  p=ROOT/item['path']
  if p.suffix=='.html':
   h=Links();h.base=p.parent;h.feed(p.read_text(encoding='utf-8'))
 cov=load('qa/coverage.json')
 for key,name in [('families','miscrits'),('forms','forms'),('abilityVariants','abilities'),('abilityBindings','miscrit-abilities'),('worldMaps','maps'),('markers','markers'),('spawnsIncludingShop','spawns'),('relics','relics'),('collections','collections')]:check(cov[key]==len(data[name]),'coverage '+key)
 check(cov['areaOnlySpawns']==sum(not s['markerIds'] for s in data['spawns']),'coverage area-only spawns')
 if (ROOT/'manifest.json').exists() and '--skip-checksums' not in sys.argv:
  manifest=load('manifest.json')
  for f in manifest['files']:
   p=ROOT/f['path'];check(p.is_file(),'manifest missing '+f['path'])
   if p.is_file():check(hashlib.sha256(p.read_bytes()).hexdigest()==f['sha256'],'checksum mismatch '+f['path']);check(p.stat().st_size==f['bytes'],'size mismatch '+f['path'])
 print(json.dumps({'passed':not ERRORS,'checks':CHECKS,'errors':ERRORS},ensure_ascii=False,indent=2))
 return 1 if ERRORS else 0
if __name__=='__main__':sys.exit(main())
