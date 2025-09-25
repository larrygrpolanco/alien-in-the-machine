Here is the comprehensive, multi-phase development plan to be provided to an AI coding agent. This plan is designed to be executed sequentially, ensuring each component is built and tested on a solid foundation.

---

### **Definitive Plan: "Alien in the Machine" - Medbay Escape Prototype v1.0**

#### **1. Guiding Principles (Based on Your Feedback)**

*   **Platform:** A simple web-based "Radio Log" UI (SvelteKit) powered by a robust backend server (Python/FastAPI). The focus is on displaying a stream of game events and accepting simple text commands.
*   **Core Mechanic:** A "Simple Threshold" system. The Director AI will determine a task's difficulty and resolve the outcome based on a comparison with the character's relevant stats. No dice rolls for this prototype.
*   **Director's Role:** A "Creative Storyteller." The Director is not a rigid rule-follower. It has the creative authority to interpret actions, resolve them, narrate them in an engaging way, and introduce minor complications or narrative flourishes by modifying the JSON state beyond the immediate action.
*   **Player Agency:** "Commands are Suggestions." The player's input is a piece of context for the AI Actor, who will weigh it against their own personality and agenda. This allows for emergent, character-driven behavior.

#### **2. System Architecture**

*   **Backend (The "Engine Room"):** A Python application using **FastAPI** for the API and **LangGraph** to manage the game's stateful, multi-step turn cycle. It will manage the "Living World" as a directory of JSON files.
*   **Frontend (The "Radio Log"):** A lightweight SvelteKit application. Its *only* job is to render a log of events provided by the backend and send the Commander's commands to the server. It contains no game logic.

---

### **Phased Development Roadmap**

This roadmap is broken into distinct, actionable phases. The AI coder will complete each phase in order.

### **Phase 0: Project Setup & Foundational Schemas**

**Goal:** Establish a clean project structure, install all dependencies, and create the rigid data schemas that will define our "Living World" JSON. This phase is about building the foundation.

**AI Coder Instructions:**

1.  **Create the Project Directory Structure:**
    ```bash
    /alien-in-the-machine /
    ├── backend/
    │   ├── app/
    │   │   ├── __init__.py
    │   │   ├── main.py             # FastAPI App
    │   │   ├── schemas.py          # Pydantic Data Models
    │   │   ├── data/               # Directory for game state files
    │   │   │   ├── character_miller.json
    │   │   │   └── zone_medbay_b.json
    │   │   ├── prompts/
    │   │   │   ├── actor_v1.txt                   # Actor AI prompt (direct edit)
    │   │   │   └── director_v1.txt                # Director AI prompt (direct edit)
    │   │   ├── engine/
    │   │   │   ├── __init__.py
    │   │   │   ├── actor_agent.py
    │   │   │   └── director_agent.py
    │   │   └── game_manager.py     # Game Loop Controller
    │   └── requirements.txt
    ├── frontend/                   # SvelteKit Project
    ```

2.  **Setup Backend Dependencies:**
    *   Create a Python virtual environment inside `/backend`.
    *   Create a `requirements.txt` file with the following content:
        ```
        fastapi
        uvicorn[standard]
        pydantic
        python-dotenv
        langchain
        langchain-openai
        langgraph
        ```
    *   Install these dependencies.

3.  **Define Core Data Schemas (`backend/app/schemas.py`):**
    *   Using Pydantic's `BaseModel`, create Python classes that mirror the structure of your JSON files. This is critical for data validation and preventing errors.
    *   **`character_schema.py`**
        ```python
        from pydantic import BaseModel
        from typing import List, Dict

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
        ```
    *   **`zone_schema.py`**
        ```python
        from pydantic import BaseModel
        from typing import Dict

        class Exit(BaseModel):
            to: str
            status: str
            panel: str
            # This allows for emergent properties from the Storyteller Director
            extra_properties: Dict[str, str] = {}

        class Zone(BaseModel):
            name: str
            description: str
            exits: Dict[str, Exit]
        ```

4.  **Create Initial State Files (`backend/app/data/`):**
    *   Create the initial JSON files based on the schemas.
    *   **`character_miller.json`:**
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
    *   **`zone_medbay_b.json`:**
        ```json
        {
          "name": "Medbay B",
          "description": "A sterile, white room. An emergency light flickers. The air smells of antiseptic.",
          "exits": {
            "north_door": {
              "to": "corridor_3",
              "status": "locked",
              "panel": "smashed"
            }
          }
        }
        ```

5.  **Setup Frontend Boilerplate:**
    *   Inside the `/frontend` directory, initialize a new SvelteKit project (use the "skeleton project" option).

**Success Criteria:** The project structure exists, all dependencies are installed, and the initial JSON data files are created and validated by the Pydantic schemas.

