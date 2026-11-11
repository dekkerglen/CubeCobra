import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { ArrowRightIcon } from '@primer/octicons-react';
import { cardName } from '@utils/cardutil';
import {
  findDuplicateRemovals,
  findPrintingCandidates,
  findPrintingUpdates,
  makeSwapPredicate,
} from '@utils/cubeCleanup';
import Card, {
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
import withAutocard from 'components/WithAutocard';
import { CSRFContext } from 'contexts/CSRFContext';
import CubeContext from 'contexts/CubeContext';
import { trackEvent } from 'utils/analytics';
import { getPrintings } from 'utils/cards/getPrintings';

const AutocardSpan = withAutocard('span');

const PRINTINGS_TAB = 1;

const PRINTING_OPTIONS = [
  { value: PrintingPreference.DEFAULT, label: 'Default' },
  { value: PrintingPreference.RECENT, label: 'Most Recent' },
  { value: PrintingPreference.FIRST, label: 'First' },
  { value: PrintingPreference.CHEAPEST, label: 'Cheapest' },
];

const printingLabel = (details: CardDetails | undefined): string =>
  details ? `${details.set.toUpperCase()}-${details.collector_number}` : '';

// The card as it looks on a given printing. A custom image would hide the printing, which is
// the whole point of the preview, so it is dropped.
const printingPreview = (card: Card, details: CardDetails | undefined): Card => ({
  ...card,
  cardID: details?.scryfall_id ?? card.cardID,
  details,
  imgUrl: undefined,
  imgBackUrl: undefined,
});

const positionKey = (board: string | undefined, index: number | undefined): string => `${board}:${index}`;

const CardRows: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="max-h-72 overflow-y-auto rounded border border-border">{children}</div>
);

interface CardRowProps {
  card: Card | undefined;
  // The printing previews carry the hover on that row, so its name stays plain.
  plainName?: boolean;
  children: React.ReactNode;
}

