import React from 'react';
import { Wind } from '../types/tile';
import { GamePhase } from '../types/game';
import './GameInfo.css';

interface GameInfoProps {
  roundWind: Wind;
  roundNumber: number;
  handNumber: number;
  phase: GamePhase;
  wallCount: number;
  scores: Record<Wind, number>;
  currentTurn: Wind;
}

const windLabels: Record<Wind, string> = {
  east: '東 East',
  south: '南 South',
  west: '西 West',
  north: '北 North',
};

export const GameInfo: React.FC<GameInfoProps> = ({
  roundWind,
  roundNumber,
  handNumber,
  phase,
  wallCount,
  scores,
  currentTurn,
}) => {
  return (
    <div className="game-info">
      <div className="round-info">
        <div className="round-wind">{windLabels[roundWind]} Round</div>
        <div className="hand-number">Hand {handNumber}</div>
      </div>
      
      <div className="wall-count">
        <span className="wall-icon">🀫</span>
        <span className="wall-number">{wallCount}</span>
        <span className="wall-label">tiles left</span>
      </div>
      
      <div className="turn-info">
        <div className="turn-label">Current Turn:</div>
        <div className={`turn-player ${currentTurn}`}>
          {windLabels[currentTurn]}
        </div>
      </div>
      
      <div className="scores">
        <div className="scores-label">Scores</div>
        {(['east', 'south', 'west', 'north'] as Wind[]).map(wind => (
          <div key={wind} className={`score-item ${wind === 'south' ? 'human' : ''}`}>
            <span className="score-wind">{wind.charAt(0).toUpperCase()}</span>
            <span className="score-value">{scores[wind]}</span>
          </div>
        ))}
      </div>
      
      {phase === 'finished' && (
        <div className="game-over">
          <div className="game-over-text">Game Over</div>
        </div>
      )}
    </div>
  );
};

export default GameInfo;

