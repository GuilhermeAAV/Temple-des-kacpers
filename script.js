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

const MANUAL_GAIN = 0.05;
const STORAGE_KEY = "kacperTempleState";
const LOCAL_LEADERBOARD_KEY = "kacperTempleLeaderboardCache";
const LEADERBOARD_DISPLAY_LIMIT = 8;
const API_BASE_URL =
  window.KACPER_API_URL || window.TEMPLE_API_URL || "http://localhost:8787";
const API_TIMEOUT_MS = 4000;
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
    description: "Ca chemise éclaire nos soirées",
    production: 7.5,
    cost: 1000,
    owned: 0,
  },
  {
    id: "daily",
    name: "Daily Kacper",
    description: "Les aventures de daily kacper ne font que commencer",
    production: 250,
    cost: 75000,
    owned: 0,
  },
];

const formatNumber = (value) =>
  new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: value < 10 ? 2 : 1,
    maximumFractionDigits: value < 10 ? 2 : 1,
  }).format(value);

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

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    return {
      aura: Number(parsed.aura) || 0,
      playerName: parsed.playerName || "",
      kacpers: cloneBaseKacpers(parsed.kacpers || []),
      blessing: {
        ...defaultBlessingState(),
        ...(parsed.blessing || {}),
        unlocked: Boolean(parsed.blessing?.unlocked),
        cost:
          typeof parsed.blessing?.cost === "number" &&
          parsed.blessing.cost > 0
            ? parsed.blessing.cost
            : BLESSING_INITIAL_COST,
        purchaseCount: Number(parsed.blessing?.purchaseCount) || 0,
        rateBonus: Number(parsed.blessing?.rateBonus) || 0,
        lastOutcome: parsed.blessing?.lastOutcome || null,
      },
    };
  } catch (error) {
    console.warn("Impossible de charger la sauvegarde :", error);
    return defaultState();
  }
}

function saveState(currentState) {
  try {
    const payload = {
      aura: currentState.aura,
      playerName: currentState.playerName,
      kacpers: currentState.kacpers.map(({ id, cost, owned }) => ({
        id,
        cost,
        owned,
      })),
      blessing: {
        unlocked: Boolean(currentState.blessing?.unlocked),
        cost:
          typeof currentState.blessing?.cost === "number"
            ? currentState.blessing.cost
            : BLESSING_INITIAL_COST,
        purchaseCount: Number(currentState.blessing?.purchaseCount) || 0,
        rateBonus: Number(currentState.blessing?.rateBonus) || 0,
        lastOutcome: currentState.blessing?.lastOutcome || null,
      },
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (error) {
    console.warn("Impossible d'enregistrer la sauvegarde :", error);
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

function persistState(force = false) {
  const now = typeof performance !== "undefined" ? performance.now() : Date.now();
  if (!force && now - lastPersistTime < 1000) return;
  lastPersistTime = now;
  saveState(state);
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

meditateBtn.addEventListener("click", () => {
  state.aura += MANUAL_GAIN;
  refreshUI(undefined, true);
});

pseudoForm.addEventListener("submit", handlePseudoSubmit);
changePseudoBtn.addEventListener("click", () => {
  openPseudoDialog(state.playerName);
});

if (blessingBtn) {
  blessingBtn.addEventListener("click", attemptBlessingPurchase);
  updateBlessingUI();
}

if (!state.playerName) {
  openPseudoDialog("");
} else {
  maybeSyncLeaderboard(true);
}

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
