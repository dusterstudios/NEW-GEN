/* ===========================================================
   AdminApi — cliente ÚNICO do Google Apps Script (camada admin)
   -----------------------------------------------------------
   Regras:
   - Toda chamada envia o idToken do Firebase. NUNCA envia marca_id.
   - A marca é resolvida no servidor a partir do uid autenticado.
   - Erros são normalizados em { code, message }.
   =========================================================== */

export const ADMIN_ENDPOINT =
  "https://script.google.com/macros/s/AKfycbwxzNGglTQb9BX4uzhLOe-9KrcJEW-FerrHT-LCpbDqF4rFJyMvciflinwirTHAJi7FxA/exec";

export class AdminApiError extends Error {
  constructor(code, message, details) {
    super(message || code);
    this.name = "AdminApiError";
    this.code = code || "UNKNOWN_ERROR";
    this.details = details || null;
  }
}

/** Campos que o cliente NUNCA pode enviar: o servidor os define. */
const FORBIDDEN_CLIENT_FIELDS = ["marca_id", "marcaId", "role", "admin_id", "adminId"];

function stripServerOwnedFields(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return payload;
  const clean = {};
  for (const [k, v] of Object.entries(payload)) {
    if (FORBIDDEN_CLIENT_FIELDS.includes(k)) continue;
    clean[k] = v;
  }
  return clean;
}

/**
 * @param {string} action  ex: "admin.session", "personagem.listar"
 * @param {object} payload dados da operação (sem marca_id)
 * @param {() => Promise<string|null>} getIdToken função que devolve o idToken atual
 */
export async function callAdminApi(action, payload, getIdToken) {
  const idToken = getIdToken ? await getIdToken() : null;

  let response;
  try {
    response = await fetch(ADMIN_ENDPOINT, {
     method: "POST",
     headers: {
        "Content-Type": "application/json"
     },
     body: JSON.stringify({
        action: "admin.session",
        idToken,
        payload: {}
    })
});
  } catch (networkError) {
    throw new AdminApiError("NETWORK_ERROR", "Falha de rede ao contatar o servidor.", networkError.message);
  }

  let body;
  const text = await response.text();
  try {
    body = JSON.parse(text);
  } catch {
    throw new AdminApiError("BAD_RESPONSE", "Resposta inválida do servidor.", text.slice(0, 300));
  }

  if (!body || body.ok !== true) {
    const err = (body && body.error) || {};
    throw new AdminApiError(err.code || "SERVER_ERROR", err.message || "Operação recusada.", err.details);
  }

  return body.data;
}
