import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { encodePlan, patientLink } from "../lib/share.js";

export default function SharePanel({ patient, plan }) {
  // varsayılan: linkte yalnızca baş harfler (KVKK açısından daha güvenli)
  const [useInitials, setUseInitials] = useState(true);
  const [link, setLink] = useState("");
  const [copied, setCopied] = useState(false);
  const qrRef = useRef(null);
  const inputRef = useRef(null);
  const timer = useRef(0);
  useEffect(() => () => clearTimeout(timer.current), []);

  const make = (ini = useInitials) => setLink(patientLink(encodePlan(patient, plan, ini)));

  useEffect(() => {
    if (link && qrRef.current) QRCode.toCanvas(qrRef.current, link, { width: 264, margin: 1, errorCorrectionLevel: "M" }).catch(() => {});
  }, [link]);

  function copy() {
    const ok = () => { setCopied(true); clearTimeout(timer.current); timer.current = setTimeout(() => setCopied(false), 1600); };
    try { navigator.clipboard.writeText(link).then(ok, () => inputRef.current?.select()); } catch { inputRef.current?.select(); }
  }

  return (
    <div className="card share">
      <div className="label">Hastayla paylaş</div>
      <p className="note">Plan linkin içine yazılır, sunucuda saklanmaz. Hasta linki açtığında yalnızca kendi 3D tedavi planını görür.</p>
      <label className="tog" htmlFor="initials">
        <input id="initials" type="checkbox" checked={useInitials} onChange={(e) => { setUseInitials(e.target.checked); if (link) make(e.target.checked); }} />
        Linkte ad yerine baş harfler görünsün
      </label>
      <button className="btn" type="button" onClick={() => make()}>Hasta linkini oluştur</button>
      {link && (
        <div style={{ display: "grid", gap: 10 }}>
          <div className="linkrow">
            <input ref={inputRef} readOnly value={link} aria-label="Hasta linki" onFocus={(e) => e.target.select()} />
            <button className="btn ghost" type="button" onClick={copy}>{copied ? "Kopyalandı" : "Kopyala"}</button>
          </div>
          <div className="qrwrap">
            <div className="qr"><canvas ref={qrRef} /></div>
            <p className="note">Hasta bu QR kodu telefonuyla okutarak planını açabilir.</p>
          </div>
        </div>
      )}
    </div>
  );
}
