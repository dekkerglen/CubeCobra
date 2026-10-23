import React from 'react';

import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import '@testing-library/jest-dom';

import AddGroupToCubeModal from 'components/modals/AddGroupToCubeModal';
import { CSRFContext } from 'contexts/CSRFContext';
import UserContext from 'contexts/UserContext';

import { createCardDetails, createCube, createUser } from '../../../server/test/test-utils/data';

const PRINTING_CHECKBOX_LABEL = "Use the cube's default printing";

// CardList renders autocards, which probe the pointer type; jsdom has no matchMedia.
beforeAll(() => {
  window.matchMedia = jest.fn().mockReturnValue({
    matches: false,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  }) as any;
});

const user = createUser({ id: 'user-1' });
const cube = createCube({ id: 'cube-1', name: 'My Cube' });
const cards = [createCardDetails({ scryfall_id: 'pkg-printing', name: 'Lightning Bolt' })];

const okResponse = { ok: true, json: async () => ({ success: 'true' }) };

const renderModal = ({ csrfFetch = jest.fn().mockResolvedValue(okResponse), withPackage = true } = {}) =>
  render(
    <CSRFContext.Provider value={{ csrfToken: 'token', csrfFetch, callApi: jest.fn() } as any}>
      <UserContext.Provider value={user as any}>
        <AddGroupToCubeModal
          cards={cards}
          isOpen
          setOpen={jest.fn()}
          cubes={[cube] as any}
          packid={withPackage ? 'pack-1' : undefined}
          voters={[user.id]}
        />
      </UserContext.Provider>
    </CSRFContext.Provider>,
  );

const bodyOf = (csrfFetch: jest.Mock) =>
  JSON.parse(csrfFetch.mock.calls.find(([url]: [string]) => url.includes('addtocube'))[1].body);

describe('AddGroupToCubeModal', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('offers the printing override unchecked by default', () => {
    renderModal();

    expect(screen.getByLabelText(PRINTING_CHECKBOX_LABEL)).not.toBeChecked();
  });

  it('does not request the printing override when it is left unchecked', async () => {
    const csrfFetch = jest.fn().mockResolvedValue(okResponse);
    renderModal({ csrfFetch });

    fireEvent.click(screen.getByText('Add'));

    await waitFor(() => expect(csrfFetch).toHaveBeenCalled());
    expect(bodyOf(csrfFetch).useDefaultPrinting).toBe(false);
  });

  it('requests the printing override when it is checked', async () => {
    const csrfFetch = jest.fn().mockResolvedValue(okResponse);
    renderModal({ csrfFetch });

    fireEvent.click(screen.getByLabelText(PRINTING_CHECKBOX_LABEL));
    fireEvent.click(screen.getByText('Add'));

    await waitFor(() => expect(csrfFetch).toHaveBeenCalled());
    expect(bodyOf(csrfFetch).useDefaultPrinting).toBe(true);
  });

  it('remembers the printing override under the shared key', () => {
    renderModal();

    fireEvent.click(screen.getByLabelText(PRINTING_CHECKBOX_LABEL));

    expect(window.localStorage.getItem('packageAddUseDefaultPrinting')).toEqual('true');
  });

  it('reads the autotag preference from the shared key', () => {
    window.localStorage.setItem('packageAddAutoTag', 'false');

    renderModal();

    expect(screen.getByLabelText('Autotag new cards with package name')).not.toBeChecked();
  });

  it('hides the printing override when there is no package', () => {
    renderModal({ withPackage: false });

    expect(screen.queryByLabelText(PRINTING_CHECKBOX_LABEL)).not.toBeInTheDocument();
  });
});