const CardRow: React.FC<CardRowProps> = ({ card, plainName = false, children }) => (
  <Flexbox
    direction="row"
    justify="between"
    alignItems="center"
    gap="2"
    className="px-2 py-1 text-sm border-b border-border last:border-b-0"
  >
    {card && !plainName ? (
      <AutocardSpan card={card} className="truncate">
        {cardName(card)}
      </AutocardSpan>
    ) : (
      <span className="truncate">{card ? cardName(card) : ''}</span>
    )}
    <Flexbox direction="row" alignItems="center" gap="2" className="shrink-0 text-text-secondary">
      {children}
    </Flexbox>
  </Flexbox>
);

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
  const [selectedBoards, setSelectedBoards] = useState<string[]>([boardToEdit]);
  const [wasOpen, setWasOpen] = useState(isOpen);
  const [printing, setPrinting] = useState<PrintingPreference>(
    isPrintingPreference(cube.defaultPrinting) ? cube.defaultPrinting : DefaultPrintingPreference,
  );
  // Resolved printings by request, so flipping between preferences doesn't refetch.
  const [results, setResults] = useState<Record<string, Record<string, CardDetails>>>({});
  const [failedKey, setFailedKey] = useState<string | null>(null);

  // Every opening starts from the edited board alone. Adjusted during render rather than in an
  // effect, so the first frame of the opened modal already shows it.
  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    if (isOpen) {
      setSelectedBoards([boardToEdit]);
    }
  }

  // Kept in the cube's board order, whatever order the boxes were ticked in.
  const targetBoards = useMemo(
    () => boardOptions.filter((board) => selectedBoards.includes(board.value)),
    [boardOptions, selectedBoards],
  );
  const boardLabels = useMemo(
    () => Object.fromEntries(boardOptions.map((board) => [board.value, board.label])),
    [boardOptions],
  );

  const setBoardSelected = (board: string, selected: boolean) =>
    setSelectedBoards((prev) => (selected ? [...prev, board] : prev.filter((value) => value !== board)));

  // Precomputes the swapped positions once, rather than on every card of every render.
  const isSwapped = useMemo(() => makeSwapPredicate(changes), [changes]);

  const targetCards = useMemo(
    () => targetBoards.flatMap((board) => changedCards[board.value] ?? []),
    [targetBoards, changedCards],
  );

  // Duplicates are found across every checked board at once, and the copy kept sits on the
  // earliest of them, so checking the mainboard alongside the maybeboard clears the maybeboard of
  // everything the mainboard already holds.
  const duplicateRemovals = useMemo(
    () =>
      findDuplicateRemovals(
        targetCards,
        isSwapped,
        targetBoards.map((board) => board.value),
      ),
    [targetCards, isSwapped, targetBoards],
  );

  const candidates = useMemo(() => findPrintingCandidates(targetCards, isSwapped), [targetCards, isSwapped]);
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
        ? targetBoards.flatMap((board) => findPrintingUpdates(changedCards[board.value] ?? [], printings, isSwapped))
        : [],
    [printings, targetBoards, changedCards, isSwapped],
  );

  const cardsByPosition = useMemo(() => {
    const map = new Map<string, Card>();
    for (const card of targetCards) {
      map.set(positionKey(card.board, card.index), card);
    }
    return map;
  }, [targetCards]);

  const printingsLoading = !printings && failedKey !== requestKey;
  const trackedBoards = targetBoards.map((board) => board.value).join(',');

  const handleRemoveDuplicates = useCallback(() => {
    if (duplicateRemovals.length === 0) {
      return;
    }

    bulkRemoveCard(duplicateRemovals);
    trackEvent('cube_cleanup_duplicates', { count: duplicateRemovals.length, board: trackedBoards });
    setOpen(false);
  }, [duplicateRemovals, bulkRemoveCard, trackedBoards, setOpen]);

  const handleUpdatePrintings = useCallback(() => {
    if (printingUpdates.length === 0) {
      return;
    }

    bulkEditPrinting(printingUpdates);
    trackEvent('cube_cleanup_printings', { count: printingUpdates.length, board: trackedBoards, printing });
    setOpen(false);
  }, [printingUpdates, bulkEditPrinting, trackedBoards, printing, setOpen]);

  return (
    <Modal isOpen={isOpen} setOpen={setOpen} md>
      <ModalHeader setOpen={setOpen}>Cleanup</ModalHeader>
      <ModalBody>
        <Flexbox direction="col" gap="2">
          <Text sm semibold>
            Boards
          </Text>
          <Flexbox direction="row" wrap="wrap" gap="4">
            {boardOptions.map((board) => (
              <Checkbox
                key={board.value}
                label={board.label}
                checked={selectedBoards.includes(board.value)}
                setChecked={(selected) => setBoardSelected(board.value, selected)}
              />
            ))}
          </Flexbox>
          <TabbedView
            activeTab={activeTab}
            tabs={[
              {
                label: 'Remove Duplicates',
                onClick: () => setActiveTab(0),
                content: (
                  <Flexbox direction="col" gap="2" className="pt-3">
                    {duplicateRemovals.length > 0 && (
                      <CardRows>
                        {duplicateRemovals.map((removal) => {
                          const card = cardsByPosition.get(positionKey(removal.board, removal.index));
                          return (
                            <CardRow key={positionKey(removal.board, removal.index)} card={card}>
                              {targetBoards.length > 1 && <span>{boardLabels[removal.board] ?? removal.board}</span>}
                              <span>{printingLabel(card?.details)}</span>
                            </CardRow>
                          );
                        })}
                      </CardRows>
                    )}
                    <Button
                      color="primary"
                      block
                      disabled={duplicateRemovals.length === 0}
                      onClick={handleRemoveDuplicates}
                    >
                      {`Remove Duplicates (${duplicateRemovals.length})`}
                    </Button>
                  </Flexbox>
                ),
              },
              {
                label: 'Update Printings',
                onClick: () => setActiveTab(PRINTINGS_TAB),
                content: (
                  <Flexbox direction="col" gap="2" className="pt-3">
                    <Select
                      id="cleanup-printing"
                      label="Printing"
                      value={printing}
                      setValue={(value) => setPrinting(value as PrintingPreference)}
                      options={PRINTING_OPTIONS}
                    />
                    {printingsLoading ? (
                      <Flexbox direction="row" justify="center" className="w-full py-2">
                        <Spinner />
                      </Flexbox>
                    ) : !printings ? (
                      <Text sm className="text-text-secondary">
                        Failed to load printings.
                      </Text>
                    ) : (
                      printingUpdates.length > 0 && (
                        <CardRows>
                          {printingUpdates.map((update) => {
                            const card = cardsByPosition.get(positionKey(update.board, update.index));
                            return (
                              <CardRow key={positionKey(update.board, update.index)} card={card} plainName>
                                {card && (
                                  <>
                                    <AutocardSpan card={printingPreview(card, card.details)}>
                                      {printingLabel(card.details)}
                                    </AutocardSpan>
                                    <ArrowRightIcon size={12} />
                                    <AutocardSpan card={printingPreview(card, update.details)}>
                                      {printingLabel(update.details)}
                                    </AutocardSpan>
                                  </>
                                )}
                              </CardRow>
                            );
                          })}
                        </CardRows>
                      )
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
        </Flexbox>
      </ModalBody>
    </Modal>
  );
};

export default CubeCleanupModal;
