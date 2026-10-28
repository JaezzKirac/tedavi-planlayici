import { useState } from "react";
import ToothChart from "./ToothChart.jsx";
import { hasE, hasG, hasI, hasC, toothName, txLabel, sortedKeys, fmtDate, fixTx } from "../data/teeth.js";

const TOOLS = [
  { id: "both", label: "Implant + Crown", dot: "linear-gradient(90deg,var(--ti) 50%,var(--crownC) 50%)" },
  { id: "implant", label: "Implant", dot: "var(--ti)" },
  { id: "crown", label: "Crown", dot: "var(--crownC)" },
  { id: "extract", label: "Extraction", dot: "var(--extC)" },
  { id: "graft", label: "Bone graft", dot: "var(--graftC)" },
  { id: "clear", label: "Clear", dot: "var(--line)" },
];

export default function ChartScreen({ patient, plan, setPlan, onBack, onNext }) {
  const [tool, setTool] = useState("both");
  const [hint, setHint] = useState("Pick a tool and tap a tooth. Tapping the same tooth again removes the mark.");
  const keys = sortedKeys(plan);

  function toggle(n) {
    const next = { ...plan };
    const cur = { ext: 0, grf: 0, imp: 0, crw: 0, ...(plan[n] || {}) };
    const hadImp = cur.imp;
    let note = "";
    if (tool === "clear") delete next[n];
    else {
      if (tool === "both") { const on = cur.imp && cur.crw; cur.imp = on ? 0 : 1; cur.crw = on ? 0 : 1; }
      if (tool === "implant") cur.imp = cur.imp ? 0 : 1;
      if (tool === "crown") cur.crw = cur.crw ? 0 : 1;
      if (tool === "extract") cur.ext = cur.ext ? 0 : 1;
      if (tool === "graft") cur.grf = cur.grf ? 0 : 1;
      note = fixTx(cur, hadImp && !cur.imp);
      if (cur.ext || cur.grf || cur.imp || cur.crw) next[n] = cur; else delete next[n];
    }
    setPlan(next);
    setHint(next[n] ? `${n} · ${toothName(n)} → ${txLabel(next, n)}${note}` : `${n} · ${toothName(n)} → mark removed`);
  }

  function remove(n) { const next = { ...plan }; delete next[n]; setPlan(next); }

  return (
    <section className="layout">
      <div className="card chartcard">
        <div className="chart-head">
          <div>
            <div className="label">{patient.name}{patient.date ? " · " + fmtDate(patient.date) : ""}</div>
            <h2>Dental chart</h2>
          </div>
          <div className="tools" role="group" aria-label="Treatment tool">
            {TOOLS.map((t) => (
              <button key={t.id} type="button" aria-pressed={tool === t.id} onClick={() => setTool(t.id)}>
                <span className="dot" style={{ background: t.dot }} />{t.label}
              </button>
            ))}
          </div>
        </div>
        <div className="hint" aria-live="polite">{hint}</div>
        <div className="archbox"><ToothChart plan={plan} onToggle={toggle} /></div>
      </div>
      <div className="side">
        <div className="card">
          <div className="label">Selected treatments</div>
          {keys.length ? (
            <ul className="plist">
              {keys.map((n) => (
                <li key={n}>
                  <span className="fdi">{n}</span>
                  <span className="nm">{toothName(n)}
                    <small>
                      {hasE(plan, n) && <span className="tag ext">EXTRACTION</span>}{" "}
                      {hasG(plan, n) && <span className="tag grf">GRAFT</span>}{" "}
                      {hasI(plan, n) && <span className="tag imp">IMPLANT</span>}{" "}
                      {hasC(plan, n) && <span className="tag crw">CROWN</span>}
                    </small>
                  </span>
                  <button className="x" type="button" onClick={() => remove(n)} aria-label={`Remove tooth ${n}`}>×</button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty">No teeth selected yet.</p>
          )}
          <button className="btn" type="button" disabled={!keys.length} onClick={onNext}>Create treatment plan →</button>
          <button className="btn ghost" type="button" onClick={onBack}>← Patient details</button>
        </div>
        <p className="note">Numbers follow the FDI system: quadrant 1 upper right, 2 upper left, 3 lower left, 4 lower right. The chart is drawn as if you are facing the patient.</p>
      </div>
    </section>
  );
}
