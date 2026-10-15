import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { actions } from "@paker/actions";
import { store } from "@paker/store";
import { value } from "@paker/value";

afterEach(cleanup);

type Profile = { city: string };
type User = { id: number; profile: Profile };
type UserState = { data: User[]; counter: number };

describe("A1 — decorated primitives stay callable as React hooks", () => {
  it("decorated value renders via hook call and re-renders when an action mutates from an event handler", async () => {
    const counter$ = actions(value(0), (value$) => ({
      increment: () => value$.get() + 1,
    }));

    function Counter() {
      const count = counter$();
      return (
        <button type="button" onClick={() => counter$.increment()}>
          {count}
        </button>
      );
    }

    render(<Counter />);
    const button = screen.getByRole("button");
    expect(button).toHaveTextContent("0");

    await userEvent.click(button);
    expect(button).toHaveTextContent("1");

    await userEvent.click(button);
    expect(button).toHaveTextContent("2");
  });

  it("decorated store hook re-renders on patches; property hooks stay scoped under decoration (S5 rules)", () => {
    const userStore$ = actions(
      store<UserState>(() => ({ data: [{ id: 1, profile: { city: "KRK" } }], counter: 0 })),
      (user$) => ({
        setCounter: (counter: number) => {
          user$.counter$.set(counter);
        },
        loadUsers: (users: User[]) => ({ data: users }),
      }),
    );

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

    // A data-only patch re-renders the whole-store hook, not the counter hook.
    act(() => {
      userStore$.loadUsers([{ id: 2, profile: { city: "WAW" } }]);
    });
    expect(wholeRenders).toBe(2);
    expect(counterRenders).toBe(1);

    // A counter write reaches both hooks — once each, one store-level notification.
    act(() => {
      userStore$.setCounter(4);
    });
    expect(wholeRenders).toBe(3);
    expect(counterRenders).toBe(2);
    expect(screen.getByText("counter:4")).toBeInTheDocument();
    expect(screen.getByText("whole:4/1")).toBeInTheDocument();
  });
});
