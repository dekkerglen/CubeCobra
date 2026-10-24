import React from 'react';

import { fireEvent, render, screen } from '@testing-library/react';

import '@testing-library/jest-dom';

import UserEmailForm from 'components/user/UserEmailForm';

const hiddenValue = (form: HTMLFormElement, name: string) =>
  (form.querySelector(`input[type="hidden"][name="${name}"]`) as HTMLInputElement | null)?.value;

describe('UserEmailForm', () => {
  it('posts the new address together with the current password', () => {
    const { container } = render(<UserEmailForm currentEmail="old@example.com" />);
    const form = container.querySelector('form') as HTMLFormElement;

    fireEvent.change(screen.getByLabelText('New email'), { target: { value: 'new@example.com' } });
    fireEvent.change(screen.getByLabelText('Current password'), { target: { value: 'hunter22' } });

    expect(form).toHaveAttribute('action', '/user/updateemail');
    expect(form).toHaveAttribute('method', 'POST');
    expect(hiddenValue(form, 'email')).toBe('new@example.com');
    expect(hiddenValue(form, 'password')).toBe('hunter22');
    expect(screen.getByText(/confirmation link to the new address/)).toBeInTheDocument();
  });

  it('shows a change that is still waiting for confirmation', () => {
    render(<UserEmailForm currentEmail="old@example.com" pendingEmail="new@example.com" />);

    expect(screen.getByText('new@example.com')).toBeInTheDocument();
    expect(screen.getByText(/We sent a confirmation link to/)).toBeInTheDocument();
  });
});
