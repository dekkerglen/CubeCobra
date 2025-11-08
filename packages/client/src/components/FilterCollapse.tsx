import React, { useCallback, useContext, useEffect, useState } from 'react';

import { allFields, FilterValues, isColorField, isNumField } from '@utils/datatypes/Card';
import CubeContext from '../contexts/CubeContext';
import FilterContext from '../contexts/FilterContext';
import Button from './base/Button';
import Collapse from './base/Collapse';
import Input from './base/Input';
import { Flexbox } from './base/Layout';
import Link from './base/Link';
import ResponsiveDiv from './base/ResponsiveDiv';
import Text from './base/Text';
import AdvancedFilterModal from './modals/AdvancedFilterModal';

interface FilterCollapseProps {
  isOpen: boolean;
  showReset?: boolean;
  className?: string;
  buttonLabel?: string;
  filterTextFn?: (filter: { mainboard?: [number, number]; maybeboard?: [number, number] }) => string;
}

const FilterCollapse: React.FC<FilterCollapseProps> = ({
  isOpen = false,
  showReset = false,
  buttonLabel = 'Filter',
  className,
  filterTextFn,
}) => {
  const { filterInput, setFilterInput, filterValid } = useContext(FilterContext);
  const { filterResult } = useContext(CubeContext);

  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [values, setValues] = useState<Partial<FilterValues>>({});
  const [searchFilterInput, setSearchFilterInput] = useState(filterInput);

  useEffect(() => {
    setSearchFilterInput(filterInput);
  }, [filterInput]);

  const applyAdvanced = useCallback(async () => {
    const tokens: string[] = [];
    for (const name of allFields) {
      if (values[name]) {
        if (isColorField(name)) {
          const op = values[`${name}Op`] || '=';
          if (values[name] && (values[name] as string[]).length > 0) {
            tokens.push(`${name}${op}${(values[name] as string[]).join('')}`);
          }
        } else {
          const op = isNumField(name) ? values[`${name}Op`] || '=' : ':';
          let value = (values[name] as string).replace('"', '\\"');
          if (value.indexOf(' ') > -1) {
            value = `"${value}"`;
          }
          tokens.push(`${name}${op}${value}`);
        }
      }
    }
    const filterString = tokens.join(' ');
    setSearchFilterInput(filterString);
    setFilterInput(filterString);
    setAdvancedOpen(false);
  }, [setFilterInput, setSearchFilterInput, values]);

  const reset = useCallback(() => {
    setFilterInput('');
    setValues({});
  }, [setFilterInput]);

  const updateValue = useCallback(
    (value: string | string[], name: keyof FilterValues) => {
      setValues({ ...values, [name]: value as any });
    },
    [values],
  );

  return (
    <Collapse isOpen={isOpen} className={className}>
      <Flexbox direction="col" gap="2" className="mt-2">
        <Flexbox direction="row" className="w-full" justify="between" gap="2" alignItems="stretch">
          <Input
            type="text"
            id="filterInput"
            name="filterInput"
            placeholder={'name:"Ambush Viper"'}
            valid={(filterInput?.length ?? 0) > 0 ? filterValid : undefined}
            className="flex-grow"
            value={searchFilterInput ?? ''}
            onChange={(event) => setSearchFilterInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                setFilterInput(searchFilterInput || '');
              }
            }}
          />
          <ResponsiveDiv md>
            <Button color="primary" onClick={() => setFilterInput(searchFilterInput || '')} className="h-full">
              <span className="px-4 whitespace-nowrap">{buttonLabel}</span>
            </Button>
          </ResponsiveDiv>
          <ResponsiveDiv md baseVisible={true}>
            <Button color="primary" onClick={() => setFilterInput(searchFilterInput || '')} className="h-full">
              <span className="px-1 whitespace-nowrap">{buttonLabel}</span>
            </Button>
          </ResponsiveDiv>
          {showReset && (
            <ResponsiveDiv md>
              <Button color="danger" onClick={reset} className="h-full">
                <span className="px-4 whitespace-nowrap">Reset</span>
              </Button>
            </ResponsiveDiv>
          )}
          {/* For mobile */}
          {showReset && (
            <ResponsiveDiv md baseVisible={true}>
              <Button color="danger" onClick={reset} className="h-full">
                <span className="px-1 whitespace-nowrap">Reset</span>
              </Button>
            </ResponsiveDiv>
          )}
          <ResponsiveDiv md>
            <Button color="accent" onClick={() => setAdvancedOpen(true)} className="h-full">
              <span className="px-4 whitespace-nowrap">Advanced</span>
            </Button>
          </ResponsiveDiv>
        </Flexbox>
        <Text sm>
          Having trouble using filter syntax? Check out our <Link href="/filters">syntax guide</Link>.
        </Text>
        {filterResult && filterResult.mainboard && filterTextFn && (
          <Text italic sm>
            {filterTextFn(filterResult)}
          </Text>
        )}
        <AdvancedFilterModal
          isOpen={advancedOpen}
          setOpen={setAdvancedOpen}
          apply={applyAdvanced}
          values={values}
          updateValue={updateValue}
        />
      </Flexbox>
    </Collapse>
  );
};

export default FilterCollapse;
