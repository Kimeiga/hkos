import { Tile } from './tile';

export type MeldType = 'chow' | 'pung' | 'kong' | 'pair';

export interface Meld {
  type: MeldType;
  tiles: Tile[];
  isConcealed: boolean;
  // For chows: the lowest tile value
  // For pungs/kongs: the tile value
  baseTile: Tile;
  // If this meld was formed from a discard
  claimedFrom?: 'east' | 'south' | 'west' | 'north';
}

export const isChow = (meld: Meld): boolean => meld.type === 'chow';
export const isPung = (meld: Meld): boolean => meld.type === 'pung';
export const isKong = (meld: Meld): boolean => meld.type === 'kong';
export const isPair = (meld: Meld): boolean => meld.type === 'pair';

export const isTripletOrQuad = (meld: Meld): boolean => 
  meld.type === 'pung' || meld.type === 'kong';

export const getMeldDisplayName = (meld: Meld): string => {
  const concealed = meld.isConcealed ? 'Concealed ' : 'Melded ';
  return `${concealed}${meld.type.charAt(0).toUpperCase() + meld.type.slice(1)}`;
};

