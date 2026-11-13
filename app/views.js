// Views: Home, Today, Projects, Project, Sub-project, Docs, Doc viewer. Plus shared row renderers.
import { S, projects, stats, subStats, nextTask, projectState, doable, waitingOn, depsWaiting, logEntries, checkMeasurement, allFiles, pendingPhotoUrl, rawUrl, isPartReady } from './store.js';
import { esc, fmtDate, fmtMin, stamp, bar, AREAS, LOG_KINDS, SUB_STATUS, PART_STATUS, TOOL_STATUS, $$, today } from './ui.js';
import { md, csvTable } from './md.js';

/* ---------- shared bits ---------- */
export const band = ({ eyebrow = '', title, crumbs = '', right = '', body = '' }) => `<header class="band"><div class="inner">
  <div class="band-row"><div>${crumbs ? `<div class="crumbs">${crumbs}</div>` : ''}${eyebrow ? `<small>${eyebrow}</small>` : ''}<h1>${title}</h1></div>${right}</div>${body}</div></header>`;
const sec = (title, right = '') => `<div class="sec"><span>${title}</span>${right}</div>`;
const SUB_TONE = { todo: 'blue', in_progress: 'warn', blocked: 'bad', done: 'ok' };
export const subStamp = s => stamp(SUB_STATUS[s.status] || s.status, SUB_TONE[s.status] || '');
export const partStamp = p => stamp(PART_STATUS[p.status] || p.status, { needed: 'bad', in_cart: 'warn', ordered: 'warn', on_hand: 'ok', installed: 'ok', skip: 'mute' }[p.status]);
export const toolStamp = t => stamp(TOOL_STATUS[t.status] || t.status, { needed: 'bad', have: 'ok', borrow: 'warn', rent: 'warn' }[t.status]);
export const docHref = path => `#/doc/${encodeURIComponent(path)}`;
const fileKind = path => (path.match(/\.([a-z0-9]+)$/i)?.[1] || '').toLowerCase();
const isImg = path => /^(png|jpe?g|gif|webp|svg)$/.test(fileKind(path));

export function taskRow(p, s, t, { context = false } = {}) {
  const wait = waitingOn(p, t);
  const subs = [];
  if (context) subs.push(`<span>${esc(s.title)}</span>`);
  if (wait.length) subs.push(`<span class="wait">Waiting: ${esc(wait.map(x => x.name).join(', '))}</span>`);
  if (t.confirm) subs.push('<span class="conf">Confirm on the car</span>');
  if (t.skipped) subs.push('<span>Skipped: not needed</span>');
  else if (t.done && t.done_date) subs.push(`<span>Done ${fmtDate(t.done_date)}</span>`);
  return `<div class="task${t.done ? ' done' : ''}">
    <button class="tick" data-act="toggle-task" data-p="${esc(p.id)}" data-s="${esc(s.id)}" data-t="${esc(t.id)}" aria-label="${t.done ? 'Mark not done' : 'Mark done'}: ${esc(t.text)}"><span>${t.done ? '✓' : ''}</span></button>
    <div class="txt" data-act="edit-task" data-p="${esc(p.id)}" data-s="${esc(s.id)}" data-t="${esc(t.id)}"><span>${esc(t.text)}</span>${subs.length ? `<div class="sub">${subs.join('')}</div>` : ''}</div>
    <span class="est" title="${t.est_guess ? 'Rough guess' : 'Estimate'}">${t.done ? '' : fmtMin(t.est_min) + (t.est_guess && t.est_min ? '?' : '')}</span>
  </div>`;
}

