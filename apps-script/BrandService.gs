/** BrandService.gs — marcas. Estrutura expansível via meta_json. */

var BrandService = {

  atual: function (ctx) {
    return { item: Auth.publicView(ctx).marca };
  },

  listar: function (ctx) {
    Guard.assertPermission(ctx, 'marca.ver_todas');
    return {
      itens: Repo.all(CONFIG.SHEETS.MARCAS).map(function (m) {
        return {
          marca_id: m.marca_id, nome: m.nome, status: m.status,
          criado_em: m.criado_em, meta: parseMeta(m.meta_json)
        };
      })
    };
  },

  criar: function (ctx, p) {
    Guard.assertPermission(ctx, 'marca.criar');
    var id = Guard.requireString(p.marca_id, 'marca_id', 60).toLowerCase().replace(/[^a-z0-9_-]/g, '-');
    var nome = Guard.requireString(p.nome, 'nome', 120);

    if (Repo.findBy(CONFIG.SHEETS.MARCAS, 'marca_id', id)) {
      fail('DUPLICATE', 'Já existe uma marca com este identificador.');
    }

    var registro = {
      marca_id: id,
      nome: nome,
      status: CONFIG.STATUS_MARCA.ATIVA,
      criado_em: Repo.now(),
      meta_json: JSON.stringify(p.meta || {})
    };
    Repo.insert(CONFIG.SHEETS.MARCAS, registro);
    Audit.log(ctx, 'marca.criar', id, 'OK');
    return { item: registro };
  },

  atualizar: function (ctx, p) {
    Guard.assertPermission(ctx, 'marca.editar');
    var alvo = Repo.findBy(CONFIG.SHEETS.MARCAS, 'marca_id', p.marca_alvo_id);
    if (!alvo) fail('NOT_FOUND', 'Marca não encontrada.');
    if (!Guard.podeVerTodasMarcas(ctx) && String(alvo.marca_id) !== String(ctx.marca.marca_id)) {
      fail('CROSS_BRAND_DENIED', 'Você só pode editar a própria marca.');
    }

    var changes = Guard.sanitize(p.changes || {}, ['nome']);
    if (p.changes && p.changes.meta) {
      var meta = parseMeta(alvo.meta_json);
      for (var k in p.changes.meta) meta[k] = p.changes.meta[k];
      changes.meta_json = JSON.stringify(meta);
    }
    Repo.update(CONFIG.SHEETS.MARCAS, alvo._rowIndex, changes);
    Audit.log(ctx, 'marca.atualizar', alvo.marca_id, 'OK');
    return { item: Repo.findBy(CONFIG.SHEETS.MARCAS, 'marca_id', alvo.marca_id) };
  },

  status: function (ctx, p) {
    Guard.assertPermission(ctx, 'marca.editar');
    var status = Guard.requireEnum(p.status, 'status',
      [CONFIG.STATUS_MARCA.ATIVA, CONFIG.STATUS_MARCA.INATIVA]);
    var alvo = Repo.findBy(CONFIG.SHEETS.MARCAS, 'marca_id', p.marca_alvo_id);
    if (!alvo) fail('NOT_FOUND', 'Marca não encontrada.');
    Repo.update(CONFIG.SHEETS.MARCAS, alvo._rowIndex, { status: status });
    Audit.log(ctx, 'marca.status', alvo.marca_id, 'OK', status);
    return { item: Repo.findBy(CONFIG.SHEETS.MARCAS, 'marca_id', alvo.marca_id) };
  }
};
