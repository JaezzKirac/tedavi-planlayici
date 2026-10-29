import { sortedKeys, hasE, hasG, hasI, hasC, hasR, hasV, hasS, hasF, ARCH_ORDER, archOf } from "./teeth.js";

// Aşama metinleri. Süre bilgisi bilerek yok: takvimi hastaya hekim / hasta danışmanı anlatır.
// t: başlık, p: açıklama, cal: 3D görünümün köşesindeki kısa etiket
export const CHINFO = {
  scan: { t: "Exam and 3D CT scan", p: "Your mouth is scanned and a dental CT measures the bone volume and the position of nerves and sinuses.", cal: "Exam" },
  fill: { t: "Dental filling", p: "The decay is cleaned out and the cavity is filled with tooth-coloured composite, which is shaped and hardened with a curing light.", cal: "Filling" },
  rct: { t: "Root canal treatment", p: "The infected nerve inside the tooth is removed, the root canals are cleaned and shaped, then sealed so the tooth can be kept. You won't feel pain during the procedure.", cal: "Root canal" },
  ext: { t: "Tooth extraction", p: "Under local anaesthesia the tooth is gently loosened and removed while the surrounding bone is preserved. You won't feel pain during the procedure.", pImp: "Depending on the bone, the implant is placed in the same visit or once the socket has healed.", cal: "Extraction" },
  graft: { t: "Bone graft", p: "Where there isn't enough bone to hold the implant securely, it is rebuilt with bone graft material. The graft is covered with a protective membrane and stitched. Done under local anaesthesia.", pExt: "Because the extraction socket is filled in the same visit, bone loss is prevented as well.", cal: "Bone graft" },
  sinus: { t: "Sinus lift", p: "In the upper back jaw the floor of the sinus is gently lifted and bone graft is placed beneath it, so there is enough bone height to hold the implant.", cal: "Sinus lift" },
  gheal: { t: "Graft maturation", p: "Over time the graft turns into your own bone. You carry on with daily life as normal; a temporary tooth can be used if needed.", cal: "Bone maturation" },
  surgery: { t: "Implant placement", p: "Under local anaesthesia a small channel is prepared in the bone, then the titanium implant is screwed into place. You won't feel pain during the procedure.", cal: "Implants" },
  heal: { t: "Healing (osseointegration)", p: "The implants fuse with the bone. You carry on with daily life as normal; a temporary tooth can be used if needed.", cal: "Healing" },
  prep: { t: "Preparing the tooth for a crown", p: "Decay is removed and a thin layer is taken from each surface of the tooth to shape it for the crown.", cal: "Preparation" },
  abut: { t: "Fitting the abutments", p: "An abutment or healing cap that will carry the crown is screwed onto each healed implant.", cal: "Abutments" },
  lab: { t: "Digital impression and lab", p: "An intraoral scanner takes the impression and the shade is chosen. Your crowns or veneers are made in the lab.", cal: "Lab" },
  fit: { t: "Fitting the crown", p: "The zirconia crown is seated and your bite is checked.", cal: "Crowns" },
  ven: { t: "Veneers", p: "A very thin layer is polished from the front of the tooth and a custom porcelain veneer is bonded on, improving its colour and shape.", cal: "Veneers" },
  temp: { t: "Temporary fixed bridge", p: "Right after the implants are placed, a temporary fixed bridge is screwed onto them, so you leave the clinic with a full set of teeth.", cal: "Temporary bridge" },
  bridge: { t: "Final bridge fitted", p: "The final full-arch bridge, made in the lab to match your bite and smile, is screwed onto the implants and your bite is checked.", cal: "Final bridge" },
  done: { t: "Treatment complete", p: "Your new teeth are ready to use. Keep them healthy with good oral hygiene and regular check-ups.", cal: "✓ Complete" },
};

// All-on-4/6/8'de bazı adımlar farklı anlatılır
const CHINFO_FMR = {
  ext: { p: "Under local anaesthesia or sedation the teeth that can't be kept are removed and the jaw is cleaned and smoothed for the implants. You won't feel pain during the procedure.", pImp: "" },
  surgery: { p: "The implants are placed in the same session as the extractions. They are spread along the jaw so they can carry a full fixed bridge." },
  heal: { p: "The implants fuse with the bone while you wear the temporary bridge. You eat soft foods at first and carry on with daily life as normal." },
  lab: { p: "A digital impression of the healed jaw is taken and the final full-arch bridge is made in the lab." },
};
const FMR_TILT = "In All-on-4 the two back implants are angled so they can use the available bone and stay clear of the sinus and nerve, which often avoids the need for a bone graft.";

/** Bölüm metni; tam ağız restorasyonunda ilgili alanlar değiştirilir */
export function chInfo(ch, fmr) {
  const base = CHINFO[ch];
  if (!fmr || !CHINFO_FMR[ch]) return base;
  const info = { ...base, ...CHINFO_FMR[ch] };
  if (ch === "surgery" && fmr.type === 4) info.p += " " + FMR_TILT;
  return info;
}