export function entryCard(e, showDate = true) {
  const p = S.projects.get(e.project);
  const sub = p?.subprojects.find(s => s.id === e.subproject);
  const meas = (e.measurements || []).map(m => {
    const c = checkMeasurement(m, e.project);
    const val = m.value == null ? '' : `${esc(m.value)} ${esc(m.unit || '')}`;
    return `<span class="meas"><span>${esc(m.what || '')}${m.location ? ` @ ${esc(m.location)}` : ''}</span><b>${val}</b>${c ? `<span class="${c.ok ? 'in' : 'out'}">${c.ok ? '✓ in spec' : '✕ out of spec'}</span>` : ''}</span>`;
  }).join('');
  const tags = showDate && e.date ? [fmtDate(e.date), LOG_KINDS[e.kind] || e.kind] : [LOG_KINDS[e.kind] || e.kind];
  if (p) tags.push(sub ? `${p.title.split(':')[0]} › ${sub.title}` : p.title);
  else if (e.area) tags.push(AREAS[e.area] || e.area);
  if (e.cost != null && e.cost !== '') tags.push(`$${Number(e.cost).toFixed(2)}`);
  if (e.odometer) tags.push(`${Number(e.odometer).toLocaleString()} mi`);
  if (e.date_approx) tags.push('date approx.');
  return `<div class="entry" data-act="edit-entry" data-id="${esc(e.id)}" role="button" tabindex="0">
    <span class="dot ${esc(e.kind)}" aria-hidden="true"></span>
    <div class="body">${e.title ? `<h4>${esc(e.title)}</h4>` : ''}${e.text ? `<div class="md">${md(e.text)}</div>` : ''}${meas}
      ${e.photos?.length ? `<div class="thumbs">${e.photos.map(ph => `<a href="${docHref(ph)}" data-stop><img data-photo="${esc(ph)}" alt="Photo" loading="lazy"></a>`).join('')}</div>` : ''}
      <div class="tags">${tags.map(t => `<span>${esc(t)}</span>`).join('')}</div></div></div>`;
}

export function docCard(f) {
  const thumb = isImg(f.path) ? `<img data-photo="${esc(f.path)}" alt="" loading="lazy">` : `<span>${esc((fileKind(f.path) || 'link').toUpperCase())}</span>`;
  const href = f.url ? esc(f.url) : docHref(f.path);
  return `<a class="doc${f.primary ? ' primary' : ''}" href="${href}"${f.url ? ' target="_blank" rel="noopener"' : ''}><div class="thumb">${thumb}</div>
    <div class="cap"><small>${esc(f.primary ? 'Main guide' : f.kind || '')}</small>${esc(f.title || f.path.split('/').pop())}</div></a>`;
}

// Images: pending photos come from the device; fresh uploads fall back to raw GitHub while Pages rebuilds.
export function afterRender(root) {
  for (const img of $$('img[data-photo]', root)) {
    const path = img.dataset.photo;
    if (S.photos[path]) pendingPhotoUrl(path).then(u => { if (u) img.src = u; });
    else { img.src = path; img.onerror = () => { img.onerror = null; img.src = rawUrl(path); }; }
  }
  for (const a of $$('[data-stop]', root)) a.addEventListener('click', e => e.stopPropagation());
}

