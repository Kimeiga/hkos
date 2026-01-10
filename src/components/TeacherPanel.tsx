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
  return (
    <div className={`teacher-panel ${isVisible ? 'visible' : 'hidden'}`}>
      <div className="teacher-header">
        <h3>🎓 Teacher</h3>
        <button className="toggle-btn" onClick={onToggle}>
          {isVisible ? '−' : '+'}
        </button>
      </div>
      
      {isVisible && suggestion && (
        <div className="teacher-content">
          <div className="recommendation">
            <div className="rec-label">Recommended Discard:</div>
            <div className="rec-tile">
              <Tile tile={suggestion.recommendedTile} isRecommended />
            </div>
          </div>
          
          <div className="reasoning">
            <div className="reasoning-label">Strategy:</div>
            <div className="reasoning-text">{suggestion.reasoning}</div>
          </div>
          
          <div className="stats">
            <div className="stat">
              <span className="stat-label">Target Hand:</span>
              <span className="stat-value">{suggestion.targetHand}</span>
            </div>
            <div className="stat">
              <span className="stat-label">Fan Potential:</span>
              <span className="stat-value fan">{suggestion.fanPotential} Fan</span>
            </div>
            <div className="stat">
              <span className="stat-label">Improving Tiles:</span>
              <span className="stat-value">{suggestion.tilesNeeded}</span>
            </div>
          </div>
          
          {suggestion.alternativeMoves.length > 0 && (
            <div className="alternatives">
              <div className="alt-label">Alternatives:</div>
              <div className="alt-list">
                {suggestion.alternativeMoves.slice(0, 2).map((alt, i) => (
                  <div key={i} className="alt-item">
                    <Tile tile={alt.tile} isHint />
                    <span className="alt-reason">{alt.fanPotential} Fan</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      
      {isVisible && !suggestion && (
        <div className="teacher-content">
          <div className="no-suggestion">
            Waiting for your turn to discard...
          </div>
        </div>
      )}
    </div>
  );
};

export default TeacherPanel;

