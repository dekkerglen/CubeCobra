import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';

import {
  CleanupCardRef,
  findDuplicateRemovals,
  findOverlapRemovals,
  findPrintingCandidates,
  findPrintingUpdates,
  makeSwapPredicate,
} from '@utils/cubeCleanup';
import {
  BoardType,
  CardDetails,
  DefaultPrintingPreference,
  isPrintingPreference,
  PrintingPreference,
} from '@utils/datatypes/Card';

import Button from 'components/base/Button';
import Checkbox from 'components/base/Checkbox';
import { Flexbox } from 'components/base/Layout';
import { Modal, ModalBody, ModalHeader } from 'components/base/Modal';
import Select from 'components/base/Select';
import Spinner from 'components/base/Spinner';
import { TabbedView } from 'components/base/Tabs';
import Text from 'components/base/Text';
import { CSRFContext } from 'contexts/CSRFContext';
import CubeContext from 'contexts/CubeContext';
import { trackEvent } from 'utils/analytics';
import { getPrintings } from 'utils/cards/getPrintings';

const PRINTINGS_TAB = 1;

const PRINTING_OPTIONS = [
  { value: PrintingPreference.DEFAULT, label: 'Default' },
  { value: PrintingPreference.RECENT, label: 'Most Recent' },
  { value: PrintingPreference.FIRST, label: 'First' },
  { value: PrintingPreference.CHEAPEST, label: 'Cheapest' },
];

interface BoardOption {
  value: string;
  label: string;
}

interface CubeCleanupModalProps {
  isOpen: boolean;
  setOpen: (open: boolean) => void;
  boardOptions: BoardOption[];
  boardToEdit: BoardType;
}

/*
 * Every action shows the length of the exact array its click stages, so the preview and the
 * action can never disagree. Each one reads the filtered card lists, so it only ever touches
 * cards the active filter is showing.
 */
