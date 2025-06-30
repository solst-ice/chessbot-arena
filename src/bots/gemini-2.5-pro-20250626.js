import { isValidMove, isInCheck, isCheckmate } from '../chess/moveValidation';
import { PIECE_TYPES, COLORS } from '../chess/gameState';

// --- Constants ---

const PIECE_VALUES = {
  [PIECE_TYPES.PAWN]: 100,
  [PIECE_TYPES.KNIGHT]: 320,
  [PIECE_TYPES.BISHOP]: 330,
  [PIECE_TYPES.ROOK]: 500,
  [PIECE_TYPES.QUEEN]: 900,
  [PIECE_TYPES.KING]: 20000,
};

const CHECKMATE_SCORE = 100000;
const MAX_SEARCH_DEPTH = 10; // Max possible depth, time limit will stop it earlier.
const MAX_QUIESCENCE_DEPTH = 5;
const MOVE_TIME_LIMIT_MS = 5000; // 5 seconds

// --- Piece-Square Tables (for horizontal layout) ---
// Note: These are structured for white (moving left-to-right). They are flipped for black.
// The board is [row][col]

const pawnTable = [
  [0,  0,  0,  0,  0,  0,  0,  0],
  [50, 50, 50, 50, 50, 50, 50, 50],
  [10, 10, 20, 30, 30, 20, 10, 10],
  [5,  5, 10, 25, 25, 10,  5,  5],
  [0,  0,  0, 20, 20,  0,  0,  0],
  [5, -5,-10,  0,  0,-10, -5,  5],
  [5, 10, 10,-20,-20, 10, 10,  5],
  [0,  0,  0,  0,  0,  0,  0,  0]
];

const knightTable = [
  [-50,-40,-30,-30,-30,-30,-40,-50],
  [-40,-20,  0,  0,  0,  0,-20,-40],
  [-30,  0, 10, 15, 15, 10,  0,-30],
  [-30,  5, 15, 20, 20, 15,  5,-30],
  [-30,  0, 15, 20, 20, 15,  0,-30],
  [-30,  5, 10, 15, 15, 10,  5,-30],
  [-40,-20,  0,  5,  5,  0,-20,-40],
  [-50,-40,-30,-30,-30,-30,-40,-50]
];

const bishopTable = [
  [-20,-10,-10,-10,-10,-10,-10,-20],
  [-10,  0,  0,  0,  0,  0,  0,-10],
  [-10,  0,  5, 10, 10,  5,  0,-10],
  [-10,  5,  5, 10, 10,  5,  5,-10],
  [-10,  0, 10, 10, 10, 10,  0,-10],
  [-10, 10, 10, 10, 10, 10, 10,-10],
  [-10,  5,  0,  0,  0,  0,  5,-10],
  [-20,-10,-10,-10,-10,-10,-10,-20]
];

const rookTable = [
  [0,  0,  0,  0,  0,  0,  0,  0],
  [5, 10, 10, 10, 10, 10, 10,  5],
  [-5,  0,  0,  0,  0,  0,  0, -5],
  [-5,  0,  0,  0,  0,  0,  0, -5],
  [-5,  0,  0,  0,  0,  0,  0, -5],
  [-5,  0,  0,  0,  0,  0,  0, -5],
  [-5,  0,  0,  0,  0,  0,  0, -5],
  [0,  0,  0,  5,  5,  0,  0,  0]
];

const queenTable = [
  [-20,-10,-10, -5, -5,-10,-10,-20],
  [-10,  0,  0,  0,  0,  0,  0,-10],
  [-10,  0,  5,  5,  5,  5,  0,-10],
  [-5,  0,  5,  5,  5,  5,  0, -5],
  [0,  0,  5,  5,  5,  5,  0, -5],
  [-10,  5,  5,  5,  5,  5,  0,-10],
  [-10,  0,  5,  0,  0,  0,  0,-10],
  [-20,-10,-10, -5, -5,-10,-10,-20]
];

