/**
 * Grok 3 Mini Chess Bot - Fixed Version
 * 
 * A chess bot that uses minimax with alpha-beta pruning
 */

import { isValidMove, isInCheck } from '../chess/moveValidation';
import { PIECE_VALUES } from '../chess/gameState';

// Piece-square tables for positional evaluation
const PIECE_SQUARE_TABLES = {
  pawn: [
    [0,  0,  0,  0,  0,  0,  0,  0],
    [50, 50, 50, 50, 50, 50, 50, 50],
    [10, 10, 20, 30, 30, 20, 10, 10],
    [5,  5, 10, 25, 25, 10,  5,  5],
    [0,  0,  0, 20, 20,  0,  0,  0],
    [5, -5,-10,  0,  0,-10, -5,  5],
    [5, 10, 10,-20,-20, 10, 10,  5],
    [0,  0,  0,  0,  0,  0,  0,  0]
  ],
  knight: [
    [-50,-40,-30,-30,-30,-30,-40,-50],
    [-40,-20,  0,  0,  0,  0,-20,-40],
    [-30,  0, 10, 15, 15, 10,  0,-30],
    [-30,  5, 15, 20, 20, 15,  5,-30],
    [-30,  0, 15, 20, 20, 15,  0,-30],
    [-30,  5, 10, 15, 15, 10,  5,-30],
    [-40,-20,  0,  5,  5,  0,-20,-40],
    [-50,-40,-30,-30,-30,-30,-40,-50]
  ],
  bishop: [
    [-20,-10,-10,-10,-10,-10,-10,-20],
    [-10,  0,  0,  0,  0,  0,  0,-10],
    [-10,  0,  5, 10, 10,  5,  0,-10],
    [-10,  5,  5, 10, 10,  5,  5,-10],
    [-10,  0, 10, 10, 10, 10,  0,-10],
    [-10, 10, 10, 10, 10, 10, 10,-10],
    [-10,  5,  0,  0,  0,  0,  5,-10],
    [-20,-10,-10,-10,-10,-10,-10,-20]
  ],
  rook: [
    [0,  0,  0,  0,  0,  0,  0,  0],
    [5, 10, 10, 10, 10, 10, 10,  5],
    [-5,  0,  0,  0,  0,  0,  0, -5],
    [-5,  0,  0,  0,  0,  0,  0, -5],
    [-5,  0,  0,  0,  0,  0,  0, -5],
    [-5,  0,  0,  0,  0,  0,  0, -5],
    [-5,  0,  0,  0,  0,  0,  0, -5],
    [0,  0,  0,  5,  5,  0,  0,  0]
  ],
  queen: [
    [-20,-10,-10, -5, -5,-10,-10,-20],
    [-10,  0,  0,  0,  0,  0,  0,-10],
    [-10,  0,  5,  5,  5,  5,  0,-10],
    [-5,  0,  5,  5,  5,  5,  0, -5],
    [0,  0,  5,  5,  5,  5,  0, -5],
    [-10,  5,  5,  5,  5,  5,  0,-10],
    [-10,  0,  5,  0,  0,  0,  0,-10],
    [-20,-10,-10, -5, -5,-10,-10,-20]
  ],
  king: [
    [-30,-40,-40,-50,-50,-40,-40,-30],
    [-30,-40,-40,-50,-50,-40,-40,-30],
    [-30,-40,-40,-50,-50,-40,-40,-30],
    [-30,-40,-40,-50,-50,-40,-40,-30],
    [-20,-30,-30,-40,-40,-30,-30,-20],
    [-10,-20,-20,-20,-20,-20,-20,-10],
    [20, 20,  0,  0,  0,  0, 20, 20],
    [20, 30, 10,  0,  0, 10, 30, 20]
  ]
};

// Get all legal moves for the current player
function getLegalMoves(board, color, gameState) {
  const moves = [];
  
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col];
      if (!piece || piece.color !== color) continue;
      
      for (let toRow = 0; toRow < 8; toRow++) {
        for (let toCol = 0; toCol < 8; toCol++) {
          const from = { row, col };
          const to = { row: toRow, col: toCol };
          
          if (isValidMove(board, from, to, gameState)) {
            // Test if move leaves king in check
            const testBoard = applyMoveToBoard(board, from, to);
            if (!isInCheck(testBoard, color)) {
              moves.push({ from, to });
            }
          }
        }
      }
    }
  }
  
  return moves;
}

