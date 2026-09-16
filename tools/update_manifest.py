#!/usr/bin/env python3
"""Rebuild hashes after an intentional, reviewed update. Run validate first."""
from pathlib import Path
import hashlib,json
P=Path(__file__).resolve().parents[1]
m=json.loads((P/'manifest.json').read_text(encoding='utf-8'))
# Keep the original kit inventory. Never add node_modules, dist or private files.
for entry in m['files']:
 p=(P/entry['path']).resolve(strict=True)
 if not p.is_relative_to(P.resolve()):raise ValueError('Manifest path outside project')
 entry.update(bytes=p.stat().st_size,sha256=hashlib.sha256(p.read_bytes()).hexdigest())
(P/"manifest.json").write_text(json.dumps(m,ensure_ascii=False,indent=2)+"\n",encoding='utf-8')
print("Hashed",len(m["files"]),"files")
