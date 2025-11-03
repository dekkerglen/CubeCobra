import React, { useContext } from 'react';

import { Flexbox } from 'components/base/Layout';
import Text from 'components/base/Text';
import CubeListNavbar from 'components/cube/CubeListNavbar';
import CurveView from 'components/cube/CurveView';
import ListView from 'components/cube/ListView';
import RotisserieDraftPanel from 'components/cube/RotisserieDraftPanel';
import TableView from 'components/cube/TableView';
import VersionMismatch from 'components/cube/VersionMismatch';
import VisualSpoiler from 'components/cube/VisualSpoiler';
import DynamicFlash from 'components/DynamicFlash';
import ErrorBoundary from 'components/ErrorBoundary';
import RenderToRoot from 'components/RenderToRoot';
import ChangesContext from 'contexts/ChangesContext';
import CubeContext from 'contexts/CubeContext';
import DisplayContext, { DisplayContextProvider } from 'contexts/DisplayContext';
import FilterContext from 'contexts/FilterContext';
import { RotoDraftContextProvider } from 'contexts/RotoDraftContext';
import Card, { BoardType } from 'datatypes/Card';
import Cube from 'datatypes/Cube';
import useQueryParam from 'hooks/useQueryParam';
import CubeLayout from 'layouts/CubeLayout';
import MainLayout from 'layouts/MainLayout';

interface CubeListPageProps {
  cube: Cube;
  cards: {
    mainboard: Card[];
    maybeboard: Card[];
  };
}

const boardToName: Record<BoardType, string> = {
  mainboard: 'Mainboard',
  maybeboard: 'Maybeboard',
};

const CubeListPageRaw: React.FC = () => {
  const { versionMismatch } = useContext(ChangesContext);
  const { changedCards } = useContext(CubeContext);
  const { showMaybeboard } = useContext(DisplayContext);
  const { cardFilter } = useContext(FilterContext);

  const [cubeView, setCubeView] = useQueryParam('view', 'table');

  if (versionMismatch) {
    return (
      <>
        <CubeListNavbar cubeView={cubeView} setCubeView={setCubeView} />
        <DynamicFlash />
        <VersionMismatch />
      </>
    );
  }

  const tagList = [];
  for (const [boardname, list] of Object.entries(changedCards)) {
    if (boardname !== 'id') {
      tagList.push(...new Set([...list.map((card) => card.tags || [])]));
    }
  }

  return (
    <RotoDraftContextProvider>
      <CubeListNavbar cubeView={cubeView} setCubeView={setCubeView} />
      <DynamicFlash />
      <RotisserieDraftPanel />
      {Object.entries(changedCards)
        .map(([boardname, boardcards]) => (
          <ErrorBoundary key={boardname}>
            <Flexbox direction="col" gap="2">
              {(showMaybeboard || boardname !== 'maybeboard') && (
                <>
                  {boardname !== 'mainboard' && (
                    <Text semibold md>
                      {boardToName[boardname as BoardType]}
                    </Text>
                  )}
                  {boardcards.length === 0 &&
                    (cardFilter ? (
                      <Text semibold md>
                        No {boardname === 'mainboard' ? 'Mainboard' : 'Maybeboard'} cards match filter.
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
            </Flexbox>
          </ErrorBoundary>
        ))
        .reverse()}
    </RotoDraftContextProvider>
  );
};

const CubeListPage: React.FC<CubeListPageProps> = ({ cube, cards }) => (
  <MainLayout>
    <DisplayContextProvider cubeID={cube.id}>
      <CubeLayout cube={cube} cards={cards} activeLink="list" loadVersionDict useChangedCards hasControls>
        <CubeListPageRaw />
      </CubeLayout>
    </DisplayContextProvider>
  </MainLayout>
);

export default RenderToRoot(CubeListPage);
