import React from 'react';

import { fireEvent, render, screen } from '@testing-library/react';

import '@testing-library/jest-dom';

import { PrimerTab } from '@utils/primerTabs';

import PrimerView from 'components/about/PrimerView';
import { CSRFContext } from 'contexts/CSRFContext';
import CubeContext from 'contexts/CubeContext';

const mockRenderedMarkdown: string[] = [];

jest.mock('components/Markdown', () => ({
  __esModule: true,
  default: ({ markdown }: { markdown: string }) => <div>{markdown}</div>,
  SafeMarkdown: ({ markdown }: { markdown: string }) => {
    mockRenderedMarkdown.push(markdown);
    return <div>{markdown}</div>;
  },
}));

const threeTabs: PrimerTab[] = [
  { title: 'Primer', content: 'English body' },
  { title: 'Español', content: 'Cuerpo español' },
  { title: '日本語', content: '日本語の本文' },
];

const renderView = (primerTabs: PrimerTab[], search = '') => {
  window.history.replaceState({}, '', `/cube/about/c1?view=primer${search}`);
  const cubeValue = { cube: { id: 'c1', cardCount: 1 }, canEdit: false } as any;
  const csrfValue = { csrfFetch: jest.fn() } as any;
  return render(
    <CubeContext.Provider value={cubeValue}>
      <CSRFContext.Provider value={csrfValue}>
        <PrimerView primerTabs={primerTabs} tags={[]} />
      </CSRFContext.Provider>
    </CubeContext.Provider>,
  );
};

