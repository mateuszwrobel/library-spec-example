import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { Profiler } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AtomicStoreComponent, WholeStoreComponent, userStore$ } from "./StoreView";
import type { User } from "./types";

afterEach(cleanup);

beforeEach(() => {
  act(() => userStore$.reset());
});

describe("D2 — Store components demonstrate atomic subscriptions", () => {
  it("incrementCounter reaches both components; a data-only change re-renders only the whole-store hook (S5 scoping)", async () => {
    let wholeCommits = 0;
    let atomicCommits = 0;
    const countCommits = (
      which: "whole" | "atomic",
    ) => () => {
      if (which === "whole") wholeCommits += 1;
      else atomicCommits += 1;
    };

    render(
      <>
        <Profiler id="whole" onRender={countCommits("whole")}>
          <WholeStoreComponent />
        </Profiler>
        <Profiler id="atomic" onRender={countCommits("atomic")}>
          <AtomicStoreComponent />
        </Profiler>
      </>,
    );

    expect(screen.getByText("Whole: 0 (0 users)")).toBeInTheDocument();
    expect(screen.getByText("Atomic: 0 (0 users)")).toBeInTheDocument();
    expect(wholeCommits).toBe(1);
    expect(atomicCommits).toBe(1);

    // incrementCounter runs — both components show the new counter value.
    act(() => {
      userStore$.incrementCounter();
    });
    expect(screen.getByText("Whole: 1 (0 users)")).toBeInTheDocument();
    expect(screen.getByText("Atomic: 1 (0 users)")).toBeInTheDocument();
    expect(wholeCommits).toBe(2);
    expect(atomicCommits).toBe(2);

    // A data-only change through the published cell contract: re-renders are
    // scoped per S5 — the whole-store component commits, the counter-scoped
    // atomic one does not (its users read is non-reactive by design).
    const users: User[] = [
      { id: 1, profile: { city: "KRK" } },
      { id: 2, profile: { city: "WAW" } },
    ];
    act(() => {
      userStore$.data$.set(users);
    });
    expect(wholeCommits).toBe(3);
    expect(atomicCommits).toBe(2);
    expect(screen.getByText("Whole: 1 (2 users)")).toBeInTheDocument();
    expect(screen.getByText("Atomic: 1 (0 users)")).toBeInTheDocument();
  });
});
