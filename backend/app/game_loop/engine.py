"""
LangGraph-based narrative engine for Alien in the Machine
This module implements the core game loop as a state graph with AI agents
"""

import os
from typing import Dict, Any, List
from langgraph.graph import StateGraph, END
from langgraph.graph.message import add_messages
from langchain_core.messages import BaseMessage, HumanMessage, AIMessage
from langchain_openai import ChatOpenAI
from pydantic import BaseModel
import json
import random

from ..state.schemas import (
    GameState, Character, Zone, ActionIntent, ActorResponse, 
    DirectorResult, TurnResult, CommanderCommand
)
from ..state.initial_state import GAME_STATE

class AgentState(BaseModel):
    """State passed between graph nodes"""
    game_state: GameState
    current_character: Character
    current_zone: Zone
    commander_command: str = ""
    actor_response: ActorResponse = None
    director_result: DirectorResult = None
    turn_result: TurnResult = None
    messages: List[BaseMessage] = []

# Initialize LLM (will use environment variable for API key)
def get_llm():
    """Get configured LLM instance"""
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise ValueError("OPENAI_API_KEY environment variable not set")
    return ChatOpenAI(model="gpt-4", api_key=api_key, temperature=0.7)

def run_ai_actor(state: AgentState) -> Dict[str, Any]:
    """
    Node 1: AI Actor generates thoughts, speech, and action intent
    
    This node takes the current game state and has the AI character
    decide what they want to do this turn.
    """
    print(f"🎭 AI Actor: {state.current_character.name} is thinking...")
    
    # Build context for the AI Actor
    character = state.current_character
    zone = state.current_zone
    commander_cmd = state.commander_command
    
    # Create AI Actor prompt
    prompt = f"""You are {character.name}, a character in a sci-fi survival scenario.

CURRENT SITUATION:
- Location: {zone.name} - {zone.description}
- Your attributes: {character.attributes.model_dump()}
- Your skills: {character.skills.model_dump()}
- Your inventory: {', '.join(character.inventory)}
- Your agenda: {character.agenda}
- Your current condition: {character.status.health}, stress level {character.status.stress}

ZONE DETAILS:
- Atmosphere: {zone.atmosphere}
- Available exits: {list(zone.exits.keys())}
- Objects you can interact with: {list(zone.objects.keys())}

COMMANDER'S ORDERS: {commander_cmd if commander_cmd else "No specific orders"}

You need to decide what to do this turn. Respond with JSON in exactly this format:
{{
    "thoughts": "Your internal thoughts about the situation (what the Commander sees via helmet cam)",
    "speech": "What you say aloud (what appears in comms)",
    "action_intent": {{
        "verb": "REPAIR|MOVE|USE|EXAMINE|ATTACK|etc",
        "target": "specific object or exit name",
        "using": "tool from inventory if needed",
        "speed": "slow|fast",
        "rationale": "why you chose this action"
    }}
}}

Focus on your agenda but consider the Commander's orders. Be decisive and specific.
"""

    try:
        llm = get_llm()
        response = llm.invoke([HumanMessage(content=prompt)])
        
        # Parse the JSON response
        response_text = response.content.strip()
        if response_text.startswith('```json'):
            response_text = response_text[7:-3]
        elif response_text.startswith('```'):
            response_text = response_text[3:-3]
            
        response_data = json.loads(response_text)
        
        # Create ActorResponse object
        action_intent = ActionIntent(
            verb=response_data["action_intent"]["verb"],
            target=response_data["action_intent"]["target"],
            using=response_data["action_intent"].get("using"),
            speed=response_data["action_intent"]["speed"],
            rationale=response_data["action_intent"]["rationale"]
        )
        
        actor_response = ActorResponse(
            thoughts=response_data["thoughts"],
            speech=response_data["speech"],
            action_intent=action_intent
        )
        
        print(f"💭 {character.name} thinks: {actor_response.thoughts}")
        print(f"🗣️  {character.name} says: '{actor_response.speech}'")
        print(f"🎯 {character.name} wants to: {action_intent.verb} {action_intent.target}")
        
        return {"actor_response": actor_response}
        
    except Exception as e:
        print(f"❌ Error in AI Actor: {e}")
        # Fallback response
        fallback_intent = ActionIntent(
            verb="EXAMINE",
            target="door_control_panel_north",
            speed="slow",
            rationale="Assess the situation before acting"
        )
        fallback_response = ActorResponse(
            thoughts="Something's not right with my neural link. Better take this slow.",
            speech="Commander, I'm experiencing some... interference. Give me a moment.",
            action_intent=fallback_intent
        )
        return {"actor_response": fallback_response}

