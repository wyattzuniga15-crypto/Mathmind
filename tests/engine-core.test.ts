import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Rational, exactRoot, simplifySurd, binomial } from '../src/lib/subjects/math/engine/rational';
import { parse } from '../src/lib/subjects/math/engine/parser';
import { normalizeMathInput } from '../src/lib/subjects/math/engine/tokenizer';
import { evaluateNode } from '../src/lib/subjects/math/engine/evaluate';
import { presentValue, toLatex } from '../src/lib/subjects/math/engine/format';
import { solveEquation, solveSystem, solveInequality } from '../src/lib/subjects/math/engine/algebra';

const evalText = (s: string, scope?: Record<string, number>) => evaluateNode(parse(s), { scope });
const exactStr = (s: string) => {
  const v = evalText(s);
  assert.ok(v.exact, `expected ${s} to be exact`);
  return v.exact!.toString();
};

test('rational arithmetic is exact', () => {
  assert.equal(Rational.parse('0.1').add(Rational.parse('0.2')).toString(), '3/10');
  assert.equal(Rational.parse('1').div(Rational.fromInt(3)).toString(), '1/3');
  assert.equal(Rational.parse('0.(3)').toString(), '1/3');
  assert.equal(Rational.parse('-2.5').toString(), '-5/2');
  assert.equal(Rational.make(6n, -4n).toString(), '-3/2');
  assert.equal(Rational.fromInt(2).powInt(-3n).toString(), '1/8');
  assert.equal(Rational.parse('7/1').toDecimalString(3), '7');
  assert.equal(Rational.make(1n, 3n).toDecimalString(6), '0.333333');
  assert.equal(Rational.make(1n, 3n).hasFiniteDecimal(), false);
  assert.equal(Rational.make(1n, 8n).hasFiniteDecimal(), true);
  assert.equal(Rational.make(-7n, 2n).floor(), -4n);
  assert.equal(Rational.make(5n, 2n).round(), 3n);
  assert.equal(binomial(10n, 3n), 120n);
});

test('exact roots and surds', () => {
  assert.equal(exactRoot(Rational.make(9n, 4n), 2n)!.toString(), '3/2');
  assert.equal(exactRoot(Rational.fromInt(2), 2n), null);
  assert.deepEqual(simplifySurd(72n), { coeff: 6n, radicand: 2n });
  assert.deepEqual(simplifySurd(13n), { coeff: 1n, radicand: 13n });
});

test('normalizes LaTeX input', () => {
  assert.equal(normalizeMathInput('\\frac{3}{4}'), '((3)/(4))');
  assert.equal(normalizeMathInput('x^{2}'), 'x^(2)');
  assert.equal(normalizeMathInput('\\sqrt{16}'), 'sqrt((16))');
  assert.equal(normalizeMathInput('2 \\cdot 3 \\le 7'), '2 * 3 <= 7');
  assert.equal(normalizeMathInput('$$\\frac{1}{2}x$$'), '((1)/(2))x');
});

test('parser handles implicit multiplication and precedence', () => {
  assert.equal(exactStr('2+3*4'), '14');
  assert.equal(exactStr('(2+3)*4'), '20');
  assert.equal(exactStr('2^3^2'), '512'); // right associative
  assert.equal(exactStr('-3^2'), '-9');
  assert.equal(exactStr('(-3)^2'), '9');
  assert.equal(evalText('2x', { x: 5 }).exact!.toString(), '10');
  assert.equal(evalText('3(x+1)', { x: 2 }).exact!.toString(), '9');
  assert.equal(exactStr('|(-7)|'), '7');
  assert.equal(exactStr('5!'), '120');
  assert.equal(exactStr('20%'), '1/5');
  assert.equal(exactStr('\\frac{3}{4}+\\frac{1}{4}'), '1');
});

test('order of operations and negative numbers', () => {
  assert.equal(exactStr('6+2*3^2-4/2'), '22');
  assert.equal(exactStr('-2-(-5)'), '3');
  assert.equal(exactStr('(-8)^(1/3)'), '-2');
  assert.equal(exactStr('8^(2/3)'), '4');
});

test('exact vs approximate is tracked honestly', () => {
  const third = evalText('1/3');
  assert.ok(third.exact);
  const p1 = presentValue(third, 6);
  assert.equal(p1.exact, '1/3');
  assert.equal(p1.decimalIsExact, false);

  const sqrt2 = evalText('sqrt(2)');
  assert.equal(sqrt2.exact, null);
  assert.equal(presentValue(sqrt2).isExact, false);

  const sqrt16 = evalText('sqrt(16)');
  assert.equal(sqrt16.exact!.toString(), '4');

  const quarter = presentValue(evalText('1/4'), 6);
  assert.equal(quarter.decimalIsExact, true);
  assert.equal(quarter.decimal, '0.25');
});

