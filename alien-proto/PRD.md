# Alien in the Machine: Product Requirements Document (PRD)

**Version:** 1.0  
**Date:** September 25, 2025  
**Author:** Kilo Code (Architect Mode)  
**Status:** Draft for Review  

This PRD outlines a new iteration of *Alien in the Machine*, a turn-based sci-fi command simulation. Drawing lessons from prior prototypes—such as AI autonomy, event-driven state management, unified decision pipelines, and avoiding UI-first development traps—this version starts fresh. It focuses on the commander's experience leading AI marine agents through emergent, narrative-driven missions in a hostile space station. The game emphasizes indirect control, limited information, and world state changes that create tension and stories.

The design prioritizes simplicity for an MVP: a single mission with 6 zones, limited agent actions, and SvelteKit-based implementation using OpenRouter for AI. No baggage from prior versions (e.g., complex ECS or Python backends) is carried forward; instead, we build a standalone prototype testable in 15-25 turns.

**Estimated Length:** ~12 pages (this document). Success Metrics: Prototype achieves mission completion with emergent narratives (e.g., agent panic leading to vial loss) in simulated playthroughs; commander feels tension via message streams without micromanagement.

---

## 1. Executive Summary & Vision

### 1.1 Project Overview
*Alien in the Machine* is a single-player command simulation where the player acts as a Colonial Marine Commander overseeing AI agents on a dangerous mission aboard an abandoned space station. Inspired by Alien RPG's tension of isolation and unknown threats, the game creates emergent stories through AI-driven actions that alter a shared world state. The commander issues high-level messages via radio, but agents act autonomously—potentially ignoring orders due to stress, personality, or context—leading to dramatic, unpredictable outcomes.

**Core Vision:**  
The player experiences the weight of command: sending brave (but fallible) AI marines into darkness, receiving fragmented reports, and making critical decisions with incomplete information. Unlike tactical squad games, direct control is limited; success emerges from smart guidance, not pixel-perfect moves. The 1980s futuristic terminal UI evokes retro sci-fi (e.g., *Aliens* command consoles), with a simple map showing agent dots and room outlines.

**Key Differentiators:**  
- **Emergent Narrative:** World state is the "truth"—e.g., searching a cabinet empties it for future agents, creating chain reactions (e.g., alien ambush in an unguarded room).  
- **AI Autonomy with Memory:** Agents maintain personal memory streams (recent events, commander messages) for contextual decisions, powered by LLMs but constrained to 6-8 limited actions.  
- **Director & Antagonist Agents:** A "director" AI subtly adjusts world state (e.g., spawning hazards), while an alien agent introduces asymmetric threats (sneak/attack).  
- **Turn-Based Tension:** Commander sends 1 message per turn, then advances; agents act in sequence, updating the world and reports.

**Target Audience:** Indie game enthusiasts, sci-fi RPG fans (Alien universe), AI simulation tinkerers. Playtime: 15-30 minutes per mission for MVP.

### 1.2 Business Goals
- **MVP Deliverable:** Functional prototype in SvelteKit, runnable locally, demonstrating 1 full mission with AI-driven emergence.  
- **Success Metrics:**  
  - 80% of simulated missions complete in 15-25 turns with vial retrieval + ≥2 survivors.  
  - Emergent stories in ≥50% of playthroughs (e.g., agent discovers empty cabinet, leading to detour and alien encounter).  
  - LLM response time <5s per agent turn; token usage <2000 per prompt.  
  - User feedback: Commander feels "helpless yet impactful" (post-play survey).  
- **Future Potential:** Expand to campaigns, moddable missions, multiplayer commanders.

### 1.3 Scope & Assumptions
- **In Scope:** Single mission, 3-4 marine agents + director + 1 alien, basic UI, LLM integration via OpenRouter.  
- **Out of Scope:** Multi-mission campaigns, complex graphics/audio, mobile support, persistent saves (MVP uses session state).  
- **Assumptions:** OpenRouter API access; local dev environment with Node.js; focus on JS for simplicity (no backend).

---

## 2. Game Overview

### 2.1 Core Loop
The game follows a strict turn-based loop emphasizing commander oversight:

1. **Commander Phase:** View map (dots for agents/alien, room shapes), read message stream (agent reports, world events). Send 1 radio message (e.g., "Hudson, search storage for clues"). Click "Next Turn."  
2. **Agent Phase:** World state updates—director agent adjusts (e.g., flickering lights), alien acts (sneak/attack), marines take turns (prompted with memory stream + message). Actions change world (e.g., search empties cabinet).  
3. **Report Phase:** New messages populate stream (e.g., "Cabinet empty—nothing here, Sarge."). Map updates (e.g., agent moves). Check win/lose.  
4. **Repeat:** Until mission ends (vial retrieved/extracted or failure).

