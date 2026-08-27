import process from 'node:process';
import { chromium } from 'playwright';

const previewUrl = process.env.PREVIEW_URL;
if (!previewUrl) throw new Error('PREVIEW_URL is required');

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  deviceScaleFactor: 3,
});
const page = await context.newPage();
const failures = [];

try {
  await page.goto(previewUrl, { waitUntil: 'networkidle', timeout: 45_000 });
  const coach = page.locator('.teacher-panel');
  await coach.waitFor({ state: 'visible', timeout: 15_000 });

  // The table deals asynchronously after mount. Wait for the Coach's first real
  // suggestion instead of reading the initial no-suggestion state.
  await coach.locator('.rec-help').filter({ hasText: 'Green tile = best discard.' }).waitFor({ state: 'visible', timeout: 15_000 });
  await coach.locator('.reasoning-text').filter({ hasText: 'est. improving copies' }).waitFor({ state: 'visible', timeout: 5_000 });

  const text = (await coach.innerText()) ?? '';
  for (const expected of ['Why this helps', 'Green tile = best discard.', 'est. improving copies', 'Improve']) {
    if (!text.includes(expected)) failures.push(`mobile: concise Coach copy is missing "${expected}"`);
  }
  for (const verbose of [
    'Why a move is good, not just what to click',
    'The same tile is marked green in your hand. Tap this tile to learn what it is.',
    'Improving copies (rough est.)',
    'Other reasonable discards',
    '0 fan by itself',
  ]) {
    if (text.includes(verbose)) failures.push(`mobile: verbose Coach copy is still rendered: "${verbose}"`);
  }

  const alternatives = coach.locator('.alternatives');
  if (await alternatives.count()) {
    const altText = (await alternatives.innerText()) ?? '';
    if (!altText.includes('Other discards')) failures.push('mobile: alternatives use the old long heading');
  }

  const ruleLinks = coach.locator('.inline-rule-link');
  if ((await ruleLinks.count()) !== 1) failures.push('mobile: Coach should expose exactly one tappable target-hand link');

  await page.screenshot({ path: 'qa-screenshots/iphone-compact-coach.png', fullPage: true });
} finally {
  await context.close();
  await browser.close();
}

if (failures.length) {
  console.error('\nCompact mobile Coach QA failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Compact mobile Coach QA passed for ${previewUrl}`);
