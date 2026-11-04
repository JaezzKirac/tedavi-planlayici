// Diş şeması geometrisi (FDI numaralandırma) ve yardımcılar

export const NAMES = ["central incisor", "lateral incisor", "canine", "first premolar", "second premolar", "first molar", "second molar", "wisdom tooth"];
export const QN = { 1: "Upper right", 2: "Upper left", 3: "Lower left", 4: "Lower right" };

const PHI = [5, 15, 25.5, 35.5, 46, 59, 73, 87];
export const SZ = [[11, 7], [9, 7], [9, 9], [11, 10], [11, 10], [16, 15], [15, 14], [14, 13]];
export const ARCH = { U: { cy: 255, rx: 150, ry: 182 }, L: { cy: 365, rx: 142, ry: 174 } };
export const CX = 260;

function pos(q, k, extra = 0) {
  const up = q <= 2, side = q === 1 || q === 4 ? -1 : 1, A = up ? ARCH.U : ARCH.L, f = (PHI[k - 1] * Math.PI) / 180;
  const rx = A.rx + extra, ry = A.ry + extra;
  const x = CX + side * rx * Math.sin(f), y = up ? A.cy - ry * Math.cos(f) : A.cy + ry * Math.cos(f);
  const dx = side * A.rx * Math.cos(f), dy = up ? A.ry * Math.sin(f) : -A.ry * Math.sin(f);
  return { x, y, a: (Math.atan2(dy, dx) * 180) / Math.PI };
}

// sıra: 18→11, 21→28, 38→31, 41→48
export const TEETH = [];
for (let k = 8; k >= 1; k--) TEETH.push({ q: 1, k });
for (let k = 1; k <= 8; k++) TEETH.push({ q: 2, k });
for (let k = 8; k >= 1; k--) TEETH.push({ q: 3, k });
for (let k = 1; k <= 8; k++) TEETH.push({ q: 4, k });
TEETH.forEach((t) => { t.n = t.q * 10 + t.k; Object.assign(t, pos(t.q, t.k)); t.l = pos(t.q, t.k, 32); });

export const toothName = (n) => `${QN[Math.floor(n / 10)]} ${NAMES[(n % 10) - 1]}`;

// Ağzın bugünkü hâli: mouth = { [fdi]: "m" eksik | "c" kronlu | "i" implantlı }; listede olmayan diş doğal diştir
export const MOUTH_STATES = { "": "Natural tooth", m: "Missing", c: "Existing crown", i: "Existing implant" };

// plan: { [fdi]: { ext, grf, sin, imp, pty, zyg, crw, rpl, rct, fil, ven, own: 0|1 } }
// rpl: mevcut kron sökülüp yenisi takılır; pty / zyg: implantın pterygoid ya da zygomatic türü (imp ile birlikte)
// FLAGS: alan adı, linkteki harf, ekranda görünen ad (linkte bu sırayla yazılır)
export const FLAGS = [
  ["ext", "e", "Extraction"], ["grf", "g", "Bone graft"], ["sin", "s", "Sinus lift"], ["imp", "i", "Implant"],
  ["pty", "p", "Pterygoid implant"], ["zyg", "z", "Zygomatic implant"],
  ["crw", "c", "Crown"], ["rpl", "x", "Crown replacement"], ["rct", "r", "Root canal"], ["fil", "f", "Filling"], ["ven", "v", "Veneer"], ["own", "o", "Own tooth"],
];
const has = (k) => (plan, n) => !!(plan[n] && plan[n][k]);
export const hasE = has("ext"), hasG = has("grf"), hasI = has("imp"), hasC = has("crw");
export const hasR = has("rct"), hasV = has("ven"), hasS = has("sin"), hasF = has("fil"), hasO = has("own"), hasX = has("rpl");
export const hasP = has("pty"), hasZ = has("zyg");
// pterygoid / zygomatic implantta ayrıca "Implant" yazılmaz
export const txLabel = (plan, n) => FLAGS.filter(([k]) => plan[n] && plan[n][k] && !(k === "imp" && (plan[n].pty || plan[n].zyg))).map(([, , label]) => label).join(" + ");
export const emptyTx = () => Object.fromEntries(FLAGS.map(([k]) => [k, 0]));

