const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { URL } = require("url");

const PORT = process.env.PORT || 8080;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, process.env.DATA_FILE || "leaderboard.json");
const ACCOUNTS_FILE = path.join(
  DATA_DIR,
  process.env.ACCOUNTS_FILE || "accounts.json"
);
const MAX_ENTRIES = 12;
const DEFAULT_BLESSING_COST = 100;

fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, "[]", "utf8");
}
if (!fs.existsSync(ACCOUNTS_FILE)) {
  fs.writeFileSync(ACCOUNTS_FILE, "[]", "utf8");
}

function readLeaderboard() {
  try {
    const raw = fs.readFileSync(DATA_FILE, "utf8");
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed;
    }
  } catch (error) {
    console.warn("Failed to read leaderboard:", error);
  }
  return [];
}

function writeLeaderboard(entries) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(entries, null, 2), "utf8");
  } catch (error) {
    console.error("Failed to write leaderboard:", error);
  }
}

function readAccounts() {
  try {
    const raw = fs.readFileSync(ACCOUNTS_FILE, "utf8");
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed;
    }
  } catch (error) {
    console.warn("Failed to read accounts:", error);
  }
  return [];
}

function writeAccounts(accounts) {
  try {
    fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify(accounts, null, 2), "utf8");
  } catch (error) {
    console.error("Failed to write accounts:", error);
  }
}

function sanitizeString(value, maxLength) {
  return value.toString().trim().slice(0, maxLength);
}

function sanitizeName(name) {
  return sanitizeString(name, 32);
}

function sanitizeId(value) {
  return sanitizeString(value, 64);
}

function hashPassword(password, salt) {
  return crypto
    .pbkdf2Sync(password, salt, 100000, 64, "sha512")
    .toString("hex");
}

function generateSalt() {
  return crypto.randomBytes(16).toString("hex");
}

function generateToken() {
  return crypto.randomBytes(32).toString("hex");
}

function findAccountByName(accounts, name) {
  const lookup = name.toLowerCase();
  const index = accounts.findIndex(
    (account) => account.nameLower === lookup || account.name.toLowerCase() === lookup
  );
  return index >= 0 ? { account: accounts[index], index } : { account: null, index: -1 };
}

function findAccountByToken(accounts, token) {
  const index = accounts.findIndex((account) => account.sessionToken === token);
  return index >= 0 ? { account: accounts[index], index } : { account: null, index: -1 };
}

function extractToken(req) {
  const header = req.headers.authorization || req.headers.Authorization;
  if (!header || typeof header !== "string") return null;
  const match = header.match(/^Bearer (.+)$/i);
  if (!match) return null;
  return match[1].trim();
}

function sanitizeKacper(entry) {
  if (!entry || typeof entry !== "object") return null;
  const id = sanitizeId(entry.id || "");
  if (!id) return null;
  const costRaw = Number(entry.cost);
  const ownedRaw = Number(entry.owned);
  return {
    id,
    cost: Number.isFinite(costRaw) && costRaw >= 0 ? costRaw : 0,
    owned: Number.isFinite(ownedRaw) && ownedRaw >= 0 ? Math.floor(ownedRaw) : 0,
  };
}

function sanitizeBlessing(raw = {}) {
  const costRaw = Number(raw.cost);
  const purchaseRaw = Number(raw.purchaseCount);
  const rateRaw = Number(raw.rateBonus);
  const normalized = {
    unlocked: Boolean(raw.unlocked),
    cost: Number.isFinite(costRaw) && costRaw >= 0 ? costRaw : DEFAULT_BLESSING_COST,
    purchaseCount: Number.isFinite(purchaseRaw) && purchaseRaw >= 0 ? Math.floor(purchaseRaw) : 0,
    rateBonus: Number.isFinite(rateRaw) ? rateRaw : 0,
    lastOutcome: null,
  };

  if (raw.lastOutcome && typeof raw.lastOutcome === "object") {
    const outcome = raw.lastOutcome;
    if (outcome.type === "reward") {
      const bonusRaw = Number(outcome.bonus);
      normalized.lastOutcome = {
        type: "reward",
        id: sanitizeId(outcome.id || ""),
        name: sanitizeName(outcome.name || ""),
        bonus: Number.isFinite(bonusRaw) ? bonusRaw : 0,
      };
    } else if (outcome.type === "none") {
      normalized.lastOutcome = { type: "none" };
    }
  }

  return normalized;
}

