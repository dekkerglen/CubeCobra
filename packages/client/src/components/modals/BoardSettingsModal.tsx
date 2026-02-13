import React, { useContext, useMemo, useState } from 'react';
import {
  BoardDefinition,
  boardNameToKey,
  DEFAULT_BOARDS,
  MAX_BOARDS,
  validateBoardDefinitions,
} from '@utils/datatypes/Cube';

import Button from 'components/base/Button';
import Checkbox from 'components/base/Checkbox';
import Input from 'components/base/Input';
import { Flexbox } from 'components/base/Layout';
import { Modal, ModalBody, ModalFooter, ModalHeader } from 'components/base/Modal';
import Text from 'components/base/Text';
import LoadingButton from 'components/LoadingButton';
import { CSRFContext } from 'contexts/CSRFContext';
import CubeContext from 'contexts/CubeContext';

interface BoardSettingsModalProps {
  isOpen: boolean;
  setOpen: (open: boolean) => void;
}

interface BoardRowProps {
  board: BoardDefinition;
  index: number;
  cardCount: number;
  isStandardBoard: boolean;
  onUpdate: (index: number, updates: Partial<BoardDefinition>) => void;
  onRemove: (index: number) => void;
  canRemove: boolean;
}

const BoardRow: React.FC<BoardRowProps> = ({
  board,
  index,
  cardCount,
  isStandardBoard,
  onUpdate,
  onRemove,
  canRemove,
}) => {
  const canDelete = canRemove && cardCount === 0 && !isStandardBoard;
  const deleteTooltip = isStandardBoard
    ? 'Standard boards can be disabled but not removed'
    : cardCount > 0
      ? `Cannot delete board with ${cardCount} card${cardCount !== 1 ? 's' : ''}`
      : !canRemove
        ? 'Must have at least one board'
        : undefined;

  return (
    <div className="rounded-md border border-border bg-bg p-3 transition-colors hover:border-border-active">
      <Flexbox direction="row" gap="2" alignItems="center">
        <div className="flex-1">
          {isStandardBoard ? (
            <Text className="font-medium">{board.name}</Text>
          ) : (
            <Input
              value={board.name}
              onChange={(e) => onUpdate(index, { name: e.target.value })}
              placeholder="Board name"
            />
          )}
        </div>
        {cardCount > 0 && (
          <Text xs className="text-text-secondary whitespace-nowrap">
            {cardCount} card{cardCount !== 1 ? 's' : ''}
          </Text>
        )}
        <Checkbox label="Enabled" checked={board.enabled} setChecked={(enabled) => onUpdate(index, { enabled })} />
        <div title={deleteTooltip}>
          <Button color="danger" onClick={() => onRemove(index)} disabled={!canDelete}>
            Remove
          </Button>
        </div>
      </Flexbox>
    </div>
  );
};

