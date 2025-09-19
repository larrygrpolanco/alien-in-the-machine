# "Alien in the Machine" - Medbay Escape Prototype - Merged Development Plan

## **Overview and Philosophy**

This plan creates a simple but architecturally sound foundation for the Alien in the Machine narrative game engine. It prioritizes:

- **Simple but Scalable Architecture**: Uses proper architectural patterns (LangGraph, GameManager) from the start, but keeps initial implementation minimal
- **Manual Control**: Direct prompt editing with simple text files - no complex versioning systems
- **Fast Iteration**: CLI-first development for rapid prompt testing without web server complexity
- **Clear Upgrade Path**: Structured to seamlessly expand into more complex features later

The core mechanic is a **Simple Threshold System** where the Director AI determines task difficulty and resolves outcomes based on character stats, with creative narrative freedom for the AI to add complications and emergent details.

---

## **Project Structure**

```
/medbay_escape_prototype/
├── backend/
│   ├── .env.example                    # Environment variables
│   ├── requirements.txt                # Python dependencies
│   ├── data/
│   │   ├── character_miller.json       # Character state
│   │   └── zone_medbay_b.json         # Zone state
│   ├── prompts/
│   │   ├── actor.txt                   # Actor AI prompt (direct edit)
│   │   └── director.txt                # Director AI prompt (direct edit)
│   ├── app/
│   │   ├── __init__.py
│   │   ├── schemas.py                  # Pydantic data models
│   │   ├── game_manager.py             # State management class
│   │   ├── narrative_engine.py         # LangGraph implementation
│   │   └── main.py                     # FastAPI server
│   └── test_cli.py                     # CLI testing script
└── frontend/                           # SvelteKit (Phase 2)
    └── [SvelteKit structure]
```

---

## **Phase 0: Foundation Setup**

### **Dependencies (requirements.txt)**
```
fastapi
uvicorn[standard]
pydantic
python-dotenv
langchain-openai
langchain-core
langgraph
```

### **Environment Setup (.env.example)**
```
# OpenRouter API Key for AI models
OPENROUTER_API_KEY=your_key_here

# Optional: Specify default model
DEFAULT_MODEL=openai/gpt-4o-mini
```

### **Core Data Schemas (app/schemas.py)**

Create Pydantic models that define the structure of our JSON data files:

```python
from pydantic import BaseModel
from typing import List, Dict, Optional
from enum import Enum

class CharacterAttributes(BaseModel):
    wits: int

class CharacterSkills(BaseModel):
    comtech: int

class CharacterStatus(BaseModel):
    health: str
    stress: int

class Character(BaseModel):
    name: str
    attributes: CharacterAttributes
    skills: CharacterSkills
    inventory: List[str]
    agenda: str
    status: CharacterStatus

class Exit(BaseModel):
    to: str
    status: str
    panel: str
    extra_properties: Dict[str, str] = {}

class Zone(BaseModel):
    name: str
    description: str
    exits: Dict[str, Exit]

class MessageType(str, Enum):
    SYSTEM = "system"
    COMMANDER = "commander"
    AI_THOUGHTS = "ai_thoughts"
    AI_DIALOGUE = "ai_dialogue"
    AI_ACTION = "ai_action"

class LogEntry(BaseModel):
    turn: int
    type: MessageType
    content: str
    author: str

class GameLogState(BaseModel):
    log: List[LogEntry]
    current_turn: int
```

### **Initial Data Files**

**data/character_miller.json:**
```json
{
  "name": "Vanessa Miller",
  "attributes": { "wits": 2 },
  "skills": { "comtech": 1 },
  "inventory": ["multitool", "pistol"],
  "agenda": "Get the job done and get paid.",
  "status": { "health": "healthy", "stress": 1 }
}
```

**data/zone_medbay_b.json:**
```json
{
  "name": "Medbay B",
  "description": "A sterile, white room. An emergency light flickers. The air smells of antiseptic.",
  "exits": {
    "north_door": {
      "to": "corridor_3",
      "status": "locked",
      "panel": "smashed",
      "extra_properties": {}
    }
  }
}
```

