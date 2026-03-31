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

## 2026-03-30 — Zoo 2 — Borders replace room.exits; doors are neither rooms nor containers

**Context:** Designing the zones/borders model from the ALIEN RPG research notes. The question was whether to keep `room.exits` as a cache alongside borders, or remove it entirely.
**What happened:** Keeping `exits` alongside `borders` would mean connectivity has two sources of truth — moveTo would need to decide which to consult, and world data could become inconsistent. Removing exits entirely forces all connectivity through one place.
**Resolution:** Full migration. `Room` has no `exits` field. All movement, scope, and description logic reads from `state.borders`. Borders also solve the "door as entity" problem — the Door entity lives on the border, not inside any room's containment.
**Implications:** Any code assuming `room.exits` will not compile. `moveTo` finds the border by checking `border.between.includes(roomId)`. The direction a player travels is stored in `border.direction[roomId]` — each room records how it names its side of the border.

---

## 2026-03-30 — Zoo 2 — Doors are reachable from both adjacent rooms

**Context:** Where do doors live in scope? They're not in containment (no room "owns" a door). They need to be interactable from either side.
**What happened:** `computeScope` was extended to iterate borders for the agent's current room. For any border of type `'door'`, the doorId is added to `reachable` — regardless of whether the door is open or locked. This lets the agent unlock/open/close a door without stepping through it.
**Resolution:** Doors appear in `reachable` for any agent whose current room is in `border.between`. No containment entry needed for doors.
**Implications:** `getEntity` must include the `doors` table, or door IDs in scope will return undefined. `available-actions` generates OPEN/CLOSE/UNLOCK for door entities found in reachable.

---

## 2026-03-30 — Zoo 2 — ScopeResult splits reachable from perceivable

**Context:** With cross-zone visibility, an agent may see entities in an adjacent room but not be able to pick them up or interact with them.
**What happened:** If `computeScope` returned a flat array like zoo-1, there would be no way to distinguish "can act on" from "can see through the doorway." `describeZone` needs to describe visible-but-unreachable entities; `getAvailableActions` must not generate actions for them.
**Resolution:** `computeScope` returns `ScopeResult { reachable: string[], perceivable: string[] }`. All action generation uses `reachable` only. Description uses both sets.
**Implications:** Any caller of `computeScope` that expects `string[]` will break. Both properties must be destructured. This is a clean boundary — no risk of accidentally generating actions for perceivable-only entities.

---

## 2026-03-27 — Zoo 1 — TypeScript union type sorting requires explicit array types

**Context:** Sorting `roomContents` into separate arrays for things, supporters, and containers in `App.tsx`.
**What happened:** Typing the arrays as `Entity[]` let everything push in, but then accessing `.isOpen` on a container caused a TypeScript error because `Entity` doesn't guarantee that property.
**Resolution:** Type the arrays specifically: `Container[]`, `Supporter[]`, `Thing[]`. TypeScript then narrows correctly after the `entity.kind` check.
**Implications:** Any future place that sorts entities by kind must use specific array types, not `Entity[]`.
