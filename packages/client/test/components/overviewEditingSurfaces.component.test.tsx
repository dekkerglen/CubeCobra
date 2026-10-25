import React from 'react';

import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import '@testing-library/jest-dom';

import Cube from '@utils/datatypes/Cube';

import { CSRFContext } from 'contexts/CSRFContext';
import CubeContext from 'contexts/CubeContext';

import EditOverviewModal from '../../src/components/cube/EditOverviewModal';
import OverviewSettings from '../../src/components/settings/OverviewSettings';

jest.mock('components/MtgImage', () => () => <div data-testid="mtg-image" />);
jest.mock('components/TextEntry', () => () => <div data-testid="text-entry" />);
jest.mock('components/base/AutocompleteInput', () => () => <input data-testid="autocomplete" />);
jest.mock('components/ImageUploadWidget', () => () => <div data-testid="image-upload" />);
jest.mock('hooks/useCanUploadImages', () => ({ __esModule: true, default: () => false }));
jest.mock('utils/cardAutocomplete', () => ({
  cardNameMatches: () => () => [],
  fetchCardImage: jest.fn().mockResolvedValue(undefined),
}));

/**
 * The Edit Cube Overview modal and the Settings -> Overview page are near-duplicates that post the
 * same field whitelist to the same endpoint. Running one suite against both is the check that they
 * stay in sync: a change made to one surface and not the other fails here rather than shipping as a
 * silent divergence between the two places an owner can edit the same cube.
 */

const buildCube = (overrides: Partial<Cube> = {}): Cube =>
  ({
    id: 'cube-1',
    shortId: 'test-cube',
    name: 'Test Cube',
    cardCount: 10,
    image: { uri: '', artist: '', imageName: '', id: '' },
    imageName: 'Island',
    ...overrides,
  }) as unknown as Cube;

// The order an owner meets these controls in, which must not drift between the two surfaces.
const SECTIONS = ['Cube Name', 'Brief Description', 'Image', 'Banner Color', 'Categories', 'Custom URL'];

const renderWithProviders = (cube: Cube, csrfFetch: jest.Mock, children: React.ReactNode) =>
  render(
    <CSRFContext.Provider value={{ csrfToken: 'token', csrfFetch, callApi: jest.fn() } as any}>
      <CubeContext.Provider value={{ cube } as any}>{children}</CubeContext.Provider>
    </CSRFContext.Provider>,
  );

const SURFACES = [
  [
    'EditOverviewModal',
    (cube: Cube, csrfFetch: jest.Mock) =>
      renderWithProviders(cube, csrfFetch, <EditOverviewModal isOpen setOpen={jest.fn()} />),
  ],
  [
    'OverviewSettings',
    (cube: Cube, csrfFetch: jest.Mock) => renderWithProviders(cube, csrfFetch, <OverviewSettings />),
  ],
] as const;

const okResponse = () => ({ ok: true, json: async () => ({ redirect: '/cube/overview/test-cube' }) });

/**
 * Both surfaces navigate on a successful save, which jsdom cannot do, and `window.location` is
 * non-configurable here so it cannot be stubbed. The request has already been made by the time
 * either navigates, so swallow that one message and let every other error through.
 */
let consoleError: jest.SpyInstance;

beforeAll(() => {
  const original = console.error.bind(console);
  consoleError = jest.spyOn(console, 'error').mockImplementation((...args: any[]) => {
    if (args[0]?.type === 'not implemented') return;
    original(...args);
  });
});

afterAll(() => consoleError.mockRestore());

/**
 * Settings disables Save until something changes, so every submission edits the name first. The
 * assertions below only read `bannerTheme`, which that edit does not touch.
 */
const submit = async (csrfFetch: jest.Mock) => {
  fireEvent.change(document.getElementById('cubeName') as HTMLInputElement, { target: { value: 'Renamed Cube' } });
  fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
  await waitFor(() => expect(csrfFetch).toHaveBeenCalledTimes(1));
  return JSON.parse(csrfFetch.mock.calls[0][1].body).cube;
};

describe.each(SURFACES)('%s', (_name, mount) => {
  let csrfFetch: jest.Mock;

  beforeEach(() => {
    csrfFetch = jest.fn().mockResolvedValue(okResponse());
  });

  describe('banner theme wiring', () => {
    it('posts an explicit clear when the cube has no theme', async () => {
      mount(buildCube(), csrfFetch);

      expect(await submit(csrfFetch)).toHaveProperty('bannerTheme', '');
    });

    it('posts the chosen theme after selecting a swatch', async () => {
      mount(buildCube(), csrfFetch);

      fireEvent.click(screen.getByRole('radio', { name: 'Blue' }));

      expect(await submit(csrfFetch)).toHaveProperty('bannerTheme', 'blue');
    });

    // Choosing the default has to reach the server as a clear, not as the absent field the
    // endpoint treats as "leave the stored theme alone".
    it('posts an explicit clear when returning to the default', async () => {
      mount(buildCube({ bannerTheme: 'blue' } as Partial<Cube>), csrfFetch);

      fireEvent.click(screen.getByRole('radio', { name: 'Green' }));

      expect(await submit(csrfFetch)).toHaveProperty('bannerTheme', '');
    });

    it('shows the stored theme as the selected swatch', () => {
      mount(buildCube({ bannerTheme: 'blue' } as Partial<Cube>), csrfFetch);

      expect(screen.getByRole('radio', { name: 'Blue' })).toBeChecked();
      expect(screen.getByRole('radio', { name: 'Green' })).not.toBeChecked();
    });

    it('shows green as selected when the cube has no theme', () => {
      mount(buildCube(), csrfFetch);

      expect(screen.getByRole('radio', { name: 'Green' })).toBeChecked();
    });
  });

  describe('presentation', () => {
    it('lays the sections out in the shared order', () => {
      mount(buildCube(), csrfFetch);

      const inDocumentOrder = [...SECTIONS].sort((a, b) =>
        screen.getByText(a).compareDocumentPosition(screen.getByText(b)) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1,
      );

      expect(inDocumentOrder).toEqual(SECTIONS);
    });

    // The heading above this field is a plain Text, not a label, so without an explicit name a
    // screen reader falls back to the placeholder for the field that breaks every link to the cube.
    it('gives the short ID field an accessible name', () => {
      mount(buildCube(), csrfFetch);

      expect(screen.getByRole('textbox', { name: 'Custom URL' })).toHaveAttribute('id', 'shortId');
    });
  });
});
