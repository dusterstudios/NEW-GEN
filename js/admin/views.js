/* ===========================================================
   views.js — controladores de tela do painel administrativo
   Cada view: { perms, controller(root) }
   Nenhuma view conhece marca_id: ela vem pronta do servidor.
   =========================================================== */

import { AdminSession } from "./AdminSession.js";
import { AdminRepository } from "../repositories/AdminRepository.js";
import { BrandRepository } from "../repositories/BrandRepository.js";
import { AdminCharacterRepository } from "../repositories/AdminCharacterRepository.js";
import { adminCall } from "./AdminSession.js";

export function esc(v) {
  return String(v ?? "").replace(/[&<>"']/g, c => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}

function erro(el, mensagem) {
  if (!el) return;
  el.hidden = !mensagem;
  el.textContent = mensagem || "";
}

function tabela(cabecalhos, linhas, vazio = "Nenhum registro.") {
  if (!linhas.length) return `<p class="admin-empty">${esc(vazio)}</p>`;
  return `
    <table class="admin-table">
      <thead><tr>${cabecalhos.map(h => `<th>${esc(h)}</th>`).join("")}</tr></thead>
      <tbody>${linhas.map(l => `<tr>${l.map(c => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody>
    </table>`;
}

function pill(texto, ativo = true) {
  return `<span class="admin-pill${ativo ? "" : " is-off"}">${esc(texto)}</span>`;
}

/* ------------------------- dashboard ------------------------- */

async function dashboard(root) {
  const resumo = await adminCall("dashboard.resumo", {});
  ["total_personagens", "total_admins", "admins_ativos"].forEach(k => {
    const el = root.querySelector(`[data-bind="${k}"]`);
    if (el) el.textContent = resumo[k] ?? 0;
  });

  const box = root.querySelector("#dashboard-audit");
  if (!AdminSession.permissions().can("audit.ver")) {
    box.innerHTML = `<p class="admin-empty">Sem permissão para ver a auditoria.</p>`;
    return;
  }
  const itens = await AdminRepository.auditLog(10);
  box.innerHTML = tabela(
    ["Quando", "Ação", "Alvo", "Resultado"],
    itens.map(i => [esc(i.data_hora), esc(i.acao), esc(i.alvo), pill(i.resultado, i.resultado === "OK")]),
    "Nenhuma atividade registrada ainda."
  );
}

/* ------------------------ personagens ------------------------ */

async function personagens(root) {
  const lista = root.querySelector("#pj-lista");
  const busca = root.querySelector("#pj-busca");
  const perms = AdminSession.permissions();

  async function carregar() {
    lista.innerHTML = `<p class="admin-empty">Carregando…</p>`;
    try {
      const itens = await AdminCharacterRepository.list({ busca: busca.value.trim() });
      lista.innerHTML = tabela(
        ["Nome", "Classe", "Afiliação", "Status", ""],
        itens.map(p => [
          esc(p.nome),
          esc(p.classe || "—"),
          esc(p.afiliacao || "—"),
          pill(p.status || "ativo", String(p.status || "ativo") !== "inativo"),
          perms.can("personagem.excluir")
            ? `<button class="btn btn-ghost" data-excluir="${esc(p.personagem_id)}">Excluir</button>`
            : ""
        ]),
        "Nenhum personagem nesta marca."
      );
    } catch (e) {
      lista.innerHTML = `<div class="admin-error">${esc(e.message)}</div>`;
    }
  }

  let timer;
  busca.addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(carregar, 250);
  });

  lista.addEventListener("click", async ev => {
    const id = ev.target.getAttribute?.("data-excluir");
    if (!id || !confirm("Excluir este personagem?")) return;
    try {
      await AdminCharacterRepository.remove(id);
      carregar();
    } catch (e) { alert(e.message); }
  });

  const novo = root.querySelector("#pj-novo");
  novo?.addEventListener("click", async () => {
    const nome = prompt("Nome do personagem:");
    if (!nome) return;
    try {
      await AdminCharacterRepository.create({ nome, status: "ativo" });
      carregar();
    } catch (e) { alert(e.message); }
  });

  await carregar();
}

/* ---------------------- administradores ---------------------- */

async function administradores(root) {
  const lista = root.querySelector("#admins-lista");
  const boxErro = root.querySelector("#admins-erro");
  const perms = AdminSession.permissions();
  const eu = AdminSession.getAdmin();

  const selectRole = root.querySelector("#na-role");
  if (selectRole) {
    const cargos = perms.can("admin.definir_role")
      ? ["admin", "moderador", "editor", "super_admin"]
      : [eu.role];
    selectRole.innerHTML = cargos.map(r => `<option value="${esc(r)}">${esc(r)}</option>`).join("");
  }

  async function carregar() {
    try {
      const itens = await AdminRepository.list();
      lista.innerHTML = tabela(
        ["Nome", "E-mail", "Cargo", "Status", "Último acesso", ""],
        itens.map(a => [
          esc(a.nome),
          esc(a.email),
          pill(a.role),
          pill(a.status, a.status === "ativo"),
          esc(a.ultimo_acesso || "—"),
          perms.can("admin.desativar") && a.admin_id !== eu.admin_id
            ? `<button class="btn btn-ghost" data-toggle="${esc(a.admin_id)}" data-status="${a.status === "ativo" ? "inativo" : "ativo"}">
                 ${a.status === "ativo" ? "Desativar" : "Reativar"}
               </button>`
            : ""
        ]),
        "Nenhum administrador nesta marca."
      );
    } catch (e) {
      lista.innerHTML = `<div class="admin-error">${esc(e.message)}</div>`;
    }
  }

  lista.addEventListener("click", async ev => {
    const id = ev.target.getAttribute?.("data-toggle");
    if (!id) return;
    try {
      await AdminRepository.setStatus(id, ev.target.getAttribute("data-status"));
      carregar();
    } catch (e) { erro(boxErro, e.message); }
  });

  root.querySelector("#admin-novo-form")?.addEventListener("submit", async ev => {
    ev.preventDefault();
    erro(boxErro, "");
    try {
      const res = await AdminRepository.create({
        nome: root.querySelector("#na-nome").value,
        email: root.querySelector("#na-email").value,
        senha: root.querySelector("#na-senha").value || undefined,
        role: selectRole.value,
        observacoes: root.querySelector("#na-obs").value
      });
      ev.target.reset();
      if (res && res.vinculo_pendente === true) {
        erro(boxErro, "Conta criada. O acesso será vinculado no primeiro login com este e-mail.");
      }
      carregar();
    } catch (e) { erro(boxErro, e.message); }
  });

  await carregar();
}

/* --------------------------- marca --------------------------- */

async function marca(root) {
  const boxErro = root.querySelector("#marca-erro");
  const atual = await BrandRepository.current();
  root.querySelector("#mk-id").value = atual?.marca_id || "";
  root.querySelector("#mk-nome").value = atual?.nome || "";
  root.querySelector("#mk-status").value = atual?.status || "";

  root.querySelector("#marca-form").addEventListener("submit", async ev => {
    ev.preventDefault();
    erro(boxErro, "");
    try {
      await BrandRepository.update(atual.marca_id, { nome: root.querySelector("#mk-nome").value });
      erro(boxErro, "");
      alert("Marca atualizada.");
    } catch (e) { erro(boxErro, e.message); }
  });
}

/* ------------------------- auditoria ------------------------- */

async function auditoria(root) {
  const box = root.querySelector("#audit-lista");
  try {
    const itens = await AdminRepository.auditLog(200);
    box.innerHTML = tabela(
      ["Quando", "Admin", "Ação", "Alvo", "Resultado", "Detalhe"],
      itens.map(i => [
        esc(i.data_hora), esc(i.admin_id), esc(i.acao), esc(i.alvo),
        pill(i.resultado, i.resultado === "OK"), esc(i.detalhe || "")
      ]),
      "Nenhum registro de auditoria."
    );
  } catch (e) {
    box.innerHTML = `<div class="admin-error">${esc(e.message)}</div>`;
  }
}

/* ---------------------- registro de views -------------------- */

export const VIEWS = {
  dashboard:       { titulo: "Dashboard",       perms: [],                   controller: dashboard },
  personagens:     { titulo: "Personagens",     perms: ["personagem.ver"],   controller: personagens },
  administradores: { titulo: "Administradores", perms: ["admin.ver"],        controller: administradores },
  marca:           { titulo: "Minha marca",     perms: [],                   controller: marca },
  auditoria:       { titulo: "Auditoria",       perms: ["audit.ver"],        controller: auditoria }
};
