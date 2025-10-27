const auraCountEl = document.getElementById("aura-count");
const auraRateEl = document.getElementById("aura-rate");
const kacperListEl = document.getElementById("kacper-list");
const meditateBtn = document.getElementById("meditate-btn");
const template = document.getElementById("kacper-card-template");
const pseudoOverlay = document.getElementById("pseudo-overlay");
const pseudoForm = document.getElementById("pseudo-form");
const pseudoInput = document.getElementById("pseudo-input");
const changePseudoBtn = document.getElementById("change-pseudo-btn");
const leaderboardListEl = document.getElementById("leaderboard-list");
const leaderboardStatusEl = document.getElementById("leaderboard-status");
const blessingPanel = document.getElementById("blessing-panel");
const blessingBtn = document.getElementById("blessing-btn");
const blessingStatusEl = document.getElementById("blessing-status");
const accountBtn = document.getElementById("account-btn");
const accountOverlay = document.getElementById("account-overlay");
const accountLoginTab = document.getElementById("account-login-tab");
const accountRegisterTab = document.getElementById("account-register-tab");
const loginForm = document.getElementById("login-form");
const registerForm = document.getElementById("register-form");
const loginNameInput = document.getElementById("login-name");
const loginPasswordInput = document.getElementById("login-password");
const registerNameInput = document.getElementById("register-name");
const registerPasswordInput = document.getElementById("register-password");
const registerConfirmInput = document.getElementById("register-confirm");
const loginErrorEl = document.getElementById("login-error");
const registerErrorEl = document.getElementById("register-error");
const accountStatusEl = document.getElementById("account-status");
const logoutBtn = document.getElementById("logout-btn");
const closeAccountBtn = document.getElementById("close-account-btn");

const MANUAL_GAIN = 0.05;
const STORAGE_KEY = "kacperTempleState";
const LOCAL_LEADERBOARD_KEY = "kacperTempleLeaderboardCache";
const AUTH_STORAGE_KEY = "kacperTempleAuth";
const LEADERBOARD_DISPLAY_LIMIT = 8;
const API_BASE_URL =
  window.KACPER_API_URL || window.TEMPLE_API_URL || "http://localhost:8787";
const API_TIMEOUT_MS = 4000;
const REMOTE_SAVE_DEBOUNCE_MS = 600;
const BLESSING_UNLOCK_THRESHOLD = 10;
const BLESSING_INITIAL_COST = 100;
const BLESSING_COST_MULTIPLIER = 1.5;
const BLESSING_REWARDS = [
  {
    id: "apple",
    name: "La pomme de Kacper",
    chance: 0.5,
    bonus: 0.2,
  },
      {
    id: "sausage",
    name: "La saucisse de kacper",
    chance: 0.1,
    bonus: 0.50,
  },
  {
    id: "car",
    name: "La voiture de Kacper",
    chance: 0.05,
    bonus: 1,
  },
  {
    id: "lover",
    name: "La meuf de Kacper",
    chance: 0.0001,
    bonus: 8,
  },

];
const BASE_KACPERS = [
  {
    id: "baby",
    name: "Kacper bébé",
    description: "Sa première étincelle nourrit le temple en douceur.",
    production: 0.05,
    cost: 5,
    owned: 0,
  },
  {
    id: "mini",
    name: "Mini Kacper",
    description: "Un disciple turbulent qui canalise plus d'énergie.",
    production: 0.25,
    cost: 25,
    owned: 0,
  },
    {
    id: "chemise",
    name: "Kacper avec chemise",
    description: "Ca chemise éclaire nos soirées.",
    production: 7.5,
    cost: 1000,
    owned: 0,
  },
  {
    id: "daily",
    name: "Daily Kacper",
    description: "Les aventures de daily kacper ne font que commencer.",
    production: 250,
    cost: 75000,
    owned: 0,
  },
    {
    id: "danse",
    name: "Kacper dansant",
    description: "Ses mouvements vous laissent en trance.",
    production: 4000,
    cost: 20000000,
    owned: 0,
  },
      {
    id: "pecho",
    name: "Kacper qui pécho",
    description: "Kacper a réussi à trouver sa femelle, c'est un événement rare.",
    production: 150000,
    cost: 4000000000,
    owned: 0,
  },
];

