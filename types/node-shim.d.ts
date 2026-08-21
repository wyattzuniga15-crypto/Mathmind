/**
 * Minimal ambient declarations so `tsconfig.lib.json` can type-check the
 * dependency-free library without @types/node installed.
 *
 * The real project uses @types/node (see package.json devDependencies); this
 * file exists only for the standalone library check and is not referenced by
 * the main tsconfig.json.
 */
declare const process: { env: Record<string, string | undefined> };

declare module 'node:test' {
  export function test(name: string, fn: () => void | Promise<void>): void;
}

declare module 'node:assert/strict' {
  interface Assert {
    (value: unknown, message?: string): void;
    ok(value: unknown, message?: string): void;
    equal(actual: unknown, expected: unknown, message?: string): void;
    notEqual(actual: unknown, expected: unknown, message?: string): void;
    deepEqual(actual: unknown, expected: unknown, message?: string): void;
    match(value: string, pattern: RegExp, message?: string): void;
    throws(fn: () => unknown, expected?: RegExp | ((e: never) => boolean), message?: string): void;
    rejects(
      fn: () => Promise<unknown>,
      expected?: RegExp | ((e: never) => boolean),
      message?: string,
    ): Promise<void>;
  }
  const assert: Assert;
  export default assert;
}
