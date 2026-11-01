import React from 'react';

import { fireEvent, render, screen } from '@testing-library/react';

import '@testing-library/jest-dom';

import CursorPagination, { willRenderCursorPager } from 'components/base/CursorPagination';

describe('CursorPagination', () => {
  it('renders no denominator', () => {
    render(<CursorPagination active={0} loadedPages={3} hasMore onPageChange={jest.fn()} />);
    expect(screen.getByText('Page 1')).toBeInTheDocument();
    expect(screen.queryByText(/of/i)).not.toBeInTheDocument();
  });

  it('renders nothing when there is nothing to navigate', () => {
    const { container } = render(
      <CursorPagination active={0} loadedPages={1} hasMore={false} onPageChange={jest.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when the list is empty', () => {
    const { container } = render(
      <CursorPagination active={0} loadedPages={0} hasMore={false} onPageChange={jest.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when no pages are loaded even if more exist', () => {
    const { container } = render(<CursorPagination active={0} loadedPages={0} hasMore onPageChange={jest.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('enables next when more pages are loaded even though hasMore is false', () => {
    render(<CursorPagination active={0} loadedPages={3} hasMore={false} onPageChange={jest.fn()} />);
    expect(screen.getByLabelText('Next page')).toBeEnabled();
  });

  it('enables next on the last loaded page when hasMore is true', () => {
    render(<CursorPagination active={2} loadedPages={3} hasMore onPageChange={jest.fn()} />);
    expect(screen.getByLabelText('Next page')).toBeEnabled();
  });

  it('disables next on the last loaded page when hasMore is false', () => {
    render(<CursorPagination active={2} loadedPages={3} hasMore={false} onPageChange={jest.fn()} />);
    expect(screen.getByLabelText('Next page')).toBeDisabled();
  });

  it('disables previous on the first page', () => {
    render(<CursorPagination active={0} loadedPages={3} hasMore onPageChange={jest.fn()} />);
    expect(screen.getByLabelText('Previous page')).toBeDisabled();
  });

  it('renders no first or last page buttons', () => {
    render(<CursorPagination active={1} loadedPages={3} hasMore onPageChange={jest.fn()} />);
    expect(screen.queryByLabelText(/first page|last page/i)).not.toBeInTheDocument();
  });

  // Review Focus 3: the list shrank under the viewer.
  it('clamps a stale active index to the last loaded page', () => {
    render(<CursorPagination active={7} loadedPages={2} hasMore={false} onPageChange={jest.fn()} />);
    expect(screen.getByText('Page 2')).toBeInTheDocument();
  });

  it('disables both controls while loading', () => {
    render(<CursorPagination active={1} loadedPages={3} hasMore loading onPageChange={jest.fn()} />);
    expect(screen.getByLabelText('Next page')).toBeDisabled();
    expect(screen.getByLabelText('Previous page')).toBeDisabled();
  });

  it('calls onPageChange with the adjacent page index', () => {
    const onPageChange = jest.fn();
    render(<CursorPagination active={1} loadedPages={3} hasMore onPageChange={onPageChange} />);

    fireEvent.click(screen.getByLabelText('Next page'));
    expect(onPageChange).toHaveBeenCalledWith(2);

    fireEvent.click(screen.getByLabelText('Previous page'));
    expect(onPageChange).toHaveBeenCalledWith(0);
  });

  it('navigates from the clamped index rather than the stale one', () => {
    const onPageChange = jest.fn();
    render(<CursorPagination active={7} loadedPages={2} hasMore onPageChange={onPageChange} />);

    fireEvent.click(screen.getByLabelText('Previous page'));
    expect(onPageChange).toHaveBeenCalledWith(0);
  });
});

// Callers that wrap the pager in their own visible chrome - a bordered card footer, say - render
// that chrome on this predicate. If it ever disagreed with the component, they would draw an empty
// bordered strip, or hide a pager that was about to render.
describe('willRenderCursorPager', () => {
  const cases: { loadedPages: number; hasMore: boolean }[] = [];
  for (const loadedPages of [0, 1, 2, 3]) {
    for (const hasMore of [false, true]) {
      cases.push({ loadedPages, hasMore });
    }
  }

  it.each(cases)('agrees with what the component renders for %o', ({ loadedPages, hasMore }) => {
    const { container } = render(
      <CursorPagination active={0} loadedPages={loadedPages} hasMore={hasMore} onPageChange={jest.fn()} />,
    );

    expect(willRenderCursorPager(loadedPages, hasMore)).toBe(!(container as HTMLElement).matches(':empty'));
  });

  it('treats an omitted hasMore as false, like the component does', () => {
    expect(willRenderCursorPager(1)).toBe(false);
    expect(willRenderCursorPager(2)).toBe(true);
  });
});