function sanitizePrayer(raw = {}) {
  const normalized = {
    unlocked: Boolean(raw.unlocked),
    lastReward: null,
    nextAvailableAt: 0,
  };

  if (raw.lastReward && typeof raw.lastReward === "object") {
    const reward = raw.lastReward;
    const ownedRaw = Number(reward.owned);
    normalized.lastReward = {
      id: sanitizeId(reward.id || ""),
      name: sanitizeName(reward.name || ""),
      owned: Number.isFinite(ownedRaw) && ownedRaw >= 0 ? Math.floor(ownedRaw) : 0,
    };
  }

  const nextAvailableAtRaw = Number(raw.nextAvailableAt);
  if (Number.isFinite(nextAvailableAtRaw) && nextAvailableAtRaw >= 0) {
    normalized.nextAvailableAt = Math.floor(nextAvailableAtRaw);
  }

  return normalized;
}

function sanitizeStatePayload(payload = {}, fallbackName = "") {
  const auraRaw = Number(payload.aura);
  const kacpers = Array.isArray(payload.kacpers)
    ? payload.kacpers.map(sanitizeKacper).filter(Boolean)
    : [];
  let playerName = sanitizeName(payload.playerName || "");
  if (!playerName && fallbackName) {
    playerName = sanitizeName(fallbackName);
  }

  return {
    aura: Number.isFinite(auraRaw) && auraRaw >= 0 ? auraRaw : 0,
    playerName,
    kacpers,
    blessing: sanitizeBlessing(payload.blessing || {}),
    prayer: sanitizePrayer(payload.prayer || {}),
  };
}

function ensureAccountState(account) {
  if (account.state && typeof account.state === "object") {
    account.state = sanitizeStatePayload(account.state, account.name);
  } else {
    account.state = sanitizeStatePayload({}, account.name);
  }
  return account.state;
}