// Apply a move to the board and return new board
function applyMoveToBoard(board, from, to) {
  const newBoard = board.map(row => [...row]);
  newBoard[to.row][to.col] = newBoard[from.row][from.col];
  newBoard[from.row][from.col] = null;
  return newBoard;
}

// Evaluate board position
function evaluateBoard(board) {
  let score = 0;
  
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col];
      if (!piece) continue;
      
      // Material value
      let pieceValue = PIECE_VALUES[piece.type] * 100;
      
      // Position value
      const table = PIECE_SQUARE_TABLES[piece.type];
      if (table) {
        const tableRow = piece.color === 'white' ? row : 7 - row;
        pieceValue += table[tableRow][col];
      }
      
      // Add or subtract based on color
      score += piece.color === 'white' ? pieceValue : -pieceValue;
    }
  }
  
  return score;
}

// Minimax with alpha-beta pruning
function minimax(board, gameState, depth, alpha, beta, maximizingPlayer, botColor) {
  // Base case: evaluate board
  if (depth === 0) {
    const evaluation = evaluateBoard(board);
    return { score: botColor === 'white' ? evaluation : -evaluation, move: null };
  }
  
  const currentColor = maximizingPlayer ? botColor : (botColor === 'white' ? 'black' : 'white');
  const moves = getLegalMoves(board, currentColor, gameState);
  
  // No legal moves - checkmate or stalemate
  if (moves.length === 0) {
    if (isInCheck(board, currentColor)) {
      // Checkmate
      return { score: maximizingPlayer ? -10000 : 10000, move: null };
    }
    // Stalemate
    return { score: 0, move: null };
  }
  
  let bestMove = moves[0];
  
  if (maximizingPlayer) {
    let maxEval = -Infinity;
    
    for (const move of moves) {
      const newBoard = applyMoveToBoard(board, move.from, move.to);
      const newGameState = {
        ...gameState,
        board: newBoard,
        currentTurn: gameState.currentTurn === 'white' ? 'black' : 'white'
      };
      
      const evaluation = minimax(newBoard, newGameState, depth - 1, alpha, beta, false, botColor);
      
      if (evaluation.score > maxEval) {
        maxEval = evaluation.score;
        bestMove = move;
      }
      
      alpha = Math.max(alpha, evaluation.score);
      if (beta <= alpha) break; // Beta cutoff
    }
    
    return { score: maxEval, move: bestMove };
  } else {
    let minEval = Infinity;
    
    for (const move of moves) {
      const newBoard = applyMoveToBoard(board, move.from, move.to);
      const newGameState = {
        ...gameState,
        board: newBoard,
        currentTurn: gameState.currentTurn === 'white' ? 'black' : 'white'
      };
      
      const evaluation = minimax(newBoard, newGameState, depth - 1, alpha, beta, true, botColor);
      
      if (evaluation.score < minEval) {
        minEval = evaluation.score;
        bestMove = move;
      }
      
      beta = Math.min(beta, evaluation.score);
      if (beta <= alpha) break; // Alpha cutoff
    }
    
    return { score: minEval, move: bestMove };
  }
}

// Main bot function
export function makeMove(gameState, botColor) {
  // Simple opening moves
  if (!gameState.moveHistory || gameState.moveHistory.length < 2) {
    if (botColor === 'white' && gameState.moveHistory.length === 0) {
      // White's first move
      const openingMoves = [
        { from: { row: 1, col: 4 }, to: { row: 3, col: 4 } }, // e4
        { from: { row: 1, col: 3 }, to: { row: 3, col: 3 } }, // d4
      ];
      const move = openingMoves[Math.floor(Math.random() * openingMoves.length)];
      if (isValidMove(gameState.board, move.from, move.to, gameState)) {
        return move;
      }
    } else if (botColor === 'black' && gameState.moveHistory.length === 1) {
      // Black's first move
      const openingMoves = [
        { from: { row: 6, col: 4 }, to: { row: 4, col: 4 } }, // e5
        { from: { row: 6, col: 3 }, to: { row: 4, col: 3 } }, // d5
      ];
      const move = openingMoves[Math.floor(Math.random() * openingMoves.length)];
      if (isValidMove(gameState.board, move.from, move.to, gameState)) {
        return move;
      }
    }
  }
  
  // Use minimax for the rest of the game
  const depth = gameState.moveHistory.length < 10 ? 3 : 4; // Deeper search in midgame
  const result = minimax(gameState.board, gameState, depth, -Infinity, Infinity, true, botColor);
  
  return result.move;
}