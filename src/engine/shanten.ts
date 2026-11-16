import { type Tile, SUITS, WINDS, DRAGONS } from '../types/tile';
import type { Meld } from '../types/meld';

// Counts for the 34 ordinary tile types (flowers/seasons are not part of a hand).
// 0-26: bamboo, characters, dots; 27-30: winds; 31-33: dragons.
const tileIndex = (tile: Tile): number => {
  if (tile.suit && tile.value && tile.value >= 1 && tile.value <= 9) {
    const suit = SUITS.indexOf(tile.suit);
    if (suit >= 0) return suit * 9 + tile.value - 1;
  }
  if (tile.category === 'wind') return 27 + WINDS.indexOf(tile.wind!);
  if (tile.category === 'dragon') return 31 + DRAGONS.indexOf(tile.dragon!);
  return -1;
};

const toCounts = (tiles: Tile[]): number[] => {
  const counts = Array<number>(34).fill(0);
  for (const tile of tiles) {
    const index = tileIndex(tile);
    if (index >= 0) counts[index]++;
  }
  return counts;
};

// Standard four-meld-and-a-pair shanten. A declared meld already counts as one
// complete set; never subtract its count from a hand that has already shrunk.
const standardFromCounts = (counts: number[], declaredMelds: number): number => {
  let best = 8;
  const visit = (start: number, melds: number, taatsu: number, pair: number): void => {
    if (melds > 4) return;
    let index = start;
    while (index < 34 && counts[index] === 0) index++;
    if (index === 34) {
      // Extra incomplete groups cannot occupy more slots than the remaining melds.
      best = Math.min(best, 8 - 2 * melds - Math.min(taatsu, 4 - melds) - pair);
      return;
    }

    const available = counts[index];
    const suited = index < 27;
    const rank = index % 9;
    if (melds < 4) {
      if (available >= 3) {
        counts[index] -= 3;
        visit(index, melds + 1, taatsu, pair);
        counts[index] += 3;
      }
      if (suited && rank <= 6 && counts[index + 1] && counts[index + 2]) {
        counts[index]--;
        counts[index + 1]--;
        counts[index + 2]--;
        visit(index, melds + 1, taatsu, pair);
        counts[index]++;
        counts[index + 1]++;
        counts[index + 2]++;
      }
    }
    if (available >= 2) {
      counts[index] -= 2;
      if (!pair) visit(index, melds, taatsu, 1);
      if (melds + taatsu < 4) visit(index, melds, taatsu + 1, pair);
      counts[index] += 2;
    }
    if (suited && melds + taatsu < 4) {
      for (const gap of [1, 2]) {
        if (rank + gap <= 8 && counts[index + gap]) {
          counts[index]--;
          counts[index + gap]--;
          visit(index, melds, taatsu + 1, pair);
          counts[index]++;
          counts[index + gap]++;
        }
      }
    }
    counts[index]--;
    visit(index, melds, taatsu, pair);
    counts[index]++;
  };
  visit(0, declaredMelds, 0, 0);
  return best;
};

export const calculateStandardShanten = (tiles: Tile[], declaredMelds = 0): number =>
  standardFromCounts(toCounts(tiles), declaredMelds);

// HKOS tables differ on this optional special hand; HKOS's own rulebook
// explicitly lists seven *distinct* pairs, so a quad is not two pairs.
export const calculateSevenPairsShanten = (tiles: Tile[]): number => {
  const counts = toCounts(tiles);
  const tileCount = counts.reduce((sum, n) => sum + n, 0);
  if (tileCount !== 13 && tileCount !== 14) return 8;
  const pairs = counts.filter(n => n >= 2).length;
  const distinct = counts.filter(n => n > 0).length;
  return 6 - pairs + Math.max(0, 7 - distinct);
};

const ORPHAN_INDICES = [0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32, 33];

export const calculateThirteenOrphansShanten = (tiles: Tile[]): number => {
  const counts = toCounts(tiles);
  const tileCount = counts.reduce((sum, n) => sum + n, 0);
  if (tileCount !== 13 && tileCount !== 14) return 13;
  const kinds = ORPHAN_INDICES.filter(i => counts[i] > 0).length;
  const pair = ORPHAN_INDICES.some(i => counts[i] >= 2) ? 1 : 0;
  return 13 - kinds - pair;
};

export const calculateShanten = (hand: Tile[], melds: Meld[]): number => {
  // All declared pungs, chows and kongs occupy one meld, concealed or not.
  const declaredMelds = melds.filter(m => m.type !== 'pair').length;
  const standard = calculateStandardShanten(hand, declaredMelds);
  if (declaredMelds > 0) return standard;
  return Math.min(standard, calculateSevenPairsShanten(hand), calculateThirteenOrphansShanten(hand));
};
