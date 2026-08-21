import { Rational, simplifySurd } from './rational';
import { evaluateNode } from './evaluate';
import type { Node } from './ast';

/**
 * Dense polynomial with exact rational coefficients.
 * coeffs[i] is the coefficient of x^i.
 */
export class Poly {
  readonly coeffs: Rational[];

  constructor(coeffs: Rational[]) {
    const c = [...coeffs];
    while (c.length > 1 && c[c.length - 1].isZero()) c.pop();
    this.coeffs = c.length ? c : [Rational.ZERO];
  }

  static constant(r: Rational) {
    return new Poly([r]);
  }
  static x() {
    return new Poly([Rational.ZERO, Rational.ONE]);
  }

  get degree(): number {
    return this.isZero() ? -Infinity : this.coeffs.length - 1;
  }
  isZero(): boolean {
    return this.coeffs.length === 1 && this.coeffs[0].isZero();
  }
  isConstant(): boolean {
    return this.coeffs.length === 1;
  }
  lead(): Rational {
    return this.coeffs[this.coeffs.length - 1];
  }
  at(i: number): Rational {
    return this.coeffs[i] ?? Rational.ZERO;
  }

  add(o: Poly): Poly {
    const len = Math.max(this.coeffs.length, o.coeffs.length);
    return new Poly(Array.from({ length: len }, (_, i) => this.at(i).add(o.at(i))));
  }
  sub(o: Poly): Poly {
    const len = Math.max(this.coeffs.length, o.coeffs.length);
    return new Poly(Array.from({ length: len }, (_, i) => this.at(i).sub(o.at(i))));
  }
  neg(): Poly {
    return new Poly(this.coeffs.map((c) => c.neg()));
  }
  mul(o: Poly): Poly {
    const out = Array.from({ length: this.coeffs.length + o.coeffs.length - 1 }, () => Rational.ZERO);
    for (let i = 0; i < this.coeffs.length; i++) {
      for (let j = 0; j < o.coeffs.length; j++) {
        out[i + j] = out[i + j].add(this.coeffs[i].mul(o.coeffs[j]));
      }
    }
    return new Poly(out);
  }
  scale(r: Rational): Poly {
    return new Poly(this.coeffs.map((c) => c.mul(r)));
  }
  pow(e: number): Poly {
    if (e < 0 || !Number.isInteger(e)) throw new Error('Polynomial powers must be non-negative integers');
    let out = Poly.constant(Rational.ONE);
    for (let i = 0; i < e; i++) out = out.mul(this);
    return out;
  }

  /** Long division: returns quotient and remainder. */
  divmod(o: Poly): { q: Poly; r: Poly } {
    if (o.isZero()) throw new Error('Polynomial division by zero');
    let r = new Poly([...this.coeffs]);
    const qc = Array.from({ length: Math.max(1, this.coeffs.length - o.coeffs.length + 1) }, () => Rational.ZERO);
    while (!r.isZero() && r.degree >= o.degree) {
      const shift = r.degree - o.degree;
      const factor = r.lead().div(o.lead());
      qc[shift] = factor;
      const sub = o.mul(new Poly([...Array.from({ length: shift }, () => Rational.ZERO), factor]));
      r = r.sub(sub);
    }
    return { q: new Poly(qc), r };
  }

  evaluate(x: Rational): Rational {
    let acc = Rational.ZERO;
    for (let i = this.coeffs.length - 1; i >= 0; i--) acc = acc.mul(x).add(this.coeffs[i]);
    return acc;
  }
  evaluateFloat(x: number): number {
    let acc = 0;
    for (let i = this.coeffs.length - 1; i >= 0; i--) acc = acc * x + this.coeffs[i].toNumber();
    return acc;
  }

  derivative(): Poly {
    if (this.coeffs.length <= 1) return new Poly([Rational.ZERO]);
    return new Poly(this.coeffs.slice(1).map((c, i) => c.mul(Rational.fromInt(i + 1))));
  }

