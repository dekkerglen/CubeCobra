import React, { useState } from 'react';

import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import '@testing-library/jest-dom';

import { TagColor } from '@utils/datatypes/Cube';

import TagColorsModal from 'components/modals/TagColorsModal';
import { CSRFContext } from 'contexts/CSRFContext';
import CubeContext from 'contexts/CubeContext';

const initialTagColors: TagColor[] = [
  { tag: 'Cut', color: 'no-color' },
  { tag: 'Ramp', color: 'green' },
];

interface HarnessProps {
  csrfFetch: jest.Mock;
  onTagColorsChange?: (colors: TagColor[]) => void;
  setOpen?: (open: boolean) => void;
}

// Renders the modal with just enough context. Tracks tagColors in real state, like CubeContext does.
const Harness: React.FC<HarnessProps> = ({ csrfFetch, onTagColorsChange, setOpen = jest.fn() }) => {
  const [tagColors, setTagColorsState] = useState<TagColor[]>(initialTagColors);

  const setTagColors = (colors: React.SetStateAction<TagColor[]>) => {
    setTagColorsState(colors);
    if (onTagColorsChange && typeof colors !== 'function') {
      onTagColorsChange(colors);
    }
  };

  const cubeValue = {
    tagColors,
    setTagColors,
    showTagColors: true,
    updateShowTagColors: jest.fn(),
    canEdit: true,
    cube: { id: 'test-cube-id' },
  };

  const csrfValue = {
    csrfToken: 'token',
    csrfFetch,
    callApi: jest.fn(),
  };

  return (
    <CSRFContext.Provider value={csrfValue as any}>
      <CubeContext.Provider value={cubeValue as any}>
        <TagColorsModal isOpen setOpen={setOpen} />
        <div data-testid="current-colors">{JSON.stringify(tagColors)}</div>
      </CubeContext.Provider>
    </CSRFContext.Provider>
  );
};

const getCurrentColors = (): TagColor[] => JSON.parse(screen.getByTestId('current-colors').textContent || '[]');

const clickSwatch = (title: string) => {
  // Swatch buttons are rendered per tag row; the first row ("Cut") is the one we expand below.
  fireEvent.click(screen.getAllByTitle(title)[0]);
};

const findDialogCloseButton = () => {
  // The ModalHeader close button is the button containing the octicon X svg.
  const dialog = screen.getByRole('dialog');
  const button = Array.from(dialog.querySelectorAll('button')).find((b) => b.querySelector('svg.octicon-x'));
  expect(button).toBeDefined();
  return button!;
};

describe('TagColorsModal', () => {
  it('saves the edited colors and closes the modal on success', async () => {
    const csrfFetch = jest.fn().mockResolvedValue({ ok: true });
    const setOpen = jest.fn();
    render(<Harness csrfFetch={csrfFetch} setOpen={setOpen} />);

    clickSwatch('Red');
    expect(getCurrentColors()).toEqual([
      { tag: 'Cut', color: 'red' },
      { tag: 'Ramp', color: 'green' },
    ]);

    fireEvent.click(screen.getByText('Save Changes'));

    await waitFor(() => expect(setOpen).toHaveBeenCalledWith(false));
    expect(csrfFetch).toHaveBeenCalledWith(
      '/cube/api/savetagcolors/test-cube-id',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          tag_colors: [
            { tag: 'Cut', color: 'red' },
            { tag: 'Ramp', color: 'green' },
          ],
        }),
      }),
    );
    // The saved colors stay applied
    expect(getCurrentColors()).toEqual([
      { tag: 'Cut', color: 'red' },
      { tag: 'Ramp', color: 'green' },
    ]);
  });

  it('reverts unsaved color changes when the modal is dismissed without saving', async () => {
    const csrfFetch = jest.fn();
    const setOpen = jest.fn();
    render(<Harness csrfFetch={csrfFetch} setOpen={setOpen} />);

    clickSwatch('Red');
    expect(getCurrentColors()).toEqual([
      { tag: 'Cut', color: 'red' },
      { tag: 'Ramp', color: 'green' },
    ]);

    fireEvent.click(findDialogCloseButton());

    expect(setOpen).toHaveBeenCalledWith(false);
    expect(csrfFetch).not.toHaveBeenCalled();
    // The live preview is rolled back to the last-saved colors
    expect(getCurrentColors()).toEqual(initialTagColors);
  });

  it('keeps the modal open and shows an error when saving fails', async () => {
    const csrfFetch = jest.fn().mockResolvedValue({ ok: false });
    const setOpen = jest.fn();
    render(<Harness csrfFetch={csrfFetch} setOpen={setOpen} />);

    clickSwatch('Red');
    fireEvent.click(screen.getByText('Save Changes'));

    await waitFor(() => expect(screen.getByText(/failed to save tag colors/i)).toBeInTheDocument());
    expect(setOpen).not.toHaveBeenCalledWith(false);
    // The user's edits are not thrown away, so they can retry
    expect(getCurrentColors()).toEqual([
      { tag: 'Cut', color: 'red' },
      { tag: 'Ramp', color: 'green' },
    ]);
  });
});
