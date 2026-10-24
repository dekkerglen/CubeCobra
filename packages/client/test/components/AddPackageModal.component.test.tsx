import React from 'react';

import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import '@testing-library/jest-dom';

import AddPackageModal from 'components/modals/AddPackageModal';
import { CSRFContext } from 'contexts/CSRFContext';
import CubeContext from 'contexts/CubeContext';
import UserContext from 'contexts/UserContext';
import { getCards } from 'utils/cards/getCards';

import { createCardDetails, createCube, createUser } from '../../../server/test/test-utils/data';

jest.mock('utils/cards/getCards');
jest.mock('utils/analytics', () => ({ trackEvent: jest.fn() }));

const AUTOTAG_LABEL = 'Tag cards with package name';
const PRINTING_LABEL = "Use the cube's default printing";

const PACKAGE_PRINTING_ID = 'pkg-printing';
const PREFERRED_PRINTING_ID = 'preferred-printing';

const user = createUser({ id: 'user-1' });
const cube = createCube({ id: 'cube-1', defaultPrinting: 'recent', defaultStatus: 'Owned' });

const cardPackage = {
  id: 'pack-1',
  title: 'Sweet Package',
  cards: [createCardDetails({ scryfall_id: PACKAGE_PRINTING_ID, name: 'Lightning Bolt' })],
};

const packageFetch = (url: string) => {
  if (url.includes('/user/getmorepackages')) {
    return Promise.resolve({ ok: true, json: async () => ({ packages: [cardPackage] }) });
  }
  return Promise.resolve({ ok: true, json: async () => ({ packages: [] }) });
};

const renderModal = async ({ bulkAddCard = jest.fn(), cubeOverrides = {} } = {}) => {
  const csrfFetch = jest.fn(packageFetch);

  render(
    <CSRFContext.Provider value={{ csrfToken: 'token', csrfFetch, callApi: jest.fn() } as any}>
      <UserContext.Provider value={user as any}>
        <CubeContext.Provider value={{ cube: { ...cube, ...cubeOverrides }, bulkAddCard } as any}>
          <AddPackageModal isOpen setOpen={jest.fn()} boardToEdit="mainboard" />
        </CubeContext.Provider>
      </UserContext.Provider>
    </CSRFContext.Provider>,
  );

  await screen.findByRole('combobox');
  return { bulkAddCard };
};

const selectPackage = () => fireEvent.change(screen.getByRole('combobox'), { target: { value: cardPackage.id } });

const addedCards = (bulkAddCard: jest.Mock) => bulkAddCard.mock.calls[0][0];

describe('AddPackageModal', () => {
  beforeEach(() => {
    window.localStorage.clear();
    jest.clearAllMocks();
  });

  it('offers autotagging on and the printing override off by default', async () => {
    await renderModal();

    expect(screen.getByLabelText(AUTOTAG_LABEL)).toBeChecked();
    expect(screen.getByLabelText(PRINTING_LABEL)).not.toBeChecked();
  });

  it('does not offer the blog post or upvote options', async () => {
    await renderModal();

    expect(screen.queryByLabelText('Create blog post')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('+1 this package')).not.toBeInTheDocument();
  });

  it('tags added cards with the package name when autotagging', async () => {
    const { bulkAddCard } = await renderModal();
    selectPackage();

    fireEvent.click(screen.getByText('Add Cards'));

    await waitFor(() => expect(bulkAddCard).toHaveBeenCalled());
    expect(addedCards(bulkAddCard as jest.Mock)[0].tags).toEqual([cardPackage.title]);
  });

  it('leaves cards untagged when autotagging is off', async () => {
    const { bulkAddCard } = await renderModal();
    fireEvent.click(screen.getByLabelText(AUTOTAG_LABEL));
    selectPackage();

    fireEvent.click(screen.getByText('Add Cards'));

    await waitFor(() => expect(bulkAddCard).toHaveBeenCalled());
    expect(addedCards(bulkAddCard as jest.Mock)[0].tags).toEqual([]);
  });

  it('keeps the package printing when the override is off', async () => {
    const { bulkAddCard } = await renderModal();
    selectPackage();

    fireEvent.click(screen.getByText('Add Cards'));

    await waitFor(() => expect(bulkAddCard).toHaveBeenCalled());
    expect(getCards).not.toHaveBeenCalled();
    expect(addedCards(bulkAddCard as jest.Mock)[0].cardID).toEqual(PACKAGE_PRINTING_ID);
  });

  it("replaces the package printing with the cube's default printing when the override is on", async () => {
    (getCards as jest.Mock).mockResolvedValue([createCardDetails({ scryfall_id: PREFERRED_PRINTING_ID })]);
    const { bulkAddCard } = await renderModal();
    fireEvent.click(screen.getByLabelText(PRINTING_LABEL));
    selectPackage();

    fireEvent.click(screen.getByText('Add Cards'));

    await waitFor(() => expect(bulkAddCard).toHaveBeenCalled());
    expect(getCards).toHaveBeenCalledWith(expect.any(Function), 'recent', ['Lightning Bolt']);
    expect(addedCards(bulkAddCard as jest.Mock)[0].cardID).toEqual(PREFERRED_PRINTING_ID);
  });

  it('falls back to the package printing when the cube preference resolves nothing', async () => {
    (getCards as jest.Mock).mockResolvedValue([null]);
    const { bulkAddCard } = await renderModal();
    fireEvent.click(screen.getByLabelText(PRINTING_LABEL));
    selectPackage();

    fireEvent.click(screen.getByText('Add Cards'));

    await waitFor(() => expect(bulkAddCard).toHaveBeenCalled());
    expect(addedCards(bulkAddCard as jest.Mock)[0].cardID).toEqual(PACKAGE_PRINTING_ID);
  });

  it('falls back to the site default preference when the cube has none stored', async () => {
    (getCards as jest.Mock).mockResolvedValue([createCardDetails({ scryfall_id: PREFERRED_PRINTING_ID })]);
    await renderModal({ cubeOverrides: { defaultPrinting: '' } });
    fireEvent.click(screen.getByLabelText(PRINTING_LABEL));
    selectPackage();

    fireEvent.click(screen.getByText('Add Cards'));

    await waitFor(() => expect(getCards).toHaveBeenCalled());
    expect(getCards).toHaveBeenCalledWith(expect.any(Function), 'default', ['Lightning Bolt']);
  });

  it('reads the options from the shared keys', async () => {
    window.localStorage.setItem('packageAddAutoTag', 'false');
    window.localStorage.setItem('packageAddUseDefaultPrinting', 'true');

    await renderModal();

    expect(screen.getByLabelText(AUTOTAG_LABEL)).not.toBeChecked();
    expect(screen.getByLabelText(PRINTING_LABEL)).toBeChecked();
  });
});
