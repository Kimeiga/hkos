import { Tile, Wind } from './tile';
import { Meld } from './meld';

export type GamePhase = 
  | 'waiting'     // Before game starts
  | 'dealing'     // Dealing tiles
  | 'playing'     // Main game loop
  | 'declaring'   // Player declaring action (pong/kong/win)
  | 'finished';   // Game/hand ended

export type PlayerAction = 
  | 'draw'
  | 'discard'
  | 'chow'
  | 'pong'
  | 'kong'
  | 'win'
  | 'pass';

export interface Player {
  seat: Wind;
  hand: Tile[];           // Concealed tiles in hand
  melds: Meld[];          // Revealed/declared melds
  flowers: Tile[];        // Collected flowers/seasons
  discards: Tile[];       // Tiles this player discarded
  score: number;
  isHuman: boolean;
}

export interface GameState {
  phase: GamePhase;
  
  // Winds
  roundWind: Wind;        // Prevalent wind for the round
  dealerSeat: Wind;       // Current dealer
  
  // Players (always 4, indexed by seat)
  players: Record<Wind, Player>;
  
  // Turn management
  currentTurn: Wind;      // Whose turn it is
  turnPhase: 'draw' | 'action' | 'discard';
  
  // Wall and tiles
  wall: Tile[];           // Remaining tiles in wall
  deadWall: Tile[];       // Dead wall (kong replacements)
  lastDiscard: Tile | null;
  lastDiscardBy: Wind | null;
  
  // Round tracking
  roundNumber: number;    // 1-4 (East, South, West, North rounds)
  handNumber: number;     // Which hand in current round
  
  // Interruption handling
  pendingActions: PendingAction[];
  
  // Win conditions
  winner: Wind | null;
  winningTile: Tile | null;
  isSelfDraw: boolean;
}

export interface PendingAction {
  player: Wind;
  action: PlayerAction;
  priority: number;  // Higher = higher priority (win > pong > chow)
}

export interface WinResult {
  isValid: boolean;
  totalFan: number;
  meetsMinimum: boolean;  // 3 fan minimum
  fanBreakdown: FanScore[];
  basePoints: number;
  finalPayment: PaymentResult;
}

export interface FanScore {
  name: string;
  fan: number;
  description: string;
}

export interface PaymentResult {
  // Who pays whom and how much
  payments: Record<Wind, number>;  // Negative = pays, Positive = receives
}

export interface TeacherSuggestion {
  recommendedTile: Tile;
  reasoning: string;
  targetHand: string;       // e.g., "Mixed Flush", "All Pungs"
  fanPotential: number;
  tilesNeeded: number;      // Ukeire - tiles that improve hand
  alternativeMoves: AlternativeMove[];
}

export interface AlternativeMove {
  tile: Tile;
  reasoning: string;
  fanPotential: number;
  tilesNeeded: number;
}

export const INITIAL_SCORE = 500;
export const MIN_FAN = 3;
export const LIMIT_FAN = 13;

