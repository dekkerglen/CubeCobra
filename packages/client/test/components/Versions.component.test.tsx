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
  set: 'tmp',
  set_name: 'Tempest',
  collector_number: '42',
  released_at: '1997-10-14',
  prices: { usd: 0.29 },
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

describe('Printings', () => {
  it('names the section for every printing it lists, not just the other ones', () => {
    render(<CardVersions card={card} versions={[version('a', 'str')]} />);

    expect(screen.getByText('Printings')).toBeInTheDocument();
    expect(screen.queryByText('Other Printings')).not.toBeInTheDocument();
  });

  it('leads with the printing being viewed', () => {
    render(<CardVersions card={card} versions={[version('a', 'str')]} />);

    const [, current, next] = screen.getAllByRole('row');

    expect(within(current).getByText('Tempest [TMP-42]')).toBeInTheDocument();
    expect(within(next).getByText(/str Edition/)).toBeInTheDocument();
  });

  it('prices the printing being viewed like any other', () => {
    render(<CardVersions card={card} versions={[]} />);

    const [, current] = screen.getAllByRole('row');

    expect(within(current).getByText('$0.29')).toBeInTheDocument();
  });

  it('lists the printing being viewed once, even if it also arrives among the versions', () => {
    // The server filters it out today; a duplicate row is the failure if that changes.
    render(<CardVersions card={card} versions={[card, version('a', 'str')]} />);

    expect(screen.getAllByText('Tempest [TMP-42]')).toHaveLength(1);
  });

  it('puts the pager in the header rather than giving it a row of its own', () => {
    render(<CardVersions card={card} versions={manyVersions(25)} />);

    const header = screen.getByText('Printings').closest('.border-b') as HTMLElement;

    expect(within(header).getByText('Page 1 of 3')).toBeInTheDocument();
  });

  it('pages through the printings from the header', () => {
    render(<CardVersions card={card} versions={manyVersions(25)} />);

    const header = screen.getByText('Printings').closest('.border-b') as HTMLElement;
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

  it('still has a row to show when this is the only printing', () => {
    render(<CardVersions card={card} versions={[]} />);

    expect(screen.getByText('Printings')).toBeInTheDocument();
    expect(screen.getByText('Tempest [TMP-42]')).toBeInTheDocument();
    expect(screen.getByText('View all printings')).toBeInTheDocument();
  });
});
