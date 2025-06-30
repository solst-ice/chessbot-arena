// claude-opus-4-20250514-ULTRATHINK - Advanced Chess Engine
// Implements state-of-the-art techniques for competitive play

import { isValidMove, isInCheck, isCheckmate } from '../chess/moveValidation';
import { PIECE_TYPES, COLORS, PIECE_VALUES } from '../chess/gameState';

// ===== CONFIGURATION =====
const MAX_SEARCH_TIME = 20000; // 20 seconds maximum
const OPENING_SEARCH_TIME = 3000; // 3 seconds for opening
const MAX_DEPTH = 20;
const QUIESCENCE_DEPTH = 4; // Reduced for faster search
const ASPIRATION_WINDOW = 50;
const NULL_MOVE_REDUCTION = 2;
const LMR_FULL_DEPTH_MOVES = 4;
const LMR_REDUCTION_LIMIT = 3;
const FUTILITY_MARGIN = 200;
const TIME_CHECK_INTERVAL = 1024; // Check time more frequently

// ===== BITBOARD REPRESENTATION =====
// Using BigInt for 64-bit bitboards
class BitBoard {
  constructor() {
    // Initialize bitboards for each piece type and color
    this.pieces = {
      white: {
        pawn: 0n,
        knight: 0n,
        bishop: 0n,
        rook: 0n,
        queen: 0n,
        king: 0n
      },
      black: {
        pawn: 0n,
        knight: 0n,
        bishop: 0n,
        rook: 0n,
        queen: 0n,
        king: 0n
      }
    };
    this.allPieces = 0n;
    this.whitePieces = 0n;
    this.blackPieces = 0n;
  }

  // Convert standard board to bitboard
  fromBoard(board) {
    this.clear();
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = board[row][col];
        if (piece) {
          const bit = 1n << BigInt(row * 8 + col);
          this.pieces[piece.color][piece.type] = this.pieces[piece.color][piece.type] | bit;
          if (piece.color === 'white') {
            this.whitePieces = this.whitePieces | bit;
          } else {
            this.blackPieces = this.blackPieces | bit;
          }
          this.allPieces = this.allPieces | bit;
        }
      }
    }
  }

  clear() {
    for (const color in this.pieces) {
      for (const piece in this.pieces[color]) {
        this.pieces[color][piece] = 0n;
      }
    }
    this.allPieces = 0n;
    this.whitePieces = 0n;
    this.blackPieces = 0n;
  }

  // Bit manipulation helpers
  setBit(square) {
    return 1n << BigInt(square);
  }

  getBit(bitboard, square) {
    return (bitboard & (1n << BigInt(square))) !== 0n;
  }

  popBit(bitboard, square) {
    return bitboard & ~(1n << BigInt(square));
  }

  countBits(bitboard) {
    let count = 0;
    let bb = bitboard;
    while (bb) {
      bb &= bb - 1n;
      count++;
    }
    return count;
  }

  getLSB(bitboard) {
    if (!bitboard) return -1;
    return Number((bitboard & -bitboard).toString(2).length - 1);
  }
}

// ===== ZOBRIST HASHING =====
class ZobristHash {
  constructor() {
    this.pieceKeys = {};
    this.castlingKeys = {};
    this.enPassantKeys = [];
    this.sideKey = this.random64();
    this.initializeKeys();
  }

  random64() {
    // Generate 64-bit random number using BigInt
    const high = BigInt(Math.floor(Math.random() * 0x100000000));
    const low = BigInt(Math.floor(Math.random() * 0x100000000));
    return (high << 32n) | low;
  }

  initializeKeys() {
    // Initialize piece keys
    const pieces = ['pawn', 'knight', 'bishop', 'rook', 'queen', 'king'];
    const colors = ['white', 'black'];
    
    for (const color of colors) {
      this.pieceKeys[color] = {};
      for (const piece of pieces) {
        this.pieceKeys[color][piece] = [];
        for (let square = 0; square < 64; square++) {
          this.pieceKeys[color][piece][square] = this.random64();
        }
      }
    }

    // Initialize castling keys
    this.castlingKeys = {
      whiteKingside: this.random64(),
      whiteQueenside: this.random64(),
      blackKingside: this.random64(),
      blackQueenside: this.random64()
    };

    // Initialize en passant keys
    for (let file = 0; file < 8; file++) {
      this.enPassantKeys[file] = this.random64();
    }
  }

  hashPosition(board, gameState) {
    let hash = 0n;

    // Hash pieces
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = board[row][col];
        if (piece) {
          const square = row * 8 + col;
          hash ^= this.pieceKeys[piece.color][piece.type][square];
        }
      }
    }

    // Hash side to move
    if (gameState.currentTurn === 'black') {
      hash ^= this.sideKey;
    }

    // Hash castling rights
    if (gameState.castlingRights) {
      if (gameState.castlingRights.whiteKingside) hash ^= this.castlingKeys.whiteKingside;
      if (gameState.castlingRights.whiteQueenside) hash ^= this.castlingKeys.whiteQueenside;
      if (gameState.castlingRights.blackKingside) hash ^= this.castlingKeys.blackKingside;
      if (gameState.castlingRights.blackQueenside) hash ^= this.castlingKeys.blackQueenside;
    }

    // Hash en passant
    if (gameState.enPassantTarget) {
      const file = gameState.enPassantTarget.col;
      hash ^= this.enPassantKeys[file];
    }

    return hash;
  }
}

