/**
 * Claude Sonnet 4 Chess Bot - Advanced Strategic Engine
 * 
 * Features:
 * - Minimax search with alpha-beta pruning
 * - Sophisticated position evaluation
 * - Opening principles and book moves
 * - Time management with iterative deepening
 * - Tactical pattern recognition
 * - Strategic positional understanding
 */

import { isValidMove, isInCheck, isCheckmate, hasAnyLegalMove } from '../chess/moveValidation';
import { PIECE_TYPES, COLORS, PIECE_VALUES } from '../chess/gameState';

// Position-specific piece value tables
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
  ]
};

// Bot state for caching and analysis
class BotState {
  constructor() {
    this.positionCache = new Map();
    this.killerMoves = [];
    this.searchedPositions = 0;
    this.startTime = 0;
    this.timeLimit = 500; // Default 0.5 seconds
    this.moveNumber = 0;
    this.pieceEvaluationOrder = this.shuffleOrder([
      PIECE_TYPES.QUEEN, PIECE_TYPES.ROOK, PIECE_TYPES.BISHOP, 
      PIECE_TYPES.KNIGHT, PIECE_TYPES.PAWN, PIECE_TYPES.KING
    ]);
  }

  shuffleOrder(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  updateTimeLimit(moveNumber) {
    if (moveNumber < 10) {
      this.timeLimit = 500; // 0.5 seconds
    } else if (moveNumber < 20) {
      this.timeLimit = 1000; // 1 second
    } else {
      this.timeLimit = 2000; // 2 seconds
    }
  }

  isTimeUp() {
    return Date.now() - this.startTime > this.timeLimit;
  }
}

const botState = new BotState();

/**
 * Main bot function
 */
export function makeMove(gameState, botColor) {
  const moveNumber = Math.floor(gameState.moveHistory.length / 2) + 1;
  botState.moveNumber = moveNumber;
  botState.updateTimeLimit(moveNumber);
  botState.startTime = Date.now();
  botState.searchedPositions = 0;
  
  // Shuffle piece evaluation order to add variety
  if (moveNumber % 5 === 0) {
    botState.pieceEvaluationOrder = botState.shuffleOrder(botState.pieceEvaluationOrder);
  }

  const validMoves = getAllValidMoves(gameState, botColor);
  
  if (validMoves.length === 0) {
    return null;
  }

  if (validMoves.length === 1) {
    return validMoves[0];
  }

  // Check for immediate checkmate
  for (const move of validMoves) {
    const testBoard = makeTestMove(gameState.board, move.from, move.to);
    const opponentColor = botColor === COLORS.WHITE ? COLORS.BLACK : COLORS.WHITE;
    if (isCheckmate(testBoard, opponentColor, gameState)) {
      return move;
    }
  }

  // Opening book for first few moves
  if (moveNumber <= 3) {
    const bookMove = getOpeningBookMove(gameState, botColor, moveNumber);
    if (bookMove && validMoves.some(m => movesEqual(m, bookMove))) {
      return bookMove;
    }
  }

  // Early game: prioritize pawn and knight moves
  if (moveNumber <= 10) {
    const priorityMoves = validMoves.filter(move => {
      const piece = gameState.board[move.from.row][move.from.col];
      return piece.type === PIECE_TYPES.PAWN || piece.type === PIECE_TYPES.KNIGHT;
    });
    
    if (priorityMoves.length > 0) {
      return findBestMove(gameState, botColor, priorityMoves, 2);
    }
  }

  // Use iterative deepening for best move search
  return iterativeDeepening(gameState, botColor, validMoves);
}

/**
 * Iterative deepening search
 */
function iterativeDeepening(gameState, botColor, validMoves) {
  let bestMove = validMoves[0];
  let bestScore = -Infinity;
  
  for (let depth = 1; depth <= 4; depth++) {
    if (botState.isTimeUp()) break;
    
    const result = findBestMove(gameState, botColor, validMoves, depth);
    if (result) {
      bestMove = result;
    }
    
    // If we found a winning move, use it immediately
    if (bestScore > 900) break;
  }
  
  return bestMove;
}

/**
 * Find best move using minimax with alpha-beta pruning
 */
function findBestMove(gameState, botColor, validMoves, depth) {
  let bestMove = null;
  let bestScore = -Infinity;
  let alpha = -Infinity;
  const beta = Infinity;
  
  // Sort moves for better pruning
  const sortedMoves = sortMoves(gameState, validMoves, botColor);
  
  for (const move of sortedMoves) {
    if (botState.isTimeUp()) break;
    
    const testGameState = applyMove(gameState, move);
    const score = minimax(testGameState, depth - 1, alpha, beta, false, botColor);
    
    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }
    
    alpha = Math.max(alpha, score);
    if (beta <= alpha) break; // Alpha-beta pruning
  }
  
