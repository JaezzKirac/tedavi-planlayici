import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api.js";
import { patientLink } from "../lib/share.js";
import { fmtDate } from "../data/teeth.js";
import { STAFF } from "../config.js";

const fmtWhen = (ms) => new Date(ms).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
const KINDS = [["ext", "Extraction", "ext"], ["grf", "Graft", "grf"], ["imp", "Implant", "imp"], ["crw", "Crown", "crw"]];

function counts(plan) {
  const c = { ext: 0, grf: 0, imp: 0, crw: 0 };
  Object.values(plan || {}).forEach((t) => KINDS.forEach(([k]) => { if (t[k]) c[k]++; }));
  return c;
}

export default function Dashboard({ user, onOpen, onNew }) {
  const admin = user.role === "admin";
  const [plans, setPlans] = useState(null);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [owner, setOwner] = useState("all");
  const [copied, setCopied] = useState("");

  const load = () => {
    setError("");
    api.plans().then((d) => setPlans(d.plans), (e) => setError(e.message));
  };
  useEffect(load, []);

  const rows = useMemo(() => {
    const needle = q.trim().toLocaleLowerCase("en");
    return (plans || []).filter((p) => (owner === "all" || p.owner === owner) && (!needle || p.patient.name.toLocaleLowerCase("en").includes(needle)));
  }, [plans, q, owner]);

  const stats = useMemo(() => {
    const now = new Date(), from = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const tot = { ext: 0, grf: 0, imp: 0, crw: 0 };
    rows.forEach((p) => { const c = counts(p.plan); KINDS.forEach(([k]) => (tot[k] += c[k])); });
    return { patients: rows.length, month: rows.filter((p) => p.createdAt >= from).length, ...tot };
  }, [rows]);

  const byOwner = useMemo(() => {
    const m = {};
    (plans || []).forEach((p) => (m[p.owner] = (m[p.owner] || 0) + 1));
    return m;
  }, [plans]);

  function copy(p) {
    navigator.clipboard?.writeText(patientLink(p.code)).then(() => { setCopied(p.id); setTimeout(() => setCopied(""), 1500); }, () => {});
  }

  return (
    <section style={{ display: "grid", gap: 18 }}>
      <div className="planhead">
        <div>
          <div className="label">{admin ? "Admin · all staff" : `Signed in as ${user.name}`}</div>
          <h1>{admin ? "All patients" : "My patients"}</h1>
          <div className="meta">{admin ? "Every treatment plan created by the team." : "Patients you created a 3D treatment plan for."}</div>
        </div>
        <button className="btn" type="button" onClick={onNew}>+ New treatment plan</button>
      </div>

      <div className="stats">
        <div><span className="label">Patients</span><b>{stats.patients}</b></div>
        <div><span className="label">This month</span><b>{stats.month}</b></div>
        <div><span className="label">Implants</span><b>{stats.imp}</b></div>
        <div><span className="label">Crowns</span><b>{stats.crw}</b></div>
        <div><span className="label">Extractions</span><b>{stats.ext}</b></div>
        <div><span className="label">Grafts</span><b>{stats.grf}</b></div>
      </div>

      <div className="card dash">
        <div className="dashbar">
          <input className="search" type="search" placeholder="Search patients…" aria-label="Search patients" value={q} onChange={(e) => setQ(e.target.value)} />
          {admin && (
            <div className="tools" role="group" aria-label="Filter by staff member">
              <button type="button" aria-pressed={owner === "all"} onClick={() => setOwner("all")}>All <small>{plans ? plans.length : ""}</small></button>
              {STAFF.map((s) => (
                <button key={s.id} type="button" aria-pressed={owner === s.id} onClick={() => setOwner(s.id)}>{s.name} <small>{byOwner[s.id] || 0}</small></button>
              ))}
            </div>
          )}
        </div>

        {error && (
          <p className="err" role="alert">Could not load plans: {error} <button className="btn link" type="button" onClick={load}>Try again</button></p>
        )}
        {!error && !plans && <p className="empty">Loading…</p>}
        {plans && !rows.length && (
          <div className="dashempty">
            <p className="empty">{plans.length ? "No patients match this filter." : "No patients yet. When you generate a patient link, the patient appears here."}</p>
            {!plans.length && <button className="btn ghost" type="button" onClick={onNew}>Create your first plan</button>}
          </div>
        )}
        {rows.length > 0 && (
          <ul className={"prow-list" + (admin ? " admin" : "")}>
            <li className="prow head" aria-hidden="true">
              <span>Patient</span><span>Treatments</span>{admin && <span>Created by</span>}<span>Created</span><span />
            </li>
            {rows.map((p) => {
              const c = counts(p.plan);
              return (
                <li key={p.id} className="prow">
                  <span className="pt">
                    <b>{p.patient.name}</b>
                    <small>{[p.patient.date && fmtDate(p.patient.date), p.patient.doc].filter(Boolean).join(" · ")}</small>
                  </span>
                  <span className="tx">
                    {KINDS.map(([k, label, cls]) => c[k] > 0 && <span key={k} className={"tag " + cls}>{`${c[k]} ${label}`}</span>)}
                  </span>
                  {admin && <span className="by"><span className="av" aria-hidden="true">{(p.ownerName || p.owner)[0]}</span>{p.ownerName || p.owner}</span>}
                  <span className="when">{fmtWhen(p.createdAt)}</span>
                  <span className="act">
                    <button className="btn ghost sm" type="button" onClick={() => copy(p)}>{copied === p.id ? "Copied" : "Copy link"}</button>
                    <button className="btn sm" type="button" onClick={() => onOpen(p)}>Open</button>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