const kingTableMg = [
  [-30,-40,-40,-50,-50,-40,-40,-30],
  [-30,-40,-40,-50,-50,-40,-40,-30],
  [-30,-40,-40,-50,-50,-40,-40,-30],
  [-30,-40,-40,-50,-50,-40,-40,-30],
  [-20,-30,-30,-40,-40,-30,-30,-20],
  [-10,-20,-20,-20,-20,-20,-20,-10],
  [20, 20,  0,  0,  0,  0, 20, 20],
  [20, 30, 10,  0,  0, 10, 30, 20]
];

const kingTableEg = [
  [-50,-40,-30,-20,-20,-30,-40,-50],
  [-30,-20,-10,  0,  0,-10,-20,-30],
  [-30,-10, 20, 30, 30, 20,-10,-30],
  [-30,-10, 30, 40, 40, 30,-10,-30],
  [-30,-10, 30, 40, 40, 30,-10,-30],
  [-30,-10, 20, 30, 30, 20,-10,-30],
  [-30,-30,  0,  0,  0,  0,-30,-30],
  [-50,-30,-30,-30,-30,-30,-30,-50]
];

const pieceSquareTables = {
  [PIECE_TYPES.PAWN]: pawnTable,
  [PIECE_TYPES.KNIGHT]: knightTable,
  [PIECE_TYPES.BISHOP]: bishopTable,
  [PIECE_TYPES.ROOK]: rookTable,
  [PIECE_TYPES.QUEEN]: queenTable,
  [PIECE_TYPES.KING]: { mg: kingTableMg, eg: kingTableEg }
};

// --- Main Bot Function ---

/**
 * The main function that the game calls to get the bot's move.
 * @param {Object} gameState - The current state of the game.
 * @param {string} botColor - The color the bot is playing ('white' or 'black').
 * @returns {Object} The best move found, e.g., { from: { row, col }, to: { row, col } }.
 */
export function makeMove(gameState, botColor) {
  const startTime = performance.now();
  const validMoves = getAllValidMoves(gameState, botColor);

  if (validMoves.length === 0) {
    return null;
  }
  
  // --- Track position history for threefold repetition ---
  const positionCounts = {};
  let tempState = getInitialGameState();
  let key = generatePositionKey(tempState);
  positionCounts[key] = 1;

  for (const move of gameState.moveHistory) {
    tempState = applyMoveToGameState(tempState, move);
    key = generatePositionKey(tempState);
    positionCounts[key] = (positionCounts[key] || 0) + 1;
  }

  const moveNumber = Math.floor(gameState.moveHistory.length / 2) + 1;

  let timeLimit;
  if (moveNumber <= 10) {
    timeLimit = 500;
  } else if (moveNumber <= 20) {
    timeLimit = 1000;
  } else {
    timeLimit = 2000;
  }

  let bestMove = validMoves[0];
  const transpositionTable = new Map();
  const searchContext = { startTime, timeLimit, positionCounts, transpositionTable, botColor };

  try {
    // Iterative Deepening
    for (let currentDepth = 1; currentDepth <= MAX_SEARCH_DEPTH; currentDepth++) {
      const result = searchRoot(currentDepth, gameState, -Infinity, Infinity, searchContext, bestMove, moveNumber);

      if (performance.now() - startTime > timeLimit) {
        break;
      }
      
      if(result.move) {
        bestMove = result.move;
      }
    }
  } catch (e) {
    if (e.message !== "Timeout") {
      throw e; // re-throw unexpected errors
    }
  }

  return bestMove;
}

function searchRoot(depth, gameState, alpha, beta, searchContext, principalVariationMove, moveNumber) {
    let bestMove = principalVariationMove;
    let bestValue = -Infinity;
    
    const validMoves = getAllValidMoves(gameState, gameState.currentTurn);
    const orderedMoves = orderMoves(gameState, validMoves, principalVariationMove, moveNumber);

    for (const move of orderedMoves) {
        if (performance.now() - searchContext.startTime > searchContext.timeLimit) {
            throw new Error("Timeout");
        }

        const testGameState = applyMoveToGameState(gameState, move);
        let moveValue;

        const nextKey = generatePositionKey(testGameState);
        if ((searchContext.positionCounts[nextKey] || 0) >= 2) {
            moveValue = 0;
        } else {
            moveValue = minimax(testGameState, depth - 1, alpha, beta, false, searchContext.botColor, searchContext);
        }

        if (moveValue > bestValue) {
            bestValue = moveValue;
            bestMove = move;
            alpha = Math.max(alpha, bestValue);
        }
    }

    return { move: bestMove, score: bestValue };
}