export function routeContext() {
  const m = location.hash.match(/^#\/p\/([^/]+)(?:\/([^/]+))?/);
  return m ? { project: m[1], subproject: m[2] || '' } : {};
}

/* ---------- Home ---------- */
function carChips() {
  const want = ['engine', 'transmission', 'current state', 'status'];
  const out = [];
  for (const sec of S.car.sections || []) for (const f of sec.fields || []) {
    if (want.includes(f.label.toLowerCase()) && f.value && f.value !== 'Unknown') out.push(f.value.split(/[;,(]/)[0].trim());
  }
  return out.slice(0, 4);
}

export function home() {
  const active = projects().filter(p => p.status === 'active');
  const other = projects().filter(p => p.status !== 'active' && p.status !== 'done');
  const picks = active.map(p => nextTask(p) && { p, ...nextTask(p) }).filter(Boolean).slice(0, 3);
  const pinned = [];
  for (const p of active) for (const s of p.specs) if (s.pinned) pinned.push(s);
  if (!pinned.length) for (const p of active) pinned.push(...p.specs.filter(s => /ft-lb|^$/.test(s.unit || '')).slice(0, 4));
  const parts = {};
  for (const p of projects()) for (const pt of p.parts) parts[pt.status] = (parts[pt.status] || 0) + 1;
  const guides = allFiles().filter(f => f.primary);
  const recent = logEntries().slice(0, 3);

  return band({
    eyebrow: esc(S.car.subtitle ? `${S.car.name} · ${S.car.subtitle}` : S.car.name || ''),
    title: 'Shop Book',
    right: `<a class="icon-btn" href="#/settings" aria-label="Settings">⚙</a>`,
    body: `<div class="chips-line">${carChips().map(c => `<span class="spec-chip">${esc(c)}</span>`).join('')}</div>
      <form class="search" data-act="search" style="margin-top:14px"><input id="home-search" name="q" type="search" placeholder="Search tasks, specs, log, docs…" aria-label="Search"></form>`,
  }) + `<div class="page">
    <section class="block">${sec('Sec. 1 · Active projects', '<a href="#/projects">All projects</a>')}
      ${active.map(projectCard).join('') || '<div class="empty">No active projects. <a href="#/projects">Start one</a>.</div>'}
      ${other.length ? `<p class="muted" style="margin:0">Also on the list: ${other.map(p => `<a href="#/p/${esc(p.id)}">${esc(p.title)}</a>`).join(', ')}</p>` : ''}
    </section>
    <section class="block">${sec('Sec. 2 · Ready to go', '<a href="#/today">Plan today</a>')}
      ${picks.length ? `<div class="tasks">${picks.map(x => taskRow(x.p, x.s, x.t, { context: true })).join('')}</div>` : '<div class="empty">Nothing is doable right now. Everything is waiting on parts.</div>'}
    </section>
    <section class="block">${sec('Sec. 3 · Latest in the log', '<a href="#/log">Full log</a>')}
      <div class="log-group">${recent.map(entryCard).join('') || '<div class="empty">No log entries yet.</div>'}</div>
    </section>
    <section class="block">${sec('Sec. 4 · Quick specs', '<a href="#/specs">All specs</a>')}
      <div class="specs">${pinned.slice(0, 6).map(specRow).join('') || '<div class="specrow muted">No specs yet.</div>'}</div>
    </section>
    <section class="block">${sec('Sec. 5 · Shelf', '<a href="#/docs">All documents</a>')}
      <div class="docs">${guides.map(docCard).join('')}</div>
      <a class="card" href="#/parts"><div class="row"><h4>Parts &amp; tools</h4><span class="meta">${['needed', 'in_cart', 'ordered', 'on_hand'].filter(k => parts[k]).map(k => `${parts[k]} ${PART_STATUS[k].toLowerCase()}`).join(' · ') || 'none listed'}</span></div></a>
    </section>
  </div>`;
}

export function projectCard(p) {
  const st = stats(p), state = projectState(p), nt = nextTask(p);
  return `<a class="card" href="#/p/${esc(p.id)}">
    <div class="row"><h3>${esc(p.title)}</h3>${stamp(state.label, state.tone)}</div>
    <div class="meta"><span>${esc(AREAS[p.area] || p.area || '')}</span><span>${p.subprojects.length} sub-projects</span><span class="num">${st.done} / ${st.total} tasks</span></div>
    ${bar(st.done, st.total)}
    ${p.next_step ? `<div class="next"><b>Next</b>${esc(p.next_step)}</div>` : ''}
    ${nt && (!p.next_step || p.status === 'active') ? `<div class="next"><b>Can do now</b>${esc(nt.t.text)}</div>` : ''}
  </a>`;
}

export const specRow = s => `<div class="specrow"><span>${esc(s.item)}</span><span class="v">${esc(s.value)} ${esc(s.unit || '')}</span>${s.notes ? `<small>${esc(s.notes)}</small>` : ''}</div>`;

/* ---------- Today ---------- */
const BUDGETS = [[15, '15 min'], [30, '30 min'], [60, '1 hr'], [120, '2 hrs'], [240, 'Half day'], [480, 'Full day']];
const getPref = (k, d) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } };
export function today_state() { return { budget: Number(getPref('shopbook.budget', 120)), proj: getPref('shopbook.todayProj', 'all') }; }