// ===== TRANSPOSITION TABLE =====
class TranspositionTable {
  constructor(sizeMB = 128) {
    this.size = (sizeMB * 1024 * 1024) / 32; // Each entry is ~32 bytes
    this.table = new Map();
    this.zobrist = new ZobristHash();
  }

  store(hash, depth, score, flag, move, age) {
    // Replace if deeper or newer
    const existing = this.table.get(hash);
    if (!existing || depth >= existing.depth || age > existing.age) {
      this.table.set(hash, { depth, score, flag, move, age });
      
      // Maintain size limit
      if (this.table.size > this.size) {
        // Remove oldest entries
        const toRemove = this.table.size - this.size;
        const entries = Array.from(this.table.entries());
        entries.sort((a, b) => a[1].age - b[1].age);
        for (let i = 0; i < toRemove; i++) {
          this.table.delete(entries[i][0]);
        }
      }
    }
  }

  probe(hash) {
    return this.table.get(hash);
  }

  clear() {
    this.table.clear();
  }
}

// ===== PIECE-SQUARE TABLES =====
const PIECE_SQUARE_TABLES = {
  pawn: {
    white: [
      [0,  0,  0,  0,  0,  0,  0,  0],
      [50, 50, 50, 50, 50, 50, 50, 50],
      [10, 10, 20, 30, 30, 20, 10, 10],
      [5,  5, 10, 25, 25, 10,  5,  5],
      [0,  0,  0, 20, 20,  0,  0,  0],
      [5, -5,-10,  0,  0,-10, -5,  5],
      [5, 10, 10,-20,-20, 10, 10,  5],
      [0,  0,  0,  0,  0,  0,  0,  0]
    ],
    black: null // Will be mirrored
  },
  knight: {
    white: [
      [-50,-40,-30,-30,-30,-30,-40,-50],
      [-40,-20,  0,  0,  0,  0,-20,-40],
      [-30,  0, 10, 15, 15, 10,  0,-30],
      [-30,  5, 15, 20, 20, 15,  5,-30],
      [-30,  0, 15, 20, 20, 15,  0,-30],
      [-30,  5, 10, 15, 15, 10,  5,-30],
      [-40,-20,  0,  5,  5,  0,-20,-40],
      [-50,-40,-30,-30,-30,-30,-40,-50]
    ],
    black: null
  },
  bishop: {
    white: [
      [-20,-10,-10,-10,-10,-10,-10,-20],
      [-10,  0,  0,  0,  0,  0,  0,-10],
      [-10,  0,  5, 10, 10,  5,  0,-10],
      [-10,  5,  5, 10, 10,  5,  5,-10],
      [-10,  0, 10, 10, 10, 10,  0,-10],
      [-10, 10, 10, 10, 10, 10, 10,-10],
      [-10,  5,  0,  0,  0,  0,  5,-10],
      [-20,-10,-10,-10,-10,-10,-10,-20]
    ],
    black: null
  },
  rook: {
    white: [
      [0,  0,  0,  0,  0,  0,  0,  0],
      [5, 10, 10, 10, 10, 10, 10,  5],
      [-5,  0,  0,  0,  0,  0,  0, -5],
      [-5,  0,  0,  0,  0,  0,  0, -5],
      [-5,  0,  0,  0,  0,  0,  0, -5],
      [-5,  0,  0,  0,  0,  0,  0, -5],
      [-5,  0,  0,  0,  0,  0,  0, -5],
      [0,  0,  0,  5,  5,  0,  0,  0]
    ],
    black: null
  },
  queen: {
    white: [
      [-20,-10,-10, -5, -5,-10,-10,-20],
      [-10,  0,  0,  0,  0,  0,  0,-10],
      [-10,  0,  5,  5,  5,  5,  0,-10],
      [-5,  0,  5,  5,  5,  5,  0, -5],
      [0,  0,  5,  5,  5,  5,  0, -5],
      [-10,  5,  5,  5,  5,  5,  0,-10],
      [-10,  0,  5,  0,  0,  0,  0,-10],
      [-20,-10,-10, -5, -5,-10,-10,-20]
    ],
    black: null
  },
  king: {
    middlegame: {
      white: [
        [-30,-40,-40,-50,-50,-40,-40,-30],
        [-30,-40,-40,-50,-50,-40,-40,-30],
        [-30,-40,-40,-50,-50,-40,-40,-30],
        [-30,-40,-40,-50,-50,-40,-40,-30],
        [-20,-30,-30,-40,-40,-30,-30,-20],
        [-10,-20,-20,-20,-20,-20,-20,-10],
        [20, 20,  0,  0,  0,  0, 20, 20],
        [20, 30, 10,  0,  0, 10, 30, 20]
      ],
      black: null
    },
    endgame: {
      white: [
        [-50,-40,-30,-20,-20,-30,-40,-50],
        [-30,-20,-10,  0,  0,-10,-20,-30],
        [-30,-10, 20, 30, 30, 20,-10,-30],
        [-30,-10, 30, 40, 40, 30,-10,-30],
        [-30,-10, 30, 40, 40, 30,-10,-30],
        [-30,-10, 20, 30, 30, 20,-10,-30],
        [-30,-30,  0,  0,  0,  0,-30,-30],
        [-50,-30,-30,-30,-30,-30,-30,-50]
      ],
      black: null
    }
  }
};

