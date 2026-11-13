// Shared UI helpers: escaping, dates, toasts, and the bottom-sheet form builder.

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export const today = () => new Date().toLocaleDateString('en-CA');
export function fmtDate(d, long = false) {
  if (!d) return '';
  const [y, m, dd] = d.split('-').map(Number);
  const dt = new Date(y, m - 1, dd || 1);
  const sameYear = y === new Date().getFullYear();
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: long || !sameYear ? 'numeric' : undefined, weekday: long ? 'short' : undefined });
}
export function fmtMin(m) {
  if (m == null || m === '') return '';
  if (m < 60) return `${m} min`;
  const h = m / 60;
  return `${Number.isInteger(h) ? h : h.toFixed(1)} hr`;
}
export const slug = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'item';
export function uniqueId(base, taken) {
  let id = slug(base), n = 2;
  const set = new Set(taken);
  while (set.has(id)) id = `${slug(base)}-${n++}`;
  return id;
}

export const AREAS = {
  engine: 'Engine', electrical: 'Electrical', drivetrain: 'Drivetrain', 'suspension-steering': 'Suspension & steering',
  brakes: 'Brakes', cooling: 'Cooling', fuel: 'Fuel', exhaust: 'Exhaust', 'body-paint': 'Body & paint',
  interior: 'Interior', 'wheels-tires': 'Wheels & tires', general: 'General',
};
export const LOG_KINDS = {
  work: 'Work done', measurement: 'Measurement', finding: 'Finding', incident: 'Incident', purchase: 'Purchase', note: 'Note',
};
export const SUB_STATUS = { todo: 'To do', in_progress: 'In progress', blocked: 'Blocked', done: 'Done' };
export const PROJ_STATUS = { active: 'Active', paused: 'Paused', idea: 'Idea', done: 'Complete' };
export const PART_STATUS = { needed: 'Needed', in_cart: 'In cart', ordered: 'Ordered', on_hand: 'On hand', installed: 'Installed', skip: 'Skip' };
export const TOOL_STATUS = { needed: 'Needed', have: 'Have', borrow: 'Borrow', rent: 'Rent' };

export const stamp = (text, tone = '') => `<span class="stamp ${tone}">${esc(text)}</span>`;
export const bar = (done, total) => `<div class="bar" role="progressbar" aria-valuenow="${done}" aria-valuemax="${total}"><i style="width:${total ? Math.round(done / total * 100) : 0}%"></i></div>`;
export const opts = obj => Object.entries(obj).map(([value, label]) => ({ value, label }));

let toastTimer;
export function toast(msg, ms = 2600) {
  const t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, ms);
}

export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; }
  catch {
    const ta = document.createElement('textarea');
    ta.value = text; document.body.append(ta); ta.select();
    let ok = false; try { ok = document.execCommand('copy'); } catch { }
    ta.remove(); return ok;
  }
}

/* ---------- Bottom-sheet form ----------
   fields: [{key, label, type: text|textarea|number|date|select|checkbox|measurements|photos|info,
             options, placeholder, help, step, required, show(values)}] */
