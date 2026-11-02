import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { encodePlan, patientLink } from "../lib/share.js";
import { api } from "../lib/api.js";

export default function SharePanel({ patient, plan, fmr, record, onSaved }) {
  // varsayılan: linkte yalnızca baş harfler
  const [useInitials, setUseInitials] = useState(record ? !!record.initials : true);
  const [link, setLink] = useState("");
  const [copied, setCopied] = useState(false);
  const [save, setSave] = useState({ state: "" });
  const qrRef = useRef(null);
  const inputRef = useRef(null);
  const timer = useRef(0);
  // kayıtlar sırayla gider: ilk kayıt bitmeden ikinci istek yeni bir hasta açmasın
  const idRef = useRef(record?.id), savedCode = useRef(record?.code);
  const queue = useRef(Promise.resolve());
  useEffect(() => () => clearTimeout(timer.current), []);

  // plan ekranı açılınca link hazırlanır ve hasta giriş yapan kişinin adına kaydedilir
  // (aynı hasta için güncellenir; hiçbir şey değişmediyse sunucuya gidilmez)
  useEffect(() => { make(useInitials); }, []);

  function make(ini) {
    const code = encodePlan(patient, plan, ini, fmr);
    setLink(patientLink(code));
    if (idRef.current && code === savedCode.current) { setSave({ state: "saved" }); return; }
    setSave({ state: "saving" });
    const body = { patient, plan, code, initials: ini, fmr };
    queue.current = queue.current.then(async () => {
      try {
        const { plan: rec } = idRef.current ? await api.updatePlan(idRef.current, body) : await api.createPlan(body);
        idRef.current = rec.id; savedCode.current = rec.code;
        onSaved?.(rec);
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
      <p className="note">This patient is saved to your dashboard automatically. The patient only sees their own 3D treatment plan.</p>
      <label className="tog" htmlFor="initials">
        <input id="initials" type="checkbox" checked={useInitials} onChange={(e) => { setUseInitials(e.target.checked); make(e.target.checked); }} />
        Show initials instead of the full name in the link
      </label>
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
