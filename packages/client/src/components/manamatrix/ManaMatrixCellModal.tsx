import React, { useCallback, useState } from 'react';

import AutocompleteInput from 'components/base/AutocompleteInput';
import Button from 'components/base/Button';
import { Flexbox } from 'components/base/Layout';
import { Modal, ModalBody, ModalFooter, ModalHeader } from 'components/base/Modal';
import Text from 'components/base/Text';
import { cardNameMatches } from 'utils/cardAutocomplete';

const getMatches = cardNameMatches();

export interface ManaMatrixCellModalProps {
  isOpen: boolean;
  setOpen: (open: boolean) => void;
  // The cell's combined requirement, e.g. 'power is 2 and type contains "faerie"'.
  cellDescription: string;
  initialValue: string;
  onPick: (value: string) => void;
}

const ManaMatrixCellModal: React.FC<ManaMatrixCellModalProps> = ({
  isOpen,
  setOpen,
  cellDescription,
  initialValue,
  onPick,
}) => {
  const [value, setValue] = useState(initialValue);

  const save = useCallback(
    (picked?: string) => {
      onPick((picked ?? value).trim());
      setOpen(false);
    },
    [onPick, value, setOpen],
  );

  return (
    <Modal isOpen={isOpen} setOpen={setOpen} sm>
      <ModalHeader setOpen={setOpen}>
        <Text semibold lg>
          Name a card
        </Text>
      </ModalHeader>
      <ModalBody>
        <Flexbox direction="col" gap="2">
          <Text sm className="text-text-secondary">
            Name a card where {cellDescription}.
          </Text>
          <AutocompleteInput
            getMatches={getMatches}
            value={value}
            setValue={setValue}
            onSubmit={(event, match) => {
              event.preventDefault();
              save(match);
            }}
            placeholder="Card name"
            autoFocus
            portalDropdown
            // No hover previews: seeing a card's art and text before committing
            // would give away whether it satisfies the cell.
            showImages={false}
          />
        </Flexbox>
      </ModalBody>
      <ModalFooter>
        <Flexbox direction="row" justify="between" gap="2" className="w-full">
          <Button color="secondary" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button color="primary" onClick={() => save()}>
            Save
          </Button>
        </Flexbox>
      </ModalFooter>
    </Modal>
  );
};

export default ManaMatrixCellModal;