export function openForm({ title, fields, values = {}, submitLabel = 'Save', onSave, onDelete, deleteLabel = 'Delete', extra = '' }) {
  const dlg = $('#sheet');
  const v = structuredClone(values);
  const fieldHtml = f => {
    const id = `f-${f.key}`;
    const val = v[f.key];
    const help = f.help ? `<small>${esc(f.help)}</small>` : '';
    const req = f.required ? ' required' : '';
    switch (f.type) {
      case 'info': return `<div class="field info">${f.html}</div>`;
      case 'textarea': return `<label class="field" for="${id}"><span>${esc(f.label)}</span><textarea id="${id}" name="${f.key}" rows="${f.rows || 4}" placeholder="${esc(f.placeholder || '')}"${req}>${esc(val)}</textarea>${help}</label>`;
      case 'select': return `<label class="field" for="${id}"><span>${esc(f.label)}</span><select id="${id}" name="${f.key}">${(f.options || []).map(o => {
        const ov = typeof o === 'string' ? o : o.value, ol = typeof o === 'string' ? o : o.label;
        return `<option value="${esc(ov)}"${String(val ?? '') === String(ov) ? ' selected' : ''}>${esc(ol)}</option>`;
      }).join('')}</select>${help}</label>`;
      case 'checks': return `<fieldset class="field"><span>${esc(f.label)}</span>${(f.options || []).map((o, i) =>
        `<label class="field check" for="${id}-${i}"><input type="checkbox" id="${id}-${i}" name="${f.key}" value="${esc(o.value)}"${(val || []).includes(o.value) ? ' checked' : ''}><span>${esc(o.label)}</span></label>`).join('') || '<small>None listed yet.</small>'}${help}</fieldset>`;
      case 'checkbox': return `<label class="field check" for="${id}"><input type="checkbox" id="${id}" name="${f.key}"${val ? ' checked' : ''}><span>${esc(f.label)}</span></label>`;
      case 'measurements': return `<div class="field"><span>${esc(f.label)}</span><div class="meas-rows" data-key="${f.key}">${(val || []).map((m, i) => measRow(m, i, f.specs)).join('')}</div>
        <button type="button" class="btn ghost small" data-add-meas>＋ Add a reading</button>${help}</div>`;
      case 'photos': return `<label class="field" for="${id}"><span>${esc(f.label)}</span><input type="file" id="${id}" name="${f.key}" accept="${esc(f.accept || 'image/*')}"${f.single ? '' : ' multiple'}>${help}</label>`;
      default: return `<label class="field" for="${id}"><span>${esc(f.label)}</span><input id="${id}" name="${f.key}" type="${f.type || 'text'}" value="${esc(val)}" placeholder="${esc(f.placeholder || '')}"${f.step ? ` step="${f.step}"` : ''}${f.type === 'number' ? ' inputmode="decimal"' : ''}${req}>${help}</label>`;
    }
  };
  const measField = fields.find(f => f.type === 'measurements');
  dlg.innerHTML = `<form method="dialog" class="sheet-form" novalidate>
    <div class="sheet-head"><h2>${esc(title)}</h2><button type="button" class="icon-btn" data-close aria-label="Close">✕</button></div>
    <div class="sheet-body">${extra}${fields.map(f => `<div class="fwrap" data-for="${f.key}">${fieldHtml(f)}</div>`).join('')}</div>
    <div class="sheet-foot">
      ${onDelete ? `<button type="button" class="btn danger ghost" data-delete>${esc(deleteLabel)}</button>` : ''}
      <span class="grow"></span>
      <button type="button" class="btn ghost" data-close>Cancel</button>
      <button type="submit" class="btn primary">${esc(submitLabel)}</button>
    </div></form>`;
  const form = $('form', dlg);
  const read = () => {
    const out = { ...v };
    for (const f of fields) {
      const el = form.elements[f.key];
      if (f.type === 'checks') { out[f.key] = $$(`input[name="${f.key}"]`, form).filter(x => x.checked).map(x => x.value); continue; }
      if (f.type === 'info') continue;
      if (f.type === 'checkbox') out[f.key] = el.checked;
      else if (f.type === 'number') out[f.key] = el.value === '' ? null : Number(el.value);
      else if (f.type === 'measurements') out[f.key] = $$('.meas-row', form).map(r => {
        const g = n => $(`[data-m="${n}"]`, r).value.trim();
        const val = g('value');
        return { what: g('what'), location: g('location'), value: val === '' ? null : (isNaN(Number(val)) ? val : Number(val)), unit: g('unit'), spec_ref: g('spec_ref') || null };
      }).filter(m => m.what || m.value !== null);
      else if (f.type === 'photos') out[f.key] = el.files ? [...el.files] : [];
      else if (f.type !== 'info') out[f.key] = el.value.trim();
    }
    return out;
  };
  const applyShow = () => {
    const cur = read();
    for (const f of fields) if (f.show) $(`.fwrap[data-for="${f.key}"]`, form).hidden = !f.show(cur);
  };
  form.addEventListener('change', applyShow);
  applyShow();
  form.addEventListener('click', e => {
    if (e.target.closest('[data-close]')) dlg.close();
    if (e.target.closest('[data-add-meas]')) {
      const box = $('.meas-rows', form);
      box.insertAdjacentHTML('beforeend', measRow({}, box.children.length, measField?.specs));
      $('.meas-row:last-child [data-m="what"]', box).focus();
    }
    if (e.target.closest('[data-del-meas]')) e.target.closest('.meas-row').remove();
    const del = e.target.closest('[data-delete]');
    if (del) {
      if (!del.dataset.armed) { del.dataset.armed = '1'; del.textContent = 'Tap again to delete'; return; }
      dlg.close(); onDelete();
    }
  });
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const out = read();
    const missing = fields.find(f => f.required && !out[f.key]);
    if (missing) { toast(`${missing.label} is required.`); form.elements[missing.key]?.focus(); return; }
    dlg.close();
    await onSave(out);
  });
  dlg.showModal();
  const first = $('input:not([type=checkbox]):not([type=file]),textarea,select', form);
  if (first && matchMedia('(hover: hover)').matches) first.focus();
}

function measRow(m = {}, i, specs = []) {
  const specOpts = specs?.length ? `<select data-m="spec_ref" aria-label="Compare to spec"><option value="">No spec</option>${specs.map(s =>
    `<option value="${esc(s.item)}"${m.spec_ref === s.item ? ' selected' : ''}>${esc(s.item)} (${esc(s.value)} ${esc(s.unit || '')})</option>`).join('')}</select>` : '<input type="hidden" data-m="spec_ref" value="">';
  return `<div class="meas-row">
    <input data-m="what" placeholder="What (e.g. Main journal #3)" value="${esc(m.what)}">
    <input data-m="location" placeholder="Where (e.g. front edge)" value="${esc(m.location)}">
    <div class="meas-val"><input data-m="value" placeholder="Value" inputmode="decimal" value="${esc(m.value)}"><input data-m="unit" placeholder="Unit" value="${esc(m.unit)}" list="units"></div>
    ${specOpts}
    <button type="button" class="icon-btn" data-del-meas aria-label="Remove reading">✕</button>
  </div>`;
}
