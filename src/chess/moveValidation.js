import { PIECE_TYPES, COLORS } from './gameState';

export function isValidMove(board, from, to, gameState) {
  const fromPiece = board[from.row][from.col];
  const toPiece = board[to.row][to.col];
  
  if (!fromPiece) return false;
  if (fromPiece.color !== gameState.currentTurn) return false;
  if (toPiece && toPiece.color === fromPiece.color) return false;
  if (to.row < 0 || to.row > 7 || to.col < 0 || to.col > 7) return false;
  
  const rowDiff = to.row - from.row;
  const colDiff = to.col - from.col;
  
  switch (fromPiece.type) {
    case PIECE_TYPES.PAWN:
      return isValidPawnMove(board, from, to, rowDiff, colDiff, fromPiece.color, gameState);
    case PIECE_TYPES.ROOK:
      return isValidRookMove(board, from, to, rowDiff, colDiff);
    case PIECE_TYPES.BISHOP:
      return isValidBishopMove(board, from, to, rowDiff, colDiff);
    case PIECE_TYPES.KNIGHT:
      return isValidKnightMove(rowDiff, colDiff);
    case PIECE_TYPES.QUEEN:
      return isValidQueenMove(board, from, to, rowDiff, colDiff);
    case PIECE_TYPES.KING:
      return isValidKingMove(board, from, to, rowDiff, colDiff, gameState);
    default:
      return false;
  }
}

function isValidPawnMove(board, from, to, rowDiff, colDiff, color, gameState) {
  const direction = color === COLORS.WHITE ? 1 : -1;
  const startCol = color === COLORS.WHITE ? 1 : 6;
  const toPiece = board[to.row][to.col];
  
  if (rowDiff === 0) {
    if (toPiece) return false;
    if (colDiff === direction) return true;
    if (from.col === startCol && colDiff === 2 * direction) {
      // Check if the square in between is clear
      const middleCol = from.col + direction;
      if (board[from.row][middleCol]) return false;
      return true;
    }
    return false;
  }
  
  if (Math.abs(rowDiff) === 1 && colDiff === direction) {
    if (toPiece) return true;
    if (gameState.enPassantTarget && 
        gameState.enPassantTarget.row === to.row && 
        gameState.enPassantTarget.col === to.col) {
      return true;
    }
    return false;
  }
  
  return false;
}

function isValidRookMove(board, from, to, rowDiff, colDiff) {
  if (rowDiff !== 0 && colDiff !== 0) return false;
  return isPathClear(board, from, to);
}

function isValidBishopMove(board, from, to, rowDiff, colDiff) {
  if (Math.abs(rowDiff) !== Math.abs(colDiff)) return false;
  return isPathClear(board, from, to);
}

function isValidKnightMove(rowDiff, colDiff) {
  return (Math.abs(rowDiff) === 2 && Math.abs(colDiff) === 1) ||
         (Math.abs(rowDiff) === 1 && Math.abs(colDiff) === 2);
}

function isValidQueenMove(board, from, to, rowDiff, colDiff) {
  return isValidRookMove(board, from, to, rowDiff, colDiff) ||
         isValidBishopMove(board, from, to, rowDiff, colDiff);
}

function isValidKingMove(board, from, to, rowDiff, colDiff, gameState) {
  if (Math.abs(rowDiff) <= 1 && Math.abs(colDiff) <= 1) {
    // Simulate the move to check if the king would be safe
    const testBoard = board.map(row => [...row]);
    testBoard[to.row][to.col] = testBoard[from.row][from.col];
    testBoard[from.row][from.col] = null;
    
    return !isSquareUnderAttack(testBoard, to, gameState.currentTurn === COLORS.WHITE ? COLORS.BLACK : COLORS.WHITE);
  }
  
  // Check for castling (king moves 2 squares horizontally)
  if (Math.abs(rowDiff) === 2 && colDiff === 0) {
    return isValidCastling(board, from, to, gameState);
  }
  
  return false;
}

