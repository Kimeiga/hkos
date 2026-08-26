import React, { useEffect } from 'react';
import { useGameStore } from '../store';
import { Wind } from '../types/tile';
import { PlayerHand } from './PlayerHand';
import { TeacherPanel } from './TeacherPanel';
import { GameStateBar } from './GameStateBar';
import { Tile } from './Tile';
import './GameTable.css';

// Position mapping: Human (East) at bottom, playing counter-clockwise
// East (bottom) -> South (left) -> West (top) -> North (right)
const positionMap: Record<Wind, 'bottom' | 'left' | 'top' | 'right'> = {
  east: 'bottom',
  south: 'left',
  west: 'top',
  north: 'right',
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
    toggleTeacher,
    initGame,
    sortHand,
    claimOffer,
    resolveClaim,
    dealerSeat,
    winner,
  } = useGameStore();

  useEffect(() => {
    if (phase === 'waiting') {
      initGame();
    }
  }, [phase, initGame]);

  const humanSeat = (Object.keys(players) as Wind[]).find(wind => players[wind].isHuman) || 'east';

  const handleTileClick = (tile: typeof selectedTile) => {
    if (!tile) return;

    if (selectedTile?.instanceId === tile.instanceId) {
      discardTile(humanSeat, tile);
    } else {
      selectTile(tile);
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
    <div className={`game-table ${showTeacher ? 'teacher-open' : ''}`}>
      <GameStateBar
        wallCount={wall.length}
        currentTurn={currentTurn}
        scores={scores}
        roundWind={roundWind}
        dealerSeat={dealerSeat}
        showTeacher={showTeacher}
        onToggleTeacher={toggleTeacher}
      />

      <div className="table-center" />

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

      <TeacherPanel
        suggestion={teacherSuggestion}
        isVisible={showTeacher}
        onToggle={toggleTeacher}
      />

      {claimOffer && (
        <ActionOverlay claimOffer={claimOffer} resolveClaim={resolveClaim} />
      )}

      {phase === 'finished' && (
        <GameOverOverlay winner={winner} onRestart={initGame} />
      )}
    </div>
  );
};

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
    <div className="action-panel" role="dialog" aria-modal="true" aria-labelledby="claim-title">
      <div className="claim-context">
        <Tile tile={claimOffer.tile} />
        <div>
          <h3 id="claim-title">Claim this discard?</h3>
          <p>Discarded by {claimOffer.fromPlayer.toUpperCase()}</p>
        </div>
      </div>
      <div className="action-buttons">
        {claimOffer.canWin && (
          <button className="action-btn win" onClick={() => resolveClaim('win')}>
            Sik / Win
          </button>
        )}
        {claimOffer.canPong && (
          <button className="action-btn pong" onClick={() => resolveClaim('pong')}>
            Pung
          </button>
        )}
        {claimOffer.canKong && (
          <button className="action-btn kong" onClick={() => resolveClaim('kong')}>
            Gong
          </button>
        )}
        {claimOffer.canChow && (
          <div className="chow-options">
            {claimOffer.chowSets?.map((set: import('../types/tile').Tile[], index: number) => (
              <button key={index} className="action-btn chow" onClick={() => resolveClaim('chow', set)}>
                Sheung {set[0].value}-{set[1].value}
              </button>
            ))}
          </div>
        )}
        <button className="action-btn pass" onClick={() => resolveClaim('pass')}>
          Pass
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
