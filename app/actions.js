// Everything that changes data: forms for tasks, sub-projects, projects, parts, specs, log, car.
import { S, save, saveProject, projPath, projects, waitingOn, addPhoto, syncNow, cfg, setCfg, testConnection, load, deleteLogEntry, logEntries, allFiles, pendingCount, stats } from './store.js';
import { openForm, toast, today, uniqueId, slug, copyText, opts, fmtDate, fmtMin, AREAS, LOG_KINDS, SUB_STATUS, PROJ_STATUS, PART_STATUS, TOOL_STATUS, $ } from './ui.js';
import { LS } from './views2.js';

const rerender = () => window.dispatchEvent(new Event('rerender'));
const P = id => S.projects.get(id);
const sub = (pid, sid) => P(pid)?.subprojects.find(s => s.id === sid);
const task = d => sub(d.p, d.s)?.tasks.find(t => t.id === d.t);
const allSpecs = () => projects().flatMap(p => p.specs);
const EST = [[null, 'Not set'], [15, '15 min'], [30, '30 min'], [45, '45 min'], [60, '1 hr'], [90, '1.5 hr'], [120, '2 hr'], [180, '3 hr'], [240, 'Half day'], [480, 'Full day']].map(([value, label]) => ({ value: value ?? '', label }));
const setPref = (k, v) => { try { localStorage.setItem(k, v); } catch { } };

async function uploadAll(files, folder) {
  const paths = [];
  for (const f of files || []) paths.push(await addPhoto(f, folder));
  return paths;
}
function projSubOptions(allowNone = true) {
  const o = allowNone ? [{ value: '|', label: 'Not tied to a project' }] : [];
  for (const p of projects()) {
    o.push({ value: `${p.id}|`, label: p.title });
    for (const s of p.subprojects) o.push({ value: `${p.id}|${s.id}`, label: `   › ${s.title}` });
  }
  return o;
}

/* ---------- log entries ---------- */
export function logSomething(ctx = {}, existing = null) {
  const e = existing || { kind: ctx.kind || 'note', date: today(), project: ctx.project || '', subproject: ctx.subproject || '', measurements: [], photos: [] };
  openForm({
    title: existing ? 'Edit log entry' : 'Log something',
    values: { ...e, where: `${e.project || ''}|${e.subproject || ''}`, cost: e.cost ?? null, odometer: e.odometer ?? null },
    fields: [
      { key: 'kind', label: 'What kind', type: 'select', options: opts(LOG_KINDS) },
      { key: 'date', label: 'Date', type: 'date', required: true, help: 'Back-date it for past work.' },
      { key: 'title', label: 'Headline', placeholder: 'e.g. Measured main journals' },
      { key: 'text', label: 'Details', type: 'textarea', placeholder: 'What you did, saw or measured. Markdown works: - lists, **bold**.' },
      { key: 'measurements', label: 'Readings', type: 'measurements', specs: allSpecs(), value: e.measurements, help: 'Pick a spec and the reading is checked against it.' },
      { key: 'where', label: 'Project', type: 'select', options: projSubOptions() },
      { key: 'area', label: 'Area', type: 'select', options: [{ value: '', label: '—' }, ...opts(AREAS)], show: v => !v.where || v.where === '|' },
      { key: 'cost', label: 'Cost ($)', type: 'number', step: '0.01', show: v => ['purchase', 'work'].includes(v.kind) },
      { key: 'odometer', label: 'Odometer (mi)', type: 'number', show: v => ['work', 'purchase', 'note'].includes(v.kind) },
      { key: 'newPhotos', label: existing?.photos?.length ? `Add photos (${existing.photos.length} attached)` : 'Photos', type: 'photos' },
    ],
    onDelete: existing ? async () => { deleteLogEntry(existing.id); await save('data/log.json', `Log: delete ${existing.title || existing.id}`); rerender(); toast('Entry deleted.'); } : null,
    onSave: async v => {
      const [project, subproject] = v.where.split('|');
      const photos = [...(e.photos || []), ...await uploadAll(v.newPhotos, 'files/photos')];
      const out = {
        ...e, kind: v.kind, date: v.date, title: v.title, text: v.text, measurements: v.measurements,
        project: project || null, subproject: subproject || null,
        area: project ? (P(project)?.area || null) : (v.area || null),
        photos, cost: v.cost, odometer: v.odometer,
      };
      delete out.where; delete out.newPhotos;
      if (!out.measurements.length) delete out.measurements;
      if (!existing) {
        out.id = uniqueId(`${v.date}-${v.title || v.text || v.kind}`.slice(0, 50), S.log.entries.map(x => x.id));
        S.log.entries.push(out);
      } else Object.assign(existing, out);
      if (out.date_approx && existing && v.date !== e.date) delete existing.date_approx;
      await save('data/log.json', `Log: ${v.title || LOG_KINDS[v.kind]}`);
      rerender(); toast(existing ? 'Entry updated.' : 'Logged.');
    },
  });
}

