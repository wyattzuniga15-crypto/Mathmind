import { parse } from './parser';
import { evaluateNumeric } from './evaluate';
import { toLatex, formatFloat } from './format';
import { differentiateNode } from './calculus';
import { toPolynomial, numericRoots, factorRationalRoots } from './polynomial';
import { variablesOf } from './ast';

export interface PlotSeries {
  expression: string;
  latex: string;
  points: { x: number; y: number | null }[];
}

export interface PlotResult {
  variable: string;
  domain: { from: number; to: number };
  range: { min: number; max: number };
  series: PlotSeries[];
  features: {
    xIntercepts: string[];
    yIntercept: string | null;
    turningPoints: { x: string; y: string; type: string }[];
    verticalAsymptotes: string[];
  };
  note: string;
}

/**
 * Produces sampled points for rendering plus the interesting features a tutor
 * would point at: intercepts, turning points, asymptotes.
 */
export function plot(
  expressions: string[],
  options: { variable?: string; from?: number; to?: number; samples?: number } = {},
): PlotResult {
  if (!expressions.length) throw new Error('Provide at least one expression to plot.');
  const nodes = expressions.map((e) => parse(e));
  const variable =
    options.variable ??
    variablesOf(nodes[0]).filter((v) => !['pi', 'e', 'tau', 'phi'].includes(v))[0] ??
    'x';
  const from = options.from ?? -10;
  const to = options.to ?? 10;
  const samples = Math.min(Math.max(options.samples ?? 400, 50), 2000);
  if (!(to > from)) throw new Error('The plot range must have "to" greater than "from".');

  const series: PlotSeries[] = [];
  let yMin = Infinity;
  let yMax = -Infinity;

  for (let i = 0; i < nodes.length; i++) {
    const points: PlotSeries['points'] = [];
    for (let s = 0; s <= samples; s++) {
      const x = from + ((to - from) * s) / samples;
      const y = evaluateNumeric(nodes[i], { [variable]: x });
      if (Number.isFinite(y) && Math.abs(y) < 1e6) {
        points.push({ x: round(x), y: round(y) });
        if (y < yMin) yMin = y;
        if (y > yMax) yMax = y;
      } else {
        points.push({ x: round(x), y: null });
      }
    }
    series.push({ expression: expressions[i], latex: toLatex(nodes[i]), points });
  }

  if (!Number.isFinite(yMin)) {
    yMin = -10;
    yMax = 10;
  }
  if (yMin === yMax) {
    yMin -= 1;
    yMax += 1;
  }

  const main = nodes[0];
  const poly = toPolynomial(main, variable);
  const xIntercepts: string[] = [];
  if (poly) {
    const { roots, remainder } = factorRationalRoots(poly);
    for (const r of roots) if (!xIntercepts.includes(r.toString())) xIntercepts.push(r.toString());
    if (Number.isFinite(remainder.degree) && remainder.degree >= 1) {
      for (const r of numericRoots(remainder)) {
        if (r >= from && r <= to) xIntercepts.push(formatFloat(r, 6));
      }
    }
  } else {
    for (const r of scanRoots(main, variable, from, to)) xIntercepts.push(formatFloat(r, 6));
  }

  const y0 = evaluateNumeric(main, { [variable]: 0 });
  const yIntercept = Number.isFinite(y0) ? formatFloat(y0, 8) : null;

  const turningPoints: PlotResult['features']['turningPoints'] = [];
  try {
    const d1 = differentiateNode(main, variable);
    const d2 = differentiateNode(d1, variable);
    const criticalXs = (() => {
      const dp = toPolynomial(d1, variable);
      if (dp && Number.isFinite(dp.degree) && dp.degree >= 1) {
        const { roots, remainder } = factorRationalRoots(dp);
        return [...roots.map((r) => r.toNumber()), ...numericRoots(remainder)];
      }
      return scanRoots(d1, variable, from, to);
    })();
    for (const x of criticalXs) {
      if (x < from || x > to) continue;
      const y = evaluateNumeric(main, { [variable]: x });
      if (!Number.isFinite(y)) continue;
      const curvature = evaluateNumeric(d2, { [variable]: x });
      const type =
        !Number.isFinite(curvature) || Math.abs(curvature) < 1e-9
          ? 'inflection or flat point'
          : curvature > 0
            ? 'local minimum'
            : 'local maximum';
      if (!turningPoints.some((t) => Math.abs(Number(t.x) - x) < 1e-6)) {
        turningPoints.push({ x: formatFloat(x, 6), y: formatFloat(y, 6), type });
      }
    }
  } catch {
    /* derivative unavailable for this expression */
  }

  const verticalAsymptotes: string[] = [];
  for (let s = 1; s < samples; s++) {
    const x = from + ((to - from) * s) / samples;
    const y = evaluateNumeric(main, { [variable]: x });
    if (!Number.isFinite(y) || Math.abs(y) > 1e6) {
      const label = formatFloat(x, 4);
      if (!verticalAsymptotes.some((v) => Math.abs(Number(v) - x) < (to - from) / 50)) {
        verticalAsymptotes.push(label);
      }
    }
  }

  return {
    variable,
    domain: { from, to },
    range: { min: round(yMin), max: round(yMax) },
    series,
    features: {
      xIntercepts,
      yIntercept,
      turningPoints,
      verticalAsymptotes,
    },
    note: 'Points are sampled numerically for display. Intercepts computed from exact roots when the function is polynomial.',
  };
}

function scanRoots(node: ReturnType<typeof parse>, variable: string, from: number, to: number): number[] {
  const roots: number[] = [];
  const steps = 1000;
  let prevX = from;
  let prevY = evaluateNumeric(node, { [variable]: prevX });
  for (let i = 1; i <= steps; i++) {
    const x = from + ((to - from) * i) / steps;
    const y = evaluateNumeric(node, { [variable]: x });
    if (Number.isFinite(y) && Number.isFinite(prevY) && prevY * y < 0) {
      let lo = prevX;
      let hi = x;
      for (let k = 0; k < 80; k++) {
        const mid = (lo + hi) / 2;
        const fm = evaluateNumeric(node, { [variable]: mid });
        if (!Number.isFinite(fm)) break;
        if (evaluateNumeric(node, { [variable]: lo }) * fm <= 0) hi = mid;
        else lo = mid;
      }
      roots.push((lo + hi) / 2);
    }
    prevX = x;
    prevY = y;
  }
  return roots;
}

const round = (x: number) => Math.round(x * 1e6) / 1e6;
