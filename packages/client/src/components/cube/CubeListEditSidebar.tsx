import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { QuestionIcon } from '@primer/octicons-react';
import { cardName, normalizeName } from '@utils/cardutil';
import { CleanupCardRef, findDuplicateRemovals, findOverlapRemovals, makeSwapPredicate } from '@utils/cubeCleanup';
import { BoardType } from '@utils/datatypes/Card';
import { boardNameToKey, getBoardDefinitions, findViewBySlug } from '@utils/datatypes/Cube';

import Alert from 'components/base/Alert';
import AutocompleteInput from 'components/base/AutocompleteInput';
import Button from 'components/base/Button';
import Checkbox from 'components/base/Checkbox';
import Collapse from 'components/base/Collapse';
import Dropdown from 'components/base/Dropdown';
import Input from 'components/base/Input';
import { Flexbox } from 'components/base/Layout';
import Link from 'components/base/Link';
import Select from 'components/base/Select';
import Text from 'components/base/Text';
import Tooltip from 'components/base/Tooltip';
import Changelist from 'components/Changelist';
import LoadingButton from 'components/LoadingButton';
import AddPackageModal from 'components/modals/AddPackageModal';
import PasteBulkModal from 'components/modals/PasteBulkModal';
import UploadBulkModal from 'components/modals/UploadBulkModal';
import UploadBulkReplaceModal from 'components/modals/UploadBulkReplaceModal';
import TextEntry from 'components/TextEntry';
import withModal from 'components/WithModal';
import { CSRFContext } from 'contexts/CSRFContext';
import CubeContext from 'contexts/CubeContext';
import DisplayContext, { DisplayContextValue } from 'contexts/DisplayContext';
import useLocalStorage from 'hooks/useLocalStorage';
import { trackEvent } from 'utils/analytics';
import { cardNameMatches, cubeCardNameMatches } from 'utils/cardAutocomplete';
import { getCard } from 'utils/cards/getCard';

const DEFAULT_BLOG_TITLE = 'Cube Updated – Automatic Post';

const TOOLTIP_SPECIFY_VERSIONS =
  'When enabled, searches include set codes and collector numbers in addition to card names (all lowercase). eg "lightning bolt [lea-161]"';
const TOOLTIP_SHOW_EXTRAS =
  "When enabled, search includes promos, tokens, digital versions, non-standard layouts, non-English cards, 'flavour' names, special editions, and more.";
const TOOLTIP_CREATE_BLOG_POST =
  "The last checked status for 'Create Blog Post' will be remembered per Cube. The default can be set in your display preferences now.";

const PasteBulkButton = withModal(Button, PasteBulkModal);
const UploadBulkButton = withModal(Button, UploadBulkModal);
const UploadBulkReplaceButton = withModal(Button, UploadBulkReplaceModal);
const AddPackageButton = withModal(Button, AddPackageModal);

const DROPDOWN_ITEM_CLASSES =
  '!text-text hover:!text-link-active text-left bg-transparent border-0 p-0 cursor-pointer font-medium disabled:opacity-50 disabled:cursor-not-allowed';

interface BoardOption {
  value: string;
  label: string;
}

interface CleanupDropdownProps {
  boardOptions: BoardOption[];
  boardToEdit: BoardType;
  duplicateRemovals: CleanupCardRef[];
  overlapRemovals: Record<string, CleanupCardRef[]>;
  onCleanup: (removals: CleanupCardRef[], event: string, otherBoard?: string) => void;
}

/*
 * Rendered in both the vertical and horizontal sidebar layouts. Every item shows the length
 * of the exact array its click stages, so the preview and the action can never disagree.
 */
