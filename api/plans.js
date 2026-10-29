// Tedavi planı kayıtları.
// GET: personel kendi kayıtlarını, admin hepsini görür.  POST: hasta linki oluşturulunca yeni kayıt.
// PUT ?id=: aynı hastanın linki yeniden oluşturulunca kaydı günceller (sahibi ya da admin).
import { randomUUID } from "node:crypto";
import { handle, readJson, send, fail, query } from "./_lib/http.js";
import { requireUser } from "./_lib/auth.js";
import { store } from "./_lib/store.js";

// diş başına tedavi işaretleri (src/data/teeth.js FLAGS ile aynı)
const TX = ["ext", "grf", "sin", "imp", "crw", "rct", "fil", "ven", "own"];
const str = (v, max) => String(v ?? "").trim().slice(0, max);

function clean(body) {
  const p = body.patient || {};
  const patient = { name: str(p.name, 80), date: /^\d{4}-\d{2}-\d{2}$/.test(p.date) ? p.date : "", doc: str(p.doc, 80) };
  if (!patient.name) throw fail(400, "Patient name is required");
  const plan = {};
  for (const [k, v] of Object.entries(body.plan || {})) {
    if (!/^[1-4][1-8]$/.test(k) || !v || typeof v !== "object") continue;
    const t = Object.fromEntries(TX.map((x) => [x, v[x] ? 1 : 0]));
    if (TX.some((x) => t[x])) plan[k] = t;
  }
  if (!Object.keys(plan).length) throw fail(400, "The plan has no treated teeth");
  const code = String(body.code || "");
  if (!/^[A-Za-z0-9_-]{1,4000}$/.test(code)) throw fail(400, "Invalid link code");
  const f = body.fmr || {};
  const fmr = [4, 6, 8].includes(+f.type) && ["U", "L", "UL"].includes(f.arches) ? { type: +f.type, arches: f.arches } : null;
  return { patient, plan, code, initials: !!body.initials, fmr };
}

export default handle(async (req, res) => {
  const user = requireUser(req);
  const db = store();

  if (req.method === "GET") {
    return send(res, 200, { plans: await db.list(user.role === "admin" ? null : user.id) });
  }
  if (req.method === "POST") {
    const now = Date.now();
    const rec = { id: randomUUID(), owner: user.id, ownerName: user.name, createdAt: now, updatedAt: now, ...clean(await readJson(req)) };
    await db.save(rec);
    return send(res, 201, { plan: rec });
  }
  if (req.method === "PUT") {
    const cur = await db.get(str(query(req).get("id"), 64));
    if (!cur) throw fail(404, "Plan not found");
    if (cur.owner !== user.id && user.role !== "admin") throw fail(403, "You can only change your own plans");
    const rec = { ...cur, ...clean(await readJson(req)), updatedAt: Date.now() };
    await db.save(rec);
    return send(res, 200, { plan: rec });
  }
  res.setHeader("Allow", "GET, POST, PUT");
  throw fail(405, "Method not allowed");
});
