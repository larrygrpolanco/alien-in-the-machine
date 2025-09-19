Phase 0: Minimal Setup

Project Structure:

/medbay_escape_prototype/
├── backend/
│   ├── .env.example                # OPENROUTER_API_KEY=your_key_here
│   ├── requirements.txt           # Minimal dependencies
│   ├── data/
│   │   ├── character_miller.json
│   │   └── zone_medbay_b.json
│   ├── prompts/
│   │   ├── actor_v1.txt          # Prompt templates as simple text files
│   │   └── director_v1.txt
│   ├── schemas.py                 # Simple Pydantic models
│   ├── narrative_engine.py        # Core AI functions (no classes!)
│   └── test_cli.py               # Command-line tester
└── frontend/                      # We'll do this in Phase 3

Dependencies (requirements.txt):

langchain-openai
langchain-core
python-dotenv
pydantic
fastapi
uvicorn[standard]

Phase 1: Core Narrative Engine (Pure Functions)

narrative_engine.py - Keep it dead simple:
python

from langchain_openai import ChatOpenAI
from langchain_core.prompts import PromptTemplate
from langchain_core.output_parsers import JsonOutputParser
import json
import os
from dotenv import load_dotenv

load_dotenv()

# Simple OpenRouter setup
def get_llm(model="openai/gpt-4o-mini"):  # Use free model by default
    return ChatOpenAI(
        base_url="https://openrouter.ai/api/v1",
        api_key=os.getenv("OPENROUTER_API_KEY"),
        model=model,
        temperature=0.7
    )

def load_prompt(filename):
    """Load prompt from text file for easy editing"""
    with open(f"prompts/{filename}", "r") as f:
        return f.read()

def actor_decide(character_data, zone_data, command, prompt_version="v1"):
    """Simple function: character + situation + command → action intent"""
    llm = get_llm()
    
    prompt_template = PromptTemplate.from_template(load_prompt(f"actor_{prompt_version}.txt"))
    parser = JsonOutputParser()
    
    chain = prompt_template | llm | parser
    
    return chain.invoke({
        "character_name": character_data["name"],
        "agenda": character_data["agenda"],
        "zone_name": zone_data["name"],
        "zone_description": zone_data["description"],
        "command": command,
        "character_status": character_data["status"]
    })

def director_resolve(action_intent, character_data, zone_data, prompt_version="v1"):
    """Simple function: action intent → narration + world updates"""
    llm = get_llm()
    
    prompt_template = PromptTemplate.from_template(load_prompt(f"director_{prompt_version}.txt"))
    parser = JsonOutputParser()
    
    chain = prompt_template | llm | parser
    
    # Simple skill check logic
    skill_total = character_data["attributes"]["wits"] + character_data["skills"]["comtech"]
    
    return chain.invoke({
        "action_intent": json.dumps(action_intent),
        "character_name": character_data["name"],
        "skill_total": skill_total,
        "zone_data": json.dumps(zone_data),
        "character_data": json.dumps(character_data)
    })

# That's it! Two functions.

Example Prompt Templates:

prompts/actor_v1.txt:

You are {character_name}, a space marine. Your driving motivation: "{agenda}"

Current situation:
- Location: {zone_name} - {zone_description}  
- Your status: {character_status}
- Commander's suggestion: "{command}"

Based on your agenda and personality, decide what you actually do. You don't have to follow the commander's suggestion if it conflicts with your agenda.

Return JSON with:
- "thoughts": Your internal reasoning
- "speech": What you say out loud (if anything)
- "action": What you physically attempt to do
- "target": What/who you're acting on

Keep it brief and in-character.

prompts/director_v1.txt:

SITUATION: {character_name} is attempting: {action_intent}
Their skill total (wits + comtech): {skill_total}

Your job as Director:
1. Decide if this needs a skill check (difficulty 0-3, where 0 = automatic success)
2. If skill_total >= difficulty: SUCCESS. If skill_total < difficulty: FAILURE or PARTIAL SUCCESS
3. Write engaging narration for the helmet cam feed
4. Update world state with consequences

Current world state: {zone_data}

Return JSON with:
- "difficulty": number (0-3)
- "outcome": "success", "failure", or "partial"  
- "narration": Brief, atmospheric description of what happens
- "world_updates": Object with any changes to zone or character data

