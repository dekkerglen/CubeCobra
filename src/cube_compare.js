import React, { Component } from 'react';
import ReactDOM from 'react-dom';

import Filter from './util/Filter';
import Hash from './util/Hash';

import CardModalForm from './components/CardModalForm';
import CompareView from './components/CompareView';
import CubeCompareNavbar from './components/CubeCompareNavbar';
import { DisplayContextProvider } from './components/DisplayContext';
import DynamicFlash from './components/DynamicFlash';
import ErrorBoundary from './components/ErrorBoundary';
import { SortContextProvider } from './components/SortContext';
import { TagContextProvider } from './components/TagContext';

const deduplicateTags = (tagColors) => {
  const used = new Set();
  const result = [];
  for (const tagColor of tagColors) {
    if (!used.has(tagColor.tag)) {
      result.push(tagColor);
      used.add(tagColor.tag);
    }
  }
  return result;
};

class CubeCompare extends Component {
  constructor(props) {
    super(props);

    this.state = {
      openCollapse: Hash.get('f', false) ? 'filter' : null,
      filter: [],
    };

    this.setOpenCollapse = this.setOpenCollapse.bind(this);
    this.setFilter = this.setFilter.bind(this);
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
    const { cards, cubeID, cube, cubeBID, cubeB, defaultTagColors, defaultShowTagColors, defaultSorts, ...props } = this.props;
    const { openCollapse, filter } = this.state;
    const defaultTagSet = new Set([].concat.apply([], cards.map((card) => card.tags)));
    const defaultTags = [...defaultTagSet].map((tag) => ({
      id: tag,
      text: tag,
    }));
    const filteredCards = filter.length > 0 ? cards.filter((card) => Filter.filterCard(card, filter)) : cards;
    return (
      <SortContextProvider defaultSorts={defaultSorts}>
        <DisplayContextProvider>
          <TagContextProvider
            cubeID={cubeID}
            defaultTagColors={deduplicateTags(defaultTagColors)}
            defaultShowTagColors={defaultShowTagColors}
            defaultTags={defaultTags}
          >
            <CubeCompareNavbar
              cubeA={cube}
              cubeAID={cubeID}
              cubeB={cubeB}
              cubeBID={cubeBID}
              cards={filteredCards}
              openCollapse={openCollapse}
              setOpenCollapse={this.setOpenCollapse}
              filter={filter}
              setFilter={this.setFilter}
            />
            <DynamicFlash />
            <ErrorBoundary>
              <CardModalForm>
                <CompareView cards={filteredCards} {...props} />
              </CardModalForm>
            </ErrorBoundary>
          </TagContextProvider>
        </DisplayContextProvider>
      </SortContextProvider>
    );
  }
}

const wrapper = document.getElementById('react-root');
const element = (
  <CubeCompare {...reactProps} />
);
wrapper ? ReactDOM.render(element, wrapper) : false;
