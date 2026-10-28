// Hasta planını linkin içine yazar / linkten okur. Sunucu gerekmez.
import { sortedKeys, hasE, hasG, hasI, hasC, fixTx } from "../data/teeth.js";

const b64e = (str) => btoa(unescape(encodeURIComponent(str))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const b64d = (str) => { str = str.replace(/-/g, "+").replace(/_/g, "/"); while (str.length % 4) str += "="; return decodeURIComponent(escape(atob(str))); };

export const initials = (nm) => nm.trim().split(/\s+/).map((w) => (w ? w[0].toLocaleUpperCase("en") + "." : "")).join(" ");

export function encodePlan(patient, plan, useInitials) {
  const p = sortedKeys(plan).map((n) => n + (hasE(plan, n) ? "e" : "") + (hasG(plan, n) ? "g" : "") + (hasI(plan, n) ? "i" : "") + (hasC(plan, n) ? "c" : "")).join(".");
  return b64e(JSON.stringify({ n: useInitials ? initials(patient.name) : patient.name, d: patient.date, h: patient.doc, p }));
}

export function decodePlan(str) {
  const o = JSON.parse(b64d(str));
  const patient = { name: String(o.n || "").slice(0, 80), date: String(o.d || "").slice(0, 10), doc: String(o.h || "").slice(0, 80) };
  const plan = {};
  String(o.p || "").split(".").forEach((x) => {
    // eski linkler (e/g harfi olmadan) da okunur
    const m = x.match(/^([1-4][1-8])(e?)(g?)(i?)(c?)$/);
    if (!m || !(m[2] || m[3] || m[4] || m[5])) return;
    const cur = { ext: m[2] ? 1 : 0, grf: m[3] ? 1 : 0, imp: m[4] ? 1 : 0, crw: m[5] ? 1 : 0 };
    fixTx(cur);
    plan[+m[1]] = cur;
  });
  return { patient, plan };
}

export function readPlanFromUrl() {
  let q = null;
  try { q = new URLSearchParams(window.location.search).get("p"); } catch { /* yok */ }
  if (!q && window.location.hash.indexOf("#p=") === 0) q = window.location.hash.slice(3);
  if (!q) return null;
  try { return decodePlan(q); } catch { return { patient: null, plan: {} }; }
}

// #p= kullanılır: adres çubuğundaki # sonrası sunucuya gönderilmez, hasta verisi sunucu loglarına düşmez.
// Eski ?p= linkleri readPlanFromUrl ile açılmaya devam eder.
export const patientLink = (code) => `${window.location.origin}${window.location.pathname}#p=${code}`;