const CubeCleanupModal: React.FC<CubeCleanupModalProps> = ({ isOpen, setOpen, boardOptions, boardToEdit }) => {
  const { csrfFetch } = useContext(CSRFContext);
  const { cube, changes, changedCards, bulkRemoveCard, bulkEditPrinting } = useContext(CubeContext)!;

  const [activeTab, setActiveTab] = useState(0);
  const [cleanBoard, setCleanBoard] = useState<string>(boardToEdit);
  const [pickedReference, setPickedReference] = useState('');
  const [printingBoards, setPrintingBoards] = useState<string[]>([boardToEdit]);
  const [wasOpen, setWasOpen] = useState(isOpen);
  const [printing, setPrinting] = useState<PrintingPreference>(
    isPrintingPreference(cube.defaultPrinting) ? cube.defaultPrinting : DefaultPrintingPreference,
  );
  // Resolved printings by request, so flipping between preferences doesn't refetch.
  const [results, setResults] = useState<Record<string, Record<string, CardDetails>>>({});
  const [failedKey, setFailedKey] = useState<string | null>(null);

  // Every opening starts from the edited board. Adjusted during render rather than in an effect,
  // so the first frame of the opened modal already shows it.
  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    if (isOpen) {
      setCleanBoard(boardToEdit);
      setPickedReference('');
      setPrintingBoards([boardToEdit]);
    }
  }

  // Precomputes the swapped positions once, rather than on every card of every render.
  const isSwapped = useMemo(() => makeSwapPredicate(changes), [changes]);

  const cleanCards = useMemo(() => changedCards[cleanBoard] ?? [], [changedCards, cleanBoard]);

  const duplicateRemovals = useMemo(() => findDuplicateRemovals(cleanCards, isSwapped), [cleanCards, isSwapped]);

  const referenceBoards = useMemo(
    () => boardOptions.filter((board) => board.value !== cleanBoard),
    [boardOptions, cleanBoard],
  );

  // Worked out for every other board so each choice in the dropdown can say what it would remove.
  const overlapByBoard = useMemo(() => {
    const removalsByBoard: Record<string, CleanupCardRef[]> = {};
    for (const reference of referenceBoards) {
      removalsByBoard[reference.value] = findOverlapRemovals(
        cleanCards,
        changedCards[reference.value] ?? [],
        isSwapped,
      );
    }

    return removalsByBoard;
  }, [referenceBoards, cleanCards, changedCards, isSwapped]);

  const referenceBoard = referenceBoards.some((board) => board.value === pickedReference)
    ? pickedReference
    : referenceBoards[0]?.value;
  const overlapRemovals = referenceBoard ? (overlapByBoard[referenceBoard] ?? []) : [];

  // Kept in the cube's board order, whatever order the boxes were ticked in.
  const printingTargets = useMemo(
    () => boardOptions.filter((board) => printingBoards.includes(board.value)),
    [boardOptions, printingBoards],
  );

  const setPrintingBoardSelected = (board: string, selected: boolean) =>
    setPrintingBoards((prev) => (selected ? [...prev, board] : prev.filter((value) => value !== board)));

  const printingCards = useMemo(
    () => printingTargets.flatMap((board) => changedCards[board.value] ?? []),
    [printingTargets, changedCards],
  );

  const candidates = useMemo(() => findPrintingCandidates(printingCards, isSwapped), [printingCards, isSwapped]);
  const requestKey = `${printing}:${candidates.join(',')}`;
  const printings = results[requestKey];

  useEffect(() => {
    if (!isOpen || activeTab !== PRINTINGS_TAB || printings) {
      return undefined;
    }

    let cancelled = false;
    setFailedKey(null);
    getPrintings(csrfFetch, printing, candidates)
      .then((result) => {
        if (cancelled) return;
        if (result) {
          setResults((prev) => ({ ...prev, [requestKey]: result }));
        } else {
          setFailedKey(requestKey);
        }
      })
      .catch(() => {
        if (!cancelled) setFailedKey(requestKey);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, activeTab, printings, requestKey, printing, candidates, csrfFetch]);

  const printingUpdates = useMemo(
    () =>
      printings
        ? printingTargets.flatMap((board) => findPrintingUpdates(changedCards[board.value] ?? [], printings, isSwapped))
        : [],
    [printings, printingTargets, changedCards, isSwapped],
  );

  const printingsLoading = !printings && failedKey !== requestKey;

  const boardLabel = (value: string | undefined): string =>
    boardOptions.find((board) => board.value === value)?.label ?? value ?? '';

  const handleRemove = useCallback(
    (removals: CleanupCardRef[], event: string, otherBoard?: string) => {
      if (removals.length === 0) {
        return;
      }

      bulkRemoveCard(removals);
      trackEvent(event, { count: removals.length, board: cleanBoard, ...(otherBoard ? { otherBoard } : {}) });
      setOpen(false);
    },
    [bulkRemoveCard, cleanBoard, setOpen],
  );

  const handleUpdatePrintings = useCallback(() => {
    if (printingUpdates.length === 0) {
      return;
    }

    bulkEditPrinting(printingUpdates);
    trackEvent('cube_cleanup_printings', {
      count: printingUpdates.length,
      board: printingTargets.map((board) => board.value).join(','),
      printing,
    });
    setOpen(false);
  }, [printingUpdates, bulkEditPrinting, printingTargets, printing, setOpen]);

  return (
    <Modal isOpen={isOpen} setOpen={setOpen} md>
      <ModalHeader setOpen={setOpen}>Cleanup</ModalHeader>
      <ModalBody>
        <Text sm className="text-text-secondary">
          Cleanup only changes cards shown by the current filter, and skips custom cards and vouchers. Its changes go to
          your change list to review before you save.
        </Text>
        <TabbedView
          activeTab={activeTab}
          tabs={[
            {
              label: 'Remove Duplicates',
              onClick: () => setActiveTab(0),
              content: (
                <Flexbox direction="col" gap="2" className="pt-3">
                  <Select
                    id="cleanup-board"
                    label="Board"
                    value={cleanBoard}
                    setValue={setCleanBoard}
                    options={boardOptions}
                  />
                  <Text sm className="text-text-secondary">
                    Keeps one copy of each card in {boardLabel(cleanBoard)} and removes the rest, counting different
                    printings of a card as copies. The copy kept is the one with the most tags and notes.
                  </Text>
                  <Button
                    color="primary"
                    block
                    disabled={duplicateRemovals.length === 0}
                    onClick={() => handleRemove(duplicateRemovals, 'cube_cleanup_duplicates')}
                  >
                    {`Remove Duplicates (${duplicateRemovals.length})`}
                  </Button>
                  {referenceBoard && (
                    <Flexbox direction="col" gap="2" className="mt-2 pt-3 border-t border-border">
                      <Select
                        id="cleanup-reference"
                        label="Remove cards also in"
                        value={referenceBoard}
                        setValue={setPickedReference}
                        options={referenceBoards.map((board) => ({
                          value: board.value,
                          label: `${board.label} (${overlapByBoard[board.value]?.length ?? 0})`,
                        }))}
                      />
                      <Text sm className="text-text-secondary">
                        Removes every card in {boardLabel(cleanBoard)} that's also in {boardLabel(referenceBoard)}.
                      </Text>
                      <Button
                        color="primary"
                        block
                        disabled={overlapRemovals.length === 0}
                        onClick={() => handleRemove(overlapRemovals, 'cube_cleanup_overlap', referenceBoard)}
                      >
                        {`Remove Cards (${overlapRemovals.length})`}
                      </Button>
                    </Flexbox>
                  )}
                </Flexbox>
              ),
            },
            {
              label: 'Update Printings',
              onClick: () => setActiveTab(PRINTINGS_TAB),
              content: (
                <Flexbox direction="col" gap="2" className="pt-3">
                  <Text sm semibold>
                    Boards
                  </Text>
                  <Flexbox direction="row" wrap="wrap" gap="4">
                    {boardOptions.map((board) => (
                      <Checkbox
                        key={board.value}
                        label={board.label}
                        checked={printingBoards.includes(board.value)}
                        setChecked={(selected) => setPrintingBoardSelected(board.value, selected)}
                      />
                    ))}
                  </Flexbox>
                  <Select
                    id="cleanup-printing"
                    label="Printing"
                    value={printing}
                    setValue={(value) => setPrinting(value as PrintingPreference)}
                    options={PRINTING_OPTIONS}
                  />
                  <Text sm className="text-text-secondary">
                    Swaps every card in the checked boards to that printing of the same card.
                  </Text>
                  {printingsLoading && (
                    <Flexbox direction="row" justify="center" className="w-full py-2">
                      <Spinner />
                    </Flexbox>
                  )}
                  {!printingsLoading && !printings && (
                    <Text sm className="text-text-secondary">
                      Failed to load printings.
                    </Text>
                  )}
                  <Button
                    color="primary"
                    block
                    disabled={printingsLoading || printingUpdates.length === 0}
                    onClick={handleUpdatePrintings}
                  >
                    {`Update Printings (${printingUpdates.length})`}
                  </Button>
                </Flexbox>
              ),
            },
          ]}
        />
      </ModalBody>
    </Modal>
  );
};

export default CubeCleanupModal;
