import React from 'react';

import { render, screen } from '@testing-library/react';

import '@testing-library/jest-dom';

import PracticeDraftView from '../../src/components/playtest/PracticeDraftView';

jest.mock('components/CustomDraftCard', () => () => <div>Custom Draft</div>);
jest.mock('components/GridDraftCard', () => () => <div>Grid Draft</div>);
jest.mock('components/SealedCard', () => () => <div>Sealed Draft</div>);
jest.mock('components/StandardDraftCard', () => () => <div>Standard Draft</div>);

describe('PracticeDraftView', () => {
  it('renders without crashing when cube.formats is missing', () => {
    render(
      <PracticeDraftView
        cube={
          {
            id: 'cube-1',
            name: 'Test Cube',
            defaultFormat: -1,
            disableDraft: false,
            disableMultiplayer: true,
            disableSealed: true,
            disableGrid: true,
          } as any
        }
      />,
    );

    expect(screen.getByText('Standard Draft')).toBeInTheDocument();
    expect(screen.getByText('Draft Simulator')).toBeInTheDocument();
  });
});
