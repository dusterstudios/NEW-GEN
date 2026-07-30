/** ===========================================================
 *  Auth.gs — validação do idToken e resolução do administrador
 *  O uid vem SEMPRE do token verificado, nunca do corpo do POST.
 *  =========================================================== */

var Auth = {

  /** Verifica o idToken junto ao Google e devolve o payload. */
  verifyIdToken: function (idToken) {
    if (!idToken) fail('NOT_AUTHENTICATED', 'Token ausente.');

    var cache = CacheService.getScriptCache();
    var chave = 'tok_' + Utilities.base64EncodeWebSafe(
      Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, idToken)
    );

    var cached = cache.get(chave);
    if (cached) return JSON.parse(cached);

    var resp = UrlFetchApp.fetch(
      'https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(idToken),
      { muteHttpExceptions: true }
    );

    if (resp.getResponseCode() !== 200) {
      fail('INVALID_TOKEN', 'Token inválido ou expirado.');
    }

    var payload = JSON.parse(resp.getContentText());

    if (String(payload.aud) !== String(CONFIG.FIREBASE_PROJECT_ID)) {
      fail('INVALID_TOKEN', 'Token emitido para outro projeto.');
    }
    if (Number(payload.exp) * 1000 <= Date.now()) {
      fail('TOKEN_EXPIRED', 'Sessão expirada. Entre novamente.');
    }
    if (!payload.sub) {
      fail('INVALID_TOKEN', 'Token sem identificador de usuário.');
    }

    // TTL curto e nunca além da expiração real do token.
    var ttl = Math.min(CONFIG.CACHE_TTL_SEGUNDOS,
                       Math.max(30, Number(payload.exp) - Math.floor(Date.now() / 1000)));
    cache.put(chave, JSON.stringify(payload), ttl);

    return payload;
  },

  /**
   * Resolve o contexto administrativo completo.
   * @returns { admin, marca, role, permissoes[] }
   */
  resolveContext: function (idToken) {
    var token = this.verifyIdToken(idToken);

    var admin = Repo.findBy(CONFIG.SHEETS.ADMINS, 'firebase_uid', token.sub);

    // Primeiro acesso: vínculo por e-mail (linha pré-cadastrada sem uid).
    if (!admin && token.email) {
      var porEmail = Repo.find(CONFIG.SHEETS.ADMINS, function (r) {
        return String(r.email).toLowerCase() === String(token.email).toLowerCase() && !r.firebase_uid;
      });
      if (porEmail) {
        Repo.update(CONFIG.SHEETS.ADMINS, porEmail._rowIndex, { firebase_uid: token.sub });
        porEmail.firebase_uid = token.sub;
        admin = porEmail;
      }
    }

    if (!admin) fail('NOT_ADMIN', 'Esta conta não possui acesso administrativo.');
    if (String(admin.status) !== CONFIG.STATUS.ATIVO) {
      fail('ADMIN_INACTIVE', 'Conta administrativa desativada.');
    }

    var marca = Repo.findBy(CONFIG.SHEETS.MARCAS, 'marca_id', admin.marca_id);
    if (!marca) fail('BRAND_NOT_FOUND', 'Marca vinculada não encontrada.');
    if (String(marca.status) !== CONFIG.STATUS_MARCA.ATIVA) {
      fail('BRAND_INACTIVE', 'A marca vinculada a esta conta está inativa.');
    }

    return {
      token: token,
      admin: admin,
      marca: marca,
      role: String(admin.role || ''),
      permissoes: Permissions.forRole(admin.role)
    };
  },

  registrarAcesso: function (ctx) {
    Repo.update(CONFIG.SHEETS.ADMINS, ctx.admin._rowIndex, { ultimo_acesso: Repo.now() });
  },

  /** Projeção segura para o cliente (nunca expõe _rowIndex nem uid). */
  publicView: function (ctx) {
    return {
      admin: {
        admin_id: ctx.admin.admin_id,
        nome: ctx.admin.nome,
        email: ctx.admin.email,
        role: ctx.admin.role,
        status: ctx.admin.status,
        ultimo_acesso: ctx.admin.ultimo_acesso
      },
      marca: {
        marca_id: ctx.marca.marca_id,
        nome: ctx.marca.nome,
        status: ctx.marca.status,
        meta: parseMeta(ctx.marca.meta_json)
      },
      permissoes: ctx.permissoes
    };
  }
};

function parseMeta(raw) {
  if (!raw) return {};
  try { return JSON.parse(raw); } catch (e) { return {}; }
}
