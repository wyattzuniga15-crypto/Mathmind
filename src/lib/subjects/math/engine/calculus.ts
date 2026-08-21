import { Rational } from './rational';
import { parse } from './parser';
import { evaluateNode, evaluateNumeric, MathEvalError } from './evaluate';
import { toLatex, toText, formatFloat, presentValue } from './format';
import { simplify } from './simplify';
import { toPolynomial } from './polynomial';
import { bin, call, neg, num, sym, substitute, variablesOf, type Node } from './ast';

const R = (n: number) => num(Rational.fromInt(n));

/* ------------------------------ derivatives ----------------------------- */

export function differentiateNode(node: Node, v: string): Node {
  const d = (n: Node): Node => {
    switch (n.kind) {
      case 'num':
        return R(0);
      case 'sym':
        return n.name === v ? R(1) : R(0);
      case 'neg':
        return neg(d(n.arg));
      case 'rel':
        throw new MathEvalError('Differentiate an expression, not an equation.');
      case 'bin': {
        const { left: u, right: w } = n;
        switch (n.op) {
          case '+':
            return bin('+', d(u), d(w));
          case '-':
            return bin('-', d(u), d(w));
          case '*':
            return bin('+', bin('*', d(u), w), bin('*', u, d(w)));
          case '/':
            return bin(
              '/',
              bin('-', bin('*', d(u), w), bin('*', u, d(w))),
              bin('^', w, R(2)),
            );
          case '^': {
            const expHasVar = variablesOf(w).includes(v);
            const baseHasVar = variablesOf(u).includes(v);
            if (!expHasVar) {
              // power rule with chain rule
              return bin('*', bin('*', w, bin('^', u, bin('-', w, R(1)))), d(u));
            }
            if (!baseHasVar) {
              // a^u  ->  a^u * ln(a) * u'
              return bin('*', bin('*', bin('^', u, w), call('ln', [u])), d(w));
            }
            // general: u^w * (w' ln u + w u'/u)
            return bin(
              '*',
              bin('^', u, w),
              bin('+', bin('*', d(w), call('ln', [u])), bin('*', w, bin('/', d(u), u))),
            );
          }
        }
        break;
      }
      case 'call': {
        const a = n.args[0];
        const da = a ? d(a) : R(0);
        const chain = (outer: Node) => bin('*', outer, da);
        switch (n.name) {
          case 'sqrt':
            return chain(bin('/', R(1), bin('*', R(2), call('sqrt', [a]))));
          case 'cbrt':
            return chain(bin('/', R(1), bin('*', R(3), bin('^', call('cbrt', [a]), R(2)))));
          case 'exp':
            return chain(call('exp', [a]));
          case 'ln':
            return chain(bin('/', R(1), a));
          case 'log10':
            return chain(bin('/', R(1), bin('*', a, call('ln', [R(10)]))));
          case 'log2':
            return chain(bin('/', R(1), bin('*', a, call('ln', [R(2)]))));
          case 'log': {
            const base = n.args[1] ?? R(10);
            return chain(bin('/', R(1), bin('*', a, call('ln', [base]))));
          }
          case 'sin':
            return chain(call('cos', [a]));
          case 'cos':
            return chain(neg(call('sin', [a])));
          case 'tan':
            return chain(bin('^', call('sec', [a]), R(2)));
          case 'cot':
            return chain(neg(bin('^', call('csc', [a]), R(2))));
          case 'sec':
            return chain(bin('*', call('sec', [a]), call('tan', [a])));
          case 'csc':
            return chain(neg(bin('*', call('csc', [a]), call('cot', [a]))));
          case 'asin':
            return chain(bin('/', R(1), call('sqrt', [bin('-', R(1), bin('^', a, R(2)))])));
          case 'acos':
            return chain(neg(bin('/', R(1), call('sqrt', [bin('-', R(1), bin('^', a, R(2)))]))));
          case 'atan':
            return chain(bin('/', R(1), bin('+', R(1), bin('^', a, R(2)))));
          case 'sinh':
            return chain(call('cosh', [a]));
          case 'cosh':
            return chain(call('sinh', [a]));
          case 'tanh':
            return chain(bin('-', R(1), bin('^', call('tanh', [a]), R(2))));
          case 'abs':
            return chain(call('sign', [a]));
          default:
            throw new MathEvalError(`No differentiation rule is implemented for ${n.name}()`);
        }
      }
    }
    throw new MathEvalError('Could not differentiate that expression');
  };
  return simplify(d(node));
}

