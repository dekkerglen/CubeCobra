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
    const { cards, cubeID, defaultTagColors, defaultShowTagColors, defaultSorts, ...props } = this.props;
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
            defaultTagColors={defaultTagColors}
            defaultShowTagColors={defaultShowTagColors}
            defaultTags={defaultTags}
          >
            <CubeCompareNavbar
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

const cube = JSON.parse(document.getElementById('cuberaw').value);
const cubeID = document.getElementById('cubeID').value;
const cards = cube.map((card, index) => Object.assign(card, { index }));
const defaultTagColors = deduplicateTags(JSON.parse(document.getElementById('cubeTagColors').value));
const defaultShowTagColors = document.getElementById('showTagColors').value === 'true';
const defaultSorts = [document.getElementById('sort1').value, document.getElementById('sort2').value];
const wrapper = document.getElementById('react-root');
const element = (
  <CubeCompare
    cards={cards}
    both={in_both}
    onlyA={only_a}
    onlyB={only_b}
    cubeID={cubeID}
    defaultTagColors={defaultTagColors}
    defaultShowTagColors={defaultShowTagColors}
    defaultSorts={defaultSorts}
  />
);
wrapper ? ReactDOM.render(element, wrapper) : false;
