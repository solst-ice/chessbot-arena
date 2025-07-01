import React, { useState, useEffect } from 'react';

const PlayerTimer = ({ isActive, gameStatus, resetTrigger, gameStarted, onTimeUpdate }) => {
  const [totalTime, setTotalTime] = useState(0);

  // Reset timer when resetTrigger changes
  useEffect(() => {
    setTotalTime(0);
  }, [resetTrigger]);

  useEffect(() => {
    let interval = null;
    
    if (isActive && (gameStatus === 'playing' || gameStatus === 'check') && gameStarted) {
      interval = setInterval(() => {
        setTotalTime(time => time + 10);
      }, 10);
    } else {
      clearInterval(interval);
    }

    return () => clearInterval(interval);
  }, [isActive, gameStatus, gameStarted]);

  // Notify parent of time continuously
  useEffect(() => {
    if (onTimeUpdate) {
      onTimeUpdate(totalTime);
    }
  }, [totalTime, onTimeUpdate]);

  const formatTime = (milliseconds) => {
    const totalMs = Math.floor(milliseconds);
    const minutes = Math.floor(totalMs / 60000);
    const seconds = Math.floor((totalMs % 60000) / 1000);
    const ms = Math.floor((totalMs % 1000) / 10);

    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  };

  return (
    <div className="player-timer">
      <div className="timer-display">
        {formatTime(totalTime)}
      </div>
    </div>
  );
};

export default PlayerTimer;