/**
 * Plandan animasyon zaman çizelgesi üretir.
 * TL: olaylar (start/dur ms), CH: bölümler, TE: diş başına olay zamanları (köprüler için TE.U / TE.L)
 * fmr (All-on-4/6/8): her işlem çene çene yapılır, çenedeki dişler kısa aralıklarla art arda işlenir
 * (stag: dişler arası ms, td: diş başına süre). İmplantların üzerine aynı gün geçici, iyileşmeden sonra kalıcı köprü takılır.
 */
export function buildTimeline(plan, { fmr = null } = {}) {
  const keys = sortedKeys(plan);
  const pick = (fn) => keys.filter((n) => fn(plan, n));
  const exts = pick(hasE), grfs = pick(hasG), sins = pick(hasS), imps = pick(hasI), crws = pick(hasC);
  const rcts = pick(hasR), fils = pick(hasF), vens = pick(hasV);
  const preps = keys.filter((n) => hasC(plan, n) && !hasI(plan, n));
  const TL = [];
  const add = (ch, dur, o = {}) => TL.push({ ch, dur, ...o });
  // çene boyunca sırayla (sağdan sola), önce üst sonra alt çene
  const arches = [["U", "upper", ARCH_ORDER.filter((n) => archOf(n) === "U")], ["L", "lower", ARCH_ORDER.filter((n) => archOf(n) === "L")]]
    .filter(([a]) => !fmr || fmr.arches.includes(a));
  const each = (ch, list, D, gap, single) => {
    if (!fmr) return list.forEach((n) => add(ch, single, { focus: n, set: [n] }));
    arches.forEach(([, arch, order]) => {
      const set = order.filter((n) => list.includes(n));
      if (set.length) add(ch, D + D * gap * (set.length - 1), { set, arch, stag: D * gap, td: D });
    });
  };
  const perArch = (ch, dur) => arches.forEach(([a, arch]) => add(ch, dur, { arch, bridge: a }));

  add("scan", 4200, { scan: 1 });
  if (fmr) {
    each("ext", exts, 3000, 0.45);
    each("surgery", imps, 3400, 0.6);
    perArch("temp", 4200);
    add("heal", 5000, { set: imps });
    add("lab", 3800, { scan: 1 });
    perArch("bridge", 5200);
  } else {
    each("fill", fils, 0, 0, 4600);
    each("rct", rcts, 0, 0, 6200);
    each("ext", exts, 0, 0, 5200);
    each("graft", grfs, 0, 0, 5600);
    each("sinus", sins, 0, 0, 6000);
    if (grfs.length || sins.length) add("gheal", 5000, { set: [...grfs, ...sins] });
    each("surgery", imps, 0, 0, 6500);
    if (imps.length) add("heal", 5000, { set: imps });
    each("prep", preps, 0, 0, 5000);
    if (imps.length) add("abut", 4000, { set: imps });
    if (crws.length || vens.length) add("lab", 3800, { scan: 1 });
    each("fit", crws, 0, 0, 3400);
    each("ven", vens, 0, 0, 4800);
  }
  add("done", 6000, { done: 1 });

  let t = 0;
  TL.forEach((e) => { e.start = t; t += e.dur; });
  const TOTAL = t;
  const TE = {};
  keys.forEach((n) => (TE[n] = {}));
  TL.forEach((e) => (e.set || []).forEach((n, i) => (TE[n][e.ch] = e.stag ? { s: e.start + i * e.stag, d: e.td } : { s: e.start, d: e.dur })));
  TL.forEach((e) => { if (e.bridge) (TE[e.bridge] ||= {})[e.ch] = { s: e.start, d: e.dur }; });
  const CH = [];
  TL.forEach((e) => { if (!CH.length || CH[CH.length - 1].ch !== e.ch) CH.push({ ch: e.ch, start: e.start }); });
  return { TL, CH, TE, TOTAL, keys, exts, grfs, sins, imps, crws, rcts, fils, vens, bridges: fmr ? arches.length : 0 };
}

/** Olayda o anda işlenen diş: tek dişlik olayda odak diş, art arda işlenen dişlerde sıradaki diş */
export const activeTooth = (e, t) => e.focus || (e.stag ? e.set[Math.min(e.set.length - 1, Math.max(0, Math.floor((t - e.start) / e.stag)))] : null);

export const eventIndexAt = (TL, t) => { const i = TL.findIndex((e) => t < e.start + e.dur); return i < 0 ? TL.length - 1 : i; };
export const chapterIndexAt = (CH, e) => { let ci = 0; CH.forEach((c, i) => { if (c.start <= e.start) ci = i; }); return ci; };
export const fmtTime = (ms) => { const x = Math.round(ms / 1000); return Math.floor(x / 60) + ":" + String(x % 60).padStart(2, "0"); };
