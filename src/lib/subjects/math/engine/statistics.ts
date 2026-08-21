import { Rational, binomial, factorial } from './rational';
import { parse } from './parser';
import { evaluateNode } from './evaluate';
import { formatFloat } from './format';

export interface StatsResult {
  n: number;
  values: string[];
  sorted: string[];
  mean: { exact: string | null; decimal: string };
  median: { exact: string | null; decimal: string };
  mode: string[];
  modeType: 'none' | 'unimodal' | 'multimodal';
  range: string;
  min: string;
  max: string;
  sum: string;
  quartiles: { q1: string; q2: string; q3: string; iqr: string };
  outliers: string[];
  populationVariance: { exact: string; decimal: string };
  sampleVariance: { exact: string; decimal: string };
  populationStdDev: { decimal: string; isExact: boolean };
  sampleStdDev: { decimal: string; isExact: boolean };
  notes: string[];
}

function parseNumbers(input: string | number[]): Rational[] {
  const raw = Array.isArray(input)
    ? input.map(String)
    : String(input)
        .replace(/[[\]{}]/g, ' ')
        .split(/[,\s;]+/)
        .filter(Boolean);
  if (!raw.length) throw new Error('No data values were provided.');
  return raw.map((t) => {
    const v = evaluateNode(parse(t));
    if (!v.exact) return Rational.fromNumber(v.approx);
    return v.exact;
  });
}

function median(sorted: Rational[]): Rational {
  const n = sorted.length;
  if (n % 2 === 1) return sorted[(n - 1) / 2];
  return sorted[n / 2 - 1].add(sorted[n / 2]).div(Rational.fromInt(2));
}

export function describe(input: string | number[]): StatsResult {
  const values = parseNumbers(input);
  const sorted = [...values].sort((a, b) => a.cmp(b));
  const n = values.length;
  const nR = Rational.fromInt(n);
  const sum = values.reduce((a, b) => a.add(b), Rational.ZERO);
  const mean = sum.div(nR);

  const counts = new Map<string, number>();
  for (const v of values) counts.set(v.toString(), (counts.get(v.toString()) ?? 0) + 1);
  const maxCount = Math.max(...counts.values());
  const modes = [...counts.entries()].filter(([, c]) => c === maxCount).map(([k]) => k);
  const modeType = maxCount === 1 ? 'none' : modes.length === 1 ? 'unimodal' : 'multimodal';

  const lowerHalf = sorted.slice(0, Math.floor(n / 2));
  const upperHalf = sorted.slice(n % 2 === 1 ? Math.floor(n / 2) + 1 : n / 2);
  const q1 = lowerHalf.length ? median(lowerHalf) : sorted[0];
  const q3 = upperHalf.length ? median(upperHalf) : sorted[n - 1];
  const q2 = median(sorted);
  const iqr = q3.sub(q1);
  const fence = iqr.mul(Rational.make(3n, 2n));
  const lowFence = q1.sub(fence);
  const highFence = q3.add(fence);
  const outliers = sorted.filter((v) => v.lt(lowFence) || v.gt(highFence)).map((v) => v.toString());

  const sqDev = values.reduce((acc, v) => acc.add(v.sub(mean).mul(v.sub(mean))), Rational.ZERO);
  const popVar = sqDev.div(nR);
  const sampVar = n > 1 ? sqDev.div(Rational.fromInt(n - 1)) : Rational.ZERO;
  const popSd = Math.sqrt(popVar.toNumber());
  const sampSd = Math.sqrt(sampVar.toNumber());

  const notes: string[] = [];
  if (n === 1) notes.push('With a single value, spread measures are zero or undefined.');
  notes.push(
    'Sample variance divides by n-1 (use it when the data is a sample); population variance divides by n.',
  );
  if (outliers.length) notes.push('Outliers flagged using the 1.5 × IQR rule.');

  const pres = (r: Rational) => ({
    exact: r.toString(),
    decimal: r.hasFiniteDecimal() ? r.toDecimalString(10) : r.toDecimalString(6),
  });

  return {
    n,
    values: values.map((v) => v.toString()),
    sorted: sorted.map((v) => v.toString()),
    mean: { exact: mean.toString(), decimal: pres(mean).decimal },
    median: { exact: q2.toString(), decimal: pres(q2).decimal },
    mode: modes,
    modeType,
    range: sorted[n - 1].sub(sorted[0]).toString(),
    min: sorted[0].toString(),
    max: sorted[n - 1].toString(),
    sum: sum.toString(),
    quartiles: { q1: q1.toString(), q2: q2.toString(), q3: q3.toString(), iqr: iqr.toString() },
    outliers,
    populationVariance: { exact: popVar.toString(), decimal: pres(popVar).decimal },
    sampleVariance: { exact: sampVar.toString(), decimal: pres(sampVar).decimal },
    populationStdDev: { decimal: formatFloat(popSd, 8), isExact: Number.isInteger(popSd) },
    sampleStdDev: { decimal: formatFloat(sampSd, 8), isExact: Number.isInteger(sampSd) },
    notes,
  };
}

