// Pure engine regressions run via Vite's TypeScript loader; no browser or test dependency.
import assert from 'node:assert/strict';
import { createServer } from 'vite';

const server = await createServer({
  configFile: false,
  logLevel: 'silent',
  server: { middlewareMode: true },
  appType: 'custom',
});

try {
  const shanten = await server.ssrLoadModule('/src/engine/shanten.ts');
  const teacher = await server.ssrLoadModule('/src/engine/teacher.ts');
  const efficiency = await server.ssrLoadModule('/src/engine/tileEfficiency.ts');
  const ai = await server.ssrLoadModule('/src/engine/ai.ts');

  let instance = 0;
  const tile = (id) => {
    const [category, suffix] = id.split('-');
    return {
      id, instanceId: 'fixture-' + instance++, category,
      ...(['bamboo', 'character', 'dot'].includes(category)
        ? { suit: category, value: Number(suffix) }
        : category === 'dragon' ? { dragon: suffix } : { wind: suffix }),
    };
  };
  const hand = (ids) => ids.trim().split(/\s+/).map(tile);
  const meld = (type, ids) => {
    const tiles = hand(ids);
    return { type, tiles, baseTile: tiles[0], isConcealed: false };
  };

  const complete = hand('bamboo-1 bamboo-2 bamboo-3 character-1 character-2 character-3 dot-1 dot-2 dot-3 dragon-red dragon-red dragon-red wind-east wind-east');
  assert.equal(shanten.calculateShanten(complete, []), -1, 'standard winning hand');
  assert.equal(shanten.calculateShanten(complete.slice(0, -1), []), 0, 'single-tile standard wait');

  const openMeld = meld('pung', 'wind-south wind-south wind-south');
  const concealed = hand('bamboo-1 bamboo-2 bamboo-3 character-1 character-2 character-3 dot-1 dot-2 dot-3 wind-east wind-east');
  assert.equal(shanten.calculateShanten(concealed, [openMeld]), -1, 'exposed pung completes the fourth set');
  assert.equal(shanten.calculateShanten(concealed.slice(0, -1), [openMeld]), 0, 'exposed pung needs one pair tile');

  const sevenPairs = hand('bamboo-1 bamboo-1 bamboo-2 bamboo-2 bamboo-3 bamboo-3 character-4 character-4 character-5 character-5 dot-6 dot-6 wind-east wind-east');
  assert.equal(shanten.calculateShanten(sevenPairs, []), -1, 'seven distinct pairs as supported by this ruleset');
  const notSevenPairs = hand('bamboo-1 bamboo-1 bamboo-1 bamboo-1 bamboo-2 bamboo-2 bamboo-3 bamboo-3 character-4 character-4 character-5 character-5 dot-6 dot-6');
  assert.ok(shanten.calculateSevenPairsShanten(notSevenPairs) > -1, 'a quad is not two distinct pairs');

  const orphans = hand('bamboo-1 bamboo-9 character-1 character-9 dot-1 dot-9 wind-east wind-south wind-west wind-north dragon-red dragon-green dragon-white dragon-green');
  assert.equal(shanten.calculateShanten(orphans, []), -1, 'thirteen orphans');
  assert.equal(shanten.calculateShanten(orphans.slice(0, -1), []), 0, 'thirteen orphans single-tile wait');

  const oneWait = hand('bamboo-1 bamboo-1 bamboo-1 bamboo-2 bamboo-2 bamboo-2 bamboo-3 bamboo-3 bamboo-3 bamboo-4 bamboo-4 bamboo-4 dot-5');
  assert.equal(efficiency.calculateVisibleUkeire(oneWait, [], efficiency.countKnownTiles(oneWait)).copies, 3);
  const visibleFives = hand('dot-5 dot-5 dot-5');
  const deadWait = efficiency.countKnownTiles([...oneWait, ...visibleFives]);
  assert.deepEqual(efficiency.calculateVisibleUkeire(oneWait, [], deadWait), { copies: 0, kinds: 0 }, 'dead wait has zero outs');
  const discarded = tile('wind-east');
  assert.equal(teacher.calculateUkeire([...oneWait, discarded], [], discarded), 3, 'freshly discarded tile stays accounted for');

  // Screenshot regression: two green dragons in hand, the other two on the table.
  const screenshotHand = hand('dragon-green dragon-green bamboo-1 bamboo-2 bamboo-3 bamboo-4 bamboo-5 bamboo-6 character-2 character-3 character-4 dot-2 dot-4 dot-6');
  const twoVisible = hand('dragon-green dragon-green');
  assert.ok(teacher.evaluateHandTargets(screenshotHand, []).some(t => t.name === 'green Dragon Pung'), 'two unseen dragons could complete a pung');
  const known = efficiency.countKnownTiles([...screenshotHand, ...twoVisible]);
  assert.equal(efficiency.unseenCopies(known, 'dragon-green'), 0);
  assert.ok(!teacher.evaluateHandTargets(screenshotHand, [], known).some(t => t.name === 'green Dragon Pung'), 'all four accounted for makes pung impossible');
  assert.notEqual(teacher.suggestDiscard(screenshotHand, [], 'east', 'east', twoVisible).targetHand, 'green Dragon Pung');

  const completedPung = hand('dragon-green dragon-green dragon-green bamboo-1 bamboo-2 bamboo-3 bamboo-4 bamboo-5 bamboo-6 character-2 character-3 character-4 dot-2 dot-4');
  assert.ok(teacher.evaluateHandTargets(completedPung, []).some(t => t.name === 'green Dragon Pung'), 'already-completed pung remains valid');

  const offSuitMeld = meld('chow', 'character-1 character-2 character-3');
  const flush = hand('bamboo-1 bamboo-1 bamboo-2 bamboo-2 bamboo-3 bamboo-3 bamboo-4 bamboo-5 bamboo-6 bamboo-7 bamboo-8');
  const targets = teacher.evaluateHandTargets(flush, [offSuitMeld]);
  for (const impossible of ['Half Flush', 'Full Flush', 'All Pungs']) {
    assert.ok(!targets.some(t => t.name === impossible), 'committed chow blocks ' + impossible);
  }

  const duplicate = efficiency.countKnownTiles([...screenshotHand, ...twoVisible, twoVisible[0]]);
  assert.equal(duplicate.get('dragon-green'), 4, 'claimed/discarded tile instance counted once');

  const ctx = { hand: screenshotHand, melds: [], seatWind: 'east', roundWind: 'east', discards: twoVisible, wallRemaining: 60 };
  for (const difficulty of ['medium', 'hard']) {
    const choice = ai.selectDiscard(difficulty, ctx);
    assert.ok(screenshotHand.some(t => t.instanceId === choice.instanceId), difficulty + ' AI returns a legal discard');
  }

  console.log('Coach engine regression tests passed.');
} finally {
  await server.close();
}
