# Records

Informal, point-in-time notes: ideas, specs, decisions, things tried and abandoned, things to revisit. Ordered by sequence number, not topic.

## Convention

- **Filename:** `NNN-kebab-title.md` (zero-padded, monotonically increasing).
- **Body:** whatever the entry needs. A paragraph, a full spec, an ADR-style decision — no required sections.

### Frontmatter

```yaml
---
date: 2026-05-14       # required — when first written
updated: 2026-05-20    # optional — only if meaningfully revised
status: idea           # required — see below
---
```

### Status values

| Status      | Meaning |
|-------------|---------|
| `idea`      | A note, thought, or thing to revisit. Not committed to. |
| `planned`   | Going to do this. Not started, in progress, or partially done. |
| `shipped`   | Done. The record is now historical context. |
| `dropped`   | Tried or considered, abandoned. |

Records are time capsules — write-once, mostly. For living documentation that needs to stay accurate (architecture, runbooks, troubleshooting guides), use a regular `docs/<topic>.md` file instead.

Records are append-only and never renumbered. If something is superseded or revisited, write a new record referencing the old one.
