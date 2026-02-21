import React, { useState } from 'react';

import Button from 'components/base/Button';
import Checkbox from 'components/base/Checkbox';
import Input from 'components/base/Input';
import { Flexbox } from 'components/base/Layout';
import { Modal, ModalBody, ModalFooter, ModalHeader } from 'components/base/Modal';
import Text from 'components/base/Text';

interface AddBoardModalProps {
  isOpen: boolean;
  setOpen: (open: boolean) => void;
  onAdd: (boardName: string, createView: boolean) => void;
  existingBoardNames: string[];
}

const AddBoardModal: React.FC<AddBoardModalProps> = ({ isOpen, setOpen, onAdd, existingBoardNames }) => {
  const [boardName, setBoardName] = useState('');
  const [createView, setCreateView] = useState(true);
  const [error, setError] = useState('');

  const handleAdd = () => {
    const trimmedName = boardName.trim();

    if (!trimmedName) {
      setError('Board name cannot be empty');
      return;
    }

    // Check if board name already exists (case-insensitive)
    const nameExists = existingBoardNames.some((name) => name.toLowerCase() === trimmedName.toLowerCase());

    if (nameExists) {
      setError('A board with this name already exists');
      return;
    }

    // Add the board
    onAdd(trimmedName, createView);

    // Reset and close
    setBoardName('');
    setCreateView(true);
    setError('');
    setOpen(false);
  };

  const handleCancel = () => {
    setBoardName('');
    setCreateView(true);
    setError('');
    setOpen(false);
  };

  return (
    <Modal isOpen={isOpen} setOpen={setOpen}>
      <ModalHeader setOpen={setOpen}>
        <Text semibold lg>
          Add New Board
        </Text>
      </ModalHeader>
      <ModalBody>
        <Flexbox direction="col" gap="3">
          <Text sm>Enter the name for your new board. Board names cannot be changed after creation.</Text>
          {error && (
            <div className="rounded-md bg-danger/10 p-2 border border-danger">
              <Text sm className="text-danger">
                {error}
              </Text>
            </div>
          )}
          <Input
            label="Board Name"
            value={boardName}
            onChange={(e) => {
              setBoardName(e.target.value);
              setError('');
            }}
            placeholder="e.g., Sideboard, Tokens"
            autoFocus
          />
          <Checkbox label="Create a dedicated view for this board" checked={createView} setChecked={setCreateView} />
        </Flexbox>
      </ModalBody>
      <ModalFooter>
        <Flexbox direction="row" gap="2" justify="end">
          <Button color="secondary" onClick={handleCancel}>
            Cancel
          </Button>
          <Button color="primary" onClick={handleAdd}>
            Add Board
          </Button>
        </Flexbox>
      </ModalFooter>
    </Modal>
  );
};

export default AddBoardModal;
