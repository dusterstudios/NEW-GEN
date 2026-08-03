/* ===========================================================
   AdminRepository — acesso a contas administrativas
   -----------------------------------------------------------
   Mesma filosofia do CharacterRepository: interface estável,
   persistência trocável. Hoje fala com Apps Script/Sheets;
   amanhã pode falar com um banco real sem mudar os chamadores.
   Nenhum método aceita marca_id: o servidor sempre a impõe.
   =========================================================== */

import { adminCall } from "../admin/AdminSession.js";

export const AdminRepository = {
  /** Lista admins da marca do usuário autenticado. */
  async list(filtros = {}) {
    const data = await adminCall("admin.listar", { filtros });
    return data.itens || [];
  },

  async getById(adminId) {
    const data = await adminCall("admin.obter", { admin_alvo_id: adminId });
    return data.item || null;
  },

  /** Cria um admin. A marca é herdada do criador (ou informada só por super_admin no servidor). */
  async create({ nome, codigo, role, observacoes }) {
    const data = await adminCall("admin.criar", { nome, codigo, role_solicitada: role, observacoes });
    return data.item;
  },

  async update(adminId, changes) {
    const data = await adminCall("admin.atualizar", { admin_alvo_id: adminId, changes });
    return data.item;
  },

  async generateCode(adminId) {
    const data = await adminCall("admin.gerar_codigo", { admin_alvo_id: adminId });
    return data;
  },

  async setStatus(adminId, status) {
    const data = await adminCall("admin.status", { admin_alvo_id: adminId, status });
    return data.item;
  },

  async auditLog(limite = 50) {
    const data = await adminCall("audit.listar", { limite });
    return data.itens || [];
  }
};