  return bestMove;
}

/**
 * Minimax algorithm with alpha-beta pruning
 */
function minimax(gameState, depth, alpha, beta, maximizingPlayer, botColor) {
  if (botState.isTimeUp()) return 0;
  
  botState.searchedPositions++;
  
  const currentColor = maximizingPlayer ? botColor : (botColor === COLORS.WHITE ? COLORS.BLACK : COLORS.WHITE);
  
  // Terminal conditions
  if (depth === 0) {
    return quiescenceSearch(gameState, alpha, beta, maximizingPlayer, botColor, 3);
  }
  
  if (isCheckmate(gameState.board, currentColor, gameState)) {
    return maximizingPlayer ? -1000 + (4 - depth) : 1000 - (4 - depth);
  }
  
  const validMoves = getAllValidMoves(gameState, currentColor);
  if (validMoves.length === 0) {
    return 0; // Stalemate
  }
  
  // Cache lookup
  const positionKey = getPositionKey(gameState, currentColor);
  if (botState.positionCache.has(positionKey)) {
    const cached = botState.positionCache.get(positionKey);
    if (cached.depth >= depth) {
      return cached.score;
    }
  }
  
  const sortedMoves = sortMoves(gameState, validMoves, currentColor);
  
  if (maximizingPlayer) {
    let maxEval = -Infinity;
    for (const move of sortedMoves) {
      if (botState.isTimeUp()) break;
      
      const newGameState = applyMove(gameState, move);
      const evaluation = minimax(newGameState, depth - 1, alpha, beta, false, botColor);
      maxEval = Math.max(maxEval, evaluation);
      alpha = Math.max(alpha, evaluation);
      if (beta <= alpha) break;
    }
    
    // Cache the result
    if (!botState.isTimeUp()) {
      botState.positionCache.set(positionKey, { score: maxEval, depth });
    }
    
    return maxEval;
  } else {
    let minEval = Infinity;
    for (const move of sortedMoves) {
      if (botState.isTimeUp()) break;
      
      const newGameState = applyMove(gameState, move);
      const evaluation = minimax(newGameState, depth - 1, alpha, beta, true, botColor);
      minEval = Math.min(minEval, evaluation);
      beta = Math.min(beta, evaluation);
      if (beta <= alpha) break;
    }
    
    // Cache the result
    if (!botState.isTimeUp()) {
      botState.positionCache.set(positionKey, { score: minEval, depth });
    }
    
    return minEval;
  }
}

/**
 * Quiescence search to resolve tactical sequences
 */
function quiescenceSearch(gameState, alpha, beta, maximizingPlayer, botColor, depth) {
  if (depth === 0 || botState.isTimeUp()) {
    return evaluatePosition(gameState, botColor);
  }
  
  const standPat = evaluatePosition(gameState, botColor);
  
  if (maximizingPlayer) {
    if (standPat >= beta) return beta;
    alpha = Math.max(alpha, standPat);
  } else {
    if (standPat <= alpha) return alpha;
    beta = Math.min(beta, standPat);
  }
  
  const currentColor = maximizingPlayer ? botColor : (botColor === COLORS.WHITE ? COLORS.BLACK : COLORS.WHITE);
  const captureMoves = getAllValidMoves(gameState, currentColor).filter(move => 
    gameState.board[move.to.row][move.to.col] !== null
  );
  
  const sortedCaptures = sortMoves(gameState, captureMoves, currentColor);
  
  for (const move of sortedCaptures) {
    if (botState.isTimeUp()) break;
    
    const newGameState = applyMove(gameState, move);
    const score = quiescenceSearch(newGameState, alpha, beta, !maximizingPlayer, botColor, depth - 1);
    
    if (maximizingPlayer) {
      alpha = Math.max(alpha, score);
      if (beta <= alpha) break;
    } else {
      beta = Math.min(beta, score);
      if (beta <= alpha) break;
    }
  }
  
  return maximizingPlayer ? alpha : beta;
}

