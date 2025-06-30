/**
 * Claude Opus 4 Chess Bot
 * 
 * Advanced chess engine with sophisticated evaluation and search algorithms.
 * Implements prioritized decision-making with emphasis on tactical awareness
 * and strategic understanding.
 */

import { isValidMove, isInCheck, hasAnyLegalMove } from '../chess/moveValidation';
import { PIECE_TYPES, COLORS, PIECE_VALUES } from '../chess/gameState';

// Configuration
const MAX_DEPTH = 4;
const QUIESCENCE_DEPTH = 3;
const TIME_LIMIT = 1800; // 1.8 seconds to ensure we finish in time
const INFINITY = 1000000;
const MATE_SCORE = 100000;

// Evaluation weights - carefully tuned for priority system
const WEIGHTS = {
  CHECKMATE: 100000,
  MATERIAL: 1000,
  KING_SAFETY: 500,
  CENTER_CONTROL: 300,
  PIECE_ACTIVITY: 200,
  PAWN_STRUCTURE: 150,
  TACTICS: 400,
  STRATEGY: 100
};

// Transposition table for caching positions
const transpositionTable = new Map();
const MAX_TABLE_SIZE = 100000;

// Killer moves for move ordering
const killerMoves = Array(MAX_DEPTH).fill(null).map(() => [null, null]);

// History heuristic for move ordering
const historyTable = {};

// Center squares - critical for control
const CENTER_SQUARES = [
  { row: 3, col: 3 }, { row: 3, col: 4 },
  { row: 4, col: 3 }, { row: 4, col: 4 }
];

const EXTENDED_CENTER = [
  { row: 2, col: 2 }, { row: 2, col: 3 }, { row: 2, col: 4 }, { row: 2, col: 5 },
  { row: 3, col: 2 }, { row: 3, col: 3 }, { row: 3, col: 4 }, { row: 3, col: 5 },
  { row: 4, col: 2 }, { row: 4, col: 3 }, { row: 4, col: 4 }, { row: 4, col: 5 },
  { row: 5, col: 2 }, { row: 5, col: 3 }, { row: 5, col: 4 }, { row: 5, col: 5 }
];