/* ---------- tasks ---------- */
function taskForm(p, s, t) {
  const isNew = !t;
  t ||= { text: '', detail: '', est_min: null, est_guess: false, needs_parts: [], confirm: false, done: false };
  openForm({
    title: isNew ? `New task · ${s.title}` : 'Task',
    values: { ...t, est_min: t.est_min ?? '', where: s.id },
    fields: [
      { key: 'text', label: 'Task', type: 'textarea', rows: 2, required: true },
      { key: 'detail', label: 'How-to, notes, cautions', type: 'textarea', rows: 4, placeholder: 'Optional. Markdown works.' },
      { key: 'est_min', label: 'Time it takes', type: 'select', options: EST },
      { key: 'needs_parts', label: 'Waits on these parts', type: 'checks', options: p.parts.map(x => ({ value: x.id, label: `${x.name} (${PART_STATUS[x.status] || x.status})` })) },
      { key: 'confirm', label: 'Needs confirming on the car', type: 'checkbox' },
      { key: 'done', label: 'Done', type: 'checkbox', show: () => !isNew },
      { key: 'where', label: 'Sub-project', type: 'select', options: p.subprojects.map(x => ({ value: x.id, label: x.title })) },
      ...(t.detail && !isNew ? [] : []),
    ],
    onDelete: isNew ? null : async () => { s.tasks.splice(s.tasks.indexOf(t), 1); await saveProject(p, `Delete task: ${t.text.slice(0, 60)}`); rerender(); },
    onSave: async v => {
      const est = v.est_min === '' ? null : Number(v.est_min);
      const upd = { text: v.text, detail: v.detail, needs_parts: v.needs_parts, confirm: v.confirm };
      if (est !== t.est_min) { upd.est_min = est; upd.est_guess = false; }
      if (!isNew && v.done !== t.done) { upd.done = v.done; upd.done_date = v.done ? today() : null; }
      Object.assign(t, upd);
      if (isNew) { t.id = uniqueId(v.text.split(/\s+/).slice(0, 5).join(' '), s.tasks.map(x => x.id)); s.tasks.push(t); }
      if (v.where !== s.id) {
        const dest = p.subprojects.find(x => x.id === v.where);
        if (s.tasks.includes(t)) s.tasks.splice(s.tasks.indexOf(t), 1);
        if (dest.tasks.some(x => x.id === t.id)) t.id = uniqueId(t.id, dest.tasks.map(x => x.id));
        dest.tasks.push(t);
      }
      if (s.status === 'todo' && s.tasks.some(x => x.done)) s.status = 'in_progress';
      await saveProject(p, `${isNew ? 'Add' : 'Edit'} task: ${v.text.slice(0, 60)}`);
      rerender();
    },
    extra: !isNew && t.detail ? '' : '',
  });
}

