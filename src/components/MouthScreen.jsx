import { useState } from "react";
import ToothChart from "./ToothChart.jsx";
import { toothName, fmtDate, ARCH_ORDER, MOUTH_STATES } from "../data/teeth.js";

// Tedaviden önce hastanın ağzının şu anki hâli: her diş ağızda (doğal), eksik, kronlu ya da implantlı
const TOOLS = [
  { id: "m", label: "Missing", dot: "var(--line)" },
  { id: "c", label: "Existing crown", dot: "var(--exC)" },
  { id: "i", label: "Existing implant", dot: "var(--ti-dark)" },
  { id: "", label: "Natural tooth", dot: "var(--tooth-edge)" },
];
const HINT = "Mark how the patient's mouth looks today. Every tooth starts as a natural tooth; tap to mark it missing, crowned or with an implant.";

export default function MouthScreen({ patient, mouth, setMouth, onBack, onNext }) {
  const [tool, setTool] = useState("m");
  const [hint, setHint] = useState(HINT);

  const set = (next) => setMouth(Object.fromEntries(Object.entries(next).filter(([, v]) => v)));

  function toggle(n) {
    const cur = mouth[n] || "", st = cur === tool ? "" : tool;
    set({ ...mouth, [n]: st });
    setHint(`${n} · ${toothName(n)} → ${MOUTH_STATES[st]}`);
  }

  // seçili durumu bütün çeneye uygular; kron ve implant 20 yaş dişlerine uygulanmaz
  function applyAll(arch) {
    const list = ARCH_ORDER.filter((n) => (arch === "A" || (arch === "U") === n < 30) && (tool === "m" || tool === "" || n % 10 <= 7));
    const next = { ...mouth };
    list.forEach((n) => { next[n] = tool; });
    set(next);
    setHint(`${MOUTH_STATES[tool]}: ${list.length} teeth`);
  }

  function wisdomMissing() {
    const next = { ...mouth };
    [18, 28, 38, 48].forEach((n) => { next[n] = "m"; });
    set(next);
    setHint("Wisdom teeth marked as missing");
  }

  const of = (st) => ARCH_ORDER.filter((n) => mouth[n] === st).sort((a, b) => a - b);
  const groups = [["m", "Missing"], ["c", "Existing crowns"], ["i", "Existing implants"]];

  return (
    <section className="layout">
      <div className="card chartcard">
        <div className="chart-head">
          <div>
            <div className="label">{patient.name}{patient.date ? " · " + fmtDate(patient.date) : ""}</div>
            <h2>Current mouth</h2>
          </div>
        </div>
        <div className="tools" role="group" aria-label="Tooth state">
          {TOOLS.map((t) => (
            <button key={t.id || "nat"} type="button" aria-pressed={tool === t.id} onClick={() => setTool(t.id)}>
              <span className="dot" style={{ background: t.dot }} />{t.label}
            </button>
          ))}
        </div>
        <div className="tools" role="group" aria-label="Apply to a whole jaw">
          {[["U", "All upper"], ["L", "All lower"], ["A", "All teeth"]].map(([a, label]) => (
            <button key={a} type="button" onClick={() => applyAll(a)}>{label}</button>
          ))}
          <button type="button" onClick={wisdomMissing}>Wisdom teeth missing</button>
        </div>
        <div className="hint" aria-live="polite">{hint}</div>
        <div className="archbox"><ToothChart plan={{}} mouth={mouth} onToggle={toggle} /></div>
      </div>
      <div className="side">
        <div className="card">
          <div className="sidehead">
            <div className="label">Patient's mouth today</div>
            <button className="btn ghost sm clearall" type="button" disabled={!Object.keys(mouth).length} onClick={() => { setMouth({}); setHint("All teeth reset to natural."); }}>Clear all</button>
          </div>
          <dl className="fmrsum">
            {groups.map(([st, label]) => (
              <div key={st}><dt>{label}</dt><dd>{of(st).length ? of(st).join(", ") : "none"}</dd></div>
            ))}
            <div className="tot"><span><b>{32 - of("m").length}</b> teeth present</span></div>
          </dl>
          <button className="btn" type="button" onClick={onNext}>Next: treatment plan →</button>
          <button className="btn ghost" type="button" onClick={onBack}>← Patient details</button>
        </div>
        <p className="note">Unmarked teeth are natural teeth. Numbers follow the FDI system: quadrant 1 upper right, 2 upper left, 3 lower left, 4 lower right. The chart is drawn as if you are facing the patient.</p>
      </div>
    </section>
  );
}
