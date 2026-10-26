import React from 'react';

import { render, screen, within } from '@testing-library/react';

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

describe('Other Printings', () => {
  it('names the section', () => {
    render(<CardVersions card={card} versions={[version('a', 'tmp')]} />);

    expect(screen.getByText('Other Printings')).toBeInTheDocument();
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
