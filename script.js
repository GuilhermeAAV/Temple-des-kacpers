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

const MANUAL_GAIN = 0.01;
const STORAGE_KEY = "kacperTempleState";
const LEADERBOARD_KEY = "kacperTempleLeaderboard";
const LEADERBOARD_LIMIT = 8;
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
];

const formatNumber = (value) =>
  new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: value < 10 ? 2 : 1,
    maximumFractionDigits: value < 10 ? 2 : 1,
  }).format(value);

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
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (error) {
    console.warn("Impossible d'enregistrer la sauvegarde :", error);
  }
}

function loadLeaderboard() {
  try {
    const raw = localStorage.getItem(LEADERBOARD_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry) => ({
        name: entry.name || "Anonyme",
        aura: Number(entry.aura) || 0,
      }))
      .slice(0, LEADERBOARD_LIMIT);
  } catch (error) {
    console.warn("Impossible de charger le leaderboard :", error);
    return [];
  }
}

function saveLeaderboard(list) {
  try {
    localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(list));
  } catch (error) {
    console.warn("Impossible d'enregistrer le leaderboard :", error);
  }
}

let state = loadState();
const elementsById = new Map();
let leaderboard = loadLeaderboard();
let lastPersistTime = 0;
let lastLeaderboardSyncTime = 0;

function renderLeaderboard() {
  if (!leaderboardListEl) return;
  leaderboardListEl.innerHTML = "";

  if (!leaderboard.length) {
    const emptyItem = document.createElement("li");
    emptyItem.className = "empty";
    emptyItem.textContent = "Aucun gardien encore.";
    leaderboardListEl.appendChild(emptyItem);
    return;
  }

  const fragment = document.createDocumentFragment();
  leaderboard.forEach((entry, index) => {
    const li = document.createElement("li");
    if (entry.name === state.playerName) {
      li.classList.add("active");
    }

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

function syncLeaderboard(force = false) {
  if (!state.playerName) return;
  const roundedAura = Number(state.aura.toFixed(2));
  let changed = false;

  const existing = leaderboard.find((entry) => entry.name === state.playerName);
  if (existing) {
    if (roundedAura > existing.aura) {
      existing.aura = roundedAura;
      changed = true;
    }
  } else if (force || roundedAura > 0) {
    leaderboard.push({ name: state.playerName, aura: roundedAura });
    changed = true;
  }

  if (changed) {
    leaderboard.sort((a, b) => b.aura - a.aura);
    leaderboard = leaderboard.slice(0, LEADERBOARD_LIMIT);
    saveLeaderboard(leaderboard);
  }

  renderLeaderboard();
}

function maybeSyncLeaderboard(force = false) {
  if (!state.playerName) {
    if (force) renderLeaderboard();
    return;
  }

  const now = typeof performance !== "undefined" ? performance.now() : Date.now();
  if (!force && now - lastLeaderboardSyncTime < 1500) return;
  lastLeaderboardSyncTime = now;
  syncLeaderboard(force);
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
  return state.kacpers.reduce(
    (total, { production, owned }) => total + production * owned,
    0
  );
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

function refreshUI(rate = getAuraRate(), forcePersist = false) {
  auraCountEl.textContent = formatNumber(state.aura);
  auraRateEl.textContent = formatNumber(rate);

  state.kacpers.forEach((kacper) => {
    const elements = elementsById.get(kacper.id);
    if (!elements) return;
    elements.button.disabled = state.aura < kacper.cost;
  });

  persistState(forcePersist);
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
  syncLeaderboard(true);
}

initShop();
renderLeaderboard();

meditateBtn.addEventListener("click", () => {
  state.aura += MANUAL_GAIN;
  refreshUI(undefined, true);
});

pseudoForm.addEventListener("submit", handlePseudoSubmit);
changePseudoBtn.addEventListener("click", () => {
  openPseudoDialog(state.playerName);
});

if (!state.playerName) {
  openPseudoDialog("");
} else {
  maybeSyncLeaderboard(true);
}

requestAnimationFrame(updateLoop);
