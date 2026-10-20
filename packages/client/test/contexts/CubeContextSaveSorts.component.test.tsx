import React, { useContext } from 'react';

import { act, fireEvent, render, screen } from '@testing-library/react';

import '@testing-library/jest-dom';

import Cube from '@utils/datatypes/Cube';

import { ChangesContextProvider } from 'contexts/ChangesContext';
import { CSRFContext } from 'contexts/CSRFContext';
import CubeContext, { CubeContextProvider } from 'contexts/CubeContext';
import { DisplayContextProvider } from 'contexts/DisplayContext';
import { FilterContextProvider } from 'contexts/FilterContext';

const view = (name: string, defaultSorts: string[]) => ({
  name,
  boards: ['mainboard'],
  displayView: 'table' as const,
  defaultSorts,
});

const CUBE_SORTS = ['Color Category', 'Types-Multicolor', 'Mana Value', 'Alphabetical'];

const cube = {
  id: 'c1',
  shortId: 'c1',
  name: 'Test Cube',
  defaultSorts: CUBE_SORTS,
  views: [view('Mainboard', CUBE_SORTS), view('Base Packs', CUBE_SORTS)],
} as unknown as Cube;

const SaveSortsButton: React.FC = () => {
  const { saveSorts, cube: current } = useContext(CubeContext);
  const [result, setResult] = React.useState<string>('none');
  return (
    <>
      <button onClick={async () => setResult(String(await saveSorts()))}>save-sorts</button>
      <span data-testid="result">{result}</span>
      <span data-testid="mainboard-sort">{current.views?.[0]?.defaultSorts?.[0]}</span>
    </>
  );
};

const csrfFetch = jest.fn();

const renderProvider = (search: string) => {
  window.history.replaceState({}, '', `/cube/list/c1${search}`);
  return render(
    <CSRFContext.Provider value={{ csrfFetch, callApi: jest.fn() } as any}>
      <DisplayContextProvider cubeID="c1" viewSlugs={['mainboard', 'base-packs']}>
        <FilterContextProvider>
          <ChangesContextProvider cube={cube} cards={{ mainboard: [], maybeboard: [] } as any}>
            <CubeContextProvider initialCube={cube} cards={{ mainboard: [], maybeboard: [] }}>
              <SaveSortsButton />
            </CubeContextProvider>
          </ChangesContextProvider>
        </FilterContextProvider>
      </DisplayContextProvider>
    </CSRFContext.Provider>,
  );
};

const savedViews = () => JSON.parse(csrfFetch.mock.calls.at(-1)![1].body).views;

describe('CubeContext saveSorts', () => {
  beforeEach(() => {
    localStorage.clear();
    csrfFetch.mockReset();
    csrfFetch.mockResolvedValue({ ok: true, json: async () => ({ success: true }) });
  });

  it('saves sorts onto the view named by the URL slug', async () => {
    renderProvider('?view=base-packs&s1=Mana%20Value');

    await act(async () => {
      fireEvent.click(screen.getByText('save-sorts'));
    });

    const views = savedViews();
    expect(views.find((v: any) => v.name === 'Base Packs').defaultSorts[0]).toBe('Mana Value');
    expect(views.find((v: any) => v.name === 'Mainboard').defaultSorts[0]).toBe('Color Category');
  });

  it('saves sorts onto the first view when no view param is present', async () => {
    renderProvider('?s1=Mana%20Value');

    await act(async () => {
      fireEvent.click(screen.getByText('save-sorts'));
    });

    const views = savedViews();
    expect(views.find((v: any) => v.name === 'Mainboard').defaultSorts[0]).toBe('Mana Value');
    expect(views.find((v: any) => v.name === 'Base Packs').defaultSorts[0]).toBe('Color Category');
  });

  it('keeps the new sorts and reports success when the server accepts them', async () => {
    renderProvider('?s1=Mana%20Value');

    await act(async () => {
      fireEvent.click(screen.getByText('save-sorts'));
    });

    expect(screen.getByTestId('result')).toHaveTextContent('true');
    expect(screen.getByTestId('mainboard-sort')).toHaveTextContent('Mana Value');
  });

  it.each([
    ['a server error', { ok: false, status: 400, json: async () => ({ success: false, message: 'bad views' }) }],
    [
      'an expired session redirected to the login page',
      {
        ok: true,
        json: async () => {
          throw new SyntaxError('Unexpected token <');
        },
      },
    ],
  ])('reverts the views and reports failure on %s', async (_label, response) => {
    csrfFetch.mockResolvedValue(response);
    renderProvider('?s1=Mana%20Value');

    await act(async () => {
      fireEvent.click(screen.getByText('save-sorts'));
    });

    expect(screen.getByTestId('result')).toHaveTextContent('false');
    expect(screen.getByTestId('mainboard-sort')).toHaveTextContent('Color Category');
  });

  it('reverts the views and reports failure when the request throws', async () => {
    csrfFetch.mockRejectedValue(new TypeError('Failed to fetch'));
    renderProvider('?s1=Mana%20Value');

    await act(async () => {
      fireEvent.click(screen.getByText('save-sorts'));
    });

    expect(screen.getByTestId('result')).toHaveTextContent('false');
    expect(screen.getByTestId('mainboard-sort')).toHaveTextContent('Color Category');
  });
});
