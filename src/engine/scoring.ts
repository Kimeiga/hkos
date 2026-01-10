import { Tile, Wind, isSuitedTile, isHonorTile, isTerminalTile, tilesSameType, DRAGONS, WINDS } from '../types/tile';
import { Meld, isPung, isKong, isChow, isTripletOrQuad } from '../types/meld';
import { FanScore, WinResult, PaymentResult, MIN_FAN, LIMIT_FAN } from '../types/game';
import { groupTiles, canFormPair, countTileTypes } from './handAnalysis';

export interface ScoringContext {
  hand: Tile[];           // Tiles in hand
  melds: Meld[];          // Exposed melds
  flowers: Tile[];        // Collected flowers
  winningTile: Tile;      // The tile that completes the hand
  seatWind: Wind;         // Player's seat wind
  roundWind: Wind;        // Prevalent wind for round
  isSelfDraw: boolean;    // Won by self-draw
  isLastTile: boolean;    // Won on last tile of wall
  isReplacementTile: boolean;  // Won after kong
  isRobbingKong: boolean; // Won by robbing kong
}

// Fan to points conversion table (from scoring_2.md)
const FAN_TO_POINTS: Record<number, number> = {
  0: 1, 1: 2, 2: 4, 3: 8, 4: 16, 5: 24, 6: 32,
  7: 48, 8: 64, 9: 96, 10: 128, 11: 192, 12: 256, 13: 384
};

export const fanToPoints = (fan: number): number => {
  if (fan >= LIMIT_FAN) return FAN_TO_POINTS[13];
  return FAN_TO_POINTS[Math.min(fan, 13)] || FAN_TO_POINTS[13];
};

// Get all tiles including those in melds
const getAllTiles = (ctx: ScoringContext): Tile[] => {
  const meldTiles = ctx.melds.flatMap(m => m.tiles);
  return [...ctx.hand, ...meldTiles, ctx.winningTile];
};

// Check if hand contains only tiles of one suit plus honors
const isMixedFlush = (tiles: Tile[]): boolean => {
  const playTiles = tiles.filter(t => t.category !== 'flower' && t.category !== 'season');
  const suits = new Set(playTiles.filter(isSuitedTile).map(t => t.suit));
  const hasHonors = playTiles.some(isHonorTile);
  return suits.size === 1 && hasHonors;
};

// Check if hand contains only tiles of one suit (no honors)
const isPureFlush = (tiles: Tile[]): boolean => {
  const playTiles = tiles.filter(t => t.category !== 'flower' && t.category !== 'season');
  const suits = new Set(playTiles.filter(isSuitedTile).map(t => t.suit));
  const hasHonors = playTiles.some(isHonorTile);
  return suits.size === 1 && !hasHonors;
};

// Check if all melds are pungs/kongs (no chows)
const isAllPungs = (melds: Meld[]): boolean => {
  const sets = melds.filter(m => m.type !== 'pair');
  return sets.length === 4 && sets.every(isTripletOrQuad);
};

// Check if all melds are chows
const isAllChows = (melds: Meld[]): boolean => {
  const sets = melds.filter(m => m.type !== 'pair');
  return sets.length === 4 && sets.every(isChow);
};

// Check for seven pairs
const isSevenPairs = (ctx: ScoringContext): boolean => {
  const allTiles = [...ctx.hand, ctx.winningTile];
  if (allTiles.length !== 14 || ctx.melds.length > 0) return false;
  
  const counts = countTileTypes(allTiles);
  return [...counts.values()].every(c => c === 2) && counts.size === 7;
};

// Check for pure straight (123 456 789 in same suit)
const hasPureStraight = (melds: Meld[]): boolean => {
  const chows = melds.filter(isChow);
  if (chows.length < 3) return false;
  
  for (const suit of ['bamboo', 'character', 'dot']) {
    const suitChows = chows.filter(m => m.baseTile.suit === suit);
    const starts = suitChows.map(m => m.baseTile.value!);
    if (starts.includes(1) && starts.includes(4) && starts.includes(7)) {
      return true;
    }
  }
  return false;
};

// Check for small three dragons
const isSmallThreeDragons = (melds: Meld[]): boolean => {
  const dragonPungs = melds.filter(m => 
    isTripletOrQuad(m) && m.baseTile.category === 'dragon'
  );
  const dragonPair = melds.find(m => 
    m.type === 'pair' && m.baseTile.category === 'dragon'
  );
  return dragonPungs.length === 2 && !!dragonPair;
};

