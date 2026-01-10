import { create } from 'zustand';
import {
  GameState, GamePhase, Player, PlayerAction, TeacherSuggestion,
  INITIAL_SCORE, WinResult
} from '../types/game';
import { Tile, Wind, WINDS, sortTiles } from '../types/tile';
import { Meld } from '../types/meld';
import { createTileSet, shuffleTiles } from '../engine/tileFactory';
import { suggestDiscard } from '../engine/teacher';
import { calculateShanten } from '../engine/shanten';
import { canPong, canKong, canChow, canWin } from '../engine/rules';
import { tilesSameType } from '../types/tile';

interface GameStore extends GameState {
  // UI state
  selectedTile: Tile | null;
  teacherSuggestion: TeacherSuggestion | null;
  showTeacher: boolean;
  animatingTile: Tile | null;
  animationTarget: 'discard' | 'draw' | null;
  claimOffer: {
    tile: Tile;
    fromPlayer: Wind;
    canPong: boolean;
    canKong: boolean;
    canChow: boolean;
    canWin: boolean;
    chowSets?: Tile[][];
  } | null;

  // Actions
  initGame: () => void;
  dealTiles: () => void;
  drawTile: (player: Wind) => Tile | null;
  discardTile: (player: Wind, tile: Tile) => void;
  selectTile: (tile: Tile | null) => void;
  declarePong: (player: Wind, fromPlayer: Wind) => void;
  declareKong: (player: Wind, tiles: Tile[]) => void;
  declareChow: (player: Wind, tiles: Tile[]) => void;
  declareWin: (player: Wind) => WinResult | null;
  resolveClaim: (action: 'pass' | 'pong' | 'kong' | 'chow' | 'win', data?: any) => void; // New action for human UI
  sortHand: () => void;
  passTurn: () => void;
  nextTurn: () => void;
  updateTeacherSuggestion: () => void;
  toggleTeacher: () => void;
  setAnimatingTile: (tile: Tile | null, target: 'discard' | 'draw' | null) => void;

  // AI actions
  playAITurn: () => Promise<void>;
  checkClaims: (tile: Tile, fromPlayer: Wind) => Promise<boolean>; // Returns true if claimed
}

// Human is East (dealer) - the most common setup in Mahjong trainers
const HUMAN_SEAT: Wind = 'east';

const createInitialPlayers = (): Record<Wind, Player> => ({
  east: { seat: 'east', hand: [], melds: [], flowers: [], discards: [], score: INITIAL_SCORE, isHuman: true },
  south: { seat: 'south', hand: [], melds: [], flowers: [], discards: [], score: INITIAL_SCORE, isHuman: false },
  west: { seat: 'west', hand: [], melds: [], flowers: [], discards: [], score: INITIAL_SCORE, isHuman: false },
  north: { seat: 'north', hand: [], melds: [], flowers: [], discards: [], score: INITIAL_SCORE, isHuman: false },
});

