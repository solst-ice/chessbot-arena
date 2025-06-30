/**
 * Claude 3.5 Sonnet Chess Bot
 * 
 * Advanced chess bot implementing prioritized evaluation system:
 * 1. Checkmate detection
 * 2. Material evaluation
 * 3. King safety
 * 4. Center control
 * 5. Piece activity
 * 6. Pawn structure
 * 7. Tactical opportunities
 * 8. Strategic planning
 */

import { isValidMove, isInCheck, hasAnyLegalMove } from '../chess/moveValidation';
import { PIECE_TYPES, COLORS, PIECE_VALUES } from '../chess/gameState';

// Configuration constants
const SEARCH_DEPTH = 3;
const QUIESCENCE_DEPTH = 2;
const INFINITY = 100000;
const CHECKMATE_SCORE = 50000;
const TIME_LIMIT = 2000; // 2 seconds

// Evaluation weights (higher = more important)
const WEIGHTS = {
  CHECKMATE: 10000,
  MATERIAL: 100,
  KING_SAFETY: 50,
  CENTER_CONTROL: 30,
  PIECE_ACTIVITY: 20,
  PAWN_STRUCTURE: 15,
  TACTICS: 40,
  STRATEGY: 10
};

// Center squares for control evaluation
const CENTER_SQUARES = [
  { row: 3, col: 3 }, { row: 3, col: 4 },
  { row: 4, col: 3 }, { row: 4, col: 4 }
];

// Piece-square tables for positional evaluation (horizontal board)
const PIECE_SQUARE_TABLES = {
  [PIECE_TYPES.PAWN]: {
    [COLORS.WHITE]: [
      [0,  0,  0,  0,  0,  0,  0,  0],
      [50, 50, 50, 50, 50, 50, 50, 50],
      [10, 10, 20, 30, 30, 20, 10, 10],
      [5,  5, 10, 25, 25, 10,  5,  5],
      [0,  0,  0, 20, 20,  0,  0,  0],
      [5, -5,-10,  0,  0,-10, -5,  5],
      [5, 10, 10,-20,-20, 10, 10,  5],
      [0,  0,  0,  0,  0,  0,  0,  0]
    ],
    [COLORS.BLACK]: [
      [0,  0,  0,  0,  0,  0,  0,  0],
      [5, 10, 10,-20,-20, 10, 10,  5],
      [5, -5,-10,  0,  0,-10, -5,  5],
      [0,  0,  0, 20, 20,  0,  0,  0],
      [5,  5, 10, 25, 25, 10,  5,  5],
      [10, 10, 20, 30, 30, 20, 10, 10],
      [50, 50, 50, 50, 50, 50, 50, 50],
      [0,  0,  0,  0,  0,  0,  0,  0]
    ]
  },
  [PIECE_TYPES.KNIGHT]: [
    [-50,-40,-30,-30,-30,-30,-40,-50],
    [-40,-20,  0,  0,  0,  0,-20,-40],
    [-30,  0, 10, 15, 15, 10,  0,-30],
    [-30,  5, 15, 20, 20, 15,  5,-30],
    [-30,  0, 15, 20, 20, 15,  0,-30],
    [-30,  5, 10, 15, 15, 10,  5,-30],
    [-40,-20,  0,  5,  5,  0,-20,-40],
    [-50,-40,-30,-30,-30,-30,-40,-50]
  ],
  [PIECE_TYPES.BISHOP]: [
    [-20,-10,-10,-10,-10,-10,-10,-20],
    [-10,  0,  0,  0,  0,  0,  0,-10],
    [-10,  0,  5, 10, 10,  5,  0,-10],
    [-10,  5,  5, 10, 10,  5,  5,-10],
    [-10,  0, 10, 10, 10, 10,  0,-10],
    [-10, 10, 10, 10, 10, 10, 10,-10],
    [-10,  5,  0,  0,  0,  0,  5,-10],
    [-20,-10,-10,-10,-10,-10,-10,-20]
  ],
  [PIECE_TYPES.ROOK]: [
    [0,  0,  0,  0,  0,  0,  0,  0],
    [5, 10, 10, 10, 10, 10, 10,  5],
    [-5,  0,  0,  0,  0,  0,  0, -5],
    [-5,  0,  0,  0,  0,  0,  0, -5],
    [-5,  0,  0,  0,  0,  0,  0, -5],
    [-5,  0,  0,  0,  0,  0,  0, -5],
    [-5,  0,  0,  0,  0,  0,  0, -5],
    [0,  0,  0,  5,  5,  0,  0,  0]
  ],
  [PIECE_TYPES.QUEEN]: [
    [-20,-10,-10, -5, -5,-10,-10,-20],
    [-10,  0,  0,  0,  0,  0,  0,-10],
    [-10,  0,  5,  5,  5,  5,  0,-10],
    [ -5,  0,  5,  5,  5,  5,  0, -5],
    [  0,  0,  5,  5,  5,  5,  0, -5],
    [-10,  5,  5,  5,  5,  5,  0,-10],
    [-10,  0,  5,  0,  0,  0,  0,-10],
    [-20,-10,-10, -5, -5,-10,-10,-20]
  ],
  [PIECE_TYPES.KING]: {
    middlegame: [
      [-30,-40,-40,-50,-50,-40,-40,-30],
      [-30,-40,-40,-50,-50,-40,-40,-30],
      [-30,-40,-40,-50,-50,-40,-40,-30],
      [-30,-40,-40,-50,-50,-40,-40,-30],
      [-20,-30,-30,-40,-40,-30,-30,-20],
      [-10,-20,-20,-20,-20,-20,-20,-10],
      [ 20, 20,  0,  0,  0,  0, 20, 20],
      [ 20, 30, 10,  0,  0, 10, 30, 20]
    ],
    endgame: [
      [-50,-40,-30,-20,-20,-30,-40,-50],
      [-30,-20,-10,  0,  0,-10,-20,-30],
      [-30,-10, 20, 30, 30, 20,-10,-30],
      [-30,-10, 30, 40, 40, 30,-10,-30],
      [-30,-10, 30, 40, 40, 30,-10,-30],
      [-30,-10, 20, 30, 30, 20,-10,-30],
      [-30,-30,  0,  0,  0,  0,-30,-30],
      [-50,-30,-30,-30,-30,-30,-30,-50]
    ]
  }
};

