/* ===========================================================
   CAMADA DE PERSISTÊNCIA (ABSTRACT STORAGE REPOSITORY)
   =========================================================== */
const CharacterRepository = {
  _getKey(userId) {
    return `newgen_characters_${userId || 'guest'}`;
  },

  async getSlots(userId) {
    try {
      const raw = localStorage.getItem(this._getKey(userId));
      if (!raw) return Array(5).fill(null);
      const parsed = JSON.parse(raw);
      return Array.from({ length: 5 }, (_, i) => parsed[i] || null);
    } catch (e) {
      console.error("[CharacterRepository] Erro ao carregar slots:", e);
      return Array(5).fill(null);
    }
  },

  async saveSlot(userId, slotIndex, characterData) {
    try {
      const slots = await this.getSlots(userId);
      slots[slotIndex] = {
        ...characterData,
        updatedAt: new Date().toISOString()
      };
      localStorage.setItem(this._getKey(userId), JSON.stringify(slots));
      return slots[slotIndex];
    } catch (e) {
      console.error("[CharacterRepository] Erro ao salvar slot:", e);
      throw e;
    }
  },

  async deleteSlot(userId, slotIndex) {
    try {
      const slots = await this.getSlots(userId);
      slots[slotIndex] = null;
      localStorage.setItem(this._getKey(userId), JSON.stringify(slots));
      return true;
    } catch (e) {
      console.error("[CharacterRepository] Erro ao deletar slot:", e);
      throw e;
    }
  }
};

