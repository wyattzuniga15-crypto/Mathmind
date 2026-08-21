'use client';

import { useState } from 'react';
import { ChevronDown, CircleAlert, CircleCheck, Loader2 } from './icons';
import type { PlotResult } from '@/lib/subjects/math/engine/plot';
import type { ToolCallRecord } from '@/lib/core/types';

const TOOL_LABELS: Record<string, string> = {
  calculate: 'Calculated',
  solve_equation: 'Solved equation',
  solve_system: 'Solved system',
  solve_inequality: 'Solved inequality',
  simplify_expression: 'Simplified',
  factor_polynomial: 'Factored',
  differentiate: 'Differentiated',
  integrate: 'Integrated',
  limit: 'Evaluated limit',
  statistics: 'Computed statistics',
  probability: 'Computed probability',
  matrix: 'Matrix operation',
  check_equivalent: 'Checked equivalence',
  check_work: 'Checked student work',
  plot_function: 'Plotted',
};

function primaryInput(record: ToolCallRecord): string {
  const input = record.input ?? {};
  for (const key of ['expression', 'equation', 'inequality', 'data', 'matrixA', 'left']) {
    if (typeof input[key] === 'string') return input[key] as string;
  }
  if (Array.isArray(input.equations)) return (input.equations as string[]).join(', ');
  if (Array.isArray(input.expressions)) return (input.expressions as string[]).join(', ');
  if (Array.isArray(input.lines)) return `${(input.lines as string[]).length} lines of work`;
  if (typeof input.kind === 'string') return input.kind;
  if (typeof input.operation === 'string') return input.operation;
  return '';
}

/** Simple dependency-free plot renderer driven by the plot tool's samples. */
function Graph({ data }: { data: PlotResult }) {
  const width = 560;
  const height = 320;
  const pad = 34;
  const { domain, range } = data;
  const yPad = (range.max - range.min) * 0.08 || 1;
  const yMin = range.min - yPad;
  const yMax = range.max + yPad;

  const sx = (x: number) => pad + ((x - domain.from) / (domain.to - domain.from)) * (width - pad * 2);
  const sy = (y: number) => height - pad - ((y - yMin) / (yMax - yMin)) * (height - pad * 2);

  const colors = ['#6366f1', '#10b981', '#f59e0b', '#ef4444'];

  const paths = data.series.map((series) => {
    let d = '';
    let pen = false;
    for (const p of series.points) {
      if (p.y === null || p.y < yMin - (yMax - yMin) || p.y > yMax + (yMax - yMin)) {
        pen = false;
        continue;
      }
      d += `${pen ? 'L' : 'M'}${sx(p.x).toFixed(2)},${sy(p.y).toFixed(2)} `;
      pen = true;
    }
    return d.trim();
  });

  const ticks = (min: number, max: number) => {
    const span = max - min;
    const step = Math.pow(10, Math.floor(Math.log10(span / 4)));
    const nice = span / step > 8 ? step * 2 : span / step < 3 ? step / 2 : step;
    const out: number[] = [];
    for (let t = Math.ceil(min / nice) * nice; t <= max; t += nice) out.push(Number(t.toFixed(6)));
    return out.slice(0, 14);
  };

  return (
    <div className="mt-2 overflow-x-auto rounded-lg border border-line bg-surface p-2">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full min-w-[320px]"
        role="img"
        aria-label={`Graph of ${data.series.map((s) => s.expression).join(', ')}`}
      >
        {ticks(domain.from, domain.to).map((t) => (
          <line
            key={`vx${t}`}
            x1={sx(t)}
            y1={pad}
            x2={sx(t)}
            y2={height - pad}
            stroke="currentColor"
            className="text-line"
            strokeWidth={1}
          />
        ))}
        {ticks(yMin, yMax).map((t) => (
          <line
            key={`hy${t}`}
            x1={pad}
            y1={sy(t)}
            x2={width - pad}
            y2={sy(t)}
            stroke="currentColor"
            className="text-line"
            strokeWidth={1}
          />
        ))}
        {yMin < 0 && yMax > 0 && (
          <line x1={pad} y1={sy(0)} x2={width - pad} y2={sy(0)} stroke="currentColor" className="text-ink-faint" strokeWidth={1.5} />
        )}
        {domain.from < 0 && domain.to > 0 && (
          <line x1={sx(0)} y1={pad} x2={sx(0)} y2={height - pad} stroke="currentColor" className="text-ink-faint" strokeWidth={1.5} />
        )}
        {paths.map((d, i) => (
          <path key={i} d={d} fill="none" stroke={colors[i % colors.length]} strokeWidth={2.2} strokeLinecap="round" />
        ))}
        {ticks(domain.from, domain.to).map((t) => (
          <text key={`tx${t}`} x={sx(t)} y={height - pad + 15} textAnchor="middle" className="fill-current text-ink-faint" fontSize={10}>
            {t}
          </text>
        ))}
        {ticks(yMin, yMax).map((t) => (
          <text key={`ty${t}`} x={pad - 6} y={sy(t) + 3} textAnchor="end" className="fill-current text-ink-faint" fontSize={10}>
            {t}
          </text>
        ))}
      </svg>
      <div className="flex flex-wrap gap-3 px-1 pb-1 pt-1.5">
        {data.series.map((s, i) => (
          <span key={s.expression} className="flex items-center gap-1.5 text-[11px] text-ink-muted">
            <span className="h-0.5 w-4 rounded" style={{ background: colors[i % colors.length] }} />
            {s.expression}
          </span>
        ))}
      </div>
    </div>
  );
}