// --- Search Algorithm (Minimax with Alpha-Beta Pruning) ---

function minimax(gameState, depth, alpha, beta, isMaximizingPlayer, botColor, searchContext) {
  if (performance.now() - searchContext.startTime > searchContext.timeLimit) {
    throw new Error("Timeout");
  }

  const originalAlpha = alpha;
  const positionKey = generatePositionKey(gameState);
  const ttEntry = searchContext.transpositionTable.get(positionKey);
  if (ttEntry && ttEntry.depth >= depth) {
    if (ttEntry.flag === 'EXACT') return ttEntry.score;
    if (ttEntry.flag === 'LOWERBOUND' && ttEntry.score > alpha) alpha = Math.max(alpha, ttEntry.score);
    if (ttEntry.flag === 'UPPERBOUND' && ttEntry.score < beta) beta = Math.min(beta, ttEntry.score);
    if (alpha >= beta) return ttEntry.score;
  }

  const opponentColor = botColor === COLORS.WHITE ? COLORS.BLACK : COLORS.WHITE;
  const playerColor = isMaximizingPlayer ? botColor : opponentColor;
  
  if (isCheckmate(gameState.board, playerColor, gameState)) {
    return isMaximizingPlayer ? -CHECKMATE_SCORE : CHECKMATE_SCORE;
  }
  
  const validMoves = getAllValidMoves(gameState, playerColor);
  if (validMoves.length === 0) { // Stalemate
    return 0;
  }

  if (depth === 0) {
    return quiescenceSearch(gameState, MAX_QUIESCENCE_DEPTH, alpha, beta, isMaximizingPlayer, botColor, searchContext);
  }

  const orderedMoves = orderMoves(gameState, validMoves);
  let bestValue;

  if (isMaximizingPlayer) {
    bestValue = -Infinity;
    for (const move of orderedMoves) {
      const testGameState = applyMoveToGameState(gameState, move);

      const nextKey = generatePositionKey(testGameState);
      if ((searchContext.positionCounts[nextKey] || 0) >= 2) {
          bestValue = Math.max(bestValue, 0);
          alpha = Math.max(alpha, 0);
          continue;
      }

      const evalScore = minimax(testGameState, depth - 1, alpha, beta, false, botColor, searchContext);
      bestValue = Math.max(bestValue, evalScore);
      alpha = Math.max(alpha, evalScore);

      if (beta <= alpha) {
        break;
      }
    }
  } else {
    bestValue = Infinity;
    for (const move of orderedMoves) {
      const testGameState = applyMoveToGameState(gameState, move);

      const nextKey = generatePositionKey(testGameState);
      if ((searchContext.positionCounts[nextKey] || 0) >= 2) {
          bestValue = Math.min(bestValue, 0);
          beta = Math.min(beta, 0);
          continue;
      }

      const evalScore = minimax(testGameState, depth - 1, alpha, beta, true, botColor, searchContext);
      bestValue = Math.min(bestValue, evalScore);
      beta = Math.min(beta, evalScore);

      if (beta <= alpha) {
        break;
      }
    }
  }

  // --- Store in Transposition Table ---
  let flag = 'EXACT';
  if (bestValue <= originalAlpha) {
    flag = 'UPPERBOUND';
  } else if (bestValue >= beta) {
    flag = 'LOWERBOUND';
  }
  searchContext.transpositionTable.set(positionKey, { score: bestValue, depth, flag });

  return bestValue;
}

