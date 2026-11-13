// Views: Log, Car, Specs, Parts, Search, Settings.
import { S, projects, logEntries, cfg, canSync, pendingCount, isPartReady } from './store.js';
import { esc, fmtDate, stamp, AREAS, LOG_KINDS, PART_STATUS, TOOL_STATUS } from './ui.js';
import { band, entryCard, specRow, partStamp, toolStamp, taskRow, docHref } from './views.js';

const sec = (title, right = '') => `<div class="sec"><span>${title}</span>${right}</div>`;

/* ---------- Log ---------- */
export const LS = { group: 'date', kind: 'all', project: 'all', q: '' };
try { Object.assign(LS, JSON.parse(localStorage.getItem('shopbook.log') || '{}'), { q: '' }); } catch { }

export function log() {
  let list = logEntries();
  if (LS.kind !== 'all') list = list.filter(e => e.kind === LS.kind);
  if (LS.project !== 'all') list = list.filter(e => LS.project === 'none' ? !e.project : e.project === LS.project);
  if (LS.q) {
    const q = LS.q.toLowerCase();
    list = list.filter(e => JSON.stringify([e.title, e.text, e.measurements]).toLowerCase().includes(q));
  }
  const groups = new Map();
  const add = (k, e) => { if (!groups.has(k)) groups.set(k, []); groups.get(k).push(e); };
  for (const e of list) {
    if (LS.group === 'date') add(e.date ? fmtDate(e.date, true) : 'Undated', e);
    else if (LS.group === 'month') add(e.date ? new Date(e.date + 'T12:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : 'Undated', e);
    else if (LS.group === 'area') add(AREAS[e.area || S.projects.get(e.project)?.area] || 'General', e);
    else if (LS.group === 'kind') add(LOG_KINDS[e.kind] || e.kind, e);
    else add(S.projects.get(e.project)?.title || 'Not tied to a project', e);
  }
  const sel = (act, label, cur, options) => `<label class="field" for="${act}"><span>${label}</span><select id="${act}" data-change="${act}">${options.map(([v, l]) => `<option value="${esc(v)}"${v === cur ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select></label>`;
  const counts = {};
  for (const e of S.log.entries) counts[e.kind] = (counts[e.kind] || 0) + 1;
  return band({
    eyebrow: `${S.log.entries.length} entries`, title: 'Work log',
    body: `<p>Everything you've done, measured or found. Back-date an entry to record work from before this site existed.</p>`,
  }) + `<div class="page">
    <div class="filters">
      ${sel('log-group', 'Group by', LS.group, [['date', 'Day'], ['month', 'Month'], ['area', 'Area'], ['project', 'Project'], ['kind', 'Type']])}
      ${sel('log-kind', 'Show', LS.kind, [['all', 'Everything'], ...Object.entries(LOG_KINDS).filter(([k]) => counts[k]).map(([k, l]) => [k, `${l} (${counts[k]})`])])}
      ${sel('log-proj', 'Project', LS.project, [['all', 'All projects'], ...projects().map(p => [p.id, p.title.split(':')[0]]), ['none', 'No project']])}
    </div>
    <form class="search" data-act="log-search"><input id="log-q" name="q" type="search" value="${esc(LS.q)}" placeholder="Search the log (e.g. 12 V, journal, relay)" aria-label="Search the log"></form>
    ${[...groups].map(([k, es]) => `<section class="log-group"><h3>${esc(k)} · ${es.length}</h3>${es.map(e => entryCard(e, LS.group !== 'date')).join('')}</section>`).join('') ||
      '<div class="empty">No entries match. Clear a filter, or tap ＋ LOG to add one.</div>'}
  </div>`;
}

/* ---------- Car ---------- */
export function car() {
  const c = S.car;
  return band({
    eyebrow: 'Vehicle record', title: esc(c.name || 'The car'),
    right: `<button class="icon-btn" data-act="edit-car" aria-label="Edit name">✎</button>`,
    body: `${c.subtitle ? `<p>${esc(c.subtitle)}</p>` : ''}<p style="font-size:.9rem">Tap any line to change it. The old value is kept with the date it changed, so you can see when the engine, wheels or tires were swapped.</p>`,
  }) + `<div class="page">
    ${(c.sections || []).map((s, si) => `<section class="block">${sec(`Sec. ${si + 1} · ${esc(s.title)}`, `<button data-act="add-field" data-si="${si}">＋ Add</button>`)}
      <div class="fields">${(s.fields || []).map((f, fi) => `<div class="fieldrow" data-act="edit-field" data-si="${si}" data-fi="${fi}" role="button" tabindex="0">
        <span class="k">${esc(f.label)}</span><span class="v${!f.value || f.value === 'Unknown' ? ' unknown' : ''}">${esc(f.value || 'Unknown')}
        ${f.notes ? `<small>${esc(f.notes)}</small>` : ''}
        ${f.history?.length ? `<small>Before: ${f.history.slice(0, 2).map(h => `${esc(h.value)} (until ${fmtDate(h.date)})`).join('; ')}</small>` : ''}</span></div>`).join('') ||
        '<div class="fieldrow muted">Nothing recorded yet.</div>'}</div></section>`).join('')}
    <button class="btn" data-act="add-section">＋ Add a section</button>
  </div>`;
}

/* ---------- Specs ---------- */
export function specs() {
  return band({ eyebrow: 'Reference', title: 'Specs & torque', body: '<p>Every spec from every project. Type to filter.</p>' }) +
    `<div class="page"><div class="search"><input type="search" data-filter="#spec-list" placeholder="Filter (e.g. rod, ft-lb, endplay)" aria-label="Filter specs"></div>
    <div id="spec-list" class="block">${projects().filter(p => p.specs.length).map(p => `<section class="block" data-group>${sec(esc(p.title))}
      <div class="specs">${p.specs.map((s, i) => `<div data-act="edit-spec" data-p="${esc(p.id)}" data-i="${i}" role="button" tabindex="0" data-item>${specRow(s)}</div>`).join('')}</div></section>`).join('') || '<div class="empty">No specs yet.</div>'}</div></div>`;
}

/* ---------- Parts ---------- */
export function parts() {
  const all = [];
  for (const p of projects()) for (const pt of p.parts) all.push({ p, pt });
  const order = ['needed', 'in_cart', 'ordered', 'on_hand', 'installed', 'skip'];
  const money = list => list.reduce((a, x) => a + (Number(x.pt.price) || 0) * (Number(x.pt.qty) || 1), 0);
  const tools = [];
  for (const p of projects()) p.tools.forEach((t, i) => tools.push({ p, t, i }));
  return band({ eyebrow: 'Shopping', title: 'Parts & tools', body: '<p>Tap a stamp to move a part along: needed → in cart → ordered → on hand → installed. Tasks that wait on a part become doable once it\'s on hand.</p>' }) +
    `<div class="page">${order.map(st => {
      const list = all.filter(x => x.pt.status === st);
      if (!list.length) return '';
      const total = money(list);
      return `<section class="block">${sec(`${PART_STATUS[st]} · ${list.length}`, total ? `<span class="num">$${total.toFixed(2)} listed</span>` : '')}
        <div class="rows">${list.map(({ p, pt }) => `<div><span class="main" data-act="edit-part" data-p="${esc(p.id)}" data-id="${esc(pt.id)}" role="button">${esc(pt.name)}
          <small>${[p.title.split(':')[0], pt.vendor, pt.part_number, pt.price != null ? `$${pt.price}` : '', pt.notes].filter(Boolean).map(esc).join(' · ')}</small></span>
          ${pt.url ? `<a class="icon-btn" href="${esc(pt.url)}" target="_blank" rel="noopener" aria-label="Open listing">↗</a>` : ''}
          <button class="status-btn" data-act="cycle-part" data-p="${esc(p.id)}" data-id="${esc(pt.id)}" aria-label="Change status">${partStamp(pt)}</button></div>`).join('')}</div></section>`;
    }).join('') || '<div class="empty">No parts listed.</div>'}
    ${tools.length ? `<section class="block">${sec('Tools')}<div class="rows">${tools.map(({ p, t, i }) => `<div><span class="main" data-act="edit-tool" data-p="${esc(p.id)}" data-i="${i}" role="button">${esc(t.name)}<small>${esc(p.title.split(':')[0])}${t.notes ? ' · ' + esc(t.notes) : ''}</small></span>
      <button class="status-btn" data-act="cycle-tool" data-p="${esc(p.id)}" data-i="${i}" aria-label="Change status">${toolStamp(t)}</button></div>`).join('')}</div></section>` : ''}
  </div>`;
}

/* ---------- Search ---------- */
export function search(q) {
  const hits = [];
  const needle = q.trim().toLowerCase();
  const terms = needle.split(/\s+/).filter(Boolean);
  const match = s => { const t = String(s || '').toLowerCase(); return terms.length && terms.every(w => t.includes(w)); };
  const hl = s => { let out = esc(s); for (const w of terms) out = out.replace(new RegExp(w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), m => `<mark>${m}</mark>`); return out; };
  if (terms.length) {
    for (const p of projects()) {
      if (match(p.title + ' ' + p.goal + ' ' + p.summary)) hits.push({ k: 'Project', t: p.title, href: `#/p/${p.id}` });
      for (const s of p.subprojects) {
        if (match(s.title + ' ' + s.goal + ' ' + s.summary + ' ' + s.notes.join(' '))) hits.push({ k: 'Sub-project', t: s.title, sub: p.title, href: `#/p/${p.id}/${s.id}` });
        for (const t of s.tasks) if (match(t.text + ' ' + (t.detail || ''))) hits.push({ k: t.done ? 'Task · done' : 'Task', t: t.text, sub: s.title, href: `#/p/${p.id}/${s.id}` });
      }
      for (const s of p.specs) if (match(`${s.item} ${s.value} ${s.unit} ${s.notes}`)) hits.push({ k: 'Spec', t: `${s.item}: ${s.value} ${s.unit || ''}`, sub: s.notes, href: '#/specs' });
      for (const pt of p.parts) if (match(`${pt.name} ${pt.part_number} ${pt.vendor} ${pt.notes}`)) hits.push({ k: `Part · ${PART_STATUS[pt.status] || pt.status}`, t: pt.name, sub: p.title, href: '#/parts' });
      for (const f of p.files) if (match(`${f.title} ${f.caption} ${f.path}`)) hits.push({ k: 'Document', t: f.title, sub: f.caption, href: docHref(f.path) });
      for (const d of p.decisions) if (match(d.text)) hits.push({ k: 'Decision', t: d.text, sub: p.title, href: `#/p/${p.id}` });
      for (const o of p.open_questions) if (match(o.text + ' ' + o.answer)) hits.push({ k: 'Question', t: o.text, sub: o.answer, href: `#/p/${p.id}` });
    }
    for (const e of logEntries()) if (match(JSON.stringify([e.title, e.text, e.measurements]))) hits.push({ k: `Log · ${fmtDate(e.date)}`, t: e.title || e.text?.slice(0, 120), sub: e.title ? e.text?.slice(0, 140) : '', href: '#/log', act: 'open-entry', id: e.id });
    for (const s of S.car.sections || []) for (const f of s.fields || []) if (match(`${f.label} ${f.value} ${f.notes}`)) hits.push({ k: `Car · ${s.title}`, t: `${f.label}: ${f.value}`, sub: f.notes, href: '#/car' });
  }
  return band({
    eyebrow: 'Search', title: q ? `“${esc(q)}”` : 'Search',
    body: `<form class="search" data-act="search" style="margin-top:12px"><input id="search-q" name="q" type="search" value="${esc(q)}" placeholder="Search everything" aria-label="Search"></form>`,
  }) + `<div class="page">${terms.length ? `<p class="muted" style="margin:0">${hits.length} result${hits.length === 1 ? '' : 's'}</p>` : ''}
    <div class="rows" style="display:block">${hits.map(h => `<a class="hit" href="${esc(h.href)}"${h.act ? ` data-act="${h.act}" data-id="${esc(h.id)}"` : ''}><small>${esc(h.k)}</small><div>${hl(h.t || '')}</div>${h.sub ? `<small style="text-transform:none;letter-spacing:0">${hl(String(h.sub).slice(0, 160))}</small>` : ''}</a>`).join('')}</div>
    ${terms.length && !hits.length ? '<div class="empty">Nothing found. Guide text isn\'t searched. Open the guide and use your browser\'s find-in-page.</div>' : ''}</div>`;
}

/* ---------- Settings ---------- */
export function settings() {
  const c = cfg();
  const n = pendingCount();
  let theme = 'auto';
  try { theme = localStorage.getItem('shopbook.theme') || 'auto'; } catch { }
  return band({ eyebrow: 'Setup', title: 'Settings' }) + `<div class="page">
    <section class="block">${sec('Sec. 1 · Saving to GitHub')}
      <div class="card">
        <p style="margin:0">Your edits are stored on this device first, then saved to your GitHub repo so every device sees them. Each device needs the token once. The token stays on this device and is only sent to GitHub.</p>
        ${canSync() ? stamp('Connected', 'ok') : stamp('Not connected: edits stay on this device', 'warn')}
        ${S.lastError ? `<div class="banner">Last problem: ${esc(S.lastError)}</div>` : ''}
        <p style="margin:0" class="muted">${n ? `${n} change${n === 1 ? '' : 's'} waiting to save.` : 'Everything is saved.'} Data is coming from ${S.source === 'github' ? 'GitHub (live)' : 'the site copy'}.</p>
      </div>
      <form class="card" data-act="save-settings" autocomplete="off">
        <label class="field" for="gh-owner"><span>GitHub username</span><input id="gh-owner" name="owner" value="${esc(c.owner || '')}" autocapitalize="off" spellcheck="false"></label>
        <label class="field" for="gh-repo"><span>Repository name</span><input id="gh-repo" name="repo" value="${esc(c.repo || '')}" autocapitalize="off" spellcheck="false"></label>
        <label class="field" for="gh-branch"><span>Branch</span><input id="gh-branch" name="branch" value="${esc(c.branch || 'main')}" autocapitalize="off"></label>
        <label class="field" for="gh-token"><span>Access token</span><input id="gh-token" name="token" type="password" value="${esc(c.token || '')}" autocapitalize="off" spellcheck="false" placeholder="github_pat_…">
          <small>A fine-grained token limited to this one repository, with "Contents: Read and write". SETUP.md walks through it.</small></label>
        <div class="btn-row"><button class="btn primary" type="submit">Save &amp; test</button><button class="btn" type="button" data-act="sync-now">Save changes now</button></div>
      </form>
    </section>
    <section class="block">${sec('Sec. 2 · Display')}
      <div class="chips">${[['auto', 'Match my device'], ['light', 'Paper (light)'], ['dark', 'Blueprint (dark)']].map(([v, l]) => `<button class="chip" data-act="set-theme" data-v="${v}" aria-pressed="${theme === v}">${l}</button>`).join('')}</div>
    </section>
    <section class="block">${sec('Sec. 3 · Offline & backup')}
      <div class="btn-row"><button class="btn" data-act="save-offline">Save all documents for offline</button><button class="btn" data-act="backup">Download a backup</button><button class="btn" data-act="reload-data">Reload data</button></div>
      ${n ? `<button class="btn danger ghost small" data-act="discard-pending">Throw away unsaved changes on this device</button>` : ''}
    </section>
  </div>`;
}
