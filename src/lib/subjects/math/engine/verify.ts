import { Rational } from './rational';
import { parse } from './parser';
import { evaluateNumeric, evaluateNode } from './evaluate';
import { toLatex, toText, formatFloat } from './format';
import { simplify, structurallyEqual } from './simplify';
import { moveToZero, solveEquation } from './algebra';
import { variablesOf, type Node } from './ast';

export interface EquivalenceResult {
  left: string;
  right: string;
  leftLatex: string;
  rightLatex: string;
  equivalent: boolean;
  method: 'symbolic' | 'numeric' | 'both';
  variables: string[];
  counterexample: { assignment: Record<string, string>; leftValue: string; rightValue: string } | null
  samplesChecked: number;
  difference: string | null;
  note: string;
}

const TEST_POINTS = [0.5, 1.5, -1.25, 2.75, -0.75, 3.125, 4.5, -2.5, 0.125, 5.75];

/**
 * Decides whether two expressions are the same function.
 *
 * Two independent methods: canonical symbolic normalisation, and evaluation at
 * many sample points. Agreement across both is what lets the tutor say a
 * student's line is wrong without guessing.
 */
export function checkEquivalent(leftInput: string, rightInput: string): EquivalenceResult {
  const left = parse(leftInput);
  const right = parse(rightInput);
  const leftExpr = moveToZero(left);
  const rightExpr = moveToZero(right);

  const vars = [...new Set([...variablesOf(leftExpr), ...variablesOf(rightExpr)])].filter(
    (v) => !['pi', 'e', 'tau', 'phi', 'Infinity'].includes(v),
  );

  const symbolic = structurallyEqual(leftExpr, rightExpr);

  let counterexample: EquivalenceResult['counterexample'] = null;
  let samples = 0;
  let numericEquivalent = true;

  const assignments = buildAssignments(vars);
  for (const assignment of assignments) {
    const lv = evaluateNumeric(leftExpr, assignment);
    const rv = evaluateNumeric(rightExpr, assignment);
    if (!Number.isFinite(lv) || !Number.isFinite(rv)) continue;
    samples++;
    const scale = Math.max(1, Math.abs(lv), Math.abs(rv));
    if (Math.abs(lv - rv) > 1e-9 * scale) {
      numericEquivalent = false;
      if (!counterexample) {
        counterexample = {
          assignment: Object.fromEntries(Object.entries(assignment).map(([k, v]) => [k, formatFloat(v, 6)])),
          leftValue: formatFloat(lv, 10),
          rightValue: formatFloat(rv, 10),
        };
      }
      break;
    }
  }

  const equivalent = symbolic || (numericEquivalent && samples > 0);
  let difference: string | null = null;
  try {
    const diff = simplify({ kind: 'bin', op: '-', left: leftExpr, right: rightExpr });
    difference = toText(diff);
  } catch {
    difference = null;
  }

  return {
    left: toText(left),
    right: toText(right),
    leftLatex: toLatex(left),
    rightLatex: toLatex(right),
    equivalent,
    method: symbolic && numericEquivalent ? 'both' : symbolic ? 'symbolic' : 'numeric',
    variables: vars,
    counterexample,
    samplesChecked: samples,
    difference,
    note: equivalent
      ? symbolic
        ? 'The two expressions reduce to the same canonical form, so they are identical.'
        : `They agree at all ${samples} tested values, so they are equivalent on the tested domain.`
      : counterexample
        ? 'They differ: substituting the counterexample below gives different values, which proves they are not the same expression.'
        : 'They could not be shown equivalent.',
  };
}

function buildAssignments(vars: string[]): Record<string, number>[] {
  if (!vars.length) return [{}];
  const out: Record<string, number>[] = [];
  for (let i = 0; i < TEST_POINTS.length; i++) {
    const assignment: Record<string, number> = {};
    vars.forEach((v, j) => {
      assignment[v] = TEST_POINTS[(i + j * 3) % TEST_POINTS.length];
    });
    out.push(assignment);
  }
  return out;
}

