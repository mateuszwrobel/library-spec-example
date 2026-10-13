# UI partial polish — description list, harness clarifier, research parity

```json
{
  "status": "done"
}
```

Follow-up polish to the ui-partial task (2026-10-05-ui-partial.md): three one-line gaps left by that change, no behavior added.

What changed and why:
- `tdd-workplan/SKILL.md` Description still listed "(CLI, API, database)" after UI became a partial — the surface enumeration in the opening paragraph now matches the partials list, selection list, and template section order.
- The UI partial's harness-surfaces clause could read as a disguised test section under the behavior/implementation dividing line — added a half-sentence after the e2e surface naming it as an infrastructure inventory, not a test section.
- The codebase-research step covered the component-gallery and e2e harness surfaces but left the design-system surface implicit in "component and token conventions" — made it explicit as "design-system presence (tokens, named components)" so the research step checks all three harness surfaces with parity.
