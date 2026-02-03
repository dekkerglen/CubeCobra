import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';

import {
  GraphIcon,
  ImageIcon,
  ListUnorderedIcon,
  PencilIcon,
  QuestionIcon,
  SearchIcon,
  SortAscIcon,
  TableIcon,
  XCircleIcon,
} from '@primer/octicons-react';
import { allFields, FilterValues, isColorField, isNumField } from '@utils/datatypes/Card';

import Button from 'components/base/Button';
import Input from 'components/base/Input';
import { Flexbox, NumCols } from 'components/base/Layout';
import AdvancedFilterModal from 'components/modals/AdvancedFilterModal';
import CubeContext from 'contexts/CubeContext';
import DisplayContext from 'contexts/DisplayContext';
import FilterContext from 'contexts/FilterContext';

import Select from '../base/Select';
import Tooltip from '../base/Tooltip';

interface CubeListNavbarProps {
  cubeView: string;
  setCubeView: (view: string) => void;
}

const CubeListNavbar: React.FC<CubeListNavbarProps> = ({ cubeView, setCubeView }) => {
  const { cardsPerRow, setCardsPerRow } = useContext(DisplayContext);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [filterValues, setFilterValues] = useState<Partial<FilterValues>>({});
  const [localFilterInput, setLocalFilterInput] = useState('');

  const { canEdit, changes } = useContext(CubeContext);
  const { filterInput, setFilterInput, filterValid } = useContext(FilterContext);

  const { rightSidebarMode, setRightSidebarMode } = useContext(DisplayContext);

  // Check if there are pending edits
  const hasPendingEdits = useMemo(() => {
    return (
      Object.values(changes.mainboard || { adds: [], removes: [], swaps: [], edits: [] }).some(
        (c) => c.length > 0,
      ) ||
      Object.values(changes.maybeboard || { adds: [], removes: [], swaps: [], edits: [] }).some(
        (c) => c.length > 0,
      )
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
          <div className="flex gap-0 bg-bg-active rounded py-0.5 px-1 self-stretch items-center">
            <Tooltip text="Table View">
              <button
                onClick={() => setCubeView('table')}
                className={`px-2 py-1 rounded transition-colors ${cubeView === 'table' ? 'bg-button-primary text-white' : 'hover:bg-bg text-text'}`}
                aria-label="Table View"
              >
                <TableIcon size={20} />
              </button>
            </Tooltip>
            <Tooltip text="Visual Spoiler">
              <button
                onClick={() => setCubeView('spoiler')}
                className={`px-2 py-1 rounded transition-colors ${cubeView === 'spoiler' ? 'bg-button-primary text-white' : 'hover:bg-bg text-text'}`}
                aria-label="Visual Spoiler"
              >
                <ImageIcon size={20} />
              </button>
            </Tooltip>
            <Tooltip text="Curve View">
              <button
                onClick={() => setCubeView('curve')}
                className={`px-2 py-1 rounded transition-colors ${cubeView === 'curve' ? 'bg-button-primary text-white' : 'hover:bg-bg text-text'}`}
                aria-label="Curve View"
              >
                <GraphIcon size={20} />
              </button>
            </Tooltip>
            {canEdit && (
              <Tooltip text="List View">
                <button
                  onClick={() => setCubeView('list')}
                  className={`px-2 py-1 rounded transition-colors ${cubeView === 'list' ? 'bg-button-primary text-white' : 'hover:bg-bg text-text'}`}
                  aria-label="List View"
                >
                  <ListUnorderedIcon size={20} />
                </button>
              </Tooltip>
            )}
          </div>

          {cubeView === 'spoiler' && (
            <div className="w-36">
              <Select
                value={`${cardsPerRow}`}
                setValue={(value) => setCardsPerRow(parseInt(value, 10) as NumCols)}
                className="bg-bg-active"
                options={[
                  { value: '1', label: '1 Card Per Row' },
                  { value: '2', label: '2 Cards Per Row' },
                  { value: '3', label: '3 Cards Per Row' },
                  { value: '4', label: '4 Cards Per Row' },
                  { value: '5', label: '5 Cards Per Row' },
                  { value: '6', label: '6 Cards Per Row' },
                  { value: '7', label: '7 Cards Per Row' },
                  { value: '8', label: '8 Cards Per Row' },
                  { value: '9', label: '9 Cards Per Row' },
                  { value: '10', label: '10 Cards Per Row' },
                  { value: '11', label: '11 Cards Per Row' },
                  { value: '12', label: '12 Cards Per Row' },
                ]}
              />
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
            <span className="absolute" style={{ left: '12px' }}>
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
              otherInputProps={{
                style: { paddingLeft: '48px' },
                onBlur: () => setFilterInput(localFilterInput),
              }}
            />
            <span className="absolute" style={{ right: '16px' }} onClick={() => setFilterInput('')}>
              <XCircleIcon size={16} className="text-text-secondary cursor-pointer" />
            </span>
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
          <div className="flex gap-0 bg-bg-active rounded py-0.5 items-center">
            <Tooltip text="Table View">
              <button
                onClick={() => setCubeView('table')}
                className={`px-2 py-1 rounded transition-colors ${cubeView === 'table' ? 'bg-button-primary text-white' : 'hover:bg-bg text-text'}`}
                aria-label="Table View"
              >
                <TableIcon size={16} />
              </button>
            </Tooltip>
            <Tooltip text="Visual Spoiler">
              <button
                onClick={() => setCubeView('spoiler')}
                className={`px-2 py-1 rounded transition-colors ${cubeView === 'spoiler' ? 'bg-button-primary text-white' : 'hover:bg-bg text-text'}`}
                aria-label="Visual Spoiler"
              >
                <ImageIcon size={16} />
              </button>
            </Tooltip>
            <Tooltip text="Curve View">
              <button
                onClick={() => setCubeView('curve')}
                className={`px-2 py-1 rounded transition-colors ${cubeView === 'curve' ? 'bg-button-primary text-white' : 'hover:bg-bg text-text'}`}
                aria-label="Curve View"
              >
                <GraphIcon size={16} />
              </button>
            </Tooltip>
            {canEdit && (
              <Tooltip text="List View">
                <button
                  onClick={() => setCubeView('list')}
                  className={`px-2 py-1 rounded transition-colors ${cubeView === 'list' ? 'bg-button-primary text-white' : 'hover:bg-bg text-text'}`}
                  aria-label="List View"
                >
                  <ListUnorderedIcon size={16} />
                </button>
              </Tooltip>
            )}
          </div>
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
                style={hasPendingEdits ? { boxShadow: '0 0 12px 1px rgb(var(--button-primary) / 0.85)', borderRadius: '0.25rem' } : {}}
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
            <Select
              value={`${cardsPerRow}`}
              setValue={(value) => setCardsPerRow(parseInt(value, 10) as NumCols)}
              className="bg-bg-active w-full"
              options={[
                { value: '1', label: '1 Card Per Row' },
                { value: '2', label: '2 Cards Per Row' },
                { value: '3', label: '3 Cards Per Row' },
                { value: '4', label: '4 Cards Per Row' },
                { value: '5', label: '5 Cards Per Row' },
                { value: '6', label: '6 Cards Per Row' },
                { value: '7', label: '7 Cards Per Row' },
                { value: '8', label: '8 Cards Per Row' },
                { value: '9', label: '9 Cards Per Row' },
                { value: '10', label: '10 Cards Per Row' },
                { value: '11', label: '11 Cards Per Row' },
                { value: '12', label: '12 Cards Per Row' },
              ]}
            />
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
            <span className="absolute" style={{ left: '12px' }}>
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
              otherInputProps={{
                style: { paddingLeft: '48px' },
                onBlur: () => setFilterInput(localFilterInput),
              }}
            />
          </div>
        </Flexbox>
      </Flexbox>
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