export const useGameStore = create<GameStore>((set, get) => ({
  // Initial state
  phase: 'waiting',
  roundWind: 'east',
  dealerSeat: 'east',
  players: createInitialPlayers(),
  currentTurn: 'east',
  turnPhase: 'draw',
  wall: [],
  deadWall: [],
  lastDiscard: null,
  lastDiscardBy: null,
  roundNumber: 1,
  handNumber: 1,
  pendingActions: [],
  winner: null,
  winningTile: null,
  isSelfDraw: false,

  // UI state
  selectedTile: null,
  teacherSuggestion: null,
  showTeacher: true,
  animatingTile: null,
  animationTarget: null,
  claimOffer: null,

  initGame: () => {
    console.log('[Game] Initializing...');
    const tiles = createTileSet(true);
    const shuffled = shuffleTiles(tiles);

    // Separate dead wall (14 tiles for kong replacements)
    const deadWall = shuffled.slice(0, 14);
    const wall = shuffled.slice(14);

    set({
      phase: 'dealing',
      wall,
      deadWall,
      players: createInitialPlayers(),
      roundWind: 'east',
      currentTurn: 'east', // Dealer starts
      dealerSeat: 'east',
      roundNumber: 1,
      handNumber: 1,
      winner: null,
      winningTile: null,
      lastDiscard: null,
      lastDiscardBy: null,
    });

    // Auto-deal after init
    setTimeout(() => get().dealTiles(), 500);
  },

  dealTiles: () => {
    console.log('[Game] Dealing tiles...');
    const state = get();
    const wall = [...state.wall];
    const players = { ...state.players };

    // Deal 13 tiles to each player (dealer gets 14)
    const dealOrder: Wind[] = ['east', 'south', 'west', 'north'];

    for (const seat of dealOrder) {
      const hand: Tile[] = [];
      const flowers: Tile[] = [];
      const tileCount = seat === 'east' ? 14 : 13;

      while (hand.length < tileCount && wall.length > 0) {
        const tile = wall.pop()!;

        // Handle flowers/seasons - collect and draw replacement
        if (tile.category === 'flower' || tile.category === 'season') {
          flowers.push(tile);
          continue; // Will draw another
        }

        hand.push(tile);
      }

      players[seat] = {
        ...players[seat],
        hand: sortTiles(hand),
        flowers,
      };
    }

    set({
      players,
      wall,
      phase: 'playing',
      currentTurn: 'east',
      turnPhase: 'east' === state.dealerSeat ? 'discard' : 'draw',
    });

    console.log('[Game] Dealt complete. Current Turn:', 'east', 'Phase:', 'east' === state.dealerSeat ? 'discard' : 'draw');
    get().updateTeacherSuggestion();

    // If starting player (Dealer/East) is AI, trigger their turn
    // Otherwise, human player is ready to discard (they already have 14 tiles as dealer)
    const dealerPlayer = players['east'];
    if (!dealerPlayer.isHuman) {
      console.log('[Game] Triggering AI Dealer turn...');
      setTimeout(() => get().playAITurn(), 800);
    } else {
      console.log('[Game] Human is dealer - ready to discard.');
    }
  },

  sortHand: () => {
    console.log('[Game] Sorting hand...');
    const state = get();
    const players = { ...state.players };
    players.south.hand = sortTiles(players.south.hand);
    set({ players });
  },

  drawTile: (player: Wind) => {
    const state = get();
    if (state.wall.length === 0) {
      console.log('[Game] Wall empty, game finished.');
      set({ phase: 'finished' });
      return null;
    }

    console.log(`[Game] ${player} drawing tile...`);
    const wall = [...state.wall];
    let tile = wall.pop()!;
    const players = { ...state.players };

    // Handle flowers - collect and draw replacement
    while ((tile.category === 'flower' || tile.category === 'season') && wall.length > 0) {
      console.log(`[Game] ${player} drew flower:`, tile);
      players[player] = {
        ...players[player],
        flowers: [...players[player].flowers, tile],
      };
      tile = wall.pop()!;
    }

    // Append tile to hand (do not sort automatically)
    // Only sort for AI players to keep their logic simple, but for human (South), append.
    if (players[player].isHuman) {
      players[player] = {
        ...players[player],
        hand: [...players[player].hand, tile],
      };
    } else {
      players[player] = {
        ...players[player],
        hand: sortTiles([...players[player].hand, tile]),
      };
    }

    set({
      wall,
      players,
      turnPhase: 'discard',
      animatingTile: tile,
      animationTarget: 'draw',
    });

    console.log(`[Game] ${player} drew:`, tile.value ? `${tile.category}-${tile.value}` : tile.category);

    // Clear animation after delay
    setTimeout(() => set({ animatingTile: null, animationTarget: null }), 300);

    get().updateTeacherSuggestion();
    return tile;
  },

  discardTile: (player: Wind, tile: Tile) => {
    console.log(`[Game] ${player} discarding:`, tile.value ? `${tile.category}-${tile.value}` : tile.category);
    const state = get();
    const players = { ...state.players };

    players[player] = {
      ...players[player],
      hand: players[player].hand.filter(t => t.instanceId !== tile.instanceId),
      discards: [...players[player].discards, tile],
    };

    // Sort hand after discard for AI (Human might want to keep it unsorted, but usually gaps close. 
    // Standard Mahjong games close the gap. Array filter does this automatically.
    // We won't re-sort strictly, just filter preserves order.)

    set({
      players,
      lastDiscard: tile,
      lastDiscardBy: player,
      turnPhase: 'draw',
      animatingTile: tile,
      animationTarget: 'discard',
      selectedTile: null,
    });

    // Capture current discard for comparison
    const discardInstanceId = tile.instanceId;

    // Animate discard, then check for claims
    setTimeout(async () => {
      set({ animatingTile: null, animationTarget: null });

      // Guard: Only proceed if this is still the current discard we're processing
      const currentState = get();
      if (currentState.lastDiscard?.instanceId !== discardInstanceId) {
        console.log('[Game] Stale discard check, skipping nextTurn.');
        return;
      }

      console.log(`[Game] Checking claims for discard by ${player}...`);
      const claimed = await get().checkClaims(tile, player);
      if (!claimed) {
        // Double-check we're still on the same discard
        const finalState = get();
        if (finalState.lastDiscard?.instanceId !== discardInstanceId) {
          console.log('[Game] Stale after claim check, skipping nextTurn.');
          return;
        }
        console.log('[Game] No claims, proceeding to next turn.');
        get().nextTurn();
      } else {
        console.log('[Game] Claim processed or offered.');
      }
    }, 400);
  },

  selectTile: (tile: Tile | null) => set({ selectedTile: tile }),

  declarePong: (player: Wind, fromPlayer: Wind) => {
    console.log(`[Game] ${player} declaring PONG from ${fromPlayer}`);
    const state = get();
    const players = { ...state.players };
    const discardTile = state.lastDiscard;
    if (!discardTile) return;

    // Find matching tiles in hand
    const matching = players[player].hand.filter(t => t.id === discardTile.id);
    if (matching.length < 2) return;

    const meld: Meld = {
      type: 'pung',
      tiles: [...matching.slice(0, 2), discardTile],
      isConcealed: false,
      baseTile: discardTile,
      claimedFrom: fromPlayer,
    };

    players[player] = {
      ...players[player],
      hand: players[player].hand.filter(t => !matching.slice(0, 2).includes(t)),
      melds: [...players[player].melds, meld],
    };

    // Remove from discarder's discard pile
    players[fromPlayer] = {
      ...players[fromPlayer],
      discards: players[fromPlayer].discards.filter(t => t.instanceId !== discardTile.instanceId),
    };

    set({
      players,
      currentTurn: player,
      turnPhase: 'discard',
      lastDiscard: null,
      lastDiscardBy: null,
    });
  },

  declareKong: (player: Wind, tiles: Tile[]) => {
    console.log(`[Game] ${player} declaring KONG`);
    const state = get();
    const players = { ...state.players };

    const meld: Meld = {
      type: 'kong',
      tiles,
      isConcealed: tiles.every(t => players[player].hand.some(h => h.instanceId === t.instanceId)),
      baseTile: tiles[0],
    };

    players[player] = {
      ...players[player],
      hand: players[player].hand.filter(t => !tiles.find(mt => mt.instanceId === t.instanceId)),
      melds: [...players[player].melds, meld],
    };

    set({ players });

    // Draw replacement tile from dead wall
    const deadWall = [...state.deadWall];
    if (deadWall.length > 0) {
      const replacement = deadWall.pop()!;
      console.log(`[Game] ${player} drew replacement for Kong:`, replacement.value ? `${replacement.category}-${replacement.value}` : replacement.category);
      players[player] = {
        ...players[player],
        hand: sortTiles([...players[player].hand, replacement]),
      };
      set({ deadWall, players, turnPhase: 'discard' });
    }
  },

  declareChow: (player: Wind, tiles: Tile[]) => {
    console.log(`[Game] ${player} declaring CHOW`);
    const state = get();
    const discardTile = state.lastDiscard;
    if (!discardTile) return;

    const players = { ...state.players };
    const handTiles = tiles.filter(t => t.instanceId !== discardTile.instanceId);

    const meld: Meld = {
      type: 'chow',
      tiles: [...tiles],
      isConcealed: false,
      baseTile: tiles.sort((a, b) => (a.value || 0) - (b.value || 0))[0],
      claimedFrom: state.lastDiscardBy!,
    };

    players[player] = {
      ...players[player],
      hand: players[player].hand.filter(t => !handTiles.find(ht => ht.instanceId === t.instanceId)),
      melds: [...players[player].melds, meld],
    };

    set({
      players,
      currentTurn: player,
      turnPhase: 'discard',
      lastDiscard: null,
      lastDiscardBy: null,
    });
  },

  declareWin: (player: Wind) => {
    console.log(`[Game] ${player} WINS!`);
    // Simplified win declaration - full scoring in a real implementation
    set({
      phase: 'finished',
      winner: player,
    });
    return null;
  },

  passTurn: () => {
    console.log('[Game] Player passed turn.');
    get().nextTurn();
  },

  nextTurn: () => {
    const state = get();
    const turnOrder: Wind[] = ['east', 'south', 'west', 'north'];
    const currentIdx = turnOrder.indexOf(state.currentTurn);
    const nextTurn = turnOrder[(currentIdx + 1) % 4];

    console.log(`[Game] Turn change: ${state.currentTurn} -> ${nextTurn}`);

    set({
      currentTurn: nextTurn,
      turnPhase: 'draw',
    });

    // If AI player, play their turn
    if (!state.players[nextTurn].isHuman) {
      console.log(`[Game] Queueing AI turn for ${nextTurn}...`);
      setTimeout(() => get().playAITurn(), 800);
    } else {
      console.log('[Game] Human turn start. Auto-drawing...');
      setTimeout(() => get().drawTile(nextTurn), 500);
    }
  },

  updateTeacherSuggestion: () => {
    const state = get();
    const humanPlayer = state.players[HUMAN_SEAT];

    // Only show suggestion when it's human's turn in discard phase
    if (state.currentTurn !== HUMAN_SEAT || state.turnPhase !== 'discard') {
      set({ teacherSuggestion: null });
      return;
    }

    if (humanPlayer.hand.length === 0 || state.phase !== 'playing') {
      set({ teacherSuggestion: null });
      return;
    }

    try {
      // Suggest when human has 14-tile equivalent (hand + drawn tile)
      // With melds: 14 tiles, 11 tiles (1 meld), 8 tiles (2 melds), etc.
      // All these satisfy hand.length % 3 === 2
      if (humanPlayer.hand.length % 3 === 2) {
        const suggestion = suggestDiscard(
          humanPlayer.hand,
          humanPlayer.melds,
          HUMAN_SEAT,
          state.roundWind
        );
        set({ teacherSuggestion: suggestion });
      } else {
        set({ teacherSuggestion: null });
      }
    } catch (e) {
      set({ teacherSuggestion: null });
    }
  },

  toggleTeacher: () => set(state => ({ showTeacher: !state.showTeacher })),

  setAnimatingTile: (tile, target) => set({ animatingTile: tile, animationTarget: target }),

  checkClaims: async (tile: Tile, fromPlayer: Wind) => {
    const state = get();
    const turnOrder: Wind[] = ['east', 'south', 'west', 'north'];
    const fromIdx = turnOrder.indexOf(fromPlayer);

    // Check in turn order starting from next player for fairness priority (win overrides all, but typically checked in order)
    // Actually, standard Mahjong: Win > Pong/Kong > Chow.
    // We will iterate all other players.

    // For simplicity in this async flow: 
    // 1. Check Wins (all other players). If anyone wins, game over.
    // 2. Check Pong/Kong (all other players). 
    // 3. Check Chow (only next player).

    const otherPlayers = turnOrder.filter(p => p !== fromPlayer);

    // 1. Check WIN
    for (const p of otherPlayers) {
      if (canWin(state.players[p].hand, state.players[p].melds, tile)) {
        if (state.players[p].isHuman) {
          console.log('[Game] Offering WIN to Human');
          set({
            claimOffer: { tile, fromPlayer, canWin: true, canPong: false, canKong: false, canChow: false }
          });
          return true; // Pause for human
        } else {
          console.log(`[Game] AI ${p} declares WIN`);
          // AI Always Wins
          get().declareWin(p);
          return true;
        }
      }
    }

    // 2. Check Pong/Kong 
    // (Technically duplicate checks if multiple can pong same tile? (impossible for 3 matching in hand))
    for (const p of otherPlayers) {
      const canP = canPong(state.players[p].hand, tile);
      const canK = canKong(state.players[p].hand, tile);

      if (canP || canK) {
        if (state.players[p].isHuman) {
          console.log('[Game] Offering Pong/Kong to Human');
          set({
            claimOffer: { tile, fromPlayer, canWin: false, canPong: canP, canKong: canK, canChow: false }
          });
          return true;
        } else {
          // AI Random Logic: 50% chance to Pong/Kong
          if (Math.random() > 0.5) {
            if (canK) {
              console.log(`[Game] AI ${p} declares KONG`);
              // Find matching tiles for Kong
              const matching = state.players[p].hand.filter(t => tilesSameType(t, tile));
              get().declareKong(p, [...matching, tile]);
            } else {
              console.log(`[Game] AI ${p} declares PONG`);
              get().declarePong(p, fromPlayer);
            }
            return true;
          }
        }
      }
    }

    // 3. Check Chow (Next player only)
    const nextPlayer = turnOrder[(fromIdx + 1) % 4];
    if (nextPlayer !== fromPlayer) { // Should always be true
      const chowSets = canChow(state.players[nextPlayer].hand, tile);
      if (chowSets.length > 0) {
        if (state.players[nextPlayer].isHuman) {
          console.log('[Game] Offering CHOW to Human');
          set({
            claimOffer: { tile, fromPlayer, canWin: false, canPong: false, canKong: false, canChow: true, chowSets }
          });
          return true;
        } else {
          // AI Random Logic: 50% chance to Chow
          if (Math.random() > 0.5) {
            console.log(`[Game] AI ${nextPlayer} declares CHOW`);
            // Pick random set
            const setTiles = chowSets[Math.floor(Math.random() * chowSets.length)];
            get().declareChow(nextPlayer, [...setTiles, tile]);
            return true;
          }
        }
      }
    }

    return false;
  },

  resolveClaim: (action, data) => {
    console.log('[Game] Resolving claim action:', action);
    const state = get();
    if (!state.claimOffer) return;

    const { fromPlayer, tile } = state.claimOffer;
    const player = 'south'; // Human is always south in this setup

    set({ claimOffer: null });

    if (action === 'pass') {
      get().nextTurn();
      return;
    }

    if (action === 'win') {
      get().declareWin(player);
      return;
    }

    if (action === 'pong') {
      get().declarePong(player, fromPlayer);
      return;
    }

    if (action === 'kong') {
      const matching = state.players[player].hand.filter(t => tilesSameType(t, tile));
      get().declareKong(player, [...matching, tile]);
      return;
    }

    if (action === 'chow' && data) {
      // data should be the other 2 tiles
      get().declareChow(player, [...data, tile]);
      return;
    }
  },

  playAITurn: async () => {
    console.log('[Game] Executing AI Turn...');
    const state = get();
    const player = state.currentTurn;

    if (state.players[player].isHuman) {
      console.log('[Game] Aborting AI turn: Player is Human');
      return;
    }

    if (state.phase !== 'playing') {
      console.log('[Game] Aborting AI turn: Game not playing');
      return;
    }

    // Draw phase
    if (state.turnPhase === 'draw') {
      get().drawTile(player);
      await new Promise(r => setTimeout(r, 600));
    }

    // Discard Phase
    // Re-fetch state after draw
    const newState = get();

    const hand = newState.players[player].hand;
    if (hand.length > 0) {
      // Simple Random AI for Easy Mode:
      // 1. Check for Win (Self Draw) - TODO: Add canWin check for self draw later? 
      // For now, just discard random.

      const randomIdx = Math.floor(Math.random() * hand.length);
      const tileToDiscard = hand[randomIdx];
      get().discardTile(player, tileToDiscard); // This will now trigger checkClaims
    } else {
      console.log(`[Game] Warning: AI ${player} has empty hand?`);
    }
  },
}));