const formatNumber = (value) => {
  if (typeof value !== "number" || !Number.isFinite(value)) return "0";

  const absValue = Math.abs(value);

  if (absValue < 1000) {
    return new Intl.NumberFormat("fr-FR", {
      minimumFractionDigits: absValue < 10 ? 2 : 1,
      maximumFractionDigits: absValue < 10 ? 2 : 1,
    }).format(value);
  }

  const suffixes = ["", "K", "m", "M", "T", "P", "E"];
  const maxTier = suffixes.length - 1;
  const baseTier = Math.min(
    maxTier,
    Math.floor(Math.log10(absValue) / 3)
  );

  const computeDigits = (num) => {
    const absNum = Math.abs(num);
    if (absNum >= 100) return 0;
    if (absNum >= 10) return 1;
    return 2;
  };

  let tier = baseTier;
  let scaled = value / Math.pow(10, tier * 3);
  let digits = computeDigits(scaled);
  let rounded = Number(scaled.toFixed(digits));

  while (Math.abs(rounded) >= 1000 && tier < maxTier) {
    tier += 1;
    scaled = value / Math.pow(10, tier * 3);
    digits = computeDigits(scaled);
    rounded = Number(scaled.toFixed(digits));
  }

  const formatted = new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  }).format(rounded);

  return `${formatted}${suffixes[tier]}`;
};

function defaultBlessingState() {
  return {
    unlocked: false,
    cost: BLESSING_INITIAL_COST,
    purchaseCount: 0,
    rateBonus: 0,
    lastOutcome: null,
  };
}

function cloneBaseKacpers(saved = []) {
  return BASE_KACPERS.map((base) => {
    const stored = saved.find((item) => item.id === base.id);
    return {
      ...base,
      owned: stored?.owned ?? 0,
      cost: stored?.cost ?? base.cost,
    };
  });
}

function defaultState() {
  return {
    aura: 0,
    playerName: "",
    kacpers: cloneBaseKacpers(),
    blessing: defaultBlessingState(),
  };
}

function sanitizeLastOutcome(raw) {
  if (!raw || typeof raw !== "object") return null;
  if (raw.type === "reward") {
    const bonus = Number(raw.bonus);
    return {
      type: "reward",
      id: (raw.id || "").toString().slice(0, 64),
      name: (raw.name || "").toString().slice(0, 64),
      bonus: Number.isFinite(bonus) ? bonus : 0,
    };
  }
  if (raw.type === "none") {
    return { type: "none" };
  }
  return null;
}

function deserializeState(raw) {
  if (!raw || typeof raw !== "object") {
    return defaultState();
  }

  const state = defaultState();
  const auraValue = Number(raw.aura);
  state.aura = Number.isFinite(auraValue) && auraValue >= 0 ? auraValue : 0;
  state.playerName = (raw.playerName || "").toString().slice(0, 32);
  state.kacpers = cloneBaseKacpers(raw.kacpers || []);
  state.blessing = {
    ...defaultBlessingState(),
    unlocked: Boolean(raw.blessing?.unlocked),
    cost:
      typeof raw.blessing?.cost === "number" && raw.blessing.cost > 0
        ? raw.blessing.cost
        : BLESSING_INITIAL_COST,
    purchaseCount: Number(raw.blessing?.purchaseCount) || 0,
    rateBonus: Number(raw.blessing?.rateBonus) || 0,
    lastOutcome: sanitizeLastOutcome(raw.blessing?.lastOutcome),
  };
  return state;
}

function serializeState(currentState) {
  return {
    aura: Number(currentState.aura) || 0,
    playerName: (currentState.playerName || "").toString().slice(0, 32),
    kacpers: currentState.kacpers.map(({ id, cost, owned }) => ({
      id,
      cost: Number(cost) || 0,
      owned: Number(owned) || 0,
    })),
    blessing: {
      unlocked: Boolean(currentState.blessing?.unlocked),
      cost:
        typeof currentState.blessing?.cost === "number" &&
        currentState.blessing.cost > 0
          ? currentState.blessing.cost
          : BLESSING_INITIAL_COST,
      purchaseCount: Number(currentState.blessing?.purchaseCount) || 0,
      rateBonus: Number(currentState.blessing?.rateBonus) || 0,
      lastOutcome: sanitizeLastOutcome(currentState.blessing?.lastOutcome),
    },
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    return deserializeState(JSON.parse(raw));
  } catch (error) {
    console.warn("Impossible de charger la sauvegarde :", error);
    return defaultState();
  }
}