// Initialize black piece-square tables (mirror of white)
for (const piece in PIECE_SQUARE_TABLES) {
  if (piece === 'king') {
    PIECE_SQUARE_TABLES.king.middlegame.black = PIECE_SQUARE_TABLES.king.middlegame.white.slice().reverse();
    PIECE_SQUARE_TABLES.king.endgame.black = PIECE_SQUARE_TABLES.king.endgame.white.slice().reverse();
  } else if (PIECE_SQUARE_TABLES[piece].white) {
    PIECE_SQUARE_TABLES[piece].black = PIECE_SQUARE_TABLES[piece].white.slice().reverse();
  }
}

// ===== OPENING BOOK =====
const OPENING_BOOK = {
  // Starting position
  'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -': [
    { from: { row: 1, col: 4 }, to: { row: 2, col: 4 }, weight: 30 }, // e4
    { from: { row: 1, col: 3 }, to: { row: 2, col: 3 }, weight: 25 }, // d4
    { from: { row: 0, col: 1 }, to: { row: 2, col: 2 }, weight: 15 }, // Nf3
    { from: { row: 1, col: 2 }, to: { row: 2, col: 2 }, weight: 10 }, // c4
    { from: { row: 0, col: 6 }, to: { row: 2, col: 5 }, weight: 10 }, // Nc3
    { from: { row: 1, col: 6 }, to: { row: 2, col: 6 }, weight: 5 },  // g3
    { from: { row: 1, col: 5 }, to: { row: 2, col: 5 }, weight: 5 }   // f4
  ],
  // After 1.e4
  'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3': [
    { from: { row: 6, col: 4 }, to: { row: 5, col: 4 }, weight: 30 }, // e5
    { from: { row: 6, col: 2 }, to: { row: 5, col: 2 }, weight: 25 }, // c5
    { from: { row: 6, col: 4 }, to: { row: 4, col: 4 }, weight: 15 }, // e6
    { from: { row: 6, col: 2 }, to: { row: 4, col: 2 }, weight: 10 }, // c6
    { from: { row: 6, col: 3 }, to: { row: 5, col: 3 }, weight: 10 }, // d5
    { from: { row: 7, col: 6 }, to: { row: 5, col: 5 }, weight: 5 }   // Nf6
  ]
};

// ===== EVALUATION FUNCTION =====
class Evaluator {
  constructor() {
    this.materialValues = {
      pawn: 100,
      knight: 320,
      bishop: 330,
      rook: 500,
      queen: 900,
      king: 20000
    };
  }

  evaluate(board, gameState, bitboard) {
    let score = 0;
    const phase = this.getGamePhase(board);
    
    // Material and piece-square tables
    score += this.evaluateMaterial(board, phase);
    
    // Pawn structure
    score += this.evaluatePawnStructure(board, bitboard);
    
    // King safety
    score += this.evaluateKingSafety(board, gameState);
    
    // Piece activity
    score += this.evaluatePieceActivity(board, gameState);
    
    // Mobility
    score += this.evaluateMobility(board, gameState);
    
    // Special patterns
    score += this.evaluateSpecialPatterns(board, gameState);
    
    return gameState.currentTurn === 'white' ? score : -score;
  }

