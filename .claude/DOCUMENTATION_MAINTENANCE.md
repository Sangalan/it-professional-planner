# Documentation Maintenance Guide

## When to Update `COMMON_MISTAKES.md`

**Trigger:** Any of these events
- A bug is found that was caused by a non-obvious codebase behavior
- A production/runtime error that took >15 min to debug
- A pattern that was done wrong on first attempt

**Do NOT add:** Generic programming advice. Only project-specific gotchas.

**Format:**
```markdown
## N. Short Title of Mistake

**Wrong:** [code or description of the bad approach]
**Right:** [correct approach with code snippet]
[1–2 sentences explaining WHY this is a gotcha in this project]
```

---

## When to Create a Completion Doc

**Trigger:** Every significant task completion (feature, bug fix, refactor)

**Location:** `.claude/completions/YYYY-MM-DD-short-title.md`

**Use template:** `.claude/templates/completion-template.md`

**⚠️ Never auto-load completions.** They are reference-only, loaded on explicit request.

---

## When to Create a Session Doc

**Trigger:** Long sessions (>1 hour), complex debugging, or multi-day work

**Location:** `.claude/sessions/active/YYYY-MM-DD-topic.md`
**Archive to:** `.claude/sessions/archive/` when session is done

**Use template:** `.claude/templates/session-template.md`

---

## When to Update Learnings Files

**Trigger:** You discover a new pattern or best practice that isn't obvious from reading the code

**Decision tree:**
```
Is it a mistake/gotcha?
  → Yes → COMMON_MISTAKES.md
  → No, it's a general pattern:
      DB-related? → docs/learnings/database-patterns.md
      API-related? → docs/learnings/api-design.md
      Frontend/React? → docs/learnings/frontend-patterns.md
      Anti-pattern? → docs/learnings/common-pitfalls.md
```

---

## When to Archive Docs

**Archive when:** A file documents a decision that is now complete and unlikely to change (planning docs, POC summaries, old architecture diagrams).

**Move to:** `docs/archive/`

**Keep a one-line note** in `docs/archive/README.md` explaining what was archived and why.

---

## When to Update `ARCHITECTURE_MAP.md`

- New view added to `frontend/src/views/`
- New table added to the database
- New API endpoint group added to `server.js`
- New utility file added to `frontend/src/utils/`

---

## When to Update `docs/INDEX.md`

- Any new learnings file added
- Token estimates change significantly
- New workflow documented
