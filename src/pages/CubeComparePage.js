import React, { useState } from 'react';

import Filter from 'util/Filter';
import Query from 'util/Query';

import CardModalForm from 'components/CardModalForm';
import CompareView from 'components/CompareView';
import CubeCompareNavbar from 'components/CubeCompareNavbar';
import { DisplayContextProvider } from 'components/DisplayContext';
import DynamicFlash from 'components/DynamicFlash';
import ErrorBoundary from 'components/ErrorBoundary';
import { SortContextProvider } from 'components/SortContext';
import { TagContextProvider } from 'components/TagContext';

const deduplicateTags = (tagColors) => {
  const used = new Set();
  const result = [];
  for (const tagColor of tagColors) {
    if (!used.has(tagColor.tag)) {
      result.push(tagColor);
      used.add(tagColor.tag);
    }
  }
  return result;
};

const CubeComparePage = ({ cards, cubeID, cube, cubeBID, cubeB, defaultTagColors, defaultShowTagColors, defaultSorts, ...props }) => {
  const [openCollapse, setOpenCollapse] = useState(Query.get('f', false) ? 'filter' : null);
  const [filter, setFilter] = useState([]);

  const defaultTagSet = new Set([].concat.apply([], cards.map((card) => card.tags)));
  const defaultTags = [...defaultTagSet].map((tag) => ({
    id: tag,
    text: tag,
  }));
  const filteredCards = filter.length > 0 ? cards.filter((card) => Filter.filterCard(card, filter)) : cards;
  return (
    <SortContextProvider defaultSorts={defaultSorts}>
      <DisplayContextProvider>
        <TagContextProvider
          cubeID={cubeID}
          defaultTagColors={deduplicateTags(defaultTagColors)}
          defaultShowTagColors={defaultShowTagColors}
          defaultTags={defaultTags}
        >
          <CubeCompareNavbar
            cubeA={cube}
            cubeAID={cubeID}
            cubeB={cubeB}
            cubeBID={cubeBID}
            cards={filteredCards}
            openCollapse={openCollapse}
            setOpenCollapse={setOpenCollapse}
            filter={filter}
            setFilter={setFilter}
          />
          <DynamicFlash />
          <ErrorBoundary>
            <CardModalForm>
              <CompareView cards={filteredCards} {...props} />
            </CardModalForm>
          </ErrorBoundary>
        </TagContextProvider>
      </DisplayContextProvider>
    </SortContextProvider>
  );
}

export default CubeComparePage;