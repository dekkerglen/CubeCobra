import React from 'react';

import { render, screen } from '@testing-library/react';

import '@testing-library/jest-dom';

import { LeaveWarningPage } from '../../src/pages/LeaveWarningPage';

jest.mock('components/RenderToRoot', () => ({ __esModule: true, default: (Component: any) => Component }));
jest.mock('layouts/MainLayout', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
jest.mock('components/DynamicFlash', () => ({ __esModule: true, default: () => null }));

describe('LeaveWarningPage', () => {
  it('links the continue button to an http(s) destination', () => {
    render(<LeaveWarningPage url="https://example.com/decklist?id=1" />);
    expect(screen.getByRole('link', { name: 'Yes, continue' })).toHaveAttribute(
      'href',
      'https://example.com/decklist?id=1',
    );
  });

  it.each([
    'javascript:alert(document.cookie)',
    'JavaScript:alert(1)',
    'data:text/html,<script></script>',
    '/user/logout',
  ])('does not offer a continue link for %s', (url) => {
    const { container } = render(<LeaveWarningPage url={url} />);
    expect(screen.queryByText('Yes, continue')).not.toBeInTheDocument();
    expect(container.querySelector('a[href]')).toBeNull();
    expect(screen.getByText('Go back')).toBeInTheDocument();
  });
});