/**
 * Sort moves for better alpha-beta pruning
 */
function sortMoves(gameState, moves, color) {
  return moves.sort((a, b) => {
    const scoreA = scoreMoveForOrdering(gameState, a, color);
    const scoreB = scoreMoveForOrdering(gameState, b, color);
    return scoreB - scoreA;
  });
}

/**
 * Score moves for ordering (captures first, then tactical moves)
 */
function scoreMoveForOrdering(gameState, move, color) {
  let score = 0;
  const piece = gameState.board[move.from.row][move.from.col];
  const target = gameState.board[move.to.row][move.to.col];
  
  // Captures
  if (target) {
    score += PIECE_VALUES[target.type] * 10 - PIECE_VALUES[piece.type];
  }
  
  // Center control
  if (isCenterSquare(move.to)) {
    score += 20;
  }
  
  // Piece development
  if (piece.type === PIECE_TYPES.KNIGHT || piece.type === PIECE_TYPES.BISHOP) {
    if (isBackRank(move.from, color)) {
      score += 10;
    }
  }
  
  // Check giving moves
  const testBoard = makeTestMove(gameState.board, move.from, move.to);
  const opponentColor = color === COLORS.WHITE ? COLORS.BLACK : COLORS.WHITE;
  if (isInCheck(testBoard, opponentColor)) {
    score += 30;
  }
  
  return score;
}

/**
 * Comprehensive position evaluation
 */
function evaluatePosition(gameState, botColor) {
  let score = 0;
  
  // Material balance
  score += evaluateMaterial(gameState.board, botColor);
  
  // King safety
  score += evaluateKingSafety(gameState.board, botColor);
  
  // Center control
  score += evaluateCenterControl(gameState.board, botColor);
  
  // Piece activity
  score += evaluatePieceActivity(gameState, botColor);
  
  // Pawn structure
  score += evaluatePawnStructure(gameState.board, botColor);
  
  // Positional bonuses
  score += evaluatePositionalFactors(gameState.board, botColor);
  
  return score;
}

/**
 * Evaluate material balance
 */
function evaluateMaterial(board, botColor) {
  let score = 0;
  
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col];
      if (!piece) continue;
      
      const value = PIECE_VALUES[piece.type];
      if (piece.color === botColor) {
        score += value * 100;
        score += getPositionalBonus(piece, row, col);
      } else {
        score -= value * 100;
        score -= getPositionalBonus(piece, row, col);
      }
    }
  }
  
  return score;
}

/**
 * Get positional bonus for piece placement
 */
function getPositionalBonus(piece, row, col) {
  if (piece.type === PIECE_TYPES.PAWN && PIECE_SQUARE_TABLES[piece.type][piece.color]) {
    return PIECE_SQUARE_TABLES[piece.type][piece.color][row][col];
  } else if (PIECE_SQUARE_TABLES[piece.type]) {
    return PIECE_SQUARE_TABLES[piece.type][row][col];
  }
  return 0;
}

/**
 * Evaluate king safety
 */
function evaluateKingSafety(board, botColor) {
  let score = 0;
  
  const botKing = findKing(board, botColor);
  const opponentKing = findKing(board, botColor === COLORS.WHITE ? COLORS.BLACK : COLORS.WHITE);
  
  if (botKing) {
    score += evaluateKingPosition(board, botKing, botColor);
  }
  
  if (opponentKing) {
    score -= evaluateKingPosition(board, opponentKing, botColor === COLORS.WHITE ? COLORS.BLACK : COLORS.WHITE);
  }
  
  return score;
}

/**
 * Evaluate individual king position
 */
function evaluateKingPosition(board, kingPos, color) {
  let safety = 0;
  
  // Pawn shield
  const direction = color === COLORS.WHITE ? 1 : -1;
  const shieldCol = kingPos.col + direction;
  
  if (shieldCol >= 0 && shieldCol < 8) {
    for (let row = kingPos.row - 1; row <= kingPos.row + 1; row++) {
      if (row >= 0 && row < 8) {
        const piece = board[row][shieldCol];
        if (piece && piece.type === PIECE_TYPES.PAWN && piece.color === color) {
          safety += 10;
        }
      }
    }
  }
  
  // King in corner is safer in early game
  if (isCornerPosition(kingPos)) {
    safety += 5;
  }
  
  return safety;
}