export interface DerivativeResult {
  input: string;
  variable: string;
  order: number;
  derivative: string;
  derivativeLatex: string;
  steps: { order: number; expression: string; latex: string }[];
  checkedNumerically: { at: number; symbolic: number; numeric: number; agrees: boolean }[];
  rulesUsed: string[];
}

export function differentiate(input: string, variable?: string, order = 1): DerivativeResult {
  const node = parse(input);
  const v = variable ?? pickVar(node);
  const steps: DerivativeResult['steps'] = [];
  let current = node;
  for (let i = 1; i <= Math.max(1, Math.min(order, 8)); i++) {
    current = differentiateNode(current, v);
    steps.push({ order: i, expression: toText(current), latex: toLatex(current) });
  }

  // Independent check: compare against a central finite difference.
  const first = order === 1 ? current : differentiateNode(node, v);
  const checks: DerivativeResult['checkedNumerically'] = [];
  for (const at of [0.37, 1.21, 2.53]) {
    const symbolic = evaluateNumeric(first, { [v]: at });
    const h = 1e-6;
    const numeric =
      (evaluateNumeric(node, { [v]: at + h }) - evaluateNumeric(node, { [v]: at - h })) / (2 * h);
    if (!Number.isFinite(symbolic) || !Number.isFinite(numeric)) continue;
    const scale = Math.max(1, Math.abs(numeric));
    checks.push({ at, symbolic, numeric, agrees: Math.abs(symbolic - numeric) / scale < 1e-4 });
  }

  return {
    input,
    variable: v,
    order,
    derivative: toText(current),
    derivativeLatex: toLatex(current),
    steps,
    checkedNumerically: checks,
    rulesUsed: detectRules(node, v),
  };
}

function detectRules(n: Node, v: string): string[] {
  const rules = new Set<string>();
  const walk = (x: Node) => {
    if (x.kind === 'bin') {
      if (x.op === '*' && variablesOf(x.left).includes(v) && variablesOf(x.right).includes(v)) {
        rules.add('product rule');
      }
      if (x.op === '/' && variablesOf(x.right).includes(v)) rules.add('quotient rule');
      if (x.op === '^') {
        rules.add(variablesOf(x.right).includes(v) ? 'exponential/logarithmic differentiation' : 'power rule');
      }
      walk(x.left);
      walk(x.right);
    } else if (x.kind === 'neg') walk(x.arg);
    else if (x.kind === 'call') {
      if (x.args[0] && x.args[0].kind !== 'sym') rules.add('chain rule');
      rules.add(`derivative of ${x.name}`);
      x.args.forEach(walk);
    }
  };
  walk(n);
  if (!rules.size) rules.add('constant/power rule');
  return [...rules];
}

function pickVar(node: Node): string {
  const vars = variablesOf(node).filter((x) => !['pi', 'e', 'tau', 'phi'].includes(x));
  if (!vars.length) throw new MathEvalError('There is no variable in this expression.');
  return vars.includes('x') ? 'x' : vars[0];
}

/* ------------------------------ integration ----------------------------- */

/**
 * Symbolic antiderivative for the forms a first-year course actually uses:
 * polynomials, 1/x, e^x, trig, and any of those composed with a linear inner
 * function. Returns null when no closed form is found — the tutor must then
 * say so rather than invent one.
 */
