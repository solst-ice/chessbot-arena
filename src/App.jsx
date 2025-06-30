import React, { useState, useEffect, useCallback, useRef } from 'react';
import ChessBoard from './components/ChessBoard';
import PlayerSelection from './components/PlayerSelection';
import CapturedPieces from './components/CapturedPieces';
import PlayerTimer from './components/PlayerTimer';
import { createGameState, COLORS, PIECE_VALUES, PIECE_TYPES } from './chess/gameState';
import { isValidMove, isInCheck, isCheckmate, isDrawByRepetition, getBoardPositionString, hasAnyLegalMove } from './chess/moveValidation';
import './App.css';

function App() {
  const [gameState, setGameState] = useState(createGameState());
  const [gameResetCounter, setGameResetCounter] = useState(0);
  const [isProcessingBotMove, setIsProcessingBotMove] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const [botDelay, setBotDelay] = useState(0); // Default instant
  const [lastMove, setLastMove] = useState(null);
  const botWorkerRef = useRef(null);

  const handleMove = (from, to) => {
    // Prevent moves if game hasn't started
    if (!gameStarted) {
      return;
    }
    
    // Prevent moves during bot processing
    if (isProcessingBotMove) {
      return;
    }
    
    // Prevent human moves when it's a bot's turn
    const currentPlayer = gameState.currentTurn === COLORS.WHITE ? gameState.whitePlayer : gameState.blackPlayer;
    if (currentPlayer !== 'human') {
      return;
    }
    
    if (!isValidMove(gameState.board, from, to, gameState)) {
      return;
    }

    executeMove(from, to);
    setLastMove({ from, to });
  };

  const handlePlayerTypeChange = (color, playerType) => {
    // Only allow changes before game starts
    if (!gameStarted) {
      setGameState(prev => ({
        ...prev,
        [color + 'Player']: playerType
      }));
    }
  };

  const startGame = () => {
    setGameStarted(true);
    setGameResetCounter(prev => prev + 1);
  };

  const resetGame = () => {
    const currentWhitePlayer = gameState.whitePlayer;
    const currentBlackPlayer = gameState.blackPlayer;
    
    const newGameState = createGameState();
    newGameState.whitePlayer = currentWhitePlayer;
    newGameState.blackPlayer = currentBlackPlayer;
    
    setGameState(newGameState);
    setGameResetCounter(prev => prev + 1);
    setIsProcessingBotMove(false);
    setGameStarted(false);
    setLastMove(null);
    // Terminate any existing worker
    if (botWorkerRef.current) {
      botWorkerRef.current.terminate();
      botWorkerRef.current = null;
    }
  };

  // Execute a move (shared by human and bot)
  const executeMove = (from, to) => {
    setGameState(prevState => {
      const newBoard = prevState.board.map(row => [...row]);
      const capturedPiece = newBoard[to.row][to.col];
      const movingPiece = newBoard[from.row][from.col];

      // Handle en passant capture
      let enPassantCapturedPiece = null;
      if (movingPiece.type === PIECE_TYPES.PAWN && 
          prevState.enPassantTarget &&
          to.row === prevState.enPassantTarget.row &&
          to.col === prevState.enPassantTarget.col &&
          !capturedPiece) {
        // Remove the pawn that was captured via en passant
        const direction = movingPiece.color === COLORS.WHITE ? -1 : 1;
        enPassantCapturedPiece = newBoard[to.row + direction][to.col];
        newBoard[to.row + direction][to.col] = null;
      }

      // Handle castling
      let castlingRookMove = null;
      if (movingPiece.type === PIECE_TYPES.KING && Math.abs(to.row - from.row) === 2) {
        const kingSide = to.row > from.row;
        const rookFromRow = kingSide ? 7 : 0;
        const rookToRow = kingSide ? to.row - 1 : to.row + 1; // Rook lands next to king
        const rookCol = from.col;
        
        castlingRookMove = {
          from: { row: rookFromRow, col: rookCol },
          to: { row: rookToRow, col: rookCol }
        };
        
        // Move the rook
        newBoard[rookToRow][rookCol] = newBoard[rookFromRow][rookCol];
        newBoard[rookFromRow][rookCol] = null;
      }

      newBoard[to.row][to.col] = movingPiece;
      newBoard[from.row][from.col] = null;
      
      // Check for pawn promotion
      let promotion = null;
      if (movingPiece.type === PIECE_TYPES.PAWN) {
        const promotionCol = movingPiece.color === COLORS.WHITE ? 7 : 0;
        if (to.col === promotionCol) {
          // Promote pawn to queen
          newBoard[to.row][to.col] = {
            type: PIECE_TYPES.QUEEN,
            color: movingPiece.color
          };
          promotion = 'queen';
        }
      }

      const newCapturedPieces = { 
        [COLORS.WHITE]: [...prevState.capturedPieces[COLORS.WHITE]],
        [COLORS.BLACK]: [...prevState.capturedPieces[COLORS.BLACK]]
      };
      if (capturedPiece) {
        newCapturedPieces[prevState.currentTurn].push(capturedPiece);
      }
      if (enPassantCapturedPiece) {
        newCapturedPieces[prevState.currentTurn].push(enPassantCapturedPiece);
      }

      // Set en passant target if pawn moved 2 squares
      let newEnPassantTarget = null;
      if (movingPiece.type === PIECE_TYPES.PAWN && Math.abs(to.col - from.col) === 2) {
        const middleCol = (from.col + to.col) / 2;
        newEnPassantTarget = { row: to.row, col: middleCol };
      }

      // Update castling rights
      const newCastlingRights = { ...prevState.castlingRights };
      
      // If king moves, lose all castling rights for that color
      if (movingPiece.type === PIECE_TYPES.KING) {
        if (movingPiece.color === COLORS.WHITE) {
          newCastlingRights.whiteKingSide = false;
          newCastlingRights.whiteQueenSide = false;
        } else {
          newCastlingRights.blackKingSide = false;
          newCastlingRights.blackQueenSide = false;
        }
      }
      
      // If rook moves, lose castling rights for that side
      if (movingPiece.type === PIECE_TYPES.ROOK) {
        if (movingPiece.color === COLORS.WHITE) {
          if (from.row === 0) newCastlingRights.whiteQueenSide = false;
          if (from.row === 7) newCastlingRights.whiteKingSide = false;
        } else {
          if (from.row === 0) newCastlingRights.blackQueenSide = false;
          if (from.row === 7) newCastlingRights.blackKingSide = false;
        }
      }
      
      // If rook is captured, lose castling rights for that side
      if (capturedPiece && capturedPiece.type === PIECE_TYPES.ROOK) {
        if (capturedPiece.color === COLORS.WHITE) {
          if (to.row === 0) newCastlingRights.whiteQueenSide = false;
          if (to.row === 7) newCastlingRights.whiteKingSide = false;
        } else {
          if (to.row === 0) newCastlingRights.blackQueenSide = false;
          if (to.row === 7) newCastlingRights.blackKingSide = false;
        }
      }

      const newGameState = {
        ...prevState,
        board: newBoard,
        currentTurn: prevState.currentTurn === COLORS.WHITE ? COLORS.BLACK : COLORS.WHITE,
        capturedPieces: newCapturedPieces,
        enPassantTarget: newEnPassantTarget,
        castlingRights: newCastlingRights,
        moveHistory: [...prevState.moveHistory, { from, to, piece: movingPiece, captured: capturedPiece, enPassantCaptured: enPassantCapturedPiece, castlingRookMove, promotion }],
        positionHistory: prevState.positionHistory
      };

      // Add current position to history
      const positionString = getBoardPositionString(newBoard, newGameState);
      newGameState.positionHistory = [...(prevState.positionHistory || []), positionString];

      // Check game status
      const inCheck = isInCheck(newBoard, newGameState.currentTurn);
      const hasLegalMoves = hasAnyLegalMove(newBoard, newGameState.currentTurn, newGameState);
      
      if (inCheck && !hasLegalMoves) {
        newGameState.gameStatus = 'checkmate';
      } else if (!inCheck && !hasLegalMoves) {
        newGameState.gameStatus = 'stalemate';
      } else if (isDrawByRepetition(newGameState)) {
        newGameState.gameStatus = 'draw';
      } else if (inCheck) {
        newGameState.gameStatus = 'check';
      } else {
        newGameState.gameStatus = 'playing';
      }

      return newGameState;
    });
  };

  // Handle bot moves with Web Worker
  useEffect(() => {
    if (!gameStarted) return;
    
    const currentPlayer = gameState.currentTurn === COLORS.WHITE ? gameState.whitePlayer : gameState.blackPlayer;
    
    // Check if it's a bot's turn and game is not over
    if (currentPlayer !== 'human' && (gameState.gameStatus === 'playing' || gameState.gameStatus === 'check')) {
      // Delay bot move based on configuration
      const timer = setTimeout(() => {
        try {
          console.log('Making bot move for:', currentPlayer, 'playing as', gameState.currentTurn);
          
          // Create a new worker for this bot move
          const worker = new Worker(
            new URL('./workers/botWorkerWrapper.js', import.meta.url),
            { type: 'module' }
          );
          botWorkerRef.current = worker;
          
          // Handle worker messages
          worker.onmessage = (event) => {
            const { success, move, error } = event.data;
            
            if (success) {
              if (move && isValidMove(gameState.board, move.from, move.to, gameState)) {
                console.log('Executing bot move');
                executeMove(move.from, move.to);
                setLastMove({ from: move.from, to: move.to });
              } else {
                console.error('Bot made an invalid move:', move);
              }
            } else {
              console.error('Error in bot worker:', error);
            }
            
            // Clean up worker
            worker.terminate();
            if (botWorkerRef.current === worker) {
              botWorkerRef.current = null;
            }
          };
          
          // Handle worker errors
          worker.onerror = (error) => {
            console.error('Worker error:', error);
            worker.terminate();
            if (botWorkerRef.current === worker) {
              botWorkerRef.current = null;
            }
          };
          
          // Send game state to worker
          worker.postMessage({
            gameState,
            currentTurn: gameState.currentTurn,
            botType: currentPlayer
          });
          
        } catch (error) {
          console.error('Error creating bot worker:', error);
        }
      }, botDelay);
      
      return () => {
        clearTimeout(timer);
        // Clean up any existing worker
        if (botWorkerRef.current) {
          botWorkerRef.current.terminate();
          botWorkerRef.current = null;
        }
      };
    }
  }, [gameState.currentTurn, gameState.whitePlayer, gameState.blackPlayer, gameState.gameStatus, gameStarted, botDelay]);

  // Clean up worker on unmount
  useEffect(() => {
    return () => {
      if (botWorkerRef.current) {
        botWorkerRef.current.terminate();
        botWorkerRef.current = null;
      }
    };
  }, []);

  const getGameStatusMessage = () => {
    if (!gameStarted) {
      return 'Select players and click Start Game';
    }
    if (gameState.gameStatus === 'checkmate') {
      const winner = gameState.currentTurn === COLORS.WHITE ? COLORS.BLACK : COLORS.WHITE;
      return `Checkmate! ${winner.charAt(0).toUpperCase() + winner.slice(1)} wins!`;
    } else if (gameState.gameStatus === 'stalemate') {
      return 'Stalemate - Draw!';
    } else if (gameState.gameStatus === 'draw') {
      return 'Draw by threefold repetition!';
    } else if (gameState.gameStatus === 'check') {
      return `${gameState.currentTurn.charAt(0).toUpperCase() + gameState.currentTurn.slice(1)} is in check!`;
    } else {
      return `${gameState.currentTurn.charAt(0).toUpperCase() + gameState.currentTurn.slice(1)}'s turn`;
    }
  };

  return (
    <div className="app">
      <div className="game-header">
        <h1>Chess BvB Arena</h1>
        <div className={`game-status ${gameState.gameStatus === 'checkmate' || gameState.gameStatus === 'stalemate' ? 'game-over' : 
                                       gameState.gameStatus === 'check' ? 'check-warning' : 'current-turn'}`}>
          {getGameStatusMessage()}
        </div>
        {!gameStarted && (
          <div style={{ margin: '10px 0' }}>
            <label style={{ marginRight: '10px', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              Bot Move Delay:
              <select 
                value={botDelay} 
                onChange={(e) => setBotDelay(Number(e.target.value))}
                className="custom-dropdown"
                style={{
                  marginLeft: '10px',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '2px solid #444',
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  color: '#ffffff',
                  fontSize: '14px',
                  cursor: 'pointer',
                  appearance: 'none',
                  backgroundImage: `url("data:image/svg+xml;utf8,<svg fill='white' height='24' viewBox='0 0 24 24' width='24' xmlns='http://www.w3.org/2000/svg'><path d='M7 10l5 5 5-5z'/></svg>")`,
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 8px center',
                  backgroundSize: '20px',
                  outline: 'none',
                  transition: 'all 0.3s ease',
                  minWidth: '120px'
                }}
                onMouseEnter={(e) => {
                  e.target.style.borderColor = '#666';
                  e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.borderColor = '#444';
                  e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#888';
                  e.target.style.boxShadow = '0 0 0 2px rgba(255, 255, 255, 0.1)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#444';
                  e.target.style.boxShadow = 'none';
                }}
              >
                <option value={0}>Instant</option>
                <option value={200}>200ms</option>
                <option value={500}>500ms</option>
                <option value={1000}>1000ms</option>
              </select>
            </label>
          </div>
        )}
        {!gameStarted ? (
          <button onClick={startGame} style={{ 
            backgroundColor: '#4CAF50', 
            color: 'white', 
            border: 'none', 
            padding: '10px 20px', 
            borderRadius: '5px',
            cursor: 'pointer',
            fontSize: '16px',
            margin: '10px'
          }}>
            Start Game
          </button>
        ) : (
          <button onClick={resetGame} style={{ 
            backgroundColor: '#f44336', 
            color: 'white', 
            border: 'none', 
            padding: '10px 20px', 
            borderRadius: '5px',
            cursor: 'pointer',
            fontSize: '16px',
            margin: '10px'
          }}>
            New Game
          </button>
        )}
      </div>
      
      <div className="game-container">
        <div className={`left-panel ${
          gameState.gameStatus === 'checkmate' && gameState.currentTurn === COLORS.WHITE ? 'loser-panel' :
          gameState.currentTurn === COLORS.WHITE && gameState.gameStatus !== 'checkmate' ? 'current-turn-highlight' : 
          ''
        }`}>
          <PlayerSelection
            color="white"
            playerType={gameState.whitePlayer}
            onPlayerTypeChange={handlePlayerTypeChange}
            disabled={gameStarted}
          />
          <CapturedPieces
            capturedPieces={gameState.capturedPieces[COLORS.WHITE]}
            playerColor={COLORS.WHITE}
            opponentCapturedPieces={gameState.capturedPieces[COLORS.BLACK]}
          />
          <PlayerTimer 
            isActive={gameState.currentTurn === COLORS.WHITE}
            gameStatus={gameState.gameStatus}
            resetTrigger={gameResetCounter}
            gameStarted={gameStarted}
          />
        </div>

        <ChessBoard
          gameState={gameState}
          onMove={handleMove}
          onGameStateChange={setGameState}
          lastMove={lastMove}
        />

        <div className={`right-panel ${
          gameState.gameStatus === 'checkmate' && gameState.currentTurn === COLORS.BLACK ? 'loser-panel' :
          gameState.currentTurn === COLORS.BLACK && gameState.gameStatus !== 'checkmate' ? 'current-turn-highlight' : 
          ''
        }`}>
          <PlayerSelection
            color="black"
            playerType={gameState.blackPlayer}
            onPlayerTypeChange={handlePlayerTypeChange}
            disabled={gameStarted}
          />
          <CapturedPieces
            capturedPieces={gameState.capturedPieces[COLORS.BLACK]}
            playerColor={COLORS.BLACK}
            opponentCapturedPieces={gameState.capturedPieces[COLORS.WHITE]}
          />
          <PlayerTimer 
            isActive={gameState.currentTurn === COLORS.BLACK}
            gameStatus={gameState.gameStatus}
            resetTrigger={gameResetCounter}
            gameStarted={gameStarted}
          />
        </div>
      </div>
      
      <div style={{
        marginTop: '20px',
        paddingTop: '10px',
        borderTop: '1px solid rgba(255, 255, 255, 0.2)',
        textAlign: 'center',
        fontSize: '14px',
        color: 'rgba(255, 255, 255, 0.8)'
      }}>
        <p style={{ margin: '5px 0' }}>
          An experiment by solst/ICE {' '}
          <span style={{ color: 'rgba(255, 255, 255, 0.6)' }}>{'{'}</span>{' '}
          <a href="https://x.com/IceSolst/" target="_blank" rel="noopener noreferrer" style={{ color: '#FFB6C1', textDecoration: 'none' }}>
            twitter
          </a>
          {' / '}
          <a href="https://github.com/solst-ice/chessbot-arena" target="_blank" rel="noopener noreferrer" style={{ color: '#FFB6C1', textDecoration: 'none' }}>
            github
          </a>
          {' '}
          <span style={{ color: 'rgba(255, 255, 255, 0.6)' }}>{'}'}</span>
        </p>
      </div>
    </div>
  );
}

export default App;