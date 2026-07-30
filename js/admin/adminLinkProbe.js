/* Revela o link "Administração" apenas para quem tem sessão admin válida.
   É cosmético: o painel revalida tudo no servidor. */
import { AdminSession } from "./AdminSession.js";

const link = document.getElementById("navAdminLink");
if (link) {
  AdminSession.onChange(sessao => { link.hidden = !sessao; });
  AdminSession.observeFirebase();
}
