import React, { useContext, useMemo, useState } from 'react';
import PropTypes from 'prop-types';

import CubeContext from 'contexts/CubeContext';
import DisplayContext, { DisplayContextProvider } from 'contexts/DisplayContext';
import CubeListNavbar from 'components/CubeListNavbar';
import CurveView from 'components/CurveView';
import DynamicFlash from 'components/DynamicFlash';
import ErrorBoundary from 'components/ErrorBoundary';
import ListView from 'components/ListView';
import { SortContextProvider } from 'contexts/SortContext';
import TableView from 'components/TableView';
import VisualSpoiler from 'components/VisualSpoiler';
import CubeLayout from 'layouts/CubeLayout';
import MainLayout from 'layouts/MainLayout';
import RenderToRoot from 'utils/RenderToRoot';
import useQueryParam from 'hooks/useQueryParam';
import CubePropType from 'proptypes/CubePropType';

const CubeListPageRaw = ({
  defaultFilterText,
  defaultView,
  defaultPrimarySort,
  defaultSecondarySort,
  defaultTertiarySort,
  defaultQuaternarySort,
  defaultShowUnsorted,
}) => {
  const { cube, changedCards } = useContext(CubeContext);
  const { showMaybeboard } = useContext(DisplayContext);

  const [cubeView, setCubeView] = useQueryParam('view', defaultView);
  const [filter, setFilter] = useState(null);
  const [sorts, setSorts] = useState(null);

  const tagList = [];
  for (const [boardname, list] of Object.entries(changedCards)) {
    if (boardname !== 'id') {
      tagList.push(...new Set([].concat(...list.map((card) => card.tags))));
    }
  }

  const filteredCards = useMemo(() => {
    if (filter) {
      return Object.fromEntries(
        Object.entries(changedCards)
          .filter(([boardname]) => boardname !== 'id')
          .map(([boardname, list]) => [boardname, list.filter(filter)]),
      );
    }
    return Object.fromEntries(Object.entries(changedCards).filter(([boardname]) => boardname !== 'id'));
  }, [filter, changedCards]);

  return (
    <SortContextProvider defaultSorts={cube.DefaultSorts} showOther={!!cube.ShowUnsorted}>
      <CubeListNavbar
        cubeView={cubeView}
        setCubeView={setCubeView}
        defaultPrimarySort={defaultPrimarySort}
        defaultSecondarySort={defaultSecondarySort}
        defaultTertiarySort={defaultTertiarySort}
        defaultQuaternarySort={defaultQuaternarySort}
        defaultShowUnsorted={defaultShowUnsorted}
        sorts={sorts}
        setSorts={setSorts}
        defaultSorts={cube.DefaultSorts}
        cubeDefaultShowUnsorted={cube.ShowUnsorted}
        defaultFilterText={defaultFilterText}
        filter={filter}
        setFilter={setFilter}
        cards={filteredCards}
        className="mb-3"
      />
      <DynamicFlash />
      {Object.entries(filteredCards)
        .map(([boardname, boardcards]) => (
          <ErrorBoundary key={boardname}>
            {(showMaybeboard || boardname !== 'Maybeboard') && (
              <>
                {boardname !== 'Mainboard' && <h4>{boardname}</h4>}
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
                {boardname === 'Maybeboard' && <hr />}
              </>
            )}
          </ErrorBoundary>
        ))
        .reverse()}
    </SortContextProvider>
  );
};

CubeListPageRaw.propTypes = {
  defaultFilterText: PropTypes.string.isRequired,
  defaultView: PropTypes.string.isRequired,
  defaultPrimarySort: PropTypes.string.isRequired,
  defaultSecondarySort: PropTypes.string.isRequired,
  defaultTertiarySort: PropTypes.string.isRequired,
  defaultQuaternarySort: PropTypes.string.isRequired,
  defaultShowUnsorted: PropTypes.string.isRequired,
};

const CubeListPage = ({
  cube,
  cards,
  defaultShowTagColors,
  defaultFilterText,
  defaultView,
  defaultPrimarySort,
  defaultSecondarySort,
  defaultTertiarySort,
  defaultQuaternarySort,
  defaultShowUnsorted,
  loginCallback,
}) => (
  <MainLayout loginCallback={loginCallback}>
    <CubeLayout cube={cube} cards={cards} activeLink="list" loadVersionDict>
      <DisplayContextProvider cubeID={cube.Id}>
        <CubeListPageRaw
          defaultShowTagColors={defaultShowTagColors}
          defaultFilterText={defaultFilterText}
          defaultView={defaultView}
          defaultPrimarySort={defaultPrimarySort}
          defaultSecondarySort={defaultSecondarySort}
          defaultTertiarySort={defaultTertiarySort}
          defaultQuaternarySort={defaultQuaternarySort}
          defaultShowUnsorted={defaultShowUnsorted}
        />
      </DisplayContextProvider>
    </CubeLayout>
  </MainLayout>
);

CubeListPage.propTypes = {
  cube: CubePropType.isRequired,
  cards: PropTypes.shape({
    boards: PropTypes.arrayOf(PropTypes.object),
  }).isRequired,
  defaultShowTagColors: PropTypes.bool.isRequired,
  defaultFilterText: PropTypes.string.isRequired,
  defaultView: PropTypes.string.isRequired,
  defaultPrimarySort: PropTypes.string.isRequired,
  defaultSecondarySort: PropTypes.string.isRequired,
  defaultTertiarySort: PropTypes.string.isRequired,
  defaultQuaternarySort: PropTypes.string.isRequired,
  defaultShowUnsorted: PropTypes.string.isRequired,
  loginCallback: PropTypes.string,
};

CubeListPage.defaultProps = {
  loginCallback: '/',
};

export default RenderToRoot(CubeListPage);
