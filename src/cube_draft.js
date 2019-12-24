import React from 'react';
import ReactDOM from 'react-dom';

import Draft from './util/Draft';

import DraftView from './components/DraftView';

Draft.init(initialDraft);
const wrapper = document.getElementById('react-root');
wrapper ? ReactDOM.render(<DraftView />, wrapper) : false;
