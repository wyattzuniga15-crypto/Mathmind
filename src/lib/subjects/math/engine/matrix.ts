import { Rational } from './rational';
import { parse } from './parser';
import { evaluateNode } from './evaluate';

export type Matrix = Rational[][];

export function parseMatrix(input: string | (string | number)[][]): Matrix {
  if (Array.isArray(input)) {
    return input.map((row) =>
      row.map((cell) => {
        const v = evaluateNode(parse(String(cell)));
        return v.exact ?? Rational.fromNumber(v.approx);
      }),
    );
  }
  const rows = String(input)
    .replace(/^\s*[[{]|[\]}]\s*$/g, '')
    .split(/\]\s*,?\s*\[|;|\n/)
    .map((r) => r.replace(/[[\]]/g, '').trim())
    .filter(Boolean);
  const matrix = rows.map((r) =>
    r
      .split(/[,\s]+/)
      .filter(Boolean)
      .map((c) => {
        const v = evaluateNode(parse(c));
        return v.exact ?? Rational.fromNumber(v.approx);
      }),
  );
  const width = matrix[0]?.length ?? 0;
  if (!width || matrix.some((r) => r.length !== width)) {
    throw new Error('Every row of a matrix must have the same number of entries.');
  }
  return matrix;
}

export const showMatrix = (m: Matrix): string[][] => m.map((r) => r.map((c) => c.toString()));

export function matrixLatex(m: Matrix): string {
  return `\\begin{bmatrix}${m.map((r) => r.map((c) => c.toLatex()).join(' & ')).join(' \\\\ ')}\\end{bmatrix}`;
}

export function multiply(a: Matrix, b: Matrix): Matrix {
  if (a[0].length !== b.length) {
    throw new Error(
      `Cannot multiply a ${a.length}x${a[0].length} matrix by a ${b.length}x${b[0].length} matrix: inner dimensions must match.`,
    );
  }
  return a.map((row) =>
    b[0].map((_, j) => row.reduce((acc, v, k) => acc.add(v.mul(b[k][j])), Rational.ZERO)),
  );
}

export function add(a: Matrix, b: Matrix): Matrix {
  if (a.length !== b.length || a[0].length !== b[0].length) {
    throw new Error('Matrix addition requires identical dimensions.');
  }
  return a.map((row, i) => row.map((v, j) => v.add(b[i][j])));
}

export function transpose(a: Matrix): Matrix {
  return a[0].map((_, j) => a.map((row) => row[j]));
}

export function determinant(a: Matrix): Rational {
  const n = a.length;
  if (n !== a[0].length) throw new Error('Determinants are only defined for square matrices.');
  const m = a.map((r) => [...r]);
  let det = Rational.ONE;
  for (let col = 0; col < n; col++) {
    let pivot = -1;
    for (let r = col; r < n; r++) {
      if (!m[r][col].isZero()) {
        pivot = r;
        break;
      }
    }
    if (pivot === -1) return Rational.ZERO;
    if (pivot !== col) {
      [m[col], m[pivot]] = [m[pivot], m[col]];
      det = det.neg();
    }
    det = det.mul(m[col][col]);
    const inv = m[col][col].inv();
    for (let r = col + 1; r < n; r++) {
      const factor = m[r][col].mul(inv);
      if (factor.isZero()) continue;
      for (let c = col; c < n; c++) m[r][c] = m[r][c].sub(factor.mul(m[col][c]));
    }
  }
  return det;
}

export function inverse(a: Matrix): Matrix {
  const n = a.length;
  if (n !== a[0].length) throw new Error('Only square matrices can be inverted.');
  const det = determinant(a);
  if (det.isZero()) throw new Error('This matrix is singular (determinant 0), so it has no inverse.');
  const m = a.map((r, i) => [...r, ...Array.from({ length: n }, (_, j) => (i === j ? Rational.ONE : Rational.ZERO))]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    while (m[pivot][col].isZero()) pivot++;
    [m[col], m[pivot]] = [m[pivot], m[col]];
    const inv = m[col][col].inv();
    m[col] = m[col].map((v) => v.mul(inv));
    for (let r = 0; r < n; r++) {
      if (r === col || m[r][col].isZero()) continue;
      const factor = m[r][col];
      m[r] = m[r].map((v, c) => v.sub(factor.mul(m[col][c])));
    }
  }
  return m.map((r) => r.slice(n));
}

export function rank(a: Matrix): number {
  const m = a.map((r) => [...r]);
  let row = 0;
  for (let col = 0; col < m[0].length && row < m.length; col++) {
    let pivot = -1;
    for (let r = row; r < m.length; r++) {
      if (!m[r][col].isZero()) {
        pivot = r;
        break;
      }
    }
    if (pivot === -1) continue;
    [m[row], m[pivot]] = [m[pivot], m[row]];
    const inv = m[row][col].inv();
    m[row] = m[row].map((v) => v.mul(inv));
    for (let r = 0; r < m.length; r++) {
      if (r === row || m[r][col].isZero()) continue;
      const factor = m[r][col];
      m[r] = m[r].map((v, c) => v.sub(factor.mul(m[row][c])));
    }
    row++;
  }
  return row;
}