/* ---------- project-level forms ---------- */
function projectForm(p) {
  const isNew = !p;
  p ||= { title: '', area: 'general', status: 'active', goal: '', summary: '', next_step: '', started: today() };
  openForm({
    title: isNew ? 'New project' : 'Edit project', values: p,
    fields: [
      { key: 'title', label: 'Name', required: true, placeholder: 'e.g. Front disc brake swap' },
      { key: 'area', label: 'Area', type: 'select', options: opts(AREAS) },
      { key: 'status', label: 'Status', type: 'select', options: opts(PROJ_STATUS) },
      { key: 'goal', label: 'Goal: what done looks like', type: 'textarea', rows: 2 },
      { key: 'next_step', label: 'Next step', type: 'textarea', rows: 2 },
      { key: 'summary', label: 'Background', type: 'textarea', rows: 5 },
      { key: 'started', label: 'Started', type: 'date' },
    ],
    onSave: async v => {
      if (isNew) {
        const id = uniqueId(v.title.split(/\s+/).slice(0, 4).join(' '), S.index.projects);
        const np = { id, ...v, links: [], files: [], subprojects: [{ id: 'first-steps', title: 'First steps', status: 'todo', goal: '', summary: '', blocked_by: '', files: [], notes: [], tasks: [] }], parts: [], tools: [], specs: [], decisions: [], open_questions: [], sources: [] };
        S.projects.set(id, np); S.index.projects.push(id);
        await save(projPath(id), `New project: ${v.title}`);
        await save('data/index.json', `Add ${id} to project list`);
        location.hash = `#/p/${id}`;
      } else {
        if (v.status === 'done' && p.status !== 'done') {
          S.log.entries.push({ id: uniqueId(`${today()}-${p.id}-complete`, S.log.entries.map(x => x.id)), date: today(), kind: 'work', project: p.id, subproject: null, area: p.area, title: `Finished project: ${v.title}`, text: v.goal || '' });
          await save('data/log.json', `Log: finished ${v.title}`);
        }
        Object.assign(p, v);
        await saveProject(p, `Edit project: ${v.title}`);
        rerender();
      }
    },
  });
}

function subForm(p, s) {
  const isNew = !s;
  s ||= { title: '', status: 'todo', goal: '', summary: '', blocked_by: '', notes: [], files: [], tasks: [] };
  openForm({
    title: isNew ? 'New sub-project' : 'Edit sub-project',
    values: { ...s, notesText: s.notes.join('\n'), filesSel: s.files },
    fields: [
      { key: 'title', label: 'Name', required: true },
      { key: 'status', label: 'Status', type: 'select', options: opts(SUB_STATUS) },
      { key: 'blocked_by', label: 'Blocked by', placeholder: 'e.g. Waiting on bearings', show: v => v.status === 'blocked' },
      { key: 'goal', label: 'Goal', type: 'textarea', rows: 2 },
      { key: 'summary', label: 'What to know', type: 'textarea', rows: 4 },
      { key: 'notesText', label: 'Notes (one per line)', type: 'textarea', rows: 4 },
      { key: 'depends_on', label: 'Comes after (these must be done first)', type: 'checks', options: projects().flatMap(pp => pp.subprojects.filter(x => x !== s).map(x => ({ value: pp.id === p.id ? x.id : `${pp.id}/${x.id}`, label: pp.id === p.id ? x.title : `${pp.title.split(':')[0]} › ${x.title}` }))) },
      { key: 'filesSel', label: 'Docs to show on this page', type: 'checks', options: p.files.map(f => ({ value: f.path, label: f.title || f.path })) },
    ],
    onDelete: isNew ? null : async () => { p.subprojects.splice(p.subprojects.indexOf(s), 1); await saveProject(p, `Delete sub-project ${s.title}`); location.hash = `#/p/${p.id}`; },
    deleteLabel: 'Delete sub-project and its tasks',
    onSave: async v => {
      Object.assign(s, { title: v.title, status: v.status, blocked_by: v.status === 'blocked' ? v.blocked_by : '', goal: v.goal, summary: v.summary, notes: v.notesText.split('\n').map(x => x.trim()).filter(Boolean), files: v.filesSel, depends_on: v.depends_on });
      if (!s.depends_on.length) delete s.depends_on;
      if (isNew) { s.id = uniqueId(v.title, p.subprojects.map(x => x.id)); p.subprojects.push(s); }
      if (v.status === 'done' && !isNew) {
        S.log.entries.push({ id: uniqueId(`${today()}-${s.id}-done`, S.log.entries.map(x => x.id)), date: today(), kind: 'work', project: p.id, subproject: s.id, area: p.area, title: `Finished: ${s.title}`, text: '' });
        await save('data/log.json', `Log: finished ${s.title}`);
      }
      await saveProject(p, `${isNew ? 'Add' : 'Edit'} sub-project: ${v.title}`);
      if (isNew) location.hash = `#/p/${p.id}/${s.id}`; else rerender();
    },
  });
}

