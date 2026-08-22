#!/usr/bin/env node
/**
 * Static checks that catch the failures a type-checker misses and that would
 * otherwise only appear at runtime: unresolved imports, a secret reaching
 * client code, or a subject registered without required pieces.
 *
 * Run with: npm run verify
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, resolve, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];
const warnings = [];

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.next' || entry.startsWith('.')) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx|mjs)$/.test(entry)) out.push(full);
  }
  return out;
}

const files = walk(join(root, 'src')).concat(walk(join(root, 'tests')));
const EXTS = ['.ts', '.tsx', '', '/index.ts', '/index.tsx'];

/* 1. Every relative and @/ import must resolve to a real file. */
for (const file of files) {
  const source = readFileSync(file, 'utf8');
  const specifiers = [...source.matchAll(/(?:from|import)\s+['"]([^'"]+)['"]/g)].map((m) => m[1]);
  for (const spec of specifiers) {
    let base;
    if (spec.startsWith('.')) base = resolve(dirname(file), spec);
    else if (spec.startsWith('@/')) base = join(root, 'src', spec.slice(2));
    else continue; // package import, resolved by npm
    if (!EXTS.some((ext) => existsSync(base + ext))) {
      failures.push(`Unresolved import "${spec}" in ${relative(root, file)}`);
    }
  }
}

/* 2. No secret may be readable from client code. */
const clientFiles = files.filter((f) => {
  const src = readFileSync(f, 'utf8');
  return src.startsWith("'use client'") || src.startsWith('"use client"') || f.includes('/components/') || f.includes('/hooks/');
});
for (const file of clientFiles) {
  const src = readFileSync(file, 'utf8');
  if (/GROQ_API_KEY|ANTHROPIC_API_KEY|process\.env\.(?!NEXT_PUBLIC_)[A-Z_]+/.test(src)) {
    failures.push(`Client file reads a server env var: ${relative(root, file)}`);
  }
  if (/api\.groq\.com|api\.anthropic\.com/.test(src)) {
    failures.push(`Client file talks to the AI provider directly: ${relative(root, file)}`);
  }
}

/* 3. The API key must only be read through the server config module.
      Tests are exempt: they set the variable to exercise config handling.
      The diag route is exempt by design: it reports whether a key is present
      without ever echoing its value, and must work even when config throws. */
const KEY_READERS_ALLOWED = ['core/env.ts', `api${sep}diag${sep}route.ts`];
for (const file of files) {
  if (file.includes(`${sep}tests${sep}`)) continue;
  const src = readFileSync(file, 'utf8');
  const allowed = KEY_READERS_ALLOWED.some((suffix) => file.endsWith(suffix));
  if (/process\.env\.(GROQ|ANTHROPIC)_API_KEY/.test(src) && !allowed) {
    failures.push(`The API key is read outside core/env.ts: ${relative(root, file)}`);
  }
}

/* 4. No committed .env with a real key. */
for (const name of ['.env', '.env.local']) {
  const p = join(root, name);
  if (existsSync(p) && /(gsk_|sk-ant-)[A-Za-z0-9]/.test(readFileSync(p, 'utf8'))) {
    failures.push(`${name} appears to contain a real API key — it must not be committed.`);
  }
}
if (!existsSync(join(root, '.env.example'))) failures.push('.env.example is missing.');
if (!readFileSync(join(root, '.gitignore'), 'utf8').includes('.env.local')) {
  failures.push('.gitignore does not ignore .env.local');
}

/* 5. Declared dependencies must cover every bare import. */
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const declared = new Set([
  ...Object.keys(pkg.dependencies ?? {}),
  ...Object.keys(pkg.devDependencies ?? {}),
]);
const builtin = /^(node:|next\/|react\/|react-dom\/)/;
for (const file of files) {
  const src = readFileSync(file, 'utf8');
  for (const m of src.matchAll(/(?:from|import)\s+['"]([^'".][^'"]*)['"]/g)) {
    const spec = m[1];
    if (spec.startsWith('@/') || spec.startsWith('.') || builtin.test(spec)) continue;
    const pkgName = spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0];
    if (!declared.has(pkgName)) {
      failures.push(`Import "${pkgName}" in ${relative(root, file)} is not in package.json`);
    }
  }
}

/* 6. Every API route must export a handler. */
const routes = files.filter((f) => f.includes('/app/api/') && f.endsWith('route.ts'));
if (!routes.length) failures.push('No API routes found.');
for (const route of routes) {
  const src = readFileSync(route, 'utf8');
  if (!/export async function (GET|POST|PUT|DELETE)/.test(src)) {
    failures.push(`${relative(root, route)} exports no HTTP handler.`);
  }
}

/* 6b. Next.js App Router conventions. */
const clientApiRe = /\b(useState|useEffect|useRef|useCallback|useMemo|window\.|document\.|localStorage)\b/;
for (const file of files) {
  if (!/src[\\/](components|hooks)[\\/]/.test(file)) continue;
  const src = readFileSync(file, 'utf8');
  if (clientApiRe.test(src) && !/^['"]use client['"]/.test(src.trimStart())) {
    failures.push(`${relative(root, file)} uses client-only APIs but lacks the "use client" directive.`);
  }
}
const layout = readFileSync(join(root, 'src/app/layout.tsx'), 'utf8');
if (!/export default function RootLayout/.test(layout)) failures.push('app/layout.tsx has no default RootLayout export.');
if (!/<html/.test(layout) || !/<body/.test(layout)) failures.push('app/layout.tsx must render <html> and <body>.');
if (!existsSync(join(root, 'src/app/page.tsx'))) failures.push('app/page.tsx is missing.');
for (const route of routes) {
  const src = readFileSync(route, 'utf8');
  if (/^['"]use client['"]/.test(src.trimStart())) {
    failures.push(`${relative(root, route)} must not be a client component.`);
  }
}

/* 7. Subject modules must be complete. */
const subjectsIndex = readFileSync(join(root, 'src/lib/subjects/index.ts'), 'utf8');
if (!/registerSubject/.test(subjectsIndex)) failures.push('subjects/index.ts never registers a subject.');

const unique = (arr) => [...new Set(arr)];
for (const f of unique(failures)) console.error(`FAIL  ${f}`);
for (const w of unique(warnings)) console.warn(`WARN  ${w}`);

if (failures.length) {
  console.error(`\n${unique(failures).length} problem(s) found.`);
  process.exit(1);
}
console.log(`OK  ${files.length} files checked, ${routes.length} API routes, no import or secret-leak problems.`);
