/**
 * Example Random Bot
 * 
 * This is a simple example bot that makes random valid moves.
 * It demonstrates the minimum requirements for a working bot.
 */

import { isValidMove, isInCheck } from '../chess/moveValidation';

export function makeMove(gameState, botColor) {
  const validMoves = [];
  
  // Find all valid moves
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = gameState.board[row][col];
      
      if (!piece || piece.color !== botColor) continue;
      
      for (let toRow = 0; toRow < 8; toRow++) {
        for (let toCol = 0; toCol < 8; toCol++) {
          const from = { row, col };
          const to = { row: toRow, col: toCol };
          
          if (isValidMove(gameState.board, from, to, gameState)) {
            // Test if move leaves king in check
            const testBoard = gameState.board.map(r => [...r]);
            testBoard[to.row][to.col] = testBoard[from.row][from.col];
            testBoard[from.row][from.col] = null;
            
            if (!isInCheck(testBoard, botColor)) {
              validMoves.push({ from, to });
            }
          }
        }
      }
    }
  }
  
  // Return random valid move
  if (validMoves.length > 0) {
    const randomIndex = Math.floor(Math.random() * validMoves.length);
    return validMoves[randomIndex];
  }
  
  return null;
}