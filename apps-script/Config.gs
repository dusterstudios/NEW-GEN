/** ===========================================================
 *  Config.gs — configuração central (orientada a dados)
 *  Nenhum nome de marca ou admin fica no código.
 *  =========================================================== */

var CONFIG = {
  // ID da planilha administrativa. Deixe vazio para usar a planilha vinculada.
  SPREADSHEET_ID: PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID') || '',

  // Project ID do Firebase — usado para validar o "aud" do idToken.
  FIREBASE_PROJECT_ID: PropertiesService.getScriptProperties().getProperty('FIREBASE_PROJECT_ID') || 'new-gen-rpg',

  SHEETS: {
    ADMINS:      'Admins',
    MARCAS:      'Marcas',
    PERMISSOES:  'Permissoes',
    AUDIT:       'AuditLog',
    PERSONAGENS: 'Personagens',
    USUARIOS:    'Usuarios'
  },

  COLUNA_MARCA: 'marca_id',

  // Abas sujeitas ao isolamento por marca. Adicionar novas abas aqui basta.
  ABAS_COM_ESCOPO: ['Personagens'],

  CACHE_TTL_SEGUNDOS: 300,

  STATUS: { ATIVO: 'ativo', INATIVO: 'inativo' },
  STATUS_MARCA: { ATIVA: 'ativa', INATIVA: 'inativa' }
};

var HEADERS = {
  Admins: ['admin_id','codigo','firebase_uid','nome','email','marca_id','role','status',
           'criado_em','ultimo_acesso','criado_por','observacoes','meta_json'],
  Marcas: ['marca_id','nome','status','criado_em','meta_json'],
  Permissoes: ['role','permissao','permitido'],
  AuditLog: ['log_id','data_hora','admin_id','marca_id','acao','alvo','resultado','detalhe']
};
