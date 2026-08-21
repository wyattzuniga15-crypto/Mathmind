import { Rational } from './rational';
import { parse, parseMany } from './parser';
import { evaluateNode, evaluateNumeric, MathEvalError } from './evaluate';
import { toLatex, toText, formatFloat } from './format';
import {
  Poly,
  factorRationalRoots,
  numericRoots,
  quadraticRoots,
  toPolynomial,
  type RootResult,
} from './polynomial';
import { bin, variablesOf, type Node } from './ast';

export interface SolutionValue {
  latex: string;
  text: string;
  exact: boolean;
  approx: number | null;
  multiplicity?: number;
}

export interface SolveResult {
  input: string;
  variable: string;
  normalized: string;
  normalizedLatex: string;
  degree: number | null;
  type: 'linear' | 'quadratic' | 'polynomial' | 'numeric' | 'identity' | 'no-solution';
  solutions: SolutionValue[];
  /** Populated for linear/quadratic so the tutor can narrate the algebra. */
  details: Record<string, string>;
  verification: { solution: string; substituted: string; residual: string; ok: boolean }[];
  warnings: string[];
}

function pickVariable(node: Node, requested?: string): string {
  const vars = variablesOf(node).filter((v) => !['pi', 'e', 'tau', 'phi', 'Infinity'].includes(v));
  if (requested) return requested;
  if (vars.length === 0) throw new MathEvalError('There is no variable to solve for in this expression.');
  if (vars.includes('x')) return 'x';
  return vars[0];
}

/** Rewrite `lhs = rhs` as `lhs - rhs` so we can solve against zero. */
export function moveToZero(node: Node): Node {
  if (node.kind === 'rel') return bin('-', node.left, node.right);
  return node;
}

