// Core tile types for Hong Kong Old Style Mahjong

export type Suit = 'bamboo' | 'character' | 'dot';
export type Honor = 'wind' | 'dragon';
export type TileCategory = Suit | Honor | 'flower' | 'season';

export type Wind = 'east' | 'south' | 'west' | 'north';
export type Dragon = 'red' | 'green' | 'white';

export interface TileDefinition {
  id: string;
  category: TileCategory;
  suit?: Suit;
  value?: number; // 1-9 for suited tiles
  wind?: Wind;
  dragon?: Dragon;
  flowerNumber?: number; // 1-4 for flowers/seasons
}

export interface Tile extends TileDefinition {
  instanceId: string; // Unique instance ID (4 copies of each tile)
}

// Tile creation helpers
export const WINDS: Wind[] = ['east', 'south', 'west', 'north'];
export const DRAGONS: Dragon[] = ['red', 'green', 'white'];
export const SUITS: Suit[] = ['bamboo', 'character', 'dot'];

export const windToNumber = (wind: Wind): number => WINDS.indexOf(wind) + 1;
export const numberToWind = (num: number): Wind => WINDS[num - 1];

export const isHonorTile = (tile: Tile): boolean => 
  tile.category === 'wind' || tile.category === 'dragon';

export const isTerminalTile = (tile: Tile): boolean =>
  tile.category !== 'wind' && 
  tile.category !== 'dragon' && 
  tile.category !== 'flower' && 
  tile.category !== 'season' &&
  (tile.value === 1 || tile.value === 9);

export const isSuitedTile = (tile: Tile): boolean =>
  tile.category === 'bamboo' || tile.category === 'character' || tile.category === 'dot';

export const tilesEqual = (a: Tile, b: Tile): boolean =>
  a.id === b.id;

export const tilesSameType = (a: Tile, b: Tile): boolean =>
  a.category === b.category &&
  a.suit === b.suit &&
  a.value === b.value &&
  a.wind === b.wind &&
  a.dragon === b.dragon;

export const getTileDisplayName = (tile: Tile): string => {
  if (tile.category === 'flower') return `Flower ${tile.flowerNumber}`;
  if (tile.category === 'season') return `Season ${tile.flowerNumber}`;
  if (tile.category === 'wind') return `${tile.wind} Wind`;
  if (tile.category === 'dragon') return `${tile.dragon} Dragon`;
  return `${tile.value} ${tile.suit}`;
};

export const getTileSortKey = (tile: Tile): string => {
  const categoryOrder = { bamboo: 0, character: 1, dot: 2, wind: 3, dragon: 4, flower: 5, season: 6 };
  const cat = categoryOrder[tile.category];
  const val = tile.value ?? (tile.wind ? WINDS.indexOf(tile.wind) : 
    (tile.dragon ? DRAGONS.indexOf(tile.dragon) : tile.flowerNumber ?? 0));
  return `${cat}-${String(val).padStart(2, '0')}`;
};

export const sortTiles = (tiles: Tile[]): Tile[] =>
  [...tiles].sort((a, b) => getTileSortKey(a).localeCompare(getTileSortKey(b)));

