import { defaultRecordDate, defaultRecordName } from '../../src/records/recordName';

/**
 * A record's `date` is a day, not an instant. `EditDescription`'s date input round-trips it
 * through UTC midnight (`new Date('2026-11-04').valueOf()`), and `FormatttedDate` renders it
 * back in UTC, so a date the organiser picks reads back as the day they picked.
 *
 * Auto-created records broke that convention: they stored `Date.now()` — a real instant — and
 * named themselves from its *local* calendar day. For anyone west of UTC drafting in the
 * evening the two disagreed, so the list showed "Draft on 4 November, 2026" on a row dated
 * 11/05/2026. These pin both halves to the organiser's local day.
 */
describe('defaultRecordDate', () => {
  const at = (iso: string) => new Date(iso);

  it('stores the organiser local day as UTC midnight', () => {
    // 20:54 on 4 November in UTC-5 is already 5 November in UTC.
    const evening = at('2026-11-05T01:54:00Z');
    const stored = defaultRecordDate(evening);

    // Whatever the runner's zone, the stored value is midnight UTC of the local day.
    expect(new Date(stored).toISOString()).toEqual(
      `${evening.getFullYear()}-${`${evening.getMonth() + 1}`.padStart(2, '0')}-${`${evening.getDate()}`.padStart(2, '0')}T00:00:00.000Z`,
    );
  });

  it('names the record the same day it stores', () => {
    const evening = at('2026-11-05T01:54:00Z');

    const name = defaultRecordName(evening);
    const rendered = new Date(defaultRecordDate(evening)).toLocaleDateString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      timeZone: 'UTC',
    });

    // The day in the name is the day the Date column will show, which is the whole point.
    expect(name).toContain(`${evening.getDate()} `);
    expect(rendered.startsWith(`${`${evening.getMonth() + 1}`.padStart(2, '0')}/`)).toBe(true);
    expect(rendered).toContain(`${`${evening.getDate()}`.padStart(2, '0')}`);
  });

  it('carries no time of day', () => {
    const stored = new Date(defaultRecordDate(at('2026-06-08T17:23:45Z')));

    expect([stored.getUTCHours(), stored.getUTCMinutes(), stored.getUTCSeconds(), stored.getUTCMilliseconds()]).toEqual(
      [0, 0, 0, 0],
    );
  });
});
