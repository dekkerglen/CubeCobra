import React, { useCallback, useContext, useMemo } from 'react';

import { StackIcon, TriangleDownIcon } from '@primer/octicons-react';

import Checkbox from 'components/base/Checkbox';
import Dropdown from 'components/base/Dropdown';
import { Flexbox } from 'components/base/Layout';
import Text from 'components/base/Text';
import AnalysisViewContext from 'contexts/AnalysisViewContext';
import CubeContext from 'contexts/CubeContext';

const boardLabel = (board: string) => board.charAt(0).toUpperCase() + board.slice(1);

// Checklist of the cube's boards whose cards feed the analytics views.
const AnalysisBoardPicker: React.FC = () => {
  const { unfilteredChangedCards } = useContext(CubeContext);
  const analysisViewContext = useContext(AnalysisViewContext);

  const boardKeys = useMemo(
    () => Object.keys(unfilteredChangedCards).filter((board) => Array.isArray(unfilteredChangedCards[board])),
    [unfilteredChangedCards],
  );
  const selectedBoards = useMemo(
    () => boardKeys.filter((board) => analysisViewContext?.boards.includes(board)),
    [boardKeys, analysisViewContext?.boards],
  );

  const toggleBoard = useCallback(
    (board: string, checked: boolean) => {
      analysisViewContext?.setBoards(
        boardKeys.filter((key) => (key === board ? checked : selectedBoards.includes(key))),
      );
    },
    [analysisViewContext, boardKeys, selectedBoards],
  );

  if (!analysisViewContext || boardKeys.length < 2) {
    return null;
  }

  return (
    <Dropdown
      trigger={
        <button
          className="flex items-center gap-2 px-3 py-2 border border-border bg-bg-active rounded-md shadow-sm text-sm text-text hover:bg-bg transition-colors"
          aria-label="Choose boards to include"
        >
          <StackIcon size={16} className="text-text-secondary" />
          {selectedBoards.length === 0
            ? 'No boards'
            : selectedBoards.length <= 2
              ? selectedBoards.map(boardLabel).join(' + ')
              : `${selectedBoards.length} boards`}
          <TriangleDownIcon size={16} />
        </button>
      }
      align="right"
    >
      <Flexbox direction="col" gap="2" className="p-3">
        <Text sm semibold className="text-text-secondary">
          Include cards from
        </Text>
        {boardKeys.map((board) => {
          const checked = selectedBoards.includes(board);
          return (
            <Checkbox
              key={board}
              label={`${boardLabel(board)} (${unfilteredChangedCards[board].length})`}
              checked={checked}
              // Keep at least one board selected so the views always have something to show.
              disabled={checked && selectedBoards.length === 1}
              setChecked={(value) => toggleBoard(board, value)}
            />
          );
        })}
      </Flexbox>
    </Dropdown>
  );
};

export default AnalysisBoardPicker;
