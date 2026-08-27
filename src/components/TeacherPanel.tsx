import React from 'react';
import { TeacherSuggestion } from '../types/game';
import { Tile as TileType } from '../types/tile';
import { Tile } from './Tile';
import './TeacherPanel.css';

interface TeacherPanelProps {
  suggestion: TeacherSuggestion | null;
  isVisible: boolean;
  onToggle: () => void;
  onOpenHand: (handName: string) => void;
  onOpenTile: (tile: TileType) => void;
}

export const TeacherPanel: React.FC<TeacherPanelProps> = ({
  suggestion,
  isVisible,
  onToggle,
  onOpenHand,
  onOpenTile,
}) => {
  if (!isVisible) return null;

  const fanLabel = suggestion
    ? suggestion.fanPotential > 0
      ? `${suggestion.fanPotential} fan`
      : '0 fan by itself'
    : '';
  const compactFanLabel = suggestion
    ? `${suggestion.fanPotential} fan`
    : '';

  return (
    <aside className="teacher-panel visible" aria-label="Mahjong coach">
      <div className="teacher-header">
        <div>
          <h3>🎓 Coach</h3>
          <div className="teacher-subtitle teacher-copy-desktop">Why a move is good, not just what to click</div>
        </div>
        <button className="toggle-btn" onClick={onToggle} aria-label="Close coach">×</button>
      </div>

      {suggestion ? (
        <div className="teacher-content">
          <div className="recommendation">
            <div>
              <div className="rec-label">Best discard</div>
              <div className="rec-help teacher-copy-desktop">The same tile is marked green in your hand. Tap this tile to learn what it is.</div>
              <div className="rec-help teacher-copy-mobile">Green tile = best discard.</div>
            </div>
            <div className="rec-tile">
              <Tile
                tile={suggestion.recommendedTile}
                isRecommended
                onClick={() => onOpenTile(suggestion.recommendedTile)}
              />
            </div>
          </div>

          <div className="reasoning">
            <div className="reasoning-label">Why this move</div>
            <div className="reasoning-text">
              <span className="teacher-copy-desktop">Moves toward </span>
              <span className="teacher-copy-mobile">Toward </span>
              <button className="inline-rule-link" onClick={() => onOpenHand(suggestion.targetHand)}>
                {suggestion.targetHand}
              </button>
              <span className="teacher-copy-desktop"> ({fanLabel}). {suggestion.tilesNeeded} estimated improving copies.</span>
              <span className="teacher-copy-mobile"> · {suggestion.tilesNeeded} est. improving copies</span>
            </div>
          </div>

          <div className="stats">
            <div className="stat">
              <span className="stat-label">Plan</span>
              <button className="stat-link" onClick={() => onOpenHand(suggestion.targetHand)}>
                {suggestion.targetHand}
              </button>
            </div>
            <div className="stat">
              <span className="stat-label">
                <span className="teacher-copy-desktop">Fan potential</span>
                <span className="teacher-copy-mobile">Fan</span>
              </span>
              <button className="stat-link fan" onClick={() => onOpenHand(suggestion.targetHand)}>
                <span className="teacher-copy-desktop">{fanLabel}</span>
                <span className="teacher-copy-mobile">{compactFanLabel}</span>
              </button>
            </div>
            <div className="stat">
              <span className="stat-label">
                <span className="teacher-copy-desktop">Improving copies (rough est.)</span>
                <span className="teacher-copy-mobile">Improve</span>
              </span>
              <span className="stat-value">{suggestion.tilesNeeded}</span>
            </div>
          </div>

          {suggestion.alternativeMoves.length > 0 && (
            <div className="alternatives">
              <div className="alt-label">
                <span className="teacher-copy-desktop">Other reasonable discards</span>
                <span className="teacher-copy-mobile">Other discards</span>
              </div>
              <div className="alt-list">
                {suggestion.alternativeMoves.slice(0, 2).map((alt, index) => (
                  <button
                    key={index}
                    className="alt-item alt-item-button"
                    onClick={() => onOpenTile(alt.tile)}
                    aria-label={`Explain ${alt.tile.id}`}
                  >
                    <Tile tile={alt.tile} isHint />
                    <span className="alt-reason">{alt.fanPotential} fan</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="teacher-content">
          <div className="no-suggestion">The coach will explain a discard when it is your turn.</div>
        </div>
      )}
    </aside>
  );
};

export default TeacherPanel;
