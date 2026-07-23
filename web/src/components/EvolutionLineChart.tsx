interface EvolutionLineChartProps {
  data: { label: string; value: number }[];
  color: string;
  max?: number;
  ariaLabel: string;
}

export function EvolutionLineChart({ data, color, max = 10, ariaLabel }: EvolutionLineChartProps) {
  const W = 300;
  const H = 120;
  const padTop = 10;
  const padBottom = 22;
  const padX = 12;
  const plotHeight = H - padTop - padBottom;
  const plotWidth = W - padX * 2;

  if (data.length === 0) return <div className="empty-state">Sem dados suficientes ainda.</div>;

  const stepX = data.length > 1 ? plotWidth / (data.length - 1) : 0;
  const points = data.map((d, i) => {
    const x = padX + stepX * i;
    const y = padTop + plotHeight - (Math.min(d.value, max) / max) * plotHeight;
    return { x, y, value: d.value, label: d.label };
  });
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" aria-label={ariaLabel}>
      <line x1={padX} x2={W - padX} y1={padTop + plotHeight} y2={padTop + plotHeight} stroke="var(--border-soft)" strokeWidth={1} />
      <path d={path} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r={3.5} fill={color}>
            <title>{`${p.label}: ${p.value}`}</title>
          </circle>
          <text x={p.x} y={H - 6} fontSize={9} fill="var(--text-faint)" textAnchor="middle">
            {p.label}
          </text>
        </g>
      ))}
    </svg>
  );
}
