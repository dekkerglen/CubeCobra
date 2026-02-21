import React, { useCallback, useContext, useMemo, useState } from 'react';

import { GrabberIcon, PlusIcon, TrashIcon } from '@primer/octicons-react';
import {
  boardNameToKey,
  CubeDisplayView,
  DEFAULT_VIEWS,
  getBoardDefinitions,
  MAX_VIEWS,
  validateViewDefinitions,
  VIEW_DEFAULT_SORTS,
  ViewDefinition,
} from '@utils/datatypes/Cube';
import { getAllSorts, ORDERED_SORTS } from '@utils/sorting/Sort';

import Button from 'components/base/Button';
import Input from 'components/base/Input';
import { Flexbox } from 'components/base/Layout';
import { Modal, ModalBody, ModalFooter, ModalHeader } from 'components/base/Modal';
import Select from 'components/base/Select';
import Text from 'components/base/Text';
import { SortableItem, SortableList } from 'components/DND';
import LoadingButton from 'components/LoadingButton';
import { CSRFContext } from 'contexts/CSRFContext';
import CubeContext from 'contexts/CubeContext';

interface ViewSettingsModalProps {
  isOpen: boolean;
  setOpen: (open: boolean) => void;
}

const DISPLAY_VIEW_OPTIONS: { value: CubeDisplayView; label: string }[] = [
  { value: 'table', label: 'Table' },
  { value: 'spoiler', label: 'Visual Spoiler' },
  { value: 'curve', label: 'Curve' },
  { value: 'stacks', label: 'Stacks' },
];

interface ViewRowProps {
  view: ViewDefinition;
  index: number;
  availableBoards: { key: string; name: string }[];
  allSorts: string[];
  onUpdate: (index: number, updates: Partial<ViewDefinition>) => void;
  onRemove: (index: number) => void;
  canRemove: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
}

const ViewRow: React.FC<ViewRowProps> = ({
  view,
  index,
  availableBoards,
  allSorts,
  onUpdate,
  onRemove,
  canRemove,
  isExpanded,
  onToggleExpand,
}) => {
  /* Prevent drag from starting when interacting with form elements */
  const preventDragStart = (event: React.PointerEvent) => {
    event.stopPropagation();
  };

  const toggleBoard = (boardKey: string) => {
    const newBoards = view.boards.includes(boardKey)
      ? view.boards.filter((b) => b !== boardKey)
      : [...view.boards, boardKey];
    onUpdate(index, { boards: newBoards });
  };

  return (
    <SortableItem id={view.name || `view-${index}`} className="no-touch-action">
      {({ handleProps }) => (
        <div className="rounded-md border border-border p-3 transition-colors hover:border-border-active">
          <Flexbox direction="row" gap="2" alignItems="center">
            <div {...handleProps}>
              <GrabberIcon size={16} className="cursor-grab text-text-secondary flex-shrink-0" />
            </div>
            <div className="flex-1" onPointerDown={preventDragStart}>
              <Input
                value={view.name}
                onChange={(e) => onUpdate(index, { name: e.target.value })}
                onBlur={(e) => onUpdate(index, { name: e.target.value.trim() })}
                placeholder="View name"
              />
            </div>
            <div onPointerDown={preventDragStart}>
              <Button color="secondary" onClick={onToggleExpand}>
                {isExpanded ? 'Collapse' : 'Configure'}
              </Button>
            </div>
            <div title={!canRemove ? 'Must have at least one view' : undefined} onPointerDown={preventDragStart}>
              <Button color="danger" onClick={() => onRemove(index)} disabled={!canRemove} aria-label="Remove view">
                <TrashIcon size={16} />
              </Button>
            </div>
          </Flexbox>

          {isExpanded && (
            <div className="mt-3 pt-3 border-t border-border" onPointerDown={preventDragStart}>
              <Flexbox direction="col" gap="3">
                {/* Boards selection */}
                <div>
                  <Text sm className="font-medium mb-2">
                    Boards to display
                  </Text>
                  <Flexbox direction="row" gap="2" wrap="wrap">
                    {availableBoards.map((board) => (
                      <button
                        key={board.key}
                        type="button"
                        onClick={() => toggleBoard(board.key)}
                        className={`px-3 py-1 rounded-md text-sm transition-colors ${
                          view.boards.includes(board.key)
                            ? 'bg-bg-active text-text font-medium border border-border-active'
                            : 'bg-bg-secondary text-text-secondary border border-border hover:border-border-active'
                        }`}
                      >
                        {board.name}
                      </button>
                    ))}
                  </Flexbox>
                  {view.boards.length === 0 && (
                    <Text xs className="text-red-500 mt-1">
                      Select at least one board
                    </Text>
                  )}
                </div>

                {/* Display view */}
                <div>
                  <Text sm className="font-medium mb-2">
                    Default display
                  </Text>
                  <Select
                    value={view.displayView}
                    setValue={(val) => onUpdate(index, { displayView: val as CubeDisplayView })}
                    options={DISPLAY_VIEW_OPTIONS}
                  />
                </div>

                {/* Default sorts */}
                <div>
                  <Text sm className="font-medium mb-2">
                    Default sorts
                  </Text>
                  <Flexbox direction="col" gap="1">
                    {[0, 1, 2, 3].map((sortIndex) => (
                      <Flexbox key={sortIndex} direction="row" gap="2" alignItems="center">
                        <Text xs className="w-20 text-text-secondary">
                          {['Primary', 'Secondary', 'Tertiary', 'Ordered'][sortIndex]}
                        </Text>
                        <div className="flex-1">
                          <Select
                            value={view.defaultSorts[sortIndex] || VIEW_DEFAULT_SORTS[sortIndex]}
                            setValue={(val) => {
                              const newSorts = [...view.defaultSorts];
                              newSorts[sortIndex] = val;
                              onUpdate(index, { defaultSorts: newSorts });
                            }}
                            options={(sortIndex < 3 ? allSorts : ORDERED_SORTS).map((s) => ({ value: s, label: s }))}
                          />
                        </div>
                      </Flexbox>
                    ))}
                  </Flexbox>
                </div>

                {/* Default filter */}
                <div>
                  <Text sm className="font-medium mb-2">
                    Default filter (optional)
                  </Text>
                  <Input
                    value={view.defaultFilter || ''}
                    onChange={(e) => onUpdate(index, { defaultFilter: e.target.value || undefined })}
                    placeholder="e.g., cmc<=3 or type:creature"
                  />
                </div>
              </Flexbox>
            </div>
          )}
        </div>
      )}
    </SortableItem>
  );
};

