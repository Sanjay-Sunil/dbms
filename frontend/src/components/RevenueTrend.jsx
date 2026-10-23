import { useEffect, useRef, useState } from 'react';

const H = 220;
const PAD = { top: 12, right: 8, bottom: 26, left: 48 };

const inr = (n) => `₹${Math.round(n).toLocaleString('en-IN')}`;
const shortDate = (iso) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

/** Niceish upper bound so gridlines land on round numbers. */
function niceMax(v) {
  if (v <= 0) return 100;
  const mag = 10 ** Math.floor(Math.log10(v));
  return Math.ceil(v / mag / 2) * 2 * mag;
}

/**
 * Daily paid revenue as a bar chart (one series → no legend; the title names it).
 * Hover any day for revenue and order count.
 */
export default function RevenueTrend({ data }) {
  const [hover, setHover] = useState(null);
  const [W, setW] = useState(720);
  const boxRef = useRef(null);

  // Draw at the container's real pixel width so text stays 10px at any size.
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(([entry]) => setW(Math.max(280, Math.round(entry.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  if (!data?.length) return null;

  const max = niceMax(Math.max(...data.map((d) => Number(d.revenue))));
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const slot = innerW / data.length;
  const barW = Math.max(2, slot - (slot > 12 ? 4 : 2)); // gap between bars
  const y = (v) => PAD.top + innerH - (v / max) * innerH;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max);
  const labelEvery = Math.ceil(data.length / Math.max(3, Math.floor(innerW / 70)));
  // Count labels back from the latest day so it is always labelled and evenly spaced.
  const showLabel = (i) => (data.length - 1 - i) % labelEvery === 0;

  const total = data.reduce((s, d) => s + Number(d.revenue), 0);
  const orders = data.reduce((s, d) => s + d.orders, 0);
  const h = hover != null ? data[hover] : null;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4 mb-4">
        <div>
          <h3 className="text-base font-semibold text-white">Daily Paid Revenue · last {data.length} days</h3>
          <p className="text-xs text-zinc-400 mt-0.5">
            SQL: <span className="font-mono text-zinc-300">GROUP BY DATE(sale_datetime)</span> over paid counter sales
          </p>
        </div>
        <div className="flex gap-6 text-right">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">Period total</div>
            <div className="text-lg font-bold font-mono text-white">{inr(total)}</div>
          </div>
          <div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">Avg / day</div>
            <div className="text-lg font-bold font-mono text-white">{inr(total / data.length)}</div>
          </div>
          <div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">Orders</div>
            <div className="text-lg font-bold font-mono text-white">{orders}</div>
          </div>
        </div>
      </div>

      <div className="relative" ref={boxRef}>
        <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="block max-w-full" role="img"
             aria-label={`Daily revenue for the last ${data.length} days, total ${inr(total)}`}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)}
                    stroke="#27272a" strokeWidth="1" strokeDasharray={t === 0 ? '' : '2 4'} />
              <text x={PAD.left - 8} y={y(t)} dy="0.32em" textAnchor="end"
                    className="fill-zinc-500" style={{ font: '10px "JetBrains Mono", monospace' }}>
                {t >= 1000 ? `${t / 1000}k` : t}
              </text>
            </g>
          ))}

          {data.map((d, i) => {
            const x = PAD.left + i * slot + (slot - barW) / 2;
            const top = y(Number(d.revenue));
            const bh = Math.max(0, PAD.top + innerH - top);
            const r = Math.min(4, barW / 2, bh);
            const active = hover === i;
            return (
              <g key={d.date}>
                {bh > 0 && (
                  <path
                    d={`M${x},${top + bh} V${top + r} Q${x},${top} ${x + r},${top} H${x + barW - r} Q${x + barW},${top} ${x + barW},${top + r} V${top + bh} Z`}
                    fill={active ? '#ffffff' : hover == null ? '#d4d4d8' : '#52525b'}
                    style={{ transition: 'fill 120ms' }}
                  />
                )}
                {/* Hit target spans the full slot height, larger than the bar. */}
                <rect x={PAD.left + i * slot} y={PAD.top} width={slot} height={innerH}
                      fill="transparent" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} />
                {showLabel(i) && (
                  <text x={i === data.length - 1 ? x + barW : x + barW / 2} y={H - 8}
                        textAnchor={i === data.length - 1 ? 'end' : 'middle'} className="fill-zinc-500"
                        style={{ font: '10px "JetBrains Mono", monospace' }}>
                    {shortDate(d.date)}
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        {h && (
          <div
            className="pointer-events-none absolute -translate-x-1/2 -translate-y-full rounded-lg border border-zinc-700 bg-zinc-950/95 px-3 py-2 shadow-xl"
            style={{
              left: `${((PAD.left + hover * slot + slot / 2) / W) * 100}%`,
              top: `${(y(Number(h.revenue)) / H) * 100}%`,
              marginTop: -8,
            }}
          >
            <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-400">{shortDate(h.date)}</div>
            <div className="text-sm font-bold font-mono text-white">{inr(h.revenue)}</div>
            <div className="text-[11px] text-zinc-400">{h.orders} orders</div>
          </div>
        )}
      </div>
    </div>
  );
}
