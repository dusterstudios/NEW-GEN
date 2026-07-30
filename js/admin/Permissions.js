/* ===========================================================
   Permissions — verificação de permissões ORIENTADA A DADOS
   -----------------------------------------------------------
   Nenhum if/switch por cargo. A lista de permissões chega do
   servidor (aba `Permissoes`) e aqui só respondemos sim/não.
   Uso exclusivo de UI: o servidor revalida tudo.
   =========================================================== */

export function createPermissionSet(permissoes) {
  const set = new Set(Array.isArray(permissoes) ? permissoes : []);

  return {
    /** @param {string} permissao ex: "personagem.editar" */
    can(permissao) {
      if (!permissao) return false;
      if (set.has("*")) return true;                 // super_admin (definido em planilha)
      if (set.has(permissao)) return true;
      const [dominio] = permissao.split(".");
      return set.has(`${dominio}.*`);                // curinga por domínio
    },
    canAny(lista) {
      return (lista || []).some(p => this.can(p));
    },
    canAll(lista) {
      return (lista || []).every(p => this.can(p));
    },
    list() {
      return Array.from(set);
    }
  };
}

/**
 * Esconde/desabilita elementos com [data-require-perm="x.y"].
 * Puramente cosmético — a autorização real é do Apps Script.
 */
export function applyPermissionsToDom(permissionSet, root = document) {
  root.querySelectorAll("[data-require-perm]").forEach(el => {
    const needed = el.getAttribute("data-require-perm").split(/\s+/).filter(Boolean);
    const allowed = permissionSet.canAny(needed);
    el.hidden = !allowed;
    if ("disabled" in el) el.disabled = !allowed;
  });
}
