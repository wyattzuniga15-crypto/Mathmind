import type { SubjectTool, ToolResultPayload } from '../../core/types';
import { parse } from './engine/parser';
import { evaluateNode } from './engine/evaluate';
import { presentValue, toLatex, toText, formatFloat } from './engine/format';
import { simplify } from './engine/simplify';
import { solveEquation, solveSystem, solveInequality } from './engine/algebra';
import { toPolynomial, factorRationalRoots, quadraticRoots } from './engine/polynomial';
import { differentiate, integrate, limit } from './engine/calculus';
import { describe, linearRegression, combinations, permutations, binomialProbability, normalProbability } from './engine/statistics';
import { parseMatrix, determinant, inverse, multiply, add as matAdd, transpose, rank, showMatrix, matrixLatex } from './engine/matrix';
import { checkEquivalent, checkWork } from './engine/verify';
import { plot } from './engine/plot';
import { Rational } from './engine/rational';

/**
 * Every tool here is deterministic: same input, same output, no model in the
 * loop. That is the point — the language model decides WHICH computation to
 * run and how to explain it, but never performs the arithmetic itself.
 */

const ok = (data: unknown, display?: ToolResultPayload['display']): ToolResultPayload => ({
  ok: true,
  data,
  display,
});

const err = (message: string): ToolResultPayload => ({ ok: false, error: message });

/** Wraps an executor so a thrown parse/domain error becomes a readable message. */
function guard(fn: (input: Record<string, unknown>) => ToolResultPayload) {
  return (input: Record<string, unknown>): ToolResultPayload => {
    try {
      return fn(input);
    } catch (e) {
      const message = (e as Error).message ?? 'Computation failed.';
      return err(`${message} (Check the expression syntax: use * for multiplication, ^ for powers, sqrt(x) for roots.)`);
    }
  };
}

function str(input: Record<string, unknown>, key: string, required = true): string {
  const v = input[key];
  if (v === undefined || v === null || v === '') {
    if (required) throw new Error(`Missing required parameter "${key}".`);
    return '';
  }
  if (typeof v === 'number') return String(v);
  if (typeof v !== 'string') throw new Error(`Parameter "${key}" must be a string.`);
  return v;
}

function numArg(input: Record<string, unknown>, key: string, fallback?: number): number {
  const v = input[key];
  if (v === undefined || v === null || v === '') {
    if (fallback === undefined) throw new Error(`Missing required parameter "${key}".`);
    return fallback;
  }
  const n = typeof v === 'number' ? v : Number(evaluateNode(parse(String(v))).approx);
  if (!Number.isFinite(n)) throw new Error(`Parameter "${key}" must be a number.`);
  return n;
}

function numberList(input: Record<string, unknown>, key: string): number[] {
  const v = input[key];
  if (Array.isArray(v)) return v.map((x) => Number(x));
  return String(v ?? '')
    .split(/[,\s;]+/)
    .filter(Boolean)
    .map(Number);
}

/* ------------------------------------------------------------------ */

const calculate: SubjectTool = {
  definition: {
    name: 'calculate',
    description:
      'Evaluate a numeric or symbolic expression exactly. Handles arithmetic, fractions, decimals, percentages, exponents, roots, logs, trig, factorials, gcd/lcm, and combinatorics. Returns BOTH the exact value (as a fraction or integer) and a decimal, and tells you which one is exact. Use this for every arithmetic step you would otherwise do in your head.',
    input_schema: {
      type: 'object',
      properties: {
        expression: {
          type: 'string',
          description: 'The expression, e.g. "3/4 + 1/6", "2^10", "sqrt(72)", "15% of 80 -> 0.15*80", "sin(pi/6)".',
        },
        variables: {
          type: 'object',
          description: 'Optional variable values, e.g. {"x": 3, "y": "1/2"}.',
        },
        angleMode: { type: 'string', enum: ['rad', 'deg'], description: 'Angle unit for trig. Default rad.' },
        decimalPlaces: { type: 'number', description: 'Decimal places to show (default 10).' },
      },
      required: ['expression'],
    },
  },
  execute: guard((input) => {
    const expression = str(input, 'expression');
    const node = parse(expression);
    const scope: Record<string, Rational | number> = {};
    const vars = input.variables;
    if (vars && typeof vars === 'object' && !Array.isArray(vars)) {
      for (const [k, v] of Object.entries(vars as Record<string, unknown>)) {
        const val = evaluateNode(parse(String(v)));
        scope[k] = val.exact ?? val.approx;
      }
    }
    const angleMode = (input.angleMode === 'deg' ? 'deg' : 'rad') as 'rad' | 'deg';
    const places = Math.min(Math.max(Math.round(numArg(input, 'decimalPlaces', 10)), 0), 20);
    const value = evaluateNode(node, { scope, angleMode });
    const presented = presentValue(value, places);
    return ok({
      expression,
      normalized: toText(node),
      latex: toLatex(node),
      exact: presented.exact,
      exactLatex: presented.exactLatex,
      decimal: presented.decimal,
      isExact: presented.isExact,
      decimalIsExact: presented.decimalIsExact,
      note: presented.note,
    });
  }),
};