export function antiderivative(node: Node, v: string): Node | null {
  const simplified = simplify(node);

  const poly = toPolynomial(simplified, v);
  if (poly) {
    let out: Node = R(0);
    for (let i = 0; i < poly.coeffs.length; i++) {
      const c = poly.coeffs[i];
      if (c.isZero()) continue;
      const coeff = c.div(Rational.fromInt(i + 1));
      out = bin('+', out, bin('*', num(coeff), bin('^', sym(v), num(Rational.fromInt(i + 1)))));
    }
    return simplify(out);
  }

  // split sums
  if (simplified.kind === 'bin' && (simplified.op === '+' || simplified.op === '-')) {
    const l = antiderivative(simplified.left, v);
    const r = antiderivative(simplified.right, v);
    if (l && r) return simplify(bin(simplified.op, l, r));
    return null;
  }
  if (simplified.kind === 'neg') {
    const a = antiderivative(simplified.arg, v);
    return a ? simplify(neg(a)) : null;
  }
  // constant multiple
  if (simplified.kind === 'bin' && simplified.op === '*') {
    const leftConst = !variablesOf(simplified.left).includes(v);
    const rightConst = !variablesOf(simplified.right).includes(v);
    if (leftConst !== rightConst) {
      const constPart = leftConst ? simplified.left : simplified.right;
      const varPart = leftConst ? simplified.right : simplified.left;
      const inner = antiderivative(varPart, v);
      return inner ? simplify(bin('*', constPart, inner)) : null;
    }
  }
  if (simplified.kind === 'bin' && simplified.op === '/') {
    const denom = simplified.right;
    if (!variablesOf(denom).includes(v)) {
      const inner = antiderivative(simplified.left, v);
      return inner ? simplify(bin('/', inner, denom)) : null;
    }
    // c / (ax+b)
    const lin = linearForm(denom, v);
    if (lin && !variablesOf(simplified.left).includes(v)) {
      return simplify(
        bin('*', bin('/', simplified.left, num(lin.a)), call('ln', [call('abs', [denom])])),
      );
    }
    // u'/u
    const du = differentiateNode(denom, v);
    if (isProportional(simplified.left, du, v)) {
      const k = proportionality(simplified.left, du, v)!;
      return simplify(bin('*', num(k), call('ln', [call('abs', [denom])])));
    }
    return null;
  }
  if (simplified.kind === 'bin' && simplified.op === '^') {
    const base = simplified.left;
    const exp = simplified.right;
    if (!variablesOf(exp).includes(v)) {
      const lin = linearForm(base, v);
      const e = constExact(exp);
      if (lin && e) {
        if (e.add(Rational.ONE).isZero()) {
          return simplify(bin('*', num(lin.a.inv()), call('ln', [call('abs', [base])])));
        }
        const np1 = e.add(Rational.ONE);
        return simplify(bin('/', bin('^', base, num(np1)), num(np1.mul(lin.a))));
      }
      return null;
    }
    // a^(linear)
    if (!variablesOf(base).includes(v)) {
      const lin = linearForm(exp, v);
      if (lin) {
        return simplify(
          bin('/', bin('^', base, exp), bin('*', num(lin.a), call('ln', [base]))),
        );
      }
    }
    return null;
  }
  if (simplified.kind === 'call') {
    const a = simplified.args[0];
    const lin = linearForm(a, v);
    if (!lin) return null;
    const k = num(lin.a.inv());
    switch (simplified.name) {
      case 'exp':
        return simplify(bin('*', k, call('exp', [a])));
      case 'sin':
        return simplify(neg(bin('*', k, call('cos', [a]))));
      case 'cos':
        return simplify(bin('*', k, call('sin', [a])));
      case 'sec':
        return simplify(
          bin('*', k, call('ln', [call('abs', [bin('+', call('sec', [a]), call('tan', [a]))])])),
        );
      case 'tan':
        return simplify(neg(bin('*', k, call('ln', [call('abs', [call('cos', [a])])]))));
      case 'sqrt':
        return simplify(
          bin('*', bin('*', k, num(Rational.make(2n, 3n))), bin('^', a, num(Rational.make(3n, 2n)))),
        );
      case 'ln':
        return simplify(bin('*', k, bin('-', bin('*', a, call('ln', [a])), a)));
      default:
        return null;
    }
  }
  return null;
}

