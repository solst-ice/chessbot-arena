// Bot Worker - Runs bot calculations in a separate thread
import { makeMove as makeRandomMove } from '../bots/example-random-bot';
import { makeMove as makeSonnetMove } from '../bots/claude-3-5-sonnet-20241022';
import { makeMove as makeOpusMove } from '../bots/claude-opus-4-20250514';
import { makeMove as makeUltrathinkMove } from '../bots/claude-opus-4-20250514-ULTRATHINK';
import { makeMove as makeSonnet4Move } from '../bots/claude-sonnet-4-20250514';
import { makeMove as makeGeminiFlashMove } from '../bots/gemini-2.5-flash-preview-05-20';
import { makeMove as makeGeminiProMove } from '../bots/gemini-2.5-pro-20250626';
import { makeMove as makeGPT4oMove } from '../bots/gpt-4o-20250626';
import { makeMove as makeGrokMove } from '../bots/grok-3-mini';

// Listen for messages from the main thread
self.addEventListener('message', (event) => {
  const { gameState, currentTurn, botType } = event.data;
  
  try {
    let botMove = null;
    
    switch (botType) {
      case 'random':
        botMove = makeRandomMove(gameState, currentTurn);
        break;
      case 'claude-3-5-sonnet-20241022':
        botMove = makeSonnetMove(gameState, currentTurn);
        break;
      case 'claude-opus-4-20250514':
        botMove = makeOpusMove(gameState, currentTurn);
        break;
      case 'claude-opus-4-20250514-ULTRATHINK':
        botMove = makeUltrathinkMove(gameState, currentTurn);
        break;
      case 'claude-sonnet-4-20250514':
        botMove = makeSonnet4Move(gameState, currentTurn);
        break;
      case 'gemini-2.5-flash-preview-05-20':
        botMove = makeGeminiFlashMove(gameState, currentTurn);
        break;
      case 'gemini-2.5-pro-20250626':
        botMove = makeGeminiProMove(gameState, currentTurn);
        break;
      case 'gpt-4o-20250626':
        botMove = makeGPT4oMove(gameState, currentTurn);
        break;
      case 'grok-3-mini':
        botMove = makeGrokMove(gameState, currentTurn);
        break;
      default:
        throw new Error(`Unknown bot type: ${botType}`);
    }
    
    // Send the move back to the main thread
    self.postMessage({ success: true, move: botMove });
  } catch (error) {
    // Send error back to the main thread
    self.postMessage({ success: false, error: error.message });
  }
});