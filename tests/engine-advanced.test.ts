import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parse } from '../src/lib/subjects/math/engine/parser';
import { toText } from '../src/lib/subjects/math/engine/format';
import { simplify, structurallyEqual } from '../src/lib/subjects/math/engine/simplify';
import { differentiate, integrate, limit, antiderivative } from '../src/lib/subjects/math/engine/calculus';
import { describe, binomialProbability, combinations, linearRegression } from '../src/lib/subjects/math/engine/statistics';
import { parseMatrix, determinant, inverse, multiply, showMatrix } from '../src/lib/subjects/math/engine/matrix';
import { checkEquivalent, checkWork } from '../src/lib/subjects/math/engine/verify';
import { plot } from '../src/lib/subjects/math/engine/plot';

const S = (s: string) => toText(simplify(parse(s)));

test('expands and collects like terms', () => {
  assert.equal(S('(x+1)*(x-2)'), 'x^2 - x - 2');
  assert.equal(S('2*x + 3*x'), '5 * x');
  assert.equal(S('(x+1)^2'), 'x^2 + 2 * x + 1');
  assert.equal(S('x - x'), '0');
  assert.equal(S('2*sin(x) + 3*sin(x)'), '5 * sin(x)');
  assert.equal(S('(a+b)^2'), 'a^2 + 2 * a * b + b^2');
});

test('structural equivalence', () => {
  assert.ok(structurallyEqual(parse('(x+1)^2'), parse('x^2+2x+1')));
  assert.ok(!structurallyEqual(parse('(x+1)^2'), parse('x^2+1')));
});

test('differentiates with all standard rules', () => {
  assert.equal(differentiate('x^3').derivative, '3 * x^2');
  assert.equal(differentiate('3x^2 + 2x - 7').derivative, '6 * x + 2');
  const product = differentiate('x^2*sin(x)');
  assert.ok(product.rulesUsed.includes('product rule'));
  assert.ok(product.checkedNumerically.every((c) => c.agrees));
  const quotient = differentiate('(x^2+1)/(x-1)');
  assert.ok(quotient.rulesUsed.includes('quotient rule'));
  assert.ok(quotient.checkedNumerically.every((c) => c.agrees));
  const chain = differentiate('sin(x^2)');
  assert.ok(chain.checkedNumerically.every((c) => c.agrees));
  const expo = differentiate('2^x');
  assert.ok(expo.checkedNumerically.every((c) => c.agrees));
  const second = differentiate('x^4', 'x', 2);
  assert.equal(second.derivative, '12 * x^2');
});

test('integrates symbolically and numerically', () => {
  const indef = integrate('x^2');
  assert.ok(indef.antiderivativeLatex!.includes('+ C'));
  assert.ok(antiderivative(parse('x^2'), 'x'));

  const def = integrate('x^2', 'x', { from: '0', to: '3' });
  assert.equal(def.exactValue, '9');
  assert.equal(def.isExact, true);
  assert.equal(def.numericCheck!.agreesWithSymbolic, true);

  const sub = integrate('sin(2*x)', 'x', { from: '0', to: 'pi/2' });
  assert.ok(Math.abs(Number(sub.approxValue) - 1) < 1e-6);

  const hard = integrate('exp(-x^2)', 'x', { from: '0', to: '1' });
  assert.equal(hard.isExact, false);
  assert.ok(Math.abs(Number(hard.approxValue) - 0.746824) < 1e-4);
  assert.ok(/numerical/i.test(hard.note));
});

test('computes limits', () => {
  const l1 = limit('(x^2-1)/(x-1)', 'x', '1');
  assert.ok(l1.exists);
  assert.equal(Number(l1.result), 2);

  const l2 = limit('sin(x)/x', 'x', '0');
  assert.equal(Number(l2.result), 1);

  const l3 = limit('1/x', 'x', '0');
  assert.equal(l3.exists, false);

  const l4 = limit('(2*x^2+3)/(x^2-1)', 'x', 'Infinity');
  assert.equal(Number(l4.result), 2);
});

