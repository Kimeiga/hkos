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
      {/* Sort Button Logic (Human Only) - Top of Stack/Overlay */}
      {isHuman && onSort && (
        <button
          className="sort-button-integrated"
          onClick={onSort}
          style={{
            marginBottom: '4px',
            padding: '6px 12px',
            fontSize: '12px',
            fontWeight: 'bold',
            background: 'rgba(0,0,0,0.5)',
            color: '#fff',
            border: '1px solid rgba(255,255,255,0.3)',
            borderRadius: '4px',
            cursor: 'pointer',
            pointerEvents: 'auto',
          }}
        >
          Sort Hand
        </button>
      )}

      {/* Discard pile - MOVED TO TOP (Furthest from Player) */}
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

      {/* Hand Composite: Grouping Exposed (Melds/Flowers) and Active Hand inline */}
      <div className={`hand-composite ${position}`}>
        {/* Flowers - Direct Children */}
        {flowers.map(tile => (
          <Tile key={`flower-${tile.instanceId}`} tile={tile} rotation={rotation} className="flower-tile" />
        ))}

        {/* Melds - Wrapper per meld is still needed for grouping 3 tiles, but we can style it inline */}
        {/* Actually, if we want TRUE wrapping where melds wrap, we keep the meld wrapper. 
            User complaint: "separate divs is still causing the issue" -> implies the GROUP div for flowers/melds.
            The individual MELD div (holding 3 tiles) should stay together. 
            But we want [Flower] [Flower] [Meld] [Meld] [Hand] all in one stream.
        */}
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

        {/* Hand tiles - We likely want these to be direct children too? 
            User said "player hand which is the main flexbox".
            If we keep <div className="hand-tiles">, that div is a block.
            If we want hand tiles to wrap WITH flowers, we must UNWRAP hand-tiles too.
        */}
        <AnimatePresence mode="popLayout">
          {tiles.map((tile, index) => {
            const isLastTile = index === tiles.length - 1;
            const isJustDrawn = isHuman && isLastTile && tiles.length % 3 === 2;
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
                enableLayoutAnimation={true}
                rotation={rotation}
                animationProps={customAnim}
                className="hand-tile"
              />
            )
          })}
        </AnimatePresence>
      </div>
    </div>
  );
};


