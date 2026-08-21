import { Rational } from './rational';
import { tokenize, type Token } from './tokenizer';
import { bin, call, neg, num, rel, sym, type Node, type RelOp } from './ast';

/** Names that are treated as function calls rather than variables. */
export const KNOWN_FUNCTIONS = new Set([
  'sqrt',
  'cbrt',
  'root',
  'abs',
  'sin',
  'cos',
  'tan',
  'cot',
  'sec',
  'csc',
  'asin',
  'acos',
  'atan',
  'arcsin',
  'arccos',
  'arctan',
  'sinh',
  'cosh',
  'tanh',
  'ln',
  'log',
  'log10',
  'log2',
  'exp',
  'floor',
  'ceil',
  'round',
  'sign',
  'min',
  'max',
  'gcd',
  'lcm',
  'nCr',
  'nPr',
  'mod',
  'deg',
  'rad',
]);

export const KNOWN_CONSTANTS = new Set(['pi', 'e', 'tau', 'phi', 'Infinity']);

/**
 * Grammar (loosest to tightest):
 *   relation := sum (relop sum)?
 *   sum      := product (('+'|'-') product)*
 *   product  := unary (('*'|'/') unary | implicit unary)*
 *   unary    := ('-'|'+') unary | power
 *   power    := postfix ('^' unary)?
 *   postfix  := primary ('!' | '%')*
 *   primary  := number | ident | call | '(' relation ')' | '|' sum '|'
 */
class Parser {
  private i = 0;
  private barDepth = 0;
  private readonly tokens: Token[];

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  private peek(offset = 0): Token {
    return this.tokens[Math.min(this.i + offset, this.tokens.length - 1)];
  }
  private next(): Token {
    return this.tokens[this.i++];
  }
  private atOp(...values: string[]): boolean {
    const t = this.peek();
    return t.type === 'op' && values.includes(t.value);
  }
  private expect(type: Token['type'], value?: string): Token {
    const t = this.peek();
    if (t.type !== type || (value !== undefined && t.value !== value)) {
      throw new SyntaxError(
        `Expected ${value ?? type} but found "${t.value || 'end of input'}" at position ${t.pos}`,
      );
    }
    return this.next();
  }

  parse(): Node {
    const node = this.relation();
    if (this.peek().type !== 'eof') {
      const t = this.peek();
      throw new SyntaxError(`Unexpected "${t.value}" at position ${t.pos}`);
    }
    return node;
  }

  private relation(): Node {
    let left = this.sum();
    while (this.atOp('=', '<', '>', '<=', '>=', '!=')) {
      const op = this.next().value as RelOp;
      const right = this.sum();
      left = rel(op, left, right);
    }
    return left;
  }

  private sum(): Node {
    let left = this.product();
    while (this.atOp('+', '-')) {
      const op = this.next().value as '+' | '-';
      const right = this.product();
      left = bin(op, left, right);
    }
    return left;
  }

  private product(): Node {
    let left = this.unary();
    for (;;) {
      if (this.atOp('*', '/')) {
        const op = this.next().value as '*' | '/';
        left = bin(op, left, this.unary());
        continue;
      }
      if (this.canStartImplicitFactor()) {
        left = bin('*', left, this.unary());
        continue;
      }
      return left;
    }
  }

  /** `2x`, `3(x+1)`, `2sin(x)`, `(x+1)(x-2)` all multiply implicitly. */
  private canStartImplicitFactor(): boolean {
    const t = this.peek();
    if (t.type === 'number' || t.type === 'lparen' || t.type === 'ident') return true;
    // A `|` only starts a new factor when we are not already inside |...|,
    // otherwise `|x|` would swallow its own closing bar.
    if (t.type === 'bar' && this.barDepth === 0) return true;
    return false;
  }

  private unary(): Node {
    if (this.atOp('-')) {
      this.next();
      return neg(this.unary());
    }
    if (this.atOp('+')) {
      this.next();
      return this.unary();
    }
    return this.power();
  }

  private power(): Node {
    const base = this.postfix();
    if (this.atOp('^')) {
      this.next();
      // right-associative, and -x binds inside the exponent: 2^-1
      return bin('^', base, this.unary());
    }
    return base;
  }

  private postfix(): Node {
    let node = this.primary();
    for (;;) {
      if (this.atOp('!')) {
        this.next();
        node = call('factorial', [node]);
        continue;
      }
      if (this.atOp('%')) {
        this.next();
        // "20%" means 20/100 unless used as modulo between two values
        node = bin('/', node, num(Rational.fromInt(100)));
        continue;
      }
      return node;
    }
  }

  private primary(): Node {
    const t = this.peek();

    if (t.type === 'number') {
      this.next();
      return num(Rational.parse(t.value));
    }

    if (t.type === 'lparen') {
      this.next();
      const inner = this.relation();
      this.expect('rparen');
      return inner;
    }

    if (t.type === 'bar') {
      this.next();
      this.barDepth++;
      let inner;
      try {
        inner = this.sum();
      } finally {
        this.barDepth--;
      }
      this.expect('bar');
      return call('abs', [inner]);
    }

    if (t.type === 'ident') {
      this.next();
      const name = t.value;
      const canonical = canonicalFunctionName(name);
      if (KNOWN_FUNCTIONS.has(canonical)) {
        if (this.peek().type === 'lparen') {
          this.next();
          const args: Node[] = [];
          if (this.peek().type !== 'rparen') {
            args.push(this.relation());
            while (this.peek().type === 'comma') {
              this.next();
              args.push(this.relation());
            }
          }
          this.expect('rparen');
          return call(canonical, args);
        }
        // bare application such as `sin x` or `ln 2`
        return call(canonical, [this.power()]);
      }
      return sym(name);
    }

    throw new SyntaxError(
      `Unexpected ${t.type === 'eof' ? 'end of input' : `"${t.value}"`} at position ${t.pos}`,
    );
  }
}

export function canonicalFunctionName(name: string): string {
  const map: Record<string, string> = {
    arcsin: 'asin',
    arccos: 'acos',
    arctan: 'atan',
    lg: 'log10',
  };
  return map[name] ?? name;
}

export function parse(input: string): Node {
  const tokens = tokenize(input);
  if (tokens.length === 1) throw new SyntaxError('Empty expression');
  return new Parser(tokens).parse();
}

/** Parse a list of equations separated by newlines, commas, or semicolons. */
export function parseMany(input: string): Node[] {
  return String(input)
    .split(/[\n;]+|,(?![^()]*\))/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map(parse);
}