// Opening book - common strong openings
const OPENING_BOOK = {
  white: {
    0: [ // First move
      { from: { row: 4, col: 1 }, to: { row: 4, col: 3 } }, // e4
      { from: { row: 3, col: 1 }, to: { row: 3, col: 3 } }, // d4
      { from: { row: 6, col: 0 }, to: { row: 5, col: 2 } }  // Nf3
    ]
  },
  black: {
    1: [ // Response to e4
      { from: { row: 4, col: 6 }, to: { row: 4, col: 5 } }, // e5
      { from: { row: 2, col: 6 }, to: { row: 2, col: 5 } }, // c5 (Sicilian)
      { from: { row: 4, col: 6 }, to: { row: 4, col: 4 } }  // e6 (French)
    ]
  }
};

// Main move selection function
export function makeMove(gameState, botColor) {
  const startTime = Date.now();
  
  // Check opening book
  if (gameState.moveHistory.length < 4) {
    const bookMove = getOpeningBookMove(gameState, botColor);
    if (bookMove) return bookMove;
  }
  
  // Get all valid moves
  const moves = getAllValidMoves(gameState, botColor);
  if (moves.length === 0) return null;
  if (moves.length === 1) return moves[0];
  
  // Iterative deepening search
  let bestMove = moves[0];
  let bestScore = -INFINITY;
  
  for (let depth = 1; depth <= SEARCH_DEPTH; depth++) {
    if (Date.now() - startTime > TIME_LIMIT * 0.8) break;
    
    let currentBestMove = null;
    let currentBestScore = -INFINITY;
    
    // Order moves for better pruning
    const orderedMoves = orderMoves(moves, gameState);
    
    for (const move of orderedMoves) {
      if (Date.now() - startTime > TIME_LIMIT * 0.9) break;
      
      const newState = makeTestGameState(gameState, move);
      const score = -minimax(newState, depth - 1, -INFINITY, INFINITY, false, botColor, startTime);
      
      if (score > currentBestScore) {
        currentBestScore = score;
        currentBestMove = move;
      }
    }
    
    if (currentBestMove && currentBestScore > bestScore) {
      bestScore = currentBestScore;
      bestMove = currentBestMove;
    }
  }
  
  return bestMove;
}

