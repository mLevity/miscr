"""Import only assets verified by source ID, four-form chain, manifest hash and image decode.
Never executes anything in the source directory. Run with --source PATH.
"""
import argparse, hashlib, json
from pathlib import Path
from PIL import Image, ImageOps, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
def load(path):
    return json.loads(path.read_text(encoding='utf-8'))
def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--source', required=True, type=Path)
    args = parser.parse_args()
    source = args.source.resolve(strict=True)
    live = load(source / 'miscrits_live.json')
    by_id = {}
    for row in live:
        by_id.setdefault(str(row['id']), []).append(row)
    inventory = {}
    for row in load(source / 'game/data/asset_index.json'):
        inventory.setdefault(row['path'], []).append(row)
    download_rows = load(source / 'game/data/character_asset_downloads.json')
    downloads = {}
    for row in download_rows:
        downloads.setdefault(row['local'], []).append(row)
    forms = {row['id']: row for row in load(ROOT/'data/forms.json')}
    families = load(ROOT/'data/miscrits.json')
    report = {'sourceRoot': str(source), 'resolved': [], 'missing': [], 'duplicateKey': [], 'invalidImage': [], 'identityConflict': [], 'orphanFile': []}
    mapping = {'schemaVersion': 1, 'forms': {}, 'elements': {}}
    destination = ROOT/'public/assets/imported'
    destination.mkdir(parents=True, exist_ok=True)
    used = set()

    def verified(relative, key, role):
        metadata = inventory.get(relative, [])
        if len(metadata) != 1:
            report['duplicateKey' if len(metadata)>1 else 'missing'].append({'key':key, 'role':role, 'path':relative})
            return None
        path = (source/relative).resolve()
        if not path.is_relative_to(source) or not path.is_file():
            report['missing'].append({'key':key,'role':role,'path':relative})
            return None
        used.add(relative)
        try:
            data = path.read_bytes()
            digest = hashlib.sha256(data).hexdigest()
            if not data.startswith(b'\x89PNG\r\n\x1a\n') or len(data)!=metadata[0]['size'] or digest!=metadata[0]['sha256']:
                raise ValueError('Signature, byte count or SHA-256 does not match the source inventory')
            with Image.open(path) as image:
                image.verify()
            with Image.open(path) as image:
                image.load()
                if image.width<16 or image.height<16 or image.width>4096 or image.height>4096:
                    raise ValueError('Unexpected dimensions')
                if image.convert('RGBA').getchannel('A').getbbox() is None:
                    raise ValueError('Entire image is transparent')
                width,height = image.size
            target = destination/f'{digest[:20]}.png'
            if target.exists() and hashlib.sha256(target.read_bytes()).hexdigest()!=digest:
                raise ValueError('Output hash collision')
            if not target.exists():
                target.write_bytes(data)
            record = {'path':f'/assets/imported/{target.name}','width':width,'height':height,'mediaType':'image/png','sha256':digest,'role':role,'sourcePath':relative}
            report['resolved'].append({'key':key,**record})
            return record
        except (OSError,ValueError) as error:
            report['invalidImage'].append({'key':key,'path':relative,'error':str(error)})
            return None

    for family in families:
        candidates = by_id.get(str(family['sourceIds']['official']), [])
        chain = [forms[form_id]['name'] for form_id in family['formIds']]
        if len(candidates)!=1 or candidates[0]['names']!=chain:
            report['identityConflict'].append({'familyId':family['id'],'expected':chain,'sourceCandidates':[row['names'] for row in candidates]})
            continue
        for form_id in family['formIds']:
            form = forms[form_id]
            slug = form['name'].replace(' ','_').lower()
            record = {'assetKey':form['assetKey'],'name':form['name']}
            for role,folder,suffix in [('avatar','avatars','avatar'),('battle','miscrits','back')]:
                relative = f'game/assets/{folder}/{slug}_{suffix}.png'
                evidence = downloads.get(relative,[])
                if len(evidence)!=1 or evidence[0].get('status') not in ('downloaded','existing') or evidence[0].get('remote')!=f'/{folder}/{slug}_{suffix}.png':
                    report['missing'].append({'key':form_id,'role':role,'path':relative,'reason':'No unambiguous download provenance'})
                    continue
                asset = verified(relative,form_id,role)
                if asset:
                    record[role] = asset
            if 'avatar' in record or 'battle' in record:
                mapping['forms'][form_id] = record
    for element in ['fire','water','nature','earth','lightning','wind']:
        asset = verified(f'game/assets/ui/elements/{element}.png',element,'element')
        if asset:
            mapping['elements'][element] = asset
    report['orphanFile'] = sorted(path for path in inventory if path.startswith(('game/assets/avatars/','game/assets/miscrits/')) and path not in used)
    report['summary'] = {key:len(report[key]) for key in ('resolved','missing','duplicateKey','invalidImage','identityConflict','orphanFile')}
    (ROOT/'qa/asset-manifest.json').write_text(json.dumps(mapping,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    runtime = {'schemaVersion':1,'forms':{},'elements':{}}
    compact = lambda asset: asset['path']
    for form_id,record in mapping['forms'].items():
        runtime['forms'][form_id] = {'name':record['name'],**{f'{role}Path':compact(record[role]) for role in ('avatar','battle') if role in record}}
    runtime['elements'] = {key:compact(asset) for key,asset in mapping['elements'].items()}
    (ROOT/'src/data/asset-manifest.json').write_text(json.dumps(runtime,ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf-8')
    (ROOT/'qa/asset-import-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    # Contact sheet for visual inspection of the first twelve complete four-form chains.
    sample = list(mapping['forms'].items())[:48]
    sheet = Image.new('RGB',(960,((len(sample)+5)//6)*190),'#11120f')
    draw = ImageDraw.Draw(sheet)
    for index,(form_id,record) in enumerate(sample):
        asset = record.get('battle') or record.get('avatar')
        with Image.open(ROOT/'public'/asset['path'].lstrip('/')) as original:
            tile = ImageOps.contain(original.convert('RGBA'),(140,145))
            x,y = (index%6)*160,(index//6)*190
            sheet.paste(tile,(x+(160-tile.width)//2,y+5),tile)
            draw.text((x+5,y+153),record['name'],fill='#f3eedb')
            draw.text((x+5,y+170),form_id,fill='#b7b29e')
    sheet.save(ROOT/'qa/imported-assets-contact-sheet.jpg')
    print(json.dumps(report['summary']))
if __name__=='__main__':
    main()
