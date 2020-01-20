import React, { useContext, useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';

import Filter from 'util/Filter';
import Hash from 'util/Hash';
import Query from 'util/Query';

import CardModalForm from 'components/CardModalForm';
import { ChangelistContextProvider } from 'components/ChangelistContext';
import CubeContext from 'components/CubeContext';
import CubeListNavbar from 'components/CubeListNavbar';
import CurveView from 'components/CurveView';
import DisplayContext, { DisplayContextProvider } from 'components/DisplayContext';
import DynamicFlash from 'components/DynamicFlash';
import ErrorBoundary from 'components/ErrorBoundary';
import GroupModal from 'components/GroupModal';
import ListView from 'components/ListView';
import Maybeboard from 'components/Maybeboard';
import { SortContextProvider } from 'components/SortContext';
import TableView from 'components/TableView';
import { tagColors, TagContextProvider } from 'components/TagContext';
import VisualSpoiler from 'components/VisualSpoiler';
import CubeLayout from 'layouts/CubeLayout';

const CubeListPageRaw = ({ maybe, defaultTagColors, defaultShowTagColors, defaultSorts }) => {
  const { cube, cubeID, canEdit } = useContext(CubeContext);

  let initialOpenCollapse = null;
  const savedChanges = cubeID && typeof localStorage !== 'undefined' && localStorage.getItem(`changelist-${cubeID}`);
  if (savedChanges && savedChanges.length > 2 && Query.get('updated', false) !== 'true') {
    initialOpenCollapse = 'edit';
  } else if (Hash.get('f', false)) {
    initialOpenCollapse = 'filter';
  }

  const [cubeView, setCubeView] = useState(Hash.get('view', 'table'));
  const [openCollapse, setOpenCollapse] = useState(initialOpenCollapse);
  const [filter, setFilter] = useState([]);

  useEffect(() => {
    if (cubeView === 'table') {
      Hash.del('view');
    } else {
      Hash.set('view', cubeView);
    }
  }, [cubeView]);

  const defaultTagSet = new Set([].concat.apply([], cube.map((card) => card.tags)));
  const defaultTags = [...defaultTagSet].map((tag) => ({
    id: tag,
    text: tag,
  }));

  const filteredCards = useMemo(() => {
    return filter.length > 0 ? cube.filter((card) => Filter.filterCard(card, filter)) : cube;
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
                  filter={filter}
                  setFilter={setFilter}
                  cards={filteredCards}
                  className="mb-3"
                />
                <DynamicFlash />
                <ErrorBoundary>
                  <DisplayContext.Consumer>
                    {({ showMaybeboard }) => showMaybeboard && <Maybeboard filter={filter} initialCards={maybe} />}
                  </DisplayContext.Consumer>
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

const CubeListPage = ({ cube, cubeID, canEdit, activeLink, ...props }) => (
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
  defaultTagColors: PropTypes.arrayOf(
    PropTypes.shape({
      tag: PropTypes.string.isRequired,
      color: PropTypes.oneOf(tagColors.map(([t, c]) => c)),
    }),
  ).isRequired,
  defaultShowTagColors: PropTypes.bool.isRequired,
  defaultSorts: PropTypes.arrayOf(PropTypes.string).isRequired,
};

export default CubeListPage;