// Enhanced piece-square tables for horizontal board
const PST = {
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

// Opening book - strong openings
const OPENING_BOOK = {
  "": ["e2e4", "d2d4", "Nf3", "c2c4"], // First moves
  "e2e4": ["e7e5", "c7c5", "e7e6", "c7c6", "d7d5"], // Responses to e4
  "d2d4": ["d7d5", "Nf6", "e7e6", "f7f5"], // Responses to d4
  "e2e4 e7e5": ["Nf3", "Bc4", "f2f4"], // Italian, King's Gambit
  "d2d4 d7d5": ["c2c4", "Nf3", "Bf4"], // Queen's Gambit, London
};

// Main entry point
export function makeMove(gameState, botColor) {
  const startTime = Date.now();
  clearOldTranspositions();
  
  // Check opening book
  const bookMove = getOpeningBookMove(gameState);
  if (bookMove) {
    return bookMove;
  }
  
  // Get legal moves
  const moves = generateLegalMoves(gameState, botColor);
  if (moves.length === 0) return null;
  if (moves.length === 1) return moves[0];
  
  // Check for immediate checkmate
  for (const move of moves) {
    const testState = applyMove(gameState, move);
    if (isCheckmate(testState)) {
      return move;
    }
  }
  
  // Iterative deepening search
  let bestMove = moves[0];
  let bestScore = -INFINITY;
  
  for (let depth = 1; depth <= MAX_DEPTH; depth++) {
    if (Date.now() - startTime > TIME_LIMIT * 0.7) break;
    
    let currentBest = null;
    let currentScore = -INFINITY;
    
    // Order moves for better pruning
    const orderedMoves = orderMoves(moves, gameState, depth);
    
    for (const move of orderedMoves) {
      if (Date.now() - startTime > TIME_LIMIT * 0.9) break;
      
      const testState = applyMove(gameState, move);
      const score = -alphaBeta(testState, depth - 1, -INFINITY, INFINITY, false, botColor, startTime);
      
      // Update history heuristic
      if (score > currentScore) {
        currentScore = score;
        currentBest = move;
        updateHistoryTable(move, depth);
      }
      
      // Beta cutoff at root
      if (score > bestScore) {
        bestScore = score;
        bestMove = move;
      }
    }
    
    // Update killer moves
    if (currentBest) {
      updateKillerMoves(currentBest, 0);
    }
  }
  
  return bestMove;
}

// Alpha-beta search with enhancements
function alphaBeta(gameState, depth, alpha, beta, maximizing, botColor, startTime) {
  // Time check
  if (Date.now() - startTime > TIME_LIMIT) {
    return evaluate(gameState, botColor);
  }
  
  // Transposition table lookup
  const hash = hashPosition(gameState);
  const ttEntry = transpositionTable.get(hash);
  if (ttEntry && ttEntry.depth >= depth) {
    if (ttEntry.type === 'exact') return ttEntry.score;
    if (ttEntry.type === 'lower' && ttEntry.score > alpha) alpha = ttEntry.score;
    if (ttEntry.type === 'upper' && ttEntry.score < beta) beta = ttEntry.score;
    if (alpha >= beta) return ttEntry.score;
  }
  
  // Check terminal nodes
  const currentColor = gameState.currentTurn;
  if (isCheckmate(gameState)) {
    return maximizing ? -MATE_SCORE + depth : MATE_SCORE - depth;
  }
  
  if (isDraw(gameState)) {
    return 0;
  }
  
  // Depth limit - enter quiescence
  if (depth <= 0) {
    return quiescence(gameState, QUIESCENCE_DEPTH, alpha, beta, maximizing, botColor, startTime);
  }
  
  // Generate and order moves
  const moves = generateLegalMoves(gameState, currentColor);
  if (moves.length === 0) {
    return isInCheck(gameState.board, currentColor) ? -MATE_SCORE + depth : 0;
  }
  
  const orderedMoves = orderMoves(moves, gameState, depth);
  
  let bestScore = maximizing ? -INFINITY : INFINITY;
  let ttType = 'upper';
  
  for (const move of orderedMoves) {
    const testState = applyMove(gameState, move);
    const score = alphaBeta(testState, depth - 1, alpha, beta, !maximizing, botColor, startTime);
    
    if (maximizing) {
      if (score > bestScore) {
        bestScore = score;
        if (score > alpha) {
          alpha = score;
          ttType = 'exact';
        }
      }
    } else {
      if (score < bestScore) {
        bestScore = score;
        if (score < beta) {
          beta = score;
          ttType = 'exact';
        }
      }
    }
    
    if (alpha >= beta) {
      updateKillerMoves(move, depth);
      ttType = maximizing ? 'lower' : 'upper';
      break;
    }
  }
  
  // Store in transposition table
  transpositionTable.set(hash, {
    score: bestScore,
    depth: depth,
    type: ttType
  });
  
  return bestScore;
}

// Quiescence search to avoid horizon effect
function quiescence(gameState, depth, alpha, beta, maximizing, botColor, startTime) {
  if (depth <= 0 || Date.now() - startTime > TIME_LIMIT) {
    return evaluate(gameState, botColor);
  }
  
  const standPat = evaluate(gameState, botColor);
  
  if (maximizing) {
    if (standPat >= beta) return beta;
    if (alpha < standPat) alpha = standPat;
  } else {
    if (standPat <= alpha) return alpha;
    if (beta > standPat) beta = standPat;
  }
  
  // Only consider captures and checks
  const moves = generateLegalMoves(gameState, gameState.currentTurn);
  const tacticalMoves = moves.filter(move => {
    const captured = gameState.board[move.to.row][move.to.col];
    const testState = applyMove(gameState, move);
    return captured || isInCheck(testState.board, testState.currentTurn);
  });
  
  if (tacticalMoves.length === 0) return standPat;
  
  const orderedMoves = orderMoves(tacticalMoves, gameState, 0);
  
  for (const move of orderedMoves) {
    const testState = applyMove(gameState, move);
    const score = quiescence(testState, depth - 1, alpha, beta, !maximizing, botColor, startTime);
    
    if (maximizing) {
      if (score >= beta) return beta;
      if (score > alpha) alpha = score;
    } else {
      if (score <= alpha) return alpha;
      if (score < beta) beta = score;
    }
  }
  
  return maximizing ? alpha : beta;
}

// Comprehensive evaluation function
function evaluate(gameState, botColor) {
  let score = 0;
  
  // 1. Checkmate/Stalemate (highest priority)
  if (isCheckmate(gameState)) {
    return gameState.currentTurn === botColor ? -MATE_SCORE : MATE_SCORE;
  }
  
  if (isDraw(gameState)) {
    return 0;
  }
  
  // 2. Material balance
  const material = evaluateMaterial(gameState.board);
  score += material * WEIGHTS.MATERIAL;
  
  // 3. King safety
  const kingSafety = evaluateKingSafety(gameState);
  score += kingSafety * WEIGHTS.KING_SAFETY;
  
  // 4. Center control
  const centerControl = evaluateCenterControl(gameState.board);
  score += centerControl * WEIGHTS.CENTER_CONTROL;
  
  // 5. Piece activity
  const activity = evaluatePieceActivity(gameState);
  score += activity * WEIGHTS.PIECE_ACTIVITY;
  
  // 6. Pawn structure
  const pawnStructure = evaluatePawnStructure(gameState.board);
  score += pawnStructure * WEIGHTS.PAWN_STRUCTURE;
  
  // 7. Tactical opportunities
  const tactics = evaluateTactics(gameState);
  score += tactics * WEIGHTS.TACTICS;
  
  // 8. Strategic factors
  const strategy = evaluateStrategy(gameState);
  score += strategy * WEIGHTS.STRATEGY;
  
  // Adjust for side to move
  return botColor === COLORS.WHITE ? score : -score;
}

// Material evaluation with piece-square tables
function evaluateMaterial(board) {
  let score = 0;
  let totalPieces = 0;
  
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col];
      if (!piece) continue;
      
      totalPieces++;
      const pieceValue = PIECE_VALUES[piece.type];
      const posValue = getPieceSquareValue(piece, row, col, totalPieces < 16);
      
      const totalValue = pieceValue + posValue * 0.1;
      score += piece.color === COLORS.WHITE ? totalValue : -totalValue;
    }
  }
  
  return score;
}

