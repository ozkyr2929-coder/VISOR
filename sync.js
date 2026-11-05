// Sync between devices through a secret GitHub gist that holds visor-datos.json.
import { mergeStates } from './model.js';

const API = 'https://api.github.com';
const FILE = 'visor-datos.json';
const DESCRIPTION = 'VISOR · registro de cine y series';
const DEBOUNCE_MS = 4000;

function syncError(code, message) { const e = new Error(message); e.code = code; return e; }

// Stable JSON (sorted keys) so equal data always compares equal.
function stable(v) {
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`;
  if (v && typeof v === 'object') return `{${Object.keys(v).sort().filter(k => v[k] !== undefined).map(k => `${JSON.stringify(k)}:${stable(v[k])}`).join(',')}}`;
  return JSON.stringify(v);
}
const dataOf = s => ({ items: (s && s.items) || {}, settings: (s && s.settings) || {} });

export function createSync({ store, fetch, now = Date.now, setTimer = (fn, ms) => setTimeout(fn, ms), clearTimer = id => clearTimeout(id) }) {
  const listeners = new Set();
  let status = { state: store.getDevice().gistId ? 'idle' : 'disconnected', lastSync: store.getDevice().lastSync || null };
  let timer = null;
  let running = null;
  let again = false;

  const setStatus = patch => { status = { ...status, ...patch }; for (const fn of listeners) fn(status); };
  const token = () => store.getDevice().ghToken;

  async function api(method, path, body, tok = token()) {
    let res;
    try {
      res = await fetch(`${API}${path}`, {
        method,
        headers: { Authorization: `Bearer ${tok}`, Accept: 'application/vnd.github+json', ...(body ? { 'Content-Type': 'application/json' } : {}) },
        body: body ? JSON.stringify(body) : undefined,
        cache: 'no-store',
      });
    } catch { throw syncError('offline', 'Sin conexión'); }
    if (res.status === 401) throw syncError('unauthorized', 'El código de GitHub no es válido o ha caducado');
    if (!res.ok) throw syncError('http', `GitHub respondió ${res.status}`);
    return res.json();
  }

  const payload = () => ({ app: 'visor', v: 1, savedAt: now(), ...dataOf(store.getState()) });

  async function pull(gistId) {
    const g = await api('GET', `/gists/${gistId}`);
    const file = g && g.files && g.files[FILE];
    if (!file) return null;
    let text = file.content;
    if (file.truncated && file.raw_url) {
      try { text = await (await fetch(file.raw_url, { cache: 'no-store' })).text(); } catch { throw syncError('offline', 'Sin conexión'); }
    }
    try { return dataOf(JSON.parse(text)); } catch { throw syncError('corrupt', 'Los datos de GitHub no se pueden leer'); }
  }

  async function runSync() {
    const { gistId } = store.getDevice();
    const remote = await pull(gistId);
    const local = dataOf(store.getState());
    const merged = mergeStates(local, remote || {});
    if (stable(merged) !== stable(local)) store.replaceState(merged);
    if (!remote || stable(merged) !== stable(remote)) {
      await api('PATCH', `/gists/${gistId}`, { files: { [FILE]: { content: JSON.stringify(payload()) } } });
    }
    store.setDevice({ lastSync: now() });
  }

  async function syncNow() {
    if (!token() || !store.getDevice().gistId) { setStatus({ state: 'disconnected' }); return 'disconnected'; }
    if (running) { again = true; return running; }
    setStatus({ state: 'syncing' });
    running = (async () => {
      let result;
      try { await runSync(); result = 'ok'; }
      catch (e) { result = ['offline', 'unauthorized'].includes(e.code) ? e.code : 'error'; if (result === 'error') console.error(e); }
      setStatus({ state: result, lastSync: store.getDevice().lastSync || null });
      return result;
    })();
    const result = await running;
    running = null;
    if (again) { again = false; return syncNow(); }
    return result;
  }

  function schedule() {
    if (!token() || !store.getDevice().gistId) return;
    if (timer) clearTimer(timer);
    timer = setTimer(() => { timer = null; syncNow(); }, DEBOUNCE_MS);
  }

  store.subscribe(e => { if (e.local) schedule(); });

  return {
    async connect(rawToken) {
      const tok = String(rawToken || '').trim();
      const user = await api('GET', '/user', null, tok);
      const gists = await api('GET', '/gists?per_page=100', null, tok);
      let gist = (gists || []).find(g => g.files && g.files[FILE]);
      if (!gist) {
        gist = await api('POST', '/gists', { description: DESCRIPTION, public: false, files: { [FILE]: { content: JSON.stringify(payload()) } } }, tok);
      }
      store.setDevice({ ghToken: tok, gistId: gist.id, login: user.login });
      await syncNow();
      return { login: user.login };
    },
    syncNow,
    schedule,
    disconnect() {
      if (timer) clearTimer(timer);
      store.setDevice({ ghToken: null, gistId: null, login: null, lastSync: null });
      setStatus({ state: 'disconnected', lastSync: null });
    },
    isConnected: () => Boolean(token() && store.getDevice().gistId),
    status: () => status,
    onStatus(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  };
}
