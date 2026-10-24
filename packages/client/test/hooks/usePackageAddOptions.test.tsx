import React from 'react';

import { render, screen } from '@testing-library/react';
import { fireEvent } from '@testing-library/react';

import '@testing-library/jest-dom';

import usePackageAddOptions from 'hooks/usePackageAddOptions';

const Harness: React.FC = () => {
  const { autoTag, setAutoTag, useDefaultPrinting, setUseDefaultPrinting } = usePackageAddOptions();
  return (
    <div>
      <span data-testid="autoTag">{String(autoTag)}</span>
      <span data-testid="useDefaultPrinting">{String(useDefaultPrinting)}</span>
      <button onClick={() => setAutoTag(!autoTag)}>toggle autoTag</button>
      <button onClick={() => setUseDefaultPrinting(!useDefaultPrinting)}>toggle printing</button>
    </div>
  );
};

describe('usePackageAddOptions', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('defaults autotagging on and the printing override off', () => {
    render(<Harness />);

    expect(screen.getByTestId('autoTag')).toHaveTextContent('true');
    expect(screen.getByTestId('useDefaultPrinting')).toHaveTextContent('false');
  });

  it('persists each option under its own key', () => {
    render(<Harness />);

    fireEvent.click(screen.getByText('toggle autoTag'));
    fireEvent.click(screen.getByText('toggle printing'));

    expect(window.localStorage.getItem('packageAddAutoTag')).toEqual('false');
    expect(window.localStorage.getItem('packageAddUseDefaultPrinting')).toEqual('true');
  });

  it('shares stored options across separately mounted consumers', () => {
    const first = render(<Harness />);
    fireEvent.click(screen.getByText('toggle printing'));
    first.unmount();

    render(<Harness />);

    expect(screen.getByTestId('useDefaultPrinting')).toHaveTextContent('true');
  });
});
