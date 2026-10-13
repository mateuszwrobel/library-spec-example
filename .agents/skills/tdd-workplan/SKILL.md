# Skill: TDD Workplan Generator

## Description
Creates behavior-first workplans for features or user journey parts. A workplan defines WHAT the feature must do — goal, acceptance criteria as Gherkin scenarios, decisions, assumptions, risks, open questions — and the interfaces and data it touches (CLI, API, database, UI) plus modularity analysis. It deliberately excludes HOW: no test sections, no implementation order, no implementation details. The coder agent derives tests and code from the described behavior after the plan is approved.

## Trigger
Use this skill when:
- Creating a workplan for a feature or module
- Planning a feature for implementation
- Breaking down a high-level plan item into a detailed workplan
- Verifying whether a plan adheres to this workplan format

## Dividing line: behavior vs implementation

A workplan is an agreement on WHAT a feature does and WHY. Implementation is derived later by the coder.

**Never include in a workplan:**
- Test sections (unit, integration, e2e test names and descriptions) — tests are derived from the Gherkin scenarios later
- Implementation order, phases, or task sequences — including red-green-refactor steps
- Implementation details: function signatures, struct field names, concrete file paths as implementation targets, algorithm choices, library choices
- A standalone Models/DTOs section — data lives where it belongs: in the API partial (request/response schemas) or the Database partial (table schemas)

**Always express behavior as:**
- Goal — observable outcome for whom
- Acceptance criteria — Gherkin scenarios (Given/When/Then)
- Decisions, assumptions, risks, open questions — the design context

## Workplan structure

A workplan has six core sections (always present, fixed order) plus partial sections (included when the feature touches that surface). The agent decides which partials apply by researching the codebase first.

### Core sections (always, in this order)

1. **Goal** — One paragraph. What the feature does, for whom, and the observable outcome. A user story ("As a... I want... so that...") folds into this paragraph.
2. **Acceptance Criteria** — A set of Gherkin scenarios. Each scenario is one observable behavior:
   ```
   ### Scenario: [short name]
   Given [context]
     And [context]
   When [action]
   Then [observable result]
     And [observable result]
   ```
   One scenario per behavior. Cover the happy path and key edge cases. Errors are behaviors too — write them as scenarios ("When an invalid value is submitted, Then the request is rejected"). Scenario values are illustrative witnesses of the behavior, not an exhaustive enumeration — they define the behavior class, not literal fixtures to reproduce.
3. **Decisions** — Every design decision made during planning. Each: the decision, the rationale, alternatives rejected and why. Record decisions here; never leave them as open options in the plan.
4. **Assumptions** — Facts taken as true without verification. Each: the assumption, what depends on it, what happens if it is wrong.
5. **Risks** — Each: the risk, the impact, the mitigation.
6. **Open Questions** — Unresolved questions. Each: the question, what depends on the answer, whether implementation is blocked without it.

Architectural decisions that need a durable record have an ADR written alongside the workplan and are linked from the Decisions section.

### When a decision needs an ADR

Produce an ADR when the decision is architectural — costly to reverse or cross-cutting:
- Adding or removing an external dependency
- Changing a pattern (e.g. builtin module to plugin)
- Changing communication style (e.g. internal call to event-based)
- Changing a fundamental approach to a problem

Routine feature decisions stay in the Decisions section without an ADR.

ADR conventions follow the repository's plan/ADR conventions. By default: one file per decision in the project ADR directory (e.g. `docs/adr/ADR-NNN-*.md`), next free number, existing ADR format (Status / Context / Decision / Consequences / Alternatives considered). Write the ADR while planning, then link it from the relevant Decisions item as `ADR-NNN`. Changes to existing ADRs are allowed — a decision may supersede an earlier one.

### When to decompose

A workplan is only decomposed into sub-workplans once all Open Questions are resolved in the main plan. Decomposing a plan that still has unanswered questions is not allowed.

### Decomposing for parallel implementation

When a plan is decomposed into sub-workplans that run in parallel lanes, each sub-workplan starts with a **scenario card** header:

- **Name** — the card's identifier
- **Scenarios owned** — the acceptance scenarios from the parent plan this card implements; ownership is exclusive, each scenario owned by exactly one card
- **Contracts** — the contracts the card exposes to and consumes from sibling cards
- **Assumptions** — what this card assumes about the sibling cards

The parent plan carries a **dependency ledger** — one row per card: which other cards or resolved prerequisites it depends on, the integration touchpoint where its behavior surface joins the others, and whether it is blocked or unblocked. The ledger is a record of behavioral prerequisites — what must already hold for the card's scenarios to be observable — not an implementation ordering or phase plan; the dividing line still forbids order and sequence anywhere in a workplan.

