import React from 'react';
import { motion } from 'framer-motion';
import { Tile as TileType } from '../types/tile';
import './Tile.css';

interface TileProps {
  tile: TileType;
  onClick?: () => void;
  isSelected?: boolean;
  isRecommended?: boolean;
  isConcealed?: boolean;
  isHint?: boolean;
  rotation?: 0 | 90 | 180 | 270; // Rotation in degrees
  enableLayoutAnimation?: boolean; // Enable FLIP animation via layoutId
  animationProps?: {
    initial?: any;
    animate?: any;
    exit?: any;
    transition?: any;
  };
}

// Pad number with leading zero if needed (e.g., 9 -> "09")
const pad = (n: number): string => n.toString().padStart(2, '0');

// Map tile to Hong Kong style SVG filename
const getTileImagePath = (tile: TileType): string => {
  const basePath = '/tiles/';

  if (tile.category === 'bamboo') {
    return `${basePath}${pad(25 + tile.value!)}-bamboos-${tile.value}.svg`;
  }
  if (tile.category === 'character') {
    return `${basePath}${pad(7 + tile.value!)}-characters-${tile.value}.svg`;
  }
  if (tile.category === 'dot') {
    return `${basePath}${pad(16 + tile.value!)}-circles-${tile.value}.svg`;
  }
  if (tile.category === 'wind') {
    const windMap = { east: '04-east-wind', south: '05-south-wind', west: '06-west-wind', north: '07-north-wind' };
    return `${basePath}${windMap[tile.wind!]}.svg`;
  }
  if (tile.category === 'dragon') {
    const dragonMap = { white: '01-white-dragon', green: '02-green-dragon', red: '03-red-dragon' };
    return `${basePath}${dragonMap[tile.dragon!]}.svg`;
  }
  if (tile.category === 'season') {
    const seasonMap: Record<number, string> = { 1: '35-spring', 2: '36-summer', 3: '37-autumn', 4: '38-winter' };
    return `${basePath}${seasonMap[tile.flowerNumber!]}.svg`;
  }
  if (tile.category === 'flower') {
    const flowerMap: Record<number, string> = { 1: '39-plum', 2: '40-orchid', 3: '41-chrysanthemum', 4: '42-bamboo' };
    return `${basePath}${flowerMap[tile.flowerNumber!]}.svg`;
  }
  return `${basePath}01-white-dragon.svg`;
};

const getTileTitle = (tile: TileType): string => {
  if (tile.category === 'bamboo') return `${tile.value} Bamboo`;
  if (tile.category === 'character') return `${tile.value} Character`;
  if (tile.category === 'dot') return `${tile.value} Dot`;
  if (tile.category === 'wind') return `${tile.wind} Wind`;
  if (tile.category === 'dragon') return `${tile.dragon} Dragon`;
  if (tile.category === 'flower') return `Flower ${tile.flowerNumber}`;
  if (tile.category === 'season') return `Season ${tile.flowerNumber}`;
  return 'Tile';
};

export const Tile: React.FC<TileProps> = ({
  tile,
  onClick,
  isSelected = false,
  isRecommended = false,
  isConcealed = false,
  isHint = false,
  rotation = 0,
  enableLayoutAnimation = false,
  animationProps,
}) => {
  const sizeClass = isHint ? 'tile-hint' : 'tile-normal';
  const rotationClass = rotation > 0 ? `tile-rotated-${rotation}` : '';
  const layoutId = enableLayoutAnimation ? `tile-${tile.instanceId}` : undefined;

  const defaultInitial = enableLayoutAnimation ? { opacity: 0, scale: 0.8 } : false;
  const defaultAnimate = { opacity: 1, scale: 1 };
  const defaultExit = { opacity: 0, scale: 0.8 };
  const defaultTransition = { type: 'spring', stiffness: 500, damping: 30 };

  return (
    <motion.div
      layoutId={layoutId}
      className={`tile ${sizeClass} ${rotationClass} ${isSelected ? 'selected' : ''} ${isRecommended ? 'recommended' : ''} ${isConcealed ? 'concealed' : ''} ${onClick ? 'clickable' : ''}`}
      onClick={onClick}
      title={isConcealed ? 'Hidden tile' : getTileTitle(tile)}
      initial={animationProps?.initial ?? defaultInitial}
      animate={animationProps?.animate ?? defaultAnimate}
      exit={animationProps?.exit ?? defaultExit}
      transition={animationProps?.transition ?? defaultTransition}
      whileHover={onClick ? { y: -4 } : undefined}
      whileTap={onClick ? { scale: 0.95 } : undefined}
    >
      {isConcealed ? (
        <div className="tile-back" />
      ) : (
        <img
          src={getTileImagePath(tile)}
          alt={getTileTitle(tile)}
          className="tile-image"
          draggable={false}
        />
      )}
    </motion.div>
  );
};

export default Tile;