const CleanupDropdown: React.FC<CleanupDropdownProps> = ({
  boardOptions,
  boardToEdit,
  duplicateRemovals,
  overlapRemovals,
  onCleanup,
}) => {
  const otherBoards = boardOptions.filter((board) => board.value !== boardToEdit);
  // The displayed board and the Board select can disagree — a view spanning several boards
  // defaults this to the first one — so the menu names what it is about to act on.
  const targetLabel = boardOptions.find((board) => board.value === boardToEdit)?.label ?? boardToEdit;

  return (
    <Dropdown
      trigger={
        <Button color="secondary" block>
          Cleanup
        </Button>
      }
      align="right"
    >
      <Flexbox direction="col" gap="2" className="p-3">
        <Text sm className="text-text-secondary">
          Cleaning <span className="font-semibold text-text">{targetLabel}</span>
        </Text>
        <div className="border-t border-border" />
        <button
          type="button"
          className={DROPDOWN_ITEM_CLASSES}
          disabled={duplicateRemovals.length === 0}
          onClick={() => onCleanup(duplicateRemovals, 'cube_cleanup_duplicates')}
        >
          {`Remove Duplicates (${duplicateRemovals.length})`}
        </button>
        {otherBoards.length > 0 && (
          <>
            <div className="border-t border-border" />
            <Text sm semibold className="text-text-secondary">
              Remove cards also in…
            </Text>
            {otherBoards.map((board) => {
              const removals = overlapRemovals[board.value] ?? [];
              return (
                <button
                  key={board.value}
                  type="button"
                  className={DROPDOWN_ITEM_CLASSES}
                  disabled={removals.length === 0}
                  onClick={() => onCleanup(removals, 'cube_cleanup_overlap', board.value)}
                >
                  {`${board.label} (${removals.length})`}
                </button>
              );
            })}
          </>
        )}
      </Flexbox>
    </Dropdown>
  );
};

interface CubeListEditSidebarProps {
  isHorizontal?: boolean;
}