import {
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";

import { auth } from "./firebase.js";

const provider = new GoogleAuthProvider();

/* ===========================================================
   NEW GEN — MAIN APPLICATION
   =========================================================== */
(() => {
  "use strict";

  const app = {
    currentPage: "home",
    pages: ["home", "personagem", "sistemas", "ficha", "loja", "creditos"],
    sectionOrder: ["home", "personagem", "sistemas", "ficha", "loja", "creditos"],
    auth: {
      user: null
    },
    state: {
      currentSlot: 0,
      currentCharacter: null,
      expandedSlot: null
    },
    runtimeUser: null
  };

  const DOM = {
    landing: document.getElementById("landing"),
    appShell: document.getElementById("app"),
    sidebar: document.getElementById("sidebar"),
    mainNav: document.getElementById("mainNav"),
    content: document.querySelector(".content"),
    needle: document.getElementById("compassNeedle"),
    drawerToggle: document.getElementById("drawerToggle"),
    drawerOverlay: document.getElementById("drawerOverlay"),
    enterBtn: document.getElementById("enterWikiBtn"),
    pagesContainer: document.getElementById("pages-container"),
    loginBtn: document.getElementById("loginBtn"),
    logoutBtn: document.getElementById("logoutBtn"),
    accountLabel: document.getElementById("accountLabel"),
    loginModal: document.getElementById("loginModal"),
    authUser: document.getElementById("authUser"),
    authEmail: document.getElementById("authEmail"),
    authPassword: document.getElementById("authPassword"),
    createAccountBtn: document.getElementById("createAccountBtn"),
    doLoginBtn: document.getElementById("doLoginBtn"),
    googleLoginBtn: document.getElementById("googleLoginBtn"),
    closeLoginModal: document.getElementById("closeLoginModal"),
    toastContainer: document.getElementById("toastContainer")
  };

  function angleFor(sectionId) {
    const i = app.sectionOrder.indexOf(sectionId);
    if (i < 0) return 0;
    return (360 / app.sectionOrder.length) * i;
  }

  function showPage(pageId) {
    if (!app.pages.includes(pageId)) return;
    app.currentPage = pageId;

    document.querySelectorAll(".section").forEach(s => {
      s.classList.toggle("active", s.id === pageId);
    });

    DOM.mainNav.querySelectorAll("a[data-section]").forEach(link => {
      link.classList.toggle("nav-active", link.getAttribute("data-section") === pageId);
    });

    if (DOM.needle) DOM.needle.style.transform = `rotate(${angleFor(pageId)}deg)`;

    closeDrawer();

    if (DOM.content) DOM.content.scrollTo({ top: 0, behavior: "smooth" });
    window.scrollTo({ top: 0, behavior: "smooth" });

    if (pageId === "ficha") renderFichaPage();
  }

  function openDrawer() {
    DOM.sidebar.classList.add("is-open");
    DOM.drawerOverlay.classList.add("is-open");
    DOM.drawerToggle.setAttribute("aria-expanded", "true");
  }

  function closeDrawer() {
    DOM.sidebar.classList.remove("is-open");
    DOM.drawerOverlay.classList.remove("is-open");
    DOM.drawerToggle.setAttribute("aria-expanded", "false");
  }

  function toggleDrawer() {
    DOM.sidebar.classList.contains("is-open") ? closeDrawer() : openDrawer();
  }

  function enterWiki() {
    DOM.landing.classList.add("is-hidden");
    DOM.appShell.classList.add("is-visible");

    setTimeout(() => {
      DOM.landing.style.display = "none";
    }, 700);

    setTimeout(() => {
      showPage("home");
    }, 150);
  }

  function showToast(message, timeout = 2600) {
    if (!DOM.toastContainer) return;
    const el = document.createElement("div");
    el.style.background = "linear-gradient(90deg, rgba(155,107,240,.12), rgba(82,217,201,.06))";
    el.style.border = "1px solid rgba(155,107,240,.12)";
    el.style.color = "var(--ivory)";
    el.style.padding = "10px 14px";
    el.style.borderRadius = "10px";
    el.style.fontFamily = "var(--font-body)";
    el.style.fontSize = "13px";
    el.style.pointerEvents = "auto";
    el.textContent = message;
    DOM.toastContainer.appendChild(el);
    setTimeout(() => {
      el.style.transition = "opacity .25s";
      el.style.opacity = "0";
      setTimeout(() => el.remove(), 300);
    }, timeout);
  }

  async function fetchText(path) {
    const res = await fetch(path);
    if (!res.ok) throw new Error(`Failed to load ${path}`);
    return await res.text();
  }

  async function loadPages() {
    const pageFiles = {
      personagem: "pages/personagem.html",
      ficha: "pages/ficha.html",
      loja: "pages/loja.html",
      creditos: "pages/creditos.html"
    };

    for (const [pageId, fileName] of Object.entries(pageFiles)) {
      try {
        const html = await fetchText(fileName);
        DOM.pagesContainer.insertAdjacentHTML("beforeend", html);
      } catch (error) {
        console.error(`Error loading ${fileName}:`, error);
        DOM.pagesContainer.insertAdjacentHTML(
          "beforeend",
          `<section id="${pageId}" class="section" data-page="${pageId}">
            <div class="empty-state">
              <h4>Página não disponível</h4>
              <p>Houve um erro ao carregar esta página.</p>
            </div>
          </section>`
        );
      }
    }

    try {
  const sistemasHTML = await fetchText("pages/sistemas.html");
  const parser2 = new DOMParser();
  const doc2 = parser2.parseFromString(sistemasHTML, "text/html");
  const sistemasSection = doc2.querySelector("#sistemas");

  if (sistemasSection) {
    DOM.pagesContainer.insertAdjacentHTML("beforeend", sistemasHTML);
  }
} catch (err) {
  console.error("Failed to load sistemas:", err);
}
  }

  function setupNavigation() {
    DOM.mainNav.addEventListener("click", e => {
      const link = e.target.closest("a[data-section]");
      if (link) showPage(link.getAttribute("data-section"));
    });

    document.addEventListener("click", e => {
      const goto = e.target.closest("[data-goto]");
      if (goto) showPage(goto.getAttribute("data-goto"));
    });
  }

  function setupDrawer() {
    DOM.drawerToggle?.addEventListener("click", toggleDrawer);
    DOM.drawerOverlay?.addEventListener("click", closeDrawer);

    document.addEventListener("keydown", e => {
      if (e.key === "Escape") closeDrawer();
    });
  }

  function setupTabs() {
    document.addEventListener("click", e => {
      const tabBtn = e.target.closest(".tab-btn");
      if (!tabBtn) return;

      const tabName = tabBtn.getAttribute("data-tab");
      const tabsNav = tabBtn.closest(".tabs-nav");
      const tabsContainer = tabsNav?.closest(".section");
      if (!tabsContainer) return;

      tabsNav.querySelectorAll(".tab-btn").forEach(btn => {
        btn.classList.toggle("active", btn.getAttribute("data-tab") === tabName);
      });

      tabsContainer.querySelectorAll(".tab-content").forEach(content => {
        content.classList.toggle("active", content.getAttribute("data-tab") === tabName);
      });
    });
  }

  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function generateSalt() {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    return Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
  }

  async function hashPassword(password, salt) {
    const encoder = new TextEncoder();
    const data = encoder.encode(salt + password);
    const digest = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, "0")).join("");
  }

  function openLoginModal() {
    if (!DOM.loginModal) return;
    DOM.loginModal.style.display = "flex";
    setTimeout(() => DOM.authUser?.focus(), 120);
  }

  function closeLoginModal() {
    if (!DOM.loginModal) return;
    DOM.loginModal.style.display = "none";
  }

  function loadUserData() {
    if (!app.auth.user) return;

    const key = `newgen_user_${app.auth.user.uid || app.auth.user.username}`;
    const raw = localStorage.getItem(key);

    if (raw) {
      const user = JSON.parse(raw);
      user.characters = user.characters || [];
      while (user.characters.length < 5) user.characters.push(null);
      app.runtimeUser = user;
      return;
    }

    app.runtimeUser = {
      username: app.auth.user.displayName || app.auth.user.username || "Jogador",
      email: app.auth.user.email || "",
      uid: app.auth.user.uid || "",
      photoURL: app.auth.user.photoURL || "",
      createdAt: new Date().toISOString(),
      characters: [null, null, null, null, null]
    };

    localStorage.setItem(key, JSON.stringify(app.runtimeUser));
  }

  function updateAccountUI() {
    if (app.auth.user) {
      DOM.accountLabel.textContent = app.auth.user.displayName || app.auth.user.username || "Jogador";
      DOM.loginBtn.style.display = "none";
      DOM.logoutBtn.style.display = "inline-block";
    } else {
      DOM.accountLabel.textContent = "Convidado";
      DOM.loginBtn.style.display = "inline-block";
      DOM.logoutBtn.style.display = "none";
    }
  }

  async function createAccount(username, email = "", password = "") {
    if (!username) return showToast("Digite um nome de usuário.");
    if (!password || password.length < 6) {
      return showToast("A senha precisa ter no mínimo 6 caracteres.");
    }
    if (email && !isValidEmail(email)) {
      return showToast("Digite um e-mail válido (ex: nome@dominio.com).");
    }

    const key = `newgen_user_${username}`;

    if (localStorage.getItem(key)) {
      showToast("Usuário já existe. Faça login.");
      return;
    }

    const salt = generateSalt();
    const passwordHash = await hashPassword(password, salt);

    const user = {
      username,
      email,
      salt,
      passwordHash,
      createdAt: new Date().toISOString(),
      characters: []
    };
    localStorage.setItem(key, JSON.stringify(user));
    showToast(`Conta criada: ${username}`);
    closeLoginModal();
    if (DOM.authPassword) DOM.authPassword.value = "";
    app.auth.user = { ...user, uid: username, displayName: username, photoURL: "" };
    localStorage.setItem("newgen_current_user", username);
    loadUserData();
    updateAccountUI();
    if (app.currentPage === "ficha") renderFichaPage();

    const { salt: _s, passwordHash: _p, ...userForSheet } = user;
    await sendToSheets("saveUser", userForSheet).catch(err => console.error(err));
  }

  async function doLogin(username, password) {
    if (!username) return showToast("Digite um nome de usuário.");
    if (!password) return showToast("Digite sua senha.");

    const key = `newgen_user_${username}`;
    const raw = localStorage.getItem(key);

    if (!raw) {
      showToast("Conta não encontrada. Crie uma conta primeiro.");
      return;
    }

    const user = JSON.parse(raw);

    if (!user.passwordHash || !user.salt) {
      showToast("Esta conta foi criada antes do sistema de senha. Crie uma nova conta.");
      return;
    }

    const attemptHash = await hashPassword(password, user.salt);
    if (attemptHash !== user.passwordHash) {
      showToast("Senha incorreta.");
      return;
    }

    app.auth.user = {
      uid: user.uid || username,
      displayName: user.username,
      email: user.email || "",
      photoURL: user.photoURL || ""
    };

    showToast(`Bem-vindo, ${user.username}`);
    closeLoginModal();
    if (DOM.authPassword) DOM.authPassword.value = "";
    localStorage.setItem("newgen_current_user", username);
    loadUserData();
    updateAccountUI();
    if (app.currentPage === "ficha") renderFichaPage();
  }

  async function loginWithGoogle() {
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      app.auth.user = {
        uid: user.uid,
        displayName: user.displayName || "Jogador",
        email: user.email || "",
        photoURL: user.photoURL || ""
      };

      loadUserData();
      updateAccountUI();
      closeLoginModal();
      showToast("Login realizado com sucesso.");
      if (app.currentPage === "ficha") renderFichaPage();

      await sendToSheets("saveUser", {
        username: user.displayName || "Jogador",
        email: user.email || "",
        uid: user.uid,
        photoURL: user.photoURL || "",
        createdAt: new Date().toISOString(),
        characters: []
      }).catch(err => console.error(err));
    } catch (error) {
      console.error(error);
      showToast("Não foi possível entrar com Google.");
    }
  }

  async function logout() {
    try {
      await signOut(auth);
    } catch (error) {
      console.error(error);
    }
    localStorage.removeItem("newgen_current_user");
    app.auth.user = null;
    app.runtimeUser = null;
    app.state.currentCharacter = null;
    app.state.currentSlot = 0;
    updateAccountUI();
    showToast("Desconectado.");
    if (app.currentPage === "ficha") renderFichaPage();
  }

  function saveUserDataToLocal() {
    if (!app.auth.user || !app.runtimeUser) return;
    const key = `newgen_user_${app.auth.user.uid || app.auth.user.username}`;
    localStorage.setItem(key, JSON.stringify(app.runtimeUser));
    showToast("Ficha salva localmente.");
  }

  const RACAS_LIVRES = ["Humanos", "Homens-Peixe", "Tritão/Sereia", "Kujas", "Bucaneiros", "Mink's", "Gigantes", "Onis"];
  const LINHAGENS_PREMIUM = ["Celestiais", "Seraphins", "Ghoul", "Germa 66", "Gigantes ancestrais", "Lunarianos", "Apóstolos", "Nosferatu's", "Shinigami's", "Deuses antigos"];
  const HAKI_OPCOES = ["Nenhum", "Observação", "Armamento", "Observação e Armamento"];

  const FICHA_TEMPLATE = `ㅤ
──── ─── ─── ────
﹆ ֪𖤐  ֺ ໑ *OPNG - FICHA*
──── ───
 雄. | 𝐍𝗈𝗆𝖾:: {{nome}}
 雄. | 𝐈𝖽𝖺𝖽𝖾:: {{idade}}
 雄. | 𝐑𝖺𝖼̧𝖺:: {{raca}}
 雄. | 𝐆ênero::: {{genero}}
 雄. | 𝐋inhagem:: {{linhagem}}
 雄. | 𝐑ecompensa:: {{recompensa}}
      _┈ֺ──̸ . 
    _.英雄. ⤿ *HISTÓRIA*_
      _┈ֺ──̸ . {{historia}}_
    _.英雄. | ֺ⤿𝐏𝖾𝗋𝗌𝗈𝗇𝖺𝗅𝗂𝖽𝖺𝖽𝖾:_
      _┈ֺ──̸ . {{personalidade}}_
────────────────────
════════════════
═══ ═══
*𖤐CLASSIFICAÇÃO*
    .英雄. | ֺ⤿Classe :: {{classe}}
    .英雄. | ֺ⤿Afiliação :: {{afiliacao}}
    .英雄. | ֺ⤿Patente :: {{patente}}
   
──── *Atributos:*
  _.英雄. | ֺ⤿Força : {{forca}}
  _.英雄. | ֺ⤿Velocidade : {{velocidade}}
  _.英雄. | ֺ⤿Resistência : {{resistencia}}
  _.英雄. | ֺ⤿Vitalidade : {{vitalidade}}
────────────────────
*𖤐 COMBATE*
    .英雄. | ֺ⤿Estilo de luta :: {{estilo}}
    .英雄. | ֺ⤿Haki :: {{haki}}
    .英雄. | ֺ⤿Akuma no Mi :: {{akuma}}
    
      *┈ֺ──̸*
*𖤐 EQUIPAMENTO*
    .英雄. | ֺ⤿Itens :: {{itens}}
    .英雄. | ֺ⤿Recursos :: {{recursos}}
    
      _┈ֺ──̸ . ( armas, objetos, dinheiro ou recursos disponíveis )
────ㅤ───────ㅤ────
──ㅤ────`;

  function escapeHtml(str) {
    return String(str == null ? "" : str).replace(/[&<>"']/g, c => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
  }

  function createDefaultCharacter(slotIndex) {
    return {
      id: `char-${Date.now()}`,
      name: `Personagem ${slotIndex + 1}`,
      idade: "",
      genero: "",
      recompensa: "",
      historia: "",
      personalidade: "",
      race: null,
      linhagem: null,
      classe: null,
      afiliacao: null,
      patente: null,
      estilo: null,
      haki: null,
      akuma: null,
      itens: "",
      recursos: "",
      atributos: { Vitalidade: 0, Força: 0, Velocidade: 0, Resistência: 0 },
      locked: { race: false, linhagem: false },
      createdAt: new Date().toISOString()
    };
  }

  function getCurrentCharacter() {
    if (!app.auth.user) return null;
    const slot = app.state.currentSlot || 0;
    app.runtimeUser.characters = app.runtimeUser.characters || [null, null, null, null, null];
    let char = app.runtimeUser.characters[slot];

    if (!char) {
      char = createDefaultCharacter(slot);
      app.runtimeUser.characters[slot] = char;
      saveUserDataToLocal();
    }

    return char;
  }

  function isFichaComplete(char) {
    if (!char) return false;
    const a = char.atributos || {};
    const attrsFilled = Number(a["Força"]) > 0 && Number(a["Velocidade"]) > 0 &&
      Number(a["Resistência"]) > 0 && Number(a["Vitalidade"]) > 0;
    return !!(
      char.name && char.name.trim() &&
      char.idade && String(char.idade).trim() &&
      char.genero && char.genero.trim() &&
      char.race &&
      char.historia && char.historia.trim() &&
      char.personalidade && char.personalidade.trim() &&
      attrsFilled
    );
  }

  function selectOption(type, value) {
    if (!app.auth.user) {
      showToast("Faça login para criar e salvar seu personagem.");
      return;
    }

    const char = getCurrentCharacter();
    if (!char) return;

    if ((type === "race" || type === "linhagem") && char.locked[type]) {
      showToast(`${type === "race" ? "Raça" : "Linhagem"} já definida e permanente para este personagem.`);
      return;
    }

    const map = {
      racas: "race",
      classes: "classe",
      estilos: "estilo",
      treinamento: "treinamento",
      linhagem: "linhagem",
      raça: "race",
      raça_pt: "race"
    };

    const key = map[type] || type;

    if (key === "race" || key === "linhagem") {
      char.locked[key] = true;
    }

    if (!char.id) char.id = `char-${Date.now()}`;

    saveUserDataToLocal();
    showToast(`${humanizeKey(key)} selecionado: ${value} ✓`);

    if (app.currentPage === "ficha") renderFichaPage();
  }

  function humanizeKey(k) {
    const names = {
      race: "Raça",
      classe: "Classe",
      estilo: "Estilo",
      linhagem: "Linhagem",
      haki: "Haki",
      akuma: "Akuma no Mi"
    };
    return names[k] || k;
  }

  function buildFichaFormHTML(char) {
    const inputStyle = "padding:8px;border-radius:8px;border:1px solid var(--line);background:transparent;color:var(--ivory);width:100%;box-sizing:border-box;";
    const textareaStyle = inputStyle + "min-height:70px;margin-bottom:10px;resize:vertical;";
    const labelStyle = "font-size:12px;color:var(--lavender);margin-bottom:4px;display:block;";
    const raceLocked = !!char.locked?.race;
    const linhagemLocked = !!char.locked?.linhagem;

    const racaOptions = RACAS_LIVRES.map(r =>
      `<option value="${r}" ${char.race === r ? "selected" : ""}>${r}</option>`
    ).join("");

    const linhagemOptions = LINHAGENS_PREMIUM.map(l =>
      `<option value="${l}" ${char.linhagem === l ? "selected" : ""}>${l} 🔒 Premium</option>`
    ).join("");

    const generoOptions = ["Masculino", "Feminino", "Outro"].map(g =>
      `<option value="${g}" ${char.genero === g ? "selected" : ""}>${g}</option>`
    ).join("");

    const hakiOptions = HAKI_OPCOES.map(h =>
      `<option value="${h}" ${char.haki === h ? "selected" : ""}>${h}</option>`
    ).join("");

    return `
      <div class="ficha-form" style="margin-top:16px;padding:16px;border:1px solid var(--line);border-radius:12px;background:rgba(255,255,255,.02);">

        <h4 style="margin-top:0;">Identificação</h4>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px;margin-bottom:14px;">
          <div><span style="${labelStyle}">Nome</span><input data-field="name" value="${escapeHtml(char.name)}" style="${inputStyle}" /></div>
          <div><span style="${labelStyle}">Idade</span><input data-field="idade" value="${escapeHtml(char.idade)}" style="${inputStyle}" /></div>
          <div><span style="${labelStyle}">Gênero</span><select data-field="genero" style="${inputStyle}"><option value="">Escolha</option>${generoOptions}</select></div>
          <div><span style="${labelStyle}">Recompensa</span><input data-field="recompensa" value="${escapeHtml(char.recompensa)}" placeholder="ex: B$ 5.000" style="${inputStyle}" /></div>
        </div>

        <h4>Raça e Linhagem</h4>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px;margin-bottom:6px;">
          <div>
            <span style="${labelStyle}">Raça${raceLocked ? " (permanente)" : ""}</span>
            <select data-field="race" ${raceLocked ? "disabled" : ""} style="${inputStyle}${raceLocked ? "opacity:.6;" : ""}">
              <option value="">Escolha a raça</option>
              ${racaOptions}
            </select>
          </div>
          <div>
            <span style="${labelStyle}">Linhagem${linhagemLocked ? " (permanente)" : " (opcional, premium)"}</span>
            <select data-field="linhagem" ${linhagemLocked ? "disabled" : ""} style="${inputStyle}${linhagemLocked ? "opacity:.6;" : ""}">
              <option value="">Nenhuma</option>
              ${linhagemOptions}
            </select>
          </div>
        </div>
        <p style="font-size:12px;color:var(--lavender);margin:0 0 14px;">Raça e Linhagem, uma vez definidas e salvas, não podem mais ser alteradas.</p>

        <h4>História e Personalidade</h4>
        <span style="${labelStyle}">História</span>
        <textarea data-field="historia" placeholder="Conte a história do personagem" style="${textareaStyle}">${escapeHtml(char.historia)}</textarea>
        <span style="${labelStyle}">Personalidade</span>
        <textarea data-field="personalidade" placeholder="Descreva a personalidade" style="${textareaStyle}">${escapeHtml(char.personalidade)}</textarea>

        <h4>Classificação</h4>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px;margin-bottom:14px;">
          <div><span style="${labelStyle}">Classe</span><select disabled style="${inputStyle}opacity:.5;"><option>Em breve</option></select></div>
          <div><span style="${labelStyle}">Afiliação</span><select disabled style="${inputStyle}opacity:.5;"><option>Em breve</option></select></div>
          <div><span style="${labelStyle}">Patente</span><select disabled style="${inputStyle}opacity:.5;"><option>Em breve</option></select></div>
        </div>

        <h4>Atributos</h4>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px;margin-bottom:14px;">
          <div><span style="${labelStyle}">Força</span><input type="number" min="0" data-field="atributo-Força" value="${char.atributos?.["Força"] || 0}" style="${inputStyle}" /></div>
          <div><span style="${labelStyle}">Velocidade</span><input type="number" min="0" data-field="atributo-Velocidade" value="${char.atributos?.["Velocidade"] || 0}" style="${inputStyle}" /></div>
          <div><span style="${labelStyle}">Resistência</span><input type="number" min="0" data-field="atributo-Resistência" value="${char.atributos?.["Resistência"] || 0}" style="${inputStyle}" /></div>
          <div><span style="${labelStyle}">Vitalidade</span><input type="number" min="0" data-field="atributo-Vitalidade" value="${char.atributos?.["Vitalidade"] || 0}" style="${inputStyle}" /></div>
        </div>

        <h4>Combate</h4>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px;">
          <div><span style="${labelStyle}">Estilo de luta</span><select disabled style="${inputStyle}opacity:.5;"><option>Em breve</option></select></div>
          <div><span style="${labelStyle}">Haki</span><select data-field="haki" style="${inputStyle}"><option value="">Nenhum</option>${hakiOptions}</select></div>
          <div><span style="${labelStyle}">Akuma no Mi</span><select disabled style="${inputStyle}opacity:.5;"><option>Em breve</option></select></div>
        </div>
      </div>
    `;
  }

  function handleFichaFieldChange(slotIndex, el) {
    const char = app.runtimeUser.characters[slotIndex];
    if (!char) return;
    const field = el.getAttribute("data-field");
    const value = el.value;

    if (field.startsWith("atributo-")) {
      const attrName = field.replace("atributo-", "");
      char.atributos = char.atributos || {};
      char.atributos[attrName] = Math.max(0, parseInt(value, 10) || 0);
    } else if (field === "race") {
      if (char.locked?.race || !value) return;
      char.race = value;
      char.locked = char.locked || {};
      char.locked.race = true;
    } else if (field === "linhagem") {
      if (char.locked?.linhagem || !value) return;
      if (LINHAGENS_PREMIUM.includes(value)) {
        showToast("Linhagem Premium — em breve você poderá desbloquear via pagamento.");
        el.value = char.linhagem || "";
        return;
      }
      char.linhagem = value;
      char.locked = char.locked || {};
      char.locked.linhagem = true;
    } else {
      char[field] = value;
    }

    saveUserDataToLocal();
    renderFichaPage();
  }

 /* ===========================================================
   SISTEMA DE GERENCIAMENTO DE FICHAS (5 SLOTS & AUTO-SAVE)
   =========================================================== */

async function renderFichaPage() {
  const container = document.getElementById("ficha-slots-container");
  if (!container) return;

  // Bloqueia o acesso aos slots para quem não está logado (conta local ou Google)
  if (!app.auth.user) {
    container.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24"><path d="M12 17a2 2 0 100-4 2 2 0 000 4zM6 11V8a6 6 0 1112 0v3M5 11h14v9H5z"/></svg>
        <h4>Faça login para acessar sua ficha</h4>
        <p>Você precisa entrar ou criar uma conta para criar, editar e salvar seus personagens.</p>
        <button class="btn-primary" style="margin-top:14px;" onclick="document.getElementById('loginBtn')?.click()">Entrar / Criar conta</button>
      </div>
    `;
    return;
  }

  const currentUserId = app.auth.user.uid;
  const slots = await CharacterRepository.getSlots(currentUserId);

  container.innerHTML = slots.map((char, index) => {
    const slotNumber = index + 1;
    if (!char) {
      return `
        <div class="slot-card empty">
          <div class="slot-header">
            <span class="slot-badge">Slot ${slotNumber}</span>
          </div>
          <div class="slot-body">
            <h4>Slot Vazio</h4>
            <p>Nenhum personagem criado neste slot.</p>
          </div>
          <div class="slot-actions">
            <button class="btn-secondary" onclick="window.openCharacterEditor(${index})">+ Criar Personagem</button>
          </div>
        </div>
      `;
    }

    return `
      <div class="slot-card active">
        <div class="slot-header">
          <span class="slot-badge">Slot ${slotNumber}</span>
          <span class="slot-race">${char.raca || 'Sem Raça'}</span>
        </div>
        <div class="slot-body">
          <h4>${char.nome || 'Sem Nome'}</h4>
          <p><strong>Linhagem:</strong> ${char.linhagem || '-'}</p>
          <p><strong>Recompensa:</strong> ${char.recompensa || '-'}</p>
        </div>
        <div class="slot-actions">
          <button class="btn-primary" onclick="window.openCharacterEditor(${index})">Editar / Abrir</button>
          <button class="btn-danger" onclick="window.deleteCharacterSlot(${index})">Excluir</button>
        </div>
      </div>
    `;
  }).join("");

  setupEditorListeners();
}

// Expõe handlers globais para os botões do HTML
window.openCharacterEditor = async function(slotIndex) {
  if (!app.auth.user) {
    showToast("Faça login para criar e editar seu personagem.");
    return;
  }

  const currentUserId = app.auth.user.uid;
  const slots = await CharacterRepository.getSlots(currentUserId);
  const char = slots[slotIndex] || {};

  document.getElementById("char-slot-index").value = slotIndex;
  document.getElementById("editor-title").textContent = `Personagem - Slot ${slotIndex + 1}`;

  // Preenche inputs
  document.getElementById("char-nome").value = char.nome || "";
  document.getElementById("char-idade").value = char.idade || "";
  document.getElementById("char-genero").value = char.genero || "";
  document.getElementById("char-recompensa").value = char.recompensa || "";
  document.getElementById("char-historia").value = char.historia || "";
  document.getElementById("char-personalidade").value = char.personalidade || "";
  document.getElementById("char-raca").value = char.raca || "";
  document.getElementById("char-linhagem").value = char.linhagem || "";
  document.getElementById("char-haki").value = char.haki || "";

  document.getElementById("character-editor").style.display = "flex";
  validateAndSaveCurrentSlot();
};

window.deleteCharacterSlot = async function(slotIndex) {
  if (!app.auth.user) {
    showToast("Faça login para gerenciar seus personagens.");
    return;
  }
  if (!confirm(`Tem certeza de que deseja excluir o personagem do Slot ${slotIndex + 1}?`)) return;

  const currentUserId = app.auth.user.uid;
  await CharacterRepository.deleteSlot(currentUserId, slotIndex);
  showToast(`Slot ${slotIndex + 1} excluído com sucesso.`);
  renderFichaPage();
};

function setupEditorListeners() {
  const form = document.getElementById("character-form");
  const closeBtn = document.getElementById("close-editor-btn");
  const copyBtn = document.getElementById("copy-ficha-btn");

  if (!form) return;

  // Auto-save e Validação Reativa ao digitar ou alterar
  form.querySelectorAll("input, select, textarea").forEach(input => {
    input.oninput = () => validateAndSaveCurrentSlot();
    input.onchange = () => validateAndSaveCurrentSlot();
  });

  if (closeBtn) {
    closeBtn.onclick = () => {
      document.getElementById("character-editor").style.display = "none";
      renderFichaPage();
    };
  }

  if (copyBtn) {
    copyBtn.onclick = generateAndCopyTemplate;
  }
}

async function validateAndSaveCurrentSlot() {
  if (!app.auth.user) return;

  const slotIndex = parseInt(document.getElementById("char-slot-index").value, 10);
  const data = {
    nome: document.getElementById("char-nome").value.trim(),
    idade: document.getElementById("char-idade").value.trim(),
    genero: document.getElementById("char-genero").value.trim(),
    recompensa: document.getElementById("char-recompensa").value.trim(),
    historia: document.getElementById("char-historia").value.trim(),
    personalidade: document.getElementById("char-personalidade").value.trim(),
    raca: document.getElementById("char-raca").value,
    linhagem: document.getElementById("char-linhagem").value.trim(),
    haki: document.getElementById("char-haki").value
  };

  // Salva no LocalStorage via Repositório
  const currentUserId = app.auth.user.uid;
  await CharacterRepository.saveSlot(currentUserId, slotIndex, data);

  // Validação dos campos obrigatórios ativos
  const isValid = Object.values(data).every(val => val !== "");
  const copyBtn = document.getElementById("copy-ficha-btn");
  if (copyBtn) copyBtn.disabled = !isValid;
}

function generateAndCopyTemplate() {
  const char = {
    nome: document.getElementById("char-nome").value,
    idade: document.getElementById("char-idade").value,
    genero: document.getElementById("char-genero").value,
    recompensa: document.getElementById("char-recompensa").value,
    historia: document.getElementById("char-historia").value,
    personalidade: document.getElementById("char-personalidade").value,
    raca: document.getElementById("char-raca").value,
    linhagem: document.getElementById("char-linhagem").value,
    haki: document.getElementById("char-haki").value
  };


   
  // Gerador de Template Oficial no padrão OPNG
  const template = `ㅤ
──── ─── ─── ────
﹆ ֪𖤐  ֺ ໑ *OPNG - FICHA*
──── ───
 雄. | 𝐍𝗈𝗆𝖾:: ${char.nome}
 雄. | 𝐈𝖽𝖺𝖽𝖾:: ${char.idade}
 雄. | 𝐑𝖺𝖼̧𝖺:: ${char.raca}
 雄. | 𝐆ênero::: ${char.genero}
 雄. | 𝐋inhagem:: ${char.linhagem}
 雄. | 𝐑ecompensa:: ${char.recompensa}
     _┈ֺ──̸ . 

   _.英雄. ⤿ *HISTÓRIA*
     _┈ֺ──̸ . ${char.historia}

   _.英雄. | ֺ⤿𝐏𝖾𝗋𝗌𝗈𝗇𝖺𝗅𝗂𝖽𝖺𝖽𝖾:
     _┈ֺ──̸ . ${char.personalidade}

────────────────────
════════════════
═══ ═══

*𖤐CLASSIFICAÇÃO*

    .英雄. | ֺ⤿Classe :: 
    .英雄. | ֺ⤿Afiliação :: 
    .英雄. | ֺ⤿Patente :: 
   

──── *Atributos:*
  _.英雄. | ֺ⤿Força : 
  _.英雄. | ֺ⤿Velocidade : 
  _.英雄. | ֺ⤿Resistência : 
  _.英雄. | ֺ⤿Vitalidade : 

────────────────────

*𖤐 COMBATE*

    .英雄. | ֺ⤿Estilo de luta :: 
    .英雄. | ֺ⤿Haki :: ${char.haki}
    .英雄. | ֺ⤿Akuma no Mi :: 
    
      *┈ֺ──̸*

*𖤐 EQUIPAMENTO*

    .英雄. | ֺ⤿Itens :: 
    .英雄. | ֺ⤿Recursos :: 
    .英雄. | ֺ⤿Berries :: 
    
      _┈ֺ──̸ . ( armas, objetos, dinheiro ou recursos disponíveis )

────ㅤ───────ㅤ────
──ㅤ────`;

  navigator.clipboard.writeText(template).then(() => {
    const status = document.getElementById("copy-status");
    if (status) {
      status.textContent = "Ficha copiada para a área de transferência!";
      setTimeout(() => { status.textContent = ""; }, 3000);
    }
  }).catch(err => {
    console.error("Erro ao copiar ficha:", err);
  });
}


  function mountFichaText(char) {
    const a = char.atributos || {};
    const f = v => (v !== undefined && v !== null && String(v).trim()) ? v : "-";

    return FICHA_TEMPLATE
      .replace("{{nome}}", f(char.name))
      .replace("{{idade}}", f(char.idade))
      .replace("{{raca}}", f(char.race))
      .replace("{{genero}}", f(char.genero))
      .replace("{{linhagem}}", f(char.linhagem))
      .replace("{{recompensa}}", f(char.recompensa))
      .replace("{{historia}}", f(char.historia))
      .replace("{{personalidade}}", f(char.personalidade))
      .replace("{{classe}}", f(char.classe))
      .replace("{{afiliacao}}", f(char.afiliacao))
      .replace("{{patente}}", f(char.patente))
      .replace("{{forca}}", f(a["Força"]))
      .replace("{{velocidade}}", f(a["Velocidade"]))
      .replace("{{resistencia}}", f(a["Resistência"]))
      .replace("{{vitalidade}}", f(a["Vitalidade"]))
      .replace("{{estilo}}", f(char.estilo))
      .replace("{{haki}}", f(char.haki))
      .replace("{{akuma}}", f(char.akuma))
      .replace("{{itens}}", f(char.itens))
      .replace("{{recursos}}", f(char.recursos));
  }

  function setupCharacterInteractions() {
    document.addEventListener("click", e => {
      const card = e.target.closest(".race-card, .attr-card, .home-card, .haki-card");
      if (!card) return;

      const tab = card.closest(".tab-content")?.getAttribute("data-tab") || null;
      const section = card.closest(".section")?.id || null;
      if (section !== "personagem") return;

      let selectType = null;
      if (tab === "racas" || card.closest(".race-grid")) selectType = "race";
      if (tab === "classes") selectType = "classe";
      if (tab === "estilos") selectType = "estilo";
      if (tab === "treinamento") selectType = "treinamento";
      if (tab === "haki") selectType = "haki";
      if (tab === "akuma") selectType = "akuma";

      if (!selectType) return;

      const h3 = card.querySelector("h3");
      const value = h3 ? h3.textContent.trim() : (card.getAttribute("data-value") || card.textContent.trim().slice(0, 40));

      const isPremium = !!card.querySelector(".premium-list");
      if (isPremium && !app.auth.user) {
        showToast("Faça login para conhecer os produtos premium.");
        return;
      }

      if ((selectType === "race" || selectType === "linhagem") && app.auth.user) {
        const char = getCurrentCharacter();
        if (char && char.locked && char.locked[selectType]) {
          showToast(`${selectType === "race" ? "Raça" : "Linhagem"} é permanente e não pode ser alterada.`);
          return;
        }
      }

      selectOption(selectType, value);
    });
  }

  async function sendToSheets(action, payload) {
    const endpoint = "https://script.google.com/macros/s/AKfycbxB8s3iCeaH2wmk4dgh7dDjYuMvHGwKTjSziDiJ6-vaJT42Z6A-cGsw4RvDKXDgi3PW/exec";
    const resposta = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain"
      },
      body: JSON.stringify({
        action,
        usuario: payload
      })
    });
    return await resposta.json();
  }

  function setupAuth() {
    document.getElementById("loginBtn")?.addEventListener("click", openLoginModal);
    document.getElementById("closeLoginModal")?.addEventListener("click", closeLoginModal);
    document.getElementById("createAccountBtn")?.addEventListener("click", () => {
      createAccount(DOM.authUser.value?.trim(), DOM.authEmail.value?.trim(), DOM.authPassword?.value || "");
    });
    document.getElementById("doLoginBtn")?.addEventListener("click", () => {
      doLogin(DOM.authUser.value?.trim(), DOM.authPassword?.value || "");
    });
    document.getElementById("googleLoginBtn")?.addEventListener("click", loginWithGoogle);
    document.getElementById("logoutBtn")?.addEventListener("click", logout);

    onAuthStateChanged(auth, user => {
      if (user) {
        app.auth.user = {
          uid: user.uid,
          displayName: user.displayName || "Jogador",
          email: user.email || "",
          photoURL: user.photoURL || ""
        };
        loadUserData();
      } else if (!localStorage.getItem("newgen_current_user")) {
        app.auth.user = null;
        app.runtimeUser = null;
        app.state.currentCharacter = null;
        app.state.currentSlot = 0;
      }

      updateAccountUI();
      if (app.currentPage === "ficha") renderFichaPage();
    });
  }

  function restoreLocalSession() {
    const username = localStorage.getItem("newgen_current_user");
    if (!username) return;

    const raw = localStorage.getItem(`newgen_user_${username}`);
    if (!raw) {
      localStorage.removeItem("newgen_current_user");
      return;
    }

    const user = JSON.parse(raw);
    app.auth.user = { ...user, uid: username, displayName: username, photoURL: "" };
    loadUserData();
  }

  async function init() {
    try {
      restoreLocalSession();
      await loadPages();
      setupNavigation();
      setupDrawer();
      setupTabs();
      setupCharacterInteractions();
      setupAuth();

      DOM.enterBtn?.addEventListener("click", enterWiki);

      updateAccountUI();

      if (!document.getElementById("ficha-root")) {
        const fichaSection = document.querySelector("#ficha");
        if (fichaSection) {
          const root = document.createElement("div");
          root.id = "ficha-root";
          fichaSection.appendChild(root);
        }
      }
    } catch (error) {
      console.error("Failed to initialize app:", error);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();