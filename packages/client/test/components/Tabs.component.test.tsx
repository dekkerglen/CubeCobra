import React from 'react';

import { fireEvent, render, screen } from '@testing-library/react';

import '@testing-library/jest-dom';

import { TabbedView } from 'components/base/Tabs';

const mountSpy = jest.fn();

const Probe: React.FC<{ name: string }> = ({ name }) => {
  React.useEffect(() => {
    mountSpy(name);
  }, [name]);
  return <div>{`content-${name}`}</div>;
};

const Harness: React.FC = () => {
  const [active, setActive] = React.useState(0);
  return (
    <TabbedView
      activeTab={active}
      tabs={[
        { label: 'First', onClick: () => setActive(0), content: <Probe name="first" /> },
        { label: 'Second', onClick: () => setActive(1), content: <Probe name="second" /> },
        { label: 'Third', onClick: () => setActive(2), content: <Probe name="third" /> },
      ]}
    />
  );
};

describe('TabContent mounting', () => {
  beforeEach(() => mountSpy.mockClear());

  it('does not mount the content of tabs that have never been opened', () => {
    render(<Harness />);

    expect(screen.getByText('content-first')).toBeInTheDocument();
    expect(screen.queryByText('content-second')).not.toBeInTheDocument();
    expect(screen.queryByText('content-third')).not.toBeInTheDocument();
  });

  it('mounts a tab the first time it is opened', () => {
    render(<Harness />);

    fireEvent.click(screen.getByRole('button', { name: 'Second' }));

    expect(screen.getByText('content-second')).toBeInTheDocument();
    expect(screen.queryByText('content-third')).not.toBeInTheDocument();
  });

  // Staying mounted keeps tab state and avoids refetching on every switch.
  it('keeps a visited tab mounted after switching away, without remounting it', () => {
    render(<Harness />);

    fireEvent.click(screen.getByRole('button', { name: 'Second' }));
    expect(mountSpy).toHaveBeenCalledWith('second');

    mountSpy.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'First' }));

    expect(screen.getByText('content-second')).toBeInTheDocument();
    expect(mountSpy).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Second' }));
    expect(mountSpy).not.toHaveBeenCalled();
  });

  it('mounts whichever tab is active on the first render', () => {
    render(
      <TabbedView
        activeTab={2}
        tabs={[
          { label: 'First', content: <Probe name="first" /> },
          { label: 'Second', content: <Probe name="second" /> },
          { label: 'Third', content: <Probe name="third" /> },
        ]}
      />,
    );

    expect(screen.getByText('content-third')).toBeInTheDocument();
    expect(screen.queryByText('content-first')).not.toBeInTheDocument();
  });
});
