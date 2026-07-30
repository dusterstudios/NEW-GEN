/** ===========================================================
 *  CharacterService.gs — personagens COM ESCOPO DE MARCA
 *  Todo acesso passa por Guard.scopeFilter / applyScope / assertScope.
 *  =========================================================== */

var CAMPOS_PERSONAGEM = [
  'nome','idade','genero','raca','linhagem','recompensa','historia','personalidade',
  'classe','afiliacao','patente','forca','velocidade','resistencia','vitalidade',
  'estilo','haki','akuma','itens','recursos','usuario_uid','status'
];

var CharacterService = {

  _view: function (r) {
    var out = {};
    for (var k in r) if (r.hasOwnProperty(k) && k !== '_rowIndex') out[k] = r[k];
    return out;
  },

  listar: function (ctx, p) {
    Guard.assertPermission(ctx, 'personagem.ver');
    var linhas = Guard.scopeFilter(ctx, Repo.all(CONFIG.SHEETS.PERSONAGENS));

    var f = (p && p.filtros) || {};
    if (f.busca) {
      var termo = String(f.busca).toLowerCase();
      linhas = linhas.filter(function (l) {
        return String(l.nome || '').toLowerCase().indexOf(termo) >= 0;
      });
    }
    if (f.status) {
      linhas = linhas.filter(function (l) { return String(l.status) === String(f.status); });
    }
    return { itens: linhas.map(function (r) { return CharacterService._view(r); }) };
  },

  obter: function (ctx, p) {
    Guard.assertPermission(ctx, 'personagem.ver');
    var alvo = Repo.findBy(CONFIG.SHEETS.PERSONAGENS, 'personagem_id', p.personagem_id);
    Guard.assertScope(ctx, alvo, 'personagem.obter');
    return { item: this._view(alvo) };
  },

  criar: function (ctx, p) {
    Guard.assertPermission(ctx, 'personagem.criar');
    var dados = Guard.sanitize(p.personagem || {}, CAMPOS_PERSONAGEM);
    Guard.requireString(dados.nome, 'nome', 120);

    var registro = Guard.applyScope(ctx, dados);   // marca_id imposta pelo servidor
    registro.personagem_id = Repo.uuid();
    registro.criado_em = Repo.now();
    registro.atualizado_em = registro.criado_em;
    registro.criado_por = ctx.admin.admin_id;

    Repo.insert(CONFIG.SHEETS.PERSONAGENS, registro);
    Audit.log(ctx, 'personagem.criar', registro.personagem_id, 'OK');
    return { item: registro };
  },

  atualizar: function (ctx, p) {
    Guard.assertPermission(ctx, 'personagem.editar');
    var alvo = Repo.findBy(CONFIG.SHEETS.PERSONAGENS, 'personagem_id', p.personagem_id);
    Guard.assertScope(ctx, alvo, 'personagem.atualizar');

    var changes = Guard.sanitize(p.changes || {}, CAMPOS_PERSONAGEM);
    if (!Object.keys(changes).length) fail('VALIDATION', 'Nada para atualizar.');
    changes.atualizado_em = Repo.now();
    changes.atualizado_por = ctx.admin.admin_id;

    Repo.update(CONFIG.SHEETS.PERSONAGENS, alvo._rowIndex, changes);
    Audit.log(ctx, 'personagem.atualizar', alvo.personagem_id, 'OK');
    return { item: this._view(Repo.findBy(CONFIG.SHEETS.PERSONAGENS, 'personagem_id', p.personagem_id)) };
  },

  excluir: function (ctx, p) {
    Guard.assertPermission(ctx, 'personagem.excluir');
    var alvo = Repo.findBy(CONFIG.SHEETS.PERSONAGENS, 'personagem_id', p.personagem_id);
    Guard.assertScope(ctx, alvo, 'personagem.excluir');
    Repo.remove(CONFIG.SHEETS.PERSONAGENS, alvo._rowIndex);
    Audit.log(ctx, 'personagem.excluir', p.personagem_id, 'OK');
    return { removido: true };
  },

  resumo: function (ctx) {
    Guard.assertPermission(ctx, 'personagem.ver');
    var linhas = Guard.scopeFilter(ctx, Repo.all(CONFIG.SHEETS.PERSONAGENS));
    var admins = Guard.scopeFilter(ctx, Repo.all(CONFIG.SHEETS.ADMINS));
    return {
      total_personagens: linhas.length,
      total_admins: admins.length,
      admins_ativos: admins.filter(function (a) { return String(a.status) === CONFIG.STATUS.ATIVO; }).length,
      marca: ctx.marca.nome
    };
  }
};
