// Ajustes: name, TMDB key, GitHub sync, backup, erase, credits. Also the first-run welcome.
import { h, icon, openSheet, fill } from './ui.js';
import { mergeStates, todayISO } from './model.js';

const TOKEN_URL = 'https://github.com/settings/tokens/new?scopes=gist&description=VISOR';
const TMDB_API_URL = 'https://www.themoviedb.org/settings/api';
const VERSION = '1.2.0';

export function render(root, ctx) {
  const { store, tmdb, sync } = ctx;
  const page = h('div', { class: 'page' });
  root.append(page);
  let confirmErase = false;
  let tmdbMsg = null;
  let syncMsg = null;
  let busy = false;      // TMDB check running
  let linking = false;   // GitHub connect running

  function nameSection() {
    const input = h('input', { class: 'input', id: 'set-name', value: store.getState().settings.name, placeholder: 'señor', autocomplete: 'given-name', maxlength: '40' });
    input.addEventListener('change', () => { store.setSettings({ name: input.value.trim() }); ctx.toast(`Entendido, ${ctx.name()}.`); });
    return h('section', { class: 'frame form' },
      h('h2', { class: 'h2' }, 'Identificación'),
      h('label', { class: 'label', for: 'set-name' }, '¿Cómo quiere que le llame?', input));
  }

  function tmdbSection() {
    const has = Boolean(store.getState().settings.tmdbKey);
    const input = h('input', { class: 'input', id: 'set-tmdb', type: 'password', autocomplete: 'off', spellcheck: 'false',
      placeholder: has ? 'Clave guardada · pegue otra para cambiarla' : 'Pegue aquí su clave o token de TMDB' });
    const save = h('button', { class: 'btn solid', type: 'submit', disabled: busy }, busy ? 'Comprobando…' : 'Comprobar y guardar');
    const form = h('form', { class: 'form' }, h('label', { class: 'label', for: 'set-tmdb' }, 'Clave de la API (v3) o token de lectura', input), h('div', {}, save));
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const key = input.value.trim();
      if (!key) { input.focus(); return; }
      busy = true; tmdbMsg = null; draw();
      try {
        if (await tmdb.validate(key)) { store.setSettings({ tmdbKey: key }); tmdbMsg = ['ok', 'Clave aceptada. Catálogo completo en línea.']; }
        else tmdbMsg = ['err', 'TMDB no acepta esa clave. Copie la «Clave de la API» completa, sin espacios.'];
      } catch { tmdbMsg = ['err', 'No he podido contactar con TMDB. Compruebe la conexión.']; }
      busy = false; draw();
    });
    return h('section', { class: 'frame', style: { display: 'grid', gap: '14px' } },
      h('h2', { class: 'h2' }, 'Catálogo · TMDB'),
      h('p', { class: `status-line ${has ? 'ok' : 'warn'}` }, has ? '● Conectado al catálogo de TMDB.' : '● Sin clave: la búsqueda y el catálogo no funcionarán.'),
      tmdbMsg ? h('p', { class: `status-line ${tmdbMsg[0]}` }, tmdbMsg[1]) : null,
      h('ol', { class: 'steps' },
        h('li', {}, 'Cree una cuenta gratis en ', h('a', { href: 'https://www.themoviedb.org/signup', target: '_blank', rel: 'noopener' }, 'themoviedb.org'), ' y confirme su correo.'),
        h('li', {}, 'Abra ', h('a', { href: TMDB_API_URL, target: '_blank', rel: 'noopener' }, 'Ajustes → API'), ' y pida una clave de tipo «Developer» (uso personal). En la web de su app puede poner cualquier dirección, por ejemplo la de esta app.'),
        h('li', {}, 'Copie la «Clave de la API» y péguela aquí. Se sincroniza con sus otros dispositivos.')),
      form);
  }

  function syncSection() {
    const dev = store.getDevice();
    const st = sync.status();
    const connected = sync.isConnected();
    const last = dev.lastSync ? new Date(dev.lastSync).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' }) : 'nunca';
    const parts = [h('h2', { class: 'h2' }, 'Sincronización · GitHub')];
    if (syncMsg) parts.push(h('p', { class: `status-line ${syncMsg[0]}` }, syncMsg[1]));
    if (connected) {
      const stateText = { ok: 'Sincronizado', syncing: 'Sincronizando…', offline: 'Sin conexión: se sincronizará al volver la red', unauthorized: 'GitHub rechaza el código. Vuelva a conectar este dispositivo.', error: 'Último intento fallido; se reintentará', idle: 'Preparado' }[st.state] || 'Preparado';
      parts.push(
        h('p', { class: `status-line ${st.state === 'unauthorized' || st.state === 'error' ? 'err' : 'ok'}` }, `● ${stateText}`),
        h('dl', { class: 'kv' }, h('dt', {}, 'Cuenta'), h('dd', {}, dev.login || '—'), h('dt', {}, 'Última vez'), h('dd', {}, last)),
        h('div', { class: 'btn-row' },
          h('button', { class: 'btn', type: 'button', onClick: async () => { await sync.syncNow(); draw(); } }, icon('sync'), 'Sincronizar ahora'),
          h('button', { class: 'btn ghost', type: 'button', onClick: () => { sync.disconnect(); syncMsg = ['warn', 'Este dispositivo ya no se sincroniza. Sus datos siguen aquí.']; draw(); } }, 'Desconectar este dispositivo')));
    } else {
      const input = h('input', { class: 'input', id: 'set-gh', type: 'password', autocomplete: 'off', spellcheck: 'false', placeholder: 'ghp_…' });
      const go = h('button', { class: 'btn solid', type: 'submit', disabled: linking }, linking ? 'Conectando…' : 'Conectar');
      const form = h('form', { class: 'form' }, h('label', { class: 'label', for: 'set-gh' }, 'Código de GitHub', input), h('div', {}, go));
      form.addEventListener('submit', async e => {
        e.preventDefault();
        if (!input.value.trim()) { input.focus(); return; }
        linking = true; syncMsg = null; draw();
        try { const r = await sync.connect(input.value); syncMsg = ['ok', `Conectado como ${r.login}. Sus datos viajan entre dispositivos.`]; }
        catch (err) { syncMsg = ['err', err.code === 'unauthorized' ? 'GitHub no acepta ese código. Cree uno nuevo con el enlace del paso 2.' : err.code === 'offline' ? 'Sin conexión. Inténtelo con red.' : 'No he podido conectar con GitHub. Pruebe de nuevo.']; }
        linking = false; draw();
      });
      parts.push(
        h('p', { class: 'muted' }, 'Guarda una copia privada de su registro en su cuenta de GitHub y la mantiene igual en el móvil y en el ordenador.'),
        h('ol', { class: 'steps' },
          h('li', {}, 'Entre en ', h('a', { href: 'https://github.com/login', target: '_blank', rel: 'noopener' }, 'GitHub'), ' (la cuenta gratuita donde está publicada esta app).'),
          h('li', {}, 'Abra ', h('a', { href: TOKEN_URL, target: '_blank', rel: 'noopener' }, 'este enlace'), '. Ya viene marcado solo el permiso «gist». En «Expiration» elija «No expiration» y pulse «Generate token».'),
          h('li', {}, 'Copie el código (empieza por ', h('code', {}, 'ghp_'), ') y péguelo aquí. Guárdelo en sus notas: lo necesitará una vez en cada dispositivo.'),
          h('li', {}, 'En el otro dispositivo, abra VISOR y pegue el mismo código. Traerá sus datos y su clave de TMDB.')),
        form,
        h('p', { class: 'faint', style: { fontSize: 'var(--t-xs)' } }, 'El código se guarda solo en este dispositivo.'));
    }
    return h('section', { class: 'frame', style: { display: 'grid', gap: '14px' } }, ...parts);
  }

  function backupSection() {
    const file = h('input', { type: 'file', id: 'set-import', accept: 'application/json,.json', hidden: true });
    file.addEventListener('change', async () => {
      const f = file.files[0];
      if (!f) return;
      try {
        const data = JSON.parse(await f.text());
        if (!data || typeof data.items !== 'object') throw new Error('shape');
        // Only titles are imported; settings (name, TMDB key) stay as they are on this device.
        const merged = mergeStates(store.getState(), { items: data.items });
        store.replaceState({ items: merged.items, settings: store.getState().settings });
        sync.schedule();
        ctx.toast('Copia importada y combinada con su registro.');
      } catch { ctx.toast('Ese archivo no es una copia de VISOR.', { error: true }); }
      file.value = '';
    });
    const exportBtn = h('button', { class: 'btn', type: 'button', onClick: () => {
      const s = store.getState();
      const data = { app: 'visor', v: 1, exportedAt: new Date().toISOString(), items: s.items, settings: { ...s.settings, tmdbKey: '' } };
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' }));
      const a = h('a', { href: url, download: `visor-copia-${todayISO()}.json` });
      document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } }, icon('download'), 'Exportar copia');
    return h('section', { class: 'frame', style: { display: 'grid', gap: '14px' } },
      h('h2', { class: 'h2' }, 'Copia de seguridad'),
      h('p', { class: 'muted' }, 'Descargue su registro en un archivo o importe uno anterior. Al importar se combina con lo que ya tiene.'),
      h('div', { class: 'btn-row' }, exportBtn, h('label', { class: 'btn ghost', for: 'set-import', tabindex: '0', role: 'button',
        onKeydown: e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); file.click(); } } }, icon('upload'), 'Importar copia'), file));
  }

  function dangerSection() {
    return h('section', { class: 'frame quiet', style: { display: 'grid', gap: '12px' } },
      h('h2', { class: 'h2' }, 'Borrar registro'),
      confirmErase
        ? h('div', { style: { display: 'grid', gap: '10px' } },
            h('p', { class: 'status-line err' }, '¿Seguro? Se borrará todo su registro, también en sus otros dispositivos sincronizados.'),
            h('div', { class: 'btn-row' },
              h('button', { class: 'btn danger', type: 'button', onClick: () => { store.clearAll(); confirmErase = false; ctx.toast('Registro borrado.'); draw(); } }, icon('trash'), 'Sí, borrar todo'),
              h('button', { class: 'btn ghost', type: 'button', onClick: () => { confirmErase = false; draw(); } }, 'Cancelar')))
        : h('div', {}, h('button', { class: 'btn danger', type: 'button', onClick: () => { confirmErase = true; draw(); } }, 'Borrar todo mi registro')));
  }

  function aboutSection() {
    return h('section', { class: 'attrib' },
      h('p', { class: 'mono' }, `VISOR ${VERSION}`),
      h('p', {}, 'Este producto utiliza la API de TMDB, pero no está respaldado ni certificado por TMDB. ',
        h('a', { href: 'https://www.themoviedb.org/', target: '_blank', rel: 'noopener' }, 'themoviedb.org')),
      h('p', {}, 'Datos de plataformas por JustWatch.'));
  }

  function draw() {
    fill(page, 
      h('header', { style: { display: 'grid', gap: '10px' } }, h('p', { class: 'eyebrow' }, 'Ajustes'), h('h1', { class: 'h1' }, 'Configuración del sistema')),
      h('div', { class: 'split' },
        h('div', { style: { display: 'grid', gap: '18px' } }, nameSection(), tmdbSection()),
        h('div', { style: { display: 'grid', gap: '18px' } }, syncSection(), backupSection(), dangerSection())),
      aboutSection());
  }

  // Never redraw under the user's fingers: a sync finishing while they type would wipe the field.
  const safeDraw = () => { if (!busy && !linking && !(document.activeElement && document.activeElement.closest('.page input, .page textarea'))) draw(); };
  const off = sync.onStatus(safeDraw);
  draw();
  return { update: safeDraw, destroy: off };
}

