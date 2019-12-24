import React from 'react';
import ReactDOM from 'react-dom';

import Draft from './util/Draft';

import DraftView from './components/DraftView';

const draft = JSON.parse(document.getElementById("draftraw").value);
window.draftGlobal = draft;
Draft.init(draft);
const wrapper = document.getElementById('react-root');
wrapper ? ReactDOM.render(<DraftView />, wrapper) : false;
