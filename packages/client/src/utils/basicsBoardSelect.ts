import { boardNameToKey } from '@utils/datatypes/Cube';

// Capitalized so they can never equal a board key, which is always lowercase.
export const BASICS_DEFAULT_OPTION = 'Default';
export const BASICS_NONE_OPTION = 'None';

export const basicsBoardToSelectValue = (stored: string | undefined): string => {
  if (stored === undefined) return BASICS_DEFAULT_OPTION;
  if (stored === BASICS_NONE_OPTION) return BASICS_NONE_OPTION;
  return boardNameToKey(stored);
};

export const selectValueToBasicsBoard = (value: string): string | undefined =>
  value === BASICS_DEFAULT_OPTION ? undefined : value;

export const basicsBoardSelectOptions = (boards: { name: string }[]): { value: string; label: string }[] => [
  { value: BASICS_DEFAULT_OPTION, label: 'Default (Basics)' },
  { value: BASICS_NONE_OPTION, label: 'None' },
  ...boards.map((board) => ({
    value: boardNameToKey(board.name),
    label: [BASICS_DEFAULT_OPTION, BASICS_NONE_OPTION].includes(board.name) ? `${board.name} (board)` : board.name,
  })),
];
