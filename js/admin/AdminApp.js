/* ===========================================================
   AdminApp — bootstrap e roteamento do painel administrativo
   -----------------------------------------------------------
   Fluxo:
     1. Firebase restaura (ou não) o usuário
     2. AdminSession resolve a sessão NO SERVIDOR
     3. Shell é montado com a marca já resolvida
     4. Rotas por hash, filtradas por permissão
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
        root.querySelector("#admin-email").value,
        root.querySelector("#admin-senha").value
      );
      location.hash = `#${ROTA_PADRAO}`;
      renderShell();
    } catch (e) {
      mostrar(traduzErro(e));
    } finally {
      btn.disabled = false;
    }
  });

  root.querySelector("#admin-login-google").addEventListener("click", async () => {
    mostrar("");
    try {
      const [{ GoogleAuthProvider, signInWithPopup }, { auth }] = await Promise.all([
        import("https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js"),
        import("../../firebase.js")
      ]);
      await signInWithPopup(auth, new GoogleAuthProvider());
      await AdminSession.refresh();
      location.hash = `#${ROTA_PADRAO}`;
      renderShell();
    } catch (e) {
      mostrar(traduzErro(e));
    }
  });
}

function traduzErro(e) {
  const code = e?.code || "";
  if (code.includes("wrong-password") || code.includes("invalid-credential")) return "E-mail ou senha inválidos.";
  if (code.includes("user-not-found")) return "Conta não encontrada.";
  if (code.includes("too-many-requests")) return "Muitas tentativas. Aguarde alguns minutos.";
  if (code === "NOT_ADMIN") return "Esta conta não possui acesso administrativo.";
  if (code === "ADMIN_INACTIVE") return "Sua conta administrativa está desativada.";
  if (code === "BRAND_INACTIVE") return "A marca vinculada à sua conta está inativa.";
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
  root.querySelector('[data-bind="admin-nome"]').textContent = sessao.admin?.nome || sessao.admin?.email || "";
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
AdminSession.observeFirebase();

// Resolve o estado inicial sem depender apenas do observer do Firebase.
(async function boot() {
  try {
    await AdminSession.refresh();
    primeiroEstado = false;
    await renderShell();
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
