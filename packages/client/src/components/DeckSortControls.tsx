import React, { useState } from 'react';

import { SortDescIcon } from '@primer/octicons-react';
import { DeckSortKey } from '@utils/draftutil';

import Dropdown from './base/Dropdown';
import { Flexbox } from './base/Layout';
import Link from './base/Link';

interface DeckSortControlsProps {
  // Re-buckets the columns by a card attribute, keeping each card's current row.
  onSort: (key: DeckSortKey) => void;
  // Splits cards into creature / non-creature rows, keeping their columns.
  onSplitCreatures: () => void;
}

const SORT_OPTIONS: { key: DeckSortKey; label: string }[] = [
  { key: 'color', label: 'Sort columns by color' },
  { key: 'cmc', label: 'Sort columns by mana value' },
  { key: 'rarity', label: 'Sort columns by rarity' },
  { key: 'type', label: 'Sort columns by type' },
];

// Quick-sort dropdown for the deckbuilder. The four column sorts re-bucket the
// columns by a card attribute; the split option moves cards between the
// creature and non-creature rows. The two are independent.
const DeckSortControls: React.FC<DeckSortControlsProps> = ({ onSort, onSplitCreatures }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Dropdown
      trigger={
        <Link className="flex items-center gap-2 !text-link hover:!text-link-active transition-colors font-medium cursor-pointer px-2">
          <SortDescIcon size={16} />
          Sort
        </Link>
      }
      align="left"
      minWidth="16rem"
      isOpen={isOpen}
      setIsOpen={setIsOpen}
    >
      <Flexbox direction="col" gap="2" className="p-3">
        {SORT_OPTIONS.map(({ key, label }) => (
          <Link
            key={key}
            onClick={() => {
              onSort(key);
              setIsOpen(false);
            }}
            className="!text-text hover:!text-link-active hover:cursor-pointer font-medium"
          >
            {label}
          </Link>
        ))}
        <Link
          onClick={() => {
            onSplitCreatures();
            setIsOpen(false);
          }}
          className="!text-text hover:!text-link-active hover:cursor-pointer font-medium"
        >
          Split creatures and non-creatures into rows
        </Link>
      </Flexbox>
    </Dropdown>
  );
};

export default DeckSortControls;