function constExact(n: Node): Rational | null {
  try {
    return evaluateNode(n).exact;
  } catch {
    return null;
  }
}

/** Returns {a, b} when node equals a*v + b with constant a, b. */
function linearForm(n: Node, v: string): { a: Rational; b: Rational } | null {
  const p = toPolynomial(n, v);
  if (!p || p.degree > 1) return null;
  const a = p.at(1);
  if (a.isZero()) return null;
  return { a, b: p.at(0) };
}

function isProportional(a: Node, b: Node, v: string): boolean {
  return proportionality(a, b, v) !== null;
}

function proportionality(a: Node, b: Node, v: string): Rational | null {
  const samples = [0.31, 1.7, 2.9];
  let ratio: number | null = null;
  for (const s of samples) {
    const av = evaluateNumeric(a, { [v]: s });
    const bv = evaluateNumeric(b, { [v]: s });
    if (!Number.isFinite(av) || !Number.isFinite(bv) || Math.abs(bv) < 1e-9) return null;
    const r = av / bv;
    if (ratio === null) ratio = r;
    else if (Math.abs(r - ratio) > 1e-8) return null;
  }
  if (ratio === null) return null;
  const rounded = Math.round(ratio * 1e6) / 1e6;
  try {
    return Rational.fromNumber(rounded);
  } catch {
    return null;
  }
}

export interface IntegralResult {
  input: string;
  variable: string;
  definite: boolean;
  antiderivative: string | null;
  antiderivativeLatex: string | null;
  exactValue: string | null;
  exactValueLatex: string | null;
  approxValue: string | null;
  method: string;
  isExact: boolean;
  note: string;
  numericCheck?: { simpson: string; agreesWithSymbolic: boolean | null };
}

/** Adaptive Simpson quadrature. */
export function numericIntegral(node: Node, v: string, a: number, b: number): number {
  const f = (x: number) => evaluateNumeric(node, { [v]: x });
  const simpson = (lo: number, hi: number, flo: number, fmid: number, fhi: number) =>
    ((hi - lo) / 6) * (flo + 4 * fmid + fhi);

  const rec = (
    lo: number,
    hi: number,
    flo: number,
    fmid: number,
    fhi: number,
    whole: number,
    eps: number,
    depth: number,
  ): number => {
    const mid = (lo + hi) / 2;
    const lmid = (lo + mid) / 2;
    const rmid = (mid + hi) / 2;
    const flmid = f(lmid);
    const frmid = f(rmid);
    const left = simpson(lo, mid, flo, flmid, fmid);
    const right = simpson(mid, hi, fmid, frmid, fhi);
    if (depth > 22 || Math.abs(left + right - whole) <= 15 * eps) {
      return left + right + (left + right - whole) / 15;
    }
    return (
      rec(lo, mid, flo, flmid, fmid, left, eps / 2, depth + 1) +
      rec(mid, hi, fmid, frmid, fhi, right, eps / 2, depth + 1)
    );
  };

  // nudge away from endpoint singularities
  const shrink = (x: number, towards: number) =>
    Number.isFinite(f(x)) ? x : x + (towards - x) * 1e-9;
  const lo = shrink(a, b);
  const hi = shrink(b, a);
  const flo = f(lo);
  const fhi = f(hi);
  const fmid = f((lo + hi) / 2);
  const whole = simpson(lo, hi, flo, fmid, fhi);
  return rec(lo, hi, flo, fmid, fhi, whole, 1e-10, 0);
}