export interface StepCheck {
  index: number;
  line: string;
  lineLatex: string;
  status: 'ok' | 'error' | 'unverifiable' | 'start';
  message: string;
  counterexample: EquivalenceResult['counterexample'];
}

export interface WorkCheckResult {
  lines: StepCheck[];
  firstErrorIndex: number | null;
  allValid: boolean;
  summary: string;
  finalAnswerCheck: {
    claimed: string;
    verified: boolean | null;
    expected: string[];
    message: string;
  } | null;
}

/**
 * Walks a student's written solution line by line and finds the FIRST line that
 * stops being equivalent to the previous one. That index is what turns
 * "your answer is wrong" into "line 3 is where it went wrong".
 */
export function checkWork(lines: string[], options?: { originalProblem?: string }): WorkCheckResult {
  const cleaned = lines
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !/^[-=*_]{3,}$/.test(l));

  const checks: StepCheck[] = [];
  let firstErrorIndex: number | null = null;
  let previous: Node | null = null;
  let previousText = '';

  cleaned.forEach((line, i) => {
    let node: Node;
    try {
      node = parse(line);
    } catch (err) {
      checks.push({
        index: i,
        line,
        lineLatex: line,
        status: 'unverifiable',
        message: `Could not read this line as math (${(err as Error).message}). It may be prose rather than a step.`,
        counterexample: null,
      });
      return;
    }

    if (previous === null) {
      previous = node;
      previousText = line;
      checks.push({
        index: i,
        line,
        lineLatex: toLatex(node),
        status: 'start',
        message: 'Starting line.',
        counterexample: null,
      });
      return;
    }

    const comparison = compareSteps(previous, node);
    if (comparison.equivalent) {
      checks.push({
        index: i,
        line,
        lineLatex: toLatex(node),
        status: 'ok',
        message: comparison.message,
        counterexample: null,
      });
      previous = node;
      previousText = line;
    } else if (comparison.verifiable) {
      if (firstErrorIndex === null) firstErrorIndex = i;
      checks.push({
        index: i,
        line,
        lineLatex: toLatex(node),
        status: 'error',
        message: `This line is not equivalent to the previous one (${previousText}). ${comparison.message}`,
        counterexample: comparison.counterexample,
      });
      previous = node;
      previousText = line;
    } else {
      checks.push({
        index: i,
        line,
        lineLatex: toLatex(node),
        status: 'unverifiable',
        message: comparison.message,
        counterexample: null,
      });
      previous = node;
      previousText = line;
    }
  });

  let finalAnswerCheck: WorkCheckResult['finalAnswerCheck'] = null;
  if (options?.originalProblem) {
    finalAnswerCheck = checkFinalAnswer(options.originalProblem, cleaned[cleaned.length - 1] ?? '');
  }

  const allValid = firstErrorIndex === null;
  return {
    lines: checks,
    firstErrorIndex,
    allValid,
    summary: allValid
      ? 'Every line follows from the one before it.'
      : `The first line that does not follow is line ${firstErrorIndex! + 1}: "${cleaned[firstErrorIndex!]}".`,
    finalAnswerCheck,
  };
}

