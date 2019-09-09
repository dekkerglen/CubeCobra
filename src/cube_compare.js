import React, { Component } from 'react';
import ReactDOM from 'react-dom';

import CompareView from './components/CompareView';

class CubeCompare extends Component {
  constructor(props) {
    super(props);

    const cube = JSON.parse(document.getElementById('cuberaw').value);
    const cards = cube.map((card, index) => Object.assign(card, { index }));

    this.state = {
      cards: [],
      sorts: ['Color Category', 'Types-Multicolor'],
    };

    updateCubeListeners.push((_, cards) => this.setState({
      cards,
      sorts: [
        document.getElementById('primarySortSelect').value,
        document.getElementById('secondarySortSelect').value,
      ],
    }));
  }

  render() {
    return <CompareView cards={this.state.cards} sorts={this.state.sorts} {...this.props} />;
  }
}

const wrapper = document.getElementById('react-root');
wrapper ? ReactDOM.render(<CubeCompare both={in_both} onlyA={only_a} onlyB={only_b} />, wrapper) : false;
