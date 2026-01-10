import { Tile, tilesSameType, sortTiles } from '../types/tile';
import { calculateShanten } from './shanten';
import { Meld } from '../types/meld';

/**
 * Check if a player can declare Pong (identical triplet) from a discarded tile.
 * Needs 2 matching tiles in hand.
 */
export const canPong = (hand: Tile[], tile: Tile): boolean => {
    const matching = hand.filter(t => tilesSameType(t, tile));
    return matching.length >= 2;
};

/**
 * Check if a player can declare Kong (identical quad) from a discarded tile.
 * Needs 3 matching tiles in hand.
 */
export const canKong = (hand: Tile[], tile: Tile): boolean => {
    const matching = hand.filter(t => tilesSameType(t, tile));
    return matching.length >= 3;
};

/**
 * Check if a player can declare Chow (sequence) from a discarded tile.
 * Returns an array of possible tile sets (tuples of 2 tiles from hand) that form a chow with the discard.
 * Only allowed if the player is the *next* player in turn order (handled by store logic).
 */
export const canChow = (hand: Tile[], tile: Tile): Tile[][] => {
    if (tile.category !== 'bamboo' && tile.category !== 'character' && tile.category !== 'dot') {
        return [];
    }
    if (!tile.value) return [];

    const possibleSets: Tile[][] = [];

    // Potential neighbors needed: (v-2, v-1), (v-1, v+1), (v+1, v+2)
    const v = tile.value;

    // Check for v-2, v-1
    if (v >= 3) {
        const m1 = hand.find(t => t.suit === tile.suit && t.value === v - 1);
        const m2 = hand.find(t => t.suit === tile.suit && t.value === v - 2);
        if (m1 && m2) possibleSets.push([m2, m1]);
    }

    // Check for v-1, v+1
    if (v >= 2 && v <= 8) {
        const m1 = hand.find(t => t.suit === tile.suit && t.value === v - 1);
        const m2 = hand.find(t => t.suit === tile.suit && t.value === v + 1);
        if (m1 && m2) possibleSets.push([m1, m2]);
    }

    // Check for v+1, v+2
    if (v <= 7) {
        const m1 = hand.find(t => t.suit === tile.suit && t.value === v + 1);
        const m2 = hand.find(t => t.suit === tile.suit && t.value === v + 2);
        if (m1 && m2) possibleSets.push([m1, m2]);
    }

    return possibleSets;
};

/**
 * Check if a player can Win from a discarded tile.
 * Combining hand + discard results in shanten -1 (complete hand).
 */
export const canWin = (hand: Tile[], melds: Meld[], tile: Tile): boolean => {
    // Shanten calculation expects a 14-tile hand (for checking ready state normally),
    // or checks if a completed hand (14 tiles) has shanten -1.
    // Here we simulate picking up the discard.
    const testHand = [...hand, tile];
    return calculateShanten(testHand, melds) === -1;
};