/** Sinüs lifting yalnızca üst çene arka bölgesinde (küçük ve büyük azılar) yapılır */
export const sinusOk = (n) => n < 30 && n % 10 >= 4;
/** Pterygoid implant üst çenenin en arkasından (2. büyük azı / 20 yaş bölgesi) pterygoid kemiğe açılı girer */
export const ptyOk = (n) => [17, 18, 27, 28].includes(n);
/** Zygomatic implant üst çenede köpek dişi – 1. büyük azı bölgesinden elmacık kemiğine uzanır */
export const zygOk = (n) => n < 30 && n % 10 >= 3 && n % 10 <= 6;

/**
 * Geçersiz kombinasyonları düzeltir. st: dişin bugünkü hâli ("" doğal, "c" kronlu, "m" eksik, "i" implantlı).
 * - çekilen ya da implant konan dişte kanal / dolgu / veneer olmaz; kronlu dişe veneer ve dolgu yapılmaz
 * - çekilen dişe kron, çekim yapılmayan bölgeye greft, sinüs lifting, pterygoid / zygomatic ancak implantla yapılır
 * - ağızda duran dişe (ya da eski implantın yerine) implant konacaksa önce diş / eski implant çıkarılır
 * impOff / extOff: implant ya da çekim az önce kaldırıldıysa geri eklenmez, ona bağlı işlemler kaldırılır.
 * Kullanıcıya gösterilecek notu döndürür.
 */
export function fixTx(cur, impOff = false, st = "", extOff = false) {
  const notes = [];
  const present = st !== "m"; // doğal, kronlu ya da implantlı: ağızda bir şey var
  if ((cur.ext || cur.imp) && (cur.rct || cur.fil || cur.ven)) { cur.rct = cur.fil = cur.ven = 0; notes.push("root canal / filling / veneer removed"); }
  if (cur.rpl && (cur.ext || cur.imp || cur.crw)) { cur.rpl = 0; notes.push("crown replacement removed"); }
  if (cur.crw && (cur.fil || cur.ven)) { cur.fil = cur.ven = 0; notes.push("filling / veneer replaced by the crown"); }
  if (extOff && present && cur.imp) { cur.imp = 0; impOff = true; notes.push("implant removed"); }
  const needC = cur.ext && cur.crw, needG = cur.grf && !cur.ext, needS = cur.sin, needP = cur.pty || cur.zyg;
  if (!cur.imp && (needC || needG || needS || needP)) {
    if (impOff) { if (needC) cur.crw = 0; if (needG) cur.grf = 0; cur.sin = cur.pty = cur.zyg = 0; notes.push("treatments that need an implant were removed too"); }
    else { cur.imp = 1; notes.push("implant added"); }
  }
  if (present && cur.imp && !cur.ext) { cur.ext = 1; notes.push("extraction added"); }
  return notes.length ? ` (${notes.join("; ")})` : "";
}
export const sortedKeys = (plan) => Object.keys(plan).map(Number).sort((a, b) => a - b);

// çene boyunca sırayla: 18→11, 21→28, 38→31, 41→48
export const ARCH_ORDER = TEETH.map((t) => t.n);

/*
 * Tam ağız restorasyonu: All-on-4 / All-on-6 / All-on-8.
 * Seçilen çenede ağızda kalan bütün dişler çekilir, çeneye 4/6/8 implant konur ve üzerine tek parça sabit köprü takılır.
 * fmr = { type: 4 | 6 | 8, arches: "U" | "L" | "UL", zyg, pty }
 * zyg: üst çenede en arkadaki implantlar zygomatic olur (kemiği çok az olan üst çene için)
 * pty: üst çenede 2. büyük azı bölgesine birer pterygoid implant eklenir; köprü o dişe kadar uzar
 * ALL_ON: her yanda implant konan diş pozisyonları (1 orta kesici … 6 birinci büyük azı).
 * All-on-4'te arka implantlar sinüs ve sinirden uzak durmak için açılı konur.
 */
export const ALL_ON = { 4: [2, 5], 6: [2, 4, 6], 8: [2, 3, 5, 6] };
export const BRIDGE_K = 6; // köprü her yanda 1–6. dişleri kapsar (çene başına 12 diş)
export const ARCH_NAMES = { U: "upper jaw", L: "lower jaw", UL: "upper and lower jaw" };
export const archOf = (n) => (n < 30 ? "U" : "L");
export const inFmr = (n, fmr) => !!fmr && fmr.arches.includes(archOf(n));
export const isTilted = (n, fmr) => !!fmr && fmr.type === 4 && n % 10 === 5;
export const fmrLabel = (fmr) => `All-on-${fmr.type}${fmr.zyg ? " zygomatic" : ""}${fmr.pty ? " + pterygoid" : ""} · ${ARCH_NAMES[fmr.arches]}`;

