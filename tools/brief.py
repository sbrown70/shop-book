"""Print a compact, readable state of the garage or of one project / sub-project.
Use this instead of reading the raw JSON: it's much shorter.

Usage:
  python tools/brief.py                    every project, one paragraph each
  python tools/brief.py wiring             one project in full
  python tools/brief.py wiring turn        one sub-project (id or part of its title), with its log
  python tools/brief.py --search relay     search tasks, log, specs, parts, car fields
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.stdout.reconfigure(encoding='utf-8')


def load(rel):
    return json.loads((ROOT / rel).read_text(encoding='utf-8'))


index, car, log = load('data/index.json'), load('data/car.json'), load('data/log.json')
projects = {pid: load(f'data/projects/{pid}.json') for pid in index['projects']}
entries = sorted(log['entries'], key=lambda e: (e.get('date') or '', e.get('id') or ''), reverse=True)
READY = {'on_hand', 'installed', 'skip'}


def mins(m):
    return '' if not m else f'{m} min' if m < 60 else f'{m / 60:g} hr'


def deps_open(p, s):
    out = []
    for ref in s.get('depends_on', []):
        pid, sid = ref.split('/', 1) if '/' in ref else (p['id'], ref)
        ss = next((x for x in projects.get(pid, {}).get('subprojects', []) if x['id'] == sid), None)
        if ss and ss['status'] != 'done':
            out.append(ss['title'])
    return out


def entry_line(e, limit=220):
    meas = '; '.join(f"{m.get('what', '')}{' @ ' + m['location'] if m.get('location') else ''} = {m.get('value')} {m.get('unit') or ''}".strip()
                     for m in e.get('measurements') or [])
    text = (e.get('text') or '').replace('\n', ' ')
    return (f"  {e['date']}{'~' if e.get('date_approx') else ''} [{e['kind']}] {e.get('title') or ''}"
            f"{': ' + (text[:limit] + ('…' if len(text) > limit else '') if limit else text) if text else ''}{' | readings: ' + meas if meas else ''}")


def task_line(p, t):
    parts = {x['id']: x for x in p['parts']}
    wait = [parts[i]['name'] for i in t.get('needs_parts', []) if i in parts and parts[i]['status'] not in READY]
    flags = []
    if t.get('confirm'):
        flags.append('confirm on car')
    if wait:
        flags.append('waiting: ' + ', '.join(wait))
    est = '' if t.get('done') else f" ~{mins(t.get('est_min'))}{'?' if t.get('est_guess') else ''}"
    return f"    [{'x' if t.get('done') else ' '}] {t['id']}: {t['text']}{est}{' (' + '; '.join(flags) + ')' if flags else ''}"


def sub_block(p, s, full=False):
    done = sum(t.get('done', False) for t in s['tasks'])
    head = f"  ## {s['title']} [{s['id']}] — {s['status']}, {done}/{len(s['tasks'])} done"
    lines = [head]
    if s.get('blocked_by'):
        lines.append(f"    blocked by: {s['blocked_by']}")
    if deps_open(p, s):
        lines.append(f"    comes after: {', '.join(deps_open(p, s))}")
    if full:
        for k in ('goal', 'summary'):
            if s.get(k):
                lines.append(f"    {k}: {s[k]}")
        for n in s.get('notes', []):
            lines.append(f"    note: {n}")
        for f in s.get('files', []):
            lines.append(f"    doc: {f}")
    lines += [task_line(p, t) for t in s['tasks'] if full or not t.get('done')]
    return '\n'.join(lines)


def project_full(p):
    print(f"# {p['title']} [{p['id']}] — {p['status']}, area {p['area']}")
    for k in ('goal', 'next_step'):
        if p.get(k):
            print(f"{k}: {p[k]}")
    print('\nSUB-PROJECTS (open tasks only; ask for one sub-project to see all)')
    for s in p['subprojects']:
        if s['status'] != 'done':
            print(sub_block(p, s))
    print('\nPARTS not yet on hand:')
    for x in p['parts']:
        if x['status'] not in READY:
            print(f"  {x['id']}: {x['name']} — {x['status']}{' — ' + x['notes'] if x.get('notes') else ''}")
    print('TOOLS needed: ' + ', '.join(t['name'] for t in p.get('tools', []) if t['status'] == 'needed'))
    if p.get('specs'):
        print('\nSPECS:')
        for x in p['specs']:
            print(f"  {x['item']}: {x['value']} {x.get('unit') or ''}{' — ' + x['notes'] if x.get('notes') else ''}")
    q = [x['text'] for x in p.get('open_questions', []) if not x.get('resolved')]
    if q:
        print('\nOPEN QUESTIONS:')
        for x in q:
            print(f'  - {x}')
    print('\nDOCS:')
    for f in p.get('files', []):
        print(f"  {f['path']} ({f.get('kind')}{', MAIN GUIDE' if f.get('primary') else ''}): {f.get('title')}")
    print('\nRECENT LOG:')
    for e in [e for e in entries if e.get('project') == p['id']][:12]:
        print(entry_line(e))


def main(argv):
    if argv[:1] == ['--search']:
        q = ' '.join(argv[1:]).lower()
        for p in projects.values():
            for s in p['subprojects']:
                for t in s['tasks']:
                    if q in (t['text'] + ' ' + (t.get('detail') or '')).lower():
                        print(f"task  {p['id']}/{s['id']}: {task_line(p, t).strip()}")
            for x in p.get('specs', []):
                if q in json.dumps(x).lower():
                    print(f"spec  {p['id']}: {x['item']} = {x['value']} {x.get('unit') or ''}")
            for x in p['parts']:
                if q in json.dumps(x).lower():
                    print(f"part  {p['id']}: {x['name']} — {x['status']}")
        for e in entries:
            if q in json.dumps(e).lower():
                print('log ' + entry_line(e))
        for sec in car['sections']:
            for f in sec['fields']:
                if q in json.dumps(f).lower():
                    print(f"car   {sec['title']}: {f['label']} = {f['value']}")
        return
    if not argv:
        print(f"{car['name']} — {car.get('subtitle', '')}")
        for p in projects.values():
            open_t = sum(not t.get('done') for s in p['subprojects'] for t in s['tasks'])
            print(f"\n# {p['title']} [{p['id']}] — {p['status']}, {open_t} open tasks\n  next: {p.get('next_step', '')}")
            for s in p['subprojects']:
                if s['status'] != 'done':
                    extra = s.get('blocked_by') or ('after ' + ', '.join(deps_open(p, s)) if deps_open(p, s) else '')
                    print(f"  - {s['title']} [{s['id']}] {s['status']}{' — ' + extra if extra else ''}")
        print('\nRECENT LOG:')
        for e in entries[:8]:
            print(entry_line(e))
        return
    p = projects.get(argv[0]) or next((x for x in projects.values() if argv[0].lower() in x['title'].lower()), None)
    if not p:
        sys.exit(f"No project matching {argv[0]!r}. Projects: {', '.join(projects)}")
    if len(argv) == 1:
        project_full(p)
        return
    key = ' '.join(argv[1:]).lower()
    s = next((x for x in p['subprojects'] if x['id'] == key), None) or next((x for x in p['subprojects'] if key in x['title'].lower() or key in x['id']), None)
    if not s:
        sys.exit(f"No sub-project matching {key!r} in {p['id']}: {', '.join(x['id'] for x in p['subprojects'])}")
    print(f"# {p['title']} [{p['id']}]")
    print(sub_block(p, s, full=True))
    print('\nLOG FOR THIS SUB-PROJECT:')
    for e in [e for e in entries if e.get('project') == p['id'] and e.get('subproject') == s['id']]:
        print(entry_line(e, limit=None))
    print('\nPROJECT SPECS: ' + '; '.join(f"{x['item']} {x['value']} {x.get('unit') or ''}".strip() for x in p.get('specs', [])))


main(sys.argv[1:])
