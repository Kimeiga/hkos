import { create } from 'zustand';
import {
  GameState, GamePhase, Player, PlayerAction, TeacherSuggestion,
  INITIAL_SCORE, WinResult
} from '../types/game';
import { Tile, Wind, WINDS, sortTiles } from '../types/tile';
import { Meld } from '../types/meld';
import { createTileSet, shuffleTiles } from '../engine/tileFactory';
import { suggestDiscard } from '../engine/teacher';
import { evaluateWinningHand } from '../engine/winning';
import type { ScoringContext } from '../engine/scoring';
import { canPong, canKong, canChow, canWin } from '../engine/rules';
import { tilesSameType } from '../types/tile';
import { AIDifficulty, selectDiscard as aiSelectDiscard, shouldClaim as aiShouldClaim, AIContext } from '../engine/ai';

interface GameStore extends GameState {
  // UI state
  gameVersion: number;
  lastDrawnTile: Tile | null;
  winResult: WinResult | null;
  canDeclareSelfDrawWin: (player: Wind) => boolean;
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
  isAutoPlay: boolean;
  toggleAutoPlay: () => void;
  playAutoTurn: () => Promise<void>;

  // AI difficulty
  aiDifficulty: AIDifficulty;
  setAIDifficulty: (difficulty: AIDifficulty) => void;

  // AI actions
  playAITurn: () => Promise<void>;
  checkClaims: (tile: Tile, fromPlayer: Wind) => Promise<boolean>; // Returns true if claimed
}

// Human is East (dealer) - the most common setup in Mahjong trainers
const HUMAN_SEAT: Wind = 'east';

// Public knowledge only. Do not peek at concealed opponents' hands, concealed
// kongs, wall or dead wall when calculating a recommendation.
const visibleMeldTiles = (players: Record<Wind, Player>): Tile[] =>
  WINDS.flatMap(seat => players[seat].melds
    .filter(m => !m.isConcealed)
    .flatMap(m => m.tiles));

const visibleDiscards = (players: Record<Wind, Player>): Tile[] =>
  WINDS.flatMap(seat => players[seat].discards);

const publiclyKnownTiles = (players: Record<Wind, Player>): Tile[] =>
  [...visibleDiscards(players), ...visibleMeldTiles(players)];