const solveEquationTool: SubjectTool = {
  definition: {
    name: 'solve_equation',
    description:
      'Solve a single equation for one variable, exactly where possible. Handles linear, quadratic (with exact radical roots), higher-degree polynomial (via the rational root theorem plus numerical roots), and non-polynomial equations (numerically). Returns solutions, the discriminant and factored form for quadratics, and a substitution check for every solution.',
    input_schema: {
      type: 'object',
      properties: {
        equation: { type: 'string', description: 'e.g. "2x + 5 = 15", "x^2 - 5x + 6 = 0", "2^x = 8".' },
        variable: { type: 'string', description: 'Variable to solve for. Inferred if omitted.' },
      },
      required: ['equation'],
    },
  },
  execute: guard((input) => ok(solveEquation(str(input, 'equation'), str(input, 'variable', false) || undefined))),
};

const solveSystemTool: SubjectTool = {
  definition: {
    name: 'solve_system',
    description:
      'Solve a system of linear equations exactly using Gaussian elimination with fractions. Detects unique solutions, no solution (inconsistent), and infinitely many solutions (returning which variables are free). Verifies the solution in every original equation.',
    input_schema: {
      type: 'object',
      properties: {
        equations: {
          type: 'array',
          items: { type: 'string' },
          description: 'e.g. ["2x + 3y = 12", "x - y = 1"].',
        },
        variables: { type: 'array', items: { type: 'string' }, description: 'Optional explicit variable order.' },
      },
      required: ['equations'],
    },
  },
  execute: guard((input) => {
    const raw = input.equations;
    const equations = Array.isArray(raw) ? raw.map(String) : String(raw ?? '').split('\n').filter(Boolean);
    if (!equations.length) throw new Error('Provide at least one equation.');
    const variables = Array.isArray(input.variables) ? input.variables.map(String) : undefined;
    return ok(solveSystem(equations, variables));
  }),
};

const solveInequalityTool: SubjectTool = {
  definition: {
    name: 'solve_inequality',
    description:
      'Solve an inequality using a sign chart. Returns critical points, the sign of the expression on each interval, and the solution set in interval notation. Use this rather than reasoning about sign flips by hand.',
    input_schema: {
      type: 'object',
      properties: {
        inequality: { type: 'string', description: 'e.g. "3x - 6 > 0", "x^2 - 4 <= 0".' },
        variable: { type: 'string', description: 'Variable to solve for. Inferred if omitted.' },
      },
      required: ['inequality'],
    },
  },
  execute: guard((input) =>
    ok(solveInequality(str(input, 'inequality'), str(input, 'variable', false) || undefined)),
  ),
};

const simplifyTool: SubjectTool = {
  definition: {
    name: 'simplify_expression',
    description:
      'Expand and collect like terms into canonical form. Use to expand products like (x+1)(x-2), combine like terms, or confirm two forms of an expression match.',
    input_schema: {
      type: 'object',
      properties: { expression: { type: 'string', description: 'e.g. "(x+1)*(x-2) + 3x".' } },
      required: ['expression'],
    },
  },
  execute: guard((input) => {
    const expression = str(input, 'expression');
    const simplified = simplify(parse(expression));
    return ok({
      input: expression,
      simplified: toText(simplified),
      simplifiedLatex: toLatex(simplified),
    });
  }),
};

