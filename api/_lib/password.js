import { createHash, timingSafeEqual } from "node:crypto";

const digest = (s) => createHash("sha256").update(String(s)).digest();

/** Şifreyi sabit sürede karşılaştırır; beklenen şifre tanımlı değilse her zaman reddeder */
export function checkPassword(given, expected) {
  return timingSafeEqual(digest(given), digest(expected || "")) && !!expected;
}