// Minimax with alpha-beta pruning
function minimax(gameState, depth, alpha, beta, isMaximizing, botColor, startTime) {
  // Time check
  if (Date.now() - startTime > TIME_LIMIT) {
    return evaluatePosition(gameState, botColor);
  }
  
  // Terminal node checks
  const currentColor = gameState.currentTurn;
  if (!hasAnyLegalMove(gameState.board, currentColor, gameState)) {
    if (isInCheck(gameState.board, currentColor)) {
      // Checkmate
      return isMaximizing ? -CHECKMATE_SCORE : CHECKMATE_SCORE;
    }
    // Stalemate
    return 0;
  }
  
  // Depth limit reached - enter quiescence search
  if (depth <= 0) {
    return quiescenceSearch(gameState, QUIESCENCE_DEPTH, alpha, beta, isMaximizing, botColor, startTime);
  }
  
  const moves = getAllValidMoves(gameState, currentColor);
  const orderedMoves = orderMoves(moves, gameState);
  
  if (isMaximizing) {
    let maxScore = -INFINITY;
    for (const move of orderedMoves) {
      const newState = makeTestGameState(gameState, move);
      const score = minimax(newState, depth - 1, alpha, beta, false, botColor, startTime);
      maxScore = Math.max(maxScore, score);
      alpha = Math.max(alpha, score);
      if (beta <= alpha) break; // Beta cutoff
    }
    return maxScore;
  } else {
    let minScore = INFINITY;
    for (const move of orderedMoves) {
      const newState = makeTestGameState(gameState, move);
      const score = minimax(newState, depth - 1, alpha, beta, true, botColor, startTime);
      minScore = Math.min(minScore, score);
      beta = Math.min(beta, score);
      if (beta <= alpha) break; // Alpha cutoff
    }
    return minScore;
  }
}

// Quiescence search to resolve tactical sequences
function quiescenceSearch(gameState, depth, alpha, beta, isMaximizing, botColor, startTime) {
  const standPat = evaluatePosition(gameState, botColor);
  
  if (depth <= 0 || Date.now() - startTime > TIME_LIMIT) {
    return standPat;
  }
  
  if (isMaximizing) {
    if (standPat >= beta) return beta;
    if (alpha < standPat) alpha = standPat;
  } else {
    if (standPat <= alpha) return alpha;
    if (beta > standPat) beta = standPat;
  }
  
  // Only consider captures and checks
  const moves = getAllValidMoves(gameState, gameState.currentTurn);
  const captureMoves = moves.filter(move => {
    const captured = gameState.board[move.to.row][move.to.col];
    return captured !== null;
  });
  
  if (captureMoves.length === 0) return standPat;
  
  const orderedMoves = orderMoves(captureMoves, gameState);
  
  if (isMaximizing) {
    let maxScore = standPat;
    for (const move of orderedMoves) {
      const newState = makeTestGameState(gameState, move);
      const score = quiescenceSearch(newState, depth - 1, alpha, beta, false, botColor, startTime);
      maxScore = Math.max(maxScore, score);
      alpha = Math.max(alpha, score);
      if (beta <= alpha) break;
    }
    return maxScore;
  } else {
    let minScore = standPat;
    for (const move of orderedMoves) {
      const newState = makeTestGameState(gameState, move);
      const score = quiescenceSearch(newState, depth - 1, alpha, beta, true, botColor, startTime);
      minScore = Math.min(minScore, score);
      beta = Math.min(beta, score);
      if (beta <= alpha) break;
    }
    return minScore;
  }
}

