# Skill: Modular Feature Planner

## Description

Plans features by decomposing them into small, independent modules that can each be understood and rewritten from scratch. Technology agnostic.

## Trigger

Use this skill when:
- Planning a new feature or system
- Breaking down a large task into implementable pieces
- Deciding module boundaries for a feature

## Prerequisites

Read `skills/modular-design-principles` before planning.

## Workflow

1. **This skill runs first** — define module boundaries and contracts
2. **Then `skills/tdd-workplan` runs per module** — create a TDD implementation plan for each module independently

## Planning Steps

### Step 1: Define what the feature does

Write one sentence: "This feature allows [who] to [do what]."
List acceptance criteria. No implementation details yet.

### Step 2: Identify the nouns (data/entities)

List all data this feature needs to work with.
For each piece of data, ask: who owns it? Is it new or does it already exist in another module?

### Step 3: Identify the verbs (operations)

List all operations the feature performs.
Group related operations together. Each group is a candidate module.

### GATE: Rewrite, Extend, or Extract?

> **For each existing module this feature touches, you must answer BOTH questions in writing before proceeding.**

**Question 1 — Model fit:**
1. Does the module's current model accommodate the new requirement naturally?
2. Or does it require workarounds — new flags, special cases, working around the existing structure?

- If the model fits → candidate for extension.
- If the model doesn't fit → plan a rewrite. Delete the old module, rebuild with a model that fits both old and new requirements.

**Question 2 — Crossing behaviors:**
1. List the behaviors currently in this module. What reason does each have to change?
2. Does the new feature introduce a behavior with its own independent reason to change?
3. Are there already behaviors in this module that change for different reasons?

- If the module has one behavior and the new feature naturally extends it → extend.
- If the new feature introduces a distinct behavior with its own reason to change → plan it as a new module from day one. Do not tuck it into the existing module.
- If the module already contains multiple behaviors that change independently → plan an extraction workplan FIRST, before adding anything new.

Write your answers explicitly. Do not proceed to Step 4 without answering for every affected module.

### Step 4: Draw module boundaries

For each candidate module, answer these in order. Stop and merge/split as needed:

1. **What design decision does it hide?** — If you can't answer, merge it with another module.
2. **Is it just a passthrough?** — If removing the boundary changes nothing, merge it. No real boundary exists.
3. **Does it have one reason to change?** — Does this module contain only one behavior, or are there multiple behaviors that would change independently? If multiple, split by behavior.
4. **What is its public contract?** — Inputs, outputs, error cases.
5. **What does it depend on?** — Other modules, external services, storage.
6. **What internal architecture fits?** — DDD, CRUD, functional, procedural — pick per module based on the problem, not based on what other modules use.

### Step 5: Cross-module validation (duplicate & ownership scan)

After drawing all module boundaries, do a cross-module pass. This step catches problems that per-module checks miss.

**5a. Duplicate concern scan:**
For each module, list its hidden design decision in one line. Then scan the full list for overlaps. If two modules hide the same concern (e.g., both own "recording lifecycle" or both own "callback routing"), merge them or explicitly split the concern with a clear boundary.

**5b. Concrete dependency scan:**
For each module, list what it depends on. If any dependency is a concrete type from another module (not a trait/interface), flag it. The module should depend on a contract, not an implementation. If the contract doesn't exist yet, define it in the module that needs it (the consumer defines the port, the provider implements it).

**5c. Shared data lifecycle trace:**
List every piece of mutable state or resource that crosses a module boundary (callbacks, connections, shared handles, configuration objects). For each one, answer:
1. Which module creates it?
2. Which modules can mutate it?
3. Which module decides when it's destroyed or swapped?

If more than one module can mutate or swap it, you need a **composition root** — a dedicated module (or a section of an existing module) that owns the lifecycle and exposes register/unregister to others.

### Step 6: Define contracts between modules

