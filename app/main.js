// Router, shell and event delegation.
import { S, load, syncNow, pendingCount, canSync } from './store.js';
import { $, $$, toast } from './ui.js';
import * as V from './views.js';
import * as V2 from './views2.js';
import { actions, logSomething } from './actions.js';

const routes = [
  [/^$/, () => V.home(), 'home'],
  [/^today$/, () => V.todayView(), 'today'],
  [/^projects$/, () => V.projectList(), 'projects'],
  [/^p\/([^/]+)$/, m => V.project(m[1]), 'projects'],
  [/^p\/([^/]+)\/([^/]+)$/, m => V.subproject(m[1], m[2]), 'projects'],
  [/^docs$/, () => V.docs(), 'home'],
  [/^doc\/(.+)$/, m => V.doc(decodeURIComponent(m[1])), 'home'],
  [/^log$/, () => V2.log(), 'log'],
  [/^car$/, () => V2.car(), 'car'],
  [/^specs$/, () => V2.specs(), 'home'],
  [/^parts$/, () => V2.parts(), 'home'],
  [/^search(?:\/(.*))?$/, m => V2.search(decodeURIComponent(m[1] || '')), 'home'],
  [/^settings$/, () => V2.settings(), 'home'],
];

let lastRoute = '';
export function render(keepScroll = false) {
  const route = location.hash.replace(/^#\/?/, '');
  const y = scrollY;
  let html = '', tab = 'home';
  try {
    for (const [re, fn, t] of routes) {
      const m = route.match(re);
      if (m) { html = fn(m); tab = t; break; }
    }
    if (!html) html = `<div class="page"><div class="empty">Page not found. <a href="#/">Go home</a></div></div>`;
  } catch (e) {
    console.error(e);
    html = `<div class="page"><div class="banner">Something broke while drawing this page: ${e.message}</div></div>`;
  }
  const view = $('#view');
  view.innerHTML = html;
  $$('#tabs a').forEach(a => a.dataset.tab === tab ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current'));
  V.afterRender(view);
  if (keepScroll && route === lastRoute) scrollTo(0, y);
  else if (route !== lastRoute) scrollTo(0, 0);
  lastRoute = route;
  updateSync();
}
window.addEventListener('rerender', () => render(true));

function updateSync() {
  const el = $('#sync');
  const n = pendingCount();
  el.className = '';
  if (S.syncing) { el.hidden = false; el.textContent = 'Saving…'; }
  else if (S.lastError && n) { el.hidden = false; el.textContent = `${n} not saved`; el.className = 'bad'; }
  else if (n && !canSync()) { el.hidden = false; el.textContent = `${n} on this device only`; el.className = 'warn'; }
  else if (n && !navigator.onLine) { el.hidden = false; el.textContent = `Offline · ${n} waiting`; el.className = 'warn'; }
  else if (n) { el.hidden = false; el.textContent = `${n} waiting`; }
  else el.hidden = true;
}
window.addEventListener('sync-status', updateSync);
window.addEventListener('online', () => syncNow());
window.addEventListener('offline', updateSync);

document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el || !document.body.contains(el)) return;
  const fn = actions[el.dataset.act];
  if (fn) { e.preventDefault(); fn(el.dataset, el); }
});
document.addEventListener('submit', e => {
  const form = e.target.closest('form[data-act]');
  if (!form) return;
  e.preventDefault();
  actions[form.dataset.act]?.(form.dataset, form);
});
document.addEventListener('keydown', e => {
  const el = e.target.closest?.('[role="button"][data-act]');
  if (el && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); el.click(); }
});
// <select data-change="action"> runs that action with data-v = the chosen value.
document.addEventListener('change', e => {
  const act = e.target.dataset?.change;
  if (act && actions[act]) actions[act]({ v: e.target.value }, e.target);
});
// Live filter: <input data-filter="#list"> hides [data-item] rows that don't match, and empty [data-group]s.
document.addEventListener('input', e => {
  const sel = e.target.dataset?.filter;
  if (!sel) return;
  const q = e.target.value.trim().toLowerCase();
  const root = $(sel);
  for (const it of $$('[data-item]', root)) it.hidden = q && !it.textContent.toLowerCase().includes(q);
  for (const g of $$('[data-group]', root)) g.hidden = !$$('[data-item]', g).some(it => !it.hidden);
});
$('#fab').addEventListener('click', () => logSomething(V.routeContext()));
window.addEventListener('hashchange', () => render());

(async () => {
  try { await load(); }
  catch (e) { console.error(e); toast('Could not load the data. Check the connection and reload.'); }
  render();
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').catch(err => console.warn('SW', err));
  }
})();
