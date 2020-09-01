import React, { useState } from 'react';
import PropTypes from 'prop-types';

import Query from 'utils/Query';

import CardModalForm from 'components/CardModalForm';
import CompareView from 'components/CompareView';
import CubeCompareNavbar from 'components/CubeCompareNavbar';
import { DisplayContextProvider } from 'components/DisplayContext';
import DynamicFlash from 'components/DynamicFlash';
import ErrorBoundary from 'components/ErrorBoundary';
import { SortContextProvider } from 'components/SortContext';
import { TAG_COLORS, TagContextProvider } from 'components/TagContext';
import MainLayout from 'layouts/MainLayout';
import RenderToRoot from 'utils/RenderToRoot';

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

const CubeComparePage = ({
  user,
  cards,
  cube,
  cubeB,
  defaultTagColors,
  defaultShowTagColors,
  defaultSorts,
  loginCallback,
  ...props
}) => {
  const [openCollapse, setOpenCollapse] = useState(Query.get('f', false) ? 'filter' : null);
  const [filter, setFilter] = useState(null);

  const defaultTagSet = new Set([].concat(...cards.map((card) => card.tags)));
  const defaultTags = [...defaultTagSet].map((tag) => ({
    id: tag,
    text: tag,
  }));
  const filteredCards = filter ? cards.filter(filter) : cards;
  return (
    <MainLayout loginCallback={loginCallback} user={user}>
      <SortContextProvider defaultSorts={defaultSorts}>
        <DisplayContextProvider>
          <TagContextProvider
            cubeID={cube._id}
            defaultTagColors={deduplicateTags(defaultTagColors)}
            defaultShowTagColors={defaultShowTagColors}
            defaultTags={defaultTags}
          >
            <CubeCompareNavbar
              cubeA={cube}
              cubeAID={cube._id}
              cubeB={cubeB}
              cubeBID={cubeB._id}
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
    </MainLayout>
  );
};

CubeComparePage.propTypes = {
  cards: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  cube: PropTypes.shape({
    _id: PropTypes.string.isRequired,
  }).isRequired,
  cubeB: PropTypes.shape({
    _id: PropTypes.string.isRequired,
  }).isRequired,
  defaultTagColors: PropTypes.arrayOf(
    PropTypes.shape({
      tag: PropTypes.string.isRequired,
      color: PropTypes.oneOf(TAG_COLORS.map(([, c]) => c)),
    }),
  ).isRequired,
  defaultShowTagColors: PropTypes.bool.isRequired,
  defaultSorts: PropTypes.arrayOf(PropTypes.string).isRequired,
  user: PropTypes.shape({
    id: PropTypes.string.isRequired,
    username: PropTypes.string.isRequired,
    notifications: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  }),
  loginCallback: PropTypes.string,
};

CubeComparePage.defaultProps = {
  user: null,
  loginCallback: '/',
};

export default RenderToRoot(CubeComparePage);
