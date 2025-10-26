const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const PORT = process.env.PORT || 8080;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, process.env.DATA_FILE || "leaderboard.json");
const MAX_ENTRIES = 12;

fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, "[]", "utf8");
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

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(body),
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
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
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
    });
    return res.end();
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
      const existing = leaderboard.find(
        (entry) => entry.name.toLowerCase() === name.toLowerCase()
      );
      const roundedAura = Math.round(aura * 100) / 100;
      const now = new Date().toISOString();
      if (existing) {
        if (roundedAura > existing.aura) {
          existing.aura = roundedAura;
          existing.updatedAt = now;
        }
      } else {
        leaderboard.push({ name, aura: roundedAura, updatedAt: now });
      }
      leaderboard.sort((a, b) => b.aura - a.aura);
      leaderboard.splice(MAX_ENTRIES);
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
