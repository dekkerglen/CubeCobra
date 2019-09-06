import React, { Component } from 'react';
import ReactDOM from 'react-dom';

import CurveView from './components/CurveView';
import ListView from './components/ListView';
import TableView from './components/TableView';
import VisualSpoiler from './components/VisualSpoiler';

class CubeList extends Component {
  constructor(props) {
    super(props);

    const cube = JSON.parse(document.getElementById('cuberaw').value);
    const cards = cube.map((card, index) => Object.assign(card, { index }));

    this.state = {
      cards: filteredCube(),
      view: document.getElementById('viewSelect').value,
    };

    updateCubeListeners.push((view, cards) => this.setState({ view, cards }));
  }

  render() {
    let { view, cards } = this.state;
    return <>
      <TableView cards={cards} style={{ display: view === 'table' ? 'block' : 'none' }} />
      <VisualSpoiler cards={cards} style={{ display: view === 'spoiler' ? 'block' : 'none' }} />
      <CurveView cards={cards} style={{ display: view === 'curve' ? 'block' : 'none' }} />
      <ListView cards={cards} style={{ display: view === 'list' ? 'block' : 'none' }} />
    </>;
  }
}

const wrapper = document.getElementById('react-root');
wrapper ? ReactDOM.render(<CubeList />, wrapper) : false;