test('functions evaluate correctly', () => {
  assert.equal(exactStr('gcd(12,18)'), '6');
  assert.equal(exactStr('lcm(4,6)'), '12');
  assert.equal(exactStr('nCr(5,2)'), '10');
  assert.equal(exactStr('log(1000)'), '3');
  assert.equal(exactStr('log2(8)'), '3');
  assert.ok(Math.abs(evalText('sin(pi/2)').approx - 1) < 1e-12);
  assert.equal(exactStr('round(3.7)'), '4');
  assert.equal(exactStr('mod(-7,3)'), '2');
  assert.throws(() => evalText('1/0'), /Division by zero/);
  assert.throws(() => evalText('sqrt(-4)'), /not a real number/);
});

test('solves linear equations exactly', () => {
  const r = solveEquation('2x + 5 = 15');
  assert.equal(r.type, 'linear');
  assert.equal(r.solutions[0].text, '5');
  assert.ok(r.verification[0].ok);

  const frac = solveEquation('(2/3)x - 4 = 10');
  assert.equal(frac.solutions[0].text, '21');

  const both = solveEquation('3(x-2) = 5x + 4');
  assert.equal(both.solutions[0].text, '-5');

  // The narration must read like a tutor, not like raw signed arithmetic.
  // Steps describe the normalised form (everything moved to one side) and must
  // read like a tutor: "add 10", never "subtract -10".
  assert.equal(r.details.isolationStep, 'Add 10 to both sides, then divide both sides by 2.');
  assert.ok(r.details.isolationStepAppliesTo.includes('= 0'));
  assert.equal(solveEquation('x + 4 = 10').details.isolationStep, 'Add 6 to both sides.');
  assert.equal(
    solveEquation('3x = 12').details.isolationStep,
    'Add 12 to both sides, then divide both sides by 3.',
  );
  assert.equal(solveEquation('3x - 12 = 0').details.isolationStep, 'Add 12 to both sides, then divide both sides by 3.');
});

test('detects identities and contradictions', () => {
  assert.equal(solveEquation('2x + 2 = 2(x+1)').type, 'identity');
  assert.equal(solveEquation('x + 1 = x + 2').type, 'no-solution');
});

test('solves quadratics with exact and radical roots', () => {
  const a = solveEquation('x^2 - 5x + 6 = 0');
  assert.deepEqual(a.solutions.map((s) => s.text), ['2', '3']);
  assert.equal(a.details.discriminant, '1');

  const b = solveEquation('x^2 - 2 = 0');
  assert.equal(b.solutions.length, 2);
  assert.ok(b.solutions.some((s) => s.latex.includes('\\sqrt{2}')));
  assert.ok(Math.abs((b.solutions[1].approx ?? 0) - Math.SQRT2) < 1e-9);

  const c = solveEquation('x^2 + 1 = 0');
  assert.equal(c.type, 'no-solution');
  assert.equal(c.details.discriminant, '-4');

  const d = solveEquation('x^2 - 6x + 9 = 0');
  assert.equal(d.solutions[0].multiplicity, 2);
});

test('solves higher-degree and non-polynomial equations', () => {
  const cubic = solveEquation('x^3 - 6x^2 + 11x - 6 = 0');
  assert.deepEqual(cubic.solutions.map((s) => s.text), ['1', '2', '3']);

  const mixed = solveEquation('2^x = 8');
  assert.ok(Math.abs((mixed.solutions[0].approx ?? 0) - 3) < 1e-6);
  assert.ok(mixed.warnings.length > 0);
});

test('solves systems of equations exactly', () => {
  const s = solveSystem('2x + 3y = 12\n x - y = 1');
  assert.equal(s.type, 'unique');
  assert.equal(s.solution!.x.text, '3');
  assert.equal(s.solution!.y.text, '2');
  assert.ok(s.verification.every((v) => v.ok));

  const none = solveSystem('x + y = 2\nx + y = 5');
  assert.equal(none.type, 'none');

  const inf = solveSystem('x + y = 2\n2x + 2y = 4');
  assert.equal(inf.type, 'infinite');
  assert.deepEqual(inf.freeVariables, ['y']);

  const three = solveSystem('x+y+z=6\n2x-y+z=3\nx+2y-z=2');
  assert.equal(three.solution!.x.text, '1');
  assert.equal(three.solution!.y.text, '2');
  assert.equal(three.solution!.z.text, '3');
});

test('solves inequalities with sign charts', () => {
  const lin = solveInequality('3x - 6 > 0');
  assert.ok(lin.solution.includes('\\infty'));
  assert.equal(lin.criticalPoints[0].value, '2');

  const quad = solveInequality('x^2 - 4 <= 0');
  assert.equal(quad.criticalPoints.length, 2);
  const included = quad.intervals.filter((i) => i.included);
  assert.equal(included.length, 1);
  assert.ok(included[0].interval.includes('-2') && included[0].interval.includes('2'));
});

test('renders LaTeX', () => {
  assert.equal(toLatex(parse('(x+1)/(x-1)')), '\\frac{x + 1}{x - 1}');
  assert.equal(toLatex(parse('x^2')), 'x^{2}');
  assert.equal(toLatex(parse('sqrt(x+1)')), '\\sqrt{x + 1}');
});