export function ToolTrace({ toolCalls, live }: { toolCalls: ToolCallRecord[]; live?: boolean }) {
  const [open, setOpen] = useState(false);
  if (!toolCalls.length) return null;

  const graphs = toolCalls
    .map((t) => t.result?.display)
    .filter((d): d is { type: string; payload: PlotResult } => d?.type === 'graph');

  const failed = toolCalls.filter((t) => t.result && !t.result.ok).length;

  return (
    <div className="mb-2">
      {graphs.map((g, i) => (
        <Graph key={i} data={g.payload} />
      ))}

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-raised px-2.5 py-1 text-[11px] text-ink-muted transition hover:text-ink"
        aria-expanded={open}
      >
        {live ? (
          <Loader2 size={12} className="animate-spin" />
        ) : failed ? (
          <CircleAlert size={12} className="text-amber-500" />
        ) : (
          <CircleCheck size={12} className="text-emerald-500" />
        )}
        <span>
          {live ? 'Verifying' : 'Verified'} with {toolCalls.length} exact computation
          {toolCalls.length === 1 ? '' : 's'}
        </span>
        <ChevronDown size={12} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="mt-1.5 space-y-1.5 rounded-lg border border-line bg-surface-raised p-2">
          {toolCalls.map((call) => (
            <div key={call.id} className="text-[11.5px]">
              <div className="flex items-baseline gap-2">
                <span className="font-medium text-ink">{TOOL_LABELS[call.name] ?? call.name}</span>
                <code className="truncate font-mono text-ink-muted">{primaryInput(call)}</code>
                {call.durationMs !== undefined && (
                  <span className="ml-auto shrink-0 text-ink-faint">{call.durationMs}ms</span>
                )}
              </div>
              {call.result && !call.result.ok && (
                <p className="mt-0.5 text-amber-600 dark:text-amber-400">{call.result.error}</p>
              )}
              {call.result?.ok && (
                <pre className="mt-1 max-h-40 overflow-auto rounded bg-surface-sunken p-1.5 text-[10.5px] leading-snug text-ink-muted">
                  {JSON.stringify(call.result.data, null, 1).slice(0, 1400)}
                </pre>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
