#!/usr/bin/env node
/**
 * Local harness that runs the real application without a Next.js install.
 *
 * It bundles the actual React components with esbuild, compiles the actual
 * Tailwind stylesheet, and serves the actual API route handlers (which are
 * plain Request -> Response functions). Nothing about the app is stubbed:
 * the math engine, agent loop, streaming, validation, and rate limiting are
 * the production code paths.
 *
 * Used for end-to-end testing in environments where `next dev` is unavailable.
 * Production still runs on Next.js.
 *
 *   node scripts/dev-harness.mjs [--port 3000]
 *
 * If ANTHROPIC_API_KEY is set the app talks to the real API. If not, set
 * MOCK_UPSTREAM=1 to run a local server that speaks the Anthropic wire format
 * so the UI, streaming, and the real math tools can be exercised offline.
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const portArg = args.indexOf('--port');
const PORT = portArg !== -1 ? Number(args[portArg + 1]) : Number(process.env.PORT || 3000);

/* ------------------------------ build assets ----------------------------- */

const esbuildBin = join(root, 'node_modules/.bin/esbuild');

function run(cmd, cmdArgs, options = {}) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(cmd, cmdArgs, { cwd: root, ...options });
    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (d) => (stdout += d));
    child.stderr?.on('data', (d) => (stderr += d));
    child.on('error', rejectPromise);
    child.on('close', (code) =>
      code === 0 ? resolvePromise({ stdout, stderr }) : rejectPromise(new Error(stderr || `${cmd} exited ${code}`)),
    );
  });
}

async function buildClient() {
  const outfile = join(root, '.harness/app.js');
  await run(esbuildBin, [
    'src/harness/client-entry.tsx',
    '--bundle',
    `--outfile=${outfile}`,
    '--jsx=automatic',
    '--loader:.tsx=tsx',
    '--loader:.ts=ts',
    '--target=es2020',
    '--format=iife',
    '--platform=browser',
    '--alias:@=./src',
    '--define:process.env.NODE_ENV="development"',
    '--sourcemap=inline',
    '--log-level=warning',
  ]);
  return readFile(outfile, 'utf8');
}