test('descriptive statistics are exact', () => {
  const s = describe('2, 4, 4, 4, 5, 5, 7, 9');
  assert.equal(s.n, 8);
  assert.equal(s.mean.exact, '5');
  assert.equal(s.median.exact, '9/2');
  assert.deepEqual(s.mode, ['4']);
  assert.equal(s.populationVariance.exact, '4');
  assert.equal(s.populationStdDev.decimal, '2');
  assert.equal(s.sampleVariance.exact, '32/7');

  const odd = describe([1, 2, 3, 4, 100]);
  assert.equal(odd.median.exact, '3');
  assert.deepEqual(odd.outliers, []); // 100 is inside the 1.5xIQR fence for this spread

  const skewed = describe([1, 2, 3, 4, 5, 6, 7, 8, 100]);
  assert.deepEqual(skewed.outliers, ['100']);
});

test('probability is exact where possible', () => {
  assert.equal(combinations(5, 2).exact, '10');
  const b = binomialProbability(3, 2, '1/2');
  assert.equal(b.exact, '3/8');
  const cum = binomialProbability(3, 3, '1/2', true);
  assert.equal(cum.exact, '1');
  const reg = linearRegression([1, 2, 3, 4], [2, 4, 6, 8]);
  assert.equal(Number(reg.slope), 2);
  assert.equal(Number(reg.rSquared), 1);
});

test('matrix operations are exact', () => {
  const m = parseMatrix('[[1,2],[3,4]]');
  assert.equal(determinant(m).toString(), '-2');
  assert.deepEqual(showMatrix(inverse(m)), [
    ['-2', '1'],
    ['3/2', '-1/2'],
  ]);
  assert.deepEqual(showMatrix(multiply(m, inverse(m))), [
    ['1', '0'],
    ['0', '1'],
  ]);
  assert.throws(() => inverse(parseMatrix('[[1,2],[2,4]]')), /singular/);
});

test('detects equivalent and non-equivalent expressions', () => {
  const good = checkEquivalent('(x+2)^2', 'x^2+4x+4');
  assert.equal(good.equivalent, true);

  const bad = checkEquivalent('(x+2)^2', 'x^2+4');
  assert.equal(bad.equivalent, false);
  assert.ok(bad.counterexample);
  assert.ok(bad.counterexample!.leftValue !== bad.counterexample!.rightValue);
});

test('check my work pinpoints the first bad line', () => {
  const result = checkWork([
    '2x + 5 = 15',
    '2x = 10',
    'x = 5',
  ]);
  assert.equal(result.allValid, true);

  const wrong = checkWork([
    '3x + 6 = 18',
    '3x = 24', // added instead of subtracting
    'x = 8',
  ]);
  assert.equal(wrong.allValid, false);
  assert.equal(wrong.firstErrorIndex, 1);
  assert.ok(wrong.summary.includes('line 2'));

  const distributed = checkWork([
    '2*(x+3)',
    '2*x + 3', // forgot to distribute
  ]);
  assert.equal(distributed.firstErrorIndex, 1);
  assert.ok(distributed.lines[1].counterexample);

  const scaled = checkWork(['x/2 = 4', 'x = 8']);
  assert.equal(scaled.allValid, true);
});

test('check my work validates a final answer against the problem', () => {
  const r = checkWork(['2x + 5 = 15', '2x = 10', 'x = 4'], { originalProblem: '2x + 5 = 15' });
  assert.equal(r.finalAnswerCheck!.verified, false);
  assert.deepEqual(r.finalAnswerCheck!.expected, ['5']);
});

test('plot produces points and features', () => {
  const p = plot(['x^2 - 4'], { from: -5, to: 5, samples: 100 });
  assert.equal(p.series[0].points.length, 101);
  assert.deepEqual(p.features.xIntercepts.sort(), ['-2', '2']);
  assert.equal(p.features.yIntercept, '-4');
  assert.equal(p.features.turningPoints[0].type, 'local minimum');

  const rational = plot(['1/x'], { from: -3, to: 3, samples: 200 });
  assert.ok(rational.features.verticalAsymptotes.length >= 1);
});
