import React from 'react';

import { fireEvent, render, screen } from '@testing-library/react';

import '@testing-library/jest-dom';

import { navigateToRotoList } from 'utils/rotodraft';

import PracticeDraftView from '../../src/components/playtest/PracticeDraftView';

jest.mock('utils/rotodraft', () => ({
  ...jest.requireActual('utils/rotodraft'),
  navigateToRotoList: jest.fn(),
}));
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

  it('sets up a rotisserie draft and opens the list page with the sheet connected', () => {
    render(<PracticeDraftView cube={{ id: 'cube-1', name: 'Test Cube', defaultFormat: -1 } as any} />);

    expect(screen.queryByText(/Display/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Set Up Rotisserie Draft' }));
    fireEvent.change(screen.getByLabelText('Google Sheet CSV URL:'), { target: { value: 'https://sheet.csv' } });
    fireEvent.click(screen.getByRole('button', { name: 'OK' }));

    expect(navigateToRotoList).toHaveBeenCalledWith('cube-1', 'https://sheet.csv');
  });
});