export function solveEquation(input: string, requestedVariable?: string): SolveResult {
  const node = parse(input);
  const variable = pickVariable(node, requestedVariable);
  const zeroForm = moveToZero(node);
  const warnings: string[] = [];
  const result: SolveResult = {
    input,
    variable,
    normalized: `${toText(zeroForm)} = 0`,
    normalizedLatex: `${toLatex(zeroForm)} = 0`,
    degree: null,
    type: 'numeric',
    solutions: [],
    details: {},
    verification: [],
    warnings,
  };

  const poly = toPolynomial(zeroForm, variable);

  if (poly) {
    result.degree = Number.isFinite(poly.degree) ? poly.degree : 0;

    if (poly.isZero()) {
      result.type = 'identity';
      result.details.reason = 'Both sides are identical, so every value of the variable works.';
      return result;
    }
    if (poly.degree === 0) {
      result.type = 'no-solution';
      result.details.reason = `The variable cancels out and leaves ${poly.coeffs[0].toString()} = 0, which is false.`;
      return result;
    }
    if (poly.degree === 1) {
      const a = poly.at(1);
      const b = poly.at(0);
      const x = b.neg().div(a);
      result.type = 'linear';
      result.details.form = `${a.toString()}*${variable} + ${b.toString()} = 0`;
      result.details.coefficient = a.toString();
      result.details.constant = b.toString();
      // Phrase the move the way a tutor would say it out loud: "add 10",
      // never "subtract -10".
      const moveConstant = b.isZero()
        ? null
        : b.isNegative()
          ? `Add ${b.abs().toString()} to both sides`
          : `Subtract ${b.toString()} from both sides`;
      const divide = a.eq(Rational.ONE) ? null : `divide both sides by ${a.toString()}`;
      const clauses = [moveConstant, divide].filter(Boolean) as string[];
      let step = clauses.length ? clauses.join(', then ') : `${variable} is already isolated`;
      step = `${step.charAt(0).toUpperCase()}${step.slice(1)}.`;
      result.details.isolationStep = step;
      result.details.isolationStepAppliesTo = `${toText(zeroForm)} = 0 (the equation after moving everything to one side)`;
      result.solutions = [
        { latex: x.toLatex(), text: x.toString(), exact: true, approx: x.toNumber(), multiplicity: 1 },
      ];
    } else if (poly.degree === 2) {
      const a = poly.at(2);
      const b = poly.at(1);
      const c = poly.at(0);
      const disc = b.mul(b).sub(Rational.fromInt(4).mul(a).mul(c));
      result.type = 'quadratic';
      result.details.a = a.toString();
      result.details.b = b.toString();
      result.details.c = c.toString();
      result.details.discriminant = disc.toString();
      result.details.discriminantMeaning = disc.isNegative()
        ? 'Negative discriminant: no real solutions (two complex conjugate solutions).'
        : disc.isZero()
          ? 'Zero discriminant: exactly one repeated real solution.'
          : 'Positive discriminant: two distinct real solutions.';
      const roots = quadraticRoots(a, b, c);
      if (!roots.length) {
        result.type = 'no-solution';
        warnings.push('No real solutions. The solutions are complex numbers.');
      }
      result.solutions = roots.map(rootToSolution);
      const rr = factorRationalRoots(poly);
      if (rr.roots.length === 2 || (rr.roots.length === 1 && rr.remainder.degree === 1)) {
        result.details.factored = factoredForm(poly, variable);
      }
    } else {
      result.type = 'polynomial';
      const { roots: rational, remainder } = factorRationalRoots(poly);
      const sols: SolutionValue[] = [];
      const counted = new Map<string, { value: Rational; mult: number }>();
      for (const r of rational) {
        const key = r.toString();
        const entry = counted.get(key);
        if (entry) entry.mult += 1;
        else counted.set(key, { value: r, mult: 1 });
      }
      for (const { value, mult } of counted.values()) {
        sols.push({
          latex: value.toLatex(),
          text: value.toString(),
          exact: true,
          approx: value.toNumber(),
          multiplicity: mult,
        });
      }
      if (remainder.degree === 2) {
        for (const root of quadraticRoots(remainder.at(2), remainder.at(1), remainder.at(0))) {
          sols.push(rootToSolution(root));
        }
      } else if (Number.isFinite(remainder.degree) && remainder.degree >= 3) {
        for (const x of numericRoots(remainder)) {
          sols.push({
            latex: formatFloat(x, 10),
            text: formatFloat(x, 10),
            exact: false,
            approx: x,
            multiplicity: 1,
          });
        }
        warnings.push(
          'Some roots are irrational and have no simple closed form; those values are numerical approximations.',
        );
      }
      result.solutions = sols.sort((p, q) => (p.approx ?? 0) - (q.approx ?? 0));
      if (rational.length) result.details.factored = factoredForm(poly, variable);
    }
  } else {
    // Not polynomial: scan for sign changes and bisect.
    result.type = 'numeric';
    const roots = numericSolveScan(zeroForm, variable);
    result.solutions = roots.map((x) => ({
      latex: formatFloat(x, 10),
      text: formatFloat(x, 10),
      exact: false,
      approx: x,
      multiplicity: 1,
    }));
    warnings.push(
      'This equation is not polynomial, so it was solved numerically on the interval [-50, 50]. Solutions are approximate and there may be others outside that range.',
    );
  }

  // Substitute every solution back in — the tutor should never present an unchecked answer.
  for (const s of result.solutions) {
    if (s.approx === null) continue;
    const residual = evaluateNumeric(zeroForm, { [variable]: s.approx });
    const ok = Number.isFinite(residual) && Math.abs(residual) < 1e-7;
    result.verification.push({
      solution: s.text,
      substituted: `${variable} = ${s.text}`,
      residual: formatFloat(residual, 12),
      ok,
    });
    if (!ok) warnings.push(`Solution ${s.text} did not verify cleanly (residual ${formatFloat(residual, 6)}).`);
  }

  return result;
}

function rootToSolution(root: RootResult): SolutionValue {
  return {
    latex: root.latex,
    text: root.rational ? root.rational.toString() : `${root.latex} ≈ ${formatFloat(root.approx, 10)}`,
    exact: root.exact,
    approx: root.approx,
    multiplicity: root.multiplicity,
  };
}

