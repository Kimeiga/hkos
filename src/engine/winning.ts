import { type Tile, type Wind, sortTiles, isSuitedTile } from '../types/tile';
import type { Meld } from '../types/meld';
import type { WinResult } from '../types/game';
import { calculateWinResult, type ScoringContext } from './scoring';

// A structural hand may have multiple decompositions. Score every legal
// decomposition rather than assuming the first one is best.
export const enumerateStandardMelds = (hand: Tile[], declared: Meld[]): Meld[][] => {
  const existing = declared.filter(m => m.type !== 'pair');
  const needed = 4 - existing.length;
  if (needed < 0 || hand.length !== needed * 3 + 2) return [];
  const results: Meld[][] = [];
  const sorted = sortTiles(hand);

  const take = (source: Tile[], pieces: Tile[]): Tile[] => {
    const ids = new Set(pieces.map(t => t.instanceId));
    return source.filter(t => !ids.has(t.instanceId));
  };

  const visit = (remaining: Tile[], melds: Meld[]): void => {
    if (melds.length === needed) {
      if (remaining.length === 0) results.push([...existing, ...melds]);
      return;
    }
    if (remaining.length !== (needed - melds.length) * 3) return;
    const first = remaining[0];
    if (!first) return;
    const identical = remaining.filter(t => t.id === first.id);
    if (identical.length >= 3) {
      const tiles = identical.slice(0, 3);
      visit(take(remaining, tiles), [...melds, {
        type: 'pung', tiles, baseTile: tiles[0], isConcealed: true,
      }]);
    }
    if (isSuitedTile(first) && first.value! <= 7) {
      const second = remaining.find(t => t.suit === first.suit && t.value === first.value! + 1);
      const third = remaining.find(t => t.suit === first.suit && t.value === first.value! + 2);
      if (second && third) {
        const tiles = [first, second, third];
        visit(take(remaining, tiles), [...melds, {
          type: 'chow', tiles, baseTile: first, isConcealed: true,
        }]);
      }
    }
  };

  const pairIds = new Set<string>();
  for (const tile of sorted) {
    if (pairIds.has(tile.id)) continue;
    pairIds.add(tile.id);
    const pair = sorted.filter(t => t.id === tile.id).slice(0, 2);
    if (pair.length !== 2) continue;
    const pairMeld: Meld = { type: 'pair', tiles: pair, baseTile: pair[0], isConcealed: true };
    const before = results.length;
    visit(take(sorted, pair), []);
    for (let i = before; i < results.length; i++) results[i] = [...results[i], pairMeld];
  }
  return results;
};

const isSevenDistinctPairs = (tiles: Tile[]): boolean => {
  if (tiles.length !== 14) return false;
  const counts = new Map<string, number>();
  for (const tile of tiles) counts.set(tile.id, (counts.get(tile.id) ?? 0) + 1);
  return counts.size === 7 && [...counts.values()].every(n => n === 2);
};

const ORPHANS = new Set([
  'bamboo-1', 'bamboo-9', 'character-1', 'character-9', 'dot-1', 'dot-9',
  'wind-east', 'wind-south', 'wind-west', 'wind-north',
  'dragon-red', 'dragon-green', 'dragon-white',
]);
const isThirteenOrphans = (tiles: Tile[]): boolean => {
  if (tiles.length !== 14) return false;
  const counts = new Map<string, number>();
  for (const tile of tiles) counts.set(tile.id, (counts.get(tile.id) ?? 0) + 1);
  return counts.size === 13 &&
    [...counts.keys()].every(id => ORPHANS.has(id)) &&
    [...counts.values()].filter(n => n === 2).length === 1;
};

// ctx.hand contains the *other* concealed tiles, not ctx.winningTile.
// Return null for structurally invalid hands; isValid=false for hands that
// have a legal shape but fail the configured minimum-fan requirement.
export const evaluateWinningHand = (ctx: ScoringContext, discarder: Wind | null = null): WinResult | null => {
  const allTiles = [...ctx.hand, ctx.winningTile];
  const declaredCount = ctx.melds.filter(m => m.type !== 'pair').length;
  if (allTiles.length !== 14 - 3 * declaredCount) return null;

  const options = enumerateStandardMelds(allTiles, ctx.melds);
  if (declaredCount === 0 && (isSevenDistinctPairs(allTiles) || isThirteenOrphans(allTiles))) {
    options.push([]);
  }
  if (!options.length) return null;

  const scored = options.map(melds => calculateWinResult(ctx, melds, discarder));
  return scored.reduce((best, result) => result.totalFan > best.totalFan ? result : best);
};
