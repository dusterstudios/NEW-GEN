/* ===========================================================
   AdminApi — REFATORADO para código simples
   Sem JWT, sem OAuth, apenas código no payload
   =========================================================== */

export const ADMIN_ENDPOINT =
  "https://script.google.com/macros/s/AKfycbzHN69Jwqk1QVdmt1N5g3P7A-kR9QiwAltpVjp81MQ-bEH9cU7Qj6ymp7t4CM6pxf93UQ/exec";

export class AdminApiError extends Error {
  constructor(code, message, details) {
    super(message || code);
    this.name = "AdminApiError";
    this.code = code || "UNKNOWN_ERROR";
    this.details = details || null;
  }
}

/**
 * Campos que o cliente NUNCA pode enviar: o servidor os define
 */
const FORBIDDEN_CLIENT_FIELDS = ["admin_id", "marca_id", "role"];

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
 * Chama a API do Apps Script
 * @param {string} action  ex: "admin.login", "personagem.listar"
 * @param {object} payload dados da operação
 * @param {() => Promise<string|null>} getCodeProvider função que devolve o código atual
 */
export async function callAdminApi(action, payload, getCodeProvider) {
  let codigo = null;
  if (getCodeProvider) {
    codigo = await getCodeProvider();
  } else if (payload && payload.codigo) {
    codigo = payload.codigo;
  }

  let response;
  try {
    response = await fetch(ADMIN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        action,
        codigo: codigo || null,  // Envia código em vez de idToken
        payload: stripServerOwnedFields(payload) || {}
      })
    });
  } catch (networkError) {
    throw new AdminApiError(
      "NETWORK_ERROR",
      "Falha de rede ao contatar o servidor.",
      networkError.message
    );
  }

  let body;
  const text = await response.text();
  try {
    body = JSON.parse(text);
  } catch {
    throw new AdminApiError(
      "BAD_RESPONSE",
      "Resposta inválida do servidor.",
      text.slice(0, 300)
    );
  }

  if (!body || body.ok !== true) {
    const err = (body && body.error) || {};
    throw new AdminApiError(
      err.code || "SERVER_ERROR",
      err.message || "Operação recusada.",
      err.details
    );
  }

  return body.data;
}