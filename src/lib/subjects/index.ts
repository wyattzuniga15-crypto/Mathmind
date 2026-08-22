import { registerSubject, hasSubject } from '../core/registry';
import { generalSubject } from './math';
import { codeSubject } from './code';

/**
 * Subject registration happens exactly once, here.
 *
 * ADDING A NEW SUBJECT:
 *   1. Create `src/lib/subjects/<name>/` with `index.ts`, `modes.ts`, and
 *      `prompt.ts` (plus `tools.ts` if it needs deterministic tools),
 *      mirroring the code or general module.
 *   2. Export a `SubjectModule` from it.
 *   3. Import it below and add it to the `SUBJECT_MODULES` array.
 *
 * Nothing else changes. API routes, streaming, tool execution, memory,
 * validation, rate limiting, and the UI all read from the registry.
 */
const SUBJECT_MODULES = [generalSubject, codeSubject];

let initialized = false;

export function initSubjects(): void {
  if (initialized) return;
  for (const module of SUBJECT_MODULES) {
    if (!hasSubject(module.id)) registerSubject(module);
  }
  initialized = true;
}

// Registering on import means every server route gets the registry populated
// simply by importing from this module.
initSubjects();

export { generalSubject, codeSubject };