// Get piece-square table value
function getPieceSquareValue(piece, row, col, isEndgame) {
  const table = PST[piece.type];
  if (!table) return 0;
  
  if (piece.type === PIECE_TYPES.PAWN) {
    return table[piece.color][row][col];
  } else if (piece.type === PIECE_TYPES.KING) {
    const kingTable = isEndgame ? table.endgame : table.middlegame;
    return kingTable[row][col];
  } else {
    return table[row][col];
  }
}

// King safety evaluation
function evaluateKingSafety(gameState) {
  let score = 0;
  const board = gameState.board;
  
  // Find kings
  const kings = findKings(board);
  
  // Evaluate each king's safety
  for (const color of [COLORS.WHITE, COLORS.BLACK]) {
    const king = kings[color];
    if (!king) continue;
    
    let safety = 0;
    
    // Pawn shield
    safety += evaluatePawnShield(board, king, color) * 10;
    
    // King exposure (open files/diagonals)
    safety -= countKingExposure(board, king, color) * 5;
    
    // Enemy piece proximity
    safety -= countAttackingPieces(board, king, color) * 15;
    
    // Castling rights bonus
    if (gameState.castlingRights) {
      if (color === COLORS.WHITE) {
        if (gameState.castlingRights.whiteKingSide || gameState.castlingRights.whiteQueenSide) {
          safety += 10;
        }
      } else {
        if (gameState.castlingRights.blackKingSide || gameState.castlingRights.blackQueenSide) {
          safety += 10;
        }
      }
    }
    
    score += color === COLORS.WHITE ? safety : -safety;
  }
  
  return score;
}

