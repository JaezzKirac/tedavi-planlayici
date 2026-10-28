import { sortedKeys, hasE, hasG, hasI, hasC } from "./teeth.js";

export const CHINFO = {
  scan: { t: "Muayene ve 3D tomografi", d: "1. gün · 30–45 dk", p: "Ağız taranır, dental tomografi ile kemik hacmi, sinir ve sinüs konumu ölçülür.", cal: "1. gün" },
  ext: { t: "Dişin çekilmesi", d: "1 seans · diş başına 15–30 dk", p: "Lokal anestezi altında diş, çevresindeki kemik korunarak nazikçe yerinden oynatılır ve çekilir. İşlem sırasında ağrı hissedilmez.", pImp: "Kemik durumuna göre implant aynı seansta ya da birkaç haftalık iyileşmenin ardından yerleştirilir.", cal: "Çekim" },
  graft: { t: "Kemik grefti uygulaması", d: "1 seans · bölge başına 30–60 dk", p: "İmplantın sağlam oturması için yetersiz olan kemik, kemik grefti (kemik tozu) ile tamamlanır. Greftin üzeri koruyucu bir zarla (membran) örtülür ve dikiş atılır. Lokal anestezi altında yapılır.", pExt: "Çekim boşluğu aynı seansta doldurulduğu için kemiğin erimesi de önlenir.", cal: "Greft" },
  gheal: { t: "Greftin kemikleşmesi", d: "4–6 ay", p: "Greft zamanla sizin kendi kemiğinize dönüşür. Bu sürede normal hayatınıza devam edersiniz; gerekirse geçici diş kullanılır.", cal: "Kemikleşme" },
  surgery: { t: "İmplantın yerleştirilmesi", d: "1. hafta · implant başına ~30 dk", p: "Lokal anestezi altında önce kemikte yuva açılır, ardından titanyum implant kemiğe vidalanır. İşlem sırasında ağrı hissedilmez.", cal: "1. hafta" },
  heal: { t: "İyileşme (kemikle kaynaşma)", d: "2–4 ay", p: "İmplantlar kemikle kaynaşır. Bu sürede normal hayatınıza devam edersiniz; gerekirse geçici diş kullanılır.", cal: "İyileşme" },
  prep: { t: "Dişin kron için hazırlanması", d: "1 seans · diş başına 30–45 dk", p: "Çürük temizlenir, dişin her yüzeyinden ince bir tabaka alınarak kronun oturacağı form verilir.", cal: "Hazırlık" },
  abut: { t: "Dayanakların (abutment) takılması", d: "1 seans · 20–30 dk", p: "İyileşen implantların üzerine kronu taşıyacak dayanak ya da dişeti şekillendirici başlık vidalanır.", cal: "3. ay" },
  lab: { t: "Dijital ölçü ve laboratuvar", d: "5–7 iş günü", p: "Ağız içi tarayıcı ile ölçü alınır, renk seçilir. Zirkonyum kronlar laboratuvarda üretilir.", cal: "Laboratuvar" },
  fit: { t: "Kronun takılması", d: "1 seans · 30–45 dk", p: "Zirkonyum kron yerine oturtulur, ısırma kontrol edilir.", cal: "Son seans" },
  done: { t: "Tedavi tamamlandı", d: "Kontrol: 6 ayda bir", p: "Yeni dişleriniz kullanıma hazır. Düzenli fırçalama ve 6 aylık kontrollerle uzun yıllar kullanılır.", cal: "✓ Tamamlandı" },
};

/**
 * Plandan animasyon zaman çizelgesi üretir.
 * TL: olaylar (start/dur ms), CH: bölümler, TE: diş başına olay zamanları
 */
export function buildTimeline(plan) {
  const keys = sortedKeys(plan);
  const exts = keys.filter((n) => hasE(plan, n));
  const grfs = keys.filter((n) => hasG(plan, n));
  const imps = keys.filter((n) => hasI(plan, n));
  const crws = keys.filter((n) => hasC(plan, n));
  const preps = keys.filter((n) => hasC(plan, n) && !hasI(plan, n));
  const TL = [];
  const add = (ch, dur, o = {}) => TL.push({ ch, dur, ...o });
  add("scan", 4200, { scan: 1 });
  exts.forEach((n) => add("ext", 5200, { focus: n, set: [n] }));
  grfs.forEach((n) => add("graft", 5600, { focus: n, set: [n] }));
  if (grfs.length) add("gheal", 5000, { set: grfs });
  imps.forEach((n) => add("surgery", 6500, { focus: n, set: [n] }));
  if (imps.length) add("heal", 5000, { set: imps });
  preps.forEach((n) => add("prep", 5000, { focus: n, set: [n] }));
  if (imps.length) add("abut", 4000, { set: imps });
  if (crws.length) add("lab", 3800, { scan: 1 });
  crws.forEach((n) => add("fit", 3400, { focus: n, set: [n] }));
  add("done", 6000, { done: 1 });

  let t = 0;
  TL.forEach((e) => { e.start = t; t += e.dur; });
  const TOTAL = t;
  const TE = {};
  keys.forEach((n) => (TE[n] = {}));
  TL.forEach((e) => (e.set || []).forEach((n) => (TE[n][e.ch] = { s: e.start, d: e.dur })));
  const CH = [];
  TL.forEach((e) => { if (!CH.length || CH[CH.length - 1].ch !== e.ch) CH.push({ ch: e.ch, start: e.start }); });
  return { TL, CH, TE, TOTAL, keys, exts, grfs, imps, crws };
}

export const eventIndexAt = (TL, t) => { const i = TL.findIndex((e) => t < e.start + e.dur); return i < 0 ? TL.length - 1 : i; };
export const chapterIndexAt = (CH, e) => { let ci = 0; CH.forEach((c, i) => { if (c.start <= e.start) ci = i; }); return ci; };
export const fmtTime = (ms) => { const x = Math.round(ms / 1000); return Math.floor(x / 60) + ":" + String(x % 60).padStart(2, "0"); };
