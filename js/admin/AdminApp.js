/* ===========================================================
   AdminApp — bootstrap e roteamento do painel administrativo
   REFATORADO: Sem Firebase, apenas código de segurança
   -----------------------------------------------------------
   Fluxo:
     1. AdminSession valida código
     2. Shell é montado com a marca já resolvida
     3. Rotas por hash, filtradas por permissão
   =========================================================== */

import { AdminSession } from "./AdminSession.js";
import { applyPermissionsToDom } from "./Permissions.js";
import { VIEWS, esc } from "./views.js";
import { AdminApiError } from "./AdminApi.js";

const root = document.getElementById("admin-root");
const ROTA_PADRAO = "dashboard";

const fragmentos = new Map();
async function fragmento(nome) {
  if (!fragmentos.has(nome)) {
    const resp = await fetch(`pages/admin/${nome}.html`, { cache: "no-cache" });
    if (!resp.ok) throw new Error(`Não foi possível carregar a tela "${nome}".`);
    fragmentos.set(nome, await resp.text());
  }
  return fragmentos.get(nome);
}

/* --------------------------- login --------------------------- */

async function renderLogin(mensagem) {
  root.innerHTML = await fragmento("login");
  const boxErro = root.querySelector("#admin-login-error");
  const mostrar = m => { boxErro.hidden = !m; boxErro.textContent = m || ""; };
  mostrar(mensagem);

  root.querySelector("#admin-login-form").addEventListener("submit", async ev => {
    ev.preventDefault();
    const btn = root.querySelector("#admin-login-btn");
    btn.disabled = true;
    mostrar("");
    try {
      await AdminSession.login(
        root.querySelector("#admin-codigo").value
      );
      location.hash = `#${ROTA_PADRAO}`;
      renderShell();
    } catch (e) {
      mostrar(traduzErro(e));
    } finally {
      btn.disabled = false;
    }
  });
}

function traduzErro(e) {
  const code = e?.code || "";
  if (code === "INVALID_CODE") return "Código inválido.";
  if (code === "ADMIN_INACTIVE") return "Sua conta administrativa está desativada.";
  if (code === "BRAND_INACTIVE") return "A marca vinculada à sua conta está inativa.";
  if (code === "BRAND_NOT_FOUND") return "Marca não encontrada.";
  if (code === "NETWORK_ERROR") return "Erro de rede. Verifique sua conexão.";
  if (e instanceof AdminApiError) return e.message;
  return e?.message || "Não foi possível entrar.";
}

/* --------------------------- shell --------------------------- */

let shellMontado = false;

async function renderShell() {
  const sessao = AdminSession.get();
  if (!sessao) return renderLogin();

  if (!shellMontado) {
    root.innerHTML = await fragmento("shell");
    shellMontado = true;

    root.querySelector("#admin-logout").addEventListener("click", async () => {
      await AdminSession.logout();
      shellMontado = false;
      location.hash = "";
      renderLogin();
    });
  }

  root.querySelector('[data-bind="marca-nome"]').textContent = sessao.marca?.nome || "—";
  root.querySelector('[data-bind="admin-nome"]').textContent = sessao.admin?.nome || "";
  root.querySelector('[data-bind="admin-role"]').textContent = sessao.admin?.role || "";

  renderNav();
  await renderRota();
}

function rotasPermitidas() {
  const perms = AdminSession.permissions();
  return Object.entries(VIEWS).filter(([, v]) => !v.perms.length || perms.canAll(v.perms));
}

function renderNav() {
  const nav = root.querySelector("#admin-nav");
  const atual = rotaAtual();
  nav.innerHTML = rotasPermitidas()
    .map(([nome, v]) =>
      `<a href="#${nome}" class="${nome === atual ? "is-active" : ""}">${esc(v.titulo)}</a>`)
    .join("");
}

function rotaAtual() {
  const nome = (location.hash || "").replace(/^#/, "") || ROTA_PADRAO;
  return VIEWS[nome] ? nome : ROTA_PADRAO;
}

async function renderRota() {
  const nome = rotaAtual();
  const view = VIEWS[nome];
  const alvo = root.querySelector("#admin-view");
  if (!alvo) return;

  const perms = AdminSession.permissions();
  if (view.perms.length && !perms.canAll(view.perms)) {
    alvo.innerHTML = `<div class="admin-error">Você não tem permissão para acessar esta área.</div>`;
    return;
  }

  alvo.innerHTML = `<p class="admin-empty">Carregando…</p>`;
  try {
    alvo.innerHTML = await fragmento(nome);
    applyPermissionsToDom(perms, alvo);
    await view.controller(alvo);
  } catch (e) {
    console.error(`[AdminApp] falha na tela ${nome}:`, e);
    alvo.innerHTML = `<div class="admin-error">${esc(traduzErro(e))}</div>`;
  }
  renderNav();
}

/* ------------------------- bootstrap ------------------------- */

window.addEventListener("hashchange", () => {
  if (AdminSession.isAuthenticated()) renderRota();
});

AdminSession.onChange(sessao => {
  if (!sessao && shellMontado) {
    shellMontado = false;
    renderLogin();
  }
});

let primeiroEstado = true;

// Bootstrap: tenta restaurar sessão do cache
(async function boot() {
  try {
    primeiroEstado = false;
    const sessao = AdminSession.get();
    if (sessao) {
      await renderShell();
    } else {
      await renderLogin("");
    }
  } catch (e) {
    primeiroEstado = false;
    const code = e?.code;
    await renderLogin(
      code && code !== "NOT_AUTHENTICATED" && code !== "NETWORK_ERROR" ? traduzErro(e) : ""
    );
  }
})();

AdminSession.onChange(async sessao => {
  if (primeiroEstado) return;
  if (sessao && !shellMontado) await renderShell();
});