function quiescenceSearch(gameState, depth, alpha, beta, isMaximizingPlayer, botColor, searchContext) {
    if (performance.now() - searchContext.startTime > searchContext.timeLimit) {
        throw new Error("Timeout");
    }

    const standPat = evaluatePosition(gameState, botColor);

    if (depth === 0) {
        return standPat;
    }

    if (isMaximizingPlayer) {
        if (standPat >= beta) return standPat;
        alpha = Math.max(alpha, standPat);
    } else {
        if (standPat <= alpha) return standPat;
        beta = Math.min(beta, standPat);
    }

    const opponentColor = botColor === COLORS.WHITE ? COLORS.BLACK : COLORS.WHITE;
    const playerColor = isMaximizingPlayer ? botColor : opponentColor;
    
    const validMoves = getAllValidMoves(gameState, playerColor);
    const captureMoves = validMoves.filter(move => gameState.board[move.to.row][move.to.col]);
    const orderedCaptures = orderMoves(gameState, captureMoves);

    for (const move of orderedCaptures) {
        const testGameState = applyMoveToGameState(gameState, move);
        
        const nextKey = generatePositionKey(testGameState);
        if ((searchContext.positionCounts[nextKey] || 0) >= 2) {
            const score = 0;
            if (isMaximizingPlayer) {
                if (score >= beta) return beta;
                alpha = Math.max(alpha, score);
            } else {
                if (score <= alpha) return alpha;
                beta = Math.min(beta, score);
            }
            continue;
        }

        const score = quiescenceSearch(testGameState, depth - 1, alpha, beta, !isMaximizingPlayer, botColor, searchContext);

        if (isMaximizingPlayer) {
            if (score >= beta) return beta;
            alpha = Math.max(alpha, score);
        } else {
            if (score <= alpha) return alpha;
            beta = Math.min(beta, score);
        }
    }

    return isMaximizingPlayer ? alpha : beta;
}

// --- Evaluation Function ---

function evaluatePosition(gameState, botColor) {
  let score = 0;
  const { board } = gameState;
  const opponentColor = botColor === COLORS.WHITE ? COLORS.BLACK : COLORS.WHITE;

  const gamePhase = getGamePhase(board); // 1 for opening, 0 for endgame

  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col];
      if (piece) {
        const materialValue = PIECE_VALUES[piece.type];
        const positionalValue = getPositionalValue(piece, row, col, gamePhase);
        
        const totalValue = materialValue + positionalValue;

        if (piece.color === botColor) {
          score += totalValue;
        } else {
          score -= totalValue;
        }
      }
    }
  }
  
  return score;
}

function getPositionalValue(piece, row, col, gamePhase) {
    const table = pieceSquareTables[piece.type];
    if (!table) return 0;
    
    const r = row;
    const c = piece.color === COLORS.WHITE ? col : 7 - col; // Flip column for black

    if (piece.type === PIECE_TYPES.KING) {
        const mgScore = table.mg[r][c];
        const egScore = table.eg[r][c];
        return Math.round(mgScore * gamePhase + egScore * (1 - gamePhase));
    }
    
    return table[r] ? table[r][c] || 0 : 0;
}

// --- Utility Functions ---

function getGamePhase(board) {
    const totalMaterial = 2 * (PIECE_VALUES.QUEEN + 2 * PIECE_VALUES.ROOK + 2 * PIECE_VALUES.BISHOP + 2 * PIECE_VALUES.KNIGHT);
    let currentMaterial = 0;
    for(let r=0; r<8; r++) {
        for(let c=0; c<8; c++) {
            const piece = board[r][c];
            if(piece && piece.type !== PIECE_TYPES.KING && piece.type !== PIECE_TYPES.PAWN) {
                currentMaterial += PIECE_VALUES[piece.type];
            }
        }
    }
    return Math.min(1, currentMaterial / totalMaterial);
}

