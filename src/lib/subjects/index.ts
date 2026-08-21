import { registerSubject, hasSubject } from '../core/registry';
import { mathSubject } from './math';

/**
 * Subject registration happens exactly once, here.
 *
 * ADDING A NEW SUBJECT (e.g. Science):
 *   1. Create `src/lib/subjects/science/` with `index.ts`, `modes.ts`,
 *      `prompt.ts`, and `tools.ts`, mirroring the math module.
 *   2. Export a `SubjectModule` from it.
 *   3. Import it below and add it to the `SUBJECT_MODULES` array.
 *
 * Nothing else changes. API routes, streaming, tool execution, memory,
 * validation, rate limiting, and the UI all read from the registry.
 */
const SUBJECT_MODULES = [mathSubject];

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

export { mathSubject };