export function todayView() {
  const { budget, proj } = today_state();
  const act = projects().filter(p => p.status === 'active' && (proj === 'all' || p.id === proj));
  const plans = [], tooBig = [], waiting = [], blockedSubs = [];
  for (const p of act) for (const s of p.subprojects) {
    if (s.status === 'done') continue;
    if (s.status === 'blocked') { if (s.tasks.some(t => !t.done)) blockedSubs.push({ p, s }); continue; }
    const deps = depsWaiting(p, s);
    if (deps.length) { blockedSubs.push({ p, s, after: deps.map(d => d.s.title) }); continue; }
    const open = s.tasks.filter(t => !t.done);
    if (!open.length) continue;
    const seq = []; let total = 0;
    for (const t of open) {
      if (waitingOn(p, t).length) break;
      const m = t.est_min || 30;
      if (total + m > budget) break;
      seq.push(t); total += m;
    }
    if (seq.length) plans.push({ p, s, tasks: seq, total, more: open.length - seq.length });
    else if (!waitingOn(p, open[0]).length) tooBig.push({ p, s, t: open[0] });
    for (const t of open) { const w = waitingOn(p, t); if (w.length) waiting.push({ p, s, t, w }); }
  }
  // Work already under way comes first, then whatever fills the time best.
  const score = x => x.total / budget + (x.s.status === 'in_progress' ? 1 : 0);
  plans.sort((a, b) => score(b) - score(a));
  const SHOW = 5;

  const chips = BUDGETS.map(([m, l]) => `<button class="chip" data-act="set-budget" data-m="${m}" aria-pressed="${m === budget}">${l}</button>`).join('');
  const pchips = [`<button class="chip" data-act="set-today-proj" data-id="all" aria-pressed="${proj === 'all'}">All projects</button>`,
    ...projects().filter(p => p.status === 'active').map(p => `<button class="chip" data-act="set-today-proj" data-id="${esc(p.id)}" aria-pressed="${proj === p.id}">${esc(p.title.split(':')[0])}</button>`)].join('');

  return band({
    eyebrow: esc(fmtDate(today(), true)), title: 'What fits today',
    body: `<p>Pick how long you have. Each plan is the next tasks from one sub-project, in order, that fit the time. Times ending in ? are rough guesses. Tap a task to fix its time.</p>`,
  }) + `<div class="page">
    <div class="scroller"><div class="chips" role="group" aria-label="Time available">${chips}</div></div>
    <div class="scroller"><div class="chips" role="group" aria-label="Project">${pchips}</div></div>
    <section class="block">${sec(`Plans that fit ${BUDGETS.find(b => b[0] === budget)?.[1] || fmtMin(budget)}`)}
      ${plans.map((x, i) => `${i === SHOW ? `<details class="block"><summary class="btn">Show ${plans.length - SHOW} more plans</summary><div class="block" style="margin-top:10px">` : ''}<div class="plan"><div class="plan-head">
          <div class="row"><h3><a href="#/p/${esc(x.p.id)}/${esc(x.s.id)}">${esc(x.s.title)}</a></h3>${subStamp(x.s)}</div>
          <div class="meta"><span>${esc(x.p.title)}</span>${x.more ? `<span>${x.more} more after this</span>` : '<span>finishes the sub-project</span>'}</div>
          <div class="fill">${bar(x.total, budget)}<span>${fmtMin(x.total)} of ${fmtMin(budget)}</span></div></div>
        <div class="tasks" style="border:0">${x.tasks.map(t => taskRow(x.p, x.s, t)).join('')}</div></div>${i === plans.length - 1 && plans.length > SHOW ? '</div></details>' : ''}`).join('') ||
        '<div class="empty">Nothing fits that window. Try a longer one, or check what\'s waiting on parts below.</div>'}
    </section>
    ${tooBig.length ? `<section class="block">${sec('Needs a longer session')}<div class="tasks">${tooBig.map(x => taskRow(x.p, x.s, x.t, { context: true })).join('')}</div></section>` : ''}
    ${waiting.length || blockedSubs.length ? `<section class="block">${sec('Waiting on', '<a href="#/parts">Parts list</a>')}
      <div class="waiting-list">${blockedSubs.map(x => `<div><a href="#/p/${esc(x.p.id)}/${esc(x.s.id)}">${esc(x.s.title)}</a><span class="why">${esc(x.after ? `after ${x.after.join(', ')}` : x.s.blocked_by || 'blocked')}</span></div>`).join('')}
      ${waiting.map(x => `<div><span>${esc(x.t.text)}</span><span class="why">${esc(x.w.map(w => `${w.name}: ${PART_STATUS[w.status] || w.status}`).join('; '))}</span></div>`).join('')}</div></section>` : ''}
  </div>`;
}

