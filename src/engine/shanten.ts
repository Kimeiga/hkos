import { Tile, isSuitedTile, tilesSameType, sortTiles, Suit, SUITS } from '../types/tile';
import { Meld } from '../types/meld';
import { countTileTypes, groupTiles } from './handAnalysis';

// Shanten = number of tiles away from tenpai (ready to win)
// -1 = winning hand, 0 = tenpai, 1+ = tiles needed

// Calculate shanten for standard 4 melds + 1 pair hand
export const calculateStandardShanten = (tiles: Tile[]): number => {
  if (tiles.length === 0) return 8; // Maximum shanten
  
  const sorted = sortTiles(tiles.filter(t => 
    t.category !== 'flower' && t.category !== 'season'
  ));
  
  let minShanten = 8;
  
  // Try each tile as the pair
  const counts = countTileTypes(sorted);
  const processed = new Set<string>();
  
  for (const [id, count] of counts) {
    if (count >= 2 && !processed.has(id)) {
      processed.add(id);
      const remaining = [...sorted];
      // Remove pair
      let removed = 0;
      for (let i = remaining.length - 1; i >= 0 && removed < 2; i--) {
        if (remaining[i].id === id) {
          remaining.splice(i, 1);
          removed++;
        }
      }
      const shanten = calculateMeldsShanten(remaining, 4) - 1;
      minShanten = Math.min(minShanten, shanten);
    }
  }
  
  // Also try without a designated pair
  const noPairShanten = calculateMeldsShanten(sorted, 4);
  minShanten = Math.min(minShanten, noPairShanten);
  
  return minShanten;
};

// Calculate how many melds can be formed and the shanten
const calculateMeldsShanten = (tiles: Tile[], meldsNeeded: number): number => {
  if (tiles.length === 0) return meldsNeeded * 2;
  if (meldsNeeded === 0) return 0;
  
  let maxMelds = 0;
  let maxPartials = 0; // Partial melds (2 tiles that could become 3)
  
  // Recursive search for best meld extraction
  const search = (remaining: Tile[], melds: number, partials: number): void => {
    if (remaining.length === 0) {
      if (melds > maxMelds || (melds === maxMelds && partials > maxPartials)) {
        maxMelds = melds;
        maxPartials = partials;
      }
      return;
    }
    
    const first = remaining[0];
    const rest = remaining.slice(1);
    
    // Try to form a pung
    const sameType = remaining.filter(t => tilesSameType(t, first));
    if (sameType.length >= 3) {
      const afterPung = [...remaining];
      let removed = 0;
      for (let i = afterPung.length - 1; i >= 0 && removed < 3; i--) {
        if (tilesSameType(afterPung[i], first)) {
          afterPung.splice(i, 1);
          removed++;
        }
      }
      search(afterPung, melds + 1, partials);
    }
    
    // Try to form a chow (sequence)
    if (isSuitedTile(first) && first.value! <= 7) {
      const t2 = remaining.find(t => t.suit === first.suit && t.value === first.value! + 1);
      const t3 = remaining.find(t => t.suit === first.suit && t.value === first.value! + 2);
      if (t2 && t3) {
        const afterChow = [...remaining];
        const removeOne = (target: Tile) => {
          const idx = afterChow.findIndex(t => t.instanceId === target.instanceId);
          if (idx >= 0) afterChow.splice(idx, 1);
        };
        removeOne(first);
        removeOne(t2);
        removeOne(t3);
        search(afterChow, melds + 1, partials);
      }
    }
    
    // Try partial melds (pair that could become pung)
    if (sameType.length >= 2) {
      const afterPartial = [...remaining];
      let removed = 0;
      for (let i = afterPartial.length - 1; i >= 0 && removed < 2; i--) {
        if (tilesSameType(afterPartial[i], first)) {
          afterPartial.splice(i, 1);
          removed++;
        }
      }
      search(afterPartial, melds, partials + 1);
    }
    
    // Try partial chow (2 consecutive)
    if (isSuitedTile(first) && first.value! <= 8) {
      const t2 = remaining.find(t => t.suit === first.suit && t.value === first.value! + 1);
      if (t2) {
        const afterPartial = [...remaining];
        const idx1 = afterPartial.findIndex(t => t.instanceId === first.instanceId);
        afterPartial.splice(idx1, 1);
        const idx2 = afterPartial.findIndex(t => t.instanceId === t2.instanceId);
        afterPartial.splice(idx2, 1);
        search(afterPartial, melds, partials + 1);
      }
    }
    
    // Skip this tile
    search(rest, melds, partials);
  };
  
  search(tiles, 0, 0);
  
  // Shanten = (melds needed - melds found) * 2 - partials
  // But partials can only reduce shanten by 1 each, up to melds needed
  const effectivePartials = Math.min(maxPartials, meldsNeeded - maxMelds);
  return (meldsNeeded - maxMelds) * 2 - effectivePartials;
};

// Calculate shanten for seven pairs
export const calculateSevenPairsShanten = (tiles: Tile[]): number => {
  const playTiles = tiles.filter(t => 
    t.category !== 'flower' && t.category !== 'season'
  );
  if (playTiles.length !== 13 && playTiles.length !== 14) return 8;
  
  const counts = countTileTypes(playTiles);
  let pairs = 0;
  let singles = 0;
  
  for (const count of counts.values()) {
    pairs += Math.floor(count / 2);
    if (count % 2 === 1) singles++;
  }
  
  // Need 7 pairs, shanten = 6 - pairs + singles/2
  return 6 - pairs + Math.ceil(singles / 2);
};

// Get overall minimum shanten
export const calculateShanten = (hand: Tile[], melds: Meld[]): number => {
  const exposedMeldCount = melds.filter(m => !m.isConcealed && m.type !== 'pair').length;
  const tilesInHand = hand.filter(t => 
    t.category !== 'flower' && t.category !== 'season'
  );
  
  // If we have exposed melds, we can't do seven pairs
  const standardShanten = calculateStandardShanten(tilesInHand) - exposedMeldCount;
  
  if (exposedMeldCount === 0) {
    const sevenPairsShanten = calculateSevenPairsShanten(tilesInHand);
    return Math.min(standardShanten, sevenPairsShanten);
  }
  
  return standardShanten;
};

