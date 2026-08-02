/* ===========================================================
   adminLinkProbe — mostra link de admin apenas se autenticado
   REFATORADO: Sem Firebase, apenas verifica sessionStorage
   =========================================================== */

import { AdminSession } from "./AdminSession.js";

const link = document.getElementById("navAdminLink");
if (link) {
  AdminSession.onChange(sessao => { link.hidden = !sessao; });
}