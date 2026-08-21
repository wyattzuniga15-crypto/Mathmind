import {
  Rational,
  binomial,
  exactRoot,
  factorial,
} from './rational';
import type { Node } from './ast';

/**
 * A value is either EXACT (a rational we can prove) or APPROXIMATE (a float).
 * Once anything irrational enters the computation the result is marked
 * approximate and stays that way. The tutor never presents an approximation
 * as an exact answer because this flag travels with the value.
 */
export interface Value {
  exact: Rational | null;
  approx: number;
}

export const exactValue = (r: Rational): Value => ({ exact: r, approx: r.toNumber() });
export const approxValue = (x: number): Value => ({ exact: null, approx: x });

export interface EvalOptions {
  /** Variable bindings, e.g. { x: Rational|number }. */
  scope?: Record<string, Value | Rational | number>;
  /** 'rad' (default) or 'deg' for trig functions. */
  angleMode?: 'rad' | 'deg';
}

export class MathEvalError extends Error {}

function toValue(v: Value | Rational | number): Value {
  if (typeof v === 'number') return Number.isInteger(v) ? exactValue(Rational.fromNumber(v)) : approxValue(v);
  if (v instanceof Rational) return exactValue(v);
  return v;
}

const CONSTANTS: Record<string, Value> = {
  pi: approxValue(Math.PI),
  tau: approxValue(Math.PI * 2),
  e: approxValue(Math.E),
  phi: approxValue((1 + Math.sqrt(5)) / 2),
  Infinity: approxValue(Infinity),
};

function needInt(v: Value, fn: string): bigint {
  if (v.exact && v.exact.isInteger()) return v.exact.n;
  if (Number.isInteger(v.approx)) return BigInt(v.approx);
  throw new MathEvalError(`${fn} requires an integer argument`);
}

/** sqrt / nth root: exact when the root is rational, approximate otherwise. */
function rootValue(v: Value, degree: bigint): Value {
  if (v.exact) {
    const r = exactRoot(v.exact, degree);
    if (r) return exactValue(r);
    if (v.exact.isNegative() && degree % 2n === 0n) {
      throw new MathEvalError(
        `The ${degree === 2n ? 'square' : `${degree}th`} root of a negative number is not a real number`,
      );
    }
  }
  const x = v.approx;
  if (x < 0 && degree % 2n === 0n) {
    throw new MathEvalError('Even roots of negative numbers are not real');
  }
  const d = Number(degree);
  return approxValue(x < 0 ? -Math.pow(-x, 1 / d) : Math.pow(x, 1 / d));
}

function powValue(base: Value, exp: Value): Value {
  if (base.exact && exp.exact) {
    if (exp.exact.isInteger()) {
      if (base.exact.isZero() && exp.exact.isNegative()) {
        throw new MathEvalError('Division by zero: 0 raised to a negative power is undefined');
      }
      return exactValue(base.exact.powInt(exp.exact.n));
    }
    // rational exponent p/q -> exact only when the q-th root is exact
    const q = exp.exact.d;
    const p = exp.exact.n;
    const r = exactRoot(base.exact, q);
    if (r) return exactValue(r.powInt(p));
  }
  const result = Math.pow(base.approx, exp.approx);
  if (Number.isNaN(result)) {
    throw new MathEvalError(
      `${base.approx} raised to the power ${exp.approx} is not a real number`,
    );
  }
  return approxValue(result);
}

