import React from 'react';

import { render, screen, within } from '@testing-library/react';

import '@testing-library/jest-dom';

import { CardDetails } from '@utils/datatypes/Card';
import HistoryType from '@utils/datatypes/History';

import CardBreakdownInfo from 'components/cardPage/Info';
import { getPlaceholderCardDetails } from 'utils/placeholderCardDetails';

// Markdown pulls in github-slugger, which is ESM-only and unloadable under this Jest
// config. Nothing in these tables depends on it.
jest.mock('components/Markdown', () => ({
  __esModule: true,
  default: () => <div />,
}));

const placeholder = getPlaceholderCardDetails('scryfall-id');

const card: CardDetails = {
  ...placeholder,
  name: 'Soltari Foot Soldier',
  scryfall_uri: 'https://scryfall.com/card/tmp/42',
  prices: { usd: 0.44 },
  legalities: {
    ...placeholder.legalities,
    Standard: 'not_legal',
    Legacy: 'legal',
    Vintage: 'restricted',
    Modern: 'banned',
  },
};

const renderInfo = () => render(<CardBreakdownInfo card={card} history={[] as HistoryType[]} />);
const rowFor = (label: string) => screen.getByText(label).parentElement as HTMLElement;

describe('card page info tab', () => {
  it('pairs every format with its status', () => {
    renderInfo();

    expect(within(rowFor('Standard')).getByText('Not Legal')).toBeInTheDocument();
    expect(within(rowFor('Legacy')).getByText('Legal')).toBeInTheDocument();
  });

  it('stripes the legality rows without drawing them as a table', () => {
    const { container } = renderInfo();

    // Purchase and Other Printings are tables; legality is a plain striped list.
    expect(screen.getByText('Standard').closest('table')).toBeNull();

    const rows = [...container.querySelectorAll('[data-legality-row]')];
    expect(rows).toHaveLength(12);
    expect(rows[0].className).not.toBe(rows[1].className);
  });

  it('puts the status chip before the format it describes, so the two sit together', () => {
    renderInfo();

    const row = rowFor('Standard');
    const chip = within(row).getByText('Not Legal');
    const format = within(row).getByText('Standard');

    expect(chip.compareDocumentPosition(format) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('lists every tracked format, split across two columns to stay compact', () => {
    renderInfo();

    for (const format of ['Standard', 'Pioneer', 'Modern', 'Legacy', 'Vintage', 'Premodern']) {
      expect(screen.getByText(format)).toBeInTheDocument();
    }
    for (const format of ['Brawl', 'Historic', 'Timeless', 'Pauper', 'Penny', 'Commander']) {
      expect(screen.getByText(format)).toBeInTheDocument();
    }
  });

  it('shows the status as a filled chip rather than bare text', () => {
    renderInfo();

    const status = within(rowFor('Legacy')).getByText('Legal');

    // Colour alone is not the signal here; the filled block is what the grid used.
    expect(status.className).toMatch(/\bbg-/);
  });

  it('distinguishes the statuses a format can be in', () => {
    renderInfo();

    expect(within(rowFor('Vintage')).getByText('Restricted')).toBeInTheDocument();
    expect(within(rowFor('Modern')).getByText('Banned')).toBeInTheDocument();
  });

  it('offers the external references as buttons below the tables, not as a table of their own', () => {
    renderInfo();

    expect(screen.getByText('Scryfall')).toHaveAttribute('href', 'https://scryfall.com/card/tmp/42');
    expect(screen.getByText('EDHREC')).toHaveAttribute('href', expect.stringContaining('edhrec.com'));
    expect(screen.getByText('MTG Top 8')).toHaveAttribute('href', expect.stringContaining('mtgtop8.com'));

    // Three rows made a table that read as a stub next to the twelve-row legality list.
    expect(screen.getByText('Scryfall').closest('table')).toBeNull();
    expect(screen.queryByText('Links')).not.toBeInTheDocument();
  });

  it('separates the card text from the data below it with a divider', () => {
    const { container } = renderInfo();

    const divider = [...container.querySelectorAll('hr')].pop() as HTMLElement;
    const illustrator = screen.getByText(/Illustrated by/);
    const firstFormat = screen.getByText('Standard');
    const after = (a: Element, b: Element) => !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

    // The rule has to fall between the card's own text and the tables, not above both.
    expect(after(illustrator, divider)).toBe(true);
    expect(after(divider, firstFormat)).toBe(true);
  });

  it('drops the Legality heading, which the status chips make obvious', () => {
    renderInfo();

    expect(screen.queryByText('Legality')).not.toBeInTheDocument();
    expect(screen.getByText('Standard')).toBeInTheDocument();
  });

  it('drops the card name from the link labels, which the heading already gives', () => {
    renderInfo();

    expect(screen.queryByText(/Soltari Foot Soldier/, { selector: 'a' })).not.toBeInTheDocument();
  });

  it.each([['View on TCGPlayer'], ['View on Card Kingdom'], ['View all Printings']])(
    'no longer carries %s',
    (label) => {
      renderInfo();

      expect(screen.queryByText(label)).not.toBeInTheDocument();
    },
  );
});
