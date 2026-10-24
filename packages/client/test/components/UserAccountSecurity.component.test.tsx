import React from 'react';

import { fireEvent, render, screen } from '@testing-library/react';

import '@testing-library/jest-dom';

import { PatronLevels, PatronStatuses } from '@utils/datatypes/Patron';

import UserEmailForm from 'components/user/UserEmailForm';
import UserPatreonConfig from 'components/user/UserPatreonConfig';

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

describe('UserPatreonConfig', () => {
  it('unlinks with a POST form rather than a link', () => {
    const patron = {
      email: 'patron@example.com',
      level: PatronLevels['Cobra Hatchling'],
      status: PatronStatuses.ACTIVE,
      owner: 'user-1',
      dateCreated: 1,
      dateLastUpdated: 1,
    };
    render(<UserPatreonConfig patron={patron} />);

    const button = screen.getByRole('button', { name: 'Unlink Patreon Account' });
    const form = button.closest('form');

    expect(button).toHaveAttribute('type', 'submit');
    expect(form).toHaveAttribute('action', '/patreon/unlink');
    expect(form).toHaveAttribute('method', 'POST');
    expect(document.querySelector('a[href="/patreon/unlink"]')).toBeNull();
  });
});
