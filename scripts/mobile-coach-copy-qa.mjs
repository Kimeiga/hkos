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

  const subtitleVisible = await coach.locator('.teacher-subtitle').isVisible();
  if (subtitleVisible) failures.push('mobile: verbose Coach subtitle is still visible');

  const text = (await coach.textContent()) ?? '';
  for (const expected of ['Green tile = best discard.', 'est. improving copies', 'Improve', 'Other discards']) {
    if (!text.includes(expected)) failures.push(`mobile: compact Coach copy is missing "${expected}"`);
  }
  for (const verbose of [
    'The same tile is marked green in your hand. Tap this tile to learn what it is.',
    'Improving copies (rough est.)',
    'Other reasonable discards',
  ]) {
    if (text.includes(verbose)) failures.push(`mobile: verbose desktop copy leaked into Coach: "${verbose}"`);
  }

  const panel = await coach.boundingBox();
  if (!panel) {
    failures.push('mobile: Coach has no bounding box');
  } else if (panel.height > 0.38 * 844 + 2) {
    failures.push(`mobile: Coach exceeds its 38dvh budget (${panel.height.toFixed(1)}px)`);
  }

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
