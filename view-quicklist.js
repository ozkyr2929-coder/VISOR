// Lista rápida: type or dictate many titles, review the best matches, confirm them all at once.
import { h, icon, openSheet, posterImg, loading, errorText, fill } from './ui.js';
import { parseQuickList, pickBestMatch } from './model.js';
import { attachMic } from './voice.js';

const TYPE_LABEL = { movie: 'Película', tv: 'Serie' };

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  const worker = async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k], k); } };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

export function openQuickList(ctx) {
  const { tmdb, store } = ctx;
  let filter = 'all';
  const inner = h('div', { class: 'sheet-inner' });
  const sheet = openSheet(inner, { label: 'Lista rápida' });

  function stepWrite(prefill = '') {
    const ta = h('textarea', { class: 'textarea', id: 'quick-list', 'aria-label': 'Títulos',
      placeholder: 'Uno por línea, o separados por comas:\nMatrix\nTitanic (1997)\nBreaking Bad' });
    ta.value = prefill;
    const mic = h('button', { class: 'btn ghost', type: 'button' }, icon('mic'), 'Dictar');
    attachMic(mic, ta);
    const seg = h('div', { class: 'seg', role: 'group', 'aria-label': 'Buscar en' }, ...[['all', 'Todo'], ['movie', 'Pelis'], ['tv', 'Series']].map(([v, l]) =>
      h('button', { type: 'button', 'aria-pressed': String(filter === v), onClick: e => {
        filter = v; seg.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b === e.currentTarget)));
      } }, l)));
    const go = h('button', { class: 'btn solid', type: 'button', onClick: () => {
      const queries = parseQuickList(ta.value);
      if (!queries.length) { ta.focus(); return; }
      stepReview(queries, ta.value);
    } }, icon('search'), 'Buscar coincidencias');
    fill(inner, 
      h('div', { style: { display: 'grid', gap: '8px', paddingRight: '44px' } },
        h('p', { class: 'eyebrow' }, 'Lista rápida'),
        h('h2', { class: 'h1' }, 'Dígame qué ha visto'),
        h('p', { class: 'lead' }, 'Escriba o dicte varios títulos. Buscaré cada uno y podrá revisarlos antes de guardarlos.')),
      h('div', { class: 'form' }, ta, h('div', { class: 'btn-row' }, mic, seg)),
      h('div', { class: 'btn-row' }, go));
    setTimeout(() => ta.focus(), 50);
  }

  async function stepReview(queries, original) {
    fill(inner, 
      h('div', { style: { display: 'grid', gap: '8px', paddingRight: '44px' } },
        h('p', { class: 'eyebrow' }, 'Lista rápida'), h('h2', { class: 'h1' }, 'Revisando coincidencias')),
      loading(`Buscando ${queries.length} títulos`));
    let rows;
    try {
      // One title failing (a network blip) leaves that row empty instead of losing the whole list.
      rows = await mapLimit(queries, 4, async q => {
        let r;
        try { r = await tmdb.search(q.query, 1); }
        catch (e) { if (e.code === 'nokey' || e.code === 'unauthorized') throw e; return { q, results: [], pick: null, on: false, failed: true }; }
        const results = r.results.filter(x => filter === 'all' || x.type === filter);
        return { q, results: results.slice(0, 6), pick: pickBestMatch(results, q), on: true };
      });
    } catch (e) {
      fill(inner, h('p', { class: 'status-line err' }, errorText(e)),
        h('div', { class: 'btn-row' }, h('button', { class: 'btn', type: 'button', onClick: () => stepWrite(original) }, 'Volver')));
      return;
    }
    const list = h('div', { style: { display: 'grid', gap: '8px' } });
    const confirmSeen = h('button', { class: 'btn solid', type: 'button' });
    const confirmLater = h('button', { class: 'btn amber', type: 'button' });

    const paint = () => {
      fill(list, ...rows.map((r, i) => {
        if (!r.pick) {
          return h('div', { class: 'ql-row miss' },
            h('div', { class: 'body' }, h('div', { class: 'q' }, `«${r.q.query}»`), h('div', { class: 't' }, r.failed ? 'No se pudo buscar (sin conexión)' : 'Sin resultados')),
            h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Quitar', onClick: () => { rows.splice(i, 1); paint(); } }, icon('close')));
        }
        const p = r.pick;
        const alts = r.open ? h('div', { class: 'ql-alts' }, r.results.filter(x => x !== p).map(x =>
          h('button', { type: 'button', onClick: () => { r.pick = x; r.open = false; paint(); } },
            h('div', { class: 'thumb', style: { width: '32px' } }, posterImg(x, 'w92')),
            `${x.title} · ${x.year || '—'} · ${TYPE_LABEL[x.type]}`))) : null;
        return h('div', { class: 'ql-row', style: { opacity: r.on ? '1' : '.45', alignItems: 'flex-start' } },
          h('div', { class: 'thumb' }, posterImg(p, 'w92')),
          h('div', { class: 'body' },
            h('div', { class: 'q' }, `«${r.q.query}»${r.q.year ? ` (${r.q.year})` : ''}`),
            h('div', { class: 't' }, p.title),
            h('div', { class: 'q' }, `${p.year || '—'} · ${TYPE_LABEL[p.type]}`),
            r.results.length > 1 ? h('button', { class: 'btn ghost small', type: 'button', style: { justifySelf: 'start', marginTop: '4px' },
              onClick: () => { r.open = !r.open; paint(); } }, r.open ? 'Cerrar' : 'No es esta') : null,
            alts),
          h('button', { class: 'check', type: 'button', 'aria-pressed': String(r.on), 'aria-label': r.on ? 'Incluida' : 'Excluida',
            onClick: () => { r.on = !r.on; paint(); } }, icon('check')));
      }));
      const n = rows.filter(r => r.on && r.pick).length;
      fill(confirmSeen, icon('hexcheck'), `Marcar ${n} como vistas`);
      fill(confirmLater, icon('bookmark'), `Añadir ${n} a pendientes`);
      confirmSeen.disabled = confirmLater.disabled = !n;
    };

    confirmSeen.addEventListener('click', () => {
      let added = 0;
      for (const r of rows) {
        if (!r.on || !r.pick) continue;
        const it = store.getItem(`${r.pick.type}:${r.pick.id}`);
        if (it && (it.status === 'watched' || it.status === 'completed')) continue;
        ctx.toggleSeen(r.pick);
        added++;
      }
      ctx.toast(added ? `Registradas ${added} como vistas.` : 'Ya estaban todas registradas.');
      sheet.close();
    });
    confirmLater.addEventListener('click', () => {
      let added = 0;
      for (const r of rows) {
        if (!r.on || !r.pick) continue;
        const it = store.getItem(`${r.pick.type}:${r.pick.id}`);
        if (it && (it.status === 'watched' || it.status === 'completed' || it.status === 'watchlist')) continue;
        store.setWatchlist(r.pick, true);
        added++;
      }
      ctx.toast(added ? `Añadidas ${added} a pendientes.` : 'Ya estaban en su registro.');
      sheet.close();
    });

    paint();
    fill(inner, 
      h('div', { style: { display: 'grid', gap: '8px', paddingRight: '44px' } },
        h('p', { class: 'eyebrow' }, 'Lista rápida'),
        h('h2', { class: 'h1' }, 'Confirme la lista'),
        h('p', { class: 'lead' }, 'Quite las que no quiera o toque «No es esta» para elegir otra.')),
      list,
      h('div', { class: 'btn-row' }, confirmSeen, confirmLater,
        h('button', { class: 'btn ghost', type: 'button', onClick: () => stepWrite(original) }, 'Editar lista')));
  }

  stepWrite();
}
