// Spreadsheet apps treat a cell starting with one of these as a formula (or, for tab/CR, strip it
// and then look again), so user-controlled text like a tag of `=HYPERLINK(...)` would execute
// when someone opens an export.
const FORMULA_TRIGGER = /^[=+\-@\t\r]/;

/**
 * Formats one CSV cell: neutralizes formula triggers in text by prefixing a `'`, doubles
 * embedded quotes and wraps the result in quotes (RFC 4180). Numbers and booleans are never
 * prefixed, so a value like -1 still reads as a number.
 */
const csvCell = (value: unknown): string => {
  let text = value === null || value === undefined ? '' : String(value);
  if (typeof value === 'string' && FORMULA_TRIGGER.test(text)) {
    text = `'${text}`;
  }
  return `"${text.replace(/"/g, '""')}"`;
};

/** Joins values into one CSV row, formatting each with csvCell. */
export const csvRow = (values: unknown[]): string => values.map(csvCell).join(',');

/**
 * Reverses csvCell's formula neutralization on an imported (already unquoted) cell, so exports
 * round-trip: `'+2 Mace` comes back as `+2 Mace`.
 */
export const fromCsvCell = <T>(value: T): T => {
  if (typeof value === 'string' && value.startsWith("'") && FORMULA_TRIGGER.test(value.slice(1))) {
    return value.slice(1) as T;
  }
  return value;
};
