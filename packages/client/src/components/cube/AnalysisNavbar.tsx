import React, { useCallback, useContext, useEffect, useState } from 'react';

import { QuestionIcon, SearchIcon } from '@primer/octicons-react';
import { allFields, FilterValues, isColorField, isNumField } from '@utils/datatypes/Card';
import { filterToReadableString } from '@utils/filtering/FilterCards';

import Input from 'components/base/Input';
import { Flexbox } from 'components/base/Layout';
import Text from 'components/base/Text';
import AnalysisBoardPicker from 'components/cube/AnalysisBoardPicker';
import AdvancedFilterModal from 'components/modals/AdvancedFilterModal';
import AnalysisViewContext from 'contexts/AnalysisViewContext';
import CubeContext from 'contexts/CubeContext';
import FilterContext from 'contexts/FilterContext';

const AnalysisNavbar: React.FC = () => {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [filterValues, setFilterValues] = useState<Partial<FilterValues>>({});
  const [localFilterInput, setLocalFilterInput] = useState('');

  const { filterInput, setFilterInput, filterValid, cardFilter } = useContext(FilterContext);
  const { filterResult } = useContext(CubeContext);
  const analysisViewContext = useContext(AnalysisViewContext);

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
  // above would then push straight back.
  const clearFilter = useCallback(() => {
    setLocalFilterInput('');
    setFilterInput('');
  }, [setFilterInput]);

  return (
    <>
      <Flexbox direction="row" gap="2" alignItems="center" justify="center" className="mt-2" wrap="wrap">
        <div className="flex items-center gap-2 px-2 flex-grow">
          <button
            onClick={() => setAdvancedOpen(true)}
            className="text-text hover:text-text-secondary transition-colors"
            aria-label="Open advanced filter"
          >
            <QuestionIcon size={20} className="hidden md:inline" />
          </button>
          <div
            className="relative flex items-center flex-grow"
            data-testid="analysis-filter"
            style={{ minWidth: '150px' }}
          >
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
        <AnalysisBoardPicker />
      </Flexbox>
      {filterResult && Object.keys(filterResult).length > 0 && (
        <div className="text-center py-1">
          <Text italic sm>
            {Object.entries(filterResult)
              .filter(([boardname]) => analysisViewContext?.boards.includes(boardname) ?? boardname === 'mainboard')
              .map(([boardname, counts]) => `Showing ${counts[0]} / ${counts[1]} cards in ${boardname}`)
              .join('. ')}
          </Text>
          {filterValid && filterInput && (
            <Text italic sm className="block text-text-secondary">
              {filterToReadableString(cardFilter.filter)}
            </Text>
          )}
        </div>
      )}
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

export default AnalysisNavbar;