// Find both kings
function findKings(board) {
  const kings = {};
  
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col];
      if (piece && piece.type === PIECE_TYPES.KING) {
        kings[piece.color] = { row, col };
      }
    }
  }
  
  return kings;
}

// Evaluate pawn shield around king
function evaluatePawnShield(board, kingPos, color) {
  let shield = 0;
  const direction = color === COLORS.WHITE ? 1 : -1;
  
  // Check pawns in front of king
  for (let dRow = -1; dRow <= 1; dRow++) {
    const row = kingPos.row + dRow;
    const col = kingPos.col + direction;
    
    if (isValidSquare(row, col)) {
      const piece = board[row][col];
      if (piece && piece.type === PIECE_TYPES.PAWN && piece.color === color) {
        shield++;
      }
    }
  }
  
  return shield;
}

// Count exposed files/diagonals around king
function countKingExposure(board, kingPos, color) {
  let exposure = 0;
  const directions = [
    [-1, -1], [-1, 0], [-1, 1],
    [0, -1],           [0, 1],
    [1, -1],  [1, 0],  [1, 1]
  ];
  
  for (const [dr, dc] of directions) {
    let distance = 1;
    let blocked = false;
    
    while (distance < 8 && !blocked) {
      const row = kingPos.row + dr * distance;
      const col = kingPos.col + dc * distance;
      
      if (!isValidSquare(row, col)) break;
      
      const piece = board[row][col];
      if (piece) {
        if (piece.color !== color) {
          // Enemy piece on line of sight
          if (piece.type === PIECE_TYPES.QUEEN ||
              (Math.abs(dr) === Math.abs(dc) && piece.type === PIECE_TYPES.BISHOP) ||
              (dr * dc === 0 && piece.type === PIECE_TYPES.ROOK)) {
            exposure += 4 - Math.min(distance, 3);
          }
        }
        blocked = true;
      }
      distance++;
    }
  }
  
  return exposure;
}

// Count enemy pieces attacking king's zone
function countAttackingPieces(board, kingPos, color) {
  let attackers = 0;
  const enemyColor = color === COLORS.WHITE ? COLORS.BLACK : COLORS.WHITE;
  
  // Check 3x3 zone around king
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      
      const row = kingPos.row + dr;
      const col = kingPos.col + dc;
      
      if (isValidSquare(row, col)) {
        // Count enemy pieces that can attack this square
        for (let r = 0; r < 8; r++) {
          for (let c = 0; c < 8; c++) {
            const piece = board[r][c];
            if (piece && piece.color === enemyColor) {
              if (canAttackSquare(board, { row: r, col: c }, { row, col }, piece)) {
                attackers++;
              }
            }
          }
        }
      }
    }
  }
  
  return attackers;
}

// Center control evaluation
function evaluateCenterControl(board) {
  let score = 0;
  
  // Direct occupation
  for (const square of CENTER_SQUARES) {
    const piece = board[square.row][square.col];
    if (piece) {
      const value = piece.type === PIECE_TYPES.PAWN ? 15 : 10;
      score += piece.color === COLORS.WHITE ? value : -value;
    }
  }
  
  // Control (attacking center squares)
  for (const square of EXTENDED_CENTER) {
    const whiteControl = isSquareControlledBy(board, square, COLORS.WHITE);
    const blackControl = isSquareControlledBy(board, square, COLORS.BLACK);
    
    if (whiteControl && !blackControl) score += 3;
    else if (blackControl && !whiteControl) score -= 3;
  }
  
  return score;
}

// Check if square is controlled by color
function isSquareControlledBy(board, square, color) {
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col];
      if (piece && piece.color === color) {
        if (canAttackSquare(board, { row, col }, square, piece)) {
          return true;
        }
      }
    }
  }
  return false;
}

