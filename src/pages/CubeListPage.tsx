import React, { useContext } from 'react';

import Text from 'components/base/Text';
import CubeListNavbar from 'components/cube/CubeListNavbar';
import CurveView from 'components/cube/CurveView';
import DynamicFlash from 'components/DynamicFlash';
import ErrorBoundary from 'components/ErrorBoundary';
import ListView from 'components/cube/ListView';
import RenderToRoot from 'components/RenderToRoot';
import TableView from 'components/TableView';
import VisualSpoiler from 'components/cube/VisualSpoiler';
import CubeContext from 'contexts/CubeContext';
import DisplayContext, { DisplayContextProvider } from 'contexts/DisplayContext';
import useQueryParam from 'hooks/useQueryParam';
import CubeLayout from 'layouts/CubeLayout';
import MainLayout from 'layouts/MainLayout';
import Cube from 'datatypes/Cube';
import Card from 'datatypes/Card';
import FilterContext from 'contexts/FilterContext';

interface CubeListPageProps {
  cube: Cube;
  cards: {
    mainboard: Card[];
    maybeboard: Card[];
  };
  loginCallback?: string;
}

const CubeListPageRaw: React.FC = () => {
  const { changedCards } = useContext(CubeContext);
  const { showMaybeboard } = useContext(DisplayContext);
  const { cardFilter } = useContext(FilterContext);

  const [cubeView, setCubeView] = useQueryParam('view', 'table');

  const tagList = [];
  for (const [boardname, list] of Object.entries(changedCards)) {
    if (boardname !== 'id') {
      tagList.push(...new Set([...list.map((card) => card.tags || [])]));
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
                {boardname !== 'mainboard' && (
                  <Text semibold md>
                    {boardname}
                  </Text>
                )}
                {boardcards.length === 0 &&
                  (cardFilter ? (
                    <Text semibold md>
                      No cards match filter.
                    </Text>
                  ) : (
                    <Text semibold md>
                      This board is empty.
                    </Text>
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

const CubeListPage: React.FC<CubeListPageProps> = ({ cube, cards, loginCallback = '/' }) => (
  <MainLayout loginCallback={loginCallback}>
    <DisplayContextProvider cubeID={cube.id}>
      <CubeLayout cube={cube} cards={cards} activeLink="list" loadVersionDict useChangedCards hasControls>
        <CubeListPageRaw />
      </CubeLayout>
    </DisplayContextProvider>
  </MainLayout>
);

export default RenderToRoot(CubeListPage);
