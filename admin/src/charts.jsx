import React, { useMemo, useState } from 'react';

const W = 720;
const H = 200;

/**
 * Revenue trend as a pure SVG polyline — no chart library, so the palette comes from
 * CSS variables and dark mode is free. The window is scrollable on a phone, where the
 * viewBox keeps its aspect instead of squashing thirty days into 320px.
 */
export function Trend({ series, metric = 'revenueCents', format }) {
  const [focus, setFocus] = useState(null);
  const { points, area, peak, ticks } = useMemo(() => {
    const values = series.map((s) => s[metric] || 0);
    const top = Math.max(1, ...values);
    const step = series.length > 1 ? W / (series.length - 1) : W;
    const pts = series.map((s, i) => ({
      x: i * step,
      y: H - (s[metric] || 0) / top * (H - 24) - 12,
      row: s
    }));
    const line = pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    return {
      points: pts,
      area: `M0,${H} L${line} L${((series.length - 1) * step).toFixed(1)},${H} Z`,
      peak: top,
      ticks: pts.filter((_, i) => i % Math.ceil(series.length / 6) === 0)
    };
  }, [series, metric]);

  if (!series.length) return <div className="empty">No window to chart.</div>;

  return (
    <div className="trend">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="trendsvg" role="img" aria-label="Revenue by day">
        <defs>
          <linearGradient id="trendfill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.16" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#trendfill)" />
        <polyline points={points.map((p) => `${p.x},${p.y}`).join(' ')} fill="none" stroke="var(--accent)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
        {points.map((p, i) => (
          <circle
            key={p.row.day}
            cx={p.x}
            cy={p.y}
            r={focus === i ? 5 : 3}
            fill="var(--paper)"
            stroke="var(--accent)"
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
            onMouseEnter={() => setFocus(i)}
            onMouseLeave={() => setFocus(null)}
          />
        ))}
      </svg>
      <div className="trendaxis">
        {ticks.map((p) => (
          <span key={p.row.day}>{p.row.day.slice(5)}</span>
        ))}
      </div>
      <div className="tiny dim">
        {focus != null
          ? `${points[focus].row.day} — ${format(points[focus].row[metric] || 0)} settled, ${points[focus].row.orders} placed`
          : `Peak ${format(peak)} in this window`}
      </div>
    </div>
  );
}

const COLORS = ['var(--accent)', 'var(--green)', 'var(--blue)', 'var(--amber)', 'var(--muted)'];

/** Income by payment method: a real SVG donut, since a stacked bar hides the split at a glance. */
export function Donut({ slices, format, unit = '', caption = 'total' }) {
  const total = slices.reduce((n, s) => n + (s.value || 0), 0);
  if (!total) return <div className="empty">Nothing settled in this window yet.</div>;
  const r = 54;
  const c = 2 * Math.PI * r;
  let offset = 0;

  return (
    <div className="donut">
      <svg viewBox="0 0 140 140" role="img" aria-label="Income by source">
        <g transform="rotate(-90 70 70)">
          {slices.map((s, i) => {
            const share = (s.value || 0) / total;
            const dash = `${share * c} ${c - share * c}`;
            const el = (
              <circle
                key={s.label}
                cx="70"
                cy="70"
                r={r}
                fill="none"
                stroke={COLORS[i % COLORS.length]}
                strokeWidth="18"
                strokeDasharray={dash}
                strokeDashoffset={-offset * c}
              />
            );
            offset += share;
            return el;
          })}
        </g>
        <text x="70" y="68" textAnchor="middle" className="donuttotal">
          {format(total)}
        </text>
        <text x="70" y="84" textAnchor="middle" className="donutlabel">
          {caption || 'total'}
        </text>
      </svg>
      <ul className="legend">
        {slices.map((s, i) => (
          <li key={s.label}>
            <i style={{ background: COLORS[i % COLORS.length] }} />
            <span className="grow">{s.label}</span>
            <span className="num">{format(s.value || 0)}{unit ? ` ${unit}` : ''}</span>
            <span className="tiny dim">{Math.round(((s.value || 0) / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Share({ value, total, tone = 'ink' }) {
  const pct = total ? Math.round((value / total) * 100) : 0;
  return (
    <div className={`bar ${tone === 'accent' ? 'accent' : ''}`} title={`${pct}%`}>
      <i style={{ width: `${Math.min(100, pct)}%` }} />
    </div>
  );
}