// Comprehensive position evaluation
function evaluatePosition(gameState, botColor) {
  let score = 0;
  
  // 1. Checkmate detection (highest priority)
  const currentColor = gameState.currentTurn;
  if (!hasAnyLegalMove(gameState.board, currentColor, gameState)) {
    if (isInCheck(gameState.board, currentColor)) {
      return currentColor === botColor ? -CHECKMATE_SCORE : CHECKMATE_SCORE;
    }
    return 0; // Stalemate
  }
  
  // 2. Material evaluation
  const material = evaluateMaterial(gameState.board, botColor);
  score += material * WEIGHTS.MATERIAL;
  
  // 3. King safety
  const kingSafety = evaluateKingSafety(gameState.board, botColor);
  score += kingSafety * WEIGHTS.KING_SAFETY;
  
  // 4. Center control
  const centerControl = evaluateCenterControl(gameState.board, botColor);
  score += centerControl * WEIGHTS.CENTER_CONTROL;
  
  // 5. Piece activity
  const pieceActivity = evaluatePieceActivity(gameState, botColor);
  score += pieceActivity * WEIGHTS.PIECE_ACTIVITY;
  
  // 6. Pawn structure
  const pawnStructure = evaluatePawnStructure(gameState.board, botColor);
  score += pawnStructure * WEIGHTS.PAWN_STRUCTURE;
  
  // 7. Tactical opportunities
  const tactics = evaluateTactics(gameState, botColor);
  score += tactics * WEIGHTS.TACTICS;
  
  // 8. Strategic planning
  const strategy = evaluateStrategy(gameState, botColor);
  score += strategy * WEIGHTS.STRATEGY;
  
  return score;
}

// Material balance calculation
function evaluateMaterial(board, botColor) {
  let whiteMaterial = 0;
  let blackMaterial = 0;
  
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col];
      if (!piece) continue;
      
      const value = PIECE_VALUES[piece.type];
      if (piece.color === COLORS.WHITE) {
        whiteMaterial += value;
      } else {
        blackMaterial += value;
      }
    }
  }
  
  return botColor === COLORS.WHITE ? whiteMaterial - blackMaterial : blackMaterial - whiteMaterial;
}

// King safety evaluation
function evaluateKingSafety(board, botColor) {
  let score = 0;
  
  // Find kings
  let botKing = null;
  let opponentKing = null;
  
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col];
      if (piece && piece.type === PIECE_TYPES.KING) {
        if (piece.color === botColor) {
          botKing = { row, col };
        } else {
          opponentKing = { row, col };
        }
      }
    }
  }
  
  // Evaluate pawn shield
  if (botKing) {
    score += evaluatePawnShield(board, botKing, botColor);
  }
  if (opponentKing) {
    score -= evaluatePawnShield(board, opponentKing, botColor === COLORS.WHITE ? COLORS.BLACK : COLORS.WHITE);
  }
  
  return score;
}

// Pawn shield evaluation
function evaluatePawnShield(board, kingPos, color) {
  let score = 0;
  const direction = color === COLORS.WHITE ? 1 : -1;
  
  // Check pawns in front of king
  for (let dRow = -1; dRow <= 1; dRow++) {
    const row = kingPos.row + dRow;
    const col = kingPos.col + direction;
    
    if (row >= 0 && row < 8 && col >= 0 && col < 8) {
      const piece = board[row][col];
      if (piece && piece.type === PIECE_TYPES.PAWN && piece.color === color) {
        score += 10;
      }
    }
  }
  
  return score;
}