function orderMoves(gameState, moves, principalVariationMove = null, moveNumber = -1) {
    if (principalVariationMove) {
        // Make the principal variation move the first to be searched
        moves = moves.filter(m => !(m.from.row === principalVariationMove.from.row && m.from.col === principalVariationMove.from.col && m.to.row === principalVariationMove.to.row && m.to.col === principalVariationMove.to.col));
        moves.unshift(principalVariationMove);
    }

    const scoredMoves = moves.map(move => {
        let score = 0;
        const fromPiece = gameState.board[move.from.row][move.from.col];
        const toPiece = gameState.board[move.to.row][move.to.col];

        if (toPiece) {
            // MVV-LVA: Most Valuable Victim - Least Valuable Aggressor
            score = 10 * PIECE_VALUES[toPiece.type] - PIECE_VALUES[fromPiece.type];
        } else {
            // Add a small random factor to quiet moves to vary the search path
            score += Math.random() * 10;
        }

        // Opening move prioritization
        if (moveNumber > 0 && moveNumber <= 10) {
            const colDiff = move.to.col - move.from.col;

            // Prioritize knights
            if (fromPiece.type === PIECE_TYPES.KNIGHT) {
                score += 10000;
            }

            // Prioritize kingside/queenside pawns (rook pawns, rows 0 and 7)
            if (fromPiece.type === PIECE_TYPES.PAWN && (move.from.row === 0 || move.from.row === 7)) {
                const direction = fromPiece.color === COLORS.WHITE ? 1 : -1;
                // by one or two squares
                if (colDiff === direction || colDiff === 2 * direction) {
                    score += 10000;
                }
            }
        }

        // Add other scoring, e.g., promotions, checks
        const piece = fromPiece.type;
        const promotionRank = fromPiece.color === COLORS.WHITE ? 7 : 0;
        if (piece === PIECE_TYPES.PAWN && move.to.col === promotionRank) {
            score += PIECE_VALUES.QUEEN;
        }

        return { move, score };
    });

    return scoredMoves.sort((a, b) => b.score - a.score).map(sm => sm.move);
}

/**
 * Get all valid moves for a given color.
 */
function getAllValidMoves(gameState, color) {
  const moves = [];
  const { board } = gameState;
  const tempGameState = { ...gameState, currentTurn: color };

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (!piece || piece.color !== color) continue;
      
      const from = { row: r, col: c };
      const pseudoLegalMoves = generatePseudoLegalMoves(board, piece, from, tempGameState);

      for (const to of pseudoLegalMoves) {
        const testBoard = makeTestMove(board, from, to, tempGameState);
        if (!isInCheck(testBoard, color)) {
            moves.push({ from, to });
        }
      }
    }
  }
  return moves;
}

function generatePseudoLegalMoves(board, piece, from, gameState) {
    switch (piece.type) {
        case PIECE_TYPES.PAWN:
            return getPawnPseudoLegalMoves(board, piece, from, gameState);
        case PIECE_TYPES.KNIGHT:
            return getKnightPseudoLegalMoves(board, piece, from);
        case PIECE_TYPES.BISHOP:
            return getSlidingPseudoLegalMoves(board, piece, from, [[-1, -1], [-1, 1], [1, -1], [1, 1]]);
        case PIECE_TYPES.ROOK:
            return getSlidingPseudoLegalMoves(board, piece, from, [[-1, 0], [1, 0], [0, -1], [0, 1]]);
        case PIECE_TYPES.QUEEN:
            return getSlidingPseudoLegalMoves(board, piece, from, [[-1, -1], [-1, 1], [1, -1], [1, 1], [-1, 0], [1, 0], [0, -1], [0, 1]]);
        case PIECE_TYPES.KING:
            return getKingPseudoLegalMoves(board, piece, from);
        default:
            return [];
    }
}