const ViewSettingsModal: React.FC<ViewSettingsModalProps> = ({ isOpen, setOpen }) => {
  const { cube, unfilteredChangedCards, setCube } = useContext(CubeContext);
  const { csrfFetch } = useContext(CSRFContext);
  const [loading, setLoading] = useState(false);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  // Get all available sorts including custom sorts
  const allSorts = useMemo(() => getAllSorts(cube), [cube]);

  // Get available boards from the cube
  const availableBoards = useMemo(() => {
    const boards = getBoardDefinitions(cube, unfilteredChangedCards);
    return boards.map((b) => ({
      key: boardNameToKey(b.name),
      name: b.name,
    }));
  }, [cube, unfilteredChangedCards]);

  // Initialize with current views or defaults
  const getInitialViews = useCallback((): ViewDefinition[] => {
    if (cube.views && cube.views.length > 0) {
      return cube.views.map((v) => {
        // Ensure defaultSorts always has exactly 4 elements
        const defaultSorts = [...v.defaultSorts];
        while (defaultSorts.length < 4) {
          defaultSorts.push(VIEW_DEFAULT_SORTS[defaultSorts.length]);
        }
        return {
          ...v,
          boards: [...v.boards],
          defaultSorts,
        };
      });
    }

    // Create default views based on cube's defaultSorts
    const cubeSorts = cube.defaultSorts || [...VIEW_DEFAULT_SORTS];
    return DEFAULT_VIEWS.map((v) => ({
      ...v,
      boards: [...v.boards],
      defaultSorts: [...cubeSorts],
    }));
  }, [cube.views, cube.defaultSorts]);

  const [views, setViews] = useState<ViewDefinition[]>(getInitialViews);
  const [error, setError] = useState<string>('');

  const addView = () => {
    if (views.length >= MAX_VIEWS) {
      setError(`Cannot add more than ${MAX_VIEWS} views`);
      return;
    }
    const newView: ViewDefinition = {
      name: '',
      boards: availableBoards.length > 0 ? [availableBoards[0].key] : [],
      displayView: 'table',
      defaultSorts: [...VIEW_DEFAULT_SORTS],
    };
    setViews([...views, newView]);
    setExpandedIndex(views.length); // Expand the new view
    setError('');
  };

  const removeView = (index: number) => {
    if (views.length <= 1) {
      setError('Must have at least one view');
      return;
    }
    const newViews = views.filter((_, i) => i !== index);
    setViews(newViews);
    if (expandedIndex === index) {
      setExpandedIndex(null);
    } else if (expandedIndex !== null && expandedIndex > index) {
      setExpandedIndex(expandedIndex - 1);
    }
    setError('');
  };

  const updateView = (index: number, updates: Partial<ViewDefinition>) => {
    const newViews = [...views];
    newViews[index] = { ...newViews[index], ...updates };
    setViews(newViews);
    setError('');
  };

  const handleSortEnd = useCallback(
    (event: any) => {
      const { active, over } = event;

      if (!over) {
        return;
      }

      if (active.id !== over.id) {
        const newViews = [...views];
        const oldIndex = views.findIndex((v) => (v.name || `view-${views.indexOf(v)}`) === active.id);
        const newIndex = views.findIndex((v) => (v.name || `view-${views.indexOf(v)}`) === over.id);

        const [removed] = newViews.splice(oldIndex, 1);
        newViews.splice(newIndex, 0, removed);

        setViews(newViews);

        // Update expanded index if needed
        if (expandedIndex === oldIndex) {
          setExpandedIndex(newIndex);
        } else if (expandedIndex !== null) {
          if (oldIndex < expandedIndex && newIndex >= expandedIndex) {
            setExpandedIndex(expandedIndex - 1);
          } else if (oldIndex > expandedIndex && newIndex <= expandedIndex) {
            setExpandedIndex(expandedIndex + 1);
          }
        }
      }
    },
    [views, expandedIndex],
  );

  const handleSave = async () => {
    const validation = validateViewDefinitions(views);
    if (!validation.valid) {
      setError(validation.error || 'Invalid view configuration');
      return;
    }

    setLoading(true);
    try {
      const response = await csrfFetch(`/cube/updateviews/${cube.id}`, {
        method: 'POST',
        body: JSON.stringify({ views }),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        // Update the cube context with new views
        setCube((prev) => ({ ...prev, views: data.views }));
        setOpen(false);
      } else {
        const data = await response.json();
        setError(data.message || 'Failed to save view settings');
      }
    } catch (err) {
      setError('Failed to save view settings: ' + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  // Reset state when modal opens
  React.useEffect(() => {
    if (isOpen) {
      setViews(getInitialViews());
      setError('');
      setExpandedIndex(null);
    }
  }, [isOpen, getInitialViews]);

  return (
    <Modal isOpen={isOpen} setOpen={setOpen} lg>
      <ModalHeader setOpen={setOpen}>
        <Text semibold lg>
          Customize Views
        </Text>
      </ModalHeader>
      <ModalBody>
        <Flexbox direction="col" gap="3">
          <Text sm className="text-text-secondary">
            Configure how you want to view your cube. Each view can show different boards with its own display settings,
            sorts, and filters.
          </Text>

          {error && (
            <div className="rounded-md bg-red-50 dark:bg-red-900/20 p-3 border border-red-200 dark:border-red-800">
              <Text sm className="text-red-800 dark:text-red-200">
                {error}
              </Text>
            </div>
          )}

          <SortableList onDragEnd={handleSortEnd} items={views.map((v, i) => v.name || `view-${i}`)}>
            <Flexbox direction="col" gap="2">
              {views.map((view, index) => (
                <ViewRow
                  key={index}
                  view={view}
                  index={index}
                  availableBoards={availableBoards}
                  allSorts={allSorts}
                  onUpdate={updateView}
                  onRemove={removeView}
                  canRemove={views.length > 1}
                  isExpanded={expandedIndex === index}
                  onToggleExpand={() => setExpandedIndex(expandedIndex === index ? null : index)}
                />
              ))}
            </Flexbox>
          </SortableList>

          <Button color="accent" onClick={addView} disabled={views.length >= MAX_VIEWS} block>
            <Flexbox direction="row" gap="1" alignItems="center" justify="center">
              <PlusIcon size={16} />
              <span>Add View</span>
            </Flexbox>
          </Button>

          {views.length >= MAX_VIEWS && (
            <Text xs className="text-text-secondary text-center">
              Maximum number of views ({MAX_VIEWS}) reached
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

export default ViewSettingsModal;
