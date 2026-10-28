import { useEffect, useMemo, useRef, useState } from "react";
import { createJawScene } from "../three/JawScene.js";
import { buildTimeline, CHINFO, eventIndexAt, chapterIndexAt, fmtTime } from "../data/timeline.js";
import { fmtDate, hasE, hasI } from "../data/teeth.js";
import SharePanel from "./SharePanel.jsx";
import { CLINIC } from "../config.js";
const PlayIcon = () => <path d="M8 5v14l11-7z" />;
const PauseIcon = () => <path d="M7 5h4v14H7zM13 5h4v14h-4z" />;

export default function PlanView({ patient, plan, patientMode, onEdit, onNew, recordId, onSaved }) {
  const tl = useMemo(() => buildTimeline(plan), [plan]);
  const tlRef = useRef(tl);
  tlRef.current = tl;

  const canvasRef = useRef(null), stageRef = useRef(null), labelRef = useRef(null), leaderRef = useRef(null), xrayRef = useRef(null);
  const fillRef = useRef(null), timeRef = useRef(null), trackRef = useRef(null);
  const sceneRef = useRef(null);
  const pb = useRef({ t: 0, playing: false, idx: -1, week: -1 });

  const [idx, setIdx] = useState(0);
  const [week, setWeek] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [started, setStarted] = useState(false);
  const [glError, setGlError] = useState(false);

  // 3D sahne: plan değişince yeniden kurulur
  useEffect(() => {
    pb.current = { t: 0, playing: false, idx: -1, week: -1 };
    setIdx(0); setPlaying(false); setStarted(false);
    const scene = createJawScene({
      canvas: canvasRef.current,
      container: stageRef.current,
      labelEl: labelRef.current,
      leaderEl: leaderRef.current,
      xrayEl: xrayRef.current,
      driver: (dt) => {
        const { TL, TOTAL } = tlRef.current, s = pb.current;
        if (s.playing) {
          s.t += dt;
          if (s.t >= TOTAL) { s.t = TOTAL - 1; s.playing = false; setPlaying(false); }
        }
        const i = eventIndexAt(TL, s.t), e = TL[i];
        if (i !== s.idx) { s.idx = i; setIdx(i); }
        if (e.ch === "heal" || e.ch === "gheal") {
          // iyileşme: 0–12. hafta, kemikleşme: 1–6. ay
          const n = e.ch === "heal" ? 13 : 6;
          const wk = Math.min(n - 1, Math.floor(((s.t - e.start) / e.dur) * n));
          if (wk !== s.week) { s.week = wk; setWeek(wk); }
        }
        if (fillRef.current) fillRef.current.style.width = (s.t / TOTAL) * 100 + "%";
        if (timeRef.current) timeRef.current.textContent = `${fmtTime(s.t)} / ${fmtTime(TOTAL)}`;
        if (trackRef.current) trackRef.current.setAttribute("aria-valuetext", fmtTime(s.t));
        return { t: s.t, e, idle: !s.played, playing: s.playing };
      },
    });
    if (!scene) { setGlError(true); return undefined; }
    setGlError(false);
    scene.build(plan, tl.TE);
    sceneRef.current = scene;
    return () => { scene.dispose(); sceneRef.current = null; };
  }, [tl, plan]);

  const start = () => { const s = pb.current; s.playing = true; s.played = true; setPlaying(true); setStarted(true); };
  const play = () => { if (pb.current.t >= tlRef.current.TOTAL - 5) pb.current.t = 0; start(); };
  const pause = () => { pb.current.playing = false; setPlaying(false); };
  // sona yakın bir yere atlamak oynatmayı başa sarmamalı, bu yüzden play() değil start()
  const seek = (t) => { pb.current.t = Math.max(0, Math.min(tl.TOTAL - 1, t)); if (!pb.current.playing) start(); };
  const seekAt = (clientX) => { const r = trackRef.current.getBoundingClientRect(); seek(((clientX - r.left) / r.width) * tl.TOTAL); };
  const dragging = useRef(false);
  const onTrackKey = (ev) => {
    const step = { ArrowLeft: -5000, ArrowRight: 5000, PageDown: -15000, PageUp: 15000 }[ev.key];
    if (step) { ev.preventDefault(); seek(pb.current.t + step); }
    else if (ev.key === "Home") { ev.preventDefault(); seek(0); }
    else if (ev.key === "End") { ev.preventDefault(); seek(tl.TOTAL - 1); }
  };

  // boşluk tuşu: oynat / duraklat
  useEffect(() => {
    const onKey = (e) => {
      if (e.code === "Space" && e.target === document.body) { e.preventDefault(); pb.current.playing ? pause() : play(); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  const e = tl.TL[idx] || tl.TL[0];
  const info = CHINFO[e.ch];
  const ci = chapterIndexAt(tl.CH, e);
  let focusN = e.focus;
  for (let i = idx; i >= 0 && !focusN; i--) focusN = tl.TL[i].focus;
  if (!focusN) focusN = tl.keys[0];
  const cal = e.ch === "heal" ? `Healing · week ${week}` : e.ch === "gheal" ? `Bone maturation · month ${week + 1}` : info.cal;
  const extra = (e.ch === "ext" && hasI(plan, e.focus) && info.pImp) || (e.ch === "graft" && hasE(plan, e.focus) && info.pExt);

  return (
    <section style={{ display: "grid", gap: 18 }}>
      <div className="planhead">
        <div>
          <div className="label">{patientMode ? "Your treatment plan" : "Personal treatment plan"}</div>
          <h1>{patient.name}</h1>
          <div className="meta">{[patient.date && fmtDate(patient.date), patient.doc, `${tl.keys.length} ${tl.keys.length === 1 ? "tooth" : "teeth"}`].filter(Boolean).join(" · ")}</div>
        </div>
        {!patientMode && (
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button className="btn ghost" type="button" onClick={() => { pause(); onEdit(); }}>← Edit chart</button>
            <button className="btn ghost" type="button" onClick={() => { pause(); onNew(); }}>New patient</button>
          </div>
        )}
      </div>

      <div className="layout">
        <div className="card player">
          <div className="stage3d" ref={stageRef}>
            <canvas ref={canvasRef} className="gl" aria-label="3D treatment animation" />
            <span className="chip overlay-chip">{cal}</span>
            <span className="chip xray" ref={xrayRef} hidden>X-ray view</span>
            <div className="tleader" ref={leaderRef} hidden />
            <div className="tlabel" ref={labelRef} />
            <div className="hint3d">Drag: rotate · Right-click / two fingers: pan · Scroll: zoom</div>
            <div className="camtools">
              <button type="button" onClick={() => sceneRef.current?.camOverview()}>Overview</button>
              {focusN && <button type="button" onClick={() => sceneRef.current?.camTooth(focusN)}>{`Zoom to tooth ${focusN}`}</button>}
            </div>
            {!started && !glError && (
              <button className="bigplay" type="button" aria-label="Play" onClick={play}>
                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 4v16l13-8z" /></svg>
              </button>
            )}
            {glError && <p className="glerr">The 3D view could not start on this device. Please try again in an up-to-date browser.</p>}
          </div>
          <div className="caption swap" key={idx} aria-live="polite">
            <span className="num2">{`STEP ${ci + 1} / ${tl.CH.length} · ${info.d}`}</span>
            <h3>{info.t + (e.focus ? ` · tooth ${e.focus}` : "")}</h3>
            <p>{info.p + (extra ? " " + extra : "")}</p>
          </div>
          <div className="controls">
            <button className="pbtn" type="button" aria-label={playing ? "Pause" : "Play"} onClick={() => (playing ? pause() : play())}>
              <svg viewBox="0 0 24 24" fill="currentColor">{playing ? <PauseIcon /> : <PlayIcon />}</svg>
            </button>
            <div
              className="track"
              ref={trackRef}
              role="slider"
              tabIndex={0}
              aria-label="Animation time"
              aria-valuemin={0}
              aria-valuemax={Math.round(tl.TOTAL / 1000)}
              onKeyDown={onTrackKey}
              onPointerDown={(ev) => { dragging.current = true; ev.currentTarget.setPointerCapture(ev.pointerId); seekAt(ev.clientX); }}
              onPointerMove={(ev) => { if (dragging.current) seekAt(ev.clientX); }}
              onPointerUp={() => { dragging.current = false; }}
              onPointerCancel={() => { dragging.current = false; }}
            >
              <div className="base" />
              <div className="fill" ref={fillRef} />
              {tl.CH.slice(1).map((c) => <i key={c.start} className="tick" style={{ left: (c.start / tl.TOTAL) * 100 + "%" }} />)}
            </div>
            <span className="time" ref={timeRef} />
          </div>
        </div>

        <div className="side">
          <div className="card">
            <div className="label">Treatment steps</div>
            <ol className="chapters">
              {tl.CH.map((c, i) => (
                <li key={c.start} className={i === ci ? "active" : i < ci ? "done" : ""}>
                  <button type="button" onClick={() => seek(c.start)}>
                    <span className="n">{i + 1}</span>
                    <span><span className="t">{CHINFO[c.ch].t}</span><span className="d">{CHINFO[c.ch].d}</span></span>
                  </button>
                </li>
              ))}
            </ol>
          </div>
          <div className="summary">
            {tl.exts.length > 0 && <div><span className="label">Extraction</span><b>{tl.exts.length}</b></div>}
            {tl.grfs.length > 0 && <div><span className="label">Graft</span><b>{tl.grfs.length}</b></div>}
            <div><span className="label">Implant</span><b>{tl.imps.length}</b></div>
            <div><span className="label">Crown</span><b>{tl.crws.length}</b></div>
            <div><span className="label">Duration</span><b>{tl.grfs.length && tl.imps.length ? "7–12 mo" : tl.grfs.length ? "4–6 mo" : tl.imps.length ? "3–6 mo" : tl.crws.length ? "1–2 wks" : "1 visit"}</b></div>
          </div>
          <p className="note">Durations are averages. Your dentist will set your personal schedule based on your bone and general health.</p>
          {!patientMode && <SharePanel patient={patient} plan={plan} recordId={recordId} onSaved={onSaved} />}
          {patientMode && CLINIC.phone && <p className="note">{`Questions? ${CLINIC.name} · ${CLINIC.phone}`}</p>}
        </div>
      </div>
    </section>
  );
}