function isValidCastling(board, from, to, gameState) {
  const piece = board[from.row][from.col];
  if (piece.type !== PIECE_TYPES.KING) return false;
  
  // King must be in starting position
  const kingStartCol = piece.color === COLORS.WHITE ? 0 : 7;
  const kingStartRow = 4;
  if (from.col !== kingStartCol || from.row !== kingStartRow) return false;
  
  // King must move exactly 2 squares horizontally
  if (Math.abs(to.row - from.row) !== 2 || to.col !== from.col) return false;
  
  const kingSide = to.row > from.row; // Moving toward row 7 (king-side) or row 0 (queen-side)
  const rookRow = kingSide ? 7 : 0;
  const rookPiece = board[rookRow][kingStartCol];
  
  // Check if rook exists and is correct color
  if (!rookPiece || rookPiece.type !== PIECE_TYPES.ROOK || rookPiece.color !== piece.color) return false;
  
  // Check castling rights
  const castlingKey = piece.color === COLORS.WHITE ? 
    (kingSide ? 'whiteKingSide' : 'whiteQueenSide') :
    (kingSide ? 'blackKingSide' : 'blackQueenSide');
  
  if (!gameState.castlingRights[castlingKey]) return false;
  
  // Check if squares between king and rook are empty
  const direction = kingSide ? 1 : -1;
  for (let row = from.row + direction; row !== rookRow; row += direction) {
    if (board[row][kingStartCol]) return false;
  }
  
  // Check if king is currently in check
  const opponentColor = piece.color === COLORS.WHITE ? COLORS.BLACK : COLORS.WHITE;
  if (isSquareUnderAttack(board, from, opponentColor)) return false;
  
  // Check if king passes through or lands on a square under attack
  for (let step = 1; step <= 2; step++) {
    const checkRow = from.row + (direction * step);
    if (isSquareUnderAttack(board, { row: checkRow, col: kingStartCol }, opponentColor)) {
      return false;
    }
  }
  
  return true;
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

function isSquareUnderAttack(board, square, attackingColor) {
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col];
      if (piece && piece.color === attackingColor) {
        if (canPieceAttackSquare(board, { row, col }, square, piece)) {
          return true;
        }
      }
    }
  }
  return false;
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
      return isValidKnightMove(rowDiff, colDiff);
    case PIECE_TYPES.QUEEN:
      return ((rowDiff === 0 || colDiff === 0) || (Math.abs(rowDiff) === Math.abs(colDiff))) && 
             isPathClear(board, from, to);
    case PIECE_TYPES.KING:
      return Math.abs(rowDiff) <= 1 && Math.abs(colDiff) <= 1;
    default:
      return false;
  }
}

export function isInCheck(board, color) {
  const king = findKing(board, color);
  if (!king) return false;
  
  const opponentColor = color === COLORS.WHITE ? COLORS.BLACK : COLORS.WHITE;
  return isSquareUnderAttack(board, king, opponentColor);
}

export function isCheckmate(board, color, gameState) {
  if (!isInCheck(board, color)) return false;
  return !hasAnyLegalMove(board, color, gameState);
}

export function hasAnyLegalMove(board, color, gameState) {
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col];
      if (piece && piece.color === color) {
        for (let toRow = 0; toRow < 8; toRow++) {
          for (let toCol = 0; toCol < 8; toCol++) {
            const from = { row, col };
            const to = { row: toRow, col: toCol };
            
            if (isValidMove(board, from, to, gameState)) {
              const testBoard = makeMove(board, from, to);
              if (!isInCheck(testBoard, color)) {
                return true; // Found at least one legal move
              }
            }
          }
        }
      }
    }
  }
  
  return false; // No legal moves found
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

function makeMove(board, from, to) {
  const newBoard = board.map(row => [...row]);
  newBoard[to.row][to.col] = newBoard[from.row][from.col];
  newBoard[from.row][from.col] = null;
  return newBoard;
}

export function isDrawByRepetition(gameState) {
  const { positionHistory } = gameState;
  if (!positionHistory || positionHistory.length < 3) return false;
  
  // Count occurrences of the current position
  const currentPosition = positionHistory[positionHistory.length - 1];
  let count = 0;
  
  for (const position of positionHistory) {
    if (position === currentPosition) {
      count++;
      if (count >= 3) {
        return true;
      }
    }
  }
  
  return false;
}

export function getBoardPositionString(board, gameState) {
  // Create a unique string representation of the board position
  let positionStr = '';
  
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col];
      if (piece) {
        positionStr += `${piece.type[0]}${piece.color[0]}`;
      } else {
        positionStr += '--';
      }
    }
  }
  
  // Add current turn and castling rights to make position unique
  positionStr += gameState.currentTurn[0];
  positionStr += gameState.castlingRights.whiteKingSide ? 'K' : '-';
  positionStr += gameState.castlingRights.whiteQueenSide ? 'Q' : '-';
  positionStr += gameState.castlingRights.blackKingSide ? 'k' : '-';
  positionStr += gameState.castlingRights.blackQueenSide ? 'q' : '-';
  
  return positionStr;
}