  getGamePhase(board) {
    let totalMaterial = 0;
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = board[row][col];
        if (piece && piece.type !== 'king') {
          totalMaterial += this.materialValues[piece.type];
        }
      }
    }
    
    // Endgame if total material < 1500 per side
    return totalMaterial < 3000 ? 'endgame' : 'middlegame';
  }

  evaluateMaterial(board, phase) {
    let score = 0;
    
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = board[row][col];
        if (piece) {
          const value = this.materialValues[piece.type];
          const psValue = this.getPieceSquareValue(piece, row, col, phase);
          
          if (piece.color === 'white') {
            score += value + psValue;
          } else {
            score -= value + psValue;
          }
        }
      }
    }
    
    return score;
  }

  getPieceSquareValue(piece, row, col, phase) {
    if (piece.type === 'king') {
      const table = PIECE_SQUARE_TABLES.king[phase][piece.color];
      return table[row][col];
    } else if (PIECE_SQUARE_TABLES[piece.type]) {
      const table = PIECE_SQUARE_TABLES[piece.type][piece.color];
      return table[row][col];
    }
    return 0;
  }

  evaluatePawnStructure(board, bitboard) {
    let score = 0;
    const pawnFiles = { white: new Set(), black: new Set() };
    
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = board[row][col];
        if (piece && piece.type === 'pawn') {
          pawnFiles[piece.color].add(col);
          
          // Passed pawns
          if (this.isPassedPawn(board, row, col, piece.color)) {
            const advancement = piece.color === 'white' ? col : 7 - col;
            score += piece.color === 'white' ? 
              (20 + advancement * advancement * 5) : 
              -(20 + advancement * advancement * 5);
          }
          
          // Isolated pawns
          if (this.isIsolatedPawn(board, row, col, piece.color)) {
            score += piece.color === 'white' ? -15 : 15;
          }
          
          // Backward pawns
          if (this.isBackwardPawn(board, row, col, piece.color)) {
            score += piece.color === 'white' ? -10 : 10;
          }
        }
      }
    }
    
    // Doubled pawns
    for (const color of ['white', 'black']) {
      const files = Array.from(pawnFiles[color]);
      for (const file of files) {
        const pawnsInFile = this.countPawnsInFile(board, file, color);
        if (pawnsInFile > 1) {
          score += color === 'white' ? -10 * (pawnsInFile - 1) : 10 * (pawnsInFile - 1);
        }
      }
    }
    
    return score;
  }

  isPassedPawn(board, row, col, color) {
    const direction = color === 'white' ? 1 : -1;
    const startCol = col + direction;
    const endCol = color === 'white' ? 8 : -1;
    
    for (let c = startCol; c !== endCol; c += direction) {
      for (let r = Math.max(0, row - 1); r <= Math.min(7, row + 1); r++) {
        const piece = board[r][c];
        if (piece && piece.type === 'pawn' && piece.color !== color) {
          return false;
        }
      }
    }
    
    return true;
  }

  isIsolatedPawn(board, row, col, color) {
    const adjacentRows = [];
    if (row > 0) adjacentRows.push(row - 1);
    if (row < 7) adjacentRows.push(row + 1);
    
    for (let r = 0; r < 8; r++) {
      for (const adjRow of adjacentRows) {
        const piece = board[r][adjRow];
        if (piece && piece.type === 'pawn' && piece.color === color) {
          return false;
        }
      }
    }
    
    return true;
  }

  isBackwardPawn(board, row, col, color) {
    const direction = color === 'white' ? -1 : 1;
    const behindCol = col + direction;
    
    if (behindCol < 0 || behindCol > 7) return false;
    
    // Check if pawn can't advance
    const frontCol = col - direction;
    if (frontCol >= 0 && frontCol <= 7) {
      const frontPiece = board[row][frontCol];
      if (frontPiece) return false; // Blocked
    }
    
    // Check if no friendly pawns can support
    for (let r = Math.max(0, row - 1); r <= Math.min(7, row + 1); r++) {
      if (r === row) continue;
      for (let c = behindCol; c >= 0 && c <= 7; c += direction) {
        const piece = board[r][c];
        if (piece && piece.type === 'pawn' && piece.color === color) {
          return false;
        }
      }
    }
    
    return true;
  }

  countPawnsInFile(board, file, color) {
    let count = 0;
    for (let row = 0; row < 8; row++) {
      const piece = board[row][file];
      if (piece && piece.type === 'pawn' && piece.color === color) {
        count++;
      }
    }
    return count;
  }

  evaluateKingSafety(board, gameState) {
    let score = 0;
    const phase = this.getGamePhase(board);
    
    if (phase === 'middlegame') {
      // Find kings
      let whiteKing = null, blackKing = null;
      for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
          const piece = board[row][col];
          if (piece && piece.type === 'king') {
            if (piece.color === 'white') whiteKing = { row, col };
            else blackKing = { row, col };
          }
        }
      }
      
      // Evaluate pawn shield
      if (whiteKing) {
        score += this.evaluatePawnShield(board, whiteKing.row, whiteKing.col, 'white');
      }
      if (blackKing) {
        score -= this.evaluatePawnShield(board, blackKing.row, blackKing.col, 'black');
      }
      
      // Penalize exposed king
      if (whiteKing && (whiteKing.col < 2 || whiteKing.col > 5)) {
        score += 20; // Bonus for castled position
      }
      if (blackKing && (blackKing.col < 2 || blackKing.col > 5)) {
        score -= 20;
      }
    }
    
    return score;
  }

  evaluatePawnShield(board, kingRow, kingCol, color) {
    let shield = 0;
    const pawnDirection = color === 'white' ? 1 : -1;
    const pawnRow = kingRow + pawnDirection;
    
    if (pawnRow >= 0 && pawnRow < 8) {
      for (let col = Math.max(0, kingCol - 1); col <= Math.min(7, kingCol + 1); col++) {
        const piece = board[pawnRow][col];
        if (piece && piece.type === 'pawn' && piece.color === color) {
          shield += 10;
        }
      }
    }
    
    return shield;
  }

  evaluatePieceActivity(board, gameState) {
    let score = 0;
    
    // Rooks on open files
    for (let col = 0; col < 8; col++) {
      let hasPawn = false;
      for (let row = 0; row < 8; row++) {
        const piece = board[row][col];
        if (piece && piece.type === 'pawn') {
          hasPawn = true;
          break;
        }
      }
      
      if (!hasPawn) {
        for (let row = 0; row < 8; row++) {
          const piece = board[row][col];
          if (piece && piece.type === 'rook') {
            score += piece.color === 'white' ? 25 : -25;
          }
        }
      }
    }
    
    // Bishop pair bonus
    const bishops = { white: 0, black: 0 };
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = board[row][col];
        if (piece && piece.type === 'bishop') {
          bishops[piece.color]++;
        }
      }
    }
    if (bishops.white >= 2) score += 30;
    if (bishops.black >= 2) score -= 30;
    
    return score;
  }

  evaluateMobility(board, gameState) {
    let score = 0;
    
    // Simple mobility evaluation - count legal moves
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = board[row][col];
        if (piece) {
          const moves = this.getPieceMoves(board, row, col, gameState);
          const mobility = moves.length;
          
          // Weight by piece type
          let weight = 1;
          if (piece.type === 'knight' || piece.type === 'bishop') weight = 4;
          else if (piece.type === 'rook') weight = 2;
          else if (piece.type === 'queen') weight = 1;
          
          score += piece.color === 'white' ? mobility * weight : -mobility * weight;
        }
      }
    }
    
    return score / 10; // Scale down
  }

  getPieceMoves(board, row, col, gameState) {
    const moves = [];
    const piece = board[row][col];
    if (!piece) return moves;
    
    // Generate pseudo-legal moves for the piece
    for (let toRow = 0; toRow < 8; toRow++) {
      for (let toCol = 0; toCol < 8; toCol++) {
        if (isValidMove(board, { row, col }, { row: toRow, col: toCol }, gameState)) {
          moves.push({ from: { row, col }, to: { row: toRow, col: toCol } });
        }
      }
    }
    
    return moves;
  }

  evaluateSpecialPatterns(board, gameState) {
    let score = 0;
    
    // Knight outposts
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = board[row][col];
        if (piece && piece.type === 'knight') {
          if (this.isOutpost(board, row, col, piece.color)) {
            score += piece.color === 'white' ? 20 : -20;
          }
        }
      }
    }
    
    return score;
  }

  isOutpost(board, row, col, color) {
    // Knight is an outpost if it's protected by a pawn and can't be attacked by enemy pawns
    const enemyColor = color === 'white' ? 'black' : 'white';
    const pawnDirection = color === 'white' ? -1 : 1;
    
    // Check if protected by friendly pawn
    let isProtected = false;
    for (let r = -1; r <= 1; r += 2) {
      const protRow = row + pawnDirection;
      const protCol = col + r;
      if (protRow >= 0 && protRow < 8 && protCol >= 0 && protCol < 8) {
        const piece = board[protRow][protCol];
        if (piece && piece.type === 'pawn' && piece.color === color) {
          isProtected = true;
          break;
        }
      }
    }
    
    if (!isProtected) return false;
    
    // Check if can be attacked by enemy pawns
    const enemyPawnDirection = -pawnDirection;
    for (let r = -1; r <= 1; r += 2) {
      const attRow = row + enemyPawnDirection;
      const attCol = col + r;
      if (attRow >= 0 && attRow < 8 && attCol >= 0 && attCol < 8) {
        const piece = board[attRow][attCol];
        if (piece && piece.type === 'pawn' && piece.color === enemyColor) {
          return false;
        }
      }
    }
    
    return true;
  }
}