// All win eligibility and payments use the same rule-engine path. A player may
// have a structurally complete hand but fail the configured fan minimum.
const scoreCandidate = (state: GameStore, player: Wind, selfDraw: boolean): WinResult | null => {
  const candidate = selfDraw ? state.lastDrawnTile : state.lastDiscard;
  if (!candidate) return null;
  const hand = state.players[player].hand;
  if (selfDraw && !hand.some(t => t.instanceId === candidate.instanceId)) return null;
  const ctx: ScoringContext = {
    hand: selfDraw ? hand.filter(t => t.instanceId !== candidate.instanceId) : hand,
    melds: state.players[player].melds,
    flowers: state.players[player].flowers,
    winningTile: candidate,
    seatWind: player,
    roundWind: state.roundWind,
    isSelfDraw: selfDraw,
    isLastTile: state.wall.length === 0,
    isReplacementTile: false,
    isRobbingKong: false,
  };
  return evaluateWinningHand(ctx, selfDraw ? null : state.lastDiscardBy);
};

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
  gameVersion: 0,
  lastDrawnTile: null,
  winResult: null,
  canDeclareSelfDrawWin: (player: Wind) => {
    const state = get();
    return state.phase === 'playing' && state.currentTurn === player &&
      state.turnPhase === 'discard' && scoreCandidate(state, player, true)?.isValid === true;
  },
  selectedTile: null,
  teacherSuggestion: null,
  showTeacher: true,
  animatingTile: null,
  animationTarget: null,
  claimOffer: null,

  // AI settings
  aiDifficulty: 'medium' as AIDifficulty,
  setAIDifficulty: (difficulty: AIDifficulty) => {
    console.log(`[Game] AI Difficulty set to: ${difficulty}`);
    set({ aiDifficulty: difficulty });
  },

  initGame: () => {
    console.log('[Game] Initializing...');
    const version = get().gameVersion + 1;
    const tiles = createTileSet(true);
    const shuffled = shuffleTiles(tiles);

    // Separate dead wall (14 tiles for kong replacements)
    const deadWall = shuffled.slice(0, 14);
    const wall = shuffled.slice(14);

    set({
      phase: 'dealing',
      gameVersion: version,
      winResult: null,
      lastDrawnTile: null,
      claimOffer: null,
      teacherSuggestion: null,
      selectedTile: null,
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
    setTimeout(() => {
      if (get().gameVersion === version && get().phase === 'dealing') get().dealTiles();
    }, 500);
  },

  dealTiles: () => {
    console.log('[Game] Dealing tiles...');
    const state = get();
    if (state.phase !== 'dealing') return;
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
      lastDrawnTile: players.east.hand[players.east.hand.length - 1] ?? null,
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
    players[HUMAN_SEAT] = {
      ...players[HUMAN_SEAT],
      hand: sortTiles(players[HUMAN_SEAT].hand),
    };
    set({ players });
  },

  drawTile: (player: Wind) => {
    const state = get();
    if (state.phase !== 'playing' || state.currentTurn !== player || state.turnPhase !== 'draw') return null;
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
    // Only sort for AI players to keep their logic simple, but for human (East), append.
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
      lastDrawnTile: tile,
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
    const state = get();
    if (state.phase !== 'playing' || state.currentTurn !== player || state.turnPhase !== 'discard' ||
        state.claimOffer || !state.players[player].hand.some(t => t.instanceId === tile.instanceId)) return;
    console.log(`[Game] ${player} discarding:`, tile.value ? `${tile.category}-${tile.value}` : tile.category);
    const version = state.gameVersion;
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
      lastDrawnTile: null,
      teacherSuggestion: null,
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
      if (currentState.gameVersion !== version || currentState.phase !== 'playing' ||
          currentState.lastDiscard?.instanceId !== discardInstanceId) {
        console.log('[Game] Stale discard check, skipping nextTurn.');
        return;
      }

      console.log(`[Game] Checking claims for discard by ${player}...`);
      const claimed = await get().checkClaims(tile, player);
      if (!claimed) {
        // Double-check we're still on the same discard
        const finalState = get();
        if (finalState.gameVersion !== version || finalState.phase !== 'playing' ||
            finalState.lastDiscard?.instanceId !== discardInstanceId) {
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
    if (!discardTile || state.lastDiscardBy !== fromPlayer || state.phase !== 'playing') return;

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
      claimOffer: null,
      selectedTile: null,
      lastDrawnTile: null,
    });

    get().updateTeacherSuggestion();
    if (!players[player].isHuman) {
      const version = state.gameVersion;
      setTimeout(() => {
        if (get().gameVersion === version && get().currentTurn === player && get().phase === 'playing') get().playAITurn();
      }, 600);
    }
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

      // If AI, trigger turn (discard) after replacement
      if (!players[player].isHuman) {
        setTimeout(() => get().playAITurn(), 600);
      }
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

    // If AI, trigger turn (discard)
    if (!players[player].isHuman) {
      setTimeout(() => get().playAITurn(), 600);
    }
  },

  declareWin: (player: Wind) => {
    const state = get();
    if (state.phase !== 'playing') return null;
    const selfDraw = state.currentTurn === player && state.turnPhase === 'discard' &&
      state.lastDrawnTile !== null;
    const result = scoreCandidate(state, player, selfDraw);
    if (!result?.isValid) return null;

    const winnerTile = selfDraw ? state.lastDrawnTile : state.lastDiscard;
    const players = { ...state.players };
    for (const wind of WINDS) {
      players[wind] = {
        ...players[wind],
        score: players[wind].score + result.finalPayment.payments[wind],
      };
    }

    console.log(`[Game] ${player} WINS with ${result.totalFan} fan`);
    set({
      players,
      phase: 'finished',
      winner: player,
      winningTile: winnerTile,
      isSelfDraw: selfDraw,
      winResult: result,
      claimOffer: null,
      teacherSuggestion: null,
      lastDrawnTile: null,
      selectedTile: null,
    });
    return result;
  },

  passTurn: () => {
    console.log('[Game] Player passed turn.');
    get().nextTurn();
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
          state.roundWind,
          publiclyKnownTiles(state.players)
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

  // Auto Play State
  isAutoPlay: false,

  toggleAutoPlay: () => {
    const state = get();
    const newAuto = !state.isAutoPlay;
    console.log(`[Game] Toggling Auto Play: ${newAuto}`);
    set({ isAutoPlay: newAuto });

    // If it's currently human turn and we just turned it ON, trigger move
    if (newAuto && state.currentTurn === HUMAN_SEAT && state.phase === 'playing' && state.turnPhase === 'discard') {
      get().playAutoTurn();
    }
  },

  playAutoTurn: async () => {
    const state = get();
    // Guard: Only play if auto is ON, it's human turn, AND game is still playing
    if (!state.isAutoPlay || state.currentTurn !== HUMAN_SEAT || state.phase !== 'playing') {
      console.log('[Game] Auto Play skipped (condition not met)', {
        auto: state.isAutoPlay,
        turn: state.currentTurn,
        phase: state.phase
      });
      return;
    }

    console.log('[Game] Auto-playing human turn...');

    // Suggestion logic
    const humanPlayer = state.players[HUMAN_SEAT];
    let tileToDiscard = humanPlayer.hand[humanPlayer.hand.length - 1]; // Default: Discard drawn tile

    try {
      if (humanPlayer.hand.length % 3 === 2) {
        const suggestion = suggestDiscard(
          humanPlayer.hand,
          humanPlayer.melds,
          HUMAN_SEAT,
          state.roundWind,
          publiclyKnownTiles(state.players)
        );
        if (suggestion && suggestion.recommendedTile) {
          // Find the actual tile instance in hand that matches the recommendation
          const match = humanPlayer.hand.find(t => t.instanceId === suggestion.recommendedTile.instanceId);
          if (match) {
            tileToDiscard = match;
            console.log('[Game] Auto Play found best move:', tileToDiscard.category, tileToDiscard.value);
          }
        }
      }
    } catch (err) {
      console.error('[Game] Auto Play error calculating best move:', err);
    }

    const version = state.gameVersion;
    await new Promise(r => setTimeout(r, 800));
    const latest = get();
    if (!latest.isAutoPlay || latest.gameVersion !== version || latest.phase !== 'playing' ||
        latest.currentTurn !== HUMAN_SEAT || latest.turnPhase !== 'discard' ||
        latest.claimOffer || !latest.players[HUMAN_SEAT].hand.some(t => t.instanceId === tileToDiscard.instanceId)) return;

    if (get().canDeclareSelfDrawWin(HUMAN_SEAT)) {
      get().declareWin(HUMAN_SEAT);
      return;
    }
    get().discardTile(HUMAN_SEAT, tileToDiscard);
  },

  checkClaims: async (tile: Tile, fromPlayer: Wind) => {
    const state = get();
    const turnOrder: Wind[] = ['east', 'south', 'west', 'north'];
    const fromIdx = turnOrder.indexOf(fromPlayer);
    // Highest-priority winning claims go to the nearest player in turn order.
    const otherPlayers = [1, 2, 3].map(offset => turnOrder[(fromIdx + offset) % 4]);

    // 1. Check WIN (Priority)
    for (const p of otherPlayers) {
      if (canWin(state.players[p].hand, state.players[p].melds, tile) &&
          scoreCandidate(state, p, false)?.isValid === true) {

        // Human Logic
        if (state.players[p].isHuman) {
          // If Auto Play is ON: Auto-Win!
          if (state.isAutoPlay) {
            console.log('[Game] Auto Play: TAKING WIN!');
            await new Promise(r => setTimeout(r, 600));
            get().declareWin(p);
            return true;
          }

          console.log('[Game] Offering WIN to Human');
          set({
            claimOffer: { tile, fromPlayer, canWin: true, canPong: false, canKong: false, canChow: false }
          });
          return true; // Pause for human
        }

        // AI Logic
        else {
          console.log(`[Game] AI ${p} declares WIN`);
          get().declareWin(p);
          return true;
        }
      }
    }

    // 2. Check Pong/Kong (Standard loops)
    for (const p of otherPlayers) {
      const canP = canPong(state.players[p].hand, tile);
      const canK = canKong(state.players[p].hand, tile);

      if (canP || canK) {
        if (state.players[p].isHuman) {
          // Auto Play: For now, skip optional claims to keep it simple/defensive/fast
          // Or we could implement a basic heuristic? 
          // Let's Skip for now to favor "Closed Hand" unless user intervenes.
          if (state.isAutoPlay) {
            console.log('[Game] Auto Play: Skipping Pong/Kong to keep hand closed.');
            continue;
          }

          console.log('[Game] Offering Pong/Kong to Human');
          set({
            claimOffer: { tile, fromPlayer, canWin: false, canPong: canP, canKong: canK, canChow: false }
          });
          return true;
        } else {
          // AI claim decision using AI engine
          const allDiscards = [
            ...state.players.east.discards,
            ...state.players.south.discards,
            ...state.players.west.discards,
            ...state.players.north.discards,
          ];

          const context: AIContext = {
            hand: state.players[p].hand,
            melds: state.players[p].melds,
            seatWind: p,
            roundWind: state.roundWind,
            discards: allDiscards,
            wallRemaining: state.wall.length,
            visibleMeldTiles: visibleMeldTiles(state.players),
          };

          const decision = aiShouldClaim(state.aiDifficulty, context, tile, {
            canWin: false,
            canPong: canP,
            canKong: canK,
            canChow: false,
          });

          if (decision.action === 'kong') {
            console.log(`[Game] AI (${state.aiDifficulty}) ${p} claims KONG: ${decision.reasoning}`);
            const matching = state.players[p].hand.filter(t => tilesSameType(t, tile));
            get().declareKong(p, [...matching, tile]);
            return true;
          } else if (decision.action === 'pong') {
            console.log(`[Game] AI (${state.aiDifficulty}) ${p} claims PONG: ${decision.reasoning}`);
            get().declarePong(p, fromPlayer);
            return true;
          }
          // AI passed
        }
      }
    }

    // 3. Check Chow (Next player only)
    const nextPlayer = turnOrder[(fromIdx + 1) % 4];
    if (nextPlayer !== fromPlayer) {
      const chowSets = canChow(state.players[nextPlayer].hand, tile);
      if (chowSets.length > 0) {
        if (state.players[nextPlayer].isHuman) {
          if (state.isAutoPlay) {
            console.log('[Game] Auto Play: Skipping Chow.');
            // Fall through to return false
          } else {
            console.log('[Game] Offering CHOW to Human');
            set({
              claimOffer: { tile, fromPlayer, canWin: false, canPong: false, canKong: false, canChow: true, chowSets }
            });
            return true;
          }
        } else {
          // AI chow decision using AI engine
          const allDiscards = [
            ...state.players.east.discards,
            ...state.players.south.discards,
            ...state.players.west.discards,
            ...state.players.north.discards,
          ];

          const context: AIContext = {
            hand: state.players[nextPlayer].hand,
            melds: state.players[nextPlayer].melds,
            seatWind: nextPlayer,
            roundWind: state.roundWind,
            discards: allDiscards,
            wallRemaining: state.wall.length,
            visibleMeldTiles: visibleMeldTiles(state.players),
          };

          const decision = aiShouldClaim(state.aiDifficulty, context, tile, {
            canWin: false,
            canPong: false,
            canKong: false,
            canChow: true,
            chowSets,
          });

          if (decision.action === 'chow' && decision.chowSet) {
            console.log(`[Game] AI (${state.aiDifficulty}) ${nextPlayer} claims CHOW: ${decision.reasoning}`);
            get().declareChow(nextPlayer, [...decision.chowSet, tile]);
            return true;
          }
          // AI passed on chow
        }
      }
    }

    return false;
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
      lastDiscard: null,
      lastDiscardBy: null,
      lastDrawnTile: null,
      claimOffer: null,
    });

    // Check if next player is Human
    const version = state.gameVersion;
    if (state.players[nextTurn].isHuman) {
      console.log('[Game] Human turn start. Auto-drawing...');
      setTimeout(() => {
        const latest = get();
        if (latest.gameVersion !== version || latest.phase !== 'playing' ||
            latest.currentTurn !== nextTurn || latest.turnPhase !== 'draw') return;
        get().drawTile(nextTurn);
        if (get().isAutoPlay) get().playAutoTurn();
      }, 500);
    } else {
      console.log(`[Game] Queueing AI turn for ${nextTurn}...`);
      setTimeout(() => {
        const latest = get();
        if (latest.gameVersion === version && latest.phase === 'playing' &&
            latest.currentTurn === nextTurn && latest.turnPhase === 'draw') get().playAITurn();
      }, 800);
    }
  },

  resolveClaim: (action, data) => {
    console.log('[Game] Resolving claim action:', action);
    const state = get();
    if (!state.claimOffer) return;

    const { fromPlayer, tile } = state.claimOffer;
    const player = HUMAN_SEAT;

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

    const version = state.gameVersion;
    if (state.turnPhase === 'draw') {
      if (!get().drawTile(player)) return;
      await new Promise(r => setTimeout(r, 600));
    }

    const newState = get();
    if (newState.gameVersion !== version || newState.phase !== 'playing' ||
        newState.currentTurn !== player || newState.turnPhase !== 'discard' ||
        newState.claimOffer) return;
    const hand = newState.players[player].hand;

    if (hand.length > 0) {
      // A complete structure is not enough: enforce the configured minimum fan.
      if (scoreCandidate(newState, player, true)?.isValid === true) {
        console.log(`[Game] AI ${player} declares WIN (self-draw)!`);
        get().declareWin(player);
        return;
      }

      // Gather all visible discards for AI context
      const allDiscards = [
        ...newState.players.east.discards,
        ...newState.players.south.discards,
        ...newState.players.west.discards,
        ...newState.players.north.discards,
      ];

      // Build AI context
      const context: AIContext = {
        hand,
        melds: newState.players[player].melds,
        seatWind: player,
        roundWind: newState.roundWind,
        discards: allDiscards,
        wallRemaining: newState.wall.length,
        visibleMeldTiles: visibleMeldTiles(newState.players),
      };

      // Use AI engine to select discard
      const tileToDiscard = aiSelectDiscard(newState.aiDifficulty, context);
      console.log(`[Game] AI (${newState.aiDifficulty}) ${player} discards:`,
        tileToDiscard.value ? `${tileToDiscard.category}-${tileToDiscard.value}` : tileToDiscard.category);

      get().discardTile(player, tileToDiscard);
    } else {
      console.log(`[Game] Warning: AI ${player} has empty hand?`);
    }
  },
}));
