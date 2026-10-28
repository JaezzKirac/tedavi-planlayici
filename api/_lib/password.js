import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

// biçim: scrypt$<tuz>$<hash> (base64url)
export function hashPassword(password) {
  const salt = randomBytes(16);
  return `scrypt$${salt.toString("base64url")}$${scryptSync(password, salt, 32).toString("base64url")}`;
}

const DUMMY = hashPassword("timing-equaliser");

/** Şifreyi doğrular; kullanıcı yoksa da aynı sürede çalışır (kullanıcı adı tahmini zorlaşsın) */
export function verifyPassword(password, stored) {
  const [kind, salt, hash] = (stored || DUMMY).split("$");
  if (kind !== "scrypt" || !salt || !hash) return false;
  const want = Buffer.from(hash, "base64url");
  const got = scryptSync(String(password), Buffer.from(salt, "base64url"), want.length);
  return timingSafeEqual(got, want) && !!stored;
}
