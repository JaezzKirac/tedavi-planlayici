// Hasta planını linkin içine yazar / linkten okur. Sunucu gerekmez.
import { sortedKeys, fixTx, FLAGS, emptyTx } from "../data/teeth.js";

const b64e = (str) => btoa(unescape(encodeURIComponent(str))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const b64d = (str) => { str = str.replace(/-/g, "+").replace(/_/g, "/"); while (str.length % 4) str += "="; return decodeURIComponent(escape(atob(str))); };

export const initials = (nm) => nm.trim().split(/\s+/).map((w) => (w ? w[0].toLocaleUpperCase("en") + "." : "")).join(" ");

export function encodePlan(patient, plan, useInitials, fmr = null) {
  const p = sortedKeys(plan).map((n) => n + FLAGS.filter(([k]) => plan[n][k]).map(([, c]) => c).join("")).join(".");
  return b64e(JSON.stringify({ n: useInitials ? initials(patient.name) : patient.name, d: patient.date, h: patient.doc, p, ...(fmr ? { f: `${fmr.type}${fmr.arches}` } : {}) }));
}

export function decodePlan(str) {
  const o = JSON.parse(b64d(str));
  const patient = { name: String(o.n || "").slice(0, 80), date: String(o.d || "").slice(0, 10), doc: String(o.h || "").slice(0, 80) };
  const plan = {};
  // her diş: FDI numarası + harfler (FLAGS sırasıyla); eski linklerdeki harfler de bu sırada olduğu için okunur
  String(o.p || "").split(".").forEach((x) => {
    const m = x.match(/^([1-4][1-8])([a-z]*)$/);
    if (!m || !m[2]) return;
    const cur = emptyTx();
    for (const ch of m[2]) { const fl = FLAGS.find(([, c]) => c === ch); if (fl) cur[fl[0]] = 1; }
    if (!FLAGS.some(([k]) => cur[k])) return;
    if (!cur.own) fixTx(cur);
    plan[+m[1]] = cur;
  });
  // f: tam ağız restorasyonu, örn. "4UL" = All-on-4 iki çene
  const f = String(o.f || "").match(/^([468])(U|L|UL)$/);
  return { patient, plan, fmr: f ? { type: +f[1], arches: f[2] } : null };
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