function saveState(currentState) {
  try {
    const payload = serializeState(currentState);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (error) {
    console.warn("Impossible d'enregistrer la sauvegarde :", error);
  }
}

function loadAuthSession() {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const name = (parsed.name || "").toString().slice(0, 32);
    const token = (parsed.token || "").toString().trim();
    if (!name || !token) return null;
    return { name, token };
  } catch (error) {
    console.warn("Impossible de charger la session :", error);
    return null;
  }
}

function saveAuthSession(session) {
  try {
    if (!session) {
      localStorage.removeItem(AUTH_STORAGE_KEY);
      return;
    }
    const payload = {
      name: (session.name || "").toString().slice(0, 32),
      token: (session.token || "").toString().trim(),
    };
    if (!payload.name || !payload.token) {
      localStorage.removeItem(AUTH_STORAGE_KEY);
      return;
    }
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(payload));
  } catch (error) {
    console.warn("Impossible d'enregistrer la session :", error);
  }
}

function normalizeLeaderboard(entries) {
  if (!Array.isArray(entries)) return [];
  return entries
    .map((entry) => ({
      name: (entry.name || "Anonyme").toString().slice(0, 32),
      aura: Number(entry.aura) || 0,
    }))
    .filter((entry) => entry.name);
}

function loadLocalLeaderboard() {
  try {
    const raw = localStorage.getItem(LOCAL_LEADERBOARD_KEY);
    if (!raw) return [];
    return normalizeLeaderboard(JSON.parse(raw));
  } catch (error) {
    console.warn("Impossible de charger le leaderboard local :", error);
    return [];
  }
}

function saveLocalLeaderboard(entries) {
  try {
    localStorage.setItem(
      LOCAL_LEADERBOARD_KEY,
      JSON.stringify(entries.slice(0, LEADERBOARD_DISPLAY_LIMIT))
    );
  } catch (error) {
    console.warn("Impossible d'enregistrer le leaderboard local :", error);
  }
}

function setLeaderboardStatus(message, tone) {
  if (!leaderboardStatusEl) return;
  leaderboardStatusEl.textContent = message;
  leaderboardStatusEl.classList.remove("success", "error");
  if (tone === "success") leaderboardStatusEl.classList.add("success");
  if (tone === "error") leaderboardStatusEl.classList.add("error");
}

let state = loadState();
const elementsById = new Map();
let leaderboard = loadLocalLeaderboard();
let lastPersistTime = 0;
let lastLeaderboardSyncTime = 0;
let leaderboardSyncInFlight = false;
let accountSession = loadAuthSession();
let remotePersistTimeoutId = null;
let remotePersistInFlight = false;
let remotePersistRequested = false;
let suppressRemotePersist = false;
let accountMode = "login";

function applyAccountSessionUI() {
  if (accountBtn) {
    accountBtn.textContent = accountSession
      ? `Compte (${accountSession.name})`
      : "Se connecter";
  }
  if (logoutBtn) {
    logoutBtn.classList.toggle("hidden", !accountSession);
  }
}

function updateAccountStatus(message = "", tone) {
  if (!accountStatusEl) return;
  accountStatusEl.textContent = message;
  accountStatusEl.classList.remove("success", "error");
  if (tone === "success") accountStatusEl.classList.add("success");
  if (tone === "error") accountStatusEl.classList.add("error");
}

function setAccountMode(mode) {
  accountMode = mode === "register" ? "register" : "login";
  if (accountLoginTab) {
    accountLoginTab.classList.toggle("active", accountMode === "login");
  }
  if (accountRegisterTab) {
    accountRegisterTab.classList.toggle("active", accountMode === "register");
  }
  if (loginForm) {
    loginForm.classList.toggle("hidden", accountMode !== "login");
  }
  if (registerForm) {
    registerForm.classList.toggle("hidden", accountMode !== "register");
  }
  clearFormError(loginErrorEl);
  clearFormError(registerErrorEl);
}

function openAccountModal(mode = accountSession ? "login" : "register") {
  if (!accountOverlay) return;
  setAccountMode(mode);
  accountOverlay.classList.remove("hidden");
  updateAccountStatus(
    accountSession ? `Connecte en tant que ${accountSession.name}` : ""
  );
  setTimeout(() => {
    const target =
      accountMode === "login" ? loginNameInput || loginPasswordInput : registerNameInput;
    target?.focus();
  }, 0);
}