---

## **Phase 1: Core Narrative Engine**

### **Basic GameManager (app/game_manager.py)**

Simple but extensible state management:

```python
import json
from pathlib import Path
from typing import Dict, Any, List
from .schemas import Character, Zone, LogEntry, MessageType

class GameManager:
    def __init__(self, data_dir: str = "data"):
        self.data_dir = Path(data_dir)
        self.current_turn = 0
        self.game_log: List[LogEntry] = []
        
        # Load initial game state
        self.character = self._load_character()
        self.zone = self._load_zone()
    
    def _load_character(self) -> Character:
        """Load character data from JSON file"""
        with open(self.data_dir / "character_miller.json", "r") as f:
            data = json.load(f)
        return Character(**data)
    
    def _load_zone(self) -> Zone:
        """Load current zone data from JSON file"""
        with open(self.data_dir / "zone_medbay_b.json", "r") as f:
            data = json.load(f)
        return Zone(**data)
    
    def add_log_entry(self, entry_type: MessageType, content: str, author: str):
        """Add an entry to the game log"""
        entry = LogEntry(
            turn=self.current_turn,
            type=entry_type,
            content=content,
            author=author
        )
        self.game_log.append(entry)
    
    def advance_turn(self):
        """Increment the turn counter"""
        self.current_turn += 1
    
    def get_current_state(self) -> Dict[str, Any]:
        """Get the complete current game state"""
        return {
            "character": self.character.model_dump(),
            "zone": self.zone.model_dump(),
            "log": [entry.model_dump() for entry in self.game_log],
            "current_turn": self.current_turn
        }
    
    def apply_world_updates(self, updates: Dict[str, Any]):
        """Apply world state changes from Director"""
        # Simple implementation - extend as needed
        if "zone" in updates:
            zone_updates = updates["zone"]
            # Update zone data
            for key, value in zone_updates.items():
                if hasattr(self.zone, key):
                    setattr(self.zone, key, value)
        
        if "character" in updates:
            char_updates = updates["character"]
            # Update character data
            for key, value in char_updates.items():
                if hasattr(self.character, key):
                    setattr(self.character, key, value)
        
        # Save updated state back to files
        self._save_state()
    
    def _save_state(self):
        """Save current state back to JSON files"""
        with open(self.data_dir / "character_miller.json", "w") as f:
            json.dump(self.character.model_dump(), f, indent=2)
        
        with open(self.data_dir / "zone_medbay_b.json", "w") as f:
            json.dump(self.zone.model_dump(), f, indent=2)
```

### **Simple LangGraph Engine (app/narrative_engine.py)**

Two-node LangGraph implementation that's easy to expand:

