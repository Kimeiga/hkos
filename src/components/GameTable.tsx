import React, { useEffect } from 'react';
import { useGameStore } from '../store';
import { Wind } from '../types/tile';
import { PlayerHand } from './PlayerHand';
import { DiscardRiver } from './DiscardRiver';
import { TeacherPanel } from './TeacherPanel';
import { GameStateBar } from './GameStateBar';
import './GameTable.css';

const positionMap: Record<Wind, 'bottom' | 'left' | 'top' | 'right'> = {
  south: 'bottom',
  east: 'right',
  north: 'top',
  west: 'left',
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
  } = useGameStore();

  // Collect all discards for the DiscardRiver
  const allDiscards = {
    south: players.south.discards,
    east: players.east.discards,
    north: players.north.discards,
    west: players.west.discards,
  };

  // Start game on mount
  useEffect(() => {
    if (phase === 'waiting') {
      initGame();
    }
  }, [phase, initGame]);

  // Handle tile click for human player
  const handleTileClick = (tile: typeof selectedTile) => {
    if (!tile) return;

    if (selectedTile?.instanceId === tile.instanceId) {
      // Double-click to discard
      discardTile('south', tile);
    } else {
      selectTile(tile);
    }
  };

  // Handle draw action
  const handleDraw = () => {
    if (currentTurn === 'south' && turnPhase === 'draw') {
      drawTile('south');
    }
  };

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

      <DiscardRiver discards={allDiscards} />

      <div className="table-center">
        {/* Center is now largely handled by DiscardRiver's specific positioning,
             but we keep this container if we need other overlays later.
             Currently empty/transparent.
         */}

        {/* Draw button for human player */}
        {currentTurn === 'south' && turnPhase === 'draw' && phase === 'playing' && (
          <button className="draw-button" onClick={handleDraw}>
            Draw Tile
          </button>
        )}
      </div>

      {/* Player hands in their positions */}
      {winds.map(wind => (
        <PlayerHand
          key={wind}
          tiles={players[wind].hand}
          melds={players[wind].melds}
          flowers={players[wind].flowers}
          position={positionMap[wind]}
          isCurrentTurn={currentTurn === wind}
          isHuman={players[wind].isHuman}
          seat={wind}
          selectedTile={wind === 'south' ? selectedTile : null}
          recommendedTile={wind === 'south' ? teacherSuggestion?.recommendedTile : null}
          onTileClick={wind === 'south' ? handleTileClick : undefined}
          canDiscard={wind === 'south' && currentTurn === 'south' && turnPhase === 'discard'}
        />
      ))}

      {phase === 'playing' && currentTurn === 'south' && turnPhase === 'discard' && (
        <button className="sort-button" onClick={sortHand}>Sort Hand</button>
      )}

      <TeacherPanel
        suggestion={teacherSuggestion}
        isVisible={showTeacher}
        onToggle={toggleTeacher}
      />

      {/* Instructions */}
      {phase === 'playing' && currentTurn === 'south' && (
        <div className="instructions">
          {turnPhase === 'draw' && 'Drawing...'}
          {turnPhase === 'discard' && 'Click a tile to select, click again to discard'}
        </div>
      )}

      {/* Action Panel (Pong/Kong/Chow/Win) */}
      {showTeacher && teacherSuggestion && currentTurn === 'south' && turnPhase === 'discard' && (
        /* Keeping existing teacher logic but maybe move it? kept for now */
        null
      )}

      {/* Real Action Panel driven by claimOffer */}
      {claimOffer && (
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
                  {claimOffer.chowSets?.map((set, i) => (
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
      )}

      {phase === 'finished' && (
        <div className="game-over-overlay">
          <div className="game-over-content">
            <h2>Game Over</h2>
            <p>{useGameStore(state => state.winner ? `${state.winner.toUpperCase()} Wins!` : 'Draw Game')}</p>
            <button onClick={initGame}>Play Again</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default GameTable;

