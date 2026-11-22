import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { PencilIcon, QuestionIcon, SearchIcon, SortAscIcon } from '@primer/octicons-react';
import { allFields, FilterValues, isColorField, isNumField } from '@utils/datatypes/Card';

import Button from 'components/base/Button';
import Input from 'components/base/Input';
import { Flexbox } from 'components/base/Layout';
import AdvancedFilterModal from 'components/modals/AdvancedFilterModal';
import CubeContext from 'contexts/CubeContext';
import DisplayContext from 'contexts/DisplayContext';
import FilterContext from 'contexts/FilterContext';

import Tooltip from '../base/Tooltip';
import CubeViewSwitcher, { CardsPerRowSelect, StacksPerRowSelect } from './CubeViewSwitcher';
import TagQuickFilters from './TagQuickFilters';

interface CubeListNavbarProps {
  cubeView: string;
  setCubeView: (view: string) => void;
}

const CubeListNavbar: React.FC<CubeListNavbarProps> = ({ cubeView, setCubeView }) => {
  const { cardsPerRow, setCardsPerRow, stacksPerRow, setStacksPerRow } = useContext(DisplayContext);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [filterValues, setFilterValues] = useState<Partial<FilterValues>>({});
  const [localFilterInput, setLocalFilterInput] = useState('');

  const { canEdit, changes } = useContext(CubeContext);
  const { filterInput, setFilterInput, filterValid } = useContext(FilterContext);

  const { rightSidebarMode, setRightSidebarMode } = useContext(DisplayContext);

  // Check if there are pending edits
  const hasPendingEdits = useMemo(() => {
    return (
      Object.values(changes.mainboard || { adds: [], removes: [], swaps: [], edits: [] }).some((c) => c.length > 0) ||
      Object.values(changes.maybeboard || { adds: [], removes: [], swaps: [], edits: [] }).some((c) => c.length > 0)
    );
  }, [changes]);

  // Sync local filter with context filter
  useEffect(() => {
    setLocalFilterInput(filterInput || '');
  }, [filterInput]);

  // Auto-apply filter after user stops typing (debounced)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (localFilterInput !== filterInput) {
        setFilterInput(localFilterInput);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [localFilterInput, filterInput, setFilterInput]);

  const applyAdvanced = useCallback(() => {
    const tokens: string[] = [];
    for (const name of allFields) {
      if (filterValues[name]) {
        if (isColorField(name)) {
          const op = filterValues[`${name}Op`] || '=';
          if (filterValues[name] && (filterValues[name] as string[]).length > 0) {
            tokens.push(`${name}${op}${(filterValues[name] as string[]).join('')}`);
          }
        } else {
          const op = isNumField(name) ? filterValues[`${name}Op`] || '=' : ':';
          let value = (filterValues[name] as string).replace(/"/g, '\\"');
          if (value.indexOf(' ') > -1) {
            value = `"${value}"`;
          }
          tokens.push(`${name}${op}${value}`);
        }
      }
    }
    const filterString = tokens.join(' ');
    setLocalFilterInput(filterString);
    setFilterInput(filterString);
    setAdvancedOpen(false);
  }, [filterValues, setFilterInput]);

  // Both the local text and the applied filter have to go. Resetting only the context
  // value would leave the stale text in `localFilterInput`, which the debounce effect
  // below would then push straight back.
  const clearFilter = useCallback(() => {
    setLocalFilterInput('');
    setFilterInput('');
  }, [setFilterInput]);

  return (
    <>
      {/* Desktop Layout - Original */}
      <Flexbox
        direction="row"
        gap="2"
        alignItems="center"
        justify="between"
        className="hidden lg:flex mt-2 w-full max-w-full"
        wrap="wrap"
      >
        <Flexbox direction="row" gap="2" alignItems="center" justify="center" className="xl:px-2">
          <CubeViewSwitcher view={cubeView} setView={setCubeView} includeList={canEdit} />

          {cubeView === 'spoiler' && (
            <div className="w-36">
              <CardsPerRowSelect value={cardsPerRow} setValue={setCardsPerRow} />
            </div>
          )}

          {cubeView === 'stacks' && (
            <div className="w-36">
              <StacksPerRowSelect value={stacksPerRow} setValue={setStacksPerRow} />
            </div>
          )}
        </Flexbox>
        <div className="flex items-center gap-2 xl:px-2 flex-grow">
          <Tooltip text="Advanced Filters">
            <button
              onClick={() => setAdvancedOpen(true)}
              className="text-text hover:text-text-secondary transition-colors"
              aria-label="Open advanced filter"
            >
              <QuestionIcon size={20} className="hidden md:inline" />
            </button>
          </Tooltip>
          <div className="relative flex items-center flex-grow" style={{ minWidth: '150px' }}>
            {/*
              `Input` wraps its field in its own positioned div, which follows this span in the
              DOM and so paints over it. Without an explicit z-index the opaque input background
              hides the icon, leaving only the gap reserved by its padding-left. The 40px of
              padding is the icon's 12px offset plus its 16px width plus a 12px gap, matching
              the input's own `px-3`.
            */}
            <span className="absolute z-10 pointer-events-none" style={{ left: '12px', lineHeight: '0' }}>
              <SearchIcon size={16} className="text-text-secondary" />
            </span>
            <Input
              type="text"
              placeholder="Filter"
              value={localFilterInput}
              onChange={(e) => setLocalFilterInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setFilterInput(localFilterInput);
                }
              }}
              valid={(filterInput?.length ?? 0) > 0 ? filterValid : undefined}
              className="pr-3 bg-bg-active"
              onClear={clearFilter}
              otherInputProps={{
                style: { paddingLeft: '40px' },
                onBlur: () => setFilterInput(localFilterInput),
              }}
            />
          </div>
        </div>
        <div className="xl:px-2">
          <Button
            color={rightSidebarMode === 'sort' ? 'primary' : 'secondary'}
            onClick={() => setRightSidebarMode(rightSidebarMode === 'sort' ? 'none' : 'sort')}
            className="flex items-center gap-2 transition-colors"
          >
            Display
            <SortAscIcon size={16} />
          </Button>
        </div>
        {canEdit && (
          <div className="xl:px-2">
            <Button
              color={rightSidebarMode === 'edit' ? 'primary' : 'secondary'}
              onClick={() => setRightSidebarMode(rightSidebarMode === 'edit' ? 'none' : 'edit')}
              className="flex items-center gap-2 transition-colors"
            >
              Edit
              <PencilIcon size={16} />
            </Button>
          </div>
        )}
      </Flexbox>

      {/* Mobile Layout - Reorganized */}
      <Flexbox direction="col" gap="2" className="lg:hidden mt-2">
        {/* First row: View select and action buttons */}
        <Flexbox direction="row" alignItems="center" justify="between" className="w-full">
          <CubeViewSwitcher view={cubeView} setView={setCubeView} includeList={canEdit} compact />
          <div className="flex gap-2 items-center">
            <Button
              color={rightSidebarMode === 'sort' ? 'primary' : 'secondary'}
              onClick={() => setRightSidebarMode(rightSidebarMode === 'sort' ? 'none' : 'sort')}
              className="flex items-center gap-1 transition-colors"
            >
              <span className="hidden sm:inline">Display</span>
              <SortAscIcon size={16} />
            </Button>
            {canEdit && (
              <div
                className={hasPendingEdits ? 'animate-pulse' : ''}
                style={
                  hasPendingEdits
                    ? { boxShadow: '0 0 12px 1px rgb(var(--button-primary) / 0.85)', borderRadius: '0.25rem' }
                    : {}
                }
              >
                <Button
                  color={rightSidebarMode === 'edit' ? 'primary' : 'secondary'}
                  onClick={() => setRightSidebarMode(rightSidebarMode === 'edit' ? 'none' : 'edit')}
                  className="flex items-center gap-1 transition-colors"
                >
                  <span className="hidden sm:inline">Edit</span>
                  <PencilIcon size={16} />
                </Button>
              </div>
            )}
          </div>
        </Flexbox>

        {/* Conditional row: Cards per row select (only in spoiler view) */}
        {cubeView === 'spoiler' && (
          <Flexbox direction="row" alignItems="center" className="w-full">
            <CardsPerRowSelect value={cardsPerRow} setValue={setCardsPerRow} className="bg-bg-active w-full" />
          </Flexbox>
        )}

        {/* Conditional row: Stacks per row select (only in stacks view) */}
        {cubeView === 'stacks' && (
          <Flexbox direction="row" alignItems="center" className="w-full">
            <StacksPerRowSelect value={stacksPerRow} setValue={setStacksPerRow} className="bg-bg-active w-full" />
          </Flexbox>
        )}

        {/* Second row: Filter input */}
        <Flexbox direction="row" alignItems="center" gap="2" className="w-full">
          <button
            onClick={() => setAdvancedOpen(true)}
            className="text-text hover:text-text-secondary transition-colors flex-shrink-0"
            aria-label="Open advanced filter"
          >
            <QuestionIcon size={20} className="hidden md:inline" />
          </button>
          <div className="relative flex items-center flex-grow">
            <span className="absolute z-10 pointer-events-none" style={{ left: '12px', lineHeight: '0' }}>
              <SearchIcon size={16} className="text-text-secondary" />
            </span>
            <Input
              type="text"
              placeholder="Filter"
              value={localFilterInput}
              onChange={(e) => setLocalFilterInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setFilterInput(localFilterInput);
                }
              }}
              valid={(filterInput?.length ?? 0) > 0 ? filterValid : undefined}
              className="pr-3 bg-bg-active w-full"
              onClear={clearFilter}
              otherInputProps={{
                style: { paddingLeft: '40px' },
                onBlur: () => setFilterInput(localFilterInput),
              }}
            />
          </div>
        </Flexbox>
      </Flexbox>
      <TagQuickFilters />
      <AdvancedFilterModal
        isOpen={advancedOpen}
        setOpen={setAdvancedOpen}
        values={filterValues}
        updateValue={(value, key) => setFilterValues({ ...filterValues, [key]: value })}
        apply={applyAdvanced}
      />
    </>
  );
};

export default CubeListNavbar;
