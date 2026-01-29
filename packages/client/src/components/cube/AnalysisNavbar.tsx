import React, { useCallback, useContext, useEffect, useState } from 'react';

import { QuestionIcon, SearchIcon } from '@primer/octicons-react';
import { allFields, FilterValues, isColorField, isNumField } from '@utils/datatypes/Card';

import Input from 'components/base/Input';
import { Flexbox } from 'components/base/Layout';
import Text from 'components/base/Text';
import AdvancedFilterModal from 'components/modals/AdvancedFilterModal';
import CubeContext from 'contexts/CubeContext';
import FilterContext from 'contexts/FilterContext';

const AnalysisNavbar: React.FC = () => {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [filterValues, setFilterValues] = useState<Partial<FilterValues>>({});
  const [localFilterInput, setLocalFilterInput] = useState('');

  const { filterInput, setFilterInput, filterValid } = useContext(FilterContext);
  const { filterResult } = useContext(CubeContext);

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
          let value = (filterValues[name] as string).replace('"', '\\"');
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
      <Flexbox direction="row" gap="2" alignItems="center" justify="center" className="mt-2" wrap="wrap">
        <div className="flex items-center gap-2 px-2">
          <button
            onClick={() => setAdvancedOpen(true)}
            className="text-text hover:text-text-secondary transition-colors"
            aria-label="Open advanced filter"
          >
            <QuestionIcon size={20} />
          </button>
          <div className="relative flex items-center" style={{ minWidth: '250px', maxWidth: '400px' }}>
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
          </div>
        </div>
      </Flexbox>
      {filterResult && filterResult.mainboard && (
        <div className="text-center py-1">
          <Text italic sm>
            {`Calculating analytics for ${filterResult.mainboard[0]} / ${filterResult.mainboard[1]} cards in mainboard.`}
          </Text>
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
