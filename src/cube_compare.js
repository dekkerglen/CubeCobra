import React, { Component } from 'react';
import ReactDOM from 'react-dom';

import CompareView from './components/CompareView';
import CubeCompareNavbar from './components/CubeCompareNavbar';
import SortContext from './components/SortContext';

class CubeCompare extends Component {
  constructor(props) {
    super(props);
  }

  componentDidMount() {
    /* global */
    init_contextModal();
  }

  render() {
    return (
      <SortContext.Provider>
        <CubeCompareNavbar />
        <CompareView {...this.props} />
      </SortContext.Provider>
    );
  }
}

const cube = JSON.parse(document.getElementById('cuberaw').value);
const cards = cube.map((card, index) => Object.assign(card, { index }));
const wrapper = document.getElementById('react-root');
const element = <CubeCompare cards={cards} both={in_both} onlyA={only_a} onlyB={only_b} />
wrapper ? ReactDOM.render(element, wrapper) : false;