describe('PrimerView tabs', () => {
  it('renders no tablist for a single tab', () => {
    renderView([threeTabs[0]!]);
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    expect(screen.getByText('English body')).toBeInTheDocument();
  });

  it('renders a tablist with a selected primary tab by default', () => {
    renderView(threeTabs);
    expect(screen.getByRole('tablist')).toBeInTheDocument();
    expect(screen.getAllByRole('tab')).toHaveLength(3);
    expect(screen.getByRole('tab', { name: 'Primer' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('English body')).toBeInTheDocument();
    expect(screen.queryByText('Cuerpo español')).not.toBeInTheDocument();
  });

  it('opens a tab from a percent-encoded latin slug', () => {
    renderView(threeTabs, '&tab=espa%C3%B1ol');
    expect(screen.getByText('Cuerpo español')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Español' })).toHaveAttribute('aria-selected', 'true');
  });

  it('paints the deep-linked tab on the first render', () => {
    mockRenderedMarkdown.length = 0;
    renderView(threeTabs, '&tab=espa%C3%B1ol');
    expect(mockRenderedMarkdown[0]).toBe('Cuerpo español');
    expect(mockRenderedMarkdown).not.toContain('English body');
  });

  it('opens a tab from a percent-encoded CJK slug', () => {
    renderView(threeTabs, '&tab=%E6%97%A5%E6%9C%AC%E8%AA%9E');
    expect(screen.getByText('日本語の本文')).toBeInTheDocument();
  });

  it('falls back to the first tab for an unknown slug', () => {
    renderView(threeTabs, '&tab=missing');
    expect(screen.getByText('English body')).toBeInTheDocument();
  });

  it('writes the tab param when selecting a tab and clears it for the primary tab', () => {
    renderView(threeTabs);

    fireEvent.click(screen.getByRole('tab', { name: 'Español' }));
    expect(window.location.search).toContain('tab=espa%C3%B1ol');
    expect(screen.getByText('Cuerpo español')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Primer' }));
    expect(new URLSearchParams(window.location.search).has('tab')).toBe(false);
    expect(screen.getByText('English body')).toBeInTheDocument();
  });
});

describe('PrimerView tabs accessibility', () => {
  it('wires tab ids, aria-controls and the tabpanel', () => {
    renderView(threeTabs, '&tab=espa%C3%B1ol');
    const tabs = screen.getAllByRole('tab');
    tabs.forEach((tab, index) => {
      expect(tab).toHaveAttribute('id', `primer-tab-${index}`);
      expect(tab).toHaveAttribute('aria-controls', 'primer-tabpanel');
    });
    const panel = screen.getByRole('tabpanel');
    expect(panel).toHaveAttribute('id', 'primer-tabpanel');
    expect(panel).toHaveAttribute('aria-labelledby', 'primer-tab-1');
    expect(panel).toHaveAttribute('tabindex', '0');
    expect(panel).toHaveTextContent('Cuerpo español');
  });

  it('does not render a tabpanel for a single tab', () => {
    renderView([threeTabs[0]!]);
    expect(screen.queryByRole('tabpanel')).not.toBeInTheDocument();
  });

  it('gives only the selected tab tabIndex 0', () => {
    renderView(threeTabs, '&tab=espa%C3%B1ol');
    expect(screen.getByRole('tab', { name: 'Primer' })).toHaveAttribute('tabindex', '-1');
    expect(screen.getByRole('tab', { name: 'Español' })).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('tab', { name: '日本語' })).toHaveAttribute('tabindex', '-1');
  });

  it('moves to the next tab with ArrowRight, focusing it and updating the URL', () => {
    renderView(threeTabs);
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Primer' }), { key: 'ArrowRight' });
    const next = screen.getByRole('tab', { name: 'Español' });
    expect(next).toHaveAttribute('aria-selected', 'true');
    expect(next).toHaveFocus();
    expect(window.location.search).toContain('tab=espa%C3%B1ol');
  });

  it('wraps to the last tab with ArrowLeft from the first', () => {
    renderView(threeTabs);
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Primer' }), { key: 'ArrowLeft' });
    const last = screen.getByRole('tab', { name: '日本語' });
    expect(last).toHaveAttribute('aria-selected', 'true');
    expect(last).toHaveFocus();
  });

  it('wraps to the first tab with ArrowRight from the last', () => {
    renderView(threeTabs, '&tab=%E6%97%A5%E6%9C%AC%E8%AA%9E');
    fireEvent.keyDown(screen.getByRole('tab', { name: '日本語' }), { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { name: 'Primer' })).toHaveAttribute('aria-selected', 'true');
  });

  it('selects the last and first tabs with End and Home', () => {
    renderView(threeTabs);
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Primer' }), { key: 'End' });
    const last = screen.getByRole('tab', { name: '日本語' });
    expect(last).toHaveAttribute('aria-selected', 'true');
    expect(last).toHaveFocus();

    fireEvent.keyDown(last, { key: 'Home' });
    const first = screen.getByRole('tab', { name: 'Primer' });
    expect(first).toHaveAttribute('aria-selected', 'true');
    expect(first).toHaveFocus();
    expect(new URLSearchParams(window.location.search).has('tab')).toBe(false);
  });
});

describe('PrimerView edit mode', () => {
  const renderEditing = (primerTabs: PrimerTab[]) => {
    window.history.replaceState({}, '', '/cube/about/c1?view=primer');
    render(
      <CubeContext.Provider value={{ cube: { id: 'c1', cardCount: 1 }, canEdit: true } as any}>
        <CSRFContext.Provider value={{ csrfFetch: jest.fn() } as any}>
          <PrimerView primerTabs={primerTabs} tags={[]} />
        </CSRFContext.Provider>
      </CubeContext.Provider>,
    );
    fireEvent.click(screen.getByText('Edit Primer'));
  };

  it('enables Save for a valid primer with no validation message', () => {
    renderEditing(threeTabs);
    expect(screen.getByRole('button', { name: 'Save Changes' })).toBeEnabled();
    expect(screen.queryByText(/characters; the limit|needs a title/)).not.toBeInTheDocument();
  });

  it('disables Save and explains why when the primer is over the limit', () => {
    renderEditing([{ title: 'Primer', content: 'a'.repeat(100_001) }]);
    expect(screen.getByRole('button', { name: 'Save Changes' })).toBeDisabled();
    const message = screen.getByText('Primer is 100,001 characters; the limit is 100,000 across all tabs.');
    expect(message.className).toContain('text-red-500');
  });

  it('disables Save when a tab title is blank', () => {
    renderEditing(threeTabs);
    fireEvent.change(screen.getByLabelText('Tab title'), { target: { value: '  ' } });
    expect(screen.getByRole('button', { name: 'Save Changes' })).toBeDisabled();
    expect(screen.getByText('Every tab needs a title.')).toBeInTheDocument();
  });

  it('saves tabs without client keys and the editor selected index', async () => {
    window.history.replaceState({}, '', '/cube/about/c1?view=primer&tab=espa%C3%B1ol');
    const csrfFetch = jest.fn().mockResolvedValue({ ok: false, json: async () => ({ error: 'nope' }) });
    render(
      <CubeContext.Provider value={{ cube: { id: 'c1', cardCount: 1 }, canEdit: true } as any}>
        <CSRFContext.Provider value={{ csrfFetch } as any}>
          <PrimerView primerTabs={threeTabs} tags={['a']} />
        </CSRFContext.Provider>
      </CubeContext.Provider>,
    );

    fireEvent.click(screen.getByText('Edit Primer'));
    expect(screen.getByLabelText('Tab title')).toHaveValue('Español');

    fireEvent.click(screen.getByRole('button', { name: '日本語' }));
    fireEvent.change(screen.getByLabelText('Tab title'), { target: { value: 'Nihongo' } });
    fireEvent.click(screen.getByText('Save Changes'));

    expect(await screen.findByText('nope')).toBeInTheDocument();
    expect(csrfFetch).toHaveBeenCalledTimes(1);
    const [url, init] = csrfFetch.mock.calls[0];
    expect(url).toBe('/cube/api/editprimer');
    expect(JSON.parse(init.body)).toEqual({
      cubeId: 'c1',
      primerTabs: [
        { title: 'Primer', content: 'English body' },
        { title: 'Español', content: 'Cuerpo español' },
        { title: 'Nihongo', content: '日本語の本文' },
      ],
      tags: ['a'],
      activeTab: 2,
    });
  });
});
