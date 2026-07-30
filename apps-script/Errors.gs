/** Erros padronizados: { ok:false, error:{ code, message } } */

function AppError(code, message, details) {
  var e = new Error(message || code);
  e.appCode = code;
  e.details = details || null;
  return e;
}

function fail(code, message, details) {
  throw AppError(code, message, details);
}

function jsonOut(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function okResponse(data) {
  return jsonOut({ ok: true, data: data || {} });
}

function errorResponse(err) {
  return jsonOut({
    ok: false,
    error: {
      code: err && err.appCode ? err.appCode : 'INTERNAL_ERROR',
      message: err && err.message ? err.message : 'Erro interno.',
      details: err && err.details ? err.details : null
    }
  });
}
