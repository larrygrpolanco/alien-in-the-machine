from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Create FastAPI application
app = FastAPI(
    title="Alien in the Machine - Narrative Engine API",
    description="Backend API for the AI-driven storytelling game",
    version="1.0.0"
)

# Configure CORS for frontend connection
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # SvelteKit default dev port
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    """Welcome endpoint - confirms the API is running"""
    return {"message": "Hello from the Director's Chair"}

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "alien-in-the-machine-api"}

# Placeholder endpoints for future implementation
@app.get("/api/game_state")
async def get_game_state():
    """Get the current game state - to be implemented in Phase 2"""
    return {"message": "Game state endpoint - coming in Phase 2"}

@app.post("/api/game_turn")
async def advance_turn():
    """Advance the game by one turn - to be implemented in Phase 2"""
    return {"message": "Turn advancement endpoint - coming in Phase 2"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
