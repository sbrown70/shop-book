// Small markdown renderer: headings, paragraphs, nested lists, task lists, tables,
// code fences, blockquotes, hr, images, links, bold/italic/code. No raw HTML passthrough.
import { esc } from './ui.js';

function inline(s, base = '') {
  const codes = [];
  s = s.replace(/`([^`]+)`/g, (_, c) => `\u0000${codes.push(c) - 1}\u0000`);
  s = esc(s);
  s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_, a, u) => `<img alt="${a}" src="${resolve(u, base)}">`);
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, t, u) => {
    const href = resolve(u, base);
    const ext = /^https?:/.test(href) ? ' target="_blank" rel="noopener"' : '';
    return `<a href="${href}"${ext}>${t}</a>`;
  });
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/__([^_]+)__/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^*\w])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>').replace(/(^|\W)_([^_\s][^_]*)_(?=\W|$)/g, '$1<em>$2</em>');
  s = s.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${esc(codes[i])}</code>`);
  return s;
}

function resolve(u, base) {
  if (/^(https?:|#|\/|mailto:|data:)/.test(u) || !base) return esc(u);
  // relative to the markdown file's folder; local docs open in the app's doc viewer
  const parts = (base.replace(/[^/]*$/, '') + u).split('/');
  const out = [];
  for (const p of parts) { if (p === '..') out.pop(); else if (p !== '.') out.push(p); }
  const path = out.join('/');
  return /\.(png|jpe?g|gif|svg|webp)$/i.test(path) ? esc(path) : `#/doc/${encodeURIComponent(path)}`;
}

const isTableSep = l => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(l);
const cells = l => l.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());

export function md(src, base = '') {
  const lines = String(src || '').replace(/\r/g, '').split('\n');
  let html = '', i = 0;
  while (i < lines.length) {
    const l = lines[i];
    if (!l.trim()) { i++; continue; }
    let m;
    if ((m = l.match(/^```(.*)$/))) {
      const buf = []; i++;
      while (i < lines.length && !lines[i].startsWith('```')) buf.push(lines[i++]);
      i++; html += `<pre><code>${esc(buf.join('\n'))}</code></pre>`; continue;
    }
    if ((m = l.match(/^(#{1,6})\s+(.*)$/))) { const n = m[1].length; html += `<h${n}>${inline(m[2], base)}</h${n}>`; i++; continue; }
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(l)) { html += '<hr>'; i++; continue; }
    if (l.startsWith('>')) {
      const buf = [];
      while (i < lines.length && lines[i].startsWith('>')) buf.push(lines[i++].replace(/^>\s?/, ''));
      html += `<blockquote>${md(buf.join('\n'), base)}</blockquote>`; continue;
    }
    if (l.includes('|') && i + 1 < lines.length && isTableSep(lines[i + 1])) {
      const head = cells(l); i += 2;
      let t = '<div class="tablewrap"><table><thead><tr>' + head.map(c => `<th>${inline(c, base)}</th>`).join('') + '</tr></thead><tbody>';
      while (i < lines.length && lines[i].includes('|') && lines[i].trim()) {
        t += '<tr>' + cells(lines[i++]).map(c => `<td>${inline(c, base)}</td>`).join('') + '</tr>';
      }
      html += t + '</tbody></table></div>'; continue;
    }
    if (/^\s*([-*+]|\d+[.)])\s+/.test(l)) {
      const buf = [];
      while (i < lines.length && (/^\s*([-*+]|\d+[.)])\s+/.test(lines[i]) || (/^\s{2,}\S/.test(lines[i]) && buf.length))) buf.push(lines[i++]);
      html += list(buf, base); continue;
    }
    const buf = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,6}\s|```|>|\s*([-*+]|\d+[.)])\s+)/.test(lines[i]) &&
      !(lines[i].includes('|') && i + 1 < lines.length && isTableSep(lines[i + 1]))) buf.push(lines[i++].trim());
    html += `<p>${inline(buf.join(' '), base)}</p>`;
  }
  return html;
}

function list(buf, base) {
  const indent = buf[0].match(/^\s*/)[0].length;
  const ordered = /^\s*\d+[.)]/.test(buf[0]);
  let out = ordered ? '<ol>' : '<ul>';
  let item = null, child = [];
  const flush = () => {
    if (item === null) return;
    let body = item, cls = '';
    const tm = body.match(/^\[( |x|X)\]\s+(.*)$/);
    if (tm) { cls = ' class="task"'; body = `<span class="box${tm[1] === ' ' ? '' : ' on'}"></span>${inline(tm[2], base)}`; }
    else body = inline(body, base);
    out += `<li${cls}>${body}${child.length ? list(child, base) : ''}</li>`;
    item = null; child = [];
  };
  for (const l of buf) {
    const ind = l.match(/^\s*/)[0].length;
    const m = l.match(/^\s*(?:[-*+]|\d+[.)])\s+(.*)$/);
    if (m && ind <= indent) { flush(); item = m[1]; }
    else if (m) child.push(l);
    else if (child.length) child.push(l);
    else item += ' ' + l.trim();
  }
  flush();
  return out + (ordered ? '</ol>' : '</ul>');
}

export function csvTable(text) {
  const rows = [];
  let row = [], cell = '', q = false;
  const s = String(text).replace(/\r/g, '');
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) { if (c === '"' && s[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  if (!rows.length) return '<p>Empty file.</p>';
  const [head, ...body] = rows.filter(r => r.some(c => c.trim()));
  const link = v => /^https?:\/\//.test(v) ? `<a href="${esc(v)}" target="_blank" rel="noopener">link</a>` : esc(v);
  return '<div class="tablewrap"><table><thead><tr>' + head.map(h => `<th>${esc(h)}</th>`).join('') +
    '</tr></thead><tbody>' + body.map(r => '<tr>' + r.map(c => `<td>${link(c)}</td>`).join('') + '</tr>').join('') + '</tbody></table></div>';
}
