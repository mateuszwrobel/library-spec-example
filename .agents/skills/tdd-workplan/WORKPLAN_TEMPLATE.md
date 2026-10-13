# Workplan: [Feature Name]

## Goal
[One paragraph. What the feature does, for whom, and the observable outcome. A user story ("As a... I want... so that...") folds into this paragraph.]

## Acceptance Criteria
<!-- Each criterion is one Gherkin scenario. One scenario per observable behavior. Cover happy path and key edge cases. Errors are behaviors too — write them as scenarios. -->

### Scenario: [short name]
Given [context]
  And [context]
When [action]
Then [observable result]
  And [observable result]

### Scenario: [short name]
Given [context]
When [action]
Then [observable result]

## Decisions
- [Decision] — Rationale: [why]. Rejected: [alternative] because [reason]. <!-- Append "(ADR-NNN) — see docs/adr/ADR-NNN-*.md" when this decision is architectural and a durable record was written. -->
- ...

> Decomposition: this workplan is decomposed into sub-workplans only after all Open Questions below are resolved.

## Assumptions
- [Assumption] — Depends: [what relies on it]. If wrong: [consequence].
- ...

## Risks
- [Risk] — Impact: [what breaks]. Mitigation: [how it is handled].
- ...

## Open Questions
- [Question] — Blocks implementation: [yes/no]. [What depends on the answer.]
- ...

<!-- ================================================================
     Partials below are included only when the feature touches that
     surface. The planner selects them by researching the codebase.
     Omit a partial entirely when it does not apply. The Modularity
     partial is always included.
     ================================================================ -->

## CLI
<!-- Include when the feature adds or changes command-line behavior. -->

### Proposed Commands
| Command | Purpose |
|---------|---------|

### Arguments
| Command | Argument | Required | Description |
|---------|----------|----------|-------------|

### Flags / Options
| Flag | Type | Default | Description |
|------|------|---------|-------------|

### Exit Codes
| Code | Meaning | When Produced |
|------|---------|---------------|

### Environment / Configuration
| Name | Purpose | Default |
|------|---------|---------|

## API
<!-- Include when the feature exposes or consumes an interface with a contract. -->

### Endpoints
| Method | Path | Purpose |
|--------|------|---------|

### Contracts
#### [METHOD] [path]
**Request**
- Headers: ...
- Body: ...

**Success response**
- Status: ...
- Body: ...

**Error responses**
- Status: ... — Body: ...
- Status: ... — Body: ...

### Data Models / DTOs
| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|

## Database
<!-- Include when the feature persists or reads structured data. -->

### Existing Data Store
[What exists today. Decision: extend this store or create a new one, and why.]

### Proposed Tables
#### [table name]
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|

### Relationships
[How the tables relate. Cascade/delete rules if relevant.]

### Data Flow
[How data enters and leaves this store — which API contract fields the schema must satisfy, and which queries serve the behavior.]

## UI
<!-- Include when the feature renders or manipulates a visible interface (page, screen, components). -->

### Mockups
<!-- One mockup per observable page state. States come from the Acceptance Criteria scenarios / user journeys — none invented. Mockups are design references for later UI work — not pixel contracts, never binding acceptance criteria. -->

| Page State | Mockup | Reference (file/prompt path) |
|------------|--------|------------------------------|

<!-- Mockup source: if the user pointed at an image-generation model source during planning, record it in Decisions and render mockups with it, storing the exact prompts/inputs verbatim beside the mockups so every render is reproducible from the repo. No source named → simple markdown mockups. -->

### UI Harness Inventory
<!-- The planner discovers what exists by researching the codebase, never by asking the user. A missing harness is planned as behavior in its own right (feeding Decisions and Modularity); an existing one is referenced. -->

| Surface | Present | Where | Plan Action |
|---------|---------|-------|-------------|
| Component exploration (component gallery; the project's own equivalent counts) | yes/no | [path or URL] | reference / extend / create |
| Design system (single source of visual tokens + named component primitives) | yes/no | [path or URL] | reference / extend / create |
| E2E (browser-driven scenarios) | yes/no | [path or URL] | reference / extend / create |

## Modularity
<!-- Always included. -->

### Behavior Analysis
[Behaviors this feature adds, each with its own reason to change.]

### Module Placement
| Behavior | Fits Existing Module | New Module | Reason |
|----------|---------------------|------------|--------|

### Internal Architecture
[Per affected/new module: architecture style (DDD, feature-layered, CRUD, procedural) and why.]

### Boundaries
[Which existing modules gain behavior, which are new, which existing modules need extraction first.]
