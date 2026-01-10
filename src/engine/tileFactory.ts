import { Tile, Suit, SUITS, WINDS, DRAGONS, Wind, Dragon } from '../types/tile';

let instanceCounter = 0;

const createTileId = (category: string, ...parts: (string | number)[]): string => 
  [category, ...parts].join('-');

const createInstance = (definition: Omit<Tile, 'instanceId'>): Tile => ({
  ...definition,
  instanceId: `${definition.id}-${instanceCounter++}`,
});

// Create all suited tiles (bamboo, character, dot) - 4 of each
const createSuitedTiles = (suit: Suit): Tile[] => {
  const tiles: Tile[] = [];
  for (let value = 1; value <= 9; value++) {
    for (let i = 0; i < 4; i++) {
      tiles.push(createInstance({
        id: createTileId(suit, value),
        category: suit,
        suit,
        value,
      }));
    }
  }
  return tiles;
};

// Create wind tiles - 4 of each
const createWindTiles = (): Tile[] => {
  const tiles: Tile[] = [];
  for (const wind of WINDS) {
    for (let i = 0; i < 4; i++) {
      tiles.push(createInstance({
        id: createTileId('wind', wind),
        category: 'wind',
        wind,
      }));
    }
  }
  return tiles;
};

// Create dragon tiles - 4 of each
const createDragonTiles = (): Tile[] => {
  const tiles: Tile[] = [];
  for (const dragon of DRAGONS) {
    for (let i = 0; i < 4; i++) {
      tiles.push(createInstance({
        id: createTileId('dragon', dragon),
        category: 'dragon',
        dragon,
      }));
    }
  }
  return tiles;
};

// Create flower tiles - 1 of each (1-4)
const createFlowerTiles = (): Tile[] => {
  const tiles: Tile[] = [];
  for (let num = 1; num <= 4; num++) {
    tiles.push(createInstance({
      id: createTileId('flower', num),
      category: 'flower',
      flowerNumber: num,
    }));
  }
  return tiles;
};

// Create season tiles - 1 of each (1-4)
const createSeasonTiles = (): Tile[] => {
  const tiles: Tile[] = [];
  for (let num = 1; num <= 4; num++) {
    tiles.push(createInstance({
      id: createTileId('season', num),
      category: 'season',
      flowerNumber: num,
    }));
  }
  return tiles;
};

// Create full tile set (136 or 144 with flowers)
export const createTileSet = (includeFlowers: boolean = true): Tile[] => {
  instanceCounter = 0;
  const tiles: Tile[] = [];
  
  // Add all suited tiles (3 suits × 9 values × 4 copies = 108)
  for (const suit of SUITS) {
    tiles.push(...createSuitedTiles(suit));
  }
  
  // Add winds (4 types × 4 copies = 16)
  tiles.push(...createWindTiles());
  
  // Add dragons (3 types × 4 copies = 12)
  tiles.push(...createDragonTiles());
  
  // Optional flowers and seasons (8 total)
  if (includeFlowers) {
    tiles.push(...createFlowerTiles());
    tiles.push(...createSeasonTiles());
  }
  
  return tiles;
};

// Fisher-Yates shuffle
export const shuffleTiles = (tiles: Tile[]): Tile[] => {
  const shuffled = [...tiles];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

// Create a single tile by specification (for testing)
export const createTile = (
  category: Tile['category'],
  opts: { suit?: Suit; value?: number; wind?: Wind; dragon?: Dragon; flowerNumber?: number }
): Tile => {
  let id: string;
  if (category === 'flower' || category === 'season') {
    id = createTileId(category, opts.flowerNumber!);
  } else if (category === 'wind') {
    id = createTileId('wind', opts.wind!);
  } else if (category === 'dragon') {
    id = createTileId('dragon', opts.dragon!);
  } else {
    id = createTileId(category, opts.value!);
  }
  
  return createInstance({
    id,
    category,
    ...opts,
  });
};

