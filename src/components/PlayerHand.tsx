import React from 'react';
import { AnimatePresence } from 'framer-motion';
import { Tile as TileType, Wind } from '../types/tile';
import { Meld } from '../types/meld';
import { Tile } from './Tile';
import './PlayerHand.css';
import './HumanActionRow.css';

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
  let rotation: 0 | 90 | 180 | 270 = 0;
  if (position === 'left') rotation = 90;
  if (position === 'right') rotation = 270;
  if (position === 'top') rotation = 180;
  const isVertical = position === 'left' || position === 'right';

  return (
    <div className={`player-hand ${position} ${isCurrentTurn ? 'current-turn' : ''}`}>
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

      {isHuman && canDiscard && (
        <div className="human-action-row" role="status" aria-live="polite">
          <span className={`hand-instruction ${selectedTile ? 'confirm' : ''}`}>
            {selectedTile ? 'Selected — tap again to discard' : 'Choose a tile to discard'}
          </span>
          {onSort && (
            <button className="sort-button-integrated" onClick={onSort}>
              Sort
            </button>
          )}
        </div>
      )}

      <div className={`hand-composite ${position}`}>
        {flowers.map(tile => (
          <Tile key={`flower-${tile.instanceId}`} tile={tile} rotation={rotation} className="flower-tile" />
        ))}

        {melds.map((meld, i) => (
          <div key={`meld-${i}`} className={`meld ${isVertical ? 'meld-vertical' : ''}`}>
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

        <AnimatePresence mode="popLayout">
          {tiles.map((tile, index) => {
            const isLastTile = index === tiles.length - 1;
            const isJustDrawn = isHuman && isLastTile && tiles.length % 3 === 2;
            const customAnim = isJustDrawn ? {
              initial: { opacity: 0, y: -40 },
              animate: { opacity: 1, y: 0 },
              transition: { duration: 0.4, ease: 'easeOut' }
            } : undefined;

            return (
              <Tile
                key={tile.instanceId}
                tile={tile}
                isConcealed={!showTiles}
                isSelected={selectedTile?.instanceId === tile.instanceId}
                isRecommended={recommendedTile?.instanceId === tile.instanceId}
                onClick={isHuman && canDiscard ? () => onTileClick?.(tile) : undefined}
                enableLayoutAnimation={true}
                rotation={rotation}
                animationProps={customAnim}
                className="hand-tile"
              />
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
};
