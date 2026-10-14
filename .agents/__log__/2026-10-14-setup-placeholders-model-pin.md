# Fill AGENTS.md placeholders and pin session/subagent model

```json
{
  "status": "done"
}
```

Turned AGENTS.md from an unfilled generic template into this repo's real project instructions, and made the session/subagent model explicit everywhere it matters. The repo is `library-spec-example` (owner `mateuszwrobel`), a TypeScript (React 19 + RxJS, vitest/RTL) project on trunk-based `main` with GitHub Actions as CI and no CI secrets today (public repo) — those truths replaced the raw `<PLACEHOLDER>` tokens in the body (default-branch references, the subagent approved-model token, and the secrets/CI-provider lines). The `## Placeholders to fill` token list was deleted because, with the body filled in, it is stale inventory of work already done; the intro line was reworded to describe the file as project instructions rather than a kit to fill.

Model pinning split by policy: the **session** model is pinned in `opencode.jsonc` (the `model` key beside `default_agent`), while the **subagent** model (`opencode/qwen3.8-flash`) is named in AGENTS.md's delegation rule rather than as `model:` lines in `.agents/agents/*` — agents stay model-less and inherit the session model, which the README documents deliberately. README's contents map and "How to use" step 2 were touched only to keep prose consistent with a filled-in AGENTS.md (config "pins the session model"; AGENTS.md row + step 2 no longer say "fill the placeholders"). Why: leaving template tokens in place would make the authoritative instructions read as unset, and an unpinned session model risks subagents launching on a global default the policy explicitly does not approve.

Verified: `grep -nE '<[A-Z_]{3,}>' AGENTS.md` returns nothing (only lowercase example tokens like `<id>`, `<task>`, `<run-id>`, `<YYYY-MM-DD>-<slug>` remain in code/example contexts, as intended); `opencode.jsonc` parses as JSON; final `git diff main --stat` spans exactly the four expected files.

Follow-up (reviewer BLOCK on 5713459): deleting the `## Placeholders to fill` bullet list orphaned five values that lived only there — repo name, owner, language, test command, verify command had no body usages to fill, so after the first commit AGENTS.md stated none of them. Reviewer caught the loss. Fix adds a compact `## Project facts` section immediately after the intro, restoring those values to the authoritative instructions body rather than leaving them only in this log narrative. Session/subagent model split and all prior behavior unchanged; status block stays `done`.
