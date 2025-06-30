# Chessbot BvB Arena

This is a fully javascript app where I asked multiple coding LLMs to implement their own javascript chess bots to play against each other. The results are a pile of hot garbage. This is the worst chess I've ever seen in my life.

<img width="987" alt="Screenshot 2025-06-29 at 7 38 39 PM" src="https://github.com/user-attachments/assets/2f31ac60-677e-4252-a4f6-60ea70a588fb" />

### The chess board

was implemented in Claude Code and initially allowed all sorts of illegal moves. Pawns could capture backwards, rooks could teleport through multiple pieces and snipe the back rank. I'm still not sure if I fixed all the bugs. Castling took a few prompts to get right, but AIs seem well versed in En Passant as I only had to ask once for it (suspicious).

### The bots

- At first, most bots would cheat by copying other existing bots, only changing the name. 
- Some bots would implement a brute-force search that took forever, even for their first move, so thinking time had to be capped. 
- They are all absolute trash. Almost every bot usually gets beat by the bot that MOVES AT RANDOM. 
- They love advancing their unprotected king early on, basically reinventing the Bong Cloud opening. 

### The prompt

This was the prompt I gave most LLMs so they write their own bots:

```
We are developing chessbots for a bot vs bot chess game. 

You will develop the chess logic for grok-3-mini.js without touching any of the other files. 

Some requirements:
- Develop the strategy independently, do not copy what the other bots are doing, as their strategies may be bad.  You may look at bot-template.js and example-random-bot.js to see how they read the board and make moves, to avoid javascript errors.
- Remember the board orientation is horizontal, so white is on the left, and black is on the right (rather than top and bottom). 
- Try to avoid threefold repetition unless you are in a losing position
- In the first 10 moves, you can only think for up to 0.5 seconds, prioritizing moving the kingside or queenside pawns (by one or two squares) or the knights. In the next 10 moves, you can think for up to 1 second. After that, you can think for up to 2 seconds.
- Try to vary which pieces you are evaluating so you don’t always make the same move. 
- Try to cache previous analysis so you can reduce thinking time per move. Vary the order of the pieces considered so it is not repeating the same analysis every turn or game. 
- Here are the rules you can follow, as a suggestion, but feel free to come up with your own strategies.

# Chess Bot Development Prompt

## Objective
Create a chess-playing algorithm that makes decisions based on a prioritized evaluation system. Your code should implement a bot capable of analyzing positions, calculating variations, and selecting moves according to strategic and tactical principles.

## Priority Framework
Implement the following priority hierarchy in your evaluation function, with higher priorities taking precedence when making decisions:

1. **Checkmate Detection (Critical)**: Identify immediate checkmate opportunities for your side and execute them. Similarly, detect and avoid positions where you would be checkmated.

2. **Material Evaluation**: Calculate the material balance using standard piece values (Queen=9, Rook=5, Bishop=3, Knight=3, Pawn=1). Prioritize capturing undefended pieces and avoid losing material without compensation.

3. **King Safety**: Evaluate the security of both kings. Consider factors such as pawn shield integrity, exposed files near the king, and proximity of enemy pieces to your king.

4. **Center Control**: Assign positive value to pieces controlling the central squares (e4, e5, d4, d5), with higher value for occupying these squares.

5. **Piece Activity**: Calculate mobility scores for each piece based on the number of legal moves it can make. Reward developed pieces and penalize undeveloped ones.

6. **Pawn Structure**: Evaluate pawn formations, identifying and penalizing weaknesses such as isolated, doubled, or backward pawns. Reward passed pawns based on their advancement.

7. **Tactical Opportunities**: Implement pattern recognition for common tactical motifs like forks, pins, skewers, and discovered attacks.

8. **Strategic Planning**: Assess long-term positional factors like open files for rooks, outposts for knights, and bishop pair advantage.

## Technical Specifications

Your chess bot should:

1. **Search Algorithm**: Implement minimax with alpha-beta pruning to explore possible move sequences.
   - Include iterative deepening to manage time constraints effectively
   - Implement a quiescence search to resolve tactical sequences

2. **Evaluation Function**: Create a weighted scoring system that incorporates all priority elements
   - Weight factors according to the priority list, with higher weights for more important considerations
   - Include position-specific pattern recognition

3. **Move Ordering**: Optimize your search by examining the most promising moves first
   - Prioritize captures, particularly favorable ones
   - Consider killer moves and history heuristics

4. **Opening Book**: Implement a simple opening book with established strong first moves

5. **Endgame Knowledge**: Include specialized evaluation for common endgames
   - King and pawn vs. king
   - Piece advantage endgames
   - Draw recognition (insufficient material, stalemate, repetition)

## Code Structure
Organize your code with these components:

1. **Board Representation**: Efficient data structure for the chess position
2. **Move Generation**: Function to calculate all legal moves
3. **Evaluation**: Position scoring system based on the priority hierarchy
4. **Search**: Minimax with alpha-beta pruning and time management
5. **Move Selection**: Final decision mechanism that chooses the best move

## Test Cases
Include logic to handle these specific scenarios:

1. Detecting a mate in 1, 2, and 3 moves
2. Avoiding mate threats
3. Capturing undefended pieces
4. Trading when ahead in material
5. Avoiding trades when behind in material
6. Developing pieces efficiently in the opening

Your solution will be evaluated on its playing strength, priority implementation, code efficiency, and extensibility.
```
