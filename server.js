const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

const PORT = Number(process.env.PORT) || 8080;
const ROOT = __dirname;
const DATA_FILE = path.join(ROOT, "inventory-data.json");
const DATABASE_URL = process.env.DATABASE_URL;
const APP_PASSWORD = process.env.APP_PASSWORD;
let pool;

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".csv": "text/csv; charset=utf-8"
};

function defaultState() {
  return { items: [], history: [], revision: 0 };
}

function getPool() {
  if (!DATABASE_URL) return null;
  if (!pool) {
    const { Pool } = require("pg");
    pool = new Pool({
      connectionString: DATABASE_URL,
      ssl: DATABASE_URL.includes("localhost") ? false : { rejectUnauthorized: false }
    });
  }
  return pool;
}

async function prepareDatabase() {
  const database = getPool();
  if (!database) return;
  await database.query(`
    CREATE TABLE IF NOT EXISTS inventory_state (
      id INTEGER PRIMARY KEY,
      data JSONB NOT NULL,
      revision INTEGER NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await database.query(
    `INSERT INTO inventory_state (id, data, revision)
     VALUES (1, $1, 0)
     ON CONFLICT (id) DO NOTHING`,
    [defaultState()]
  );
}

async function readState() {
  const database = getPool();
  if (database) {
    await prepareDatabase();
    const result = await database.query(
      "SELECT data, revision FROM inventory_state WHERE id = 1"
    );
    const row = result.rows[0];
    return {
      items: Array.isArray(row.data.items) ? row.data.items : [],
      history: Array.isArray(row.data.history) ? row.data.history : [],
      revision: Number(row.revision) || 0
    };
  }

  if (!fs.existsSync(DATA_FILE)) return defaultState();
  try {
    const data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    return {
      items: Array.isArray(data.items) ? data.items : [],
      history: Array.isArray(data.history) ? data.history : [],
      revision: Number.isInteger(data.revision) ? data.revision : 0
    };
  } catch {
    return defaultState();
  }
}

async function writeState(state, revision, expectedRevision) {
  const safeState = {
    items: Array.isArray(state.items) ? state.items : [],
    history: Array.isArray(state.history) ? state.history : [],
    revision
  };

  const database = getPool();
  if (database) {
    await prepareDatabase();
    const result = await database.query(
      `UPDATE inventory_state
       SET data = $1, revision = $2, updated_at = NOW()
       WHERE id = 1 AND revision = $3`,
      [safeState, revision, expectedRevision]
    );
    return result.rowCount === 1;
  }

  fs.writeFileSync(DATA_FILE, JSON.stringify(safeState, null, 2), "utf8");
  return true;
}

function sendJson(response, status, payload) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  response.end(JSON.stringify(payload));
}

function receiveJson(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 10 * 1024 * 1024) {
        reject(new Error("request too large"));
        request.destroy();
      }
    });
    request.on("end", () => {
      try {
        resolve(JSON.parse(body || "{}"));
      } catch (error) {
        reject(error);
      }
    });
    request.on("error", reject);
  });
}

function isAuthorized(request) {
  if (!APP_PASSWORD) return true;
  const header = request.headers.authorization || "";
  if (!header.startsWith("Basic ")) return false;
  const decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
  const separator = decoded.indexOf(":");
  return separator >= 0 &&
    decoded.slice(0, separator) === "inventory" &&
    decoded.slice(separator + 1) === APP_PASSWORD;
}

function requestLogin(response) {
  response.writeHead(401, {
    "WWW-Authenticate": 'Basic realm="Emergency Inventory"',
    "Content-Type": "text/plain; charset=utf-8"
  });
  response.end("ログインが必要です");
}

function serveFile(request, response) {
  const requestUrl = new URL(request.url, `http://${request.headers.host}`);
  const pathname = decodeURIComponent(requestUrl.pathname);
  const filePath = path.normalize(path.join(ROOT, pathname === "/" ? "index.html" : pathname));

  if (!filePath.startsWith(ROOT) || filePath === DATA_FILE) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      response.writeHead(404);
      response.end("Not Found");
      return;
    }

    response.writeHead(200, {
      "Content-Type": MIME_TYPES[path.extname(filePath)] || "application/octet-stream",
      "Cache-Control": "no-store"
    });
    response.end(content);
  });
}

const server = http.createServer(async (request, response) => {
  if (!isAuthorized(request)) {
    requestLogin(response);
    return;
  }

  if (request.url === "/api/state" && request.method === "GET") {
    sendJson(response, 200, await readState());
    return;
  }

  if (request.url === "/api/state" && request.method === "POST") {
    try {
      const state = await receiveJson(request);
      const current = await readState();
      if (Number(state.revision) !== current.revision) {
        sendJson(response, 409, current);
        return;
      }

      const revision = current.revision + 1;
      const saved = await writeState(state, revision, current.revision);
      if (!saved) {
        sendJson(response, 409, await readState());
        return;
      }
      sendJson(response, 200, { ok: true, revision });
    } catch {
      sendJson(response, 400, { ok: false, message: "保存できませんでした" });
    }
    return;
  }

  if (request.method === "GET") {
    serveFile(request, response);
    return;
  }

  response.writeHead(405);
  response.end("Method Not Allowed");
});

server.listen(PORT, "0.0.0.0", () => {
  const addresses = Object.values(os.networkInterfaces())
    .flat()
    .filter((entry) => entry && entry.family === "IPv4" && !entry.internal)
    .map((entry) => `http://${entry.address}:${PORT}`);

  console.log("救急物品 在庫管理サーバーを起動しました。");
  console.log(`このパソコン: http://localhost:${PORT}`);
  addresses.forEach((address) => console.log(`他の端末: ${address}`));
  if (DATABASE_URL) console.log("保存先: PostgreSQLデータベース");
  if (APP_PASSWORD) console.log("アクセス保護: 有効");
});