// Piece activity (mobility + development)
function evaluatePieceActivity(gameState) {
  let score = 0;
  const board = gameState.board;
  
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col];
      if (!piece) continue;
      
      // Count legal moves (mobility)
      const mobility = countPieceMobility(gameState, { row, col });
      let pieceScore = mobility;
      
      // Development bonus
      if (gameState.moveHistory.length < 20) {
        if (piece.type === PIECE_TYPES.KNIGHT || piece.type === PIECE_TYPES.BISHOP) {
          const startCol = piece.color === COLORS.WHITE ? 0 : 7;
          if (col !== startCol) pieceScore += 10;
        }
      }
      
      // Rook on open/semi-open file
      if (piece.type === PIECE_TYPES.ROOK) {
        const fileStatus = evaluateFile(board, row);
        if (fileStatus === 'open') pieceScore += 15;
        else if (fileStatus === 'semi-open') pieceScore += 8;
      }
      
      score += piece.color === COLORS.WHITE ? pieceScore : -pieceScore;
    }
  }
  
  return score;
}

// Count legal moves for a piece
function countPieceMobility(gameState, from) {
  let count = 0;
  
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      if (isValidMove(gameState.board, from, { row, col }, gameState)) {
        count++;
      }
    }
  }
  
  return count;
}

// Evaluate file status for rooks
function evaluateFile(board, file) {
  let ownPawns = 0;
  let enemyPawns = 0;
  
  for (let col = 0; col < 8; col++) {
    const piece = board[file][col];
    if (piece && piece.type === PIECE_TYPES.PAWN) {
      if (piece.color === COLORS.WHITE) ownPawns++;
      else enemyPawns++;
    }
  }
  
  if (ownPawns === 0 && enemyPawns === 0) return 'open';
  if (ownPawns === 0 || enemyPawns === 0) return 'semi-open';
  return 'closed';
}

// Pawn structure evaluation
function evaluatePawnStructure(board) {
  let score = 0;
  
  // Analyze each pawn
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col];
      if (piece && piece.type === PIECE_TYPES.PAWN) {
        let pawnScore = 0;
        
        // Passed pawn
        if (isPassedPawn(board, row, col, piece.color)) {
          const advancement = piece.color === COLORS.WHITE ? col : 7 - col;
          pawnScore += 20 + advancement * advancement * 5;
        }
        
        // Isolated pawn
        if (isIsolatedPawn(board, row, col, piece.color)) {
          pawnScore -= 15;
        }
        
        // Doubled pawn
        if (isDoubledPawn(board, row, col, piece.color)) {
          pawnScore -= 10;
        }
        
        // Backward pawn
        if (isBackwardPawn(board, row, col, piece.color)) {
          pawnScore -= 8;
        }
        
        // Connected pawns
        if (hasConnectedPawn(board, row, col, piece.color)) {
          pawnScore += 7;
        }
        
        score += piece.color === COLORS.WHITE ? pawnScore : -pawnScore;
      }
    }
  }
  
  return score;
}

// Pawn structure helpers
function isPassedPawn(board, row, col, color) {
  const direction = color === COLORS.WHITE ? 1 : -1;
  const endCol = color === COLORS.WHITE ? 7 : 0;
  
  for (let c = col + direction; color === COLORS.WHITE ? c <= endCol : c >= endCol; c += direction) {
    for (let r = row - 1; r <= row + 1; r++) {
      if (isValidSquare(r, c)) {
        const piece = board[r][c];
        if (piece && piece.type === PIECE_TYPES.PAWN && piece.color !== color) {
          return false;
        }
      }
    }
  }
  
  return true;
}

