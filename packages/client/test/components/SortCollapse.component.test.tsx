import React from 'react';

import { fireEvent, render, screen } from '@testing-library/react';

import '@testing-library/jest-dom';

import { DEFAULT_CUBE_DISPLAY_OPTIONS } from '@utils/datatypes/Cube';

import SortCollapse from 'components/SortCollapse';
import { CSRFContext } from 'contexts/CSRFContext';
import CubeContext from 'contexts/CubeContext';
import { DisplayContextProvider } from 'contexts/DisplayContext';

describe('SortCollapse display buttons', () => {
  it('toggle unsorted and duplicates on the page without saving', () => {
    const csrfFetch = jest.fn();
    render(
      <CSRFContext.Provider value={{ csrfToken: 't', csrfFetch, callApi: jest.fn() } as any}>
        <DisplayContextProvider cubeID="c1" savedDisplayOptions={DEFAULT_CUBE_DISPLAY_OPTIONS}>
          <CubeContext.Provider value={{ cube: { id: 'c1' }, effectiveDefaultSorts: [], resetSorts: jest.fn() } as any}>
            <SortCollapse isOpen />
          </CubeContext.Provider>
        </DisplayContextProvider>
      </CSRFContext.Provider>,
    );

    fireEvent.click(screen.getByText('Show Unsorted cards'));
    fireEvent.click(screen.getByText('Collapse Duplicate Cards'));

    expect(screen.getByText('Hide Unsorted cards')).toBeInTheDocument();
    expect(screen.getByText('Separate Duplicate Cards')).toBeInTheDocument();
    expect(csrfFetch).not.toHaveBeenCalled();
  });
});
