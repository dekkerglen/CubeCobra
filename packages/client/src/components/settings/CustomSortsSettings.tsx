import React, { useCallback, useContext, useEffect, useState } from 'react';

import { GrabberIcon, PlusIcon, TrashIcon } from '@primer/octicons-react';
import { CustomSort, CustomSortCategory } from '@utils/datatypes/Cube';

import Alert from 'components/base/Alert';
import Button from 'components/base/Button';
import { Card, CardBody, CardHeader } from 'components/base/Card';
import Checkbox from 'components/base/Checkbox';
import Input from 'components/base/Input';
import { Flexbox } from 'components/base/Layout';
import Link from 'components/base/Link';
import Text from 'components/base/Text';
import { SortableItem, SortableList } from 'components/DND';
import LoadingButton from 'components/LoadingButton';
import { CSRFContext } from 'contexts/CSRFContext';
import CubeContext from 'contexts/CubeContext';

interface CategoryRowProps {
  category: CustomSortCategory;
  sortIndex: number;
  categoryIndex: number;
  onUpdate: (sortIndex: number, categoryIndex: number, updates: Partial<CustomSortCategory>) => void;
  onRemove: (sortIndex: number, categoryIndex: number) => void;
  canRemove: boolean;
}

const CategoryRow: React.FC<CategoryRowProps> = ({
  category,
  sortIndex,
  categoryIndex,
  onUpdate,
  onRemove,
  canRemove,
}) => {
  const preventDragStart = (event: React.PointerEvent) => {
    event.stopPropagation();
  };

  return (
    <SortableItem id={`${sortIndex}-${categoryIndex}`} className="no-touch-action">
      {({ handleProps }) => (
        <div className="rounded-md border border-border p-2 transition-colors hover:border-border-active bg-bg">
          <Flexbox direction="row" gap="2" alignItems="center">
            <div {...handleProps}>
              <GrabberIcon size={16} className="cursor-grab text-text-secondary flex-shrink-0" />
            </div>
            <div className="flex-1" onPointerDown={preventDragStart}>
              <Input
                value={category.label}
                onChange={(e) => onUpdate(sortIndex, categoryIndex, { label: e.target.value })}
                placeholder="Category name"
              />
            </div>
            <div className="flex-1" onPointerDown={preventDragStart}>
              <Input
                value={category.filter}
                onChange={(e) => onUpdate(sortIndex, categoryIndex, { filter: e.target.value })}
                placeholder="e.g., cmc<=3 or type:creature"
              />
            </div>
            <div title={!canRemove ? 'Must have at least one category' : undefined} onPointerDown={preventDragStart}>
              <Button
                color="danger"
                onClick={() => onRemove(sortIndex, categoryIndex)}
                disabled={!canRemove}
                aria-label="Remove category"
              >
                <TrashIcon size={16} />
              </Button>
            </div>
          </Flexbox>
        </div>
      )}
    </SortableItem>
  );
};

interface SortRowProps {
  sort: CustomSort;
  index: number;
  onUpdate: (index: number, updates: Partial<CustomSort>) => void;
  onRemove: (index: number) => void;
  canRemove: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onCategoryUpdate: (sortIndex: number, categoryIndex: number, updates: Partial<CustomSortCategory>) => void;
  onCategoryRemove: (sortIndex: number, categoryIndex: number) => void;
  onCategoryAdd: (sortIndex: number) => void;
  onCategoryReorder: (sortIndex: number, oldIndex: number, newIndex: number) => void;
}