// ===== MOVE ORDERING =====
class MoveOrdering {
  constructor() {
    this.historyTable = {};
    this.killerMoves = [];
    for (let i = 0; i < MAX_DEPTH; i++) {
      this.killerMoves[i] = [null, null];
    }
  }

  orderMoves(moves, board, ttMove, ply) {
    const scoredMoves = moves.map(move => {
      let score = 0;
      const piece = board[move.from.row][move.from.col];
      
      // TT move gets highest priority
      if (ttMove && this.movesEqual(move, ttMove)) {
        score = 1000000;
      }
      
      // MVV-LVA for captures
      const target = board[move.to.row][move.to.col];
      if (target) {
        const attacker = board[move.from.row][move.from.col];
        score += 10000 + PIECE_VALUES[target.type] * 10 - PIECE_VALUES[attacker.type];
      }
      
      // Promotions
      if (piece && piece.type === 'pawn') {
        const promotionRow = piece.color === 'white' ? 7 : 0;
        if (move.to.col === promotionRow) {
          score += 8500;
        }
      }
      
      // Center control bonus
      const centerBonus = (4 - Math.abs(3.5 - move.to.row)) + (4 - Math.abs(3.5 - move.to.col));
      score += centerBonus * 10;
      
      // Killer moves
      if (ply < MAX_DEPTH && this.killerMoves[ply]) {
        if (this.movesEqual(move, this.killerMoves[ply][0])) score += 9000;
        else if (this.movesEqual(move, this.killerMoves[ply][1])) score += 8000;
      }
      
      // History heuristic
      const historyKey = `${move.from.row},${move.from.col}-${move.to.row},${move.to.col}`;
      score += this.historyTable[historyKey] || 0;
      
      return { move, score };
    });
    
    scoredMoves.sort((a, b) => b.score - a.score);
    return scoredMoves.map(sm => sm.move);
  }

  updateHistory(move, depth) {
    const key = `${move.from.row},${move.from.col}-${move.to.row},${move.to.col}`;
    this.historyTable[key] = (this.historyTable[key] || 0) + depth * depth;
  }

  updateKillers(move, ply) {
    if (!this.isCaptureMove(move) && ply < MAX_DEPTH && this.killerMoves[ply]) {
      if (!this.movesEqual(move, this.killerMoves[ply][0])) {
        this.killerMoves[ply][1] = this.killerMoves[ply][0];
        this.killerMoves[ply][0] = move;
      }
    }
  }

