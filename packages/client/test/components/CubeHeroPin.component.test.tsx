import React from 'react';

import { render, screen } from '@testing-library/react';

import '@testing-library/jest-dom';

import { DEFAULT_CUBE_DISPLAY_OPTIONS } from '@utils/datatypes/Cube';

import CubeHero from 'components/cube/CubeHero';
import { CSRFContext } from 'contexts/CSRFContext';
import CubeContext from 'contexts/CubeContext';
import { DisplayContextProvider } from 'contexts/DisplayContext';
import FilterContext from 'contexts/FilterContext';
import UserContext from 'contexts/UserContext';

import { createCube, createUser } from '../../../server/test/test-utils/data';

jest.mock('components/Markdown', () => ({
  __esModule: true,
  SafeMarkdown: () => <div />,
  default: () => <div />,
}));
jest.mock('components/modals/PrintAndPlayExportModal', () => ({ __esModule: true, default: () => <div /> }));
jest.mock('components/modals/ArenaExportModal', () => ({ __esModule: true, default: () => <div /> }));

const owner = createUser({ id: 'owner-1' });
const collaborator = createUser({ id: 'collab-1' });
const stranger = createUser({ id: 'stranger-1' });
const cube = createCube({ id: 'cube-1', owner, collaborators: ['collab-1'], pinnedByCurrentUser: false } as any);

const renderHero = (viewer: any) =>
  render(
    <CSRFContext.Provider value={{ csrfToken: 't', csrfFetch: jest.fn(), callApi: jest.fn() } as any}>
      <UserContext.Provider value={viewer}>
        <DisplayContextProvider cubeID={cube.id} savedDisplayOptions={DEFAULT_CUBE_DISPLAY_OPTIONS}>
          <FilterContext.Provider value={{ filterInput: '', cardFilter: { filter: null } } as any}>
            <CubeContext.Provider value={{ cube, unfilteredChangedCards: { mainboard: [] } } as any}>
              <CubeHero cube={cube} />
            </CubeContext.Provider>
          </FilterContext.Provider>
        </DisplayContextProvider>
      </UserContext.Provider>
    </CSRFContext.Provider>,
  );

const pinButtons = () => screen.queryAllByRole('button', { name: 'Pin to your menu (only you see this)' });

describe('CubeHero pin', () => {
  it('lets the owner pin, and says the pin is private', () => {
    renderHero(owner);

    expect(pinButtons().length).toBeGreaterThan(0);
    expect(pinButtons()[0]).toHaveAttribute('title', 'Pin to your menu (only you see this)');
    expect(pinButtons()[0]).toHaveTextContent('Pin');
  });

  it('lets a collaborator pin', () => {
    renderHero(collaborator);

    expect(pinButtons().length).toBeGreaterThan(0);
  });

  it('offers no pin to anyone else', () => {
    renderHero(stranger);

    expect(pinButtons()).toHaveLength(0);
  });
});
