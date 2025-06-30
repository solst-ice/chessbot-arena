import React from 'react';
import { calculateScore } from '../chess/gameState';
import ChessPiece from './ChessPiece';

const CapturedPieces = ({ capturedPieces, playerColor, opponentCapturedPieces }) => {
  const myScore = calculateScore(capturedPieces);
  const opponentScore = calculateScore(opponentCapturedPieces);
  const scoreDifference = myScore - opponentScore;

  return (
    <div className="captured-pieces-simple">
      {capturedPieces.map((piece, index) => (
        <span key={index} className="captured-piece-simple">
          <ChessPiece piece={piece} position={{ row: -1, col: -1 }} />
        </span>
      ))}
      {scoreDifference > 0 && (
        <span className="score-advantage-simple">
          +{scoreDifference}
        </span>
      )}
    </div>
  );
};

export default CapturedPieces;