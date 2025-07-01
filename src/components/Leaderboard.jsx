import React from 'react';

const Leaderboard = ({ playerScores, playerTimes }) => {
  // Get player names for human-readable display
  const playerDisplayNames = {
    'random': 'Random Moves Bot',
    'claude-3-5-sonnet-20241022': 'Claude 3.5 Sonnet',
    'claude-opus-4-20250514': 'Claude Opus 4',
    'claude-opus-4-20250514-ULTRATHINK': 'Claude Opus 4 ULTRATHINK',
    'claude-sonnet-4-20250514': 'Claude Sonnet 4',
    'gemini-2.5-flash-preview-05-20': 'Gemini 2.5 Flash',
    'gemini-2.5-pro-20250626': 'Gemini 2.5 Pro',
    'gpt-4o-20250626': 'GPT-4o',
    'grok-3-mini': 'Grok 3 Mini'
  };

  // Combine scores and times data
  const players = Object.keys({ ...playerScores, ...playerTimes });
  const leaderboardData = players.map(player => ({
    player,
    displayName: playerDisplayNames[player] || player,
    score: playerScores[player] || 0,
    totalTime: playerTimes[player] || 0
  }));

  // Sort by score (descending)
  leaderboardData.sort((a, b) => b.score - a.score);

  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  if (leaderboardData.length === 0) {
    return null;
  }

  return (
    <div style={{
      marginTop: '30px',
      padding: '20px',
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
      borderRadius: '10px',
      width: '100%',
      maxWidth: '600px',
      margin: '30px auto'
    }}>
      <h2 style={{ 
        textAlign: 'center', 
        color: 'white',
        marginBottom: '20px',
        fontSize: '24px'
      }}>
        Endless Mode Leaderboard
      </h2>
      <table style={{
        width: '100%',
        borderCollapse: 'collapse',
        color: 'white'
      }}>
        <thead>
          <tr>
            <th style={{
              textAlign: 'left',
              padding: '10px',
              borderBottom: '2px solid rgba(255, 255, 255, 0.3)',
              fontSize: '14px',
              fontWeight: 'bold'
            }}>
              Player
            </th>
            <th style={{
              textAlign: 'center',
              padding: '10px',
              borderBottom: '2px solid rgba(255, 255, 255, 0.3)',
              fontSize: '14px',
              fontWeight: 'bold'
            }}>
              Score
            </th>
            <th style={{
              textAlign: 'right',
              padding: '10px',
              borderBottom: '2px solid rgba(255, 255, 255, 0.3)',
              fontSize: '14px',
              fontWeight: 'bold'
            }}>
              Total Time
            </th>
          </tr>
        </thead>
        <tbody>
          {leaderboardData.map((entry, index) => (
            <tr key={entry.player} style={{
              backgroundColor: index === 0 ? 'rgba(255, 215, 0, 0.1)' : 'transparent'
            }}>
              <td style={{
                padding: '10px',
                borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                fontSize: '14px'
              }}>
                {index === 0 && '👑 '}
                {entry.displayName}
              </td>
              <td style={{
                padding: '10px',
                borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                textAlign: 'center',
                fontSize: '16px',
                fontWeight: 'bold'
              }}>
                {entry.score}
              </td>
              <td style={{
                padding: '10px',
                borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                textAlign: 'right',
                fontSize: '14px',
                fontFamily: 'monospace'
              }}>
                {formatTime(entry.totalTime)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default Leaderboard;