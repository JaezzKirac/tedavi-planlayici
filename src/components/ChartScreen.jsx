import { useState } from "react";
import ToothChart from "./ToothChart.jsx";
import { FLAGS, emptyTx, toothName, txLabel, sortedKeys, fmtDate, fixTx, fmrPlan, fmrMarksFor, inFmr, fmrLabel, ARCH_NAMES, sinusOk, ptyOk, zygOk, hasI, hasP, hasZ, ARCH_ORDER } from "../data/teeth.js";

// tool: araç id, k: plandaki alan
const TOOLS = [
  { id: "implant", k: "imp", label: "Implant", dot: "var(--ti)" },
  { id: "pterygoid", k: "pty", label: "Pterygoid implant", dot: "var(--ti-dark)" },
  { id: "zygomatic", k: "zyg", label: "Zygomatic implant", dot: "var(--ti-dark)" },
  { id: "crown", k: "crw", label: "Crown", dot: "var(--crownC)" },
  { id: "replace", k: "rpl", label: "Replace crown", dot: "var(--rplC)" },
  { id: "extract", k: "ext", label: "Extraction", dot: "var(--extC)" },
  { id: "graft", k: "grf", label: "Bone graft", dot: "var(--graftC)" },
  { id: "sinus", k: "sin", label: "Sinus lift", dot: "var(--sinC)" },
  { id: "rct", k: "rct", label: "Root canal", dot: "var(--rctC)" },
  { id: "filling", k: "fil", label: "Filling", dot: "var(--filC)" },
  { id: "veneer", k: "ven", label: "Veneer", dot: "var(--venC)" },
  { id: "clear", label: "Clear", dot: "var(--line)" },
];
const LABEL = Object.fromEntries(FLAGS.map(([k, , label]) => [k, label]));
const HINT = "Pick a treatment and tap a tooth. Tapping the same tooth again removes it.";
const FMR_HINT = "Teeth that are in the mouth today are extracted. Tap a tooth to keep it instead. Existing implants are kept; tap one to have it removed.";
const FMR_DEFAULT = { type: 4, arches: "UL", pty: false, zyg: false };
const TAG = { rpl: "rpl", ext: "ext", grf: "grf", sin: "sin", imp: "imp", pty: "imp", zyg: "imp", crw: "crw", rct: "rct", fil: "fil", ven: "ven", own: "own" };

/** İşlem bu dişe yapılamıyorsa nedenini döndürür. st: dişin bugünkü hâli */
function blocked(k, n, st, cur) {
  const name = LABEL[k].toLowerCase();
  // eski implant: kronu değiştirilebilir ya da implant çıkarılabilir (Extraction); çıkarılınca yerine yenisi planlanabilir
  if (st === "i" && ["rct", "fil", "ven"].includes(k)) return "this tooth has an implant: replace its crown, or remove the implant with Extraction";
  if (st === "m" && ["ext", "rct", "fil", "ven", "rpl"].includes(k)) return "this tooth is missing (see the Current mouth step)";
  if (k === "rpl" && st !== "c") return "there is no existing crown to replace (mark it on the Current mouth step)";
  if (["fil", "ven"].includes(k) && (st === "c" || cur.crw)) return `a crowned tooth doesn't need a ${name}`;
  if (["rct", "fil", "ven"].includes(k) && (cur.ext || cur.imp)) return `${name} needs a tooth that stays (not extracted or replaced by an implant)`;
  if (k === "ven" && n % 10 > 5) return "veneers are for front teeth and premolars";
  if (k === "sin" && !sinusOk(n)) return "sinus lift is only done in the upper back jaw (premolars and molars)";
  if (k === "pty" && !ptyOk(n)) return "pterygoid implants go at the very back of the upper jaw (second molar / wisdom tooth area)";
  if (k === "zyg" && !zygOk(n)) return "zygomatic implants go in the upper jaw (canine to first molar area)";
  return null;
}

