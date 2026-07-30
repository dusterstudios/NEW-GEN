/** ===========================================================
 *  AdminService.gs — contas administrativas
 *  Regras invioláveis:
 *   - 1 admin = 1 marca (vínculo permanente; marca_id nunca é editável)
 *   - contas individuais; nenhum login compartilhado
 *   - a marca de um novo admin é a marca de quem o cria
 *  =========================================================== */

var AdminService = {

  session: function (ctx) {
    Auth.registrarAcesso(ctx);
    Audit.log(ctx, 'admin.session', ctx.admin.admin_id, 'OK');
    return Auth.publicView(ctx);
  },

  _view: function (a) {
    return {
      admin_id: a.admin_id, nome: a.nome, email: a.email, marca_id: a.marca_id,
      role: a.role, status: a.status, criado_em: a.criado_em,
      ultimo_acesso: a.ultimo_acesso, criado_por: a.criado_por,
      observacoes: a.observacoes, meta: parseMeta(a.meta_json)
    };
  },

  listar: function (ctx) {
    Guard.assertPermission(ctx, 'admin.ver');
    var linhas = Guard.scopeFilter(ctx, Repo.all(CONFIG.SHEETS.ADMINS));
    return { itens: linhas.map(function (r) { return AdminService._view(r); }) };
  },

  obter: function (ctx, p) {
    Guard.assertPermission(ctx, 'admin.ver');
    var alvo = Repo.findBy(CONFIG.SHEETS.ADMINS, 'admin_id', p.admin_alvo_id);
    Guard.assertScope(ctx, alvo, 'admin.obter');
    return { item: this._view(alvo) };
  },

  criar: function (ctx, p) {
    Guard.assertPermission(ctx, 'admin.criar');

    var nome  = Guard.requireString(p.nome, 'nome', 120);
    var email = Guard.requireEmail(p.email);

    var jaExiste = Repo.find(CONFIG.SHEETS.ADMINS, function (r) {
      return String(r.email).toLowerCase() === email;
    });
    if (jaExiste) fail('DUPLICATE', 'Já existe um administrador com este e-mail.');

    // Cargo: só é possível conceder cargos que existam na aba Permissoes,
    // e nunca um cargo acima do próprio (a menos que haja admin.definir_role).
    var role = Guard.requireEnum(p.role_solicitada, 'role', RoleRegistry.listar());
    if (role !== ctx.role) Guard.assertPermission(ctx, 'admin.definir_role');

    // A MARCA NÃO VEM DO CLIENTE: é herdada de quem está criando.
    var marcaId = ctx.marca.marca_id;

    var uid = '';
    if (p.senha) uid = FirebaseAdmin.criarUsuario(email, String(p.senha)) || '';

    var registro = {
      admin_id: Repo.uuid(),
      firebase_uid: uid,
      nome: nome,
      email: email,
      marca_id: marcaId,
      role: role,
      status: CONFIG.STATUS.ATIVO,
      criado_em: Repo.now(),
      ultimo_acesso: '',
      criado_por: ctx.admin.admin_id,
      observacoes: p.observacoes ? String(p.observacoes).slice(0, 500) : '',
      meta_json: '{}'
    };

    Repo.insert(CONFIG.SHEETS.ADMINS, registro);
    Audit.log(ctx, 'admin.criar', registro.admin_id, 'OK', email + ' / ' + role);
    return { item: this._view(registro), vinculo_pendente: !uid };
  },

  atualizar: function (ctx, p) {
    Guard.assertPermission(ctx, 'admin.editar');
    var alvo = Repo.findBy(CONFIG.SHEETS.ADMINS, 'admin_id', p.admin_alvo_id);
    Guard.assertScope(ctx, alvo, 'admin.atualizar');

    // marca_id, admin_id, firebase_uid e criado_em jamais entram aqui.
    var changes = Guard.sanitize(p.changes || {}, ['nome', 'observacoes']);

    if (p.changes && p.changes.role !== undefined) {
      Guard.assertPermission(ctx, 'admin.definir_role');
      changes.role = Guard.requireEnum(p.changes.role, 'role', RoleRegistry.listar());
    }

    if (!Object.keys(changes).length) fail('VALIDATION', 'Nenhum campo alterável informado.');

    Repo.update(CONFIG.SHEETS.ADMINS, alvo._rowIndex, changes);
    Audit.log(ctx, 'admin.atualizar', alvo.admin_id, 'OK', JSON.stringify(changes));
    return { item: this._view(Repo.findBy(CONFIG.SHEETS.ADMINS, 'admin_id', alvo.admin_id)) };
  },

  status: function (ctx, p) {
    Guard.assertPermission(ctx, 'admin.desativar');
    var status = Guard.requireEnum(p.status, 'status', [CONFIG.STATUS.ATIVO, CONFIG.STATUS.INATIVO]);
    var alvo = Repo.findBy(CONFIG.SHEETS.ADMINS, 'admin_id', p.admin_alvo_id);
    Guard.assertScope(ctx, alvo, 'admin.status');

    if (String(alvo.admin_id) === String(ctx.admin.admin_id)) {
      fail('SELF_LOCKOUT', 'Você não pode desativar a própria conta.');
    }

    Repo.update(CONFIG.SHEETS.ADMINS, alvo._rowIndex, { status: status });
    Audit.log(ctx, 'admin.status', alvo.admin_id, 'OK', status);
    return { item: this._view(Repo.findBy(CONFIG.SHEETS.ADMINS, 'admin_id', alvo.admin_id)) };
  }
};

/** Cargos existem enquanto houver linhas na aba Permissoes — zero hardcode. */
var RoleRegistry = {
  listar: function () {
    var vistos = {};
    Repo.all(CONFIG.SHEETS.PERMISSOES).forEach(function (r) {
      if (r.role) vistos[String(r.role)] = true;
    });
    return Object.keys(vistos);
  }
};
