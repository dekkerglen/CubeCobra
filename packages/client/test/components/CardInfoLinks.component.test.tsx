import React from 'react';

import { render, screen } from '@testing-library/react';

import '@testing-library/jest-dom';

import { CardDetails } from '@utils/datatypes/Card';
import HistoryType from '@utils/datatypes/History';

import CardBreakdownInfo from 'components/cardPage/Info';
import { getPlaceholderCardDetails } from 'utils/placeholderCardDetails';

// Markdown pulls in github-slugger, which is ESM-only and unloadable under this Jest
// config. Nothing in these link buttons depends on it.
jest.mock('components/Markdown', () => ({
  __esModule: true,
  default: () => <div />,
}));

const card: CardDetails = {
  ...getPlaceholderCardDetails('scryfall-id'),
  name: 'Soltari Foot Soldier',
  prices: { usd: 0.44 },
};

describe('card page info tab links', () => {
  it.each([['View on TCGPlayer'], ['View on Card Kingdom']])('leaves %s to the Purchase section', (label) => {
    render(<CardBreakdownInfo card={card} history={[] as HistoryType[]} />);

    expect(screen.queryByText(label)).not.toBeInTheDocument();
  });

  it.each([['View on Scryfall'], ['View on EDHRec'], ['View all Printings']])(
    'keeps %s, which nothing else duplicates',
    (label) => {
      render(<CardBreakdownInfo card={card} history={[] as HistoryType[]} />);

      expect(screen.getByText(label)).toBeInTheDocument();
    },
  );
});