function isIsolatedPawn(board, row, col, color) {
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

function isDoubledPawn(board, row, col, color) {
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

function isBackwardPawn(board, row, col, color) {
  const direction = color === COLORS.WHITE ? -1 : 1;
  
  // Check if pawn can advance
  const advanceCol = col + (color === COLORS.WHITE ? 1 : -1);
  if (advanceCol < 0 || advanceCol > 7 || board[row][advanceCol]) {
    return false;
  }
  
  // Check if supported by friendly pawns
  for (let r = row - 1; r <= row + 1; r += 2) {
    if (isValidSquare(r, col + direction)) {
      const piece = board[r][col + direction];
      if (piece && piece.type === PIECE_TYPES.PAWN && piece.color === color) {
        return false;
      }
    }
  }
  
  return true;
}

function hasConnectedPawn(board, row, col, color) {
  for (let dr = -1; dr <= 1; dr += 2) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dc === 0) continue;
      const r = row + dr;
      const c = col + dc;
      if (isValidSquare(r, c)) {
        const piece = board[r][c];
        if (piece && piece.type === PIECE_TYPES.PAWN && piece.color === color) {
          return true;
        }
      }
    }
  }
  return false;
}

// Tactical evaluation
function evaluateTactics(gameState) {
  let score = 0;
  const board = gameState.board;
  
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col];
      if (!piece) continue;
      
      // Forks
      if (piece.type === PIECE_TYPES.KNIGHT || piece.type === PIECE_TYPES.PAWN) {
        const forks = countForks(board, { row, col }, piece);
        const forkValue = piece.color === COLORS.WHITE ? forks * 25 : -forks * 25;
        score += forkValue;
      }
      
      // Pins and skewers
      if ([PIECE_TYPES.BISHOP, PIECE_TYPES.ROOK, PIECE_TYPES.QUEEN].includes(piece.type)) {
        const pins = countPinsAndSkewers(board, { row, col }, piece);
        const pinValue = piece.color === COLORS.WHITE ? pins * 30 : -pins * 30;
        score += pinValue;
      }
    }
  }
  
  return score;
}

// Count fork opportunities
function countForks(board, pos, piece) {
  let forks = 0;
  const enemyColor = piece.color === COLORS.WHITE ? COLORS.BLACK : COLORS.WHITE;
  const attacks = [];
  
  // Find all attacked enemy pieces
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const target = board[row][col];
      if (target && target.color === enemyColor && target.type !== PIECE_TYPES.PAWN) {
        if (canAttackSquare(board, pos, { row, col }, piece)) {
          attacks.push(PIECE_VALUES[target.type]);
        }
      }
    }
  }
  
  // Count valuable forks
  if (attacks.length >= 2) {
    attacks.sort((a, b) => b - a);
    if (attacks[0] + attacks[1] > PIECE_VALUES[piece.type] + 2) {
      forks++;
    }
  }
  
  return forks;
}

// Count pins and skewers
function countPinsAndSkewers(board, pos, piece) {
  let count = 0;
  const directions = getSlideDirections(piece.type);
  
  for (const [dr, dc] of directions) {
    const ray = [];
    let r = pos.row + dr;
    let c = pos.col + dc;
    
    // Scan along ray
    while (isValidSquare(r, c)) {
      const target = board[r][c];
      if (target) {
        if (target.color !== piece.color) {
          ray.push({ piece: target, pos: { row: r, col: c } });
          if (ray.length >= 2) break;
        } else {
          break;
        }
      }
      r += dr;
      c += dc;
    }
    
    // Check for pin/skewer
    if (ray.length === 2) {
      const values = ray.map(r => PIECE_VALUES[r.piece.type]);
      if (values[0] < values[1]) count++; // Pin
      else if (values[0] > values[1]) count++; // Skewer
    }
  }
  
  return count;
}

// Strategic evaluation
function evaluateStrategy(gameState) {
  let score = 0;
  const board = gameState.board;
  
  // Bishop pair
  const bishops = { white: 0, black: 0 };
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col];
      if (piece && piece.type === PIECE_TYPES.BISHOP) {
        bishops[piece.color]++;
      }
    }
  }
  
  if (bishops.white >= 2) score += 25;
  if (bishops.black >= 2) score -= 25;
  
  // Knight outposts
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col];
      if (piece && piece.type === PIECE_TYPES.KNIGHT) {
        if (isKnightOutpost(board, { row, col }, piece.color)) {
          score += piece.color === COLORS.WHITE ? 20 : -20;
        }
      }
    }
  }
  
  return score;
}

