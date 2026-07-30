/** ===========================================================
 *  LegacyService.gs — compatibilidade com o app público atual
 *  A ação "saveUser" continua funcionando exatamente como antes,
 *  sem exigir sessão administrativa.
 *  =========================================================== */

var LegacyService = {
  saveUser: function (usuario) {
    if (!usuario) return { salvo: false };

    var sh = _spreadsheet().getSheetByName(CONFIG.SHEETS.USUARIOS);
    if (!sh) {
      sh = _spreadsheet().insertSheet(CONFIG.SHEETS.USUARIOS);
      sh.appendRow(['uid', 'username', 'email', 'photoURL', 'createdAt', 'atualizado_em']);
    }

    var chave = String(usuario.uid || usuario.username || '').trim();
    if (!chave) return { salvo: false };

    var existente = Repo.find(CONFIG.SHEETS.USUARIOS, function (r) {
      return String(r.uid) === chave || String(r.username) === chave;
    });

    var registro = {
      uid: usuario.uid || '',
      username: usuario.username || '',
      email: usuario.email || '',
      photoURL: usuario.photoURL || '',
      createdAt: usuario.createdAt || Repo.now(),
      atualizado_em: Repo.now()
    };

    if (existente) {
      Repo.update(CONFIG.SHEETS.USUARIOS, existente._rowIndex, registro);
    } else {
      Repo.insert(CONFIG.SHEETS.USUARIOS, registro);
    }
    return { salvo: true };
  }
};