// Center control evaluation
function evaluateCenterControl(board, botColor) {
  let score = 0;
  
  for (const square of CENTER_SQUARES) {
    const piece = board[square.row][square.col];
    if (piece) {
      if (piece.color === botColor) {
        score += 10;
        if (piece.type === PIECE_TYPES.PAWN) score += 5;
      } else {
        score -= 10;
        if (piece.type === PIECE_TYPES.PAWN) score -= 5;
      }
    }
    
    // Control evaluation (who attacks the square)
    const botControl = isSquareControlled(board, square, botColor);
    const oppControl = isSquareControlled(board, square, botColor === COLORS.WHITE ? COLORS.BLACK : COLORS.WHITE);
    
    if (botControl && !oppControl) score += 5;
    if (!botControl && oppControl) score -= 5;
  }
  
  return score;
}

// Check if a square is controlled by a color
function isSquareControlled(board, square, color) {
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col];
      if (piece && piece.color === color) {
        if (canPieceAttackSquare(board, { row, col }, square, piece)) {
          return true;
        }
      }
    }
  }
  return false;
}

// Simple attack check for control evaluation
function canPieceAttackSquare(board, from, to, piece) {
  const rowDiff = to.row - from.row;
  const colDiff = to.col - from.col;
  
  switch (piece.type) {
    case PIECE_TYPES.PAWN:
      const direction = piece.color === COLORS.WHITE ? 1 : -1;
      return Math.abs(rowDiff) === 1 && colDiff === direction;
      
    case PIECE_TYPES.KNIGHT:
      return (Math.abs(rowDiff) === 2 && Math.abs(colDiff) === 1) ||
             (Math.abs(rowDiff) === 1 && Math.abs(colDiff) === 2);
             
    case PIECE_TYPES.BISHOP:
      return Math.abs(rowDiff) === Math.abs(colDiff) && isPathClear(board, from, to);
      
    case PIECE_TYPES.ROOK:
      return (rowDiff === 0 || colDiff === 0) && isPathClear(board, from, to);
      
    case PIECE_TYPES.QUEEN:
      return ((rowDiff === 0 || colDiff === 0) || 
              (Math.abs(rowDiff) === Math.abs(colDiff))) && 
             isPathClear(board, from, to);
             
    case PIECE_TYPES.KING:
      return Math.abs(rowDiff) <= 1 && Math.abs(colDiff) <= 1;
      
    default:
      return false;
  }
}

// Check if path between squares is clear
function isPathClear(board, from, to) {
  const rowStep = to.row > from.row ? 1 : to.row < from.row ? -1 : 0;
  const colStep = to.col > from.col ? 1 : to.col < from.col ? -1 : 0;
  
  let row = from.row + rowStep;
  let col = from.col + colStep;
  
  while (row !== to.row || col !== to.col) {
    if (board[row][col]) return false;
    row += rowStep;
    col += colStep;
  }
  
  return true;
}

// Piece activity evaluation
function evaluatePieceActivity(gameState, botColor) {
  let score = 0;
  const board = gameState.board;
  
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col];
      if (!piece) continue;
      
      const mobility = countPieceMobility(gameState, { row, col });
      if (piece.color === botColor) {
        score += mobility;
        
        // Bonus for developed pieces
        if (piece.type === PIECE_TYPES.KNIGHT || piece.type === PIECE_TYPES.BISHOP) {
          const startCol = piece.color === COLORS.WHITE ? 0 : 7;
          if (col !== startCol) score += 10;
        }
      } else {
        score -= mobility;
      }
    }
  }
  
  return score;
}

// Count legal moves for a piece
function countPieceMobility(gameState, from) {
  let count = 0;
  
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const to = { row, col };
      if (isValidMove(gameState.board, from, to, gameState)) {
        count++;
      }
    }
  }
  
  return count;
}