This loop tests commander strategy: Messages guide but don't control; poor phrasing or ignored orders lead to failure.

### 2.2 Mission Structure
**Objective:** Retrieve the "Vial of Yellow Blood" from Medbay and extract ≥2 marines to Shuttle. Fail if all marines die or 30 turns elapse (station self-destruct).

**Zones (6 Total, Linear with Branches):**  
- **Shuttle (Start/End):** Safe hub. Agents gear up (health kits, weapons), strap in to end mission.  
- **Shuttle Bay:** Transition zone; potential alien ambush point.  
- **Corridor:** Branch point—leads to Storage or Command Room.  
- **Storage Room:** Contains supplies; alien starts hidden here (sneak mechanic hides dot on map).  
- **Command Room:** Console to hack/unlock Medbay (technical action).  
- **Medbay (Goal):** Locked door (hack/break/open via console). Vial inside—must be picked up and carried back.

**Emergence Example:** Marine searches Storage (empties cabinet, reveals clue), but disturbs alien (sneak fails, triggers attack). Commander messages "Fall back!"—agent complies or panics based on stress.

**Win/Lose Conditions:**  
- **Win:** Vial returned to Shuttle + ≥2 survivors (reward: mission log summary).  
- **Lose:** All marines dead, vial lost, or timeout (e.g., "Station integrity failing"). Partial success for vial without survivors.

**Duration:** 15-25 turns for balanced play; adjustable via director agent.

---

## 3. Mechanics

### 3.1 Actions (Limited Set for AI Predictability)
Agents (marines, alien, director) choose from 6-8 actions per turn, with clear world effects. Actions cost 1 turn; success based on simple modifiers (e.g., skill + context). World state tracks changes (e.g., item states: full/empty).

**Marine Actions (Core 6):**  
| Action | Description | World Effect | Cost/Requirements |  
|--------|-------------|--------------|-------------------|  
| Move | Travel to adjacent zone. | Update position; may trigger events (e.g., door noise). | None; reveals on map. |  
| Search | Examine container/object. | Reveals/discovers items; marks as "searched" (e.g., cabinet empty next time). | Observation skill; 50% chance for hidden clues. |  
| Interact | Use object (e.g., hack console, pick up vial). | Changes state (e.g., door unlocks, item inventory added/removed). | Technical skill; vial pickup succeeds 80%. |  
| Attack | Combat in current zone. | Damages target (alien/marine); reduces health. | Combat skill; weapons add +1 damage. |  
| Take Cover | Hide/reduce detection. | Lowers alien sneak success; increases defense. | Agility skill. |  
| Report | Send message to commander. | Adds to stream (e.g., "Vial secured!"). | None; builds context. |  

**Panic Actions (If Stress >7):** Freeze (skip turn), Flee (random move), Fight (auto-attack).  

**Alien Actions (Asymmetric 4):**  
- Sneak: Hide dot on map; move undetected.  
- Attack: Damage marine in zone; reveal position.  
- Stalk: Follow agent without engaging.  
- Ambush: High-damage surprise in next zone.  

**Director Actions (World Control, 3-4):**  
- Adjust Hazard: e.g., Lock random door, spawn noise event.  
- Escalate: Increase alien aggression after X turns.  
- Narrative Nudge: Add environmental event (e.g., "Lights flicker—visibility reduced").  

**Suggested Addition (Gap Address):** Agent Personalities—e.g., Aggressive (prefers Attack, 70% compliance), Cautious (prefers Search/Cover, 90% compliance). Assign 1-2 traits per marine for variety.

### 3.2 Zones & World State
World state is an event log: Every action appends an event (e.g., `{type: 'search', actor: 'hudson', target: 'cabinet', result: 'empty'}`). State derives from log (e.g., cabinet.isEmpty = true).

Zones have properties: Connections, Items (stateful), Hazards. Map shows basic shapes/dots; commander can't see alien if sneaking.

### 3.3 Stress & Health
- **Stress (0-10):** +1 per combat/failure; >5: -10% action success; >7: Panic roll (30% chance). Resets on rest in Shuttle.  
- **Health:** Starts at 10; damage from attacks (1-3). 0 = dead (mission impact).  

**Win/Lose (Suggested Gap):** Win: Vial in Shuttle + ≥2 survivors; lose on all dead/timeout. Partial: Vial lost but intel gained (unlocks future missions).

---

## 4. AI & Agents