```python
import json
from typing import Dict, Any, TypedDict
from pathlib import Path

from langchain_openai import ChatOpenAI
from langchain_core.prompts import PromptTemplate
from langchain_core.output_parsers import JsonOutputParser
from langgraph.graph import StateGraph, END

from dotenv import load_dotenv
import os

load_dotenv()

class NarrativeState(TypedDict):
    """State object passed between LangGraph nodes"""
    character_data: Dict[str, Any]
    zone_data: Dict[str, Any]
    command: str
    actor_result: Dict[str, Any]
    director_result: Dict[str, Any]
    error: str

class NarrativeEngine:
    def __init__(self, prompts_dir: str = "prompts"):
        self.prompts_dir = Path(prompts_dir)
        self.llm = self._get_llm()
        self.graph = self._create_graph()
    
    def _get_llm(self, model: str = None):
        """Initialize the LLM"""
        model = model or os.getenv("DEFAULT_MODEL", "openai/gpt-4o-mini")
        return ChatOpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key=os.getenv("OPENROUTER_API_KEY"),
            model=model,
            temperature=0.7
        )
    
    def _load_prompt(self, prompt_name: str) -> str:
        """Load prompt template from text file"""
        prompt_file = self.prompts_dir / f"{prompt_name}.txt"
        if not prompt_file.exists():
            raise FileNotFoundError(f"Prompt file not found: {prompt_file}")
        
        with open(prompt_file, "r") as f:
            return f.read()
    
    def _actor_node(self, state: NarrativeState) -> NarrativeState:
        """Actor AI decides what the character does"""
        try:
            prompt_text = self._load_prompt("actor")
            prompt_template = PromptTemplate.from_template(prompt_text)
            parser = JsonOutputParser()
            
            chain = prompt_template | self.llm | parser
            
            result = chain.invoke({
                "character_name": state["character_data"]["name"],
                "agenda": state["character_data"]["agenda"],
                "zone_name": state["zone_data"]["name"],
                "zone_description": state["zone_data"]["description"],
                "command": state["command"],
                "character_status": json.dumps(state["character_data"]["status"])
            })
            
            state["actor_result"] = result
            return state
            
        except Exception as e:
            state["error"] = f"Actor node error: {str(e)}"
            return state
    
    def _director_node(self, state: NarrativeState) -> NarrativeState:
        """Director AI resolves the action and narrates the outcome"""
        try:
            prompt_text = self._load_prompt("director")
            prompt_template = PromptTemplate.from_template(prompt_text)
            parser = JsonOutputParser()
            
            chain = prompt_template | self.llm | parser
            
            # Calculate skill total for threshold system
            char_data = state["character_data"]
            skill_total = char_data["attributes"]["wits"] + char_data["skills"]["comtech"]
            
            result = chain.invoke({
                "action_intent": json.dumps(state["actor_result"]),
                "character_name": char_data["name"],
                "skill_total": skill_total,
                "zone_data": json.dumps(state["zone_data"]),
                "character_data": json.dumps(char_data)
            })
            
            state["director_result"] = result
            return state
            
        except Exception as e:
            state["error"] = f"Director node error: {str(e)}"
            return state
    
    def _create_graph(self):
        """Create the LangGraph workflow"""
        workflow = StateGraph(NarrativeState)
        
        # Add nodes
        workflow.add_node("actor", self._actor_node)
        workflow.add_node("director", self._director_node)
        
        # Define the flow
        workflow.set_entry_point("actor")
        workflow.add_edge("actor", "director")
        workflow.add_edge("director", END)
        
        return workflow.compile()
    
    def process_turn(self, character_data: Dict, zone_data: Dict, command: str) -> Dict[str, Any]:
        """Process a complete turn through the narrative engine"""
        initial_state = NarrativeState(
            character_data=character_data,
            zone_data=zone_data,
            command=command,
            actor_result={},
            director_result={},
            error=""
        )
        
        final_state = self.graph.invoke(initial_state)
        
        return {
            "actor_result": final_state["actor_result"],
            "director_result": final_state["director_result"],
            "error": final_state.get("error", "")
        }
```

### **Prompt Templates**

**prompts/actor.txt:**
```
You are {character_name}, a tough space marine. Your driving motivation: "{agenda}"

Current situation:
- Location: {zone_name} - {zone_description}
- Your status: {character_status}
- Commander's order: "{command}"

You respect the chain of command but you're not a mindless robot. Based on your agenda and the situation, decide what you actually do. You may follow the commander's order, modify it, or do something completely different if it conflicts with your agenda.

Return JSON with:
- "thoughts": Your internal reasoning (brief)
- "speech": What you say out loud (if anything)
- "action": What you physically attempt to do
- "target": What/who you're acting on (if applicable)

Stay in character. Be concise but flavorful.
```

