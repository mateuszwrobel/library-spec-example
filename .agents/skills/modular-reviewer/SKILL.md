# Skill: Modular Code Reviewer

## Description

Reviews code for proper modular design. Checks whether code follows small-program composition principles. Technology agnostic.

## Trigger

Use this skill when:
- Reviewing a pull request or code change
- Evaluating existing code for modularity
- Checking if implementation matches the planned module boundaries

## Prerequisites

Read `skills/modular-design-principles` before reviewing.

## Review Checklist

Go through these checks in order for each module in the change. Stop on any BLOCK finding — it must be fixed before continuing.

### Critical (BLOCK if failed)

1. **Is this change working WITH the module's model, or AROUND it?**
   If the code adds workarounds, special-case flags, or avoids touching the core model — BLOCK. The module should have been rewritten with a model that fits, not patched around.

2. **Does this module contain crossing behaviors?**
   List the behaviors in this module. Does each one change for the same reason? If the module contains behaviors that change independently — BLOCK. Recommend which behavior to extract into its own module.

3. **Are there circular dependencies between modules?**
   If yes — modules cannot be independently replaced. Must break the cycle.

4. **Can this module be deleted without cascading changes to other modules?**
   If no — too tightly coupled. Identify the coupling and recommend how to break it.

### Important (WARN — should fix)

5. **Does this change introduce a new behavior with its own reason to change?**
   If the change adds functionality that could change independently from the module's existing behavior — WARN. It should be its own module, not tucked in.

6. **Does the module hide a named design decision?**
   Can you say "this module hides [X]"? If not — the boundary may be arbitrary.

7. **Is the module just a passthrough to another module?**
   If yes — merge them. No real boundary exists.

8. **Does each piece of data have exactly one owning module?**
   If multiple modules write to the same data — unclear ownership causes coupling.

9. **Do modules communicate through explicit contracts, not shared internals?**
   Check for: shared database tables without a contract layer, direct access to another module's internal types, assumptions about another module's implementation.

10. **Does the module depend on contracts (traits/interfaces) or concrete types?**
    If a module holds a concrete type from another module (not behind a trait), it is coupled to that module's implementation. The dependency should be on a trait/interface, not a struct.

11. **Does the module's internal architecture match its problem?**
    Simple CRUD for simple data, richer patterns for complex domains. Flag: DDD ceremony on a trivial module, or a flat structure on a complex domain.

12. **Are there abstractions that serve no current requirement?**
    Unused interfaces, extension points for hypothetical futures, wrapper types that add no value. Flag for removal.

### Cross-module (BLOCK if failed — run after reviewing all modules in the change)

13. **Do any two modules hide the same design decision?**
    List each module's hidden decision. If two overlap (e.g., both own "request lifecycle" or "recording state"), one must be stripped down or merged. This is the most common source of subtle duplication.

14. **Does every shared resource have a single lifecycle owner?**
    For each callback, connection, handle, or mutable state that crosses module boundaries: trace who creates it, who can swap/mutate it, who destroys it. If more than one module can mutate it, a composition root is missing.

### Minor (INFO — optional)

15. **Is there dead code, unused parameters, or backwards-compatibility shims?**
    If unused — delete it.

16. **Is error handling appropriate for the boundary type?**
    Validate at system boundaries (user input, external APIs). Trust internal code within a module.

## Review Output Format

~~~
## Module: [name]

### BLOCK
[List any critical failures, or "None"]

### WARN
[List any important issues, or "None"]

### INFO
[List any minor observations, or "None"]

### Verdict: APPROVE / REQUEST CHANGES
[One sentence: what must change, or "Looks good"]
~~~

## Example Review

Module: `OrderService`

A "gift wrapping" feature was added by inserting `if is_gift_wrap` checks in 8 places across the order processing flow.

~~~
## Module: OrderService

### BLOCK
- Change works AROUND the module's model. Gift wrapping is a separate concern
  threaded through order processing via scattered flag checks. Either extract
  gift wrapping into its own module (contract: accepts order ID, returns
  wrapping instructions) or rewrite OrderService with a model that handles
  order decorations as a first-class concept.

### WARN
- None

### INFO
- None

### Verdict: REQUEST CHANGES
Gift wrapping was patched in rather than designed in. Rewrite or extract.
~~~

## Quick Reference: Common Findings

| Finding | Severity | Fix |
|---------|----------|-----|
| Change works around the module's model | BLOCK | Rewrite module with a model that fits |
| Module contains crossing behaviors | BLOCK | Extract each behavior into its own module |
| Circular dependency between modules | BLOCK | Break cycle, introduce contract |
| Deletion would cascade | BLOCK | Decouple through explicit contract |
| Two modules hide the same design decision | BLOCK | Strip one down or merge |
| Shared resource has no single lifecycle owner | BLOCK | Add composition root |
| Change introduces behavior with independent reason to change | WARN | Plan as separate module, not extension |
| No clear hidden design decision | WARN | Reconsider boundary or merge |
| Passthrough module | WARN | Merge with the module it wraps |
| Shared mutable data, unclear owner | WARN | Assign single owner |
| Depends on concrete type, not contract | WARN | Introduce trait/interface, depend on that |
| Speculative abstraction | WARN | Delete it, build when needed |
| Over-engineered simple module | WARN | Simplify internal architecture |
| Dead code | INFO | Delete |