  /** Multiply through by the LCM of denominators, divide by the GCD of numerators. */
  primitive(): { poly: Poly; content: Rational } {
    if (this.isZero()) return { poly: this, content: Rational.ONE };
    let lcm = 1n;
    for (const c of this.coeffs) {
      const d = c.d;
      let g = lcm;
      let b = d;
      while (b) {
        const t = g % b;
        g = b;
        b = t;
      }
      lcm = (lcm * d) / (g || 1n);
    }
    const ints = this.coeffs.map((c) => c.mul(Rational.make(lcm)).n);
    let gcd = 0n;
    for (const v of ints) {
      let a = gcd < 0n ? -gcd : gcd;
      let b = v < 0n ? -v : v;
      while (b) {
        const t = a % b;
        a = b;
        b = t;
      }
      gcd = a;
    }
    if (gcd === 0n) gcd = 1n;
    const content = Rational.make(gcd, lcm);
    return { poly: new Poly(this.coeffs.map((c) => c.div(content))), content };
  }

  toLatex(variable = 'x'): string {
    return polyToString(this, variable, true);
  }
  toString(variable = 'x'): string {
    return polyToString(this, variable, false);
  }
}

function polyToString(p: Poly, v: string, latex: boolean): string {
  if (p.isZero()) return '0';
  const parts: string[] = [];
  for (let i = p.coeffs.length - 1; i >= 0; i--) {
    const c = p.coeffs[i];
    if (c.isZero()) continue;
    const abs = c.abs();
    const sign = c.isNegative() ? '-' : '+';
    let body: string;
    const coeffStr = latex ? abs.toLatex() : abs.toString();
    const showCoeff = !abs.eq(Rational.ONE) || i === 0;
    const varPart = i === 0 ? '' : i === 1 ? v : latex ? `${v}^{${i}}` : `${v}^${i}`;
    if (showCoeff && varPart) {
      const needsParen = !latex && !abs.isInteger();
      body = `${needsParen ? `(${coeffStr})` : coeffStr}${latex ? '' : '*'}${varPart}`;
    } else {
      body = showCoeff ? coeffStr : varPart;
    }
    parts.push(parts.length === 0 ? (sign === '-' ? `-${body}` : body) : ` ${sign} ${body}`);
  }
  return parts.join('');
}

/**
 * Convert an expression tree into a polynomial in one variable.
 * Returns null when the expression is not polynomial (e.g. sin(x), 1/x).
 */
export function toPolynomial(node: Node, variable: string): Poly | null {
  const walk = (n: Node): Poly | null => {
    switch (n.kind) {
      case 'num':
        return Poly.constant(n.value);
      case 'sym':
        if (n.name === variable) return Poly.x();
        try {
          const v = evaluateNode(n);
          if (v.exact) return Poly.constant(v.exact);
        } catch {
          /* not a constant */
        }
        return null;
      case 'neg': {
        const a = walk(n.arg);
        return a ? a.neg() : null;
      }
      case 'bin': {
        const a = walk(n.left);
        if (!a) return null;
        if (n.op === '^') {
          // exponent must be a non-negative integer constant
          let e: number;
          try {
            const v = evaluateNode(n.right);
            if (!v.exact || !v.exact.isInteger()) return null;
            e = Number(v.exact.n);
          } catch {
            return null;
          }
          if (e < 0 || e > 64) return null;
          return a.pow(e);
        }
        const b = walk(n.right);
        if (!b) return null;
        switch (n.op) {
          case '+':
            return a.add(b);
          case '-':
            return a.sub(b);
          case '*':
            return a.mul(b);
          case '/': {
            if (!b.isConstant() || b.coeffs[0].isZero()) return null;
            return a.scale(b.coeffs[0].inv());
          }
        }
        return null;
      }
      case 'call': {
        // constant-valued calls are fine (sqrt(4), gcd(6,4)); anything with the
        // variable inside is not polynomial
        try {
          const v = evaluateNode(n);
          if (v.exact) return Poly.constant(v.exact);
        } catch {
          /* contains the variable */
        }
        return null;
      }
      case 'rel':
        return null;
    }
  };
  return walk(node);
}