**prompts/director.txt:**
```
SITUATION: {character_name} is attempting the following action:
{action_intent}

Their total skill (wits + comtech): {skill_total}

As Director, you are a creative storyteller with full authority to resolve this action:

1. Set difficulty (0=trivial, 1=easy, 2=moderate, 3=hard, 4=extreme)
2. Compare skill_total to difficulty:
   - skill_total >= difficulty: SUCCESS
   - skill_total < difficulty: FAILURE or PARTIAL SUCCESS (your choice)
3. Write engaging narration for the helmet cam feed
4. Specify any world state changes (be creative with consequences)

Current world state: {zone_data}
Current character: {character_data}

Return JSON with:
- "difficulty": number (0-4)
- "outcome": "success", "partial", or "failure"
- "narration": Helmet cam description (2-3 sentences, atmospheric)
- "world_updates": Object with changes to make

Be creative with consequences. Successes can have complications, failures can reveal information. You have full creative authority to modify the world beyond the immediate action.
```

---

## **Phase 1.5: CLI Testing Framework**

**test_cli.py** - Basic but effective testing script:

```python
#!/usr/bin/env python3
"""
Simple CLI testing script for the narrative engine.
Edit the scenarios list to test different commands.
"""

import sys
from pathlib import Path

# Add the app directory to the path
sys.path.append(str(Path(__file__).parent / "app"))

from game_manager import GameManager
from narrative_engine import NarrativeEngine

def test_scenario(command: str, engine: NarrativeEngine, game_manager: GameManager):
    """Test a single scenario"""
    print(f"\n{'='*60}")
    print(f"TESTING: '{command}'")
    print(f"{'='*60}")
    
    try:
        # Get current game state
        character_data = game_manager.character.model_dump()
        zone_data = game_manager.zone.model_dump()
        
        print(f"\nLocation: {zone_data['name']}")
        print(f"Character: {character_data['name']} (Wits: {character_data['attributes']['wits']}, Comtech: {character_data['skills']['comtech']})")
        print(f"Status: {character_data['status']}")
        
        # Process through narrative engine
        result = engine.process_turn(character_data, zone_data, command)
        
        if result["error"]:
            print(f"\n❌ ERROR: {result['error']}")
            return
        
        actor_result = result["actor_result"]
        director_result = result["director_result"]
        
        # Display results
        print(f"\n🤖 ACTOR (Miller):")
        print(f"  Thoughts: {actor_result.get('thoughts', 'N/A')}")
        if actor_result.get('speech'):
            print(f"  Speech: \"{actor_result['speech']}\"")
        print(f"  Action: {actor_result.get('action', 'N/A')}")
        if actor_result.get('target'):
            print(f"  Target: {actor_result['target']}")
        
        print(f"\n🎬 DIRECTOR:")
        print(f"  Difficulty: {director_result.get('difficulty', 'N/A')}")
        print(f"  Outcome: {director_result.get('outcome', 'N/A')}")
        print(f"  Narration: {director_result.get('narration', 'N/A')}")
        
        if director_result.get('world_updates'):
            print(f"  World Updates: {director_result['world_updates']}")
        
    except Exception as e:
        print(f"❌ ERROR: {e}")

def main():
    """Main testing function"""
    print("🚀 NARRATIVE ENGINE CLI TESTER")
    print("=" * 60)
    
    try:
        # Initialize components
        game_manager = GameManager()
        narrative_engine = NarrativeEngine()
        
        # Test scenarios - EDIT THESE TO TEST DIFFERENT COMMANDS
        scenarios = [
            "Fix the door panel",
            "Kick down the door",
            "Look for another way out",
            "Check my equipment",
            "Examine the room carefully",
            "Try to hack the door panel",
            "Search for medical supplies"
        ]
        
        print(f"Testing {len(scenarios)} scenarios...")
        
        for i, scenario in enumerate(scenarios, 1):
            test_scenario(scenario, narrative_engine, game_manager)
            
            if i < len(scenarios):
                input(f"\n⏸️  Test {i}/{len(scenarios)} complete. Press Enter to continue...")
        
        print(f"\n✅ All tests completed!")
        
    except Exception as e:
        print(f"💥 Fatal error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()
```

**Usage:**
```bash
cd backend
python test_cli.py
```

This allows rapid prompt testing without any web interface. Edit the scenarios list in the script to test different commands.

---

## **Phase 2: FastAPI Server**

**app/main.py** - Simple but complete API:

