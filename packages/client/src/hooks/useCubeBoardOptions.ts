import { useContext, useEffect, useRef, useState } from 'react';

import { CSRFContext } from '../contexts/CSRFContext';

export interface BoardOption {
  value: string;
  label: string;
}

// Used when a cube's boards can't be fetched. Stable identity so callers'
// board-validity checks don't churn every render.
export const DEFAULT_BOARD_OPTIONS: BoardOption[] = [
  { value: 'mainboard', label: 'Mainboard' },
  { value: 'maybeboard', label: 'Maybeboard' },
];

/**
 * The boards a cube actually has (mainboard/maybeboard plus any custom boards),
 * fetched the first time each cube is selected and cached per cube so switching
 * back is instant. Cube lists like mycubes carry no card data, so they can't
 * tell us the boards on their own.
 *
 * `boardOptions` is null while the selected cube's boards are loading.
 */
const useCubeBoardOptions = (cubeId: string | null | undefined): { boardOptions: BoardOption[] | null } => {
  const { csrfFetch } = useContext(CSRFContext);
  const [boardsByCube, setBoardsByCube] = useState<Record<string, BoardOption[]>>({});
  // Tracks fetches already started so a cube is requested once, even if the
  // user switches away and back before it lands. Results are keyed by cube id,
  // so a response that arrives after switching is still stored correctly.
  const requested = useRef(new Set<string>());

  useEffect(() => {
    if (!cubeId || requested.current.has(cubeId)) return;
    requested.current.add(cubeId);
    (async () => {
      let options = DEFAULT_BOARD_OPTIONS;
      try {
        const res = await csrfFetch(`/cube/api/cubeboards/${encodeURIComponent(cubeId)}`);
        if (res.ok) {
          const json = await res.json();
          if (json.success === 'true' && Array.isArray(json.boards) && json.boards.length > 0) {
            options = json.boards as BoardOption[];
          }
        }
      } catch {
        // fall back to the defaults; the server still validates the board on add
      }
      setBoardsByCube((prev) => ({ ...prev, [cubeId]: options }));
    })();
  }, [cubeId, csrfFetch]);

  return { boardOptions: cubeId ? (boardsByCube[cubeId] ?? null) : null };
};

/**
 * `preferred` if the cube has that board, otherwise mainboard, otherwise the
 * cube's first board. Lets a remembered board choice survive switching to a
 * cube that lacks it without overwriting the remembered value.
 */
export const resolveBoard = (boardOptions: BoardOption[], preferred: string): string => {
  if (boardOptions.some((board) => board.value === preferred)) return preferred;
  if (boardOptions.some((board) => board.value === 'mainboard')) return 'mainboard';
  return boardOptions[0]?.value ?? preferred;
};

export default useCubeBoardOptions;
