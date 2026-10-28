import React, { useCallback, useEffect, useState } from 'react';

import AutocompleteInput, { normalize } from 'components/base/AutocompleteInput';
import Button from 'components/base/Button';
import { Flexbox } from 'components/base/Layout';
import { Modal, ModalBody, ModalFooter, ModalHeader } from 'components/base/Modal';
import Text from 'components/base/Text';
import { cardNameMatches } from 'utils/cardAutocomplete';

const getMatches = cardNameMatches();

// Matches the autocomplete's own floor and debounce; the server returns nothing
// for shorter queries.
const MIN_QUERY_LENGTH = 3;
const LOOKUP_DEBOUNCE_MS = 150;

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
  // Every card name a lookup has returned. The value is a real card once it's
  // in here, so picking a suggestion validates instantly — the lookup for the
  // partial query that produced the suggestion already returned it.
  const [knownNames, setKnownNames] = useState<Set<string>>(() => new Set());
  // The most recent query whose lookup finished, to tell "not a card" apart
  // from "still checking".
  const [lastChecked, setLastChecked] = useState<string | null>(null);

  const query = normalize(value);

  useEffect(() => {
    if (!query) {
      return undefined;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      const names = query.length >= MIN_QUERY_LENGTH ? await getMatches(query, controller.signal) : [];
      if (controller.signal.aborted) {
        return;
      }
      setKnownNames((prev) => (names.every((name) => prev.has(name)) ? prev : new Set([...prev, ...names])));
      setLastChecked(query);
    }, LOOKUP_DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  // An empty value clears the cell; anything else must name a real card.
  const valid = !query || knownNames.has(query);
  // Judged on the last finished lookup rather than the current query so the
  // message doesn't flicker off and on between keystrokes.
  const showInvalid = !valid && lastChecked !== null && !knownNames.has(lastChecked);

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
            showExactMatch
            // No hover previews: seeing a card's art and text before committing
            // would give away whether it satisfies the cell.
            showImages={false}
          />
          {showInvalid && (
            <Text sm className="text-danger">
              No card by that name — pick one from the suggestions.
            </Text>
          )}
        </Flexbox>
      </ModalBody>
      <ModalFooter>
        <Flexbox direction="row" justify="between" gap="2" className="w-full">
          <Button color="secondary" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button color="primary" onClick={() => save()} disabled={!valid}>
            Save
          </Button>
        </Flexbox>
      </ModalFooter>
    </Modal>
  );
};

export default ManaMatrixCellModal;
