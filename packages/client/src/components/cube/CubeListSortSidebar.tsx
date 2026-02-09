import React, { useContext, useMemo } from 'react';

import { QuestionIcon } from '@primer/octicons-react';
import { CUBE_DEFAULT_SORTS, ORDERED_SORTS, SORTS } from '@utils/sorting/Sort';

import Button from 'components/base/Button';
import Checkbox from 'components/base/Checkbox';
import { Flexbox } from 'components/base/Layout';
import Select from 'components/base/Select';
import Text from 'components/base/Text';
import Tooltip from 'components/base/Tooltip';
import RotisserieDraftModal from 'components/modals/RotisserieDraftModal';
import TagColorsModal from 'components/modals/TagColorsModal';
import withModal from 'components/WithModal';
import CubeContext from 'contexts/CubeContext';
import DisplayContext from 'contexts/DisplayContext';
import RotoDraftContext from 'contexts/RotoDraftContext';

const TagColorsModalButton = withModal(Button, TagColorsModal);
const RotoSetupButton = withModal(Button, RotisserieDraftModal);

interface CubeListSortSidebarProps {
  canEdit: boolean;
  isHorizontal?: boolean;
}

const CubeListSortSidebar: React.FC<CubeListSortSidebarProps> = ({ canEdit, isHorizontal = false }) => {
  const {
    cube,
    setShowUnsorted,
    setCollapseDuplicateCards,
    saveSorts,
    resetSorts,
    sortPrimary,
    sortSecondary,
    sortTertiary,
    sortQuaternary,
    setSortPrimary,
    setSortSecondary,
    setSortTertiary,
    setSortQuaternary,
  } = useContext(CubeContext);

  const {
    setRightSidebarMode: _setRightSidebarMode,
    showInlineTagEmojis,
    toggleShowInlineTagEmojis,
    showAllBoards,
    setShowAllBoards,
  } = useContext(DisplayContext);
  const { url: rotoURL, setUrl: setRotoURL } = useContext(RotoDraftContext);

  const sortsModified = useMemo(() => {
    return (
      sortPrimary !== ((cube.defaultSorts && cube.defaultSorts[0]) || CUBE_DEFAULT_SORTS[0]) ||
      sortSecondary !== ((cube.defaultSorts && cube.defaultSorts[1]) || CUBE_DEFAULT_SORTS[1]) ||
      sortTertiary !== ((cube.defaultSorts && cube.defaultSorts[2]) || CUBE_DEFAULT_SORTS[2]) ||
      sortQuaternary !== ((cube.defaultSorts && cube.defaultSorts[3]) || CUBE_DEFAULT_SORTS[3])
    );
  }, [sortPrimary, cube.defaultSorts, sortSecondary, sortTertiary, sortQuaternary]);

  return (
    <>
      {!isHorizontal ? (
        // Vertical layout for right sidebar
        <Flexbox direction="col" gap="3">
          <Select
            label="Primary Sort (columns)"
            value={sortPrimary || CUBE_DEFAULT_SORTS[0]}
            setValue={setSortPrimary}
            options={SORTS.map((sort) => ({ value: sort, label: sort }))}
          />

          <Select
            label="Secondary Sort (groups within columns)"
            value={sortSecondary || CUBE_DEFAULT_SORTS[1]}
            setValue={setSortSecondary}
            options={SORTS.map((sort) => ({ value: sort, label: sort }))}
          />

          <Select
            label="Tertiary Sort (rows within groups)"
            value={sortTertiary || CUBE_DEFAULT_SORTS[2]}
            setValue={setSortTertiary}
            options={SORTS.map((sort) => ({ value: sort, label: sort }))}
          />

          <Select
            label="Ordered Sort"
            value={sortQuaternary || CUBE_DEFAULT_SORTS[3]}
            setValue={setSortQuaternary}
            options={ORDERED_SORTS.map((sort) => ({ value: sort, label: sort }))}
          />

          <Text italic sm className="text-text-secondary">
            Cards will appear as duplicates if they fit in multiple categories. The counts will still only count each
            item once.
          </Text>

          <Flexbox direction="col" gap="2">
            <Button color="danger" onClick={resetSorts} disabled={!sortsModified} block>
              Reset Sort
            </Button>

            {canEdit && (
              <Button color="accent" onClick={saveSorts} disabled={!sortsModified} block>
                Save as Default Sort
              </Button>
            )}

            <TagColorsModalButton color="secondary" block>
              {canEdit ? 'Set Tag Colors' : 'View Tag Colors'}
            </TagColorsModalButton>

            {rotoURL ? (
              <Button color="secondary" onClick={() => setRotoURL('')} block>
                Clear Rotisserie Draft
              </Button>
            ) : (
              <RotoSetupButton color="secondary" block>
                Setup Rotisserie Draft
              </RotoSetupButton>
            )}
          </Flexbox>

          <Flexbox direction="col" gap="2">
            <Flexbox direction="row" gap="2" alignItems="center">
              <Checkbox label="Show Unsorted Cards" checked={cube.showUnsorted || false} setChecked={setShowUnsorted} />
              <Tooltip text="Creates a separate column for cards that would be hidden otherwise.">
                <QuestionIcon size={16} className="hidden md:inline" />
              </Tooltip>
            </Flexbox>
            <Flexbox direction="row" gap="2" alignItems="center">
              <Checkbox
                label="Collapse Duplicates"
                checked={cube.collapseDuplicateCards || false}
                setChecked={setCollapseDuplicateCards}
              />
              <Tooltip text="Collapses duplicate cards that appear in multiple categories into a single instance.">
                <QuestionIcon size={16} className="hidden md:inline" />
              </Tooltip>
            </Flexbox>
            <Flexbox direction="row" gap="2" alignItems="center">
              <Checkbox
                label="Show Inline Emojis"
                checked={showInlineTagEmojis}
                setChecked={toggleShowInlineTagEmojis}
              />
              <Tooltip text="Display emoji tags directly next to card names in the list view.">
                <QuestionIcon size={16} className="hidden md:inline" />
              </Tooltip>
            </Flexbox>
            <Flexbox direction="row" gap="2" alignItems="center">
              <Checkbox label="Show All Boards" checked={showAllBoards} setChecked={setShowAllBoards} />
              <Tooltip text="Display both mainboard and maybeboard at the same time.">
                <QuestionIcon size={16} className="hidden md:inline" />
              </Tooltip>
            </Flexbox>
          </Flexbox>
        </Flexbox>
      ) : (
        // Horizontal layout for bottom card - completely redesigned
        <div className="w-full">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Column 1: Sort Controls */}
            <div className="flex flex-col gap-3">
              <Text semibold sm>
                Sort Controls
              </Text>
              <Select
                label="Primary Sort"
                value={sortPrimary || CUBE_DEFAULT_SORTS[0]}
                setValue={setSortPrimary}
                options={SORTS.map((sort) => ({ value: sort, label: sort }))}
              />
              <Select
                label="Secondary Sort"
                value={sortSecondary || CUBE_DEFAULT_SORTS[1]}
                setValue={setSortSecondary}
                options={SORTS.map((sort) => ({ value: sort, label: sort }))}
              />
            </div>

            {/* Column 2: More Sort Controls */}
            <div className="flex flex-col gap-3">
              <Text semibold sm>
                Additional Sorts
              </Text>
              <Select
                label="Tertiary Sort"
                value={sortTertiary || CUBE_DEFAULT_SORTS[2]}
                setValue={setSortTertiary}
                options={SORTS.map((sort) => ({ value: sort, label: sort }))}
              />
              <Select
                label="Ordered Sort"
                value={sortQuaternary || CUBE_DEFAULT_SORTS[3]}
                setValue={setSortQuaternary}
                options={ORDERED_SORTS.map((sort) => ({ value: sort, label: sort }))}
              />
            </div>

            {/* Column 3: Display Options */}
            <div className="flex flex-col gap-2">
              <Text semibold sm>
                Display Options
              </Text>
              <Flexbox direction="row" gap="2" alignItems="center">
                <Checkbox label="Show Unsorted" checked={cube.showUnsorted || false} setChecked={setShowUnsorted} />
                <Tooltip text="Creates a separate column for cards that would be hidden otherwise.">
                  <QuestionIcon size={16} />
                </Tooltip>
              </Flexbox>
              <Flexbox direction="row" gap="2" alignItems="center">
                <Checkbox
                  label="Collapse Duplicates"
                  checked={cube.collapseDuplicateCards || false}
                  setChecked={setCollapseDuplicateCards}
                />
                <Tooltip text="Collapses duplicate cards that appear in multiple categories into a single instance.">
                  <QuestionIcon size={16} />
                </Tooltip>
              </Flexbox>
              <Flexbox direction="row" gap="2" alignItems="center">
                <Checkbox
                  label="Show Inline Emojis"
                  checked={showInlineTagEmojis}
                  setChecked={toggleShowInlineTagEmojis}
                />
                <Tooltip text="Display emoji tags directly next to card names in the list view.">
                  <QuestionIcon size={16} />
                </Tooltip>
              </Flexbox>
              <Flexbox direction="row" gap="2" alignItems="center">
                <Checkbox label="Show All Boards" checked={showAllBoards} setChecked={setShowAllBoards} />
                <Tooltip text="Display both mainboard and maybeboard at the same time.">
                  <QuestionIcon size={16} />
                </Tooltip>
              </Flexbox>
            </div>

            {/* Column 4: Actions */}
            <div className="flex flex-col gap-2">
              <Text semibold sm>
                Actions
              </Text>
              <Button color="danger" onClick={resetSorts} disabled={!sortsModified} block>
                Reset Sort
              </Button>
              {canEdit && (
                <Button color="accent" onClick={saveSorts} disabled={!sortsModified} block>
                  Save as Default
                </Button>
              )}
              <TagColorsModalButton color="secondary" block>
                {canEdit ? 'Set Tag Colors' : 'View Tag Colors'}
              </TagColorsModalButton>
              {rotoURL ? (
                <Button color="secondary" onClick={() => setRotoURL('')} block>
                  Clear Rotisserie
                </Button>
              ) : (
                <RotoSetupButton color="secondary" block>
                  Setup Rotisserie
                </RotoSetupButton>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default CubeListSortSidebar;
