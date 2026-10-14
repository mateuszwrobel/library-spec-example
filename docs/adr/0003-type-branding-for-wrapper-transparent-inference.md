# 0003. Type branding for wrapper-transparent inference

**Status**: Accepted

## Context

The spec requires `InferValue`, `InferState`, `InferActions`, `InferEvents` and friends to read a composed Paker instance through any wrapper order. The cost of reversal is high: every wrapper module's public type must carry the convention, so retrofitting after the wrappers ship would break every entry point's type surface.

## Decision

We will carry the inner primitive's type identity as a structural phantom brand added to each wrapper module's return type, read by conditional-type helpers defined once in utils. Branding is type-level only — zero runtime code, no RxJS types leak through it.

## Consequences

### Positive
- Single owner of the projection convention; wrappers stay thin; the spec's import strings compile.

### Negative
- The heaviest type-level surface in the project; error messages from wrong names point at helper calls.

### Neutral
- The convention is authored in `workplans/workplan_utils.md` and implemented by the value/store/actions/rxjs cards.

## Alternatives considered

- Runtime metadata objects: rejected — runtime cost, and generics cannot smuggle what is needed through them.
- Independent per-entry `Infer` definitions: rejected — two owners of the same projection drift.
- Branding deferred to a post-hoc utility PR: rejected — the wrappers would ship non-composable types.