### Partial sections (selected by the agent)

- **CLI** — Feature adds or changes command-line behavior. Include: proposed commands (name, purpose), arguments (name, required/optional, description), flags/options (name, type, default, description), exit codes (code, meaning, when produced), environment variables / config keys (name, purpose, default).
- **API** — Feature exposes or consumes an interface with a contract. Include: proposed endpoints (method, path, purpose), a contract per endpoint (request headers/body schema, success response status + body, error responses), and the data models/DTOs that cross the boundary (fields, types, constraints).
- **Database** — Feature persists or reads structured data. First state what data store exists today. If a store exists: analyze whether extending it (new tables, new columns, new indexes) satisfies the feature, and decide — only propose a separate data store when extension is wrong. If no store exists: propose one. Include: proposed tables (name, columns, types, constraints), relationships, and how data enters and leaves (which API contract fields the schema must satisfy and which queries serve the behavior).
- **UI** — Feature renders or manipulates a visible interface (page, screen, components). Include: **Mockups** — one per observable page state, states taken from the Acceptance Criteria scenarios / user journeys, none invented. If the user pointed at an image-generation model source during planning, record the source in Decisions and render the mockups with it, storing the exact prompts/inputs verbatim beside the mockups so every render is reproducible from the repo; no source named → simple markdown mockups. Mockups are design references for later UI work — not pixel contracts, never binding acceptance criteria. And **UI harness surfaces** — three surfaces must be accounted for: a component exploration surface (a component gallery — the project's own equivalent counts), a design system surface (a single source of visual tokens plus named component primitives), and an e2e surface (browser-driven scenarios) — this inventory names infrastructure surfaces, not a test section under the dividing line. The planner discovers what exists by researching the codebase, never by asking the user: a missing harness is planned as behavior in its own right (feeding Decisions and Modularity), an existing one is referenced.
- **Modularity** — Always included. Analyze whether the feature's behaviors fit existing modules or need new ones, following the modular design principles (one behavior per module, hidden design decision, crossing behaviors, model fit). Then decide the internal architecture style per affected module — DDD, feature-layered, CRUD, procedural — and justify it. State module boundaries: which modules gain behavior, which are new, which existing modules need extraction first.

### Deciding which partials apply

Research the codebase, then include:
- CLI partial — any behavior reaches a command line
- API partial — any behavior crosses an interface boundary with a contract
- Database partial — any behavior reads or persists structured data
- UI partial — any behavior renders or manipulates a visible interface
- Modularity partial — always

## Instructions

### 1. Understand the scope
- Read the task or high-level plan
- Identify the affected module/service and its dependencies

### 2. Research the codebase
- CLI: existing commands, arguments, exit codes, config conventions
- API: existing endpoints, contracts, schemas
- Database: existing data stores, tables, schemas
- UI: existing pages/screens, design-system presence (tokens, named components), component gallery presence, browser-driven test harness presence
- Modularity: existing modules and their responsibilities
- Error handling and naming conventions (background context for judgment, not for the workplan body)

### 3. Decide the structure
Determine which partials apply. The final workplan contains exactly the six core sections plus the selected partials — nothing else.

### 4. Write the core sections
- Goal: outcome-focused, no implementation
- Acceptance criteria: Gherkin scenarios, one observable behavior each
- Decisions, assumptions, risks, open questions: complete enough that anyone can implement the plan without guessing

### 5. Write the selected partials
Fill each selected partial strictly from the template. Omit sub-items that do not apply rather than writing placeholders.

### 6. Review against the dividing line
Before finishing, strip anything that violates the behavior/implementation dividing line: test sections, implementation order, implementation details, standalone models sections.
- If the change touches behavior-bearing emitted strings, keep documentation and any claim registry consistent in the same change.

## Question quality
When gathering requirements, ask about intent and behavior, not implementation. Good: "Should overdue invoices be listed alongside current ones, or separated?" Bad: "Should this function return a Result or an Option?" Implementation follows from behavior — don't ask the user to make implementation decisions.

## No ambiguity
Every statement must have exactly one clear path. Do not include alternatives, "consider whether...", or "you might want to...". All design decisions are made during planning — the coder only implements.

## Output format
Use the template from `.agents/skills/tdd-workplan/WORKPLAN_TEMPLATE.md` (co-located with this skill).
Save the workplan in the `workplans/` directory at the repo root as: `workplans/workplan_{module}_{feature}.md`.