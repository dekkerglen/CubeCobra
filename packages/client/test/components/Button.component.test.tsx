import React from 'react';

import { fireEvent, render, screen } from '@testing-library/react';

import '@testing-library/jest-dom';

import Button from 'components/base/Button';

describe('Button link loading state', () => {
  it('shows a spinner when navigating the current tab', () => {
    render(
      <Button type="link" href="/tool/card/abc">
        View Card Analytics
      </Button>,
    );

    const link = screen.getByText('View Card Analytics');
    fireEvent.click(link);

    expect(screen.queryByText('View Card Analytics')).not.toBeInTheDocument();
  });

  it('does not show a spinner when the link opens in a new tab', () => {
    render(
      <Button type="link" href="/tool/card/abc" target="_blank">
        View Card Analytics
      </Button>,
    );

    const link = screen.getByText('View Card Analytics');
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    fireEvent(link, event);

    expect(screen.getByText('View Card Analytics')).toBeInTheDocument();
    expect(link).not.toHaveClass('cursor-not-allowed');
    expect(event.defaultPrevented).toBe(false);
  });

  it('keeps a new-tab link clickable after repeated clicks', () => {
    const onClick = jest.fn();
    render(
      <Button type="link" href="/tool/card/abc" target="_blank" onClick={onClick}>
        View Card Analytics
      </Button>,
    );

    const link = screen.getByText('View Card Analytics');
    fireEvent.click(link);
    fireEvent.click(link);

    expect(onClick).toHaveBeenCalledTimes(2);
  });

  it('does not show a spinner when a modifier key opens a new tab', () => {
    render(
      <Button type="link" href="/tool/card/abc">
        View Card Analytics
      </Button>,
    );

    const link = screen.getByText('View Card Analytics');
    fireEvent.click(link, { metaKey: true });

    expect(screen.getByText('View Card Analytics')).toBeInTheDocument();
  });
});
