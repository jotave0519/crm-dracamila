import { useId } from "react";

interface RevenueAreaChartProps {
  data: { month: string; value: number }[];
  /** Cor da linha/área. Default: accent. */
  color?: string;
  height?: number;
  formatValue?: (v: number) => string;
}

function monthLabel(key: string): string {
  const [year, month] = key.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
}

/**
 * Gráfico de área suave (linha + preenchimento em degradê) para séries mensais.
 * SVG puro, sem dependência de biblioteca — mesmo espírito dos outros charts.
 */
export function RevenueAreaChart({ data, color = "var(--accent)", height = 150, formatValue = (v) => String(v) }: RevenueAreaChartProps) {
  const gid = useId().replace(/:/g, "");
  const W = 320;
  const H = height;
  const padTop = 12;
  const padBottom = 24;
  const padX = 4;
  const plotH = H - padTop - padBottom;
  const plotW = W - padX * 2;

  const total = data.reduce((sum, d) => sum + d.value, 0);
  if (data.length === 0 || total === 0) {
    return (
      <div className="empty-state" style={{ padding: "36px 12px" }}>
        Sem faturamento registrado nos últimos meses.
      </div>
    );
  }

  const max = Math.max(1, ...data.map((d) => d.value));
  const stepX = data.length > 1 ? plotW / (data.length - 1) : 0;
  const pts = data.map((d, i) => ({
    x: padX + stepX * i,
    y: padTop + plotH - (d.value / max) * plotH,
    d,
  }));

  // Curva suave (Catmull-Rom -> Bézier) para o traço não ficar "quebrado".
  function smoothPath(points: { x: number; y: number }[]): string {
    if (points.length < 2) return points.length ? `M${points[0].x},${points[0].y}` : "";
    let path = `M${points[0].x},${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i - 1] || points[i];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[i + 2] || p2;
      const c1x = p1.x + (p2.x - p0.x) / 6;
      const c1y = p1.y + (p2.y - p0.y) / 6;
      const c2x = p2.x - (p3.x - p1.x) / 6;
      const c2y = p2.y - (p3.y - p1.y) / 6;
      path += ` C${c1x},${c1y} ${c2x},${c2y} ${p2.x},${p2.y}`;
    }
    return path;
  }

  const line = smoothPath(pts);
  const area = `${line} L${pts[pts.length - 1].x},${padTop + plotH} L${pts[0].x},${padTop + plotH} Z`;
  const last = pts[pts.length - 1];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" aria-label="Faturamento por mês" preserveAspectRatio="none">
      <defs>
        <linearGradient id={`area-${gid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <line x1={0} x2={W} y1={padTop + plotH} y2={padTop + plotH} stroke="var(--border-soft)" strokeWidth={1} />
      <path d={area} fill={`url(#area-${gid})`} />
      <path d={line} fill="none" stroke={color} strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last.x} cy={last.y} r={3.75} fill={color} stroke="var(--surface)" strokeWidth={2} />
      {data.map((d, i) => (
        <text
          key={d.month}
          x={pts[i].x}
          y={H - 7}
          fontSize={9}
          fill="var(--text-faint)"
          textAnchor={i === 0 ? "start" : i === data.length - 1 ? "end" : "middle"}
        >
          {monthLabel(d.month)}
        </text>
      ))}
      {pts.map((p, i) => (
        <rect key={i} x={p.x - stepX / 2} y={0} width={stepX || plotW} height={H} fill="transparent">
          <title>{`${monthLabel(data[i].month)}: ${formatValue(data[i].value)}`}</title>
        </rect>
      ))}
    </svg>
  );
}
