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
    showTeacher: boolean;
    onToggleTeacher: () => void;
}

export const GameStateBar: React.FC<GameStateBarProps> = ({
    wallCount,
    currentTurn,
    scores,
    roundWind,
    dealerSeat,
    showTeacher,
    onToggleTeacher,
}) => {
    const isAutoPlay = useGameStore(state => state.isAutoPlay);
    const toggleAutoPlay = useGameStore(state => state.toggleAutoPlay);

    const windOrder: Wind[] = ['east', 'south', 'west', 'north'];

    const sortedPlayers = useMemo(() => {
        const startIndex = windOrder.indexOf(dealerSeat);
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
            <div className="global-state">
                <div className="round-indicator" title="Prevailing Wind">
                    {windLabels[roundWind]}
                </div>
                <div className="deck-count" title="Tiles Remaining">
                    <div className="deck-icon" />
                    {wallCount}
                </div>
            </div>

            <div className="center-controls">
                <button
                    className={`auto-play-btn ${isAutoPlay ? 'active' : ''}`}
                    onClick={toggleAutoPlay}
                    title="Toggle Auto Play"
                >
                    {isAutoPlay ? 'AUTO ON' : 'AUTO OFF'}
                </button>
                <button
                    className={`teacher-toggle-btn ${showTeacher ? 'active' : ''}`}
                    onClick={onToggleTeacher}
                    title={showTeacher ? 'Close Coach' : 'Open Coach'}
                    aria-label={showTeacher ? 'Close Mahjong coach' : 'Open Mahjong coach'}
                    aria-pressed={showTeacher}
                >
                    <span className="teacher-toggle-icon">🎓</span>
                    <span className="teacher-toggle-label">COACH</span>
                </button>
            </div>

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
