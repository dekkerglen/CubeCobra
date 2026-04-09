import React from 'react';

import { render, screen } from '@testing-library/react';

import '@testing-library/jest-dom';

import Datetime from 'components/base/Datetime';

describe('Datetime component', () => {
  const RealDate = Date;

  function mockNow(isoString: string) {
    const fixed = new RealDate(isoString).getTime();
    jest.spyOn(Date, 'now').mockReturnValue(fixed);
  }

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders a <time> element with a valid dateTime attribute', () => {
    mockNow('2024-06-15T12:00:00Z');
    render(<Datetime date={new RealDate('2024-06-10T12:00:00Z')} />);
    const el = screen.getByRole('time');
    expect(el).toBeInTheDocument();
    expect(el).toHaveAttribute('dateTime', '2024-06-10T12:00:00.000Z');
  });

  it('shows a relative label for a date within the last 7 days', () => {
    mockNow('2024-06-15T12:00:00Z');
    render(<Datetime date={new RealDate('2024-06-12T12:00:00Z')} />);
    expect(screen.getByRole('time').textContent).toMatch(/days? ago/i);
  });

  it('shows an absolute date for a date older than 7 days', () => {
    mockNow('2024-06-15T12:00:00Z');
    render(<Datetime date={new RealDate('2024-01-01T12:00:00Z')} />);
    expect(screen.getByRole('time').textContent).toMatch(/Jan 1, 2024/);
  });

  it('accepts a numeric timestamp', () => {
    mockNow('2024-06-15T12:00:00Z');
    const ts = new RealDate('2020-03-20T12:00:00Z').getTime();
    render(<Datetime date={ts} />);
    expect(screen.getByRole('time').textContent).toMatch(/Mar 20, 2020/);
  });

  it('shows "yesterday" for a date 1 day ago', () => {
    mockNow('2024-06-15T12:00:00Z');
    render(<Datetime date={new RealDate('2024-06-14T12:00:00Z')} />);
    expect(screen.getByRole('time').textContent).toMatch(/yesterday/i);
  });

  it('shows "less than a minute ago" for a date less than 30 seconds ago', () => {
    mockNow('2024-06-15T12:00:30Z');
    render(<Datetime date={new RealDate('2024-06-15T12:00:00Z')} />);
    expect(screen.getByRole('time').textContent).toBe('less than a minute ago');
  });
});
