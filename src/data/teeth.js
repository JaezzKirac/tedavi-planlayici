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

// plan: { [fdi]: { ext, grf, imp, crw, rct, ven, sin, fil, own: 0|1 } }
// FLAGS: alan adı, linkteki harf, ekranda görünen ad (linkte bu sırayla yazılır)
export const FLAGS = [
  ["ext", "e", "Extraction"], ["grf", "g", "Bone graft"], ["sin", "s", "Sinus lift"], ["imp", "i", "Implant"],
  ["crw", "c", "Crown"], ["rct", "r", "Root canal"], ["fil", "f", "Filling"], ["ven", "v", "Veneer"], ["own", "o", "Own tooth"],
];
const has = (k) => (plan, n) => !!(plan[n] && plan[n][k]);
export const hasE = has("ext"), hasG = has("grf"), hasI = has("imp"), hasC = has("crw");
export const hasR = has("rct"), hasV = has("ven"), hasS = has("sin"), hasF = has("fil"), hasO = has("own");
export const txLabel = (plan, n) => FLAGS.filter(([k]) => plan[n] && plan[n][k]).map(([, , label]) => label).join(" + ");
export const emptyTx = () => Object.fromEntries(FLAGS.map(([k]) => [k, 0]));

/** Sinüs lifting yalnızca üst çene arka bölgesinde (küçük ve büyük azılar) yapılır */
export const sinusOk = (n) => n < 30 && n % 10 >= 4;
/** Kanal tedavisi, dolgu ve veneer yalnızca ağızda kalan doğal dişe yapılır; veneer ön dişlere (kesiciler, köpek dişi, küçük azılar) */
export const naturalOk = (cur) => !cur.ext && !cur.imp;

/**
 * Geçersiz kombinasyonları düzeltir:
 * çekilen dişe kron, çekim yapılmayan bölgeye greft ve sinüs lifting ancak implantla yapılır;
 * çekilen ya da implant konan dişte kanal / dolgu / veneer olmaz; kronlu dişe veneer ve dolgu yapılmaz.
 * impOff: implant az önce kaldırıldıysa geri eklenmez, ona bağlı işlemler kaldırılır. Kullanıcıya gösterilecek notu döndürür.
 */
export function fixTx(cur, impOff) {
  const notes = [];
  if ((cur.ext || cur.imp) && (cur.rct || cur.fil || cur.ven)) { cur.rct = cur.fil = cur.ven = 0; notes.push("root canal / filling / veneer removed"); }
  if (cur.crw && (cur.fil || cur.ven)) { cur.fil = cur.ven = 0; notes.push("filling / veneer replaced by the crown"); }
  const needC = cur.ext && cur.crw, needG = cur.grf && !cur.ext, needS = cur.sin;
  if (!cur.imp && (needC || needG || needS)) {
    if (impOff) { if (needC) cur.crw = 0; if (needG) cur.grf = 0; if (needS) cur.sin = 0; notes.push("treatments that need an implant were removed too"); }
    else { cur.imp = 1; notes.push("implant added"); }
  }
  return notes.length ? ` (${notes.join("; ")})` : "";
}
export const sortedKeys = (plan) => Object.keys(plan).map(Number).sort((a, b) => a - b);

// çene boyunca sırayla: 18→11, 21→28, 38→31, 41→48
export const ARCH_ORDER = TEETH.map((t) => t.n);

/*
 * Tam ağız restorasyonu: All-on-4 / All-on-6 / All-on-8.
 * Seçilen çenede ağızda kalan bütün dişler çekilir, çeneye 4/6/8 implant konur ve üzerine tek parça sabit köprü takılır.
 * fmr = { type: 4 | 6 | 8, arches: "U" | "L" | "UL" }
 * ALL_ON: her yanda implant konan diş pozisyonları (1 orta kesici … 6 birinci büyük azı).
 * All-on-4'te arka implantlar sinüs ve sinirden uzak durmak için açılı konur.
 */
export const ALL_ON = { 4: [2, 5], 6: [2, 4, 6], 8: [2, 3, 5, 6] };
export const BRIDGE_K = 6; // köprü her yanda 1–6. dişleri kapsar (çene başına 12 diş)
export const ARCH_NAMES = { U: "upper jaw", L: "lower jaw", UL: "upper and lower jaw" };
export const archOf = (n) => (n < 30 ? "U" : "L");
export const inFmr = (n, fmr) => !!fmr && fmr.arches.includes(archOf(n));
export const isTilted = (n, fmr) => !!fmr && fmr.type === 4 && n % 10 === 5;
export const fmrLabel = (fmr) => `All-on-${fmr.type} · ${ARCH_NAMES[fmr.arches]}`;

/**
 * İşaretlenen dişlerden plan üretir. marks: Map(diş → "x" çekilecek | "o" hastanın kendi dişi, kalacak).
 * İşaretsiz diş ağızda yok demektir. Tipe göre implant pozisyonları eklenir; kendi dişi kalan yere implant konmaz.
 */
export function fmrPlan(marks, fmr) {
  const plan = {};
  ARCH_ORDER.forEach((n) => {
    if (!inFmr(n, fmr)) return;
    const m = marks.get(n);
    if (m === "o") { plan[n] = { ...emptyTx(), own: 1 }; return; }
    const ext = m === "x" ? 1 : 0, imp = ALL_ON[fmr.type].includes(n % 10) ? 1 : 0;
    if (ext || imp) plan[n] = { ...emptyTx(), ext, imp };
  });
  return plan;
}
/** Plandan işaretleri geri okur */
export const fmrMarks = (plan) => new Map(sortedKeys(plan).filter((n) => plan[n].ext || plan[n].own).map((n) => [n, plan[n].own ? "o" : "x"]));

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const fmtDate = (d) => { if (!d) return ""; const [y, m, g] = d.split("-"); return `${+g} ${MONTHS[+m - 1] || m} ${y}`; };

export const DEMO = {
  patient: { name: "Jane Smith" },
  plan: { 36: { ext: 1, grf: 1, imp: 1, crw: 1 }, 37: { imp: 1, crw: 1 }, 46: { imp: 0, crw: 1 }, 14: { imp: 1, crw: 1 }, 24: { grf: 1, imp: 1, crw: 0 }, 48: { ext: 1 } },
};
