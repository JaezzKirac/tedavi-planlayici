import { lazy, Suspense, useEffect, useState } from "react";
import Intake from "./components/Intake.jsx";
import ChartScreen from "./components/ChartScreen.jsx";
import Login from "./components/Login.jsx";
import Dashboard from "./components/Dashboard.jsx";
import { readPlanFromUrl } from "./lib/share.js";
import { api } from "./lib/api.js";
import { DEMO } from "./data/teeth.js";
import { CLINIC } from "./config.js";
// 3D oynatıcı (Three.js) ayrı dosyada; ilk ekran daha hızlı açılır
const PlanView = lazy(() => import("./components/PlanView.jsx"));

const today = () => new Date().toISOString().slice(0, 10);
const STEPS = ["Patient", "Dental chart", "Treatment plan"];
const loading = <p className="loading">Loading treatment plan…</p>;

function Brand() {
  return (
    <div className="brand">
      <i aria-hidden="true">
        <svg viewBox="0 0 20 20" fill="currentColor"><path d="M6.6 2.5C4.5 2.5 3 4.2 3 6.6c0 2.2.8 3.7 1.3 5.7.5 2 .7 5.2 2.2 5.2 1.4 0 1.4-3.8 3.5-3.8s2.1 3.8 3.5 3.8c1.5 0 1.7-3.2 2.2-5.2.5-2 1.3-3.5 1.3-5.7 0-2.4-1.5-4.1-3.6-4.1-1.6 0-2.3.9-3.4.9s-1.8-.9-3.4-.9z" /></svg>
      </i>
      <span>Treatment Planner</span>
    </div>
  );
}

export default function App() {
  // #p=... (ya da eski ?p=...) ile açılırsa giriş gerekmeyen hasta görünümü
  const [fromUrl] = useState(() => readPlanFromUrl());
  return fromUrl ? <PatientView fromUrl={fromUrl} /> : <StaffApp />;
}

function PatientView({ fromUrl }) {
  const ok = fromUrl.patient && Object.keys(fromUrl.plan).length > 0;
  useEffect(() => { document.title = ok ? `${fromUrl.patient.name} · Treatment plan` : CLINIC.name; }, [ok, fromUrl]);
  return (
    <div className="wrap">
      <div className="top"><Brand /></div>
      {ok ? (
        <Suspense fallback={loading}>
          <PlanView patient={fromUrl.patient} plan={fromUrl.plan} fmr={fromUrl.fmr} patientMode />
        </Suspense>
      ) : (
        <section className="card intake">
          <div className="label">Treatment plan</div>
          <h1>This link could not be opened</h1>
          <p>The link may have been copied incompletely. Please ask your clinic to send it again.</p>
        </section>
      )}
    </div>
  );
}

function StaffApp() {
  const [user, setUser] = useState(undefined); // undefined: yükleniyor, null: giriş yok
  const [authErr, setAuthErr] = useState("");
  const [view, setView] = useState("dashboard"); // "dashboard" | "create"
  const [step, setStep] = useState(1);
  const [patient, setPatient] = useState({ name: "", date: today(), doc: "" });
  const [plan, setPlan] = useState({});
  const [recordId, setRecordId] = useState(null);
  const [fmr, setFmr] = useState(null); // tam ağız restorasyonu: { type: 4|6|8, arches: "U"|"L"|"UL" }

  const checkSession = () => {
    setAuthErr("");
    api.me().then((d) => setUser(d.user), (e) => (e.status === 401 ? setUser(null) : setAuthErr(e.message)));
  };
  useEffect(checkSession, []);
  useEffect(() => { document.title = `${CLINIC.name} · Treatment Planner`; }, []);
  useEffect(() => { window.scrollTo({ top: 0, behavior: "smooth" }); }, [step, view]);

  const newPlan = () => {
    setPatient({ name: "", date: today(), doc: user?.name || "" });
    setPlan({}); setFmr(null); setRecordId(null); setStep(1); setView("create");
  };
  const openRecord = (rec) => {
    setPatient(rec.patient); setPlan(rec.plan); setFmr(rec.fmr || null); setRecordId(rec.id); setStep(3); setView("create");
  };
  const logout = async () => {
    try { await api.logout(); } catch { /* çerez yine de süresi dolunca geçersiz olur */ }
    setUser(null); setView("dashboard");
  };

  let body;
  if (authErr) {
    body = (
      <section className="card intake">
        <div className="label">Connection problem</div>
        <h1>Can't reach the server</h1>
        <p>{authErr}</p>
        <div><button className="btn" type="button" onClick={checkSession}>Try again</button></div>
      </section>
    );
  } else if (user === undefined) {
    body = <p className="loading">Loading…</p>;
  } else if (!user) {
    body = <Login onLogin={(u) => { setUser(u); setView("dashboard"); }} />;
  } else if (view === "dashboard") {
    body = <Dashboard user={user} onOpen={openRecord} onNew={newPlan} />;
  } else {
    body = (
      <>
        <div className="progress" aria-label="Progress">
          {STEPS.map((s, i) => (
            <span key={s} className={i + 1 === step ? "on" : i + 1 < step ? "ok" : ""}>{`${i + 1} · ${s}`}</span>
          ))}
        </div>
        {step === 1 && (
          <Intake
            patient={patient}
            onChange={setPatient}
            onSubmit={() => setStep(2)}
            onDemo={() => { setPatient({ ...patient, ...DEMO.patient }); setPlan(DEMO.plan); setFmr(null); setStep(2); }}
          />
        )}
        {step === 2 && <ChartScreen patient={patient} plan={plan} setPlan={setPlan} fmr={fmr} setFmr={setFmr} onBack={() => setStep(1)} onNext={() => setStep(3)} />}
        {step === 3 && (
          <Suspense fallback={loading}>
            <PlanView
              patient={patient}
              plan={plan}
              fmr={fmr}
              recordId={recordId}
              onSaved={setRecordId}
              onEdit={() => setStep(2)}
              onNew={newPlan}
            />
          </Suspense>
        )}
      </>
    );
  }

  return (
    <div className="wrap">
      <div className="top">
        <Brand />
        {user && (
          <nav className="nav" aria-label="Main">
            <button type="button" className={view === "dashboard" ? "on" : ""} aria-current={view === "dashboard" ? "page" : undefined} onClick={() => setView("dashboard")}>
              {user.role === "admin" ? "Admin dashboard" : "My dashboard"}
            </button>
            <button type="button" className={view === "create" ? "on" : ""} onClick={newPlan}>+ New plan</button>
            <span className="me">
              <span className="av" aria-hidden="true">{user.name[0]}</span>
              <span>{user.name}{user.role === "admin" && <small>Admin</small>}</span>
            </span>
            <button type="button" className="out" onClick={logout}>Sign out</button>
          </nav>
        )}
      </div>
      {body}
    </div>
  );
}