function partForm(p, pt, asTool = false) {
  const isNew = !pt;
  pt ||= { name: '', status: 'needed', qty: 1, vendor: '', part_number: '', price: null, url: '', notes: '' };
  openForm({
    title: isNew ? 'Add a part or tool' : 'Part', values: { ...pt, what: asTool ? 'tool' : 'part' },
    fields: [
      ...(isNew ? [{ key: 'what', label: 'This is a', type: 'select', options: [{ value: 'part', label: 'Part (goes on the car)' }, { value: 'tool', label: 'Tool' }] }] : []),
      { key: 'name', label: 'Name', required: true },
      { key: 'status', label: 'Status', type: 'select', options: opts(PART_STATUS), show: v => v.what !== 'tool' },
      { key: 'tstatus', label: 'Status', type: 'select', options: opts(TOOL_STATUS), show: v => v.what === 'tool' },
      { key: 'qty', label: 'Qty', type: 'number', show: v => v.what !== 'tool' },
      { key: 'vendor', label: 'Vendor', show: v => v.what !== 'tool' },
      { key: 'part_number', label: 'Part number', show: v => v.what !== 'tool' },
      { key: 'price', label: 'Price each ($)', type: 'number', step: '0.01', show: v => v.what !== 'tool' },
      { key: 'url', label: 'Link', type: 'url', show: v => v.what !== 'tool' },
      { key: 'notes', label: 'Notes', type: 'textarea', rows: 2 },
    ],
    onDelete: isNew ? null : async () => { p.parts.splice(p.parts.indexOf(pt), 1); for (const s of p.subprojects) for (const t of s.tasks) t.needs_parts = (t.needs_parts || []).filter(x => x !== pt.id); await saveProject(p, `Remove part ${pt.name}`); rerender(); },
    onSave: async v => {
      if (v.what === 'tool' && isNew) {
        p.tools.push({ id: uniqueId(v.name, p.tools.map(x => x.id)), name: v.name, status: v.tstatus || 'needed', notes: v.notes });
        await saveProject(p, `Add tool ${v.name}`); rerender(); return;
      }
      const before = pt.status;
      Object.assign(pt, { name: v.name, status: v.status, qty: v.qty, vendor: v.vendor, part_number: v.part_number, price: v.price, url: v.url, notes: v.notes });
      if (isNew) { pt.id = uniqueId(v.name, p.parts.map(x => x.id)); p.parts.push(pt); }
      await partChanged(p, pt, before);
      await saveProject(p, `${isNew ? 'Add' : 'Edit'} part ${v.name}`); rerender();
    },
  });
}
async function partChanged(p, pt, before) {
  if (pt.status === before) return;
  if (['on_hand', 'installed'].includes(pt.status) && !['on_hand', 'installed'].includes(before)) {
    const freed = p.subprojects.flatMap(s => s.tasks).filter(t => !t.done && (t.needs_parts || []).includes(pt.id) && !waitingOn(p, t).length);
    if (freed.length) toast(`${pt.name} on hand. ${freed.length} task${freed.length > 1 ? 's are' : ' is'} now doable.`, 4000);
  }
  if (pt.status === 'ordered' || pt.status === 'on_hand') {
    if (pt.status === 'on_hand' && before !== 'ordered' && before !== 'in_cart') return;
    if (pt.status === 'ordered' && pt.price) {
      S.log.entries.push({ id: uniqueId(`${today()}-order-${pt.id}`, S.log.entries.map(x => x.id)), date: today(), kind: 'purchase', project: p.id, subproject: null, area: p.area, title: `Ordered ${pt.name}`, text: [pt.vendor, pt.part_number].filter(Boolean).join(' · '), cost: (Number(pt.price) || 0) * (Number(pt.qty) || 1) });
      await save('data/log.json', `Log: ordered ${pt.name}`);
    }
  }
}

