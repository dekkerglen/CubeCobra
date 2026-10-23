import React from 'react';

import { fireEvent, render, screen } from '@testing-library/react';

import '@testing-library/jest-dom';

import RotisserieDraftPanel from 'components/cube/RotisserieDraftPanel';
import CubeContext from 'contexts/CubeContext';
import RotoDraftContext from 'contexts/RotoDraftContext';

jest.mock('hooks/usePollGoogleSheet', () => ({
  __esModule: true,
  default: () => {},
}));

const renderPanel = (url: string, setUrl = jest.fn()) => {
  render(
    <CubeContext.Provider value={{ changedCards: { mainboard: [] } } as any}>
      <RotoDraftContext.Provider
        value={
          {
            url,
            setUrl,
            rotoInfo: { picks: {}, players: {}, picksByPlayer: {} },
            assignCardIndexes: jest.fn(),
          } as any
        }
      >
        <RotisserieDraftPanel />
      </RotoDraftContext.Provider>
    </CubeContext.Provider>,
  );
  return setUrl;
};

describe('RotisserieDraftPanel', () => {
  it('renders nothing when no draft is connected', () => {
    renderPanel('');
    expect(screen.queryByText('Rotisserie Draft Picks')).not.toBeInTheDocument();
  });

  it('offers Disconnect as soon as a sheet is connected, even before picks load', () => {
    const setUrl = renderPanel('https://sheet.csv');

    fireEvent.click(screen.getByRole('button', { name: 'Disconnect' }));

    expect(setUrl).toHaveBeenCalledWith('');
  });
});
