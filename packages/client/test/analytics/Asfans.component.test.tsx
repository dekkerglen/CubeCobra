import React from 'react';

import { render, screen } from '@testing-library/react';

import '@testing-library/jest-dom';

import Cube from '@utils/datatypes/Cube';
import { DraftFormat } from '@utils/datatypes/Draft';

import CubeContext from 'contexts/CubeContext';

import Asfans from '../../src/analytics/Asfans';

const format = (title: string): DraftFormat =>
  ({
    title,
    packs: [{ slots: [{ filter: '*' }], steps: [{ action: 'pick', amount: 1 }] }],
    multiples: false,
    defaultSeats: 8,
  }) as unknown as DraftFormat;

const card = (id: string) => ({
  cardID: id,
  index: 0,
  board: 'mainboard',
  details: { name: id, colors: [], type: 'Creature', cmc: 1, color_identity: [] },
});

const renderAsfans = (cubeOverrides: Partial<Cube>) =>
  render(
    <CubeContext.Provider
      value={
        {
          cube: { id: 'cube-1', name: 'Test Cube', formats: [], ...cubeOverrides } as Cube,
          changedCards: { mainboard: [card('a'), card('b')] },
        } as any
      }
    >
      <Asfans />
    </CubeContext.Provider>,
  );

// The format Select renders a label without an id to bind it to, so it cannot be queried by
// label text; it is the first combobox on the page, ahead of "Order By".
const formatSelect = () => screen.getAllByRole('combobox')[0] as HTMLSelectElement;

describe('Asfans draft format selection', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/cube/analysis/cube-1?view=asfans');
  });

  it("starts on the cube's default format", () => {
    renderAsfans({ formats: [format('Powered'), format('Peasant')], defaultFormat: 1 });

    expect(formatSelect()).toHaveValue('1');
  });

  it('starts on Standard Draft when the cube defaults to it', () => {
    renderAsfans({ formats: [format('Powered')], defaultFormat: -1 });

    expect(formatSelect()).toHaveValue('-1');
  });

  it('starts on Standard Draft when the cube has no default', () => {
    renderAsfans({ formats: [format('Powered')] });

    expect(formatSelect()).toHaveValue('-1');
  });

  it('lets the query param override the default', () => {
    window.history.replaceState({}, '', '/cube/analysis/cube-1?view=asfans&format=-1');

    renderAsfans({ formats: [format('Powered')], defaultFormat: 0 });

    expect(formatSelect()).toHaveValue('-1');
  });

  it('coerces a default that points at a format the cube no longer offers', () => {
    renderAsfans({ formats: [format('Powered')], defaultFormat: 5 });

    expect(formatSelect()).toHaveValue('-1');
  });
});
