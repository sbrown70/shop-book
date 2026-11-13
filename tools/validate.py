"""Check Shop Book data before committing. Exit code 1 if anything is wrong.

Usage: python tools/validate.py
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
errors, warnings = [], []

AREAS = {'engine', 'electrical', 'drivetrain', 'suspension-steering', 'brakes', 'cooling', 'fuel', 'exhaust',
         'body-paint', 'interior', 'wheels-tires', 'general'}
PROJ_STATUS = {'active', 'paused', 'done', 'idea'}
SUB_STATUS = {'todo', 'in_progress', 'blocked', 'done'}
PART_STATUS = {'needed', 'in_cart', 'ordered', 'on_hand', 'installed', 'skip'}
TOOL_STATUS = {'needed', 'have', 'borrow', 'rent'}
LOG_KINDS = {'work', 'measurement', 'finding', 'incident', 'purchase', 'note'}
DATE = re.compile(r'^\d{4}-\d{2}-\d{2}$')
# The repo is public: keep the owner's personal details out of it.
PRIVATE = re.compile(r'stephen|\bsteph\b|gmail|[\w.+-]+@[\w-]+\.[\w.]+', re.I)


def load(rel):
    try:
        return json.loads((ROOT / rel).read_text(encoding='utf-8'))
    except Exception as e:  # noqa: BLE001
        errors.append(f'{rel}: does not parse ({e})')
        return None


def exists(path, where):
    if path and not (ROOT / path).exists():
        errors.append(f'{where}: file not found: {path}')


def unique(items, key, where):
    seen = set()
    for it in items:
        v = it.get(key)
        if v in seen:
            errors.append(f'{where}: duplicate {key} "{v}"')
        seen.add(v)


index = load('data/index.json') or {'projects': []}
load('data/car.json')
log = load('data/log.json') or {'entries': []}
projects = {}
for pid in index.get('projects', []):
    p = load(f'data/projects/{pid}.json')
    if p is None:
        continue
    if p.get('id') != pid:
        errors.append(f'data/projects/{pid}.json: id is "{p.get("id")}", expected "{pid}"')
    projects[pid] = p

for pid, p in projects.items():
    w = f'project {pid}'
    if p.get('status') not in PROJ_STATUS:
        errors.append(f'{w}: bad status {p.get("status")!r}')
    if p.get('area') not in AREAS:
        errors.append(f'{w}: bad area {p.get("area")!r}')
    for f in p.get('files', []):
        exists(f.get('path'), w)
    part_ids = {x['id'] for x in p.get('parts', [])}
    tool_ids = {x['id'] for x in p.get('tools', [])}
    unique(p.get('parts', []), 'id', f'{w} parts')
    unique(p.get('tools', []), 'id', f'{w} tools')
    unique(p.get('subprojects', []), 'id', f'{w} subprojects')
    for x in p.get('parts', []):
        if x.get('status') not in PART_STATUS:
            errors.append(f'{w}: part {x["id"]} bad status {x.get("status")!r}')
    for x in p.get('tools', []):
        if x.get('status') not in TOOL_STATUS:
            errors.append(f'{w}: tool {x["id"]} bad status {x.get("status")!r}')
    for s in p.get('subprojects', []):
        ws = f'{w} › {s["id"]}'
        if s.get('status') not in SUB_STATUS:
            errors.append(f'{ws}: bad status {s.get("status")!r}')
        for path in s.get('files', []):
            exists(path, ws)
        for ref in s.get('depends_on', []):
            dp, ds = ref.split('/', 1) if '/' in ref else (pid, ref)
            if dp not in projects or ds not in {x['id'] for x in projects[dp].get('subprojects', [])}:
                errors.append(f'{ws}: depends_on "{ref}" does not exist')
        unique(s.get('tasks', []), 'id', f'{ws} tasks')
        for t in s.get('tasks', []):
            if 'id' not in t or 'text' not in t:
                errors.append(f'{ws}: task missing id or text: {t}')
                continue
            for r in t.get('needs_parts', []):
                if r not in part_ids:
                    errors.append(f'{ws} › {t["id"]}: needs_parts "{r}" is not a part in {pid}')
            for r in t.get('needs_tools', []):
                if r not in tool_ids:
                    errors.append(f'{ws} › {t["id"]}: needs_tools "{r}" is not a tool in {pid}')
            if t.get('done') and t.get('done_date') and not DATE.match(t['done_date']):
                errors.append(f'{ws} › {t["id"]}: bad done_date {t["done_date"]!r}')

unique(log.get('entries', []), 'id', 'log')
for e in log.get('entries', []):
    w = f'log {e.get("id")}'
    if not DATE.match(e.get('date') or ''):
        errors.append(f'{w}: bad date {e.get("date")!r}')
    if e.get('kind') not in LOG_KINDS:
        errors.append(f'{w}: bad kind {e.get("kind")!r}')
    if e.get('project') and e['project'] not in projects:
        errors.append(f'{w}: unknown project {e["project"]!r}')
    if e.get('subproject') and e.get('project') in projects and e['subproject'] not in {s['id'] for s in projects[e['project']]['subprojects']}:
        errors.append(f'{w}: unknown subproject {e["subproject"]!r}')
    for ph in e.get('photos', []):
        exists(ph, w)

for f in list((ROOT / 'data').rglob('*.json')) + [x for x in (ROOT / 'files').rglob('*') if x.suffix in {'.md', '.html', '.csv', '.svg', '.txt'}]:
    text = f.read_text(encoding='utf-8', errors='ignore')
    for m in PRIVATE.finditer(text):
        warnings.append(f'{f.relative_to(ROOT)}: possible personal info "{m.group(0)}" (the repo is public)')

for w in warnings:
    print('WARN ', w)
for e in errors:
    print('ERROR', e)
print(f'{len(projects)} projects, {len(log.get("entries", []))} log entries: '
      f'{"OK" if not errors else f"{len(errors)} error(s)"}{f", {len(warnings)} warning(s)" if warnings else ""}')
sys.exit(1 if errors else 0)
