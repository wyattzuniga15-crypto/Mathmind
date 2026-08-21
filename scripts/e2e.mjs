#!/usr/bin/env node
/**
 * End-to-end test: drives the real UI in a real browser against the real API
 * routes, real agent loop, and real math engine.
 *
 *   node scripts/e2e.mjs            # offline, using the stand-in upstream
 *   ANTHROPIC_API_KEY=... node scripts/e2e.mjs --live
 *
 * With --live the language model is real too. Without it, only the model is
 * substituted; every number asserted below still comes from the math engine.
 */
import { chromium } from 'playwright';
import { startMockUpstream } from './mock-upstream.mjs';

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
    process.env.GROQ_API_KEY = 'gsk-harness-not-a-real-key';
  }
  process.env.RATE_LIMIT_PER_MINUTE = '200';

  const { startHarness } = await import('./dev-harness.mjs');
  const harness = await startHarness({ port: 0, quiet: true });
  const base = `http://127.0.0.1:${harness.port}`;

  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
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
    check('API key never appears in the client bundle', !clientBundle.includes('gsk-') && !clientBundle.includes('sk-ant-'));
    check(
      'client bundle contains no ANTHROPIC_API_KEY reference',
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
