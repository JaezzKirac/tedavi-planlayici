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
      <div className="label">Yeni tedavi planı</div>
      <h1>Hasta bilgileri</h1>
      <p>Hastanın adını girin, ardından diş şemasında tedavi edilecek dişleri işaretleyin.</p>
      <form onSubmit={submit} noValidate style={{ display: "grid", gap: 14 }}>
        <div className="field">
          <label className="label" htmlFor="pname">Ad soyad</label>
          <input id="pname" autoComplete="off" placeholder="Örn. Ayşe Yılmaz" value={patient.name} onChange={set("name")} autoFocus />
        </div>
        <div className="row2">
          <div className="field">
            <label className="label" htmlFor="pdate">Tarih</label>
            <input id="pdate" type="date" value={patient.date} onChange={set("date")} />
          </div>
          <div className="field">
            <label className="label" htmlFor="pdoc">Hekim</label>
            <input id="pdoc" autoComplete="off" placeholder="Dt. …" value={patient.doc} onChange={set("doc")} />
          </div>
        </div>
        {err && <p className="err">Devam etmek için hastanın adını yazın.</p>}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <button className="btn" type="submit">Diş şemasını aç →</button>
          <button className="btn link" type="button" onClick={onDemo}>Örnek hasta ile dene</button>
        </div>
      </form>
    </section>
  );
}