const factorTool: SubjectTool = {
  definition: {
    name: 'factor_polynomial',
    description:
      'Factor a single-variable polynomial over the rationals, using the rational root theorem and the quadratic formula for any remaining quadratic factor. Reports the roots and whether the factorisation is complete over the rationals.',
    input_schema: {
      type: 'object',
      properties: {
        expression: { type: 'string', description: 'e.g. "x^2 - 5x + 6", "2x^3 - 4x^2 - 22x + 24".' },
        variable: { type: 'string', description: 'Defaults to x.' },
      },
      required: ['expression'],
    },
  },
  execute: guard((input) => {
    const expression = str(input, 'expression');
    const variable = str(input, 'variable', false) || 'x';
    const node = parse(expression);
    const poly = toPolynomial(node, variable);
    if (!poly) return err(`"${expression}" is not a polynomial in ${variable}, so it cannot be factored this way.`);
    if (!Number.isFinite(poly.degree) || poly.degree < 1) {
      return ok({ expression, factored: poly.toString(variable), roots: [], note: 'This is a constant.' });
    }

    const { roots, remainder } = factorRationalRoots(poly);
    const factors: string[] = [];
    const latexFactors: string[] = [];

    const content = remainder.isConstant() ? remainder.coeffs[0] : null;
    if (content && !content.eq(Rational.ONE)) {
      factors.push(content.toString());
      latexFactors.push(content.toLatex());
    }
    for (const r of roots) {
      if (r.isZero()) {
        factors.push(variable);
        latexFactors.push(variable);
        continue;
      }
      const shifted = r.neg();
      const sign = shifted.isNegative() ? '-' : '+';
      factors.push(`(${variable} ${sign} ${shifted.abs().toString()})`);
      latexFactors.push(`(${variable} ${sign} ${shifted.abs().toLatex()})`);
    }

    let irreducible: string | null = null;
    if (!remainder.isConstant()) {
      irreducible = remainder.toString(variable);
      factors.push(`(${irreducible})`);
      latexFactors.push(`(${remainder.toLatex(variable)})`);
    }

    const quadraticRootInfo =
      remainder.degree === 2
        ? quadraticRoots(remainder.at(2), remainder.at(1), remainder.at(0)).map((r) => ({
            latex: r.latex,
            approx: formatFloat(r.approx, 8),
            exact: r.exact,
          }))
        : [];

    return ok({
      expression,
      expanded: poly.toString(variable),
      factored: factors.length ? factors.join('') : poly.toString(variable),
      factoredLatex: latexFactors.length ? latexFactors.join('') : poly.toLatex(variable),
      rationalRoots: roots.map((r) => r.toString()),
      irreducibleFactor: irreducible,
      remainingRoots: quadraticRootInfo,
      completelyFactoredOverRationals: remainder.isConstant(),
      note: remainder.isConstant()
        ? 'Fully factored over the rational numbers.'
        : 'The remaining factor has no rational roots, so it does not factor further over the rationals.',
    });
  }),
};

const differentiateTool: SubjectTool = {
  definition: {
    name: 'differentiate',
    description:
      'Compute a symbolic derivative (any order) and independently verify it against a numerical finite-difference check. Reports which differentiation rules the expression required.',
    input_schema: {
      type: 'object',
      properties: {
        expression: { type: 'string', description: 'e.g. "x^2*sin(x)", "(x^2+1)/(x-1)".' },
        variable: { type: 'string', description: 'Defaults to x.' },
        order: { type: 'number', description: 'Derivative order, default 1.' },
      },
      required: ['expression'],
    },
  },
  execute: guard((input) =>
    ok(
      differentiate(
        str(input, 'expression'),
        str(input, 'variable', false) || undefined,
        Math.round(numArg(input, 'order', 1)),
      ),
    ),
  ),
};

const integrateTool: SubjectTool = {
  definition: {
    name: 'integrate',
    description:
      'Compute an indefinite or definite integral. Finds a symbolic antiderivative for polynomials, 1/x, exponentials, and trig composed with linear inner functions; otherwise falls back to adaptive Simpson quadrature and says clearly that the result is numerical. Definite results are cross-checked symbolically against the numeric value.',
    input_schema: {
      type: 'object',
      properties: {
        expression: { type: 'string', description: 'The integrand, e.g. "x^2", "sin(2*x)".' },
        variable: { type: 'string', description: 'Defaults to x.' },
        from: { type: 'string', description: 'Lower bound for a definite integral, e.g. "0".' },
        to: { type: 'string', description: 'Upper bound, e.g. "pi/2".' },
      },
      required: ['expression'],
    },
  },
  execute: guard((input) => {
    const from = str(input, 'from', false);
    const to = str(input, 'to', false);
    const bounds = from !== '' && to !== '' ? { from, to } : undefined;
    return ok(integrate(str(input, 'expression'), str(input, 'variable', false) || undefined, bounds));
  }),
};

