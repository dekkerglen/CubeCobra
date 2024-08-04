import React, { useState } from 'react';

import PropTypes from 'prop-types';
import CardPropType from 'proptypes/CardPropType';
import CubePropType from 'proptypes/CubePropType';

import CompareView from 'components/CompareView';
import CubeCompareNavbar from 'components/CubeCompareNavbar';
import DynamicFlash from 'components/DynamicFlash';
import ErrorBoundary from 'components/ErrorBoundary';
import RenderToRoot from 'components/RenderToRoot';
import { CubeContextProvider } from 'contexts/CubeContext';
import { DisplayContextProvider } from 'contexts/DisplayContext';
import MainLayout from 'layouts/MainLayout';
import Query from 'utils/Query';

const CubeComparePage = ({ cards, cube, cubeB, loginCallback, onlyA, onlyB, both }) => {
  const [openCollapse, setOpenCollapse] = useState(Query.get('f', false) ? 'filter' : null);
  const [filter, setFilter] = useState(null);

  const filteredCards = filter ? cards.filter(filter) : cards;
  return (
    <MainLayout loginCallback={loginCallback}>
      <DisplayContextProvider>
        <CubeContextProvider initialCube={cube} cards={{ mainboard: cards }}>
          <CubeCompareNavbar
            cubeA={cube}
            cubeAID={cube.id}
            cubeB={cubeB}
            cubeBID={cubeB.id}
            cards={filteredCards}
            openCollapse={openCollapse}
            setOpenCollapse={setOpenCollapse}
            filter={filter}
            setFilter={setFilter}
          />
          <DynamicFlash />
          <ErrorBoundary>
            <CompareView cards={filteredCards} onlyA={onlyA} onlyB={onlyB} both={both} />
          </ErrorBoundary>
        </CubeContextProvider>
      </DisplayContextProvider>
    </MainLayout>
  );
};

CubeComparePage.propTypes = {
  cards: PropTypes.arrayOf(CardPropType).isRequired,
  onlyA: PropTypes.arrayOf(CardPropType).isRequired,
  onlyB: PropTypes.arrayOf(CardPropType).isRequired,
  both: PropTypes.arrayOf(CardPropType).isRequired,
  cube: CubePropType.isRequired,
  cubeB: CubePropType.isRequired,
  loginCallback: PropTypes.string,
};

CubeComparePage.defaultProps = {
  loginCallback: '/',
};

export default RenderToRoot(CubeComparePage);
