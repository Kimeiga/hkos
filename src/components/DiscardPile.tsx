import React from 'react';
import { AnimatePresence } from 'framer-motion';
import { Tile as TileType, Wind } from '../types/tile';
import { Tile } from './Tile';
import './DiscardPile.css';

interface DiscardPileProps {
  discards: TileType[];
  player: Wind;
  isHumanPlayer?: boolean;
}

export const DiscardPile: React.FC<DiscardPileProps> = ({
  discards,
  player,
  isHumanPlayer = false,
}) => {
  // Rotate tiles for East/West
  let rotation: 0 | 90 | 180 | 270 = 0;
  if (player === 'west') rotation = 90;
  if (player === 'east') rotation = 270;
  if (player === 'north') rotation = 180;
  // Split discards into chunks of 8 (rows/columns)
  const chunkSize = 8;
  const chunks: TileType[][] = [];
  for (let i = 0; i < discards.length; i += chunkSize) {
    chunks.push(discards.slice(i, i + chunkSize));
  }

  // Ensure at least one empty chunk to hold space/avoid collapse if needed, 
  // though CSS min-height handles that. 
  // If empty, chunks is [], map won't render anything, which is fine.

  return (
    <div className={`discard-pile ${player}`}>
      <div className="discard-label">{player}</div>
      <div className="discards-container">
        {chunks.map((chunk, chunkIndex) => (
          <div key={chunkIndex} className="discard-row">
            <AnimatePresence mode="popLayout">
              {chunk.map((tile) => (
                <Tile
                  key={tile.instanceId}
                  tile={tile}
                  rotation={rotation}
                  enableLayoutAnimation={true}
                />
              ))}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DiscardPile;

