import React from 'react';

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

import '@testing-library/jest-dom';

import ConsentToHashedEmailsModal from 'components/modals/ConsentToHashedEmailsModal';
import { CSRFContext } from 'contexts/CSRFContext';

const csrfFetch = jest.fn();

const renderModal = () =>
  render(
    <CSRFContext.Provider value={{ csrfFetch, callApi: jest.fn() } as any}>
      <ConsentToHashedEmailsModal isOpen />
    </CSRFContext.Provider>,
  );

const choose = async (label: string) => {
  await act(async () => {
    fireEvent.click(screen.getByText(label));
  });
};

describe('ConsentToHashedEmailsModal', () => {
  beforeEach(() => {
    csrfFetch.mockReset();
  });

  it('sends the preference and closes when the server accepts it', async () => {
    csrfFetch.mockResolvedValue({ ok: true, json: async () => ({ success: 'true' }) });
    renderModal();

    await choose('I consent');

    expect(JSON.parse(csrfFetch.mock.calls[0][1].body)).toEqual({ preference: true });
    await waitFor(() => expect(screen.queryByText('I consent')).not.toBeInTheDocument());
  });

  it.each([
    ['a server error', { ok: false, status: 400, json: async () => ({ error: 'Invalid preference value' }) }],
    [
      'an expired session redirected to the login page',
      {
        ok: true,
        json: async () => {
          throw new SyntaxError('Unexpected token <');
        },
      },
    ],
  ])('stays open and shows an error on %s', async (_label, response) => {
    csrfFetch.mockResolvedValue(response);
    renderModal();

    await choose('I do not consent');

    expect(screen.getByText('I do not consent')).toBeInTheDocument();
    expect(screen.getByText(/couldn't save your preference/i)).toBeInTheDocument();
  });

  it('stays open and shows an error when the request throws', async () => {
    csrfFetch.mockRejectedValue(new TypeError('Failed to fetch'));
    renderModal();

    await choose('I consent');

    expect(screen.getByText('I consent')).toBeInTheDocument();
    expect(screen.getByText(/couldn't save your preference/i)).toBeInTheDocument();
  });
});
