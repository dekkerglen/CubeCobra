import React from 'react';

import { fireEvent, render, screen } from '@testing-library/react';

import '@testing-library/jest-dom';

import { P1P1Pack } from '@utils/datatypes/P1P1Pack';

import PreviousP1P1sCard from 'components/p1p1/PreviousP1P1sCard';
import { CSRFContext } from 'contexts/CSRFContext';

// The real preview pulls in a delete modal, user/cube contexts and autocards; the only behaviour
// this suite needs from it is a handle on the pack and a way to report it deleted.
jest.mock('components/p1p1/P1P1Preview', () => ({
  __esModule: true,
  default: ({ pack, onDeleted }: any) => (
    <div>
      <span>{`Pack ${pack.id}`}</span>
      <button type="button" aria-label={`delete ${pack.id}`} onClick={() => onDeleted(pack.id)}>
        delete
      </button>
    </div>
  ),
}));

const makePacks = (count: number): P1P1Pack[] =>
  Array.from(
    { length: count },
    (_, index) =>
      ({
        id: `${index + 1}`,
        cubeId: 'cube-1',
        createdBy: 'user-1',
        createdByUsername: 'user',
        date: 1700000000000 + index,
        votesByUser: {},
        cards: [],
        seed: 'seed',
      }) as P1P1Pack,
  );

const renderCard = (packs: P1P1Pack[], packsLastKey: any = null, csrfFetch = jest.fn()) =>
  render(
    <CSRFContext.Provider value={{ csrfToken: 'token', csrfFetch, callApi: jest.fn() } as any}>
      <PreviousP1P1sCard packs={packs} packsLastKey={packsLastKey} cubeId="cube-1" cubeOwner="user-1" />
    </CSRFContext.Provider>,
  );

// Both the header and footer render a pager, so every control has two matches.
const clickNextPage = () => fireEvent.click(screen.getAllByLabelText('Next page')[0]);

const deletePack = (id: string) => fireEvent.click(screen.getByLabelText(`delete ${id}`));

describe('PreviousP1P1sCard', () => {
  it('renders the header with no loaded-record count', () => {
    renderCard(makePacks(3));

    expect(screen.getByText('P1P1s')).toBeInTheDocument();
    expect(screen.queryByText(/P1P1s \(/)).not.toBeInTheDocument();
  });

  it('shows no pager when there are no packs', () => {
    renderCard([]);

    expect(screen.queryByText(/Page/)).not.toBeInTheDocument();
  });

  // The footer is a bordered strip; before it tracked the pager's own visibility rule it drew as an
  // empty divider under every cube whose packs fit on one page, and under cubes with no packs at all.
  it('draws no empty bordered footer when every pack fits on one page', () => {
    const { container } = renderCard(makePacks(3));

    expect(screen.queryByText(/Page/)).not.toBeInTheDocument();
    expect(container.querySelector('.border-t')).toBeNull();
    expect(screen.getByText('Pack 1')).toBeInTheDocument();
  });

  it('draws no empty bordered footer when there are no packs at all', () => {
    const { container } = renderCard([]);

    expect(container.querySelector('.border-t')).toBeNull();
  });

  it('draws the bordered footer once there is a pager to put in it', () => {
    const { container } = renderCard(makePacks(3), { id: 'cursor' });

    expect(screen.getAllByText('Page 1').length).toBeGreaterThan(0);
    expect(container.querySelector('.border-t')).not.toBeNull();
  });

  it('renders Page 1 with no denominator', () => {
    renderCard(makePacks(25), { id: 'cursor' });

    expect(screen.getAllByText('Page 1').length).toBeGreaterThan(0);
    expect(screen.queryByText(/ of /i)).not.toBeInTheDocument();
  });

  it('does not strand the viewer past the end when packs are deleted', async () => {
    // 25 packs at a page size of 10 is three loaded pages; the cursor keeps the pager rendered
    // once the list shrinks back to a single page.
    renderCard(makePacks(25), { id: 'cursor' });

    clickNextPage();
    clickNextPage();
    expect(screen.getAllByText('Page 3').length).toBeGreaterThan(0);
    expect(screen.getByText('Pack 21')).toBeInTheDocument();

    // Delete the whole third page, then the whole second, leaving one page under a viewer whose
    // position is still page three.
    for (let id = 21; id <= 25; id += 1) {
      deletePack(`${id}`);
    }
    for (let id = 11; id <= 20; id += 1) {
      deletePack(`${id}`);
    }

    expect(screen.getAllByText('Page 1').length).toBeGreaterThan(0);
    expect(screen.getByText('Pack 1')).toBeInTheDocument();
  });
});
