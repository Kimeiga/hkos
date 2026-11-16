import { type Tile, isSuitedTile, isHonorTile, SUITS, DRAGONS, type Wind } from '../types/tile';
import type { Meld } from '../types/meld';
import type { TeacherSuggestion } from '../types/game';
import { calculateShanten } from './shanten';
import { calculateVisibleUkeire, countKnownTiles, unseenCopies, type KnownTileCounts } from './tileEfficiency';

// Kept as a public helper for callers that only need the acceptance total.
// The discard is part of "hand", so it must remain counted as an unavailable tile.
export const calculateUkeire = (
  hand: Tile[], melds: Meld[], discardTile: Tile, visibleTiles: Tile[] = []
): number => {
  const after = hand.filter(t => t.instanceId !== discardTile.instanceId);
  const known = countKnownTiles([...hand, ...melds.flatMap(m => m.tiles), ...visibleTiles]);
  return calculateVisibleUkeire(after, melds, known).copies;
};

export interface HandTarget {
  name: string;
  fanValue: number;
  probability: number; // Relative heuristic, not a calibrated win probability.
  requiredTiles: string[];
}

export const evaluateHandTargets = (
  hand: Tile[], melds: Meld[], knownCounts: KnownTileCounts = countKnownTiles([...hand, ...melds.flatMap(m => m.tiles)])
): HandTarget[] => {
  const targets: HandTarget[] = [];
  const exposedTiles = melds.flatMap(m => m.tiles);
  const allTiles = [...hand, ...exposedTiles];

  for (const suit of SUITS) {
    const suitTiles = allTiles.filter(t => t.suit === suit).length;
    const honorTiles = allTiles.filter(isHonorTile).length;
    const otherSuitTiles = allTiles.filter(t => isSuitedTile(t) && t.suit !== suit).length;
    // A committed meld cannot be discarded to complete a flush.
    const incompatibleMeld = exposedTiles.some(t => isSuitedTile(t) && t.suit !== suit);
    if (!incompatibleMeld && suitTiles + honorTiles >= 10 && otherSuitTiles <= 3) {
      targets.push({
        name: 'Half Flush', fanValue: 3,
        probability: Math.min(1, 0.5 + (suitTiles + honorTiles) / 28),
        requiredTiles: [`${suit} tiles`, 'honor tiles'],
      });
    }
    if (!incompatibleMeld && !exposedTiles.some(isHonorTile) && suitTiles >= 11 && otherSuitTiles <= 2) {
      targets.push({
        name: 'Full Flush', fanValue: 6,
        probability: Math.min(1, 0.3 + suitTiles / 26),
        requiredTiles: [`${suit} tiles only`],
      });
    }
  }

  const committedPungs = melds.filter(m => m.type === 'pung' || m.type === 'kong').length;
  // A pair with no possible third copy is a pair only, not potential pung material.
  const counts = new Map<string, number>();
  for (const tile of hand) counts.set(tile.id, (counts.get(tile.id) ?? 0) + 1);
  const viablePungGroups = [...counts].filter(([id, n]) => n >= 3 || (n >= 2 && unseenCopies(knownCounts, id) > 0)).length;
  if (!melds.some(m => m.type === 'chow') && committedPungs + viablePungGroups >= 3) {
    targets.push({
      name: 'All Pungs', fanValue: 3,
      probability: Math.min(1, 0.4 + committedPungs * 0.15),
      requiredTiles: ['triplets only'],
    });
  }

  for (const dragon of DRAGONS) {
    const id = `dragon-${dragon}`;
    const inHand = hand.filter(t => t.id === id).length;
    const alreadyDeclared = melds.some(m => (m.type === 'pung' || m.type === 'kong') && m.baseTile.id === id);
    const live = unseenCopies(knownCounts, id);
    // Two dragons can be completed only if another copy is still unseen.
    // Three in hand or a declared pung is already a valid scoring group.
    if (alreadyDeclared || inHand >= 3 || (inHand >= 2 && live > 0)) {
      targets.push({
        name: `${dragon} Dragon Pung`, fanValue: 1,
        probability: alreadyDeclared || inHand >= 3 ? 0.9 : 0.25 * live,
        requiredTiles: [`${dragon} dragon`],
      });
    }
  }

  return targets.sort((a, b) => b.fanValue * b.probability - a.fanValue * a.probability);
};

export const suggestDiscard = (
  hand: Tile[], melds: Meld[], _seatWind: Wind, _roundWind: Wind, visibleTiles: Tile[] = []
): TeacherSuggestion => {
  const playable = hand.filter(t => t.category !== 'flower' && t.category !== 'season');
  if (!playable.length) throw new Error('No tiles to discard');

  const known = countKnownTiles([...hand, ...melds.flatMap(m => m.tiles), ...visibleTiles]);
  const evaluated = playable.map(tile => {
    const after = hand.filter(t => t.instanceId !== tile.instanceId);
    const shanten = calculateShanten(after, melds);
    const ukeire = calculateVisibleUkeire(after, melds, known);
    const target = evaluateHandTargets(after, melds, known)[0];
    return {
      tile, shanten, ukeire: ukeire.copies,
      targetHand: target?.name ?? 'Basic Hand', fanPotential: target?.fanValue ?? 0,
    };
  });

  evaluated.sort((a, b) => {
    // A structural tenpai with zero possible winning tiles is a dead wait;
    // prefer paths that can actually improve with unseen tiles.
    const effectiveA = a.shanten + (a.ukeire === 0 ? 1 : 0);
    const effectiveB = b.shanten + (b.ukeire === 0 ? 1 : 0);
    if (effectiveA !== effectiveB) return effectiveA - effectiveB;
    if (a.ukeire !== b.ukeire) return b.ukeire - a.ukeire;
    if (a.shanten !== b.shanten) return a.shanten - b.shanten;
    return b.fanPotential - a.fanPotential;
  });

  const best = evaluated[0];
  return {
    recommendedTile: best.tile,
    reasoning: best.fanPotential > 0
      ? `Toward ${best.targetHand} (${best.fanPotential} fan). ${best.ukeire} unseen improving copies.`
      : `Toward a standard winning structure. ${best.ukeire} unseen improving copies.`,
    targetHand: best.targetHand,
    fanPotential: best.fanPotential,
    tilesNeeded: best.ukeire,
    alternativeMoves: evaluated.slice(1, 4).map(e => ({
      tile: e.tile,
      reasoning: `Shanten: ${e.shanten}, ${e.ukeire} unseen improving copies`,
      fanPotential: e.fanPotential,
      tilesNeeded: e.ukeire,
    })),
  };
};
