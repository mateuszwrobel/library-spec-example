import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { value } from "@paker/value";

afterEach(cleanup);

type Address = { city: string; zip?: string };
type User = { address: Address; tag: string };
type Settings = { user: User; tag: string };

describe("V8 — callable as a React hook", () => {
  it("renders the current value without a selector and re-renders on set from an event handler", async () => {
    const counter$ = value(0);

    function Counter() {
      const count = counter$();
      return (
        <button type="button" onClick={() => counter$.set((current) => current + 1)}>
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

  it("unmount detaches the subscription automatically", () => {
    const counter$ = value(0);

    function Reader() {
      const count = counter$();
      return <span>{count}</span>;
    }

    const view = render(<Reader />);
    expect(screen.getByText("0")).toBeInTheDocument();

    act(() => counter$.set(1));
    expect(screen.getByText("1")).toBeInTheDocument();

    view.unmount();
    act(() => {
      counter$.set(2);
    });
    // no throw after unmount — the hook subscription was cleaned up
    expect(screen.queryByText("1")).toBeNull();
  });
});

describe("V7 — computed is callable as a React hook", () => {
  it("re-renders when a dependency changes", () => {
    const counter$ = value(0);
    const users$ = value<{ name: string }[]>([]);
    const total$ = value([counter$, users$], (counter, users) => counter + users.length);

    function Total() {
      const total = total$();
      return <span>{total}</span>;
    }

    render(<Total />);
    expect(screen.getByText("0")).toBeInTheDocument();

    act(() => counter$.set(2));
    expect(screen.getByText("2")).toBeInTheDocument();

    act(() => users$.set([{ name: "a" }, { name: "b" }]));
    expect(screen.getByText("4")).toBeInTheDocument();
  });
});

describe("V13 — deep-path writes re-render whole-value hook readers with sibling paths silent", () => {
  it("hook reader re-renders on a deep leaf write; untouched sibling subscribers stay silent", () => {
    const settings$ = value<Settings>({
      user: { address: { city: "KRK" }, tag: "a" },
      tag: "root",
    });
    const tagSpy = vi.fn();
    const zipSpy = vi.fn();
    settings$.subscribeKey("user.tag", tagSpy);
    settings$.subscribeKey("user.address.zip", zipSpy);

    let renders = 0;
    function City() {
      renders += 1;
      const city = settings$().user.address.city;
      return <span>{city}</span>;
    }

    render(<City />);
    expect(screen.getByText("KRK")).toBeInTheDocument();
    expect(renders).toBe(1);

    act(() => settings$.setKey("user.address.city", "WAW"));
    expect(screen.getByText("WAW")).toBeInTheDocument();
    expect(renders).toBe(2);
    expect(tagSpy).not.toHaveBeenCalled();
    expect(zipSpy).not.toHaveBeenCalled();

    act(() => settings$.setKey("user.address.city", "WAW"));
    expect(renders).toBe(2);
    expect(tagSpy).not.toHaveBeenCalled();
    expect(zipSpy).not.toHaveBeenCalled();
  });
});
