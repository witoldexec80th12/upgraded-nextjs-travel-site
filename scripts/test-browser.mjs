import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';

// Use a local production server for release checks, or the proxied dev URL.
const baseURL = process.argv.find((argument) => argument.startsWith('--base-url='))?.slice('--base-url='.length) || process.env.TEST_BASE_URL ||
  (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : 'http://127.0.0.1:5000');
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/repl/tools/bin/chromium',
  headless: true, args: ['--no-sandbox'],
});
const errors = [];
let context;
try {
  await mkdir('generated-artifacts/browser', { recursive: true });
  context = await browser.newContext({ baseURL, viewport: { width: 1440, height: 1000 } });
  let page = await context.newPage();
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page.getByRole('button', { name: 'Switch language' }).click();
  await page.getByRole('button', { name: 'Español', exact: true }).click();
  await page.waitForURL(/\/es$/);
  await page.getByText(/^Adulto \(€/).first().locator('..').getByRole('button').last().click();
  await page.getByRole('button', { name: 'Comprar Entradas', exact: true }).click();
  await page.waitForURL(/\/es\/booking\/castle-tickets\?/);
  await page.locator('.rdp-day_button:not([disabled])').first().click();
  await page.getByRole('button', { name: /^\d{1,2}:\d{2}$/ }).first().click();
  await page.getByRole('button', { name: /Continuar/ }).click();
  await page.waitForURL(/\/es\/success\?order_id=ORD-/);
  await page.getByRole('heading', { name: 'Booking Confirmed', exact: true }).waitFor();
  await page.getByText(/^ORD-[A-Z0-9]+$/).waitFor();
  await page.screenshot({ path: 'generated-artifacts/browser/demo-confirmation.jpg' });
  await page.goBack();
  await page.waitForURL(/\/es\/booking\/castle-tickets\?/);
  await page.goto('/guide/es/paseo-jardines-castillo-peles');
  await page.locator('article h1').waitFor();
  await page.getByRole('button', { name: 'Switch language' }).click();
  await page.getByRole('button', { name: 'Italiano', exact: true }).click();
  await page.waitForURL(/\/it\/guides\//);
  await page.locator('div[lang="it"] article h1').waitFor();
  await page.waitForLoadState('networkidle');
  // The new package route must connect to the same reusable demo booking flow.
  // Isolate this independent journey from pending dev-router refreshes.
  await page.close();
  page = await context.newPage();
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/en/tours/castle-tickets');
  await page.getByRole('heading', { level: 1 }).waitFor();
  await page.getByRole('link', { name: 'Purchase Tickets', exact: true }).last().click();
  await page.waitForURL(/\/en\/booking\/castle-tickets\?.+_adults=1/);
  await page.getByRole('button', { name: 'Switch language' }).click();
  await page.getByRole('button', { name: 'Español', exact: true }).click();
  await page.waitForURL(/\/es\/booking\/castle-tickets\?.+_adults=1/);
  await page.locator('.rdp-day_button:not([disabled])').first().waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await page.screenshot({ path: 'generated-artifacts/browser/mobile-home.jpg' });
  await page.goto('/faq');
  await page.locator('details summary').first().click();
  assert.equal(await page.locator('details').first().getAttribute('open'), '');
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));

  // Existing secret is consumed only by the test login; it is never printed,
  // persisted, added to URLs, or included in screenshots/traces.
  if (process.argv.includes('--admin-login')) {
    if (!process.env.ADMIN_API_KEY) throw new Error('ADMIN_API_KEY must exist to run the optional live admin check.');
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/admin');
    await page.waitForURL(/\/admin\/login$/);
    await page.getByLabel('Admin key').fill('intentionally-invalid-test-key');
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByRole('alert').waitFor();
    await page.getByLabel('Admin key').fill(process.env.ADMIN_API_KEY);
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByRole('heading', { name: 'Hut availability', exact: true }).waitFor();
    await page.getByRole('heading', { name: 'Daily availability matrix', exact: true }).waitFor();
    await page.locator('#sweep-from').waitFor();
    await page.locator('.av-hut-link').first().waitFor();
    const exportLink = page.getByRole('link', { name: /Export|Download CSV/i });
    if (await exportLink.count()) {
      const exportResponse = await context.request.get(await exportLink.getAttribute('href'));
      assert.equal(exportResponse.status(), 200);
      assert.match(exportResponse.headers()['content-type'], /text\/csv/);
    }
    await page.locator('.av-hut-link').first().click();
    await page.waitForURL(/\/admin\/history\//);
    // The pathname updates before Next finishes replacing the route payload.
    // Wait for the committed page before filling local component state.
    await page.waitForLoadState('networkidle');
    await page.getByLabel('Night', { exact: true }).fill('2027-07-01');
    await page.getByRole('button', { name: /View history/ }).click();
    await page.getByText(/Checks for 2027-07-01/).waitFor();
    await page.screenshot({ path: 'generated-artifacts/browser/admin-history.jpg' });
    await page.getByRole('link', { name: /Back to availability/ }).click();
    await page.getByRole('heading', { name: 'Hut availability', exact: true }).waitFor();
    await page.getByRole('button', { name: /Sign out/ }).click();
    await page.getByRole('heading', { name: 'Operator sign in' }).waitFor();
    const denied = await context.request.get('/api/huts');
    assert.equal(denied.status(), 401);
  }
  assert.deepEqual(errors, [], 'Browser runtime or hydration error');

  // Real no-JavaScript request: content must be visible, not only serialized.
  const noJS = await browser.newContext({ baseURL, javaScriptEnabled: false });
  const staticPage = await noJS.newPage();
  await staticPage.goto('/');
  assert.ok(await staticPage.locator('h1').isVisible());
  assert.ok(await staticPage.locator('header nav').isVisible());
  await staticPage.goto('/guide/castle-grounds-walk');
  assert.ok(await staticPage.locator('article h1').isVisible());
  await noJS.close();
  console.log('Browser checks passed: localized demo booking, article navigation, mobile layout, native FAQ, initial HTML' +
    (process.argv.includes('--admin-login') ? ', live admin login/history/export/logout.' : '.'));
} catch (error) {
  // Do not allow a browser call log to disclose an existing credential.
  const message = String(error?.stack ?? error);
  console.error(process.env.ADMIN_API_KEY ? message.replaceAll(process.env.ADMIN_API_KEY, '[REDACTED]') : message);
  process.exitCode = 1;
} finally {
  await context?.close();
  await browser.close();
}
