import type { Brand } from "@paker/utils";

/**
 * A direct key/index (`1`, `"theme"`) or a dot-delimited nested path
 * (`"user.address.city"`, `"0.items.0.sku"`). Path strings carry no
 * compile-time validation; keys containing literal dots are unreachable
 * via path form (workplan_paker_library.md, key-operations decision).
 */
export type PathOrKey = string | number;

export type Listener<T> = (current: T, previous: T) => void;

export type KeyListener = (current: unknown, previous: unknown) => void;

/** Returned by `subscribe`/`subscribeKey` — call it to detach the listener. */
export type Cleanup = () => void;

/**
 * Read surface shared by mutable value cells and computed cells: callable as
 * a React hook inside a component, whole-value and key-targeted reads.
 * Branded with the inner data type (ADR-0003).
 */
export interface ReadApi<T> extends Brand<T> {
  (): T;
  get(): T;
  getInitial(): T;
  subscribe(listener: Listener<T>): Cleanup;
  getKey(pathOrKey: PathOrKey): unknown;
  subscribeKey(pathOrKey: PathOrKey, listener: KeyListener): Cleanup;
}

/** Write surface — absent from computed cells at the type level (V7). */
export interface WriteApi<T> {
  set(nextOrUpdater: T | ((current: T) => T)): void;
  setKey(pathOrKey: PathOrKey, next: unknown): void;
  reset(): void;
}

/** A reactive cell holding one piece of state (workplan_value.md). */
export interface ValueCell<T> extends ReadApi<T>, WriteApi<T> {}

/**
 * A derived cell over dependency cells — the read surface only, no write
 * APIs; `set`/`setKey`/`reset` are compile-time failures on it (V7).
 */
export interface ComputedCell<T> extends ReadApi<T> {}
