export const PIECE_TYPES = {
  KING: 'king',
  QUEEN: 'queen',
  ROOK: 'rook',
  BISHOP: 'bishop',
  KNIGHT: 'knight',
  PAWN: 'pawn'
};

export const COLORS = {
  WHITE: 'white',
  BLACK: 'black'
};

export const PIECE_VALUES = {
  [PIECE_TYPES.PAWN]: 1,
  [PIECE_TYPES.KNIGHT]: 3,
  [PIECE_TYPES.BISHOP]: 3,
  [PIECE_TYPES.ROOK]: 5,
  [PIECE_TYPES.QUEEN]: 9,
  [PIECE_TYPES.KING]: 0
};

export function createInitialBoard() {
  const board = Array(8).fill(null).map(() => Array(8).fill(null));
  
  // Place white pieces (left side)
  board[0][0] = { type: PIECE_TYPES.ROOK, color: COLORS.WHITE };
  board[1][0] = { type: PIECE_TYPES.KNIGHT, color: COLORS.WHITE };
  board[2][0] = { type: PIECE_TYPES.BISHOP, color: COLORS.WHITE };
  board[3][0] = { type: PIECE_TYPES.QUEEN, color: COLORS.WHITE };
  board[4][0] = { type: PIECE_TYPES.KING, color: COLORS.WHITE };
  board[5][0] = { type: PIECE_TYPES.BISHOP, color: COLORS.WHITE };
  board[6][0] = { type: PIECE_TYPES.KNIGHT, color: COLORS.WHITE };
  board[7][0] = { type: PIECE_TYPES.ROOK, color: COLORS.WHITE };
  
  for (let i = 0; i < 8; i++) {
    board[i][1] = { type: PIECE_TYPES.PAWN, color: COLORS.WHITE };
  }
  
  // Place black pieces (right side)
  board[0][7] = { type: PIECE_TYPES.ROOK, color: COLORS.BLACK };
  board[1][7] = { type: PIECE_TYPES.KNIGHT, color: COLORS.BLACK };
  board[2][7] = { type: PIECE_TYPES.BISHOP, color: COLORS.BLACK };
  board[3][7] = { type: PIECE_TYPES.QUEEN, color: COLORS.BLACK };
  board[4][7] = { type: PIECE_TYPES.KING, color: COLORS.BLACK };
  board[5][7] = { type: PIECE_TYPES.BISHOP, color: COLORS.BLACK };
  board[6][7] = { type: PIECE_TYPES.KNIGHT, color: COLORS.BLACK };
  board[7][7] = { type: PIECE_TYPES.ROOK, color: COLORS.BLACK };
  
  for (let i = 0; i < 8; i++) {
    board[i][6] = { type: PIECE_TYPES.PAWN, color: COLORS.BLACK };
  }
  
  return board;
}

// List of available bots (excluding human)
const AVAILABLE_BOTS = [
  'random',
  'claude-3-5-sonnet-20241022',
  'claude-opus-4-20250514',
  'claude-opus-4-20250514-ULTRATHINK',
  'claude-sonnet-4-20250514',
  'gemini-2.5-flash-preview-05-20',
  'gemini-2.5-pro-20250626',
  'gpt-4o-20250626',
  'grok-3-mini'
];

function getRandomBot() {
  return AVAILABLE_BOTS[Math.floor(Math.random() * AVAILABLE_BOTS.length)];
}

export function createGameState() {
  return {
    board: createInitialBoard(),
    currentTurn: COLORS.WHITE,
    capturedPieces: {
      [COLORS.WHITE]: [],
      [COLORS.BLACK]: []
    },
    gameStatus: 'playing',
    whitePlayer: getRandomBot(),
    blackPlayer: getRandomBot(),
    castlingRights: {
      whiteKingSide: true,
      whiteQueenSide: true,
      blackKingSide: true,
      blackQueenSide: true
    },
    enPassantTarget: null,
    moveHistory: [],
    positionHistory: []
  };
}

export function calculateScore(capturedPieces) {
  return capturedPieces.reduce((total, piece) => total + PIECE_VALUES[piece.type], 0);
}