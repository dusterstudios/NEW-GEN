/** AuditService.gs — trilha de auditoria (append-only). */

var Audit = {
  log: function (ctx, acao, alvo, resultado, detalhe) {
    try {
      Repo.insert(CONFIG.SHEETS.AUDIT, {
        log_id: Repo.uuid(),
        data_hora: Repo.now(),
        admin_id: ctx && ctx.admin ? ctx.admin.admin_id : '-',
        marca_id: ctx && ctx.marca ? ctx.marca.marca_id : '-',
        acao: acao || '-',
        alvo: alvo === undefined || alvo === null ? '-' : String(alvo),
        resultado: resultado || 'OK',
        detalhe: detalhe ? String(detalhe).slice(0, 500) : ''
      });
    } catch (e) {
      console.error('[Audit] falha ao registrar: ' + e.message);
    }
  },

  listar: function (ctx, limite) {
    Guard.assertPermission(ctx, 'audit.ver');
    var linhas = Repo.all(CONFIG.SHEETS.AUDIT);
    if (!Guard.podeVerTodasMarcas(ctx)) {
      var m = String(ctx.marca.marca_id);
      linhas = linhas.filter(function (l) { return String(l.marca_id) === m; });
    }
    linhas.sort(function (a, b) { return String(b.data_hora).localeCompare(String(a.data_hora)); });
    return linhas.slice(0, Math.min(Number(limite) || 50, 500)).map(function (l) {
      delete l._rowIndex; return l;
    });
  }
};
