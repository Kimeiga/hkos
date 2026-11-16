import { type Tile, SUITS, WINDS, DRAGONS } from '../types/tile';
import type { Meld } from '../types/meld';
import { calculateShanten } from './shanten';

// One representative of every non-flower tile type; nothing in the game has a fifth copy.
export const TILE_TYPES: Tile[] = [
  ...SUITS.flatMap(suit => Array.from({ length: 9 }, (_, n) => ({
    id: `${suit}-${n + 1}`, instanceId: `simulation-${suit}-${n + 1}`,
    category: suit, suit, value: n + 1,
  }))),
  ...WINDS.map(wind => ({ id: `wind-${wind}`, instanceId: `simulation-wind-${wind}`, category: 'wind' as const, wind })),
  ...DRAGONS.map(dragon => ({ id: `dragon-${dragon}`, instanceId: `simulation-dragon-${dragon}`, category: 'dragon' as const, dragon })),
];

export type KnownTileCounts = Map<string, number>;

// Only the viewer's hand, their melds and publicly visible table tiles belong
// here. Never pass opponents' concealed hands or wall/dead-wall contents.
export const countKnownTiles = (tiles: Tile[]): KnownTileCounts => {
  const counts = new Map<string, number>();
  const seenInstances = new Set<string>();
  for (const tile of tiles) {
    if (tile.category === 'flower' || tile.category === 'season' || seenInstances.has(tile.instanceId)) continue;
    seenInstances.add(tile.instanceId);
    counts.set(tile.id, (counts.get(tile.id) ?? 0) + 1);
  }
  return counts;
};

export const unseenCopies = (knownCounts: KnownTileCounts, tileId: string): number =>
  Math.max(0, 4 - (knownCounts.get(tileId) ?? 0));

export interface Ukeire { copies: number; kinds: number }

// Ukeire counts unseen copies of draws that reduce structural shanten. This is
// an upper bound on draws from the wall: unseen tiles may be concealed elsewhere.
export const calculateVisibleUkeire = (
  handAfterDiscard: Tile[], melds: Meld[], knownCounts: KnownTileCounts
): Ukeire => {
  const before = calculateShanten(handAfterDiscard, melds);
  if (before < 0) return { copies: 0, kinds: 0 };
  let copies = 0;
  let kinds = 0;
  for (const tile of TILE_TYPES) {
    const remaining = unseenCopies(knownCounts, tile.id);
    if (remaining === 0) continue;
    if (calculateShanten([...handAfterDiscard, tile], melds) < before) {
      copies += remaining;
      kinds++;
    }
  }
  return { copies, kinds };
};