const limitTool: SubjectTool = {
  definition: {
    name: 'limit',
    description:
      'Evaluate a limit numerically from both sides (or one side), including limits at infinity. Reports the sampled values so you can show the approach, and says explicitly when the limit does not exist.',
    input_schema: {
      type: 'object',
      properties: {
        expression: { type: 'string', description: 'e.g. "(x^2-1)/(x-1)", "sin(x)/x".' },
        variable: { type: 'string', description: 'Defaults to x.' },
        approaching: { type: 'string', description: 'The target, e.g. "1", "0", "Infinity", "-Infinity".' },
        direction: { type: 'string', enum: ['both', 'left', 'right'], description: 'Default both.' },
      },
      required: ['expression', 'approaching'],
    },
  },
  execute: guard((input) => {
    const direction = ['both', 'left', 'right'].includes(String(input.direction))
      ? (input.direction as 'both' | 'left' | 'right')
      : 'both';
    return ok(
      limit(
        str(input, 'expression'),
        str(input, 'variable', false) || undefined,
        str(input, 'approaching'),
        direction,
      ),
    );
  }),
};

const statisticsTool: SubjectTool = {
  definition: {
    name: 'statistics',
    description:
      'Descriptive statistics for a data set: mean, median, mode, range, quartiles, IQR, outliers (1.5xIQR rule), and both population and sample variance/standard deviation. Means and variances are exact fractions. Also does least-squares linear regression when y values are supplied.',
    input_schema: {
      type: 'object',
      properties: {
        data: { type: 'string', description: 'Comma or space separated values, e.g. "2, 4, 4, 4, 5, 5, 7, 9".' },
        yData: { type: 'string', description: 'Optional second list to run a linear regression of y on data.' },
      },
      required: ['data'],
    },
  },
  execute: guard((input) => {
    const data = str(input, 'data');
    const result: Record<string, unknown> = { descriptive: describe(data) };
    const yRaw = str(input, 'yData', false);
    if (yRaw) {
      result.regression = linearRegression(numberList(input, 'data'), numberList({ y: yRaw }, 'y'));
    }
    return ok(result);
  }),
};

const probabilityTool: SubjectTool = {
  definition: {
    name: 'probability',
    description:
      'Exact combinatorics and probability: combinations, permutations, binomial probabilities (exact fractions), and normal-distribution probabilities (approximate, and labelled as such).',
    input_schema: {
      type: 'object',
      properties: {
        kind: {
          type: 'string',
          enum: ['combinations', 'permutations', 'binomial', 'normal'],
          description: 'Which computation to run.',
        },
        n: { type: 'number', description: 'Trials or population size.' },
        k: { type: 'number', description: 'Successes or chosen count.' },
        p: { type: 'string', description: 'Success probability for binomial, e.g. "1/2" or "0.3".' },
        cumulative: { type: 'boolean', description: 'For binomial: P(X <= k) instead of P(X = k).' },
        mean: { type: 'number', description: 'Normal distribution mean.' },
        stdDev: { type: 'number', description: 'Normal distribution standard deviation.' },
        from: { type: 'number', description: 'Normal: lower bound.' },
        to: { type: 'number', description: 'Normal: upper bound.' },
      },
      required: ['kind'],
    },
  },
  execute: guard((input) => {
    const kind = str(input, 'kind');
    switch (kind) {
      case 'combinations':
        return ok(combinations(numArg(input, 'n'), numArg(input, 'k')));
      case 'permutations':
        return ok(permutations(numArg(input, 'n'), numArg(input, 'k')));
      case 'binomial':
        return ok(
          binomialProbability(
            numArg(input, 'n'),
            numArg(input, 'k'),
            str(input, 'p'),
            input.cumulative === true,
          ),
        );
      case 'normal':
        return ok(
          normalProbability(
            numArg(input, 'mean', 0),
            numArg(input, 'stdDev', 1),
            input.from === undefined ? undefined : numArg(input, 'from'),
            input.to === undefined ? undefined : numArg(input, 'to'),
          ),
        );
      default:
        return err(`Unknown probability kind "${kind}".`);
    }
  }),
};

