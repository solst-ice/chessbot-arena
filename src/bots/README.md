# Chessbot BvB Arena


This directory will contain chess bot implementations for the Chess Bot Arena.

## Bot Interface

Each bot should be a single JavaScript file that exports a function with the following signature:

```javascript
export function makeMove(gameState, color) {
  // gameState: Current game state object
  // color: 'white' or 'black' - the color this bot is playing
  // Returns: { from: { row, col }, to: { row, col } }
}
```

## Available Data

The `gameState` object contains:
- `board`: 8x8 array representing the current board state
- `currentTurn`: Current player's turn ('white' or 'black')
- `capturedPieces`: Object with arrays of captured pieces for each color
- `gameStatus`: Current game status ('playing', 'check', 'checkmate')
- `castlingRights`: Object with castling availability
- `enPassantTarget`: Current en passant target square
- `moveHistory`: Array of previous moves

Each piece on the board has:
- `type`: Piece type ('king', 'queen', 'rook', 'bishop', 'knight', 'pawn')
- `color`: Piece color ('white', 'black')
- `botId`: ID of the bot/player controlling this piece

## Example Bot Structure

```javascript
import { isValidMove } from '../chess/moveValidation';

export function makeMove(gameState, color) {
  // Find all valid moves for the current color
  const validMoves = getAllValidMoves(gameState, color);
  
  // Select a move (random, evaluation-based, etc.)
  const selectedMove = validMoves[Math.floor(Math.random() * validMoves.length)];
  
  return selectedMove;
}

function getAllValidMoves(gameState, color) {
  const moves = [];
  // Implementation to find all valid moves
  return moves;
}
```