function factoredForm(p: Poly, variable: string): string {
  const { roots, remainder } = factorRationalRoots(p);
  if (!roots.length) return '';
  const parts = roots.map((r) => {
    if (r.isZero()) return variable;
    const shifted = r.neg();
    const sign = shifted.isNegative() ? '-' : '+';
    return `(${variable} ${sign} ${shifted.abs().toString()})`;
  });
  const lead = remainder.isConstant() ? remainder.coeffs[0] : null;
  const prefix = lead && !lead.eq(Rational.ONE) ? `${lead.toString()}` : '';
  const tail = remainder.isConstant() ? '' : `(${remainder.toString(variable)})`;
  return `${prefix}${parts.join('')}${tail}`;
}

function numericSolveScan(node: Node, variable: string, from = -50, to = 50, steps = 4000): number[] {
  const roots: number[] = [];
  const f = (x: number) => evaluateNumeric(node, { [variable]: x });
  let prevX = from;
  let prevY = f(prevX);
  for (let i = 1; i <= steps; i++) {
    const x = from + ((to - from) * i) / steps;
    const y = f(x);
    if (Number.isFinite(y) && Math.abs(y) < 1e-12) {
      if (!roots.some((r) => Math.abs(r - x) < 1e-6)) roots.push(x);
    } else if (Number.isFinite(y) && Number.isFinite(prevY) && prevY * y < 0) {
      let lo = prevX;
      let hi = x;
      let flo = prevY;
      for (let k = 0; k < 200; k++) {
        const mid = (lo + hi) / 2;
        const fm = f(mid);
        if (!Number.isFinite(fm)) break;
        if (flo * fm <= 0) hi = mid;
        else {
          lo = mid;
          flo = fm;
        }
      }
      const r = (lo + hi) / 2;
      if (!roots.some((v) => Math.abs(v - r) < 1e-6)) roots.push(r);
    }
    prevX = x;
    prevY = y;
  }
  return roots;
}

/* ------------------------------------------------------------------ */
/* Systems of linear equations                                         */
/* ------------------------------------------------------------------ */

export interface SystemResult {
  variables: string[];
  equations: string[];
  type: 'unique' | 'infinite' | 'none';
  solution: Record<string, { text: string; latex: string; approx: number }> | null;
  freeVariables: string[];
  parametric: string[];
  rref: string[][];
  verification: { equation: string; leftValue: string; rightValue: string; ok: boolean }[];
  explanation: string;
}

