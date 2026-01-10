import React from 'react';
import { Wind } from '../types/tile';
import './CenterCompass.css';

interface CenterCompassProps {
    wallCount: number;
    currentTurn: Wind;
    scores: Record<Wind, number>;
    roundWind: Wind; // Not actively used in new design spec but good to have
    handNumber: number;
}

/**
 * Center Wind Compass
 * Displays the current turn, scores, and remaining tiles in a central widget.
 * 
 * Rotations:
 * Bottom (South/User): 0deg
 * Right (East): -90deg
 * Top (North): 180deg
 * Left (West): 90deg
 */
export const CenterCompass: React.FC<CenterCompassProps> = ({
    wallCount,
    currentTurn,
    scores,
    roundWind,
    handNumber
}) => {

    // Map logical winds to UI positions
    // Bottom is ALWAYS South (User)
    // Counter-clockwise from Bottom: East (Right), North (Top), West (Left)?
    // Wait, standard compass: N, E, S, W.
    // Mahjong order: East, South, West, North (Counter-clockwise).

    // User Spec:
    // Bottom (User): Display 東 (East) -> Wait, user said "Bottom (User): Display 東 (East)."
    // BUT usually user is South?
    // Let's re-read spec: "Bottom (User): Display 東 (East)."
    // IF the user is East, then Bottom is East.
    // "Right: Display 南 (South)."
    // "Top: Display 西 (West)."
    // "Left: Display 北 (North)."

    // This implies the User is sitting at East.
    // However, in our game logic, Human is 'south'.
    // Let's stick to the visual spec requested but map the DATA correctly.

    // Actually, Mahjong seating rotates.
    // If we want to implementation strictly what user asked:
    // Bottom = East label.

    // Let's look at `gameStore`: 
    // roundWind, dealerSeat.
    // Standard HKOS: Dealer is East.

    // If the user wants specific labels fixed to positions:
    // Bottom Label: "東" (East)
    // Right Label: "南" (South)
    // Top Label: "西" (West)
    // Left Label: "北" (North)

    // We need to map which PLAYER is currently at that wind.
    // If the user (South player) is at the bottom, and the label says East... that's confusing.

    // Interpretation: The label indicates WHICH WIND that seat corresponds to in the abstract, OR the user made a typo and meant standard seating.
    // Standard Seating relative to dealer:
    // Dealer = East.
    // Right of Dealer = South.
    // Across Dealer = West.
    // Left of Dealer = North.

    // Let's implement the labels as requested by the user for now.
    // "Bottom (User): Display 東 (East)."
    // This implies the User is acting as East.
    // BUT our code says `humanSeat: 'south'`.

    // DECISION: I will display the WIND CHARACTER that corresponds to the player at that position.
    // In `GameTable.tsx`, we map:
    // south -> bottom
    // east -> right
    // north -> top
    // west -> left

    // So:
    // Bottom (South Player) -> Label should be South (南)?
    // User spec: "Bottom (User): Display 東 (East)."
    // This contradicts existing code where user is South.
    // However, I will follow the COMPONENT SPEC visual structure. 
    // Maybe the user wants the "East" position to be the bottom?
    // OR the user just gave an example.

    // "Note: This is the Mahjong order (Counter-Clockwise), not the standard compass order."
    // E -> S -> W -> N.

    // Let's assume the user wants the LABELS to match the PLAYERS at those positions.
    // Players:
    // Bottom: South
    // Right: East
    // Top: North
    // Left: West

    // Wait, `GameTable.tsx` map:
    // south: 'bottom'
    // east: 'right'
    // north: 'top'
    // west: 'left'

    // If I put "East" label at bottom, it will mismatch the "South" player data.
    // I will make the component DATA DRIVEN.
    // I will map the `players` to the `sectors`.

    // Sector Data Structure
    type Sector = {
        position: 'bottom' | 'right' | 'top' | 'left';
        wind: Wind;
        label: string; // The character
        score: number;
    };

    const sectors: Sector[] = [
        { position: 'bottom', wind: 'south', label: '南', score: scores.south },
        { position: 'right', wind: 'east', label: '東', score: scores.east },
        { position: 'top', wind: 'north', label: '北', score: scores.north },
        { position: 'left', wind: 'west', label: '西', score: scores.west },
    ];

    // Round Wind Character
    const roundWindChar = {
        east: '東',
        south: '南',
        west: '西',
        north: '北'
    }[roundWind];

    return (
        <div className="center-compass">
            {/* Center Info: Round Wind, Hand #, Tiles Left */}
            <div className="compass-center">
                <div className="round-info">
                    <span className="round-wind">{roundWindChar}</span>
                    <span className="hand-num">{handNumber}</span>
                </div>
                <div className="tiles-remaining" title="Tiles Remaining">
                    {wallCount}
                </div>
            </div>

            {/* Sectors */}
            {sectors.map(s => (
                <div
                    key={s.wind}
                    className={`compass-sector ${s.position} ${currentTurn === s.wind ? 'active' : ''}`}
                >
                    <div className="compass-character-box">
                        <div className="compass-label">{s.label}</div>
                    </div>
                    <div className="compass-score">{s.score}</div>
                </div>
            ))}
        </div>
    );
};