/* ---------- Projects ---------- */
export function projectList() {
  const groups = [['active', 'Active'], ['paused', 'Paused'], ['idea', 'Ideas & someday'], ['done', 'Complete']];
  return band({ eyebrow: esc(S.car.name || ''), title: 'Projects', right: `<button class="btn primary small" data-act="new-project">＋ New</button>` }) +
    `<div class="page">${groups.map(([k, l], i) => {
      const list = projects().filter(p => (p.status || 'active') === k);
      return list.length ? `<section class="block">${sec(`Sec. ${i + 1} · ${l}`)}${list.map(projectCard).join('')}</section>` : '';
    }).join('') || '<div class="empty">No projects yet.</div>'}
    <p class="muted">Finished jobs from before this site existed belong in the <a href="#/log">log</a>: add an entry with the old date.</p></div>`;
}

export function project(id) {
  const p = S.projects.get(id);
  if (!p) return `<div class="page"><div class="empty">No project called "${esc(id)}". <a href="#/projects">All projects</a></div></div>`;
  const st = stats(p), state = projectState(p);
  const primary = p.files.find(f => f.primary);
  const entries = logEntries().filter(e => e.project === p.id);
  const nt = nextTask(p);
  const openQ = p.open_questions.filter(q => !q.resolved);
  const jump = [['subs', 'Sub-projects'], ['docs', 'Documents'], ['parts', 'Parts & tools'], ['specs', 'Specs'], ['plog', 'Log'], ['notes', 'Decisions & questions']];
  return band({
    crumbs: `<a href="#/projects">Projects</a> ›`, title: esc(p.title),
    right: stamp(state.label, state.tone),
    body: `${p.goal ? `<p><b>Goal:</b> ${esc(p.goal)}</p>` : ''}
      <div class="chips-line"><span class="spec-chip">${esc(AREAS[p.area] || p.area || '')}</span><span class="spec-chip num">${st.done}/${st.total} tasks</span>${p.started ? `<span class="spec-chip">Since ${fmtDate(p.started)}</span>` : ''}</div>`,
  }) + `<div class="page wide">
    <div class="btn-row">
      ${primary ? `<a class="btn primary" href="${docHref(primary.path)}">Open the guide</a>` : ''}
      <button class="btn" data-act="log-here" data-p="${esc(p.id)}">＋ Log</button>
      <button class="btn" data-act="edit-project" data-p="${esc(p.id)}">Edit</button>
      <button class="btn ghost" data-act="claude-brief" data-p="${esc(p.id)}">Copy brief for Claude</button>
    </div>
    <div class="card"><div class="next"><b>Next step</b>${esc(p.next_step || 'Not set.')}</div>
      ${nt ? `<div class="next"><b>Can do now</b><a href="#/p/${esc(p.id)}/${esc(nt.s.id)}">${esc(nt.t.text)}</a></div>` : '<div class="next"><b>Can do now</b>Nothing. Every open task is waiting on parts or blocked.</div>'}
      ${p.summary ? `<details><summary class="muted">Background</summary><div class="md prose">${md(p.summary)}</div></details>` : ''}</div>
    <div class="scroller"><div class="chips">${jump.map(([k, l]) => `<button class="chip" data-act="jump" data-to="${k}">${l}</button>`).join('')}</div></div>
    <div class="two">
    <section class="block" id="subs">${sec('Sec. 1 · Sub-projects', `<button data-act="add-sub" data-p="${esc(p.id)}">＋ Add</button>`)}
      ${p.subprojects.map(s => subCard(p, s)).join('')}</section>
    <div class="block" style="align-content:start">
    <section class="block" id="docs">${sec('Sec. 2 · Documents', `<button data-act="add-file" data-p="${esc(p.id)}">＋ Add</button>`)}
      <div class="docs">${p.files.map(docCard).join('')}${p.links.map(l => docCard({ url: l.url, title: l.label, kind: 'link', path: '' })).join('')}</div></section>
    <section class="block" id="parts">${sec('Sec. 3 · Parts & tools', `<button data-act="add-part" data-p="${esc(p.id)}">＋ Part</button>`)}
      ${partsRows(p)}</section>
    <section class="block" id="specs">${sec('Sec. 4 · Specs', `<button data-act="add-spec" data-p="${esc(p.id)}">＋ Add</button>`)}
      <div class="specs">${p.specs.map((s, i) => `<div data-act="edit-spec" data-p="${esc(p.id)}" data-i="${i}" role="button" tabindex="0">${specRow(s)}</div>`).join('') || '<div class="specrow muted">None yet.</div>'}</div></section>
    </div></div>
    <section class="block" id="plog">${sec('Sec. 5 · Log for this project', `<a href="#/log" data-act="log-filter" data-p="${esc(p.id)}">All ${entries.length}</a>`)}
      <div class="log-group">${entries.slice(0, 6).map(entryCard).join('') || '<div class="empty">Nothing logged yet.</div>'}</div></section>
    <section class="block" id="notes">${sec('Sec. 6 · Decisions & open questions', `<button data-act="add-question" data-p="${esc(p.id)}">＋ Question</button>`)}
      ${openQ.length ? `<div class="rows">${p.open_questions.map((q, i) => q.resolved ? '' : `<div data-act="edit-question" data-p="${esc(p.id)}" data-i="${i}" role="button"><span class="main">${esc(q.text)}</span>${stamp('Open', 'warn')}</div>`).join('')}</div>` : ''}
      ${p.decisions.length ? `<div class="rows">${p.decisions.map(d => `<div><span class="main">${esc(d.text)}</span><span class="meta">${fmtDate(d.date)}</span></div>`).join('')}</div>` : ''}
      ${p.open_questions.some(q => q.resolved) ? `<details><summary class="muted">Answered questions</summary><div class="rows">${p.open_questions.map((q, i) => q.resolved ? `<div data-act="edit-question" data-p="${esc(p.id)}" data-i="${i}" role="button"><span class="main">${esc(q.text)}<small>${esc(q.answer || '')}</small></span>${stamp('Answered', 'ok')}</div>` : '').join('')}</div></details>` : ''}
      ${p.sources.length ? `<details><summary class="muted">Sources (${p.sources.length})</summary><ul>${p.sources.map(s => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a></li>`).join('')}</ul></details>` : ''}
    </section>
  </div>`;
}

function partsRows(p) {
  const parts = [...p.parts].sort((a, b) => Number(isPartReady(a)) - Number(isPartReady(b)));
  const rows = parts.map(pt => `<div><span class="main" data-act="edit-part" data-p="${esc(p.id)}" data-id="${esc(pt.id)}" role="button">${esc(pt.name)}<small>${[pt.vendor, pt.part_number, pt.price != null ? `$${pt.price}` : '', pt.notes].filter(Boolean).map(esc).join(' · ')}</small></span>
    <button class="status-btn" data-act="cycle-part" data-p="${esc(p.id)}" data-id="${esc(pt.id)}" aria-label="Change status">${partStamp(pt)}</button></div>`).join('');
  const tools = p.tools.map((t, i) => `<div><span class="main" data-act="edit-tool" data-p="${esc(p.id)}" data-i="${i}" role="button">${esc(t.name)}<small>Tool${t.notes ? ' · ' + esc(t.notes) : ''}</small></span>
    <button class="status-btn" data-act="cycle-tool" data-p="${esc(p.id)}" data-i="${i}" aria-label="Change status">${toolStamp(t)}</button></div>`).join('');
  return (rows || tools) ? `<div class="rows">${rows}${tools}</div><p class="muted" style="margin:0;font-size:.85rem">Tap a stamp to move it along: needed → in cart → ordered → on hand.</p>` : '<div class="empty">No parts listed.</div>';
}

function subCard(p, s) {
  const st = subStats(s);
  const nt = s.tasks.find(t => !t.done);
  const deps = s.status === 'done' ? [] : depsWaiting(p, s);
  return `<a class="card" href="#/p/${esc(p.id)}/${esc(s.id)}">
    <div class="row"><h4>${esc(s.title)}</h4>${subStamp(s)}</div>
    ${deps.length ? `<div class="meta"><span style="color:var(--red)">After: ${esc(deps.map(d => d.s.title).join(', '))}</span></div>` : ''}
    <div class="meta"><span class="num">${st.done} / ${st.total} tasks</span>${s.files.length ? `<span>${s.files.length} docs</span>` : ''}</div>
    ${bar(st.done, st.total)}
    ${s.status === 'blocked' && s.blocked_by ? `<div class="next"><b>Blocked</b>${esc(s.blocked_by)}</div>` : nt ? `<div class="next"><b>Next</b>${esc(nt.text)}</div>` : ''}
  </a>`;
}

export function subproject(pid, sid) {
  const p = S.projects.get(pid);
  const s = p?.subprojects.find(x => x.id === sid);
  if (!s) return `<div class="page"><div class="empty">Sub-project not found. <a href="#/p/${esc(pid)}">Back to project</a></div></div>`;
  const st = subStats(s);
  const entries = logEntries().filter(e => e.project === pid && e.subproject === sid);
  const idx = p.subprojects.indexOf(s);
  const prev = p.subprojects[idx - 1], next = p.subprojects[idx + 1];
  const files = s.files.map(path => p.files.find(f => f.path === path) || { path, title: path.split('/').pop() });
  const primary = p.files.find(f => f.primary);
  return band({
    crumbs: `<a href="#/projects">Projects</a> › <a href="#/p/${esc(p.id)}">${esc(p.title)}</a> ›`, title: esc(s.title),
    right: subStamp(s),
    body: `${s.goal ? `<p><b>Goal:</b> ${esc(s.goal)}</p>` : ''}<div class="chips-line"><span class="spec-chip num">${st.done}/${st.total} tasks</span>
      <span class="spec-chip">${fmtMin(s.tasks.filter(t => !t.done).reduce((a, t) => a + (t.est_min || 30), 0)) || '0 min'} left (est.)</span></div>`,
  }) + `<div class="page">
    <div class="btn-row">
      ${primary ? `<a class="btn primary" href="${docHref(primary.path)}">Open the guide</a>` : ''}
      <button class="btn" data-act="log-here" data-p="${esc(p.id)}" data-s="${esc(s.id)}">＋ Log</button>
      <button class="btn" data-act="edit-sub" data-p="${esc(p.id)}" data-s="${esc(s.id)}">Edit</button>
    </div>
    ${s.status === 'blocked' && s.blocked_by ? `<div class="banner"><b>Blocked:</b> ${esc(s.blocked_by)}</div>` : ''}
    ${s.status !== 'done' && depsWaiting(p, s).length ? `<div class="banner"><b>Comes after:</b> ${depsWaiting(p, s).map(d => `<a href="#/p/${esc(d.p.id)}/${esc(d.s.id)}">${esc(d.s.title)}</a>`).join(', ')}. Its tasks stay off the Today list until then.</div>` : ''}
    ${s.summary ? `<div class="card md prose">${md(s.summary)}</div>` : ''}
    <section class="block">${sec('Tasks', `<button data-act="add-task" data-p="${esc(p.id)}" data-s="${esc(s.id)}">＋ Add task</button>`)}
      <div class="tasks">${s.tasks.map(t => taskRow(p, s, t)).join('') || '<div class="empty" style="border:0">No tasks yet.</div>'}</div>
      <p class="muted" style="margin:0;font-size:.85rem">Tap the box when it's done. Tap the text to edit it, add how-to detail, set the time, or link parts.</p></section>
    ${s.notes.length ? `<section class="block">${sec('Notes')}<div class="card md">${md(s.notes.map(n => `- ${n}`).join('\n'))}</div></section>` : ''}
    ${files.length ? `<section class="block">${sec('Diagrams & docs')}<div class="docs">${files.map(docCard).join('')}</div></section>` : ''}
    <section class="block">${sec('Log', `<button data-act="log-here" data-p="${esc(p.id)}" data-s="${esc(s.id)}">＋ Log</button>`)}
      <div class="log-group">${entries.map(entryCard).join('') || '<div class="empty">Nothing logged here yet. Measurements and findings you log here show up on this page.</div>'}</div></section>
    <div class="row">${prev ? `<a href="#/p/${esc(p.id)}/${esc(prev.id)}">‹ ${esc(prev.title)}</a>` : '<span></span>'}${next ? `<a href="#/p/${esc(p.id)}/${esc(next.id)}">${esc(next.title)} ›</a>` : ''}</div>
  </div>`;
}

/* ---------- Docs ---------- */
export function docs() {
  const files = allFiles();
  const byProj = new Map();
  for (const f of files) { if (!byProj.has(f.project.id)) byProj.set(f.project.id, []); byProj.get(f.project.id).push(f); }
  return band({ eyebrow: 'Library', title: 'Documents', body: '<p>Guides, install sheets, diagrams, photos and references, filed by project.</p>' }) +
    `<div class="page"><div class="btn-row"><button class="btn small" data-act="save-offline">Save all for offline</button></div>
    ${[...byProj.values()].map((list, i) => `<section class="block">${sec(`Sec. ${i + 1} · ${esc(list[0].project.title)}`)}
      ${['guide', 'sheet', 'pdf', 'diagram', 'photo', 'reference', 'list'].map(k => {
        const fs = list.filter(f => (f.kind || 'reference') === k);
        return fs.length ? `<h3 class="meta" style="margin-top:6px">${esc(k === 'pdf' ? 'PDFs' : k === 'list' ? 'Lists' : k[0].toUpperCase() + k.slice(1) + 's')}</h3><div class="docs">${fs.map(docCard).join('')}</div>` : '';
      }).join('')}</section>`).join('')}</div>`;
}

const docCache = new Map();
export function doc(path) {
  const f = allFiles().find(x => x.path === path) || { path, title: path.split('/').pop() };
  const ext = fileKind(path);
  const back = f.project ? `<a href="#/p/${esc(f.project.id)}">${esc(f.project.title)}</a> ›` : `<a href="#/docs">Documents</a> ›`;
  let body;
  if (isImg(path)) body = `<div class="viewer img"><img data-photo="${esc(path)}" alt="${esc(f.title)}"></div><p class="muted" style="margin:0">Pinch to zoom, or open the full image in a new tab.</p>`;
  else if (ext === 'html' || ext === 'htm') body = `<div class="viewer frame"><iframe src="${esc(path)}" title="${esc(f.title)}"></iframe></div>`;
  else if (ext === 'pdf') body = `<div class="viewer frame"><iframe src="${esc(path)}" title="${esc(f.title)}"></iframe></div><p class="muted" style="margin:0">On a phone the PDF may show only its first page here. Use "Open in new tab" to get the full document.</p>`;
  else if (ext === 'md' || ext === 'csv' || ext === 'txt') {
    if (!docCache.has(path)) {
      docCache.set(path, null);
      fetch(path).then(r => r.ok ? r.text() : Promise.reject(r.status)).then(t => { docCache.set(path, t); window.dispatchEvent(new Event('rerender')); })
        .catch(() => { docCache.set(path, false); window.dispatchEvent(new Event('rerender')); });
    }
    const t = docCache.get(path);
    body = `<div class="viewer md">${t === null ? '<p class="muted">Loading…</p>' : t === false ? '<p>Could not load this file. If you are offline, open it once while online so it gets saved.</p>' :
      ext === 'md' ? md(t, path) : ext === 'csv' ? csvTable(t) : `<pre>${esc(t)}</pre>`}</div>`;
  } else body = `<div class="empty">This file type opens in its own tab.</div>`;
  return band({ crumbs: back, title: esc(f.title || path.split('/').pop()), body: f.caption ? `<p>${esc(f.caption)}</p>` : '' }) +
    `<div class="page wide"><div class="btn-row"><a class="btn small" href="${esc(path)}" target="_blank" rel="noopener">Open in new tab</a></div>${body}</div>`;
}