For each module boundary, specify:
- The interface (function signatures, message formats, API endpoints)
- Data formats exchanged
- Error cases and how they propagate
- Data ownership: one owner per piece of data. Others get copies or ask.

### Step 7: Plan the implementation order

Order modules so that:
- Modules with no dependencies are built first
- Each module can be tested independently
- Integration between modules is tested after individual modules work

Then create a TDD workplan (see the `skills/tdd-workplan` skill) per module.

### Step 8: Decompose for parallel lanes

When the module workplans will run in parallel lanes, decompose per the `skills/tdd-workplan` "Decomposing for parallel implementation" section: give each lane's sub-workplan a scenario card (name, exclusively owned acceptance scenarios, contracts exposed/consumed, assumptions about siblings), and give the parent plan a dependency ledger — one row per card with depends-on, integration touchpoint, blocked/unblocked. Keep the ledger behavioral prerequisites only, never an implementation ordering.

## Validation Checklist

Before finalizing, verify every module passes these checks in order. If any check fails, fix it before continuing:

### Per-module checks
1. [ ] Hides a named design decision (can you say "this module hides [X]"?)
2. [ ] Is not a passthrough (removing the boundary would change behavior)
3. [ ] Has one reason to change — no crossing behaviors that change independently
4. [ ] Has a defined public contract (inputs, outputs, errors)
5. [ ] Does not depend on another module's internals
6. [ ] Depends on contracts (traits/interfaces), not concrete types from other modules
7. [ ] Owns its data — no shared mutable state with other modules
8. [ ] Has no speculative abstractions — every abstraction serves a current requirement
9. [ ] Can be tested independently without other modules running

### Cross-module checks (run after all per-module checks pass)
10. [ ] No two modules hide the same design decision (scan the full list of hidden decisions for duplicates)
11. [ ] Every piece of shared mutable state has exactly one owning module (trace lifecycle: creation, mutation, destruction)
12. [ ] Where multiple modules need to swap or configure a shared resource, a composition root exists

## Common Mistakes

1. **Module is just a passthrough** — wraps one call to another module. Merge it. No real boundary.

2. **Module has crossing behaviors** — if the module contains behaviors that change for independent reasons, they belong in separate modules. Don't wait until it's painful — extract when you spot the second reason to change.

3. **Uniform architecture forced** — DDD ceremony on a 50-line CRUD module, or CRUD on a complex domain. Each module picks what fits its problem.

4. **Coupling through data** — two modules sharing a database table without an explicit contract. Make the contract explicit or give one module ownership.

5. **Forecasting** — abstractions, interfaces, or extension points for requirements that do not exist yet. Build for now. Rewrite when needed.

6. **Patching a wrong model** — adding workarounds and special cases to an existing module instead of rewriting it. If the model doesn't fit, delete and rebuild.

7. **Tucking new behavior into an existing module** — a new feature has its own reason to change, but gets added to an existing module because "it's related." Plan it as its own module from day one. Extraction after the fact is always harder.

## Quick Example

Feature: "Users can upload and share documents"

**BAD plan:** One `DocumentService` module that handles upload, storage, sharing permissions, and notifications.

**GOOD plan:**
- `UploadModule` — hides storage backend (S3, local, etc.). Contract: accepts file bytes, returns document ID.
- `SharingModule` — hides permission model. Contract: accepts document ID + user ID, returns access grant.
- `NotificationModule` — hides notification delivery. Contract: accepts event, delivers notification.

Each is independently testable, independently rewritable. `UploadModule` uses simple procedural style. `SharingModule` uses DDD because permissions are complex. `NotificationModule` is a thin CRUD layer over a message queue.

## Output

Create a workplan file per module using the TDD workplan template at `.agents/skills/tdd-workplan/WORKPLAN_TEMPLATE.md`.
Each workplan must be concrete enough that a coder agent (including small models) can implement the module independently, without needing to read other modules' internals.