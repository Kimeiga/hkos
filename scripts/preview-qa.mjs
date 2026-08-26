import fs from 'node:fs/promises';
import process from 'node:process';
import { chromium } from 'playwright';

const previewUrl = process.env.PREVIEW_URL;
if (!previewUrl) throw new Error('PREVIEW_URL is required');

const scenarios = [
  { name: 'desktop', viewport: { width: 1440, height: 900 }, isMobile: false },
  { name: 'iphone', viewport: { width: 390, height: 844 }, isMobile: true },
];

await fs.mkdir('qa-screenshots', { recursive: true });
const browser = await chromium.launch();
const failures = [];

const overlaps = (a, b) =>
  a && b && a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

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
    }));
    if (overflow.width > overflow.viewport + 2) {
      failures.push(`${scenario.name}: horizontal overflow ${overflow.width}px > ${overflow.viewport}px`);
    }

    const playableTile = page.locator('.player-hand.bottom .hand-tile.clickable').first();
    await playableTile.waitFor({ state: 'visible', timeout: 15_000 });
    await playableTile.click();

    if (!(await playableTile.evaluate(el => el.classList.contains('selected')))) {
      failures.push(`${scenario.name}: clicking a human tile did not select it`);
    }

    const instruction = page.locator('.human-action-row .hand-instruction');
    await instruction.waitFor({ state: 'visible', timeout: 5_000 });
    const instructionText = await instruction.textContent();
    if (!instructionText?.includes('tap again to discard')) {
      failures.push(`${scenario.name}: selection confirmation instruction is missing`);
    }

    const instructionBox = await instruction.boundingBox();
    const handBox = await page.locator('.player-hand.bottom .hand-composite').boundingBox();
    if (overlaps(instructionBox, handBox)) {
      failures.push(`${scenario.name}: discard instruction overlaps the human hand`);
    }

    const recommended = page.locator('.player-hand.bottom .tile.recommended').first();
    if (await recommended.count()) {
      const tipContent = await recommended.evaluate(el => getComputedStyle(el, '::after').content);
      if (!tipContent.includes('TIP')) failures.push(`${scenario.name}: recommended tile is missing TIP marker`);
    }

    await page.screenshot({ path: `qa-screenshots/${scenario.name}.png`, fullPage: true });

    const teacherToggle = page.locator('.teacher-toggle-btn');
    await teacherToggle.waitFor({ state: 'visible', timeout: 5_000 });
    if (!(await page.locator('.teacher-panel').isVisible())) await teacherToggle.click();

    const coach = page.locator('.teacher-panel');
    await coach.waitFor({ state: 'visible', timeout: 5_000 });
    await page.waitForTimeout(250);

    const coachBox = await coach.boundingBox();
    for (const position of ['top', 'bottom', 'left', 'right']) {
      const playerBox = await page.locator(`.player-hand.${position}`).boundingBox();
      if (overlaps(coachBox, playerBox)) {
        failures.push(`${scenario.name}: coach overlaps ${position} player area`);
      }
    }

    await page.screenshot({ path: `qa-screenshots/${scenario.name}-coach.png`, fullPage: true });

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