// Check for big three dragons
const isBigThreeDragons = (melds: Meld[]): boolean => {
  const dragonPungs = melds.filter(m => 
    isTripletOrQuad(m) && m.baseTile.category === 'dragon'
  );
  return dragonPungs.length === 3;
};

// Check for small four winds
const isSmallFourWinds = (melds: Meld[]): boolean => {
  const windPungs = melds.filter(m => 
    isTripletOrQuad(m) && m.baseTile.category === 'wind'
  );
  const windPair = melds.find(m => 
    m.type === 'pair' && m.baseTile.category === 'wind'
  );
  return windPungs.length === 3 && !!windPair;
};

// Check for big four winds (limit hand)
const isBigFourWinds = (melds: Meld[]): boolean => {
  const windPungs = melds.filter(m => 
    isTripletOrQuad(m) && m.baseTile.category === 'wind'
  );
  return windPungs.length === 4;
};

// Check for all honors
const isAllHonors = (tiles: Tile[]): boolean => {
  const playTiles = tiles.filter(t => t.category !== 'flower' && t.category !== 'season');
  return playTiles.every(isHonorTile);
};

// Check for all terminals
const isAllTerminals = (tiles: Tile[]): boolean => {
  const playTiles = tiles.filter(t => t.category !== 'flower' && t.category !== 'season');
  return playTiles.every(isTerminalTile);
};

// Check for thirteen orphans
const isThirteenOrphans = (ctx: ScoringContext): boolean => {
  const allTiles = [...ctx.hand, ctx.winningTile];
  if (allTiles.length !== 14 || ctx.melds.length > 0) return false;
  
  const required = [
    'bamboo-1', 'bamboo-9', 'character-1', 'character-9', 'dot-1', 'dot-9',
    'wind-east', 'wind-south', 'wind-west', 'wind-north',
    'dragon-red', 'dragon-green', 'dragon-white'
  ];
  
  const counts = countTileTypes(allTiles);
  let hasPair = false;
  
  for (const id of required) {
    const count = counts.get(id) || 0;
    if (count === 0) return false;
    if (count === 2) hasPair = true;
  }
  
  return hasPair && counts.size === 13;
};

