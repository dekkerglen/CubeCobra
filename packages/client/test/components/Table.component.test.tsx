import React from 'react';

import { render } from '@testing-library/react';

import '@testing-library/jest-dom';

import Table from 'components/base/Table';

const rows = [
  { label: 'Standard', value: 'Legal' },
  { label: 'Modern', value: 'Banned' },
];

describe('Table', () => {
  it('rules itself off from the page by default', () => {
    const { container } = render(<Table rows={rows} />);

    expect(container.querySelector('table')?.className).toContain('border-border');
  });

  it('drops every rule when borderless, leaving the stripes to separate the rows', () => {
    const { container } = render(<Table rows={rows} borderless />);

    const bordered = [...container.querySelectorAll('table, tr, td, th')].filter((el) =>
      el.className.includes('border-border'),
    );

    expect(bordered).toHaveLength(0);
  });

  it('pads its cells more generously when there is no rule to space them', () => {
    const { container: plain } = render(<Table rows={rows} />);
    const { container: borderless } = render(<Table rows={rows} borderless />);

    expect(plain.querySelector('td')?.className).toContain('p-1');
    expect(borderless.querySelector('td')?.className).toContain('p-2');
  });

  it('still stripes alternate rows, which is what separates them', () => {
    const { container } = render(<Table rows={rows} borderless />);

    const [first, second] = [...container.querySelectorAll('tbody tr')];

    expect(first.className).not.toBe(second.className);
  });
});
