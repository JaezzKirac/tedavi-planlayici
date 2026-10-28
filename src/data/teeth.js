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

// plan: { [fdi]: { ext: 0|1, grf: 0|1, imp: 0|1, crw: 0|1 } }
export const hasE = (plan, n) => !!(plan[n] && plan[n].ext);
export const hasG = (plan, n) => !!(plan[n] && plan[n].grf);
export const hasI = (plan, n) => !!(plan[n] && plan[n].imp);
export const hasC = (plan, n) => !!(plan[n] && plan[n].crw);
export const txLabel = (plan, n) => [hasE(plan, n) && "Extraction", hasG(plan, n) && "Bone graft", hasI(plan, n) && "Implant", hasC(plan, n) && "Crown"].filter(Boolean).join(" + ");

/**
 * Geçersiz kombinasyonları düzeltir: çekilen dişe kron ve çekim yapılmayan bölgeye greft ancak implantla yapılır.
 * impOff: implant az önce kaldırıldıysa geri eklenmez, ona bağlı işlemler kaldırılır. Kullanıcıya gösterilecek notu döndürür.
 */
export function fixTx(cur, impOff) {
  const needC = cur.ext && cur.crw, needG = cur.grf && !cur.ext;
  if (cur.imp || !(needC || needG)) return "";
  if (impOff) { if (needC) cur.crw = 0; if (needG) cur.grf = 0; return " (treatments that need an implant were removed too)"; }
  cur.imp = 1;
  return " (implant added)";
}
export const sortedKeys = (plan) => Object.keys(plan).map(Number).sort((a, b) => a - b);

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const fmtDate = (d) => { if (!d) return ""; const [y, m, g] = d.split("-"); return `${+g} ${MONTHS[+m - 1] || m} ${y}`; };

export const DEMO = {
  patient: { name: "Jane Smith" },
  plan: { 36: { ext: 1, grf: 1, imp: 1, crw: 1 }, 37: { imp: 1, crw: 1 }, 46: { imp: 0, crw: 1 }, 14: { imp: 1, crw: 1 }, 24: { grf: 1, imp: 1, crw: 0 }, 48: { ext: 1 } },
};