export interface RegressionResult {
  n: number;
  slope: string;
  intercept: string;
  equation: string;
  equationLatex: string;
  r: string;
  rSquared: string;
  note: string;
}

export function linearRegression(xs: number[], ys: number[]): RegressionResult {
  if (xs.length !== ys.length || xs.length < 2) {
    throw new Error('Regression needs at least two matching x and y values.');
  }
  const n = xs.length;
  const sx = xs.reduce((a, b) => a + b, 0);
  const sy = ys.reduce((a, b) => a + b, 0);
  const sxy = xs.reduce((a, x, i) => a + x * ys[i], 0);
  const sxx = xs.reduce((a, x) => a + x * x, 0);
  const syy = ys.reduce((a, y) => a + y * y, 0);
  const denom = n * sxx - sx * sx;
  if (Math.abs(denom) < 1e-12) throw new Error('All x values are identical, so no line of best fit exists.');
  const slope = (n * sxy - sx * sy) / denom;
  const intercept = (sy - slope * sx) / n;
  const r = (n * sxy - sx * sy) / Math.sqrt(denom * (n * syy - sy * sy));
  return {
    n,
    slope: formatFloat(slope, 8),
    intercept: formatFloat(intercept, 8),
    equation: `y = ${formatFloat(slope, 6)}x + ${formatFloat(intercept, 6)}`,
    equationLatex: `y = ${formatFloat(slope, 6)}x ${intercept < 0 ? '-' : '+'} ${formatFloat(Math.abs(intercept), 6)}`,
    r: formatFloat(r, 8),
    rSquared: formatFloat(r * r, 8),
    note: 'Least-squares fit computed with floating point; values are approximate.',
  };
}

export interface ProbabilityResult {
  kind: string;
  exact: string | null;
  decimal: string;
  percent: string;
  explanation: string;
}

export function combinations(n: number, k: number): ProbabilityResult {
  const value = binomial(BigInt(n), BigInt(k));
  return {
    kind: 'combinations',
    exact: value.toString(),
    decimal: value.toString(),
    percent: '',
    explanation: `C(${n}, ${k}) = ${n}! / (${k}!(${n}-${k})!) counts the ways to choose ${k} items when order does not matter.`,
  };
}

export function permutations(n: number, k: number): ProbabilityResult {
  const value = factorial(BigInt(n)) / factorial(BigInt(n - k));
  return {
    kind: 'permutations',
    exact: value.toString(),
    decimal: value.toString(),
    percent: '',
    explanation: `P(${n}, ${k}) = ${n}!/(${n}-${k})! counts arrangements where order matters.`,
  };
}

/** Exact binomial probability P(X = k) or P(X <= k). */
export function binomialProbability(
  n: number,
  k: number,
  p: string | number,
  cumulative = false,
): ProbabilityResult {
  const pr = typeof p === 'number' ? Rational.fromNumber(p) : Rational.parse(String(p));
  const q = Rational.ONE.sub(pr);
  const single = (i: number) =>
    Rational.make(binomial(BigInt(n), BigInt(i)))
      .mul(pr.powInt(BigInt(i)))
      .mul(q.powInt(BigInt(n - i)));
  let total = Rational.ZERO;
  if (cumulative) for (let i = 0; i <= k; i++) total = total.add(single(i));
  else total = single(k);
  return {
    kind: cumulative ? 'binomial P(X <= k)' : 'binomial P(X = k)',
    exact: total.toString(),
    decimal: total.toDecimalString(10),
    percent: `${total.mul(Rational.fromInt(100)).toDecimalString(6)}%`,
    explanation: `Binomial with n=${n}, p=${pr.toString()}. Each term is C(n,i)·p^i·(1-p)^(n-i).`,
  };
}

/** Standard normal CDF via Abramowitz–Stegun; approximate by nature. */
export function normalCdf(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989422804014327 * Math.exp((-z * z) / 2);
  const p =
    d * t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return z > 0 ? 1 - p : p;
}

export function normalProbability(mean: number, sd: number, from?: number, to?: number): ProbabilityResult {
  if (sd <= 0) throw new Error('Standard deviation must be positive.');
  const zl = from === undefined ? -Infinity : (from - mean) / sd;
  const zr = to === undefined ? Infinity : (to - mean) / sd;
  const lo = from === undefined ? 0 : normalCdf(zl);
  const hi = to === undefined ? 1 : normalCdf(zr);
  const value = Math.max(0, hi - lo);
  return {
    kind: 'normal distribution probability',
    exact: null,
    decimal: formatFloat(value, 8),
    percent: `${formatFloat(value * 100, 6)}%`,
    explanation: `z-scores: ${from === undefined ? '-inf' : formatFloat(zl, 4)} to ${to === undefined ? 'inf' : formatFloat(zr, 4)}. The normal CDF has no elementary closed form, so this value is a numerical approximation.`,
  };
}