---

### **Phase 1: Building the Agentic Core (Backend Only)**

**Goal:** Implement the complete AI logic for both the Actor and the Director. We will test this with a simple, direct Python script, completely isolated from the web server, to ensure the core loop works perfectly.

**AI Coder Instructions:**

1.  **Create the AI Actor (`backend/app/engine/actor_agent.py`):**
    *   Define a function `get_actor_intent(character_data: Character, zone_data: Zone, commander_suggestion: str) -> dict`.
    *   Inside this function, create a detailed prompt template. This prompt is critical and must incorporate your feedback:
        *   "You are {character_name}. Your personality is driven by your agenda: '{agenda}'.
        *   You are in {zone_name}, which is {zone_description}.
        *   Your current status is: {character_status}.
        *   The Commander has just made a suggestion: '{commander_suggestion}'.
        *   Based on your agenda and the situation, decide on your action. Your agenda is your primary driver. The Commander's suggestion is secondary.
        *   Return a JSON object with your 'thoughts', 'speech', and 'action_intent' (including 'verb', 'target', and 'rationale')."
    *   Use a LangChain chain with an OpenAI model configured for JSON output to execute this prompt.

2.  **Create the Director Agent (`backend/app/engine/director_agent.py`):**
    *   This will be a **LangGraph** graph. Define a state dictionary for the graph, e.g., `DirectorState(TypedDict)`.
    *   **Node 1: `interpret_action`:**
        *   Input: The `action_intent` from the Actor.
        *   Action: Calls an LLM to analyze the intent.
        *   Output: Classifies the action. Based on your feedback, it should determine if a skill check is needed and its difficulty. Example output: `{"requires_check": true, "skill": "WITS+comtech", "difficulty": 2}`. Most simple tasks should have a difficulty of 0 or 1.
    *   **Node 2: `resolve_action`:**
        *   Input: The classification from the previous node.
        *   Action: Implements the "Simple Threshold" mechanic. It compares `character_stats` (e.g., wits + comtech = 3) to the `difficulty` (e.g., 2).
        *   Output: A result, e.g., `{"outcome": "success"}` or `{"outcome": "failure"}`.
    *   **Node 3: `narrate_and_update`:**
        *   Input: The `outcome` and original `action_intent`.
        *   Action: This is the "Creative Storyteller" node. It calls an LLM with a prompt that encourages creative freedom.
        *   Prompt Example: "The character Miller attempted to REPAIR the door_control_panel_north. The result was a SUCCESS. Your task is to act as a creative storyteller.
            1.  Write a short, descriptive narration of this event for the 'helmet_cam_feed'.
            2.  Generate the precise JSON patch needed to update the world state. You have the freedom to add emergent details. For example, a success might not just unlock the door, but also make the panel spark, or a failure might increase the character's stress."
        *   Output: A dictionary containing the narration and the JSON patch to be applied, e.g., `{"narration": "Sparks fly...", "state_update": {"zone_medbay_b.json": {"exits.north_door.status": "unlocked", "exits.north_door.extra_properties.panel_condition": "sparking"}}}`.
    *   **Compile the Graph:** Wire these nodes together in a `StateGraph`. The `resolve_action` node will be conditionally branched based on whether a check is required.

**Success Criteria:** You can run a Python script that manually loads the JSON, calls `get_actor_intent`, passes the result to the compiled `Director_Agent` graph, and prints a final narration and a valid JSON state update to the console.

---

### **Phase 2: Building the API and Game Loop**

**Goal:** Wrap the agentic core in a FastAPI server. This involves managing the game state and exposing endpoints for the frontend to interact with.

**AI Coder Instructions:**

1.  **Create the State Manager (`backend/app/game_manager.py`):**
    *   Create a `GameManager` class.
    *   On initialization (`__init__`), it should load all files from the `/data` directory into a dictionary of Pydantic objects (e.g., `self.world_state`).
    *   Implement a method `apply_update(patch: dict)` that intelligently updates the in-memory `world_state` and saves the changed object back to its corresponding JSON file.
    *   Implement a method `get_log_state()` which will be crucial for the frontend. It should return a dictionary containing not just the raw state, but a formatted log of events for the current turn.

2.  **Define the Turn Log Schema (`backend/app/schemas.py`):**
    *   Update your schemas to include a model for the data structure the Radio Log will consume.
        ```python
        from enum import Enum

        class MessageType(str, Enum):
            SYSTEM = "system"
            COMMANDER = "commander"
            AI_THOUGHTS = "ai_thoughts" # For debug
            AI_DIALOGUE = "ai_dialogue"
            AI_ACTION = "ai_action"   # The narration

        class LogEntry(BaseModel):
            turn: int
            type: MessageType
            content: str
            author: str # e.g., "System", "Commander", "Miller"

        class GameLogState(BaseModel):
            log: List[LogEntry]
            # Include other relevant states for UI if needed
            character_statuses: List[CharacterStatus]
        ```

