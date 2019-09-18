import React, { Component } from 'react';
import ReactDOM from 'react-dom';

import CurveView from './components/CurveView';
import ListView from './components/ListView';
import SortContext from './components/SortContext';
import TableView from './components/TableView';
import VisualSpoiler from './components/VisualSpoiler';

class CubeList extends Component {
  constructor(props) {
    super(props);

    const cube = JSON.parse(document.getElementById('cuberaw').value);

    this.state = {
      cards: [],
      cubeView: 'table',
    };

    updateCubeListeners.push((cubeView, cards) => this.setState({ cubeView, cards }));
  }

  render() {
    let { cubeView, cards } = this.state;
    return (
      <SortContext.Provider>
        <TableView cards={cards} style={{ display: cubeView === 'table' ? undefined : 'none' }} />
        <VisualSpoiler cards={cards} style={{ display: cubeView === 'spoiler' ? undefined : 'none' }} />
        <CurveView cards={cards} style={{ display: cubeView === 'curve' ? undefined : 'none' }} />
        <ListView cards={cards} style={{ display: cubeView === 'list' ? undefined : 'none' }} />
      </SortContext.Provider>
    );
  }
}

const wrapper = document.getElementById('react-root');
wrapper ? ReactDOM.render(<CubeList />, wrapper) : false;