const SortRow: React.FC<SortRowProps> = ({
  sort,
  index,
  onUpdate,
  onRemove,
  canRemove,
  isExpanded,
  onToggleExpand,
  onCategoryUpdate,
  onCategoryRemove,
  onCategoryAdd,
  onCategoryReorder,
}) => {
  const preventDragStart = (event: React.PointerEvent) => {
    event.stopPropagation();
  };

  const handleCategorySortEnd = useCallback(
    (event: any) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = sort.categories.findIndex((_, i) => `${index}-${i}` === active.id);
      const newIndex = sort.categories.findIndex((_, i) => `${index}-${i}` === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        onCategoryReorder(index, oldIndex, newIndex);
      }
    },
    [sort.categories, index, onCategoryReorder],
  );

  return (
    <SortableItem id={`sort-${index}`} className="no-touch-action">
      {({ handleProps }) => (
        <div className="rounded-md border border-border p-3 transition-colors hover:border-border-active">
          <Flexbox direction="row" gap="2" alignItems="center">
            <div {...handleProps}>
              <GrabberIcon size={16} className="cursor-grab text-text-secondary flex-shrink-0" />
            </div>
            <div className="flex-1" onPointerDown={preventDragStart}>
              <Input
                value={sort.name}
                onChange={(e) => onUpdate(index, { name: e.target.value })}
                placeholder="Sort name"
              />
            </div>
            <div onPointerDown={preventDragStart}>
              <Button color="secondary" onClick={onToggleExpand}>
                {isExpanded ? 'Collapse' : 'Configure'}
              </Button>
            </div>
            <div title={!canRemove ? 'Must have at least one sort' : undefined} onPointerDown={preventDragStart}>
              <Button color="danger" onClick={() => onRemove(index)} disabled={!canRemove} aria-label="Remove sort">
                <TrashIcon size={16} />
              </Button>
            </div>
          </Flexbox>

          {isExpanded && (
            <div className="mt-3 pl-6" onPointerDown={preventDragStart}>
              <Flexbox direction="col" gap="3">
                <div>
                  <Checkbox
                    label="Match cards to first category only"
                    checked={sort.matchFirstOnly}
                    setChecked={(checked) => onUpdate(index, { matchFirstOnly: checked })}
                  />
                  <Text xs className="text-text-secondary mt-1">
                    When enabled, each card appears only in the first matching category. When disabled, cards appear in
                    all matching categories.
                  </Text>
                </div>

                <div>
                  <Flexbox direction="row" justify="between" alignItems="center" className="mb-2">
                    <Text semibold sm>
                      Categories
                    </Text>
                    <Text xs className="text-text-secondary">
                      Order matters for display and matching
                    </Text>
                  </Flexbox>

                  <Flexbox direction="col" gap="2" className="mb-2">
                    <Flexbox direction="row" gap="2" alignItems="center" className="px-2">
                      <div className="w-4" />
                      <div className="flex-1">
                        <Text xs className="text-text-secondary">
                          Category Label
                        </Text>
                      </div>
                      <div className="flex-1">
                        <Flexbox direction="row" gap="1" alignItems="center">
                          <Text xs className="text-text-secondary">
                            Filter Syntax
                          </Text>
                          <Link href="/filters" target="_blank" className="text-link text-xs">
                            (syntax guide)
                          </Link>
                        </Flexbox>
                      </div>
                      <div className="w-8" />
                    </Flexbox>
                  </Flexbox>

                  <SortableList
                    onDragEnd={handleCategorySortEnd}
                    items={sort.categories.map((_, i) => `${index}-${i}`)}
                  >
                    <Flexbox direction="col" gap="2">
                      {sort.categories.map((category, catIndex) => (
                        <CategoryRow
                          key={catIndex}
                          category={category}
                          sortIndex={index}
                          categoryIndex={catIndex}
                          onUpdate={onCategoryUpdate}
                          onRemove={onCategoryRemove}
                          canRemove={sort.categories.length > 1}
                        />
                      ))}
                    </Flexbox>
                  </SortableList>

                  <Button color="secondary" onClick={() => onCategoryAdd(index)} block className="mt-2">
                    <PlusIcon size={16} className="inline mr-1" />
                    Add Category
                  </Button>
                </div>
              </Flexbox>
            </div>
          )}
        </div>
      )}
    </SortableItem>
  );
};

