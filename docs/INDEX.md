# Documentation Index

Master navigation. Token estimates help you decide what to load.

---

## Always-Load Files (~800 tokens total)

| File | Tokens | Purpose |
|---|---|---|
| `CLAUDE.md` | ~200 | Project overview + session protocol |
| `.claude/COMMON_MISTAKES.md` | ~350 | Critical gotchas — ALWAYS load |
| `.claude/QUICK_START.md` | ~200 | Commands + workflows |
| `.claude/ARCHITECTURE_MAP.md` | ~300 | Where everything lives |

---

## Load by Task Type

### Working on the Database / Backend Data

Load: `docs/learnings/database-patterns.md` (~400 tokens)

- Schema patterns, migration approach
- Raw SQL via better-sqlite3
- JSON column handling (`category_ids`, `fixed_days`, `urls`)
- WAL mode considerations

### Adding or Modifying API Endpoints

Load: `docs/learnings/api-design.md` (~350 tokens)

- Route structure conventions
- Error response patterns
- Fixed task expansion logic
- File upload with multer

### Working on Frontend / React Views

Load: `docs/learnings/frontend-patterns.md` (~400 tokens)

- Component patterns (functional + hooks)
- How to add a new view + route
- `api.js` fetch wrapper usage
- CategoryContext usage
- dateUtils / categoryUtils helpers

### Debugging Unexpected Behavior

Load: `docs/learnings/common-pitfalls.md` (~300 tokens)

- Anti-patterns found in this project
- Status string gotchas
- Proxy vs production mode confusion

### QA / Manual Testing

Load: `docs/learnings/testing-patterns.md` (~250 tokens)

- Manual testing checklists per view type
- What to verify after each type of change

---

## Navigation by Decision

```
Need to add a feature?
  └── Backend endpoint → api-design.md
  └── Frontend view  → frontend-patterns.md
  └── DB change      → database-patterns.md

Something broken?
  └── Start with COMMON_MISTAKES.md (already loaded)
  └── Weird data behavior → database-patterns.md
  └── UI not updating → frontend-patterns.md
  └── API returning wrong data → api-design.md

Code review?
  └── common-pitfalls.md

Done with task?
  └── Create completion doc → .claude/templates/completion-template.md
```

---

## Never Auto-Load

| Path | Reason |
|---|---|
| `.claude/completions/**` | Historical task records — load on explicit request only |
| `.claude/sessions/**` | Session notes — load on explicit request only |
| `docs/archive/**` | Superseded docs — load on explicit request only |

---

## Before/After Token Comparison

| Scenario | Before (no structure) | After (this structure) |
|---|---|---|
| Session start | ~8,000 tokens | ~800 tokens |
| Session + one feature | ~12,000 tokens | ~1,200 tokens |
| Full debug session | ~15,000 tokens | ~2,000 tokens |
| Savings | — | ~85–90% |
