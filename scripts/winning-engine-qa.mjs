import assert from 'node:assert/strict';
import { createServer } from 'vite';

const server = await createServer({
  configFile: false, logLevel: 'silent',
  server: { middlewareMode: true }, appType: 'custom',
});

try {
  const { evaluateWinningHand, enumerateStandardMelds } = await server.ssrLoadModule('/src/engine/winning.ts');
  const { isStandardWinningHand, canFormCompleteHand } = await server.ssrLoadModule('/src/engine/handAnalysis.ts');

  let counter = 0;
  const tile = (name) => {
    const [category, arg] = name.split('-');
    return {
      id: name, instanceId: 'win-' + counter++, category,
      ...(['bamboo','character','dot'].includes(category)
        ? { suit: category, value: Number(arg) }
        : category === 'wind' ? { wind: arg } : { dragon: arg }),
    };
  };
  const tiles = names => names.trim().split(/\s+/).map(tile);
  const context = (hand, winningTile, opts = {}) => ({
    hand, winningTile, melds: [], flowers: [],
    seatWind: 'east', roundWind: 'east',
    isSelfDraw: false, isLastTile: false,
    isReplacementTile: false, isRobbingKong: false,
    ...opts,
  });

  // Pair is the lowest tile by sort order, not the last group.
  const lowPair = tiles('bamboo-1 bamboo-1 bamboo-2 bamboo-3 bamboo-4 character-1 character-2 character-3 dot-1 dot-2 dot-3 dragon-red dragon-red dragon-red');
  assert.ok(isStandardWinningHand(lowPair, []), 'pair-first winning hand');
  assert.ok(canFormCompleteHand(lowPair, 4), 'pair-first meld extraction');
  assert.ok(enumerateStandardMelds(lowPair, []).length > 0, 'enumerator finds pair-first hand');

  // A structural win can still be below the configured 3-fan minimum.
  const lowFan = tiles('bamboo-1 bamboo-2 bamboo-3 dot-1 dot-2 dot-3 character-1 character-2 character-3 bamboo-5 bamboo-5 bamboo-5 wind-west wind-west');
  const losing = evaluateWinningHand(context(lowFan.slice(0, 13), lowFan[13]), 'south');
  assert.ok(losing, 'legal shape recognized');
  assert.equal(losing.totalFan, 2, 'no flowers and concealed are the only bonuses');
  assert.equal(losing.isValid, false, 'two fan cannot win on discard');
  const selfDraw = evaluateWinningHand(context(lowFan.slice(0, 13), lowFan[13], { isSelfDraw: true }));
  assert.equal(selfDraw.totalFan, 3, 'self-draw supplies one additional fan');
  assert.equal(selfDraw.isValid, true, 'self-drawn 3-fan hand may win');
  assert.deepEqual(selfDraw.finalPayment.payments, { east: 24, south: -8, west: -8, north: -8 }, 'self draw transfers from all three players');

  const greenPung = tiles('dragon-green dragon-green dragon-green bamboo-1 bamboo-2 bamboo-3 character-1 character-2 character-3 dot-1 dot-2 dot-3 wind-west wind-west');
  const scored = evaluateWinningHand(context(greenPung.slice(0, 2).concat(greenPung.slice(3)), greenPung[2]), 'south');
  assert.equal(scored?.totalFan, 3, 'dragon pung + no flowers + concealed hand');
  assert.deepEqual(scored?.finalPayment.payments, { east: 16, south: -16, west: 0, north: 0 }, 'discarder pays winner twice base points');
  assert.equal(Object.values(scored.finalPayment.payments).reduce((a,b) => a+b,0),0,'zero sum');

  const eastPung = tiles('wind-east wind-east wind-east bamboo-1 bamboo-2 bamboo-3 character-1 character-2 character-3 dot-1 dot-2 dot-3 wind-west wind-west');
  const eastScored = evaluateWinningHand(context(eastPung.slice(0,2).concat(eastPung.slice(3)), eastPung[2]), 'south');
  assert.ok(eastScored.fanBreakdown.some(f => f.name === 'Seat Wind'), 'seat wind counted');
  assert.ok(eastScored.fanBreakdown.some(f => f.name === 'Round Wind'), 'same pung can also match round wind');

  assert.equal(evaluateWinningHand(context(lowFan.slice(0, 11), lowFan[13]), 'south'), null, 'invalid tile count cannot win');

  const orphans = tiles('bamboo-1 bamboo-9 character-1 character-9 dot-1 dot-9 wind-east wind-south wind-west wind-north dragon-red dragon-green dragon-white bamboo-1');
  assert.equal(evaluateWinningHand(context(orphans.slice(0,-1), orphans.at(-1)), 'south')?.totalFan, 13, 'thirteen orphans limit hand');

  console.log('Winning and scoring engine regression tests passed.');
} finally {
  await server.close();
}
