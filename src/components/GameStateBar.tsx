import React, { useMemo } from 'react';
import { Wind } from '../types/tile';
import './GameStateBar.css';
import { useGameStore } from '../store/gameStore';

interface GameStateBarProps {
    wallCount: number;
    currentTurn: Wind;
    scores: Record<Wind, number>;
    roundWind: Wind;
    dealerSeat: Wind;
}

export const GameStateBar: React.FC<GameStateBarProps> = ({
    wallCount,
    currentTurn,
    scores,
    roundWind,
    dealerSeat,
}) => {

    // Order logic: Counter-Clockwise from Dealer.
    // Sequence: East, South, West, North.
    // If Dealer is East: E -> S -> W -> N.
    // If Dealer is South: S -> W -> N -> E.
    const windOrder: Wind[] = ['east', 'south', 'west', 'north'];

    const sortedPlayers = useMemo(() => {
        const startIndex = windOrder.indexOf(dealerSeat);
        // Create new array starting from dealer
        return [
            ...windOrder.slice(startIndex),
            ...windOrder.slice(0, startIndex)
        ];
    }, [dealerSeat]);

    const windLabels: Record<Wind, string> = {
        east: '東',
        south: '南',
        west: '西',
        north: '北'
    };

    return (
        <div className="game-state-bar">
            {/* Left Widget: Global State */}
            <div className="global-state">
                <div className="round-indicator" title="Prevailing Wind">
                    {windLabels[roundWind]}
                </div>
                <div className="deck-count" title="Tiles Remaining">
                    <div className="deck-icon" />
                    {wallCount}
                </div>
            </div>

            {/* Right Widget: Player Status */}
            <div className="player-strip">
                {sortedPlayers.map((wind) => {
                    const isDealer = wind === dealerSeat;
                    const isActive = wind === currentTurn;

                    return (
                        <div
                            key={wind}
                            className={`status-player ${isActive ? 'active' : ''} ${isDealer ? 'is-dealer' : ''}`}
                        >
                            {isDealer && <div className="dealer-icon">莊</div>}
                            <div className="status-wind">{windLabels[wind]}</div>
                            <div className="status-score">{scores[wind]}</div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