function closeAccountModal() {
  if (!accountOverlay) return;
  accountOverlay.classList.add("hidden");
  resetAccountForms();
  updateAccountStatus("");
}

function clearFormError(target) {
  if (!target) return;
  target.textContent = "";
}

function setFormError(target, message) {
  if (!target) return;
  target.textContent = message || "";
}

function setFormLoading(form, isLoading) {
  if (!form) return;
  const elements = form.querySelectorAll("input, button");
  elements.forEach((element) => {
    element.disabled = isLoading;
  });
}

function resetAccountForms() {
  loginForm?.reset();
  registerForm?.reset();
  clearFormError(loginErrorEl);
  clearFormError(registerErrorEl);
}

function setAccountSession(session) {
  if (session && session.name && session.token) {
    accountSession = {
      name: session.name.toString().slice(0, 32),
      token: session.token.toString(),
    };
  } else {
    accountSession = null;
  }
  saveAuthSession(accountSession);
  applyAccountSessionUI();
}

async function handleLoginSubmit(event) {
  event.preventDefault();
  if (!loginForm) return;

  const name = sanitizeAccountName(loginNameInput?.value || "");
  const password = loginPasswordInput?.value || "";

  if (!name) {
    setFormError(loginErrorEl, "Choisis un nom d'esprit.");
    loginNameInput?.focus();
    return;
  }

  if (!password) {
    setFormError(loginErrorEl, "Entre ton mot de passe.");
    loginPasswordInput?.focus();
    return;
  }

  setFormError(loginErrorEl, "");
  updateAccountStatus("Connexion au temple en cours...");
  setFormLoading(loginForm, true);

  try {
    const response = await loginAccountRequest(name, password);
    const accountName = response?.account?.name || name;
    if (!response?.token) {
      throw new Error("Session invalide.");
    }
    setAccountSession({ name: accountName, token: response.token });
    if (response.state) {
      applyRemoteState(response.state);
    } else {
      maybeSyncLeaderboard(true);
    }
    updateAccountStatus(`Connecte en tant que ${accountName}`, "success");
    closeAccountModal();
  } catch (error) {
    console.warn("Connexion impossible :", error);
    const message =
      typeof error?.message === "string" && error.message
        ? error.message
        : "Connexion impossible, reessaie.";
    setFormError(loginErrorEl, message);
    updateAccountStatus("Connexion impossible.", "error");
  } finally {
    setFormLoading(loginForm, false);
  }
}

async function handleRegisterSubmit(event) {
  event.preventDefault();
  if (!registerForm) return;

  const name = sanitizeAccountName(registerNameInput?.value || "");
  const password = registerPasswordInput?.value || "";
  const confirm = registerConfirmInput?.value || "";

  if (!name || name.length < 3) {
    setFormError(registerErrorEl, "Choisis un nom d'esprit (3 caracteres min).");
    registerNameInput?.focus();
    return;
  }

  if (password.length < 6) {
    setFormError(registerErrorEl, "Mot de passe trop court (6 caracteres min).");
    registerPasswordInput?.focus();
    return;
  }

  if (password !== confirm) {
    setFormError(registerErrorEl, "Les mots de passe ne correspondent pas.");
    registerConfirmInput?.focus();
    return;
  }

  setFormError(registerErrorEl, "");
  updateAccountStatus("Creation du compte...");
  setFormLoading(registerForm, true);

  try {
    const response = await registerAccountRequest(name, password);
    const accountName = response?.account?.name || name;
    if (!response?.token) {
      throw new Error("Session invalide.");
    }
    setAccountSession({ name: accountName, token: response.token });
    if (response.state) {
      applyRemoteState(response.state);
    } else {
      maybeSyncLeaderboard(true);
    }
    updateAccountStatus(`Bienvenue ${accountName} !`, "success");
    closeAccountModal();
  } catch (error) {
    console.warn("Creation de compte impossible :", error);
    const message =
      typeof error?.message === "string" && error.message
        ? error.message
        : "Creation impossible, reessaie.";
    setFormError(registerErrorEl, message);
    updateAccountStatus("Creation impossible.", "error");
  } finally {
    setFormLoading(registerForm, false);
  }
}