  movesEqual(m1, m2) {
    return m1 && m2 &&
           m1.from.row === m2.from.row &&
           m1.from.col === m2.from.col &&
           m1.to.row === m2.to.row &&
           m1.to.col === m2.to.col;
  }

  isCaptureMove(move) {
    // This should check the board, but for simplicity we'll skip it
    return false;
  }
}

// ===== SEARCH ENGINE =====
class SearchEngine {
  constructor() {
    this.transpositionTable = new TranspositionTable(256); // 256MB
    this.evaluator = new Evaluator();
    this.moveOrdering = new MoveOrdering();
    this.bitboard = new BitBoard();
    this.nodes = 0;
    this.age = 0;
  }

  search(board, gameState, timeLimit) {
    this.startTime = Date.now();
    this.timeLimit = Math.min(timeLimit, MAX_SEARCH_TIME); // Hard cap at 20 seconds
    this.nodes = 0;
    this.age++;
    this.timeUp = false;
    
    // Get all legal moves as fallback
    const allMoves = this.generateAllMoves(board, gameState);
    if (allMoves.length === 0) return null;
    
    // Order moves for better search
    const orderedMoves = this.moveOrdering.orderMoves(allMoves, board, null, 0);
    let bestMove = orderedMoves[0]; // Always have a move
    let bestScore = -Infinity;
    let lastScore = 0;
    
    // Determine max depth based on game phase
    const moveCount = gameState.moveHistory ? gameState.moveHistory.length : 0;
    const maxDepth = moveCount < 10 ? Math.min(MAX_DEPTH, 6) : Math.min(MAX_DEPTH, 10);
    
    // Iterative deepening
    for (let depth = 1; depth <= maxDepth; depth++) {
      // Stop if we've used 30% of our time
      if (Date.now() - this.startTime > this.timeLimit * 0.3) break;
      
      try {
        const score = this.alphaBeta(board, gameState, depth, -Infinity, Infinity, 0, true);
        
        // Only update if we completed the search
        if (!this.timeUp) {
          const pv = this.getPrincipalVariation(board, gameState, depth);
          if (pv.length > 0) {
            bestMove = pv[0];
            bestScore = score;
            lastScore = score;
          }
        }
      } catch (e) {
        if (e.message === 'TIME_UP') {
          break;
        }
        throw e;
      }
      
      // If we found a checkmate, stop searching
      if (Math.abs(bestScore) > 9000) break;
    }
    
    return bestMove;
  }

  alphaBeta(board, gameState, depth, alpha, beta, ply, isPV) {
    this.nodes++;
    
    // Prevent stack overflow
    if (ply >= MAX_DEPTH * 2) {
      return this.evaluator.evaluate(board, gameState, this.bitboard);
    }
    
    // Time check - more frequent checks
    if (this.nodes % TIME_CHECK_INTERVAL === 0) {
      if (Date.now() - this.startTime > this.timeLimit) {
        this.timeUp = true;
        throw new Error('TIME_UP');
      }
    }
    
    // Check extension
    const inCheck = isInCheck(board, gameState.currentTurn);
    if (inCheck && depth < MAX_DEPTH) depth++;
    
    // Quiescence search at leaf nodes
    if (depth <= 0) {
      return this.quiescence(board, gameState, alpha, beta);
    }
    
    // Transposition table probe
    const hash = this.transpositionTable.zobrist.hashPosition(board, gameState);
    const ttEntry = this.transpositionTable.probe(hash);
    
    if (ttEntry && ttEntry.depth >= depth && !isPV) {
      if (ttEntry.flag === 'exact') return ttEntry.score;
      if (ttEntry.flag === 'lower' && ttEntry.score > alpha) alpha = ttEntry.score;
      if (ttEntry.flag === 'upper' && ttEntry.score < beta) beta = ttEntry.score;
      if (alpha >= beta) return ttEntry.score;
    }
    
    // Null move pruning
    if (!isPV && !inCheck && depth >= 3 && Math.abs(beta) < 9000) {
      const nullGameState = this.makeNullMove(gameState);
      const nullScore = -this.alphaBeta(board, nullGameState, depth - NULL_MOVE_REDUCTION - 1, -beta, -beta + 1, ply + 1, false);
      
      if (nullScore >= beta) {
        return beta;
      }
    }
    
    // Generate and order moves
    const moves = this.generateAllMoves(board, gameState);
    const ttMove = ttEntry ? ttEntry.move : null;
    const orderedMoves = this.moveOrdering.orderMoves(moves, board, ttMove, ply);
    
    if (orderedMoves.length === 0) {
      if (inCheck) return -10000 + ply; // Checkmate
      return 0; // Stalemate
    }
    
    let bestMove = null;
    let bestScore = -Infinity;
    let searchedMoves = 0;
    
    for (const move of orderedMoves) {
      const newBoard = this.makeMove(board, move);
      const newGameState = this.updateGameState(gameState, move, newBoard);
      
      let score;
      
      // Principal variation search
      if (searchedMoves === 0) {
        score = -this.alphaBeta(newBoard, newGameState, depth - 1, -beta, -alpha, ply + 1, isPV);
      } else {
        // Late move reduction
        let reduction = 0;
        if (searchedMoves >= LMR_FULL_DEPTH_MOVES && depth >= LMR_REDUCTION_LIMIT && !inCheck && !this.isCapture(board, move)) {
          reduction = Math.floor(Math.sqrt(depth) * Math.sqrt(searchedMoves) / 2);
          reduction = Math.min(reduction, depth - 1);
        }
        
        // Search with reduced depth
        score = -this.alphaBeta(newBoard, newGameState, depth - 1 - reduction, -alpha - 1, -alpha, ply + 1, false);
        
        // Re-search if it improves alpha
        if (score > alpha && reduction > 0) {
          score = -this.alphaBeta(newBoard, newGameState, depth - 1, -beta, -alpha, ply + 1, isPV);
        } else if (score > alpha && score < beta) {
          score = -this.alphaBeta(newBoard, newGameState, depth - 1, -beta, -alpha, ply + 1, isPV);
        }
      }
      
      searchedMoves++;
      
      if (score > bestScore) {
        bestScore = score;
        bestMove = move;
        
        if (score > alpha) {
          alpha = score;
          
          if (score >= beta) {
            // Update killer moves and history
            this.moveOrdering.updateKillers(move, ply);
            if (!this.isCapture(board, move)) {
              this.moveOrdering.updateHistory(move, depth);
            }
            
            // Store in TT
            this.transpositionTable.store(hash, depth, beta, 'lower', move, this.age);
            return beta;
          }
        }
      }
    }
    
    // Store in transposition table
    const flag = bestScore <= alpha ? 'upper' : 'exact';
    this.transpositionTable.store(hash, depth, bestScore, flag, bestMove, this.age);
    
    return bestScore;
  }

