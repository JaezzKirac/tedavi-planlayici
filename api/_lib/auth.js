// İmzalı oturum çerezi (HttpOnly). Sunucu tarafında oturum tablosu gerekmez.
import { createHmac, timingSafeEqual } from "node:crypto";
import { fail } from "./http.js";
import { findUser, publicUser } from "./users.js";

const COOKIE = "session";
const MAX_AGE = 7 * 24 * 3600; // saniye

function secret() {
  const s = process.env.AUTH_SECRET;
  if (s && s.length >= 32) return s;
  if (process.env.VERCEL || process.env.NODE_ENV === "production") throw fail(500, "AUTH_SECRET is not configured on the server");
  return "local-development-only-secret-not-for-production";
}

const sig = (data) => createHmac("sha256", secret()).update(data).digest("base64url");

function readToken(token) {
  const [data, mac] = String(token || "").split(".");
  if (!data || !mac) return null;
  const a = Buffer.from(sig(data)), b = Buffer.from(mac);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const p = JSON.parse(Buffer.from(data, "base64url").toString("utf8"));
    return p.exp > Date.now() / 1000 ? p : null;
  } catch { return null; }
}

function cookie(req, value, maxAge) {
  const secure = process.env.VERCEL || req.headers["x-forwarded-proto"] === "https";
  return `${COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure ? "; Secure" : ""}`;
}

export function startSession(req, res, user) {
  const data = Buffer.from(JSON.stringify({ u: user.id, exp: Math.floor(Date.now() / 1000) + MAX_AGE })).toString("base64url");
  res.setHeader("Set-Cookie", cookie(req, `${data}.${sig(data)}`, MAX_AGE));
}

export const endSession = (req, res) => res.setHeader("Set-Cookie", cookie(req, "", 0));

export function currentUser(req) {
  const raw = (req.headers.cookie || "").split(/;\s*/).find((c) => c.startsWith(COOKIE + "="));
  const p = raw && readToken(raw.slice(COOKIE.length + 1));
  return p ? publicUser(findUser(p.u)) : null;
}

export function requireUser(req) {
  const u = currentUser(req);
  if (!u) throw fail(401, "Please sign in");
  return u;
}