const CustomSortsSettings: React.FC = () => {
  const { cube } = useContext(CubeContext);
  const { csrfFetch } = useContext(CSRFContext);
  const [loading, setLoading] = useState(false);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [error, setError] = useState<string>('');
  const [hasChanges, setHasChanges] = useState(false);

  const getInitialSorts = useCallback((): CustomSort[] => {
    if (cube.customSorts && cube.customSorts.length > 0) {
      return cube.customSorts.map((s) => ({
        ...s,
        categories: s.categories.map((c) => ({ ...c })),
      }));
    }
    return [];
  }, [cube.customSorts]);

  const [customSorts, setCustomSorts] = useState<CustomSort[]>(getInitialSorts);

  // Detect changes
  useEffect(() => {
    const changed = JSON.stringify(customSorts) !== JSON.stringify(getInitialSorts());
    setHasChanges(changed);
  }, [customSorts, getInitialSorts]);

  const addSort = () => {
    const newSort: CustomSort = {
      name: '',
      categories: [{ label: '', filter: '' }],
      matchFirstOnly: false,
    };
    setCustomSorts([...customSorts, newSort]);
    setExpandedIndex(customSorts.length);
    setError('');
  };

  const removeSort = (index: number) => {
    const newSorts = customSorts.filter((_, i) => i !== index);
    setCustomSorts(newSorts);
    if (expandedIndex === index) {
      setExpandedIndex(null);
    } else if (expandedIndex !== null && expandedIndex > index) {
      setExpandedIndex(expandedIndex - 1);
    }
    setError('');
  };

  const updateSort = (index: number, updates: Partial<CustomSort>) => {
    const newSorts = [...customSorts];
    newSorts[index] = { ...newSorts[index], ...updates };
    setCustomSorts(newSorts);
    setError('');
  };

  const addCategory = (sortIndex: number) => {
    const newSorts = [...customSorts];
    newSorts[sortIndex].categories.push({ label: '', filter: '' });
    setCustomSorts(newSorts);
  };

  const removeCategory = (sortIndex: number, categoryIndex: number) => {
    const newSorts = [...customSorts];
    newSorts[sortIndex].categories = newSorts[sortIndex].categories.filter((_, i) => i !== categoryIndex);
    setCustomSorts(newSorts);
  };

  const updateCategory = (sortIndex: number, categoryIndex: number, updates: Partial<CustomSortCategory>) => {
    const newSorts = [...customSorts];
    newSorts[sortIndex].categories[categoryIndex] = {
      ...newSorts[sortIndex].categories[categoryIndex],
      ...updates,
    };
    setCustomSorts(newSorts);
  };

  const reorderCategories = (sortIndex: number, oldIndex: number, newIndex: number) => {
    const newSorts = [...customSorts];
    const categories = [...newSorts[sortIndex].categories];
    const [moved] = categories.splice(oldIndex, 1);
    categories.splice(newIndex, 0, moved);
    newSorts[sortIndex].categories = categories;
    setCustomSorts(newSorts);
  };

  const handleSortEnd = useCallback(
    (event: any) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = customSorts.findIndex((_, i) => `sort-${i}` === active.id);
      const newIndex = customSorts.findIndex((_, i) => `sort-${i}` === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        const newSorts = [...customSorts];
        const [moved] = newSorts.splice(oldIndex, 1);
        newSorts.splice(newIndex, 0, moved);
        setCustomSorts(newSorts);

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
    [customSorts, expandedIndex],
  );

  const validateSorts = (): string | null => {
    const emptyNameSort = customSorts.find((s) => !s.name.trim());
    if (emptyNameSort) {
      return 'All sorts must have a name';
    }

    const names = customSorts.map((s) => s.name.trim().toLowerCase());
    const uniqueNames = new Set(names);
    if (names.length !== uniqueNames.size) {
      return 'Sort names must be unique';
    }

    for (const sort of customSorts) {
      const emptyLabel = sort.categories.find((c) => !c.label.trim());
      if (emptyLabel) {
        return `Sort "${sort.name}" has a category with an empty label`;
      }
    }

    return null;
  };

  const handleSave = async () => {
    const validationError = validateSorts();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await csrfFetch(`/cube/api/customsorts/${cube.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customSorts,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        // Reload page to reflect changes
        window.location.href = `/cube/settings/${cube.id}?view=custom-sorts`;
      } else {
        setError(data.message || 'Failed to save custom sorts');
      }
    } catch (err) {
      setError(`An error occurred while saving: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const resetChanges = () => {
    setCustomSorts(getInitialSorts());
    setError('');
    setExpandedIndex(null);
  };

  return (
    <Flexbox direction="col" gap="3">
      {error && <Alert color="danger">{error}</Alert>}

      <Card>
        <CardHeader>
          <Flexbox direction="row" justify="between" alignItems="center">
            <Text semibold lg>
              Custom Sorts
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
          <Flexbox direction="col" gap="3">
            <Text sm className="text-text-secondary">
              Create custom sorts to organize your cube cards into categories. Each sort can have multiple categories
              with filter syntax to match cards. Use these custom sorts anywhere you can select a sort option.
            </Text>

            {customSorts.length > 0 ? (
              <SortableList onDragEnd={handleSortEnd} items={customSorts.map((_, i) => `sort-${i}`)}>
                <Flexbox direction="col" gap="2">
                  {customSorts.map((sort, index) => (
                    <SortRow
                      key={index}
                      sort={sort}
                      index={index}
                      onUpdate={updateSort}
                      onRemove={removeSort}
                      canRemove={customSorts.length > 0}
                      isExpanded={expandedIndex === index}
                      onToggleExpand={() => setExpandedIndex(expandedIndex === index ? null : index)}
                      onCategoryUpdate={updateCategory}
                      onCategoryRemove={removeCategory}
                      onCategoryAdd={addCategory}
                      onCategoryReorder={reorderCategories}
                    />
                  ))}
                </Flexbox>
              </SortableList>
            ) : (
              <div className="rounded-md bg-bg-active p-6 text-center">
                <Text sm className="text-text-secondary">
                  No custom sorts yet. Click "Add Sort" to create your first custom sort.
                </Text>
              </div>
            )}

            <Button color="secondary" onClick={addSort} block>
              <PlusIcon size={16} className="inline mr-1" />
              Add Sort
            </Button>
          </Flexbox>
        </CardBody>
      </Card>
    </Flexbox>
  );
};

export default CustomSortsSettings;
