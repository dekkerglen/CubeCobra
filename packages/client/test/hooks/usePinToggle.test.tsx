import React from 'react';

import { act, renderHook } from '@testing-library/react';

import { CSRFContext } from 'contexts/CSRFContext';
import usePinToggle from 'hooks/usePinToggle';

const setup = () => {
  let resolve: (value: { ok: boolean }) => void = () => {};
  const csrfFetch = jest.fn().mockReturnValue(new Promise((r) => (resolve = r)));
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <CSRFContext.Provider value={{ csrfFetch, csrfToken: 't' } as any}>{children}</CSRFContext.Provider>
  );
  const hook = renderHook(() => usePinToggle('cube-1', false), { wrapper });
  return { ...hook, csrfFetch, resolve: (value: { ok: boolean }) => resolve(value) };
};

describe('usePinToggle', () => {
  it('ignores a second toggle while the first request is pending', async () => {
    const { result, csrfFetch, resolve } = setup();

    act(() => result.current.toggle());
    expect(result.current.busy).toBe(true);
    act(() => result.current.toggle());

    expect(csrfFetch).toHaveBeenCalledTimes(1);
    expect(result.current.pinned).toBe(true);

    await act(async () => resolve({ ok: true }));
    expect(result.current.busy).toBe(false);

    act(() => result.current.toggle());
    expect(csrfFetch).toHaveBeenCalledTimes(2);
    expect(csrfFetch).toHaveBeenLastCalledWith('/cube/unpin/cube-1', expect.objectContaining({ method: 'POST' }));
  });
});
