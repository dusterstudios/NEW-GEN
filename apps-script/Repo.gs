/** ===========================================================
 *  Repo.gs — ÚNICA camada que conhece o Google Sheets.
 *  Trocar Sheets por um banco real = reescrever só este arquivo.
 *  Leitura em bloco (getValues) para respeitar as cotas.
 *  =========================================================== */

function _spreadsheet() {
  return CONFIG.SPREADSHEET_ID
    ? SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID)
    : SpreadsheetApp.getActiveSpreadsheet();
}

function _sheet(nome) {
  var sh = _spreadsheet().getSheetByName(nome);
  if (!sh) fail('SHEET_NOT_FOUND', 'Aba não encontrada: ' + nome);
  return sh;
}

var Repo = {

  /** Todas as linhas como objetos, com _rowIndex (1-based na planilha). */
  all: function (nome) {
    var sh = _sheet(nome);
    var last = sh.getLastRow();
    if (last < 2) return [];
    var values = sh.getRange(1, 1, last, sh.getLastColumn()).getValues();
    var header = values[0];
    var out = [];
    for (var i = 1; i < values.length; i++) {
      var row = {}, vazio = true;
      for (var c = 0; c < header.length; c++) {
        var key = String(header[c] || '').trim();
        if (!key) continue;
        row[key] = values[i][c];
        if (values[i][c] !== '' && values[i][c] !== null) vazio = false;
      }
      if (vazio) continue;
      row._rowIndex = i + 1;
      out.push(row);
    }
    return out;
  },

  find: function (nome, predicate) {
    var rows = this.all(nome);
    for (var i = 0; i < rows.length; i++) if (predicate(rows[i])) return rows[i];
    return null;
  },

  findBy: function (nome, campo, valor) {
    return this.find(nome, function (r) { return String(r[campo]) === String(valor); });
  },

  filter: function (nome, predicate) {
    return this.all(nome).filter(predicate);
  },

  insert: function (nome, objeto) {
    var lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
      var sh = _sheet(nome);
      var header = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
      var linha = header.map(function (h) {
        var k = String(h || '').trim();
        return objeto[k] === undefined ? '' : objeto[k];
      });
      sh.appendRow(linha);
      return objeto;
    } finally {
      lock.releaseLock();
    }
  },

  update: function (nome, rowIndex, changes) {
    var lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
      var sh = _sheet(nome);
      var header = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
      var atual = sh.getRange(rowIndex, 1, 1, header.length).getValues()[0];
      for (var c = 0; c < header.length; c++) {
        var k = String(header[c] || '').trim();
        if (changes.hasOwnProperty(k)) atual[c] = changes[k];
      }
      sh.getRange(rowIndex, 1, 1, header.length).setValues([atual]);
      return true;
    } finally {
      lock.releaseLock();
    }
  },

  remove: function (nome, rowIndex) {
    var lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
      _sheet(nome).deleteRow(rowIndex);
      return true;
    } finally {
      lock.releaseLock();
    }
  },

  uuid: function () {
    return Utilities.getUuid();
  },

  now: function () {
    return new Date().toISOString();
  }
};