3.  **Implement the Game Loop in `GameManager`:**
    *   Create a method `advance_turn(commander_command: str)`.
    *   This method orchestrates the full loop:
        a. Log the commander's command as a `LogEntry`.
        b. Get the current actor (e.g., Miller).
        c. Call the `actor_agent.get_actor_intent()`.
        d. Log the actor's `thoughts` and `speech` as `LogEntry`s.
        e. Call the `director_agent.run_director()` with the intent.
        f. Log the director's `narration` as an `AI_ACTION` `LogEntry`.
        g. Use the `apply_update()` method to save the state changes.
        h. Return the complete list of `LogEntry` objects for this turn.

4.  **Create API Endpoints (`backend/app/main.py`):**
    *   Instantiate the `GameManager` as a global object.
    *   **`GET /api/state`**: Returns the initial state of the game log, formatted as `GameLogState`.
    *   **`POST /api/turn`**:
        *   Accepts a JSON body, e.g., `{"command": "Fix the door."}`.
        *   Calls `GameManager.advance_turn()` with the command.
        *   Returns the new `GameLogState` containing the log of events for the turn that just occurred.

**Success Criteria:** The FastAPI server runs. You can use a tool like Postman or `curl` to send a command to `POST /api/turn` and receive a structured JSON response containing a list of log entries for that turn. The underlying JSON files in the `/data` directory should be correctly updated.

---

### **Finalized Frontend Development Plan: Phase 3 (SvelteKit & TypeScript)**

**Goal:** To create a reactive, single-page web application that serves as the player's "Radio Log." It will be a "dumb client" that fetches game state from the backend, displays it in a styled log according to user-controlled filters, and sends the player's command to the server to trigger the next turn.

**Guiding Principles:**

*   **Backend is the Source of Truth:** The frontend holds no game logic. It renders the `GameLogState` object provided by the backend.
*   **Minimalist MVP:** The scope is strictly limited to the core features: displaying the log, filtering messages, and submitting commands.
*   **Smart Defaults:** The UI will default to showing gameplay-relevant information, with debug views being opt-in.
*   **Turn Progression:** The user submitting a command via the input box is the sole mechanism for advancing the game turn. An empty command submission is a valid way to simply "pass" and let the turn proceed.

---

**AI Coder Instructions:**

#### **Step 3.1: Project Scaffolding & TypeScript Setup**

1.  Inside the `/frontend` directory, ensure a SvelteKit project is initialized with TypeScript support.
2.  Create the following file structure inside `/frontend/src/lib/`:
    ```
    /lib
    ├── api.ts              # Functions for backend communication
    ├── store.ts              # Svelte stores for managing state
    ├── types.ts              # TypeScript type definitions for API objects
    └── components/
        ├── RadioLog.svelte     # The main container for the log view
        ├── LogEntry.svelte     # Component for a single message
        └── CommandInput.svelte # The text input and submit button
    ```

#### **Step 3.2: Defining Shared TypeScript Types (`types.ts`)**

1.  Create TypeScript types that are an exact match for the backend's Pydantic schemas. This is critical for type safety.
    ```typescript
    // This enum MUST match the 'MessageType' enum in the backend's schemas.py
    export enum MessageType {
      SYSTEM = "system",
      COMMANDER = "commander",
      AI_THOUGHTS = "ai_thoughts",
      AI_DIALOGUE = "ai_dialogue",
      AI_ACTION = "ai_action",
    }

    export interface LogEntry {
      turn: number;
      type: MessageType;
      content: string;
      author: string; // e.g., "System", "Commander", "Miller"
    }

    // This interface MUST match the backend's GameLogState response
    export interface GameLogState {
      log: LogEntry[];
    }
    ```

#### **Step 3.3: API Integration Layer (`api.ts`)**

1.  Implement two clean, strongly-typed functions to handle all communication with the FastAPI backend.
    ```typescript
    import type { GameLogState } from './types';

    const API_BASE_URL = 'http://127.0.0.1:8000'; // Or from an environment variable

    /** Fetches the initial state of the game log when the app loads. */
    export async function getInitialState(): Promise<GameLogState> {
      const response = await fetch(`${API_BASE_URL}/api/state`);
      if (!response.ok) throw new Error("Failed to fetch initial state");
      return await response.json() as GameLogState;
    }

    /** Posts the player's command to advance the turn and gets the new log entries. */
    export async function postPlayerTurn(command: string): Promise<GameLogState> {
      const response = await fetch(`${API_BASE_URL}/api/turn`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: command }),
      });
      if (!response.ok) throw new Error("Failed to post turn");
      return await response.json() as GameLogState;
    }
    ```

