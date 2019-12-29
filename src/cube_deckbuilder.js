import React from 'react';
import ReactDOM from 'react-dom';

import Deckbuilder from './components/Deckbuilder';

const wrapper = document.getElementById('react-root');
wrapper ? ReactDOM.render(<Deckbuilder {...reactProps} />, wrapper) : false;
