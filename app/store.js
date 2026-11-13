// Data layer. All app data lives in JSON files in the repo (see DATA.md).
// Reads: GitHub API when a token is set (always fresh), else the site's own copy (works offline via the service worker).
// Writes: every edit is stored on the device first (IndexedDB), then committed to GitHub when online.
import { today, toast, slug } from './ui.js';

export const S = {
  index: { projects: [] }, car: { sections: [] }, log: { entries: [] }, projects: new Map(),
  shas: {}, pending: {}, photos: {}, loaded: false, source: 'site', syncing: false, lastError: '',
};

/* ---------- settings ---------- */
const CFG_KEY = 'shopbook.cfg';
export function cfg() {
  let c = {};
  try { c = JSON.parse(localStorage.getItem(CFG_KEY) || '{}'); } catch { }
  if (!c.owner && location.hostname.endsWith('.github.io')) c.owner = location.hostname.split('.')[0];
  if (!c.repo && location.hostname.endsWith('.github.io')) c.repo = location.pathname.split('/').filter(Boolean)[0] || `${c.owner}.github.io`;
  c.branch ||= 'main';
  return c;
}
export function setCfg(c) { try { localStorage.setItem(CFG_KEY, JSON.stringify(c)); } catch { } }
export const canSync = () => { const c = cfg(); return !!(c.token && c.owner && c.repo); };