// Main scoring function
export const calculateFan = (ctx: ScoringContext, completeMelds: Meld[]): FanScore[] => {
  const scores: FanScore[] = [];
  const allTiles = getAllTiles(ctx);

  // === LIMIT HANDS (13+ fan) ===
  if (isThirteenOrphans(ctx)) {
    scores.push({ name: 'Thirteen Orphans', fan: 13, description: 'All terminals and honors with one pair' });
    return scores;
  }
  if (isBigFourWinds(completeMelds)) {
    scores.push({ name: 'Big Four Winds', fan: 13, description: 'Pungs of all four winds' });
    return scores;
  }
  if (isAllTerminals(allTiles)) {
    scores.push({ name: 'All Terminals', fan: 13, description: 'Only 1s and 9s' });
    return scores;
  }

  // === HIGH VALUE HANDS ===
  if (isAllHonors(allTiles)) {
    scores.push({ name: 'All Honors', fan: 10, description: 'Only honor tiles' });
    return scores;
  }
  if (isBigThreeDragons(completeMelds)) {
    scores.push({ name: 'Big Three Dragons', fan: 8, description: 'Pungs of all three dragons' });
  } else if (isSmallThreeDragons(completeMelds)) {
    scores.push({ name: 'Small Three Dragons', fan: 5, description: 'Two dragon pungs and dragon pair' });
  }
  if (isSmallFourWinds(completeMelds)) {
    scores.push({ name: 'Small Four Winds', fan: 6, description: 'Three wind pungs and wind pair' });
  }
  if (isPureFlush(allTiles)) {
    scores.push({ name: 'Pure Flush', fan: 7, description: 'Only one suit, no honors' });
  } else if (isMixedFlush(allTiles)) {
    scores.push({ name: 'Mixed Flush', fan: 3, description: 'One suit plus honors' });
  }

  // === 3 FAN HANDS ===
  if (isAllPungs(completeMelds)) {
    scores.push({ name: 'All Pungs', fan: 3, description: 'Four triplets/quads' });
  }
  if (isSevenPairs(ctx)) {
    scores.push({ name: 'Seven Pairs', fan: 3, description: 'Seven pairs of tiles' });
  }
  if (hasPureStraight(completeMelds)) {
    scores.push({ name: 'Pure Straight', fan: 3, description: '1-9 sequence in one suit' });
  }

  // === 1 FAN ELEMENTS ===
  if (isAllChows(completeMelds) && !scores.some(s => s.fan >= 3)) {
    const pair = completeMelds.find(m => m.type === 'pair');
    if (pair && isSuitedTile(pair.baseTile)) {
      scores.push({ name: 'All Chows', fan: 1, description: 'Only sequences' });
    }
  }

  // Dragon pungs (if not already counted in three dragons)
  if (!scores.some(s => s.name.includes('Dragon'))) {
    for (const meld of completeMelds) {
      if (isTripletOrQuad(meld) && meld.baseTile.category === 'dragon') {
        scores.push({ name: `${meld.baseTile.dragon} Dragon Pung`, fan: 1, description: 'Dragon triplet' });
      }
    }
  }

  // Seat wind pung
  const seatWindPung = completeMelds.find(m =>
    isTripletOrQuad(m) && m.baseTile.category === 'wind' && m.baseTile.wind === ctx.seatWind
  );
  if (seatWindPung && !scores.some(s => s.name.includes('Winds'))) {
    scores.push({ name: 'Seat Wind', fan: 1, description: `Pung of ${ctx.seatWind} wind` });
  }

  // Round wind pung
  const roundWindPung = completeMelds.find(m =>
    isTripletOrQuad(m) && m.baseTile.category === 'wind' && m.baseTile.wind === ctx.roundWind
  );
  if (roundWindPung && ctx.seatWind !== ctx.roundWind && !scores.some(s => s.name.includes('Winds'))) {
    scores.push({ name: 'Round Wind', fan: 1, description: `Pung of ${ctx.roundWind} wind` });
  }

  // Flowers
  const seatNumber = WINDS.indexOf(ctx.seatWind) + 1;
  const matchingFlowers = ctx.flowers.filter(f => f.flowerNumber === seatNumber);
  for (const flower of matchingFlowers) {
    const type = flower.category === 'flower' ? 'Flower' : 'Season';
    scores.push({ name: `Seat ${type}`, fan: 1, description: `${type} matches seat` });
  }
  if (ctx.flowers.length === 0) {
    scores.push({ name: 'No Flowers', fan: 1, description: 'No flowers or seasons' });
  }

  // Winning conditions
  if (ctx.isSelfDraw) {
    scores.push({ name: 'Self Draw', fan: 1, description: 'Won by drawing tile' });
  }
  if (ctx.isLastTile) {
    scores.push({ name: 'Last Tile', fan: 1, description: 'Won on last tile' });
  }
  if (ctx.isReplacementTile) {
    scores.push({ name: 'After Kong', fan: 1, description: 'Won after declaring kong' });
  }
  if (ctx.isRobbingKong) {
    scores.push({ name: 'Robbing Kong', fan: 1, description: 'Won by robbing kong' });
  }

  // Concealed hand bonus
  if (ctx.melds.every(m => m.isConcealed) && !ctx.isSelfDraw) {
    scores.push({ name: 'Concealed Hand', fan: 1, description: 'All concealed, won by discard' });
  }

  return scores;
};

// Calculate total result
export const calculateWinResult = (ctx: ScoringContext, completeMelds: Meld[]): WinResult => {
  const fanBreakdown = calculateFan(ctx, completeMelds);
  const totalFan = fanBreakdown.reduce((sum, f) => sum + f.fan, 0);
  const meetsMinimum = totalFan >= MIN_FAN;
  const basePoints = fanToPoints(totalFan);

  const payments = calculatePayments(ctx.seatWind, ctx.isSelfDraw, basePoints, ctx.roundWind);

  return {
    isValid: meetsMinimum,
    totalFan,
    meetsMinimum,
    fanBreakdown,
    basePoints,
    finalPayment: payments,
  };
};

// Calculate who pays whom
const calculatePayments = (
  winner: Wind,
  isSelfDraw: boolean,
  points: number,
  roundWind: Wind
): PaymentResult => {
  const payments: Record<Wind, number> = { east: 0, south: 0, west: 0, north: 0 };

  if (isSelfDraw) {
    // All others pay the winner
    for (const w of WINDS) {
      if (w === winner) {
        payments[w] = points * 3;  // Winner receives
      } else {
        payments[w] = -points;     // Others pay
      }
    }
  } else {
    // This is called with discarder info elsewhere
    // Default: winner gets points (actual discarder payment handled in game logic)
    payments[winner] = points * 2;
  }

  return { payments };
};

