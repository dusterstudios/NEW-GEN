/* ===========================================================
   AdminGuard — proteção das telas administrativas
   REFATORADO: Sem Firebase, apenas valida sessão local
   -----------------------------------------------------------
   Redireciona quem não tem sessão válida. É apenas UX:
   a barreira real está no Guard.gs do Apps Script.
   =========================================================== */

import { AdminSession } from "./AdminSession.js";

export const AdminGuard = {
  /**
   * @param {object} opts
   * @param {string} [opts.redirectTo="#login"] rota interna quando não autenticado
   * @param {string[]} [opts.requirePermissions] permissões exigidas pela tela
   */
  async require(opts = {}) {
    const { redirectTo = "#login", requirePermissions = [] } = opts;

    let session = AdminSession.get();
    if (!session) {
      if (redirectTo) location.hash = redirectTo;
      return { allowed: false, reason: "NOT_AUTHENTICATED", session: null };
    }

    if (requirePermissions.length && !AdminSession.permissions().canAll(requirePermissions)) {
      return { allowed: false, reason: "FORBIDDEN", session };
    }

    return { allowed: true, reason: null, session };
  }
};