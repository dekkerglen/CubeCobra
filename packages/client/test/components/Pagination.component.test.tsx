import React from 'react';

import { render, screen } from '@testing-library/react';

import '@testing-library/jest-dom';

import Pagination from 'components/base/Pagination';

describe('Pagination', () => {
  // Review Focus 1
  it('does not claim a page exists when there are none', () => {
    render(<Pagination count={0} active={0} onClick={jest.fn()} />);
    expect(screen.queryByText('Page 1 of 0')).not.toBeInTheDocument();
    expect(screen.getByText('No results')).toBeInTheDocument();
  });

  it('disables every control when there are no pages', () => {
    render(<Pagination count={0} active={0} onClick={jest.fn()} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(4);
    buttons.forEach((b) => expect(b).toBeDisabled());
  });

  it('still renders a single page normally', () => {
    render(<Pagination count={1} active={0} onClick={jest.fn()} />);
    expect(screen.getByText('Page 1 of 1')).toBeInTheDocument();
    expect(screen.queryByText('No results')).not.toBeInTheDocument();
  });

  it('renders a multi-page label and leaves next enabled', () => {
    render(<Pagination count={5} active={0} onClick={jest.fn()} />);
    expect(screen.getByText('Page 1 of 5')).toBeInTheDocument();
    const buttons = screen.getAllByRole('button');
    expect(buttons[2]).toBeEnabled();
    expect(buttons[3]).toBeEnabled();
  });

  it('applies the same empty label in link mode', () => {
    render(<Pagination count={0} active={0} urlF={(i) => `/p/${i}`} />);
    expect(screen.queryByText('Page 1 of 0')).not.toBeInTheDocument();
    expect(screen.getByText('No results')).toBeInTheDocument();
  });

  it('disables every control in link mode when there are no pages', () => {
    render(<Pagination count={0} active={0} urlF={(i) => `/p/${i}`} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(4);
    buttons.forEach((b) => expect(b).toBeDisabled());
  });

  it('still renders a single page normally in link mode', () => {
    render(<Pagination count={1} active={0} urlF={(i) => `/p/${i}`} />);
    expect(screen.getByText('Page 1 of 1')).toBeInTheDocument();
    expect(screen.queryByText('No results')).not.toBeInTheDocument();
  });

  it('applies the same empty label with no controls at all', () => {
    render(<Pagination count={0} active={0} />);
    expect(screen.queryByText('Page 1 of 0')).not.toBeInTheDocument();
    expect(screen.getByText('No results')).toBeInTheDocument();
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('still renders a single page normally with no controls at all', () => {
    render(<Pagination count={1} active={0} />);
    expect(screen.getByText('Page 1 of 1')).toBeInTheDocument();
  });

  // A count can only be below zero through a caller's arithmetic, and it is no more navigable
  // than zero is.
  it('treats a negative count as empty', () => {
    render(<Pagination count={-1} active={0} onClick={jest.fn()} />);
    expect(screen.getByText('No results')).toBeInTheDocument();
    screen.getAllByRole('button').forEach((b) => expect(b).toBeDisabled());
  });

  it('ignores a stale active index when there are no pages', () => {
    render(<Pagination count={0} active={3} onClick={jest.fn()} />);
    expect(screen.queryByText(/Page \d+ of/)).not.toBeInTheDocument();
    expect(screen.getByText('No results')).toBeInTheDocument();
    screen.getAllByRole('button').forEach((b) => expect(b).toBeDisabled());
  });

  it('does not call onClick from a control that has no page to reach', () => {
    const onClick = jest.fn();
    render(<Pagination count={0} active={0} onClick={onClick} />);
    screen.getAllByRole('button').forEach((b) => b.click());
    expect(onClick).not.toHaveBeenCalled();
  });
});
