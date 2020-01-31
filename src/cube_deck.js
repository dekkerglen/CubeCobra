import React from 'react';
import ReactDOM from 'react-dom';

import CubeDeckPage from 'pages/CubeDeckPage';

const element = <CubeDeckPage {...window.reactProps} />;
const wrapper = document.getElementById('react-root');
if (wrapper) {
  ReactDOM.render(element.wrapper);
}
