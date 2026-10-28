// Tedavi planı kayıtları.
// Üretimde Upstash Redis (bağlantı bilgileri api/_lib/secrets.js içinde ya da ortam değişkenlerinde).
// Yerel geliştirmede Redis tanımlı değilse .data/db.json dosyasına yazar.
import { promises as fs } from "node:fs";
import path from "node:path";
import { fail } from "./http.js";
import { env } from "./secrets.js";

const LIMIT = 500;

function redisConf() {
  const url = env("KV_REST_API_URL") || env("UPSTASH_REDIS_REST_URL");
  const token = env("KV_REST_API_TOKEN") || env("UPSTASH_REDIS_REST_TOKEN");
  return url && token ? { url, token } : null;
}

async function redis(cmds) {
  const { url, token } = redisConf();
  const r = await fetch(`${url}/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(cmds),
  });
  if (!r.ok) throw new Error(`Redis HTTP ${r.status}`);
  const out = await r.json();
  for (const x of out) if (x.error) throw new Error(`Redis: ${x.error}`);
  return out.map((x) => x.result);
}

const redisStore = {
  async save(rec) {
    await redis([
      ["SET", `plan:${rec.id}`, JSON.stringify(rec)],
      ["ZADD", "plans", rec.createdAt, rec.id],
      ["ZADD", `plans:u:${rec.owner}`, rec.createdAt, rec.id],
    ]);
  },
  async get(id) {
    const [v] = await redis([["GET", `plan:${id}`]]);
    return v ? JSON.parse(v) : null;
  },
  async list(owner) {
    const [ids] = await redis([["ZREVRANGE", owner ? `plans:u:${owner}` : "plans", 0, LIMIT - 1]]);
    if (!ids.length) return [];
    const [vals] = await redis([["MGET", ...ids.map((id) => `plan:${id}`)]]);
    return vals.filter(Boolean).map((v) => JSON.parse(v));
  },
};

// yerel dosya deposu (yalnız geliştirme)
const FILE = path.join(process.cwd(), ".data", "db.json");
let queue = Promise.resolve();
const readDb = async () => { try { return JSON.parse(await fs.readFile(FILE, "utf8")); } catch { return { plans: {} }; } };
const fileStore = {
  save(rec) {
    queue = queue.then(async () => {
      const db = await readDb();
      db.plans[rec.id] = rec;
      await fs.mkdir(path.dirname(FILE), { recursive: true });
      await fs.writeFile(FILE, JSON.stringify(db, null, 2));
    });
    return queue;
  },
  async get(id) { await queue; return (await readDb()).plans[id] || null; },
  async list(owner) {
    await queue;
    return Object.values((await readDb()).plans)
      .filter((p) => !owner || p.owner === owner)
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, LIMIT);
  },
};

export function store() {
  if (redisConf()) return redisStore;
  if (process.env.VERCEL) throw fail(500, "Storage is not configured. Add the Upstash Redis URL and token to api/_lib/secrets.js.");
  return fileStore;
}
