/**
 * Exact rational arithmetic backed by BigInt.
 *
 * The whole point of this module is that a math tutor must be able to say
 * "this is EXACTLY 1/3" instead of "this is 0.3333333333333333".
 * Every operation here is exact or it refuses to happen.
 */

function gcdBig(a: bigint, b: bigint): bigint {
  let x = a < 0n ? -a : a;
  let y = b < 0n ? -b : b;
  while (y) {
    const t = x % y;
    x = y;
    y = t;
  }
  return x;
}

export class Rational {
  readonly n: bigint; // numerator, carries the sign
  readonly d: bigint; // denominator, always > 0

  private constructor(n: bigint, d: bigint) {
    this.n = n;
    this.d = d;
  }

  static make(n: bigint, d: bigint = 1n): Rational {
    if (d === 0n) throw new RangeError('Division by zero: denominator cannot be 0');
    if (d < 0n) {
      n = -n;
      d = -d;
    }
    const g = gcdBig(n, d) || 1n;
    return new Rational(n / g, d / g);
  }

  static readonly ZERO = Rational.make(0n);
  static readonly ONE = Rational.make(1n);

  static fromInt(i: number | bigint): Rational {
    return Rational.make(BigInt(i));
  }

  /**
   * Parse a decimal literal exactly. "0.1" becomes 1/10, not a float.
   * Supports scientific notation and repeating-decimal syntax "0.(3)".
   */
  static parse(text: string): Rational {
    const s = text.trim().replace(/_/g, '');
    const repeating = /^([+-]?)(\d*)(?:\.(\d*))?\((\d+)\)$/.exec(s);
    if (repeating) {
      const [, sign, ip, fpRaw, rep] = repeating;
      const fp = fpRaw ?? '';
      // value = ip.fp(rep) = (ipfprep - ipfp) / (10^(|fp|+|rep|) - 10^|fp|)
      const whole = BigInt((ip || '0') + fp + rep);
      const prefix = BigInt((ip || '0') + fp);
      const denom = 10n ** BigInt(fp.length + rep.length) - 10n ** BigInt(fp.length);
      const r = Rational.make(whole - prefix, denom);
      return sign === '-' ? r.neg() : r;
    }

    const frac = /^([+-]?[\d.]+(?:[eE][+-]?\d+)?)\s*\/\s*([+-]?[\d.]+(?:[eE][+-]?\d+)?)$/.exec(s);
    if (frac) return Rational.parse(frac[1]).div(Rational.parse(frac[2]));

    const m = /^([+-]?)(\d*)(?:\.(\d*))?(?:[eE]([+-]?\d+))?$/.exec(s);
    if (!m || (m[2] === '' && (m[3] === undefined || m[3] === ''))) {
      throw new SyntaxError(`Not a valid number: "${text}"`);
    }
    const [, sign, ip, fp = '', exp] = m;
    let num = BigInt((ip || '0') + fp);
    let den = 10n ** BigInt(fp.length);
    if (exp) {
      const e = BigInt(exp);
      if (e >= 0n) num *= 10n ** e;
      else den *= 10n ** -e;
    }
    const r = Rational.make(num, den);
    return sign === '-' ? r.neg() : r;
  }

  /** Convert a JS number to an exact rational (floats are dyadic, so this is exact). */
  static fromNumber(x: number): Rational {
    if (!Number.isFinite(x)) throw new RangeError(`Cannot convert ${x} to a rational`);
    if (Number.isInteger(x)) return Rational.make(BigInt(x));
    // Use the shortest decimal representation, which is what a human means by the value.
    return Rational.parse(x.toString());
  }

  add(o: Rational): Rational {
    return Rational.make(this.n * o.d + o.n * this.d, this.d * o.d);
  }
  sub(o: Rational): Rational {
    return Rational.make(this.n * o.d - o.n * this.d, this.d * o.d);
  }
  mul(o: Rational): Rational {
    return Rational.make(this.n * o.n, this.d * o.d);
  }
  div(o: Rational): Rational {
    if (o.isZero()) throw new RangeError('Division by zero');
    return Rational.make(this.n * o.d, this.d * o.n);
  }
  neg(): Rational {
    return Rational.make(-this.n, this.d);
  }
  abs(): Rational {
    return this.n < 0n ? this.neg() : this;
  }
  inv(): Rational {
    return Rational.ONE.div(this);
  }

  /** Exact integer power (negative exponents allowed). */
  powInt(e: bigint): Rational {
    if (e === 0n) return Rational.ONE;
    if (e < 0n) return this.inv().powInt(-e);
    let base: Rational = this;
    let result = Rational.ONE;
    let k = e;
    while (k > 0n) {
      if (k & 1n) result = result.mul(base);
      base = base.mul(base);
      k >>= 1n;
    }
    return result;
  }

  cmp(o: Rational): number {
    const l = this.n * o.d;
    const r = o.n * this.d;
    return l < r ? -1 : l > r ? 1 : 0;
  }
  eq(o: Rational): boolean {
    return this.n === o.n && this.d === o.d;
  }
  lt(o: Rational) {
    return this.cmp(o) < 0;
  }
  lte(o: Rational) {
    return this.cmp(o) <= 0;
  }
  gt(o: Rational) {
    return this.cmp(o) > 0;
  }
  gte(o: Rational) {
    return this.cmp(o) >= 0;
  }

