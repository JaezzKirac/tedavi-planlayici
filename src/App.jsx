import { lazy, Suspense, useEffect, useState } from "react";
import Intake from "./components/Intake.jsx";
import ChartScreen from "./components/ChartScreen.jsx";
// 3D oynatıcı (Three.js) ayrı dosyada; ilk ekran daha hızlı açılır
const PlanView = lazy(() => import("./components/PlanView.jsx"));
import { readPlanFromUrl } from "./lib/share.js";
import { DEMO } from "./data/teeth.js";
import { CLINIC } from "./config.js";
const today = () => new Date().toISOString().slice(0, 10);
const STEPS = ["Hasta", "Diş şeması", "Tedavi planı"];

export default function App() {
  // ?p=... ile açılırsa hasta görünümü
  const [fromUrl] = useState(() => readPlanFromUrl());
  const patientMode = !!fromUrl;
  const linkOk = patientMode && fromUrl.patient && Object.keys(fromUrl.plan).length > 0;

  const [step, setStep] = useState(linkOk ? 3 : 1);
  const [patient, setPatient] = useState(linkOk ? fromUrl.patient : { name: "", date: today(), doc: "" });
  const [plan, setPlan] = useState(linkOk ? fromUrl.plan : {});

  useEffect(() => { window.scrollTo({ top: 0, behavior: "smooth" }); }, [step]);
  useEffect(() => { document.title = patientMode && linkOk ? `${patient.name} · Tedavi planı` : CLINIC.name; }, [patientMode, linkOk, patient.name]);

  return (
    <div className="wrap">
      <div className="top">
        <div className="brand">
          <i aria-hidden="true">
            <svg viewBox="0 0 20 20" fill="currentColor"><path d="M6.6 2.5C4.5 2.5 3 4.2 3 6.6c0 2.2.8 3.7 1.3 5.7.5 2 .7 5.2 2.2 5.2 1.4 0 1.4-3.8 3.5-3.8s2.1 3.8 3.5 3.8c1.5 0 1.7-3.2 2.2-5.2.5-2 1.3-3.5 1.3-5.7 0-2.4-1.5-4.1-3.6-4.1-1.6 0-2.3.9-3.4.9s-1.8-.9-3.4-.9z" /></svg>
          </i>
          <span>Tedavi Planlayıcı</span>
        </div>
        {!patientMode && (
          <div className="progress">
            {STEPS.map((s, i) => (
              <span key={s} className={i + 1 === step ? "on" : i + 1 < step ? "ok" : ""}>{`${i + 1} · ${s}`}</span>
            ))}
          </div>
        )}
      </div>

      {patientMode && !linkOk && (
        <section className="card intake">
          <div className="label">Tedavi planı</div>
          <h1>Bu link açılamadı</h1>
          <p>Link eksik kopyalanmış olabilir. Lütfen kliniğinizden linki tekrar isteyin.</p>
        </section>
      )}

      {!patientMode && step === 1 && (
        <Intake
          patient={patient}
          onChange={setPatient}
          onSubmit={() => setStep(2)}
          onDemo={() => { setPatient({ ...patient, ...DEMO.patient }); setPlan(DEMO.plan); setStep(2); }}
        />
      )}
      {!patientMode && step === 2 && (
        <ChartScreen patient={patient} plan={plan} setPlan={setPlan} onBack={() => setStep(1)} onNext={() => setStep(3)} />
      )}
      {step === 3 && (patientMode ? linkOk : true) && (
        <Suspense fallback={<p className="loading">Tedavi planı yükleniyor…</p>}>
          <PlanView
            patient={patient}
            plan={plan}
            patientMode={patientMode}
            onEdit={() => setStep(2)}
            onNew={() => { setPlan({}); setPatient({ name: "", date: today(), doc: "" }); setStep(1); }}
          />
        </Suspense>
      )}
    </div>
  );
}
