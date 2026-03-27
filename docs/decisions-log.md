# Decisions Log

Append-only. Each entry records something that changed understanding — a surprise, a failure, a fork in the road. Not routine progress.

---

## 2026-03-27 — Zoo 1 — Two-part location system

**Context:** Implementing `take` and noticing that moving an item requires updating two places: the entity's `locationId` and the `containment` map.
**What happened:** The glizzy was added to world data with `locationId: 'hallway'` but `containment.lab` listed it. After taking and dropping, it reappeared in the lab because `drop` used `locationId` to find the old parent but `containment` was wrong.
**Resolution:** The invariant is explicit: `entity.locationId` and `containment[parentId]` must always agree. Every action that moves an entity must update both.
**Implications:** Any future `moveEntity` helper must enforce both writes as a unit. Any world data file must be audited for consistency before use.

---

## 2026-03-27 — Zoo 1 — Agent location is not always a room

**Context:** Implementing `hideIn` — the agent's `locationId` changes from a room ID to a container ID.
**What happened:** `App.tsx` crashed when trying `state.entities.rooms[agent.locationId]` after hiding, because `agent.locationId` was now `'closet'`, not a room. The room lookup returned `undefined` and the render exploded.
**Resolution:** `App.tsx` checks `agent.isHidden && container` first and renders a separate "inside container" view. The normal room view only runs when the agent is in a room.
**Implications:** Any code that assumes `agent.locationId` is a room ID will break when the agent is hidden. Functions that need "which room is the agent in?" must follow one extra hop: `container.locationId` when `agent.isHidden` is true.

---

## 2026-03-27 — Zoo 1 — No action registry implemented

**Context:** The zoo plan (section 3.3) described a central action registry mapping action names to their implementations and argument schemas.
**What happened:** The registry was skipped in favor of direct imports and a manual dispatch chain in `use-actions.ts` and `available-actions.ts`. This was faster to build and sufficient for seven actions.
**Resolution:** Kept the direct approach for Zoo 1. The registry would reduce the surface area of "places you update when adding an action" (currently: the action file, the barrel export, `use-actions.ts`, and `available-actions.ts`).
**Implications:** Before Zoo 3's LLM adapter needs to enumerate actions, decide if a registry is worth adding. The LLM needs action descriptions, not just labels — this may force the issue.

---

## 2026-03-27 — Zoo 1 — TypeScript union type sorting requires explicit array types

**Context:** Sorting `roomContents` into separate arrays for things, supporters, and containers in `App.tsx`.
**What happened:** Typing the arrays as `Entity[]` let everything push in, but then accessing `.isOpen` on a container caused a TypeScript error because `Entity` doesn't guarantee that property.
**Resolution:** Type the arrays specifically: `Container[]`, `Supporter[]`, `Thing[]`. TypeScript then narrows correctly after the `entity.kind` check.
**Implications:** Any future place that sorts entities by kind must use specific array types, not `Entity[]`.
