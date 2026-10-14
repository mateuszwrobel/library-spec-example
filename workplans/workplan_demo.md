# Workplan: Paker demo app (lane D)

> Scenario card
> **Name:** demo-app
> **Scenarios owned:** parent D1–D3
> **Contracts exposed:** demo gallery page (component exploration surface: one view per spec example)
> **Contracts consumed:** published entry contracts of value, store, actions, rxjs adapter (import strings from the spec; ADR-0001 aliases)
> **Assumptions about siblings:** composed instances (rxjs(actions(store(value)))) behave per R5/U6; the spec's exact example components render and react as written.

## Goal

As a reader of this repository, I want a runnable demo app rendering the specification's example components (Counter, store components, RxJS users page) so the library's documented behavior is observable end-to-end, and I want it to serve as the project's component-exploration surface. Observable outcome: D1–D3 pass against real composed Paker instances.

## Acceptance Criteria

### Scenario: D1 — Counter example behaves as specified
Given the spec's Component rendered in the demo app
Then the button shows "0 (0 users, 0 total)"
When clicked once
Then it shows "1 (0 users, 1 total)"

### Scenario: D2 — Store components demonstrate atomic subscriptions
Given the spec's WholeStoreComponent and AtomicStoreComponent over one decorated store
When incrementCounter runs
Then both show the new counter value
  And re-renders are scoped per the S5 scenario

### Scenario: D3 — RxJS example renders fetched users
Given the spec's Users component with a stubbed fetch endpoint
When FETCH(5) is triggered
Then the page shows "2 users" for the two-user stub response

## Decisions

- The demo is a plain React app (single page, minimal links per example, unstyled markup) under its own directory; examples import through the spec's entry strings via aliases. Rejected: Storybook — installs tooling the spec doesn't require; the gallery page itself is the exploration surface (UI harness rule: "the project's own equivalent counts").
- Demo behavior is proven by vitest + RTL + user-event (installed stack); the live dev server is for humans. No browser e2e harness added (parent UI decision restated).
- Network edges use a stub fetch so the demo runs offline; the stub is the same two-user witness as D3 (external boundary mocked per testing-guide; demo app code keeps it behind a single function).
- Demo app excluded from the 100% coverage gate (parent decision); its tests still run in the suite.

## Assumptions

- All runtime lanes (V, S, A, R) land before this lane runs; composed instances behave per their contracts. If wrong: demo tests fail at integration — which is exactly this lane's job to surface.
- No design tokens or styling system exist or are planned. If wrong (styled demo requested): design-system surface becomes real behavior needing its own plan.

## Risks

- The demo's exact copy strings ("0 (0 users, 0 total)") couple tests to spec example text. Impact: wording drift breaks tests. Mitigation: strings come from the spec verbatim; they are contractual witnesses, not UI taste.
- Stubbed fetch diverging from real API shapes. Impact: demo behavior ≠ production fetch. Mitigation: stub returns `User[]` typed explicitly; shape is compile-checked.

## Open Questions

- None.

## UI

### Mockups

| Page State | Mockup | Reference |
|---|---|---|
| Gallery initial | `PAKER DEMO — links: /counter /store /users` → `/counter → [0 (0 users, 0 total)]` | D1 |
| Counter after click | `[1 (0 users, 1 total)]` | D1 |
| Store page | `[/store → Whole: 0 (0 users) · Atomic: 0 (0 users)]` after increment `1 (0 users)` both | D2 |
| Users after fetch | `[/users → 2 users]` | D3 |

### UI Harness Inventory

| Surface | Present | Where | Plan Action |
|---|---|---|---|
| Component exploration | no | — | create: the gallery page is this lane's deliverable (one view per spec example) |
| Design system | no | — | none planned: unstyled demo per Decisions |
| E2E (browser-driven) | no | — | none planned: RTL/jsdom behavior proof per Decisions |

## Modularity

### Behavior Analysis

One behavior: rendering the spec's examples against composed library instances (integration demonstration). Changes when the spec's examples change, not when library internals change.

### Module Placement

| Behavior | Fits Existing Module | New Module | Reason |
|---|---|---|---|
| spec example rendering + gallery | — | `demo app` (this) | integration surface kept outside library modules so library entries stay side-effect-free and demo can be deleted wholesale |

### Internal Architecture

Minimal feature-per-example components; no state management beyond what the library provides (the demo IS the library's usage).

### Boundaries

Depends only on published entry contracts; nothing depends on the demo; deletable without touching library behavior.
