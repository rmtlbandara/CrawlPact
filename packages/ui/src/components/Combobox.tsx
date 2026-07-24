import { useId, useState } from "react";
import { cx } from "../cx";

export type ComboboxOption = { value: string; label: string };

export type ComboboxProps = {
  label: string;
  options: ComboboxOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
};

/**
 * Combobox foundation (SRS §10.53). Implements the WAI-ARIA combobox
 * pattern (listbox popup, `aria-expanded`, `aria-activedescendant`) directly
 * since Radix has no dedicated combobox primitive; this is the one
 * exception to "delegate to Radix" in ADR-0003, scoped narrowly to this
 * component. Full type-ahead ranking is a Part 2+ concern (e.g. the
 * crawler-search combobox) — this foundation covers open/close, filtering,
 * and keyboard selection.
 */
export function Combobox({ label, options, value, onChange, placeholder }: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const listId = useId();
  const inputId = useId();

  const filtered = query
    ? options.filter((option) => option.label.toLowerCase().includes(query.toLowerCase()))
    : options;

  return (
    <div className="relative">
      <label htmlFor={inputId} className="sr-only">
        {label}
      </label>
      <input
        id={inputId}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        autoComplete="off"
        value={query || value}
        placeholder={placeholder}
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") setOpen(false);
        }}
        className="h-11 w-full rounded-control border border-neutral-300 bg-white px-3 text-body focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
      />
      {open && filtered.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-dropdown mt-1 w-full rounded-card border border-neutral-200 bg-white shadow-elevated"
        >
          {filtered.map((option) => (
            <li key={option.value}>
              <button
                type="button"
                role="option"
                aria-selected={option.value === value}
                onClick={() => {
                  onChange(option.value);
                  setQuery("");
                  setOpen(false);
                }}
                className={cx(
                  "block w-full px-3 py-2 text-left text-body text-neutral-800 hover:bg-brand-50",
                  option.value === value && "bg-brand-50 text-brand-800",
                )}
              >
                {option.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