// Pawn structure evaluation
function evaluatePawnStructure(board, botColor) {
  let score = 0;
  
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col];
      if (piece && piece.type === PIECE_TYPES.PAWN) {
        if (piece.color === botColor) {
          // Passed pawn bonus
          if (isPassedPawn(board, row, col, piece.color)) {
            const advancement = piece.color === COLORS.WHITE ? col : 7 - col;
            score += 10 + advancement * 5;
          }
          
          // Isolated pawn penalty
          if (isIsolatedPawn(board, row, col, piece.color)) {
            score -= 10;
          }
          
          // Doubled pawn penalty
          if (isDoubledPawn(board, row, col, piece.color)) {
            score -= 8;
          }
        } else {
          // Same evaluations for opponent pawns
          if (isPassedPawn(board, row, col, piece.color)) {
            const advancement = piece.color === COLORS.WHITE ? col : 7 - col;
            score -= 10 + advancement * 5;
          }
          if (isIsolatedPawn(board, row, col, piece.color)) {
            score += 10;
          }
          if (isDoubledPawn(board, row, col, piece.color)) {
            score += 8;
          }
        }
      }
    }
  }
  
  return score;
}

// Check if pawn is passed
function isPassedPawn(board, row, col, color) {
  const direction = color === COLORS.WHITE ? 1 : -1;
  const endCol = color === COLORS.WHITE ? 7 : 0;
  
  // Check all columns ahead
  for (let c = col + direction; color === COLORS.WHITE ? c <= endCol : c >= endCol; c += direction) {
    // Check three files
    for (let r = row - 1; r <= row + 1; r++) {
      if (r >= 0 && r < 8) {
        const piece = board[r][c];
        if (piece && piece.type === PIECE_TYPES.PAWN && piece.color !== color) {
          return false;
        }
      }
    }
  }
  
  return true;
}

// Check if pawn is isolated
function isIsolatedPawn(board, row, col, color) {
  // Check adjacent files
  for (let r = row - 1; r <= row + 1; r += 2) {
    if (r >= 0 && r < 8) {
      for (let c = 0; c < 8; c++) {
        const piece = board[r][c];
        if (piece && piece.type === PIECE_TYPES.PAWN && piece.color === color) {
          return false;
        }
      }
    }
  }
  
  return true;
}

// Check if pawn is doubled
function isDoubledPawn(board, row, col, color) {
  // Check same file
  for (let c = 0; c < 8; c++) {
    if (c !== col) {
      const piece = board[row][c];
      if (piece && piece.type === PIECE_TYPES.PAWN && piece.color === color) {
        return true;
      }
    }
  }
  
  return false;
}

// Tactical opportunities evaluation
function evaluateTactics(gameState, botColor) {
  let score = 0;
  const board = gameState.board;
  
  // Check for forks, pins, skewers
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col];
      if (!piece) continue;
      
      if (piece.color === botColor) {
        // Fork detection
        if (piece.type === PIECE_TYPES.KNIGHT || piece.type === PIECE_TYPES.PAWN) {
          const attacks = countAttackedPieces(gameState.board, { row, col }, piece);
          if (attacks >= 2) score += 20;
        }
        
        // Pin/skewer detection for sliding pieces
        if ([PIECE_TYPES.BISHOP, PIECE_TYPES.ROOK, PIECE_TYPES.QUEEN].includes(piece.type)) {
          score += detectPinsAndSkewers(gameState.board, { row, col }, piece) * 15;
        }
      }
    }
  }
  
  return score;
}

// Count pieces attacked by a piece
function countAttackedPieces(board, from, piece) {
  let count = 0;
  const opponentColor = piece.color === COLORS.WHITE ? COLORS.BLACK : COLORS.WHITE;
  
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const target = board[row][col];
      if (target && target.color === opponentColor) {
        if (canPieceAttackSquare(board, from, { row, col }, piece)) {
          count++;
        }
      }
    }
  }
  
  return count;
}