### 4.1 Agent Types
- **Marine Agents (3-4):** Autonomous, with personal memory. Prompt: "You are [Name], [Personality]. Recent events: [Log snippet]. Commander said: [Message]. Choose 1 action." Constrained to marine actions; output JSON `{action, target, reasoning}`.  
- **Alien Agent:** Hostile; prompt emphasizes stealth/threat. Limited visibility (only current zone).  
- **Director Agent:** Oversees fairness; prompt: "Maintain tension—escalate if too easy." Subtle changes only (no direct kills).  

### 4.2 Memory & Context
- **Personal Memory Stream:** Per-agent event log (last 20-50 events, pruned for tokens). Includes: Personal history, squad reports, commander messages.  
- **Local Context:** Current zone state + visible agents/items. E.g., Post-search: "Cabinet: Empty (previously full)."  
- **Shared Elements:** Squad-wide events (e.g., "Door unlocked"); commander messages appended to all marine prompts.  

**LLM Integration:** OpenRouter (e.g., Claude/GPT-4o-mini). Prompts use templates for consistency:  
```
You are {agent}, {role}. Stress: {stress}/10. Zone: {zone}. Visible: {items/agents}.
Recent Memory: {stream}.
Commander: {message}.
Choose ONE action: {action list with effects}.
Respond JSON: {"action": "Search", "target": "cabinet", "reasoning": "..."}
```

**Fallbacks (Suggested Gap):** If LLM invalid (e.g., non-existent action), default to "Wait/Report" with rule-based choice (e.g., lowest stress action).

### 4.3 Emergence & Testing
AI choices + world changes create stories: E.g., Cautious marine searches (empties cabinet), aggressive follows (triggers alien). Test: Simulate 20 missions; measure narrative variety (e.g., % with panic detour).

---

## 5. Architecture

### 5.1 World State & Events
Event-driven: Central log array `{id, tick, type, actor, details}`. State queries log (e.g., getZoneState(zoneId) filters recent events). Changes immutable—append only for auditability.

**Turn Architecture:**  
- Commander turn: Message → Append to log.  
- Agent turns: Sequence (director → alien → marines by speed). Each: Assemble context → LLM → Validate → Append event.  
- Parallelism: Marines in same zone act sequentially; alien independent.

### 5.2 Message Streams
- **Radio Stream:** Global log of messages (commander → agents, agent reports → commander). Filtered per agent (e.g., marines see squad-only).  
- **Management:** Prune to last 10 exchanges/turn; summarize old (e.g., "Previous orders: Proceed to Medbay"). Stored in Svelte store for reactivity.

**Mermaid: Turn Flow** (see Appendix).

### 5.3 Data Flow
World → Event Log → Context Assembly → LLM → Validation → World Update → UI Reactivity.

---

## 6. UX/Commander Interface

### 6.1 Terminal UI (1980s Futuristic)
- **Layout:** Left: Simple map (SVG rooms/shapes, colored dots: green=marine, red=alien if visible, ? = unknown). Center: Message stream (scrolling log with timestamps/senders). Right: Agent status (health/stress/personality). Bottom: Input (message box + "Next Turn" button).  
- **Style:** Green monochrome text, scan lines, beeps for new messages. Click map to target messages (e.g., "Hudson in Storage: Search there").  

### 6.2 Interactions
- **Message Sending:** Text input, 1/turn; AI parses intent (e.g., "Search medbay" → boosts search priority).  
- **Overrides:** Rare button (e.g., force Move); adds +2 stress.  
- **Feedback:** Real-time map updates, message animations. No omniscience—rely on reports for details.

**Accessibility:** Keyboard nav, high-contrast mode.

---

## 7. Technical Stack

- **Frontend:** SvelteKit (JS/TS) for reactive UI, stores for world/message state. Vite for dev server.  
- **AI:** OpenRouter API for all agents (models: GPT-4o-mini for speed, Claude for narrative). JSON mode enforced.  
- **State Management:** In-memory event log (array in store); no DB for MVP.  
- **Tools:** ESLint/Prettier for code quality; Mermaid for docs.  
- **Deployment:** Static build to Vercel/Netlify; local run via `npm run dev`.  
- **Dependencies:** Minimal—SvelteKit, OpenRouter SDK, no heavy libs.

**Why JS/SvelteKit:** Fast prototyping, reactive updates for turns/map, easy LLM integration. Avoids backend for MVP simplicity.

---

## 8. Roadmap & MVP Milestones

### 8.1 MVP Definition
Functional prototype: 1 mission, 3 marines + director + alien, full loop, emergent play.

