import React from 'react';
import { PIECE_TYPES, COLORS } from '../chess/gameState';

const PIECE_UNICODE = {
  [COLORS.WHITE]: {
    [PIECE_TYPES.KING]: '♚',
    [PIECE_TYPES.QUEEN]: '♛',
    [PIECE_TYPES.ROOK]: '♜',
    [PIECE_TYPES.BISHOP]: '♝',
    [PIECE_TYPES.KNIGHT]: '♞',
    [PIECE_TYPES.PAWN]: '♟'
  },
  [COLORS.BLACK]: {
    [PIECE_TYPES.KING]: '♚',
    [PIECE_TYPES.QUEEN]: '♛',
    [PIECE_TYPES.ROOK]: '♜',
    [PIECE_TYPES.BISHOP]: '♝',
    [PIECE_TYPES.KNIGHT]: '♞',
    [PIECE_TYPES.PAWN]: '♟'
  }
};


const ChessPiece = ({ piece, position, onClick, isSelected }) => {
  if (!piece) return null;

  const handleClick = () => {
    if (onClick) {
      onClick(position, piece);
    }
  };

  return (
    <div
      className={`chess-piece ${piece.color} ${isSelected ? 'selected' : ''}`}
      onClick={handleClick}
      data-piece-type={piece.type}
      data-piece-color={piece.color}
      data-bot-id={piece.botId}
      data-position={`${position.row}-${position.col}`}
      style={{
        fontSize: '36px',
        cursor: 'pointer',
        userSelect: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
        transition: 'all 0.2s ease',
        color: piece.color === COLORS.WHITE ? '#FF69B4' : '#006400',
        textShadow: '-0.5px -0.5px 0 #000, 0.5px -0.5px 0 #000, -0.5px 0.5px 0 #000, 0.5px 0.5px 0 #000'
      }}
    >
      {PIECE_UNICODE[piece.color][piece.type]}
    </div>
  );
};

export default ChessPiece;