```python
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
import os

from .game_manager import GameManager
from .narrative_engine import NarrativeEngine
from .schemas import MessageType

app = FastAPI(title="Medbay Escape API", version="1.0.0")

# Enable CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize game components
game_manager = GameManager()
narrative_engine = NarrativeEngine()

class CommandRequest(BaseModel):
    command: str

@app.get("/api/health")
def health_check():
    """Simple health check endpoint"""
    return {"status": "ok", "message": "Narrative engine is running"}

@app.get("/api/state")
def get_game_state():
    """Get current game state"""
    try:
        return {
            "log": [entry.model_dump() for entry in game_manager.game_log],
            "current_turn": game_manager.current_turn,
            "character": game_manager.character.model_dump(),
            "zone": game_manager.zone.model_dump()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/turn")
def advance_turn(request: CommandRequest):
    """Process a game turn"""
    try:
        command = request.command.strip()
        
        # Log the commander's input
        game_manager.add_log_entry(
            MessageType.COMMANDER, 
            command, 
            "Commander"
        )
        
        # Process through narrative engine
        character_data = game_manager.character.model_dump()
        zone_data = game_manager.zone.model_dump()
        
        result = narrative_engine.process_turn(character_data, zone_data, command)
        
        if result["error"]:
            raise HTTPException(status_code=500, detail=result["error"])
        
        actor_result = result["actor_result"]
        director_result = result["director_result"]
        
        # Log AI thoughts (for debugging)
        if actor_result.get("thoughts"):
            game_manager.add_log_entry(
                MessageType.AI_THOUGHTS,
                actor_result["thoughts"],
                game_manager.character.name
            )
        
        # Log AI dialogue
        if actor_result.get("speech"):
            game_manager.add_log_entry(
                MessageType.AI_DIALOGUE,
                actor_result["speech"],
                game_manager.character.name
            )
        
        # Log the action narration
        if director_result.get("narration"):
            game_manager.add_log_entry(
                MessageType.AI_ACTION,
                director_result["narration"],
                "System"
            )
        
        # Apply world state changes
        if director_result.get("world_updates"):
            game_manager.apply_world_updates(director_result["world_updates"])
        
        # Advance turn counter
        game_manager.advance_turn()
        
        # Return updated game state
        return {
            "log": [entry.model_dump() for entry in game_manager.game_log],
            "current_turn": game_manager.current_turn,
            "turn_result": {
                "actor": actor_result,
                "director": director_result
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
```

**Running the server:**
```bash
cd backend
uvicorn app.main:app --reload
```

Test with curl:
```bash
curl -X POST "http://127.0.0.1:8000/api/turn" \
     -H "Content-Type: application/json" \
     -d '{"command": "Fix the door panel"}'
```

---

## **Phase 3: Simple Frontend (Optional - can start with API testing)**

For initial development, you can test entirely through the API or CLI. When ready for a frontend:

