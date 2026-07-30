/* ===========================================================
   BrandRepository — acesso a marcas
   -----------------------------------------------------------
   Um admin comum enxerga apenas a própria marca.
   Listar/criar marcas exige permissão `marca.*` (super_admin).
   =========================================================== */

import { adminCall } from "../admin/AdminSession.js";

export const BrandRepository = {
  /** Marca do admin autenticado (sempre permitido). */
  async current() {
    const data = await adminCall("marca.atual", {});
    return data.item || null;
  },

  /** Só retorna algo para quem tem `marca.ver_todas`. */
  async list() {
    const data = await adminCall("marca.listar", {});
    return data.itens || [];
  },

  async create({ marca_id, nome, meta }) {
    const data = await adminCall("marca.criar", { marca_id, nome, meta });
    return data.item;
  },

  async update(marcaId, changes) {
    const data = await adminCall("marca.atualizar", { marca_alvo_id: marcaId, changes });
    return data.item;
  },

  async setStatus(marcaId, status) {
    const data = await adminCall("marca.status", { marca_alvo_id: marcaId, status });
    return data.item;
  }
};
