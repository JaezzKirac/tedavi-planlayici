import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { encodePlan, patientLink } from "../lib/share.js";
import { api } from "../lib/api.js";

export default function SharePanel({ patient, plan, fmr, recordId, onSaved }) {
  // varsayılan: linkte yalnızca baş harfler
  const [useInitials, setUseInitials] = useState(true);
  const [link, setLink] = useState("");
  const [copied, setCopied] = useState(false);
  const [save, setSave] = useState({ state: "" });
  const qrRef = useRef(null);
  const inputRef = useRef(null);
  const timer = useRef(0);
  // kayıtlar sırayla gider: ilk kayıt bitmeden ikinci istek yeni bir hasta açmasın
  const idRef = useRef(recordId);
  const queue = useRef(Promise.resolve());
  useEffect(() => () => clearTimeout(timer.current), []);

  // link oluşturulduğu anda hasta, giriş yapan kişinin adına kaydedilir (aynı hasta için tekrar oluşturulursa güncellenir)
  function make(ini = useInitials) {
    const code = encodePlan(patient, plan, ini, fmr);
    setLink(patientLink(code));
    setSave({ state: "saving" });
    const body = { patient, plan, code, initials: ini, fmr };
    queue.current = queue.current.then(async () => {
      try {
        const { plan: rec } = idRef.current ? await api.updatePlan(idRef.current, body) : await api.createPlan(body);
        idRef.current = rec.id;
        onSaved?.(rec.id);
        setSave({ state: "saved" });
      } catch (e) {
        setSave({ state: "error", msg: e.message });
      }
    });
  }

  useEffect(() => {
    if (link && qrRef.current) QRCode.toCanvas(qrRef.current, link, { width: 264, margin: 1, errorCorrectionLevel: "M" }).catch(() => {});
  }, [link]);

  function copy() {
    const ok = () => { setCopied(true); clearTimeout(timer.current); timer.current = setTimeout(() => setCopied(false), 1600); };
    try { navigator.clipboard.writeText(link).then(ok, () => inputRef.current?.select()); } catch { inputRef.current?.select(); }
  }

  return (
    <div className="card share">
      <div className="label">Share with patient</div>
      <p className="note">Generating the link saves this patient to your dashboard. The patient only sees their own 3D treatment plan.</p>
      <label className="tog" htmlFor="initials">
        <input id="initials" type="checkbox" checked={useInitials} onChange={(e) => { setUseInitials(e.target.checked); if (link) make(e.target.checked); }} />
        Show initials instead of the full name in the link
      </label>
      <button className="btn" type="button" onClick={() => make()}>{link ? "Generate link again" : "Generate patient link"}</button>
      {save.state && (
        <p className={"savestate " + save.state} role="status">
          {save.state === "saving" ? "Saving to dashboard…" : save.state === "saved" ? "✓ Saved to your dashboard" : `Not saved: ${save.msg}. The link still works.`}
        </p>
      )}
      {link && (
        <div style={{ display: "grid", gap: 10 }}>
          <div className="linkrow">
            <input ref={inputRef} readOnly value={link} aria-label="Patient link" onFocus={(e) => e.target.select()} />
            <button className="btn ghost" type="button" onClick={copy}>{copied ? "Copied" : "Copy"}</button>
          </div>
          <div className="qrwrap">
            <div className="qr"><canvas ref={qrRef} /></div>
            <p className="note">The patient can scan this QR code with their phone to open the plan.</p>
          </div>
        </div>
      )}
    </div>
  );
}