function upsertLeaderboardEntry(leaderboard, name, aura, accountId = null) {
  const trimmedName = sanitizeName(name || "");
  if (!trimmedName) return leaderboard;
  const roundedAura = Math.round(Math.max(0, Number(aura) || 0) * 100) / 100;
  const now = new Date().toISOString();

  let targetIndex = -1;
  if (accountId) {
    targetIndex = leaderboard.findIndex((entry) => entry.accountId === accountId);
  }
  if (targetIndex === -1) {
    targetIndex = leaderboard.findIndex(
      (entry) => entry.name.toLowerCase() === trimmedName.toLowerCase()
    );
  }

  if (targetIndex >= 0) {
    const entry = leaderboard[targetIndex];
    if (roundedAura >= entry.aura) {
      entry.aura = roundedAura;
    }
    entry.name = trimmedName;
    entry.updatedAt = now;
    if (accountId) entry.accountId = accountId;
  } else {
    leaderboard.push({
      name: trimmedName,
      aura: roundedAura,
      updatedAt: now,
      ...(accountId ? { accountId } : {}),
    });
  }

  leaderboard.sort((a, b) => b.aura - a.aura);
  if (leaderboard.length > MAX_ENTRIES) {
    leaderboard.splice(MAX_ENTRIES);
  }
  return leaderboard;
}

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(body),
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  });
  res.end(body);
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      try {
        const buffer = Buffer.concat(chunks).toString("utf8");
        const parsed = buffer ? JSON.parse(buffer) : {};
        resolve(parsed);
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

async function handleRequest(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "86400",
    });
    return res.end();
  }

  if (url.pathname === "/auth/register" && req.method === "POST") {
    try {
      const payload = await parseBody(req);
      const name = sanitizeName(payload.name || "");
      const password = (payload.password || "").toString();

      if (!name || name.length < 3) {
        return sendJson(res, 400, { error: "Nom invalide" });
      }
      if (!password || password.length < 6) {
        return sendJson(res, 400, { error: "Mot de passe invalide" });
      }

      const accounts = readAccounts();
      const { account: existing } = findAccountByName(accounts, name);
      if (existing) {
        return sendJson(res, 409, { error: "Ce compte existe deja" });
      }

      const salt = generateSalt();
      const passwordHash = hashPassword(password, salt);
      const token = generateToken();
      const now = new Date().toISOString();
      const state = sanitizeStatePayload({}, name);

      const accountRecord = {
        name,
        nameLower: name.toLowerCase(),
        salt,
        passwordHash,
        sessionToken: token,
        state,
        createdAt: now,
        updatedAt: now,
      };

      accounts.push(accountRecord);
      writeAccounts(accounts);

      const leaderboard = readLeaderboard();
      upsertLeaderboardEntry(
        leaderboard,
        state.playerName || name,
        state.aura,
        accountRecord.nameLower
      );
      writeLeaderboard(leaderboard);

      return sendJson(res, 200, {
        token,
        account: { name: accountRecord.name },
        state: accountRecord.state,
      });
    } catch (error) {
      console.error("Failed to handle POST /auth/register:", error);
      return sendJson(res, 500, { error: "Server error" });
    }
  }

  if (url.pathname === "/auth/login" && req.method === "POST") {
    try {
      const payload = await parseBody(req);
      const name = sanitizeName(payload.name || "");
      const password = (payload.password || "").toString();

      if (!name || !password) {
        return sendJson(res, 400, { error: "Identifiants invalides" });
      }

      const accounts = readAccounts();
      const { account, index } = findAccountByName(accounts, name);
      if (!account) {
        return sendJson(res, 401, { error: "Identifiants invalides" });
      }

      const hashed = hashPassword(password, account.salt);
      if (hashed !== account.passwordHash) {
        return sendJson(res, 401, { error: "Identifiants invalides" });
      }

      const token = generateToken();
      account.sessionToken = token;
      account.nameLower = account.nameLower || account.name.toLowerCase();
      ensureAccountState(account);
      account.updatedAt = new Date().toISOString();
      accounts[index] = account;
      writeAccounts(accounts);

      return sendJson(res, 200, {
        token,
        account: { name: account.name },
        state: account.state,
      });
    } catch (error) {
      console.error("Failed to handle POST /auth/login:", error);
      return sendJson(res, 500, { error: "Server error" });
    }
  }

  if (url.pathname === "/progress" && req.method === "GET") {
    const token = extractToken(req);
    if (!token) {
      return sendJson(res, 401, { error: "Non autorise" });
    }

    const accounts = readAccounts();
    const { account } = findAccountByToken(accounts, token);
    if (!account) {
      return sendJson(res, 401, { error: "Non autorise" });
    }

    const state = ensureAccountState(account);
    return sendJson(res, 200, {
      account: { name: account.name },
      state,
    });
  }

  if (url.pathname === "/progress" && req.method === "POST") {
    const token = extractToken(req);
    if (!token) {
      return sendJson(res, 401, { error: "Non autorise" });
    }

    try {
      const payload = await parseBody(req);
      const accounts = readAccounts();
      const { account, index } = findAccountByToken(accounts, token);
      if (!account) {
        return sendJson(res, 401, { error: "Non autorise" });
      }

      const statePayload =
        payload && typeof payload === "object" ? payload.state || payload : {};
      const state = sanitizeStatePayload(statePayload, account.name);
      account.state = state;
      account.updatedAt = new Date().toISOString();
      account.nameLower = account.nameLower || account.name.toLowerCase();
      accounts[index] = account;
      writeAccounts(accounts);

      const leaderboard = readLeaderboard();
      upsertLeaderboardEntry(
        leaderboard,
        state.playerName || account.name,
        state.aura,
        account.nameLower || account.name.toLowerCase()
      );
      writeLeaderboard(leaderboard);

      return sendJson(res, 200, { state });
    } catch (error) {
      console.error("Failed to handle POST /progress:", error);
      return sendJson(res, 500, { error: "Server error" });
    }
  }

  if (url.pathname === "/leaderboard" && req.method === "GET") {
    const leaderboard = readLeaderboard();
    return sendJson(res, 200, leaderboard);
  }

  if (url.pathname === "/leaderboard" && req.method === "POST") {
    try {
      const payload = await parseBody(req);
      const name = (payload.name || "").toString().trim();
      const aura = Number(payload.aura);
      if (!name || !Number.isFinite(aura) || aura < 0) {
        return sendJson(res, 400, { error: "Invalid payload" });
      }
      const leaderboard = readLeaderboard();
      upsertLeaderboardEntry(leaderboard, name, aura);
      writeLeaderboard(leaderboard);
      return sendJson(res, 200, leaderboard);
    } catch (error) {
      console.error("Failed to handle POST /leaderboard:", error);
      return sendJson(res, 500, { error: "Server error" });
    }
  }

  sendJson(res, 404, { error: "Not found" });
}

const server = http.createServer((req, res) => {
  handleRequest(req, res);
});

server.listen(PORT, () => {
  console.log(`Kacper leaderboard server listening on http://localhost:${PORT}`);
});

