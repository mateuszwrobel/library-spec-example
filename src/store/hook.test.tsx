import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { store } from "@paker/store";

afterEach(cleanup);

type Profile = { city: string };
type User = { id: number; profile: Profile };
type UserState = { data: User[]; counter: number };

describe("S5 — store and property hooks scope re-renders", () => {
  it("whole-store hook re-renders on any property change; property hook re-renders only for its key", () => {
    const userStore$ = store<UserState>(() => ({
      data: [{ id: 1, profile: { city: "KRK" } }],
      counter: 0,
    }));
    let wholeRenders = 0;
    let counterRenders = 0;

    function Whole() {
      wholeRenders += 1;
      const state = userStore$();
      return <span>{`whole:${state.counter}/${state.data.length}`}</span>;
    }
    function CounterOnly() {
      counterRenders += 1;
      const counter = userStore$.counter$();
      return <span>{`counter:${counter}`}</span>;
    }

    render(
      <>
        <Whole />
        <CounterOnly />
      </>,
    );
    expect(wholeRenders).toBe(1);
    expect(counterRenders).toBe(1);
    expect(screen.getByText("whole:0/1")).toBeInTheDocument();
    expect(screen.getByText("counter:0")).toBeInTheDocument();

    // Only data$ changes — the counter-only component must not re-render.
    act(() => {
      userStore$.data$.setKey("0.profile.city", "WAW");
    });
    expect(wholeRenders).toBe(2);
    expect(counterRenders).toBe(1);
    expect(screen.getByText("whole:0/1")).toBeInTheDocument();

    // A counter change reaches both hooks — once each, store view fires once per change.
    act(() => {
      userStore$.counter$.set(5);
    });
    expect(wholeRenders).toBe(3);
    expect(counterRenders).toBe(2);
    expect(screen.getByText("counter:5")).toBeInTheDocument();

    // A multi-key whole-store replacement is one operation — exactly one
    // re-render for the whole-store hook, one for the counter hook (its key
    // actually changed).
    const emptiedData: User[] = [];
    act(() => {
      userStore$.set({ data: emptiedData, counter: 6 });
    });
    expect(wholeRenders).toBe(4);
    expect(counterRenders).toBe(3);

    // An equal-valued replacement re-renders nobody.
    act(() => {
      userStore$.set({ data: emptiedData, counter: 6 });
    });
    expect(wholeRenders).toBe(4);
    expect(counterRenders).toBe(3);
  });

  it("whole-state snapshot identity is stable between changes — hook reads never loop", () => {
    const userStore$ = store<UserState>(() => ({ data: [], counter: 0 }));
    const before = userStore$.get();
    expect(userStore$.get()).toBe(before);

    act(() => {
      userStore$.counter$.set(1);
    });
    const after = userStore$.get();
    expect(after).not.toBe(before);
    expect(userStore$.get()).toBe(after);
    // Attach-then-read via the same subscribe path the hook bridge uses stays quiet.
    const unsubscribe = userStore$.subscribe(() => undefined);
    unsubscribe();
    expect(userStore$.get()).toBe(after);
  });

  it("unmount detaches the whole-store hook subscription", () => {
    const userStore$ = store<UserState>(() => ({ data: [], counter: 0 }));
    let renders = 0;
    function Whole() {
      renders += 1;
      const state = userStore$();
      return <span>{state.counter}</span>;
    }

    const view = render(<Whole />);
    expect(renders).toBe(1);
    view.unmount();
    expect(() => {
      act(() => {
        userStore$.counter$.set(9);
      });
    }).not.toThrow();
    expect(renders).toBe(1);
  });
});
