/** ===========================================================
 *  FirebaseAdmin.gs — criação de contas no Firebase Auth
 *  -----------------------------------------------------------
 *  Usa a Identity Toolkit REST API com a Web API Key do projeto
 *  (script property FIREBASE_API_KEY).
 *  Se a chave não estiver configurada, o admin é pré-cadastrado
 *  apenas por e-mail e o vínculo do uid acontece no 1º login
 *  (ver Auth.resolveContext).
 *  A senha NUNCA é gravada na planilha.
 *  =========================================================== */

var FirebaseAdmin = {

  apiKey: function () {
    return PropertiesService.getScriptProperties().getProperty('FIREBASE_API_KEY') || '';
  },

  disponivel: function () {
    return !!this.apiKey();
  },

  /** @returns {string|null} uid criado, ou null se indisponível. */
  criarUsuario: function (email, senha) {
    if (!this.disponivel()) return null;
    if (!senha || String(senha).length < 6) {
      fail('VALIDATION', 'A senha precisa ter no mínimo 6 caracteres.');
    }

    var resp = UrlFetchApp.fetch(
      'https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=' + this.apiKey(),
      {
        method: 'post',
        contentType: 'application/json',
        muteHttpExceptions: true,
        payload: JSON.stringify({ email: email, password: senha, returnSecureToken: false })
      }
    );

    var body = JSON.parse(resp.getContentText() || '{}');
    if (resp.getResponseCode() !== 200) {
      var motivo = body.error && body.error.message ? body.error.message : 'desconhecido';
      if (motivo === 'EMAIL_EXISTS') fail('DUPLICATE', 'Já existe uma conta Firebase com este e-mail.');
      fail('FIREBASE_ERROR', 'Não foi possível criar a conta: ' + motivo);
    }
    return body.localId || null;
  }
};
