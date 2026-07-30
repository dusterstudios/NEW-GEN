/* ===========================================================
   AdminCharacterRepository — personagens no escopo da marca
   -----------------------------------------------------------
   Espelha a interface do CharacterRepository (app.js) para que
   a troca de camada de persistência seja trivial no futuro.
   O escopo de marca é aplicado no Apps Script, nunca aqui.
   =========================================================== */

import { adminCall } from "../admin/AdminSession.js";

export const AdminCharacterRepository = {
  async list(filtros = {}) {
    const data = await adminCall("personagem.listar", { filtros });
    return data.itens || [];
  },

  async getById(id) {
    const data = await adminCall("personagem.obter", { personagem_id: id });
    return data.item || null;
  },

  async create(personagem) {
    const data = await adminCall("personagem.criar", { personagem });
    return data.item;
  },

  async update(id, changes) {
    const data = await adminCall("personagem.atualizar", { personagem_id: id, changes });
    return data.item;
  },

  async remove(id) {
    await adminCall("personagem.excluir", { personagem_id: id });
    return true;
  }
};
