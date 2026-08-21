import { AppError } from './errors';
import type { SubjectModule } from './types';

/**
 * The registry is the seam that makes this a platform rather than a math app.
 *
 * To add Science: create `src/lib/subjects/science/index.ts` exporting a
 * SubjectModule, then call `registerSubject(scienceModule)` in
 * `src/lib/subjects/index.ts`. API routes, streaming, memory, rate limiting,
 * and the entire UI pick it up with no further changes.
 */
const modules = new Map<string, SubjectModule>();

export function registerSubject(module: SubjectModule): void {
  if (modules.has(module.id)) {
    throw new Error(`Subject "${module.id}" is already registered.`);
  }
  for (const tool of module.tools) {
    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(tool.definition.name)) {
      throw new Error(`Invalid tool name "${tool.definition.name}" in subject "${module.id}".`);
    }
  }
  if (!module.modes.some((m) => m.id === module.defaultMode)) {
    throw new Error(`Subject "${module.id}" default mode "${module.defaultMode}" is not in its mode list.`);
  }
  modules.set(module.id, module);
}

export function getSubject(id: string): SubjectModule {
  const found = modules.get(id);
  if (!found) {
    throw new AppError('unknown_subject', `Unknown subject "${id}".`, {
      details: { available: [...modules.keys()] },
    });
  }
  return found;
}

export function hasSubject(id: string): boolean {
  return modules.has(id);
}

export function listSubjects(): SubjectModule[] {
  return [...modules.values()];
}

/** Serializable description of the platform for the client. */
export function describePlatform() {
  return {
    subjects: listSubjects().map((s) => ({
      id: s.id,
      name: s.name,
      tagline: s.tagline,
      description: s.description,
      icon: s.icon,
      accent: s.accent,
      status: s.status,
      defaultMode: s.defaultMode,
      modes: s.modes.map((m) => ({
        id: m.id,
        label: m.label,
        description: m.description,
        hint: m.hint,
        icon: m.icon,
      })),
      suggestions: s.suggestions,
      tools: s.tools.map((t) => ({ name: t.definition.name, description: t.definition.description })),
    })),
  };
}

/** Test helper: clears the registry so modules can be re-registered. */
export function __resetRegistry(): void {
  modules.clear();
}
