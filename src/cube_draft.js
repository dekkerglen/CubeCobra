import React, { useCallback, useState } from 'react';
import ReactDOM from 'react-dom';

import Draft from './util/Draft';

import DraftView from './components/DraftView';

const draft = JSON.parse(document.getElementById("draftraw").value);
Draft.init(draft);
const wrapper = document.getElementById('react-root');
wrapper ? ReactDOM.render(<DraftView />, wrapper) : false;
