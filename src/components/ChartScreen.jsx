import { useState } from "react";
import ToothChart from "./ToothChart.jsx";
import { FLAGS, emptyTx, toothName, txLabel, sortedKeys, fmtDate, fixTx, fmrPlan, fmrMarks, inFmr, fmrLabel, ARCH_NAMES, sinusOk, naturalOk, hasI } from "../data/teeth.js";

// tool: araç id, k: plandaki alan
const TOOLS = [
  { id: "implant", k: "imp", label: "Implant", dot: "var(--ti)" },
  { id: "crown", k: "crw", label: "Crown", dot: "var(--crownC)" },
  { id: "extract", k: "ext", label: "Extraction", dot: "var(--extC)" },
  { id: "graft", k: "grf", label: "Bone graft", dot: "var(--graftC)" },
  { id: "sinus", k: "sin", label: "Sinus lift", dot: "var(--sinC)" },
  { id: "rct", k: "rct", label: "Root canal", dot: "var(--rctC)" },
  { id: "filling", k: "fil", label: "Filling", dot: "var(--filC)" },
  { id: "veneer", k: "ven", label: "Veneer", dot: "var(--venC)" },
  { id: "clear", label: "Clear", dot: "var(--line)" },
];
// tam ağız restorasyonunda dişler iki şekilde işaretlenir; işaretsiz diş ağızda yok demektir
const FMR_TOOLS = [
  { id: "x", label: "Extract (tooth present)", dot: "var(--extC)" },
  { id: "o", label: "Own tooth (keep)", dot: "var(--ownC)" },
];
const HINT = "Pick a tool and tap a tooth. Tapping the same tooth again removes the mark.";
const FMR_HINT = "Mark the patient's own teeth: teeth that will be extracted, and teeth that will be kept. Unmarked teeth are treated as missing.";
const FMR_DEFAULT = { type: 4, arches: "UL" };
const TAG = { ext: "ext", grf: "grf", sin: "sin", imp: "imp", crw: "crw", rct: "rct", fil: "fil", ven: "ven", own: "own" };

