import fs from 'node:fs/promises';
import process from 'node:process';
import { chromium } from 'playwright';

const previewUrl = process.env.PREVIEW_URL;
if (!previewUrl) {
  throw new Error('PREVIEW_URL is required');
}

const scenarios = [
  { name: 'desktop', viewport: { width: 1440, height: 900 }, isMobile: false },
  { name: 'iphone', viewport: { width: 390, height: 844 }, isMobile: true },
];

await fs.mkdir('qa-screenshots', { recursive: true });
const browser = await chromium.launch();
const failures = [];

for (const scenario of scenarios) {
  const context = await browser.newContext({
    viewport: scenario.viewport,
    isMobile: scenario.isMobile,
    hasTouch: scenario.isMobile,
    deviceScaleFactor: scenario.isMobile ? 3 : 1,
  });
  const page = await context.newPage();
  const runtimeErrors = [];

  page.on('pageerror', error => runtimeErrors.push(`pageerror: ${error.message}`));
  page.on('console', message => {
    if (message.type() === 'error') runtimeErrors.push(`console: ${message.text()}`);
  });

  try {
    await page.goto(previewUrl, { waitUntil: 'networkidle', timeout: 45_000 });
    await page.locator('.game-table').waitFor({ state: 'visible', timeout: 15_000 });

    const title = await page.title();
    if (!/HKOS|Mahjong/i.test(title)) failures.push(`${scenario.name}: unexpected title: ${title}`);

    const overflow = await page.evaluate(() => ({
      width: document.documentElement.scrollWidth,
      viewport: window.innerWidth,
      height: document.documentElement.scrollHeight,
      viewportHeight: window.innerHeight,
    }));
    if (overflow.width > overflow.viewport + 2) {
      failures.push(`${scenario.name}: horizontal overflow ${overflow.width}px > ${overflow.viewport}px`);
    }

    const coach = page.locator('.teacher-panel');
    if (!(await coach.isVisible())) failures.push(`${scenario.name}: coach panel is not visible on initial load`);

    const turnCoach = page.locator('.turn-coach');
    await turnCoach.waitFor({ state: 'visible', timeout: 15_000 });

    const playableTile = page.locator('.player-hand.bottom .hand-tile.clickable').first();
    await playableTile.waitFor({ state: 'visible', timeout: 15_000 });
    await playableTile.click();

    if (!(await playableTile.evaluate(el => el.classList.contains('selected')))) {
      failures.push(`${scenario.name}: clicking a human tile did not select it`);
    }

    const instruction = await turnCoach.textContent();
    if (!instruction?.includes('Tap the selected tile again')) {
      failures.push(`${scenario.name}: selection confirmation instruction is missing`);
    }

    const recommended = page.locator('.player-hand.bottom .tile.recommended').first();
    if (await recommended.count()) {
      const tipContent = await recommended.evaluate(el => getComputedStyle(el, '::after').content);
      if (!tipContent.includes('TIP')) failures.push(`${scenario.name}: recommended tile is missing TIP marker`);
    }

    await page.screenshot({
      path: `qa-screenshots/${scenario.name}.png`,
      fullPage: true,
    });

    if (runtimeErrors.length) failures.push(...runtimeErrors.map(error => `${scenario.name}: ${error}`));
  } catch (error) {
    failures.push(`${scenario.name}: ${error instanceof Error ? error.message : String(error)}`);
    await page.screenshot({ path: `qa-screenshots/${scenario.name}-failure.png`, fullPage: true }).catch(() => {});
  } finally {
    await context.close();
  }
}

await browser.close();

if (failures.length) {
  console.error('\nPreview browser QA failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Preview browser QA passed for ${previewUrl}`);
