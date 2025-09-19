"""
NarrativeEngine: Orchestrates the full turn cycle using Actor and Director agents.
This glues the modular agents into a simple workflow: Command -> Actor intent -> Director resolution.
Similar to simple plan's two-node LangGraph, but uses separate agents for better separation (seeding complex plan).
No graph here—linear flow for simplicity; can wrap in LangGraph later for persistence/checkpoints.
Key Concepts:
- Orchestration: Coordinates AI steps, calculates derived values (skill_total), handles errors.
- Input/Output: Takes raw data dicts (from GameManager), returns structured results for logging/updates.
- Modularity: Easy to insert steps (e.g., validation node) or parallel agents in future.
"""

import json
from typing import Dict, Any, TypedDict

from app.engine.actor_agent import get_actor_intent
from app.engine.director_agent import DirectorAgent

class NarrativeState(TypedDict):
    """
    TypedDict for internal state (though not used in graph yet—seeded for LangGraph integration).
    Mirrors simple plan: Passes data between steps.
    """
    character_data: Dict[str, Any]
    zone_data: Dict[str, Any]
    command: str
    actor_result: Dict[str, Any]
    director_result: Dict[str, Any]
    error: str

class NarrativeEngine:
    def __init__(self, prompts_dir: str = "app/prompts"):
        """
        Initialize with DirectorAgent (Actor is functional, no state).
        prompts_dir: Relative path for loading (adjusted from agents).
        """
        self.prompts_dir = prompts_dir
        self.director_agent = DirectorAgent(prompts_dir=prompts_dir)
    
    def process_turn(self, character_data: Dict[str, Any], zone_data: Dict[str, Any], command: str) -> Dict[str, Any]:
        """
        Process a complete turn: Actor decides -> Director resolves/narrates.
        
        Args:
            character_data: Dict from Character.model_dump()
            zone_data: Dict from Zone.model_dump()
            command: Commander's suggestion string
        
        Returns:
            {"actor_result": {...}, "director_result": {...}, "error": str}
            actor_result: From get_actor_intent (thoughts, speech, action, target)
            director_result: From run_director (difficulty, outcome, narration, world_updates)
        
        Workflow:
        1. Actor interprets command via agenda.
        2. Calculate skill_total (wits + comtech) for threshold.
        3. Director resolves action creatively.
        4. If error in either, propagate for handling in GameManager/API.
        
        Seeded for Complex: Add more steps, e.g., pre-validation or post-narration tools.
        """
        # Step 1: Get Actor's intent
        actor_result = get_actor_intent(
            character_data=character_data,
            zone_data=zone_data,
            commander_suggestion=command,
            prompts_dir=self.prompts_dir
        )
        
        if "error" in actor_result:
            return {
                "actor_result": actor_result,
                "director_result": {},
                "error": actor_result["error"]
            }
        
        # Step 2: Calculate skill total for threshold system
        # Simple: wits + relevant skill (comtech here); extend for dynamic skills in complex
        skill_total = character_data["attributes"]["wits"] + character_data["skills"]["comtech"]
        
        # Step 3: Run Director for resolution and narration
        director_response = self.director_agent.run_director(
            action_intent=actor_result,
            character_data=character_data,
            zone_data=zone_data,
            skill_total=skill_total
        )
        
        director_result = director_response["director_result"]
        error = director_response["error"]
        
        if error:
            return {
                "actor_result": actor_result,
                "director_result": {},
                "error": f"Director failed: {error}"
            }
        
        return {
            "actor_result": actor_result,
            "director_result": director_result,
            "error": ""
        }