def run_director_interpreter(state: AgentState) -> Dict[str, Any]:
    """
    Node 2: Director interprets the actor's intent and determines what kind of action it is
    """
    print("🎬 Director: Interpreting action intent...")
    
    action_intent = state.actor_response.action_intent
    character = state.current_character
    zone = state.current_zone
    
    # Simple interpretation logic (will be enhanced with LLM in Phase 1)
    skill_check_needed = False
    skill_used = None
    difficulty = None
    
    # Check if the target exists and what kind of interaction it is
    target = action_intent.target
    
    if target in zone.objects:
        obj = zone.objects[target]
        if obj.properties.get("required_skill"):
            skill_check_needed = True
            skill_used = obj.properties["required_skill"]
            difficulty = obj.properties.get("difficulty", "moderate")
    elif target in zone.exits:
        exit_obj = zone.exits[target]
        if exit_obj.status == "locked":
            skill_check_needed = True
            skill_used = "comtech"  # Default for locked doors
            difficulty = "moderate"
    
    print(f"📋 Action requires skill check: {skill_check_needed}")
    if skill_check_needed:
        print(f"🎲 Skill: {skill_used}, Difficulty: {difficulty}")
    
    return {
        "director_result": DirectorResult(
            skill_check_needed=skill_check_needed,
            skill_used=skill_used,
            difficulty=difficulty,
            success=None,  # Will be determined in resolver
            narration="",  # Will be generated in narrator
            state_updates={}  # Will be determined after resolution
        )
    }

def run_director_resolver(state: AgentState) -> Dict[str, Any]:
    """
    Node 3: Director resolves skill checks if needed
    """
    print("🎲 Director: Resolving action...")
    
    director_result = state.director_result
    character = state.current_character
    
    if not director_result.skill_check_needed:
        director_result.success = True
        print("✅ No skill check needed - automatic success")
        return {"director_result": director_result}
    
    # Get character's skill value
    skill_name = director_result.skill_used
    skill_value = getattr(character.skills, skill_name, 0)
    
    # Get relevant attribute (simplified mapping)
    attribute_map = {
        "comtech": character.attributes.wits,
        "heavy_machinery": character.attributes.might,
        "medical_aid": character.attributes.empathy,
        "observation": character.attributes.wits,
        "close_combat": character.attributes.might,
        "ranged_combat": character.attributes.agility
    }
    
    attribute_value = attribute_map.get(skill_name, character.attributes.wits)
    
    # Simple dice roll system (2d6 + attribute + skill vs difficulty)
    dice_roll = random.randint(1, 6) + random.randint(1, 6)
    total = dice_roll + attribute_value + skill_value
    
    # Difficulty thresholds
    difficulty_map = {
        "trivial": 6,
        "easy": 8, 
        "moderate": 10,
        "hard": 12,
        "extreme": 14
    }
    
    threshold = difficulty_map.get(director_result.difficulty, 10)
    success = total >= threshold
    
    director_result.success = success
    
    print(f"🎲 Roll: {dice_roll} + {attribute_value} (attr) + {skill_value} (skill) = {total} vs {threshold}")
    print(f"{'✅ SUCCESS' if success else '❌ FAILURE'}")
    
    return {"director_result": director_result}

def run_director_narrator(state: AgentState) -> Dict[str, Any]:
    """
    Node 4: Director generates narrative description of the action outcome
    """
    print("📖 Director: Generating narration...")
    
    director_result = state.director_result
    character = state.current_character
    action_intent = state.actor_response.action_intent
    
    # Generate appropriate narration based on action and outcome
    verb = action_intent.verb
    target = action_intent.target
    success = director_result.success
    
    # Simple narration templates (will be enhanced with LLM in Phase 1)
    if verb == "REPAIR" and target == "door_control_panel_north":
        if success:
            narration = f"{character.name} carefully works on the damaged control panel with her multitool. Sparks fly as she reroutes damaged circuits. After several tense minutes, the panel flickers back to life with a soft chime."
        else:
            narration = f"{character.name} attempts to repair the control panel, but the damage is worse than expected. Her multitool sparks against the fried circuits, and the panel remains dark and unresponsive."
    elif verb == "EXAMINE":
        narration = f"{character.name} takes a closer look at the {target.replace('_', ' ')}, studying its condition and looking for ways to interact with it."
    else:
        # Generic narration
        action_desc = "successfully completes" if success else "struggles with"
        narration = f"{character.name} {action_desc} the {verb.lower()} action on {target.replace('_', ' ')}."
    
    director_result.narration = narration
    print(f"📖 Narration: {narration}")
    
    return {"director_result": director_result}

