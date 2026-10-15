import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { rxjs } from "@paker/adapters/rxjs";
import { actions } from "@paker/actions";
import { store } from "@paker/store";
import { value } from "@paker/value";
import { tap } from "rxjs/operators";

afterEach(cleanup);

type Profile = { city: string };
type User = { id: number; profile: Profile };
type UserState = { data: User[]; counter: number };

const makeUser = (id: number, city: string): User => ({ id, profile: { city } });

describe("R5 — adapter preserves wrapped APIs and React behavior", () => {
  const buildComposed = () => {
    const innerStore$ = store<UserState>(() => ({ data: [], counter: 0 }));
    const actioned$ = actions(innerStore$, (userCells$) => ({
      incrementBy: (amount: number) => {
        userCells$.counter$.set(userCells$.counter$.get() + amount);
      },
    }));
    // Kit untouched → inferred without annotation (Decisions). The spec's
    // first-factory-arg destructuring: cells/action methods are its members.
    const userStore$ = rxjs(actioned$, ({ data$ }) => ({
      LOAD: (users: User[]) => [tap(() => data$.set(users))],
    }));
    return { innerStore$, actioned$, userStore$ };
  };

  it("full stack rxjs(actions(store(...))): state, action, and subscription APIs behave as unwrapped", () => {
    const { innerStore$, actioned$, userStore$ } = buildComposed();
    const u1 = makeUser(1, "KRK");
    const u2 = makeUser(2, "WAW");

    const dataSpy = vi.fn();
    const counterSpy = vi.fn();
    const wholeSpy = vi.fn();
    userStore$.data$.subscribe(dataSpy);
    userStore$.counter$.subscribe(counterSpy);
    userStore$.subscribe(wholeSpy);

    userStore$.LOAD([u1, u2]); // event method writes through the wrapped cell
    expect(userStore$.data$.get()).toEqual([u1, u2]);
    expect(dataSpy).toHaveBeenCalledTimes(1);
    expect(counterSpy).not.toHaveBeenCalled(); // per-key firing survives (S1/S5)
    expect(wholeSpy).toHaveBeenCalledTimes(1);

    userStore$.incrementBy(4); // action apply protocol survives (A)
    expect(userStore$.counter$.get()).toBe(4);
    expect(counterSpy).toHaveBeenCalledWith(4, 0);
    expect(dataSpy).toHaveBeenCalledTimes(1); // counter silent for data cell

    // Whole-state APIs intact (A1 through both wrappers).
    expect(userStore$.get()).toEqual({ data: [u1, u2], counter: 4 });
    expect(userStore$.getInitial()).toEqual({ data: [], counter: 0 });
    userStore$.data$.setKey("0.profile.city", "WAW"); // key ops through property cells (S6)
    expect(userStore$.data$.getKey("0.profile.city")).toBe("WAW");
    userStore$.reset(); // S4
    expect(userStore$.get()).toEqual({ data: [], counter: 0 });

    // The wrapped primitives are untouched; one state owner per stack (A1).
    expect("LOAD" in innerStore$).toBe(false);
    expect("LOAD" in actioned$).toBe(false);
    expect(userStore$.data$).toBe(actioned$.data$); // same cell objects
    expect(actioned$.data$).toBe(innerStore$.data$);
  });

  it("rxjs over an actions-decorated VALUE wraps the other decorated form too (lane contract leg)", () => {
    const counter$ = rxjs(
      actions(value(0), (value$) => ({ bump: () => value$.get() + 1 })),
      (value$) => ({ TOUCH: () => [tap(() => value$.set(100))] }),
    );
    counter$.bump(); // action through the event wrapper (A3 apply rule)
    expect(counter$.get()).toBe(1);
    counter$.TOUCH(); // event through the action-decorated value
    expect(counter$.get()).toBe(100);
    expect(counter$.getInitial()).toBe(0); // value contract preserved
  });

  it("atomic hook subscriptions scope re-renders through the full stack; wrapped hook calls behave as unwrapped", () => {
    const { userStore$ } = buildComposed();
    const u1 = makeUser(1, "KRK");
    const u2 = makeUser(2, "WAW");

    let usersRenders = 0;
    let wholeRenders = 0;
    function Users() {
      usersRenders += 1;
      const data = userStore$.data$(); // property hook through the wrapper
      return <span>{`${data.length} users`}</span>;
    }
    function Whole() {
      wholeRenders += 1;
      const state = userStore$(); // wrapper's own hook call delegates to the store hook
      return <span>{`whole:${state.counter}/${state.data.length}`}</span>;
    }

    render(
      <>
        <Users />
        <Whole />
      </>,
    );
    expect(usersRenders).toBe(1);
    expect(wholeRenders).toBe(1);

    // A counter action never touches the data cell: Users stays unrendered (V/S rules hold under wrapping).
    act(() => {
      userStore$.incrementBy(7);
    });
    expect(usersRenders).toBe(1);
    expect(wholeRenders).toBe(2);
    expect(screen.getByText("0 users")).toBeInTheDocument();

    // An event writing data re-renders both — once each.
    act(() => {
      userStore$.LOAD([u1, u2]);
    });
    expect(usersRenders).toBe(2);
    expect(wholeRenders).toBe(3);
    expect(screen.getByText("2 users")).toBeInTheDocument();
    expect(screen.getByText("whole:7/2")).toBeInTheDocument();
  });
});