#### **Step 3.4: Central Svelte Stores for Reactive State (`store.ts`)**

1.  Create stores to manage the application's state.
    ```typescript
    import { writable, derived } from 'svelte/store';
    import type { LogEntry } from './types';
    import { MessageType } from './types';

    // Holds the complete, unfiltered list of all log entries
    export const fullGameLog = writable<LogEntry[]>([]);

    // Holds a Set of the currently active message types for filtering
    export const activeFilters = writable<Set<MessageType>>(new Set([
      // Default to gameplay-relevant types ON, debug types OFF
      MessageType.SYSTEM,
      MessageType.COMMANDER,
      MessageType.AI_DIALOGUE,
      MessageType.AI_ACTION,
    ]));

    // A derived store that automatically computes the filtered log whenever the
    // full log or the filters change.
    export const filteredGameLog = derived(
      [fullGameLog, activeFilters],
      ([$fullGameLog, $activeFilters]) => {
        return $fullGameLog.filter(entry => $activeFilters.has(entry.type));
      }
    );
    ```

#### **Step 3.5: Building the UI Components (`components/`)**

1.  **`LogEntry.svelte`:**
    *   **Props:** `export let entry: LogEntry;`
    *   **Logic:** Use Svelte's class directive to apply styles based on `entry.type`. For example: `<div class="message-item" class:system={entry.type === MessageType.SYSTEM} ...>`.
    *   **Styling:** Adapt the CSS from your provided example for `.message-item`, `.message-header`, and `.message-content`. Focus on matching the color-coding and layout for each message type.

2.  **`CommandInput.svelte`:**
    *   **Props:** `export let disabled: boolean = false;`
    *   **Logic:**
        *   Contains an `<input type="text">` bound to a local variable and a `<button>`. Both should be disabled when the `disabled` prop is true.
        *   Create a `handleSubmit` function that dispatches the input's value. This function should be called on button click or when "Enter" is pressed in the input field.
        *   It should dispatch the command even if the input is an empty string.
    *   **Styling:** Style as a simple, thematic input bar.

3.  **`RadioLog.svelte`:**
    *   **Props:** None. This component will get its data from the stores.
    *   **Logic:**
        *   Import `filteredGameLog` and `activeFilters` from `store.ts`.
        *   Render the list of messages using an `#each $filteredGameLog as entry` block.
        *   Implement the filter buttons. Each button's `on:click` handler will modify the `$activeFilters` Set (e.g., adding or deleting a `MessageType`). Use the `class:active` directive on the buttons to show their current state.
        *   Implement the auto-scroll toggle logic.
    *   **Styling:** Adapt the overall layout, header, filter controls, and `.message-list` CSS from your example.

#### **Step 3.6: Assembling the Main Application (`/src/routes/+page.svelte`)**

1.  This file is the final orchestrator.
    ```svelte
    <script lang="ts">
      import { onMount } from 'svelte';
      import { fullGameLog } from '$lib/store';
      import { getInitialState, postPlayerTurn } from '$lib/api';
      import RadioLog from '$lib/components/RadioLog.svelte';
      import CommandInput from '$lib/components/CommandInput.svelte';

      let isLoading = true; // Used to disable input during API calls

      // On component mount, fetch the initial game state
      onMount(async () => {
        try {
          const initialState = await getInitialState();
          $fullGameLog = initialState.log;
        } catch (error) {
          console.error("Failed to load initial state:", error);
          // Handle error display here
        } finally {
          isLoading = false;
        }
      });

      // This function handles the core game loop trigger
      async function handleCommandSubmit(event: CustomEvent<string>) {
        if (isLoading) return; // Prevent multiple submissions

        isLoading = true;
        const command = event.detail;

        try {
          const newState = await postPlayerTurn(command);
          // Append the new log entries from the turn to the existing log
          $fullGameLog = [...$fullGameLog, ...newState.log];
        } catch (error) {
          console.error("Failed to process turn:", error);
          // Handle error display here
        } finally {
          isLoading = false;
        }
      }
    </script>

    <main>
      <RadioLog />
      <CommandInput on:submit={handleCommandSubmit} disabled={isLoading} />
    </main>

    <style>
      main {
        /* Add styles for the main container, height, etc. */
      }
    </style>
    ```

---

**Success Criteria:** You can run the backend and frontend servers. The web page loads, displaying the initial game state. You can type a command, hit Enter, and see the log update with the AI's thoughts, speech, and the Director's narration of the action. The UI reactively displays the entire turn's events. The "Medbay Escape" prototype is complete and playable.
