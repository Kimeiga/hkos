import React from 'react';
import { TeacherSuggestion } from '../types/game';
import { Tile } from './Tile';
import './TeacherPanel.css';

interface TeacherPanelProps {
  suggestion: TeacherSuggestion | null;
  isVisible: boolean;
  onToggle: () => void;
}

export const TeacherPanel: React.FC<TeacherPanelProps> = ({
  suggestion,
  isVisible,
  onToggle,
}) => {
  if (!isVisible) return null;

  return (
    <aside className="teacher-panel visible" aria-label="Mahjong coach">
      <div className="teacher-header">
        <div>
          <h3>🎓 Coach</h3>
          <div className="teacher-subtitle">Why a move is good, not just what to click</div>
        </div>
        <button className="toggle-btn" onClick={onToggle} aria-label="Close coach">
          ×
        </button>
      </div>

      {suggestion ? (
        <div className="teacher-content">
          <div className="recommendation">
            <div>
              <div className="rec-label">Best discard</div>
              <div className="rec-help">The same tile is marked green in your hand.</div>
            </div>
            <div className="rec-tile">
              <Tile tile={suggestion.recommendedTile} isRecommended />
            </div>
          </div>

          <div className="reasoning">
            <div className="reasoning-label">Why this move</div>
            <div className="reasoning-text">{suggestion.reasoning}</div>
          </div>

          <div className="stats">
            <div className="stat">
              <span className="stat-label">Plan</span>
              <span className="stat-value">{suggestion.targetHand}</span>
            </div>
            <div className="stat">
              <span className="stat-label">Fan potential</span>
              <span className="stat-value fan">{suggestion.fanPotential} fan</span>
            </div>
            <div className="stat">
              <span className="stat-label">Improving tiles (est.)</span>
              <span className="stat-value">{suggestion.tilesNeeded}</span>
            </div>
          </div>

          {suggestion.alternativeMoves.length > 0 && (
            <div className="alternatives">
              <div className="alt-label">Other reasonable discards</div>
              <div className="alt-list">
                {suggestion.alternativeMoves.slice(0, 2).map((alt, index) => (
                  <div key={index} className="alt-item">
                    <Tile tile={alt.tile} isHint />
                    <span className="alt-reason">{alt.fanPotential} fan</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="teacher-content">
          <div className="no-suggestion">
            The coach will explain a discard when it is your turn.
          </div>
        </div>
      )}
    </aside>
  );
};

export default TeacherPanel;
