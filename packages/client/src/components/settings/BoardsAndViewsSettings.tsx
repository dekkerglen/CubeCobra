import React, { useCallback, useContext, useMemo, useState } from 'react';

import { GrabberIcon, PencilIcon, PlusIcon, TrashIcon } from '@primer/octicons-react';
import {
  BoardDefinition,
  boardNameToKey,
  CubeDisplayView,
  DEFAULT_BOARDS,
  MAX_BOARDS,
  MAX_VIEWS,
  validateBoardDefinitions,
  validateViewDefinitions,
  VIEW_DEFAULT_SORTS,
  ViewDefinition,
} from '@utils/datatypes/Cube';
import { getAllSorts, ORDERED_SORTS } from '@utils/sorting/Sort';

import Alert from 'components/base/Alert';
import Button from 'components/base/Button';
import { Card, CardBody, CardHeader } from 'components/base/Card';
import Checkbox from 'components/base/Checkbox';
import Input from 'components/base/Input';
import { Flexbox } from 'components/base/Layout';
import { Modal, ModalBody, ModalFooter, ModalHeader } from 'components/base/Modal';
import Select from 'components/base/Select';
import Text from 'components/base/Text';
import CSRFForm from 'components/CSRFForm';
import { SortableItem, SortableList } from 'components/DND';
import LoadingButton from 'components/LoadingButton';
import CubeContext from 'contexts/CubeContext';

import AddBoardModal from './AddBoardModal';

const DISPLAY_VIEW_OPTIONS: { value: CubeDisplayView; label: string }[] = [
  { value: 'table', label: 'Table' },
  { value: 'spoiler', label: 'Visual Spoiler' },
  { value: 'curve', label: 'Curve' },
  { value: 'stacks', label: 'Stacks' },
];

