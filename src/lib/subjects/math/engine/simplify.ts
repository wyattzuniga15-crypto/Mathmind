import { Rational } from './rational';
import { evaluateNode } from './evaluate';
import { toText } from './format';
import { bin, call, neg, num, rel, sym, type Node } from './ast';

/**
 * Canonical form: a sum of monomials over "atoms".
 *
 * An atom is either a variable (`x`) or an opaque subtree that is not
 * polynomial (`sin(x)`, `1/(x+1)`). Treating those as atoms means the same
 * machinery expands `(x+1)(x-2)` and collects `2sin(x) + 3sin(x)`.
 */
type Factors = Array<[string, number]>;

interface Term {
  coeff: Rational;
  factors: Factors;
}

export class MultiPoly {
  terms: Map<string, Term>;
  atoms: Map<string, Node>;

  constructor(atoms: Map<string, Node>) {
    this.terms = new Map();
    this.atoms = atoms;
  }

  static constant(r: Rational, atoms: Map<string, Node>): MultiPoly {
    const p = new MultiPoly(atoms);
    if (!r.isZero()) p.terms.set('', { coeff: r, factors: [] });
    return p;
  }

  static atom(key: string, node: Node, atoms: Map<string, Node>): MultiPoly {
    atoms.set(key, node);
    const p = new MultiPoly(atoms);
    p.terms.set(monoKey([[key, 1]]), { coeff: Rational.ONE, factors: [[key, 1]] });
    return p;
  }

  isZero() {
    return this.terms.size === 0;
  }

  constantValue(): Rational | null {
    if (this.terms.size === 0) return Rational.ZERO;
    if (this.terms.size === 1 && this.terms.has('')) return this.terms.get('')!.coeff;
    return null;
  }

  addTerm(coeff: Rational, factors: Factors) {
    if (coeff.isZero()) return;
    const key = monoKey(factors);
    const existing = this.terms.get(key);
    if (existing) {
      const sum = existing.coeff.add(coeff);
      if (sum.isZero()) this.terms.delete(key);
      else existing.coeff = sum;
    } else {
      this.terms.set(key, { coeff, factors: normalizeFactors(factors) });
    }
  }

  add(o: MultiPoly): MultiPoly {
    const out = new MultiPoly(this.atoms);
    for (const t of this.terms.values()) out.addTerm(t.coeff, t.factors);
    for (const t of o.terms.values()) out.addTerm(t.coeff, t.factors);
    return out;
  }

  scale(r: Rational): MultiPoly {
    const out = new MultiPoly(this.atoms);
    if (r.isZero()) return out;
    for (const t of this.terms.values()) out.addTerm(t.coeff.mul(r), t.factors);
    return out;
  }

  sub(o: MultiPoly): MultiPoly {
    return this.add(o.scale(Rational.fromInt(-1)));
  }

  mul(o: MultiPoly): MultiPoly {
    const out = new MultiPoly(this.atoms);
    for (const a of this.terms.values()) {
      for (const b of o.terms.values()) {
        out.addTerm(a.coeff.mul(b.coeff), [...a.factors, ...b.factors]);
      }
    }
    return out;
  }

  pow(e: number): MultiPoly {
    let out = MultiPoly.constant(Rational.ONE, this.atoms);
    for (let i = 0; i < e; i++) out = out.mul(this);
    return out;
  }

  /** Total degree of a term, used only for output ordering. */
  private static degreeOf(t: Term): number {
    return t.factors.reduce((a, [, e]) => a + e, 0);
  }