function getPawnPseudoLegalMoves(board, piece, from, gameState) {
    const moves = [];
    const { r, c } = {r: from.row, c: from.col};
    const direction = piece.color === COLORS.WHITE ? 1 : -1;
    const startCol = piece.color === COLORS.WHITE ? 1 : 6;

    // Single move
    if (c + direction >=0 && c+direction < 8 && !board[r][c + direction]) {
        moves.push({ row: r, col: c + direction });
    }
    // Double move
    if (c === startCol && !board[r][c + direction] && !board[r][c + 2 * direction]) {
        moves.push({ row: r, col: c + 2 * direction });
    }
    // Captures
    const captureRows = [r - 1, r + 1];
    for (const captureRow of captureRows) {
        if (captureRow >= 0 && captureRow < 8) {
            const target = board[captureRow][c + direction];
            if (target && target.color !== piece.color) {
                moves.push({ row: captureRow, col: c + direction });
            }
            // En passant
            if (gameState.enPassantTarget && 
                gameState.enPassantTarget.row === captureRow &&
                gameState.enPassantTarget.col === c + direction) {
                moves.push({ row: captureRow, col: c + direction });
            }
        }
    }
    return moves;
}

function getKnightPseudoLegalMoves(board, piece, from) {
    const moves = [];
    const { r, c } = {r: from.row, c: from.col};
    const knightMoves = [
        [-2, -1], [-2, 1], [-1, -2], [-1, 2],
        [1, -2], [1, 2], [2, -1], [2, 1]
    ];
    for (const [dr, dc] of knightMoves) {
        const to = { row: r + dr, col: c + dc };
        if (to.row >= 0 && to.row < 8 && to.col >= 0 && to.col < 8) {
            const target = board[to.row][to.col];
            if (!target || target.color !== piece.color) {
                moves.push(to);
            }
        }
    }
    return moves;
}

function getKingPseudoLegalMoves(board, piece, from) {
    const moves = [];
    const { r, c } = {r: from.row, c: from.col};
    const kingMoves = [
        [-1, -1], [-1, 0], [-1, 1], [0, -1],
        [0, 1], [1, -1], [1, 0], [1, 1]
    ];
    for (const [dr, dc] of kingMoves) {
        const to = { row: r + dr, col: c + dc };
        if (to.row >= 0 && to.row < 8 && to.col >= 0 && to.col < 8) {
            const target = board[to.row][to.col];
            if (!target || target.color !== piece.color) {
                moves.push(to);
            }
        }
    }
    // Castling would be added here
    return moves;
}

function getSlidingPseudoLegalMoves(board, piece, from, directions) {
    const moves = [];
    const { r, c } = {r: from.row, c: from.col};

    for (const [dr, dc] of directions) {
        for (let i = 1; i < 8; i++) {
            const to = { row: r + i * dr, col: c + i * dc };
            if (to.row < 0 || to.row >= 8 || to.col < 0 || to.col >= 8) break;

            const target = board[to.row][to.col];
            if (target) {
                if (target.color !== piece.color) {
                    moves.push(to);
                }
                break; 
            }
            moves.push(to);
        }
    }
    return moves;
}

/**
 * Creates a new board state with a move applied.
 */
function makeTestMove(board, from, to, gameState) {
  const newBoard = board.map(row => [...row]);
  const piece = newBoard[from.row][from.col];

  newBoard[to.row][to.col] = piece;
  newBoard[from.row][from.col] = null;
  
  // Handle en passant capture
  if (piece.type === PIECE_TYPES.PAWN && gameState.enPassantTarget) {
      if (to.row === gameState.enPassantTarget.row && to.col === gameState.enPassantTarget.col) {
          const opponentPawnRow = from.row;
          const opponentPawnCol = to.col;
          newBoard[opponentPawnRow][opponentPawnCol] = null;
      }
  }
  
  // Handle pawn promotion (simple version, promotes to Queen)
  if (piece && piece.type === PIECE_TYPES.PAWN) {
      const promotionRank = piece.color === COLORS.WHITE ? 7 : 0;
      if (to.col === promotionRank) {
          newBoard[to.row][to.col] = { ...piece, type: PIECE_TYPES.QUEEN };
      }
  }

  return newBoard;
}

/**
 * Creates a deep copy of the game state and applies a move.
 */
