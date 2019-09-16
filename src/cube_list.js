import React, { Component } from 'react';
import ReactDOM from 'react-dom';

import CubeListNavbar from './components/CubeListNavbar';
import CurveView from './components/CurveView';
import DisplayContext from './components/DisplayContext';
import ListView from './components/ListView';
import SortContext from './components/SortContext';
import TableView from './components/TableView';
import TagContext from './components/TagContext';
import VisualSpoiler from './components/VisualSpoiler';

class CubeList extends Component {
  constructor(props) {
    super(props);

    this.state = {
      cubeView: 'table',
    };

    this.changeCubeView = this.changeCubeView.bind(this);
  }

  componentDidMount() {
    /* global */
    init_groupcontextModal();
    autocard_init('autocard');
  }

  componentDidUpdate() {
    /* global */
    init_groupcontextModal();
    autocard_init('autocard');
  }

  changeCubeView(cubeView) {
    this.setState({ cubeView });
  }

  render() {
    const { cards, canEdit } = this.props;
    const { cubeView } = this.state;
    const defaultTagSet = new Set([].concat.apply([], cards.map(card => card.tags)));
    const defaultTags = [...defaultTagSet].map(tag => ({
      id: tag,
      text: tag,
    }))
    return (
      <SortContext.Provider>
        <DisplayContext.Provider>
          <CubeListNavbar
            canEdit={canEdit}
            cubeID={cubeID}
            cubeView={cubeView}
            changeCubeView={this.changeCubeView}
            hasCustomImages={cards.some(card => card.imgUrl)}
          />
          <TagContext.Provider defaultTags={defaultTags}>
            {{
              'table': <TableView cards={cards} />,
              'spoiler': <VisualSpoiler cards={cards} />,
              'curve': <CurveView cards={cards} />,
              'list': <ListView cards={cards} />,
            }[cubeView]}
          </TagContext.Provider>
        </DisplayContext.Provider>
      </SortContext.Provider>
    );
  }
}

const cube = JSON.parse(document.getElementById('cuberaw').value);
cube.forEach((card, index) => {
  card.index = index;
  cubeDict[index] = card;
});
const cubeID = document.getElementById('cubeID').value;
const canEdit = document.getElementById('canEdit').value;
const wrapper = document.getElementById('react-root');
const element = <CubeList cards={cube} canEdit={canEdit} cubeID={cubeID} />;
wrapper ? ReactDOM.render(element, wrapper) : false;