export function integrate(
  input: string,
  variable?: string,
  bounds?: { from: string; to: string },
): IntegralResult {
  const node = parse(input);
  const v = variable ?? pickVar(node);
  const F = antiderivative(node, v);

  if (!bounds) {
    return {
      input,
      variable: v,
      definite: false,
      antiderivative: F ? toText(F) : null,
      antiderivativeLatex: F ? `${toLatex(F)} + C` : null,
      exactValue: null,
      exactValueLatex: null,
      approxValue: null,
      method: F ? 'symbolic antiderivative (power rule / linear substitution)' : 'none found',
      isExact: !!F,
      note: F
        ? 'Indefinite integral. Remember the constant of integration.'
        : 'No closed-form antiderivative was found by the symbolic engine. Do not guess one; either use a different technique or evaluate it numerically over an interval.',
    };
  }

  const a = evaluateNode(parse(bounds.from));
  const b = evaluateNode(parse(bounds.to));
  const simpsonValue = numericIntegral(node, v, a.approx, b.approx);

  if (F) {
    const upper = evaluateNode(substitute(F, v, parse(bounds.to)));
    const lower = evaluateNode(substitute(F, v, parse(bounds.from)));
    const exact = upper.exact && lower.exact ? upper.exact.sub(lower.exact) : null;
    const approx = upper.approx - lower.approx;
    const presented = presentValue(exact ? { exact, approx: exact.toNumber() } : { exact: null, approx });
    const agrees = Math.abs(approx - simpsonValue) <= 1e-6 * Math.max(1, Math.abs(simpsonValue));
    return {
      input,
      variable: v,
      definite: true,
      antiderivative: toText(F),
      antiderivativeLatex: toLatex(F),
      exactValue: presented.exact,
      exactValueLatex: presented.exactLatex,
      approxValue: formatFloat(approx, 10),
      method: 'Fundamental Theorem of Calculus with a symbolic antiderivative',
      isExact: !!exact,
      note: exact
        ? 'Exact value from F(b) - F(a).'
        : 'The antiderivative involves irrational constants, so the value is approximate.',
      numericCheck: { simpson: formatFloat(simpsonValue, 10), agreesWithSymbolic: agrees },
    };
  }

  return {
    input,
    variable: v,
    definite: true,
    antiderivative: null,
    antiderivativeLatex: null,
    exactValue: null,
    exactValueLatex: null,
    approxValue: formatFloat(simpsonValue, 10),
    method: 'adaptive Simpson numerical quadrature',
    isExact: false,
    note: 'No closed form was found, so this value is a numerical approximation.',
    numericCheck: { simpson: formatFloat(simpsonValue, 10), agreesWithSymbolic: null },
  };
}

/* --------------------------------- limits -------------------------------- */

export interface LimitResult {
  input: string;
  variable: string;
  approaching: string;
  direction: 'both' | 'left' | 'right';
  result: string;
  resultLatex: string;
  exists: boolean;
  isExact: boolean;
  method: string;
  samples: { h: string; value: string }[];
  note: string;
}

