import React, { useContext, useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';

import { filterCard } from 'utils/Filter';
import LocalStorage from 'utils/LocalStorage';
import Query from 'utils/Query';

import CardModalForm from 'components/CardModalForm';
import { ChangelistContextProvider } from 'components/ChangelistContext';
import ClientOnly from 'components/ClientOnly';
import CubeContext from 'components/CubeContext';
import CubeListNavbar from 'components/CubeListNavbar';
import CurveView from 'components/CurveView';
import DisplayContext, { DisplayContextProvider } from 'components/DisplayContext';
import DynamicFlash from 'components/DynamicFlash';
import ErrorBoundary from 'components/ErrorBoundary';
import GroupModal from 'components/GroupModal';
import ListView from 'components/ListView';
import Maybeboard from 'components/Maybeboard';
import { MaybeboardContextProvider } from 'components/MaybeboardContext';
import { SortContextProvider } from 'components/SortContext';
import TableView from 'components/TableView';
import { TAG_COLORS, TagContextProvider } from 'components/TagContext';
import VisualSpoiler from 'components/VisualSpoiler';
import CubeLayout from 'layouts/CubeLayout';

const CubeListPageRaw = ({
  maybe,
  defaultFilterText,
  defaultView,
  defaultTagColors,
  defaultShowTagColors,
  defaultSorts,
}) => {
  const { cube, cubeID, canEdit } = useContext(CubeContext);

  const [cubeView, setCubeView] = useState(defaultView);
  const [openCollapse, setOpenCollapse] = useState(null);
  const [filter, setFilter] = useState([]);

  useEffect(() => {
    const savedChanges = cubeID && LocalStorage.get(`changelist-${cubeID}`);
    if (savedChanges && savedChanges.length > 2 && Query.get('updated', false) !== 'true') {
      setOpenCollapse('edit');
    } else if (defaultFilterText && defaultFilterText.length > 0) {
      setOpenCollapse('filter');
    }
  }, [cubeID, defaultFilterText]);

  useEffect(() => {
    if (cubeView === 'table') {
      Query.del('view');
    } else {
      Query.set('view', cubeView);
    }
  }, [cubeView]);

  const defaultTagSet = new Set([].concat(...cube.cards.map((card) => card.tags)));
  const defaultTags = [...defaultTagSet].map((tag) => ({
    id: tag,
    text: tag,
  }));

  const filteredCards = useMemo(() => {
    return filter.length > 0 ? cube.cards.filter((card) => filterCard(card, filter)) : cube.cards;
  }, [filter, cube]);

  return (
    <SortContextProvider defaultSorts={defaultSorts}>
      <DisplayContextProvider cubeID={cubeID}>
        <TagContextProvider
          cubeID={cubeID}
          defaultTagColors={defaultTagColors}
          defaultShowTagColors={defaultShowTagColors}
          defaultTags={defaultTags}
        >
          <ChangelistContextProvider cubeID={cubeID} setOpenCollapse={setOpenCollapse}>
            <CardModalForm>
              <GroupModal cubeID={cubeID} canEdit={canEdit}>
                <CubeListNavbar
                  cubeView={cubeView}
                  setCubeView={setCubeView}
                  openCollapse={openCollapse}
                  setOpenCollapse={setOpenCollapse}
                  defaultFilterText={defaultFilterText}
                  filter={filter}
                  setFilter={setFilter}
                  cards={filteredCards}
                  className="mb-3"
                />
                <DynamicFlash />
                <ErrorBoundary>
                  <ClientOnly>
                    <DisplayContext.Consumer>
                      {({ showMaybeboard }) => (
                        <MaybeboardContextProvider initialCards={maybe}>
                          {showMaybeboard && <Maybeboard filter={filter} />}
                        </MaybeboardContextProvider>
                      )}
                    </DisplayContext.Consumer>
                  </ClientOnly>
                </ErrorBoundary>
                <ErrorBoundary>
                  {filteredCards.length === 0 ? <h5 className="mt-1 mb-3">No cards match filter.</h5> : ''}
                  {
                    {
                      table: <TableView cards={filteredCards} />,
                      spoiler: <VisualSpoiler cards={filteredCards} />,
                      curve: <CurveView cards={filteredCards} />,
                      list: <ListView cards={filteredCards} />,
                    }[cubeView]
                  }
                </ErrorBoundary>
              </GroupModal>
            </CardModalForm>
          </ChangelistContextProvider>
        </TagContextProvider>
      </DisplayContextProvider>
    </SortContextProvider>
  );
};

CubeListPageRaw.propTypes = {
  maybe: PropTypes.arrayOf(PropTypes.object).isRequired,
  defaultTagColors: PropTypes.arrayOf(
    PropTypes.shape({
      tag: PropTypes.string.isRequired,
      color: PropTypes.oneOf(TAG_COLORS.map(([, c]) => c)),
    }),
  ).isRequired,
  defaultShowTagColors: PropTypes.bool.isRequired,
  defaultSorts: PropTypes.arrayOf(PropTypes.string).isRequired,
  defaultFilterText: PropTypes.string.isRequired,
  defaultView: PropTypes.string.isRequired,
};

const CubeListPage = ({ cube, cubeID, canEdit, ...props }) => (
  <CubeLayout cube={cube} cubeID={cubeID} canEdit={canEdit} activeLink="list">
    <CubeListPageRaw {...props} />
  </CubeLayout>
);

CubeListPage.propTypes = {
  cube: PropTypes.shape({
    cards: PropTypes.arrayOf(PropTypes.object).isRequired,
  }).isRequired,
  cubeID: PropTypes.string.isRequired,
  canEdit: PropTypes.bool,
  ...CubeListPageRaw.propTypes,
};

CubeListPage.defaultProps = {
  canEdit: false,
};

export default CubeListPage;
