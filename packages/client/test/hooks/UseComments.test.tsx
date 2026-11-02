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

// Replying to a collapsed comment runs two requests at once: the optimistic add, and the
// deferred initial fetch that `setLoaded(true)` enables. Whichever settled last used to win
// outright, so the reply either wiped out every sibling reply or vanished itself.
describe('useComments adding to a thread that has not loaded yet', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const ReplyHarness: React.FC<{ enabled: boolean; onReady: (add: (body: string) => void) => void }> = ({
    enabled,
    onReady,
  }) => {
    const [comments, addComment] = useComments('parent-1', 'comment', { enabled });
    onReady(addComment);
    return <span data-testid="ids">{comments.map((c) => c.id).join(',')}</span>;
  };

  const renderReply = (enabled: boolean, onReady: (add: (body: string) => void) => void) =>
    render(
      <CSRFContext.Provider value={{ csrfFetch, callApi: jest.fn(), csrfToken: 't' } as any}>
        <ReplyHarness enabled={enabled} onReady={onReady} />
      </CSRFContext.Provider>,
    );

  const routeFetch = ({ serverReplies, addDelay, getDelay }: any) =>
    csrfFetch.mockImplementation(async (url: string) => {
      const isAdd = url.includes('addcomment');
      await new Promise((resolve) => setTimeout(resolve, isAdd ? addDelay : getDelay));
      return {
        ok: true,
        text: async () =>
          JSON.stringify(
            isAdd
              ? { comment: { id: 'new-reply', body: 'mine' } }
              : { success: 'true', comments: serverReplies, lastKey: null },
          ),
      };
    });

  const run = async (opts: any) => {
    routeFetch(opts);
    let add: any;
    const { rerender } = renderReply(false, (fn) => {
      add = fn;
    });

    // Exactly what Comment.tsx's reply submit does: post the reply, then flip the thread to
    // loaded, which enables the deferred fetch.
    await act(async () => {
      add('mine');
      rerender(
        <CSRFContext.Provider value={{ csrfFetch, callApi: jest.fn(), csrfToken: 't' } as any}>
          <ReplyHarness enabled onReady={(fn) => (add = fn)} />
        </CSRFContext.Provider>,
      );
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    // React flushes the rerender's effect as the act above exits, so the fetch it starts is
    // still in flight at that point. Settle it before reading the thread.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    return screen.getByTestId('ids').textContent!.split(',').filter(Boolean);
  };

  it('keeps sibling replies when the add settles last', async () => {
    const ids = await run({
      serverReplies: [{ id: 'old-1' }, { id: 'old-2' }],
      addDelay: 20,
      getDelay: 0,
    });

    expect(ids.sort()).toEqual(['new-reply', 'old-1', 'old-2']);
  });

  it('keeps the new reply when the fetch settles last without it', async () => {
    // The replies GSI is eventually consistent, so a read issued right after the write
    // frequently does not contain it yet.
    const ids = await run({
      serverReplies: [{ id: 'old-1' }, { id: 'old-2' }],
      addDelay: 0,
      getDelay: 20,
    });

    expect(ids.sort()).toEqual(['new-reply', 'old-1', 'old-2']);
  });

  it('does not duplicate the reply when the fetch already contains it', async () => {
    const ids = await run({
      serverReplies: [{ id: 'new-reply' }, { id: 'old-1' }],
      addDelay: 0,
      getDelay: 20,
    });

    expect(ids.sort()).toEqual(['new-reply', 'old-1']);
  });
});