/* ---------- tiny IndexedDB key/value store ---------- */
let dbp;
function db() {
  dbp ||= new Promise((res, rej) => {
    const r = indexedDB.open('shopbook', 1);
    r.onupgradeneeded = () => { r.result.createObjectStore('pending'); r.result.createObjectStore('photos'); };
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
  return dbp;
}
async function idb(store, mode, fn) {
  try {
    const d = await db();
    return await new Promise((res, rej) => {
      const tx = d.transaction(store, mode); const st = tx.objectStore(store);
      const req = fn(st); tx.oncomplete = () => res(req?.result); tx.onerror = () => rej(tx.error);
    });
  } catch (e) { console.warn('IndexedDB unavailable', e); return undefined; }
}
const idbAll = async store => {
  const keys = await idb(store, 'readonly', s => s.getAllKeys()) || [];
  const vals = await idb(store, 'readonly', s => s.getAll()) || [];
  return Object.fromEntries(keys.map((k, i) => [k, vals[i]]));
};

/* ---------- GitHub API ---------- */
const enc = s => { const b = new TextEncoder().encode(s); let bin = ''; for (let i = 0; i < b.length; i += 0x8000) bin += String.fromCharCode(...b.subarray(i, i + 0x8000)); return btoa(bin); };
const dec = b64 => new TextDecoder().decode(Uint8Array.from(atob(b64.replace(/\n/g, '')), c => c.charCodeAt(0)));
async function gh(path, opts = {}) {
  const c = cfg();
  const r = await fetch(`https://api.github.com/repos/${c.owner}/${c.repo}/contents/${path}${opts.method ? '' : `?ref=${c.branch}`}`, {
    ...opts, cache: 'no-store',
    headers: { Authorization: `Bearer ${c.token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', ...(opts.headers || {}) },
  });
  if (r.status === 404 && !opts.method) return null;
  if (!r.ok) { const t = await r.text(); throw new Error(`GitHub ${r.status}: ${t.slice(0, 160)}`); }
  return r.json();
}
export async function testConnection() {
  const c = cfg();
  const r = await fetch(`https://api.github.com/repos/${c.owner}/${c.repo}`, { headers: { Authorization: `Bearer ${c.token}` }, cache: 'no-store' });
  if (!r.ok) throw new Error(r.status === 404 ? 'Repo not found, or the token cannot see it.' : r.status === 401 ? 'The token was rejected.' : `GitHub said ${r.status}.`);
  const j = await r.json();
  if (!j.permissions?.push) throw new Error('The token can read the repo but not write to it. Give it "Contents: Read and write".');
  return j;
}

/* ---------- loading ---------- */
async function readJson(path) {
  if (S.pending[path]) return JSON.parse(S.pending[path].content);
  if (canSync() && navigator.onLine) {
    try {
      const j = await gh(path);
      if (j) { S.shas[path] = j.sha; S.source = 'github'; return JSON.parse(dec(j.content)); }
      return null;
    } catch (e) { console.warn('GitHub read failed, using site copy', e); S.lastError = e.message; }
  }
  const r = await fetch(path, { cache: 'no-cache' });
  if (!r.ok) return null;
  return r.json();
}

export async function load() {
  S.pending = await idbAll('pending') || {};
  const photoKeys = await idb('photos', 'readonly', s => s.getAllKeys()) || [];
  S.photos = Object.fromEntries(photoKeys.map(k => [k, true]));
  const [index, car, log] = await Promise.all(['data/index.json', 'data/car.json', 'data/log.json'].map(readJson));
  S.index = index || { projects: [] };
  S.car = car || { name: 'My car', sections: [] };
  S.log = log || { entries: [] };
  const projs = await Promise.all(S.index.projects.map(id => readJson(projPath(id)).catch(() => null)));
  S.projects = new Map();
  projs.forEach((p, i) => { if (p) S.projects.set(S.index.projects[i], normProject(p)); });
  S.loaded = true;
  if (Object.keys(S.pending).length || photoKeys.length) scheduleSync(500);
}

function normProject(p) {
  for (const k of ['links', 'files', 'subprojects', 'parts', 'tools', 'specs', 'decisions', 'open_questions', 'sources']) p[k] ||= [];
  for (const s of p.subprojects) { s.tasks ||= []; s.files ||= []; s.notes ||= []; }
  return p;
}

export const projPath = id => `data/projects/${id}.json`;

/* ---------- saving ---------- */
const docFor = path => path === 'data/index.json' ? S.index : path === 'data/car.json' ? S.car : path === 'data/log.json' ? S.log
  : S.projects.get(path.replace(/^data\/projects\/|\.json$/g, ''));
const messages = {};
export async function save(path, message) {
  const doc = docFor(path);
  if (!doc) return;
  if ('updated' in doc || path !== 'data/log.json') doc.updated = today();
  const rec = { content: JSON.stringify({ ...doc, deleted_ids: undefined }, null, 2) + '\n', baseSha: S.pending[path]?.baseSha ?? S.shas[path] ?? null, at: Date.now() };
  if (doc.deleted_ids) rec.deleted = [...doc.deleted_ids];
  S.pending[path] = rec;
  (messages[path] ||= []).push(message);
  await idb('pending', 'readwrite', s => s.put(rec, path));
  window.dispatchEvent(new Event('sync-status'));
  scheduleSync();
}
export const saveProject = (p, msg) => save(projPath(p.id), msg);

/* Photos: resized on the phone, kept on the device until committed. */
export async function addPhoto(file, folder = 'files/photos') {
  const isImage = /^image\/(jpeg|png|webp|heic|heif)/.test(file.type);
  const blob = isImage ? await resize(file, 1600, 0.82) : file;
  const ext = isImage ? 'jpg' : (file.name.match(/\.([a-z0-9]+)$/i)?.[1] || 'bin').toLowerCase();
  const name = `${today()}-${slug(file.name.replace(/\.[^.]+$/, '')).slice(0, 24)}-${Math.random().toString(36).slice(2, 6)}.${ext}`;
  const path = `${folder}/${today().slice(0, 4)}/${name}`;
  await idb('photos', 'readwrite', s => s.put(blob, path));
  S.photos[path] = true;
  photoUrls.set(path, URL.createObjectURL(blob));
  scheduleSync();
  return path;
}
const photoUrls = new Map();
export async function pendingPhotoUrl(path) {
  if (photoUrls.has(path)) return photoUrls.get(path);
  const blob = await idb('photos', 'readonly', s => s.get(path));
  if (!blob) return null;
  const u = URL.createObjectURL(blob); photoUrls.set(path, u); return u;
}
async function resize(file, max, q) {
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    return await new Promise(r => c.toBlob(r, 'image/jpeg', q));
  } catch { return file; }
}
export const rawUrl = path => { const c = cfg(); return c.owner && c.repo ? `https://raw.githubusercontent.com/${c.owner}/${c.repo}/${c.branch}/${path}` : path; };

/* ---------- sync ---------- */
let timer;
export function scheduleSync(ms = 4000) { clearTimeout(timer); timer = setTimeout(syncNow, ms); }
export const pendingCount = () => Object.keys(S.pending).length + Object.keys(S.photos).length;

export async function syncNow() {
  if (S.syncing || !canSync() || !navigator.onLine) { window.dispatchEvent(new Event('sync-status')); return; }
  if (!pendingCount()) return;
  S.syncing = true; S.lastError = ''; window.dispatchEvent(new Event('sync-status'));
  try {
    for (const path of Object.keys(S.photos)) {
      const blob = await idb('photos', 'readonly', s => s.get(path));
      if (blob) {
        const b64 = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result.split(',')[1]); fr.readAsDataURL(blob); });
        const existing = await gh(path);
        if (!existing) await gh(path, { method: 'PUT', body: JSON.stringify({ message: `Photo ${path.split('/').pop()}`, content: b64, branch: cfg().branch }) });
      }
      await idb('photos', 'readwrite', s => s.delete(path));
      delete S.photos[path];
    }
    for (const path of Object.keys(S.pending)) {
      const rec = S.pending[path];
      const remote = await gh(path);
      let content = rec.content;
      if (remote && rec.baseSha && remote.sha !== rec.baseSha) {
        content = merge(path, dec(remote.content), rec);
      }
      const sent = (messages[path] || []).length;
      const msg = summarize(messages[path]) || `Update ${path}`;
      const res = await gh(path, { method: 'PUT', body: JSON.stringify({ message: msg, content: enc(content), sha: remote?.sha, branch: cfg().branch }) });
      S.shas[path] = res.content.sha;
      if (S.pending[path] === rec) {
        delete S.pending[path]; await idb('pending', 'readwrite', s => s.delete(path));
        if (path === 'data/log.json') delete S.log.deleted_ids;
      }
      else S.pending[path].baseSha = res.content.sha;
      messages[path] = (messages[path] || []).slice(sent);
    }
    S.source = 'github';
  } catch (e) {
    S.lastError = e.message; console.error(e);
    scheduleSync(60000);
  } finally {
    S.syncing = false; window.dispatchEvent(new Event('sync-status'));
    if (!S.lastError && pendingCount()) scheduleSync(1000); // edits made while this sync ran
  }
}
const summarize = list => !list?.length ? '' : list.length === 1 ? list[0] : `${list[0]} (+${list.length - 1} more edits)`;

// Another device changed the same file since this device loaded it.
// The log merges entry by entry; anything else keeps this device's version and says so.
function merge(path, remoteText, rec) {
  const localText = rec.content;
  if (path === 'data/log.json') {
    try {
      const r = JSON.parse(remoteText), l = JSON.parse(localText);
      const deleted = new Set(rec.deleted || []);
      const byId = new Map(r.entries.filter(e => !deleted.has(e.id)).map(e => [e.id, e]));
      for (const e of l.entries) byId.set(e.id, e);
      const out = { ...l, entries: [...byId.values()] };
      S.log.entries = out.entries;
      return JSON.stringify(out, null, 2) + '\n';
    } catch { return localText; }
  }
  toast(`${path.split('/').pop()} was also changed on another device. Kept this device's version.`, 5000);
  return localText;
}

/* ---------- queries ---------- */
export const projects = () => S.index.projects.map(id => S.projects.get(id)).filter(Boolean);
export const isPartReady = p => ['on_hand', 'installed', 'skip'].includes(p?.status);
export function waitingOn(proj, task) {
  const parts = (task.needs_parts || []).map(id => proj.parts.find(p => p.id === id)).filter(p => p && !isPartReady(p));
  return parts;
}
export function stats(p) {
  let total = 0, done = 0;
  for (const s of p.subprojects) for (const t of s.tasks) { total++; if (t.done) done++; }
  return { total, done };
}
export function subStats(s) { return { total: s.tasks.length, done: s.tasks.filter(t => t.done).length }; }
// Sub-projects that must be finished first. Refs are "sub-id" or "project-id/sub-id".
export function depsWaiting(p, s) {
  return (s.depends_on || []).map(ref => {
    const [pid, sid] = ref.includes('/') ? ref.split('/') : [p.id, ref];
    const pp = S.projects.get(pid), ss = pp?.subprojects.find(x => x.id === sid);
    return ss && ss.status !== 'done' ? { p: pp, s: ss } : null;
  }).filter(Boolean);
}
export function nextTask(p) {
  for (const s of p.subprojects) {
    if (s.status === 'done' || depsWaiting(p, s).length) continue;
    for (const t of s.tasks) if (!t.done && !waitingOn(p, t).length && s.status !== 'blocked') return { s, t };
  }
  return null;
}
export function projectState(p) {
  if (p.status === 'done') return { label: 'Complete', tone: 'ok' };
  if (p.status === 'paused') return { label: 'Paused', tone: 'mute' };
  if (p.status === 'idea') return { label: 'Idea', tone: 'mute' };
  return doable(p).length ? { label: 'Workable now', tone: 'ok' } : { label: 'Waiting on parts', tone: 'bad' };
}
export function doable(p) {
  const out = [];
  for (const s of p.subprojects) {
    if (s.status === 'done' || s.status === 'blocked' || depsWaiting(p, s).length) continue;
    for (const t of s.tasks) if (!t.done && !waitingOn(p, t).length) out.push({ p, s, t });
  }
  return out;
}
export function specFor(entryProject, ref) {
  const p = S.projects.get(entryProject);
  return p?.specs.find(s => s.item === ref) || projects().flatMap(x => x.specs).find(s => s.item === ref) || null;
}
export function checkMeasurement(m, projectId) {
  let min = m.min, max = m.max;
  if ((min == null && max == null) && m.spec_ref) { const s = specFor(projectId, m.spec_ref); if (s) { min = s.min; max = s.max; } }
  if (typeof m.value !== 'number' || (min == null && max == null)) return null;
  const ok = (min == null || m.value >= min) && (max == null || m.value <= max);
  return { ok, min, max };
}
export const logEntries = () => [...S.log.entries].sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.id || '').localeCompare(a.id || ''));
export function deleteLogEntry(id) {
  S.log.entries = S.log.entries.filter(e => e.id !== id);
  (S.log.deleted_ids ||= []).push(id);
}
export function allFiles() {
  const out = [];
  for (const p of projects()) for (const f of p.files) out.push({ ...f, project: p });
  return out;
}