  toNode(): Node {
    if (this.terms.size === 0) return num(Rational.ZERO);
    const allKeys = [...new Set([...this.terms.values()].flatMap((t) => t.factors.map(([k]) => k)))].sort();
    const expOf = (t: Term, key: string) => t.factors.find(([k]) => k === key)?.[1] ?? 0;
    const sorted = [...this.terms.values()].sort((a, b) => {
      const d = MultiPoly.degreeOf(b) - MultiPoly.degreeOf(a);
      if (d !== 0) return d;
      // same total degree: highest power of the first variable comes first,
      // so (a+b)^2 prints as a^2 + 2ab + b^2
      for (const key of allKeys) {
        const diff = expOf(b, key) - expOf(a, key);
        if (diff !== 0) return diff;
      }
      return monoKey(a.factors).localeCompare(monoKey(b.factors));
    });

    let result: Node | null = null;
    for (const term of sorted) {
      const isNegative = term.coeff.isNegative();
      const magnitude = term.coeff.abs();
      let piece: Node | null = null;
      for (const [key, exp] of term.factors) {
        const base = this.atoms.get(key)!;
        const factorNode = exp === 1 ? base : bin('^', base, num(Rational.fromInt(exp)));
        piece = piece ? bin('*', piece, factorNode) : factorNode;
      }
      let termNode: Node;
      if (!piece) termNode = num(magnitude);
      else if (magnitude.eq(Rational.ONE)) termNode = piece;
      else termNode = bin('*', num(magnitude), piece);

      if (result === null) result = isNegative ? neg(termNode) : termNode;
      else result = bin(isNegative ? '-' : '+', result, termNode);
    }
    return result!;
  }
}

function normalizeFactors(factors: Factors): Factors {
  const map = new Map<string, number>();
  for (const [k, e] of factors) map.set(k, (map.get(k) ?? 0) + e);
  return [...map.entries()].filter(([, e]) => e !== 0).sort((a, b) => a[0].localeCompare(b[0]));
}

function monoKey(factors: Factors): string {
  return normalizeFactors(factors)
    .map(([k, e]) => `${k}^${e}`)
    .join('*');
}

function constantOf(node: Node): Rational | null {
  try {
    const v = evaluateNode(node);
    return v.exact;
  } catch {
    return null;
  }
}

export function toMultiPoly(node: Node, atoms = new Map<string, Node>()): MultiPoly {
  const walk = (n: Node): MultiPoly => {
    switch (n.kind) {
      case 'num':
        return MultiPoly.constant(n.value, atoms);
      case 'sym': {
        const c = constantOf(n);
        if (c) return MultiPoly.constant(c, atoms);
        return MultiPoly.atom(`v:${n.name}`, n, atoms);
      }
      case 'neg':
        return walk(n.arg).scale(Rational.fromInt(-1));
      case 'bin': {
        if (n.op === '+') return walk(n.left).add(walk(n.right));
        if (n.op === '-') return walk(n.left).sub(walk(n.right));
        if (n.op === '*') return walk(n.left).mul(walk(n.right));
        if (n.op === '/') {
          const right = walk(n.right);
          const c = right.constantValue();
          if (c && !c.isZero()) return walk(n.left).scale(c.inv());
          const left = walk(n.left);
          const lc = left.constantValue();
          if (lc && lc.isZero()) return MultiPoly.constant(Rational.ZERO, atoms);
          const node = bin('/', left.toNode(), right.toNode());
          return MultiPoly.atom(`a:${toText(node)}`, node, atoms);
        }
        // '^'
        const expConst = constantOf(n.right);
        const base = walk(n.left);
        if (expConst && expConst.isInteger()) {
          const e = Number(expConst.n);
          if (e >= 0 && e <= 32) return base.pow(e);
          if (e < 0 && e >= -32) {
            const inner = bin('^', base.toNode(), num(expConst));
            return MultiPoly.atom(`a:${toText(inner)}`, inner, atoms);
          }
        }
        const node = bin('^', base.toNode(), walk(n.right).toNode());
        return MultiPoly.atom(`a:${toText(node)}`, node, atoms);
      }
      case 'call': {
        const c = constantOf(n);
        if (c) return MultiPoly.constant(c, atoms);
        const simplifiedArgs = n.args.map((a) => walk(a).toNode());
        const node = call(n.name, simplifiedArgs);
        return MultiPoly.atom(`a:${toText(node)}`, node, atoms);
      }
      case 'rel':
        throw new Error('Cannot normalize a relation as a single expression');
    }
  };
  return walk(node);
}

/** Fully expand and collect like terms. */
export function simplify(node: Node): Node {
  if (node.kind === 'rel') return rel(node.op, simplify(node.left), simplify(node.right));
  return toMultiPoly(node).toNode();
}

export const expand = simplify;

/** Structural equality after canonicalisation. */
export function structurallyEqual(a: Node, b: Node): boolean {
  try {
    const diff = toMultiPoly(bin('-', a, b));
    return diff.isZero();
  } catch {
    return false;
  }
}

export { sym, num };
