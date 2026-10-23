import React, { useCallback, useContext, useMemo } from 'react';

import { QuestionIcon } from '@primer/octicons-react';
import { CubeDisplayOptions } from '@utils/datatypes/Cube';
import { CUBE_DEFAULT_SORTS, getAllSorts, ORDERED_SORTS } from '@utils/sorting/Sort';

import Button from 'components/base/Button';
import Checkbox from 'components/base/Checkbox';
import { Flexbox } from 'components/base/Layout';
import Link from 'components/base/Link';
import Select from 'components/base/Select';
import Text from 'components/base/Text';
import Tooltip from 'components/base/Tooltip';
import RotisserieDraftModal from 'components/modals/RotisserieDraftModal';
import TagColorsModal from 'components/modals/TagColorsModal';
import withModal from 'components/WithModal';
import CubeContext from 'contexts/CubeContext';
import DisplayContext from 'contexts/DisplayContext';
import RotoDraftContext from 'contexts/RotoDraftContext';
import useAlerts, { Alerts } from 'hooks/UseAlerts';

const TagColorsModalButton = withModal(Button, TagColorsModal);
const RotoSetupButton = withModal(Button, RotisserieDraftModal);

const DISPLAY_OPTION_CONTROLS: { key: keyof CubeDisplayOptions; label: string; tooltip: string }[] = [
  {
    key: 'showUnsorted',
    label: 'Show Unsorted Cards',
    tooltip: 'Creates a separate column for cards that would be hidden otherwise.',
  },
  {
    key: 'collapseDuplicateCards',
    label: 'Collapse Duplicates',
    tooltip: 'Collapses duplicate cards that appear in multiple categories into a single instance.',
  },
  {
    key: 'showInlineTagEmojis',
    label: 'Show Inline Emojis',
    tooltip: 'Display emoji tags directly next to card names in the list view.',
  },
  {
    key: 'showTagQuickFilters',
    label: 'Show Tag Quick Filters',
    tooltip: "Show a row of buttons for this cube's emoji tags below the filter bar. Clicking one filters to that tag.",
  },
  {
    key: 'showAllBoards',
    label: 'Show All Boards',
    tooltip: "Display all boards at the same time, regardless of the current view's board selection.",
  },
  {
    key: 'useBaseCardData',
    label: 'Use Base Card Data',
    tooltip:
      "Sort and filter using a card's original printed attributes, ignoring any overrides you've set (e.g. custom CMC, colors, type).",
  },
  {
    key: 'showTagColors',
    label: 'Show Tag Colors',
    tooltip: 'Color card rows by their highest-priority tag color.',
  },
];

interface DisplayOptionsControlsProps {
  canEdit: boolean;
  tooltipIconClassName?: string;
}

const DisplayOptionsControls: React.FC<DisplayOptionsControlsProps> = ({ canEdit, tooltipIconClassName }) => {
  const { displayOptions, setDisplayOption, displayOptionsModified, resetDisplayOptions, saveDisplayOptions } =
    useContext(DisplayContext);
  const { alerts, addAlert, dismissAlerts } = useAlerts();

  const handleSave = useCallback(async () => {
    dismissAlerts();
    if (!(await saveDisplayOptions())) {
      addAlert('danger', "Couldn't save the default display options. Please make sure you're logged in and try again.");
    }
  }, [saveDisplayOptions, addAlert, dismissAlerts]);

  return (
    <Flexbox direction="col" gap="2">
      {DISPLAY_OPTION_CONTROLS.map(({ key, label, tooltip }) => (
        <Flexbox key={key} direction="row" gap="2" alignItems="center">
          <Checkbox label={label} checked={displayOptions[key]} setChecked={(value) => setDisplayOption(key, value)} />
          <Tooltip text={tooltip}>
            <QuestionIcon size={16} className={tooltipIconClassName} />
          </Tooltip>
        </Flexbox>
      ))}
      <Alerts alerts={alerts} />
      {canEdit && (
        <Button color="primary" onClick={handleSave} disabled={!displayOptionsModified} block>
          Save as Default Display
        </Button>
      )}
      <Button color="danger" onClick={resetDisplayOptions} disabled={!displayOptionsModified} block>
        Reset Display
      </Button>
    </Flexbox>
  );
};

interface CubeListSortSidebarProps {
  canEdit: boolean;
  isHorizontal?: boolean;
}

