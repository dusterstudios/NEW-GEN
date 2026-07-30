/** ===========================================================
 *  Router.gs — mapa action -> handler (orientado a dados).
 *  Adicionar uma operação = adicionar uma entrada. Zero switch.
 *  =========================================================== */

var ROUTES = {
  'admin.session':        function (ctx, p) { return AdminService.session(ctx); },
  'admin.listar':         function (ctx, p) { return AdminService.listar(ctx, p); },
  'admin.obter':          function (ctx, p) { return AdminService.obter(ctx, p); },
  'admin.criar':          function (ctx, p) { return AdminService.criar(ctx, p); },
  'admin.atualizar':      function (ctx, p) { return AdminService.atualizar(ctx, p); },
  'admin.status':         function (ctx, p) { return AdminService.status(ctx, p); },

  'marca.atual':          function (ctx, p) { return BrandService.atual(ctx); },
  'marca.listar':         function (ctx, p) { return BrandService.listar(ctx); },
  'marca.criar':          function (ctx, p) { return BrandService.criar(ctx, p); },
  'marca.atualizar':      function (ctx, p) { return BrandService.atualizar(ctx, p); },
  'marca.status':         function (ctx, p) { return BrandService.status(ctx, p); },

  'personagem.listar':    function (ctx, p) { return CharacterService.listar(ctx, p); },
  'personagem.obter':     function (ctx, p) { return CharacterService.obter(ctx, p); },
  'personagem.criar':     function (ctx, p) { return CharacterService.criar(ctx, p); },
  'personagem.atualizar': function (ctx, p) { return CharacterService.atualizar(ctx, p); },
  'personagem.excluir':   function (ctx, p) { return CharacterService.excluir(ctx, p); },

  'dashboard.resumo':     function (ctx, p) { return CharacterService.resumo(ctx); },

  'audit.listar':         function (ctx, p) { return { itens: Audit.listar(ctx, p.limite) }; }
};

/** Ações públicas legadas (sem sessão admin) — compatibilidade total. */
var LEGACY_ROUTES = {
  'saveUser': function (payload) { return LegacyService.saveUser(payload); }
};

function routeRequest(body) {
  var action = String(body.action || '');
  if (!action) fail('VALIDATION', 'Ação não informada.');

  // 1) rota legada do app público — mantém o comportamento atual intacto
  if (LEGACY_ROUTES[action]) {
    return LEGACY_ROUTES[action](body.usuario || body.payload || {});
  }

  var handler = ROUTES[action];
  if (!handler) fail('UNKNOWN_ACTION', 'Ação desconhecida: ' + action);

  // 2) rota administrativa: token obrigatório, contexto resolvido no servidor
  var ctx = Auth.resolveContext(body.idToken);
  return handler(ctx, body.payload || {});
}
