import { useState } from "react";
import { STAFF } from "../config.js";
import { api } from "../lib/api.js";

const LAST = "lastUser";
const readLast = () => { try { return localStorage.getItem(LAST) || ""; } catch { return ""; } };

export default function Login({ onLogin }) {
  const [user, setUser] = useState(readLast);
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (!user) { setErr("Choose your name."); return; }
    if (!password) { setErr("Enter your password."); return; }
    setBusy(true); setErr("");
    try {
      const d = await api.login(user, password);
      try { localStorage.setItem(LAST, user); } catch { /* gizli pencere */ }
      onLogin(d.user);
    } catch (e2) {
      setErr(e2.status === 401 ? "Wrong name or password." : e2.message);
      setPassword("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card intake">
      <div className="label">Clinic staff</div>
      <h1>Sign in</h1>
      <p>Treatment plans you share with patients are saved to your own dashboard.</p>
      <form onSubmit={submit} noValidate style={{ display: "grid", gap: 16 }}>
        <fieldset className="who">
          <legend className="label">Who are you?</legend>
          <div className="whogrid">
            {STAFF.map((s) => (
              <label key={s.id} className={"whoopt" + (user === s.id ? " on" : "")}>
                <input type="radio" name="user" value={s.id} checked={user === s.id} onChange={() => setUser(s.id)} />
                <span className="av" aria-hidden="true">{s.name[0]}</span>
                {s.name}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="field">
          <label className="label" htmlFor="pw">Password</label>
          <input id="pw" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        {err && <p className="err" role="alert">{err}</p>}
        <div>
          <button className="btn" type="submit" disabled={busy}>{busy ? "Signing in…" : "Sign in →"}</button>
        </div>
      </form>
    </section>
  );
}
