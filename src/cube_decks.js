import React from 'react';
import ReactDOM from 'react-dom';

import CubeDecksPage from 'pages/CubeDecksPage';

const element = <CubeDecksPage {...window.reactProps} />;
const wrapper = document.getElementById('react-root');
if (wrapper) {
  ReactDOM.render(element, wrapper);
}