export function solveSystem(input: string | string[], requestedVars?: string[]): SystemResult {
  const nodes = Array.isArray(input) ? input.map((s) => parse(s)) : parseMany(input);
  if (!nodes.length) throw new MathEvalError('No equations were provided.');

  const varSet = new Set<string>();
  for (const n of nodes) {
    for (const v of variablesOf(n)) {
      if (!['pi', 'e', 'tau', 'phi', 'Infinity'].includes(v)) varSet.add(v);
    }
  }
  const variables = requestedVars?.length ? requestedVars : [...varSet].sort();

  // Build the augmented matrix by extracting exact linear coefficients.
  const rows: Rational[][] = [];
  for (const n of nodes) {
    const zero = moveToZero(n);
    const row: Rational[] = [];
    for (const v of variables) {
      const scope: Record<string, number> = {};
      for (const other of variables) scope[other] = 0;
      const base = evalExact(zero, scope);
      scope[v] = 1;
      const withOne = evalExact(zero, scope);
      row.push(withOne.sub(base));
    }
    const zeroScope: Record<string, number> = {};
    for (const v of variables) zeroScope[v] = 0;
    const constant = evalExact(zero, zeroScope);
    // verify linearity: value at all-ones must equal sum of coefficients + constant
    const onesScope: Record<string, number> = {};
    for (const v of variables) onesScope[v] = 1;
    const actual = evalExact(zero, onesScope);
    const predicted = row.reduce((acc, c) => acc.add(c), constant);
    if (!actual.eq(predicted)) {
      throw new MathEvalError(
        'This system is not linear. The linear-system solver only handles first-degree equations.',
      );
    }
    row.push(constant.neg()); // move constant to the right-hand side
    rows.push(row);
  }

  const { matrix, pivots } = rref(rows, variables.length);
  const result: SystemResult = {
    variables,
    equations: nodes.map((n) => toText(n)),
    type: 'unique',
    solution: null,
    freeVariables: [],
    parametric: [],
    rref: matrix.map((r) => r.map((c) => c.toString())),
    verification: [],
    explanation: '',
  };

  // inconsistent row: 0 = nonzero
  for (const row of matrix) {
    const allZero = row.slice(0, variables.length).every((c) => c.isZero());
    if (allZero && !row[variables.length].isZero()) {
      result.type = 'none';
      result.explanation =
        'Elimination produces a contradiction (a row saying 0 equals a non-zero number), so the equations describe lines/planes that never meet at a common point.';
      return result;
    }
  }

  const pivotCols = new Set(pivots);
  const free = variables.filter((_, i) => !pivotCols.has(i));
  if (free.length) {
    result.type = 'infinite';
    result.freeVariables = free;
    for (let r = 0; r < pivots.length; r++) {
      const col = pivots[r];
      const terms: string[] = [matrix[r][variables.length].toString()];
      for (let c = 0; c < variables.length; c++) {
        if (pivotCols.has(c) || matrix[r][c].isZero()) continue;
        const coeff = matrix[r][c].neg();
        terms.push(`${coeff.toString()}*${variables[c]}`);
      }
      result.parametric.push(`${variables[col]} = ${terms.join(' + ')}`);
    }
    result.explanation = `There are more unknowns than independent equations, so ${free.join(', ')} can be chosen freely and the rest follow.`;
    return result;
  }

  const solution: Record<string, { text: string; latex: string; approx: number }> = {};
  for (let r = 0; r < pivots.length; r++) {
    const value = matrix[r][variables.length];
    solution[variables[pivots[r]]] = {
      text: value.toString(),
      latex: value.toLatex(),
      approx: value.toNumber(),
    };
  }
  result.solution = solution;
  result.explanation = 'Gaussian elimination with exact fractions produced a single intersection point.';

  const scope: Record<string, number> = {};
  for (const [k, v] of Object.entries(solution)) scope[k] = v.approx;
  for (const n of nodes) {
    if (n.kind === 'rel') {
      const l = evaluateNumeric(n.left, scope);
      const r = evaluateNumeric(n.right, scope);
      result.verification.push({
        equation: toText(n),
        leftValue: formatFloat(l, 10),
        rightValue: formatFloat(r, 10),
        ok: Math.abs(l - r) < 1e-9,
      });
    }
  }
  return result;
}

function evalExact(node: Node, scope: Record<string, number>): Rational {
  const v = evaluateNode(node, { scope });
  if (!v.exact) throw new MathEvalError('The system contains non-exact (irrational) coefficients.');
  return v.exact;
}

function rref(input: Rational[][], varCount: number): { matrix: Rational[][]; pivots: number[] } {
  const m = input.map((r) => [...r]);
  const pivots: number[] = [];
  let row = 0;
  for (let col = 0; col < varCount && row < m.length; col++) {
    let sel = -1;
    for (let r = row; r < m.length; r++) {
      if (!m[r][col].isZero()) {
        sel = r;
        break;
      }
    }
    if (sel === -1) continue;
    [m[row], m[sel]] = [m[sel], m[row]];
    const pivot = m[row][col];
    m[row] = m[row].map((c) => c.div(pivot));
    for (let r = 0; r < m.length; r++) {
      if (r === row || m[r][col].isZero()) continue;
      const factor = m[r][col];
      m[r] = m[r].map((c, i) => c.sub(factor.mul(m[row][i])));
    }
    pivots.push(col);
    row++;
  }
  return { matrix: m, pivots };
}

/* ------------------------------------------------------------------ */
/* Inequalities                                                        */
/* ------------------------------------------------------------------ */

export interface InequalityResult {
  input: string;
  variable: string;
  normalized: string;
  criticalPoints: { value: string; approx: number; exact: boolean }[];
  intervals: { interval: string; sample: number; sign: string; included: boolean }[];
  solution: string;
  solutionLatex: string;
  explanation: string;
  warnings: string[];
}

