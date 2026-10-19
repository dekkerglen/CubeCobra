import React, { useState } from 'react';

import { fireEvent, render, screen, within } from '@testing-library/react';

import '@testing-library/jest-dom';

import { rectSortingStrategy } from '@dnd-kit/sortable';
import { PrimerTab } from '@utils/primerTabs';

import PrimerTabsEditor from 'components/about/PrimerTabsEditor';
import { SortableList } from 'components/DND';

jest.mock('components/DND', () => {
  const actual = jest.requireActual('components/DND');
  return { ...actual, SortableList: jest.fn(actual.SortableList) };
});

jest.mock('components/Markdown', () => ({
  __esModule: true,
  default: ({ markdown }: { markdown: string }) => <div>{markdown}</div>,
  SafeMarkdown: ({ markdown }: { markdown: string }) => <div>{markdown}</div>,
}));

let latestTabs: PrimerTab[] = [];
let latestSelected = 0;

const Harness: React.FC<{ initial: PrimerTab[]; initialSelected?: number }> = ({ initial, initialSelected = 0 }) => {
  const [tabs, setTabs] = useState(initial);
  const [selected, setSelected] = useState(initialSelected);
  latestTabs = tabs;
  latestSelected = selected;
  return <PrimerTabsEditor tabs={tabs} setTabs={setTabs} selected={selected} setSelected={setSelected} />;
};

const twoTabs: PrimerTab[] = [
  { title: 'Primer', content: 'English body' },
  { title: 'Español', content: 'Cuerpo' },
];

