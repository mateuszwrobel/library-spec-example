# Agent frontmatter YAML fixes; agents inherit session model

```json
{
  "status": "done",
  "links": {
    "commits": ["bd22468", "714c742"]
  }
}
```

One task, two commits. Removed the explicit `model:` key from every agent def so agents inherit the session model — the shipped `gateway/deepseek-v4-flash` tokens were example values leaked from the source project, and opencode already falls back to the session model when `model:` is absent; README's model note was rewritten to say agents ship without a `model:` line and consumers add one only to pin a fixed model. Fixed frontmatter YAML parsing twice: an unquoted `description:` value containing a colon is not valid YAML, and git-ops's "Clean context: no coding" broke loading (bd22468 replaced the colon with an em dash); the orchestrator rewrite later reintroduced the same class of bug ("Owns the session: understand, plan…"), fixed the same way in 714c742. Why: model inheritance keeps one model policy in one place, and the colon rule prevents the load failure from recurring when descriptions are reworded.
