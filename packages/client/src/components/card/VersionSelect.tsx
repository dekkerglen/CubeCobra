import React, { useMemo, useRef, useState } from 'react';

import { ChevronDownIcon } from '@primer/octicons-react';
import classNames from 'classnames';

import Dropdown from '../base/Dropdown';
import Input from '../base/Input';
import { ListGroupItem } from '../base/ListGroup';
import withAutocard from '../WithAutocard';

// Rows are real DOM elements (unlike native <option>s), so autocard can attach
// and preview each printing's image on hover.
const AutocardItem = withAutocard(ListGroupItem);

// Above this many versions we show a filter box to tame very long printing lists.
const FILTER_THRESHOLD = 8;

// Only the fields VersionSelect needs; a subset of CubeContext's CardVersion so
// callers can pass their existing (looser) version objects without casting.
export interface VersionOption {
  scryfall_id: string;
  version: string;
  image_normal?: string;
}

export interface VersionSelectProps {
  label?: string;
  value: string; // current scryfall_id (card.cardID)
  setValue: (value: string) => void;
  versions: VersionOption[]; // each includes image_normal for the hover preview
  disabled?: boolean;
  loading?: boolean;
}

const VersionSelect: React.FC<VersionSelectProps> = ({ label, value, setValue, versions, disabled, loading }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const filterRef = useRef<HTMLInputElement>(null);

  const selected = useMemo(() => versions.find((v) => v.scryfall_id === value), [versions, value]);

  const filtered = useMemo(() => {
    const query = filter.trim().toLowerCase();
    if (!query) {
      return versions;
    }
    return versions.filter((v) => v.version.toLowerCase().includes(query));
  }, [versions, filter]);

  const showFilter = versions.length > FILTER_THRESHOLD;

  const handleSelect = (id: string) => {
    setValue(id);
    setIsOpen(false);
    setFilter('');
  };

  const triggerClasses = classNames(
    'flex items-center justify-between gap-2 w-full px-3 py-2 border border-border bg-bg rounded-md shadow-sm sm:text-sm',
    'focus:outline-none focus:ring-2 focus:ring-focus-ring focus:border-focus-ring transition duration-200 ease-in-out',
    {
      'opacity-50 cursor-not-allowed': disabled || loading,
      'cursor-pointer': !disabled && !loading,
    },
  );

  return (
    <div className="block w-full">
      {label && <label className="block text-sm font-medium text-text">{label}</label>}
      {loading ? (
        <div className="flex items-center gap-2 px-3 py-2">
          <div className="animate-spin h-4 w-4 border-2 border-gray-500 border-t-transparent rounded-full" />
          <span className="text-sm text-gray-500">Loading...</span>
        </div>
      ) : (
        <Dropdown
          className="w-full"
          minWidth="100%"
          isOpen={isOpen && !disabled}
          setIsOpen={(open) => {
            if (disabled) {
              return;
            }
            setIsOpen(open);
            if (open) {
              setFilter('');
              // Focus the filter box once the menu has mounted.
              setTimeout(() => filterRef.current?.focus(), 0);
            }
          }}
          trigger={
            <div className={triggerClasses} role="button" aria-disabled={disabled}>
              <span className="truncate">{selected?.version ?? 'Select a version'}</span>
              <ChevronDownIcon size={16} className="shrink-0" />
            </div>
          }
        >
          <div className="flex flex-col">
            {showFilter && (
              <div className="p-2 border-b border-border">
                <Input
                  innerRef={filterRef}
                  type="text"
                  placeholder="Filter versions..."
                  value={filter}
                  onChange={(event) => setFilter(event.target.value)}
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                />
              </div>
            )}
            <div className="max-h-80 overflow-y-auto">
              {filtered.length > 0 ? (
                filtered.map((version, index) => {
                  const rowProps = {
                    className: classNames('flex justify-between', {
                      'font-bold bg-bg-active': version.scryfall_id === value,
                    }),
                    onClick: () => handleSelect(version.scryfall_id),
                    first: index === 0 && !showFilter,
                    last: index === filtered.length - 1,
                  };
                  // Only wrap with autocard when we have an image to preview;
                  // withAutocard would otherwise dereference an undefined card.
                  return version.image_normal ? (
                    <AutocardItem key={version.scryfall_id} image={version.image_normal} inModal {...rowProps}>
                      {version.version}
                    </AutocardItem>
                  ) : (
                    <ListGroupItem key={version.scryfall_id} {...rowProps}>
                      {version.version}
                    </ListGroupItem>
                  );
                })
              ) : (
                <div className="px-3 py-2 text-sm text-text-secondary">No versions match your filter.</div>
              )}
            </div>
          </div>
        </Dropdown>
      )}
    </div>
  );
};

export default VersionSelect;