function specForm(p, s) {
  const isNew = !s;
  s ||= { item: '', value: '', unit: '', notes: '' };
  openForm({
    title: isNew ? 'Add a spec' : 'Spec', values: s,
    fields: [
      { key: 'item', label: 'What', required: true, placeholder: 'e.g. Rod nuts' },
      { key: 'value', label: 'Value as written', placeholder: 'e.g. 19-24' },
      { key: 'unit', label: 'Unit', placeholder: 'ft-lb, in., V…' },
      { key: 'min', label: 'Low limit (number)', type: 'number', step: 'any', help: 'Optional. Lets logged readings be checked.' },
      { key: 'max', label: 'High limit (number)', type: 'number', step: 'any' },
      { key: 'notes', label: 'Notes', type: 'textarea', rows: 2 },
      { key: 'pinned', label: 'Show on the home page', type: 'checkbox' },
    ],
    onDelete: isNew ? null : async () => { p.specs.splice(p.specs.indexOf(s), 1); await saveProject(p, `Remove spec ${s.item}`); rerender(); },
    onSave: async v => {
      const out = { ...s, ...v };
      for (const k of ['min', 'max']) if (out[k] == null) delete out[k];
      if (!out.pinned) delete out.pinned;
      if (isNew) p.specs.push(out); else Object.assign(s, out);
      await saveProject(p, `${isNew ? 'Add' : 'Edit'} spec ${v.item}`); rerender();
    },
  });
}

/* ---------- Claude brief ---------- */
function brief(p) {
  const st = stats(p);
  const L = [];
  L.push(`# ${p.title}`, '', `Car: ${S.car.name}${S.car.subtitle ? ` (${S.car.subtitle})` : ''}. Status: ${PROJ_STATUS[p.status]}, ${st.done}/${st.total} tasks done. Updated ${p.updated || today()}.`, '');
  if (p.goal) L.push(`**Goal:** ${p.goal}`, '');
  if (p.next_step) L.push(`**Next step:** ${p.next_step}`, '');
  if (p.summary) L.push(p.summary, '');
  L.push('## Sub-projects');
  for (const s of p.subprojects) {
    L.push('', `### ${s.title} (${SUB_STATUS[s.status]})${s.blocked_by ? ` | blocked by: ${s.blocked_by}` : ''}`);
    if (s.goal) L.push(`Goal: ${s.goal}`);
    for (const t of s.tasks) L.push(`- [${t.done ? 'x' : ' '}] ${t.text}${t.confirm ? ' (confirm)' : ''}${!t.done && t.est_min ? ` [~${fmtMin(t.est_min)}]` : ''}`);
    for (const n of s.notes) L.push(`- Note: ${n}`);
  }
  const open = p.parts.filter(x => !['installed', 'skip'].includes(x.status));
  if (open.length) { L.push('', '## Parts'); for (const x of open) L.push(`- ${x.name}: ${PART_STATUS[x.status]}${x.part_number ? ` (${x.vendor} ${x.part_number})` : ''}`); }
  if (p.specs.length) { L.push('', '## Specs'); for (const x of p.specs) L.push(`- ${x.item}: ${x.value} ${x.unit || ''}${x.notes ? ` (${x.notes})` : ''}`); }
  const q = p.open_questions.filter(x => !x.resolved);
  if (q.length) { L.push('', '## Open questions'); for (const x of q) L.push(`- ${x.text}`); }
  const log = logEntries().filter(e => e.project === p.id).slice(0, 15);
  if (log.length) {
    L.push('', '## Recent log (newest first)');
    for (const e of log) {
      const m = (e.measurements || []).map(m => `${m.what}${m.location ? ' @ ' + m.location : ''} = ${m.value ?? ''} ${m.unit || ''}`).join('; ');
      L.push(`- ${e.date} [${e.kind}] ${e.title || ''}${e.text ? ': ' + e.text.replace(/\s+/g, ' ').slice(0, 300) : ''}${m ? ` | readings: ${m}` : ''}`);
    }
  }
  L.push('', '---', `When we're done, give me any new or changed tasks, parts, specs and log entries as JSON in the Shop Book format (project id "${p.id}"), so I can paste them into data/projects/${p.id}.json and data/log.json.`);
  return L.join('\n');
}

