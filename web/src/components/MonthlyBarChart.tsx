interface MonthlyBarChartProps {
  data: { month: string; value: number }[];
  color: string;
  formatValue: (value: number) => string;
  ariaLabel: string;
}

function monthLabel(key: string): string {
  const [year, month] = key.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
}

export function MonthlyBarChart({ data, color, formatValue, ariaLabel }: MonthlyBarChartProps) {
  const W = 300;
  const H = 150;
  const padTop = 10;
  const padBottom = 22;
  const plotHeight = H - padTop - padBottom;
  const maxValue = Math.max(1, ...data.map((m) => m.value));
  const groupWidth = W / Math.max(data.length, 1);
  const barWidth = Math.min(20, groupWidth * 0.55);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" aria-label={ariaLabel}>
      <line x1={0} x2={W} y1={padTop + plotHeight} y2={padTop + plotHeight} stroke="var(--border-soft)" strokeWidth={1} />
      {data.map((m, i) => {
        const barHeight = (m.value / maxValue) * plotHeight;
        const x = groupWidth * i + groupWidth / 2 - barWidth / 2;
        const y = padTop + plotHeight - barHeight;
        return (
          <g key={m.month}>
            <rect x={x} y={y} width={barWidth} height={Math.max(barHeight, 1)} rx={3} fill={color}>
              <title>{`${monthLabel(m.month)}: ${formatValue(m.value)}`}</title>
            </rect>
            <text x={groupWidth * i + groupWidth / 2} y={H - 6} fontSize={9} fill="var(--text-faint)" textAnchor="middle">
              {monthLabel(m.month)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
