// Vercel fonksiyonları ve yerel geliştirme sunucusu için ortak istek / yanıt yardımcıları

const MAX_BODY = 100 * 1024;

export const fail = (status, message) => Object.assign(new Error(message), { status, expose: true });

export async function readJson(req) {
  if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) return req.body;
  let raw = typeof req.body === "string" ? req.body : "";
  if (!raw) {
    const chunks = [];
    let size = 0;
    for await (const c of req) {
      size += c.length;
      if (size > MAX_BODY) throw fail(413, "Request too large");
      chunks.push(c);
    }
    raw = Buffer.concat(chunks).toString("utf8");
  }
  try { return raw ? JSON.parse(raw) : {}; } catch { throw fail(400, "Invalid JSON"); }
}

export function send(res, status, data, headers = {}) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
  res.end(JSON.stringify(data));
}

/** Hataları JSON yanıta çevirir; beklenmeyen hataların ayrıntısı istemciye gönderilmez */
export const handle = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (e) {
    if (!e.expose) console.error(e);
    send(res, e.status || 500, { error: e.expose ? e.message : "Server error" });
  }
};

export const query = (req) => new URL(req.url, "http://local").searchParams;
