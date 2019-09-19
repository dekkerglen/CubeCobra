import React, { Component } from 'react';
import ReactDOM from 'react-dom';

import CardModalForm from './components/CardModalForm';
import CompareView from './components/CompareView';
import CubeCompareNavbar from './components/CubeCompareNavbar';
import DynamicFlash from './components/DynamicFlash';
import SortContext from './components/SortContext';

class CubeCompare extends Component {
  constructor(props) {
    super(props);

    this.state = {
      cards: this.props.defaultCards,
    };

    /* global */
    updateCubeListeners.push(cards => this.setState({ cards }));
  }

  componentDidMount() {
    /* global */
    init_groupcontextModal();
  }

  render() {
    const { defaultCards, ...props} = this.props;
    const { cards } = this.state;
    return (
      <SortContext.Provider>
        <CubeCompareNavbar />
        <DynamicFlash />
        <CardModalForm>
          <CompareView cards={cards} {...props} />
        </CardModalForm>
      </SortContext.Provider>
    );
  }
}

const cube = JSON.parse(document.getElementById('cuberaw').value);
const cards = cube.map((card, index) => Object.assign(card, { index }));
const wrapper = document.getElementById('react-root');
const element = <CubeCompare defaultCards={cards} both={in_both} onlyA={only_a} onlyB={only_b} />
wrapper ? ReactDOM.render(element, wrapper) : false;