**Milestones (4-6 Weeks):**  
1. **Week 1: Core Architecture (AI-First)** – Event log, world state, basic agent prompts (no UI). Test: Autonomous mission sim.  
2. **Week 2: Mechanics & Agents** – Implement 6 actions, zones, memory streams. Test: 10 sims with emergence.  
3. **Week 3: Commander UX** – Terminal UI, map, messages. Test: Manual playthroughs.  
4. **Week 4: Integration & Polish** – LLM fallbacks, director/alien, win/lose. Test: User sims (15-25 turns).  
5. **Week 5-6 (Optional):** Audio cues, personality traits, basic analytics.

**Post-MVP:** Campaigns, mod support, advanced LLMs.

---

## 9. Risks & Mitigations

- **LLM Inconsistency:** Invalid actions/responses. *Mitigation:* Strict JSON schema, rule-based fallbacks (e.g., random valid action).  
- **Token Limits/Emergence:** Long memory bloats prompts, reduces story quality. *Mitigation:* Prune to 50 events; summarize (e.g., "Last 5 turns: 2 searches, 1 attack").  
- **Pacing Issues:** Turns too slow/fast. *Mitigation:* Parallel agent actions; configurable speeds.  
- **Tech Risks:** OpenRouter downtime. *Mitigation:* Mock LLM mode for dev.  
- **Gaps Addressed:**  
  - **Personalities:** Add traits (Aggressive/Cautious) to prompts for variety.  
  - **Win Conditions:** Vial + ≥2 survivors; lose on all dead/timeout.  
  - **Fallbacks:** If LLM fails 3x, switch to scripted AI.  
  - **Coordination:** Shared squad stream for marines (e.g., "Hudson found clue—follow up").

**Overall Risk Level:** Medium—AI focus is innovative but testable via sims.

---

## 10. Appendix

### 10.1 Mermaid Diagrams

**Zone Layout:**  
```mermaid
graph TD
    A[Shuttle<br/>Health kits, weapons, beds<br/>Start/End point] --> B[Shuttle Bay]
    B --> C[Corridor]
    C --> D[Storage Room<br/>Alien starts here]
    C --> E[Command Room<br/>Console to unlock Medbay]
    E --> F[Medbay<br/>Locked door<br/>Vial of yellow blood]
    style A fill:#90EE90
    style F fill:#FFB6C1
    style D fill:#FFE4B5
```

**Turn Flow:**  
```mermaid
sequenceDiagram
    participant C as Commander
    participant W as World State
    participant A as AI Agents
    participant D as Director Agent
    participant AL as Alien Agent
    C->>W: Send message (1 per turn)
    C->>W: Click Next Turn
    W->>A: Assemble context (memory stream + recent events)
    W->>D: Director prompt (world adjustments)
    W->>AL: Alien prompt (stealth/attack)
    A->>W: Select action from limited moves (e.g., search, move)
    D->>W: Update world (e.g., spawn hazard)
    AL->>W: Perform action (e.g., sneak, attack)
    W->>W: Apply changes (e.g., cabinet empty after search)
    W->>C: Generate reports (messages from agents)
    Note over C,A: Loop until mission complete
```

**Agent Context Pipeline:**  
```mermaid
flowchart LR
    WS[World State<br/>Zones, Items, Entities] --> EL[Event Log<br/>All changes as events]
    EL --> MS[Memory Stream<br/>Per-agent history, pruned to 50-100 ticks]
    MS --> AP[Prompt Assembly<br/>Templates + recent events + commander messages]
    AP --> LLM[OpenRouter LLM<br/>Select action from limited moves]
    LLM --> VP[Validation/Parse<br/>Ensure valid action, fallback if invalid]
    VP --> WS
    MS -.->> Prune[Prune old events<br/>Token limit management]
```

**Commander-AI Interaction:**  
```mermaid
sequenceDiagram
    participant C as Commander
    participant R as Radio/Messages
    participant M as Marine Agents
    participant Dir as Director
    participant AL as Alien
    C->>R: Send message (e.g., "Search medbay")
    R->>M: Include in next context
    Note over M: Agents act autonomously, may comply based on stress/personality
    M->>R: Report back (e.g., "Cabinet empty, found vial")
    Dir->>R: World events (e.g., "Door unlocked")
    AL->>R: Indirect via world changes (e.g., attack triggers event)
    C->>M: Optional override (adds stress)
    R->>C: Stream of messages for context
```

### 10.2 Action Tables
(See Section 3.1 for full table; example JSON for world state:  
```json
{
  "zones": {
    "storage": {
      "items": {"cabinet": {"state": "empty", "lastSearchedBy": "hudson"}}
    }
  },
  "events": [{"tick": 5, "type": "search", "result": "empty"}]
}
```

---

This PRD draft synthesizes the vision into an actionable blueprint. It incorporates lessons from prototypes (e.g., event logging for memory) while addressing gaps as suggestions. Total: ~12 pages equivalent.