export function solveInequality(input: string, requestedVariable?: string): InequalityResult {
  const node = parse(input);
  if (node.kind !== 'rel' || node.op === '=' || node.op === '!=') {
    throw new MathEvalError('Provide an inequality using <, >, <=, or >=.');
  }
  const variable = pickVariable(node, requestedVariable);
  const zeroForm = bin('-', node.left, node.right);
  const op = node.op;
  const warnings: string[] = [];

  const poly = toPolynomial(zeroForm, variable);
  let critical: { value: Rational | null; approx: number; exact: boolean; latex: string }[] = [];

  if (poly) {
    if (poly.degree === 1) {
      const r = poly.at(0).neg().div(poly.at(1));
      critical = [{ value: r, approx: r.toNumber(), exact: true, latex: r.toLatex() }];
    } else {
      const { roots, remainder } = factorRationalRoots(poly);
      const seen = new Set<string>();
      for (const r of roots) {
        if (seen.has(r.toString())) continue;
        seen.add(r.toString());
        critical.push({ value: r, approx: r.toNumber(), exact: true, latex: r.toLatex() });
      }
      if (remainder.degree === 2) {
        for (const root of quadraticRoots(remainder.at(2), remainder.at(1), remainder.at(0))) {
          critical.push({ value: root.rational ?? null, approx: root.approx, exact: true, latex: root.latex });
        }
      } else if (Number.isFinite(remainder.degree) && remainder.degree >= 3) {
        for (const x of numericRoots(remainder)) {
          critical.push({ value: null, approx: x, exact: false, latex: formatFloat(x, 8) });
        }
        warnings.push('Some boundary points are approximate.');
      }
    }
  } else {
    for (const x of numericSolveScan(zeroForm, variable)) {
      critical.push({ value: null, approx: x, exact: false, latex: formatFloat(x, 8) });
    }
    warnings.push(
      'Non-polynomial inequality solved numerically on [-50, 50]; boundaries are approximate and behaviour outside that range was not checked.',
    );
  }

  critical.sort((a, b) => a.approx - b.approx);
  const pts = critical.map((c) => c.approx);
  const testPoints: number[] = [];
  if (!pts.length) testPoints.push(0);
  else {
    testPoints.push(pts[0] - 1);
    for (let i = 0; i < pts.length - 1; i++) testPoints.push((pts[i] + pts[i + 1]) / 2);
    testPoints.push(pts[pts.length - 1] + 1);
  }

  const satisfies = (y: number) =>
    op === '<' ? y < 0 : op === '<=' ? y <= 0 : op === '>' ? y > 0 : y >= 0;

  const intervals: InequalityResult['intervals'] = [];
  const boundLabel = (i: number) => (i < 0 ? '-\\infty' : i >= critical.length ? '\\infty' : critical[i].latex);
  const selected: string[] = [];
  const closed = op === '<=' || op === '>=';

  for (let i = 0; i < testPoints.length; i++) {
    const sample = testPoints[i];
    const y = evaluateNumeric(zeroForm, { [variable]: sample });
    const included = Number.isFinite(y) && satisfies(y);
    const lo = i === 0 ? '-\\infty' : boundLabel(i - 1);
    const hi = i === testPoints.length - 1 ? '\\infty' : boundLabel(i);
    const loBracket = lo === '-\\infty' ? '(' : closed ? '[' : '(';
    const hiBracket = hi === '\\infty' ? ')' : closed ? ']' : ')';
    const label = `${loBracket}${lo}, ${hi}${hiBracket}`;
    intervals.push({
      interval: label,
      sample,
      sign: !Number.isFinite(y) ? 'undefined' : y > 0 ? 'positive' : y < 0 ? 'negative' : 'zero',
      included,
    });
    if (included) selected.push(label);
  }

  // isolated boundary points count when the relation allows equality
  if (closed) {
    for (const c of critical) {
      if (!selected.some((s) => s.includes(c.latex))) {
        const already = selected.length > 0;
        if (!already) selected.push(`\\{${c.latex}\\}`);
      }
    }
  }

  const solutionLatex = selected.length ? selected.join(' \\cup ') : '\\varnothing';
  return {
    input,
    variable,
    normalized: `${toText(zeroForm)} ${op} 0`,
    criticalPoints: critical.map((c) => ({ value: c.latex, approx: c.approx, exact: c.exact })),
    intervals,
    solution: selected.length ? selected.join(' or ') : 'no solution',
    solutionLatex,
    explanation:
      'Move everything to one side, find where that expression equals zero, then test one point inside each interval. The sign can only change at those boundary points.',
    warnings,
  };
}