function handleLogout(event) {
  event?.preventDefault();
  setAccountSession(null);
  if (remotePersistTimeoutId) {
    clearTimeout(remotePersistTimeoutId);
    remotePersistTimeoutId = null;
  }
  remotePersistRequested = false;
  updateAccountStatus("Deconnecte.", "success");
  closeAccountModal();
}

function renderLeaderboard() {
  if (!leaderboardListEl) return;
  leaderboardListEl.innerHTML = "";

  const entries = leaderboard.slice(0, LEADERBOARD_DISPLAY_LIMIT);
  if (!entries.length) {
    const emptyItem = document.createElement("li");
    emptyItem.className = "empty";
    emptyItem.textContent = "Aucun gardien encore.";
    leaderboardListEl.appendChild(emptyItem);
    return;
  }

  const fragment = document.createDocumentFragment();
  entries.forEach((entry, index) => {
    const li = document.createElement("li");
    if (entry.name === state.playerName) li.classList.add("active");

    const nameWrap = document.createElement("span");
    nameWrap.className = "name";
    const rank = document.createElement("span");
    rank.className = "rank";
    rank.textContent = `#${index + 1}`;
    const name = document.createElement("span");
    name.textContent = entry.name;
    nameWrap.append(rank, name);

    const auraValue = document.createElement("span");
    auraValue.className = "aura";
    auraValue.textContent = `${formatNumber(entry.aura)} aura`;

    li.append(nameWrap, auraValue);
    fragment.appendChild(li);
  });

  leaderboardListEl.appendChild(fragment);
}

function abortableFetch(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  const opts = { ...options, signal: controller.signal };
  return fetch(url, opts).finally(() => clearTimeout(timeout));
}

async function fetchLeaderboardFromServer() {
  if (typeof fetch === "undefined") {
    throw new Error("fetch indisponible");
  }
  const response = await abortableFetch(`${API_BASE_URL}/leaderboard`, {
    method: "GET",
  });
  if (!response.ok) {
    throw new Error(`GET /leaderboard failed with ${response.status}`);
  }
  const data = await response.json();
  return normalizeLeaderboard(data);
}

async function submitScoreToServer() {
  if (typeof fetch === "undefined") {
    throw new Error("fetch indisponible");
  }
  const payload = {
    name: state.playerName,
    aura: Number(state.aura.toFixed(2)),
  };
  const response = await abortableFetch(`${API_BASE_URL}/leaderboard`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(`POST /leaderboard failed with ${response.status}`);
  }
  const data = await response.json();
  return normalizeLeaderboard(data);
}

async function callTempleApi(path, { method = "GET", body, auth = false } = {}) {
  if (typeof fetch === "undefined") {
    throw new Error("fetch indisponible");
  }

  const headers = {};
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  if (auth) {
    if (!accountSession?.token) {
      throw new Error("Session invalide");
    }
    headers.Authorization = `Bearer ${accountSession.token}`;
  }

  const response = await abortableFetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  let payload = null;
  if (response.status !== 204) {
    try {
      payload = await response.json();
    } catch (error) {
      payload = null;
    }
  }

  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && payload.error
        ? payload.error.toString()
        : `Requete ${method} ${path} echouee (${response.status})`;
    const rejection = new Error(message);
    rejection.status = response.status;
    rejection.payload = payload;
    throw rejection;
  }

  return payload;
}

function sanitizeAccountName(name) {
  return name.toString().trim().slice(0, 32);
}

async function registerAccountRequest(name, password) {
  return callTempleApi("/auth/register", {
    method: "POST",
    body: { name: sanitizeAccountName(name), password },
  });
}

async function loginAccountRequest(name, password) {
  return callTempleApi("/auth/login", {
    method: "POST",
    body: { name: sanitizeAccountName(name), password },
  });
}

async function fetchProgressFromServer() {
  return callTempleApi("/progress", { method: "GET", auth: true });
}

async function saveProgressToServer(payload) {
  return callTempleApi("/progress", {
    method: "POST",
    body: { state: payload },
    auth: true,
  });
}

