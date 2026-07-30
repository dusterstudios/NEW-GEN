/* ===========================================================
   AdminSession — autenticação e sessão administrativa
   -----------------------------------------------------------
   Fluxo:
     Firebase Auth (email/senha)  ->  idToken
     -> Apps Script "admin.session" valida o token
     -> devolve { admin, marca, permissoes }
   A sessão guardada no sessionStorage é APENAS cache de UI.
   Nenhuma decisão de autorização depende dela.
   =========================================================== */

import {
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";

import { auth } from "../../firebase.js";
import { callAdminApi, AdminApiError } from "./AdminApi.js";
import { createPermissionSet } from "./Permissions.js";

const CACHE_KEY = "newgen_admin_session_cache";

let _session = null;               // { admin, marca, permissoes }
let _permissions = createPermissionSet([]);
const _listeners = new Set();

/* ---------- token ---------- */

async function getIdToken(forceRefresh = false) {
  const user = auth.currentUser;
  if (!user) return null;
  return user.getIdToken(forceRefresh);
}

/** Passado ao AdminApi para que toda chamada carregue o token atual. */
export const tokenProvider = () => getIdToken(false);

/* ---------- cache de UI ---------- */

function writeCache(session) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(session));
  } catch { /* modo privado: ignorar */ }
}

function readCache() {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function clearCache() {
  try { sessionStorage.removeItem(CACHE_KEY); } catch { /* noop */ }
}

function setSession(session) {
  _session = session;
  _permissions = createPermissionSet(session ? session.permissoes : []);
  if (session) writeCache(session); else clearCache();
  _listeners.forEach(fn => {
    try { fn(session); } catch (e) { console.error("[AdminSession] listener:", e); }
  });
}

/* ---------- API pública ---------- */

export const AdminSession = {
  /** Login com e-mail/senha (conta individual — nunca compartilhada). */
  async login(email, password) {
    if (!email || !password) {
      throw new AdminApiError("VALIDATION", "Informe e-mail e senha.");
    }
    await signInWithEmailAndPassword(auth, email.trim(), password);
    return this.refresh();
  },

  /** Re-resolve a sessão no servidor. Fonte da verdade. */
  async refresh() {
    const token = await getIdToken(true);
    if (!token) {
      setSession(null);
      throw new AdminApiError("NOT_AUTHENTICATED", "Nenhuma sessão do Firebase ativa.");
    }
    const data = await callAdminApi("admin.session", {}, () => Promise.resolve(token));
    setSession({
      admin: data.admin,
      marca: data.marca,
      permissoes: data.permissoes || [],
      resolvidoEm: new Date().toISOString()
    });
    return _session;
  },

  async logout() {
    try { await signOut(auth); } catch (e) { console.error(e); }
    setSession(null);
  },

  /** Sessão em memória (ou cache de UI logo após reload). */
  get() {
    if (!_session) {
      const cached = readCache();
      if (cached) {
        _session = cached;
        _permissions = createPermissionSet(cached.permissoes);
      }
    }
    return _session;
  },

  /** Marca do admin — SOMENTE LEITURA. Nunca há setMarca(). */
  getMarca() {
    const s = this.get();
    return s ? Object.freeze({ ...s.marca }) : null;
  },

  getAdmin() {
    const s = this.get();
    return s ? Object.freeze({ ...s.admin }) : null;
  },

  permissions() {
    this.get();
    return _permissions;
  },

  isAuthenticated() {
    return !!this.get();
  },

  onChange(listener) {
    _listeners.add(listener);
    return () => _listeners.delete(listener);
  },

  /** Reconecta a sessão admin quando o Firebase restaura o usuário. */
  observeFirebase() {
    return onAuthStateChanged(auth, async user => {
      if (!user) {
        setSession(null);
        return;
      }
      try {
        await this.refresh();
      } catch (e) {
        console.warn("[AdminSession] usuário Firebase sem acesso administrativo:", e.code || e.message);
        setSession(null);
      }
    });
  }
};

/** Atalho para os repositórios: chamada já autenticada. */
export function adminCall(action, payload) {
  return callAdminApi(action, payload, tokenProvider);
}
