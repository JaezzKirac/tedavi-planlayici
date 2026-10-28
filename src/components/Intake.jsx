import { useState } from "react";

export default function Intake({ patient, onChange, onSubmit, onDemo }) {
  const [err, setErr] = useState(false);
  const set = (k) => (e) => onChange({ ...patient, [k]: e.target.value });

  function submit(e) {
    e.preventDefault();
    if (!patient.name.trim()) { setErr(true); return; }
    setErr(false);
    onSubmit();
  }

  return (
    <section className="card intake">
      <div className="label">New treatment plan</div>
      <h1>Patient details</h1>
      <p>Enter the patient's name, then mark the teeth to treat on the dental chart.</p>
      <form onSubmit={submit} noValidate style={{ display: "grid", gap: 14 }}>
        <div className="field">
          <label className="label" htmlFor="pname">Full name</label>
          <input id="pname" autoComplete="off" placeholder="e.g. Jane Smith" value={patient.name} onChange={set("name")} autoFocus />
        </div>
        <div className="row2">
          <div className="field">
            <label className="label" htmlFor="pdate">Date</label>
            <input id="pdate" type="date" value={patient.date} onChange={set("date")} />
          </div>
          <div className="field">
            <label className="label" htmlFor="pdoc">Dentist</label>
            <input id="pdoc" autoComplete="off" placeholder="Dr. …" value={patient.doc} onChange={set("doc")} />
          </div>
        </div>
        {err && <p className="err">Enter the patient's name to continue.</p>}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <button className="btn" type="submit">Open dental chart →</button>
          <button className="btn link" type="button" onClick={onDemo}>Try with a sample patient</button>
        </div>
      </form>
    </section>
  );
}
