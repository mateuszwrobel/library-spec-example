# Add UI partial to tdd-workplan kit

```json
{
  "status": "done"
}
```

Gave the workplan kit a UI partial so planner output covers visible-interface features the way CLI/API/Database partials cover their surfaces. Distilled from a downstream consumer (todo-test1) that planned UI work ad hoc — one mockup per observable page state with a user-named image-generation source and prompts stored verbatim for reproducible renders — and discovered three harness needs (component gallery, design system, browser-driven e2e) the planner had to surface itself.

What changed and why:
- `tdd-workplan/SKILL.md`: UI added to the partials list, the partial-selection list, and the codebase-research step. The partial keeps the behavior/implementation dividing line: mockups are one per scenario-derived page state (none invented), framed as design references and never binding acceptance criteria; the generation-source rule keys off what the user pointed at during planning (recorded in Decisions, prompts kept verbatim beside renders) and falls back to markdown mockups; the three harness surfaces (component exploration, design system, e2e) are discovered by codebase research, never asked of the user, with a missing harness planned as behavior feeding Decisions/Modularity.
- `tdd-workplan/WORKPLAN_TEMPLATE.md`: `## UI` block between Database and Modularity, matching sibling style — trigger comment, Mockups table (page state / mockup / reference), verbatim-prompt storage note, and a three-row harness inventory (present / where / reference-extend-create) so no surface is silently skipped.
- Tool-agnostic phrasing throughout: "component exploration surface (the project's own equivalent counts)" instead of pinning storybook or any named generator; downstream literals (model names, paths, endpoints) deliberately not copied.

Verified: partial-selection list, partials section, and template section order agree (CLI/API/Database/UI/Modularity); no downstream literals in the skill dir.
