/** ===========================================================
 *  Setup.gs — executar UMA VEZ no editor do Apps Script.
 *  Cria abas, cabeçalhos, permissões padrão e faz o backfill.
 *  =========================================================== */

/** 1) Cria/normaliza as abas administrativas. */
function setup_1_criarAbas() {
  var ss = _spreadsheet();
  Object.keys(HEADERS).forEach(function (nome) {
    var sh = ss.getSheetByName(nome) || ss.insertSheet(nome);
    var atual = sh.getLastColumn() ? sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0] : [];
    if (String(atual.join('|')) !== String(HEADERS[nome].join('|'))) {
      sh.getRange(1, 1, 1, HEADERS[nome].length).setValues([HEADERS[nome]]);
      sh.setFrozenRows(1);
    }
  });
  Logger.log('Abas administrativas prontas.');
}

/** 2) Semeia a matriz de permissões (dados, não código). */
function setup_2_permissoesPadrao() {
  var matriz = {
    super_admin: ['*'],
    admin: [
      'personagem.ver','personagem.criar','personagem.editar','personagem.excluir',
      'admin.ver','admin.criar','admin.editar','admin.desativar',
      'marca.editar','audit.ver'
    ],
    moderador: ['personagem.ver','personagem.editar','audit.ver'],
    editor:    ['personagem.ver','personagem.criar','personagem.editar']
  };

  var existentes = {};
  Repo.all(CONFIG.SHEETS.PERMISSOES).forEach(function (r) {
    existentes[r.role + '|' + r.permissao] = true;
  });

  Object.keys(matriz).forEach(function (role) {
    matriz[role].forEach(function (perm) {
      if (existentes[role + '|' + perm]) return;
      Repo.insert(CONFIG.SHEETS.PERMISSOES, { role: role, permissao: perm, permitido: true });
    });
  });
  Logger.log('Permissões padrão semeadas.');
}

/** 3) Cria a marca de legado e adiciona marca_id nas abas com escopo. */
function setup_3_marcaLegadoEBackfill() {
  var MARCA_LEGADO = 'marca_legado';

  if (!Repo.findBy(CONFIG.SHEETS.MARCAS, 'marca_id', MARCA_LEGADO)) {
    Repo.insert(CONFIG.SHEETS.MARCAS, {
      marca_id: MARCA_LEGADO,
      nome: 'Marca Legado',
      status: CONFIG.STATUS_MARCA.ATIVA,
      criado_em: Repo.now(),
      meta_json: '{}'
    });
  }

  var ss = _spreadsheet();
  CONFIG.ABAS_COM_ESCOPO.forEach(function (nome) {
    var sh = ss.getSheetByName(nome);
    if (!sh) return;

    var header = sh.getRange(1, 1, 1, Math.max(1, sh.getLastColumn())).getValues()[0];
    var idx = header.indexOf(CONFIG.COLUNA_MARCA);

    if (idx < 0) {
      sh.insertColumnAfter(sh.getLastColumn());
      sh.getRange(1, sh.getLastColumn()).setValue(CONFIG.COLUNA_MARCA);
      idx = sh.getLastColumn() - 1;
    }

    var ultima = sh.getLastRow();
    if (ultima < 2) return;

    var col = sh.getRange(2, idx + 1, ultima - 1, 1);
    var valores = col.getValues().map(function (v) {
      return [v[0] === '' || v[0] === null ? MARCA_LEGADO : v[0]];
    });
    col.setValues(valores);
  });

  Logger.log('Backfill concluído com a marca "' + MARCA_LEGADO + '".');
}

/**
 * 4) Cria o primeiro super administrador.
 * Ajuste os valores abaixo e execute uma única vez.
 */
function setup_4_primeiroSuperAdmin() {
  var NOME  = 'Dus.j';
  var MARCA = 'marca_legado';
  var CODIGO = 'ADM0001';

  var codigo = String(CODIGO).trim().toUpperCase();
  if (Repo.find(CONFIG.SHEETS.ADMINS, function (r) { return String(r.codigo).trim().toUpperCase() === codigo; })) {
    Logger.log('Já existe admin com este código.');
    return;
  }

  Repo.insert(CONFIG.SHEETS.ADMINS, {
    admin_id: Repo.uuid(),
    codigo: codigo,
    nome: NOME,
    marca_id: MARCA,
    role: 'super_admin',
    status: CONFIG.STATUS.ATIVO,
    criado_em: Repo.now(),
    ultimo_acesso: '',
    criado_por: 'setup',
    observacoes: 'Criado pelo Setup.gs',
    meta_json: '{}'
  });

  Logger.log('Super admin criado com código administrativo: ' + codigo);
}

/** Executa tudo na ordem correta (exceto o super admin). */
function setup_completo() {
  setup_1_criarAbas();
  setup_2_permissoesPadrao();
  setup_3_marcaLegadoEBackfill();
}
