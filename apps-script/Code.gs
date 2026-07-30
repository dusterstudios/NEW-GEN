/** ===========================================================
 *  Code.gs — ponto de entrada do Web App
 *  Publicar como: Executar como "Eu" / Acesso "Qualquer pessoa".
 *  A autorização real é feita pelo Guard, não pelo Apps Script.
 *  =========================================================== */

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      fail('VALIDATION', 'Corpo da requisição vazio.');
    }
    var body = JSON.parse(e.postData.contents);
    return okResponse(routeRequest(body));
  } catch (err) {
    console.error('[doPost] ' + (err.appCode || '') + ' ' + err.message);
    return errorResponse(err);
  }
}

function doGet() {
  return jsonOut({ ok: true, data: { servico: 'NEW GEN Admin API', versao: '1.0.0' } });
}