const matrixTool: SubjectTool = {
  definition: {
    name: 'matrix',
    description:
      'Exact matrix arithmetic with fractions: determinant, inverse, multiply, add, transpose, rank. Use for linear algebra and for solving systems in matrix form.',
    input_schema: {
      type: 'object',
      properties: {
        operation: {
          type: 'string',
          enum: ['determinant', 'inverse', 'multiply', 'add', 'transpose', 'rank'],
        },
        matrixA: { type: 'string', description: 'e.g. "[[1,2],[3,4]]".' },
        matrixB: { type: 'string', description: 'Second matrix for multiply/add.' },
      },
      required: ['operation', 'matrixA'],
    },
  },
  execute: guard((input) => {
    const op = str(input, 'operation');
    const a = parseMatrix(str(input, 'matrixA'));
    const b = input.matrixB ? parseMatrix(str(input, 'matrixB')) : null;
    const present = (m: ReturnType<typeof parseMatrix>) => ({ rows: showMatrix(m), latex: matrixLatex(m) });
    switch (op) {
      case 'determinant': {
        const d = determinant(a);
        return ok({ operation: op, determinant: d.toString(), latex: d.toLatex(), isZero: d.isZero() });
      }
      case 'inverse':
        return ok({ operation: op, result: present(inverse(a)) });
      case 'multiply':
        if (!b) return err('multiply needs matrixB.');
        return ok({ operation: op, result: present(multiply(a, b)) });
      case 'add':
        if (!b) return err('add needs matrixB.');
        return ok({ operation: op, result: present(matAdd(a, b)) });
      case 'transpose':
        return ok({ operation: op, result: present(transpose(a)) });
      case 'rank':
        return ok({ operation: op, rank: rank(a) });
      default:
        return err(`Unknown matrix operation "${op}".`);
    }
  }),
};

const checkEquivalentTool: SubjectTool = {
  definition: {
    name: 'check_equivalent',
    description:
      'Determine whether two expressions are mathematically equal, using canonical symbolic normalisation AND evaluation at many sample points. When they differ it returns a concrete counterexample. Use this before telling someone two forms match, and to check your own algebra.',
    input_schema: {
      type: 'object',
      properties: {
        left: { type: 'string', description: 'First expression or equation.' },
        right: { type: 'string', description: 'Second expression or equation.' },
      },
      required: ['left', 'right'],
    },
  },
  execute: guard((input) => ok(checkEquivalent(str(input, 'left'), str(input, 'right')))),
};

const checkWorkTool: SubjectTool = {
  definition: {
    name: 'check_work',
    description:
      "Analyse a written solution line by line and find the FIRST line that does not follow from the line before it. Returns a per-line verdict, the index of the first error, and a counterexample proving the error. This is the authoritative check -- always call it before judging someone's work, rather than eyeballing it.",
    input_schema: {
      type: 'object',
      properties: {
        lines: {
          type: 'array',
          items: { type: 'string' },
          description: 'The steps, one per element, in order. e.g. ["2x + 5 = 15", "2x = 10", "x = 5"].',
        },
        originalProblem: {
          type: 'string',
          description: 'Optional: the original problem, so the final answer can also be verified against it.',
        },
      },
      required: ['lines'],
    },
  },
  execute: guard((input) => {
    const raw = input.lines;
    const lines = Array.isArray(raw) ? raw.map(String) : String(raw ?? '').split('\n');
    if (!lines.filter((l) => l.trim()).length) throw new Error('No lines of work were provided.');
    const originalProblem = str(input, 'originalProblem', false) || undefined;
    return ok(checkWork(lines, { originalProblem }));
  }),
};

const plotTool: SubjectTool = {
  definition: {
    name: 'plot_function',
    description:
      'Sample one or more functions for graphing and identify key features: x- and y-intercepts, turning points (with min/max classification), and vertical asymptotes. The person sees an interactive graph, so call this whenever a picture would help.',
    input_schema: {
      type: 'object',
      properties: {
        expressions: {
          type: 'array',
          items: { type: 'string' },
          description: 'Functions of one variable, e.g. ["x^2 - 4", "2x + 1"].',
        },
        variable: { type: 'string', description: 'Defaults to x.' },
        from: { type: 'number', description: 'Left edge of the domain, default -10.' },
        to: { type: 'number', description: 'Right edge, default 10.' },
      },
      required: ['expressions'],
    },
  },
  execute: guard((input) => {
    const raw = input.expressions;
    const expressions = Array.isArray(raw) ? raw.map(String) : [String(raw ?? '')];
    const result = plot(expressions.filter(Boolean), {
      variable: str(input, 'variable', false) || undefined,
      from: numArg(input, 'from', -10),
      to: numArg(input, 'to', 10),
      samples: 320,
    });
    // The model only needs the features; the full point list goes to the UI.
    return ok(
      {
        variable: result.variable,
        domain: result.domain,
        range: result.range,
        features: result.features,
        note: result.note,
      },
      { type: 'graph', payload: result },
    );
  }),
};

export const MATH_TOOLS: SubjectTool[] = [
  calculate,
  solveEquationTool,
  solveSystemTool,
  solveInequalityTool,
  simplifyTool,
  factorTool,
  differentiateTool,
  integrateTool,
  limitTool,
  statisticsTool,
  probabilityTool,
  matrixTool,
  checkEquivalentTool,
  checkWorkTool,
  plotTool,
];
