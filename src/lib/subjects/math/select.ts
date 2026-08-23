import type { SubjectTool } from '../../core/types';

/**
 * Which tools to advertise for a given question.
 *
 * Every tool schema sent upstream is paid for on each call of the agent loop,
 * and a tutored answer costs at least two calls: one to choose the tool, one to
 * explain the verified result. All fifteen schemas together run about 2400
 * tokens, which on a small per-minute quota is enough to exhaust the budget
 * before the explanation can start.
 *
 * So the tools are filtered rather than shortened. A question about a
 * derivative does not need the matrix schema, and cutting the descriptions
 * instead would degrade the one thing they exist for: teaching the model when
 * to reach for exact computation rather than doing arithmetic in its head.
 *
 * This is an optimisation, never a restriction. `runAgent` dispatches against
 * the subject's full tool list, so a model that names a tool outside this
 * selection still gets a real execution — the only cost is that it had to
 * think of the tool without seeing the schema.
 */

/** Useful for any question at all: arithmetic shows up everywhere. */
const ALWAYS = ['calculate'];

/** Sent when the question gives no signal about what it needs. */
const FALLBACK = ['solve_equation', 'simplify_expression', 'check_equivalent'];

/**
 * Ordered so the earliest match wins a place when the cap bites. Patterns are
 * matched against the person's own words, so they lean on how people actually
 * phrase things ("how likely", "at most") rather than on formal names.
 */
const PATTERNS: { tool: string; test: RegExp }[] = [
  {
    tool: 'differentiate',
    test: /\bderivative|\bdifferentiat|d\/dx|\bf'|\btangent line|\brate of change|\bslope of the curve/,
  },
  {
    tool: 'integrate',
    test: /\bintegral|\bintegrat|\bantiderivative|∫|\barea under|\baccumulat/,
  },
  {
    tool: 'limit',
    test: /\blimit\b|\blim\b|\bapproaches\b|\bcontinuous\b|\bcontinuity\b|\basymptot/,
  },
  {
    tool: 'matrix',
    test: /\bmatri(x|ces)\b|\bdeterminant\b|\beigen|\brow reduce|\brref\b|\btranspose\b/,
  },
  {
    tool: 'statistics',
    test: /\bmean\b|\bmedian\b|\bmode\b|\baverage\b|\bstandard deviation\b|\bvariance\b|\bquartile|\bpercentile|\bcorrelat|\bregress|\bdata set\b|\bdataset\b/,
  },
  {
    tool: 'probability',
    test: /\bprobabilit|\bodds\b|\bhow likely\b|\bchance\b|\bcombination|\bpermutation|\bfactorial\b|\bchoose\b|\bdice\b|\bdie\b|\bcoin\b|\bcards?\b|\bmarbles?\b/,
  },
  {
    tool: 'plot_function',
    test: /\bgraph|\bplot\b|\bsketch\b|\bdraw\b|\bintercepts?\b|\bvertex\b|\bparabola\b|\bcurve looks?\b/,
  },
  {
    tool: 'solve_inequality',
    // The lookbehind keeps a "->" arrow from reading as a greater-than.
    test: /\binequalit|(?<!-)[<>]=?|≤|≥|\bat least\b|\bat most\b|\bgreater than\b|\bless than\b|\bno more than\b/,
  },
  {
    tool: 'solve_system',
    test: /\bsystems?\b|\bsimultaneous\b|\bboth equations?\b|\b(two|three) equations?\b|\belimination\b|\bsubstitution method\b/,
  },
  {
    tool: 'factor_polynomial',
    test: /\bfactor|\bfactoris|\bfactoriz|\bzeros?\b|\broots?\b|\bquadratic formula\b/,
  },
  {
    tool: 'simplify_expression',
    test: /\bsimplif|\bexpand\b|\bdistribute\b|\bcombine like terms\b|\breduce\b|\blowest terms\b/,
  },
  {
    tool: 'check_work',
    test: /\bcheck my\b|\bdid i\b|\bis my\b|\bwhere did i go wrong\b|\bwhat did i do wrong\b|\bmy work\b|\bmy answer\b/,
  },
  {
    tool: 'check_equivalent',
    test: /\bequivalent\b|\bsame as\b|\bsame thing\b|\bequal to\b|\bthe same answer\b/,
  },
  {
    tool: 'solve_equation',
    test: /\bsolve\b|\bequation\b|=|\bfind x\b|\bwhat is x\b|\broot of\b/,
  },
];

/** Never send more than this many schemas, however many patterns hit. */
const MAX_TOOLS = 8;

export interface ToolSelectionInput {
  /** The person's words — latest message, plus the problem under discussion. */
  text: string;
}

export function selectMathTools(
  all: SubjectTool[],
  { text }: ToolSelectionInput,
): SubjectTool[] {
  const byName = new Map(all.map((tool) => [tool.definition.name, tool]));
  const chosen: string[] = [];

  const add = (name: string) => {
    if (byName.has(name) && !chosen.includes(name)) chosen.push(name);
  };

  for (const name of ALWAYS) add(name);

  const haystack = text.toLowerCase();
  for (const { tool, test } of PATTERNS) {
    if (test.test(haystack)) add(tool);
  }

  // Two or more equations stated together is a system even when the student
  // never uses the word: "2x + 3y = 12, x - y = 1".
  if ((haystack.match(/=/g) ?? []).length > 1) add('solve_system');

  // A context-free follow-up carries no signal of its own. Send the
  // everyday set rather than arithmetic alone.
  if (chosen.length === ALWAYS.length) {
    for (const name of FALLBACK) add(name);
  }

  return chosen.slice(0, MAX_TOOLS).map((name) => byName.get(name)!);
}
