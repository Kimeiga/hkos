/**
 * AI Engine for Mahjong
 */

import { Tile, isSuitedTile, tilesSameType, Wind } from '../types/tile';
import { Meld } from '../types/meld';
import { calculateShanten } from './shanten';
import { countTileTypes } from './handAnalysis';

export type AIDifficulty = 'easy' | 'medium' | 'hard';

export interface AIDecision {
  action: 'discard' | 'pong' | 'kong' | 'chow' | 'win' | 'pass';
  tile?: Tile;
  chowSet?: Tile[];
  reasoning?: string;
}

export interface AIContext {
  hand: Tile[];
  melds: Meld[];
  seatWind: Wind;
  roundWind: Wind;
  discards: Tile[];
  wallRemaining: number;
}

export const selectDiscard = (difficulty: AIDifficulty, context: AIContext): Tile => {
  switch (difficulty) {
    case 'easy': return selectDiscardEasy(context);
    case 'medium': return selectDiscardMedium(context);
    case 'hard': return selectDiscardHard(context);
    default: return selectDiscardEasy(context);
  }
};

export const shouldClaim = (
  difficulty: AIDifficulty,
  context: AIContext,
  discardedTile: Tile,
  options: { canWin: boolean; canPong: boolean; canKong: boolean; canChow: boolean; chowSets?: Tile[][] }
): AIDecision => {
  if (options.canWin) return { action: 'win', reasoning: 'Winning hand!' };
  switch (difficulty) {
    case 'easy': return shouldClaimEasy(context, discardedTile, options);
    case 'medium': return shouldClaimMedium(context, discardedTile, options);
    case 'hard': return shouldClaimHard(context, discardedTile, options);
    default: return { action: 'pass' };
  }
};

// EASY AI
const selectDiscardEasy = (context: AIContext): Tile => {
  const { hand } = context;
  const counts = countTileTypes(hand);
  const scored = hand.map(tile => {
    let score = 50;
    const count = counts.get(tile.id) || 1;
    if (count >= 2) score += 30;
    if (count >= 3) score += 50;
    if ((tile.category === 'wind' || tile.category === 'dragon') && count === 1) score -= 20;
    if (isSuitedTile(tile) && (tile.value === 1 || tile.value === 9) && count === 1) score -= 10;
    if (isSuitedTile(tile) && tile.value && tile.value >= 3 && tile.value <= 7) score += 15;
    score += Math.random() * 10;
    return { tile, score };
  });
  scored.sort((a, b) => a.score - b.score);
  return scored[0].tile;
};

const shouldClaimEasy = (
  _context: AIContext, discardedTile: Tile,
  options: { canPong: boolean; canKong: boolean; canChow: boolean }
): AIDecision => {
  if ((options.canPong || options.canKong) && 
      (discardedTile.category === 'dragon' || discardedTile.category === 'wind')) {
    return { action: options.canKong ? 'kong' : 'pong', reasoning: 'Claiming honor tile' };
  }
  return { action: 'pass', reasoning: 'Easy AI passes on most claims' };
};

// MEDIUM AI
const selectDiscardMedium = (context: AIContext): Tile => {
  const { hand, melds } = context;
  const evaluations = hand.map(tile => {
    const handAfterDiscard = hand.filter(t => t.instanceId !== tile.instanceId);
    const shanten = calculateShanten(handAfterDiscard, melds);
    const ukeire = calculateSimpleUkeire(handAfterDiscard, melds);
    return { tile, shanten, ukeire };
  });
  evaluations.sort((a, b) => {
    if (a.shanten !== b.shanten) return a.shanten - b.shanten;
    return b.ukeire - a.ukeire;
  });
  return evaluations[0].tile;
};

const calculateSimpleUkeire = (hand: Tile[], melds: Meld[]): number => {
  const currentShanten = calculateShanten(hand, melds);
  if (currentShanten <= -1) return 0;
  let improvingTypes = 0;
  const checked = new Set<string>();
  const suits = ['bamboo', 'character', 'dot'] as const;
  for (const suit of suits) {
    for (let value = 1; value <= 9; value++) {
      const id = `${suit}-${value}`;
      if (checked.has(id)) continue;
      checked.add(id);
      const mockTile: Tile = { id, instanceId: 'mock', category: suit, suit, value };
      const testHand = [...hand, mockTile];
      if (calculateShanten(testHand, melds) < currentShanten) improvingTypes++;
    }
  }
  return improvingTypes;
};

const shouldClaimMedium = (
  context: AIContext, discardedTile: Tile,
  options: { canPong: boolean; canKong: boolean; canChow: boolean; chowSets?: Tile[][] }
): AIDecision => {
  const { hand, melds } = context;
  const currentShanten = calculateShanten(hand, melds);
  if (options.canPong || options.canKong) {
    const matchingTiles = hand.filter(t => tilesSameType(t, discardedTile));
    const tilesForMeld = options.canKong ? matchingTiles.slice(0, 3) : matchingTiles.slice(0, 2);
    const handAfterPong = hand.filter(t => !tilesForMeld.some(m => m.instanceId === t.instanceId));
    const newMeld: Meld = { type: 'pung', tiles: [...tilesForMeld, discardedTile], isConcealed: false, baseTile: discardedTile };
    const newShanten = calculateShanten(handAfterPong, [...melds, newMeld]);
    if (newShanten < currentShanten) {
      return { action: options.canKong ? 'kong' : 'pong', reasoning: `Shanten ${currentShanten} -> ${newShanten}` };
    }
    if ((discardedTile.category === 'dragon' || discardedTile.category === 'wind') && currentShanten <= 2) {
      return { action: options.canKong ? 'kong' : 'pong', reasoning: 'Claiming valuable honor tile' };
    }
  }
  return { action: 'pass', reasoning: 'Claim would not improve hand significantly' };
};