export interface RootResult {
  /** Exact rational root. */
  rational?: Rational;
  /** Exact radical root of the form (a + b*sqrt(d))/c. */
  radical?: { a: Rational; b: Rational; d: bigint };
  /** Numeric approximation, always present for real roots. */
  approx: number;
  exact: boolean;
  latex: string;
  multiplicity: number;
}

/** All rational roots via the rational root theorem. */
export function rationalRoots(p: Poly): Rational[] {
  if (p.isZero() || p.degree < 1) return [];
  const { poly } = p.primitive();
  const a0 = poly.coeffs[0];
  const an = poly.lead();
  const roots: Rational[] = [];

  if (a0.isZero()) {
    roots.push(Rational.ZERO);
    let reduced = poly;
    while (!reduced.isZero() && reduced.coeffs[0].isZero()) {
      reduced = new Poly(reduced.coeffs.slice(1));
    }
    return [...roots, ...rationalRoots(reduced)];
  }

  const divisors = (v: bigint): bigint[] => {
    const abs = v < 0n ? -v : v;
    const out: bigint[] = [];
    for (let i = 1n; i * i <= abs; i++) {
      if (abs % i === 0n) {
        out.push(i);
        if (i !== abs / i) out.push(abs / i);
      }
      if (i > 100000n) break;
    }
    return out.sort((x, y) => (x < y ? -1 : 1));
  };

  const ps = divisors(a0.n);
  const qs = divisors(an.n);
  const seen = new Set<string>();
  for (const pn of ps) {
    for (const qn of qs) {
      for (const sign of [1n, -1n]) {
        const cand = Rational.make(sign * pn, qn);
        const key = cand.toString();
        if (seen.has(key)) continue;
        seen.add(key);
        if (poly.evaluate(cand).isZero()) roots.push(cand);
      }
    }
  }
  return roots.sort((a, b) => a.cmp(b));
}

/** Factor out all rational roots; returns linear factors plus the remaining polynomial. */
export function factorRationalRoots(p: Poly): { roots: Rational[]; remainder: Poly } {
  let current = p;
  const roots: Rational[] = [];
  for (let guard = 0; guard < 64; guard++) {
    if (current.degree < 1) break;
    const rs = rationalRoots(current);
    if (!rs.length) break;
    const r = rs[0];
    const { q, r: rem } = current.divmod(new Poly([r.neg(), Rational.ONE]));
    if (!rem.isZero()) break;
    roots.push(r);
    current = q;
  }
  return { roots, remainder: current };
}