/**
 * Evaluate center control
 */
function evaluateCenterControl(board, botColor) {
  let score = 0;
  const centerSquares = [
    { row: 3, col: 3 }, { row: 3, col: 4 },
    { row: 4, col: 3 }, { row: 4, col: 4 }
  ];
  
  for (const square of centerSquares) {
    const piece = board[square.row][square.col];
    if (piece) {
      if (piece.color === botColor) {
        score += PIECE_VALUES[piece.type] * 5;
      } else {
        score -= PIECE_VALUES[piece.type] * 5;
      }
    }
    
    // Count attacks on center squares
    score += countAttacksOnSquare(board, square, botColor) * 2;
    score -= countAttacksOnSquare(board, square, botColor === COLORS.WHITE ? COLORS.BLACK : COLORS.WHITE) * 2;
  }
  
  return score;
}

/**
 * Evaluate piece activity and mobility
 */
function evaluatePieceActivity(gameState, botColor) {
  let score = 0;
  
  const botMoves = getAllValidMoves(gameState, botColor);
  const opponentMoves = getAllValidMoves(gameState, botColor === COLORS.WHITE ? COLORS.BLACK : COLORS.WHITE);
  
  score += botMoves.length * 2;
  score -= opponentMoves.length * 2;
  
  return score;
}

/**
 * Evaluate pawn structure
 */
function evaluatePawnStructure(board, botColor) {
  let score = 0;
  const botPawns = [];
  const opponentPawns = [];
  
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col];
      if (piece && piece.type === PIECE_TYPES.PAWN) {
        if (piece.color === botColor) {
          botPawns.push({ row, col });
        } else {
          opponentPawns.push({ row, col });
        }
      }
    }
  }
  
  // Evaluate pawn advancement
  for (const pawn of botPawns) {
    const advancement = botColor === COLORS.WHITE ? pawn.col : (7 - pawn.col);
    score += advancement * 2;
    
    // Passed pawn bonus
    if (isPassedPawn(board, pawn, botColor)) {
      score += advancement * 5;
    }
  }
  
  for (const pawn of opponentPawns) {
    const advancement = botColor === COLORS.WHITE ? (7 - pawn.col) : pawn.col;
    score -= advancement * 2;
    
    if (isPassedPawn(board, pawn, botColor === COLORS.WHITE ? COLORS.BLACK : COLORS.WHITE)) {
      score -= advancement * 5;
    }
  }
  
  return score;
}

/**
 * Evaluate various positional factors
 */
function evaluatePositionalFactors(board, botColor) {
  let score = 0;
  
  // Rook on open files
  score += evaluateRookPlacement(board, botColor);
  
  // Bishop pair
  if (hasBishopPair(board, botColor)) {
    score += 30;
  }
  if (hasBishopPair(board, botColor === COLORS.WHITE ? COLORS.BLACK : COLORS.WHITE)) {
    score -= 30;
  }
  
  return score;
}

/**
 * Opening book moves
 */
function getOpeningBookMove(gameState, botColor, moveNumber) {
  const openingMoves = {
    1: {
      [COLORS.WHITE]: [
        { from: { row: 4, col: 1 }, to: { row: 4, col: 3 } }, // e4
        { from: { row: 3, col: 1 }, to: { row: 3, col: 3 } }, // d4
        { from: { row: 6, col: 0 }, to: { row: 5, col: 2 } }, // Nf3
      ]
    }
  };
  
  if (openingMoves[moveNumber] && openingMoves[moveNumber][botColor]) {
    const moves = openingMoves[moveNumber][botColor];
    return moves[Math.floor(Math.random() * moves.length)];
  }
  
  return null;
}