/* ---------- action table ---------- */
export const actions = {
  'toggle-task': async d => {
    const p = P(d.p), s = sub(d.p, d.s), t = task(d);
    if (!t) return;
    if (t.done) {
      t.done = false; t.done_date = null;
      const auto = S.log.entries.filter(e => e.task === `${s.id}/${t.id}` && e.auto && !e.text && !e.measurements?.length && !e.photos?.length);
      for (const e of auto) deleteLogEntry(e.id);
      await saveProject(p, `Reopen task: ${t.text.slice(0, 60)}`);
      if (auto.length) await save('data/log.json', 'Log: remove auto entry');
      rerender(); return;
    }
    const wait = waitingOn(p, t);
    openForm({
      title: 'Mark done', submitLabel: 'Mark done',
      extra: `<div class="field info"><b>${t.text.replace(/[<>&]/g, '')}</b>${wait.length ? `<br><small>Note: still waiting on ${wait.map(w => w.name).join(', ')}.</small>` : ''}</div>`,
      values: { date: today(), note: '', measurements: [], log: true },
      fields: [
        { key: 'date', label: 'Done on', type: 'date' },
        { key: 'note', label: 'Notes (optional)', type: 'textarea', rows: 3, placeholder: 'Anything worth remembering: what you found, what you\'d do differently.' },
        { key: 'measurements', label: 'Readings (optional)', type: 'measurements', specs: p.specs },
        { key: 'photos', label: 'Photos (optional)', type: 'photos' },
        { key: 'log', label: 'Add to the work log', type: 'checkbox' },
      ],
      onSave: async v => {
        t.done = true; t.done_date = v.date || today();
        if (s.status === 'todo') s.status = 'in_progress';
        const left = s.tasks.filter(x => !x.done).length;
        if (v.log) {
          const photos = await uploadAll(v.photos, 'files/photos');
          const e = { id: uniqueId(`${t.done_date}-${t.id}`, S.log.entries.map(x => x.id)), date: t.done_date, kind: 'work', project: p.id, subproject: s.id, area: p.area, title: t.text, text: v.note, task: `${s.id}/${t.id}`, auto: true };
          if (v.measurements.length) e.measurements = v.measurements;
          if (photos.length) e.photos = photos;
          S.log.entries.push(e);
          await save('data/log.json', `Log: ${t.text.slice(0, 60)}`);
        }
        await saveProject(p, `Done: ${t.text.slice(0, 60)}`);
        rerender();
        toast(left ? `Done. ${left} left in ${s.title}.` : `That was the last task in ${s.title}. Mark the sub-project done from its Edit button.`, 3500);
      },
    });
  },
  'edit-task': d => taskForm(P(d.p), sub(d.p, d.s), task(d)),
  'add-task': d => taskForm(P(d.p), sub(d.p, d.s), null),
  'add-sub': d => subForm(P(d.p), null),
  'edit-sub': d => subForm(P(d.p), sub(d.p, d.s)),
  'new-project': () => projectForm(null),
  'edit-project': d => projectForm(P(d.p)),
  'add-part': d => partForm(P(d.p), null),
  'edit-part': d => { const p = P(d.p); partForm(p, p.parts.find(x => x.id === d.id)); },
  'cycle-part': async d => {
    const p = P(d.p), pt = p.parts.find(x => x.id === d.id);
    const order = ['needed', 'in_cart', 'ordered', 'on_hand', 'installed'];
    const before = pt.status;
    pt.status = order[(order.indexOf(pt.status) + 1) % order.length];
    await partChanged(p, pt, before);
    await saveProject(p, `${pt.name}: ${PART_STATUS[pt.status]}`);
    rerender(); toast(`${pt.name}: ${PART_STATUS[pt.status]}`);
  },
  'edit-tool': d => {
    const p = P(d.p), t = p.tools[d.i];
    openForm({
      title: 'Tool', values: t,
      fields: [{ key: 'name', label: 'Name', required: true }, { key: 'status', label: 'Status', type: 'select', options: opts(TOOL_STATUS) }, { key: 'notes', label: 'Notes', type: 'textarea', rows: 2 }],
      onDelete: async () => { p.tools.splice(d.i, 1); await saveProject(p, `Remove tool ${t.name}`); rerender(); },
      onSave: async v => { Object.assign(t, v); await saveProject(p, `Edit tool ${v.name}`); rerender(); },
    });
  },
  'cycle-tool': async d => {
    const p = P(d.p), t = p.tools[d.i];
    const order = ['needed', 'have', 'borrow', 'rent'];
    t.status = order[(order.indexOf(t.status) + 1) % order.length];
    await saveProject(p, `${t.name}: ${TOOL_STATUS[t.status]}`); rerender();
  },
  'add-spec': d => specForm(P(d.p), null),
  'edit-spec': d => { const p = P(d.p); specForm(p, p.specs[d.i]); },
  'add-question': d => actions['edit-question']({ p: d.p, i: -1 }),
  'edit-question': d => {
    const p = P(d.p), isNew = Number(d.i) < 0, q = isNew ? { text: '', resolved: false, answer: '' } : p.open_questions[d.i];
    openForm({
      title: isNew ? 'Open question' : 'Question', values: q,
      fields: [{ key: 'text', label: 'Question', type: 'textarea', rows: 2, required: true }, { key: 'resolved', label: 'Answered', type: 'checkbox' }, { key: 'answer', label: 'Answer', type: 'textarea', rows: 3, show: v => v.resolved }],
      onDelete: isNew ? null : async () => { p.open_questions.splice(d.i, 1); await saveProject(p, 'Remove question'); rerender(); },
      onSave: async v => { if (isNew) p.open_questions.push(v); else Object.assign(q, v); await saveProject(p, isNew ? 'Add question' : 'Edit question'); rerender(); },
    });
  },
  'add-file': d => {
    const p = P(d.p);
    openForm({
      title: 'Add a document', values: { how: 'upload', kind: 'diagram' },
      fields: [
        { key: 'how', label: 'Add by', type: 'select', options: [{ value: 'upload', label: 'Uploading a file (photo, PDF, diagram)' }, { value: 'link', label: 'Link (e.g. a Claude artifact or web page)' }] },
        { key: 'title', label: 'Title', required: true },
        { key: 'file', label: 'File', type: 'photos', accept: 'image/*,.pdf,.md,.html,.csv,.svg,.txt', single: true, show: v => v.how === 'upload' },
        { key: 'kind', label: 'Kind', type: 'select', options: ['guide', 'sheet', 'diagram', 'photo', 'pdf', 'reference', 'list'], show: v => v.how === 'upload' },
        { key: 'url', label: 'Link', type: 'url', show: v => v.how === 'link' },
        { key: 'caption', label: 'Caption', type: 'textarea', rows: 2 },
      ],
      onSave: async v => {
        if (v.how === 'link') { if (!v.url) return toast('Add the link.'); p.links.push({ label: v.title, url: v.url }); }
        else {
          if (!v.file?.length) return toast('Choose a file.');
          const [path] = await uploadAll(v.file, `files/${p.id}/uploads`);
          p.files.push({ path, title: v.title, kind: v.kind, caption: v.caption });
        }
        await saveProject(p, `Add document ${v.title}`); rerender();
      },
    });
  },
  'log-here': d => logSomething({ project: d.p, subproject: d.s || '' }),
  'edit-entry': d => { const e = S.log.entries.find(x => x.id === d.id); if (e) logSomething({}, e); },
  'open-entry': d => { location.hash = '#/log'; setTimeout(() => actions['edit-entry'](d), 50); },
  'claude-brief': async d => { const ok = await copyText(brief(P(d.p))); toast(ok ? 'Copied. Paste it into a new Claude chat.' : 'Could not copy on this device.'); },
  jump: d => document.getElementById(d.to)?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
  'set-budget': d => { setPref('shopbook.budget', d.m); rerender(); },
  'set-today-proj': d => { setPref('shopbook.todayProj', d.id); rerender(); },
  'log-group': d => { LS.group = d.v; persistLog(); rerender(); },
  'log-kind': d => { LS.kind = d.v; persistLog(); rerender(); },
  'log-proj': d => { LS.project = d.v; persistLog(); rerender(); },
  'log-filter': d => { LS.project = d.p; persistLog(); location.hash = '#/log'; },
  'log-search': (d, form) => { LS.q = form.elements.q.value.trim(); rerender(); },
  search: (d, form) => { const q = form.elements.q.value.trim(); if (q) location.hash = `#/search/${encodeURIComponent(q)}`; },
  'save-settings': async (d, form) => {
    const c = cfg();
    for (const k of ['owner', 'repo', 'branch', 'token']) c[k] = form.elements[k].value.trim();
    setCfg(c);
    try { await testConnection(); toast('Connected. Edits now save to GitHub.'); await load(); syncNow(); }
    catch (e) { toast(e.message, 6000); }
    rerender();
  },
  'sync-now': async () => { await syncNow(); toast(pendingCount() ? (S.lastError || 'Not saved yet.') : 'Everything is saved.'); rerender(); },
  'set-theme': d => { setPref('shopbook.theme', d.v); applyTheme(); rerender(); },
  'reload-data': async () => { await load(); rerender(); toast('Data reloaded.'); },
  'discard-pending': async (d, el) => {
    if (!el.dataset.armed) { el.dataset.armed = '1'; el.textContent = 'Tap again: this deletes them for good'; return; }
    const db = await new Promise(r => { const q = indexedDB.open('shopbook', 1); q.onsuccess = () => r(q.result); });
    await new Promise(r => { const tx = db.transaction(['pending', 'photos'], 'readwrite'); tx.objectStore('pending').clear(); tx.objectStore('photos').clear(); tx.oncomplete = r; });
    S.pending = {}; S.photos = {}; await load(); rerender(); toast('Unsaved changes thrown away.');
  },
  backup: () => {
    const data = { index: S.index, car: S.car, log: S.log, projects: Object.fromEntries(S.projects) };
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    a.download = `shop-book-backup-${today()}.json`; a.click();
  },
  'save-offline': async () => {
    if (!navigator.serviceWorker?.controller) return toast('Offline saving starts after the site has loaded once over https.');
    const urls = allFiles().map(f => f.path).filter(Boolean);
    navigator.serviceWorker.controller.postMessage({ type: 'precache', urls });
    toast(`Saving ${urls.length} documents for offline use…`);
  },
  'edit-car': () => {
    openForm({
      title: 'The car', values: S.car,
      fields: [{ key: 'name', label: 'Name', required: true }, { key: 'subtitle', label: 'Subtitle' }],
      onSave: async v => { Object.assign(S.car, v); await save('data/car.json', 'Car: rename'); rerender(); },
    });
  },
  'add-section': () => {
    openForm({
      title: 'New section', values: {}, fields: [{ key: 'title', label: 'Section name', required: true, placeholder: 'e.g. Exhaust' }],
      onSave: async v => { S.car.sections.push({ id: uniqueId(v.title, S.car.sections.map(s => s.id)), title: v.title, fields: [] }); await save('data/car.json', `Car: add section ${v.title}`); rerender(); },
    });
  },
  'add-field': d => actions['edit-field']({ si: d.si, fi: -1 }),
  'edit-field': d => {
    const sec = S.car.sections[d.si], isNew = Number(d.fi) < 0;
    const f = isNew ? { label: '', value: '', notes: '', history: [] } : sec.fields[d.fi];
    openForm({
      title: isNew ? `Add to ${sec.title}` : f.label, values: { ...f, when: today() },
      extra: !isNew && f.history?.length ? `<div class="field info"><b>History</b><br>${f.history.map(h => `${h.value.replace(/[<>&]/g, '')} (until ${fmtDate(h.date)})`).join('<br>')}</div>` : '',
      fields: [
        { key: 'label', label: 'Label', required: true, placeholder: 'e.g. Tire size' },
        { key: 'value', label: 'Value', placeholder: 'e.g. 205/70R14' },
        { key: 'when', label: 'Changed on', type: 'date', show: () => !isNew, help: 'If the value changes, the old one is kept with this date.' },
        { key: 'notes', label: 'Notes', type: 'textarea', rows: 2 },
      ],
      onDelete: isNew ? null : async () => { sec.fields.splice(d.fi, 1); await save('data/car.json', `Car: remove ${f.label}`); rerender(); },
      onSave: async v => {
        if (!isNew && v.value !== f.value && f.value && f.value !== 'Unknown') (f.history ||= []).unshift({ date: v.when || today(), value: f.value });
        Object.assign(f, { label: v.label, value: v.value || 'Unknown', notes: v.notes, updated: v.when || today() });
        if (isNew) sec.fields.push(f);
        await save('data/car.json', `Car: ${v.label} = ${v.value}`); rerender();
      },
    });
  },
};
function persistLog() { try { localStorage.setItem('shopbook.log', JSON.stringify({ ...LS, q: '' })); } catch { } }

export function applyTheme() {
  let t = 'auto';
  try { t = localStorage.getItem('shopbook.theme') || 'auto'; } catch { }
  if (t === 'auto') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', t);
  $('meta[name="theme-color"]')?.setAttribute('content', getComputedStyle(document.documentElement).getPropertyValue('--band').trim() || '#1c4e9c');
}
applyTheme();