### **Basic HTML Interface (static/index.html)**
```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Medbay Escape - Radio Log</title>
    <style>
        body {
            font-family: 'Courier New', monospace;
            background-color: #1a1a1a;
            color: #00ff00;
            margin: 0;
            padding: 20px;
        }
        .container {
            max-width: 800px;
            margin: 0 auto;
        }
        .log-container {
            background-color: #000;
            border: 2px solid #00ff00;
            border-radius: 5px;
            padding: 15px;
            height: 400px;
            overflow-y: auto;
            margin-bottom: 20px;
        }
        .log-entry {
            margin-bottom: 10px;
            padding: 5px;
        }
        .commander { color: #ffff00; }
        .ai_dialogue { color: #00ffff; }
        .ai_action { color: #ff9900; }
        .ai_thoughts { color: #888888; font-style: italic; }
        .system { color: #ff0000; }
        
        .input-container {
            display: flex;
            gap: 10px;
        }
        .command-input {
            flex: 1;
            padding: 10px;
            background-color: #333;
            color: #00ff00;
            border: 1px solid #00ff00;
            border-radius: 3px;
            font-family: inherit;
        }
        .submit-btn {
            padding: 10px 20px;
            background-color: #00ff00;
            color: #000;
            border: none;
            border-radius: 3px;
            cursor: pointer;
            font-family: inherit;
            font-weight: bold;
        }
        .submit-btn:hover {
            background-color: #00cc00;
        }
        .submit-btn:disabled {
            background-color: #555;
            color: #999;
            cursor: not-allowed;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🛸 MEDBAY ESCAPE - RADIO LOG</h1>
        <div id="log" class="log-container"></div>
        <div class="input-container">
            <input type="text" id="commandInput" class="command-input" 
                   placeholder="Enter command..." maxlength="200">
            <button id="submitBtn" class="submit-btn">SEND</button>
        </div>
    </div>

    <script>
        const API_BASE = 'http://127.0.0.1:8000';
        const logContainer = document.getElementById('log');
        const commandInput = document.getElementById('commandInput');
        const submitBtn = document.getElementById('submitBtn');

        async function loadInitialState() {
            try {
                const response = await fetch(`${API_BASE}/api/state`);
                const data = await response.json();
                displayLog(data.log);
            } catch (error) {
                console.error('Failed to load initial state:', error);
                addLogEntry('system', 'ERROR: Failed to connect to server', 'System');
            }
        }

        async function sendCommand() {
            const command = commandInput.value.trim();
            
            submitBtn.disabled = true;
            commandInput.disabled = true;

            try {
                const response = await fetch(`${API_BASE}/api/turn`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ command })
                });

                if (!response.ok) {
                    throw new Error(`Server error: ${response.status}`);
                }

                const data = await response.json();
                displayLog(data.log);
                commandInput.value = '';

            } catch (error) {
                console.error('Failed to send command:', error);
                addLogEntry('system', `ERROR: ${error.message}`, 'System');
            } finally {
                submitBtn.disabled = false;
                commandInput.disabled = false;
                commandInput.focus();
            }
        }

        function displayLog(logEntries) {
            logContainer.innerHTML = '';
            logEntries.forEach(entry => {
                addLogEntry(entry.type, entry.content, entry.author);
            });
            logContainer.scrollTop = logContainer.scrollHeight;
        }

        function addLogEntry(type, content, author) {
            const div = document.createElement('div');
            div.className = `log-entry ${type}`;
            div.innerHTML = `<strong>[${author}]</strong> ${content}`;
            logContainer.appendChild(div);
        }

        // Event listeners
        submitBtn.addEventListener('click', sendCommand);
        commandInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !submitBtn.disabled) {
                sendCommand();
            }
        });

        // Initialize
        loadInitialState();
        commandInput.focus();
    </script>
</body>
</html>
```

---

## **Development Workflow**

### **Recommended Development Order:**

1. **Setup Phase 0**: Create project structure, install dependencies, create data files
2. **Test CLI**: Get `test_cli.py` working first - this is your main development tool
3. **Iterate on Prompts**: Edit `prompts/actor.txt` and `prompts/director.txt` directly, test with CLI
4. **Add API**: Once CLI works well, add the FastAPI server
5. **Test API**: Use curl or the simple HTML frontend to test the web interface
6. **Expand**: Add more features, zones, characters as needed

### **Key Benefits of This Architecture:**

- **Fast Iteration**: Edit prompts directly, test immediately with CLI
- **Simple Debugging**: Everything is explicit, no hidden complexity
- **Cheap Development**: Uses free OpenRouter models
- **Clear Upgrade Path**: Easy to add more LangGraph nodes, sophisticated GameManager features
- **Proper Foundation**: Uses industry-standard patterns (Pydantic, FastAPI, LangGraph)

### **Easy Extensions:**

When ready to expand:
- Add more LangGraph nodes (interpret → resolve → narrate)
- Add more sophisticated state management
- Add multiple characters/zones
- Add save/load functionality
- Add more complex AI prompt templates
- Add frontend with SvelteKit for better UX

This plan provides a solid foundation that can grow into the full complex system while keeping the initial implementation simple and fast to develop.