// Knight outpost detection
function isKnightOutpost(board, pos, color) {
  const enemyColor = color === COLORS.WHITE ? COLORS.BLACK : COLORS.WHITE;
  const advanceDir = color === COLORS.WHITE ? 1 : -1;
  
  // Check if in enemy territory
  const inEnemyTerritory = color === COLORS.WHITE ? pos.col >= 4 : pos.col <= 3;
  if (!inEnemyTerritory) return false;
  
  // Check if protected by pawn
  let pawnProtected = false;
  for (let dr = -1; dr <= 1; dr += 2) {
    const r = pos.row + dr;
    const c = pos.col - advanceDir;
    if (isValidSquare(r, c)) {
      const piece = board[r][c];
      if (piece && piece.type === PIECE_TYPES.PAWN && piece.color === color) {
        pawnProtected = true;
        break;
      }
    }
  }
  
  if (!pawnProtected) return false;
  
  // Check if can't be kicked by enemy pawn
  for (let dr = -1; dr <= 1; dr += 2) {
    const r = pos.row + dr;
    const c = pos.col + advanceDir;
    if (isValidSquare(r, c)) {
      const piece = board[r][c];
      if (piece && piece.type === PIECE_TYPES.PAWN && piece.color === enemyColor) {
        return false;
      }
    }
  }
  
  return true;
}

// Move generation
function generateLegalMoves(gameState, color) {
  const moves = [];
  const board = gameState.board;
  
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col];
      if (!piece || piece.color !== color) continue;
      
      for (let toRow = 0; toRow < 8; toRow++) {
        for (let toCol = 0; toCol < 8; toCol++) {
          const from = { row, col };
          const to = { row: toRow, col: toCol };
          
          if (isValidMove(board, from, to, gameState)) {
            const testBoard = makeTestMove(board, from, to);
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

// Move ordering for better pruning
function orderMoves(moves, gameState, depth) {
  const board = gameState.board;
  
  const scoredMoves = moves.map(move => {
    let score = 0;
    const from = board[move.from.row][move.from.col];
    const to = board[move.to.row][move.to.col];
    
    // MVV-LVA for captures
    if (to) {
      score += 10000 + PIECE_VALUES[to.type] * 100 - PIECE_VALUES[from.type];
    }
    
    // Killer moves
    if (depth < MAX_DEPTH) {
      if (movesEqual(move, killerMoves[depth][0])) score += 9000;
      else if (movesEqual(move, killerMoves[depth][1])) score += 8000;
    }
    
    // History heuristic
    const histKey = `${move.from.row},${move.from.col}-${move.to.row},${move.to.col}`;
    score += historyTable[histKey] || 0;
    
    // Promotions
    if (from.type === PIECE_TYPES.PAWN) {
      const promotionCol = from.color === COLORS.WHITE ? 7 : 0;
      if (move.to.col === promotionCol) {
        score += 9500;
      }
    }
    
    // Center moves
    if (CENTER_SQUARES.some(s => s.row === move.to.row && s.col === move.to.col)) {
      score += 50;
    }
    
    // Castling
    if (from.type === PIECE_TYPES.KING && Math.abs(move.to.row - move.from.row) === 2) {
      score += 300;
    }
    
    return { move, score };
  });
  
  scoredMoves.sort((a, b) => b.score - a.score);
  return scoredMoves.map(sm => sm.move);
}

// Helper functions
function isCheckmate(gameState) {
  const color = gameState.currentTurn;
  if (!isInCheck(gameState.board, color)) return false;
  return !hasAnyLegalMove(gameState.board, color, gameState);
}

function isDraw(gameState) {
  // Stalemate
  if (!isInCheck(gameState.board, gameState.currentTurn) && 
      !hasAnyLegalMove(gameState.board, gameState.currentTurn, gameState)) {
    return true;
  }
  
  // Insufficient material
  if (isInsufficientMaterial(gameState.board)) {
    return true;
  }
  
  // TODO: Repetition and 50-move rule
  
  return false;
}

function isInsufficientMaterial(board) {
  const pieces = [];
  
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col];
      if (piece && piece.type !== PIECE_TYPES.KING) {
        pieces.push(piece);
      }
    }
  }
  
  // K vs K
  if (pieces.length === 0) return true;
  
  // K+B vs K or K+N vs K
  if (pieces.length === 1 && 
      (pieces[0].type === PIECE_TYPES.BISHOP || pieces[0].type === PIECE_TYPES.KNIGHT)) {
    return true;
  }
  
  return false;
}