export function evaluateNode(node: Node, options: EvalOptions = {}): Value {
  const angleMode = options.angleMode ?? 'rad';
  const scope: Record<string, Value> = {};
  for (const [k, v] of Object.entries(options.scope ?? {})) scope[k] = toValue(v);

  const toAngle = (v: Value): number => (angleMode === 'deg' ? (v.approx * Math.PI) / 180 : v.approx);
  const fromAngle = (x: number): number => (angleMode === 'deg' ? (x * 180) / Math.PI : x);

  const walk = (n: Node): Value => {
    switch (n.kind) {
      case 'num':
        return exactValue(n.value);

      case 'sym': {
        if (n.name in scope) return scope[n.name];
        if (n.name in CONSTANTS) return CONSTANTS[n.name];
        throw new MathEvalError(
          `Unknown variable "${n.name}". Provide a value for it or solve for it instead.`,
        );
      }

      case 'neg': {
        const v = walk(n.arg);
        return v.exact ? exactValue(v.exact.neg()) : approxValue(-v.approx);
      }

      case 'rel':
        throw new MathEvalError(
          'This is an equation or inequality, not a value. Use the equation solver instead.',
        );

      case 'bin': {
        const a = walk(n.left);
        const b = walk(n.right);
        switch (n.op) {
          case '+':
            return a.exact && b.exact ? exactValue(a.exact.add(b.exact)) : approxValue(a.approx + b.approx);
          case '-':
            return a.exact && b.exact ? exactValue(a.exact.sub(b.exact)) : approxValue(a.approx - b.approx);
          case '*':
            return a.exact && b.exact ? exactValue(a.exact.mul(b.exact)) : approxValue(a.approx * b.approx);
          case '/': {
            if (b.exact ? b.exact.isZero() : b.approx === 0) {
              throw new MathEvalError('Division by zero is undefined');
            }
            return a.exact && b.exact ? exactValue(a.exact.div(b.exact)) : approxValue(a.approx / b.approx);
          }
          case '^':
            return powValue(a, b);
        }
        break;
      }

      case 'call': {
        const args = n.args.map(walk);
        const a0 = args[0];
        const need = (k: number) => {
          if (args.length < k) throw new MathEvalError(`${n.name}() expects ${k} argument(s)`);
        };
        switch (n.name) {
          case 'sqrt':
            need(1);
            return rootValue(a0, 2n);
          case 'cbrt':
            need(1);
            return rootValue(a0, 3n);
          case 'root':
            need(2);
            return rootValue(a0, needInt(args[1], 'root'));
          case 'abs':
            need(1);
            return a0.exact ? exactValue(a0.exact.abs()) : approxValue(Math.abs(a0.approx));
          case 'floor':
            need(1);
            return a0.exact
              ? exactValue(Rational.make(a0.exact.floor()))
              : exactValue(Rational.fromNumber(Math.floor(a0.approx)));
          case 'ceil':
            need(1);
            return a0.exact
              ? exactValue(Rational.make(a0.exact.ceil()))
              : exactValue(Rational.fromNumber(Math.ceil(a0.approx)));
          case 'round': {
            need(1);
            if (args.length >= 2) {
              const places = Number(needInt(args[1], 'round'));
              const factor = Rational.fromInt(10).powInt(BigInt(places));
              if (a0.exact) return exactValue(Rational.make(a0.exact.mul(factor).round()).div(factor));
              const f = Math.pow(10, places);
              return approxValue(Math.round(a0.approx * f) / f);
            }
            return a0.exact
              ? exactValue(Rational.make(a0.exact.round()))
              : exactValue(Rational.fromNumber(Math.round(a0.approx)));
          }
          case 'sign':
            need(1);
            return exactValue(Rational.fromInt(a0.exact ? a0.exact.sign() : Math.sign(a0.approx)));
          case 'factorial':
            need(1);
            return exactValue(Rational.make(factorial(needInt(a0, 'factorial'))));
          case 'nCr':
            need(2);
            return exactValue(Rational.make(binomial(needInt(a0, 'nCr'), needInt(args[1], 'nCr'))));
          case 'nPr': {
            need(2);
            const nn = needInt(a0, 'nPr');
            const kk = needInt(args[1], 'nPr');
            return exactValue(Rational.make(factorial(nn) / factorial(nn - kk)));
          }
          case 'gcd': {
            need(2);
            let g = needInt(a0, 'gcd');
            for (let i = 1; i < args.length; i++) {
              let b = needInt(args[i], 'gcd');
              g = g < 0n ? -g : g;
              b = b < 0n ? -b : b;
              while (b) {
                const t = g % b;
                g = b;
                b = t;
              }
            }
            return exactValue(Rational.make(g < 0n ? -g : g));
          }
          case 'lcm': {
            need(2);
            const x = needInt(a0, 'lcm');
            const y = needInt(args[1], 'lcm');
            let g = x < 0n ? -x : x;
            let b = y < 0n ? -y : y;
            while (b) {
              const t = g % b;
              g = b;
              b = t;
            }
            const l = g === 0n ? 0n : (x * y) / g;
            return exactValue(Rational.make(l < 0n ? -l : l));
          }
          case 'mod': {
            need(2);
            const x = needInt(a0, 'mod');
            const m = needInt(args[1], 'mod');
            if (m === 0n) throw new MathEvalError('mod by zero is undefined');
            return exactValue(Rational.make(((x % m) + m) % m));
          }
          case 'min':
          case 'max': {
            need(1);
            const pick = n.name === 'min' ? -1 : 1;
            return args.reduce((best, v) => {
              if (best.exact && v.exact) return v.exact.cmp(best.exact) === pick ? v : best;
              return Math.sign(v.approx - best.approx) === pick ? v : best;
            });
          }
          case 'deg':
            need(1);
            return approxValue((a0.approx * 180) / Math.PI);
          case 'rad':
            need(1);
            return approxValue((a0.approx * Math.PI) / 180);
          case 'exp':
            need(1);
            return approxValue(Math.exp(a0.approx));
          case 'ln': {
            need(1);
            if (a0.approx <= 0) throw new MathEvalError('Logarithm of a non-positive number is undefined');
            if (a0.exact && a0.exact.eq(Rational.ONE)) return exactValue(Rational.ZERO);
            return approxValue(Math.log(a0.approx));
          }
          case 'log10':
          case 'log2':
          case 'log': {
            need(1);
            const base = n.name === 'log2' ? 2 : n.name === 'log10' ? 10 : args[1] ? args[1].approx : 10;
            if (a0.approx <= 0) throw new MathEvalError('Logarithm of a non-positive number is undefined');
            const result = Math.log(a0.approx) / Math.log(base);
            // log_b(b^k) is exact for integer k
            const rounded = Math.round(result);
            if (Math.abs(result - rounded) < 1e-12 && a0.exact) {
              const check = Rational.fromNumber(base).powInt(BigInt(rounded));
              if (check.eq(a0.exact)) return exactValue(Rational.fromInt(rounded));
            }
            return approxValue(result);
          }
          case 'sin':
          case 'cos':
          case 'tan':
          case 'cot':
          case 'sec':
          case 'csc': {
            need(1);
            const t = toAngle(a0);
            const isZero = a0.exact?.isZero() ?? false;
            if (isZero) {
              if (n.name === 'sin') return exactValue(Rational.ZERO);
              if (n.name === 'cos' || n.name === 'sec') return exactValue(Rational.ONE);
              if (n.name === 'tan') return exactValue(Rational.ZERO);
            }
            const table: Record<string, number> = {
              sin: Math.sin(t),
              cos: Math.cos(t),
              tan: Math.tan(t),
              cot: 1 / Math.tan(t),
              sec: 1 / Math.cos(t),
              csc: 1 / Math.sin(t),
            };
            const out = table[n.name];
            if (!Number.isFinite(out)) throw new MathEvalError(`${n.name} is undefined at that value`);
            return approxValue(out);
          }
          case 'asin':
          case 'acos':
          case 'atan': {
            need(1);
            const x = a0.approx;
            if ((n.name === 'asin' || n.name === 'acos') && (x < -1 || x > 1)) {
              throw new MathEvalError(`${n.name} is only defined for inputs between -1 and 1`);
            }
            const raw = n.name === 'asin' ? Math.asin(x) : n.name === 'acos' ? Math.acos(x) : Math.atan(x);
            return approxValue(fromAngle(raw));
          }
          case 'sinh':
            return approxValue(Math.sinh(a0.approx));
          case 'cosh':
            return approxValue(Math.cosh(a0.approx));
          case 'tanh':
            return approxValue(Math.tanh(a0.approx));
          default:
            throw new MathEvalError(`Unknown function "${n.name}"`);
        }
      }
    }
    throw new MathEvalError('Could not evaluate the expression');
  };

  return walk(node);
}

/** Convenience: numeric-only evaluation, used by plotting and root finding. */
export function evaluateNumeric(node: Node, scope: Record<string, number>, angleMode: 'rad' | 'deg' = 'rad'): number {
  try {
    return evaluateNode(node, { scope, angleMode }).approx;
  } catch {
    return NaN;
  }
}
