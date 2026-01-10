import React from 'react';
import { Wind, Tile as TileType } from '../types/tile';
import { Tile } from './Tile';
import './DiscardRiver.css';

interface DiscardRiverProps {
    discards: Record<Wind, TileType[]>;
}

export const DiscardRiver: React.FC<DiscardRiverProps> = ({ discards }) => {
    return (
        <div className="discard-river">
            {/* Center Anchor "The Pond" */}
            <div className="river-center">

                {/* South (User) - Bottom */}
                <div className="river-section south">
                    {discards.south.map(tile => (
                        <Tile key={tile.instanceId} tile={tile} rotation={0} /> // Portrait
                    ))}
                </div>

                {/* East (Right) */}
                <div className="river-section east">
                    {discards.east.map(tile => (
                        <Tile key={tile.instanceId} tile={tile} rotation={270} /> // Landscape (Top->Left)
                    ))}
                </div>

                {/* North (Top) */}
                <div className="river-section north">
                    {discards.north.map(tile => (
                        <Tile key={tile.instanceId} tile={tile} rotation={180} /> // Portrait (Inverted)
                    ))}
                </div>

                {/* West (Left) */}
                <div className="river-section west">
                    {discards.west.map(tile => (
                        <Tile key={tile.instanceId} tile={tile} rotation={90} /> // Landscape (Top->Right)
                    ))}
                </div>

            </div>
        </div>
    );
};
