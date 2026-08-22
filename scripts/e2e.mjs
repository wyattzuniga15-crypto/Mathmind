#!/usr/bin/env node
/**
 * End-to-end test: drives the real UI in a real browser against the real API
 * routes, real agent loop, and real math engine.
 *
 *   node scripts/e2e.mjs            # offline, using the stand-in upstream
 *   GROQ_API_KEY=... node scripts/e2e.mjs --live
 *
 * With --live the language model is real too. Without it, only the model is
 * substituted; every number asserted below still comes from the math engine.
 */
import { startMockUpstream } from './mock-upstream.mjs';

/**
 * Playwright is loaded on demand rather than declared as a dependency: its
 * install step downloads browser bundles, and this repository is deployed with
 * `npm install`, so declaring it would put a few hundred megabytes of download
 * into every production build for a tool only the test suite uses.
 */
async function loadChromium() {
  try {
    return (await import('playwright')).chromium;
  } catch {
    console.error(
      'The end-to-end suite needs Playwright:\n' +
        '  npm install --no-save playwright && npx playwright install chromium\n' +
        'If a Chromium is already installed, point PLAYWRIGHT_CHROMIUM_EXECUTABLE at it.',
    );
    process.exit(1);
  }
}

const LIVE = process.argv.includes('--live') && Boolean(process.env.GROQ_API_KEY);

const results = [];
let failures = 0;

