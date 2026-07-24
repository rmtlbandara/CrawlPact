# UI Components

Per-component documentation (SRS §10.54), consolidated in one file per ADR-0003 rather than 36
separate files. All components live in `packages/ui/src/components/`. The dev-only showcase at
`/dev/components` (disabled in production, disallowed in robots.txt) renders every component
listed here for manual and visual-regression QA.

Unless noted, every component: is keyboard operable (Tab/Shift+Tab, Enter/Space, Escape where
applicable), exposes an accessible name (visible label, `aria-label`, or both), supports a
`disabled` state where relevant, and is responsive by virtue of using relative Tailwind
utilities rather than fixed pixel widths.

| Component                                  | Purpose                                        | States beyond default                                                  | A11y / keyboard notes                                                                                                                         |
| ------------------------------------------ | ---------------------------------------------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `Button`                                   | Primary/secondary/tertiary/destructive actions | hover, focus-visible, active, disabled, loading (spinner, `aria-busy`) | One primary button per view (SRS §10.20)                                                                                                      |
| `IconButton`                               | Icon-only action                               | same as Button                                                         | `label` prop is mandatory — becomes `aria-label` and `title`                                                                                  |
| `Link`                                     | Styled anchor                                  | hover, focus-visible                                                   | Plain `<a>` — no client router                                                                                                                |
| `FormField`                                | Label/description/error/success wrapper        | error (`role="alert"`), success                                        | Wires `aria-describedby`/`aria-invalid` onto its child automatically                                                                          |
| `Input`, `Textarea`                        | Text entry                                     | placeholder, invalid, disabled, read-only                              | Always paired with `FormField` for a persistent label                                                                                         |
| `SearchField`                              | Search input with icon                         | —                                                                      | Visually hidden `<label>`, never placeholder-only                                                                                             |
| `Select`                                   | Native-feeling single choice                   | open, highlighted item, disabled                                       | Full Radix Select keyboard support                                                                                                            |
| `Combobox`                                 | Filterable single choice                       | open, filtered, no-match                                               | Implements the ARIA combobox pattern directly (documented exception to "always use Radix" in ADR-0003, since Radix has no combobox primitive) |
| `Checkbox`, `Radio`/`RadioGroup`, `Switch` | Boolean/choice controls                        | checked, indeterminate (checkbox), disabled                            | Radix primitives; visible label always rendered, not just `aria-label`                                                                        |
| `StatusChip`                               | Status indicator                               | 6 tones (success/warning/error/critical/info/unknown)                  | Colour is never the only signal — text label always present                                                                                   |
| `Tooltip`, `Popover`, `DropdownMenu`       | Contextual layers                              | open/closed                                                            | Radix; Escape closes, focus returns to trigger                                                                                                |
| `Modal`, `ConfirmDialog`, `Drawer`         | Blocking/side-panel dialogs                    | open/closed                                                            | Radix Dialog: focus trap, Escape, focus restoration. `ConfirmDialog` supports required typed confirmation (SRS §10.36)                        |
| `Tabs`                                     | Sectioned content                              | active tab                                                             | `value`/`onValueChange` are controllable for URL-synced state (SRS §10.31)                                                                    |
| `Accordion`                                | Collapsible sections                           | open/closed per item                                                   | Used for FAQ (SRS §9.17)                                                                                                                      |
| `Breadcrumb`, `Pagination`                 | Navigation aids                                | current page (`aria-current`)                                          | —                                                                                                                                             |
| `Card`, `MetricCard`                       | Content grouping                               | —                                                                      | Border + minimal shadow per SRS §10.19                                                                                                        |
| `Alert`, `Banner`                          | Inline / persistent messaging                  | 6 tones (Alert), 3 tones (Banner)                                      | `role="alert"` for error/critical Alert; Banner is `role="status"`                                                                            |
| `Toast` (+`ToastProvider`)                 | Transient feedback                             | auto-dismiss (5s), manual dismiss                                      | `aria-live="polite"` region; never used for persistent errors (SRS §10.37)                                                                    |
| `Skeleton`                                 | Loading placeholder                            | —                                                                      | `role="status"`, respects `prefers-reduced-motion` globally                                                                                   |
| `EmptyState`, `ErrorState`                 | Zero-data / failure explanation                | —                                                                      | Always explain what/why/action (SRS §10.34–§10.35); `ErrorState` supports collapsible technical detail                                        |
| `ProgressSteps`                            | Multi-stage progress (audit scan)              | current, completed                                                     | Never shows a fabricated percentage (SRS §10.32)                                                                                              |
| `DataTable`                                | Tabular data foundation                        | loading, empty, error                                                  | Sticky header, responsive column hiding via `hideBelow`                                                                                       |
| `CodeBlock`                                | Monospace code/evidence display                | copied (transient)                                                     | Line numbers, copy button, horizontal scroll                                                                                                  |
| `DiffViewer`                               | Configuration diff foundation                  | added/removed/unchanged lines                                          | Uses `+`/`-` glyphs and `aria-label`, not colour alone (SRS §10.28)                                                                           |
| `ScoreComponent`                           | Policy Health Score foundation                 | scored, incomplete                                                     | Horizontal band, not a gauge — avoids implying false precision (SRS §10.24)                                                                   |

## Prohibited usage (applies to all components)

- Do not introduce a second headless component library alongside Radix (ADR-0003).
- Do not hard-code a colour, spacing, radius, or shadow value that has a token — extend
  `tokens.css` instead.
- Do not render target-controlled text unescaped (see `docs/security/SSRF_SECURITY_MODEL.md`)
  — React already escapes text children by default; never use `dangerouslySetInnerHTML` with
  scan-derived content.
