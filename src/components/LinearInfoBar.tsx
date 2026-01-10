import React from 'react';
import { Wind } from '../types/tile';
import './LinearInfoBar.css';

interface LinearInfoBarProps {
    wallCount: number;
    currentTurn: Wind;
    scores: Record<Wind, number>;
}

export const LinearInfoBar: React.FC<LinearInfoBarProps> = ({
    wallCount,
    currentTurn,
    scores,
}) => {
    // Order: North, West, East, South (Matches user linear order request roughly, 
    // or purely strictly linear: N, W, E, S? 
    // User said: "north west east whatever the order is right east north west south"
    // Let's do standard Compass order linear: East, South, West, North?
    // Or relative to screen? Top (N), Left (W), Right (E), Bottom (S).
    // This seems most intuitive for a watcher.

    const players: { wind: Wind; label: string }[] = [
        { wind: 'north', label: '北' },
        { wind: 'west', label: '西' },
        { wind: 'east', label: '東' },
        { wind: 'south', label: '南' },
    ];

    return (
        <div className="linear-info-bar">
            {/* Tiles Remaining */}
            <div className="info-segment">
                <div className="tiles-left">{wallCount}</div>
            </div>

            <div className="divider" />

            {/* Players */}
            <div className="players-linear">
                {players.map((p) => (
                    <div
                        key={p.wind}
                        className={`player-info-item ${currentTurn === p.wind ? 'active' : ''}`}
                    >
                        <div className="player-wind">{p.label}</div>
                        <div className="player-score">{scores[p.wind]}</div>
                    </div>
                ))}
            </div>
        </div>
    );
};
