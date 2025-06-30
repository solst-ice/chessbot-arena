import React from 'react';

const PlayerSelection = ({ color, playerType, onPlayerTypeChange, disabled }) => {
  const playerOptions = [
    { value: 'human', label: 'Human' },
    { value: 'random', label: 'Random Moves Bot' },
    { value: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet' },
    { value: 'claude-opus-4-20250514', label: 'Claude Opus 4' },
    { value: 'claude-opus-4-20250514-ULTRATHINK', label: 'Claude Opus 4 ULTRATHINK' },
    { value: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4' },
    { value: 'gemini-2.5-flash-preview-05-20', label: 'Gemini 2.5 Flash' },
    { value: 'gemini-2.5-pro-20250626', label: 'Gemini 2.5 Pro' },
    { value: 'gpt-4o-20250626', label: 'GPT-4o' },
    { value: 'grok-3-mini', label: 'Grok 3 Mini' }
  ];

  return (
    <div className={`player-selection ${disabled ? 'disabled' : ''}`}>
      <h3 style={{ color: color === 'black' ? 'black' : 'inherit' }}>
        {color.charAt(0).toUpperCase() + color.slice(1)} Player
      </h3>
      <div className="player-options">
        <select
          value={playerType}
          onChange={(e) => onPlayerTypeChange(color, e.target.value)}
          disabled={disabled}
          className="custom-dropdown"
          style={{
            width: '100%',
            padding: '8px 12px',
            borderRadius: '6px',
            border: '2px solid #444',
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            color: '#ffffff',
            fontSize: '14px',
            cursor: disabled ? 'not-allowed' : 'pointer',
            appearance: 'none',
            backgroundImage: `url("data:image/svg+xml;utf8,<svg fill='white' height='24' viewBox='0 0 24 24' width='24' xmlns='http://www.w3.org/2000/svg'><path d='M7 10l5 5 5-5z'/></svg>")`,
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'right 8px center',
            backgroundSize: '20px',
            outline: 'none',
            transition: 'all 0.3s ease',
            opacity: disabled ? '0.5' : '1'
          }}
          onMouseEnter={(e) => {
            if (!disabled) {
              e.target.style.borderColor = '#666';
              e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
            }
          }}
          onMouseLeave={(e) => {
            e.target.style.borderColor = '#444';
            e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
          }}
          onFocus={(e) => {
            if (!disabled) {
              e.target.style.borderColor = '#888';
              e.target.style.boxShadow = '0 0 0 2px rgba(255, 255, 255, 0.1)';
            }
          }}
          onBlur={(e) => {
            e.target.style.borderColor = '#444';
            e.target.style.boxShadow = 'none';
          }}
        >
          {playerOptions.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};

export default PlayerSelection;