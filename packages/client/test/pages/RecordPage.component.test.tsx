import React from 'react';

import { fireEvent, render, screen } from '@testing-library/react';

import '@testing-library/jest-dom';

import Cube from '@utils/datatypes/Cube';
import Record from '@utils/datatypes/Record';

import CubeContext from 'contexts/CubeContext';

import RecordPage from '../../src/pages/RecordPage';

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
jest.mock('components/comments/CommentsSection', () => ({ __esModule: true, default: () => null }));
jest.mock('components/Markdown', () => ({
  __esModule: true,
  default: ({ markdown }: { markdown: string }) => <div>{markdown}</div>,
  SafeMarkdown: ({ markdown }: { markdown: string }) => <div>{markdown}</div>,
}));

// The tabs themselves are exercised elsewhere; what matters here is that the entry point
// into the transcription workspace does not live inside any of them.
jest.mock('../../src/records/RecordDecks', () => ({
  __esModule: true,
  default: () => <div data-testid="decks-tab" />,
}));
jest.mock('../../src/records/RecordStandings', () => ({
  __esModule: true,
  default: () => <div data-testid="standings-tab" />,
}));
jest.mock('../../src/records/RecordMatches', () => ({
  __esModule: true,
  default: () => <div data-testid="matches-tab" />,
}));

const cube = { id: 'cube-1', name: 'My Cube' } as unknown as Cube;

const record: Record = {
  id: 'rec-1',
  cube: 'cube-1',
  date: 1700000000000,
  name: 'Tuesday Night',
  description: 'Eight players, three rounds',
  players: [{ name: 'Alice' }, { name: 'Bob' }],
  matches: [],
  trophy: [],
};

const renderPage = (canEdit: boolean) =>
  render(
    <CubeContext.Provider value={{ cube, canEdit } as any}>
      <RecordPage cube={cube} record={record} players={[]} />
    </CubeContext.Provider>,
  );

const transcribeLink = () => screen.queryByRole('link', { name: 'Enter event data' });

describe('RecordPage', () => {
  // The design asks for this to be visible from every tab rather than buried in one, so it
  // sits above the tab strip and survives switching tabs.
  it('offers the transcription workspace from every tab', () => {
    renderPage(true);

    expect(transcribeLink()).toHaveAttribute('href', '/cube/records/enter/rec-1');

    fireEvent.click(screen.getByRole('button', { name: 'Matches' }));
    expect(screen.getByTestId('matches-tab')).toBeInTheDocument();
    expect(transcribeLink()).toHaveAttribute('href', '/cube/records/enter/rec-1');

    fireEvent.click(screen.getByRole('button', { name: 'Standings' }));
    expect(screen.getByTestId('standings-tab')).toBeInTheDocument();
    expect(transcribeLink()).toHaveAttribute('href', '/cube/records/enter/rec-1');
  });

  it('offers it to nobody but the cube owner', () => {
    renderPage(false);

    expect(transcribeLink()).not.toBeInTheDocument();
  });
});
