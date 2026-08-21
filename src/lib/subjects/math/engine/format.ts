import { Rational } from './rational';
import type { Node } from './ast';
import type { Value } from './evaluate';

const FUNC_LATEX: Record<string, string> = {
  sin: '\\sin',
  cos: '\\cos',
  tan: '\\tan',
  cot: '\\cot',
  sec: '\\sec',
  csc: '\\csc',
  asin: '\\arcsin',
  acos: '\\arccos',
  atan: '\\arctan',
  ln: '\\ln',
  log: '\\log',
  log10: '\\log_{10}',
  log2: '\\log_{2}',
  exp: '\\exp',
  min: '\\min',
  max: '\\max',
  gcd: '\\gcd',
};

const GREEK_NAMES = new Set([
  'alpha',
  'beta',
  'gamma',
  'delta',
  'theta',
  'lambda',
  'mu',
  'sigma',
  'phi',
  'omega',
  'pi',
  'tau',
]);

function precedence(n: Node): number {
  switch (n.kind) {
    case 'rel':
      return 0;
    case 'bin':
      return n.op === '+' || n.op === '-' ? 1 : n.op === '*' || n.op === '/' ? 2 : 4;
    case 'neg':
      return 1.5;
    default:
      return 5;
  }
}

function wrap(child: Node, parentPrec: number, latex: boolean): string {
  const s = latex ? toLatex(child) : toText(child);
  return precedence(child) < parentPrec ? (latex ? `\\left(${s}\\right)` : `(${s})`) : s;
}

export function toLatex(n: Node): string {
  switch (n.kind) {
    case 'num':
      return n.value.toLatex();
    case 'sym':
      return GREEK_NAMES.has(n.name) ? `\\${n.name}` : n.name.replace(/_(\w+)/, '_{$1}');
    case 'neg':
      return `-${wrap(n.arg, 2, true)}`;
    case 'rel': {
      const ops: Record<string, string> = {
        '=': '=',
        '<': '<',
        '>': '>',
        '<=': '\\le',
        '>=': '\\ge',
        '!=': '\\ne',
      };
      return `${toLatex(n.left)} ${ops[n.op]} ${toLatex(n.right)}`;
    }
    case 'bin': {
      if (n.op === '/') return `\\frac{${toLatex(n.left)}}{${toLatex(n.right)}}`;
      if (n.op === '^') return `${wrap(n.left, 5, true)}^{${toLatex(n.right)}}`;
      if (n.op === '*') {
        const l = wrap(n.left, 2, true);
        const r = wrap(n.right, 2, true);
        const needsDot = /[0-9]$/.test(l) && /^[0-9]/.test(r);
        return `${l} ${needsDot ? '\\cdot' : ''} ${r}`.replace(/\s+/g, ' ').trim();
      }
      return `${wrap(n.left, 1, true)} ${n.op} ${wrap(n.right, 1, true)}`;
    }
    case 'call': {
      if (n.name === 'sqrt') return `\\sqrt{${toLatex(n.args[0])}}`;
      if (n.name === 'cbrt') return `\\sqrt[3]{${toLatex(n.args[0])}}`;
      if (n.name === 'root') return `\\sqrt[${toLatex(n.args[1])}]{${toLatex(n.args[0])}}`;
      if (n.name === 'abs') return `\\left|${toLatex(n.args[0])}\\right|`;
      if (n.name === 'factorial') return `${wrap(n.args[0], 5, true)}!`;
      const fn = FUNC_LATEX[n.name] ?? `\\operatorname{${n.name}}`;
      return `${fn}\\left(${n.args.map(toLatex).join(', ')}\\right)`;
    }
  }
}

export function toText(n: Node): string {
  switch (n.kind) {
    case 'num':
      return n.value.toString();
    case 'sym':
      return n.name;
    case 'neg':
      return `-${wrap(n.arg, 2, false)}`;
    case 'rel':
      return `${toText(n.left)} ${n.op} ${toText(n.right)}`;
    case 'bin': {
      if (n.op === '^') return `${wrap(n.left, 5, false)}^${wrap(n.right, 5, false)}`;
      const prec = n.op === '+' || n.op === '-' ? 1 : 2;
      return `${wrap(n.left, prec, false)} ${n.op} ${wrap(n.right, n.op === '-' || n.op === '/' ? prec + 0.5 : prec, false)}`;
    }
    case 'call':
      return `${n.name}(${n.args.map(toText).join(', ')})`;
  }
}

export interface PresentedValue {
  /** Exact value as a string, when one exists. */
  exact: string | null;
  exactLatex: string | null;
  /** Decimal form. */
  decimal: string;
  /** True when `decimal` is the complete, non-rounded value. */
  decimalIsExact: boolean;
  isExact: boolean;
  note: string;
}

/**
 * Presents a computed value honestly: exact form, decimal form, and an explicit
 * statement of whether the decimal is exact or rounded.
 */
export function presentValue(v: Value, places = 10): PresentedValue {
  if (v.exact) {
    const finite = v.exact.hasFiniteDecimal();
    return {
      exact: v.exact.toString(),
      exactLatex: v.exact.toLatex(),
      decimal: v.exact.toDecimalString(places),
      decimalIsExact: finite,
      isExact: true,
      note: finite
        ? 'Exact value; the decimal form is also exact.'
        : `Exact value is the fraction; the decimal shown is rounded to ${places} places.`,
    };
  }
  const approx = v.approx;
  return {
    exact: null,
    exactLatex: null,
    decimal: formatFloat(approx, places),
    decimalIsExact: false,
    isExact: false,
    note: 'Approximate value: this quantity is irrational or transcendental, so the decimal is rounded.',
  };
}

export function formatFloat(x: number, places = 10): string {
  if (!Number.isFinite(x)) return x > 0 ? 'Infinity' : x < 0 ? '-Infinity' : 'undefined';
  if (Number.isInteger(x) && Math.abs(x) < 1e15) return String(x);
  const abs = Math.abs(x);
  if (abs !== 0 && (abs < 1e-6 || abs >= 1e15)) return x.toExponential(6);
  const s = x.toFixed(places);
  return s.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
}

/** Renders a rational as a LaTeX fraction or integer. */
export function rationalLatex(r: Rational): string {
  return r.toLatex();
}
