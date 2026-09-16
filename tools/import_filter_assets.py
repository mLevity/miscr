"""Import only decoded, nonempty UI PNGs from the recovered game assets."""
from pathlib import Path
from PIL import Image, ImageDraw
import hashlib, json, shutil

root = Path(__file__).resolve().parents[1]
source = Path(r'C:\lvt_proj\yandex\miscrits\recovered_assets\assets\scenes\common')
dest = root / 'public/assets/filters'
manifest = {}
tiles = []
for kind, folder in [('elements', 'elements/large'), ('stats', 'stats/large'), ('rarity', 'rarity'), ('chunks', '../miscripedia/chunks')]:
    (dest / kind).mkdir(parents=True, exist_ok=True)
    for file in sorted((source / folder).glob('*.png')):
        with Image.open(file) as image:
            image.load()
            assert image.format == 'PNG' and image.width <= 2048 and image.height <= 2048
            rgba = image.convert('RGBA')
            assert rgba.getbbox()
            tile = Image.new('RGBA', (140, 120), '#242620')
            rgba.thumbnail((100, 85))
            tile.alpha_composite(rgba, ((140-rgba.width)//2, 0))
            ImageDraw.Draw(tile).text((5, 95), file.stem, fill='white')
            tiles.append(tile)
        output = dest / kind / file.name.lower()
        shutil.copyfile(file, output)
        manifest[f'{kind}/{file.stem.lower()}'] = {'source': str(file), 'sha256': hashlib.sha256(file.read_bytes()).hexdigest()}
(root / 'qa/filter-asset-manifest.json').write_text(json.dumps(manifest, indent=2), encoding='utf8')
sheet = Image.new('RGB', (140*8, 120*((len(tiles)+7)//8)), '#242620')
for i, tile in enumerate(tiles): sheet.paste(tile, ((i%8)*140, (i//8)*120))
sheet.save(root / 'qa/filter-assets.jpg')
print(f'Imported {len(tiles)} verified PNG assets')
