import React, { useContext, useMemo } from 'react';

import emojiRegex from 'emoji-regex';

import CubeContext from 'contexts/CubeContext';
import DisplayContext from 'contexts/DisplayContext';
import FilterContext from 'contexts/FilterContext';

// Quoted tag values are exact (case-insensitive) matches; JSON quoting escapes any quotes in the tag.
const tagFilter = (tag: string): string => `tag:${JSON.stringify(tag)}`;

/**
 * Row of one-click filter buttons for a cube's emoji tags. Cube owners use emoji tags for groups
 * they want drafters to see (e.g. "🛡 Protection"), so these get surfaced; plain tags do not.
 */
const TagQuickFilters: React.FC = () => {
  const { tagColors } = useContext(CubeContext);
  const { showTagQuickFilters } = useContext(DisplayContext).displayOptions;
  const { filterInput, setFilterInput } = useContext(FilterContext);

  // tagColors holds every active tag in the owner's chosen order.
  const emojiTags = useMemo(() => {
    const regex = emojiRegex();
    return tagColors.map((tc) => tc.tag).filter((tag) => tag.match(regex));
  }, [tagColors]);

  if (!showTagQuickFilters || emojiTags.length === 0) {
    return null;
  }

  const currentFilter = (filterInput ?? '').trim();

  return (
    <div className="flex flex-wrap gap-2 mt-2 xl:px-2">
      {emojiTags.map((tag) => {
        const filter = tagFilter(tag);
        const active = currentFilter === filter;
        return (
          <button
            key={tag}
            type="button"
            onClick={() => setFilterInput(active ? '' : filter)}
            aria-pressed={active}
            className={`px-2 py-1 rounded border text-sm transition-colors bg-bg-active text-text hover:bg-bg ${
              active ? 'border-button-primary' : 'border-border'
            }`}
          >
            {tag}
          </button>
        );
      })}
    </div>
  );
};

export default TagQuickFilters;
