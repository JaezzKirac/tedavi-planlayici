import { TEETH, SZ, ARCH, CX, hasE, hasG, hasI, hasC, toothName, txLabel } from "../data/teeth.js";

// greft granülleri: dişin çevresinde küçük noktalar
const GRAN = Array.from({ length: 9 }, (_, i) => { const a = (i / 9) * Math.PI * 2; return [Math.cos(a), Math.sin(a)]; });

function Shape({ k, cls }) {
  const [w, h] = SZ[k - 1];
  if (k >= 6) return <rect className={cls} x={-w} y={-h} width={2 * w} height={2 * h} rx={w * 0.45} />;
  return <ellipse className={cls} rx={w} ry={h} />;
}

function Cusps({ k }) {
  const [w, h] = SZ[k - 1];
  if (k >= 6) return <path className="cusp" d={`M${-w * 0.55} 0 Q0 ${h * 0.15} ${w * 0.55} 0 M${-w * 0.1} ${-h * 0.55} Q${w * 0.1} 0 ${-w * 0.1} ${h * 0.55}`} />;
  if (k >= 4) return <path className="cusp" d={`M${-w * 0.55} 0 Q0 ${h * 0.2} ${w * 0.55} 0`} />;
  if (k === 3) return <circle className="cusp" r={2} />;
  return <path className="cusp" d={`M${-w * 0.7} ${h * 0.15} Q0 ${-h * 0.15} ${w * 0.7} ${h * 0.15}`} />;
}

function visFor(plan, n) {
  const ext = hasE(plan, n) ? 1 : 0, grf = hasG(plan, n) ? 1 : 0;
  if (hasI(plan, n) && hasC(plan, n)) return { ccrown: 1, imp: 1, ext, grf };
  if (hasI(plan, n)) return { socket: 1, ghost: 1, imp: 1, ext, grf };
  if (hasC(plan, n)) return { ccrown: 1, ext, grf };
  // yalnız çekim: boş yuva; greftliyse (soket koruma) yuva greftle dolu
  if (ext) return { socket: 1, ext, extX: grf ? 0 : 1, grf };
  return { nat: 1 };
}

const arcPath = (A, up) => {
  let d = "";
  for (let p = -98; p <= 98; p += 4) {
    const f = (p * Math.PI) / 180;
    const x = CX + A.rx * Math.sin(f), y = up ? A.cy - A.ry * Math.cos(f) : A.cy + A.ry * Math.cos(f);
    d += (d ? "L" : "M") + x.toFixed(1) + " " + y.toFixed(1);
  }
  return d;
};

function Mouth() {
  return (
    <>
      <rect className="mouthbg" x="0" y="0" width="520" height="620" rx="40" opacity=".55" />
      <ellipse className="tongue" cx={CX} cy="430" rx="104" ry="96" opacity=".75" />
      {[0, 1, 2, 3].map((i) => {
        const y = 110 + i * 26;
        return <path key={i} className="rugae" d={`M${CX - 48 + i * 4} ${y + 8} Q${CX - 24} ${y - 6} ${CX - 6} ${y + 4} M${CX + 6} ${y + 4} Q${CX + 24} ${y - 6} ${CX + 48 - i * 4} ${y + 8}`} />;
      })}
      <path d={`M${CX} 100 L${CX} 200`} className="rugae" />
      <path className="gumline" d={arcPath(ARCH.U, true)} strokeWidth="50" />
      <path className="gumline" d={arcPath(ARCH.L, false)} strokeWidth="48" />
      <text className="qlabel" x="18" y="26">SAĞ</text>
      <text className="qlabel" x="502" y="26" textAnchor="end">SOL</text>
      <text className="qlabel" x={CX} y="305" textAnchor="middle">ÜST ÇENE ↑ · ↓ ALT ÇENE</text>
    </>
  );
}

export default function ToothChart({ plan, onToggle }) {
  return (
    <svg className="chart enter" viewBox="0 0 520 620" role="group" aria-label="Diş şeması">
      <Mouth />
      {TEETH.map((t, i) => {
        const [w, h] = SZ[t.k - 1], r = Math.max(w, h), vis = visFor(plan, t.n);
        const op = (k) => ({ opacity: vis[k] ? 1 : 0 });
        const state = plan[t.n] ? txLabel(plan, t.n) : "işaretsiz";
        return (
          <g
            key={t.n}
            className="tw"
            transform={`translate(${t.x.toFixed(1)} ${t.y.toFixed(1)}) rotate(${t.a.toFixed(1)})`}
            onClick={() => onToggle(t.n)}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onToggle(t.n); } }}
            tabIndex={0}
            role="button"
            aria-label={`${t.n} · ${toothName(t.n)} · ${state}`}
          >
            <g className="pop" style={{ animationDelay: `${i * 35}ms` }}>
              <ellipse className="socket a" style={op("socket")} rx={w * 0.75} ry={h * 0.75} />
              <g className="a" style={op("nat")}><Shape k={t.k} cls="tshape" /><Cusps k={t.k} /></g>
              <g className="a" style={op("ccrown")}><Shape k={t.k} cls="chartcrown" /><Cusps k={t.k} /></g>
              <g className="a" style={op("ghost")}><Shape k={t.k} cls="ghostT" /></g>
              <g className="a" style={op("imp")}>
                <circle className="tiC" r="7" />
                <path className="spiral" d="M0 -5 A5 5 0 1 1 -4.3 2.5 A3.5 3.5 0 1 1 2.5 -1.5 A1.6 1.6 0 1 1 0 0" />
              </g>
              <g className="a" style={op("grf")}>
                {GRAN.map(([cx, cy], j) => <circle key={j} className="gran" cx={cx * w * 0.62} cy={cy * h * 0.62} r={j % 2 ? 1.7 : 2.2} />)}
              </g>
              <circle className="extR a" style={op("ext")} r={r + 3} />
              <path className="extX a" style={op("extX")} d="M-5 -5L5 5M5 -5L-5 5" />
              <circle className="hit" r={r + 6} />
            </g>
          </g>
        );
      })}
      {TEETH.map((t) => (
        <text key={t.n} className={"num" + (hasI(plan, t.n) ? " imp" : hasC(plan, t.n) ? " crw" : hasG(plan, t.n) ? " grf" : hasE(plan, t.n) ? " ext" : "")} x={t.l.x.toFixed(1)} y={t.l.y.toFixed(1)}>{t.n}</text>
      ))}
    </svg>
  );
}
