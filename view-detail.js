// Ficha: everything about one title, plus the user's own log for it.
import { h, icon, openSheet, posterImg, starsInput, formatDate, loading, errorText, STATUS_LABEL } from './ui.js';
import { img } from './tmdb.js';
import { formatMinutes, todayISO } from './model.js';
import { genreName } from './genres.js';

const TV_STATES = ['watchlist', 'watching', 'completed', 'dropped'];

export function openDetail(ctx, type, id, onUserClose) {
  const { store, tmdb } = ctx;
  const key = `${type}:${id}`;
  let silent = false;
  let info = null;      // TMDB details
  let undated = false;  // TV: mark seasons without a date
  let confirmRemove = false;

  const inner = h('div', {});
  const sheet = openSheet(inner, { label: 'Ficha', onClose: () => { unsub(); if (!silent) onUserClose && onUserClose(); } });
  const logBox = h('section', { class: 'frame', style: { display: 'grid', gap: '16px' } });

  const meta = () => {
    const it = store.getItem(key);
    const base = info || it || { type, id, title: '' };
    const m = { type, id, title: base.title, original: base.original, year: base.year, poster: base.poster, backdrop: base.backdrop, genres: base.genres, runtime: base.runtime };
    if (type === 'tv') m.seasons = info && info.seasons ? info.seasons : (it && it.seasons) || [];
    return m;
  };

  // ---------- Header + info ----------
  function drawShell() {
    const it = store.getItem(key);
    const d = info || it;
    if (!d) { inner.replaceChildren(h('div', { class: 'sheet-inner' }, loading())); return; }
    const backdrop = img(d.backdrop, 'w1280');
    const facts = [];
    if (d.year) facts.push(String(d.year));
    if (type === 'movie' && d.runtime) facts.push(formatMinutes(d.runtime));
    if (type === 'tv') {
      const n = (d.seasons || []).filter(s => s.n > 0).length;
      if (n) facts.push(`${n} ${n === 1 ? 'temporada' : 'temporadas'}`);
      if (d.runtime) facts.push(`${d.runtime} min/cap.`);
    }
    if (info && info.vote) facts.push(`TMDB ${info.vote.toFixed(1).replace('.', ',')}`);
    const genres = info ? info.genreNames : (d.genres || []).map(genreName);

    inner.replaceChildren(
      h('div', { class: 'hero' }, backdrop ? h('img', { src: backdrop, alt: '', crossorigin: 'anonymous', decoding: 'async' }) : null),
      h('div', { class: 'sheet-inner' },
        h('div', { class: 'detail-head' },
          h('div', { class: 'poster-lg' }, posterImg(d, 'w342', `Cartel de ${d.title}`)),
          h('div', { style: { display: 'grid', gap: '8px', minWidth: '0' } },
            h('p', { class: 'eyebrow' }, type === 'tv' ? 'Serie' : 'Película'),
            h('h2', { class: 'h1' }, d.title),
            d.original && d.original !== d.title ? h('p', { class: 'muted' }, d.original) : null,
            h('div', { class: 'facts' }, facts.map(f => h('span', {}, f))),
            genres.length ? h('div', { class: 'facts' }, genres.join(' · ')) : null)),
        logBox,
        info ? infoSection() : h('p', { class: 'muted' }, 'Datos guardados en su registro. La ficha completa se cargará con conexión.')));
    drawLog();
  }

  function infoSection() {
    const p = info.providers || {};
    const providerRow = list => h('div', { class: 'providers' }, list.map(x => h('span', { class: 'provider' },
      x.logo ? h('img', { src: img(x.logo, 'w92'), alt: '', loading: 'lazy', crossorigin: 'anonymous' }) : h('span', { class: 'logo-ph' }), x.name)));
    return h('section', { style: { display: 'grid', gap: '18px' } },
      info.tagline ? h('p', { class: 'h3', style: { color: 'var(--arc)' } }, info.tagline) : null,
      info.overview ? h('p', { class: 'lead', style: { color: 'var(--ink)' } }, info.overview) : null,
      h('dl', { class: 'kv' },
        info.people.length ? [h('dt', {}, type === 'tv' ? 'Creación' : 'Dirección'), h('dd', {}, info.people.join(', '))] : null,
        info.cast.length ? [h('dt', {}, 'Reparto'), h('dd', {}, info.cast.slice(0, 8).map(c => c.name).join(', '))] : null),
      h('div', { style: { display: 'grid', gap: '10px' } },
        h('p', { class: 'eyebrow' }, 'Dónde verla en España'),
        p.flatrate && p.flatrate.length ? providerRow(p.flatrate) : h('p', { class: 'muted' }, 'No está incluida en ninguna suscripción ahora mismo.'),
        (p.rent && p.rent.length) || (p.buy && p.buy.length)
          ? h('p', { class: 'muted', style: { fontSize: 'var(--t-sm)' } }, `Alquiler o compra: ${[...new Set([...(p.rent || []), ...(p.buy || [])].map(x => x.name))].slice(0, 6).join(', ')}`) : null,
        p.link ? h('a', { class: 'btn ghost small', href: p.link, target: '_blank', rel: 'noopener', style: { justifySelf: 'start' } }, icon('external'), 'Ver todas las opciones') : null,
        h('p', { class: 'faint', style: { fontSize: 'var(--t-xs)' } }, 'Datos de plataformas por JustWatch.')));
  }

  // ---------- The user's log ----------
  function drawLog() {
    const it = store.getItem(key);
    const parts = [h('p', { class: 'eyebrow' }, 'Su registro')];
    if (type === 'movie') parts.push(...movieLog(it)); else parts.push(...tvLog(it));
    if (it) {
      parts.push(confirmRemove
        ? h('div', { class: 'btn-row' }, h('span', { class: 'muted' }, '¿Quitar este título de su registro?'),
            h('button', { class: 'btn danger small', type: 'button', onClick: () => { confirmRemove = false; store.removeItem(key); ctx.toast(`${it.title} quitada del registro.`); } }, 'Sí, quitar'),
            h('button', { class: 'btn ghost small', type: 'button', onClick: () => { confirmRemove = false; drawLog(); } }, 'Cancelar'))
        : h('div', {}, h('button', { class: 'btn ghost small', type: 'button', onClick: () => { confirmRemove = true; drawLog(); } }, icon('trash'), 'Quitar de mi registro')));
    }
    logBox.replaceChildren(...parts);
  }

  function noteField(it) {
    const ta = h('textarea', { class: 'textarea', id: `note-${key}`, style: { minHeight: '80px' }, placeholder: 'Una nota para usted (opcional)', 'aria-label': 'Nota' });
    ta.value = it.note || '';
    ta.addEventListener('change', () => store.setNote(key, ta.value.trim()));
    return ta;
  }

  function movieLog(it) {
    const watched = it && it.status === 'watched';
    const out = [];
    if (watched) {
      const n = it.watches.length;
      out.push(h('p', { class: 'status-line ok' }, n === 1 ? 'Vista.' : `Vista ${n} veces.`));
      out.push(h('div', { class: 'label' }, 'Su nota', starsInput(it.rating, r => store.setRating(key, r))));
      out.push(noteField(it));
      out.push(h('div', { class: 'watch-log' }, h('ul', {}, it.watches.map((w, i) => h('li', {},
        h('span', {}, formatDate(w.date), w.note ? h('span', { class: 'muted' }, ` · ${w.note}`) : null),
        h('button', { class: 'icon-btn', type: 'button', 'aria-label': `Borrar visionado del ${formatDate(w.date)}`, onClick: () => store.deleteWatch(key, i) }, icon('trash')))))));
    } else if (it && it.status === 'watchlist') {
      out.push(h('p', { class: 'status-line warn' }, 'En su lista de pendientes.'));
    } else {
      out.push(h('p', { class: 'muted' }, 'Todavía no está en su registro.'));
    }
    out.push(watchForm(watched));
    if (!watched) {
      const on = it && it.status === 'watchlist';
      out.push(h('div', {}, h('button', { class: 'btn amber', type: 'button', onClick: () => {
        store.setWatchlist(meta(), !on); ctx.toast(on ? 'Quitada de pendientes.' : `${meta().title} añadida a pendientes.`);
      } }, icon('bookmark'), on ? 'Quitar de pendientes' : 'Añadir a pendientes')));
    }
    return out;
  }

  function watchForm(watched) {
    let rating = null;
    const date = h('input', { class: 'input', type: 'date', id: `date-${key}`, value: todayISO(), max: todayISO(), style: { maxWidth: '220px' } });
    const noDate = h('input', { type: 'checkbox', id: `nodate-${key}` });
    noDate.addEventListener('change', () => { date.disabled = noDate.checked; });
    const note = h('input', { class: 'input', id: `wnote-${key}`, placeholder: 'Nota del visionado (opcional)' });
    const save = h('button', { class: 'btn solid', type: 'submit' }, icon('hexcheck'), watched ? 'Añadir otro visionado' : 'Marcar como vista');
    const form = h('form', { class: 'form' },
      h('p', { class: 'h3' }, watched ? 'Volver a verla' : 'Registrar visionado'),
      h('div', { class: 'btn-row' }, date, h('label', { class: 'toggle', for: `nodate-${key}` }, noDate, 'No recuerdo la fecha')),
      watched ? null : h('div', { class: 'label' }, 'Su nota', starsInput(null, r => { rating = r; })),
      note, h('div', {}, save));
    form.addEventListener('submit', e => {
      e.preventDefault();
      const d = noDate.checked ? null : (date.value || todayISO());
      store.markMovieWatched(meta(), { date: d, rating, note: note.value.trim() });
      ctx.toast(`Registro actualizado: ${meta().title}.`);
    });
    return form;
  }

  function tvLog(it) {
    const out = [];
    const m = meta();
    out.push(h('div', { class: 'chips', role: 'group', 'aria-label': 'Estado' }, TV_STATES.map(s =>
      h('button', { class: 'chip', type: 'button', 'aria-pressed': String(Boolean(it && it.status === s)), onClick: () => {
        store.setTvStatus(m, it && it.status === s ? null : s);
      } }, STATUS_LABEL[s]))));
    if (it) {
      out.push(h('div', { class: 'label' }, 'Su nota', starsInput(it.rating, r => store.setRating(key, r))));
      out.push(noteField(it));
    }
    const seasons = (m.seasons || []).filter(s => s.n > 0);
    if (!seasons.length) {
      out.push(info ? h('p', { class: 'muted' }, 'TMDB no tiene temporadas para esta serie.') : loading('Cargando temporadas'));
      return out;
    }
    const seen = (it && it.seen) || {};
    const noDate = h('input', { type: 'checkbox', id: `tvnodate-${key}`, checked: undated });
    noDate.addEventListener('change', () => { undated = noDate.checked; });
    const when = () => (undated ? null : todayISO());
    const maxN = Math.max(...seasons.map(s => s.n));
    out.push(h('div', { class: 'toolbar' },
      h('p', { class: 'h3' }, 'Temporadas'),
      h('div', { class: 'btn-row' },
        h('label', { class: 'toggle', for: `tvnodate-${key}` }, noDate, 'Sin fecha (la vi hace tiempo)'),
        h('button', { class: 'btn small', type: 'button', onClick: () => { store.setSeasonsUpTo(m, maxN, when()); ctx.toast(`${m.title}: todas las temporadas registradas.`); } }, icon('hexcheck'), 'Todas'))));
    out.push(h('div', { class: 'seasons' }, seasons.map(s => {
      const isSeen = String(s.n) in seen;
      const d = seen[s.n];
      return h('div', { class: `season${isSeen ? ' done' : ''}` },
        h('button', { class: 'check', type: 'button', 'aria-pressed': String(isSeen), 'aria-label': `Temporada ${s.n}: ${isSeen ? 'vista' : 'marcar como vista'}`,
          onClick: () => store.setSeasonSeen(m, s.n, isSeen ? false : when()) }, icon('check')),
        h('div', { class: 'body' },
          h('div', {}, s.name && !/^temporada \d+$/i.test(s.name) ? `Temporada ${s.n} · ${s.name}` : `Temporada ${s.n}`),
          h('div', { class: 'faint mono', style: { fontSize: '12px' } },
            [`${s.eps} caps.`, s.air ? s.air.slice(0, 4) : null, isSeen ? (d ? `vista el ${formatDate(d)}` : 'vista antes de VISOR') : null].filter(Boolean).join(' · '))),
        !isSeen && s.n > 1 ? h('button', { class: 'btn ghost small', type: 'button', 'aria-label': `Marcar hasta la temporada ${s.n}`,
          onClick: () => store.setSeasonsUpTo(m, s.n, when()) }, 'Hasta aquí') : null);
    })));
    return out;
  }

  const unsub = store.subscribe(() => { if (info || store.getItem(key)) drawLog(); });

  drawShell();
  tmdb.details(type, id).then(d => {
    info = d;
    // Keep stored metadata fresh (poster, seasons) for titles already in the log.
    const it = store.getItem(key);
    if (it && type === 'tv' && d.seasons && JSON.stringify(d.seasons) !== JSON.stringify(it.seasons)) store.setSeasons(key, d.seasons);
    drawShell();
  }).catch(e => {
    if (!store.getItem(key)) inner.replaceChildren(h('div', { class: 'sheet-inner' }, h('p', { class: 'status-line err', style: { paddingRight: '44px' } }, errorText(e))));
    else drawShell();
  });

  return { close(isSilent) { silent = Boolean(isSilent); sheet.close(); } };
}