function applyMoveToGameState(gameState, move) {
    const board = gameState.board;
    const piece = board[move.from.row][move.from.col];
    
    const newBoard = makeTestMove(board, move.from, move.to, gameState);
    const newCurrentTurn = gameState.currentTurn === COLORS.WHITE ? COLORS.BLACK : COLORS.WHITE;

    // --- Update Castling Rights ---
    const newCastlingRights = { ...gameState.castlingRights };
    if (piece.type === PIECE_TYPES.KING) {
        if (piece.color === COLORS.WHITE) {
            newCastlingRights.whiteKingSide = false;
            newCastlingRights.whiteQueenSide = false;
        } else {
            newCastlingRights.blackKingSide = false;
            newCastlingRights.blackQueenSide = false;
        }
    }
    // If a rook moves from its starting square
    const whiteKingSideRookStart = {row: 7, col: 0};
    const whiteQueenSideRookStart = {row: 0, col: 0};
    const blackKingSideRookStart = {row: 7, col: 7};
    const blackQueenSideRookStart = {row: 0, col: 7};

    if (move.from.row === whiteKingSideRookStart.row && move.from.col === whiteKingSideRookStart.col) newCastlingRights.whiteKingSide = false;
    if (move.from.row === whiteQueenSideRookStart.row && move.from.col === whiteQueenSideRookStart.col) newCastlingRights.whiteQueenSide = false;
    if (move.from.row === blackKingSideRookStart.row && move.from.col === blackKingSideRookStart.col) newCastlingRights.blackKingSide = false;
    if (move.from.row === blackQueenSideRookStart.row && move.from.col === blackQueenSideRookStart.col) newCastlingRights.blackQueenSide = false;
    
    // --- Update En Passant Target ---
    let newEnPassantTarget = null;
    if (piece.type === PIECE_TYPES.PAWN) {
        const colDiff = move.to.col - move.from.col;
        if (Math.abs(colDiff) === 2) {
            newEnPassantTarget = { row: move.from.row, col: move.from.col + colDiff / 2 };
        }
    }

    return {
        ...gameState,
        board: newBoard,
        currentTurn: newCurrentTurn,
        castlingRights: newCastlingRights,
        enPassantTarget: newEnPassantTarget,
        moveHistory: [...gameState.moveHistory, move],
    };
}

function getInitialGameState() {
    const board = Array(8).fill(null).map(() => Array(8).fill(null));

    const place = (row, col, type, color) => {
        board[row][col] = { type, color, hasMoved: false };
    };

    const backRank = [PIECE_TYPES.ROOK, PIECE_TYPES.KNIGHT, PIECE_TYPES.BISHOP, PIECE_TYPES.QUEEN, PIECE_TYPES.KING, PIECE_TYPES.BISHOP, PIECE_TYPES.KNIGHT, PIECE_TYPES.ROOK];

    for (let i = 0; i < 8; i++) {
        place(i, 0, backRank[i], COLORS.WHITE);
        place(i, 1, PIECE_TYPES.PAWN, COLORS.WHITE);
        place(i, 7, backRank[i], COLORS.BLACK);
        place(i, 6, PIECE_TYPES.PAWN, COLORS.BLACK);
    }
    
    return {
        board,
        currentTurn: COLORS.WHITE,
        castlingRights: {
            whiteKingSide: true,
            whiteQueenSide: true,
            blackKingSide: true,
            blackQueenSide: true,
        },
        enPassantTarget: null,
        moveHistory: [],
        capturedPieces: { white: [], black: [] },
        gameStatus: 'playing',
    };
}

function generatePositionKey(gameState) {
    const { board, currentTurn, castlingRights, enPassantTarget } = gameState;
    let key = '';

    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const piece = board[r][c];
            key += piece ? `${piece.color.charAt(0)}${piece.type}` : '-';
        }
    }
    
    key += `|${currentTurn}`;
    key += `|${castlingRights.whiteKingSide ? 'K' : ''}${castlingRights.whiteQueenSide ? 'Q' : ''}${castlingRights.blackKingSide ? 'k' : ''}${castlingRights.blackQueenSide ? 'q' : ''}`;
    key += `|${enPassantTarget ? `${enPassantTarget.row}${enPassantTarget.col}` : '-'}`;

    return key;
}
