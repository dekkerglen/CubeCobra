import React from 'react';

import { fireEvent, render, screen } from '@testing-library/react';

import '@testing-library/jest-dom';

import CubeChangelogPage from '../../src/pages/CubeChangelogPage';

jest.mock('components/RenderToRoot', () => ({ __esModule: true, default: (Component: any) => Component }));
jest.mock('layouts/MainLayout', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
jest.mock('layouts/CubeLayout', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
jest.mock('components/DynamicFlash', () => ({ __esModule: true, default: () => null }));
jest.mock('components/blog/BlogPostChangelog', () => ({ __esModule: true, default: () => <div>text-changelog</div> }));
jest.mock('components/blog/ChangelogCardView', () => ({ __esModule: true, default: () => <div>cards-view</div> }));

const renderPage = () =>
  render(
    <CubeChangelogPage
      cube={{ id: 'cube-1' } as any}
      changelog={{ id: 'cl-1', cubeId: 'cube-1', date: 1700000000000, changelog: { mainboard: {} } }}
    />,
  );

describe('CubeChangelogPage actions', () => {
  it('keeps the point-in-time links behind an overflow menu', () => {
    renderPage();

    expect(screen.queryByText('View cube at this point in time')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Changelog actions' }));

    expect(screen.getByText('View cube at this point in time')).toHaveAttribute(
      'href',
      '/cube/changelog/cube-1/cl-1/list',
    );
    expect(screen.getByText('Compare with present')).toHaveAttribute('href', '/cube/changelog/cube-1/cl-1/compare');
  });
});