const BoardSettingsModal: React.FC<BoardSettingsModalProps> = ({ isOpen, setOpen }) => {
  const { cube, unfilteredChangedCards, setCube } = useContext(CubeContext);
  const { csrfFetch } = useContext(CSRFContext);
  const [loading, setLoading] = useState(false);

  // Standard board names that are always available
  const standardBoardNames = useMemo(() => DEFAULT_BOARDS.map((b) => b.name), []);

  // Initialize with current boards, ensuring standard boards are available
  const getInitialBoards = useCallback((): BoardDefinition[] => {
    // Start with saved boards or defaults
    const boards: BoardDefinition[] =
      cube.boards && cube.boards.length > 0
        ? cube.boards.map((b) => ({ ...b }))
        : DEFAULT_BOARDS.map((b) => ({ ...b }));

    // Ensure all standard boards (Basics, Tokens) are in the list
    for (const defaultBoard of DEFAULT_BOARDS) {
      const exists = boards.some((b) => boardNameToKey(b.name) === boardNameToKey(defaultBoard.name));
      if (!exists) {
        boards.push({ ...defaultBoard });
      }
    }

    return boards;
  }, [cube.boards]);

  const [boards, setBoards] = useState<BoardDefinition[]>(getInitialBoards);
  const [error, setError] = useState<string>('');

  // Calculate card counts for each board (including legacy basics)
  const boardCardCounts = useMemo(() => {
    const counts: Record<string, number> = {};

    for (const board of boards) {
      const key = boardNameToKey(board.name);
      const cards = unfilteredChangedCards?.[key];
      counts[board.name] = cards?.length || 0;
    }

    // Include legacy basics in the Basics board count
    if (cube.basics && Array.isArray(cube.basics) && cube.basics.length > 0) {
      const basicsBoard = boards.find((b) => boardNameToKey(b.name) === 'basics');
      if (basicsBoard) {
        counts[basicsBoard.name] = (counts[basicsBoard.name] || 0) + cube.basics.length;
      }
    }

    return counts;
  }, [boards, unfilteredChangedCards, cube.basics]);

  const addBoard = () => {
    if (boards.length >= MAX_BOARDS) {
      setError(`Cannot add more than ${MAX_BOARDS} boards`);
      return;
    }
    setBoards([...boards, { name: '', enabled: true }]);
    setError('');
  };

  const removeBoard = (index: number) => {
    const board = boards[index];

    if (boards.length <= 1) {
      setError('Must have at least one board');
      return;
    }

    // Standard boards can be disabled but not removed
    if (standardBoardNames.includes(board.name)) {
      setError(`"${board.name}" is a standard board. You can disable it, but not remove it.`);
      return;
    }

    // Check if board has cards
    const cardCount = boardCardCounts[board.name] || 0;
    if (cardCount > 0) {
      setError(
        `Cannot remove "${board.name}" - it contains ${cardCount} card${cardCount !== 1 ? 's' : ''}. Move all cards first.`,
      );
      return;
    }

    const newBoards = boards.filter((_, i) => i !== index);
    setBoards(newBoards);
    setError('');
  };

  const updateBoard = (index: number, updates: Partial<BoardDefinition>) => {
    const newBoards = [...boards];
    newBoards[index] = { ...newBoards[index], ...updates };
    setBoards(newBoards);
    setError('');
  };

  const handleSave = async () => {
    const validation = validateBoardDefinitions(boards);
    if (!validation.valid) {
      setError(validation.error || 'Invalid board configuration');
      return;
    }

    setLoading(true);
    try {
      const response = await csrfFetch(`/cube/updateboards/${cube.id}`, {
        method: 'POST',
        body: JSON.stringify({ boards }),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        // Update the cube context with new boards
        setCube((prev) => ({ ...prev, boards: data.boards }));
        setOpen(false);
      } else {
        const data = await response.json();
        setError(data.message || 'Failed to save board settings');
      }
    } catch (err) {
      setError('Failed to save board settings: ' + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  // Reset state when modal opens
  React.useEffect(() => {
    if (isOpen) {
      setBoards(getInitialBoards());
      setError('');
    }
  }, [isOpen, getInitialBoards]);

  return (
    <Modal isOpen={isOpen} setOpen={setOpen} lg>
      <ModalHeader setOpen={setOpen}>
        <Text semibold lg>
          Customize Boards
        </Text>
      </ModalHeader>
      <ModalBody>
        <Flexbox direction="col" gap="3">
          <Text sm className="text-text-secondary">
            Configure which boards are available for your cube. Toggle to enable/disable boards.
          </Text>

          {error && (
            <div className="rounded-md bg-danger/10 p-3 border border-danger">
              <Text sm className="text-danger">
                {error}
              </Text>
            </div>
          )}

          <Flexbox direction="col" gap="2">
            {boards.map((board, index) => (
              <BoardRow
                key={board.name || `board-${index}`}
                board={board}
                index={index}
                cardCount={boardCardCounts[board.name] || 0}
                isStandardBoard={standardBoardNames.includes(board.name)}
                onUpdate={updateBoard}
                onRemove={removeBoard}
                canRemove={boards.length > 1}
              />
            ))}
          </Flexbox>

          <Button color="accent" onClick={addBoard} disabled={boards.length >= MAX_BOARDS} block>
            Add Board
          </Button>

          {boards.length >= MAX_BOARDS && (
            <Text xs className="text-text-secondary text-center">
              Maximum number of boards ({MAX_BOARDS}) reached
            </Text>
          )}
        </Flexbox>
      </ModalBody>
      <ModalFooter>
        <Flexbox direction="row" justify="between" gap="2" className="w-full">
          <LoadingButton block color="primary" onClick={handleSave} loading={loading}>
            Save Changes
          </LoadingButton>
          <Button block color="secondary" onClick={() => setOpen(false)}>
            Cancel
          </Button>
        </Flexbox>
      </ModalFooter>
    </Modal>
  );
};

export default BoardSettingsModal;
