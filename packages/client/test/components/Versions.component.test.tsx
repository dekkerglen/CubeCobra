import React from 'react';

import { fireEvent, render, screen, within } from '@testing-library/react';

import '@testing-library/jest-dom';

import { CardDetails } from '@utils/datatypes/Card';

import CardVersions from 'components/cardPage/Versions';
import { getPlaceholderCardDetails } from 'utils/placeholderCardDetails';

jest.mock('components/WithAutocard', () => ({
  __esModule: true,
  default: (Tag: React.ElementType) => (props: any) => <Tag {...props} />,
}));

const card: CardDetails = {
  ...getPlaceholderCardDetails('this-printing'),
  name: 'Soltari Foot Soldier',
};

const version = (id: string, set: string): CardDetails => ({
  ...getPlaceholderCardDetails(id),
  name: 'Soltari Foot Soldier',
  set,
  set_name: `${set} Edition`,
  collector_number: '12',
  released_at: '2001-01-01',
});

const manyVersions = (count: number): CardDetails[] =>
  Array.from({ length: count }, (_, i) => version(`v${i}`, `s${i}`));

describe('Other Printings', () => {
  it('names the section', () => {
    render(<CardVersions card={card} versions={[version('a', 'tmp')]} />);

    expect(screen.getByText('Other Printings')).toBeInTheDocument();
  });

  it('puts the pager in the header rather than giving it a row of its own', () => {
    render(<CardVersions card={card} versions={manyVersions(25)} />);

    const header = screen.getByText('Other Printings').closest('.border-b') as HTMLElement;

    expect(within(header).getByText('Page 1 of 3')).toBeInTheDocument();
  });

  it('pages through the printings from the header', () => {
    render(<CardVersions card={card} versions={manyVersions(25)} />);

    const header = screen.getByText('Other Printings').closest('.border-b') as HTMLElement;
    // The pager is first/prev/next/last; the icons carry no accessible name.
    fireEvent.click(within(header).getAllByRole('button')[2]);

    expect(within(header).getByText('Page 2 of 3')).toBeInTheDocument();
    expect(screen.getByText(/s10 Edition/)).toBeInTheDocument();
    expect(screen.queryByText(/s0 Edition/)).not.toBeInTheDocument();
  });

  it('leaves the header uncluttered when everything fits on one page', () => {
    render(<CardVersions card={card} versions={[version('a', 'tmp')]} />);

    expect(screen.queryByText(/Page 1 of 1/)).not.toBeInTheDocument();
  });

  it('offers the full printing search in its footer, where the list ends', () => {
    const { container } = render(<CardVersions card={card} versions={[version('a', 'tmp')]} />);

    const footer = container.querySelector('.border-t') as HTMLElement;
    const link = within(footer).getByText('View all printings');

    expect(link).toHaveAttribute('href', expect.stringContaining('di=printings'));
    expect(link).toHaveAttribute('href', expect.stringContaining('Soltari Foot Soldier'));
  });

  it('keeps the header and the search link even when there is nothing else to list', () => {
    render(<CardVersions card={card} versions={[]} />);

    expect(screen.getByText('Other Printings')).toBeInTheDocument();
    expect(screen.getByText('No other printings')).toBeInTheDocument();
    expect(screen.getByText('View all printings')).toBeInTheDocument();
  });
});
