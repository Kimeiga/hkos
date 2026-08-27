import process from 'node:process';
import { chromium } from 'playwright';

const previewUrl = process.env.PREVIEW_URL;
if (!previewUrl) throw new Error('PREVIEW_URL is required');

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await context.newPage();

try {
  const url = new URL(previewUrl);
  url.searchParams.set('qa', '1');
  await page.goto(url.toString(), { waitUntil: 'networkidle', timeout: 45_000 });
  await page.waitForFunction(() => Boolean(window.__HKOS_QA_STORE__), null, { timeout: 15_000 });
  await page.waitForTimeout(1_200); // allow the normal initial deal timer to finish before replacing state

  const failures = await page.evaluate(() => {
    const store = window.__HKOS_QA_STORE__;
    const failures = [];
    const assert = (condition, message) => {
      if (!condition) failures.push(message);
    };

    const suited = (suit, value, instanceId) => ({
      id: `${suit}-${value}`,
      instanceId,
      category: suit,
      suit,
      value,
    });
    const dragon = (color, instanceId) => ({
      id: `dragon-${color}`,
      instanceId,
      category: 'dragon',
      dragon: color,
    });
    const player = (seat, isHuman) => ({
      seat,
      hand: [],
      melds: [],
      flowers: [],
      discards: [],
      score: 500,
      isHuman,
    });
    const players = () => ({
      east: player('east', true),
      south: player('south', false),
      west: player('west', false),
      north: player('north', false),
    });
    const reset = (overrides = {}) => {
      store.setState({
        phase: 'playing',
        players: players(),
        currentTurn: 'south',
        turnPhase: 'draw',
        wall: [],
        deadWall: [],
        lastDiscard: null,
        lastDiscardBy: null,
        claimOffer: null,
        selectedTile: null,
        teacherSuggestion: null,
        winner: null,
        winningTile: null,
        isSelfDraw: false,
        isAutoPlay: false,
        ...overrides,
      });
    };

    // Sort Hand must act on the visible human (East), never the legacy South seat.
    {
      const ps = players();
      const eastA = suited('character', 3, 'sort-east-a');
      const eastB = suited('bamboo', 1, 'sort-east-b');
      const southA = suited('dot', 8, 'sort-south-a');
      const southB = suited('bamboo', 2, 'sort-south-b');
      ps.east.hand = [eastA, eastB];
      ps.south.hand = [southA, southB];
      reset({ players: ps, currentTurn: 'east', turnPhase: 'discard' });
      store.getState().sortHand();
      const state = store.getState();
      assert(state.players.east.hand[0]?.instanceId === eastB.instanceId, 'Sort Hand did not sort East');
      assert(state.players.south.hand[0]?.instanceId === southA.instanceId, 'Sort Hand unexpectedly changed South');
    }

    // Pung: human claim routes to East and removes the source discard exactly once.
    {
      const ps = players();
      const discard = dragon('red', 'pung-discard');
      const a = dragon('red', 'pung-a');
      const b = dragon('red', 'pung-b');
      ps.east.hand = [a, b];
      ps.south.discards = [discard];
      reset({
        players: ps,
        currentTurn: 'south',
        lastDiscard: discard,
        lastDiscardBy: 'south',
        claimOffer: { tile: discard, fromPlayer: 'south', canWin: false, canPong: true, canKong: false, canChow: false },
      });
      store.getState().resolveClaim('pong');
      const state = store.getState();
      const meld = state.players.east.melds[0];
      assert(meld?.type === 'pung' && meld.tiles.some((tile) => tile.instanceId === discard.instanceId), 'Pung did not land in East melds');
      assert(!state.players.south.discards.some((tile) => tile.instanceId === discard.instanceId), 'Pung left claimed tile in source discard pile');
      assert(state.currentTurn === 'east' && state.turnPhase === 'discard', 'Pung did not transfer discard turn to East');
      assert(state.lastDiscard === null && state.claimOffer === null, 'Pung did not clear claim/discard state');
    }

    // Gong/Kong: consume three hand copies + discard, remove source discard, draw replacement, and keep East in discard phase.
    {
      const ps = players();
      const discard = suited('dot', 5, 'kong-discard');
      const a = suited('dot', 5, 'kong-a');
      const b = suited('dot', 5, 'kong-b');
      const c = suited('dot', 5, 'kong-c');
      const replacement = suited('character', 9, 'kong-replacement');
      ps.east.hand = [a, b, c];
      ps.south.discards = [discard];
      reset({
        players: ps,
        currentTurn: 'south',
        lastDiscard: discard,
        lastDiscardBy: 'south',
        deadWall: [replacement],
        claimOffer: { tile: discard, fromPlayer: 'south', canWin: false, canPong: true, canKong: true, canChow: false },
      });
      store.getState().resolveClaim('kong');
      const state = store.getState();
      const meld = state.players.east.melds[0];
      assert(meld?.type === 'kong' && meld.tiles.length === 4, 'Gong did not create a four-tile East meld');
      assert(meld?.claimedFrom === 'south' && meld?.isConcealed === false, 'Claimed Gong metadata is incorrect');
      assert(!state.players.south.discards.some((tile) => tile.instanceId === discard.instanceId), 'Gong left claimed tile in source discard pile');
      assert(state.players.east.hand.some((tile) => tile.instanceId === replacement.instanceId), 'Gong did not draw dead-wall replacement');
      assert(state.currentTurn === 'east' && state.turnPhase === 'discard', 'Gong did not leave East in discard phase');
      assert(state.lastDiscard === null && state.lastDiscardBy === null && state.claimOffer === null, 'Gong did not clear claim/discard state');
    }

    // Sheung/Chow: source discard moves into the meld and disappears from the river.
    {
      const ps = players();
      const one = suited('bamboo', 1, 'chow-one');
      const two = suited('bamboo', 2, 'chow-two');
      const discard = suited('bamboo', 3, 'chow-discard');
      ps.east.hand = [one, two];
      ps.north.discards = [discard];
      reset({
        players: ps,
        currentTurn: 'north',
        lastDiscard: discard,
        lastDiscardBy: 'north',
        claimOffer: { tile: discard, fromPlayer: 'north', canWin: false, canPong: false, canKong: false, canChow: true, chowSets: [[one, two]] },
      });
      store.getState().resolveClaim('chow', [one, two]);
      const state = store.getState();
      const meld = state.players.east.melds[0];
      assert(meld?.type === 'chow' && meld.tiles.some((tile) => tile.instanceId === discard.instanceId), 'Sheung did not land in East melds');
      assert(meld?.baseTile?.value === 1 && meld?.claimedFrom === 'north', 'Sheung meld metadata is incorrect');
      assert(!state.players.north.discards.some((tile) => tile.instanceId === discard.instanceId), 'Sheung left claimed tile in source discard pile');
      assert(state.currentTurn === 'east' && state.turnPhase === 'discard', 'Sheung did not transfer discard turn to East');
    }

    // Win: resolving a human win must identify East, not legacy South.
    {
      const ps = players();
      const discard = suited('character', 5, 'win-discard');
      ps.south.discards = [discard];
      reset({
        players: ps,
        currentTurn: 'south',
        lastDiscard: discard,
        lastDiscardBy: 'south',
        claimOffer: { tile: discard, fromPlayer: 'south', canWin: true, canPong: false, canKong: false, canChow: false },
      });
      store.getState().resolveClaim('win');
      const state = store.getState();
      assert(state.phase === 'finished' && state.winner === 'east', 'Human Win resolved to the wrong seat');
    }

    // Pass: clear the offer and advance from the discarder to the next seat.
    {
      const ps = players();
      const discard = suited('dot', 7, 'pass-discard');
      ps.south.discards = [discard];
      reset({
        players: ps,
        currentTurn: 'south',
        lastDiscard: discard,
        lastDiscardBy: 'south',
        claimOffer: { tile: discard, fromPlayer: 'south', canWin: false, canPong: true, canKong: false, canChow: false },
      });
      store.getState().resolveClaim('pass');
      const state = store.getState();
      assert(state.claimOffer === null, 'Pass did not clear claim offer');
      assert(state.currentTurn === 'west' && state.turnPhase === 'draw', 'Pass did not advance to the next seat');
    }

    return failures;
  });

  if (failures.length > 0) {
    console.error('\nClaim-state regression QA failed:');
    for (const failure of failures) console.error(`- ${failure}`);
    process.exitCode = 1;
  } else {
    console.log(`Claim-state regression QA passed for ${previewUrl}`);
  }
} finally {
  await context.close();
  await browser.close();
}

if (process.exitCode) process.exit(process.exitCode);
