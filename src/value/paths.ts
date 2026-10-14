import { sameValueZero } from "./equality";

/**
 * Key-path mechanics for cell state (V9–V15). Data classes are primitives,
 * arrays, and plain objects; anything non-object is traversed as opaque and
 * reads `undefined`. Writes never mutate in place — each level met on the
 * path is copied into a fresh array/object, so previously-read snapshots keep
 * reporting the old data (V9, V13, V15).
 */

type Keyed = Record<string, unknown>;

export interface PathWrite {
  changed: boolean;
  value: unknown;
}

/** Splits a direct key/index or dot-delimited path into segments. */
export function toSegments(pathOrKey: string | number): string[] {
  return String(pathOrKey).split(".");
}

function isContainer(value: unknown): value is object {
  return value != null && typeof value === "object";
}

/** Reads one segment; non-containers and absent keys read `undefined` (V12). */
function child(container: unknown, segment: string): unknown {
  return isContainer(container) ? (container as Keyed)[segment] : undefined;
}

/** Walks dot-delimited segments; missing paths read `undefined`, never throw. */
export function readPath(state: unknown, segments: string[]): unknown {
  let current = state;
  for (const segment of segments) {
    current = child(current, segment);
  }
  return current;
}

/** Immutably places `value` under `segment`, replacing the direct key. */
function withChild(container: unknown, segment: string, value: unknown): unknown {
  if (Array.isArray(container)) {
    const copy = container.slice();
    (copy as unknown as Keyed)[segment] = value;
    return copy;
  }
  // Missing intermediates are created; primitives met mid-path are replaced
  // by a plain-object container on write (V14).
  const base = isContainer(container) ? container : {};
  return { ...base, [segment]: value };
}

export function writePath(state: unknown, segments: string[], next: unknown): PathWrite {
  return writeAt(state, segments, 0, next);
}

function writeAt(container: unknown, segments: string[], index: number, next: unknown): PathWrite {
  const segment = segments[index];
  const current = child(container, segment);

  if (index === segments.length - 1) {
    if (sameValueZero(current, next)) {
      return { changed: false, value: container };
    }
    return { changed: true, value: withChild(container, segment, next) };
  }

  const inner = writeAt(current, segments, index + 1, next);
  if (!inner.changed) {
    return { changed: false, value: container };
  }
  return { changed: true, value: withChild(container, segment, inner.value) };
}