async function buildCss() {
  const outfile = join(root, '.harness/app.css');
  await run('node', [
    join(root, 'node_modules/tailwindcss/lib/cli.js'),
    '-i',
    'src/app/globals.css',
    '-o',
    outfile,
    '--content',
    './src/**/*.{ts,tsx}',
  ]);
  let css = await readFile(outfile, 'utf8');
  // Tailwind should inline the KaTeX stylesheet via @import. If it did not,
  // that is a real bug in globals.css — surface it rather than papering over it.
  if (!/\.katex-mathml/.test(css)) {
    throw new Error(
      'KaTeX stylesheet was not inlined by the CSS build. Check that the @import in src/app/globals.css comes before the @tailwind directives.',
    );
  }
  // Serve the font files from a path this harness can resolve.
  css = css.replace(/url\((["']?)fonts\//g, 'url($1/katex-fonts/');
  return css;
}

/* ------------------------------- api routes ------------------------------ */

const routeModules = new Map();
const ROUTE_NAMES = ['chat', 'diag', 'health', 'subjects', 'title'];

/**
 * Route handlers use the `@/` path alias, which Node cannot resolve on its own.
 * Next.js does that via tsconfig paths; here esbuild does it, bundling each
 * route into plain ESM. The handler code itself is untouched.
 */
async function buildRoutes() {
  for (const name of ROUTE_NAMES) {
    const outfile = join(root, `.harness/api-${name}.mjs`);
    await run(esbuildBin, [
      `src/app/api/${name}/route.ts`,
      '--bundle',
      `--outfile=${outfile}`,
      '--platform=node',
      '--format=esm',
      '--target=node18',
      '--alias:@=./src',
      '--packages=external',
      '--log-level=warning',
    ]);
    routeModules.set(name, await import(`${outfile}?v=${Date.now()}`));
  }
}

function loadRoute(name) {
  return routeModules.get(name) ?? null;
}

function nodeRequestToWeb(req) {
  const url = `http://${req.headers.host ?? 'localhost'}${req.url}`;
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) {
    if (Array.isArray(v)) v.forEach((x) => headers.append(k, x));
    else if (v !== undefined) headers.set(k, v);
  }
  if (req.method === 'GET' || req.method === 'HEAD') {
    return new Request(url, { method: req.method, headers });
  }
  const chunks = [];
  return new Promise((resolvePromise) => {
    req.on('data', (c) => chunks.push(c));
    req.on('end', () =>
      resolvePromise(new Request(url, { method: req.method, headers, body: Buffer.concat(chunks) })),
    );
  });
}

async function sendWebResponse(res, webResponse) {
  const headers = {};
  webResponse.headers.forEach((value, key) => {
    if (key.toLowerCase() === 'set-cookie') return;
    headers[key] = value;
  });
  const setCookie = webResponse.headers.getSetCookie?.() ?? [];
  res.writeHead(webResponse.status, { ...headers, ...(setCookie.length ? { 'Set-Cookie': setCookie } : {}) });

  if (!webResponse.body) {
    res.end();
    return;
  }
  const reader = webResponse.body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    res.write(Buffer.from(value));
    // SSE must reach the browser immediately, not sit in a buffer.
    res.flushHeaders?.();
  }
  res.end();
}

/* --------------------------------- server -------------------------------- */

const page = (title) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title}</title>
<link rel="stylesheet" href="/app.css" />
<script>
(function () {
  try {
    var s = JSON.parse(localStorage.getItem('tutor.settings.v1') || '{}');
    var t = s.theme || 'system';
    var dark = t === 'dark' || (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (dark) document.documentElement.classList.add('dark');
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
  } catch (e) {}
})();
</script>
</head>
<body class="antialiased"><div id="root"></div><script src="/app.js"></script></body>
</html>`;

let cachedJs = null;
let cachedCss = null;

export async function startHarness({ port = PORT, quiet = false } = {}) {
  cachedJs = await buildClient();
  cachedCss = await buildCss();
  await buildRoutes();

  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, `http://${req.headers.host ?? 'localhost'}`);

      if (url.pathname === '/app.js') {
        res.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8' });
        res.end(cachedJs);
        return;
      }
      if (url.pathname === '/app.css') {
        res.writeHead(200, { 'Content-Type': 'text/css; charset=utf-8' });
        res.end(cachedCss);
        return;
      }
      if (url.pathname.startsWith('/katex-fonts/')) {
        try {
          const file = await readFile(join(root, 'node_modules/katex/dist/fonts', url.pathname.slice(13)));
          res.writeHead(200, { 'Content-Type': 'font/woff2' });
          res.end(file);
        } catch {
          res.writeHead(404).end();
        }
        return;
      }

      const apiMatch = /^\/api\/([a-z]+)$/.exec(url.pathname);
      if (apiMatch) {
        const mod = loadRoute(apiMatch[1]);
        const handler = mod?.[req.method];
        if (!handler) {
          res.writeHead(405, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: { code: 'method_not_allowed', message: 'Unsupported method.' } }));
          return;
        }
        const webRequest = await nodeRequestToWeb(req);
        const webResponse = await handler(webRequest);
        await sendWebResponse(res, webResponse);
        return;
      }

      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(page('MathMind — AI Math Tutor'));
    } catch (err) {
      if (!quiet) console.error('harness error:', err);
      if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: { code: 'internal_error', message: String(err?.message ?? err) } }));
    }
  });

  await new Promise((r) => server.listen(port, r));
  const actualPort = server.address().port;
  if (!quiet) console.log(`Harness running on http://localhost:${actualPort}`);
  return {
    server,
    port: actualPort,
    close: () => new Promise((r) => server.close(r)),
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  startHarness().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
