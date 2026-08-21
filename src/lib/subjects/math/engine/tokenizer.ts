/**
 * Turns human / LaTeX-ish math text into tokens.
 *
 * Students paste things like "\frac{3}{4}x^{2} \le 12" and models emit LaTeX,
 * so normalization happens here rather than being pushed onto the caller.
 */

export type TokenType =
  | 'number'
  | 'ident'
  | 'op'
  | 'lparen'
  | 'rparen'
  | 'comma'
  | 'bar'
  | 'eof';

export interface Token {
  type: TokenType;
  value: string;
  pos: number;
}

const GREEK: Record<string, string> = {
  '\\alpha': 'alpha',
  '\\beta': 'beta',
  '\\gamma': 'gamma',
  '\\theta': 'theta',
  '\\lambda': 'lambda',
  '\\mu': 'mu',
  '\\sigma': 'sigma',
  '\\phi': 'phi',
  '\\omega': 'omega',
  '\\pi': 'pi',
};

/** Rewrite `\frac{a}{b}` (and \dfrac/\tfrac) into `((a)/(b))`, innermost first. */
function expandFractions(input: string): string {
  let s = input;
  for (let guard = 0; guard < 100; guard++) {
    const idx = s.search(/\\[dt]?frac\s*\{/);
    if (idx === -1) break;
    const braceStart = s.indexOf('{', idx);
    const first = matchBrace(s, braceStart);
    if (first === -1) break;
    let j = first + 1;
    while (j < s.length && /\s/.test(s[j])) j++;
    if (s[j] !== '{') break;
    const second = matchBrace(s, j);
    if (second === -1) break;
    const numerator = s.slice(braceStart + 1, first);
    const denominator = s.slice(j + 1, second);
    s = `${s.slice(0, idx)}((${numerator})/(${denominator}))${s.slice(second + 1)}`;
  }
  return s;
}

function matchBrace(s: string, open: number): number {
  if (s[open] !== '{') return -1;
  let depth = 0;
  for (let i = open; i < s.length; i++) {
    if (s[i] === '{') depth++;
    else if (s[i] === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/** Rewrite `\sqrt[3]{x}` -> `root(x,3)` and `\sqrt{x}` -> `sqrt(x)`. */
function expandRoots(input: string): string {
  let s = input;
  for (let guard = 0; guard < 100; guard++) {
    const m = /\\sqrt\s*(\[([^\]]*)\])?\s*\{/.exec(s);
    if (!m) break;
    const braceStart = s.indexOf('{', m.index);
    const end = matchBrace(s, braceStart);
    if (end === -1) break;
    const body = s.slice(braceStart + 1, end);
    const degree = m[2];
    const repl = degree ? `root((${body}),(${degree}))` : `sqrt((${body}))`;
    s = s.slice(0, m.index) + repl + s.slice(end + 1);
  }
  return s;
}

/** Superscript/subscript braces: `x^{2}` -> `x^(2)`. */
function expandBraces(input: string): string {
  let s = input;
  for (let guard = 0; guard < 200; guard++) {
    const idx = s.indexOf('{');
    if (idx === -1) break;
    const end = matchBrace(s, idx);
    if (end === -1) {
      s = s.replace('{', '(');
      continue;
    }
    s = `${s.slice(0, idx)}(${s.slice(idx + 1, end)})${s.slice(end + 1)}`;
  }
  return s.replace(/\}/g, ')');
}

export function normalizeMathInput(raw: string): string {
  let s = String(raw ?? '').trim();

  // strip display/inline math delimiters
  s = s.replace(/^\$\$?|\$\$?$/g, '').trim();
  s = s.replace(/\\\[|\\\]|\\\(|\\\)/g, ' ');
  s = s.replace(/\\left|\\right/g, '');
  s = s.replace(/\\!|\\,|\\;|\\quad|\\qquad|\\ /g, ' ');
  s = s.replace(/\\displaystyle/g, ' ');

  s = expandFractions(s);
  s = expandRoots(s);

  // binary operators & relations
  s = s.replace(/\\cdot|\\times|·|×/g, '*');
  s = s.replace(/\\div|÷/g, '/');
  s = s.replace(/\\pm/g, '+'); // caller handles ± cases explicitly
  s = s.replace(/\\leq|\\le|≤/g, '<=');
  s = s.replace(/\\geq|\\ge|≥/g, '>=');
  s = s.replace(/\\neq|\\ne|≠/g, '!=');
  s = s.replace(/\\infty|∞/g, 'Infinity');

  // functions & constants
  s = s.replace(
    /\\(sin|cos|tan|cot|sec|csc|arcsin|arccos|arctan|sinh|cosh|tanh|ln|log|exp|min|max|gcd|deg)\b/g,
    '$1',
  );
  for (const [tex, plain] of Object.entries(GREEK)) {
    s = s.split(tex).join(plain);
  }
  s = s.replace(/π/g, 'pi');
  s = s.replace(/√/g, 'sqrt');

  s = expandBraces(s);

  // unicode exponents and misc
  s = s
    .replace(/²/g, '^2')
    .replace(/³/g, '^3')
    .replace(/⁴/g, '^4')
    .replace(/−/g, '-')
    .replace(/–/g, '-');

  // subscripts become part of the identifier: x_1 -> x_1 (kept as-is)
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

const OPERATORS = ['<=', '>=', '!=', '==', '+', '-', '*', '/', '^', '=', '<', '>', '%', '!'];

export function tokenize(input: string): Token[] {
  const s = normalizeMathInput(input);
  const tokens: Token[] = [];
  let i = 0;

  while (i < s.length) {
    const c = s[i];
    if (c === ' ' || c === '\t' || c === '\n') {
      i++;
      continue;
    }
    if (c >= '0' && c <= '9') {
      const start = i;
      while (i < s.length && /[0-9]/.test(s[i])) i++;
      if (s[i] === '.') {
        i++;
        while (i < s.length && /[0-9]/.test(s[i])) i++;
      }
      if (/[eE]/.test(s[i] ?? '') && /[0-9+-]/.test(s[i + 1] ?? '')) {
        const save = i;
        i++;
        if (s[i] === '+' || s[i] === '-') i++;
        if (/[0-9]/.test(s[i] ?? '')) {
          while (i < s.length && /[0-9]/.test(s[i])) i++;
        } else {
          i = save;
        }
      }
      tokens.push({ type: 'number', value: s.slice(start, i), pos: start });
      continue;
    }
    if (c === '.' && /[0-9]/.test(s[i + 1] ?? '')) {
      const start = i;
      i++;
      while (i < s.length && /[0-9]/.test(s[i])) i++;
      tokens.push({ type: 'number', value: s.slice(start, i), pos: start });
      continue;
    }
    if (/[A-Za-z]/.test(c)) {
      const start = i;
      while (i < s.length && /[A-Za-z0-9_]/.test(s[i])) i++;
      tokens.push({ type: 'ident', value: s.slice(start, i), pos: start });
      continue;
    }
    if (c === '(' || c === '[') {
      tokens.push({ type: 'lparen', value: '(', pos: i++ });
      continue;
    }
    if (c === ')' || c === ']') {
      tokens.push({ type: 'rparen', value: ')', pos: i++ });
      continue;
    }
    if (c === ',') {
      tokens.push({ type: 'comma', value: ',', pos: i++ });
      continue;
    }
    if (c === '|') {
      tokens.push({ type: 'bar', value: '|', pos: i++ });
      continue;
    }
    const op = OPERATORS.find((o) => s.startsWith(o, i));
    if (op) {
      tokens.push({ type: 'op', value: op === '==' ? '=' : op, pos: i });
      i += op.length;
      continue;
    }
    throw new SyntaxError(`Unexpected character "${c}" at position ${i} in "${s}"`);
  }

  tokens.push({ type: 'eof', value: '', pos: s.length });
  return tokens;
}