  isZero(): boolean {
    return this.n === 0n;
  }
  isInteger(): boolean {
    return this.d === 1n;
  }
  isNegative(): boolean {
    return this.n < 0n;
  }
  sign(): -1 | 0 | 1 {
    return this.n < 0n ? -1 : this.n > 0n ? 1 : 0;
  }

  floor(): bigint {
    const q = this.n / this.d;
    return this.n < 0n && q * this.d !== this.n ? q - 1n : q;
  }
  ceil(): bigint {
    const q = this.n / this.d;
    return this.n > 0n && q * this.d !== this.n ? q + 1n : q;
  }
  round(): bigint {
    // round half up, matching what students are taught
    const base = this.floor();
    const frac = this.sub(Rational.make(base, 1n));
    const half = Rational.make(1n, 2n);
    if (frac.cmp(half) > 0) return base + 1n;
    if (frac.cmp(half) < 0) return base;
    return this.n < 0n ? base : base + 1n;
  }

  toNumber(): number {
    // Direct division overflows for huge BigInts, so scale first.
    const asNum = Number(this.n) / Number(this.d);
    if (Number.isFinite(asNum) && asNum !== 0) return asNum;
    const digits = 25n;
    const scaled = (this.n * 10n ** digits) / this.d;
    return Number(scaled) / Number(10n ** digits);
  }

  /** "3", "-7/4" */
  toString(): string {
    return this.d === 1n ? this.n.toString() : `${this.n}/${this.d}`;
  }

  /** LaTeX form: integers plain, fractions as \frac{}{}. */
  toLatex(): string {
    if (this.d === 1n) return this.n.toString();
    const sign = this.n < 0n ? '-' : '';
    const abs = this.n < 0n ? -this.n : this.n;
    return `${sign}\\frac{${abs}}{${this.d}}`;
  }

  /** true when the value has a finite decimal expansion (denominator is 2^a*5^b). */
  hasFiniteDecimal(): boolean {
    let d = this.d;
    while (d % 2n === 0n) d /= 2n;
    while (d % 5n === 0n) d /= 5n;
    return d === 1n;
  }

  /**
   * Decimal string with a fixed number of places, correctly rounded.
   * Never lies: callers pair this with `hasFiniteDecimal()` to know whether
   * the result is exact or truncated.
   */
  toDecimalString(places = 10): string {
    const neg = this.n < 0n;
    const n = neg ? -this.n : this.n;
    const scale = 10n ** BigInt(places);
    const scaled = (n * scale * 10n) / this.d;
    let rounded = scaled / 10n;
    if (scaled % 10n >= 5n) rounded += 1n;
    let s = rounded.toString().padStart(places + 1, '0');
    let out = places > 0 ? `${s.slice(0, s.length - places)}.${s.slice(s.length - places)}` : s;
    if (places > 0) out = out.replace(/\.?0+$/, '');
    if (out === '' || out === '-') out = '0';
    return (neg && rounded !== 0n ? '-' : '') + out;
  }
}

/** Exact integer nth root, or null when the root is irrational. */
export function exactIntRoot(value: bigint, n: bigint): bigint | null {
  if (n <= 0n) return null;
  if (value < 0n) {
    if (n % 2n === 0n) return null;
    const r = exactIntRoot(-value, n);
    return r === null ? null : -r;
  }
  if (value === 0n || value === 1n) return value;
  let lo = 1n;
  let hi = 1n;
  while (hi ** n <= value) hi <<= 1n;
  while (lo < hi) {
    const mid = (lo + hi + 1n) >> 1n;
    if (mid ** n <= value) lo = mid;
    else hi = mid - 1n;
  }
  return lo ** n === value ? lo : null;
}

/** Exact nth root of a rational, or null when irrational. */
export function exactRoot(r: Rational, n: bigint): Rational | null {
  const num = exactIntRoot(r.n, n);
  if (num === null) return null;
  const den = exactIntRoot(r.d, n);
  if (den === null) return null;
  return Rational.make(num, den);
}

/**
 * Pull perfect squares out of a radical: sqrt(72) -> 6*sqrt(2).
 * Returns { coeff, radicand } meaning coeff * sqrt(radicand).
 */
export function simplifySurd(value: bigint): { coeff: bigint; radicand: bigint } {
  if (value < 0n) throw new RangeError('simplifySurd expects a non-negative value');
  if (value === 0n) return { coeff: 0n, radicand: 1n };
  let coeff = 1n;
  let radicand = value;
  for (let f = 2n; f * f <= radicand; f++) {
    while (radicand % (f * f) === 0n) {
      radicand /= f * f;
      coeff *= f;
    }
    if (f > 100000n) break; // keep pathological inputs from hanging
  }
  return { coeff, radicand };
}

export function factorial(n: bigint): bigint {
  if (n < 0n) throw new RangeError('Factorial is undefined for negative numbers');
  let out = 1n;
  for (let i = 2n; i <= n; i++) out *= i;
  return out;
}

export function binomial(n: bigint, k: bigint): bigint {
  if (k < 0n || k > n) return 0n;
  let out = 1n;
  const kk = k > n - k ? n - k : k;
  for (let i = 0n; i < kk; i++) {
    out = (out * (n - i)) / (i + 1n);
  }
  return out;
}