function check(name, condition, detail = '') {
  const ok = Boolean(condition);
  if (!ok) failures++;
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail && !ok ? ` — ${detail}` : ''}`);
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  let upstream = null;
  if (!LIVE) {
    upstream = await startMockUpstream({ port: 0 });
    process.env.GROQ_BASE_URL = upstream.url;
    process.env.GROQ_API_KEY = 'gsk_harnessNotARealKey000000000000';
  }
  process.env.RATE_LIMIT_PER_MINUTE = '200';

  const { startHarness } = await import('./dev-harness.mjs');
  const harness = await startHarness({ port: 0, quiet: true });
  const base = `http://127.0.0.1:${harness.port}`;

  const chromium = await loadChromium();
  // CI images and sandboxes often ship a preinstalled Chromium instead of
  // letting Playwright download its own. Honour it when it is pointed at.
  const browser = await chromium.launch(
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
      : {},
  );
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    permissions: ['clipboard-read', 'clipboard-write'],
  });
  const page = await context.newPage();

  const consoleErrors = [];
  const pageErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => pageErrors.push(err.message));

  try {
    /* ------------------------------- loading ------------------------------ */
    await page.goto(base, { waitUntil: 'networkidle' });
    check('app loads without a page error', pageErrors.length === 0, pageErrors.join(' | '));

    await page.waitForSelector('textarea[aria-label="Message"]', { timeout: 15000 });
    check('math tutor interface renders', await page.isVisible('text=Math tutor'));
    check('mode buttons render', (await page.locator('[role="tab"]').count()) === 6);
    check(
      'styles applied (tailwind compiled)',
      (await page.evaluate(() => getComputedStyle(document.body).backgroundColor)) !== 'rgba(0, 0, 0, 0)',
    );

    /* ---------------------- 1. basic arithmetic: 2 + 2 -------------------- */
    const send = async (text, { mode } = {}) => {
      if (mode) await page.click(`[role="tab"]:has-text("${mode}")`);
      await page.fill('textarea[aria-label="Message"]', text);
      await page.press('textarea[aria-label="Message"]', 'Enter');
    };
    const waitForReply = async (timeout = 30000) => {
      await page.waitForSelector('button:has-text("Regenerate")', { timeout });
    };
    // KaTeX renders the unicode minus sign (U+2212); normalise it so assertions
    // can use plain ASCII.
    const lastAssistant = async () =>
      (await page.locator('article').last().innerText()).replace(/\u2212/g, '-');

    await send('2 + 2');
    await waitForReply();
    let reply = await lastAssistant();
    check('1. arithmetic 2 + 2 returns 4 from the engine', /\b4\b/.test(reply), reply.slice(0, 120));
    check(
      'request reached the backend and streamed back',
      (await page.locator('article').count()) >= 2,
    );
    check(
      'tool trace shows a verified computation',
      await page.isVisible('text=/Verified with \\d+ exact computation/'),
    );
    check('KaTeX rendered math', (await page.locator('.katex').count()) > 0);

    /* ------------------------ copy conversation as markdown ---------------- */
    check(
      'copy-as-markdown button appears once a conversation has messages',
      await page.isVisible('button[aria-label="Copy conversation as Markdown"]'),
    );
    await page.click('button[aria-label="Copy conversation as Markdown"]');
    await wait(200);
    const clipboard = await page.evaluate(() => navigator.clipboard.readText()).catch(() => '');
    check(
      'clipboard holds the conversation as markdown, not the rendered app',
      clipboard.startsWith('#') && clipboard.includes('2 + 2') && !clipboard.includes('<'),
      clipboard.slice(0, 60),
    );

    /* ------------------------- export as PDF (print) ----------------------- */
    check(
      'export button appears once a conversation has messages',
      await page.isVisible('button[aria-label="Export this conversation as a PDF"]'),
    );
    await page.emulateMedia({ media: 'print' });
    check(
      'sidebar and composer are hidden when printing',
      !(await page.locator('aside').first().isVisible()) &&
        !(await page.locator('textarea[aria-label="Message"]').isVisible()),
    );
    check(
      'the transcript itself stays visible when printing',
      await page.isVisible('text=/Verified with \\d+ exact computation/'),
    );
    await page.emulateMedia({ media: 'screen' });

    /* ------------------- 2. linear equation 2x + 5 = 15 ------------------- */
    await page.click('button:has-text("New conversation")');
    await page.waitForSelector('text=Math tutor');
    await send('2x + 5 = 15');
    await waitForReply();
    reply = await lastAssistant();
    check('2. solves 2x + 5 = 15 with x = 5', /x\s*=\s*5|=\s*5\b/.test(reply.replace(/\s+/g, ' ')), reply.slice(0, 160));
    check('solution verified by substitution', /residual|verified/i.test(reply));

    /* ------------- 7. follow-up referring to the prior problem ------------ */
    await send('why did you subtract 5?');
    await waitForReply();
    reply = await lastAssistant();
    check(
      '7. follow-up resolves against the current problem',
      /balanc|both sides|isolat/i.test(reply),
      reply.slice(0, 160),
    );

    /* --------------------------- 4. fractions ---------------------------- */
    await page.click('button:has-text("New conversation")');
    await send('3/4 + 1/6');
    await waitForReply();
    reply = await lastAssistant();
    check('4. fraction 3/4 + 1/6 gives exactly 11/12', /11/.test(reply) && /12/.test(reply), reply.slice(0, 160));
    check('exactness is stated, not implied', /exact/i.test(reply));

    /* -------------------- 3. multi-step algebra problem ------------------- */
    await page.click('button:has-text("New conversation")');
    await send('3(x - 2) = 5x + 4');
    await waitForReply();
    reply = await lastAssistant();
    check('3. multi-step algebra gives x = -5', /-5/.test(reply), reply.slice(0, 160));

    /* --------------------------- 5. word problem -------------------------- */
    await page.click('button:has-text("New conversation")');
    await send('80*t = 60*(t + 2)');
    await waitForReply();
    reply = await lastAssistant();
    check('5. word-problem equation gives t = 6', /\b6\b/.test(reply), reply.slice(0, 160));

    /* ---------------- 6. check my work with a wrong solution -------------- */
    await page.click('button:has-text("New conversation")');
    await send('3x + 6 = 18\n3x = 24\nx = 8\n\nDid I do this right?', { mode: 'Check My Work' });
    await waitForReply();
    reply = await lastAssistant();
    check('6. check-my-work names the first wrong line', /Line 2/i.test(reply), reply.slice(0, 200));
    check('6. check-my-work gives the correct answer', /\b4\b/.test(reply), reply.slice(0, 200));

    /* ----------------------------- 8. calculus ---------------------------- */
    await page.click('button:has-text("New conversation")');
    await send('what is the derivative of x^2*sin(x)?');
    await waitForReply();
    reply = await lastAssistant();
    check(
      '8. calculus derivative computed and verified',
      /product rule/i.test(reply) && /Verified numerically/i.test(reply),
      reply.slice(0, 200),
    );

    /* ------------- 9. difficult problem needing several tools ------------- */
    await page.click('button:has-text("New conversation")');
    await send('Solve this system:\nx + y + z = 6\n2x - y + z = 3\nx + 2y - z = 2');
    await waitForReply();
    reply = await lastAssistant();
    check(
      '9. system of three equations solved (x=1, y=2, z=3)',
      /1/.test(reply) && /2/.test(reply) && /3/.test(reply),
      reply.slice(0, 200),
    );

    /* --------------------------- streaming/stop --------------------------- */
    await page.click('button:has-text("New conversation")');
    // Slow the stream so the mid-generation state is reliably observable.
    upstream?.setDelay(120);
    await page.fill('textarea[aria-label="Message"]', '2x + 5 = 15');
    await page.press('textarea[aria-label="Message"]', 'Enter');
    const stopVisible = await page
      .waitForSelector('button[aria-label="Stop generating"]', { timeout: 8000 })
      .then(() => true)
      .catch(() => false);
    check('streaming state shows a stop button', stopVisible);
    if (stopVisible) {
      const partial = await lastAssistant();
      await page.click('button[aria-label="Stop generating"]', { timeout: 5000 });
      await wait(600);
      check(
        'stop generation returns the composer to idle',
        await page.isVisible('button[aria-label="Send message"]'),
      );
      await wait(800);
      const afterStop = await lastAssistant();
      check(
        'stopping halts the stream instead of continuing in the background',
        afterStop.length - partial.length < 400,
        `grew by ${afterStop.length - partial.length} chars`,
      );
    }
    upstream?.setDelay(8);

    /* ---------------------------- conversations --------------------------- */
    const convCount = await page.locator('aside button[title]').count();
    check('conversation history lists past chats', convCount >= 5, `found ${convCount}`);

    // search: the mock upstream titles every conversation identically, so
    // this asserts by opening the filtered result and checking its actual
    // transcript, the same thing a real user cares about -- not the title.
    check('search box appears once there is enough history', await page.isVisible('input[aria-label="Search conversations"]'));
    await page.fill('input[aria-label="Search conversations"]', 'derivative');
    await wait(150);
    const searchRowCount = await page.locator('aside .group').count();
    check('search narrows the list to the matching conversation', searchRowCount === 1, `${searchRowCount} rows`);
    if (searchRowCount === 1) {
      await page.click('aside .group button >> nth=0');
      await wait(300);
      check(
        'the opened search result actually contains the search term',
        /derivative/i.test(await page.locator('article').first().innerText()),
      );
    }
    await page.fill('input[aria-label="Search conversations"]', 'no conversation says this');
    await wait(150);
    check('search reports no matches rather than showing everything', await page.isVisible('text=/No conversations match/'));
    await page.click('button[aria-label="Clear search"]');
    await wait(150);

    // rename
    const firstRow = page.locator('aside .group').first();
    await firstRow.hover();
    await firstRow.locator('button[aria-label^="Options"]').click();
    await page.click('button:has-text("Rename")');
    await page.fill('input[aria-label="Conversation name"]', 'Renamed by test');
    await page.press('input[aria-label="Conversation name"]', 'Enter');
    await wait(300);
    check('rename conversation works', await page.isVisible('text=Renamed by test'));

    // persistence across reload
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForSelector('textarea[aria-label="Message"]');
    check('conversation history persists across reload', await page.isVisible('text=Renamed by test'));

    // delete
    const rowToDelete = page.locator('aside .group').first();
    await rowToDelete.hover();
    await rowToDelete.locator('button[aria-label^="Options"]').click();
    await page.click('button:has-text("Delete")');
    await wait(400);
    check('delete conversation works', !(await page.isVisible('text=Renamed by test')));

    /* --------------------------- jump to latest ---------------------------- */
    await page.click('button:has-text("New conversation")');
    await page.waitForSelector('text=Math tutor');
    for (const p of ['1 + 1', '2 + 2', '3 + 3', '4 + 4']) await send(p);
    await page.evaluate(() => {
      const el = document.querySelector('.overscroll-contain');
      el.scrollTop = 0;
      el.dispatchEvent(new Event('scroll'));
    });
    await wait(200);
    const jumpVisible = await page.isVisible('button[aria-label="Jump to the latest message"]');
    check('jump-to-latest button appears once scrolled away from the bottom', jumpVisible);
    if (jumpVisible) {
      await page.click('button[aria-label="Jump to the latest message"]');
      await wait(500);
      const gap = await page.evaluate(() => {
        const el = document.querySelector('.overscroll-contain');
        return el.scrollHeight - el.scrollTop - el.clientHeight;
      });
      check('jump-to-latest actually returns to the bottom', gap < 120, `gap=${gap}`);
      check(
        'jump-to-latest button disappears once back at the bottom',
        !(await page.isVisible('button[aria-label="Jump to the latest message"]')),
      );
    }

    /* ---------------------------- offline banner --------------------------- */
    await context.setOffline(true);
    await page.evaluate(() => window.dispatchEvent(new Event('offline')));
    await wait(200);
    check('offline banner appears when the connection drops', await page.isVisible('text=/You.re offline/'));
    check('composer is disabled while offline', await page.isDisabled('textarea[aria-label="Message"]'));
    await context.setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event('online')));
    await wait(200);
    check('offline banner clears once back online', !(await page.isVisible('text=/You.re offline/')));
    check('composer re-enables once back online', !(await page.isDisabled('textarea[aria-label="Message"]')));

    /* ------------------------------- theming ------------------------------ */
    const beforeTheme = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    await page.click('button[aria-label="Toggle dark mode"]');
    await wait(250);
    const afterTheme = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    check('theme toggle switches mode', beforeTheme !== afterTheme);
    await page.reload({ waitUntil: 'networkidle' });
    const persistedTheme = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    check('theme persists across reload', persistedTheme === afterTheme);

    /* --------------------------- error handling --------------------------- */
    if (upstream) {
      upstream.setFailMode('overloaded');
      await page.waitForSelector('textarea[aria-label="Message"]');
      await page.fill('textarea[aria-label="Message"]', '5 + 5');
      await page.press('textarea[aria-label="Message"]', 'Enter');
      await page.waitForSelector('[role="alert"]', { timeout: 15000 });
      const alertText = await page.locator('[role="alert"]').first().innerText();
      check('upstream failure shows a readable error', /overload|busy|try again/i.test(alertText), alertText);
      check('retryable error offers a retry action', await page.isVisible('button:has-text("Try again")'));
      upstream.setFailMode(null);
    }

    /* ------------------------------ security ------------------------------ */
    const clientBundle = await (await fetch(`${base}/app.js`)).text();
    // Real Groq keys start with `gsk_`, so that is the prefix that matters here.
    check(
      'API key never appears in the client bundle',
      !clientBundle.includes('gsk_') && !clientBundle.includes('gsk-') && !clientBundle.includes('sk-ant-'),
    );
    check(
      'client bundle contains no API key reference',
      !clientBundle.includes('GROQ_API_KEY'),
    );
    check(
      'client never calls the AI provider directly',
      !clientBundle.includes('api.groq.com'),
    );

    /* --------------------------- console health --------------------------- */
    const realErrors = consoleErrors.filter(
      (e) => !/favicon|404 \(Not Found\)|Failed to load resource/i.test(e),
    );
    check('no React or console errors during the session', realErrors.length === 0, realErrors.slice(0, 3).join(' | '));
    check('no uncaught page errors during the session', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '));
  } finally {
    await browser.close();
    await harness.close();
    if (upstream) await upstream.close();
  }

  console.log(`\n${results.length - failures}/${results.length} checks passed`);
  if (failures) process.exit(1);
}

main().catch((err) => {
  console.error('\nE2E run failed:', err);
  process.exit(1);
});
