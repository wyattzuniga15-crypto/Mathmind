import { test } from 'node:test';
import assert from 'node:assert/strict';

import { mathSubject } from '../src/lib/subjects/math';
import { buildContext } from '../src/lib/core/memory';
import type { ToolExecutionContext, ToolResultPayload } from '../src/lib/core/types';

/**
 * Scenario coverage for the cases a tutor must get right.
 * These call the real tools the model calls, with the real engine behind them.
 */

const ctx: ToolExecutionContext = { subjectId: 'math', mode: 'solve', level: 'auto' };
const tool = (name: string) => {
  const found = mathSubject.tools.find((t) => t.definition.name === name);
  assert.ok(found, `tool ${name} is missing`);
  return found!;
};
const run = async (name: string, input: Record<string, unknown>): Promise<ToolResultPayload> =>
  tool(name).execute(input, ctx);

test('scenario: basic arithmetic stays exact', async () => {
  const r = await run('calculate', { expression: '3/4 + 1/6' });
  assert.equal(r.ok, true);
  const d = r.data as { exact: string; decimal: string; isExact: boolean; decimalIsExact: boolean };
  assert.equal(d.exact, '11/12');
  assert.equal(d.isExact, true);
  assert.equal(d.decimalIsExact, false); // 11/12 is a repeating decimal

  const order = (await run('calculate', { expression: '6 + 2 * 3^2 - 4/2' })).data as { exact: string };
  assert.equal(order.exact, '22');

  const pct = (await run('calculate', { expression: '0.15 * 80' })).data as { exact: string };
  assert.equal(pct.exact, '12');
});

test('scenario: algebra equation with full detail for explanation', async () => {
  const r = await run('solve_equation', { equation: '2x + 5 = 15' });
  const d = r.data as {
    solutions: { text: string }[];
    details: Record<string, string>;
    verification: { ok: boolean }[];
    type: string;
  };
  assert.equal(d.type, 'linear');
  assert.equal(d.solutions[0].text, '5');
  assert.ok(d.details.isolationStep.includes('divide'));
  assert.ok(d.verification[0].ok);
});

test('scenario: word problem reduces to a solvable equation', async () => {
  // "Train A at 60mph; train B leaves 2h later at 80mph. When does B catch A?"
  const r = await run('solve_equation', { equation: '80*t = 60*(t + 2)' });
  const d = r.data as { solutions: { text: string }[] };
  assert.equal(d.solutions[0].text, '6');
});

test('scenario: multi-step problem chains tools correctly', async () => {
  const factored = (await run('factor_polynomial', { expression: 'x^2 - 5x + 6' })).data as {
    factored: string;
    completelyFactoredOverRationals: boolean;
  };
  assert.equal(factored.factored, '(x - 2)(x - 3)');
  assert.equal(factored.completelyFactoredOverRationals, true);

  const expanded = (await run('simplify_expression', { expression: '(x - 2)*(x - 3)' })).data as {
    simplified: string;
  };
  assert.equal(expanded.simplified, 'x^2 - 5 * x + 6');

  const equivalent = (await run('check_equivalent', { left: '(x-2)(x-3)', right: 'x^2 - 5x + 6' })).data as {
    equivalent: boolean;
  };
  assert.equal(equivalent.equivalent, true);
});

test("scenario: a student's incorrect solution is pinpointed, not just rejected", async () => {
  const r = await run('check_work', {
    lines: ['3x + 6 = 18', '3x = 24', 'x = 8'],
    originalProblem: '3x + 6 = 18',
  });
  const d = r.data as {
    firstErrorIndex: number | null;
    allValid: boolean;
    lines: { status: string; counterexample: unknown }[];
    finalAnswerCheck: { verified: boolean | null; expected: string[] };
  };
  assert.equal(d.allValid, false);
  assert.equal(d.firstErrorIndex, 1); // the line "3x = 24" is where it breaks
  assert.equal(d.lines[0].status, 'start');
  assert.equal(d.lines[1].status, 'error');
  assert.equal(d.finalAnswerCheck.verified, false);
  assert.deepEqual(d.finalAnswerCheck.expected, ['4']);
});

test('scenario: correct student work is confirmed as correct', async () => {
  const r = await run('check_work', { lines: ['2x + 5 = 15', '2x = 10', 'x = 5'] });
  const d = r.data as { allValid: boolean; firstErrorIndex: number | null };
  assert.equal(d.allValid, true);
  assert.equal(d.firstErrorIndex, null);
});

test('scenario: follow-up question resolves against the current problem', () => {
  const ctxBuilt = buildContext([
    { role: 'user', content: '2x + 5 = 15' },
    { role: 'assistant', content: 'Subtract 5 from both sides to get 2x = 10, then divide by 2.' },
    { role: 'user', content: 'why did you subtract 5?' },
  ]);
  assert.equal(ctxBuilt.activeProblem, '2x + 5 = 15');
  const prompt = mathSubject.buildSystemPrompt({
    mode: 'solve',
    level: 'auto',
    sessionNotes: ctxBuilt.sessionNotes,
  });
  // The system prompt must carry the problem forward, or "why 5?" is unanswerable.
  assert.ok(prompt.includes('2x + 5 = 15'));
  assert.ok(prompt.includes('follow-up'));
});

