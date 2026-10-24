import React from 'react';

import { fireEvent, render, screen } from '@testing-library/react';

import '@testing-library/jest-dom';

import PostButton from 'components/base/PostButton';

// jsdom doesn't implement navigation, so record whether each submit would have gone through. The
// listener sits on the document so it runs after React's handler on the root container.
let removeListener: (() => void) | undefined;
const submitOutcomes = (): boolean[] => {
  const outcomes: boolean[] = [];
  const listener = (event: Event) => {
    outcomes.push(!event.defaultPrevented);
    event.preventDefault();
  };
  document.addEventListener('submit', listener);
  removeListener = () => document.removeEventListener('submit', listener);
  return outcomes;
};

describe('PostButton', () => {
  afterEach(() => {
    removeListener?.();
    jest.restoreAllMocks();
  });

  it('renders a submit button inside a POST form for the action', () => {
    render(<PostButton action="/user/follow/abc">Follow</PostButton>);

    const button = screen.getByRole('button', { name: 'Follow' });
    const form = button.closest('form');

    expect(button).toHaveAttribute('type', 'submit');
    expect(form).toHaveAttribute('method', 'POST');
    expect(form).toHaveAttribute('action', '/user/follow/abc');
    expect(document.querySelector('a')).toBeNull();
  });

  it('styles the button like Button and stretches the form when block', () => {
    render(
      <PostButton action="/x" color="danger" outline block>
        Delete
      </PostButton>,
    );

    const button = screen.getByRole('button', { name: 'Delete' });
    expect(button).toHaveClass('text-button-danger', 'border-button-danger', 'w-full');
    expect(button.closest('form')).toHaveClass('w-full');
  });

  it('renders a bare button styled only by className when unstyled', () => {
    render(
      <PostButton action="/user/logout" unstyled className="text-text">
        Logout
      </PostButton>,
    );

    const button = screen.getByRole('button', { name: 'Logout' });
    expect(button).toHaveClass('text-text', 'cursor-pointer');
    expect(button).not.toHaveClass('rounded');
  });

  it('submits once and ignores repeat clicks while the request is in flight', () => {
    render(<PostButton action="/cube/clone/abc">Clone</PostButton>);
    const form = screen.getByRole('button', { name: 'Clone' }).closest('form') as HTMLFormElement;
    const outcomes = submitOutcomes();

    fireEvent.submit(form);
    fireEvent.submit(form);

    expect(outcomes).toEqual([true, false]);
  });

  it('asks for confirmation and only submits when the user agrees', () => {
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
    render(
      <PostButton action="/x" confirm="Are you sure?">
        Go
      </PostButton>,
    );
    const form = screen.getByRole('button', { name: 'Go' }).closest('form') as HTMLFormElement;
    const outcomes = submitOutcomes();

    fireEvent.submit(form);
    fireEvent.submit(form);

    expect(confirmSpy).toHaveBeenCalledWith('Are you sure?');
    expect(outcomes).toEqual([false, true]);
  });
});
