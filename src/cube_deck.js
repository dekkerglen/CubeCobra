import React from 'react';
import ReactDOM from 'react-dom';

import CubeDeckPage from 'pages/CubeDeckPage';

const element = <CubeDeckPage {...reactProps} />;
const wrapper = document.getElementById('react-root');
wrapper ? ReactDOM.render(element, wrapper) : false;