// Utility functions
function getAllValidMoves(gameState, color) {
  const moves = [];
  
  // Order pieces by current evaluation preference
  const piecePositions = [];
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = gameState.board[row][col];
      if (piece && piece.color === color) {
        piecePositions.push({ row, col, piece });
      }
    }
  }
  
  // Sort by piece type priority
  piecePositions.sort((a, b) => {
    const aIndex = botState.pieceEvaluationOrder.indexOf(a.piece.type);
    const bIndex = botState.pieceEvaluationOrder.indexOf(b.piece.type);
    return aIndex - bIndex;
  });
  
  for (const pos of piecePositions) {
    for (let toRow = 0; toRow < 8; toRow++) {
      for (let toCol = 0; toCol < 8; toCol++) {
        const from = { row: pos.row, col: pos.col };
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
  
  return moves;
}

function makeTestMove(board, from, to) {
  const newBoard = board.map(row => [...row]);
  newBoard[to.row][to.col] = newBoard[from.row][from.col];
  newBoard[from.row][from.col] = null;
  return newBoard;
}

function applyMove(gameState, move) {
  const newGameState = {
    ...gameState,
    board: makeTestMove(gameState.board, move.from, move.to),
    currentTurn: gameState.currentTurn === COLORS.WHITE ? COLORS.BLACK : COLORS.WHITE
  };
  return newGameState;
}

function findKing(board, color) {
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col];
      if (piece && piece.type === PIECE_TYPES.KING && piece.color === color) {
        return { row, col };
      }
    }
  }
  return null;
}

function isCenterSquare(pos) {
  return (pos.row >= 3 && pos.row <= 4) && (pos.col >= 3 && pos.col <= 4);
}

function isBackRank(pos, color) {
  return color === COLORS.WHITE ? pos.col === 0 : pos.col === 7;
}

function isCornerPosition(pos) {
  return (pos.row === 0 || pos.row === 7) && (pos.col === 0 || pos.col === 7);
}

function isPassedPawn(board, pawnPos, color) {
  const direction = color === COLORS.WHITE ? 1 : -1;
  const opponentColor = color === COLORS.WHITE ? COLORS.BLACK : COLORS.WHITE;
  
  for (let col = pawnPos.col + direction; col >= 0 && col < 8; col += direction) {
    for (let row = Math.max(0, pawnPos.row - 1); row <= Math.min(7, pawnPos.row + 1); row++) {
      const piece = board[row][col];
      if (piece && piece.type === PIECE_TYPES.PAWN && piece.color === opponentColor) {
        return false;
      }
    }
  }
  return true;
}

function hasBishopPair(board, color) {
  let bishops = 0;
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col];
      if (piece && piece.type === PIECE_TYPES.BISHOP && piece.color === color) {
        bishops++;
      }
    }
  }
  return bishops >= 2;
}

function evaluateRookPlacement(board, color) {
  let score = 0;
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col];
      if (piece && piece.type === PIECE_TYPES.ROOK && piece.color === color) {
        if (isOpenFile(board, row)) {
          score += 20;
        }
      }
    }
  }
  return score;
}

function isOpenFile(board, row) {
  for (let col = 0; col < 8; col++) {
    const piece = board[row][col];
    if (piece && piece.type === PIECE_TYPES.PAWN) {
      return false;
    }
  }
  return true;
}

function countAttacksOnSquare(board, square, color) {
  let attacks = 0;
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col];
      if (piece && piece.color === color) {
        if (canPieceAttackSquare(board, { row, col }, square, piece)) {
          attacks++;
        }
      }
    }
  }
  return attacks;
}

function canPieceAttackSquare(board, from, to, piece) {
  const rowDiff = to.row - from.row;
  const colDiff = to.col - from.col;
  
  switch (piece.type) {
    case PIECE_TYPES.PAWN:
      const direction = piece.color === COLORS.WHITE ? 1 : -1;
      return colDiff === direction && Math.abs(rowDiff) === 1;
    case PIECE_TYPES.ROOK:
      return (rowDiff === 0 || colDiff === 0) && isPathClear(board, from, to);
    case PIECE_TYPES.BISHOP:
      return Math.abs(rowDiff) === Math.abs(colDiff) && isPathClear(board, from, to);
    case PIECE_TYPES.KNIGHT:
      return (Math.abs(rowDiff) === 2 && Math.abs(colDiff) === 1) ||
             (Math.abs(rowDiff) === 1 && Math.abs(colDiff) === 2);
    case PIECE_TYPES.QUEEN:
      return ((rowDiff === 0 || colDiff === 0) || (Math.abs(rowDiff) === Math.abs(colDiff))) && 
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

function getPositionKey(gameState, color) {
  let key = color + '|';
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = gameState.board[row][col];
      if (piece) {
        key += `${piece.color[0]}${piece.type[0]}${row}${col}|`;
      }
    }
  }
  return key;
}

function movesEqual(move1, move2) {
  return move1.from.row === move2.from.row &&
         move1.from.col === move2.from.col &&
         move1.to.row === move2.to.row &&
         move1.to.col === move2.to.col;
}
