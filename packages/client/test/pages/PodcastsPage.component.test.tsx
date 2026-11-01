import React from 'react';

import { render, screen } from '@testing-library/react';

import '@testing-library/jest-dom';

import Episode from '@utils/datatypes/Episode';

import { CSRFContext } from 'contexts/CSRFContext';

import PodcastsPage from '../../src/pages/PodcastsPage';

jest.mock('components/RenderToRoot', () => ({ __esModule: true, default: (Component: any) => Component }));
jest.mock('layouts/MainLayout', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
jest.mock('components/DynamicFlash', () => ({ __esModule: true, default: () => null }));
jest.mock('components/Banner', () => ({ __esModule: true, default: () => null }));
jest.mock('components/content/PodcastPreview', () => ({
  __esModule: true,
  default: ({ podcast }: any) => <div>{podcast.title}</div>,
}));
jest.mock('components/content/PodcastEpisodePreview', () => ({
  __esModule: true,
  default: ({ episode }: any) => <div>{episode.title}</div>,
}));

const episode = (index: number): Episode => ({ id: `e${index}`, title: `Episode ${index}` }) as Episode;

const renderPage = (props: Partial<React.ComponentProps<typeof PodcastsPage>> = {}, csrfFetch = jest.fn()) =>
  render(
    <CSRFContext.Provider value={{ csrfToken: 'token', csrfFetch, callApi: jest.fn() } as any}>
      <PodcastsPage episodes={[]} podcasts={[]} lastKey={undefined} {...props} />
    </CSRFContext.Provider>,
  );

describe('PodcastsPage', () => {
  it('shows no pager for a podcast with no episodes', () => {
    renderPage({ episodes: [] });

    expect(screen.queryByText(/Page/)).not.toBeInTheDocument();
  });

  it('shows no pager when nothing is loaded but a cursor remains', () => {
    renderPage({ episodes: [], lastKey: 'cursor' });

    expect(screen.queryByText(/Page/)).not.toBeInTheDocument();
  });

  it('renders the episode header with no loaded-record count', () => {
    renderPage({ episodes: Array.from({ length: 5 }, (_, index) => episode(index)) });

    expect(screen.getByText('Blog Posts')).toBeInTheDocument();
    expect(screen.queryByText(/Blog Posts \(/)).not.toBeInTheDocument();
  });

  it('renders Page 1 with no denominator once more episodes can be fetched', () => {
    renderPage({ episodes: Array.from({ length: 24 }, (_, index) => episode(index)), lastKey: 'cursor' });

    expect(screen.getAllByText('Page 1').length).toBeGreaterThan(0);
    expect(screen.queryByText(/ of /i)).not.toBeInTheDocument();
  });
});
