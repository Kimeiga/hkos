import { Tile, isSuitedTile, isHonorTile, tilesSameType, sortTiles, SUITS, DRAGONS, WINDS, Wind } from '../types/tile';
import { Meld } from '../types/meld';
import { TeacherSuggestion, AlternativeMove } from '../types/game';
import { calculateShanten } from './shanten';
import { groupTiles, countTileTypes } from './handAnalysis';
import { isMixedFlush, isPureFlush, isAllPungs } from './handPatterns';

// Calculate ukeire (tile acceptance) - how many tiles can improve the hand
export const calculateUkeire = (hand: Tile[], melds: Meld[], discardTile: Tile): number => {
  const handAfterDiscard = hand.filter(t => t.instanceId !== discardTile.instanceId);
  const currentShanten = calculateShanten(handAfterDiscard, melds);
  
  if (currentShanten <= -1) return 0; // Already won
  
  let improvingTiles = 0;
  
  // Check all possible tile types
  const allTileTypes = getAllPossibleTileIds();
  
  for (const tileId of allTileTypes) {
    // Create a mock tile of this type
    const mockTile = createMockTile(tileId);
    if (!mockTile) continue;
    
    const testHand = [...handAfterDiscard, mockTile];
    const newShanten = calculateShanten(testHand, melds);
    
    if (newShanten < currentShanten) {
      // This tile type improves the hand
      // Count how many copies could still be available (simplified - assume 4 max)
      improvingTiles += 4;
    }
  }
  
  return improvingTiles;
};

// Evaluate potential hand targets after discarding a tile
export interface HandTarget {
  name: string;
  fanValue: number;
  probability: number;
  requiredTiles: string[];
}

export const evaluateHandTargets = (hand: Tile[], melds: Meld[]): HandTarget[] => {
  const targets: HandTarget[] = [];
  const allTiles = [...hand, ...melds.flatMap(m => m.tiles)];
  
  // Check Mixed Flush potential
  for (const suit of SUITS) {
    const suitTiles = allTiles.filter(t => t.suit === suit);
    const honorTiles = allTiles.filter(isHonorTile);
    const otherSuitTiles = allTiles.filter(t => isSuitedTile(t) && t.suit !== suit);
    
    if (suitTiles.length + honorTiles.length >= 10 && otherSuitTiles.length <= 3) {
      targets.push({
        name: 'Mixed Flush',
        fanValue: 3,
        probability: 0.5 + (suitTiles.length + honorTiles.length) / 28,
        requiredTiles: [`${suit} tiles`, 'honor tiles'],
      });
    }
  }
  
  // Check Pure Flush potential
  for (const suit of SUITS) {
    const suitTiles = allTiles.filter(t => t.suit === suit);
    const nonSuitTiles = allTiles.filter(t => isSuitedTile(t) && t.suit !== suit);
    
    if (suitTiles.length >= 11 && nonSuitTiles.length <= 2) {
      targets.push({
        name: 'Pure Flush',
        fanValue: 7,
        probability: 0.3 + suitTiles.length / 26,
        requiredTiles: [`${suit} tiles only`],
      });
    }
  }
  
  // Check All Pungs potential
  const pungCount = melds.filter(m => m.type === 'pung' || m.type === 'kong').length;
  const pairs = countPairs(hand);
  
  if (pungCount + pairs >= 3) {
    targets.push({
      name: 'All Pungs',
      fanValue: 3,
      probability: 0.4 + pungCount * 0.15,
      requiredTiles: ['triplets only'],
    });
  }
  
  // Check dragon pungs
  for (const dragon of DRAGONS) {
    const dragonTiles = hand.filter(t => t.dragon === dragon);
    if (dragonTiles.length >= 2) {
      targets.push({
        name: `${dragon} Dragon Pung`,
        fanValue: 1,
        probability: dragonTiles.length >= 3 ? 0.9 : 0.5,
        requiredTiles: [`${dragon} dragon`],
      });
    }
  }
  
  return targets.sort((a, b) => b.fanValue * b.probability - a.fanValue * a.probability);
};

// Main teacher function - suggest the best discard
export const suggestDiscard = (
  hand: Tile[],
  melds: Meld[],
  seatWind: Wind,
  roundWind: Wind
): TeacherSuggestion => {
  const playableTiles = hand.filter(t => 
    t.category !== 'flower' && t.category !== 'season'
  );
  
  if (playableTiles.length === 0) {
    throw new Error('No tiles to discard');
  }
  
  const evaluations: {
    tile: Tile;
    shanten: number;
    ukeire: number;
    targetHand: string;
    fanPotential: number;
  }[] = [];
  
  for (const tile of playableTiles) {
    const handAfterDiscard = hand.filter(t => t.instanceId !== tile.instanceId);
    const shanten = calculateShanten(handAfterDiscard, melds);
    const ukeire = calculateUkeire(hand, melds, tile);
    const targets = evaluateHandTargets(handAfterDiscard, melds);
    const bestTarget = targets[0];
    
    evaluations.push({
      tile,
      shanten,
      ukeire,
      targetHand: bestTarget?.name || 'Basic Hand',
      fanPotential: bestTarget?.fanValue || 1,
    });
  }
  
  // Sort by: lowest shanten, then highest ukeire, then highest fan potential
  evaluations.sort((a, b) => {
    if (a.shanten !== b.shanten) return a.shanten - b.shanten;
    if (a.ukeire !== b.ukeire) return b.ukeire - a.ukeire;
    return b.fanPotential - a.fanPotential;
  });
  
  const best = evaluations[0];
  const alternatives = evaluations.slice(1, 4).map(e => ({
    tile: e.tile,
    reasoning: `Shanten: ${e.shanten}, ${e.ukeire} improving tiles`,
    fanPotential: e.fanPotential,
    tilesNeeded: e.ukeire,
  }));
  
  return {
    recommendedTile: best.tile,
    reasoning: `Moves toward ${best.targetHand} (${best.fanPotential} fan). ${best.ukeire} tiles can improve.`,
    targetHand: best.targetHand,
    fanPotential: best.fanPotential,
    tilesNeeded: best.ukeire,
    alternativeMoves: alternatives,
  };
};

// Helper functions
const countPairs = (tiles: Tile[]): number => {
  const counts = countTileTypes(tiles);
  return [...counts.values()].filter(c => c >= 2).length;
};

const getAllPossibleTileIds = (): string[] => {
  const ids: string[] = [];
  for (const suit of SUITS) {
    for (let v = 1; v <= 9; v++) {
      ids.push(`${suit}-${v}`);
    }
  }
  for (const w of WINDS) ids.push(`wind-${w}`);
  for (const d of DRAGONS) ids.push(`dragon-${d}`);
  return ids;
};

const createMockTile = (id: string): Tile | null => {
  const parts = id.split('-');
  if (SUITS.includes(parts[0] as any)) {
    return {
      id, instanceId: 'mock', category: parts[0] as any,
      suit: parts[0] as any, value: parseInt(parts[1])
    };
  }
  if (parts[0] === 'wind') {
    return { id, instanceId: 'mock', category: 'wind', wind: parts[1] as any };
  }
  if (parts[0] === 'dragon') {
    return { id, instanceId: 'mock', category: 'dragon', dragon: parts[1] as any };
  }
  return null;
};