function applyRemoteState(rawState, { syncLeaderboard = true } = {}) {
  if (!rawState) return;
  const normalized = deserializeState(rawState);
  suppressRemotePersist = true;
  state.aura = normalized.aura;
  state.playerName = normalized.playerName;
  state.kacpers = normalized.kacpers;
  state.blessing = normalized.blessing;
  saveState(state);
  refreshUI(undefined, false);
  suppressRemotePersist = false;
  if (syncLeaderboard) {
    maybeSyncLeaderboard(true);
  }
}

async function bootstrapAccountSession() {
  applyAccountSessionUI();
  if (!accountSession?.token) {
    if (!state.playerName) {
      openPseudoDialog("");
    } else {
      maybeSyncLeaderboard(true);
    }
    return;
  }

  updateAccountStatus(`Chargement de ${accountSession.name}...`);
  try {
    const response = await fetchProgressFromServer();
    const accountName = response?.account?.name || accountSession.name;
    setAccountSession({ name: accountName, token: accountSession.token });
    if (response?.state) {
      applyRemoteState(response.state);
    } else if (!state.playerName) {
      state.playerName = accountName;
      saveState(state);
    }
    updateAccountStatus(`Connecte en tant que ${accountName}`, "success");
  } catch (error) {
    console.warn("Impossible de charger la progression distante :", error);
    updateAccountStatus("Serveur inaccessible pour le compte.", "error");
    if (error?.status === 401) {
      setAccountSession(null);
    }
  } finally {
    if (!state.playerName) {
      openPseudoDialog("");
    } else {
      maybeSyncLeaderboard(true);
    }
  }
}

function maybeSyncLeaderboard(force = false) {
  if (!state.playerName) {
    renderLeaderboard();
    return;
  }
  const now = typeof performance !== "undefined" ? performance.now() : Date.now();
  if (!force && now - lastLeaderboardSyncTime < 2000) return;
  if (leaderboardSyncInFlight) return;

  lastLeaderboardSyncTime = now;
  leaderboardSyncInFlight = true;

  submitScoreToServer()
    .then((remoteBoard) => {
      leaderboard = remoteBoard;
      saveLocalLeaderboard(remoteBoard);
      setLeaderboardStatus("Connecté au temple.", "success");
      renderLeaderboard();
    })
    .catch((error) => {
      console.warn("Sync leaderboard échoué :", error);
      setLeaderboardStatus("Serveur indisponible, affichage local.", "error");
      leaderboard = loadLocalLeaderboard();
      renderLeaderboard();
    })
    .finally(() => {
      leaderboardSyncInFlight = false;
    });
}

function bootstrapLeaderboard() {
  renderLeaderboard();
  fetchLeaderboardFromServer()
    .then((remoteBoard) => {
      leaderboard = remoteBoard;
      saveLocalLeaderboard(remoteBoard);
      setLeaderboardStatus("Connecté au temple.", "success");
      renderLeaderboard();
    })
    .catch((error) => {
      console.warn("Chargement du leaderboard distant impossible :", error);
      setLeaderboardStatus("Serveur indisponible, affichage local.", "error");
      renderLeaderboard();
    });
}

function scheduleRemotePersist(force = false) {
  if (!accountSession?.token) return;
  remotePersistRequested = true;

  if (remotePersistInFlight) {
    return;
  }

  if (remotePersistTimeoutId) {
    if (force) {
      clearTimeout(remotePersistTimeoutId);
      remotePersistTimeoutId = setTimeout(runRemotePersist, 0);
    }
    return;
  }

  const delay = force ? 0 : REMOTE_SAVE_DEBOUNCE_MS;
  remotePersistTimeoutId = setTimeout(runRemotePersist, delay);
}

async function runRemotePersist() {
  if (!accountSession?.token) {
    remotePersistRequested = false;
    if (remotePersistTimeoutId) {
      clearTimeout(remotePersistTimeoutId);
      remotePersistTimeoutId = null;
    }
    return;
  }

  if (remotePersistInFlight) return;

  remotePersistInFlight = true;
  if (remotePersistTimeoutId) {
    clearTimeout(remotePersistTimeoutId);
    remotePersistTimeoutId = null;
  }

  const payload = serializeState(state);
  try {
    const response = await saveProgressToServer(payload);
    remotePersistRequested = false;
    if (response?.state) {
      applyRemoteState(response.state, { syncLeaderboard: false });
    }
  } catch (error) {
    console.warn("Sauvegarde distante impossible :", error);
    remotePersistRequested = true;
  } finally {
    remotePersistInFlight = false;
    if (remotePersistRequested && !remotePersistTimeoutId) {
      remotePersistTimeoutId = setTimeout(runRemotePersist, REMOTE_SAVE_DEBOUNCE_MS);
    }
  }
}

