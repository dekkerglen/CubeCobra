import React from 'react';
import ReactDOM from 'react-dom';

import Draft from './util/Draft';

import BoosterDraftPage from './components/BoosterDraftPage';
import GridDraftPage from './components/GridDraftPage';

const element = {
  booster: Draft.init(initialDraft) || <BoosterDraftPage />,
  grid: <GridDraftPage initialDraft={initialDraft} />,
}[initialDraft.type || 'booster'];
const wrapper = document.getElementById('react-root');
wrapper && ReactDOM.render(element, wrapper);
