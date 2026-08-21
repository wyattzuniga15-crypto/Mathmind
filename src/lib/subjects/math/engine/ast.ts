import { Rational } from './rational';

export type BinOp = '+' | '-' | '*' | '/' | '^';
export type RelOp = '=' | '<' | '>' | '<=' | '>=' | '!=';

export type Node =
  | { kind: 'num'; value: Rational }
  | { kind: 'sym'; name: string }
  | { kind: 'bin'; op: BinOp; left: Node; right: Node }
  | { kind: 'neg'; arg: Node }
  | { kind: 'call'; name: string; args: Node[] }
  | { kind: 'rel'; op: RelOp; left: Node; right: Node };

export const num = (v: Rational | number | bigint): Node => ({
  kind: 'num',
  value: v instanceof Rational ? v : Rational.fromInt(typeof v === 'number' ? Math.trunc(v) : v),
});
export const sym = (name: string): Node => ({ kind: 'sym', name });
export const bin = (op: BinOp, left: Node, right: Node): Node => ({ kind: 'bin', op, left, right });
export const neg = (arg: Node): Node => ({ kind: 'neg', arg });
export const call = (name: string, args: Node[]): Node => ({ kind: 'call', name, args });
export const rel = (op: RelOp, left: Node, right: Node): Node => ({ kind: 'rel', op, left, right });

export const ZERO = num(Rational.ZERO);
export const ONE = num(Rational.ONE);

export function isNum(n: Node): n is { kind: 'num'; value: Rational } {
  return n.kind === 'num';
}
export function isNumValue(n: Node, v: number): boolean {
  return n.kind === 'num' && n.value.eq(Rational.fromInt(v));
}

/** Every distinct variable name used in the expression, sorted. */
export function variablesOf(n: Node, into = new Set<string>()): string[] {
  switch (n.kind) {
    case 'num':
      break;
    case 'sym':
      into.add(n.name);
      break;
    case 'bin':
    case 'rel':
      variablesOf(n.left, into);
      variablesOf(n.right, into);
      break;
    case 'neg':
      variablesOf(n.arg, into);
      break;
    case 'call':
      n.args.forEach((a) => variablesOf(a, into));
      break;
  }
  return [...into].sort();
}

export function cloneNode(n: Node): Node {
  switch (n.kind) {
    case 'num':
      return { kind: 'num', value: n.value };
    case 'sym':
      return { kind: 'sym', name: n.name };
    case 'bin':
      return { kind: 'bin', op: n.op, left: cloneNode(n.left), right: cloneNode(n.right) };
    case 'rel':
      return { kind: 'rel', op: n.op, left: cloneNode(n.left), right: cloneNode(n.right) };
    case 'neg':
      return { kind: 'neg', arg: cloneNode(n.arg) };
    case 'call':
      return { kind: 'call', name: n.name, args: n.args.map(cloneNode) };
  }
}

export function nodeEquals(a: Node, b: Node): boolean {
  if (a.kind !== b.kind) return false;
  switch (a.kind) {
    case 'num':
      return a.value.eq((b as typeof a).value);
    case 'sym':
      return a.name === (b as typeof a).name;
    case 'bin': {
      const o = b as typeof a;
      return a.op === o.op && nodeEquals(a.left, o.left) && nodeEquals(a.right, o.right);
    }
    case 'rel': {
      const o = b as typeof a;
      return a.op === o.op && nodeEquals(a.left, o.left) && nodeEquals(a.right, o.right);
    }
    case 'neg':
      return nodeEquals(a.arg, (b as typeof a).arg);
    case 'call': {
      const o = b as typeof a;
      return (
        a.name === o.name &&
        a.args.length === o.args.length &&
        a.args.every((x, i) => nodeEquals(x, o.args[i]))
      );
    }
  }
}

/** Substitute a variable with a subtree. */
export function substitute(n: Node, name: string, value: Node): Node {
  switch (n.kind) {
    case 'num':
      return n;
    case 'sym':
      return n.name === name ? cloneNode(value) : n;
    case 'bin':
      return bin(n.op, substitute(n.left, name, value), substitute(n.right, name, value));
    case 'rel':
      return rel(n.op, substitute(n.left, name, value), substitute(n.right, name, value));
    case 'neg':
      return neg(substitute(n.arg, name, value));
    case 'call':
      return call(
        n.name,
        n.args.map((a) => substitute(a, name, value)),
      );
  }
}
