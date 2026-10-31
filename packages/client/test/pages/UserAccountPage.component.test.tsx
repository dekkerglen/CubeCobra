import React from 'react';

import { render, screen } from '@testing-library/react';

import '@testing-library/jest-dom';

import { UserAccountPage } from '../../src/pages/UserAccountPage';

jest.mock('components/RenderToRoot', () => ({ __esModule: true, default: (Component: any) => Component }));
jest.mock('layouts/MainLayout', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
jest.mock('components/DynamicFlash', () => ({ __esModule: true, default: () => null }));
jest.mock('components/Banner', () => ({ __esModule: true, default: () => null }));
// The profile section pulls in Markdown, which depends on ESM-only github-slugger.
jest.mock('components/TextEntry', () => () => <div data-testid="text-entry" />);

// The landing view (no nav) and a section view (nav set) are the page's two layouts; logout has to
// be reachable from either one.
const renderPage = (defaultNav = '') => render(<UserAccountPage defaultNav={defaultNav} />);

describe('UserAccountPage', () => {
  it('offers logout', () => {
    renderPage();
    expect(screen.getByRole('button', { name: /logout/i })).toBeInTheDocument();
  });

  it('posts rather than linking, so an image cannot trigger it', () => {
    renderPage();
    const form = screen.getByRole('button', { name: /logout/i }).closest('form');
    expect(form).toHaveAttribute('action', '/user/logout');
    expect(form).toHaveAttribute('method', 'POST');
  });

  it('offers logout from a section view as well as the landing view', () => {
    const { unmount } = renderPage();
    expect(screen.getByRole('button', { name: /logout/i })).toBeInTheDocument();
    unmount();

    renderPage('display');
    // The landing copy is gone, so this is the section layout rather than the tile grid.
    expect(screen.queryByText('Choose a section to manage your account.')).not.toBeInTheDocument();
    const form = screen.getByRole('button', { name: /logout/i }).closest('form');
    expect(form).toHaveAttribute('action', '/user/logout');
  });

  it('does not render logout as a settings section', () => {
    renderPage();
    expect(screen.queryByRole('link', { name: /logout/i })).not.toBeInTheDocument();
  });
});
