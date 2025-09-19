"""
FastAPI server for the Medbay Escape narrative engine.
Exposes endpoints for game state and turn advancement.
Integrates GameManager for state/log and NarrativeEngine for AI processing.

Key Concepts:
- FastAPI: Async API framework with auto-docs (/docs), Pydantic validation, CORS for frontend.
- Global Instances: GameManager and NarrativeEngine as singletons for simplicity (in-memory state).
  In production, use dependency injection or DB for persistence/multi-user.
- Turn Endpoint: Logs commander input, runs AI (Actor/Director), logs outputs, applies updates, advances turn.
- Log Types: Uses MessageType enum for radio feed (color-coded in frontend).
- Error Handling: HTTPExceptions for API errors, returns structured responses.
- Seeded for Complex: Add auth, WebSockets for real-time, more endpoints (e.g., /save).
Run with: uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
Test with curl or browser at http://127.0.0.1:8000/docs
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from .game_manager import GameManager
from .narrative_engine import NarrativeEngine
from .schemas import MessageType, GameLogState

# Initialize global instances (single game for dev; extend for multi-session)
game_manager = GameManager()
narrative_engine = NarrativeEngine()

app = FastAPI(title="Medbay Escape API", version="1.0.0")

# Enable CORS for frontend (e.g., SvelteKit on different port)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],  # SvelteKit default
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class CommandRequest(BaseModel):
    """Pydantic model for /turn input validation."""
    command: str

@app.get("/api/health")
def health_check():
    """Health check endpoint – confirms server and engine are ready."""
    return {"status": "ok", "message": "Narrative engine running", "turn": game_manager.current_turn}

@app.get("/api/state", response_model=GameLogState)
def get_game_state():
    """Get current game state: log, turn, character, zone for frontend display."""
    try:
        state = game_manager.get_current_state()
        return GameLogState(
            log=state["log"],
            current_turn=state["current_turn"]
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"State load failed: {str(e)}")

@app.post("/api/turn", response_model=GameLogState)
def advance_turn(request: CommandRequest):
    """
    Advance game turn: Process command via AI, log events, update world.
    Returns updated log/state for frontend to render radio feed.
    
    Workflow:
    1. Log commander input.
    2. Run NarrativeEngine: Actor (intent) -> Director (resolve/narrate).
    3. Log AI thoughts/speech (debug) and narration (AI_ACTION).
    4. Apply world updates (e.g., unlock door, increase stress).
    5. Advance turn.
    6. Return full log for append/display.
    
    Concepts:
    - Stateful: Mutates global GameManager (logs, state).
    - Structured Logging: Each event as LogEntry with type/author for UI filtering.
    - Error Propagation: If AI fails, log as SYSTEM error, don't advance.
    """
    try:
        command = request.command.strip()
        if not command:
            raise HTTPException(status_code=400, detail="Command cannot be empty")
        
        # Step 1: Log commander's input
        game_manager.add_log_entry(MessageType.COMMANDER, command, "Commander")
        
        # Step 2: Get current data for AI
        character_data = game_manager.character.model_dump()
        zone_data = game_manager.zone.model_dump()
        
        # Step 3: Process AI turn
        result = narrative_engine.process_turn(character_data, zone_data, command)
        
        if result["error"]:
            # Log AI failure as system error
            game_manager.add_log_entry(MessageType.SYSTEM, f"AI Error: {result['error']}", "System")
            raise HTTPException(status_code=500, detail=result["error"])
        
        actor_result = result["actor_result"]
        director_result = result["director_result"]
        
        # Step 4: Log AI outputs
        # Actor thoughts (debug; hide in prod UI)
        if actor_result.get("thoughts"):
            game_manager.add_log_entry(
                MessageType.AI_THOUGHTS,
                actor_result["thoughts"],
                game_manager.character.name
            )
        
        # Actor speech (dialogue)
        if actor_result.get("speech"):
            game_manager.add_log_entry(
                MessageType.AI_DIALOGUE,
                actor_result["speech"],
                game_manager.character.name
            )
        
        # Director narration (main action feed)
        if director_result.get("narration"):
            game_manager.add_log_entry(
                MessageType.AI_ACTION,
                director_result["narration"],
                "Director"
            )
        
        # Step 5: Apply world updates if any
        if director_result.get("world_updates"):
            game_manager.apply_world_updates(director_result["world_updates"])
        
        # Step 6: Advance turn counter
        game_manager.advance_turn()
        
        # Step 7: Return updated state (full log for frontend append)
        state = game_manager.get_current_state()
        return GameLogState(
            log=state["log"],
            current_turn=state["current_turn"]
        )
        
    except HTTPException:
        raise
    except Exception as e:
        game_manager.add_log_entry(MessageType.SYSTEM, f"Turn failed: {str(e)}", "System")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    # Run server for local testing
    uvicorn.run(app, host="127.0.0.1", port=8000, reload=True)
