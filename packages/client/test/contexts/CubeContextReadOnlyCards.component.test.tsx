import React, { useContext } from 'react';

import { act, fireEvent, render, screen } from '@testing-library/react';

import '@testing-library/jest-dom';

import Cube from '@utils/datatypes/Cube';

import { ChangesContextProvider } from 'contexts/ChangesContext';
import { CSRFContext } from 'contexts/CSRFContext';
import CubeContext, { CubeContextProvider } from 'contexts/CubeContext';
import { DisplayContextProvider } from 'contexts/DisplayContext';
import { FilterContextProvider } from 'contexts/FilterContext';
import UserContext from 'contexts/UserContext';

jest.mock('utils/cardDetailsCache', () => ({
  getCardDetail: jest.fn(),
  getCardDetails: jest.fn(async () => ({})),
}));
jest.mock('components/card/CardModal', () => ({
  __esModule: true,
  default: ({ canEdit }: { canEdit: boolean }) => <div data-testid="card-modal" data-can-edit={String(canEdit)} />,
}));

const SORTS = ['Color Category', 'Types-Multicolor', 'Mana Value', 'Alphabetical'];

const cube = {
  id: 'c1',
  shortId: 'c1',
  name: 'Test Cube',
  owner: { id: 'owner' },
  defaultSorts: SORTS,
  views: [{ name: 'Mainboard', boards: ['mainboard'], displayView: 'table', defaultSorts: SORTS }],
} as unknown as Cube;

const details = { scryfall_id: 'a', oracle_id: 'oa', name: 'Card A' };
const cards = { mainboard: [{ cardID: 'a', index: 0, board: 'mainboard', details }], maybeboard: [] };

const OpenCard: React.FC = () => {
  const { canEdit, setModalSelection, setModalOpen } = useContext(CubeContext);
  return (
    <button
      data-can-edit={String(canEdit)}
      onClick={() => {
        setModalSelection({ board: 'mainboard', index: 0 });
        setModalOpen(true);
      }}
    >
      open
    </button>
  );
};

const renderAsOwner = (readOnlyCards: boolean) => {
  window.history.replaceState({}, '', '/cube/list/c1');
  render(
    <CSRFContext.Provider value={{ csrfFetch: jest.fn(), callApi: jest.fn() } as any}>
      <UserContext.Provider value={{ id: 'owner' } as any}>
        <DisplayContextProvider cubeID="c1" viewSlugs={['mainboard']}>
          <FilterContextProvider>
            <ChangesContextProvider cube={cube} cards={cards as any}>
              <CubeContextProvider initialCube={cube} cards={cards as any} readOnlyCards={readOnlyCards}>
                <OpenCard />
              </CubeContextProvider>
            </ChangesContextProvider>
          </FilterContextProvider>
        </DisplayContextProvider>
      </UserContext.Provider>
    </CSRFContext.Provider>,
  );
};

describe('CubeContextProvider readOnlyCards', () => {
  beforeEach(() => localStorage.clear());

  it.each([
    [false, 'true'],
    [true, 'false'],
  ])('with readOnlyCards=%s opens the card pop-up with canEdit=%s for the owner', async (readOnlyCards, expected) => {
    renderAsOwner(readOnlyCards);

    await act(async () => {
      fireEvent.click(screen.getByText('open'));
    });

    expect(screen.getByTestId('card-modal')).toHaveAttribute('data-can-edit', expected);
    // The context value keeps the owner's rights (e.g. the compare header's Tag Colors button).
    expect(screen.getByText('open')).toHaveAttribute('data-can-edit', 'true');
  });
});
