# Phase 21 Design System Gap Analysis

## Gap found and closed: `DataTable` had no way to hide a column past 768px

`packages/ui/src/components/DataTable.tsx`'s `hideBelow` option only supported `"sm" | "md" |
"lg"` — under this project's remapped breakpoint scale, `lg` is 768px, which was already the
_widest_ tier available. Any column that genuinely needed to stay hidden until desktop (1024px,
`xl`) had no way to express that; the closest available option (`lg`) made it appear exactly at
the tablet width where — as FINDING-01 in `UX_FINDING_REGISTER.md` shows — a table with several
other columns already visible often doesn't have room for a sentence-length column yet.

**Closed**: added an `"xl"` tier (`hidden xl:table-cell`) to both the `hideBelow` type union and
the `HIDE_CLASSES` map. `RuntimeConfigManager.tsx`'s description column now uses it. No other
consumer needed it this phase (see FINDING-01's disposition for why the other `hideBelow: "lg"`
columns elsewhere don't reproduce the same failure), but the option now exists for the next table
that needs it, instead of being invented ad hoc again.

## Gap found and closed: long monospace identifiers had no wrap strategy

Nine admin manager components rendered identifier-like values (database IDs, setting keys,
webhook event IDs, scan IDs, user-agent tokens, blocked-target patterns) in a `font-mono` span with
no `break-all`, while one sibling component (`RegistryReleasesManager.tsx`) already had the
correct treatment. This is exactly the kind of consistency drift a whole-product pass is meant to
catch: a fix applied once, in one place, that was never propagated to its siblings using the
identical pattern. All nine are now consistent with the one that was already correct.

## Gap **not** closed this phase: no shared "long value" column convention

The fix above is applied per-callsite (`break-all` on each span). A more structural fix would be a
`DataTableColumn` option like `wrap: "break-all" | "normal"` so this is declared once per column
definition and enforced at the type level, rather than relying on each new manager component's
author remembering to add the class by hand (which is exactly how the original inconsistency
happened). Not implemented this phase — it's a larger API change to a shared component with many
call sites, better suited to its own reviewed change than folded into a bug-fix pass. Recorded here
so it isn't silently lost; a candidate for `docs/risks/ACTIVE_RISKS.md` if a future admin table
reintroduces the same class of bug.

## No dark-theme, spacing-token, or typography gaps found

Consistent with `docs/design/DESIGN_SYSTEM.md`'s existing statements (light-theme-only by design,
Tailwind's default spacing scale reused as-is, system font stack) — nothing in this phase's review
contradicted those documented decisions, and none of the surfaces inspected showed a token-level
inconsistency (arbitrary hex colours, off-scale spacing, etc.).