const BoardsAndViewsSettings: React.FC = () => {
  const { cube, unfilteredChangedCards } = useContext(CubeContext);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [hasChanges, setHasChanges] = useState(false);
  const [showAddBoardModal, setShowAddBoardModal] = useState(false);
  const formRef = React.useRef<HTMLFormElement>(null);

  // Initialize boards from cards structure
  const getInitialBoards = useCallback((): BoardDefinition[] => {
    if (!unfilteredChangedCards) {
      return DEFAULT_BOARDS.map((b) => ({ ...b }));
    }

    const boardKeys = Object.keys(unfilteredChangedCards).filter((key) => key !== 'id');
    if (boardKeys.length === 0) {
      return DEFAULT_BOARDS.map((b) => ({ ...b }));
    }

    const standardKeys = ['mainboard', 'maybeboard', 'basics'];
    const sortedKeys = boardKeys.sort((a, b) => {
      const aIsStandard = standardKeys.indexOf(a.toLowerCase());
      const bIsStandard = standardKeys.indexOf(b.toLowerCase());
      if (aIsStandard !== -1 && bIsStandard !== -1) return aIsStandard - bIsStandard;
      if (aIsStandard !== -1) return -1;
      if (bIsStandard !== -1) return 1;
      return a.localeCompare(b);
    });

    return sortedKeys.map((key) => ({
      name: key.charAt(0).toUpperCase() + key.slice(1),
    }));
  }, [unfilteredChangedCards]);

  const getInitialViews = useCallback((): ViewDefinition[] => {
    if (cube.views && cube.views.length > 0) {
      return cube.views.map((v) => ({ ...v, defaultSorts: [...v.defaultSorts] }));
    }
    return [];
  }, [cube.views]);

  const [boards, setBoards] = useState<BoardDefinition[]>(getInitialBoards);
  const [views, setViews] = useState<ViewDefinition[]>(getInitialViews);
  const [editingViewIndex, setEditingViewIndex] = useState<number | null>(null);
  const [editingViewDraft, setEditingViewDraft] = useState<ViewDefinition | null>(null);

  const allSorts = useMemo(() => getAllSorts(cube), [cube]);

  // Calculate card counts for each board
  const boardCardCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const board of boards) {
      const key = boardNameToKey(board.name);
      const cards = unfilteredChangedCards?.[key];
      counts[board.name] = cards?.length || 0;
    }
    return counts;
  }, [boards, unfilteredChangedCards]);

  // Detect changes
  React.useEffect(() => {
    const boardsChanged = JSON.stringify(boards) !== JSON.stringify(getInitialBoards());
    const viewsChanged = JSON.stringify(views) !== JSON.stringify(getInitialViews());
    setHasChanges(boardsChanged || viewsChanged);
  }, [boards, views, getInitialBoards, getInitialViews]);

  const addBoard = () => {
    if (boards.length >= MAX_BOARDS) {
      setError(`Cannot add more than ${MAX_BOARDS} boards`);
      return;
    }
    setShowAddBoardModal(true);
  };

  const handleAddBoard = (boardName: string, createView: boolean) => {
    const newBoard = { name: boardName };
    const newBoards = [...boards, newBoard];
    setBoards(newBoards);

    if (createView) {
      const boardKey = boardNameToKey(boardName);
      const newView: ViewDefinition = {
        name: boardName,
        boards: [boardKey],
        displayView: 'table',
        defaultSorts: [...VIEW_DEFAULT_SORTS],
      };
      setViews([...views, newView]);
    }

    setError('');
  };

  const removeBoard = (index: number) => {
    const board = boards[index];
    if (boards.length <= 1) {
      setError('Must have at least one board');
      return;
    }

    const cardCount = boardCardCounts[board.name] || 0;
    if (cardCount > 0) {
      setError(
        `Cannot remove "${board.name}" - it contains ${cardCount} card${cardCount !== 1 ? 's' : ''}. Move all cards first.`,
      );
      return;
    }

    const boardKey = boardNameToKey(board.name);
    const referencingViews = views.filter((view) => view.boards.includes(boardKey));
    if (referencingViews.length > 0) {
      setError(
        `Cannot remove "${board.name}" - it is referenced by view${referencingViews.length !== 1 ? 's' : ''}: ${referencingViews.map((v) => v.name).join(', ')}.`,
      );
      return;
    }

    setBoards(boards.filter((_, i) => i !== index));
    setError('');
  };

  const addView = () => {
    if (views.length >= MAX_VIEWS) {
      setError(`Cannot add more than ${MAX_VIEWS} views`);
      return;
    }
    const newView: ViewDefinition = {
      name: '',
      boards: boards.length > 0 ? [boardNameToKey(boards[0].name)] : [],
      displayView: 'table',
      defaultSorts: [...VIEW_DEFAULT_SORTS],
    };
    setViews([...views, newView]);
    setError('');
  };

  const removeView = (index: number) => {
    if (views.length <= 1) {
      setError('Must have at least one view');
      return;
    }
    setViews(views.filter((_, i) => i !== index));
    setError('');
  };

  const updateView = (index: number, updates: Partial<ViewDefinition>) => {
    const newViews = [...views];
    newViews[index] = { ...newViews[index], ...updates };
    setViews(newViews);
    setError('');
  };

  const openEditModal = (index: number) => {
    setEditingViewIndex(index);
    setEditingViewDraft({
      ...views[index],
      defaultSorts: [...views[index].defaultSorts],
      boards: [...views[index].boards],
    });
  };

  const closeEditModal = () => {
    setEditingViewIndex(null);
    setEditingViewDraft(null);
  };

  const applyEditModal = () => {
    if (editingViewIndex !== null && editingViewDraft) {
      const newViews = [...views];
      newViews[editingViewIndex] = editingViewDraft;
      setViews(newViews);
      setError('');
    }
    closeEditModal();
  };

  const updateDraft = (updates: Partial<ViewDefinition>) => {
    if (editingViewDraft) {
      setEditingViewDraft({ ...editingViewDraft, ...updates });
    }
  };

  const toggleBoardInDraft = (boardKey: string) => {
    if (!editingViewDraft) return;
    const newBoards = editingViewDraft.boards.includes(boardKey)
      ? editingViewDraft.boards.filter((b) => b !== boardKey)
      : [...editingViewDraft.boards, boardKey];
    setEditingViewDraft({ ...editingViewDraft, boards: newBoards });
  };

  const handleDraftBoardsSortEnd = (event: any) => {
    if (!editingViewDraft) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = editingViewDraft.boards.findIndex((key) => key === active.id);
    const newIndex = editingViewDraft.boards.findIndex((key) => key === over.id);

    if (oldIndex !== -1 && newIndex !== -1) {
      const newBoards = [...editingViewDraft.boards];
      const [removed] = newBoards.splice(oldIndex, 1);
      newBoards.splice(newIndex, 0, removed);
      setEditingViewDraft({ ...editingViewDraft, boards: newBoards });
    }
  };

  const handleViewsSortEnd = useCallback(
    (event: any) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = views.findIndex((_, i) => `view-${i}` === active.id);
      const newIndex = views.findIndex((_, i) => `view-${i}` === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        const newViews = [...views];
        const [removed] = newViews.splice(oldIndex, 1);
        newViews.splice(newIndex, 0, removed);
        setViews(newViews);
        setError('');
      }
    },
    [views],
  );

  const handleSave = () => {
    // Validate boards
    const boardValidation = validateBoardDefinitions(boards);
    if (!boardValidation.valid) {
      setError(boardValidation.error || 'Invalid board configuration');
      return;
    }

    // Validate views
    const viewValidation = validateViewDefinitions(views);
    if (!viewValidation.valid) {
      setError(viewValidation.error || 'Invalid view configuration');
      return;
    }

    setError('');
    setLoading(true);

    // Submit unified form
    if (formRef.current) {
      formRef.current.submit();
    }
  };

  const resetChanges = () => {
    setBoards(getInitialBoards());
    setViews(getInitialViews());
    setError('');
  };

  const availableBoards = useMemo(
    () =>
      boards.map((board) => ({
        key: boardNameToKey(board.name),
        name: board.name,
      })),
    [boards],
  );

  return (
    <Flexbox direction="col" gap="3">
      {error && <Alert color="danger">{error}</Alert>}

      <Card>
        <CardHeader>
          <Flexbox direction="row" justify="between" alignItems="center">
            <Text semibold lg>
              Boards and Views
            </Text>
            <Flexbox direction="row" gap="2">
              <Button color="secondary" onClick={resetChanges} disabled={!hasChanges}>
                Reset
              </Button>
              <LoadingButton color="primary" onClick={handleSave} disabled={!hasChanges} loading={loading}>
                Save Changes
              </LoadingButton>
            </Flexbox>
          </Flexbox>
        </CardHeader>
        <CardBody>
          <Flexbox direction="col" gap="4">
            {/* Boards Section */}
            <div>
              <Flexbox direction="row" justify="between" alignItems="center" className="mb-3">
                <Text semibold md>
                  Boards
                </Text>
                <Button color="accent" onClick={addBoard} disabled={boards.length >= MAX_BOARDS}>
                  <PlusIcon size={16} className="mr-1" /> Add Board
                </Button>
              </Flexbox>

              <Flexbox direction="col" gap="3">
                <Text sm className="text-text-secondary">
                  Configure which boards are available for your cube. Create custom boards to organize your cards. Board
                  names cannot be changed after creation.
                </Text>

                {boards.map((board, index) => {
                  const cardCount = boardCardCounts[board.name] || 0;
                  const canDelete = boards.length > 1 && cardCount === 0;

                  return (
                    <div
                      key={index}
                      className="rounded-md border border-border bg-bg p-3 transition-colors hover:border-border-active"
                    >
                      <Flexbox direction="row" gap="2" alignItems="center">
                        <div className="flex-1">
                          <Text className="font-medium">{board.name}</Text>
                        </div>
                        {cardCount > 0 && (
                          <Text xs className="text-text-secondary whitespace-nowrap">
                            {cardCount} card{cardCount !== 1 ? 's' : ''}
                          </Text>
                        )}
                        <Button color="danger" onClick={() => removeBoard(index)} disabled={!canDelete}>
                          <TrashIcon size={16} />
                        </Button>
                      </Flexbox>
                    </div>
                  );
                })}
              </Flexbox>
            </div>

            {/* Views Section */}
            <div className="pt-4 border-t border-border">
              <Flexbox direction="row" justify="between" alignItems="center" className="mb-3">
                <Text semibold md>
                  Views
                </Text>
                <Button color="accent" onClick={addView} disabled={views.length >= MAX_VIEWS}>
                  <PlusIcon size={16} className="mr-1" /> Add View
                </Button>
              </Flexbox>
              <Text sm className="text-text-secondary mb-3">
                Configure different views of your cube list with custom board selections, sorts, and filters. Drag to
                reorder.
              </Text>

              <SortableList onDragEnd={handleViewsSortEnd} items={views.map((_, idx) => `view-${idx}`)}>
                <Flexbox direction="col" gap="3">
                  {views.map((view, index) => {
                    return (
                      <SortableItem key={`view-${index}`} id={`view-${index}`}>
                        {({ handleProps }) => (
                          <div className="rounded-md border border-border bg-bg transition-colors hover:border-border-active">
                            {/* View Header */}
                            <div {...handleProps} className="p-3 flex items-center gap-2 cursor-grab select-none">
                              <GrabberIcon size={16} className="text-text-secondary flex-shrink-0" />
                              <div className="flex-1" onPointerDown={(e) => e.stopPropagation()}>
                                <Input
                                  value={view.name}
                                  onChange={(e) => updateView(index, { name: e.target.value })}
                                  placeholder="View name"
                                  onClick={(e) => e.stopPropagation()}
                                />
                              </div>
                              <div onPointerDown={(e) => e.stopPropagation()}>
                                <Button color="secondary" onClick={() => openEditModal(index)} className="p-2">
                                  <PencilIcon size={16} className="mr-1" /> Edit
                                </Button>
                              </div>
                              <div onPointerDown={(e) => e.stopPropagation()}>
                                <Button color="danger" onClick={() => removeView(index)} disabled={views.length <= 1}>
                                  <TrashIcon size={16} />
                                </Button>
                              </div>
                            </div>
                          </div>
                        )}
                      </SortableItem>
                    );
                  })}
                </Flexbox>
              </SortableList>
            </div>
          </Flexbox>
        </CardBody>
      </Card>

      <AddBoardModal
        isOpen={showAddBoardModal}
        setOpen={setShowAddBoardModal}
        onAdd={handleAddBoard}
        existingBoardNames={boards.map((b) => b.name)}
      />

      {/* Edit View Modal */}
      <Modal
        isOpen={editingViewIndex !== null}
        setOpen={(open) => {
          if (!open) closeEditModal();
        }}
        lg
      >
        <ModalHeader
          setOpen={(open) => {
            if (!open) closeEditModal();
          }}
        >
          Edit View{editingViewDraft ? `: ${editingViewDraft.name || '(unnamed)'}` : ''}
        </ModalHeader>
        {editingViewDraft && (
          <ModalBody>
            <Flexbox direction="col" gap="4">
              {/* Board Selection with Checkboxes */}
              <div>
                <Text sm className="font-medium mb-2">
                  Boards to display
                </Text>
                <div className="grid grid-cols-1 gap-2">
                  {availableBoards.map((board) => (
                    <Checkbox
                      key={board.key}
                      label={board.name}
                      checked={editingViewDraft.boards.includes(board.key)}
                      setChecked={() => toggleBoardInDraft(board.key)}
                    />
                  ))}
                </div>
                {editingViewDraft.boards.length === 0 && (
                  <Text xs className="text-red-500 mt-1">
                    Select at least one board
                  </Text>
                )}
              </div>

              {/* Board Order */}
              {editingViewDraft.boards.length > 1 && (
                <div>
                  <Flexbox direction="col" gap="1" className="mb-2">
                    <Text sm className="font-medium">
                      Board display order
                    </Text>
                    <Text xs className="text-text-secondary">
                      Drag to reorder how boards appear in this view
                    </Text>
                  </Flexbox>
                  <SortableList onDragEnd={handleDraftBoardsSortEnd} items={editingViewDraft.boards}>
                    <Flexbox direction="col" gap="2">
                      {editingViewDraft.boards.map((boardKey) => {
                        const boardName = availableBoards.find((b) => b.key === boardKey)?.name || boardKey;
                        return (
                          <SortableItem key={boardKey} id={boardKey}>
                            {({ handleProps }) => (
                              <div
                                {...handleProps}
                                className="flex items-center gap-2 p-2 bg-bg-accent rounded border border-border cursor-grab select-none"
                              >
                                <GrabberIcon size={16} className="text-text-secondary" />
                                <Text sm>{boardName}</Text>
                              </div>
                            )}
                          </SortableItem>
                        );
                      })}
                    </Flexbox>
                  </SortableList>
                </div>
              )}

              <Select
                label="Default display"
                value={editingViewDraft.displayView}
                setValue={(val) => updateDraft({ displayView: val as CubeDisplayView })}
                options={DISPLAY_VIEW_OPTIONS}
              />

              <div>
                <Text sm className="font-medium mb-2">
                  Default sorts
                </Text>
                <Flexbox direction="col" gap="2">
                  {[0, 1, 2, 3].map((sortIndex) => (
                    <Flexbox key={sortIndex} direction="row" gap="2" alignItems="center">
                      <Text xs className="w-20 text-text-secondary">
                        {['Primary', 'Secondary', 'Tertiary', 'Ordered'][sortIndex]}
                      </Text>
                      <div className="flex-1">
                        <Select
                          value={editingViewDraft.defaultSorts[sortIndex] || VIEW_DEFAULT_SORTS[sortIndex]}
                          setValue={(val) => {
                            const newSorts = [...editingViewDraft.defaultSorts];
                            newSorts[sortIndex] = val;
                            updateDraft({ defaultSorts: newSorts });
                          }}
                          options={(sortIndex < 3 ? allSorts : ORDERED_SORTS).map((s) => ({
                            value: s,
                            label: s,
                          }))}
                        />
                      </div>
                    </Flexbox>
                  ))}
                </Flexbox>
              </div>

              <Input
                label="Default filter (optional)"
                value={editingViewDraft.defaultFilter || ''}
                onChange={(e) => updateDraft({ defaultFilter: e.target.value || undefined })}
                placeholder="e.g., cmc<=3 or type:creature"
              />
            </Flexbox>
          </ModalBody>
        )}
        <ModalFooter>
          <Flexbox direction="row" gap="2" justify="end">
            <Button color="secondary" onClick={closeEditModal}>
              Cancel
            </Button>
            <Button color="primary" onClick={applyEditModal} disabled={editingViewDraft?.boards.length === 0}>
              Apply Changes
            </Button>
          </Flexbox>
        </ModalFooter>
      </Modal>

      {/* Hidden form for submission */}
      <div className="hidden">
        <CSRFForm
          method="POST"
          action={`/cube/updateboardsandviews/${cube.id}`}
          formData={{
            boards: JSON.stringify(boards),
            views: JSON.stringify(views),
          }}
          ref={formRef}
        />
      </div>
    </Flexbox>
  );
};

export default BoardsAndViewsSettings;
