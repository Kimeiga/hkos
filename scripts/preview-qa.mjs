import fs from 'node:fs/promises';
import process from 'node:process';
import { chromium } from 'playwright';

const previewUrl = process.env.PREVIEW_URL;
if (!previewUrl) throw new Error('PREVIEW_URL is required');

const scenarios = [
  { name: 'iphone', viewport: { width: 390, height: 844 }, isMobile: true, tileRange: [31.5, 32.5] },
  { name: 'tablet', viewport: { width: 768, height: 1024 }, isMobile: false, tileRange: [41, 44] },
  { name: 'desktop', viewport: { width: 1440, height: 900 }, isMobile: false, tileRange: [64, 66] },
  { name: 'desktop-wide', viewport: { width: 1920, height: 1080 }, isMobile: false, tileRange: [71, 73] },
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
    await page.waitForTimeout(800); // let Framer Motion deal/draw animations settle

    const title = await page.title();
    if (!/HKOS|Mahjong/i.test(title)) failures.push(`${scenario.name}: unexpected title: ${title}`);

    const overflow = await page.evaluate(() => ({
      width: document.documentElement.scrollWidth,
      viewport: window.innerWidth,
    }));
    if (overflow.width > overflow.viewport + 2) {
      failures.push(`${scenario.name}: horizontal overflow ${overflow.width}px > ${overflow.viewport}px`);
    }

    const teacherToggle = page.locator('.teacher-toggle-btn');
    await teacherToggle.waitFor({ state: 'visible', timeout: 5_000 });
    if (await page.locator('.teacher-panel').isVisible()) await teacherToggle.click();

    const playableTile = page.locator('.player-hand.bottom .hand-tile.clickable').first();
    await playableTile.waitFor({ state: 'visible', timeout: 15_000 });

    // Read the computed CSS size, not the animated bounding box. Bounding boxes
    // can briefly report Framer Motion's transform scale during dealing.
    const computedTileWidth = await playableTile.evaluate(el => parseFloat(getComputedStyle(el).width));
    const [minWidth, maxWidth] = scenario.tileRange;
    if (computedTileWidth < minWidth || computedTileWidth > maxWidth) {
      failures.push(`${scenario.name}: computed human tile width ${computedTileWidth.toFixed(1)}px outside expected fluid range ${minWidth}-${maxWidth}px`);
    }

    const clippedTiles = await page.evaluate(() => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      return Array.from(document.querySelectorAll('.player-hand .tile'))
        .map((el, index) => ({ index, rect: el.getBoundingClientRect() }))
        .filter(({ rect }) => rect.right < -1 || rect.left > vw + 1 || rect.bottom < -1 || rect.top > vh + 1)
        .length;
    });
    if (clippedTiles > 0) failures.push(`${scenario.name}: ${clippedTiles} player tiles are completely outside the viewport`);

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

    await page.screenshot({ path: `qa-screenshots/${scenario.name}.png`, fullPage: true });

    await teacherToggle.click();
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

    if (scenario.name === 'iphone') {
      for (const selector of ['.teacher-subtitle', '.stats', '.alternatives']) {
        if (!(await coach.locator(selector).isVisible())) {
          failures.push(`iphone: full Coach information missing: ${selector}`);
        }
      }
      const overflowY = await coach.evaluate(el => getComputedStyle(el).overflowY);
      if (!['auto', 'scroll'].includes(overflowY)) failures.push(`iphone: Coach surface is not scrollable (overflow-y=${overflowY})`);
    }

    const recommended = page.locator('.player-hand.bottom .tile.recommended').first();
    if (await recommended.count()) {
      const tipContent = await recommended.evaluate(el => getComputedStyle(el, '::after').content);
      if (!tipContent.includes('TIP')) failures.push(`${scenario.name}: recommended tile is missing TIP marker`);
    }

    await page.screenshot({ path: `qa-screenshots/${scenario.name}-coach.png`, fullPage: true });

    const handLink = coach.locator('.inline-rule-link');
    await handLink.waitFor({ state: 'visible', timeout: 5_000 });
    await handLink.click();
    const knowledge = page.locator('.knowledge-card');
    await knowledge.waitFor({ state: 'visible', timeout: 5_000 });
    if (!(await knowledge.locator('h2').first().isVisible()) || !(await knowledge.locator('.knowledge-definition').first().isVisible())) {
      failures.push(`${scenario.name}: Coach hand link did not open a populated rulebook detail`);
    }
    if (scenario.name === 'iphone' || scenario.name === 'desktop') {
      await page.screenshot({ path: `qa-screenshots/${scenario.name}-rule-detail.png`, fullPage: true });
    }
    await knowledge.locator('.knowledge-close').click();

    const rulebookButton = page.locator('.rulebook-toggle-btn');
    await rulebookButton.click();
    const rulebook = page.locator('.knowledge-card');
    await rulebook.waitFor({ state: 'visible', timeout: 5_000 });
    if (!(await page.locator('.rulebook-search').isVisible())) failures.push(`${scenario.name}: rulebook search is missing`);
    if (scenario.name === 'iphone' || scenario.name === 'desktop') {
      await page.screenshot({ path: `qa-screenshots/${scenario.name}-rulebook.png`, fullPage: true });
    }
    await rulebook.locator('.knowledge-close').click();

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
