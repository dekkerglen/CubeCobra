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