  quiescence(board, gameState, alpha, beta, qDepth = 0) {
    this.nodes++;
    
    // Time check in quiescence too
    if (this.nodes % TIME_CHECK_INTERVAL === 0 && Date.now() - this.startTime > this.timeLimit) {
      this.timeUp = true;
      throw new Error('TIME_UP');
    }
    
    // Limit quiescence search depth
    if (qDepth >= QUIESCENCE_DEPTH) {
      return this.evaluator.evaluate(board, gameState, this.bitboard);
    }
    
    const standPat = this.evaluator.evaluate(board, gameState, this.bitboard);
    
    if (standPat >= beta) return beta;
    if (standPat > alpha) alpha = standPat;
    
    // Generate only capture moves
    const moves = this.generateCaptureMoves(board, gameState);
    const orderedMoves = this.moveOrdering.orderMoves(moves, board, null, 0);
    
    for (const move of orderedMoves) {
      // Delta pruning
      const capturedValue = PIECE_VALUES[board[move.to.row][move.to.col].type];
      if (standPat + capturedValue + FUTILITY_MARGIN < alpha) continue;
      
      const newBoard = this.makeMove(board, move);
      const newGameState = this.updateGameState(gameState, move, newBoard);
      
      const score = -this.quiescence(newBoard, newGameState, -beta, -alpha, qDepth + 1);
      
      if (score >= beta) return beta;
      if (score > alpha) alpha = score;
    }
    
    return alpha;
  }

  generateAllMoves(board, gameState) {
    const moves = [];
    const color = gameState.currentTurn;
    
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = board[row][col];
        if (piece && piece.color === color) {
          for (let toRow = 0; toRow < 8; toRow++) {
            for (let toCol = 0; toCol < 8; toCol++) {
              if (isValidMove(board, { row, col }, { row: toRow, col: toCol }, gameState)) {
                moves.push({ from: { row, col }, to: { row: toRow, col: toCol } });
              }
            }
          }
        }
      }
    }
    
    return moves;
  }

  generateCaptureMoves(board, gameState) {
    const moves = [];
    const color = gameState.currentTurn;
    
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = board[row][col];
        if (piece && piece.color === color) {
          for (let toRow = 0; toRow < 8; toRow++) {
            for (let toCol = 0; toCol < 8; toCol++) {
              if (board[toRow][toCol] && board[toRow][toCol].color !== color) {
                if (isValidMove(board, { row, col }, { row: toRow, col: toCol }, gameState)) {
                  moves.push({ from: { row, col }, to: { row: toRow, col: toCol } });
                }
              }
            }
          }
        }
      }
    }
    
    return moves;
  }

  makeMove(board, move) {
    const newBoard = board.map(row => [...row]);
    const piece = newBoard[move.from.row][move.from.col];
    newBoard[move.to.row][move.to.col] = piece;
    newBoard[move.from.row][move.from.col] = null;
    
    // Handle special moves (castling, en passant, promotion)
    // ... (implementation details)
    
    return newBoard;
  }

  makeNullMove(gameState) {
    return {
      ...gameState,
      currentTurn: gameState.currentTurn === 'white' ? 'black' : 'white',
      enPassantTarget: null
    };
  }

  updateGameState(gameState, move, newBoard) {
    const newState = {
      ...gameState,
      board: newBoard,
      currentTurn: gameState.currentTurn === 'white' ? 'black' : 'white',
      moveHistory: [...(gameState.moveHistory || []), move]
    };
    
    // Update castling rights, en passant, etc.
    // ... (implementation details)
    
    return newState;
  }

  isCapture(board, move) {
    return board[move.to.row][move.to.col] !== null;
  }

  getPrincipalVariation(board, gameState, depth) {
    const pv = [];
    const visited = new Set();
    
    for (let i = 0; i < depth; i++) {
      const hash = this.transpositionTable.zobrist.hashPosition(board, gameState);
      
      if (visited.has(hash)) break;
      visited.add(hash);
      
      const ttEntry = this.transpositionTable.probe(hash);
      if (!ttEntry || !ttEntry.move) break;
      
      pv.push(ttEntry.move);
      board = this.makeMove(board, ttEntry.move);
      gameState = this.updateGameState(gameState, ttEntry.move, board);
    }
    
    return pv;
  }
}

