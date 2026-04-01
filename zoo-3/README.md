# Zoo-3 — First LLM Agent

## What This Zoo Is

Zoo-1 proved that pure action functions work as reliable state transitions. Zoo-2 added zones, borders, doors, cross-zone visibility, and a structured description layer. Zoo-3 closes the loop: an LLM takes control of the agent, choosing actions from the description and action list that Zoo-2 produces.

**The question:** Given a well-formed room description and a list of valid actions, does an LLM make reasonable choices toward a goal?

**What we build:**
- An LLM adapter that calls OpenRouter's API (lets us switch models easily)
- A prompt builder that assembles system instructions + zone description + action list + goal
- A game loop: describe → prompt → LLM → parse response → execute action → repeat
- A React UI showing the world map, zone description, LLM reasoning, chosen action, and turn log
- Full logging of every turn for later analysis

**What we reuse from Zoo-2:** All world logic — types, actions, scope, describe, available-actions, and the lab-world definition. Zoo-2 code is treated as a library; we don't modify it.

---

## World: Same as Zoo-2

```
Laboratory ─[north_door: door, locked]─ Maintenance Corridor ─[open]─ Storage Bay
```

**Goal given to the LLM:** "Find the keycard, unlock the security door, and escape through it to the corridor."

---

## Stages

### Stage 1 — Bring Zoo-2 Code Into Zoo-3
- Copy zoo-2's `src/types/`, `src/world/`, `src/actions/`, and `src/worlds/` into zoo-3
- Verify all 58 tests pass unchanged
- No modifications to zoo-2 code — it's a frozen dependency
- **Learning checkpoint:** Review each copied file. Can you explain what `computeScope` returns? What does `describeZone` output look like? If not, revisit zoo-2's docs before proceeding.

### Stage 2 — LLM Adapter (OpenRouter)
- Create `src/agent/llm-adapter.ts`
- Single function: `callLLM(messages, model, apiKey) → Promise<string>`
- Calls `POST https://openrouter.ai/api/v1/chat/completions`
- Supports model switching (we'll start with 2–3 models to compare)
- API key: read from env or entered in UI
- **Learning checkpoint:** Understand the OpenRouter API request/response shape. What does a typical response look like? How do we handle errors (rate limit, bad key, model unavailable)?

### Stage 3 — Prompt Builder
- Create `src/agent/prompt-builder.ts`
- Assembles the full prompt from:
  - System instructions (role, goal, response format rules)
  - Zone description from `describeZone(state, agentId)`
  - Action list from `listAvailableActions(state, agentId)`
  - Recent turn history (last N turns)
- **Key decision:** Response format. We'll start with numbered action selection (e.g., "3" to pick action #3) plus a short reasoning line. This is simpler and more reliable than JSON parsing. If the action list grows large, we'll revisit (grouped menus, categorized actions, etc.).
- **Learning checkpoint:** Read the assembled prompt as a human would. Does it give enough context? Is the response format unambiguous?

### Stage 4 — Game Loop
- Create `src/agent/game-loop.ts`
- Orchestrates one turn:
  1. Generate description + action list from current state
  2. Build prompt
  3. Call LLM
  4. Parse response → extract action choice
  5. Execute action via zoo-2 action functions
  6. Log the result (success or failure message)
  7. Increment turn
- **Error recovery:** If the LLM picks an invalid action (bad parse or out-of-range index), feed the error message back as the next turn's context so it can correct itself.
- **Learning checkpoint:** Trace one full turn by hand. State → description → prompt → LLM response → action → new state. Every step should be clear.

### Stage 5 — React UI
- Reuse zoo-2's layout pattern: zone description as primary view, world map above it
- Add LLM agent panel:
  - Model selector dropdown
  - Current prompt preview (collapsible)
  - LLM reasoning output
  - Chosen action and result
  - Step button (one turn) and Auto-play toggle
- Debug panels (collapsible): full world state, scope result, action log
- **Learning checkpoint:** The UI is a window into the game loop. Every piece of displayed data should trace back to a function you understand.

### Stage 6 — Logging & Observation
- Every turn recorded: prompt sent, LLM response, action chosen, action result, state diff
- Scrollable log panel in UI
- Export log as JSON for later analysis
- **What we're measuring:** Does the LLM pick sensible actions? How often does it fail to parse? Does it get stuck in loops? How many turns to complete the goal?

---

## Key Design Decisions

**Numbered action selection over JSON.** The LLM responds with an action number (e.g., "3") plus optional reasoning. This is simpler and more reliable across models, especially cheaper ones. If the action list grows too large, we'll revisit with grouped menus or categorized actions.

**Error feedback loop.** When the LLM makes an invalid choice, the error message goes back into the next prompt. This lets the agent self-correct rather than silently skipping turns.

**Frozen zoo-2 code.** We copy zoo-2's code but don't modify it. Each zoo is its own self-contained module. If we discover zoo-2 needs a change, we make it in zoo-2 first, then re-copy. This keeps the boundary clean.

**OpenRouter for model flexibility.** One API, many models. We can compare Claude, GPT, and cheaper models without changing code — just a dropdown selection.

---

## Running

```sh
bun install
bun test       # verify zoo-2 tests still pass
bun run dev    # UI with LLM agent
```

---

## What Success Looks Like

- The LLM agent completes the goal (find keycard → unlock door → escape) without human intervention
- We can switch models and observe different behaviors
- Every turn is logged and inspectable
- You can explain every part of the system: how the prompt is built, how the response is parsed, how actions are executed, how state flows through the loop
