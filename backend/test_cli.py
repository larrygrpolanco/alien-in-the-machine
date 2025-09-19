#!/usr/bin/env python3
"""
Simple CLI testing script for the narrative engine.
Run from backend/ to test prompts and AI behavior iteratively.
Edit the scenarios list to try different commands.
This tests the full flow: Load state -> Process turn (Actor + Director) -> Print results -> Apply updates.

Key Concepts:
- Standalone script: Uses sys.path to import from app/ (no package install needed).
- Rapid Iteration: Run `python test_cli.py`, edit prompts/*.txt, rerun. See AI responses immediately.
- Validation: Checks for errors from LLM (e.g., bad JSON), prints state changes.
- No server needed: Pure Python for core engine testing before API/frontend.
- After run, check app/data/*.json for updates (e.g., door status, stress).
"""

import sys
import json
from pathlib import Path

# Add app/ to Python path for imports (since running from backend/)
sys.path.insert(0, str(Path(__file__).parent / "app"))

from game_manager import GameManager
from narrative_engine import NarrativeEngine

def test_scenario(command: str, engine: NarrativeEngine, game_manager: GameManager):
    """Test a single scenario: Process command, print AI results."""
    print(f"\n{'='*60}")
    print(f"TESTING: '{command}'")
    print(f"{'='*60}")
    
    try:
        # Get current game state (dumps to dict for engine)
        character_data = game_manager.character.model_dump()
        zone_data = game_manager.zone.model_dump()
        
        # Print context for debugging
        print(f"\nLocation: {zone_data['name']} - {zone_data['description'][:50]}...")
        print(f"Character: {character_data['name']} (Wits: {character_data['attributes']['wits']}, Comtech: {character_data['skills']['comtech']})")
        print(f"Status: Health={character_data['status']['health']}, Stress={character_data['status']['stress']}")
        print(f"Inventory: {', '.join(character_data['inventory'])}")
        
        # Process through narrative engine
        result = engine.process_turn(character_data, zone_data, command)
        
        if result["error"]:
            print(f"\n❌ ERROR: {result['error']}")
            return
        
        actor_result = result["actor_result"]
        director_result = result["director_result"]
        
        # Display Actor (character's response)
        print(f"\n🤖 ACTOR ({game_manager.character.name}):")
        print(f"  Thoughts: {actor_result.get('thoughts', 'N/A')}")
        if actor_result.get('speech'):
            print(f"  Speech: \"{actor_result['speech']}\"")
        print(f"  Action: {actor_result.get('action', 'N/A')}")
        if actor_result.get('target'):
            print(f"  Target: {actor_result['target']}")
        
        # Display Director (resolution and narration)
        print(f"\n🎬 DIRECTOR (Storyteller):")
        print(f"  Difficulty: {director_result.get('difficulty', 'N/A')} (0=trivial, 4=extreme)")
        print(f"  Outcome: {director_result.get('outcome', 'N/A').upper()}")
        print(f"  Narration: {director_result.get('narration', 'N/A')}")
        
        if director_result.get('world_updates'):
            print(f"  World Updates Applied: {json.dumps(director_result['world_updates'], indent=2)}")
            # Apply updates to state (for next test)
            game_manager.apply_world_updates(director_result['world_updates'])
        
        # Log entries would be added in API, but for CLI, we just print
        # In full game, these would be AI_THOUGHTS, AI_DIALOGUE, AI_ACTION
        
    except Exception as e:
        print(f"❌ TEST ERROR: {e}")
        import traceback
        traceback.print_exc()

def main():
    """Main testing function: Run multiple scenarios."""
    print("🚀 NARRATIVE ENGINE CLI TESTER")
    print("=" * 60)
    
    try:
        # Initialize components
        game_manager = GameManager()
        narrative_engine = NarrativeEngine()
        
        # Test scenarios - EDIT THESE TO TEST DIFFERENT COMMANDS
        # These cover various mechanics: repair, force, explore, etc.
        scenarios = [
            "Fix the door panel",
            "Kick down the door",
            "Look for another way out",
            "Check my equipment",
            "Examine the room carefully",
            "Try to hack the door panel",
            "Search for medical supplies"
        ]
        
        print(f"Starting {len(scenarios)} tests. Skill Total: {game_manager.character.attributes.wits + game_manager.character.skills.comtech}")
        print("Note: Check app/data/ files after each test for state changes.\n")
        
        for i, scenario in enumerate(scenarios, 1):
            test_scenario(scenario, narrative_engine, game_manager)
            
            if i < len(scenarios):
                input(f"\n⏸️  Test {i}/{len(scenarios)} complete. Press Enter to continue to next...")
        
        print(f"\n✅ All tests completed!")
        print("\nFinal State:")
        print(json.dumps(game_manager.get_current_state(), indent=2))
        
    except Exception as e:
        print(f"💥 Fatal error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()
