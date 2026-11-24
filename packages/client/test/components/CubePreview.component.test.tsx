import React from 'react';

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

import '@testing-library/jest-dom';

import CubePreview from 'components/cube/CubePreview';
import { CSRFContext } from 'contexts/CSRFContext';

import { createCube, createUser } from '../../../server/test/test-utils/data';

const PIN = 'Pin to your menu (only you see this)';
const UNPIN = 'Unpin from your menu';

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
  it('shows a pin toggle outside the card link, and says the pin is private', () => {
    renderPreview({ pinToggle: true });

    const button = screen.getByRole('button', { name: PIN });
    expect(button).toHaveAttribute('title', PIN);
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
    expect(screen.getByRole('link', { name: 'Test Cube, pinned' })).toBeInTheDocument();
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
    expect(screen.getByRole('button', { name: UNPIN })).toHaveAttribute('title', UNPIN);
    // The marker and link name follow the live state, not the initial prop.
    expect(screen.getByRole('link', { name: 'Test Cube, pinned' })).toBeInTheDocument();
  });

  it('unpins a pinned cube', () => {
    const csrfFetch = renderPreview({ pinToggle: true, cube: { ...cube, pinnedByCurrentUser: true } });

    expect(screen.getByRole('link', { name: 'Test Cube, pinned' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: UNPIN }));

    expect(csrfFetch).toHaveBeenCalledWith('/cube/unpin/cube-1', expect.objectContaining({ method: 'POST' }));
    expect(screen.getByRole('button', { name: PIN })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Test Cube, pinned' })).not.toBeInTheDocument();
  });

  it('reverts when the request fails', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    renderPreview({ pinToggle: true }, jest.fn().mockResolvedValue({ ok: false }));

    fireEvent.click(screen.getByRole('button', { name: PIN }));
    expect(screen.getByRole('button', { name: UNPIN })).toBeInTheDocument();

    await waitFor(() => expect(screen.getByRole('button', { name: PIN })).toBeInTheDocument());
    expect(screen.queryByRole('link', { name: 'Test Cube, pinned' })).not.toBeInTheDocument();
  });
});
