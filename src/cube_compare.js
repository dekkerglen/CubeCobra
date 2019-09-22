import React, { Component } from 'react';
import ReactDOM from 'react-dom';

import Filter from './util/Filter';
import Hash from './util/Hash';

import CardModalForm from './components/CardModalForm';
import CompareView from './components/CompareView';
import CubeCompareNavbar from './components/CubeCompareNavbar';
import DynamicFlash from './components/DynamicFlash';
import SortContext from './components/SortContext';

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

  componentDidMount() {
    /* global */
    autocard_init('autocard');
  }

  componentDidUpdate() {
    /* global */
    autocard_init('autocard');
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
    const { cards, ...props } = this.props;
    const { openCollapse, filter } = this.state;
    const filteredCards = filter.length > 0 ? cards.filter(card => Filter.filterCard(card, filter)) : cards;
    return (
      <SortContext.Provider>
        <CubeCompareNavbar
          cards={filteredCards}
          openCollapse={openCollapse}
          setOpenCollapse={this.setOpenCollapse}
          filter={filter}
          setFilter={this.setFilter}
        />
        <DynamicFlash />
        <CardModalForm>
          <CompareView cards={filteredCards} {...props} />
        </CardModalForm>
      </SortContext.Provider>
    );
  }
}

const cube = JSON.parse(document.getElementById('cuberaw').value);
const cards = cube.map((card, index) => Object.assign(card, { index }));
const wrapper = document.getElementById('react-root');
const element = <CubeCompare cards={cards} both={in_both} onlyA={only_a} onlyB={only_b} />
wrapper ? ReactDOM.render(element, wrapper) : false;
