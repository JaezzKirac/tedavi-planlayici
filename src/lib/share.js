// Hasta planını linkin içine yazar / linkten okur. Sunucu gerekmez.
import { sortedKeys, fixTx, FLAGS, emptyTx, legacyMouth } from "../data/teeth.js";

const b64e = (str) => btoa(unescape(encodeURIComponent(str))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const b64d = (str) => { str = str.replace(/-/g, "+").replace(/_/g, "/"); while (str.length % 4) str += "="; return decodeURIComponent(escape(atob(str))); };

export const initials = (nm) => nm.trim().split(/\s+/).map((w) => (w ? w[0].toLocaleUpperCase("en") + "." : "")).join(" ");

export function encodePlan(patient, plan, useInitials, fmr = null, mouth = {}) {
  const p = sortedKeys(plan).map((n) => n + FLAGS.filter(([k]) => plan[n][k]).map(([, c]) => c).join("")).join(".");
  // m: ağzın bugünkü hâli, örn. "18m.36c.46i"
  const m = sortedKeys(mouth).map((n) => n + mouth[n]).join(".");
  const f = fmr ? `${fmr.type}${fmr.arches}${fmr.pty ? "p" : ""}${fmr.zyg ? "z" : ""}` : "";
  return b64e(JSON.stringify({ n: useInitials ? initials(patient.name) : patient.name, d: patient.date, h: patient.doc, p, m, ...(f ? { f } : {}) }));
}

export function decodePlan(str) {
  const o = JSON.parse(b64d(str));
  const patient = { name: String(o.n || "").slice(0, 80), date: String(o.d || "").slice(0, 10), doc: String(o.h || "").slice(0, 80) };
  const raw = {};
  // her diş: FDI numarası + işlem harfleri (sıra önemli değil)
  String(o.p || "").split(".").forEach((x) => {
    const m = x.match(/^([1-4][1-8])([a-z]*)$/);
    if (!m || !m[2]) return;
    const cur = emptyTx();
    for (const ch of m[2]) { const fl = FLAGS.find(([, c]) => c === ch); if (fl) cur[fl[0]] = 1; }
    if (FLAGS.some(([k]) => cur[k])) raw[+m[1]] = cur;
  });
  // f: tam ağız restorasyonu, örn. "4ULpz" = All-on-4 iki çene, pterygoid + zygomatic
  const fm = String(o.f || "").match(/^([468])(U|L|UL)(p?)(z?)$/);
  const fmr = fm ? { type: +fm[1], arches: fm[2], pty: !!fm[3], zyg: !!fm[4] } : null;
  // m yoksa eski link: ağız plandan tahmin edilir
  let mouth = {};
  if (typeof o.m === "string") String(o.m).split(".").forEach((x) => { const m = x.match(/^([1-4][1-8])([mci])$/); if (m) mouth[+m[1]] = m[2]; });
  else mouth = legacyMouth(raw, fmr);
  const plan = {};
  sortedKeys(raw).forEach((n) => { const cur = raw[n]; if (!cur.own) fixTx(cur, false, mouth[n] || ""); plan[n] = cur; });
  return { patient, plan, fmr, mouth };
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
