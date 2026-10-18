import React from 'react';

import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import '@testing-library/jest-dom';

import BasicsModal from 'components/modals/BasicsModal';
import { CSRFContext } from 'contexts/CSRFContext';
import DisplayContext from 'contexts/DisplayContext';

import { defaultDisplayContext } from '../../../server/test/test-utils/context';
import { createCard, createCardDetails } from '../../../server/test/test-utils/data';

const spell = createCard({ cardID: 'spell', details: createCardDetails({ name: 'Llanowar Elves' }) });
const plains = createCard({
  cardID: 'plains',
  details: createCardDetails({ name: 'Plains', oracle_id: 'plains-oracle', image_normal: 'plains-default.png' }),
});
const forest = createCard({
  cardID: 'forest',
  imgUrl: 'forest-custom.png',
  details: createCardDetails({ name: 'Forest', oracle_id: 'forest-oracle', image_normal: 'forest-default.png' }),
});
const cards = [spell, plains, forest];

const renderModal = ({
  showCustomImages = true,
  csrfFetch = jest.fn(),
  addBasics = jest.fn(),
  setOpen = jest.fn(),
} = {}) =>
  render(
    <CSRFContext.Provider value={{ csrfToken: 'token', csrfFetch, callApi: jest.fn() } as any}>
      <DisplayContext.Provider value={{ ...defaultDisplayContext, showCustomImages }}>
        <BasicsModal isOpen setOpen={setOpen} addBasics={addBasics} deck={[0]} basics={[1, 2]} cards={cards} />
      </DisplayContext.Provider>
    </CSRFContext.Provider>,
  );

describe('BasicsModal', () => {
  it('shows a basic’s custom image when custom images are enabled', () => {
    renderModal();

    expect(screen.getByAltText('Forest')).toHaveAttribute('src', 'forest-custom.png');
  });

  it('shows the default image when custom images are hidden', () => {
    renderModal({ showCustomImages: false });

    expect(screen.getByAltText('Forest')).toHaveAttribute('src', 'forest-default.png');
  });

  it('shows the default image for a basic without a custom image', () => {
    renderModal();

    expect(screen.getByAltText('Plains')).toHaveAttribute('src', 'plains-default.png');
  });

  it('adds the selected counts and closes', () => {
    const addBasics = jest.fn();
    const setOpen = jest.fn();
    renderModal({ addBasics, setOpen });

    fireEvent.change(screen.getAllByRole('combobox')[1]!, { target: { value: '7' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    expect(addBasics).toHaveBeenCalledWith([0, 7]);
    expect(setOpen).toHaveBeenCalledWith(false);
  });

  it('fills counts from the calculate response', async () => {
    const csrfFetch = jest.fn().mockResolvedValue({
      json: async () => ({
        success: 'true',
        basics: [{ oracle_id: 'forest-oracle' }, { oracle_id: 'forest-oracle' }, { oracle_id: 'plains-oracle' }],
      }),
    });
    renderModal({ csrfFetch });

    fireEvent.click(screen.getByRole('button', { name: 'Calculate' }));

    await waitFor(() => expect(screen.getAllByRole('combobox')[1]).toHaveValue('2'));
    expect(screen.getAllByRole('combobox')[0]).toHaveValue('1');
    expect(JSON.parse(csrfFetch.mock.calls[0][1].body)).toEqual({
      mainboard: [spell.details],
      basics: [plains.details, forest.details],
    });
  });
});
