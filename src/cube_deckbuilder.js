import React from 'react';
import ReactDOM from 'react-dom';

import CubeDeckbuilderPage from 'pages/CubeDeckbuilderPage';

const wrapper = document.getElementById('react-root');
wrapper ? ReactDOM.render(<CubeDeckbuilderPage {...window.reactProps} />, wrapper) : false;
