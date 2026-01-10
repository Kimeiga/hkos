import React, { useEffect } from 'react';
import { useGameStore } from '../store';
import { Wind } from '../types/tile';
import { PlayerHand } from './PlayerHand';
import { TeacherPanel } from './TeacherPanel';
import { GameStateBar } from './GameStateBar';
import './GameTable.css';

// Position mapping: Human (East) at bottom, playing counter-clockwise
// East (bottom) -> South (left) -> West (top) -> North (right)
const positionMap: Record<Wind, 'bottom' | 'left' | 'top' | 'right'> = {
  east: 'bottom',   // Human/Dealer
  south: 'left',    // Next player (counter-clockwise)
  west: 'top',      // Across from human
  north: 'right',   // Previous player
};

export const GameTable: React.FC = () => {
  const {
    phase,
    players,
    currentTurn,
    turnPhase,
    wall,
    roundWind,
    selectedTile,
    teacherSuggestion,
    showTeacher,
    selectTile,
    discardTile,
    drawTile,
    toggleTeacher,
    initGame,
    sortHand,
    claimOffer,
    resolveClaim,
    dealerSeat,
    winner,
  } = useGameStore();

  // Start game on mount
  useEffect(() => {
    if (phase === 'waiting') {
      initGame();
    }
  }, [phase, initGame]);

  // Find the human player's seat
  const humanSeat = (Object.keys(players) as Wind[]).find(w => players[w].isHuman) || 'east';

  // Handle tile click for human player
  const handleTileClick = (tile: typeof selectedTile) => {
    if (!tile) return;

    if (selectedTile?.instanceId === tile.instanceId) {
      // Double-click to discard
      discardTile(humanSeat, tile);
    } else {
      selectTile(tile);
    }
  };

  // Handle draw action (unused but kept for potential future use)
  const _handleDraw = () => {
    if (currentTurn === humanSeat && turnPhase === 'draw') {
      drawTile(humanSeat);
    }
  };
  void _handleDraw; // Suppress unused warning

  const winds: Wind[] = ['south', 'east', 'north', 'west'];
  const scores = {
    east: players.east.score,
    south: players.south.score,
    west: players.west.score,
    north: players.north.score,
  };

  return (
    <div className="game-table">
      <GameStateBar
        wallCount={wall.length}
        currentTurn={currentTurn}
        scores={scores}
        roundWind={roundWind}
        dealerSeat={dealerSeat}
      />

      {/* DiscardRiver Removed - Integrated into PlayerHand */}

      <div className="table-center">
        {/* Center is now truly empty, used for effects or dead wall if needed */}
      </div>

      {/* Player hands in their positions */}
      {winds.map(wind => {
        const isHuman = players[wind].isHuman;
        return (
          <PlayerHand
            key={wind}
            tiles={players[wind].hand}
            melds={players[wind].melds}
            flowers={players[wind].flowers}
            discards={players[wind].discards}
            position={positionMap[wind]}
            isCurrentTurn={currentTurn === wind}
            isHuman={isHuman}
            seat={wind}
            selectedTile={isHuman ? selectedTile : null}
            recommendedTile={isHuman ? teacherSuggestion?.recommendedTile : null}
            onTileClick={isHuman ? handleTileClick : undefined}
            onSort={
              isHuman && phase === 'playing' && currentTurn === wind && turnPhase === 'discard'
                ? sortHand
                : undefined
            }
            canDiscard={isHuman && currentTurn === wind && turnPhase === 'discard'}
          />
        );
      })}

      {/* Floating Sort Button Removed - Integrated into PlayerHand */}

      <TeacherPanel
        suggestion={teacherSuggestion}
        isVisible={showTeacher}
        onToggle={toggleTeacher}
      />

      {/* Instructions Removed */}

      {/* Action Panel (Pong/Kong/Chow/Win) */}
      {showTeacher && teacherSuggestion && currentTurn === 'south' && turnPhase === 'discard' && (
        /* Keeping existing teacher logic but maybe move it? kept for now */
        null
      )}

      {/* Real Action Panel driven by claimOffer */}
      {claimOffer && (
        <ActionOverlay claimOffer={claimOffer} resolveClaim={resolveClaim} />
      )}

      {phase === 'finished' && (
        <GameOverOverlay winner={winner} onRestart={initGame} />
      )}
    </div>
  );
};

// Sub-components to ensure clean render tree and avoid hook issues
interface ClaimOffer {
  tile: import('../types/tile').Tile;
  fromPlayer: Wind;
  canPong: boolean;
  canKong: boolean;
  canChow: boolean;
  canWin: boolean;
  chowSets?: import('../types/tile').Tile[][];
}

const ActionOverlay: React.FC<{
  claimOffer: ClaimOffer;
  resolveClaim: (action: 'pass' | 'pong' | 'kong' | 'chow' | 'win', data?: import('../types/tile').Tile[]) => void;
}> = ({ claimOffer, resolveClaim }) => (
  <div className="action-panel-overlay">
    <div className="action-panel">
      <h3>Claim Tile?</h3>
      <div className="action-buttons">
        {claimOffer.canWin && (
          <button className="action-btn win" onClick={() => resolveClaim('win')}>
            WIN (Hu)
          </button>
        )}
        {claimOffer.canPong && (
          <button className="action-btn pong" onClick={() => resolveClaim('pong')}>
            PONG
          </button>
        )}
        {claimOffer.canKong && (
          <button className="action-btn kong" onClick={() => resolveClaim('kong')}>
            KONG
          </button>
        )}
        {claimOffer.canChow && (
          <div className="chow-options">
            {claimOffer.chowSets?.map((set: import('../types/tile').Tile[], i: number) => (
              <button key={i} className="action-btn chow" onClick={() => resolveClaim('chow', set)}>
                CHOW {set[0].value}-{set[1].value}
              </button>
            ))}
          </div>
        )}
        <button className="action-btn pass" onClick={() => resolveClaim('pass')}>
          PASS
        </button>
      </div>
    </div>
  </div>
);

const GameOverOverlay: React.FC<{
  winner: string | null;
  onRestart: () => void;
}> = ({ winner, onRestart }) => (
  <div className="game-over-overlay">
    <div className="game-over-content">
      <h2>Game Over</h2>
      <p>{winner ? `${winner.toUpperCase()} Wins!` : 'Draw Game'}</p>
      <button onClick={onRestart}>Play Again</button>
    </div>
  </div>
);

export default GameTable;