function persistState(force = false) {
  const now = typeof performance !== "undefined" ? performance.now() : Date.now();
  if (!force && now - lastPersistTime < 1000) return;
  lastPersistTime = now;
  saveState(state);
  if (suppressRemotePersist) return;
  if (accountSession?.token) {
    scheduleRemotePersist(force);
  }
}

function initShop() {
  state.kacpers.forEach((kacper) => {
    const node = template.content.cloneNode(true);
    const card = node.querySelector(".kacper-card");
    const nameEl = card.querySelector(".name");
    const descriptionEl = card.querySelector(".description");
    const productionEl = card.querySelector(".production");
    const costEl = card.querySelector(".cost");
    const ownedEl = card.querySelector(".owned");
    const button = card.querySelector(".buy-btn");

    nameEl.textContent = kacper.name;
    descriptionEl.textContent = kacper.description;
    productionEl.textContent = `${kacper.production}`;
    costEl.textContent = formatNumber(kacper.cost);
    ownedEl.textContent = kacper.owned;
    button.dataset.kacperId = kacper.id;
    button.addEventListener("click", () => buyKacper(kacper.id));

    elementsById.set(kacper.id, {
      productionEl,
      costEl,
      ownedEl,
      button,
    });

    kacperListEl.appendChild(node);
  });
}

function getAuraRate() {
  const baseRate = state.kacpers.reduce(
    (total, { production, owned }) => total + production * owned,
    0
  );
  const bonusMultiplier = 1 + (state.blessing?.rateBonus || 0);
  return baseRate * bonusMultiplier;
}

function buyKacper(id) {
  const kacper = state.kacpers.find((item) => item.id === id);
  if (!kacper || state.aura < kacper.cost) return;

  state.aura -= kacper.cost;
  kacper.owned += 1;
  kacper.cost = +(kacper.cost * 1.15).toFixed(2);
  updateKacperCard(kacper);
  refreshUI(undefined, true);
}

function updateKacperCard(kacper) {
  const elements = elementsById.get(kacper.id);
  if (!elements) return;

  elements.ownedEl.textContent = kacper.owned;
  elements.costEl.textContent = formatNumber(kacper.cost);
  elements.productionEl.textContent = `${kacper.production}`;
}

function refreshUI(rate, forcePersist = false) {
  const currentRate = typeof rate === "number" ? rate : getAuraRate();
  auraCountEl.textContent = formatNumber(state.aura);
  auraRateEl.textContent = formatNumber(currentRate);

  const unlockedNow = maybeUnlockBlessing();
  updateBlessingUI();

  state.kacpers.forEach((kacper) => {
    const elements = elementsById.get(kacper.id);
    if (!elements) return;
    elements.button.disabled = state.aura < kacper.cost;
  });

  persistState(forcePersist || unlockedNow);
  maybeSyncLeaderboard(forcePersist);
}

function updateLoop(timestamp) {
  if (!updateLoop.lastTime) updateLoop.lastTime = timestamp;
  const deltaSeconds = (timestamp - updateLoop.lastTime) / 1000;
  updateLoop.lastTime = timestamp;

  const rate = getAuraRate();
  state.aura += rate * deltaSeconds;
  refreshUI(rate);

  requestAnimationFrame(updateLoop);
}

function openPseudoDialog(prefill = "") {
  pseudoOverlay.classList.remove("hidden");
  pseudoInput.value = prefill;
  setTimeout(() => pseudoInput.focus(), 0);
}

function closePseudoDialog() {
  pseudoOverlay.classList.add("hidden");
}

function handlePseudoSubmit(event) {
  event.preventDefault();
  const value = pseudoInput.value.trim();
  if (!value) return;

  state.playerName = value;
  closePseudoDialog();
  persistState(true);
  maybeSyncLeaderboard(true);
}

initShop();
bootstrapLeaderboard();

if (meditateBtn) {
  meditateBtn.addEventListener("click", () => {
    state.aura += MANUAL_GAIN;
    refreshUI(undefined, true);
  });
}