test('scenario: difficult problem - calculus with verification', async () => {
  const d = (await run('differentiate', { expression: 'x^2*sin(x)' })).data as {
    derivative: string;
    checkedNumerically: { agrees: boolean }[];
    rulesUsed: string[];
  };
  assert.ok(d.checkedNumerically.length > 0);
  assert.ok(d.checkedNumerically.every((c) => c.agrees));
  assert.ok(d.rulesUsed.includes('product rule'));

  const integral = (await run('integrate', { expression: 'x^2', from: '0', to: '3' })).data as {
    exactValue: string;
    isExact: boolean;
    numericCheck: { agreesWithSymbolic: boolean };
  };
  assert.equal(integral.exactValue, '9');
  assert.equal(integral.isExact, true);
  assert.equal(integral.numericCheck.agreesWithSymbolic, true);

  const system = (await run('solve_system', {
    equations: ['x + y + z = 6', '2x - y + z = 3', 'x + 2y - z = 2'],
  })).data as { solution: Record<string, { text: string }>; type: string };
  assert.equal(system.type, 'unique');
  assert.equal(system.solution.z.text, '3');
});

test('scenario: approximations are never presented as exact', async () => {
  const irrational = (await run('calculate', { expression: 'sqrt(2)' })).data as {
    isExact: boolean;
    exact: string | null;
    note: string;
  };
  assert.equal(irrational.isExact, false);
  assert.equal(irrational.exact, null);
  assert.match(irrational.note, /[Aa]pproximate/);

  const exactRoot = (await run('calculate', { expression: 'sqrt(16)' })).data as { exact: string };
  assert.equal(exactRoot.exact, '4');

  const noClosedForm = (await run('integrate', { expression: 'exp(-x^2)', from: '0', to: '1' })).data as {
    isExact: boolean;
    exactValue: string | null;
    method: string;
  };
  assert.equal(noClosedForm.isExact, false);
  assert.equal(noClosedForm.exactValue, null);
  assert.match(noClosedForm.method, /numerical/i);
});

test('scenario: bad input produces a helpful error, never a fabricated answer', async () => {
  const r = await run('calculate', { expression: '2 +* 3' });
  assert.equal(r.ok, false);
  assert.ok(r.error && r.error.length > 10);
  assert.equal(r.data, undefined);

  const missing = await run('solve_equation', {});
  assert.equal(missing.ok, false);

  const noVariable = await run('solve_equation', { equation: '5 = 5' });
  assert.equal(noVariable.ok, false);
});

test('scenario: statistics and probability', async () => {
  const stats = (await run('statistics', { data: '2, 4, 4, 4, 5, 5, 7, 9' })).data as {
    descriptive: { mean: { exact: string }; populationStdDev: { decimal: string } };
  };
  assert.equal(stats.descriptive.mean.exact, '5');
  assert.equal(stats.descriptive.populationStdDev.decimal, '2');

  const prob = (await run('probability', { kind: 'binomial', n: 3, k: 2, p: '1/2' })).data as {
    exact: string;
  };
  assert.equal(prob.exact, '3/8');
});

test('scenario: graphing returns renderable data plus features', async () => {
  const r = await run('plot_function', { expressions: ['x^2 - 4'], from: -5, to: 5 });
  assert.equal(r.ok, true);
  assert.equal(r.display?.type, 'graph');
  const features = (r.data as { features: { xIntercepts: string[]; turningPoints: unknown[] } }).features;
  assert.deepEqual(features.xIntercepts.sort(), ['-2', '2']);
  assert.equal(features.turningPoints.length, 1);
});

test('scenario: every mode produces a distinct, non-empty system prompt', () => {
  const prompts = mathSubject.modes.map((m) =>
    mathSubject.buildSystemPrompt({ mode: m.id, level: 'auto' }),
  );
  assert.equal(new Set(prompts).size, mathSubject.modes.length);
  for (const p of prompts) assert.ok(p.length > 500);

  // Hint mode must actually forbid giving the answer.
  const hint = mathSubject.buildSystemPrompt({ mode: 'hint', level: 'auto' });
  assert.match(hint, /Never state the final answer/);

  // Levels must change the guidance.
  const elementary = mathSubject.buildSystemPrompt({ mode: 'solve', level: 'elementary' });
  const college = mathSubject.buildSystemPrompt({ mode: 'solve', level: 'college' });
  assert.notEqual(elementary, college);
  assert.match(elementary, /elementary/);
  assert.match(college, /college/);
});
