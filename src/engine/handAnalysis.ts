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

// Check an exact four-sets-and-a-pair hand, including already declared sets.
export const isStandardWinningHand = (tiles: Tile[], melds: Meld[]): boolean => {
  const declared = melds.filter(m => m.type !== 'pair').length;
  return canFormCompleteHand(tiles, 4 - declared);
};

// Pair selection must not depend on tile sort order. In particular the pair
// can come *before* all four sets, not just after the final set.
export const canFormCompleteHand = (tiles: Tile[], meldsNeeded: number): boolean => {
  if (meldsNeeded < 0 || tiles.length !== meldsNeeded * 3 + 2) return false;
  const sorted = sortTiles(tiles);

  const take = (from: Tile[], selected: Tile[]): Tile[] => {
    const ids = new Set(selected.map(t => t.instanceId));
    return from.filter(t => !ids.has(t.instanceId));
  };

  const sets = (remaining: Tile[], needed: number): boolean => {
    if (needed === 0) return remaining.length === 0;
    if (remaining.length !== needed * 3) return false;
    const first = remaining[0];
    const same = remaining.filter(t => tilesSameType(t, first));
    if (same.length >= 3 && sets(take(remaining, same.slice(0, 3)), needed - 1)) return true;
    if (isSuitedTile(first) && first.value! <= 7) {
      const second = remaining.find(t => t.suit === first.suit && t.value === first.value! + 1);
      const third = remaining.find(t => t.suit === first.suit && t.value === first.value! + 2);
      if (second && third && sets(take(remaining, [first, second, third]), needed - 1)) return true;
    }
    return false;
  };

  const seen = new Set<string>();
  for (const tile of sorted) {
    if (seen.has(tile.id)) continue;
    seen.add(tile.id);
    const pair = sorted.filter(t => tilesSameType(t, tile)).slice(0, 2);
    if (pair.length === 2 && sets(take(sorted, pair), meldsNeeded)) return true;
  }
  return false;
};
