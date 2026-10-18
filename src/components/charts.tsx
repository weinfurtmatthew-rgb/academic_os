'use client';

import { cn } from '@/lib/utils';

interface BarDatum {
  label: string;
  value: number;
  color?: string;
}

/** Simple flex-based bar chart. */
export function BarChart({
  data,
  height = 160,
  unit = '',
  className,
}: {
  data: BarDatum[];
  height?: number;
  unit?: string;
  className?: string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className={cn('w-full', className)}>
      <div className="flex items-end gap-1.5 sm:gap-2" style={{ height }}>
        {data.map((d, i) => {
          const h = Math.round((d.value / max) * 100);
          return (
            <div key={i} className="group relative flex h-full flex-1 flex-col items-center justify-end">
              <div className="pointer-events-none absolute -top-1 z-10 -translate-y-full whitespace-nowrap rounded-md bg-foreground px-2 py-0.5 text-[11px] font-semibold text-background opacity-0 transition-opacity group-hover:opacity-100">
                {Math.round(d.value * 10) / 10}
                {unit}
              </div>
              <div
                className="w-full max-w-[42px] rounded-t-md transition-all duration-300"
                style={{
                  height: `${d.value === 0 ? 2 : Math.max(h, 3)}%`,
                  background: d.color || 'hsl(var(--primary))',
                  opacity: d.value === 0 ? 0.25 : 1,
                }}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-1.5 flex gap-1.5 sm:gap-2">
        {data.map((d, i) => (
          <div key={i} className="flex-1 truncate text-center text-[10px] font-medium text-muted-foreground sm:text-[11px]">
            {d.label}
          </div>
        ))}
      </div>
    </div>
  );
}

/** SVG line chart with area fill and dots. */
export function LineChart({
  points,
  labels,
  height = 180,
  yMin,
  yMax,
  format = (v: number) => String(Math.round(v * 100) / 100),
  className,
}: {
  points: number[];
  labels: string[];
  height?: number;
  yMin?: number;
  yMax?: number;
  format?: (v: number) => string;
  className?: string;
}) {
  if (points.length === 0) return null;
  const W = 100;
  const H = 100;
  const pad = 6;
  const lo = yMin !== undefined ? yMin : Math.min(...points);
  const hi = yMax !== undefined ? yMax : Math.max(...points);
  const span = hi - lo || 1;

  const xy = points.map((p, i) => {
    const x = points.length === 1 ? W / 2 : pad + (i / (points.length - 1)) * (W - pad * 2);
    const y = H - pad - ((p - lo) / span) * (H - pad * 2);
    return [x, y] as const;
  });

  const path = xy.map(([x, y]) => `${x},${y}`).join(' ');
  const area = `${pad},${H} ${path} ${xy[xy.length - 1][0]},${H}`;

  return (
    <div className={cn('w-full', className)}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ height }} className="w-full overflow-visible">
        {[0.25, 0.5, 0.75].map((g) => (
          <line
            key={g}
            x1={0}
            x2={W}
            y1={H * g}
            y2={H * g}
            stroke="hsl(var(--border))"
            strokeWidth={0.4}
            strokeDasharray="1.5 1.5"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        <polygon points={area} fill="hsl(var(--primary) / 0.12)" />
        <polyline
          points={path}
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
        {xy.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={2} fill="hsl(var(--card))" stroke="hsl(var(--primary))" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
        ))}
      </svg>
      <div className="mt-1 flex justify-between text-[10px] font-medium text-muted-foreground sm:text-[11px]">
        {labels.map((l, i) => (
          <span key={i} className={cn(labels.length > 8 && i % 2 === 1 && 'hidden sm:inline')}>
            {l}
          </span>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground/70">
        <span>min {format(Math.min(...points))}</span>
        <span>max {format(Math.max(...points))}</span>
      </div>
    </div>
  );
}