/** Exact quadratic roots, kept in radical form when the discriminant is not a perfect square. */
export function quadraticRoots(a: Rational, b: Rational, c: Rational): RootResult[] {
  const disc = b.mul(b).sub(Rational.fromInt(4).mul(a).mul(c));
  const twoA = Rational.fromInt(2).mul(a);
  if (disc.isNegative()) return [];
  if (disc.isZero()) {
    const r = b.neg().div(twoA);
    return [{ rational: r, approx: r.toNumber(), exact: true, latex: r.toLatex(), multiplicity: 2 }];
  }
  // disc = n/d ; sqrt(n/d) = sqrt(n*d)/d
  const inner = disc.n * disc.d;
  const { coeff, radicand } = simplifySurd(inner);
  const sqrtCoeff = Rational.make(coeff, disc.d);
  if (radicand === 1n) {
    const roots = [b.neg().add(sqrtCoeff).div(twoA), b.neg().sub(sqrtCoeff).div(twoA)].sort((x, y) => x.cmp(y));
    return roots.map((r) => ({
      rational: r,
      approx: r.toNumber(),
      exact: true,
      latex: r.toLatex(),
      multiplicity: 1,
    }));
  }
  const base = b.neg().div(twoA);
  const radCoeff = sqrtCoeff.div(twoA);
  const sqrtVal = Math.sqrt(Number(radicand));
  const mk = (sign: 1 | -1): RootResult => {
    const bb = sign === 1 ? radCoeff : radCoeff.neg();
    const approx = base.toNumber() + bb.toNumber() * sqrtVal;
    const bLatex = bb.abs().eq(Rational.ONE) ? '' : bb.abs().toLatex();
    const op = bb.isNegative() ? '-' : '+';
    const latex = `${base.isZero() ? (op === '-' ? '-' : '') : `${base.toLatex()} ${op} `}${bLatex}\\sqrt{${radicand}}`;
    return {
      radical: { a: base, b: bb, d: radicand },
      approx,
      exact: true,
      latex: base.isZero() && op === '+' ? `${bLatex}\\sqrt{${radicand}}` : latex,
      multiplicity: 1,
    };
  };
  return [mk(1), mk(-1)].sort((x, y) => x.approx - y.approx);
}

/** Numeric real roots for higher degrees, via Durand–Kerner then refinement. */
export function numericRoots(p: Poly, tolerance = 1e-12): number[] {
  const n = p.degree;
  if (!Number.isFinite(n) || n < 1) return [];
  const c = p.coeffs.map((x) => x.toNumber());
  const lead = c[n];
  const norm = c.map((x) => x / lead);
  let zs: { re: number; im: number }[] = Array.from({ length: n }, (_, k) => ({
    re: 0.4 * Math.cos((2 * Math.PI * k) / n + 0.5),
    im: 0.4 * Math.sin((2 * Math.PI * k) / n + 0.5) + 0.9,
  }));
  const evalC = (z: { re: number; im: number }) => {
    let re = 0;
    let im = 0;
    for (let i = n; i >= 0; i--) {
      const nre = re * z.re - im * z.im + norm[i];
      im = re * z.im + im * z.re;
      re = nre;
    }
    return { re, im };
  };
  for (let iter = 0; iter < 500; iter++) {
    let maxDelta = 0;
    const next = zs.map((z, i) => {
      let dre = 1;
      let dim = 0;
      for (let j = 0; j < n; j++) {
        if (i === j) continue;
        const are = z.re - zs[j].re;
        const aim = z.im - zs[j].im;
        const nre = dre * are - dim * aim;
        const nim = dre * aim + dim * are;
        dre = nre;
        dim = nim;
      }
      const f = evalC(z);
      const den = dre * dre + dim * dim;
      if (den === 0) return z;
      const qre = (f.re * dre + f.im * dim) / den;
      const qim = (f.im * dre - f.re * dim) / den;
      maxDelta = Math.max(maxDelta, Math.hypot(qre, qim));
      return { re: z.re - qre, im: z.im - qim };
    });
    zs = next;
    if (maxDelta < tolerance) break;
  }
  const real = zs.filter((z) => Math.abs(z.im) < 1e-7).map((z) => z.re);
  // Newton polish
  const dp = p.derivative();
  const polished = real.map((x0) => {
    let x = x0;
    for (let k = 0; k < 60; k++) {
      const fx = p.evaluateFloat(x);
      const dx = dp.evaluateFloat(x);
      if (!Number.isFinite(dx) || Math.abs(dx) < 1e-14) break;
      const step = fx / dx;
      x -= step;
      if (Math.abs(step) < 1e-15) break;
    }
    return x;
  });
  const unique: number[] = [];
  for (const r of polished.sort((a, b) => a - b)) {
    if (!unique.some((u) => Math.abs(u - r) < 1e-8)) unique.push(r);
  }
  return unique;
}
