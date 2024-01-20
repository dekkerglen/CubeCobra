import React, { useContext } from 'react';
import PropTypes from 'prop-types';

import CubeContext from 'contexts/CubeContext';
import DisplayContext, { DisplayContextProvider } from 'contexts/DisplayContext';
import CubeListNavbar from 'components/CubeListNavbar';
import CurveView from 'components/CurveView';
import DynamicFlash from 'components/DynamicFlash';
import ErrorBoundary from 'components/ErrorBoundary';
import ListView from 'components/ListView';
import TableView from 'components/TableView';
import VisualSpoiler from 'components/VisualSpoiler';
import CubeLayout from 'layouts/CubeLayout';
import MainLayout from 'layouts/MainLayout';
import RenderToRoot from 'utils/RenderToRoot';
import useQueryParam from 'hooks/useQueryParam';
import CubePropType from 'proptypes/CubePropType';

const CubeListPageRaw = () => {
  const { changedCards, filter } = useContext(CubeContext);
  const { showMaybeboard } = useContext(DisplayContext);

  const [cubeView, setCubeView] = useQueryParam('view', 'table');

  const tagList = [];
  for (const [boardname, list] of Object.entries(changedCards)) {
    if (boardname !== 'id') {
      tagList.push(...new Set([].concat(...list.map((card) => card.tags))));
    }
  }

  return (
    <>
      <CubeListNavbar cubeView={cubeView} setCubeView={setCubeView} />
      <DynamicFlash />
      {Object.entries(changedCards)
        .map(([boardname, boardcards]) => (
          <ErrorBoundary key={boardname}>
            {(showMaybeboard || boardname !== 'maybeboard') && (
              <>
                {boardname !== 'mainboard' && <h4 className="boardTitle">{boardname}</h4>}
                {boardcards.length === 0 &&
                  (filter ? (
                    <h5 className="mt-1 mb-3">No cards match filter.</h5>
                  ) : (
                    <h5 className="mt-1 mb-3">This board is empty.</h5>
                  ))}
                {
                  {
                    table: <TableView cards={boardcards} />,
                    spoiler: <VisualSpoiler cards={boardcards} />,
                    curve: <CurveView cards={boardcards} />,
                    list: <ListView cards={boardcards} />,
                  }[cubeView]
                }
                {boardname !== 'mainboard' && <hr />}
              </>
            )}
          </ErrorBoundary>
        ))
        .reverse()}
    </>
  );
};

const CubeListPage = ({ cube, cards, loginCallback }) => (
  <MainLayout loginCallback={loginCallback}>
    <DisplayContextProvider cubeID={cube.id}>
      <CubeLayout cube={cube} cards={cards} activeLink="list" loadVersionDict useChangedCards>
        <CubeListPageRaw />
      </CubeLayout>
    </DisplayContextProvider>
  </MainLayout>
);

CubeListPage.propTypes = {
  cube: CubePropType.isRequired,
  cards: PropTypes.shape({
    boards: PropTypes.arrayOf(PropTypes.object),
  }).isRequired,
  loginCallback: PropTypes.string,
};

CubeListPage.defaultProps = {
  loginCallback: '/',
};

export default RenderToRoot(CubeListPage);
