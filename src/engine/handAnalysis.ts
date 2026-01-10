import { Tile, isSuitedTile, isHonorTile, tilesSameType, sortTiles, Suit, Wind, Dragon } from '../types/tile';
import { Meld } from '../types/meld';

// Group tiles by their type for analysis
export interface TileGroups {
  bamboo: Map<number, Tile[]>;
  character: Map<number, Tile[]>;
  dot: Map<number, Tile[]>;
  winds: Map<Wind, Tile[]>;
  dragons: Map<Dragon, Tile[]>;
}

export const groupTiles = (tiles: Tile[]): TileGroups => {
  const groups: TileGroups = {
    bamboo: new Map(),
    character: new Map(),
    dot: new Map(),
    winds: new Map(),
    dragons: new Map(),
  };

  for (const tile of tiles) {
    if (tile.category === 'bamboo' || tile.category === 'character' || tile.category === 'dot') {
      const map = groups[tile.category];
      const existing = map.get(tile.value!) || [];
      map.set(tile.value!, [...existing, tile]);
    } else if (tile.category === 'wind' && tile.wind) {
      const existing = groups.winds.get(tile.wind) || [];
      groups.winds.set(tile.wind, [...existing, tile]);
    } else if (tile.category === 'dragon' && tile.dragon) {
      const existing = groups.dragons.get(tile.dragon) || [];
      groups.dragons.set(tile.dragon, [...existing, tile]);
    }
  }

  return groups;
};

// Count tiles by id
export const countTileTypes = (tiles: Tile[]): Map<string, number> => {
  const counts = new Map<string, number>();
  for (const tile of tiles) {
    counts.set(tile.id, (counts.get(tile.id) || 0) + 1);
  }
  return counts;
};

// Check if tiles can form a valid chow (sequence)
export const canFormChow = (tiles: Tile[]): boolean => {
  if (tiles.length !== 3) return false;
  if (!tiles.every(t => isSuitedTile(t))) return false;
  if (!tiles.every(t => t.suit === tiles[0].suit)) return false;
  
  const values = tiles.map(t => t.value!).sort((a, b) => a - b);
  return values[1] === values[0] + 1 && values[2] === values[1] + 1;
};

// Check if tiles can form a pung (triplet)
export const canFormPung = (tiles: Tile[]): boolean => {
  if (tiles.length !== 3) return false;
  return tiles.every(t => tilesSameType(t, tiles[0]));
};

// Check if tiles can form a kong (quad)
export const canFormKong = (tiles: Tile[]): boolean => {
  if (tiles.length !== 4) return false;
  return tiles.every(t => tilesSameType(t, tiles[0]));
};

// Check if tiles can form a pair
export const canFormPair = (tiles: Tile[]): boolean => {
  if (tiles.length !== 2) return false;
  return tilesSameType(tiles[0], tiles[1]);
};

// Find all possible melds from a set of tiles
export interface PossibleMeld {
  type: 'chow' | 'pung' | 'kong' | 'pair';
  tiles: Tile[];
  baseTile: Tile;
}

export const findPossibleMelds = (tiles: Tile[]): PossibleMeld[] => {
  const melds: PossibleMeld[] = [];
  const groups = groupTiles(tiles);
  const sorted = sortTiles(tiles);

  // Find pairs, pungs, and kongs from same tiles
  const countById = countTileTypes(tiles);
  for (const [id, count] of countById) {
    const tilesOfType = tiles.filter(t => t.id === id);
    if (count >= 2) {
      melds.push({ type: 'pair', tiles: tilesOfType.slice(0, 2), baseTile: tilesOfType[0] });
    }
    if (count >= 3) {
      melds.push({ type: 'pung', tiles: tilesOfType.slice(0, 3), baseTile: tilesOfType[0] });
    }
    if (count >= 4) {
      melds.push({ type: 'kong', tiles: tilesOfType.slice(0, 4), baseTile: tilesOfType[0] });
    }
  }

  // Find chows for each suit
  for (const suit of ['bamboo', 'character', 'dot'] as Suit[]) {
    const suitMap = groups[suit];
    for (let start = 1; start <= 7; start++) {
      const t1 = suitMap.get(start)?.[0];
      const t2 = suitMap.get(start + 1)?.[0];
      const t3 = suitMap.get(start + 2)?.[0];
      if (t1 && t2 && t3) {
        melds.push({ type: 'chow', tiles: [t1, t2, t3], baseTile: t1 });
      }
    }
  }

  return melds;
};

// Check if hand is complete (4 melds + 1 pair)
export const isStandardWinningHand = (tiles: Tile[], melds: Meld[]): boolean => {
  const totalMelds = melds.filter(m => m.type !== 'pair').length;
  const tilesInHand = tiles.length;
  
  // Already have 4 melds exposed, just need a pair in hand
  if (totalMelds === 4 && tilesInHand === 2) {
    return canFormPair(tiles);
  }
  
  // Need to check if remaining tiles can form melds + pair
  return canFormCompleteHand(tiles, 4 - totalMelds);
};

// Recursive function to check if tiles can form N melds plus a pair
export const canFormCompleteHand = (tiles: Tile[], meldsNeeded: number): boolean => {
  if (tiles.length === 0 && meldsNeeded === 0) return false; // Need pair
  if (tiles.length === 2 && meldsNeeded === 0) return canFormPair(tiles);
  if (tiles.length < 2) return false;
  if (meldsNeeded < 0) return false;
  
  const sorted = sortTiles(tiles);
  const first = sorted[0];
  
  // Try to form a pung with first tile
  const sameType = sorted.filter(t => tilesSameType(t, first));
  if (sameType.length >= 3) {
    const remaining = [...sorted];
    for (let i = 0; i < 3; i++) {
      const idx = remaining.findIndex(t => tilesSameType(t, first));
      remaining.splice(idx, 1);
    }
    if (canFormCompleteHand(remaining, meldsNeeded - 1)) return true;
  }
  
  // Try to form a chow with first tile (if suited)
  if (isSuitedTile(first) && first.value! <= 7) {
    const t2 = sorted.find(t => t.suit === first.suit && t.value === first.value! + 1);
    const t3 = sorted.find(t => t.suit === first.suit && t.value === first.value! + 2);
    if (t2 && t3) {
      const remaining = [...sorted];
      const removeOne = (target: Tile) => {
        const idx = remaining.findIndex(t => t.instanceId === target.instanceId);
        if (idx >= 0) remaining.splice(idx, 1);
      };
      removeOne(first);
      removeOne(t2);
      removeOne(t3);
      if (canFormCompleteHand(remaining, meldsNeeded - 1)) return true;
    }
  }
  
  return false;
};