export default function ChartScreen({ patient, mouth, plan, setPlan, fmr, setFmr, onBack, onNext }) {
  const [tool, setTool] = useState("implant");
  const [hint, setHint] = useState(fmr ? FMR_HINT : HINT);
  const keys = sortedKeys(plan);

  function setMode(on) {
    if (!!fmr === on) return;
    if (on) { setFmr(FMR_DEFAULT); setPlan(fmrPlan(fmrMarksFor(mouth, FMR_DEFAULT), FMR_DEFAULT)); setHint(FMR_HINT); }
    else { setFmr(null); setPlan({}); setHint(HINT); }
  }

  // tip, çene ya da ek implant seçeneği değişince işaretler korunur, implant pozisyonları yeniden hesaplanır
  function setOption(next) {
    const f = { ...fmr, ...next };
    if (!f.arches.includes("U")) f.pty = f.zyg = false;
    setFmr(f); setPlan(fmrPlan(fmrMarksFor(mouth, f, plan), f));
  }

  function toggleSingle(n) {
    const say = (msg) => setHint(`${n} · ${toothName(n)} → ${msg}`);
    const st = mouth[n] || "", next = { ...plan };
    if (tool === "clear") { delete next[n]; setPlan(next); say("treatment removed"); return; }
    let { k } = TOOLS.find((x) => x.id === tool);
    if (k === "crw" && (st === "c" || st === "i") && !plan[n]?.ext) k = "rpl"; // kronlu dişe yeni kron = kron değişimi
    const cur = { ...emptyTx(), ...(plan[n] || {}) };
    const turningOn = !cur[k];
    if (turningOn) { const why = blocked(k, n, st, cur); if (why) { say(why); return; } }
    const hadImp = cur.imp, hadExt = cur.ext;
    cur[k] = turningOn ? 1 : 0;
    if (turningOn && k === "rpl") cur.crw = cur.fil = cur.ven = 0; // yeni kron bunların yerini alır
    if (k === "pty" || k === "zyg") {
      if (turningOn) { cur.imp = 1; cur[k === "pty" ? "zyg" : "pty"] = 0; } else cur.imp = 0;
    }
    const note = fixTx(cur, hadImp && !cur.imp, st, hadExt && !cur.ext);
    if (FLAGS.some(([x]) => cur[x])) next[n] = cur; else delete next[n];
    setPlan(next);
    const lbl = (x) => (st === "i" ? x.replace("Extraction", "Implant removal").replace("extraction added", "implant removal added") : x);
    say(next[n] ? lbl(`${txLabel(next, n)}${note}`) : "treatment removed");
  }

  // bütün mevcut kronları değiştirmek için (implant üstündekiler dahil)
  function replaceAll(arch) {
    const list = ARCH_ORDER.filter((n) => (arch === "A" || (arch === "U") === n < 30) && (mouth[n] === "c" || mouth[n] === "i"));
    if (!list.length) { setHint("No existing crowns in this jaw. Mark them on the Current mouth step."); return; }
    const next = { ...plan };
    list.forEach((n) => { next[n] = { ...emptyTx(), ...(plan[n] || {}), rpl: 1, crw: 0, fil: 0, ven: 0 }; });
    setPlan(next);
    setHint(`Crown replacement on ${list.length} teeth`);
  }

  function toggleFmr(n) {
    const say = (msg) => setHint(`${n} · ${toothName(n)} → ${msg}`);
    if (!inFmr(n, fmr)) { say(`the ${ARCH_NAMES[n < 30 ? "U" : "L"]} is not part of this restoration`); return; }
    if (mouth[n] === "m") { say("missing (see the Current mouth step)"); return; }
    const marks = fmrMarksFor(mouth, fmr, plan);
    marks.set(n, marks.get(n) === "o" ? "x" : "o");
    setPlan(fmrPlan(marks, fmr));
    const kind = mouth[n] === "i" ? "implant" : "tooth";
    say(marks.get(n) === "o" ? `own ${kind}, will be kept` : mouth[n] === "i" ? "old implant will be removed" : "will be extracted");
  }

  // tüm seçimleri siler; tam ağızda tip ve çene seçimi korunur, işaretler ağızdan yeniden gelir
  function clearAll() {
    setPlan(fmr ? fmrPlan(fmrMarksFor(mouth, fmr), fmr) : {});
    setHint("All selections cleared.");
  }

  function remove(n) { const next = { ...plan }; delete next[n]; setPlan(next); }

  const pick = (fn) => keys.filter((n) => fn(plan[n], n));
  const extracted = pick((t) => t.ext), kept = pick((t) => t.own);
  const implants = pick((t, n) => hasI(plan, n) && !hasP(plan, n) && !hasZ(plan, n)), ptys = pick((t) => t.pty), zygs = pick((t) => t.zyg);

  return (
    <section className="layout">
      <div className="card chartcard">
        <div className="chart-head">
          <div>
            <div className="label">{patient.name}{patient.date ? " · " + fmtDate(patient.date) : ""}</div>
            <h2>Treatment plan</h2>
          </div>
          <div className="modes" role="group" aria-label="Treatment type">
            <button type="button" aria-pressed={!fmr} onClick={() => setMode(false)}>Single teeth</button>
            <button type="button" aria-pressed={!!fmr} onClick={() => setMode(true)}>Full mouth restoration</button>
          </div>
        </div>
        {fmr ? (
          <div className="fmropts">
            <div className="tools" role="group" aria-label="Restoration type">
              {[4, 6, 8].map((t) => (
                <button key={t} type="button" aria-pressed={fmr.type === t} onClick={() => setOption({ type: t })}>{`All-on-${t}`}</button>
              ))}
            </div>
            <div className="tools" role="group" aria-label="Jaw">
              {[["U", "Upper"], ["L", "Lower"], ["UL", "Both jaws"]].map(([a, label]) => (
                <button key={a} type="button" aria-pressed={fmr.arches === a} onClick={() => setOption({ arches: a })}>{label}</button>
              ))}
            </div>
            <div className="tools" role="group" aria-label="Special implants (upper jaw)">
              <button type="button" disabled={!fmr.arches.includes("U")} aria-pressed={!!fmr.zyg} onClick={() => setOption({ zyg: !fmr.zyg })}>Zygomatic</button>
              <button type="button" disabled={!fmr.arches.includes("U")} aria-pressed={!!fmr.pty} onClick={() => setOption({ pty: !fmr.pty })}>Pterygoid</button>
            </div>
          </div>
        ) : (
          <>
            <div className="tools" role="group" aria-label="Treatment">
              {TOOLS.map((t) => (
                <button key={t.id} type="button" aria-pressed={tool === t.id} onClick={() => setTool(t.id)}>
                  <span className="dot" style={{ background: t.dot }} />{t.label}
                </button>
              ))}
            </div>
            {tool === "replace" && (
              <div className="tools" role="group" aria-label="Replace all existing crowns">
                {[["U", "All upper crowns"], ["L", "All lower crowns"], ["A", "All crowns"]].map(([a, label]) => (
                  <button key={a} type="button" onClick={() => replaceAll(a)}>{label}</button>
                ))}
              </div>
            )}
          </>
        )}
        <div className="hint" aria-live="polite">{hint}</div>
        <div className="archbox"><ToothChart plan={plan} mouth={mouth} onToggle={fmr ? toggleFmr : toggleSingle} /></div>
      </div>
      <div className="side">
        <div className="card">
          <div className="sidehead">
            <div className="label">{fmr ? "Full mouth restoration" : "Selected treatments"}</div>
            <button className="btn ghost sm clearall" type="button" disabled={!fmr && !keys.length} onClick={clearAll}>Clear all</button>
          </div>
          {fmr ? (
            <dl className="fmrsum">
              <div><dt>Treatment</dt><dd className="big">{fmrLabel(fmr)}</dd></div>
              <div><dt>Teeth extracted</dt><dd>{extracted.length ? extracted.join(", ") : "none"}</dd></div>
              <div><dt>Own teeth kept</dt><dd>{kept.length ? kept.join(", ") : "none"}</dd></div>
              <div><dt>Implant positions</dt><dd>{implants.join(", ") || "none"}</dd></div>
              {zygs.length > 0 && <div><dt>Zygomatic implants</dt><dd>{zygs.join(", ")}</dd></div>}
              {ptys.length > 0 && <div><dt>Pterygoid implants</dt><dd>{ptys.join(", ")}</dd></div>}
              <div className="tot">
                <span><b>{extracted.length}</b> extractions</span>
                <span><b>{implants.length + zygs.length + ptys.length}</b> implants</span>
                <span><b>{fmr.arches.length}</b> {fmr.arches.length === 1 ? "fixed bridge" : "fixed bridges"}</span>
              </div>
            </dl>
          ) : keys.length ? (
            <ul className="plist">
              {keys.map((n) => (
                <li key={n}>
                  <span className="fdi">{n}</span>
                  <span className="nm">{toothName(n)}
                    <small>
                      {FLAGS.filter(([k]) => plan[n][k] && !(k === "imp" && (plan[n].pty || plan[n].zyg))).map(([k, , label]) => <span key={k} className={"tag " + TAG[k]}>{(k === "ext" && mouth[n] === "i" ? "Implant removal" : label).toUpperCase()}</span>)}
                    </small>
                  </span>
                  <button className="x" type="button" onClick={() => remove(n)} aria-label={`Remove tooth ${n}`}>×</button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty">No treatments selected yet.</p>
          )}
          <button className="btn" type="button" disabled={!keys.length} onClick={onNext}>Create 3D plan →</button>
          <button className="btn ghost" type="button" onClick={onBack}>← Current mouth</button>
        </div>
        <p className="note">
          {fmr && (fmr.type === 4
            ? "All-on-4: the two front implants are upright, the two back implants are angled to avoid the sinus and nerve and use the available bone. "
            : `All-on-${fmr.type}: more implants spread the biting force across the jaw. `)}
          {fmr?.zyg && "Zygomatic: the back implants of the upper jaw are anchored in the cheekbone. "}
          {fmr?.pty && "Pterygoid: an extra angled implant at the back of each side of the upper jaw. "}
          Grey teeth on the chart are existing crowns or implants from the Current mouth step.
        </p>
      </div>
    </section>
  );
}
