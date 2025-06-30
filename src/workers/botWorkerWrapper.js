// Wrapper for bot worker to handle dynamic imports
// This allows us to use ES modules in the worker

self.addEventListener('message', async (event) => {
  const { gameState, currentTurn, botType } = event.data;
  
  try {
    // Dynamic imports for the bot modules
    const [
      { makeMove: makeRandomMove },
      { makeMove: makeSonnetMove },
      { makeMove: makeOpusMove },
      { makeMove: makeUltrathinkMove },
      { makeMove: makeSonnet4Move },
      { makeMove: makeGeminiFlashMove },
      { makeMove: makeGeminiProMove },
      { makeMove: makeGpt4oMove },
      { makeMove: makeGrokMove }
    ] = await Promise.all([
      import('../bots/example-random-bot.js'),
      import('../bots/claude-3-5-sonnet-20241022.js'),
      import('../bots/claude-opus-4-20250514.js'),
      import('../bots/claude-opus-4-20250514-ULTRATHINK.js'),
      import('../bots/claude-sonnet-4-20250514.js'),
      import('../bots/gemini-2.5-flash-preview-05-20.js'),
      import('../bots/gemini-2.5-pro-20250626.js'),
      import('../bots/gpt-4o-20250626.js'),
      import('../bots/grok-3-mini.js')
    ]);
    
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
        botMove = makeGpt4oMove(gameState, currentTurn);
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