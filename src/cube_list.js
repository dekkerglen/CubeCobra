import React, { Component } from 'react';
import ReactDOM from 'react-dom';

import Filter from './util/Filter';
import Hash from './util/Hash';

import CardModalForm from './components/CardModalForm';
import CubeContext, { CubeContextProvider } from './components/CubeContext';
import CubeListNavbar from './components/CubeListNavbar';
import CurveView from './components/CurveView';
import { DisplayContextProvider } from './components/DisplayContext';
import DynamicFlash from './components/DynamicFlash';
import ErrorBoundary from './components/ErrorBoundary';
import GroupModal from './components/GroupModal';
import ListView from './components/ListView';
import SortContext from './components/SortContext';
import TableView from './components/TableView';
import TagContext from './components/TagContext';
import VisualSpoiler from './components/VisualSpoiler';

class CubeList extends Component {
  constructor(props) {
    super(props);

    this.state = {
      cubeView: Hash.get('view', 'table'),
      openCollapse: Hash.get('f', false) ? 'filter' : null,
      filter: [],
    };

    this.changeCubeView = this.changeCubeView.bind(this);
    this.setOpenCollapse = this.setOpenCollapse.bind(this);
    this.setFilter = this.setFilter.bind(this);
  }

  changeCubeView(cubeView) {
    if (cubeView === 'table') {
      Hash.del('view');
    } else {
      Hash.set('view', cubeView);
    }
    this.setState({ cubeView });
  }

  setOpenCollapse(collapseFunction) {
    this.setState(({ openCollapse }) => ({
      openCollapse: collapseFunction(openCollapse),
    }));
  }

  setFilter(filter) {
    this.setState({ filter });
  }

  render() {
    const { cards, cubeID, canEdit, defaultCards, defaultTagColors, defaultShowTagColors } = this.props;
    const { cubeView, openCollapse, filter } = this.state;
    const defaultTagSet = new Set([].concat.apply([], cards.map((card) => card.tags)));
    const defaultTags = [...defaultTagSet].map((tag) => ({
      id: tag,
      text: tag,
    }));
    const filteredCards = filter.length > 0 ? cards.filter((card) => Filter.filterCard(card, filter)) : cards;
    return (
      <SortContext.Provider>
        <DisplayContextProvider>
          <TagContext.Provider
            cubeID={cubeID}
            defaultTagColors={defaultTagColors}
            defaultShowTagColors={defaultShowTagColors}
            defaultTags={defaultTags}
          >
            <CardModalForm canEdit={canEdit} setOpenCollapse={this.setOpenCollapse}>
              <GroupModal cubeID={cubeID} canEdit={canEdit} setOpenCollapse={this.setOpenCollapse}>
                <CubeListNavbar
                  canEdit={canEdit}
                  cubeID={cubeID}
                  cubeView={cubeView}
                  changeCubeView={this.changeCubeView}
                  openCollapse={openCollapse}
                  setOpenCollapse={this.setOpenCollapse}
                  filter={filter}
                  setFilter={this.setFilter}
                  cards={filteredCards}
                  hasCustomImages={cards.some((card) => card.imgUrl)}
                />
                <DynamicFlash />
                <ErrorBoundary className="mt-3">
                  {filteredCards.length === 0 ? <h5 className="mt-4">No cards match filter.</h5> : ''}
                  {
                    {
                      table: <TableView cards={filteredCards} />,
                      spoiler: <VisualSpoiler cards={filteredCards} />,
                      curve: <CurveView cards={filteredCards} />,
                      list: <ListView cubeID={cubeID} cards={filteredCards} />,
                    }[cubeView]
                  }
                </ErrorBoundary>
              </GroupModal>
            </CardModalForm>
          </TagContext.Provider>
        </DisplayContextProvider>
      </SortContext.Provider>
    );
  }
}

const cube = JSON.parse(document.getElementById('cuberaw').value);
const cubeID = document.getElementById('cubeID').value;
const canEdit = document.getElementById('canEdit').value === 'true';
const defaultTagColors = JSON.parse(document.getElementById('cubeTagColors').value);
const defaultShowTagColors = document.getElementById('showTagColors').value === 'true';
const wrapper = document.getElementById('react-root');
const element = (
  <CubeContextProvider initialCube={cube}>
    <CubeContext.Consumer>
      {({ cube }) => (
        <CubeList
          cards={cube}
          canEdit={canEdit}
          cubeID={cubeID}
          defaultTagColors={defaultTagColors}
          defaultShowTagColors={defaultShowTagColors}
        />
      )}
    </CubeContext.Consumer>
  </CubeContextProvider>
);
wrapper && ReactDOM.render(element, wrapper);
