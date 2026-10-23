import React, { useContext, useEffect } from 'react';

import { act, render, screen } from '@testing-library/react';

import '@testing-library/jest-dom';

import { CubeDisplayOptions, DEFAULT_CUBE_DISPLAY_OPTIONS } from '@utils/datatypes/Cube';

import { CSRFContext } from 'contexts/CSRFContext';
import DisplayContext, { DisplayContextProvider, DisplayContextValue } from 'contexts/DisplayContext';

const captured: { ctx?: DisplayContextValue } = {};
const Probe: React.FC = () => {
  const value = useContext(DisplayContext);
  useEffect(() => {
    captured.ctx = value;
  });
  return <div data-testid="options">{JSON.stringify(value.displayOptions)}</div>;
};
// Reads the latest captured context value on each access.
const ctx = new Proxy({} as DisplayContextValue, {
  get: (_target, key) => captured.ctx![key as keyof DisplayContextValue],
});

const options = (): CubeDisplayOptions => JSON.parse(screen.getByTestId('options').textContent || '{}');

const renderProvider = (csrfFetch: jest.Mock, saved?: CubeDisplayOptions) =>
  render(
    <CSRFContext.Provider value={{ csrfToken: 't', csrfFetch, callApi: jest.fn() } as any}>
      <DisplayContextProvider cubeID="c1" savedDisplayOptions={saved}>
        <Probe />
      </DisplayContextProvider>
    </CSRFContext.Provider>,
  );

describe('DisplayContext display options', () => {
  let csrfFetch: jest.Mock;

  beforeEach(() => {
    localStorage.clear();
    csrfFetch = jest.fn();
  });

  it('starts from the saved cube values', () => {
    const saved = { ...DEFAULT_CUBE_DISPLAY_OPTIONS, showTagColors: false, showAllBoards: true };
    renderProvider(csrfFetch, saved);
    expect(options()).toEqual(saved);
    expect(ctx.displayOptionsModified).toBe(false);
  });

  it('starts from defaults when no saved values are given', () => {
    renderProvider(csrfFetch);
    expect(options()).toEqual(DEFAULT_CUBE_DISPLAY_OPTIONS);
  });

  it('ignores legacy localStorage values', () => {
    localStorage.setItem('useBaseCardData', 'true');
    localStorage.setItem('inline-tag-emojis-c1', 'true');
    localStorage.setItem('c1-showAllBoards', 'true');
    localStorage.setItem('c1-showTagQuickFilters', 'false');
    renderProvider(csrfFetch, DEFAULT_CUBE_DISPLAY_OPTIONS);
    expect(options()).toEqual(DEFAULT_CUBE_DISPLAY_OPTIONS);
  });

  it('toggling is page-only', () => {
    const setItem = jest.spyOn(Storage.prototype, 'setItem');
    renderProvider(csrfFetch, DEFAULT_CUBE_DISPLAY_OPTIONS);

    act(() => ctx.setDisplayOption('showTagColors', false));

    expect(options().showTagColors).toBe(false);
    expect(ctx.displayOptionsModified).toBe(true);
    expect(csrfFetch).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();
    setItem.mockRestore();
  });

  it('toggling back clears modified', () => {
    renderProvider(csrfFetch, DEFAULT_CUBE_DISPLAY_OPTIONS);
    act(() => ctx.setDisplayOption('showTagColors', false));
    act(() => ctx.setDisplayOption('showTagColors', true));
    expect(ctx.displayOptionsModified).toBe(false);
  });

  it('reset restores saved values', () => {
    renderProvider(csrfFetch, DEFAULT_CUBE_DISPLAY_OPTIONS);
    act(() => ctx.setDisplayOption('showUnsorted', true));
    act(() => ctx.resetDisplayOptions());
    expect(options()).toEqual(DEFAULT_CUBE_DISPLAY_OPTIONS);
    expect(ctx.displayOptionsModified).toBe(false);
  });

  it('save posts current values and becomes the new baseline', async () => {
    csrfFetch.mockResolvedValue({ ok: true });
    renderProvider(csrfFetch, DEFAULT_CUBE_DISPLAY_OPTIONS);
    act(() => ctx.setDisplayOption('collapseDuplicateCards', true));

    let result: boolean | undefined;
    await act(async () => {
      result = await ctx.saveDisplayOptions();
    });

    const expected = { ...DEFAULT_CUBE_DISPLAY_OPTIONS, collapseDuplicateCards: true };
    expect(result).toBe(true);
    expect(csrfFetch).toHaveBeenCalledTimes(1);
    const [url, init] = csrfFetch.mock.calls[0];
    expect(url).toBe('/cube/api/savedisplayoptions/c1');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ displayOptions: expected });
    expect(ctx.displayOptionsModified).toBe(false);
  });

  it.each([
    ['a non-ok response', () => Promise.resolve({ ok: false })],
    ['a network error', () => Promise.reject(new Error('offline'))],
  ])('failed save (%s) keeps page values and modified state', async (_label, impl) => {
    csrfFetch.mockImplementation(impl);
    renderProvider(csrfFetch, DEFAULT_CUBE_DISPLAY_OPTIONS);
    act(() => ctx.setDisplayOption('showUnsorted', true));

    let result: boolean | undefined;
    await act(async () => {
      result = await ctx.saveDisplayOptions();
    });

    expect(result).toBe(false);
    expect(options().showUnsorted).toBe(true);
    expect(ctx.displayOptionsModified).toBe(true);
  });
});
