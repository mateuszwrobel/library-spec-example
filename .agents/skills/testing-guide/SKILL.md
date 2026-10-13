# Skill: Testing Guide

## Description
Documents the installed test stack for this repository and when each tool applies. Covers runner configuration, component-level integration testing, interaction simulation, DOM assertions, the DOM environment, and reactive-pipeline testing — with guidance on the unit vs integration split and what may be mocked. The stack is ready to use as-is; no additional test tooling is installed.

## Trigger
Use this skill when:
- Writing or reviewing tests in this repository
- Deciding which tool or test environment applies to a given test
- Deciding what a test may mock and what it must exercise for real

## Installed stack

| Package | Role | When to use |
| --- | --- | --- |
| `vitest` | Test runner: unit and integration tests, `jsdom` environment, fake timers (`vi.useFakeTimers`), coverage via `@vitest/coverage-v8` | Every test. Config lives in `vitest.config.ts` (`environment: "jsdom"`, `restoreMocks: true`, provider `v8`). No setup file exists — do not assume global matchers or global setup. |
| `@testing-library/react` | Component-level integration testing: render real component trees, let real subscriptions and renders happen, query by role, await async state with `findBy*` / `waitFor`, automatic cleanup after each test | Any test that involves a component. Render the real composition under test; assert observable behavior through queries, not internal state. |
| `@testing-library/user-event` | Realistic user-interaction sequences (typing, clicking, pointer flows) | All interaction in component tests. Prefer over `fireEvent`; fall back to `fireEvent` only for low-level event edges or performance-sensitive loops. |
| `@testing-library/jest-dom` | DOM-aware matchers (`toBeInTheDocument`, `toHaveTextContent`, ...) | Assertions on rendered output. Import `@testing-library/jest-dom/vitest` per test file — there is no setup file, so the import belongs in each file that uses the matchers. |
| `jsdom` | Default test environment providing DOM globals | Default for all files via config. Pure-logic tests may override per-file with a `// @vitest-environment node` comment. |
| `rxjs` | Reactive programming library: both the code under test (when the library under test builds on it) and its `TestScheduler` for virtual-time testing of operator pipelines | `vi.useFakeTimers` for plain async timing; `TestScheduler` (marble or direct) when testing time-based operators themselves (`debounceTime`, `delay`, `auditTime`, windows). |

## Unit vs integration

- **Unit** — pure functions and operator factories in the `node` environment (`// @vitest-environment node`). No React, no DOM. Input in, output out, or subscribe-to-a-pipeline.
- **Integration** — the wiring of composed pieces: state primitives, their subscribers, and components rendered together. Assert observable behavior through public APIs and the DOM. Do not mock the internals of what the test is meant to prove — let real subscriptions deliver real values and real renders produce real DOM.
- **Mock only external boundaries** — e.g. network via `vi.stubGlobal("fetch", ...)`. Everything inside the system under test stays real.
- `msw` is **not installed**. Adding it is an implementation-phase decision, not a harness default.

## Timing

- Prefer `vi.useFakeTimers()` / `vi.advanceTimersByTimeAsync()` for ordinary async and timeout behavior.
- Use rxjs `TestScheduler` when the time-based operator behavior itself is the subject of the test.
- `restoreMocks` is on globally, so per-test mocks do not leak; timers still need explicit `vi.useRealTimers()` when a file enables fake timers.

## Environment-aware logic

Code that branches on environment capabilities (DOM present vs absent) is testable without a browser: run the non-DOM branch under the `node` environment per-file, and the DOM branch under the default `jsdom` environment. Same source, two files, two environments.
