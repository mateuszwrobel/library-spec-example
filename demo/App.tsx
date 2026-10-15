import { useEffect, useState } from "react";
import { Component as CounterExample } from "./CounterView";
import { StorePage } from "./StoreView";
import { UsersPage } from "./UsersView";

/**
 * Lane D gallery — the component-exploration surface: one view per spec
 * example, plain unstyled markup, hash routing with no added dependency
 * (workplan_demo.md, Decisions).
 */

function readRoute(): string {
  return window.location.hash.replace(/^#\/?/, "");
}

function useHashRoute(): string {
  const [route, setRoute] = useState(readRoute);
  useEffect(() => {
    const onChange = () => setRoute(readRoute());
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return route;
}

export function App() {
  const route = useHashRoute();
  return (
    <main>
      <h1>PAKER DEMO</h1>
      <nav>
        links: <a href="#/counter">/counter</a> <a href="#/store">/store</a>{" "}
        <a href="#/users">/users</a>
      </nav>
      {route === "counter" && <CounterExample />}
      {route === "store" && <StorePage />}
      {route === "users" && <UsersPage />}
    </main>
  );
}
