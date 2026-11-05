const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

// Default name for a one-click record: "Draft on 8 June, 2026".
export const defaultRecordName = (date: Date): string =>
  `Draft on ${date.getDate()} ${MONTHS[date.getMonth()]}, ${date.getFullYear()}`;

/**
 * The day `date` falls on for the organiser, stored the way a record's date is stored
 * everywhere else: midnight UTC of that day.
 *
 * A record's date is a day, not an instant. EditDescription's date input round-trips it
 * through UTC midnight and FormatttedDate renders it back in UTC, so a picked date reads back
 * as the day it was picked. Auto-created records used to store `Date.now()` and name
 * themselves from its *local* day, so west of UTC an evening draft was named one day and
 * listed as the next.
 */
export const defaultRecordDate = (date: Date): number => Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