def run_director_state_updater(state: AgentState) -> Dict[str, Any]:
    """
    Node 5: Director updates the game state based on action results
    """
    print("💾 Director: Updating game state...")
    
    director_result = state.director_result
    action_intent = state.actor_response.action_intent
    game_state = state.game_state
    
    state_updates = {}
    
    # Update state based on successful actions
    if director_result.success and action_intent.verb == "REPAIR":
        if action_intent.target == "door_control_panel_north":
            # Update the panel status
            zone = game_state.zones[state.current_character.current_zone]
            if "door_control_panel_north" in zone.objects:
                zone.objects["door_control_panel_north"].status = "functional"
                state_updates["door_control_panel_north"] = "repaired"
            
            # Update door status if panel is fixed
            if "north_door" in zone.exits:
                zone.exits["north_door"].status = "unlocked"
                state_updates["north_door"] = "unlocked"
    
    director_result.state_updates = state_updates
    
    # Create turn result
    turn_result = TurnResult(
        helmet_cam_feed=director_result.narration,
        character_speech=state.actor_response.speech,
        state_changes=state_updates,
        turn_number=game_state.current_turn,
        active_character=state.current_character.name
    )
    
    # Add to game log
    game_state.game_log.append(turn_result)
    game_state.current_turn += 1
    
    print(f"💾 State updates: {state_updates}")
    print(f"🔄 Turn {game_state.current_turn - 1} completed")
    
    return {
        "director_result": director_result,
        "turn_result": turn_result
    }

def create_narrative_graph():
    """Create and configure the LangGraph state graph"""
    
    # Create the state graph
    workflow = StateGraph(AgentState)
    
    # Add nodes
    workflow.add_node("ai_actor", run_ai_actor)
    workflow.add_node("director_interpreter", run_director_interpreter) 
    workflow.add_node("director_resolver", run_director_resolver)
    workflow.add_node("director_narrator", run_director_narrator)
    workflow.add_node("director_state_updater", run_director_state_updater)
    
    # Define the flow
    workflow.set_entry_point("ai_actor")
    workflow.add_edge("ai_actor", "director_interpreter")
    workflow.add_edge("director_interpreter", "director_resolver")
    workflow.add_edge("director_resolver", "director_narrator")
    workflow.add_edge("director_narrator", "director_state_updater")
    workflow.add_edge("director_state_updater", END)
    
    return workflow.compile()

def run_single_turn(commander_command: str = "") -> TurnResult:
    """
    Execute a single game turn
    
    Args:
        commander_command: Optional command from the Commander
        
    Returns:
        TurnResult: The outcome of the turn
    """
    print(f"\n🚀 Starting Turn {GAME_STATE.current_turn}")
    print(f"👤 Active Character: {GAME_STATE.active_character_id}")
    
    # Get current character and zone
    current_char = GAME_STATE.characters[GAME_STATE.active_character_id]
    current_zone = GAME_STATE.zones[current_char.current_zone]
    
    # Create initial agent state
    initial_state = AgentState(
        game_state=GAME_STATE,
        current_character=current_char,
        current_zone=current_zone,
        commander_command=commander_command
    )
    
    # Run the narrative graph
    graph = create_narrative_graph()
    result = graph.invoke(initial_state)
    
    return result["turn_result"]

# Test runner for Phase 0
if __name__ == "__main__":
    print("🔬 Testing Alien in the Machine - Narrative Engine")
    print("=" * 60)
    
    # Display initial state
    miller = GAME_STATE.characters["miller"]
    medbay = GAME_STATE.zones["medbay_b"]
    
    print(f"📍 {miller.name} is in {medbay.name}")
    print(f"🎯 Mission: {GAME_STATE.mission_status['objective']}")
    print(f"🚪 Door Status: {medbay.exits['north_door'].status}")
    print(f"🔧 Panel Status: {medbay.objects['door_control_panel_north'].status}")
    print()
    
    # Run a test turn
    test_command = "Try to get us out of here, Miller!"
    result = run_single_turn(test_command)
    
    print("\n📊 TURN RESULTS:")
    print(f"🎥 Helmet Cam: {result.helmet_cam_feed}")
    print(f"📻 Comms: '{result.character_speech}'")
    print(f"🔄 Changes: {result.state_changes}")
    
    # Show updated state
    print(f"\n📍 Updated Door Status: {medbay.exits['north_door'].status}")
    print(f"🔧 Updated Panel Status: {medbay.objects['door_control_panel_north'].status}")
