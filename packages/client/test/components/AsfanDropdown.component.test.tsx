import React from 'react';

import { render, screen } from '@testing-library/react';

import '@testing-library/jest-dom';

import Cube from '@utils/datatypes/Cube';

import AsfanDropdown from '../../src/components/analytics/AsfanDropdown';

const createCube = (overrides: Partial<Cube> = {}): Cube =>
  ({
    id: 'cube-1',
    name: 'Test Cube',
    formats: [{ title: 'Custom', packs: [] }],
    ...overrides,
  }) as unknown as Cube;

const renderDropdown = (cube: Cube, draftFormat = '-1', setDraftFormat: (value: string) => void = () => {}) =>
  render(
    <AsfanDropdown
      cube={cube}
      draftFormat={draftFormat}
      setDraftFormat={setDraftFormat}
      useAsfans
      alwaysOn
      setUseAsfans={() => {}}
    />,
  );

const optionLabels = () =>
  Array.from(screen.getByRole('combobox').querySelectorAll('option')).map((option) => option.textContent);

describe('AsfanDropdown', () => {
  it('offers Standard Draft alongside the custom formats', () => {
    renderDropdown(createCube());

    expect(optionLabels()).toEqual(['Standard Draft', 'Custom']);
    expect(screen.getByRole('combobox')).toHaveValue('-1');
  });

  it('offers Standard Draft when the cube has no custom formats', () => {
    renderDropdown(createCube({ formats: [] }));

    expect(optionLabels()).toEqual(['Standard Draft']);
  });

  it('omits Standard Draft when the cube has it disabled', () => {
    renderDropdown(createCube({ disableDraft: true }), '0');

    expect(optionLabels()).toEqual(['Custom']);
  });

  it('offers Standard Draft when it is disabled but there are no custom formats to fall back to', () => {
    renderDropdown(createCube({ disableDraft: true, formats: [] }));

    expect(optionLabels()).toEqual(['Standard Draft']);
  });

  it('tolerates a cube without a formats array', () => {
    renderDropdown(createCube({ formats: undefined as unknown as Cube['formats'] }));

    expect(optionLabels()).toEqual(['Standard Draft']);
  });

  describe('coercing an unavailable selection', () => {
    it('falls back to the first custom format when Standard Draft is disabled', () => {
      const setDraftFormat = jest.fn();
      renderDropdown(createCube({ disableDraft: true }), '-1', setDraftFormat);

      expect(setDraftFormat).toHaveBeenCalledWith('0');
    });

    it('falls back to Standard Draft when the selected format no longer exists', () => {
      const setDraftFormat = jest.fn();
      renderDropdown(createCube(), '7', setDraftFormat);

      expect(setDraftFormat).toHaveBeenCalledWith('-1');
    });

    it('leaves a selection that is still available alone', () => {
      const setDraftFormat = jest.fn();
      renderDropdown(createCube(), '0', setDraftFormat);

      expect(setDraftFormat).not.toHaveBeenCalled();
    });

    it('leaves Standard Draft alone when it is available', () => {
      const setDraftFormat = jest.fn();
      renderDropdown(createCube(), '-1', setDraftFormat);

      expect(setDraftFormat).not.toHaveBeenCalled();
    });
  });
});
