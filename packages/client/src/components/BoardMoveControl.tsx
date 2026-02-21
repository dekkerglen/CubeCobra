import React from 'react';

import Button from './base/Button';
import Select from './base/Select';

interface BoardMoveControlProps {
  currentBoard?: string;
  targetBoard: string;
  setTargetBoard: (board: string) => void;
  onMove: () => void;
  availableBoards: { name: string }[];
  buttonText?: string;
  disabled?: boolean;
}

const BoardMoveControl: React.FC<BoardMoveControlProps> = ({
  currentBoard,
  targetBoard,
  setTargetBoard,
  onMove,
  availableBoards,
  buttonText = 'Move',
  disabled = false,
}) => {
  const options = availableBoards
    .filter((b) => !currentBoard || b.name.toLowerCase() !== currentBoard)
    .map((b) => ({ value: b.name.toLowerCase(), label: b.name }));

  return (
    <div className="flex w-full items-center">
      <div className="flex-1 min-w-0">
        <Select options={options} value={targetBoard} setValue={setTargetBoard} />
      </div>
      <Button color="accent" className="ml-2 whitespace-nowrap" onClick={onMove} disabled={disabled || !targetBoard}>
        {buttonText}
      </Button>
    </div>
  );
};

export default BoardMoveControl;