const CubeListEditSidebar: React.FC<CubeListEditSidebarProps> = ({ isHorizontal = false }) => {
  const { csrfFetch } = useContext(CSRFContext);
  const [addValue, setAddValue] = useState('');
  const [removeValue, setRemoveValue] = useState('');
  const { setRightSidebarMode, activeView } = useContext(DisplayContext) as DisplayContextValue;
  const addRef = useRef<HTMLInputElement>(null);
  const removeRef = useRef<HTMLInputElement>(null);

  const {
    cube,
    changes,
    addCard,
    removeCard,
    swapCard,
    bulkRemoveCard,
    changedCards,
    unfilteredChangedCards,
    clearChanges,
    commitChanges,
    alerts,
    setAlerts,
    loading,
    useBlog,
    setUseBlog,
  } = useContext(CubeContext)!;

  const [postContent, setPostContent] = useLocalStorage(`${cube.id}-blogpost`, '');
  const [postTitle, setPostTitle] = useLocalStorage(`${cube.id}-blogtitle`, DEFAULT_BLOG_TITLE);
  const [specifyEdition, setSpecifyEdition] = useLocalStorage(`${cube.id}-specifyEdition`, false);
  const [showExtras, setShowExtras] = useLocalStorage(`${cube.id}-showExtras`, false);
  const [boardToEdit, setBoardToEdit] = useLocalStorage<BoardType>(`${cube.id}-editBoard`, 'mainboard');

  // Memoize so AutocompleteInput's cache is only invalidated when options change
  const addCardMatches = useMemo(() => cardNameMatches(specifyEdition, showExtras), [specifyEdition, showExtras]);

  // Get board options from cube's board definitions
  const boardOptions = useMemo(() => {
    const boards = getBoardDefinitions(cube, changedCards);
    return boards.map((board) => ({
      value: boardNameToKey(board.name),
      label: board.name,
    }));
  }, [cube, changedCards]);

  // Precomputes the swapped positions once, rather than on every card of every render.
  const isSwapped = useMemo(() => makeSwapPredicate(changes), [changes]);

  const duplicateRemovals = useMemo(
    () => findDuplicateRemovals(changedCards[boardToEdit] ?? [], isSwapped),
    [changedCards, boardToEdit, isSwapped],
  );

  const overlapRemovals = useMemo(() => {
    const removalsByBoard: Record<string, CleanupCardRef[]> = {};

    for (const board of boardOptions) {
      if (board.value === boardToEdit) {
        continue;
      }

      removalsByBoard[board.value] = findOverlapRemovals(
        changedCards[boardToEdit] ?? [],
        changedCards[board.value] ?? [],
        isSwapped,
      );
    }

    return removalsByBoard;
  }, [boardOptions, changedCards, boardToEdit, isSwapped]);

  const handleCleanup = useCallback(
    (removals: CleanupCardRef[], event: string, otherBoard?: string) => {
      if (removals.length === 0) {
        return;
      }

      bulkRemoveCard(removals);
      trackEvent(event, { count: removals.length, board: boardToEdit, ...(otherBoard ? { otherBoard } : {}) });
    },
    [bulkRemoveCard, boardToEdit],
  );

  // Default the edit board to the first board in the active view. Tracks the
  // previously-seen view name with a ref so we only force a switch when the
  // user actually navigates to a new view. Manual overrides via the Board
  // dropdown stick — even to a board that isn't part of the current view —
  // until the next view change.
  const lastViewRef = useRef<string | null>(null);
  useEffect(() => {
    if (lastViewRef.current === activeView) return;
    const view = findViewBySlug(cube, activeView);
    if (!view || !view.boards || view.boards.length === 0) return;
    lastViewRef.current = activeView;
    const target = view.boards[0] as BoardType;
    if (target !== boardToEdit) {
      setBoardToEdit(target);
    }
    // boardToEdit is intentionally not in the dep array — we only want this
    // effect to react to view changes, not to user-driven board picks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeView, cube]);

  const handleAdd = useCallback(
    async (event: React.FormEvent, match: string) => {
      event.preventDefault();
      try {
        const card = await getCard(csrfFetch, cube.defaultPrinting, match, setAlerts);
        if (!card) {
          return;
        }
        addCard(
          { cardID: card.scryfall_id, addedTmsp: new Date().valueOf().toString(), status: cube.defaultStatus },
          boardToEdit,
        );
        trackEvent('cube_card_add', { method: 'single', count: 1, board: boardToEdit });
        setAddValue('');

        if (addRef.current) {
          addRef.current.focus();
        }
      } catch (e) {
        console.error(e);
      }
    },
    [csrfFetch, cube.defaultPrinting, cube.defaultStatus, setAlerts, addCard, boardToEdit],
  );

  const handleRemoveReplace = useCallback(
    async (event: React.FormEvent, match: string) => {
      event.preventDefault();
      const replace = addValue.length > 0;
      try {
        let removeIndex = -1;
        const board = unfilteredChangedCards[boardToEdit];
        for (let i = 0; i < board.length; i++) {
          const card = board[i];
          if (
            !card.markedForDelete &&
            card.index !== undefined &&
            normalizeName(cardName(card)) === normalizeName(match)
          ) {
            removeIndex = card.index;
          }
        }

        if (removeIndex === -1) {
          setAlerts((items) => [
            ...items,
            {
              color: 'danger',
              message: `Couldn't find a card with name "${match}" in "${boardToEdit}".`,
            },
          ]);
          return;
        }

        if (replace) {
          const card = await getCard(csrfFetch, cube.defaultPrinting, addValue, setAlerts);
          if (!card) {
            return;
          }
          swapCard(
            removeIndex,
            { cardID: card.scryfall_id, addedTmsp: new Date().valueOf().toString(), status: cube.defaultStatus },
            boardToEdit,
          );
        } else {
          removeCard(removeIndex, boardToEdit);
        }

        setAddValue('');
        setRemoveValue('');

        const focus = replace ? addRef : removeRef;
        if (focus.current) {
          focus.current.focus();
        }
      } catch (e) {
        console.error(e);
      }
    },
    [
      addValue,
      unfilteredChangedCards,
      boardToEdit,
      setAlerts,
      csrfFetch,
      cube.defaultPrinting,
      cube.defaultStatus,
      swapCard,
      removeCard,
    ],
  );

  const submit = useCallback(async () => {
    // Keep the blog post if the save failed, so it can be submitted again.
    if (!(await commitChanges(postTitle, postContent))) return;
    setPostTitle(DEFAULT_BLOG_TITLE);
    setPostContent('');
  }, [commitChanges, postContent, postTitle, setPostContent, setPostTitle]);

  return (
    <>
      {!isHorizontal ? (
        // Vertical layout for right sidebar
        <Flexbox direction="col" gap="3">
          {alerts.map(({ color, message }, index) => (
            <Alert key={index} color={color}>
              {message}
            </Alert>
          ))}

          <Flexbox direction="col" gap="2">
            <Dropdown
              trigger={
                <Button color="secondary" block>
                  Import
                </Button>
              }
              align="right"
            >
              <Flexbox direction="col" gap="2" className="p-3">
                <PasteBulkButton modalprops={{ cubeID: cube.id, boardOptions }} className={DROPDOWN_ITEM_CLASSES}>
                  Paste Text
                </PasteBulkButton>
                <UploadBulkButton modalprops={{ cubeID: cube.id, boardOptions }} className={DROPDOWN_ITEM_CLASSES}>
                  Upload File
                </UploadBulkButton>
                <UploadBulkReplaceButton modalprops={{ cubeID: cube.id }} className={DROPDOWN_ITEM_CLASSES}>
                  Replace with CSV Upload
                </UploadBulkReplaceButton>
              </Flexbox>
            </Dropdown>
            <CleanupDropdown
              boardOptions={boardOptions}
              boardToEdit={boardToEdit}
              duplicateRemovals={duplicateRemovals}
              overlapRemovals={overlapRemovals}
              onCleanup={handleCleanup}
            />
            <AddPackageButton color="secondary" block modalprops={{ boardToEdit }}>
              Add Package
            </AddPackageButton>
          </Flexbox>

          <Select
            label="Board"
            value={boardToEdit}
            setValue={(value) => setBoardToEdit(value as BoardType)}
            options={boardOptions}
          />

          <Flexbox direction="col" gap="2">
            <Text semibold sm>
              Add Card
            </Text>
            <AutocompleteInput
              getMatches={addCardMatches}
              type="text"
              innerRef={addRef}
              name="add"
              value={addValue}
              setValue={setAddValue}
              onSubmit={(e, addCardValue) => handleAdd(e, addCardValue!)}
              placeholder="Card to Add"
              autoComplete="off"
              data-lpignore
              defaultPrinting={cube.defaultPrinting}
            />
            <Button color="primary" disabled={addValue.length === 0} onClick={(e) => handleAdd(e, addValue)} block>
              Add
            </Button>
          </Flexbox>

          <Flexbox direction="col" gap="2">
            <Text semibold sm>
              Remove/Replace Card
            </Text>
            <AutocompleteInput
              cubeId={cube.id}
              getMatches={cubeCardNameMatches(cube.id, boardToEdit)}
              type="text"
              innerRef={removeRef}
              name="remove"
              value={removeValue}
              setValue={setRemoveValue}
              onSubmit={(e, removeCardValue) => handleRemoveReplace(e, removeCardValue!)}
              placeholder="Card to Remove"
              autoComplete="off"
              data-lpignore
            />
            <Button
              color="accent"
              disabled={removeValue.length === 0}
              onClick={(e) => handleRemoveReplace(e, removeValue)}
              block
            >
              Remove/Replace
            </Button>
          </Flexbox>

          <Flexbox direction="col" gap="2">
            <Flexbox direction="row" gap="2" alignItems="center">
              <Checkbox
                label="Specify Versions"
                checked={specifyEdition}
                setChecked={(value) => setSpecifyEdition(value)}
              />
              <Tooltip text={TOOLTIP_SPECIFY_VERSIONS}>
                <QuestionIcon size={16} className="hidden md:inline" />
              </Tooltip>
            </Flexbox>
            <Flexbox direction="row" gap="2" alignItems="center">
              <Checkbox label="Show Extras" checked={showExtras} setChecked={(value) => setShowExtras(value)} />
              <Tooltip text={TOOLTIP_SHOW_EXTRAS}>
                <QuestionIcon size={16} className="hidden md:inline" />
              </Tooltip>
            </Flexbox>
            <Flexbox direction="row" gap="2" alignItems="center">
              <Checkbox label="Create Blog Post" checked={useBlog} setChecked={(value) => setUseBlog(value)} />
              <Tooltip text={TOOLTIP_CREATE_BLOG_POST}>
                <QuestionIcon size={16} className="hidden md:inline" />
              </Tooltip>
            </Flexbox>
          </Flexbox>

          <Collapse
            isOpen={Object.keys(changes)
              .filter((key) => key !== 'version')
              .some((board) => {
                const boardChanges = changes[board];
                if (!boardChanges || typeof boardChanges !== 'object') return false;
                return Object.values(boardChanges).some((c: any) => Array.isArray(c) && c.length > 0);
              })}
          >
            <Flexbox direction="col" gap="3">
              <Changelist />

              {useBlog && (
                <Flexbox direction="col" gap="2">
                  <Input
                    label="Blog Post Title"
                    type="text"
                    value={postTitle}
                    onChange={(e) => setPostTitle(e.target.value)}
                    className="mb-2 !h-auto"
                  />
                  <TextEntry name="blog" value={postContent} setValue={setPostContent} maxLength={30000} rows={4} />
                </Flexbox>
              )}

              <Flexbox direction="row" gap="2" className="mb-16">
                <LoadingButton color="primary" block onClick={submit} loading={loading} className="flex-1">
                  Save Changes
                </LoadingButton>
                <Button
                  color="danger"
                  block
                  onClick={() => {
                    clearChanges();
                    setPostTitle(DEFAULT_BLOG_TITLE);
                    setPostContent('');
                    setRightSidebarMode('none');
                  }}
                  className="flex-1"
                >
                  Discard All
                </Button>
              </Flexbox>
            </Flexbox>
          </Collapse>

          <div className="pt-3 mt-2 border-t border-border">
            <Text sm className="text-text-secondary">
              Looking for new cards for your cube? Try using our{' '}
              <Link href={`/cube/analysis/${cube.id}?view=recommender`}>Smart Search</Link> that sorts the cards by how
              well we think the card will fit into your cube.
            </Text>
          </div>
        </Flexbox>
      ) : (
        // Horizontal layout for bottom card - completely redesigned
        <div className="w-full">
          {alerts.map(({ color, message }, index) => (
            <Alert key={index} color={color} className="mb-3">
              {message}
            </Alert>
          ))}

          {/* Board select - shown alone on md, hidden on lg+ */}
          <div className="flex items-center gap-2 lg:hidden mb-4">
            <Text semibold sm className="whitespace-nowrap">
              Board
            </Text>
            <Select
              value={boardToEdit}
              setValue={(value) => setBoardToEdit(value as BoardType)}
              options={boardOptions}
            />
          </div>

          {/* First Row: Board (lg+ only), Add Card, Remove/Replace Card */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Board - shown inline on lg+ */}
            <div className="hidden lg:flex items-center gap-2">
              <Text semibold sm className="whitespace-nowrap">
                Board
              </Text>
              <Select
                value={boardToEdit}
                setValue={(value) => setBoardToEdit(value as BoardType)}
                options={boardOptions}
              />
            </div>

            {/* Add Card */}
            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                <div className="flex-1">
                  <AutocompleteInput
                    getMatches={addCardMatches}
                    type="text"
                    innerRef={addRef}
                    name="add"
                    value={addValue}
                    setValue={setAddValue}
                    onSubmit={(e, addCardValue) => handleAdd(e, addCardValue!)}
                    placeholder="Card to Add"
                    autoComplete="off"
                    data-lpignore
                    defaultPrinting={cube.defaultPrinting}
                  />
                </div>
                <Button color="primary" disabled={addValue.length === 0} onClick={(e) => handleAdd(e, addValue)}>
                  Add
                </Button>
              </div>
            </div>

            {/* Remove/Replace Card */}
            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                <div className="flex-1">
                  <AutocompleteInput
                    cubeId={cube.id}
                    getMatches={cubeCardNameMatches(cube.id, boardToEdit)}
                    type="text"
                    innerRef={removeRef}
                    name="remove"
                    value={removeValue}
                    setValue={setRemoveValue}
                    onSubmit={(e, removeCardValue) => handleRemoveReplace(e, removeCardValue!)}
                    placeholder="Card to Remove"
                    autoComplete="off"
                    data-lpignore
                  />
                </div>
                <Button
                  color="accent"
                  disabled={removeValue.length === 0}
                  onClick={(e) => handleRemoveReplace(e, removeValue)}
                >
                  Remove/Replace
                </Button>
              </div>
            </div>
          </div>

          {/* Second Row: Specify Versions, Show Extras, Create Blog Post, Import */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
            {/* Checkboxes - share a single wrapping row so spacing stays even and they never overlap */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 lg:col-span-2">
              <div className="flex items-center gap-2">
                <Checkbox
                  label="Specify Versions"
                  checked={specifyEdition}
                  setChecked={(value) => setSpecifyEdition(value)}
                />
                <Tooltip text={TOOLTIP_SPECIFY_VERSIONS}>
                  <QuestionIcon size={16} />
                </Tooltip>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox label="Show Extras" checked={showExtras} setChecked={(value) => setShowExtras(value)} />
                <Tooltip text={TOOLTIP_SHOW_EXTRAS}>
                  <QuestionIcon size={16} />
                </Tooltip>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox label="Create Blog Post" checked={useBlog} setChecked={(value) => setUseBlog(value)} />
                <Tooltip text={TOOLTIP_CREATE_BLOG_POST}>
                  <QuestionIcon size={16} />
                </Tooltip>
              </div>
            </div>

            {/* Import */}
            <div className="flex flex-col gap-2">
              <Dropdown
                trigger={
                  <Button color="secondary" block>
                    Import
                  </Button>
                }
                align="right"
              >
                <Flexbox direction="col" gap="2" className="p-3">
                  <PasteBulkButton modalprops={{ cubeID: cube.id, boardOptions }} className={DROPDOWN_ITEM_CLASSES}>
                    Paste Text
                  </PasteBulkButton>
                  <UploadBulkButton modalprops={{ cubeID: cube.id, boardOptions }} className={DROPDOWN_ITEM_CLASSES}>
                    Upload File
                  </UploadBulkButton>
                  <UploadBulkReplaceButton modalprops={{ cubeID: cube.id }} className={DROPDOWN_ITEM_CLASSES}>
                    Replace with CSV Upload
                  </UploadBulkReplaceButton>
                </Flexbox>
              </Dropdown>
              <CleanupDropdown
                boardOptions={boardOptions}
                boardToEdit={boardToEdit}
                duplicateRemovals={duplicateRemovals}
                overlapRemovals={overlapRemovals}
                onCleanup={handleCleanup}
              />
              <AddPackageButton color="secondary" block modalprops={{ boardToEdit }}>
                Add Package
              </AddPackageButton>
            </div>
          </div>

          {/* Changelist and Blog - Side by Side on Wide Screens */}
          {Object.keys(changes)
            .filter((key) => key !== 'version')
            .some((board) => {
              const boardChanges = changes[board];
              if (!boardChanges || typeof boardChanges !== 'object') return false;
              return Object.values(boardChanges).some((c: any) => Array.isArray(c) && c.length > 0);
            }) && (
            <div className="mt-4 pt-4 border-t border-border">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Changelist */}
                <div>
                  <Changelist />
                </div>

                {/* Blog Post */}
                {useBlog && (
                  <div className="flex flex-col gap-4">
                    <Input
                      label="Blog Post Title"
                      type="text"
                      value={postTitle}
                      onChange={(e) => setPostTitle(e.target.value)}
                      className="mb-2 !h-auto"
                    />
                    <TextEntry name="blog" value={postContent} setValue={setPostContent} maxLength={30000} rows={4} />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Action Buttons - Full Width at Bottom */}
          {Object.keys(changes)
            .filter((key) => key !== 'version')
            .some((board) => {
              const boardChanges = changes[board];
              if (!boardChanges || typeof boardChanges !== 'object') return false;
              return Object.values(boardChanges).some((c: any) => Array.isArray(c) && c.length > 0);
            }) && (
            <div className="mt-4 pt-4 border-t border-border flex gap-4">
              <LoadingButton color="primary" block onClick={submit} loading={loading} className="flex-1">
                Save Changes
              </LoadingButton>
              <Button
                color="danger"
                block
                onClick={() => {
                  clearChanges();
                  setPostTitle(DEFAULT_BLOG_TITLE);
                  setPostContent('');
                  setRightSidebarMode('none');
                }}
                className="flex-1"
              >
                Discard All
              </Button>
            </div>
          )}

          <div className="mt-4 pt-3 border-t border-border">
            <Text sm className="text-text-secondary">
              Looking for new cards for your cube? Try using our{' '}
              <Link href={`/cube/analysis/${cube.id}?view=recommender`}>Smart Search</Link> that sorts the cards by how
              well we think the card will fit into your cube.
            </Text>
          </div>
        </div>
      )}
    </>
  );
};

export default CubeListEditSidebar;
