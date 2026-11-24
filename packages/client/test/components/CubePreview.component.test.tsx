import React from 'react';

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

import '@testing-library/jest-dom';

import CubePreview from 'components/cube/CubePreview';
import { CSRFContext } from 'contexts/CSRFContext';

import { createCube, createUser } from '../../../server/test/test-utils/data';

const PIN_TITLE = 'Pin to your menu (only you see this)';
const UNPIN_TITLE = 'Unpin from your menu';
// The accessible name names the cube, so a list of cards doesn't read as a run of identical buttons.
const PIN = `${PIN_TITLE}: Test Cube`;
const UNPIN = `${UNPIN_TITLE}: Test Cube`;

const cube = createCube({ id: 'cube-1', shortId: 'cube-1', name: 'Test Cube', owner: createUser({ id: 'u1' }) });

const renderPreview = (props: any, csrfFetch: any = jest.fn().mockResolvedValue({ ok: true })) => {
  render(
    <CSRFContext.Provider value={{ csrfFetch, csrfToken: 't' } as any}>
      <CubePreview cube={cube} {...props} />
    </CSRFContext.Provider>,
  );
  return csrfFetch;
};

describe('CubePreview pin toggle', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('shows a pin toggle outside the card link, and says the pin is private', () => {
    renderPreview({ pinToggle: true });

    const button = screen.getByRole('button', { name: PIN });
    expect(button).toHaveAttribute('title', PIN_TITLE);
    // Interactive content nested in a link is invalid and confuses screen readers.
    expect(button.closest('a')).toBeNull();
  });

  it('shows no pin toggle without the prop', () => {
    renderPreview({});

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('keeps the dashboard marker without a toggle', () => {
    renderPreview({ markPinned: true, cube: { ...cube, pinnedByCurrentUser: true } });

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    // "Pinned" is a description, so the link keeps its content-derived name (stats, owner).
    const link = screen.getByRole('link');
    expect(link).toHaveAccessibleDescription('Pinned');
    expect(link).toHaveAccessibleName(expect.stringContaining('by'));
  });

  it('has no pinned description when not pinned', () => {
    renderPreview({ markPinned: true });

    expect(screen.getByRole('link')).not.toHaveAccessibleDescription('Pinned');
  });

  it('toggling does not navigate and flips the label', async () => {
    const csrfFetch = renderPreview({ pinToggle: true });
    const button = screen.getByRole('button', { name: PIN });

    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    await act(async () => {
      button.dispatchEvent(event);
    });

    expect(event.defaultPrevented).toBe(true);
    expect(csrfFetch).toHaveBeenCalledWith('/cube/pin/cube-1', expect.objectContaining({ method: 'POST' }));
    expect(screen.getByRole('button', { name: UNPIN })).toHaveAttribute('title', UNPIN_TITLE);
    // The marker and description follow the live state, not the initial prop.
    expect(screen.getByRole('link')).toHaveAccessibleDescription('Pinned');
  });

  it('unpins a pinned cube', () => {
    const csrfFetch = renderPreview({ pinToggle: true, cube: { ...cube, pinnedByCurrentUser: true } });

    expect(screen.getByRole('link')).toHaveAccessibleDescription('Pinned');
    fireEvent.click(screen.getByRole('button', { name: UNPIN }));

    expect(csrfFetch).toHaveBeenCalledWith('/cube/unpin/cube-1', expect.objectContaining({ method: 'POST' }));
    expect(screen.getByRole('button', { name: PIN })).toBeInTheDocument();
    expect(screen.getByRole('link')).not.toHaveAccessibleDescription('Pinned');
  });

  it('disables the toggle while a request is pending', async () => {
    let resolve: (value: { ok: boolean }) => void = () => {};
    renderPreview({ pinToggle: true }, jest.fn().mockReturnValue(new Promise((r) => (resolve = r))));

    fireEvent.click(screen.getByRole('button', { name: PIN }));
    expect(screen.getByRole('button', { name: UNPIN })).toBeDisabled();

    await act(async () => resolve({ ok: true }));
    expect(screen.getByRole('button', { name: UNPIN })).toBeEnabled();
  });

  it('reverts when the request fails', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    renderPreview({ pinToggle: true }, jest.fn().mockResolvedValue({ ok: false }));

    fireEvent.click(screen.getByRole('button', { name: PIN }));
    expect(screen.getByRole('button', { name: UNPIN })).toBeInTheDocument();

    await waitFor(() => expect(screen.getByRole('button', { name: PIN })).toBeInTheDocument());
    expect(screen.getByRole('link')).not.toHaveAccessibleDescription('Pinned');
  });
});
