import { useEffect, useMemo, useRef, useState } from "react";
import { createJawScene } from "../three/JawScene.js";
import { buildTimeline, chInfo, captionOf, eventIndexAt, chapterIndexAt, fmtTime } from "../data/timeline.js";
import { fmtDate, fmrLabel } from "../data/teeth.js";
import { encodePlan } from "../lib/share.js";
import { api } from "../lib/api.js";
import { CLINIC } from "../config.js";
const PlayIcon = () => <path d="M8 5v14l11-7z" />;
const PauseIcon = () => <path d="M7 5h4v14H7zM13 5h4v14h-4z" />;
const SPEEDS = [1, 1.5, 2, 3];

export default function PlanView({ patient, plan, fmr = null, mouth = {}, patientMode, onEdit, onNew, record, onSaved }) {
  const tl = useMemo(() => buildTimeline(plan, { fmr }), [plan, fmr]);
  const tlRef = useRef(tl);
  tlRef.current = tl;

  const canvasRef = useRef(null), stageRef = useRef(null), labelRef = useRef(null), leaderRef = useRef(null), xrayRef = useRef(null);
  const fillRef = useRef(null), timeRef = useRef(null), trackRef = useRef(null);
  const sceneRef = useRef(null);
  const pb = useRef({ t: 0, playing: false, idx: -1, speed: 1 });

  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [exporting, setExporting] = useState(null); // video hazırlanırken 0–1 arası ilerleme
  const [videoErr, setVideoErr] = useState("");
  const abortRef = useRef(null);
  const [saveState, setSaveState] = useState(null);

  // plan ekranı açılınca hasta giriş yapan kişinin adına kaydedilir (aynı hasta güncellenir; değişiklik yoksa sunucuya gidilmez).
  // Paneldeki "Copy link" bu kayıttaki kodu kullanır; linkte baş harfler yazar.
  useEffect(() => {
    if (patientMode) return;
    const initials = record ? !!record.initials : true, code = encodePlan(patient, plan, initials, fmr, mouth);
    if (record && record.code === code) { setSaveState({ state: "saved" }); return; }
    setSaveState({ state: "saving" });
    const body = { patient, plan, mouth, code, initials, fmr };
    (record ? api.updatePlan(record.id, body) : api.createPlan(body)).then(
      (d) => { onSaved?.(d.plan); setSaveState({ state: "saved" }); },
      (e) => setSaveState({ state: "error", msg: e.message }),
    );
  }, []);
  const [started, setStarted] = useState(false);
  const [glError, setGlError] = useState(false);

  // 3D sahne: plan değişince yeniden kurulur
  useEffect(() => {
    pb.current = { t: 0, playing: false, idx: -1, speed: pb.current.speed };
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
          s.t += dt * s.speed;
          if (s.t >= TOTAL) { s.t = TOTAL - 1; s.playing = false; setPlaying(false); }
        }
        const i = eventIndexAt(TL, s.t), e = TL[i];
        if (i !== s.idx) { s.idx = i; setIdx(i); }
        // yalnızca zaman değişince DOM'a yazılır
        if (s.t !== s.shown) {
          s.shown = s.t;
          if (fillRef.current) fillRef.current.style.width = (s.t / TOTAL) * 100 + "%";
          const label = fmtTime(s.t);
          if (label !== s.label) {
            s.label = label;
            if (timeRef.current) timeRef.current.textContent = `${label} / ${fmtTime(TOTAL)}`;
            if (trackRef.current) trackRef.current.setAttribute("aria-valuetext", label);
          }
        }
        return { t: s.t, e, idle: !s.played, playing: s.playing, speed: s.speed };
      },
    });
    if (!scene) { setGlError(true); return undefined; }
    setGlError(false);
    scene.build(plan, tl.TE, fmr, mouth);
    sceneRef.current = scene;
    return () => { abortRef.current?.abort(); scene.dispose(); sceneRef.current = null; };
  }, [tl, plan, fmr, mouth]);

  const start = () => { const s = pb.current; s.playing = true; s.played = true; setPlaying(true); setStarted(true); };
  const play = () => { if (pb.current.t >= tlRef.current.TOTAL - 5) pb.current.t = 0; sceneRef.current?.autoCamera(); start(); };
  const pause = () => { pb.current.playing = false; setPlaying(false); };
  const setRate = (x) => { pb.current.speed = x; setSpeed(x); };

  // seçili hızda MP4 üretir ve indirir; video modülü (kodlayıcı) yalnızca gerekince yüklenir
  async function downloadVideo() {
    pause(); setVideoErr(""); setExporting(0);
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      const { exportVideo } = await import("../lib/exportVideo.js");
      const blob = await exportVideo({ scene: sceneRef.current, tl, plan, fmr, mouth, speed, signal: ac.signal, onProgress: setExporting });
      const url = URL.createObjectURL(blob), a = document.createElement("a");
      a.href = url; a.download = `treatment-plan-${patient.name.trim().replace(/\s+/g, "-") || "patient"}.mp4`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (err) {
      if (!ac.signal.aborted) setVideoErr(err.message || "The video could not be created.");
    } finally {
      abortRef.current = null;
      setExporting(null);
    }
  }
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
  const info = chInfo(e.ch, fmr);
  const ci = chapterIndexAt(tl.CH, e);
  let focusN = e.focus;
  for (let i = idx; i >= 0 && !focusN; i--) focusN = tl.TL[i].focus;
  if (!focusN) focusN = tl.keys[0];
  const cal = info.cal;
  const cap = captionOf(e, plan, fmr, mouth);

  return (
    <section className={"planview" + (exporting !== null ? " busy" : "")}>
      {!patientMode && <div className="planhead">
        <div>
          <div className="label">{(patientMode ? "Your treatment plan" : "Personal treatment plan") + (fmr ? ` · ${fmrLabel(fmr)}` : "")}</div>
          <h1>{patient.name}</h1>
          <div className="meta">{[patient.date && fmtDate(patient.date), patient.doc, `${tl.keys.length} ${tl.keys.length === 1 ? "tooth" : "teeth"}`].filter(Boolean).join(" · ")}</div>
          {saveState && (
            <p className={"savestate " + saveState.state} role="status">
              {saveState.state === "saving" ? "Saving to dashboard…" : saveState.state === "saved" ? "✓ Saved to your dashboard" : `Not saved: ${saveState.msg}`}
            </p>
          )}
        </div>
        {!patientMode && (
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button className="btn ghost" type="button" onClick={() => { pause(); onEdit(); }}>← Edit treatment</button>
            <button className="btn ghost" type="button" onClick={() => { pause(); onNew(); }}>New patient</button>
          </div>
        )}
      </div>}

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
            {exporting !== null && (
              <div className="exporting" role="status">
                <b>Preparing video… {Math.round(exporting * 100)}%</b>
                <div className="bar"><i style={{ width: exporting * 100 + "%" }} /></div>
                <button className="btn ghost sm" type="button" onClick={() => abortRef.current?.abort()}>Cancel</button>
              </div>
            )}
            {glError && <p className="glerr">The 3D view could not start on this device. Please try again in an up-to-date browser.</p>}
          </div>
          <div className="caption swap" key={idx} aria-live="polite">
            <span className="num2">{`STEP ${ci + 1} / ${tl.CH.length}`}</span>
            <h3>{cap.title}</h3>
            <p>{cap.text}</p>
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
            <div className="speed" role="group" aria-label="Playback speed">
              {SPEEDS.map((x) => <button key={x} type="button" aria-pressed={speed === x} onClick={() => setRate(x)}>{x}×</button>)}
            </div>
            {!patientMode && !glError && typeof VideoEncoder !== "undefined" && (
              <button className="btn ghost sm" type="button" disabled={exporting !== null} onClick={downloadVideo}>Download video</button>
            )}
            {videoErr && <p className="err videoerr" role="alert">{videoErr}</p>}
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
                    <span className="t">{chInfo(c.ch, fmr).t}</span>
                  </button>
                </li>
              ))}
            </ol>
          </div>
          <div className="summary">
            {[
              ["Extraction", tl.exts], ["Graft", tl.grfs], ["Sinus lift", tl.sins], ["Root canal", tl.rcts], ["Filling", tl.fils],
              ["Implant", tl.regImps], ["Zygomatic implant", tl.zygs], ["Pterygoid implant", tl.ptys], ["Crown", tl.crws], ["Crown replacement", tl.rpls], ["Veneer", tl.vens],
            ].filter(([, list]) => list.length).map(([label, list]) => <div key={label}><span className="label">{label}</span><b>{list.length}</b></div>)}
            {fmr && <div><span className="label">Bridge</span><b>{tl.bridges}</b></div>}
          </div>
          {patientMode && CLINIC.phone && <p className="note">{`Questions? ${CLINIC.name} · ${CLINIC.phone}`}</p>}
        </div>
      </div>
    </section>
  );
}