// ===== MAIN BOT FUNCTION =====
export function makeMove(gameState, botColor) {
  try {
    // Simple opening moves for the very first move
    if (!gameState.moveHistory || gameState.moveHistory.length === 0) {
      // For white's first move
      if (botColor === 'white') {
        const openingMoves = [
          { from: { row: 1, col: 1 }, to: { row: 2, col: 1 } }, // e2-e3
          { from: { row: 1, col: 1 }, to: { row: 3, col: 1 } }, // e2-e4
          { from: { row: 6, col: 1 }, to: { row: 6, col: 2 } }, // d2-d3
          { from: { row: 6, col: 1 }, to: { row: 6, col: 3 } }, // d2-d4
          { from: { row: 1, col: 0 }, to: { row: 2, col: 2 } }, // Nf3
          { from: { row: 6, col: 0 }, to: { row: 5, col: 2 } }  // Nc3
        ];
        const move = openingMoves[Math.floor(Math.random() * openingMoves.length)];
        if (isValidMove(gameState.board, move.from, move.to, gameState)) {
          return move;
        }
      }
    } else if (gameState.moveHistory && gameState.moveHistory.length === 1) {
      // For black's first move
      if (botColor === 'black') {
        const openingMoves = [
          { from: { row: 1, col: 6 }, to: { row: 1, col: 5 } }, // e7-e6
          { from: { row: 1, col: 6 }, to: { row: 1, col: 4 } }, // e7-e5
          { from: { row: 6, col: 6 }, to: { row: 6, col: 5 } }, // d7-d6
          { from: { row: 6, col: 6 }, to: { row: 6, col: 4 } }, // d7-d5
          { from: { row: 1, col: 7 }, to: { row: 2, col: 5 } }, // Nf6
          { from: { row: 6, col: 7 }, to: { row: 5, col: 5 } }  // Nc6
        ];
        const move = openingMoves[Math.floor(Math.random() * openingMoves.length)];
        if (isValidMove(gameState.board, move.from, move.to, gameState)) {
          return move;
        }
      }
    }
    
    // Use search engine with reduced time for early moves
    const moveCount = gameState.moveHistory ? gameState.moveHistory.length : 0;
    const searchTime = moveCount < 10 ? OPENING_SEARCH_TIME : MAX_SEARCH_TIME; // 3 seconds for opening, 20 seconds max later
    
    const engine = new SearchEngine();
    engine.bitboard.fromBoard(gameState.board);
    
    // Adjust game state for bot perspective
    const adjustedState = botColor === gameState.currentTurn ? gameState : {
      ...gameState,
      currentTurn: botColor
    };
    
    const move = engine.search(gameState.board, adjustedState, searchTime);
    
    return move;
  } catch (error) {
    console.error('Error in ULTRATHINK bot:', error);
    
    // Fallback to random legal move
    const moves = [];
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = gameState.board[row][col];
        if (piece && piece.color === botColor) {
          for (let toRow = 0; toRow < 8; toRow++) {
            for (let toCol = 0; toCol < 8; toCol++) {
              if (isValidMove(gameState.board, { row, col }, { row: toRow, col: toCol }, gameState)) {
                moves.push({ from: { row, col }, to: { row: toRow, col: toCol } });
              }
            }
          }
        }
      }
    }
    
    return moves.length > 0 ? moves[Math.floor(Math.random() * moves.length)] : null;
  }
}

// Helper function to convert board to FEN-like string for opening book
function boardToFEN(board, gameState) {
  // Simplified FEN for opening book lookup
  let fen = '';
  
  for (let row = 7; row >= 0; row--) {
    let empty = 0;
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col];
      if (piece) {
        if (empty > 0) {
          fen += empty;
          empty = 0;
        }
        const letter = piece.type[0].toUpperCase();
        fen += piece.color === 'white' ? letter : letter.toLowerCase();
      } else {
        empty++;
      }
    }
    if (empty > 0) fen += empty;
    if (row > 0) fen += '/';
  }
  
  fen += ' ' + gameState.currentTurn[0];
  
  // Add castling rights
  let castling = '';
  if (gameState.castlingRights) {
    if (gameState.castlingRights.whiteKingside) castling += 'K';
    if (gameState.castlingRights.whiteQueenside) castling += 'Q';
    if (gameState.castlingRights.blackKingside) castling += 'k';
    if (gameState.castlingRights.blackQueenside) castling += 'q';
  }
  fen += ' ' + (castling || '-');
  
  // Add en passant
  if (gameState.enPassantTarget) {
    fen += ' ' + String.fromCharCode(97 + gameState.enPassantTarget.col) + (gameState.enPassantTarget.row + 1);
  } else {
    fen += ' -';
  }
  
  return fen;
}