// Detect pins and skewers
function detectPinsAndSkewers(board, from, piece) {
  let count = 0;
  const directions = [];
  
  if (piece.type === PIECE_TYPES.BISHOP || piece.type === PIECE_TYPES.QUEEN) {
    directions.push([1, 1], [1, -1], [-1, 1], [-1, -1]);
  }
  if (piece.type === PIECE_TYPES.ROOK || piece.type === PIECE_TYPES.QUEEN) {
    directions.push([0, 1], [0, -1], [1, 0], [-1, 0]);
  }
  
  for (const [dRow, dCol] of directions) {
    const pieces = [];
    let row = from.row + dRow;
    let col = from.col + dCol;
    
    while (row >= 0 && row < 8 && col >= 0 && col < 8) {
      const target = board[row][col];
      if (target) {
        if (target.color !== piece.color) {
          pieces.push({ piece: target, pos: { row, col } });
          if (pieces.length >= 2) break;
        } else {
          break;
        }
      }
      row += dRow;
      col += dCol;
    }
    
    // Check if we have a pin or skewer
    if (pieces.length === 2) {
      const values = pieces.map(p => PIECE_VALUES[p.piece.type]);
      if (values[0] < values[1]) count++; // Pin
      if (values[0] > values[1]) count++; // Skewer
    }
  }
  
  return count;
}

// Strategic planning evaluation
function evaluateStrategy(gameState, botColor) {
  let score = 0;
  
  // Rooks on open files
  score += evaluateRookPlacement(gameState.board, botColor);
  
  // Bishop pair advantage
  score += evaluateBishopPair(gameState.board, botColor);
  
  // Knight outposts
  score += evaluateKnightOutposts(gameState.board, botColor);
  
  return score;
}

// Evaluate rook placement
function evaluateRookPlacement(board, botColor) {
  let score = 0;
  
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col];
      if (piece && piece.type === PIECE_TYPES.ROOK) {
        // Check if file is open or semi-open
        let ownPawns = 0;
        let oppPawns = 0;
        
        for (let c = 0; c < 8; c++) {
          const p = board[row][c];
          if (p && p.type === PIECE_TYPES.PAWN) {
            if (p.color === piece.color) ownPawns++;
            else oppPawns++;
          }
        }
        
        if (piece.color === botColor) {
          if (ownPawns === 0 && oppPawns === 0) score += 20; // Open file
          else if (ownPawns === 0) score += 10; // Semi-open file
        } else {
          if (ownPawns === 0 && oppPawns === 0) score -= 20;
          else if (oppPawns === 0) score -= 10;
        }
      }
    }
  }
  
  return score;
}

// Evaluate bishop pair
function evaluateBishopPair(board, botColor) {
  let whiteBishops = 0;
  let blackBishops = 0;
  
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col];
      if (piece && piece.type === PIECE_TYPES.BISHOP) {
        if (piece.color === COLORS.WHITE) whiteBishops++;
        else blackBishops++;
      }
    }
  }
  
  if (botColor === COLORS.WHITE && whiteBishops >= 2) return 15;
  if (botColor === COLORS.BLACK && blackBishops >= 2) return 15;
  if (botColor === COLORS.WHITE && blackBishops >= 2) return -15;
  if (botColor === COLORS.BLACK && whiteBishops >= 2) return -15;
  
  return 0;
}

// Evaluate knight outposts
function evaluateKnightOutposts(board, botColor) {
  let score = 0;
  
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col];
      if (piece && piece.type === PIECE_TYPES.KNIGHT) {
        // Check if knight is on an outpost (protected and can't be attacked by pawns)
        const isOutpost = isKnightOnOutpost(board, { row, col }, piece.color);
        
        if (piece.color === botColor && isOutpost) score += 20;
        else if (piece.color !== botColor && isOutpost) score -= 20;
      }
    }
  }
  
  return score;
}

// Check if knight is on an outpost
function isKnightOnOutpost(board, pos, color) {
  const opponentColor = color === COLORS.WHITE ? COLORS.BLACK : COLORS.WHITE;
  const direction = color === COLORS.WHITE ? 1 : -1;
  
  // Check if protected by a pawn
  let isProtected = false;
  for (let dRow = -1; dRow <= 1; dRow += 2) {
    const row = pos.row + dRow;
    const col = pos.col - direction;
    
    if (row >= 0 && row < 8 && col >= 0 && col < 8) {
      const piece = board[row][col];
      if (piece && piece.type === PIECE_TYPES.PAWN && piece.color === color) {
        isProtected = true;
        break;
      }
    }
  }
  
  if (!isProtected) return false;
  
  // Check if can be attacked by opponent pawns
  for (let dRow = -1; dRow <= 1; dRow += 2) {
    const row = pos.row + dRow;
    const col = pos.col + direction;
    
    if (row >= 0 && row < 8 && col >= 0 && col < 8) {
      const piece = board[row][col];
      if (piece && piece.type === PIECE_TYPES.PAWN && piece.color === opponentColor) {
        return false;
      }
    }
  }
  
  return true;
}

