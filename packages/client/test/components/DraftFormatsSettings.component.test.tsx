import React from 'react';

import { fireEvent, render, screen } from '@testing-library/react';

import '@testing-library/jest-dom';

import Cube from '@utils/datatypes/Cube';
import { DraftFormat } from '@utils/datatypes/Draft';

import { CSRFContext } from 'contexts/CSRFContext';
import CubeContext from 'contexts/CubeContext';

import DraftFormatsSettings from '../../src/components/settings/DraftFormatsSettings';

jest.mock('components/TextEntry', () => () => <div data-testid="text-entry" />);

const format = (title: string): DraftFormat =>
  ({
    title,
    packs: [{ slots: [{ filter: '*' }], steps: null }],
    multiples: false,
    defaultSeats: 8,
  }) as unknown as DraftFormat;

const renderSettings = (cube: Partial<Cube>) =>
  render(
    <CSRFContext.Provider value={{ csrfToken: 'token', csrfFetch: jest.fn(), callApi: jest.fn() } as any}>
      <CubeContext.Provider
        value={
          {
            cube: { id: 'cube-1', name: 'Test Cube', ...cube } as Cube,
            unfilteredChangedCards: { mainboard: [] },
          } as any
        }
      >
        <DraftFormatsSettings />
      </CubeContext.Provider>
    </CSRFContext.Provider>,
  );

const defaultFormatSelect = () => screen.getByLabelText('Default format') as HTMLSelectElement;

const defaultFormatLabels = () =>
  Array.from(defaultFormatSelect().querySelectorAll('option')).map((option) => option.textContent);

const standardDraftCheckbox = () => screen.getByRole('checkbox', { name: 'Enable Standard Draft' });

const deleteFormatButtons = () =>
  Array.from(document.querySelectorAll('button')).filter((button) => button.querySelector('svg.octicon-trash'));

describe('DraftFormatsSettings default format', () => {
  it('offers Standard Draft while it is enabled', () => {
    renderSettings({ formats: [format('Powered')] });

    expect(defaultFormatLabels()).toEqual(['Standard Draft', 'Powered']);
  });

  it('drops Standard Draft and moves the default off it when it is unchecked', () => {
    renderSettings({ formats: [format('Powered')], defaultFormat: -1 });

    expect(defaultFormatSelect()).toHaveValue('-1');

    fireEvent.click(standardDraftCheckbox());

    expect(defaultFormatLabels()).toEqual(['Powered']);
    expect(defaultFormatSelect()).toHaveValue('0');
  });

  it('leaves a custom default alone when Standard Draft is unchecked', () => {
    renderSettings({ formats: [format('Powered'), format('Peasant')], defaultFormat: 1 });

    fireEvent.click(standardDraftCheckbox());

    expect(defaultFormatSelect()).toHaveValue('1');
  });

  it('keeps Standard Draft listed when there is no custom format to fall back to', () => {
    renderSettings({ formats: [], defaultFormat: -1 });

    fireEvent.click(standardDraftCheckbox());

    expect(defaultFormatLabels()).toEqual(['Standard Draft']);
    expect(defaultFormatSelect()).toHaveValue('-1');
  });

  it('restores Standard Draft as a choice when it is re-enabled', () => {
    renderSettings({ formats: [format('Powered')], defaultFormat: -1 });

    fireEvent.click(standardDraftCheckbox());
    fireEvent.click(standardDraftCheckbox());

    expect(defaultFormatLabels()).toEqual(['Standard Draft', 'Powered']);
    expect(defaultFormatSelect()).toHaveValue('0');
  });
});

describe('DraftFormatsSettings deleting every custom format', () => {
  it('finds the delete controls', () => {
    renderSettings({ formats: [format('Powered'), format('Peasant')] });

    expect(deleteFormatButtons()).toHaveLength(2);
  });

  it('falls back to Standard Draft when the last format goes and it is enabled', () => {
    renderSettings({ formats: [format('Powered')], defaultFormat: 0 });

    fireEvent.click(deleteFormatButtons()[0]!);

    expect(defaultFormatLabels()).toEqual(['Standard Draft']);
    expect(defaultFormatSelect()).toHaveValue('-1');
  });

  it('still offers Standard Draft when the last format goes and it is disabled', () => {
    renderSettings({ formats: [format('Powered')], defaultFormat: 0 });

    fireEvent.click(standardDraftCheckbox());
    fireEvent.click(deleteFormatButtons()[0]!);

    expect(defaultFormatLabels()).toEqual(['Standard Draft']);
    expect(defaultFormatSelect()).toHaveValue('-1');
  });

  it('moves the default to a surviving format rather than a disabled Standard Draft', () => {
    renderSettings({ formats: [format('Powered'), format('Peasant')], defaultFormat: 0 });

    fireEvent.click(standardDraftCheckbox());
    fireEvent.click(deleteFormatButtons()[0]!);

    expect(defaultFormatLabels()).toEqual(['Peasant']);
    expect(defaultFormatSelect()).toHaveValue('0');
  });
});
