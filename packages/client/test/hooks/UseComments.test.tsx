import React from 'react';

import { act, render, screen, waitFor } from '@testing-library/react';

import '@testing-library/jest-dom';

import useComments from 'hooks/UseComments';

import { CSRFContext } from '../../src/contexts/CSRFContext';

const csrfFetch = jest.fn();

const Harness: React.FC<{ enabled?: boolean }> = ({ enabled }) => {
  const [comments, , , , , getMore] = useComments('parent-1', 'blog', enabled === undefined ? undefined : { enabled });
  return (
    <div>
      <span data-testid="count">{comments.length}</span>
      <button onClick={() => getMore()}>more</button>
    </div>
  );
};

const renderHook = (props: { enabled?: boolean } = {}) =>
  render(
    <CSRFContext.Provider value={{ csrfFetch, callApi: jest.fn(), csrfToken: 't' } as any}>
      <Harness {...props} />
    </CSRFContext.Provider>,
  );

const respondWith = (comments: any[], lastKey: string | null = null) =>
  csrfFetch.mockResolvedValue({
    ok: true,
    text: async () => JSON.stringify({ success: 'true', comments, lastKey }),
  });

describe('useComments', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    respondWith([]);
  });

  it('fetches on mount by default', async () => {
    renderHook();

    await waitFor(() => expect(csrfFetch).toHaveBeenCalledTimes(1));
  });

  it('does not fetch on mount when disabled', async () => {
    renderHook({ enabled: false });

    // Give any effect a chance to run before concluding it did not.
    await act(async () => {
      await Promise.resolve();
    });
    expect(csrfFetch).not.toHaveBeenCalled();
  });

  it('fetches once when enabled flips true', async () => {
    const { rerender } = renderHook({ enabled: false });
    expect(csrfFetch).not.toHaveBeenCalled();

    rerender(
      <CSRFContext.Provider value={{ csrfFetch, callApi: jest.fn(), csrfToken: 't' } as any}>
        <Harness enabled />
      </CSRFContext.Provider>,
    );

    await waitFor(() => expect(csrfFetch).toHaveBeenCalledTimes(1));
  });

  it('does not sleep before fetching more', async () => {
    respondWith([{ id: 'c-1', body: 'one' }], 'cursor-1');
    renderHook();
    await waitFor(() => expect(csrfFetch).toHaveBeenCalledTimes(1));

    // getMore used to wait two seconds before issuing its request, to hold back the request
    // storm the eager reply fetching created. With that gone the delay should be too.
    await act(async () => {
      screen.getByText('more').click();
    });

    await waitFor(() => expect(csrfFetch).toHaveBeenCalledTimes(2));
  }, 1000);
});
