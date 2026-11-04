// Animasyonu MP4 dosyasına çevirir. Ekran kaydı değildir: her kare sırayla çizilip kodlanır,
// bu yüzden yavaş bilgisayarda yalnızca süre uzar, videoda takılma olmaz.
import { Muxer, ArrayBufferTarget } from "mp4-muxer";
import { captionOf, chapterIndexAt, chInfo, eventIndexAt } from "../data/timeline.js";

const W = 1280, H = 720, GL_H = 574, FPS = 24, BITRATE = 3_500_000, U = W / 1920; // U: 1080p'ye göre yazı ölçeği
const CODECS = ["avc1.64001F", "avc1.4D001F", "avc1.42E01F"]; // H.264 High / Main / Baseline (WhatsApp ve telefonlarda açılır)
const DISPLAY = "Montserrat, 'Segoe UI', sans-serif", BODY = "Figtree, 'Segoe UI', sans-serif";

// ekran kartıyla kodlama varsa o seçilir (çok daha hızlı)
async function pickConfig() {
  for (const hardwareAcceleration of ["prefer-hardware", "no-preference"]) {
    for (const codec of CODECS) {
      const config = { codec, width: W, height: H, bitrate: BITRATE, framerate: FPS, hardwareAcceleration };
      const { supported } = await VideoEncoder.isConfigSupported(config);
      if (supported) return config;
    }
  }
  return null;
}

// setTimeout arka plandaki sekmede çok yavaşlatılır; MessageChannel yavaşlatılmaz, video sekme değişince de hızlı hazırlanır
const nextTask = () => new Promise((r) => { const c = new MessageChannel(); c.port1.onmessage = () => r(); c.port2.postMessage(0); });
const px = (n) => Math.round(n * U);

function pill(ctx, text, x, y, { right = false, font = `700 ${px(24)}px ${DISPLAY}`, fill = "rgba(10,14,36,.82)", stroke = "rgba(147,165,255,.5)" } = {}) {
  ctx.font = font;
  const w = ctx.measureText(text).width + px(40), h = px(48), left = right ? x - w : x;
  ctx.beginPath(); ctx.roundRect(left, y, w, h, h / 2);
  ctx.fillStyle = fill; ctx.fill();
  ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = "#fff"; ctx.textBaseline = "middle";
  ctx.fillText(text, left + px(20), y + h / 2 + 1);
}

// metin satırlara bölünür; aynı metin her karede yeniden ölçülmesin diye saklanır
function wrapper(ctx) {
  let key = "", lines = [];
  return (text, maxW) => {
    if (text === key) return lines;
    key = text; lines = []; let cur = "";
    for (const w of text.split(" ")) {
      const next = cur ? `${cur} ${w}` : w;
      if (ctx.measureText(next).width > maxW && cur) { lines.push(cur); cur = w; } else cur = next;
    }
    lines.push(cur);
    return lines;
  };
}

/**
 * @returns {Promise<Blob>} video/mp4
 * signal iptal edilirse AbortError fırlatır. speed oynatıcıda seçili hızdır.
 */
export async function exportVideo({ scene, tl, plan, fmr, mouth = {}, speed, signal, onProgress }) {
  const config = await pickConfig();
  if (!config) throw new Error("This browser can't create MP4 video. Please use an up-to-date Chrome or Edge.");
  await document.fonts?.ready;

  const target = new ArrayBufferTarget();
  const muxer = new Muxer({ target, video: { codec: "avc", width: W, height: H }, fastStart: "in-memory" });
  let failed = null;
  const encoder = new VideoEncoder({ output: (chunk, meta) => muxer.addVideoChunk(chunk, meta), error: (e) => { failed = e; } });
  encoder.configure(config);

  const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
  const ctx = cv.getContext("2d", { alpha: false });
  const bg = ctx.createRadialGradient(W / 2, GL_H * 0.36, 0, W / 2, GL_H * 0.36, W * 0.62);
  [[0, "#2C3A78"], [0.44, "#18204A"], [0.8, "#0B1029"], [1, "#060818"]].forEach(([o, c]) => bg.addColorStop(o, c));
  const wrap = wrapper(ctx);

  const gl = scene.beginCapture(W, GL_H);
  try {
    const stepMs = 1000 / FPS, total = Math.ceil(tl.TOTAL / speed / stepMs);
    let shown = -1;
    for (let i = 0; i < total; i++) {
      if (signal.aborted) throw new DOMException("Cancelled", "AbortError");
      if (failed) throw failed;
      const t = Math.min(tl.TOTAL - 1, i * stepMs * speed), e = tl.TL[eventIndexAt(tl.TL, t)];
      const { label, xray } = scene.captureFrame(t, e, stepMs * speed);

      ctx.fillStyle = bg; ctx.fillRect(0, 0, W, GL_H);
      ctx.drawImage(gl, 0, 0, W, GL_H);
      pill(ctx, chInfo(e.ch, fmr).cal, px(32), px(28));
      if (xray) pill(ctx, "X-ray view", W - px(32), px(28), { right: true });
      if (label) {
        ctx.strokeStyle = "rgba(142,162,255,.9)"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(label.lx, label.ly); ctx.lineTo(label.sx, label.sy); ctx.stroke();
        ctx.fillStyle = "#8EA2FF"; ctx.beginPath(); ctx.arc(label.sx, label.sy, 4, 0, Math.PI * 2); ctx.fill();
        ctx.font = `700 ${px(24)}px ${DISPLAY}`;
        pill(ctx, label.text, label.lx - (ctx.measureText(label.text).width + px(40)) / 2, label.ly - px(24), { stroke: "#8EA2FF" });
      }

      const cap = captionOf(e, plan, fmr, mouth);
      ctx.fillStyle = "#0B1029"; ctx.fillRect(0, GL_H, W, H - GL_H);
      ctx.textBaseline = "alphabetic";
      ctx.fillStyle = "#93A5FF"; ctx.font = `700 ${px(22)}px ${DISPLAY}`;
      ctx.fillText(`STEP ${chapterIndexAt(tl.CH, e) + 1} / ${tl.CH.length}`, px(56), GL_H + px(44));
      ctx.fillStyle = "#fff"; ctx.font = `800 ${px(40)}px ${DISPLAY}`;
      ctx.fillText(cap.title, px(56), GL_H + px(96));
      ctx.fillStyle = "#C9CFE8"; ctx.font = `400 ${px(25)}px ${BODY}`;
      wrap(cap.text, W - px(112)).slice(0, 3).forEach((line, n) => ctx.fillText(line, px(56), GL_H + px(136) + n * px(32)));

      const frame = new VideoFrame(cv, { timestamp: Math.round((i * 1e6) / FPS), duration: Math.round(1e6 / FPS) });
      encoder.encode(frame, { keyFrame: i % (FPS * 2) === 0 });
      frame.close();
      while (encoder.encodeQueueSize > 4) await new Promise((r) => encoder.addEventListener("dequeue", r, { once: true }));
      const pct = Math.floor((i / total) * 100);
      if (pct !== shown) { shown = pct; onProgress(i / total); } // ekranı yalnızca yüzde değişince günceller
      if (i % 4 === 0) await nextTask();
    }
    await encoder.flush();
    if (failed) throw failed;
    muxer.finalize();
    return new Blob([target.buffer], { type: "video/mp4" });
  } finally {
    scene.endCapture();
    if (encoder.state !== "closed") encoder.close();
  }
}