export default function ChartScreen({ patient, plan, setPlan, fmr, setFmr, onBack, onNext }) {
  const [tool, setTool] = useState(fmr ? "x" : "implant");
  const [hint, setHint] = useState(fmr ? FMR_HINT : HINT);
  const [noTeeth, setNoTeeth] = useState(false); // tam ağız: hastanın hiç kendi dişi kalmamış
  const keys = sortedKeys(plan);

  function setMode(on) {
    if (!!fmr === on) return;
    if (on) {
      setFmr(FMR_DEFAULT); setPlan(fmrPlan(new Map(), FMR_DEFAULT)); setTool("x"); setHint(FMR_HINT);
    } else {
      setFmr(null); setPlan({}); setTool("implant"); setHint(HINT);
    }
    setNoTeeth(false);
  }

  // tip ya da çene değişince işaretler korunur, implant pozisyonları yeniden hesaplanır
  function setOption(next) {
    const f = { ...fmr, ...next };
    const marks = new Map([...fmrMarks(plan)].filter(([n]) => inFmr(n, f)));
    setFmr(f); setPlan(fmrPlan(marks, f));
  }

  function toggleSingle(n) {
    const say = (msg) => setHint(`${n} · ${toothName(n)} → ${msg}`);
    const next = { ...plan };
    if (tool === "clear") { delete next[n]; setPlan(next); say("mark removed"); return; }
    const t = TOOLS.find((x) => x.id === tool);
    const cur = { ...emptyTx(), ...(plan[n] || {}) };
    const turningOn = !cur[t.k];
    // yalnızca uygun dişe yapılabilen işlemler
    if (turningOn) {
      if (t.k === "sin" && !sinusOk(n)) { say("sinus lift is only done in the upper back jaw (premolars and molars)"); return; }
      if (["rct", "fil", "ven"].includes(t.k) && !naturalOk(cur)) { say(`${t.label.toLowerCase()} needs the patient's own tooth (not extracted or replaced by an implant)`); return; }
      if (["fil", "ven"].includes(t.k) && cur.crw) { say(`a crowned tooth doesn't need a ${t.label.toLowerCase()}`); return; }
      if (t.k === "ven" && n % 10 > 5) { say("veneers are for front teeth and premolars"); return; }
    }
    const hadImp = cur.imp;
    cur[t.k] = turningOn ? 1 : 0;
    const note = fixTx(cur, hadImp && !cur.imp);
    if (FLAGS.some(([k]) => cur[k])) next[n] = cur; else delete next[n];
    setPlan(next);
    say(next[n] ? `${txLabel(next, n)}${note}` : "mark removed");
  }

  function toggleFmr(n) {
    if (!inFmr(n, fmr)) { setHint(`${n} · ${toothName(n)} → the ${ARCH_NAMES[n < 30 ? "U" : "L"]} is not part of this restoration`); return; }
    const marks = fmrMarks(plan);
    if (marks.get(n) === tool) marks.delete(n); else marks.set(n, tool);
    setPlan(fmrPlan(marks, fmr));
    if (marks.size) setNoTeeth(false);
    const m = marks.get(n);
    setHint(`${n} · ${toothName(n)} → ${m === "x" ? "present, will be extracted" : m === "o" ? "own tooth, will be kept" : "missing"}`);
  }

  function remove(n) { const next = { ...plan }; delete next[n]; setPlan(next); }

  const extracted = keys.filter((n) => plan[n].ext);
  const kept = keys.filter((n) => plan[n].own);
  const implants = keys.filter((n) => hasI(plan, n));
  // tam ağız: kendi dişleri işaretlenmeden (ya da "hiç dişi yok" onaylanmadan) devam edilmez
  const fmrReady = !fmr || extracted.length + kept.length > 0 || noTeeth;
  const canNext = keys.length > 0 && fmrReady;

  return (
    <section className="layout">
      <div className="card chartcard">
        <div className="chart-head">
          <div>
            <div className="label">{patient.name}{patient.date ? " · " + fmtDate(patient.date) : ""}</div>
            <h2>Dental chart</h2>
          </div>
          <div className="modes" role="group" aria-label="Treatment type">
            <button type="button" aria-pressed={!fmr} onClick={() => setMode(false)}>Single teeth</button>
            <button type="button" aria-pressed={!!fmr} onClick={() => setMode(true)}>Full mouth restoration</button>
          </div>
        </div>
        {fmr && (
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
          </div>
        )}
        <div className="tools" role="group" aria-label="Treatment tool">
          {(fmr ? FMR_TOOLS : TOOLS).map((t) => (
            <button key={t.id} type="button" aria-pressed={tool === t.id} onClick={() => setTool(t.id)}>
              <span className="dot" style={{ background: t.dot }} />{t.label}
            </button>
          ))}
        </div>
        <div className="hint" aria-live="polite">{hint}</div>
        <div className="archbox"><ToothChart plan={plan} fmr={fmr} onToggle={fmr ? toggleFmr : toggleSingle} /></div>
      </div>
      <div className="side">
        <div className="card">
          <div className="label">{fmr ? "Full mouth restoration" : "Selected treatments"}</div>
          {fmr ? (
            <dl className="fmrsum">
              <div><dt>Treatment</dt><dd className="big">{fmrLabel(fmr)}</dd></div>
              <div><dt>Own teeth · extracted</dt><dd>{extracted.length ? extracted.join(", ") : "none"}</dd></div>
              <div><dt>Own teeth · kept</dt><dd>{kept.length ? kept.join(", ") : "none"}</dd></div>
              <div><dt>Implant positions</dt><dd>{implants.join(", ")}</dd></div>
              <div className="tot">
                <span><b>{extracted.length}</b> extractions</span>
                <span><b>{implants.length}</b> implants</span>
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
                      {FLAGS.filter(([k]) => plan[n][k]).map(([k, , label]) => <span key={k} className={"tag " + TAG[k]}>{label.toUpperCase()}</span>)}
                    </small>
                  </span>
                  <button className="x" type="button" onClick={() => remove(n)} aria-label={`Remove tooth ${n}`}>×</button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty">No teeth selected yet.</p>
          )}
          {fmr && !extracted.length && !kept.length && (
            <div className="gate">
              <p>Mark the patient's own teeth on the chart before continuing.</p>
              <label className="tog">
                <input type="checkbox" checked={noTeeth} onChange={(e) => setNoTeeth(e.target.checked)} />
                The patient has no own teeth left in this {fmr.arches === "UL" ? "mouth" : "jaw"}
              </label>
            </div>
          )}
          <button className="btn" type="button" disabled={!canNext} onClick={onNext}>Create treatment plan →</button>
          <button className="btn ghost" type="button" onClick={onBack}>← Patient details</button>
        </div>
        <p className="note">
          {fmr && (fmr.type === 4
            ? "All-on-4: the two front implants are upright, the two back implants are angled to avoid the sinus and nerve and use the available bone. "
            : `All-on-${fmr.type}: more implants spread the biting force across the jaw. `)}
          Numbers follow the FDI system: quadrant 1 upper right, 2 upper left, 3 lower left, 4 lower right. The chart is drawn as if you are facing the patient.
        </p>
      </div>
    </section>
  );
}
