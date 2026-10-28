import { sortedKeys, hasE, hasG, hasI, hasC } from "./teeth.js";

export const CHINFO = {
  scan: { t: "Exam and 3D CT scan", d: "Day 1 · 30–45 min", p: "Your mouth is scanned and a dental CT measures the bone volume and the position of nerves and sinuses.", cal: "Day 1" },
  ext: { t: "Tooth extraction", d: "1 visit · 15–30 min per tooth", p: "Under local anaesthesia the tooth is gently loosened and removed while the surrounding bone is preserved. You won't feel pain during the procedure.", pImp: "Depending on the bone, the implant is placed in the same visit or after a few weeks of healing.", cal: "Extraction" },
  graft: { t: "Bone graft", d: "1 visit · 30–60 min per site", p: "Where there isn't enough bone to hold the implant securely, it is rebuilt with bone graft material. The graft is covered with a protective membrane and stitched. Done under local anaesthesia.", pExt: "Because the extraction socket is filled in the same visit, bone loss is prevented as well.", cal: "Graft" },
  gheal: { t: "Graft maturation", d: "4–6 months", p: "Over time the graft turns into your own bone. You carry on with daily life as normal; a temporary tooth can be used if needed.", cal: "Bone maturation" },
  surgery: { t: "Implant placement", d: "Week 1 · ~30 min per implant", p: "Under local anaesthesia a small channel is prepared in the bone, then the titanium implant is screwed into place. You won't feel pain during the procedure.", cal: "Week 1" },
  heal: { t: "Healing (osseointegration)", d: "2–4 months", p: "The implants fuse with the bone. You carry on with daily life as normal; a temporary tooth can be used if needed.", cal: "Healing" },
  prep: { t: "Preparing the tooth for a crown", d: "1 visit · 30–45 min per tooth", p: "Decay is removed and a thin layer is taken from each surface of the tooth to shape it for the crown.", cal: "Preparation" },
  abut: { t: "Fitting the abutments", d: "1 visit · 20–30 min", p: "An abutment or healing cap that will carry the crown is screwed onto each healed implant.", cal: "Month 3" },
  lab: { t: "Digital impression and lab", d: "5–7 working days", p: "An intraoral scanner takes the impression and the shade is chosen. The zirconia crowns are made in the lab.", cal: "Lab" },
  fit: { t: "Fitting the crown", d: "1 visit · 30–45 min", p: "The zirconia crown is seated and your bite is checked.", cal: "Final visit" },
  done: { t: "Treatment complete", d: "Check-up every 6 months", p: "Your new teeth are ready to use. With regular brushing and check-ups every 6 months they will last for many years.", cal: "✓ Complete" },
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
