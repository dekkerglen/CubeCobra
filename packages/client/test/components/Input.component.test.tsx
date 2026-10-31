import React from 'react';

import { fireEvent, render, screen } from '@testing-library/react';

import '@testing-library/jest-dom';

import Input from 'components/base/Input';

const clearButton = () => screen.queryByRole('button', { name: 'Clear' });

describe('Input clear button', () => {
  it('does not render a clear button when onClear is omitted', () => {
    render(<Input value="abc" onChange={jest.fn()} />);

    expect(clearButton()).not.toBeInTheDocument();
  });

  it('does not render a clear button when the value is empty', () => {
    render(<Input value="" onChange={jest.fn()} onClear={jest.fn()} />);

    expect(clearButton()).not.toBeInTheDocument();
  });

  it('renders a clear button for a whitespace-only value', () => {
    render(<Input value=" " onChange={jest.fn()} onClear={jest.fn()} />);

    expect(clearButton()).toBeInTheDocument();
  });

  it('does not render a clear button when disabled', () => {
    render(<Input value="abc" onChange={jest.fn()} onClear={jest.fn()} disabled />);

    expect(clearButton()).not.toBeInTheDocument();
  });

  it('calls onClear and returns focus to the input', () => {
    const onClear = jest.fn();
    render(<Input value="abc" onChange={jest.fn()} onClear={onClear} />);

    fireEvent.click(clearButton()!);

    expect(onClear).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('textbox')).toHaveFocus();
  });

  // jsdom does not move focus on mousedown, so an onBlur spy would stay clean either way.
  // The dispatch result is the only honest signal that preventDefault() ran.
  it('suppresses the input blur when the clear button is pressed', () => {
    render(<Input value="abc" onChange={jest.fn()} onClear={jest.fn()} />);

    const notCancelled = fireEvent.mouseDown(clearButton()!);

    expect(notCancelled).toBe(false);
  });

  it('is type=button so it cannot submit a surrounding form', () => {
    const onSubmit = jest.fn((event: React.FormEvent) => event.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <Input value="abc" onChange={jest.fn()} onClear={jest.fn()} />
      </form>,
    );

    expect(clearButton()).toHaveAttribute('type', 'button');

    fireEvent.click(clearButton()!);

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('reserves right padding only when onClear is set', () => {
    const { rerender } = render(<Input value="abc" onChange={jest.fn()} />);

    expect(screen.getByRole('textbox')).not.toHaveStyle({ paddingRight: '2.25rem' });

    rerender(<Input value="abc" onChange={jest.fn()} onClear={jest.fn()} />);

    expect(screen.getByRole('textbox')).toHaveStyle({ paddingRight: '2.25rem' });
  });

  it('preserves a caller-supplied inline style alongside the reserved padding', () => {
    render(
      <Input
        value="abc"
        onChange={jest.fn()}
        onClear={jest.fn()}
        otherInputProps={{ style: { paddingLeft: '48px' } }}
      />,
    );

    expect(screen.getByRole('textbox')).toHaveStyle({ paddingLeft: '48px', paddingRight: '2.25rem' });
  });

  // The three search pages force the input background white in every theme
  // (`!bg-white` on SearchPage, CardSearch, PackagesPage), while `text-text` is
  // rgb(240,240,240) in dark theme. A hover that resolves to it put the icon at
  // ~1.08:1 against its own background, so the control vanished when pointed at.
  it('does not use a hover colour that can vanish against a forced-white input', () => {
    render(<Input value="abc" onChange={jest.fn()} onClear={jest.fn()} />);

    expect(clearButton()).not.toHaveClass('hover:text-text');
    expect(clearButton()).toHaveClass('text-text-secondary');
  });
});