export function limit(
  input: string,
  variable: string | undefined,
  approaching: string,
  direction: 'both' | 'left' | 'right' = 'both',
): LimitResult {
  const node = parse(input);
  const v = variable ?? pickVar(node);
  const target = approaching.trim();
  const isInfinite = /^[+-]?(Infinity|inf|oo)$/i.test(target.replace(/\\/g, ''));
  const samples: { h: string; value: string }[] = [];

  const evalAt = (x: number) => evaluateNumeric(node, { [v]: x });

  if (isInfinite) {
    const sign = target.startsWith('-') ? -1 : 1;
    const values: number[] = [];
    for (const m of [1e2, 1e3, 1e4, 1e5, 1e6, 1e7]) {
      const y = evalAt(sign * m);
      values.push(y);
      samples.push({ h: `${v} = ${sign * m}`, value: formatFloat(y, 8) });
    }
    const last = values[values.length - 1];
    const prev = values[values.length - 2];
    const converged = Number.isFinite(last) && Math.abs(last - prev) < 1e-4 * Math.max(1, Math.abs(last));
    const diverges = !Number.isFinite(last) || Math.abs(last) > 1e12;
    return {
      input,
      variable: v,
      approaching: target,
      direction: 'both',
      result: diverges ? (last > 0 ? 'Infinity' : '-Infinity') : formatFloat(roundNear(last), 8),
      resultLatex: diverges ? (last > 0 ? '\\infty' : '-\\infty') : formatFloat(roundNear(last), 8),
      exists: !diverges && converged,
      isExact: false,
      method: 'numerical sampling at increasingly large values',
      samples,
      note: diverges
        ? 'The function grows without bound, so the limit does not exist as a finite number.'
        : 'Value estimated numerically; confirm with an algebraic argument such as dividing by the highest power.',
    };
  }

  const point = evaluateNode(parse(target));

  // direct substitution first — if it works exactly, the limit is that value
  try {
    const direct = evaluateNode(node, { scope: { [v]: point } });
    const p = presentValue(direct);
    const nearby = [1e-4, 1e-5].map((h) => evalAt(point.approx + h));
    const continuous = nearby.every(
      (y) => Number.isFinite(y) && Math.abs(y - direct.approx) < 1e-3 * Math.max(1, Math.abs(direct.approx)),
    );
    if (continuous) {
      return {
        input,
        variable: v,
        approaching: target,
        direction,
        result: p.exact ?? p.decimal,
        resultLatex: p.exactLatex ?? p.decimal,
        exists: true,
        isExact: p.isExact,
        method: 'direct substitution (the function is continuous there)',
        samples,
        note: 'The function is defined and continuous at that point, so substitution gives the limit.',
      };
    }
  } catch {
    /* undefined at the point: fall through to sampling */
  }

  const approach = (side: -1 | 1) => {
    const vals: number[] = [];
    for (const h of [1e-1, 1e-2, 1e-3, 1e-4, 1e-5, 1e-6, 1e-7]) {
      const y = evalAt(point.approx + side * h);
      vals.push(y);
      samples.push({ h: `${v} = ${formatFloat(point.approx + side * h, 8)}`, value: formatFloat(y, 8) });
    }
    return vals;
  };

  const left = direction === 'right' ? null : approach(-1);
  const right = direction === 'left' ? null : approach(1);
  const tail = (vals: number[] | null) => (vals ? vals[vals.length - 1] : null);
  const lv = tail(left);
  const rv = tail(right);

  const finite = (x: number | null) => x !== null && Number.isFinite(x) && Math.abs(x) < 1e12;
  let value: number | null = null;
  let exists = false;

  if (direction === 'left') {
    value = lv;
    exists = finite(lv);
  } else if (direction === 'right') {
    value = rv;
    exists = finite(rv);
  } else if (finite(lv) && finite(rv)) {
    exists = Math.abs((lv as number) - (rv as number)) < 1e-4 * Math.max(1, Math.abs(lv as number));
    value = exists ? ((lv as number) + (rv as number)) / 2 : null;
  }

  const rounded = value === null ? null : roundNear(value);
  return {
    input,
    variable: v,
    approaching: target,
    direction,
    result:
      rounded === null
        ? lv !== null && rv !== null && !finite(lv) && !finite(rv)
          ? 'does not exist (unbounded)'
          : 'does not exist (one-sided limits disagree)'
        : formatFloat(rounded, 8),
    resultLatex: rounded === null ? '\\text{DNE}' : formatFloat(rounded, 8),
    exists,
    isExact: false,
    method: 'two-sided numerical approach',
    samples,
    note: exists
      ? 'Estimated numerically. The value is very likely exact if it is a simple number, but confirm algebraically (factor and cancel, or use L\u2019H\u00f4pital\u2019s rule).'
      : 'The one-sided behaviour does not agree, so the two-sided limit does not exist.',
  };
}

/** Snap 0.9999999 to 1 so numeric limits read like the values students expect. */
function roundNear(x: number): number {
  const candidates = [1, 2, 3, 4, 6, 8, 12, 100];
  for (const d of candidates) {
    const r = Math.round(x * d) / d;
    if (Math.abs(r - x) < 1e-6 * Math.max(1, Math.abs(x))) return r;
  }
  return x;
}
