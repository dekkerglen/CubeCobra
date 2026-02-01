import React, { useContext } from 'react';

import Card from '@utils/datatypes/Card';
import Cube from '@utils/datatypes/Cube';

import Container from 'components/base/Container';
import { Flexbox } from 'components/base/Layout';
import Text from 'components/base/Text';
import CubeListNavbar from 'components/cube/CubeListNavbar';
import CubeListRightSidebar from 'components/cube/CubeListRightSidebar';
import CurveView from 'components/cube/CurveView';
import ListView from 'components/cube/ListView';
import RotisserieDraftPanel from 'components/cube/RotisserieDraftPanel';
import ScryfallDragDropOverlay from 'components/cube/ScryfallDragDropOverlay';
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

const CubeListPageRaw: React.FC = () => {
  const { versionMismatch } = useContext(ChangesContext);
  const { changedCards, filterResult, canEdit } = useContext(CubeContext);
  const { showMaybeboard } = useContext(DisplayContext);
  const { filterInput } = useContext(FilterContext);

  const [cubeView, setCubeView] = useQueryParam('view', 'table');

  if (versionMismatch) {
    return (
      <>
        <Container xl>
          <CubeListNavbar cubeView={cubeView} setCubeView={setCubeView} />
        </Container>
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
    <>
      {canEdit && <ScryfallDragDropOverlay />}
      <Container xl>
        <CubeListNavbar cubeView={cubeView} setCubeView={setCubeView} />
      </Container>
      {filterResult && filterInput && filterInput.length > 0 && (
        <div className="text-center py-1">
          <Text italic sm>
            {showMaybeboard
              ? filterResult.maybeboard
                ? `Showing ${filterResult.maybeboard[0]} / ${filterResult.maybeboard[1]} cards in Maybeboard.`
                : 'Showing 0 / 0 cards in Maybeboard.'
              : filterResult.mainboard
                ? `Showing ${filterResult.mainboard[0]} / ${filterResult.mainboard[1]} cards in Mainboard.`
                : 'Showing 0 / 0 cards in Mainboard.'}
          </Text>
        </div>
      )}
      <DynamicFlash />
      <RotisserieDraftPanel />
      {Object.entries(changedCards)
        .map(([boardname, boardcards]) => (
          <ErrorBoundary key={boardname}>
            <Flexbox direction="col" gap="2">
              {((showMaybeboard && boardname === 'maybeboard') || (!showMaybeboard && boardname === 'mainboard')) && (
                <>
                  {boardcards.length === 0 && (
                    <Text semibold md className="text-center mt-4">
                      This board appears to be empty!
                    </Text>
                  )}
                  {
                    {
                      table: <TableView cards={boardcards} />,
                      spoiler: <VisualSpoiler cards={boardcards} />,
                      curve: <CurveView cards={boardcards} />,
                      list: <ListView cards={boardcards} />,
                    }[cubeView]
                  }
                </>
              )}
            </Flexbox>
          </ErrorBoundary>
        ))
        .reverse()}
    </>
  );
};

const CubeListPage: React.FC<CubeListPageProps> = ({ cube, cards }) => {
  return (
    <MainLayout useContainer={false}>
      <DisplayContextProvider cubeID={cube.id}>
        <RotoDraftContextProvider>
          <CubeLayout
            cube={cube}
            cards={cards}
            activeLink="list"
            loadVersionDict
            useChangedCards
            rightSidebar={<CubeListPageRightSidebarWrapper />}
          >
            <CubeListPageRaw />
          </CubeLayout>
        </RotoDraftContextProvider>
      </DisplayContextProvider>
    </MainLayout>
  );
};

const CubeListPageRightSidebarWrapper: React.FC = () => {
  const { canEdit } = useContext(CubeContext);
  return <CubeListRightSidebar canEdit={canEdit} />;
};

export default RenderToRoot(CubeListPage);
