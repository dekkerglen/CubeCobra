import React from 'react';
import ReactDOM from 'react-dom';

import CubeDeckbuilderPage from 'components/CubeDeckbuilderPage';

const wrapper = document.getElementById('react-root');
wrapper ? ReactDOM.render(<CubeDeckbuilderPage {...reactProps} />, wrapper) : false;
