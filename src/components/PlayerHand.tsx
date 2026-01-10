import React from 'react';
import { AnimatePresence } from 'framer-motion';
import { Tile as TileType, Wind } from '../types/tile';
import { Meld } from '../types/meld';
import { Tile } from './Tile';
import './PlayerHand.css';

interface PlayerHandProps {
  tiles: TileType[];
  melds: Meld[];
  flowers: TileType[];
  discards: TileType[];
  position: 'bottom' | 'left' | 'top' | 'right';
  isCurrentTurn: boolean;
  isHuman: boolean;
  seat: Wind;
  selectedTile: TileType | null;
  recommendedTile?: TileType | null;
  onTileClick?: (tile: TileType) => void;
  onSort?: () => void;
  canDiscard: boolean;
}

export const PlayerHand: React.FC<PlayerHandProps> = ({
  tiles,
  melds,
  flowers,
  discards,
  position,
  isCurrentTurn,
  isHuman,
  selectedTile,
  recommendedTile,
  onTileClick,
  onSort,
  canDiscard,
}) => {
  const showTiles = isHuman || position === 'bottom';
  // Determine rotation based on position
  let rotation: 0 | 90 | 180 | 270 = 0;
  if (position === 'left') rotation = 90;
  if (position === 'right') rotation = 270;
  if (position === 'top') rotation = 180;
  const isVertical = position === 'left' || position === 'right';

  return (
    <div className={`player-hand ${position} ${isCurrentTurn ? 'current-turn' : ''}`}>
    {/* Sort Button Logic (Human Only) - Top of Stack */}
    {isHuman && onSort && (
      <button
        className="sort-button-integrated"
        onClick={onSort}
        style={{
          marginBottom: '8px', /* Spacing from Discard Zone */
          padding: '6px 12px',
          fontSize: '12px',
          fontWeight: 'bold',
          background: 'rgba(0,0,0,0.5)',
          color: '#fff',
          border: '1px solid rgba(255,255,255,0.3)',
          borderRadius: '4px',
          cursor: 'pointer',
          pointerEvents: 'auto', // Ensure it's clickable
        }}
      >
        Sort Hand
      </button>
    )}
    {/* Exposed Zone: Melds + Flowers */}
    <div className="exposed-zone">
      {/* Flowers */}
      {flowers.length > 0 && (
        <div className={`flowers ${isVertical ? 'flowers-vertical' : ''}`}>
          {flowers.map(tile => (
            <Tile key={tile.instanceId} tile={tile} isHint={true} rotation={rotation} />
          ))}
        </div>
      )}

      {/* Melds */}
      {melds.length > 0 && (
        <div className={`melds ${isVertical ? 'melds-vertical' : ''}`}>
          {melds.map((meld, i) => (
            <div key={i} className={`meld ${isVertical ? 'meld-vertical' : ''}`}>
              {meld.tiles.map((tile) => (
                <Tile
                  key={tile.instanceId}
                  tile={tile}
                  isConcealed={meld.isConcealed}
                  rotation={rotation}
                />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>

    {/* Discard pile */}
    {discards.length > 0 && (
      <div className={`discard-pile ${isVertical ? 'discard-pile-vertical' : ''}`}>
        {discards.map(tile => (
          <Tile
            key={tile.instanceId}
            tile={tile}
            rotation={rotation}
            enableLayoutAnimation={true}
          />
        ))}
      </div>
    )}

    {/* Hand tiles */}
    <div className={`hand-tiles ${isVertical ? 'hand-tiles-vertical' : ''}`} style={{ minWidth: isHuman ? 'auto' : 'auto' }}>
      <AnimatePresence mode="popLayout">
        {tiles.map((tile, index) => {
          // Logic to identify the just-drawn tile for the "Float Down" animation.
          const isLastTile = index === tiles.length - 1;
          const isJustDrawn = isHuman && isLastTile && tiles.length % 3 === 2; // Rough heuristic: typical hands are 13, draw is 14. 14%3=2. 
          // Better: pass `isJustDrawn` in tile object or use store state. 
          // For now, re-using existing logic or simplfying.

          const customAnim = isJustDrawn ? {
            initial: { opacity: 0, y: -40 },
            animate: { opacity: 1, y: 0 },
            transition: { duration: 0.4, ease: "easeOut" }
          } : undefined;

          return (
            <Tile
              key={tile.instanceId}
              tile={tile}
              isConcealed={!showTiles}
              isSelected={selectedTile?.instanceId === tile.instanceId}
              isRecommended={recommendedTile?.instanceId === tile.instanceId}
              onClick={isHuman && canDiscard ? () => onTileClick?.(tile) : undefined}
              enableLayoutAnimation={true} // Enable for everyone to support Discard Layout Animations (Hand -> Pile)
              rotation={rotation}
              animationProps={customAnim}
            />
          )
        })}
      </AnimatePresence>
    </div>
  </div>
  );
};


