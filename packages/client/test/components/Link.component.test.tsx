import React from 'react';

import { fireEvent, render, screen } from '@testing-library/react';

import '@testing-library/jest-dom';

import Link from 'components/base/Link';

describe('Link', () => {
  it('still runs its onClick when it also navigates', () => {
    const onClick = jest.fn();

    render(
      <Link href="https://example.com/product" onClick={onClick}>
        Buy
      </Link>,
    );
    fireEvent.click(screen.getByText('Buy'));

    // Affiliate tracking rides on exactly this combination.
    expect(onClick).toHaveBeenCalled();
  });

  it('runs its onClick when it is only a button in disguise', () => {
    const onClick = jest.fn();

    render(
      <Link href="#" onClick={onClick}>
        Toggle
      </Link>,
    );
    fireEvent.click(screen.getByText('Toggle'));

    expect(onClick).toHaveBeenCalled();
  });
});
