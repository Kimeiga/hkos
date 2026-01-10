import { Tile, isSuitedTile, isHonorTile, isTerminalTile, SUITS } from '../types/tile';
import { Meld, isTripletOrQuad, isChow } from '../types/meld';

// Check if tiles form a mixed flush (one suit + honors)
export const isMixedFlush = (tiles: Tile[]): boolean => {
  const playTiles = tiles.filter(t => t.category !== 'flower' && t.category !== 'season');
  const suits = new Set(playTiles.filter(isSuitedTile).map(t => t.suit));
  const hasHonors = playTiles.some(isHonorTile);
  return suits.size === 1 && hasHonors;
};

// Check if tiles form a pure flush (one suit only)
export const isPureFlush = (tiles: Tile[]): boolean => {
  const playTiles = tiles.filter(t => t.category !== 'flower' && t.category !== 'season');
  const suits = new Set(playTiles.filter(isSuitedTile).map(t => t.suit));
  const hasHonors = playTiles.some(isHonorTile);
  return suits.size === 1 && !hasHonors && playTiles.length > 0;
};

// Check if all melds are triplets/quads
export const isAllPungs = (melds: Meld[]): boolean => {
  const sets = melds.filter(m => m.type !== 'pair');
  return sets.length === 4 && sets.every(isTripletOrQuad);
};

// Check if all melds are sequences
export const isAllChows = (melds: Meld[]): boolean => {
  const sets = melds.filter(m => m.type !== 'pair');
  return sets.length === 4 && sets.every(isChow);
};

// Check for all terminals (only 1s and 9s)
export const isAllTerminals = (tiles: Tile[]): boolean => {
  const playTiles = tiles.filter(t => t.category !== 'flower' && t.category !== 'season');
  return playTiles.length > 0 && playTiles.every(isTerminalTile);
};

// Check for all honors
export const isAllHonors = (tiles: Tile[]): boolean => {
  const playTiles = tiles.filter(t => t.category !== 'flower' && t.category !== 'season');
  return playTiles.length > 0 && playTiles.every(isHonorTile);
};

// Check for mixed terminals (terminals + honors)
export const isMixedTerminals = (tiles: Tile[]): boolean => {
  const playTiles = tiles.filter(t => t.category !== 'flower' && t.category !== 'season');
  const allTerminalsOrHonors = playTiles.every(t => isTerminalTile(t) || isHonorTile(t));
  const hasTerminals = playTiles.some(isTerminalTile);
  const hasHonors = playTiles.some(isHonorTile);
  return allTerminalsOrHonors && hasTerminals && hasHonors;
};

// Calculate dominant suit (if any)
export const getDominantSuit = (tiles: Tile[]): string | null => {
  const counts: Record<string, number> = { bamboo: 0, character: 0, dot: 0 };
  
  for (const tile of tiles) {
    if (isSuitedTile(tile) && tile.suit) {
      counts[tile.suit]++;
    }
  }
  
  const max = Math.max(...Object.values(counts));
  if (max === 0) return null;
  
  for (const [suit, count] of Object.entries(counts)) {
    if (count === max && count >= 6) return suit;
  }
  
  return null;
};

// Calculate hand "shape" for pattern matching
export interface HandShape {
  suitDistribution: Record<string, number>;
  honorCount: number;
  terminalCount: number;
  pungCount: number;
  chowCount: number;
  pairCount: number;
}

export const analyzeHandShape = (tiles: Tile[], melds: Meld[]): HandShape => {
  const suitDistribution: Record<string, number> = { bamboo: 0, character: 0, dot: 0 };
  let honorCount = 0;
  let terminalCount = 0;
  
  for (const tile of tiles) {
    if (isSuitedTile(tile) && tile.suit) {
      suitDistribution[tile.suit]++;
      if (tile.value === 1 || tile.value === 9) terminalCount++;
    } else if (isHonorTile(tile)) {
      honorCount++;
    }
  }
  
  const pungCount = melds.filter(m => m.type === 'pung' || m.type === 'kong').length;
  const chowCount = melds.filter(m => m.type === 'chow').length;
  const pairCount = melds.filter(m => m.type === 'pair').length;
  
  return {
    suitDistribution,
    honorCount,
    terminalCount,
    pungCount,
    chowCount,
    pairCount,
  };
};

