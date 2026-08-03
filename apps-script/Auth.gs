/** ===========================================================
 *  Auth.gs — validação do código administrativo e resolução do administrador
 *  A autorização administrativa é feita exclusivamente por `codigo`.
 *  =========================================================== */

var Auth = {

  normalizeCode: function (codigo) {
    if (codigo === null || codigo === undefined) return '';
    return String(codigo).trim().toUpperCase();
  },

  /**
   * Resolve o contexto administrativo completo.
   * @returns { admin, marca, role, permissoes[] }
   */
  resolveContext: function (codigo) {
    var valor = this.normalizeCode(codigo);
    if (!valor) fail('NOT_AUTHENTICATED', 'Código administrativo ausente.');

    var admin = Repo.find(CONFIG.SHEETS.ADMINS, function (r) {
      return this.normalizeCode(r.codigo) === valor;
    }.bind(this));

    if (!admin) fail('INVALID_CODE', 'Código administrativo inválido.');
    if (String(admin.status) !== CONFIG.STATUS.ATIVO) {
      fail('ADMIN_INACTIVE', 'Conta administrativa desativada.');
    }

    var marca = Repo.findBy(CONFIG.SHEETS.MARCAS, 'marca_id', admin.marca_id);
    if (!marca) fail('BRAND_NOT_FOUND', 'Marca vinculada não encontrada.');
    if (String(marca.status) !== CONFIG.STATUS_MARCA.ATIVA) {
      fail('BRAND_INACTIVE', 'A marca vinculada a esta conta está inativa.');
    }

    return {
      admin: admin,
      marca: marca,
      role: String(admin.role || ''),
      permissoes: Permissions.forRole(admin.role)
    };
  },

  registrarAcesso: function (ctx) {
    Repo.update(CONFIG.SHEETS.ADMINS, ctx.admin._rowIndex, { ultimo_acesso: Repo.now() });
  },

  /** Projeção segura para o cliente (nunca expõe _rowIndex). */
  publicView: function (ctx) {
    return {
      admin: {
        admin_id: ctx.admin.admin_id,
        nome: ctx.admin.nome,
        codigo: ctx.admin.codigo,
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
