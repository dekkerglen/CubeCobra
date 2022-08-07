import React, { useState } from 'react';
import PropTypes from 'prop-types';
import CardPropType from 'proptypes/CardPropType';
import CubePropType from 'proptypes/CubePropType';

import Query from 'utils/Query';

import CompareView from 'components/CompareView';
import CubeCompareNavbar from 'components/CubeCompareNavbar';
import { DisplayContextProvider } from 'contexts/DisplayContext';
import DynamicFlash from 'components/DynamicFlash';
import ErrorBoundary from 'components/ErrorBoundary';
import { SortContextProvider } from 'contexts/SortContext';
import MainLayout from 'layouts/MainLayout';
import RenderToRoot from 'utils/RenderToRoot';

import { TAG_COLORS } from 'contexts/CubeContext';

const CubeComparePage = ({
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

  const filteredCards = filter ? cards.filter(filter) : cards;
  return (
    <MainLayout loginCallback={loginCallback}>
      <SortContextProvider defaultSorts={defaultSorts}>
        <DisplayContextProvider>
          <CubeCompareNavbar
            cubeA={cube}
            cubeAID={cube.Id}
            cubeB={cubeB}
            cubeBID={cubeB.Id}
            cards={filteredCards}
            openCollapse={openCollapse}
            setOpenCollapse={setOpenCollapse}
            filter={filter}
            setFilter={setFilter}
          />
          <DynamicFlash />
          <ErrorBoundary>
            <CompareView cards={filteredCards} {...props} />
          </ErrorBoundary>
        </DisplayContextProvider>
      </SortContextProvider>
    </MainLayout>
  );
};

CubeComparePage.propTypes = {
  cards: PropTypes.arrayOf(CardPropType).isRequired,
  cube: CubePropType.isRequired,
  cubeB: CubePropType.isRequired,
  defaultTagColors: PropTypes.arrayOf(
    PropTypes.shape({
      tag: PropTypes.string.isRequired,
      color: PropTypes.oneOf(TAG_COLORS.map(([, c]) => c)),
    }),
  ).isRequired,
  defaultShowTagColors: PropTypes.bool.isRequired,
  defaultSorts: PropTypes.arrayOf(PropTypes.string).isRequired,
  loginCallback: PropTypes.string,
};

CubeComparePage.defaultProps = {
  loginCallback: '/',
};

export default RenderToRoot(CubeComparePage);
