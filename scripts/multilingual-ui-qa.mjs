import process from 'node:process';
import { chromium } from 'playwright';

const previewUrl = process.env.PREVIEW_URL;
if (!previewUrl) throw new Error('PREVIEW_URL is required');

const browser = await chromium.launch();
const failures = [];

const assert = (condition, message) => {
  if (!condition) failures.push(message);
};

for (const scenario of [
  { name: 'desktop', viewport: { width: 1280, height: 800 }, isMobile: false },
  { name: 'iphone', viewport: { width: 390, height: 844 }, isMobile: true },
]) {
  const context = await browser.newContext({
    viewport: scenario.viewport,
    isMobile: scenario.isMobile,
    hasTouch: scenario.isMobile,
    deviceScaleFactor: scenario.isMobile ? 3 : 1,
  });
  const page = await context.newPage();

  try {
    const url = new URL(previewUrl);
    url.searchParams.set('qa', '1');
    await page.goto(url.toString(), { waitUntil: 'networkidle', timeout: 45_000 });
    await page.locator('.game-table').waitFor({ state: 'visible', timeout: 15_000 });
    await page.waitForFunction(() => Boolean(window.__HKOS_QA_STORE__), null, { timeout: 15_000 });
    await page.waitForTimeout(800);

    const felt = await page.locator('.game-table').evaluate(el => ({
      base: getComputedStyle(el).backgroundImage,
      texture: getComputedStyle(el, '::before').backgroundImage,
      textureOpacity: parseFloat(getComputedStyle(el, '::before').opacity),
    }));
    assert(felt.base.includes('radial-gradient') && felt.base.includes('linear-gradient'), `${scenario.name}: felt lighting gradients are missing`);
    assert(felt.texture.includes('data:image/svg+xml') && felt.textureOpacity >= 0.5, `${scenario.name}: procedural felt fiber texture is missing`);

    await page.locator('.rulebook-toggle-btn').click();
    const rulebook = page.locator('.knowledge-card');
    await rulebook.waitFor({ state: 'visible', timeout: 5_000 });

    const callCards = rulebook.locator('.terminology-card');
    assert((await callCards.count()) === 4, `${scenario.name}: Rulebook should show four core multilingual call cards`);
    const callText = await rulebook.locator('.terminology-section').textContent();
    for (const token of ['上', 'soeng5', '吃', 'chī', '碰', 'pung3', 'pèng', '槓', 'gong3', '杠', 'gàng', '食糊', 'sik6 wu4', '和牌', 'hé pái']) {
      assert(callText?.includes(token), `${scenario.name}: Rulebook is missing multilingual term ${token}`);
    }

    const search = rulebook.locator('.rulebook-search');
    await search.fill('soeng5');
    assert((await rulebook.locator('.terminology-card').count()) === 1, `${scenario.name}: Jyutping search did not filter to the Sheung / Chow term`);
    assert((await rulebook.locator('.terminology-card').first().textContent())?.includes('Sheung / Chow'), `${scenario.name}: Jyutping search returned the wrong call`);
    await rulebook.locator('.knowledge-close').click();

    await page.evaluate(() => {
      const store = window.__HKOS_QA_STORE__;
      const tile = (value, instanceId) => ({
        id: `bamboo-${value}`,
        instanceId,
        category: 'bamboo',
        suit: 'bamboo',
        value,
      });
      const discard = tile(3, 'multilingual-discard');
      const one = tile(1, 'multilingual-one');
      const two = tile(2, 'multilingual-two');
      const current = store.getState();
      store.setState({
        ...current,
        phase: 'playing',
        claimOffer: {
          tile: discard,
          fromPlayer: 'north',
          canWin: true,
          canPong: true,
          canKong: true,
          canChow: true,
          chowSets: [[one, two]],
        },
      });
    });

    const panel = page.locator('.action-panel');
    await panel.waitFor({ state: 'visible', timeout: 5_000 });
    const expectedButtons = [
      ['.action-btn.win', ['Sik / Win', '食糊', 'sik6 wu4', '和牌', 'hé pái']],
      ['.action-btn.pong', ['Pung', '碰', 'pung3', 'pèng']],
      ['.action-btn.kong', ['Gong / Kong', '槓', 'gong3', '杠', 'gàng']],
      ['.action-btn.chow', ['Sheung / Chow', '上', 'soeng5', '吃', 'chī']],
    ];
    for (const [selector, tokens] of expectedButtons) {
      const button = panel.locator(selector).first();
      await button.waitFor({ state: 'visible', timeout: 5_000 });
      const text = await button.textContent();
      for (const token of tokens) assert(text?.includes(token), `${scenario.name}: ${selector} missing ${token}`);
    }

    const panelBox = await panel.boundingBox();
    assert(Boolean(panelBox) && panelBox.left >= -1 && panelBox.right <= scenario.viewport.width + 1, `${scenario.name}: multilingual claim panel overflows horizontally`);
    assert(Boolean(panelBox) && panelBox.top >= -1 && panelBox.bottom <= scenario.viewport.height + 1, `${scenario.name}: multilingual claim panel overflows vertically`);

    await page.screenshot({ path: `qa-screenshots/${scenario.name}-multilingual-claims.png`, fullPage: true });
  } catch (error) {
    failures.push(`${scenario.name}: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    await context.close();
  }
}

await browser.close();

if (failures.length) {
  console.error('\nMultilingual/felt UI QA failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Multilingual/felt UI QA passed for ${previewUrl}`);
