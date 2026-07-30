/** ===========================================================
 *  Guard.gs — ponto ÚNICO de autorização.
 *  Nenhum handler acessa dados sem passar por aqui.
 *  =========================================================== */

var Permissions = {
  /** Lê a aba Permissoes e devolve a lista de permissões do cargo. */
  forRole: function (role) {
    if (!role) return [];
    return Repo.filter(CONFIG.SHEETS.PERMISSOES, function (r) {
      return String(r.role) === String(role) &&
             (r.permitido === true || String(r.permitido).toUpperCase() === 'TRUE');
    }).map(function (r) { return String(r.permissao); });
  },

  has: function (permissoes, alvo) {
    if (permissoes.indexOf('*') >= 0) return true;
    if (permissoes.indexOf(alvo) >= 0) return true;
    var dominio = String(alvo).split('.')[0];
    return permissoes.indexOf(dominio + '.*') >= 0;
  }
};

var Guard = {

  assertPermission: function (ctx, permissao) {
    if (!Permissions.has(ctx.permissoes, permissao)) {
      Audit.log(ctx, permissao, '-', 'DENIED', 'permissão ausente');
      fail('FORBIDDEN', 'Você não tem permissão para: ' + permissao);
    }
  },

  /** true somente se o cargo puder atravessar marcas (definido em planilha). */
  podeVerTodasMarcas: function (ctx) {
    return Permissions.has(ctx.permissoes, 'marca.ver_todas');
  },

  /** Filtro obrigatório de leitura. */
  scopeFilter: function (ctx, linhas) {
    if (this.podeVerTodasMarcas(ctx)) return linhas;
    var marca = String(ctx.marca.marca_id);
    return linhas.filter(function (l) { return String(l[CONFIG.COLUNA_MARCA]) === marca; });
  },

  /** Impõe a marca da sessão em qualquer escrita, descartando o que veio do cliente. */
  applyScope: function (ctx, objeto) {
    var copia = {};
    for (var k in objeto) if (objeto.hasOwnProperty(k)) copia[k] = objeto[k];
    copia[CONFIG.COLUNA_MARCA] = ctx.marca.marca_id;   // sobrescrita incondicional
    return copia;
  },

  /** Barreira de edição/exclusão: a linha alvo pertence à marca da sessão? */
  assertScope: function (ctx, linha, acao) {
    if (!linha) fail('NOT_FOUND', 'Registro não encontrado.');
    if (this.podeVerTodasMarcas(ctx)) return linha;
    if (String(linha[CONFIG.COLUNA_MARCA]) !== String(ctx.marca.marca_id)) {
      Audit.log(ctx, acao || 'scope', String(linha.id || linha._rowIndex), 'DENIED', 'CROSS_BRAND');
      fail('CROSS_BRAND_DENIED', 'Registro pertence a outra marca.');
    }
    return linha;
  },

  /** Sanitiza payloads de escrita: remove campos de propriedade do servidor. */
  sanitize: function (objeto, camposPermitidos) {
    var out = {};
    (camposPermitidos || []).forEach(function (c) {
      if (objeto && objeto.hasOwnProperty(c) && objeto[c] !== undefined) out[c] = objeto[c];
    });
    return out;
  },

  requireString: function (valor, campo, max) {
    var v = valor === null || valor === undefined ? '' : String(valor).trim();
    if (!v) fail('VALIDATION', 'Campo obrigatório: ' + campo);
    if (max && v.length > max) fail('VALIDATION', campo + ' excede ' + max + ' caracteres.');
    return v;
  },

  requireEmail: function (valor) {
    var v = this.requireString(valor, 'email', 255).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) fail('VALIDATION', 'E-mail inválido.');
    return v;
  },

  requireEnum: function (valor, campo, permitidos) {
    var v = String(valor || '');
    if (permitidos.indexOf(v) < 0) fail('VALIDATION', campo + ' inválido.');
    return v;
  }
};