Be creative with consequences. Successes can have complications, failures can reveal new information.

Phase 1.5: CLI Testing Framework

test_cli.py - Your main development tool:
python

#!/usr/bin/env python3
from narrative_engine import actor_decide, director_resolve
import json

def load_game_data():
    with open("data/character_miller.json") as f:
        character = json.load(f)
    with open("data/zone_medbay_b.json") as f:
        zone = json.load(f)
    return character, zone

def test_scenario(command, actor_version="v1", director_version="v1"):
    print(f"\n{'='*50}")
    print(f"TESTING: '{command}'")
    print(f"Actor: {actor_version}, Director: {director_version}")
    print(f"{'='*50}")
    
    character, zone = load_game_data()
    
    # Step 1: Actor decides
    print("\n🤖 ACTOR THINKING...")
    actor_result = actor_decide(character, zone, command, actor_version)
    print(f"Thoughts: {actor_result.get('thoughts', 'N/A')}")
    print(f"Speech: {actor_result.get('speech', 'N/A')}")
    print(f"Action: {actor_result.get('action', 'N/A')}")
    
    # Step 2: Director resolves
    print("\n🎬 DIRECTOR RESOLVING...")
    director_result = director_resolve(actor_result, character, zone, director_version)
    print(f"Difficulty: {director_result.get('difficulty', 'N/A')}")
    print(f"Outcome: {director_result.get('outcome', 'N/A')}")
    print(f"Narration: {director_result.get('narration', 'N/A')}")
    print(f"Updates: {director_result.get('world_updates', 'N/A')}")

if __name__ == "__main__":
    # Test different scenarios
    scenarios = [
        "Fix the door panel",
        "Kick down the door", 
        "Look for another way out",
        "Check my equipment"
    ]
    
    for scenario in scenarios:
        test_scenario(scenario)
        input("\nPress Enter for next test...")

Usage:
bash

cd backend
python test_cli.py

This lets you rapidly test prompts without any web interface.
Phase 2: Simple API (When Core Works)

Only after your CLI testing shows the narrative engine works well:
python

# main.py - Dead simple FastAPI
from fastapi import FastAPI
from narrative_engine import actor_decide, director_resolve
import json

app = FastAPI()

# Global game state (terrible but simple)
game_log = []

@app.get("/api/state")
def get_state():
    return {"log": game_log}

@app.post("/api/turn") 
def advance_turn(request: dict):
    command = request.get("command", "")
    
    # Load current state
    with open("data/character_miller.json") as f:
        character = json.load(f)
    with open("data/zone_medbay_b.json") as f:
        zone = json.load(f)
    
    # Run narrative engine
    actor_result = actor_decide(character, zone, command)
    director_result = director_resolve(actor_result, character, zone)
    
    # Add to log
    game_log.extend([
        {"type": "commander", "content": command, "author": "Commander"},
        {"type": "ai_dialogue", "content": actor_result.get("speech", ""), "author": character["name"]},
        {"type": "ai_action", "content": director_result.get("narration", ""), "author": "System"}
    ])
    
    return {"log": game_log}

Phase 3: Basic Frontend (HTML + Vanilla JS)

Skip SvelteKit complexity initially. Just HTML + fetch():
html

<!DOCTYPE html>
<html>
<head><title>Medbay Escape</title></head>
<body>
    <div id="log"></div>
    <input type="text" id="command" placeholder="Enter command...">
    <button onclick="sendCommand()">Submit</button>
    
    <script>
    async function sendCommand() {
        const command = document.getElementById('command').value;
        const response = await fetch('/api/turn', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({command})
        });
        const data = await response.json();
        updateLog(data.log);
    }
    
    function updateLog(log) {
        const logDiv = document.getElementById('log');
        logDiv.innerHTML = log.map(entry => 
            `<div class="${entry.type}">${entry.author}: ${entry.content}</div>`
        ).join('');
    }
    </script>
</body>
</html>

Key Benefits of This Approach:

    Easy Prompt Testing - Edit text files, run test_cli.py
    Simple Debugging - Plain Python functions you can step through
    Cheap Development - Free OpenRouter models
    Quick Iteration - No framework complexity
    Clear Upgrade Path - Can add LangGraph/tools later when core works

This approach gets you a working prototype in a few hours rather than days of framework wrestling.


