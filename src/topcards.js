import React, { useState } from 'react';
import ReactDOM from 'react-dom';

import DynamicFlash from 'components/DynamicFlash';
import ErrorBoundary from 'components/ErrorBoundary';
import FilterCollapse from 'components/FilterCollapse';
import TopCardsTable from 'components/TopCardsTable';

import Query from 'utils/Query';

const TopCards = () => {
  const [filter, setFilter] = useState(Query.get('f') || '');
  const [count, setCount] = useState(0);

  const updateFilter = (_, filterInput) => {
    setFilter(filterInput);
  };

  return (
    <>
      <div className="usercontrols pt-3 mb-3">
        <h4 className="mx-3 mb-3">Top Cards</h4>
        <FilterCollapse
          isOpen
          defaultFilterText=""
          filter={filter}
          setFilter={updateFilter}
          numCards={count}
          numShown={Math.min(count, 100)}
        />
      </div>
      <DynamicFlash />
      <TopCardsTable filter={filter} setCount={setCount} count={count} />
    </>
  );
};

const wrapper = document.getElementById('react-root');
const element = (
  <ErrorBoundary className="mt-3">
    <TopCards {...window.reactProps} />
  </ErrorBoundary>
);
if (wrapper) {
  ReactDOM.render(element, wrapper);
}