function compareSteps(
  prev: Node,
  next: Node,
): { equivalent: boolean; verifiable: boolean; message: string; counterexample: EquivalenceResult['counterexample'] } {
  const prevIsRel = prev.kind === 'rel';
  const nextIsRel = next.kind === 'rel';

  // Equation -> equation: both must have the same solution set. Comparing
  // lhs-rhs up to a non-zero constant multiple covers the legal moves
  // (adding to both sides, multiplying both sides by a constant).
  if (prevIsRel && nextIsRel) {
    const a = moveToZero(prev);
    const b = moveToZero(next);
    if (structurallyEqual(a, b)) {
      return { equivalent: true, verifiable: true, message: 'Same equation, rearranged correctly.', counterexample: null };
    }
    const ratio = constantRatio(a, b);
    if (ratio !== null) {
      return {
        equivalent: true,
        verifiable: true,
        message: `Both sides were scaled by ${ratio}, which keeps the solutions the same.`,
        counterexample: null,
      };
    }
    const eq = checkEquivalent(toText(a), toText(b));
    return {
      equivalent: false,
      verifiable: true,
      message: eq.counterexample
        ? `For example, at ${describeAssignment(eq.counterexample.assignment)} the previous line gives ${eq.counterexample.leftValue} but this line gives ${eq.counterexample.rightValue}.`
        : 'The two equations do not have the same solutions.',
      counterexample: eq.counterexample,
    };
  }

  // Expression -> expression: must be identically equal.
  if (!prevIsRel && !nextIsRel) {
    const eq = checkEquivalent(toText(prev), toText(next));
    return {
      equivalent: eq.equivalent,
      verifiable: eq.samplesChecked > 0 || eq.equivalent,
      message: eq.equivalent
        ? 'Equivalent to the previous expression.'
        : eq.counterexample
          ? `At ${describeAssignment(eq.counterexample.assignment)} the previous line gives ${eq.counterexample.leftValue} but this line gives ${eq.counterexample.rightValue}.`
          : 'These expressions are not equal.',
      counterexample: eq.counterexample,
    };
  }

  return {
    equivalent: false,
    verifiable: false,
    message:
      'This line changes between an expression and an equation, so it cannot be compared automatically. Check it by hand.',
    counterexample: null,
  };
}

function describeAssignment(a: Record<string, string>): string {
  const entries = Object.entries(a);
  if (!entries.length) return 'the tested value';
  return entries.map(([k, v]) => `${k} = ${v}`).join(', ');
}

/** If a = k*b for a non-zero constant k, the equations a=0 and b=0 are the same. */
function constantRatio(a: Node, b: Node): string | null {
  const vars = [...new Set([...variablesOf(a), ...variablesOf(b)])];
  const points = buildAssignments(vars);
  let ratio: number | null = null;
  let checked = 0;
  for (const p of points) {
    const av = evaluateNumeric(a, p);
    const bv = evaluateNumeric(b, p);
    if (!Number.isFinite(av) || !Number.isFinite(bv)) continue;
    if (Math.abs(bv) < 1e-9) {
      if (Math.abs(av) > 1e-9) return null;
      continue;
    }
    const r = av / bv;
    checked++;
    if (ratio === null) ratio = r;
    else if (Math.abs(r - ratio) > 1e-8 * Math.max(1, Math.abs(ratio))) return null;
  }
  if (ratio === null || checked < 2 || Math.abs(ratio) < 1e-9) return null;
  if (Math.abs(ratio - 1) < 1e-12) return '1';
  try {
    return Rational.fromNumber(Math.round(ratio * 1e6) / 1e6).toString();
  } catch {
    return formatFloat(ratio, 6);
  }
}

function checkFinalAnswer(problem: string, lastLine: string): WorkCheckResult['finalAnswerCheck'] {
  try {
    const solved = solveEquation(problem);
    const expected = solved.solutions.map((s) => s.text);
    const answer = parse(lastLine);
    let claimedValue: number | null = null;
    if (answer.kind === 'rel' && answer.op === '=') {
      claimedValue = evaluateNumeric(answer.right, {});
      if (!Number.isFinite(claimedValue)) claimedValue = evaluateNumeric(answer.left, {});
    } else {
      claimedValue = evaluateNode(answer).approx;
    }
    if (claimedValue === null || !Number.isFinite(claimedValue)) {
      return { claimed: lastLine, verified: null, expected, message: 'Could not read a final numeric answer.' };
    }
    const match = solved.solutions.some(
      (s) => s.approx !== null && Math.abs(s.approx - claimedValue!) < 1e-8,
    );
    return {
      claimed: lastLine,
      verified: match,
      expected,
      message: match
        ? 'The final answer matches the correct solution.'
        : `The final answer does not match. The equation actually gives ${expected.join(' or ') || 'no real solution'}.`,
    };
  } catch {
    return null;
  }
}
