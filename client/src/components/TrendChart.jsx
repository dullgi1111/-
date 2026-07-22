const TYPE_COLORS = {
  breakdown_repair: 'var(--danger)',
  preventive_inspection: 'var(--ok)',
  other: 'var(--purple)',
  unknown: 'var(--ink4)',
};

const TYPE_LABELS = {
  breakdown_repair: '고장수리',
  preventive_inspection: '예방점검',
  other: '기타',
  unknown: '미상',
};

// rows: [{ month: ISO date string, maintenance_type, count }]
export function TrendLegend({ rows }) {
  if (!rows || rows.length === 0) return null;
  const types = [...new Set(rows.map((r) => r.maintenance_type))];
  return (
    <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
      {types.map((type) => (
        <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: 'var(--ink3)' }}>
          <span style={{ width: 10, height: 10, borderRadius: 3, background: TYPE_COLORS[type] || 'var(--ink4)', display: 'inline-block' }} />
          {TYPE_LABELS[type] || type}
        </div>
      ))}
    </div>
  );
}

// Shows at most the most recent MAX_MONTHS -- beyond that, bars get too
// thin to read regardless of layout, so trim instead of forcing a scroll.
const MAX_MONTHS = 12;

export function TrendChart({ rows }) {
  if (!rows || rows.length === 0) return null;

  const allMonths = [...new Set(rows.map((r) => r.month))].sort();
  const months = allMonths.slice(-MAX_MONTHS);
  const types = [...new Set(rows.map((r) => r.maintenance_type))];
  const totalsByMonth = months.map((m) =>
    rows.filter((r) => r.month === m).reduce((sum, r) => sum + r.count, 0)
  );
  const maxTotal = Math.max(...totalsByMonth, 1);

  const barWidth = 34;
  const gap = 18;
  const chartHeight = 160;
  const width = months.length * (barWidth + gap) + gap;

  function formatMonth(iso) {
    const d = new Date(iso);
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}`;
  }

  return (
    <div style={{ width: '100%', height: '100%', minHeight: 0, display: 'flex' }}>
      <svg width="100%" height="100%" viewBox={`0 0 ${width} ${chartHeight + 40}`} preserveAspectRatio="xMidYMid meet" role="img">
        {months.map((month, i) => {
          const x = gap + i * (barWidth + gap);
          let yOffset = chartHeight;
          return (
            <g key={month}>
              {types.map((type) => {
                const row = rows.find((r) => r.month === month && r.maintenance_type === type);
                const count = row ? row.count : 0;
                if (count === 0) return null;
                const segH = (count / maxTotal) * chartHeight;
                yOffset -= segH;
                return (
                  <rect
                    key={type}
                    x={x}
                    y={yOffset}
                    width={barWidth}
                    height={segH}
                    fill={TYPE_COLORS[type] || 'var(--ink4)'}
                    rx={2}
                  />
                );
              })}
              <text x={x + barWidth / 2} y={chartHeight + 16} textAnchor="middle" fontSize="10.5" fill="var(--ink3)">
                {formatMonth(month)}
              </text>
              <text x={x + barWidth / 2} y={chartHeight - (totalsByMonth[i] / maxTotal) * chartHeight - 6} textAnchor="middle" fontSize="10.5" fontWeight="700" fill="var(--ink2)">
                {totalsByMonth[i]}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
