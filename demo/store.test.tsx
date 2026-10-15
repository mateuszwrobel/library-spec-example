import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { Profiler } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  AtomicStoreComponent,
  CounterOnlyComponent,
  WholeStoreComponent,
  userStore$,
} from "./StoreView";
import type { User } from "./types";

afterEach(cleanup);

beforeEach(() => {
  act(() => userStore$.reset());
});

describe("D2 — Store components demonstrate atomic subscriptions", () => {
  it("incrementCounter reaches every counter subscriber; a data-only change re-renders the whole and spec-atomic hooks while the counter-only subscriber stays silent (S5 scoping leg)", () => {
    let wholeCommits = 0;
    let atomicCommits = 0;
    let counterOnlyCommits = 0;

    render(
      <>
        <Profiler id="whole" onRender={() => { wholeCommits += 1; }}>
          <WholeStoreComponent />
        </Profiler>
        <Profiler id="atomic" onRender={() => { atomicCommits += 1; }}>
          <AtomicStoreComponent />
        </Profiler>
        <Profiler id="counterOnly" onRender={() => { counterOnlyCommits += 1; }}>
          <CounterOnlyComponent />
        </Profiler>
      </>,
    );

    expect(screen.getByText("Whole: 0 (0 users)")).toBeInTheDocument();
    expect(screen.getByText("Atomic: 0 (0 users)")).toBeInTheDocument();
    expect(screen.getByText("Counter only: 0")).toBeInTheDocument();
    expect(wholeCommits).toBe(1);
    expect(atomicCommits).toBe(1);
    expect(counterOnlyCommits).toBe(1);

    // incrementCounter runs — all three components show the new counter value.
    act(() => {
      userStore$.incrementCounter();
    });
    expect(screen.getByText("Whole: 1 (0 users)")).toBeInTheDocument();
    expect(screen.getByText("Atomic: 1 (0 users)")).toBeInTheDocument();
    expect(screen.getByText("Counter only: 1")).toBeInTheDocument();
    expect(wholeCommits).toBe(2);
    expect(atomicCommits).toBe(2);
    expect(counterOnlyCommits).toBe(2);

    // A data-only change through the published cell contract: the whole-store
    // hook re-renders, and the spec-atomic component re-renders too — atomic
    // means per-property subscriptions, and it subscribes data$, so it shows
    // the live users count. The counter-only subscriber does NOT re-render:
    // its commit count is unchanged — the S5 scoping leg.
    const users: User[] = [
      { id: 1, profile: { city: "KRK" } },
      { id: 2, profile: { city: "WAW" } },
    ];
    act(() => {
      userStore$.data$.set(users);
    });
    expect(wholeCommits).toBe(3);
    expect(atomicCommits).toBe(3);
    expect(counterOnlyCommits).toBe(2);
    expect(screen.getByText("Whole: 1 (2 users)")).toBeInTheDocument();
    expect(screen.getByText("Atomic: 1 (2 users)")).toBeInTheDocument();
    expect(screen.getByText("Counter only: 1")).toBeInTheDocument();
  });
});