describe('PrimerTabsEditor', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('starts on the passed selected tab', () => {
    render(<Harness initial={twoTabs} initialSelected={1} />);
    expect(screen.getByLabelText('Tab title')).toHaveValue('Español');
    expect(screen.getByRole('button', { name: 'Español', pressed: true })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Primer', pressed: false })).toBeInTheDocument();
  });

  it('sorts with the wrapping-aware rect strategy', () => {
    render(<Harness initial={twoTabs} />);
    // React 19 dropped legacy context, so function components are called with props only;
    // under React 18 the second argument was an empty legacy-context object.
    expect(SortableList).toHaveBeenCalledWith(expect.objectContaining({ strategy: rectSortingStrategy }), undefined);
  });

  it('renders a labelled list of tabs rather than a tablist', () => {
    render(<Harness initial={twoTabs} />);
    const list = screen.getByRole('list', { name: 'Primer tabs' });
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(twoTabs.length);
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
    items.forEach((item) => {
      const pressable = within(item)
        .getAllByRole('button')
        .filter((button) => button.hasAttribute('aria-pressed'));
      expect(pressable).toHaveLength(1);
      expect(within(item).getByRole('img', { name: 'Drag to reorder' })).toBeInTheDocument();
      expect(within(item).getByRole('button', { name: /^Remove tab / })).toBeInTheDocument();
    });
    expect(list.querySelectorAll('[role="button"]')).toHaveLength(0);
  });

  it('adds and selects new tabs with incrementing titles', () => {
    render(<Harness initial={[{ title: 'Primer', content: '' }]} />);

    fireEvent.click(screen.getByRole('button', { name: '+ Add tab' }));
    expect(latestTabs.map((t) => t.title)).toEqual(['Primer', 'New Tab']);
    expect(latestSelected).toBe(1);
    expect(screen.getByLabelText('Tab title')).toHaveValue('New Tab');

    fireEvent.click(screen.getByRole('button', { name: '+ Add tab' }));
    expect(latestTabs.map((t) => t.title)).toEqual(['Primer', 'New Tab', 'New Tab 2']);
    expect(latestSelected).toBe(2);
  });

  it('disables add at the tab limit', () => {
    const tabs = Array.from({ length: 10 }, (_, i) => ({ title: `T${i}`, content: '' }));
    render(<Harness initial={tabs} />);
    expect(screen.getByRole('button', { name: '+ Add tab' })).toBeDisabled();
  });

  it('has no remove button with a single tab', () => {
    render(<Harness initial={[{ title: 'Primer', content: 'x' }]} />);
    expect(screen.queryByRole('button', { name: 'Remove tab Primer' })).not.toBeInTheDocument();
  });

  it('removes an empty tab without confirming', () => {
    const confirm = jest.spyOn(window, 'confirm');
    render(
      <Harness
        initial={[
          { title: 'Primer', content: 'x' },
          { title: 'Empty', content: '' },
        ]}
        initialSelected={1}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Remove tab Empty' }));
    expect(confirm).not.toHaveBeenCalled();
    expect(latestTabs.map((t) => t.title)).toEqual(['Primer']);
    expect(latestSelected).toBe(0);
  });

  it('keeps a tab with content when confirm is declined', () => {
    jest.spyOn(window, 'confirm').mockReturnValue(false);
    render(<Harness initial={twoTabs} initialSelected={1} />);
    fireEvent.click(screen.getByRole('button', { name: 'Remove tab Español' }));
    expect(window.confirm).toHaveBeenCalled();
    expect(latestTabs).toHaveLength(2);
  });

  it('removes a tab with content when confirmed and clamps selection', () => {
    jest.spyOn(window, 'confirm').mockReturnValue(true);
    render(<Harness initial={twoTabs} initialSelected={1} />);
    fireEvent.click(screen.getByRole('button', { name: 'Remove tab Español' }));
    expect(latestTabs.map((t) => t.title)).toEqual(['Primer']);
    expect(latestSelected).toBe(0);
  });

  it('edits the selected title with a max length', () => {
    render(<Harness initial={twoTabs} initialSelected={1} />);
    const input = screen.getByLabelText('Tab title');
    expect(input).toHaveAttribute('maxlength', '50');
    fireEvent.change(input, { target: { value: 'Deutsch' } });
    expect(latestTabs[1]!.title).toBe('Deutsch');
    expect(latestTabs[0]!.title).toBe('Primer');
  });

  it('labels a blank-titled tab as untitled and flags the missing title', () => {
    render(<Harness initial={twoTabs} initialSelected={1} />);
    expect(screen.queryByText('Title required')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Tab title'), { target: { value: '   ' } });

    const tab = screen.getByRole('button', { name: '(untitled)' });
    expect(tab.className).toContain('italic');
    expect(screen.getByRole('button', { name: 'Remove untitled tab' })).toBeInTheDocument();
    expect(screen.getByText('Title required')).toBeInTheDocument();
  });

  it('only shows Title required for the selected tab', () => {
    render(<Harness initial={twoTabs} initialSelected={1} />);
    fireEvent.change(screen.getByLabelText('Tab title'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Primer' }));
    expect(screen.queryByText('Title required')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '(untitled)' })).toBeInTheDocument();
  });

  it('shows the counters', () => {
    render(
      <Harness
        initial={[
          { title: 'Primer', content: 'a'.repeat(30) },
          { title: 'Two', content: 'b'.repeat(12) },
        ]}
      />,
    );
    expect(screen.getByText('42 / 100,000 characters (all tabs)')).toBeInTheDocument();
    expect(screen.getByText('2 / 10 tabs')).toBeInTheDocument();
    expect(screen.queryByText('Over the limit — shorten the primer before saving.')).not.toBeInTheDocument();
  });

  it('shows only the combined counter, not a per-tab one', () => {
    render(<Harness initial={[{ title: 'Primer', content: 'a'.repeat(30) }]} />);
    expect(screen.getByText('30 / 100,000 characters (all tabs)')).toBeInTheDocument();
    expect(screen.queryByText('30 / 100000')).not.toBeInTheDocument();
    expect(screen.queryByText(/^\d+ \/ 100000$/)).not.toBeInTheDocument();
  });

  it('shows a danger counter and message when over the limit', () => {
    render(<Harness initial={[{ title: 'Primer', content: 'a'.repeat(100_001) }]} />);
    const counter = screen.getByText('100,001 / 100,000 characters (all tabs)');
    expect(counter.className).toContain('text-red-500');
    expect(screen.getByText('Over the limit — shorten the primer before saving.')).toBeInTheDocument();
  });
});