function applyMove(gameState, move) {
  const newBoard = makeTestMove(gameState.board, move.from, move.to);
  
  return {
    board: newBoard,
    currentTurn: gameState.currentTurn === COLORS.WHITE ? COLORS.BLACK : COLORS.WHITE,
    castlingRights: gameState.castlingRights,
    enPassantTarget: null,
    moveHistory: [...gameState.moveHistory, move]
  };
}

function makeTestMove(board, from, to) {
  const newBoard = board.map(row => [...row]);
  newBoard[to.row][to.col] = newBoard[from.row][from.col];
  newBoard[from.row][from.col] = null;
  return newBoard;
}

function canAttackSquare(board, from, to, piece) {
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

function isValidSquare(row, col) {
  return row >= 0 && row < 8 && col >= 0 && col < 8;
}

function getSlideDirections(pieceType) {
  switch (pieceType) {
    case PIECE_TYPES.BISHOP:
      return [[1, 1], [1, -1], [-1, 1], [-1, -1]];
    case PIECE_TYPES.ROOK:
      return [[0, 1], [0, -1], [1, 0], [-1, 0]];
    case PIECE_TYPES.QUEEN:
      return [[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [1, -1], [-1, 1], [-1, -1]];
    default:
      return [];
  }
}

function movesEqual(m1, m2) {
  if (!m1 || !m2) return false;
  return m1.from.row === m2.from.row && m1.from.col === m2.from.col &&
         m1.to.row === m2.to.row && m1.to.col === m2.to.col;
}

function updateKillerMoves(move, depth) {
  if (depth >= MAX_DEPTH) return;
  
  if (!movesEqual(move, killerMoves[depth][0])) {
    killerMoves[depth][1] = killerMoves[depth][0];
    killerMoves[depth][0] = move;
  }
}

function updateHistoryTable(move, depth) {
  const key = `${move.from.row},${move.from.col}-${move.to.row},${move.to.col}`;
  historyTable[key] = (historyTable[key] || 0) + depth * depth;
}

function hashPosition(gameState) {
  // Simple hash for transposition table
  let hash = '';
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = gameState.board[row][col];
      if (piece) {
        hash += piece.type[0] + piece.color[0];
      } else {
        hash += '--';
      }
    }
  }
  hash += gameState.currentTurn[0];
  return hash;
}

function clearOldTranspositions() {
  if (transpositionTable.size > MAX_TABLE_SIZE) {
    transpositionTable.clear();
  }
}

function getOpeningBookMove(gameState) {
  // Convert move history to string notation
  const historyStr = gameState.moveHistory.map(m => 
    `${String.fromCharCode(97 + m.from.row)}${m.from.col + 1}` +
    `${String.fromCharCode(97 + m.to.row)}${m.to.col + 1}`
  ).join(' ');
  
  const bookMoves = OPENING_BOOK[historyStr];
  if (bookMoves && bookMoves.length > 0) {
    // Parse book move (simplified)
    const moveStr = bookMoves[Math.floor(Math.random() * bookMoves.length)];
    // TODO: Parse algebraic notation to move object
    return null; // For now, skip opening book
  }
  
  return null;
}