import React, { useContext, useState } from 'react';

import { BoardDefinition, MAX_BOARDS, validateBoardDefinitions } from '@utils/datatypes/Cube';

import Button from 'components/base/Button';
import Checkbox from 'components/base/Checkbox';
import Input from 'components/base/Input';
import { Flexbox } from 'components/base/Layout';
import { Modal, ModalBody, ModalFooter, ModalHeader } from 'components/base/Modal';
import Text from 'components/base/Text';
import CSRFForm from 'components/CSRFForm';
import LoadingButton from 'components/LoadingButton';
import CubeContext from 'contexts/CubeContext';

interface BoardSettingsModalProps {
  isOpen: boolean;
  setOpen: (open: boolean) => void;
}

const BoardSettingsModal: React.FC<BoardSettingsModalProps> = ({ isOpen, setOpen }) => {
  const { cube } = useContext(CubeContext);

  // Initialize with current boards or defaults
  const initialBoards: BoardDefinition[] =
    cube.boards && cube.boards.length > 0
      ? cube.boards.map((b) => ({ ...b }))
      : [
          { name: 'Mainboard', enabled: true },
          { name: 'Maybeboard', enabled: true },
        ];

  const [boards, setBoards] = useState<BoardDefinition[]>(initialBoards);
  const [error, setError] = useState<string>('');
  const formRef = React.createRef<HTMLFormElement>();

  const addBoard = () => {
    if (boards.length >= MAX_BOARDS) {
      setError(`Cannot add more than ${MAX_BOARDS} boards`);
      return;
    }
    setBoards([...boards, { name: '', enabled: true }]);
    setError('');
  };

  const removeBoard = (index: number) => {
    if (boards.length <= 1) {
      setError('Must have at least one board');
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

  const handleSave = () => {
    const validation = validateBoardDefinitions(boards);
    if (!validation.valid) {
      setError(validation.error || 'Invalid board configuration');
      return;
    }

    // Submit the form
    formRef.current?.submit();
  };

  return (
    <Modal isOpen={isOpen} setOpen={setOpen} lg>
      <ModalHeader setOpen={setOpen}>
        <Text semibold lg>
          Customize Boards
        </Text>
      </ModalHeader>
      <ModalBody>
        <CSRFForm
          ref={formRef}
          formData={{ boards: JSON.stringify(boards) }}
          method="POST"
          action={`/cube/updateboards/${cube.id}`}
        >
          <Flexbox direction="col" gap="3">
            <Text sm className="text-text-secondary">
              Configure the boards for your cube. You can have up to {MAX_BOARDS} boards. Each board can be enabled or
              disabled.
            </Text>

            {error && (
              <div className="rounded-md bg-red-50 p-3">
                <Text sm className="text-red-800">
                  {error}
                </Text>
              </div>
            )}

            <Flexbox direction="col" gap="2">
              {boards.map((board, index) => (
                <div
                  key={index}
                  className="rounded-md border border-border p-3 hover:border-border-active transition-colors"
                >
                  <Flexbox direction="row" gap="2" alignItems="center">
                    <div className="flex-1">
                      <Input
                        value={board.name}
                        onChange={(e) => updateBoard(index, { name: e.target.value })}
                        placeholder="Board name"
                      />
                    </div>
                    <Checkbox
                      label="Enabled"
                      checked={board.enabled}
                      setChecked={(enabled) => updateBoard(index, { enabled })}
                    />
                    <Button
                      color="danger"
                      onClick={() => removeBoard(index)}
                      disabled={boards.length <= 1}
                      aria-label="Remove board"
                    >
                      Remove
                    </Button>
                  </Flexbox>
                </div>
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
        </CSRFForm>
      </ModalBody>
      <ModalFooter>
        <Flexbox direction="row" justify="between" gap="2" className="w-full">
          <LoadingButton block color="primary" onClick={handleSave}>
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
