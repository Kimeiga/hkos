export type MahjongCallKey = 'chow' | 'pung' | 'kong' | 'win';

export interface MahjongCallTerm {
  key: MahjongCallKey;
  primary: string;
  english: string;
  cantonese: {
    script: string;
    jyutping: string;
  };
  mandarin: {
    script: string;
    pinyin: string;
  };
  definition: string;
}

export const MAHJONG_CALL_TERMS: Record<MahjongCallKey, MahjongCallTerm> = {
  chow: {
    key: 'chow',
    primary: 'Sheung / Chow',
    english: 'Chow',
    cantonese: { script: '上', jyutping: 'soeng5' },
    mandarin: { script: '吃', pinyin: 'chī' },
    definition: 'Claim a discard to make a three-tile sequence in one suit. Only the next player in turn order can make this call.',
  },
  pung: {
    key: 'pung',
    primary: 'Pung',
    english: 'Pung',
    cantonese: { script: '碰', jyutping: 'pung3' },
    mandarin: { script: '碰', pinyin: 'pèng' },
    definition: 'Claim a discard to make three identical tiles.',
  },
  kong: {
    key: 'kong',
    primary: 'Gong / Kong',
    english: 'Kong',
    cantonese: { script: '槓', jyutping: 'gong3' },
    mandarin: { script: '杠', pinyin: 'gàng' },
    definition: 'Make four identical tiles, then draw a replacement tile.',
  },
  win: {
    key: 'win',
    primary: 'Sik / Win',
    english: 'Win',
    cantonese: { script: '食糊', jyutping: 'sik6 wu4' },
    mandarin: { script: '和牌', pinyin: 'hé pái' },
    definition: 'Declare that your hand is complete and satisfies the table’s winning requirements.',
  },
};

export const CORE_MAHJONG_CALLS: MahjongCallTerm[] = [
  MAHJONG_CALL_TERMS.chow,
  MAHJONG_CALL_TERMS.pung,
  MAHJONG_CALL_TERMS.kong,
  MAHJONG_CALL_TERMS.win,
];

export const mahjongCallSearchText = (term: MahjongCallTerm): string =>
  [
    term.primary,
    term.english,
    term.cantonese.script,
    term.cantonese.jyutping,
    term.mandarin.script,
    term.mandarin.pinyin,
    term.definition,
  ]
    .join(' ')
    .toLowerCase();
