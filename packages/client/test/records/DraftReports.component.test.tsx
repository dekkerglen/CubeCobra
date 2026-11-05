import React from 'react';

import { render, screen, within } from '@testing-library/react';

import '@testing-library/jest-dom';

import Cube from '@utils/datatypes/Cube';
import Record from '@utils/datatypes/Record';

import { CSRFContext } from 'contexts/CSRFContext';
import CubeContext from 'contexts/CubeContext';

import DraftReports from '../../src/records/DraftReports';

const cube = { id: 'cube-1', name: 'My Cube' } as unknown as Cube;

const record = (overrides: Partial<Record> = {}): Record =>
  ({
    id: 'rec-1',
    cube: 'cube-1',
    // Midnight UTC, the way a record's date is stored everywhere.
    date: Date.UTC(2026, 10, 4),
    name: 'Tuesday Night',
    description: '',
    players: [{ name: 'Alice' }, { name: 'Bob' }],
    matches: [{ matches: [{ p1: 'Alice', p2: 'Bob', results: [2, 1, 0] }] }],
    trophy: [],
    ...overrides,
  }) as Record;

const renderList = (records: Record[], canEdit = true) =>
  render(
    <CSRFContext.Provider value={{ csrfToken: 't', csrfFetch: jest.fn(), callApi: jest.fn() } as any}>
      <CubeContext.Provider value={{ cube, canEdit } as any}>
        <DraftReports records={records} lastKey={null} />
      </CubeContext.Provider>
    </CSRFContext.Provider>,
  );

const row = (name: string) => screen.getByText(name).closest('tr') as HTMLElement;

/**
 * This list exists to pick a record out of a pile of them. It showed name, date and a raw
 * comma-joined list of player names — so two records created the same day under the default
 * name were identical on screen even when one held four players and two rounds and the other
 * was an empty shell. What distinguishes them is how much is in them.
 */
describe('DraftReports', () => {
  it('heads the columns that tell records apart', () => {
    renderList([record()]);

    const headers = [...screen.getAllByRole('columnheader')].map((h) => h.textContent?.trim());
    expect(headers).toEqual(['Name', 'Date', 'Players', 'Rounds', 'Winner', '']);
  });

  it('counts the players rather than naming them', () => {
    renderList([record({ players: [{ name: 'Alice' }, { name: 'Bob' }, { name: 'Carol' }] })]);

    const cells = within(row('Tuesday Night')).getAllByRole('cell');
    expect(cells[2]).toHaveTextContent('3');
    // Names belong on the record page, where there is room for sixteen of them.
    expect(screen.queryByText(/Alice/)).not.toBeInTheDocument();
  });

  it('counts the rounds', () => {
    renderList([record({ matches: [{ matches: [] }, { matches: [] }] })]);

    expect(within(row('Tuesday Night')).getAllByRole('cell')[3]).toHaveTextContent('2');
  });

  it('shows an empty record as empty rather than as a blank cell', () => {
    renderList([record({ players: [], matches: [], trophy: [] })]);

    const cells = within(row('Tuesday Night')).getAllByRole('cell');
    expect(cells[2]).toHaveTextContent('0');
    expect(cells[3]).toHaveTextContent('0');
  });

  it('names the winner, and says so when there is none yet', () => {
    renderList([record({ trophy: ['Alice'] }), record({ id: 'rec-2', name: 'Thursday Night', trophy: [] })]);

    expect(within(row('Tuesday Night')).getAllByRole('cell')[4]).toHaveTextContent('Alice');
    expect(within(row('Thursday Night')).getAllByRole('cell')[4]).toHaveTextContent('—');
  });

  it('names every winner when a record has more than one', () => {
    renderList([record({ trophy: ['Alice', 'Bob'] })]);

    expect(within(row('Tuesday Night')).getAllByRole('cell')[4]).toHaveTextContent('Alice, Bob');
  });

  // The two counts are the first thing to go when the row runs out of width; the name, date
  // and player count are what a reader needs to find the record at all.
  it('drops the secondary columns on a narrow viewport', () => {
    renderList([record()]);

    const headers = [...screen.getAllByRole('columnheader')];
    const hidden = headers.filter((h) => h.className.includes('hidden')).map((h) => h.textContent?.trim());
    expect(hidden).toEqual(['Rounds', 'Winner']);
  });

  it('offers no delete control to someone who cannot edit the cube', () => {
    renderList([record()], false);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