// HARD AI - Advanced strategy with defensive play and tile counting
const selectDiscardHard = (context: AIContext): Tile => {
  const { hand, melds, discards, wallRemaining } = context;
  const evaluations = hand.map(tile => {
    const handAfterDiscard = hand.filter(t => t.instanceId !== tile.instanceId);
    const shanten = calculateShanten(handAfterDiscard, melds);
    const ukeire = calculateAdvancedUkeire(handAfterDiscard, melds, discards);
    const defensiveScore = calculateDefensiveScore(tile, discards);
    return { tile, shanten, ukeire, defensiveScore };
  });

  const isLateGame = wallRemaining < 30;
  evaluations.sort((a, b) => {
    if (a.shanten !== b.shanten) return a.shanten - b.shanten;
    const weightDefense = isLateGame ? 0.4 : 0.1;
    const scoreA = a.ukeire * (1 - weightDefense) + a.defensiveScore * weightDefense;
    const scoreB = b.ukeire * (1 - weightDefense) + b.defensiveScore * weightDefense;
    return scoreB - scoreA;
  });
  return evaluations[0].tile;
};

const calculateAdvancedUkeire = (hand: Tile[], melds: Meld[], discards: Tile[]): number => {
  const currentShanten = calculateShanten(hand, melds);
  if (currentShanten <= -1) return 0;
  const visibleCounts = countTileTypes([...hand, ...discards, ...melds.flatMap(m => m.tiles)]);
  let totalImprovingTiles = 0;
  const checked = new Set<string>();
  const suits = ['bamboo', 'character', 'dot'] as const;
  for (const suit of suits) {
    for (let value = 1; value <= 9; value++) {
      const id = `${suit}-${value}`;
      if (checked.has(id)) continue;
      checked.add(id);
      const mockTile: Tile = { id, instanceId: 'mock', category: suit, suit, value };
      const testHand = [...hand, mockTile];
      if (calculateShanten(testHand, melds) < currentShanten) {
        const visible = visibleCounts.get(id) || 0;
        totalImprovingTiles += Math.max(0, 4 - visible);
      }
    }
  }
  return totalImprovingTiles;
};

const calculateDefensiveScore = (tile: Tile, discards: Tile[]): number => {
  let score = 50;
  const sameTypeDiscarded = discards.filter(d => tilesSameType(d, tile)).length;
  score += sameTypeDiscarded * 25;
  if (tile.category === 'wind' || tile.category === 'dragon') score += 10;
  if (isSuitedTile(tile) && (tile.value === 1 || tile.value === 9)) score += 5;
  if (isSuitedTile(tile) && tile.value && tile.value >= 4 && tile.value <= 6) score -= 10;
  return score;
};

const shouldClaimHard = (
  context: AIContext, discardedTile: Tile,
  options: { canPong: boolean; canKong: boolean; canChow: boolean; chowSets?: Tile[][] }
): AIDecision => {
  const { hand, melds, wallRemaining } = context;
  const currentShanten = calculateShanten(hand, melds);

  if (options.canPong || options.canKong) {
    const matchingTiles = hand.filter(t => tilesSameType(t, discardedTile));
    const tilesForMeld = options.canKong ? matchingTiles.slice(0, 3) : matchingTiles.slice(0, 2);
    const handAfterPong = hand.filter(t => !tilesForMeld.some(m => m.instanceId === t.instanceId));
    const newMelds: Meld[] = [...melds, { type: 'pung', tiles: [...tilesForMeld, discardedTile], isConcealed: false, baseTile: discardedTile }];
    const newShanten = calculateShanten(handAfterPong, newMelds);

    // Claim to reach tenpai
    if (newShanten <= 0 && currentShanten > 0) {
      return { action: options.canKong ? 'kong' : 'pong', reasoning: 'Claiming to reach tenpai' };
    }
    // Claim if significant improvement and not too late
    if (newShanten < currentShanten && wallRemaining > 20) {
      return { action: options.canKong ? 'kong' : 'pong', reasoning: 'Significant shanten improvement' };
    }
    // Claim valuable honor tiles near tenpai
    if ((discardedTile.category === 'dragon' || discardedTile.category === 'wind') && currentShanten <= 1) {
      return { action: options.canKong ? 'kong' : 'pong', reasoning: 'Valuable honor tile near tenpai' };
    }
  }

  // Chow decisions - only chow to reach tenpai
  if (options.canChow && options.chowSets && options.chowSets.length > 0) {
    for (const chowSet of options.chowSets) {
      const handAfterChow = hand.filter(t => !chowSet.some(c => c.instanceId === t.instanceId));
      const newMelds: Meld[] = [...melds, { type: 'chow', tiles: [...chowSet, discardedTile], isConcealed: false, baseTile: chowSet[0] }];
      const newShanten = calculateShanten(handAfterChow, newMelds);
      if (newShanten <= 0 && currentShanten > 0) {
        return { action: 'chow', chowSet, reasoning: 'Chow to reach tenpai' };
      }
    }
  }

  return { action: 'pass', reasoning: 'Keeping hand closed for better scoring' };
};

