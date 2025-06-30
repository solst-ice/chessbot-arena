import React, { useState } from 'react';
import ChessPiece from './ChessPiece';
import { isValidMove, isInCheck, isCheckmate } from '../chess/moveValidation';
import { COLORS, PIECE_TYPES } from '../chess/gameState';

const ChessBoard = ({ gameState, onMove, onGameStateChange, lastMove }) => {
  const [selectedSquare, setSelectedSquare] = useState(null);
  const [validMoves, setValidMoves] = useState([]);

  const handleSquareClick = (row, col) => {
    const clickedPiece = gameState.board[row][col];
    
    if (selectedSquare) {
      const from = selectedSquare;
      const to = { row, col };
      
      if (isValidMove(gameState.board, from, to, gameState)) {
        onMove(from, to);
        setSelectedSquare(null);
        setValidMoves([]);
      } else {
        if (clickedPiece && clickedPiece.color === gameState.currentTurn) {
          setSelectedSquare({ row, col });
          setValidMoves(getValidMovesForPiece(row, col));
        } else {
          setSelectedSquare(null);
          setValidMoves([]);
        }
      }
    } else {
      if (clickedPiece && clickedPiece.color === gameState.currentTurn) {
        setSelectedSquare({ row, col });
        setValidMoves(getValidMovesForPiece(row, col));
      }
    }
  };

  const getValidMovesForPiece = (row, col) => {
    const moves = [];
    for (let toRow = 0; toRow < 8; toRow++) {
      for (let toCol = 0; toCol < 8; toCol++) {
        const from = { row, col };
        const to = { row: toRow, col: toCol };
        if (isValidMove(gameState.board, from, to, gameState)) {
          const testBoard = makeTestMove(gameState.board, from, to);
          if (!isInCheck(testBoard, gameState.currentTurn)) {
            moves.push({ row: toRow, col: toCol });
          }
        }
      }
    }
    return moves;
  };

  const makeTestMove = (board, from, to) => {
    const newBoard = board.map(row => [...row]);
    newBoard[to.row][to.col] = newBoard[from.row][from.col];
    newBoard[from.row][from.col] = null;
    return newBoard;
  };

  const isSquareSelected = (row, col) => {
    return selectedSquare && selectedSquare.row === row && selectedSquare.col === col;
  };

  const isValidMoveSquare = (row, col) => {
    return validMoves.some(move => move.row === row && move.col === col);
  };

  const isSquareLight = (row, col) => {
    return (row + col) % 2 === 0;
  };

  const isLastMoveDestination = (row, col) => {
    return lastMove && lastMove.to.row === row && lastMove.to.col === col;
  };

  return (
    <div className="chess-board">
      {gameState.board.map((row, rowIndex) =>
        row.map((piece, colIndex) => (
          <div
            key={`${rowIndex}-${colIndex}`}
            className={`square ${isSquareLight(rowIndex, colIndex) ? 'light' : 'dark'} 
                       ${isSquareSelected(rowIndex, colIndex) ? 'selected' : ''} 
                       ${isValidMoveSquare(rowIndex, colIndex) ? 'valid-move' : ''}`}
            onClick={() => handleSquareClick(rowIndex, colIndex)}
            data-row={rowIndex}
            data-col={colIndex}
            style={{
              backgroundColor: isLastMoveDestination(rowIndex, colIndex) ? 'orange' : '',
              boxSizing: 'border-box'
            }}
          >
            <ChessPiece
              piece={piece}
              position={{ row: rowIndex, col: colIndex }}
              isSelected={isSquareSelected(rowIndex, colIndex)}
            />
          </div>
        ))
      )}
    </div>
  );
};

export default ChessBoard;