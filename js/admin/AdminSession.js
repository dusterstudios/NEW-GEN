/* ===========================================================
   AdminSession — REFATORADO para código simples
   Sem Firebase, sem JWT, apenas armazenamento local
   =========================================================== */

import { callAdminApi, AdminApiError } from "./AdminApi.js";
import { createPermissionSet } from "./Permissions.js";

const CACHE_KEY = "newgen_admin_session_cache";

let _session = null;
let _permissions = createPermissionSet([]);
const _listeners = new Set();

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
  /**
   * Login com código de segurança
   */
  async login(codigo) {
    if (!codigo || typeof codigo !== 'string') {
      throw new AdminApiError("VALIDATION", "Código inválido.");
    }

    const data = await callAdminApi("admin.login", { codigo });
    
    setSession({
      admin: data.admin,
      marca: data.marca,
      permissoes: data.permissoes || [],
      resolvidoEm: new Date().toISOString()
    });

    return _session;
  },

  async logout() {
    setSession(null);
  },

  /**
   * Sessão em memória (ou cache de UI logo após reload)
   */
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
  }
};

/**
 * Atalho para os repositórios: chamada já autenticada
 * Agora passa o código em vez de token
 */
export function adminCall(action, payload) {
  const session = AdminSession.get();
  const codigo = session ? session.admin.codigo : null;
  return callAdminApi(action, payload, () => Promise.resolve(codigo));
}