// Get all valid moves for a color
function getAllValidMoves(gameState, color) {
  const moves = [];
  
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = gameState.board[row][col];
      if (!piece || piece.color !== color) continue;
      
      for (let toRow = 0; toRow < 8; toRow++) {
        for (let toCol = 0; toCol < 8; toCol++) {
          const from = { row, col };
          const to = { row: toRow, col: toCol };
          
          if (isValidMove(gameState.board, from, to, gameState)) {
            const testBoard = makeTestMove(gameState.board, from, to);
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

// Create test game state
function makeTestGameState(gameState, move) {
  const newBoard = makeTestMove(gameState.board, move.from, move.to);
  
  return {
    board: newBoard,
    currentTurn: gameState.currentTurn === COLORS.WHITE ? COLORS.BLACK : COLORS.WHITE,
    enPassantTarget: null,
    castlingRights: gameState.castlingRights,
    moveHistory: [],
    whitePlayer: gameState.whitePlayer,
    blackPlayer: gameState.blackPlayer,
    capturedPieces: gameState.capturedPieces,
    gameStatus: 'playing'
  };
}

// Make test move on board
function makeTestMove(board, from, to) {
  const newBoard = board.map(row => [...row]);
  newBoard[to.row][to.col] = newBoard[from.row][from.col];
  newBoard[from.row][from.col] = null;
  return newBoard;
}

// Move ordering for better pruning
function orderMoves(moves, gameState) {
  const scoredMoves = moves.map(move => {
    let score = 0;
    const from = gameState.board[move.from.row][move.from.col];
    const to = gameState.board[move.to.row][move.to.col];
    
    // MVV-LVA for captures
    if (to) {
      score += 100 * PIECE_VALUES[to.type] - PIECE_VALUES[from.type];
    }
    
    // Promotions
    if (from.type === PIECE_TYPES.PAWN) {
      const promotionCol = from.color === COLORS.WHITE ? 7 : 0;
      if (move.to.col === promotionCol) {
        score += 900;
      }
    }
    
    // Center moves
    if (CENTER_SQUARES.some(s => s.row === move.to.row && s.col === move.to.col)) {
      score += 30;
    }
    
    // Castling
    if (from.type === PIECE_TYPES.KING && Math.abs(move.to.row - move.from.row) === 2) {
      score += 50;
    }
    
    return { move, score };
  });
  
  scoredMoves.sort((a, b) => b.score - a.score);
  return scoredMoves.map(sm => sm.move);
}

// Get opening book move
function getOpeningBookMove(gameState, botColor) {
  const moveCount = gameState.moveHistory.length;
  const book = botColor === COLORS.WHITE ? OPENING_BOOK.white : OPENING_BOOK.black;
  
  if (book && book[moveCount]) {
    const moves = book[moveCount];
    const validMoves = moves.filter(move => 
      isValidMove(gameState.board, move.from, move.to, gameState)
    );
    
    if (validMoves.length > 0) {
      return validMoves[Math.floor(Math.random() * validMoves.length)];
    }
  }
  
  return null;
}

// Position-specific evaluation using piece-square tables
function getPositionValue(piece, row, col, isEndgame) {
  const table = PIECE_SQUARE_TABLES[piece.type];
  if (!table) return 0;
  
  if (piece.type === PIECE_TYPES.PAWN) {
    return table[piece.color][row][col] / 10;
  } else if (piece.type === PIECE_TYPES.KING) {
    const kingTable = isEndgame ? table.endgame : table.middlegame;
    return kingTable[row][col] / 10;
  } else {
    return table[row][col] / 10;
  }
}