/**
 * İşaretlenen dişlerden plan üretir. marks: Map(diş → "x" çekilecek | "o" hastanın kendi dişi, kalacak).
 * İşaretsiz diş ağızda yok demektir. Tipe göre implant pozisyonları eklenir; kendi dişi kalan yere implant konmaz.
 */
export function fmrPlan(marks, fmr) {
  const plan = {}, post = Math.max(...ALL_ON[fmr.type]);
  ARCH_ORDER.forEach((n) => {
    if (!inFmr(n, fmr)) return;
    const m = marks.get(n), k = n % 10, upper = n < 30;
    if (m === "o") { plan[n] = { ...emptyTx(), own: 1 }; return; }
    const pty = fmr.pty && upper && k === 7 ? 1 : 0;
    const imp = ALL_ON[fmr.type].includes(k) || pty ? 1 : 0, zyg = fmr.zyg && upper && k === post ? 1 : 0;
    const ext = m === "x" ? 1 : 0;
    if (ext || imp) plan[n] = { ...emptyTx(), ext, imp, pty, zyg };
  });
  return plan;
}
/** Tam ağız işaretleri: ağızda olan dişler önceki seçim korunarak, yoksa varsayılanla (implantlı diş kalır, diğerleri çekilir) */
export function fmrMarksFor(mouth, fmr, plan = {}) {
  const marks = new Map();
  ARCH_ORDER.forEach((n) => {
    if (!inFmr(n, fmr) || mouth[n] === "m") return;
    const p = plan[n];
    marks.set(n, p?.own ? "o" : p?.ext ? "x" : mouth[n] === "i" ? "o" : "x");
  });
  return marks;
}
/** Bridge, pterygoid implant varsa o dişe kadar uzar */
export const bridgeK = (fmr, upper) => (fmr && upper && fmr.pty ? 7 : BRIDGE_K);

/** Ağız bilgisi olmayan eski kayıtlar için planından tahmin eder (implant tek başına = eksik diş, kron değişimi = kronlu diş) */
export function legacyMouth(plan, fmr) {
  const mouth = {};
  sortedKeys(plan).forEach((n) => {
    const t = plan[n];
    if (t.rpl) mouth[n] = "c";
    else if ((t.imp || t.grf) && !t.ext) mouth[n] = "m";
  });
  if (fmr) ARCH_ORDER.forEach((n) => { if (inFmr(n, fmr) && !plan[n]) mouth[n] = "m"; });
  return mouth;
}

/** Ağız değişince plandaki artık geçersiz işlemleri temizler */
export function fitPlanToMouth(plan, mouth, fmr) {
  if (fmr) return fmrPlan(fmrMarksFor(mouth, fmr, plan), fmr);
  const out = {};
  sortedKeys(plan).forEach((n) => {
    const st = mouth[n] || "", c = { ...emptyTx(), ...plan[n] };
    // eski implant çıkarılmıyorsa yalnızca kronu değiştirilebilir
    if (st === "i" && !c.ext) { const r = c.rpl || c.crw; Object.assign(c, emptyTx()); c.rpl = r ? 1 : 0; }
    else {
      if (st === "m") { c.ext = c.rct = c.fil = c.ven = c.rpl = 0; if (!c.imp) c.crw = 0; }
      if (st === "c") { c.fil = c.ven = 0; if (c.crw && !c.imp && !c.ext) { c.crw = 0; c.rpl = 1; } }
      if (st === "") c.rpl = 0;
      fixTx(c, false, st);
    }
    if (FLAGS.some(([k]) => c[k])) out[n] = c;
  });
  return out;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const fmtDate = (d) => { if (!d) return ""; const [y, m, g] = d.split("-"); return `${+g} ${MONTHS[+m - 1] || m} ${y}`; };

export const DEMO = {
  patient: { name: "Jane Smith" },
  mouth: { 18: "m", 28: "m", 38: "m", 14: "m", 37: "m", 24: "m", 46: "c", 16: "i" },
  plan: {
    36: { ext: 1, grf: 1, imp: 1, crw: 1 }, 37: { imp: 1, crw: 1 }, 46: { rpl: 1 }, 14: { imp: 1, crw: 1 },
    24: { grf: 1, imp: 1 }, 48: { ext: 1 }, 16: { rpl: 1 }, 11: { ven: 1 }, 21: { ven: 1 },
  },
};