const CubeListSortSidebar: React.FC<CubeListSortSidebarProps> = ({ canEdit, isHorizontal = false }) => {
  const {
    cube,
    resetSorts,
    saveSorts,
    effectiveDefaultSorts,
    sortPrimary,
    sortSecondary,
    sortTertiary,
    sortQuaternary,
    setSortPrimary,
    setSortSecondary,
    setSortTertiary,
    setSortQuaternary,
  } = useContext(CubeContext);

  const { url: rotoURL, setUrl: setRotoURL } = useContext(RotoDraftContext);

  const sortsModified = useMemo(() => {
    return (
      sortPrimary !== (effectiveDefaultSorts[0] || CUBE_DEFAULT_SORTS[0]) ||
      sortSecondary !== (effectiveDefaultSorts[1] || CUBE_DEFAULT_SORTS[1]) ||
      sortTertiary !== (effectiveDefaultSorts[2] || CUBE_DEFAULT_SORTS[2]) ||
      sortQuaternary !== (effectiveDefaultSorts[3] || CUBE_DEFAULT_SORTS[3])
    );
  }, [sortPrimary, effectiveDefaultSorts, sortSecondary, sortTertiary, sortQuaternary]);

  const allSorts = useMemo(() => getAllSorts(cube), [cube]);

  const { alerts, addAlert, dismissAlerts } = useAlerts();
  const handleSaveSorts = useCallback(async () => {
    dismissAlerts();
    if (!(await saveSorts())) {
      addAlert('danger', "Couldn't save the default sort. Please make sure you're logged in and try again.");
    }
  }, [saveSorts, addAlert, dismissAlerts]);

  return (
    <>
      {!isHorizontal ? (
        // Vertical layout for right sidebar
        <Flexbox direction="col" gap="3">
          <Select
            label="Primary Sort (columns)"
            value={sortPrimary || CUBE_DEFAULT_SORTS[0]}
            setValue={setSortPrimary}
            options={allSorts.map((sort) => ({ value: sort, label: sort }))}
          />

          <Select
            label="Secondary Sort (groups within columns)"
            value={sortSecondary || CUBE_DEFAULT_SORTS[1]}
            setValue={setSortSecondary}
            options={allSorts.map((sort) => ({ value: sort, label: sort }))}
          />

          <Select
            label="Tertiary Sort (rows within groups)"
            value={sortTertiary || CUBE_DEFAULT_SORTS[2]}
            setValue={setSortTertiary}
            options={allSorts.map((sort) => ({ value: sort, label: sort }))}
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
            <Alerts alerts={alerts} />
            {canEdit && (
              <Button color="primary" onClick={handleSaveSorts} disabled={!sortsModified} block>
                Save as Default Sort
              </Button>
            )}
            <Button color="danger" onClick={resetSorts} disabled={!sortsModified} block>
              Reset Sort
            </Button>

            {canEdit && (
              <TagColorsModalButton color="secondary" block>
                Set Tag Colors
              </TagColorsModalButton>
            )}

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

          <DisplayOptionsControls canEdit={canEdit} tooltipIconClassName="hidden md:inline" />

          {canEdit && (
            <div className="pt-3 mt-2 border-t border-border">
              <Text sm className="text-text-secondary">
                Looking for more ways to customize how your cube is displayed? Customize the boards and views{' '}
                <Link href={`/cube/settings/${cube.id}?view=boards-and-views`}>here</Link>.
              </Text>
            </div>
          )}
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
                options={allSorts.map((sort) => ({ value: sort, label: sort }))}
              />
              <Select
                label="Secondary Sort"
                value={sortSecondary || CUBE_DEFAULT_SORTS[1]}
                setValue={setSortSecondary}
                options={allSorts.map((sort) => ({ value: sort, label: sort }))}
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
                options={allSorts.map((sort) => ({ value: sort, label: sort }))}
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
              <DisplayOptionsControls canEdit={canEdit} />
            </div>

            {/* Column 4: Actions */}
            <div className="flex flex-col gap-2">
              <Text semibold sm>
                Actions
              </Text>
              <Alerts alerts={alerts} />
              {canEdit && (
                <Button color="primary" onClick={handleSaveSorts} disabled={!sortsModified} block>
                  Save as Default Sort
                </Button>
              )}
              <Button color="danger" onClick={resetSorts} disabled={!sortsModified} block>
                Reset Sort
              </Button>
              {canEdit && (
                <TagColorsModalButton color="secondary" block>
                  Set Tag Colors
                </TagColorsModalButton>
              )}
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

          {canEdit && (
            <div className="pt-3 mt-3 border-t border-border">
              <Text sm className="text-text-secondary">
                Looking for more ways to customize how your cube is displayed? Customize the boards and views{' '}
                <Link href={`/cube/settings/${cube.id}?view=boards-and-views`}>here</Link>.
              </Text>
            </div>
          )}
        </div>
      )}
    </>
  );
};

export default CubeListSortSidebar;