export function openWelcome(ctx) {
  const input = h('input', { class: 'input', id: 'welcome-name', placeholder: 'señor', autocomplete: 'given-name', maxlength: '40' });
  const go = h('button', { class: 'btn solid', type: 'submit' }, 'Iniciar');
  const form = h('form', { class: 'form' }, h('label', { class: 'label', for: 'welcome-name' }, '¿Cómo quiere que le llame?', input), h('div', {}, go));
  const inner = h('div', { class: 'sheet-inner' },
    h('div', { style: { display: 'grid', gap: '10px', paddingRight: '44px' } },
      h('p', { class: 'eyebrow' }, 'Protocolo de inicio'),
      h('h2', { class: 'h1' }, 'Bienvenido a VISOR'),
      h('p', { class: 'lead' }, 'Su registro personal de cine y series. Sin perfiles, sin seguidores: solo lo que usted ve.')),
    h('ol', { class: 'steps' },
      h('li', {}, 'Conecte el catálogo con su clave gratuita de TMDB (Ajustes).'),
      h('li', {}, 'Si quiere, active la sincronización entre móvil y ordenador.'),
      h('li', {}, 'Póngase al día marcando de golpe lo que ya ha visto.')),
    form);
  const sheet = openSheet(inner, { label: 'Bienvenida', onClose: () => ctx.store.setDevice({ welcomed: true }) });
  form.addEventListener('submit', e => {
    e.preventDefault();
    if (input.value.trim()) ctx.store.setSettings({ name: input.value.trim() });
    ctx.store.setDevice({ welcomed: true });
    sheet.close();
    ctx.go(ctx.store.getState().settings.tmdbKey ? 'catalogo' : 'ajustes');
    ctx.toast(`A su servicio, ${ctx.name()}.`);
  });
  setTimeout(() => input.focus(), 60);
}