if (pseudoForm) {
  pseudoForm.addEventListener("submit", handlePseudoSubmit);
}
if (changePseudoBtn) {
  changePseudoBtn.addEventListener("click", () => {
    openPseudoDialog(state.playerName);
  });
}

if (accountBtn) {
  accountBtn.addEventListener("click", () => {
    openAccountModal(accountSession ? "login" : "register");
  });
}
if (accountLoginTab) {
  accountLoginTab.addEventListener("click", () => setAccountMode("login"));
}
if (accountRegisterTab) {
  accountRegisterTab.addEventListener("click", () => setAccountMode("register"));
}
if (closeAccountBtn) {
  closeAccountBtn.addEventListener("click", closeAccountModal);
}
if (logoutBtn) {
  logoutBtn.addEventListener("click", handleLogout);
}
if (accountOverlay) {
  accountOverlay.addEventListener("click", (event) => {
    if (event.target === accountOverlay) {
      closeAccountModal();
    }
  });
}
if (loginForm) {
  loginForm.addEventListener("submit", handleLoginSubmit);
}
if (registerForm) {
  registerForm.addEventListener("submit", handleRegisterSubmit);
}

if (blessingBtn) {
  blessingBtn.addEventListener("click", attemptBlessingPurchase);
  updateBlessingUI();
}

applyAccountSessionUI();
bootstrapAccountSession();

requestAnimationFrame(updateLoop);

function maybeUnlockBlessing() {
  if (!state.blessing) {
    state.blessing = defaultBlessingState();
  }
  if (state.blessing.unlocked) return false;

  if (state.aura >= BLESSING_UNLOCK_THRESHOLD) {
    state.blessing.unlocked = true;
    return true;
  }
  return false;
}

function updateBlessingUI() {
  if (!blessingPanel || !state.blessing) return;

  if (!state.blessing.unlocked) {
    blessingPanel.classList.add("hidden");
    if (blessingStatusEl) {
      blessingStatusEl.textContent = `Accumule ${BLESSING_UNLOCK_THRESHOLD} auras pour débloquer le rituel.`;
    }
    return;
  }

  blessingPanel.classList.remove("hidden");

  if (blessingBtn) {
    blessingBtn.disabled = state.aura < state.blessing.cost;
    blessingBtn.textContent = `Rituel (${formatNumber(
      state.blessing.cost
    )} aura)`;
  }

  if (blessingStatusEl) {
    blessingStatusEl.textContent = getBlessingStatusText();
  }
}

function getBlessingStatusText() {
  if (!state.blessing?.unlocked) {
    return `Accumule ${BLESSING_UNLOCK_THRESHOLD} auras pour débloquer le rituel.`;
  }

  const outcome = state.blessing.lastOutcome;
  if (!outcome) {
    return "Les esprits attendent ton offrande.";
  }

  if (outcome.type === "reward") {
    const bonusPercent = Math.round(outcome.bonus * 100);
    const totalPercent = Math.round((state.blessing.rateBonus || 0) * 100);
    return `${outcome.name} booste ta production : +${bonusPercent}% aura/s (bonus total +${totalPercent}% aura/s).`;
  }

  if (outcome.type === "none") {
    return "Les esprits restent silencieux... aucune bénédiction.";
  }

  return "Les esprits attendent ton offrande.";
}

function attemptBlessingPurchase() {
  if (!state.blessing?.unlocked) return;
  const cost = state.blessing.cost;
  if (state.aura < cost) return;

  state.aura -= cost;
  state.blessing.purchaseCount += 1;
  state.blessing.cost = Number(
    (state.blessing.cost * BLESSING_COST_MULTIPLIER).toFixed(2)
  );

  const reward = rollBlessingReward();
  if (reward) {
    state.blessing.rateBonus = Number(
      (state.blessing.rateBonus + reward.bonus).toFixed(4)
    );
    state.blessing.lastOutcome = {
      type: "reward",
      id: reward.id,
      name: reward.name,
      bonus: reward.bonus,
    };
  } else {
    state.blessing.lastOutcome = { type: "none" };
  }

  refreshUI(undefined, true);
}

function rollBlessingReward() {
  const roll = Math.random();
  let cumulative = 0;
  for (const reward of BLESSING_REWARDS) {
    cumulative += reward.chance;
    if (roll < cumulative) {
      return reward;
    }
  }
  return null;
}


